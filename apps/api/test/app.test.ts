import { afterAll, beforeAll, describe, expect, test } from "vitest";

import { buildServer } from "../src/app";
import { loadConfig } from "../src/config";
import { RuntimeConfigStore } from "../src/runtime-config";

describe("POST /v1/explanations", () => {
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

  test("returns a structured bridge paragraph", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/v1/explanations",
      payload: {
        page: {
          url: "https://example.com/article",
          title: "Understanding OpenMAS",
          hostname: "example.com",
          articleFingerprint: "fingerprint-1",
          language: "en"
        },
        profile: {
          discipline: "Law",
          roleContext: "Law student exploring technical systems",
          technicalFamiliarity: "low",
          explanationPreference: "analogy",
          updatedAt: new Date().toISOString()
        },
        newHighlights: [
          {
            id: "highlight-1",
            url: "https://example.com/article",
            text: "Webhook",
            createdAt: new Date().toISOString(),
            status: "active",
            anchor: {
              paragraphIndex: 2,
              domPath: "body/article[1]/p[3]",
              startOffset: 5,
              endOffset: 12,
              quote: {
                exact: "Webhook",
                prefix: "via ",
                suffix: " to"
              }
            }
          }
        ],
        contextWindow: {
          paragraphs: [
            {
              index: 1,
              text: "Systems often notify each other through callbacks.",
              domPath: "body/article[1]/p[2]"
            },
            {
              index: 2,
              text: "A webhook can trigger another service when an event happens.",
              domPath: "body/article[1]/p[3]"
            }
          ],
          startIndex: 1,
          endIndex: 2,
          lastHighlightParagraphIndex: 2
        },
        priorGapSignals: []
      }
    });

    expect(response.statusCode).toBe(200);

    const payload = response.json();
    expect(payload.bridgeText).toContain("workflow");
    expect(payload.disclosureLabel).toBe("AI bridge");
    expect(payload.inferredGapTags.length).toBeGreaterThan(0);
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
