import type { ExplanationRequest, ExplanationResponse } from "@underline/shared";

export interface LLMClient {
  explain(request: ExplanationRequest): Promise<ExplanationResponse>;
}
