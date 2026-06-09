import { StrictMode, useEffect, useState, type CSSProperties } from "react";
import { createRoot } from "react-dom/client";

import { getCleanArticleByStorageKey, type CleanArticleCacheRecord } from "../../lib/storage";
import "../popup/style.css";

const articleStyle: CSSProperties = {
  maxWidth: 760,
  margin: "0 auto",
  padding: "48px 24px 72px",
  fontSize: 18,
  lineHeight: 1.78
};

const paragraphStyle: CSSProperties = {
  margin: "0 0 1.15em"
};

function splitParagraphs(text: string): string[] {
  return text
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
}

function ArticleViewer() {
  const [record, setRecord] = useState<CleanArticleCacheRecord | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    void (async () => {
      const key = new URLSearchParams(location.search).get("key");

      if (!key) {
        setError("正文不存在或已失效。");
        return;
      }

      const loaded = await getCleanArticleByStorageKey(key);

      if (!loaded?.cleanedText) {
        setError("正文不存在或已失效。");
        return;
      }

      setRecord(loaded);
    })();
  }, []);

  const paragraphs = record ? splitParagraphs(record.cleanedText) : [];

  return (
    <main style={articleStyle}>
      {error ? <p style={paragraphStyle}>{error}</p> : null}
      {paragraphs.map((paragraph, index) => (
        <p key={`${index}-${paragraph.slice(0, 16)}`} style={paragraphStyle}>
          {paragraph}
        </p>
      ))}
    </main>
  );
}

document.body.style.margin = "0";
document.body.style.minHeight = "100vh";
document.body.style.background = "#fffdf8";
document.body.style.color = "#181c18";
document.body.style.fontFamily = '"SF Pro Text", "PingFang SC", system-ui, sans-serif';

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Article root element not found.");
}

createRoot(rootElement).render(
  <StrictMode>
    <ArticleViewer />
  </StrictMode>
);
