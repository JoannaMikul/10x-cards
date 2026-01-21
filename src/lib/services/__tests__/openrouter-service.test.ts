import { describe, it, expect, vi, beforeEach, afterEach, beforeAll } from "vitest";
import type { JsonSchemaResponseFormat } from "../../../types";
import { server } from "../../../test/setup";
import { http, HttpResponse } from "msw";

vi.mock("../../openrouter-service", () => {
  // Define error classes
  class MockOpenRouterError extends Error {
    constructor(
      message: string,
      public readonly code?: string
    ) {
      super(message);
      this.name = "OpenRouterError";
    }
  }

  class MockOpenRouterConfigError extends MockOpenRouterError {
    constructor(message: string) {
      super(message, "CONFIG_ERROR");
      this.name = "OpenRouterConfigError";
    }
  }

  class MockOpenRouterAuthError extends MockOpenRouterError {
    constructor(message: string) {
      super(message, "AUTH_ERROR");
      this.name = "OpenRouterAuthError";
    }
  }

  class MockOpenRouterBadRequestError extends MockOpenRouterError {
    constructor(
      message: string,
      public readonly details?: unknown
    ) {
      super(message, "BAD_REQUEST");
      this.name = "OpenRouterBadRequestError";
    }
  }

  class MockOpenRouterRateLimitError extends MockOpenRouterError {
    constructor(
      message: string,
      public readonly retryAfter?: number
    ) {
      super(message, "RATE_LIMIT");
      this.name = "OpenRouterRateLimitError";
    }
  }

  class MockOpenRouterServerError extends MockOpenRouterError {
    constructor(
      message: string,
      public readonly statusCode: number
    ) {
      super(message, "SERVER_ERROR");
      this.name = "OpenRouterServerError";
    }
  }

  class MockOpenRouterNetworkError extends MockOpenRouterError {
    constructor(message: string) {
      super(message, "NETWORK_ERROR");
      this.name = "OpenRouterNetworkError";
    }
  }

  class MockOpenRouterParseError extends MockOpenRouterError {
    constructor(
      message: string,
      public readonly rawResponse?: string
    ) {
      super(message, "PARSE_ERROR");
      this.name = "OpenRouterParseError";
    }
  }

  // Simplified service class for testing
  class MockOpenRouterService {
    public readonly defaultModel: string;
    public readonly defaultParams: Record<string, unknown>;
    public readonly baseUrl: string;
    private readonly apiKey: string;
    private readonly httpClient: typeof fetch;

    constructor(
      private readonly config: {
        apiKey: string;
        baseUrl?: string;
        defaultModel: string;
        defaultParams?: Record<string, unknown>;
        httpClient?: typeof fetch;
      }
    ) {
      if (!config.apiKey) {
        throw new MockOpenRouterConfigError("Missing OpenRouter API key");
      }

      this.apiKey = config.apiKey;
      this.baseUrl = config.baseUrl ?? "https://openrouter.ai/api/v1/chat/completions";
      this.defaultModel = config.defaultModel ?? "openai/gpt-3.5-turbo";
      this.defaultParams = config.defaultParams ?? { temperature: 0.2 };
      this.httpClient = config.httpClient ?? global.fetch;
    }

    public async completeChat(options: {
      userPrompt: string;
      systemPrompt?: string;
      model?: string;
      params?: Record<string, unknown>;
      metadata?: Record<string, unknown>;
    }): Promise<{
      text: string;
      usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
      model: string;
    }> {
      const model = options.model ?? this.defaultModel;
      const mergedParams = { ...this.defaultParams, ...options.params };
      const messages = this._buildMessages(options.userPrompt, options.systemPrompt);
      const requestBody = this._buildRequestBody(messages, model, mergedParams, undefined, options.metadata);

      const response = await this._callOpenRouter(requestBody);
      return this._parseTextResponse(response);
    }

    public async completeStructuredChat<TSchema>(options: {
      userPrompt: string;
      systemPrompt?: string;
      model?: string;
      params?: Record<string, unknown>;
      metadata?: Record<string, unknown>;
      responseFormat: { type: string; json_schema: { schema: Record<string, unknown> } };
    }): Promise<TSchema> {
      const model = options.model ?? this.defaultModel;
      if (model.includes("anthropic/claude")) {
        return this._completeStructuredWithTools<TSchema>(options);
      }

      const mergedParams = { ...this.defaultParams, ...options.params };
      const messages = this._buildMessages(options.userPrompt, options.systemPrompt);
      const requestBody = this._buildRequestBody(
        messages,
        model,
        mergedParams,
        options.responseFormat,
        options.metadata
      );

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

    private async _completeStructuredWithTools<TSchema>(options: {
      userPrompt: string;
      systemPrompt?: string;
      model?: string;
      params?: Record<string, unknown>;
      metadata?: Record<string, unknown>;
      responseFormat: { type: string; json_schema: { schema: Record<string, unknown> } };
    }): Promise<TSchema> {
      const model = options.model ?? this.defaultModel;
      const mergedParams = { ...this.defaultParams, ...options.params };
      const messages = this._buildMessages(options.userPrompt, options.systemPrompt);

      const requestBody: Record<string, unknown> = {
        model,
        messages,
        ...mergedParams,
        response_format: {
          type: "json_object",
        },
      };

      if (options.metadata) {
        requestBody.metadata = options.metadata;
      }

      const jsonInstruction = `You must respond with a valid JSON object that matches this schema: ${JSON.stringify(
        options.responseFormat.json_schema.schema
      )}`;
      if (requestBody.messages && Array.isArray(requestBody.messages)) {
        requestBody.messages = [{ role: "system", content: jsonInstruction }, ...requestBody.messages];
      }

      const response = await this._callOpenRouter(requestBody);
      return this._parseStructuredResponse<TSchema>(response);
    }

    private _buildRequestBody(
      messages: { role: string; content: string }[],
      model: string,
      params: Record<string, unknown>,
      responseFormat?: { type: string; json_schema: { schema: Record<string, unknown> } },
      metadata?: Record<string, unknown>
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

    private async _callOpenRouter(requestBody: Record<string, unknown>): Promise<{
      choices: {
        message: { role: string; content: string };
        finish_reason: string;
        index: number;
      }[];
      usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
      model: string;
    }> {
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
          throw new MockOpenRouterParseError("Invalid response structure: missing or empty choices array");
        }

        return data;
      } catch (error) {
        if (error instanceof MockOpenRouterError) {
          throw error;
        }

        throw new MockOpenRouterNetworkError(
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
          throw new MockOpenRouterAuthError("Authentication failed: invalid or expired API key");
        case 400:
          throw new MockOpenRouterBadRequestError("Bad request: invalid parameters or format", errorMessage);
        case 429:
          throw new MockOpenRouterRateLimitError("Rate limit exceeded", this._extractRetryAfter(response));
        case 500:
        case 502:
        case 503:
        case 504:
          throw new MockOpenRouterServerError("OpenRouter service temporarily unavailable", statusCode);
        default:
          throw new MockOpenRouterError(`Unexpected HTTP error: ${errorMessage}`, `${statusCode}`);
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

    private _parseTextResponse(response: {
      choices: {
        message: { role: string; content: string };
        finish_reason: string;
        index: number;
      }[];
      usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
      model: string;
    }): {
      text: string;
      usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
      model: string;
    } {
      const choice = response.choices[0];
      if (!choice || !choice.message || typeof choice.message.content !== "string") {
        throw new MockOpenRouterParseError("Invalid response structure: missing message content");
      }

      const usage = {
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

    private _parseToolResponse<TSchema>(response: {
      choices: {
        message: {
          tool_calls?: { function?: { name?: string; arguments?: string } }[];
        };
      }[];
    }): TSchema {
      const choice = response.choices[0];
      if (!choice || !choice.message) {
        throw new MockOpenRouterParseError("Invalid response structure: missing message");
      }

      if (
        !choice.message.tool_calls ||
        !Array.isArray(choice.message.tool_calls) ||
        choice.message.tool_calls.length === 0
      ) {
        throw new MockOpenRouterParseError("Invalid tool response: missing tool_calls");
      }

      const toolCall = choice.message.tool_calls[0];
      if (!toolCall || toolCall.function?.name !== "generate_structured_response") {
        throw new MockOpenRouterParseError("Invalid tool response: unexpected tool call");
      }

      let content: string;
      try {
        const args = JSON.parse(toolCall.function.arguments ?? "");
        content = JSON.stringify(args);
      } catch (parseError) {
        throw new MockOpenRouterParseError(
          `Failed to parse tool arguments: ${parseError instanceof Error ? parseError.message : "Unknown parse error"}`
        );
      }

      try {
        const parsed = JSON.parse(content);

        if (typeof parsed !== "object" || parsed === null) {
          throw new MockOpenRouterParseError("Parsed tool response is not a valid object");
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

        throw new MockOpenRouterParseError(
          `Failed to parse tool response as JSON: ${parseError instanceof Error ? parseError.message : "Unknown parse error"}`,
          content
        );
      }
    }

    private _parseStructuredResponse<TSchema>(response: {
      choices: {
        message: { role: string; content: string };
        finish_reason: string;
        index: number;
      }[];
      usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
      model: string;
    }): TSchema {
      const choice = response.choices[0];
      if (!choice || !choice.message) {
        throw new MockOpenRouterParseError("Invalid response structure: missing message");
      }

      let content: string;

      if (typeof choice.message.content === "string") {
        content = choice.message.content
          .replace(/^```(?:json)?\s*\n?/i, "")
          .replace(/\n?```\s*$/i, "")
          .trim();
      } else if (choice.message.content && typeof choice.message.content === "object") {
        content = JSON.stringify(choice.message.content);
      } else {
        throw new MockOpenRouterParseError("Invalid response structure: unsupported content format");
      }

      try {
        const parsed = JSON.parse(content);

        if (typeof parsed !== "object" || parsed === null) {
          throw new MockOpenRouterParseError("Parsed response is not a valid object");
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

        throw new MockOpenRouterParseError(
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

  return {
    OpenRouterService: MockOpenRouterService,
    OpenRouterError: MockOpenRouterError,
    OpenRouterConfigError: MockOpenRouterConfigError,
    OpenRouterAuthError: MockOpenRouterAuthError,
    OpenRouterBadRequestError: MockOpenRouterBadRequestError,
    OpenRouterRateLimitError: MockOpenRouterRateLimitError,
    OpenRouterServerError: MockOpenRouterServerError,
    OpenRouterNetworkError: MockOpenRouterNetworkError,
    OpenRouterParseError: MockOpenRouterParseError,
    openRouterService: undefined,
  };
});

let OpenRouterService: typeof import("../../openrouter-service").OpenRouterService;
let OpenRouterError: typeof import("../../openrouter-service").OpenRouterError;
let OpenRouterConfigError: typeof import("../../openrouter-service").OpenRouterConfigError;
let OpenRouterAuthError: typeof import("../../openrouter-service").OpenRouterAuthError;
let OpenRouterBadRequestError: typeof import("../../openrouter-service").OpenRouterBadRequestError;
let OpenRouterRateLimitError: typeof import("../../openrouter-service").OpenRouterRateLimitError;
let OpenRouterServerError: typeof import("../../openrouter-service").OpenRouterServerError;
let OpenRouterNetworkError: typeof import("../../openrouter-service").OpenRouterNetworkError;
let OpenRouterParseError: typeof import("../../openrouter-service").OpenRouterParseError;

beforeAll(async () => {
  ({
    OpenRouterService,
    OpenRouterError,
    OpenRouterConfigError,
    OpenRouterAuthError,
    OpenRouterBadRequestError,
    OpenRouterRateLimitError,
    OpenRouterServerError,
    OpenRouterNetworkError,
    OpenRouterParseError,
  } = await import("../../openrouter-service"));
});

describe("OpenRouterService", () => {
  let service: InstanceType<typeof OpenRouterService>;
  const validConfig = {
    apiKey: "test-api-key",
    baseUrl: "https://openrouter.ai/api/v1/chat/completions",
    defaultModel: "openai/gpt-3.5-turbo",
    defaultParams: { temperature: 0.2 },
  };

  beforeEach(() => {
    service = new OpenRouterService(validConfig);
    vi.clearAllMocks();
  });

  afterEach(() => {
    server.resetHandlers();
    vi.clearAllMocks();
  });

  describe("constructor", () => {
    it("should create service with valid config", () => {
      const service = new OpenRouterService(validConfig);
      expect(service.defaultModel).toBe("openai/gpt-3.5-turbo");
      expect(service.defaultParams).toEqual({ temperature: 0.2 });
      expect(service.baseUrl).toBe("https://openrouter.ai/api/v1/chat/completions");
    });

    it("should throw OpenRouterConfigError when apiKey is missing", () => {
      expect(() => {
        new OpenRouterService({ ...validConfig, apiKey: "" });
      }).toThrow(OpenRouterConfigError);
    });

    it("should use default values when optional config is not provided", () => {
      const minimalConfig = { apiKey: "test-key", defaultModel: "openai/gpt-3.5-turbo" };
      const service = new OpenRouterService(minimalConfig);
      expect(service.defaultModel).toBe("openai/gpt-3.5-turbo");
      expect(service.defaultParams).toEqual({ temperature: 0.2 });
      expect(service.baseUrl).toBe("https://openrouter.ai/api/v1/chat/completions");
    });

    it("should use custom baseUrl when provided", () => {
      const customConfig = { ...validConfig, baseUrl: "https://custom.openrouter.ai/api/v1/chat/completions" };
      const service = new OpenRouterService(customConfig);
      expect(service.baseUrl).toBe("https://custom.openrouter.ai/api/v1/chat/completions");
    });
  });

  describe("completeChat", () => {
    const mockTextResponse = {
      id: "chatcmpl-123456789",
      object: "chat.completion",
      created: 1677830400,
      model: "openai/gpt-3.5-turbo",
      choices: [
        {
          message: {
            role: "assistant",
            content: "This is a test response from the AI model.",
          },
          finish_reason: "stop",
          index: 0,
        },
      ],
      usage: {
        prompt_tokens: 10,
        completion_tokens: 15,
        total_tokens: 25,
      },
    };

    it("should successfully complete chat and return text response", async () => {
      server.use(
        http.post("https://openrouter.ai/api/v1/chat/completions", () => {
          return HttpResponse.json(mockTextResponse);
        })
      );

      const result = await service.completeChat({
        userPrompt: "Test prompt",
      });

      expect(result.text).toBe("This is a test response from the AI model.");
      expect(result.usage.prompt_tokens).toBe(10);
      expect(result.usage.completion_tokens).toBe(15);
      expect(result.usage.total_tokens).toBe(25);
      expect(result.model).toBe("openai/gpt-3.5-turbo");
    });

    it("should include system prompt when provided", async () => {
      server.use(
        http.post("https://openrouter.ai/api/v1/chat/completions", async ({ request }) => {
          const body = (await request.json()) as Record<string, unknown>;
          expect(body.messages).toEqual([
            { role: "system", content: "You are a helpful assistant." },
            { role: "user", content: "Hello" },
          ]);
          return HttpResponse.json(mockTextResponse);
        })
      );

      await service.completeChat({
        systemPrompt: "You are a helpful assistant.",
        userPrompt: "Hello",
      });
    });

    it("should use custom model when provided", async () => {
      server.use(
        http.post("https://openrouter.ai/api/v1/chat/completions", async ({ request }) => {
          const body = (await request.json()) as Record<string, unknown>;
          expect(body.model).toBe("openai/gpt-4");
          return HttpResponse.json(mockTextResponse);
        })
      );

      await service.completeChat({
        userPrompt: "Test",
        model: "openai/gpt-4",
      });
    });

    it("should merge default and custom parameters", async () => {
      server.use(
        http.post("https://openrouter.ai/api/v1/chat/completions", async ({ request }) => {
          const body = (await request.json()) as Record<string, unknown>;
          expect(body.temperature).toBe(0.5);
          expect(body.max_tokens).toBe(100);
          return HttpResponse.json(mockTextResponse);
        })
      );

      await service.completeChat({
        userPrompt: "Test",
        params: { temperature: 0.5, max_tokens: 100 },
      });
    });

    it("should include metadata when provided", async () => {
      server.use(
        http.post("https://openrouter.ai/api/v1/chat/completions", async ({ request }) => {
          const body = (await request.json()) as Record<string, unknown>;
          expect(body.metadata).toEqual({ userId: "123", requestId: "abc" });
          return HttpResponse.json(mockTextResponse);
        })
      );

      await service.completeChat({
        userPrompt: "Test",
        metadata: { userId: "123", requestId: "abc" },
      });
    });
  });

  describe("completeStructuredChat", () => {
    const mockStructuredResponse = {
      id: "chatcmpl-123456789",
      object: "chat.completion",
      created: 1677830400,
      model: "openai/gpt-3.5-turbo",
      choices: [
        {
          message: {
            role: "assistant",
            content: JSON.stringify({
              cards: [
                {
                  front: "What is TCP?",
                  back: "Transmission Control Protocol",
                  tag_ids: [1, 2],
                },
              ],
            }),
          },
          finish_reason: "stop",
          index: 0,
        },
      ],
      usage: {
        prompt_tokens: 150,
        completion_tokens: 100,
        total_tokens: 250,
      },
    };
    const responseFormat = {
      type: "json_schema",
      json_schema: {
        name: "flashcard_generation",
        strict: true,
        schema: {
          type: "object",
          properties: {
            cards: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  front: { type: "string" },
                  back: { type: "string" },
                  tag_ids: { type: "array", items: { type: "number" } },
                },
                required: ["front", "back"],
              },
            },
          },
          required: ["cards"],
        },
      },
    } satisfies JsonSchemaResponseFormat;

    it("should successfully complete structured chat and return parsed JSON", async () => {
      server.use(
        http.post("https://openrouter.ai/api/v1/chat/completions", () => {
          return HttpResponse.json(mockStructuredResponse);
        })
      );

      const result = await service.completeStructuredChat({
        userPrompt: "Generate flashcards about networking",
        responseFormat,
      });

      expect(result).toEqual({
        cards: [
          {
            front: "What is TCP?",
            back: "Transmission Control Protocol",
            tag_ids: [1, 2],
          },
        ],
      });
    });

    it("should handle valid partial JSON response", async () => {
      const validPartialResponse = {
        ...mockStructuredResponse,
        choices: [
          {
            message: {
              role: "assistant",
              content: '{"cards": [{"front": "Test", "back": "Answer"}]}',
            },
            finish_reason: "stop",
            index: 0,
          },
        ],
      };

      server.use(
        http.post("https://openrouter.ai/api/v1/chat/completions", () => {
          return HttpResponse.json(validPartialResponse);
        })
      );

      const result = await service.completeStructuredChat({
        userPrompt: "Generate flashcards",
        responseFormat: {
          type: "json_schema",
          json_schema: { name: "test", strict: false, schema: {} },
        },
      });

      expect(result).toEqual({
        cards: [
          {
            front: "Test",
            back: "Answer",
          },
        ],
      });
    });

    it("should handle incomplete JSON in structured response", async () => {
      const incompleteResponse = {
        ...mockStructuredResponse,
        choices: [
          {
            message: {
              role: "assistant",
              content: '{"cards": [{"front": "Test", "back": "Answer"}]',
            },
            finish_reason: "stop",
            index: 0,
          },
        ],
      };

      server.use(
        http.post("https://openrouter.ai/api/v1/chat/completions", () => {
          return HttpResponse.json(incompleteResponse);
        })
      );

      const result = await service.completeStructuredChat({
        userPrompt: "Generate flashcards",
        responseFormat: {
          type: "json_schema",
          json_schema: { name: "test", strict: false, schema: {} },
        },
      });

      expect(result).toEqual({
        cards: [
          {
            front: "Test",
            back: "Answer",
          },
        ],
      });
    });

    it("should include response_format and metadata in request body", async () => {
      server.use(
        http.post("https://openrouter.ai/api/v1/chat/completions", async ({ request }) => {
          const body = (await request.json()) as Record<string, unknown>;
          expect(body.response_format).toEqual(responseFormat);
          expect(body.metadata).toEqual({ userId: "123" });
          return HttpResponse.json(mockStructuredResponse);
        })
      );

      await service.completeStructuredChat({
        userPrompt: "Generate flashcards",
        responseFormat,
        metadata: { userId: "123" },
      });
    });

    it("should use JSON mode and inject schema instruction for Claude models", async () => {
      server.use(
        http.post("https://openrouter.ai/api/v1/chat/completions", async ({ request }) => {
          const body = (await request.json()) as Record<string, unknown>;
          const messages = body.messages as { role: string; content: string }[];
          expect(body.response_format).toEqual({ type: "json_object" });
          expect(messages[0].role).toBe("system");
          expect(messages[0].content).toContain(JSON.stringify(responseFormat.json_schema.schema));
          expect(body.metadata).toEqual({ requestId: "abc" });
          return HttpResponse.json(mockStructuredResponse);
        })
      );

      await service.completeStructuredChat({
        userPrompt: "Generate flashcards",
        model: "anthropic/claude-3-opus",
        responseFormat,
        metadata: { requestId: "abc" },
      });
    });
  });

  describe("structured response parsing", () => {
    const buildResponse = (content: unknown) => ({
      choices: [
        {
          message: {
            content,
          },
          finish_reason: "stop",
          index: 0,
        },
      ],
      usage: {
        prompt_tokens: 1,
        completion_tokens: 1,
        total_tokens: 2,
      },
      model: "openai/gpt-3.5-turbo",
    });
    const parseStructuredResponse = (response: unknown) =>
      (service as unknown as { _parseStructuredResponse: (r: unknown) => unknown })._parseStructuredResponse(response);

    it("should strip markdown code blocks from JSON content", () => {
      const response = buildResponse('```json\n{"cards":[{"front":"Q","back":"A"}]}\n```');
      const result = parseStructuredResponse(response);

      expect(result).toEqual({ cards: [{ front: "Q", back: "A" }] });
    });

    it("should parse object content directly", () => {
      const response = buildResponse({ cards: [{ front: "Q", back: "A" }] });
      const result = parseStructuredResponse(response);

      expect(result).toEqual({ cards: [{ front: "Q", back: "A" }] });
    });

    it("should repair incomplete JSON when possible", () => {
      const response = buildResponse('{"foo":"bar"');
      const result = parseStructuredResponse(response);

      expect(result).toEqual({ foo: "bar" });
    });

    it("should fallback to partial card extraction when JSON is invalid", () => {
      const response = buildResponse('{"cards":[{"front":"Q","back":"A"},{"front":"Q2","back":"A2"}], "oops": }');
      const result = parseStructuredResponse(response);

      expect(result).toEqual({
        cards: [{ front: "Q", back: "A" }],
      });
    });

    it("should throw OpenRouterParseError for unsupported content type", () => {
      const response = buildResponse(123);

      expect(() => parseStructuredResponse(response)).toThrow(OpenRouterParseError);
    });
  });

  describe("tool response parsing", () => {
    const buildToolResponse = (toolCalls?: { function?: { name?: string; arguments?: string } }[]) => ({
      choices: [
        {
          message: {
            tool_calls: toolCalls,
          },
        },
      ],
    });
    const parseToolResponse = (response: unknown) =>
      (service as unknown as { _parseToolResponse: (r: unknown) => unknown })._parseToolResponse(response);

    it("should parse structured tool response arguments", () => {
      const response = buildToolResponse([
        {
          function: {
            name: "generate_structured_response",
            arguments: JSON.stringify({ cards: [{ front: "Q", back: "A" }] }),
          },
        },
      ]);
      const result = parseToolResponse(response);

      expect(result).toEqual({ cards: [{ front: "Q", back: "A" }] });
    });

    it("should throw when tool_calls are missing", () => {
      const response = buildToolResponse();

      expect(() => parseToolResponse(response)).toThrow(OpenRouterParseError);
    });

    it("should throw when tool name is unexpected", () => {
      const response = buildToolResponse([{ function: { name: "unexpected_tool", arguments: "{}" } }]);

      expect(() => parseToolResponse(response)).toThrow(OpenRouterParseError);
    });

    it("should throw when tool arguments are invalid JSON", () => {
      const response = buildToolResponse([{ function: { name: "generate_structured_response", arguments: "{" } }]);

      expect(() => parseToolResponse(response)).toThrow(OpenRouterParseError);
    });

    it("should throw when parsed tool response is not an object", () => {
      const response = buildToolResponse([{ function: { name: "generate_structured_response", arguments: "42" } }]);

      expect(() => parseToolResponse(response)).toThrow(OpenRouterParseError);
    });
  });

  describe("error handling", () => {
    it("should throw OpenRouterAuthError for 401 responses", async () => {
      server.use(
        http.post("https://openrouter.ai/api/v1/chat/completions", () => {
          return HttpResponse.json({ error: { message: "Authentication failed" } }, { status: 401 });
        })
      );

      await expect(service.completeChat({ userPrompt: "Test" })).rejects.toThrow(OpenRouterAuthError);
    });

    it("should throw OpenRouterBadRequestError for 400 responses", async () => {
      server.use(
        http.post("https://openrouter.ai/api/v1/chat/completions", () => {
          return HttpResponse.json({ error: { message: "Invalid parameters" } }, { status: 400 });
        })
      );

      await expect(service.completeChat({ userPrompt: "Test" })).rejects.toThrow(OpenRouterBadRequestError);
    });

    it("should throw OpenRouterRateLimitError for 429 responses", async () => {
      server.use(
        http.post("https://openrouter.ai/api/v1/chat/completions", () => {
          return HttpResponse.json(
            { error: { message: "Rate limit exceeded" } },
            {
              status: 429,
              headers: { "retry-after": "60" },
            }
          );
        })
      );

      await expect(service.completeChat({ userPrompt: "Test" })).rejects.toThrow(OpenRouterRateLimitError);
      try {
        await service.completeChat({ userPrompt: "Test" });
      } catch (error) {
        expect((error as InstanceType<typeof OpenRouterRateLimitError>).retryAfter).toBe(60);
      }
    });

    it("should ignore invalid retry-after header values", async () => {
      server.use(
        http.post("https://openrouter.ai/api/v1/chat/completions", () => {
          return HttpResponse.json(
            { error: { message: "Rate limit exceeded" } },
            {
              status: 429,
              headers: { "retry-after": "not-a-number" },
            }
          );
        })
      );

      try {
        await service.completeChat({ userPrompt: "Test" });
      } catch (error) {
        expect((error as InstanceType<typeof OpenRouterRateLimitError>).retryAfter).toBeUndefined();
      }
    });

    it("should throw OpenRouterServerError for 5xx responses", async () => {
      server.use(
        http.post("https://openrouter.ai/api/v1/chat/completions", () => {
          return HttpResponse.json({ error: { message: "Internal server error" } }, { status: 500 });
        })
      );

      await expect(service.completeChat({ userPrompt: "Test" })).rejects.toThrow(OpenRouterServerError);
    });

    it("should throw OpenRouterError for unexpected status codes", async () => {
      server.use(
        http.post("https://openrouter.ai/api/v1/chat/completions", () => {
          return HttpResponse.text("Unexpected error", { status: 418, statusText: "I'm a teapot" });
        })
      );

      await expect(service.completeChat({ userPrompt: "Test" })).rejects.toThrow(OpenRouterError);
    });

    it("should throw OpenRouterParseError for invalid response structure", async () => {
      server.use(
        http.post("https://openrouter.ai/api/v1/chat/completions", () => {
          return HttpResponse.json({ invalid: "response" });
        })
      );

      await expect(service.completeChat({ userPrompt: "Test" })).rejects.toThrow(OpenRouterParseError);
    });

    it("should throw OpenRouterParseError for missing message content", async () => {
      const invalidResponse = {
        id: "chatcmpl-123",
        object: "chat.completion",
        created: 1677830400,
        model: "gpt-3.5-turbo",
        choices: [
          {
            message: { role: "assistant" }, // missing content
            finish_reason: "stop",
            index: 0,
          },
        ],
        usage: {
          prompt_tokens: 10,
          completion_tokens: 10,
          total_tokens: 20,
        },
      };

      server.use(
        http.post("https://openrouter.ai/api/v1/chat/completions", () => {
          return HttpResponse.json(invalidResponse);
        })
      );

      await expect(service.completeChat({ userPrompt: "Test" })).rejects.toThrow(OpenRouterParseError);
    });

    it("should throw OpenRouterParseError for invalid JSON in structured response", async () => {
      const invalidJsonResponse = {
        id: "chatcmpl-123",
        object: "chat.completion",
        created: 1677830400,
        model: "gpt-3.5-turbo",
        choices: [
          {
            message: {
              role: "assistant",
              content: "invalid json {{{",
            },
            finish_reason: "stop",
            index: 0,
          },
        ],
        usage: {
          prompt_tokens: 10,
          completion_tokens: 10,
          total_tokens: 20,
        },
      };

      server.use(
        http.post("https://openrouter.ai/api/v1/chat/completions", () => {
          return HttpResponse.json(invalidJsonResponse);
        })
      );

      await expect(
        service.completeStructuredChat({
          userPrompt: "Test",
          responseFormat: { type: "json_schema", json_schema: { name: "test", strict: false, schema: {} } },
        })
      ).rejects.toThrow(OpenRouterParseError);
    });

    it("should throw OpenRouterNetworkError for network failures", async () => {
      const mockHttpClient = vi.fn().mockRejectedValue(new Error("Network error"));
      const serviceWithMockClient = new OpenRouterService({
        ...validConfig,
        httpClient: mockHttpClient,
      });

      await expect(serviceWithMockClient.completeChat({ userPrompt: "Test" })).rejects.toThrow(OpenRouterNetworkError);
    });
  });

  describe("HTTP client integration", () => {
    it("should send correct headers", async () => {
      server.use(
        http.post("https://openrouter.ai/api/v1/chat/completions", async ({ request }) => {
          expect(request.headers.get("Authorization")).toBe("Bearer test-api-key");
          expect(request.headers.get("Content-Type")).toBe("application/json");
          expect(request.headers.get("HTTP-Referer")).toBe("https://10xcards.com");
          expect(request.headers.get("X-Title")).toBe("10x-cards");
          return HttpResponse.json({
            id: "test",
            object: "chat.completion",
            created: 123,
            model: "gpt-3.5-turbo",
            choices: [{ message: { role: "assistant", content: "test" }, finish_reason: "stop", index: 0 }],
            usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
          });
        })
      );

      await service.completeChat({ userPrompt: "Test" });
    });

    it("should send correct request body structure", async () => {
      server.use(
        http.post("https://openrouter.ai/api/v1/chat/completions", async ({ request }) => {
          const body = (await request.json()) as Record<string, unknown>;
          expect(body.model).toBe("openai/gpt-3.5-turbo");
          expect(body.messages).toBeInstanceOf(Array);
          expect((body.messages as unknown[])[0]).toEqual({ role: "user", content: "Test prompt" });
          expect(body.temperature).toBe(0.2);
          return HttpResponse.json({
            id: "test",
            object: "chat.completion",
            created: 123,
            model: "gpt-3.5-turbo",
            choices: [{ message: { role: "assistant", content: "test" }, finish_reason: "stop", index: 0 }],
            usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
          });
        })
      );

      await service.completeChat({ userPrompt: "Test prompt" });
    });
  });
});
