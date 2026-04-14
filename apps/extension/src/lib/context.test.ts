import { describe, expect, test } from "vitest";

import { buildContextWindow } from "./context";

describe("buildContextWindow", () => {
  test("includes one paragraph before and after the highlighted range", () => {
    const paragraphs = [
      {
        index: 0,
        domPath: "body/p[1]",
        rawText: "Paragraph 1",
        text: "Paragraph 1",
        element: {} as HTMLParagraphElement,
        tagName: "p",
        className: "",
        parentTagName: "body",
        lang: "",
        dir: ""
      },
      {
        index: 1,
        domPath: "body/p[2]",
        rawText: "Paragraph 2",
        text: "Paragraph 2",
        element: {} as HTMLParagraphElement,
        tagName: "p",
        className: "",
        parentTagName: "body",
        lang: "",
        dir: ""
      },
      {
        index: 2,
        domPath: "body/p[3]",
        rawText: "Paragraph 3",
        text: "Paragraph 3",
        element: {} as HTMLParagraphElement,
        tagName: "p",
        className: "",
        parentTagName: "body",
        lang: "",
        dir: ""
      }
    ];

    const context = buildContextWindow(paragraphs, [
      {
        id: "highlight-1",
        url: "https://example.com",
        text: "Paragraph 2",
        createdAt: new Date().toISOString(),
        status: "active",
        anchor: {
          paragraphIndex: 1,
          domPath: "body/p[2]",
          quote: {
            exact: "Paragraph 2",
            prefix: "",
            suffix: ""
          }
        }
      }
    ]);

    expect(context.startIndex).toBe(0);
    expect(context.endIndex).toBe(2);
    expect(context.paragraphs).toHaveLength(3);
  });
});
