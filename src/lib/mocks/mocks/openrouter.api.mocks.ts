import { expect } from "vitest";
import type { FlashcardsGenerationResult } from "../../ai-schemas";

interface OpenRouterMessage {
  role: "system" | "user";
  content: string;
}

interface OpenRouterUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

interface OpenRouterChoice {
  message: {
    role: "assistant";
    content: string;
  };
  finish_reason: "stop";
  index: number;
}

interface OpenRouterResponse {
  id: string;
  object: "chat.completion";
  created: number;
  model: string;
  choices: OpenRouterChoice[];
  usage: OpenRouterUsage;
}

export interface OpenRouterApiMock {
  description: string;
  status: number;
  request: {
    method: "POST";
    url: string;
    headers?: Record<string, string>;
    body: {
      model: string;
      messages: OpenRouterMessage[];
      response_format?: {
        type: "json_schema";
        json_schema: {
          schema: Record<string, unknown>;
        };
      };
      temperature?: number;
      max_tokens?: number;
    };
  };
  response: OpenRouterResponse | { error: { message: string } };
}

export const openRouterApiMocks: OpenRouterApiMock[] = [
  {
    description: "200 OK – successful flashcard generation",
    status: 200,
    request: {
      method: "POST",
      url: "https://openrouter.ai/api/v1/chat/completions",
      headers: {
        Authorization: "Bearer test-key",
        "Content-Type": "application/json",
      },
      body: {
        model: "openai/gpt-3.5-turbo",
        messages: [
          {
            role: "system",
            content: expect.stringContaining("You are an expert in creating high-quality educational flashcards"),
          },
          {
            role: "user",
            content: expect.stringContaining(
              "Analyze the following source text and generate up to 10 high-quality educational flashcards"
            ),
          },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            schema: expect.any(Object),
          },
        },
        temperature: 0.3,
      },
    },
    response: {
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
                  back: "Transmission Control Protocol - a connection-oriented protocol that ensures reliable data transmission.",
                  tag_ids: [1, 2],
                },
                {
                  front: "How does TCP establish connections?",
                  back: "Through the three-way handshake: SYN, SYN-ACK, ACK.",
                  tag_ids: [2, 5],
                },
              ],
            } as FlashcardsGenerationResult),
          },
          finish_reason: "stop",
          index: 0,
        },
      ],
      usage: {
        prompt_tokens: 150,
        completion_tokens: 200,
        total_tokens: 350,
      },
    },
  },
  {
    description: "200 OK – flashcard generation with partial JSON response",
    status: 200,
    request: {
      method: "POST",
      url: "https://openrouter.ai/api/v1/chat/completions",
      body: {
        model: "openai/gpt-3.5-turbo",
        messages: expect.any(Array),
        response_format: expect.any(Object),
        temperature: 0.3,
      },
    },
    response: {
      id: "chatcmpl-123456790",
      object: "chat.completion",
      created: 1677830500,
      model: "openai/gpt-3.5-turbo",
      choices: [
        {
          message: {
            role: "assistant",
            content:
              '{"cards": [{"front": "What is UDP?", "back": "User Datagram Protocol - a connectionless protocol", "tag_ids": [1]}',
          },
          finish_reason: "stop",
          index: 0,
        },
      ],
      usage: {
        prompt_tokens: 150,
        completion_tokens: 80,
        total_tokens: 230,
      },
    },
  },
  {
    description: "429 Too Many Requests – rate limit exceeded",
    status: 429,
    request: {
      method: "POST",
      url: "https://openrouter.ai/api/v1/chat/completions",
      body: {
        model: "openai/gpt-3.5-turbo",
        messages: expect.any(Array),
        response_format: expect.any(Object),
        temperature: 0.3,
      },
    },
    response: {
      error: {
        message: "Rate limit exceeded. Please try again later.",
      },
    },
  },
  {
    description: "500 Internal Server Error – OpenRouter service error",
    status: 500,
    request: {
      method: "POST",
      url: "https://openrouter.ai/api/v1/chat/completions",
      body: {
        model: "openai/gpt-3.5-turbo",
        messages: expect.any(Array),
        response_format: expect.any(Object),
        temperature: 0.3,
      },
    },
    response: {
      error: {
        message: "Internal server error occurred.",
      },
    },
  },
  {
    description: "502 Bad Gateway – upstream service error",
    status: 502,
    request: {
      method: "POST",
      url: "https://openrouter.ai/api/v1/chat/completions",
      body: {
        model: "openai/gpt-3.5-turbo",
        messages: expect.any(Array),
        response_format: expect.any(Object),
        temperature: 0.3,
      },
    },
    response: {
      error: {
        message: "Bad gateway error.",
      },
    },
  },
  {
    description: "401 Unauthorized – invalid API key",
    status: 401,
    request: {
      method: "POST",
      url: "https://openrouter.ai/api/v1/chat/completions",
      headers: {
        Authorization: "Bearer invalid-key",
        "Content-Type": "application/json",
      },
      body: {
        model: "openai/gpt-3.5-turbo",
        messages: expect.any(Array),
        response_format: expect.any(Object),
        temperature: 0.3,
      },
    },
    response: {
      error: {
        message: "Authentication failed: invalid or expired API key",
      },
    },
  },
  {
    description: "400 Bad Request – invalid request parameters",
    status: 400,
    request: {
      method: "POST",
      url: "https://openrouter.ai/api/v1/chat/completions",
      body: {
        model: "invalid-model",
        messages: [],
        response_format: expect.any(Object),
        temperature: 0.3,
      },
    },
    response: {
      error: {
        message: "Invalid model specified or malformed request",
      },
    },
  },
];
