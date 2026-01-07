import type { APIRoute } from "astro";
import { createSupabaseServerInstance } from "../../../db/supabase.client";
import { AUTH_ERROR_CODES, type AuthErrorCode } from "../../../lib/errors";
import { resetPasswordSchema } from "../../../lib/validation/auth.schema";
import type { ResetPasswordCommand } from "../../../types";

export const prerender = false;

const JSON_HEADERS = { "Content-Type": "application/json" } as const;

export const POST: APIRoute = async ({ request, cookies }) => {
  try {
    const body: ResetPasswordCommand = await request.json();

    const validationResult = resetPasswordSchema.safeParse(body);
    if (!validationResult.success) {
      return new Response(
        JSON.stringify({
          error: {
            code: AUTH_ERROR_CODES.INVALID_BODY,
            message: "Invalid request body",
            details: validationResult.error.errors,
          },
        }),
        {
          status: 400,
          headers: JSON_HEADERS,
        }
      );
    }

    const supabase = createSupabaseServerInstance({ cookies, headers: request.headers });

    const { error } = await supabase.auth.resetPasswordForEmail(body.email, {
      redirectTo: `${new URL(request.url).origin}/auth/callback`,
    });

    if (error) {
      const errorCode: AuthErrorCode = AUTH_ERROR_CODES.UNEXPECTED_ERROR;
      const message = "An unexpected error occurred while sending password reset instructions";

      return new Response(
        JSON.stringify({
          error: { code: errorCode, message },
        }),
        {
          status: 400,
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
