import { z } from "zod";

export const LearningProfileSchema = z.object({
  discipline: z.string().min(1),
  roleContext: z.string().min(1),
  technicalFamiliarity: z.enum(["low", "medium", "high"]),
  explanationPreference: z.enum(["analogy", "principles", "balanced"]),
  goals: z.string().optional(),
  updatedAt: z.string().datetime()
});

export const ProfileSignalSchema = z.object({
  id: z.string().min(1),
  type: z.enum([
    "highlight",
    "bridge-generated",
    "bridge-removed",
    "bridge-regenerated"
  ]),
  summary: z.string().min(1),
  weight: z.number().min(0).max(1),
  inferredTags: z.array(z.string().min(1)).default([]),
  createdAt: z.string().datetime()
});

export const TextQuoteSelectorSchema = z.object({
  exact: z.string().min(1),
  prefix: z.string(),
  suffix: z.string()
});

export const HighlightAnchorSchema = z.object({
  paragraphIndex: z.number().int().nonnegative(),
  domPath: z.string().min(1),
  startOffset: z.number().int().nonnegative().optional(),
  endOffset: z.number().int().nonnegative().optional(),
  quote: TextQuoteSelectorSchema
});

export const HighlightRecordSchema = z.object({
  id: z.string().min(1),
  url: z.string().url(),
  text: z.string().min(1),
  createdAt: z.string().datetime(),
  status: z.enum(["active", "removed"]).default("active"),
  consumedByBridgeId: z.string().optional(),
  anchor: HighlightAnchorSchema
});

export const BridgeRecordSchema = z.object({
  id: z.string().min(1),
  url: z.string().url(),
  highlightIds: z.array(z.string().min(1)).min(1),
  insertAfterAnchor: HighlightAnchorSchema,
  bridgeText: z.string().min(1),
  disclosureLabel: z.string().min(1),
  inferredGapTags: z.array(z.string().min(1)).default([]),
  createdAt: z.string().datetime(),
  status: z.enum(["active", "removed", "anchor-missing"]).default("active"),
  source: z.enum(["ai", "mock"]).default("ai"),
  contextSource: z.enum(["clean-article", "nearby-context"]).default("nearby-context"),
  contextWarning: z.string().optional(),
  fallbackReason: z.string().optional()
});

export const ContextParagraphSchema = z.object({
  index: z.number().int().nonnegative(),
  text: z.string().min(1),
  domPath: z.string().min(1)
});

export const ContextWindowSchema = z.object({
  paragraphs: z.array(ContextParagraphSchema),
  startIndex: z.number().int().nonnegative(),
  endIndex: z.number().int().nonnegative(),
  lastHighlightParagraphIndex: z.number().int().nonnegative()
});

export const PagePayloadSchema = z.object({
  url: z.string().url(),
  title: z.string().min(1),
  hostname: z.string().min(1),
  articleFingerprint: z.string().min(1),
  language: z.string().min(1)
});

export const CleanArticleRequestSchema = z.object({
  page: PagePayloadSchema,
  rawText: z.string().min(1).max(50_000),
  rawTextFingerprint: z.string().min(1),
  truncated: z.boolean().default(false)
});

export const CleanArticleResponseSchema = z.object({
  articleFingerprint: z.string().min(1),
  rawTextFingerprint: z.string().min(1),
  cleanedText: z.string().default(""),
  cleanedAt: z.string().datetime(),
  usable: z.boolean(),
  truncated: z.boolean().default(false),
  failureReason: z.string().optional()
});

export const CleanArticleContextSchema = z.object({
  articleFingerprint: z.string().min(1),
  cleanedText: z.string().min(1),
  cleanedAt: z.string().datetime(),
  highlightMatched: z.boolean().optional()
});

export const ExplanationRequestSchema = z.object({
  page: PagePayloadSchema,
  profile: LearningProfileSchema,
  newHighlights: z.array(HighlightRecordSchema).min(1),
  contextWindow: ContextWindowSchema,
  cleanArticle: CleanArticleContextSchema.optional(),
  priorGapSignals: z.array(ProfileSignalSchema).default([])
});

export const ExplanationResponseSchema = z.object({
  bridgeId: z.string().min(1),
  insertAfterAnchor: HighlightAnchorSchema,
  bridgeText: z.string().min(1),
  disclosureLabel: z.string().min(1),
  inferredGapTags: z.array(z.string().min(1)).default([]),
  source: z.enum(["ai", "mock"]).default("ai"),
  contextSource: z.enum(["clean-article", "nearby-context"]).default("nearby-context"),
  contextWarning: z.string().optional(),
  fallbackReason: z.string().optional()
});

export const ProviderConfigSchema = z.object({
  apiUrl: z.string().url(),
  apiKey: z.string().default(""),
  model: z.string().default(""),
  timeoutMs: z.number().int().positive(),
  wireApi: z.enum(["auto", "responses", "chat-completions"]).default("auto")
});

export const ProviderConfigResponseSchema = z.object({
  apiUrl: z.string().url(),
  model: z.string(),
  timeoutMs: z.number().int().positive(),
  wireApi: z.enum(["auto", "responses", "chat-completions"]),
  hasApiKey: z.boolean(),
  apiKeyHint: z.string(),
  configured: z.boolean()
});

export const ProviderConfigTestSchema = z.object({
  ok: z.boolean(),
  mode: z.enum(["configured", "mock"]),
  message: z.string().min(1)
});

export type LearningProfile = z.infer<typeof LearningProfileSchema>;
export type ProfileSignal = z.infer<typeof ProfileSignalSchema>;
export type TextQuoteSelector = z.infer<typeof TextQuoteSelectorSchema>;
export type HighlightAnchor = z.infer<typeof HighlightAnchorSchema>;
export type HighlightRecord = z.infer<typeof HighlightRecordSchema>;
export type BridgeRecord = z.infer<typeof BridgeRecordSchema>;
export type ContextParagraph = z.infer<typeof ContextParagraphSchema>;
export type ContextWindow = z.infer<typeof ContextWindowSchema>;
export type PagePayload = z.infer<typeof PagePayloadSchema>;
export type CleanArticleRequest = z.infer<typeof CleanArticleRequestSchema>;
export type CleanArticleResponse = z.infer<typeof CleanArticleResponseSchema>;
export type CleanArticleContext = z.infer<typeof CleanArticleContextSchema>;
export type ExplanationRequest = z.infer<typeof ExplanationRequestSchema>;
export type ExplanationResponse = z.infer<typeof ExplanationResponseSchema>;
export type ProviderConfig = z.infer<typeof ProviderConfigSchema>;
export type ProviderConfigResponse = z.infer<typeof ProviderConfigResponseSchema>;
export type ProviderConfigTest = z.infer<typeof ProviderConfigTestSchema>;
