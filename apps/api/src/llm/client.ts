import type {
  CleanArticleRequest,
  CleanArticleResponse,
  ExplanationRequest,
  ExplanationResponse
} from "@underline/shared";

export interface LLMClient {
  cleanArticle(request: CleanArticleRequest): Promise<CleanArticleResponse>;
  explain(request: ExplanationRequest): Promise<ExplanationResponse>;
}
