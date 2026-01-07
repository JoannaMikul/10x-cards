import type { APIRoute } from "astro";
import { ANALYTICS_ERROR_CODES, buildErrorResponse } from "../../../lib/errors";

export const prerender = false;

/**
 * GET /api/admin/check
 *
 * Checks if the current user has admin privileges.
 * Returns a simple boolean response.
 *
 * @param locals - Astro locals containing user and supabase client
 * @returns Response with admin status or error response
 */
export const GET: APIRoute = async ({ locals }) => {
  if (!locals.supabase) {
    const descriptor = buildErrorResponse(
      500,
      ANALYTICS_ERROR_CODES.UNEXPECTED_ERROR,
      "Supabase client is not available in the current context."
    );
    return new Response(JSON.stringify(descriptor.body), {
      status: descriptor.status,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (!locals.user) {
    const descriptor = buildErrorResponse(401, ANALYTICS_ERROR_CODES.UNAUTHORIZED, "User not authenticated.");
    return new Response(JSON.stringify(descriptor.body), {
      status: descriptor.status,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const { data, error } = await locals.supabase.rpc("is_admin");

    if (error) {
      const descriptor = buildErrorResponse(500, ANALYTICS_ERROR_CODES.DB_ERROR, "Failed to verify admin privileges.");
      return new Response(JSON.stringify(descriptor.body), {
        status: descriptor.status,
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ isAdmin: data === true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch {
    const descriptor = buildErrorResponse(
      500,
      ANALYTICS_ERROR_CODES.UNEXPECTED_ERROR,
      "Unexpected error while checking admin status."
    );
    return new Response(JSON.stringify(descriptor.body), {
      status: descriptor.status,
      headers: { "Content-Type": "application/json" },
    });
  }
};
