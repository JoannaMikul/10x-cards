import type { APIRoute } from "astro";
import type { PostgrestError } from "@supabase/supabase-js";

import { supabaseClient } from "../../db/supabase.client.ts";
import { CANDIDATE_ERROR_CODES, buildErrorResponse, mapCandidateDbError } from "../../lib/errors.ts";
import { listGenerationCandidates } from "../../lib/services/generation-candidates.service.ts";
import { getGenerationById } from "../../lib/services/generations.service.ts";
import {
  InvalidCandidateCursorError,
  buildGenerationCandidatesQuery,
  generationCandidatesQuerySchema,
  type GenerationCandidatesQuery,
} from "../../lib/validation/generation-candidates.schema.ts";
import { encodeBase64 } from "../../lib/utils/base64.ts";
import type { GenerationCandidateListResponse } from "../../types";

export const prerender = false;

const JSON_HEADERS = { "Content-Type": "application/json" } as const;

interface RawGenerationCandidatesQueryParams {
  generation_id?: string;
  limit?: string;
  cursor?: string;
  "status[]": string[] | undefined;
}

export const GET: APIRoute = async ({ locals, url }) => {
  const supabase = locals.supabase ?? supabaseClient;

  if (!supabase) {
    const descriptor = buildErrorResponse(
      500,
      CANDIDATE_ERROR_CODES.UNEXPECTED_ERROR,
      "Supabase client is not available in the current context."
    );
    return jsonResponse(descriptor.status, descriptor.body);
  }

  if (!locals.user) {
    const descriptor = buildErrorResponse(401, CANDIDATE_ERROR_CODES.UNEXPECTED_ERROR, "User not authenticated.");
    return jsonResponse(descriptor.status, descriptor.body);
  }

  const rawQuery = buildRawQuery(url);
  const validationResult = generationCandidatesQuerySchema.safeParse(rawQuery);

  if (!validationResult.success) {
    const message =
      validationResult.error.issues.map((issue) => issue.message).join("; ") || "Query parameters are invalid.";
    return invalidQueryResponse(message);
  }

  let query: GenerationCandidatesQuery;
  try {
    query = buildGenerationCandidatesQuery(validationResult.data);
  } catch (error) {
    if (error instanceof InvalidCandidateCursorError) {
      return invalidQueryResponse(error.message);
    }

    const descriptor = buildErrorResponse(
      500,
      CANDIDATE_ERROR_CODES.UNEXPECTED_ERROR,
      "Unexpected error while parsing the query cursor."
    );
    return jsonResponse(descriptor.status, descriptor.body);
  }

  const userId = locals.user.id;

  try {
    const generation = await getGenerationById(supabase, userId, query.generationId);

    if (generation && generation.status === "succeeded") {
      const { data: candidates } = await supabase
        .from("generation_candidates")
        .select("id, status")
        .eq("generation_id", query.generationId)
        .eq("owner_id", userId);

      if (!candidates || candidates.length === 0) {
        try {
          await fetch("/api/generations/process", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
          });
        } catch {
          // Ignore reprocessing errors
        }

        return jsonResponse(202, {
          data: [],
          page: {
            has_more: false,
            next_cursor: null,
          },
          message: "Generation completed but no candidates were created. Reprocessing has been triggered.",
        });
      }
    }

    if (!generation) {
      const { data: anyGeneration } = await supabase
        .from("generations")
        .select("id, user_id, status")
        .eq("id", query.generationId)
        .maybeSingle();

      if (anyGeneration) {
        return jsonResponse(403, {
          error: {
            code: "forbidden",
            message: "You don't have access to this generation.",
          },
        });
      }

      const descriptor = buildErrorResponse(404, CANDIDATE_ERROR_CODES.NOT_FOUND, "Generation could not be found.");
      return jsonResponse(descriptor.status, descriptor.body);
    }

    const result = await listGenerationCandidates(supabase, userId, query);
    const payload: GenerationCandidateListResponse = {
      data: result.items,
      page: {
        has_more: result.hasMore,
        next_cursor: encodeCandidateCursor(result.nextCursorId),
      },
    };

    return jsonResponse(200, payload);
  } catch (error) {
    if (isPostgrestError(error)) {
      const descriptor = mapCandidateDbError(error);
      return jsonResponse(descriptor.status, descriptor.body);
    }

    const descriptor = buildErrorResponse(
      500,
      CANDIDATE_ERROR_CODES.UNEXPECTED_ERROR,
      "Unexpected error while fetching generation candidates."
    );
    return jsonResponse(descriptor.status, descriptor.body);
  }
};

function buildRawQuery(url: URL): RawGenerationCandidatesQueryParams {
  const statusFilters = url.searchParams.getAll("status[]");

  return {
    generation_id: optionalParam(url.searchParams.get("generation_id")),
    limit: optionalParam(url.searchParams.get("limit")),
    cursor: optionalParam(url.searchParams.get("cursor")),
    "status[]": statusFilters.length > 0 ? statusFilters : undefined,
  };
}

function optionalParam(value: string | null): string | undefined {
  return value ?? undefined;
}

function encodeCandidateCursor(id: string | null): string | null {
  if (!id) {
    return null;
  }

  try {
    return encodeBase64(id);
  } catch {
    return null;
  }
}

function invalidQueryResponse(message: string): Response {
  const descriptor = buildErrorResponse(400, CANDIDATE_ERROR_CODES.INVALID_QUERY, message);
  return jsonResponse(descriptor.status, descriptor.body);
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: JSON_HEADERS,
  });
}

function isPostgrestError(error: unknown): error is PostgrestError {
  return Boolean(
    error && typeof error === "object" && "code" in error && typeof (error as Record<string, unknown>).code === "string"
  );
}
