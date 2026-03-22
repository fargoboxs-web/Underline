import type { ExplanationRequest, ExplanationResponse } from "@underline/shared";

import type { LLMClient } from "./client";

function isChineseLanguage(request: ExplanationRequest): boolean {
  if (request.page.language.toLowerCase().startsWith("zh")) {
    return true;
  }

  return /[\u4e00-\u9fff]/.test(
    request.contextWindow.paragraphs.map((paragraph) => paragraph.text).join(" ")
  );
}

function inferGapTags(text: string): string[] {
  const lower = text.toLowerCase();
  const tags = new Set<string>();

  if (/(webhook|url|http|https|api|request|response)/.test(lower)) {
    tags.add("web-foundations");
    tags.add("request-response");
  }

  if (/(ssh|server|terminal|shell|remote)/.test(lower)) {
    tags.add("remote-computing");
  }

  if (/(paper|baseline|dataset|benchmark|ablation)/.test(lower)) {
    tags.add("research-methodology");
  }

  if (/(model|embedding|vector|prompt|agent)/.test(lower)) {
    tags.add("ml-systems");
  }

  if (!tags.size) {
    tags.add("domain-mental-model");
  }

  return Array.from(tags).slice(0, 3);
}

function buildBridgeText(request: ExplanationRequest, tags: string[]): string {
  const highlights = request.newHighlights.map((highlight) => highlight.text).join(", ");
  const preference = request.profile.explanationPreference;
  const chinese = isChineseLanguage(request);

  if (chinese) {
    if (preference === "principles") {
      return `这里真正缺的通常不是对 ${highlights} 这些词分别查字典，而是先建立一个更上层的系统视角：这一段在讨论的，是多个技术对象如何被定位、连接、触发和协作。只要先把它理解成“系统之间如何找到彼此、如何安全通信、以及事件发生后如何继续流转”的一条链路，这些术语就会从零散名词，变成同一套机制里的不同角色。带着这个框架回去读原文，很多句子会突然顺起来。`;
    }

    if (preference === "analogy") {
      return `如果把这段内容想成一个跨部门办案流程，会更容易读懂：有的术语负责告诉你“对象放在哪里”，有的术语负责说明“你怎样安全地进入另一台机器或系统”，还有的术语负责表示“某件事一发生，系统就会主动通知下游继续动作”。所以你现在卡住的点，不是单个词义，而是还没把这些词放进同一张流程图里。先补上这张图，再回头看原文，术语就不会再像散落的黑话。`;
    }

    return `这段内容背后缺的更像是一张“系统如何协作”的地图，而不是几个孤立词汇的解释。原文里的术语分别在回答三个问题：资源在哪里、系统如何建立连接、事件如何在系统之间继续传递。先把这三个问题作为主线，你就会发现这些词其实是在描述同一个技术过程的不同环节，而不是互不相关的新概念。`;
  }

  if (preference === "principles") {
    return `The real gap here is usually not the individual meaning of ${highlights}, but the higher-level frame that ties them together. This passage is describing how software systems identify resources, establish secure access, and pass events across boundaries. Once you read the paragraph through that systems lens, the jargon stops feeling like isolated vocabulary and starts behaving like parts of one mechanism, which makes the original sentence much easier to follow.`;
  }

  if (preference === "analogy") {
    return `A useful way to read this passage is to imagine an operations workflow rather than a glossary. Some of these terms answer where something lives, others explain how you securely reach another machine, and others describe how one system taps the next on the shoulder when an event happens. The confusion is therefore less about each word in isolation and more about not yet having the shared map that makes them feel like one coordinated process.`;
  }

  return `What is missing here is less a set of word-by-word definitions and more the coordinating mental model behind them. The highlighted terms are all playing roles in the same story: how systems name things, connect to each other, and hand work forward when something happens. With that frame in place, the paragraph becomes easier to parse because each term starts acting like a role in one workflow instead of a separate piece of jargon.`;
}

export class MockLLMClient implements LLMClient {
  async explain(request: ExplanationRequest): Promise<ExplanationResponse> {
    const allText = request.newHighlights.map((highlight) => highlight.text).join(" ");
    const inferredGapTags = inferGapTags(allText);

    return {
      bridgeId: crypto.randomUUID(),
      insertAfterAnchor: request.newHighlights[request.newHighlights.length - 1].anchor,
      bridgeText: buildBridgeText(request, inferredGapTags),
      disclosureLabel: isChineseLanguage(request) ? "AI 补充" : "AI bridge",
      inferredGapTags,
      source: "mock"
    };
  }
}
