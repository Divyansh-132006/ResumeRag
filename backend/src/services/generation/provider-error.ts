export class ProviderError extends Error {
  public readonly statusCode: number;

  public constructor(
    provider: string,
    statusCode: number,
    message = "The AI provider is temporarily unavailable",
  ) {
    super(`${provider} provider failed with status ${statusCode}: ${message}`);
    this.name = "ProviderError";
    this.statusCode = statusCode;
  }
}
