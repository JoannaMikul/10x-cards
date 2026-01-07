import type { APIRoute } from "astro";

import { createSupabaseServerInstance } from "../../../db/supabase.client";
import { AUTH_ERROR_CODES } from "../../../lib/errors";

export const prerender = false;

const JSON_HEADERS = { "Content-Type": "application/json" } as const;

export const POST: APIRoute = async ({ request, cookies }) => {
  try {
    const supabase = createSupabaseServerInstance({ cookies, headers: request.headers });

    const { error } = await supabase.auth.signOut();

    if (error) {
      return new Response(
        JSON.stringify({
          error: {
            code: AUTH_ERROR_CODES.UNEXPECTED_ERROR,
            message: "An unexpected error occurred during logout",
          },
        }),
        {
          status: 500,
          headers: JSON_HEADERS,
        }
      );
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: JSON_HEADERS,
    });
  } catch {
    return new Response(
      JSON.stringify({
        error: {
          code: AUTH_ERROR_CODES.UNEXPECTED_ERROR,
          message: "An unexpected error occurred. Please try again later.",
        },
      }),
      {
        status: 500,
        headers: JSON_HEADERS,
      }
    );
  }
};
