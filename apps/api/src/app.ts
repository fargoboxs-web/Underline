import Fastify from "fastify";
import {
  CleanArticleRequestSchema,
  CleanArticleResponseSchema,
  ExplanationRequestSchema,
  ExplanationResponseSchema,
  ProviderConfigResponseSchema,
  ProviderConfigSchema,
  ProviderConfigTestSchema,
  type ExplanationRequest,
  type ProviderConfig
} from "@underline/shared";

import type { AppConfig } from "./config";
import type { LLMClient } from "./llm/client";
import { UpstreamLLMError } from "./llm/errors";
import { MockLLMClient } from "./llm/mock";
import { OpenAICompatibleClient } from "./llm/openai-compatible";
import { RuntimeConfigStore } from "./runtime-config";

export type LLMClientFactory = (
  providerConfig: ProviderConfig,
  request?: ExplanationRequest
) => LLMClient;

function isChineseRequest(request: ExplanationRequest): boolean {
  if (request.page.language.toLowerCase().startsWith("zh")) {
    return true;
  }

  return /[\u4e00-\u9fff]/.test(
    request.contextWindow.paragraphs.map((paragraph) => paragraph.text).join(" ")
  );
}

function buildUnconfiguredReason(request: ExplanationRequest): string {
  return isChineseRequest(request)
    ? "未配置真实模型，当前使用本地 Demo 解释。"
    : "No real model is configured, so the local demo explanation is being used.";
}

function buildFallbackReason(
  request: ExplanationRequest,
  error: UpstreamLLMError
): string {
  return isChineseRequest(request)
    ? `真实模型暂时不可用，已回退到本地 Demo：${error.message}`
    : `The real model is temporarily unavailable, so Underline fell back to the local demo: ${error.message}`;
}

function buildClient(
  providerConfig: ProviderConfig,
  request?: ExplanationRequest
): LLMClient {
  if (providerConfig.apiKey && providerConfig.model) {
    return new OpenAICompatibleClient(providerConfig);
  }

  return new MockLLMClient({
    fallbackReason: request
      ? buildUnconfiguredReason(request)
      : "No real model is configured, so the local demo explanation is being used."
  });
}

function isPrivilegedOrigin(origin: string | undefined): boolean {
  return !origin || origin.startsWith("chrome-extension://") || origin.startsWith("moz-extension://");
}

export function buildServer(
  config: AppConfig,
  runtimeStore = new RuntimeConfigStore(config),
  clientFactory: LLMClientFactory = buildClient
) {
  const app = Fastify({
    logger: false
  });

  app.addHook("onRequest", async (request, reply) => {
    reply.header(
      "Access-Control-Allow-Origin",
      request.headers.origin && isPrivilegedOrigin(request.headers.origin)
        ? request.headers.origin
        : "*"
    );
    reply.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
    reply.header("Access-Control-Allow-Methods", "GET, POST, PUT, OPTIONS");

    if (request.method === "OPTIONS") {
      reply.code(204).send();
    }
  });

  app.get("/health", async () => ({
    ok: true
  }));

  app.get("/v1/provider-config", async (request, reply) => {
    if (!isPrivilegedOrigin(request.headers.origin)) {
      reply.code(403);
      return {
        error: "Provider config is only available to the extension UI or local tools."
      };
    }

    reply.code(200);
    return ProviderConfigResponseSchema.parse(runtimeStore.getProviderConfigResponse());
  });

  app.put("/v1/provider-config", async (request, reply) => {
    if (!isPrivilegedOrigin(request.headers.origin)) {
      reply.code(403);
      return {
        error: "Provider config updates are only available to the extension UI or local tools."
      };
    }

    const parsedBody = ProviderConfigSchema.safeParse(request.body);

    if (!parsedBody.success) {
      reply.code(400);
      return {
        error: "Invalid provider config.",
        details: parsedBody.error.flatten()
      };
    }

    const payload = await runtimeStore.saveProviderConfig(parsedBody.data);
    reply.code(200);
    return ProviderConfigResponseSchema.parse(payload);
  });

  app.post("/v1/provider-config/test", async (request, reply) => {
    if (!isPrivilegedOrigin(request.headers.origin)) {
      reply.code(403);
      return {
        error: "Provider config tests are only available to the extension UI or local tools."
      };
    }

    const parsedBody =
      request.body && Object.keys((request.body as Record<string, unknown>) ?? {}).length > 0
        ? ProviderConfigSchema.safeParse(request.body)
        : {
            success: true as const,
            data: runtimeStore.getProviderConfig()
          };

    if (!parsedBody.success) {
      reply.code(400);
      return {
        error: "Invalid provider config.",
        details: parsedBody.error.flatten()
      };
    }

    const providerConfig = parsedBody.data;

    if (!providerConfig.apiKey || !providerConfig.model) {
      reply.code(200);
      return ProviderConfigTestSchema.parse({
        ok: true,
        mode: "mock",
        message: "当前还没配置真实模型，后端会继续使用 mock 教学模式。"
      });
    }

    try {
      await new OpenAICompatibleClient(providerConfig).testConnection();
      reply.code(200);
      return ProviderConfigTestSchema.parse({
        ok: true,
        mode: "configured",
        message: `已连接到模型 ${providerConfig.model}。`
      });
    } catch (error) {
      reply.code(400);
      return ProviderConfigTestSchema.parse({
        ok: false,
        mode: "configured",
        message:
          error instanceof Error
            ? `${error.message}。你仍然可以直接使用插件，解释时会自动回退到本地 Demo 模式。`
            : "连接测试失败。你仍然可以直接使用插件，解释时会自动回退到本地 Demo 模式。"
      });
    }
  });

  app.post("/v1/articles/clean", async (request, reply) => {
    const parsedBody = CleanArticleRequestSchema.safeParse(request.body);

    if (!parsedBody.success) {
      reply.code(400);
      return {
        error: "Invalid clean article request.",
        details: parsedBody.error.flatten()
      };
    }

    const input = parsedBody.data;
    const providerConfig = runtimeStore.getProviderConfig();

    if (!providerConfig.apiKey || !providerConfig.model) {
      reply.code(409);
      return {
        error: "Clean article generation requires a configured real model."
      };
    }

    try {
      const result = await clientFactory(providerConfig).cleanArticle(input);
      const payload = CleanArticleResponseSchema.parse(result);

      reply.code(200);
      return payload;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unexpected clean article error.";

      reply.code(error instanceof UpstreamLLMError ? 502 : 500);
      return {
        error: message
      };
    }
  });

  app.post("/v1/explanations", async (request, reply) => {
    const parsedBody = ExplanationRequestSchema.safeParse(request.body);

    if (!parsedBody.success) {
      reply.code(400);
      return {
        error: "Invalid explanation request.",
        details: parsedBody.error.flatten()
      };
    }

    const input = parsedBody.data as ExplanationRequest;

    try {
      const result = await clientFactory(runtimeStore.getProviderConfig(), input).explain(input);
      const payload = ExplanationResponseSchema.parse(result);

      reply.code(200);
      return payload;
    } catch (error) {
      if (error instanceof UpstreamLLMError) {
        const fallback = await new MockLLMClient({
          disclosureLabel: isChineseRequest(input) ? "AI 演示" : "AI demo",
          fallbackReason: buildFallbackReason(input, error)
        }).explain(input);
        const payload = ExplanationResponseSchema.parse({
          ...fallback
        });

        reply.code(200);
        return payload;
      }

      const message =
        error instanceof Error ? error.message : "Unexpected explanation error.";

      reply.code(500);
      return {
        error: message
      };
    }
  });

  return app;
}
