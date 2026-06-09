import type { ExplanationRequest } from "@underline/shared";

const baseTimestamp = "2026-05-03T00:00:00.000Z";

function createRequest(input: {
  language: string;
  title: string;
  hostname: string;
  discipline: string;
  roleContext: string;
  technicalFamiliarity: "low" | "medium" | "high";
  explanationPreference: "analogy" | "principles" | "balanced";
  highlightText: string;
  paragraphs: string[];
}): ExplanationRequest {
  return {
    page: {
      url: `https://${input.hostname}/article`,
      title: input.title,
      hostname: input.hostname,
      articleFingerprint: `${input.hostname}-fingerprint`,
      language: input.language
    },
    profile: {
      discipline: input.discipline,
      roleContext: input.roleContext,
      technicalFamiliarity: input.technicalFamiliarity,
      explanationPreference: input.explanationPreference,
      updatedAt: baseTimestamp
    },
    newHighlights: [
      {
        id: `${input.hostname}-highlight`,
        url: `https://${input.hostname}/article`,
        text: input.highlightText,
        createdAt: baseTimestamp,
        status: "active",
        anchor: {
          paragraphIndex: 1,
          domPath: "body/article[1]/p[2]",
          startOffset: 0,
          endOffset: input.highlightText.length,
          quote: {
            exact: input.highlightText,
            prefix: "",
            suffix: ""
          }
        }
      }
    ],
    contextWindow: {
      paragraphs: input.paragraphs.map((text, index) => ({
        index,
        text,
        domPath: `body/article[1]/p[${index + 1}]`
      })),
      startIndex: 0,
      endIndex: input.paragraphs.length - 1,
      lastHighlightParagraphIndex: 1
    },
    priorGapSignals: []
  };
}

export const explanationCases = [
  {
    name: "english-webhook",
    expectedLanguage: "en" as const,
    requiredPattern: /\b(system|workflow|process|mechanism|story)\b/i,
    request: createRequest({
      language: "en",
      title: "Understanding Webhooks",
      hostname: "example.com",
      discipline: "Law",
      roleContext: "Non-technical reader crossing into software ideas",
      technicalFamiliarity: "low",
      explanationPreference: "analogy",
      highlightText: "Webhook",
      paragraphs: [
        "Modern products often react to events triggered by other services.",
        "A webhook can notify another system when a payment succeeds.",
        "That notification keeps the workflow moving without manual polling."
      ]
    })
  },
  {
    name: "english-ssh",
    expectedLanguage: "en" as const,
    requiredPattern: /\b(system|systems|workflow|process|map|remote|mechanism)\b/i,
    request: createRequest({
      language: "en",
      title: "SSH for Researchers",
      hostname: "research.example",
      discipline: "Biology",
      roleContext: "Research student using remote tools for the first time",
      technicalFamiliarity: "low",
      explanationPreference: "principles",
      highlightText: "SSH tunnel",
      paragraphs: [
        "Researchers often run heavy workloads on remote machines.",
        "An SSH tunnel lets a local tool securely talk to a remote service.",
        "Without that setup, a private dashboard might never load in the browser."
      ]
    })
  },
  {
    name: "english-embeddings",
    expectedLanguage: "en" as const,
    requiredPattern: /\b(system|workflow|frame|mechanism|model)\b/i,
    request: createRequest({
      language: "en",
      title: "Embeddings in Search",
      hostname: "ml.example",
      discipline: "Business",
      roleContext: "Operator learning how AI features are wired into products",
      technicalFamiliarity: "low",
      explanationPreference: "balanced",
      highlightText: "vector embedding",
      paragraphs: [
        "Search systems can compare text by converting it into numeric representations.",
        "A vector embedding captures semantic similarity instead of exact keywords.",
        "That allows retrieval to match related ideas even when wording changes."
      ]
    })
  },
  {
    name: "english-ablation",
    expectedLanguage: "en" as const,
    requiredPattern: /\b(system|workflow|frame|process|benchmark|mechanism)\b/i,
    request: createRequest({
      language: "en",
      title: "Reading ML Papers",
      hostname: "papers.example",
      discipline: "Design",
      roleContext: "Curious reader trying to parse machine learning papers",
      technicalFamiliarity: "low",
      explanationPreference: "principles",
      highlightText: "ablation study",
      paragraphs: [
        "Benchmarks help compare a model against strong baselines.",
        "An ablation study removes one part at a time to show which component matters.",
        "That evidence helps separate real gains from accidental complexity."
      ]
    })
  },
  {
    name: "chinese-microservices",
    expectedLanguage: "zh" as const,
    requiredPattern: /系统|框架|流程|机制|地图/,
    request: createRequest({
      language: "zh-CN",
      title: "理解微服务",
      hostname: "zh.example",
      discipline: "法律",
      roleContext: "非技术背景读者，正在跨到软件系统文章",
      technicalFamiliarity: "low",
      explanationPreference: "balanced",
      highlightText: "事件驱动架构",
      paragraphs: [
        "大型系统通常不是一个程序完成全部工作。",
        "事件驱动架构会让不同服务在事件发生后继续协作。",
        "这样可以减少轮询，让流程更及时地向下游推进。"
      ]
    })
  },
  {
    name: "chinese-vector-db",
    expectedLanguage: "zh" as const,
    requiredPattern: /系统|框架|流程|机制|地图/,
    request: createRequest({
      language: "zh-CN",
      title: "向量数据库入门",
      hostname: "zhml.example",
      discipline: "金融",
      roleContext: "产品侧阅读者，需要理解 AI 检索系统",
      technicalFamiliarity: "low",
      explanationPreference: "analogy",
      highlightText: "向量数据库",
      paragraphs: [
        "检索系统有时不会只靠关键词匹配。",
        "向量数据库会存储文本的语义表示，帮助查找相近意思的内容。",
        "这让问答系统更容易找到真正相关的背景材料。"
      ]
    })
  }
] as const;
