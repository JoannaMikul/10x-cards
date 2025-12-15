import type {
  OpenRouterServiceConfig,
  OpenRouterModelParams,
  OpenRouterMetadata,
  OpenRouterTextResponse,
  JsonSchemaResponseFormat,
  OpenRouterUsage,
  OpenRouterResponse,
} from "../types";

export class OpenRouterError extends Error {
  constructor(
    message: string,
    public readonly code?: string
  ) {
    super(message);
    this.name = "OpenRouterError";
  }
}

export class OpenRouterConfigError extends OpenRouterError {
  constructor(message: string) {
    super(message, "CONFIG_ERROR");
    this.name = "OpenRouterConfigError";
  }
}

export class OpenRouterAuthError extends OpenRouterError {
  constructor(message: string) {
    super(message, "AUTH_ERROR");
    this.name = "OpenRouterAuthError";
  }
}

export class OpenRouterBadRequestError extends OpenRouterError {
  constructor(
    message: string,
    public readonly details?: unknown
  ) {
    super(message, "BAD_REQUEST");
    this.name = "OpenRouterBadRequestError";
  }
}

export class OpenRouterRateLimitError extends OpenRouterError {
  constructor(
    message: string,
    public readonly retryAfter?: number
  ) {
    super(message, "RATE_LIMIT");
    this.name = "OpenRouterRateLimitError";
  }
}

export class OpenRouterServerError extends OpenRouterError {
  constructor(
    message: string,
    public readonly statusCode: number
  ) {
    super(message, "SERVER_ERROR");
    this.name = "OpenRouterServerError";
  }
}

export class OpenRouterNetworkError extends OpenRouterError {
  constructor(message: string) {
    super(message, "NETWORK_ERROR");
    this.name = "OpenRouterNetworkError";
  }
}

export class OpenRouterParseError extends OpenRouterError {
  constructor(
    message: string,
    public readonly rawResponse?: string
  ) {
    super(message, "PARSE_ERROR");
    this.name = "OpenRouterParseError";
  }
}

export class OpenRouterService {
  public readonly defaultModel: string;
  public readonly defaultParams: OpenRouterModelParams;
  public readonly baseUrl: string;

  private readonly apiKey: string;
  private readonly httpClient: typeof fetch;

  constructor(private readonly config: OpenRouterServiceConfig) {
    if (!config.apiKey) {
      throw new OpenRouterConfigError("Missing OpenRouter API key");
    }

    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl ?? "https://openrouter.ai/api/v1/chat/completions";
    this.defaultModel = config.defaultModel;
    this.defaultParams = config.defaultParams ?? { temperature: 0.2 };
    this.httpClient = config.httpClient ?? fetch;
  }

  public async completeChat(options: {
    systemPrompt?: string;
    userPrompt: string;
    model?: string;
    params?: OpenRouterModelParams;
    metadata?: OpenRouterMetadata;
  }): Promise<OpenRouterTextResponse> {
    const model = options.model ?? this.defaultModel;
    const mergedParams = { ...this.defaultParams, ...options.params };
    const messages = this._buildMessages(options.userPrompt, options.systemPrompt);
    const requestBody = this._buildRequestBody(messages, model, mergedParams, undefined, options.metadata);

    const response = await this._callOpenRouter(requestBody);
    return this._parseTextResponse(response);
  }

  public async completeStructuredChat<TSchema>(options: {
    systemPrompt?: string;
    userPrompt: string;
    responseFormat: JsonSchemaResponseFormat;
    model?: string;
    params?: OpenRouterModelParams;
    metadata?: OpenRouterMetadata;
  }): Promise<TSchema> {
    const model = options.model ?? this.defaultModel;
    const mergedParams = { ...this.defaultParams, ...options.params };
    const messages = this._buildMessages(options.userPrompt, options.systemPrompt);
    const requestBody = this._buildRequestBody(messages, model, mergedParams, options.responseFormat, options.metadata);

    const response = await this._callOpenRouter(requestBody);
    return this._parseStructuredResponse<TSchema>(response);
  }

  private _buildHeaders(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://10xcards.com",
      "X-Title": "10x-cards",
    };
  }

  private _buildMessages(userPrompt: string, systemPrompt?: string): { role: string; content: string }[] {
    const messages: { role: string; content: string }[] = [];

    if (systemPrompt) {
      messages.push({ role: "system", content: systemPrompt });
    }

    messages.push({ role: "user", content: userPrompt });

    return messages;
  }

  private _buildRequestBody(
    messages: { role: string; content: string }[],
    model: string,
    params: OpenRouterModelParams,
    responseFormat?: JsonSchemaResponseFormat,
    metadata?: OpenRouterMetadata
  ): Record<string, unknown> {
    const body: Record<string, unknown> = {
      model,
      messages,
      ...params,
    };

    if (responseFormat) {
      body.response_format = responseFormat;
    }

    if (metadata) {
      body.metadata = metadata;
    }

    return body;
  }

  private async _callOpenRouter(requestBody: Record<string, unknown>): Promise<OpenRouterResponse> {
    const headers = this._buildHeaders();

    try {
      const response = await this.httpClient(this.baseUrl, {
        method: "POST",
        headers,
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        await this._handleHttpError(response);
      }

      const data = await response.json();

      if (!data.choices || !Array.isArray(data.choices) || data.choices.length === 0) {
        throw new OpenRouterParseError("Invalid response structure: missing or empty choices array");
      }

      return data as OpenRouterResponse;
    } catch (error) {
      if (error instanceof OpenRouterError) {
        throw error;
      }

      throw new OpenRouterNetworkError(
        `Network request failed: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  private async _handleHttpError(response: Response): Promise<never> {
    const statusCode = response.status;
    let errorMessage = `HTTP ${statusCode}: ${response.statusText}`;

    try {
      const errorBody = await response.json();
      if (errorBody.error?.message) {
        errorMessage = errorBody.error.message;
      }
    } catch {
      // Ignore JSON parsing errors for error body
    }

    switch (statusCode) {
      case 401:
        throw new OpenRouterAuthError("Authentication failed: invalid or expired API key");
      case 400:
        throw new OpenRouterBadRequestError("Bad request: invalid parameters or format", errorMessage);
      case 429:
        throw new OpenRouterRateLimitError("Rate limit exceeded", this._extractRetryAfter(response));
      case 500:
      case 502:
      case 503:
      case 504:
        throw new OpenRouterServerError("OpenRouter service temporarily unavailable", statusCode);
      default:
        throw new OpenRouterError(`Unexpected HTTP error: ${errorMessage}`, `${statusCode}`);
    }
  }

  private _extractRetryAfter(response: Response): number | undefined {
    const retryAfter = response.headers.get("retry-after");
    if (retryAfter) {
      const seconds = parseInt(retryAfter, 10);
      return isNaN(seconds) ? undefined : seconds;
    }
    return undefined;
  }

  private _parseTextResponse(response: OpenRouterResponse): OpenRouterTextResponse {
    const choice = response.choices[0];
    if (!choice || !choice.message || typeof choice.message.content !== "string") {
      throw new OpenRouterParseError("Invalid response structure: missing message content");
    }

    const usage: OpenRouterUsage = {
      prompt_tokens: response.usage.prompt_tokens,
      completion_tokens: response.usage.completion_tokens,
      total_tokens: response.usage.total_tokens,
    };

    return {
      text: choice.message.content,
      usage,
      model: response.model,
    };
  }

  private _parseStructuredResponse<TSchema>(response: OpenRouterResponse): TSchema {
    const choice = response.choices[0];
    if (!choice || !choice.message) {
      throw new OpenRouterParseError("Invalid response structure: missing message");
    }

    let content: string;

    if (typeof choice.message.content === "string") {
      content = choice.message.content;
    } else if (choice.message.content && typeof choice.message.content === "object") {
      content = JSON.stringify(choice.message.content);
    } else {
      throw new OpenRouterParseError("Invalid response structure: unsupported content format");
    }

    try {
      const parsed = JSON.parse(content);

      if (typeof parsed !== "object" || parsed === null) {
        throw new OpenRouterParseError("Parsed response is not a valid object");
      }

      return parsed as TSchema;
    } catch (parseError) {
      const partialResult = this._extractPartialJsonCards(content);

      if (partialResult && partialResult.cards && partialResult.cards.length > 0) {
        return partialResult as TSchema;
      }

      const repairedContent = this._repairIncompleteJson(content);
      if (repairedContent !== content) {
        try {
          const parsed = JSON.parse(repairedContent);

          if (typeof parsed === "object" && parsed !== null) {
            return parsed as TSchema;
          }
        } catch {
          // Ignore repair errors
        }
      }

      throw new OpenRouterParseError(
        `Failed to parse structured response as JSON: ${parseError instanceof Error ? parseError.message : "Unknown parse error"}`,
        content
      );
    }
  }

  private _extractPartialJsonCards(content: string): { cards: unknown[] } | null {
    try {
      const cardsArrayMatch = content.match(/"cards"\s*:\s*\[([\s\S]*?)\]/);
      if (!cardsArrayMatch) {
        return null;
      }

      const cardsContent = cardsArrayMatch[1];
      const cards: unknown[] = [];

      const cardBlocks = cardsContent.split(/\},\s*\{/);

      for (let i = 0; i < cardBlocks.length; i++) {
        let cardBlock = cardBlocks[i].trim();

        if (i === cardBlocks.length - 1) {
          const quoteCount = (cardBlock.match(/"/g) || []).length;
          if (quoteCount % 2 !== 0) {
            continue;
          }

          const openBraces = (cardBlock.match(/\{/g) || []).length;
          const closeBraces = (cardBlock.match(/\}/g) || []).length;
          if (openBraces > closeBraces) {
            continue;
          }
        }

        if (i === 0 && !cardBlock.startsWith("{")) {
          cardBlock = "{" + cardBlock;
        }
        if (i < cardBlocks.length - 1 && !cardBlock.endsWith("}")) {
          cardBlock = cardBlock + "}";
        }
        if (i === cardBlocks.length - 1 && !cardBlock.endsWith("}")) {
          cardBlock = cardBlock + "}";
        }

        cardBlock = cardBlock.replace(/,(\s*[}\]])/g, "$1");

        try {
          const parsedCard = JSON.parse(cardBlock);
          if (
            parsedCard &&
            typeof parsedCard === "object" &&
            typeof parsedCard.front === "string" &&
            parsedCard.front.trim() &&
            typeof parsedCard.back === "string" &&
            parsedCard.back.trim()
          ) {
            cards.push(parsedCard);
          }
        } catch {
          // Ignore repair errors
        }
      }

      if (cards.length > 0) {
        return { cards };
      }

      return null;
    } catch {
      return null;
    }
  }

  private _repairIncompleteJson(content: string): string {
    let repaired = content.replace(/,(\s*[}\]])/g, "$1").trim();

    const openQuotes = (repaired.match(/"/g) || []).length;
    if (openQuotes % 2 !== 0) {
      repaired += '"';
    }

    const openBraces = (repaired.match(/\{/g) || []).length;
    let closeBraces = (repaired.match(/\}/g) || []).length;
    const openBrackets = (repaired.match(/\[/g) || []).length;
    let closeBrackets = (repaired.match(/\]/g) || []).length;

    while (closeBraces < openBraces) {
      repaired += "}";
      closeBraces++;
    }

    while (closeBrackets < openBrackets) {
      repaired += "]";
      closeBrackets++;
    }

    return repaired;
  }
}

const apiKey = import.meta.env.OPENROUTER_API_KEY;
if (!apiKey) {
  throw new Error("OPENROUTER_API_KEY environment variable is required");
}

export const openRouterService = new OpenRouterService({
  apiKey,
  defaultModel: import.meta.env.OPENROUTER_DEFAULT_MODEL ?? "openai/gpt-3.5-turbo",
  defaultParams: {
    temperature: Number(import.meta.env.OPENROUTER_TEMPERATURE ?? 0.3),
    max_tokens: Number(import.meta.env.OPENROUTER_MAX_TOKENS ?? 2048),
  },
});
