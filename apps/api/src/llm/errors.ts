export class UpstreamLLMError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = "UpstreamLLMError";
  }
}
