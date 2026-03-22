import {
  ExplanationResponseSchema,
  type ProviderConfig,
  type ExplanationRequest,
  type ExplanationResponse
} from "@underline/shared";

import { buildSystemPrompt, buildUserPrompt } from "../prompt";
import type { LLMClient } from "./client";
import { UpstreamLLMError } from "./errors";

type WireApi = "responses" | "chat-completions";

function extractJson(content: string): unknown {
  const trimmed = content.trim();

  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    return JSON.parse(trimmed);
  }

  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");

  if (firstBrace >= 0 && lastBrace > firstBrace) {
    return JSON.parse(trimmed.slice(firstBrace, lastBrace + 1));
  }

  throw new Error("Model did not return JSON.");
}

function extractTextFromContentParts(content: unknown): string {
  if (typeof content === "string") {
    return content;
  }

  if (!Array.isArray(content)) {
    return "";
  }

  return content
    .map((part) => {
      if (typeof part === "string") {
        return part;
      }

      if (part && typeof part === "object") {
        const record = part as Record<string, unknown>;

        if (typeof record.text === "string") {
          return record.text;
        }
      }

      return "";
    })
    .join("")
    .trim();
}

function extractChatCompletionText(payload: unknown): string {
  if (!payload || typeof payload !== "object") {
    return "";
  }

  const choices = (payload as { choices?: Array<{ message?: { content?: unknown } }> }).choices;
  return extractTextFromContentParts(choices?.[0]?.message?.content);
}

function extractResponsesText(payload: unknown): string {
  if (!payload || typeof payload !== "object") {
    return "";
  }

  const record = payload as {
    output_text?: string;
    output?: Array<{
      type?: string;
      content?: Array<{
        type?: string;
        text?: string;
      }>;
    }>;
  };

  if (typeof record.output_text === "string" && record.output_text.trim()) {
    return record.output_text.trim();
  }

  const text = record.output
    ?.flatMap((item) => item.content ?? [])
    .map((part) => part.text ?? "")
    .join("")
    .trim();

  return text ?? "";
}

async function parseUpstreamError(response: Response): Promise<UpstreamLLMError> {
  const rawText = await response.text();
  let details: unknown = rawText;
  let message = `LLM request failed with status ${response.status}.`;

  if (rawText) {
    try {
      const parsed = JSON.parse(rawText) as {
        error?: {
          message?: string;
          type?: string;
          code?: string;
        };
        message?: string;
        code?: string;
      };

      details = parsed;
      const upstreamMessage =
        parsed.error?.message ??
        parsed.message ??
        parsed.code ??
        `HTTP ${response.status}`;
      message = `LLM request failed with status ${response.status}: ${upstreamMessage}`;
    } catch {
      message = `LLM request failed with status ${response.status}: ${rawText.slice(0, 300)}`;
    }
  }

  return new UpstreamLLMError(message, response.status, details);
}

function shouldRetryWithoutJsonMode(error: UpstreamLLMError): boolean {
  if (error.status < 400 || error.status >= 500) {
    return false;
  }

  const message = error.message.toLowerCase();
  return (
    message.includes("response_format") ||
    message.includes("json_object") ||
    message.includes("json schema") ||
    message.includes("unsupported parameter") ||
    message.includes("text.format")
  );
}

function shouldTryAlternateProtocol(error: UpstreamLLMError): boolean {
  if ([401, 403].includes(error.status)) {
    return false;
  }

  if ([404, 405, 415, 422].includes(error.status)) {
    return true;
  }

  if (error.status !== 400) {
    return false;
  }

  const message = error.message.toLowerCase();
  return (
    message.includes("unsupported") ||
    message.includes("unknown parameter") ||
    message.includes("invalid url") ||
    message.includes("not found") ||
    message.includes("does not support")
  );
}

function buildEndpoint(apiUrl: string, wireApi: WireApi): string {
  const url = new URL(apiUrl);
  const pathname = url.pathname.replace(/\/+$/, "");

  if (wireApi === "responses") {
    if (pathname.endsWith("/responses")) {
      return url.toString();
    }

    if (pathname.endsWith("/chat/completions")) {
      url.pathname = pathname.replace(/\/chat\/completions$/, "/responses");
      return url.toString();
    }

    if (!pathname || pathname === "/") {
      url.pathname = "/v1/responses";
      return url.toString();
    }

    url.pathname = `${pathname}/responses`;
    return url.toString();
  }

  if (pathname.endsWith("/chat/completions")) {
    return url.toString();
  }

  if (pathname.endsWith("/responses")) {
    url.pathname = pathname.replace(/\/responses$/, "/chat/completions");
    return url.toString();
  }

  if (!pathname || pathname === "/") {
    url.pathname = "/v1/chat/completions";
    return url.toString();
  }

  url.pathname = `${pathname}/chat/completions`;
  return url.toString();
}

function chooseProtocolOrder(config: ProviderConfig): WireApi[] {
  if (config.wireApi === "responses") {
    return ["responses"];
  }

  if (config.wireApi === "chat-completions") {
    return ["chat-completions"];
  }

  if (/^gpt-5(\b|[.-])|codex/i.test(config.model)) {
    return ["responses", "chat-completions"];
  }

  return ["chat-completions", "responses"];
}

export class OpenAICompatibleClient implements LLMClient {
  constructor(private readonly config: ProviderConfig) {}

  private async postJson(endpoint: string, body: Record<string, unknown>): Promise<unknown> {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.config.apiKey}`
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(this.config.timeoutMs)
    });

    if (!response.ok) {
      throw await parseUpstreamError(response);
    }

    return response.json();
  }

  private async createChatCompletion(
    request: ExplanationRequest,
    useJsonMode: boolean
  ): Promise<string> {
    const payload = await this.postJson(buildEndpoint(this.config.apiUrl, "chat-completions"), {
      model: this.config.model,
      temperature: 0.4,
      ...(useJsonMode ? { response_format: { type: "json_object" } } : {}),
      messages: [
        {
          role: "system",
          content: buildSystemPrompt()
        },
        {
          role: "user",
          content: buildUserPrompt(request)
        }
      ]
    });

    const content = extractChatCompletionText(payload);

    if (!content) {
      throw new Error("Chat Completions returned an empty response.");
    }

    return content;
  }

  private async createResponse(
    request: ExplanationRequest,
    useJsonMode: boolean
  ): Promise<string> {
    const payload = await this.postJson(buildEndpoint(this.config.apiUrl, "responses"), {
      model: this.config.model,
      temperature: 0.4,
      ...(useJsonMode
        ? {
            text: {
              format: {
                type: "json_object"
              }
            }
          }
        : {}),
      input: [
        {
          role: "system",
          content: [
            {
              type: "input_text",
              text: buildSystemPrompt()
            }
          ]
        },
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: buildUserPrompt(request)
            }
          ]
        }
      ]
    });

    const content = extractResponsesText(payload);

    if (!content) {
      throw new Error("Responses API returned an empty response.");
    }

    return content;
  }

  private async generateJsonText(
    request: ExplanationRequest,
    wireApi: WireApi
  ): Promise<string> {
    const run = (useJsonMode: boolean) =>
      wireApi === "responses"
        ? this.createResponse(request, useJsonMode)
        : this.createChatCompletion(request, useJsonMode);

    try {
      return await run(true);
    } catch (error) {
      if (!(error instanceof UpstreamLLMError) || !shouldRetryWithoutJsonMode(error)) {
        throw error;
      }

      return run(false);
    }
  }

  async explain(request: ExplanationRequest): Promise<ExplanationResponse> {
    const protocols = chooseProtocolOrder(this.config);
    let lastError: unknown;

    for (const wireApi of protocols) {
      try {
        const content = await this.generateJsonText(request, wireApi);
        const parsed = extractJson(content) as Record<string, unknown>;

        return ExplanationResponseSchema.parse({
          bridgeId: crypto.randomUUID(),
          insertAfterAnchor: request.newHighlights[request.newHighlights.length - 1].anchor,
          bridgeText: parsed.bridgeText,
          disclosureLabel: parsed.disclosureLabel ?? "AI bridge",
          inferredGapTags: parsed.inferredGapTags ?? [],
          source: "ai"
        });
      } catch (error) {
        lastError = error;

        if (!(error instanceof UpstreamLLMError) || !shouldTryAlternateProtocol(error)) {
          throw error;
        }
      }
    }

    throw lastError instanceof Error ? lastError : new Error("LLM request failed.");
  }

  async testConnection(): Promise<void> {
    const protocols = chooseProtocolOrder(this.config);
    let lastError: unknown;

    for (const wireApi of protocols) {
      try {
        if (wireApi === "responses") {
          await this.postJson(buildEndpoint(this.config.apiUrl, "responses"), {
            model: this.config.model,
            max_output_tokens: 1,
            input: [
              {
                role: "user",
                content: [
                  {
                    type: "input_text",
                    text: "Respond with OK."
                  }
                ]
              }
            ]
          });
        } else {
          await this.postJson(buildEndpoint(this.config.apiUrl, "chat-completions"), {
            model: this.config.model,
            max_tokens: 1,
            temperature: 0,
            messages: [
              {
                role: "user",
                content: "Respond with OK."
              }
            ]
          });
        }

        return;
      } catch (error) {
        lastError = error;

        if (!(error instanceof UpstreamLLMError) || !shouldTryAlternateProtocol(error)) {
          throw error;
        }
      }
    }

    throw lastError instanceof Error ? lastError : new Error("Connection test failed.");
  }
}
