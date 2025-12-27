import type { APIRoute } from "astro";
import type { PostgrestError } from "@supabase/supabase-js";

import { DEFAULT_USER_ID, supabaseClient } from "../../../db/supabase.client.ts";
import { CATEGORY_ERROR_CODES, buildErrorResponse, mapCategoryDbError } from "../../../lib/errors.ts";
import { updateCategoryById, deleteCategoryById } from "../../../lib/services/categories.service.ts";
import type { UpdateCategoryCommand } from "../../../types";
import { categoryIdParamSchema, updateCategoryBodySchema } from "../../../lib/validation/categories.schema.ts";

export const prerender = false;

const JSON_HEADERS = { "Content-Type": "application/json" } as const;
const CATEGORY_EVENT_SCOPE = "api/categories/[id]";

/**
 * Checks if the current user has admin privileges.
 * @param supabase Supabase client instance
 * @returns Promise resolving to true if user is admin, throws error otherwise
 */
async function checkAdminStatus(supabase: NonNullable<typeof supabaseClient>): Promise<boolean> {
  const { data, error } = await supabase.rpc("is_admin");

  if (error) {
    throw new Error(`Failed to verify admin privileges: ${error.message}`);
  }

  return data === true;
}

/* eslint-disable no-console */
export const PATCH: APIRoute = async ({ locals, params, request }) => {
  const supabase = locals.supabase ?? supabaseClient;

  if (!supabase) {
    const descriptor = buildErrorResponse(
      500,
      CATEGORY_ERROR_CODES.UNEXPECTED_ERROR,
      "Supabase client is not available in the current context."
    );
    recordCategoriesEvent({
      severity: "error",
      status: descriptor.status,
      code: CATEGORY_ERROR_CODES.UNEXPECTED_ERROR,
      details: { reason: "missing_supabase_client" },
    });
    return jsonResponse(descriptor.status, descriptor.body);
  }

  if (!locals.user) {
    const descriptor = buildErrorResponse(401, CATEGORY_ERROR_CODES.UNAUTHORIZED, "User not authenticated.");
    recordCategoriesEvent({
      severity: "error",
      status: descriptor.status,
      code: CATEGORY_ERROR_CODES.UNAUTHORIZED,
      details: { reason: "user_not_authenticated" },
    });
    return jsonResponse(descriptor.status, descriptor.body);
  }

  const paramValidationResult = categoryIdParamSchema.safeParse(params);
  if (!paramValidationResult.success) {
    const descriptor = buildErrorResponse(400, CATEGORY_ERROR_CODES.INVALID_QUERY, "Invalid category ID parameter.");
    recordCategoriesEvent({
      severity: "info",
      status: descriptor.status,
      code: CATEGORY_ERROR_CODES.INVALID_QUERY,
      details: {
        reason: "invalid_id_param",
        userId: locals.user.id,
        params,
        issues: paramValidationResult.error.issues,
      },
    });
    return jsonResponse(descriptor.status, descriptor.body);
  }

  const { id } = paramValidationResult.data;

  try {
    const isAdmin = await checkAdminStatus(supabase);
    if (!isAdmin) {
      const descriptor = buildErrorResponse(403, CATEGORY_ERROR_CODES.FORBIDDEN, "Admin privileges required.");
      recordCategoriesEvent({
        severity: "error",
        status: descriptor.status,
        code: CATEGORY_ERROR_CODES.FORBIDDEN,
        details: { reason: "user_not_admin", userId: locals.user.id, categoryId: id },
      });
      return jsonResponse(descriptor.status, descriptor.body);
    }
  } catch (error) {
    const descriptor = buildErrorResponse(500, CATEGORY_ERROR_CODES.DB_ERROR, "Failed to verify admin privileges.");
    recordCategoriesEvent({
      severity: "error",
      status: descriptor.status,
      code: CATEGORY_ERROR_CODES.DB_ERROR,
      details: {
        reason: "admin_check_failed",
        userId: locals.user.id,
        categoryId: id,
        message: error instanceof Error ? error.message : String(error),
      },
    });
    return jsonResponse(descriptor.status, descriptor.body);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    const descriptor = buildErrorResponse(400, CATEGORY_ERROR_CODES.INVALID_BODY, "Request body must be valid JSON.");
    recordCategoriesEvent({
      severity: "info",
      status: descriptor.status,
      code: CATEGORY_ERROR_CODES.INVALID_BODY,
      details: { reason: "invalid_json_body", userId: locals.user.id, categoryId: id },
    });
    return jsonResponse(descriptor.status, descriptor.body);
  }

  const validationResult = updateCategoryBodySchema.safeParse(body);
  if (!validationResult.success) {
    const issues = validationResult.error.issues.map((issue) => ({
      message: issue.message,
      path: issue.path,
    }));
    const descriptor = buildErrorResponse(400, CATEGORY_ERROR_CODES.INVALID_BODY, "Request body validation failed.", {
      issues,
    });
    recordCategoriesEvent({
      severity: "info",
      status: descriptor.status,
      code: CATEGORY_ERROR_CODES.INVALID_BODY,
      details: {
        reason: "body_validation_failed",
        userId: locals.user.id,
        categoryId: id,
        issues,
      },
    });
    return jsonResponse(descriptor.status, descriptor.body);
  }

  const command: UpdateCategoryCommand = validationResult.data;

  try {
    const category = await updateCategoryById(supabase, id, command);

    recordCategoriesEvent({
      severity: "info",
      status: 200,
      code: "category_updated",
      details: {
        reason: "category_updated_successfully",
        userId: locals.user.id,
        categoryId: category.id,
        categorySlug: category.slug,
      },
    });

    return jsonResponse(200, category);
  } catch (error) {
    if (isPostgrestError(error)) {
      const descriptor = mapCategoryDbError(error);
      recordCategoriesEvent({
        severity: "error",
        status: descriptor.status,
        code: descriptor.body.error.code,
        details: {
          reason: "postgrest_error",
          userId: locals.user.id,
          categoryId: id,
          command: serializeUpdateCommand(command),
          db_code: error.code,
        },
      });
      return jsonResponse(descriptor.status, descriptor.body);
    }

    if (error instanceof Error && error.message.includes("not found")) {
      const descriptor = buildErrorResponse(404, CATEGORY_ERROR_CODES.NOT_FOUND, "Category not found.");
      recordCategoriesEvent({
        severity: "info",
        status: descriptor.status,
        code: CATEGORY_ERROR_CODES.NOT_FOUND,
        details: {
          reason: "category_not_found",
          userId: locals.user.id,
          categoryId: id,
        },
      });
      return jsonResponse(descriptor.status, descriptor.body);
    }

    const descriptor = buildErrorResponse(
      500,
      CATEGORY_ERROR_CODES.UNEXPECTED_ERROR,
      "Unexpected error while updating category."
    );
    recordCategoriesEvent({
      severity: "error",
      status: descriptor.status,
      code: CATEGORY_ERROR_CODES.UNEXPECTED_ERROR,
      details: {
        reason: "unexpected_update_error",
        userId: locals.user.id,
        categoryId: id,
        command: serializeUpdateCommand(command),
        message: error instanceof Error ? error.message : String(error),
      },
    });
    return jsonResponse(descriptor.status, descriptor.body);
  }
};

export const DELETE: APIRoute = async ({ locals, params }) => {
  const supabase = locals.supabase ?? supabaseClient;

  if (!supabase) {
    const descriptor = buildErrorResponse(
      500,
      CATEGORY_ERROR_CODES.UNEXPECTED_ERROR,
      "Supabase client is not available in the current context."
    );
    recordCategoriesEvent({
      severity: "error",
      status: descriptor.status,
      code: CATEGORY_ERROR_CODES.UNEXPECTED_ERROR,
      details: { reason: "missing_supabase_client" },
    });
    return jsonResponse(descriptor.status, descriptor.body);
  }

  if (!locals.user) {
    const descriptor = buildErrorResponse(401, CATEGORY_ERROR_CODES.UNAUTHORIZED, "User not authenticated.");
    recordCategoriesEvent({
      severity: "error",
      status: descriptor.status,
      code: CATEGORY_ERROR_CODES.UNAUTHORIZED,
      details: { reason: "user_not_authenticated" },
    });
    return jsonResponse(descriptor.status, descriptor.body);
  }

  const paramValidationResult = categoryIdParamSchema.safeParse(params);
  if (!paramValidationResult.success) {
    const descriptor = buildErrorResponse(400, CATEGORY_ERROR_CODES.INVALID_QUERY, "Invalid category ID parameter.");
    recordCategoriesEvent({
      severity: "info",
      status: descriptor.status,
      code: CATEGORY_ERROR_CODES.INVALID_QUERY,
      details: {
        reason: "invalid_id_param",
        userId: locals.user.id,
        params,
        issues: paramValidationResult.error.issues,
      },
    });
    return jsonResponse(descriptor.status, descriptor.body);
  }

  const { id } = paramValidationResult.data;

  try {
    const isAdmin = await checkAdminStatus(supabase);
    if (!isAdmin) {
      const descriptor = buildErrorResponse(403, CATEGORY_ERROR_CODES.FORBIDDEN, "Admin privileges required.");
      recordCategoriesEvent({
        severity: "error",
        status: descriptor.status,
        code: CATEGORY_ERROR_CODES.FORBIDDEN,
        details: { reason: "user_not_admin", userId: locals.user.id, categoryId: id },
      });
      return jsonResponse(descriptor.status, descriptor.body);
    }
  } catch (error) {
    const descriptor = buildErrorResponse(500, CATEGORY_ERROR_CODES.DB_ERROR, "Failed to verify admin privileges.");
    recordCategoriesEvent({
      severity: "error",
      status: descriptor.status,
      code: CATEGORY_ERROR_CODES.DB_ERROR,
      details: {
        reason: "admin_check_failed",
        userId: locals.user.id,
        categoryId: id,
        message: error instanceof Error ? error.message : String(error),
      },
    });
    return jsonResponse(descriptor.status, descriptor.body);
  }

  try {
    await deleteCategoryById(supabase, id);

    recordCategoriesEvent({
      severity: "info",
      status: 204,
      code: "category_deleted",
      details: {
        reason: "category_deleted_successfully",
        userId: locals.user.id,
        categoryId: id,
      },
    });

    return new Response(null, { status: 204 });
  } catch (error) {
    if (isPostgrestError(error)) {
      const descriptor = mapCategoryDbError(error);
      recordCategoriesEvent({
        severity: "error",
        status: descriptor.status,
        code: descriptor.body.error.code,
        details: {
          reason: "postgrest_error",
          userId: locals.user.id,
          categoryId: id,
          db_code: error.code,
        },
      });
      return jsonResponse(descriptor.status, descriptor.body);
    }

    if (error instanceof Error && error.message.includes("not found")) {
      const descriptor = buildErrorResponse(404, CATEGORY_ERROR_CODES.NOT_FOUND, "Category not found.");
      recordCategoriesEvent({
        severity: "info",
        status: descriptor.status,
        code: CATEGORY_ERROR_CODES.NOT_FOUND,
        details: {
          reason: "category_not_found",
          userId: locals.user.id,
          categoryId: id,
        },
      });
      return jsonResponse(descriptor.status, descriptor.body);
    }

    const descriptor = buildErrorResponse(
      500,
      CATEGORY_ERROR_CODES.UNEXPECTED_ERROR,
      "Unexpected error while deleting category."
    );
    recordCategoriesEvent({
      severity: "error",
      status: descriptor.status,
      code: CATEGORY_ERROR_CODES.UNEXPECTED_ERROR,
      details: {
        reason: "unexpected_delete_error",
        userId: locals.user.id,
        categoryId: id,
        message: error instanceof Error ? error.message : String(error),
      },
    });
    return jsonResponse(descriptor.status, descriptor.body);
  }
};

function serializeUpdateCommand(command: UpdateCategoryCommand): Record<string, string | undefined | null> {
  return {
    name: command.name ?? undefined,
    slug: command.slug ?? undefined,
    description: command.description ?? undefined,
    color: command.color ?? undefined,
  };
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

interface CategoryEventPayload {
  severity: "info" | "error";
  status: number;
  code: string;
  details?: Record<string, unknown>;
}

function recordCategoriesEvent(payload: CategoryEventPayload): void {
  const entry = {
    scope: CATEGORY_EVENT_SCOPE,
    timestamp: new Date().toISOString(),
    userId: DEFAULT_USER_ID,
    ...payload,
  };

  const logger = payload.severity === "error" ? console.error : console.info;
  logger(`[${CATEGORY_EVENT_SCOPE}]`, JSON.stringify(entry));
}
/* eslint-enable no-console */
