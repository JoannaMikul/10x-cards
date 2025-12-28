import type { APIRoute } from "astro";

export const prerender = false;

/**
 * GET /api/auth/me
 *
 * Returns information about the currently authenticated user.
 *
 * @param locals - Astro locals containing user and supabase client
 * @returns Response with user information or error response
 */
export const GET: APIRoute = async ({ locals }) => {
  if (!locals.user) {
    return new Response(
      JSON.stringify({
        error: {
          code: "unauthorized",
          message: "User not authenticated.",
        },
      }),
      {
        status: 401,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  return new Response(
    JSON.stringify({
      user: {
        id: locals.user.id,
        email: locals.user.email,
      },
    }),
    {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }
  );
};
