import { describe, expect, test } from "vitest";

import { locateQuoteInText } from "./anchors";

describe("locateQuoteInText", () => {
  test("prefers the candidate that matches prefix and suffix", () => {
    const rawText =
      "URL explains where a resource lives. Another URL can describe a different resource.";

    const result = locateQuoteInText(rawText, {
      paragraphIndex: 0,
      domPath: "body/p[1]",
      quote: {
        exact: "URL",
        prefix: "",
        suffix: " explains"
      }
    });

    expect(result).toEqual({
      start: 0,
      end: 3
    });
  });
});
