import type { ApiErrorResponse } from "../../types";

/**
 * Configuration options for API requests
 */
export interface ApiRequestOptions extends RequestInit {
  params?: URLSearchParams | Record<string, string | number | boolean | string[]>;
  timeout?: number;
}

/**
 * Base API Client error
 */
export class ApiClientError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode?: number,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = "ApiClientError";
  }

  static fromApiErrorResponse(response: ApiErrorResponse, statusCode?: number): ApiClientError {
    return new ApiClientError(response.error.message, response.error.code, statusCode, response.error.details);
  }

  static network(message = "Network error occurred"): ApiClientError {
    return new ApiClientError(message, "network_error");
  }

  static timeout(message = "Request timeout"): ApiClientError {
    return new ApiClientError(message, "timeout_error");
  }

  static unauthorized(message = "Unauthorized"): ApiClientError {
    return new ApiClientError(message, "unauthorized", 401);
  }

  toApiErrorResponse(): ApiErrorResponse {
    return {
      error: {
        code: this.code,
        message: this.message,
        details: this.details as ApiErrorResponse["error"]["details"],
      },
    };
  }
}

/**
 * Base API Client with common HTTP functionality
 */
export class BaseApiClient {
  private readonly baseUrl: string;
  private readonly defaultTimeout: number;

  constructor(baseUrl = "/api", defaultTimeout = 30000) {
    this.baseUrl = baseUrl;
    this.defaultTimeout = defaultTimeout;
  }

  /**
   * Make an HTTP GET request
   */
  protected async get<TResponse>(path: string, options?: ApiRequestOptions): Promise<TResponse> {
    return this.request<TResponse>(path, { ...options, method: "GET" });
  }

  /**
   * Make an HTTP POST request
   */
  protected async post<TResponse, TBody = unknown>(
    path: string,
    body?: TBody,
    options?: ApiRequestOptions
  ): Promise<TResponse> {
    return this.request<TResponse>(path, {
      ...options,
      method: "POST",
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  /**
   * Make an HTTP PATCH request
   */
  protected async patch<TResponse, TBody = unknown>(
    path: string,
    body?: TBody,
    options?: ApiRequestOptions
  ): Promise<TResponse> {
    return this.request<TResponse>(path, {
      ...options,
      method: "PATCH",
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  /**
   * Make an HTTP PUT request
   */
  protected async put<TResponse, TBody = unknown>(
    path: string,
    body?: TBody,
    options?: ApiRequestOptions
  ): Promise<TResponse> {
    return this.request<TResponse>(path, {
      ...options,
      method: "PUT",
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  /**
   * Make an HTTP DELETE request
   */
  protected async delete<TResponse>(path: string, options?: ApiRequestOptions): Promise<TResponse> {
    return this.request<TResponse>(path, { ...options, method: "DELETE" });
  }

  /**
   * Core request method with error handling, timeout, and authentication
   */
  private async request<TResponse>(path: string, options: ApiRequestOptions = {}): Promise<TResponse> {
    const { params, timeout = this.defaultTimeout, ...fetchOptions } = options;

    // Build URL with query parameters
    const url = this.buildUrl(path, params);

    // Setup abort controller for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    // Merge headers with defaults
    const headers = new Headers(fetchOptions.headers);
    if (!headers.has("Content-Type") && fetchOptions.body) {
      headers.set("Content-Type", "application/json");
    }

    try {
      const response = await globalThis.fetch(url, {
        ...fetchOptions,
        headers,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      return await this.handleResponse<TResponse>(response);
    } catch (error) {
      clearTimeout(timeoutId);

      // Handle abort/timeout
      if (error instanceof DOMException && error.name === "AbortError") {
        throw ApiClientError.timeout();
      }

      // Handle network errors
      if (error instanceof TypeError) {
        throw ApiClientError.network(error.message);
      }

      // Re-throw ApiClientError
      if (error instanceof ApiClientError) {
        throw error;
      }

      // Unknown error
      throw ApiClientError.network(error instanceof Error ? error.message : "Unknown error");
    }
  }

  /**
   * Handle HTTP response and extract data or throw error
   */
  private async handleResponse<TResponse>(response: Response): Promise<TResponse> {
    // Handle 401 Unauthorized - redirect to login
    if (response.status === 401) {
      this.redirectToLogin();
      throw ApiClientError.unauthorized();
    }

    // Success response
    if (response.ok) {
      // Handle empty responses (204 No Content, etc.)
      if (response.status === 204 || response.headers.get("Content-Length") === "0") {
        return {} as TResponse;
      }

      return await response.json();
    }

    // Error response
    const errorData = await this.parseErrorResponse(response);
    throw ApiClientError.fromApiErrorResponse(errorData, response.status);
  }

  /**
   * Parse error response from API
   */
  private async parseErrorResponse(response: Response): Promise<ApiErrorResponse> {
    try {
      const data = await response.json();
      // Validate it's an ApiErrorResponse
      if (data && typeof data === "object" && "error" in data) {
        return data as ApiErrorResponse;
      }
      // Fallback if response doesn't match expected format
      return {
        error: {
          code: "unknown_error",
          message: `Request failed with status ${response.status}`,
        },
      };
    } catch {
      // JSON parse failed
      return {
        error: {
          code: "unknown_error",
          message: `Request failed with status ${response.status}`,
        },
      };
    }
  }

  /**
   * Build URL with query parameters
   */
  private buildUrl(
    path: string,
    params?: URLSearchParams | Record<string, string | number | boolean | string[]>
  ): string {
    // Use relative URL construction to avoid window.location.origin issues
    let urlString = `${this.baseUrl}${path.startsWith("/") ? path : `/${path}`}`;

    if (params) {
      const searchParams = params instanceof URLSearchParams ? params : this.objectToSearchParams(params);
      const queryString = searchParams.toString();
      if (queryString) {
        urlString += `?${queryString}`;
      }
    }

    return urlString;
  }

  /**
   * Convert object to URLSearchParams (handles arrays for tag_ids[], status[], etc.)
   */
  private objectToSearchParams(obj: Record<string, string | number | boolean | string[]>): URLSearchParams {
    const params = new URLSearchParams();

    Object.entries(obj).forEach(([key, value]) => {
      if (Array.isArray(value)) {
        // Handle array parameters (e.g., tag_ids[])
        value.forEach((item) => params.append(`${key}[]`, String(item)));
      } else if (value !== undefined && value !== null) {
        params.set(key, String(value));
      }
    });

    return params;
  }

  /**
   * Redirect to login page with return URL
   */
  private redirectToLogin(): void {
    if (typeof window === "undefined") {
      return;
    }

    const currentPath = window.location.pathname + window.location.search;
    const returnTo = encodeURIComponent(currentPath || "/");
    window.location.href = `/auth/login?returnTo=${returnTo}`;
  }
}
