import { rm } from "node:fs/promises";

import { afterAll, beforeAll, describe, expect, test } from "vitest";

import { buildServer } from "../src/app";
import { loadConfig } from "../src/config";
import { UpstreamLLMError } from "../src/llm/errors";
import { RuntimeConfigStore } from "../src/runtime-config";
import { explanationCases } from "./fixtures/explanation-cases";

describe("POST /v1/explanations", () => {
  const runtimeConfigPath = ".test-runtime-app.json";
  const config = loadConfig({
    API_PORT: "8787",
    RUNTIME_CONFIG_PATH: runtimeConfigPath,
    LLM_TIMEOUT_MS: "5000"
  });
  const runtimeStore = new RuntimeConfigStore(config);
  const app = buildServer(config, runtimeStore);

  beforeAll(async () => {
    await rm(runtimeConfigPath, { force: true });
    await runtimeStore.load();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
    await rm(runtimeConfigPath, { force: true });
  });

  test("returns a structured bridge paragraph", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/v1/explanations",
      payload: explanationCases[0].request
    });

    expect(response.statusCode).toBe(200);

    const payload = response.json();
    expect(payload.bridgeText).toContain("workflow");
    expect(payload.disclosureLabel).toBe("AI demo");
    expect(payload.source).toBe("mock");
    expect(payload.fallbackReason).toContain("No real model is configured");
    expect(payload.inferredGapTags.length).toBeGreaterThan(0);
  });

  test("falls back to demo with a reason when the upstream model fails", async () => {
    const fallbackRuntimeConfigPath = ".test-runtime-fallback.json";
    const fallbackConfig = loadConfig({
      API_PORT: "8787",
      RUNTIME_CONFIG_PATH: fallbackRuntimeConfigPath,
      LLM_TIMEOUT_MS: "5000"
    });
    await rm(fallbackRuntimeConfigPath, { force: true });
    const configuredRuntimeStore = new RuntimeConfigStore(fallbackConfig);
    await configuredRuntimeStore.load();
    await configuredRuntimeStore.saveProviderConfig({
      apiUrl: "https://example.com/v1/chat/completions",
      apiKey: "test-key",
      model: "test-model",
      timeoutMs: 5000,
      wireApi: "chat-completions"
    });

    const failingApp = buildServer(
      config,
      configuredRuntimeStore,
      () => ({
        cleanArticle: async () => {
          throw new Error("unused in this test");
        },
        explain: async () => {
          throw new UpstreamLLMError("synthetic upstream outage", 503);
        }
      })
    );

    await failingApp.ready();

    const response = await failingApp.inject({
      method: "POST",
      url: "/v1/explanations",
      payload: explanationCases[0].request
    });

    expect(response.statusCode).toBe(200);
    const payload = response.json();
    expect(payload.source).toBe("mock");
    expect(payload.disclosureLabel).toBe("AI demo");
    expect(payload.fallbackReason).toContain("synthetic upstream outage");

    await failingApp.close();
    await rm(fallbackRuntimeConfigPath, { force: true });
  });

  test("rejects clean article requests when no real model is configured", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/v1/articles/clean",
      payload: {
        page: explanationCases[0].request.page,
        rawText: "Navigation\nA webhook can notify another system when a payment succeeds.",
        rawTextFingerprint: "raw-fingerprint",
        truncated: false
      }
    });

    expect(response.statusCode).toBe(409);
    expect(response.json().error).toContain("configured real model");
  });

  test("returns a clean article body from a configured real-model client", async () => {
    const cleanRuntimeConfigPath = ".test-runtime-clean.json";
    const cleanConfig = loadConfig({
      API_PORT: "8787",
      RUNTIME_CONFIG_PATH: cleanRuntimeConfigPath,
      LLM_TIMEOUT_MS: "5000"
    });
    await rm(cleanRuntimeConfigPath, { force: true });
    const cleanRuntimeStore = new RuntimeConfigStore(cleanConfig);
    await cleanRuntimeStore.load();
    await cleanRuntimeStore.saveProviderConfig({
      apiUrl: "https://example.com/v1/chat/completions",
      apiKey: "test-key",
      model: "test-model",
      timeoutMs: 5000,
      wireApi: "chat-completions"
    });

    const cleanApp = buildServer(cleanConfig, cleanRuntimeStore, () => ({
      cleanArticle: async (request) => ({
        articleFingerprint: request.page.articleFingerprint,
        rawTextFingerprint: request.rawTextFingerprint,
        cleanedText:
          "A webhook can notify another system when a payment succeeds.\n\nThat notification keeps the workflow moving without manual polling.",
        cleanedAt: "2026-05-03T00:00:00.000Z",
        usable: true,
        truncated: request.truncated
      }),
      explain: async () => {
        throw new Error("unused in this test");
      }
    }));

    await cleanApp.ready();

    const response = await cleanApp.inject({
      method: "POST",
      url: "/v1/articles/clean",
      payload: {
        page: explanationCases[0].request.page,
        rawText: "Navigation\nA webhook can notify another system when a payment succeeds.",
        rawTextFingerprint: "raw-fingerprint",
        truncated: false
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().usable).toBe(true);
    expect(response.json().cleanedText).toContain("webhook");

    await cleanApp.close();
    await rm(cleanRuntimeConfigPath, { force: true });
  });

  test("returns masked provider config to privileged origins", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/v1/provider-config",
      headers: {
        origin: "chrome-extension://test-extension"
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().hasApiKey).toBe(false);
  });
});
