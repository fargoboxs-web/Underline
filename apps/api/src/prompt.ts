import type { ExplanationRequest } from "@underline/shared";

function formatPreference(preference: ExplanationRequest["profile"]["explanationPreference"]): string {
  if (preference === "analogy") {
    return "Prefer comparisons, familiar metaphors, and practical intuition.";
  }

  if (preference === "principles") {
    return "Prefer first principles, causal explanations, and minimal metaphor.";
  }

  return "Balance analogy and first-principles reasoning.";
}

export function buildSystemPrompt(): string {
  return [
    "You are an expert teaching assistant embedded inside an article.",
    "Your job is not to define every highlighted term one by one.",
    "Instead, infer the missing background concept or knowledge frame that would make the highlighted material understandable.",
    "Write one compact bridge paragraph that could be inserted into the article between paragraphs.",
    "Keep the explanation in the same language as the source article.",
    "Do not mention that you are diagnosing a gap unless it feels natural.",
    "Do not output HTML.",
    "Return strict JSON with exactly these keys: bridgeText, disclosureLabel, inferredGapTags.",
    "The disclosure label must stay short, such as 'AI bridge' or its equivalent in the article language.",
    "The bridge paragraph should feel like a missing explanatory paragraph in the article, but it must remain honest and not pretend to be original author text."
  ].join(" ");
}

export function buildUserPrompt(input: ExplanationRequest): string {
  return JSON.stringify(
    {
      page: {
        title: input.page.title,
        hostname: input.page.hostname,
        language: input.page.language
      },
      learner: {
        discipline: input.profile.discipline,
        roleContext: input.profile.roleContext,
        technicalFamiliarity: input.profile.technicalFamiliarity,
        explanationPreference: input.profile.explanationPreference,
        goals: input.profile.goals ?? "",
        instruction: formatPreference(input.profile.explanationPreference)
      },
      highlightedText: input.newHighlights.map((highlight) => ({
        text: highlight.text,
        paragraphIndex: highlight.anchor.paragraphIndex
      })),
      contextWindow: input.contextWindow.paragraphs.map((paragraph) => ({
        index: paragraph.index,
        text: paragraph.text
      })),
      priorGapSignals: input.priorGapSignals.map((signal) => ({
        summary: signal.summary,
        inferredTags: signal.inferredTags
      })),
      task: [
        "Infer the deeper missing background knowledge behind the highlights.",
        "Write a single bridge paragraph that teaches that missing frame.",
        "Keep it concise enough to fit naturally inside an article.",
        "If a short connecting sentence helps, include it inside the same paragraph.",
        "Choose 1 to 3 inferred gap tags in kebab-case."
      ]
    },
    null,
    2
  );
}
