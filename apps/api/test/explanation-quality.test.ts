import { afterAll, beforeAll, describe, expect, test } from "vitest";

import { buildServer } from "../src/app";
import { loadConfig } from "../src/config";
import { RuntimeConfigStore } from "../src/runtime-config";
import { explanationCases } from "./fixtures/explanation-cases";

function containsChinese(text: string): boolean {
  return /[\u4e00-\u9fff]/.test(text);
}

describe("explanation quality harness", () => {
  const config = loadConfig({
    API_PORT: "8787",
    RUNTIME_CONFIG_PATH: ".test-runtime.json",
    LLM_TIMEOUT_MS: "5000"
  });
  const runtimeStore = new RuntimeConfigStore(config);
  const app = buildServer(config, runtimeStore);

  beforeAll(async () => {
    await runtimeStore.load();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  for (const fixture of explanationCases) {
    test(`keeps bridge quality for ${fixture.name}`, async () => {
      const response = await app.inject({
        method: "POST",
        url: "/v1/explanations",
        payload: fixture.request
      });

      expect(response.statusCode).toBe(200);
      const payload = response.json();

      expect(payload.source).toBe("mock");
      expect(payload.bridgeText.length).toBeGreaterThan(80);
      expect(payload.bridgeText.length).toBeLessThan(520);
      expect(payload.bridgeText).not.toContain("\n");
      expect(payload.inferredGapTags.length).toBeGreaterThanOrEqual(1);
      expect(payload.inferredGapTags.length).toBeLessThanOrEqual(3);
      expect(payload.bridgeText).toMatch(fixture.requiredPattern);

      if (fixture.expectedLanguage === "zh") {
        expect(payload.disclosureLabel).toBe("AI 演示");
        expect(containsChinese(payload.bridgeText)).toBe(true);
      } else {
        expect(payload.disclosureLabel).toBe("AI demo");
        expect(containsChinese(payload.bridgeText)).toBe(false);
      }
    });
  }
});
