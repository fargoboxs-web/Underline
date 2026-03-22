import Fastify from "fastify";
import {
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

function buildClient(providerConfig: ProviderConfig): LLMClient {
  if (providerConfig.apiKey && providerConfig.model) {
    return new OpenAICompatibleClient(providerConfig);
  }

  return new MockLLMClient();
}

function isPrivilegedOrigin(origin: string | undefined): boolean {
  return !origin || origin.startsWith("chrome-extension://") || origin.startsWith("moz-extension://");
}

export function buildServer(
  config: AppConfig,
  runtimeStore = new RuntimeConfigStore(config)
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

  app.post("/v1/explanations", async (request, reply) => {
    const parsedBody = ExplanationRequestSchema.safeParse(request.body);

    if (!parsedBody.success) {
      reply.code(400);
      return {
        error: "Invalid explanation request.",
        details: parsedBody.error.flatten()
      };
    }

    try {
      const result = await buildClient(runtimeStore.getProviderConfig()).explain(
        parsedBody.data as ExplanationRequest
      );
      const payload = ExplanationResponseSchema.parse(result);

      reply.code(200);
      return payload;
    } catch (error) {
      if (error instanceof UpstreamLLMError) {
        const fallback = await new MockLLMClient().explain(parsedBody.data as ExplanationRequest);
        const payload = ExplanationResponseSchema.parse({
          ...fallback,
          disclosureLabel:
            parsedBody.data.page.language.toLowerCase().startsWith("zh") ||
            /[\u4e00-\u9fff]/.test(
              parsedBody.data.contextWindow.paragraphs.map((paragraph) => paragraph.text).join(" ")
            )
              ? "AI 演示"
              : "AI demo"
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
