import type { APIRoute } from "astro";
import { createSupabaseServerInstance } from "../../../db/supabase.client";
import { AUTH_ERROR_CODES, type AuthErrorCode } from "../../../lib/errors";
import { updatePasswordSchema } from "../../../lib/validation/auth.schema";
import type { UpdatePasswordCommand } from "../../../types";

export const prerender = false;

const JSON_HEADERS = { "Content-Type": "application/json" } as const;

export const POST: APIRoute = async ({ request, cookies }) => {
  try {
    const body: UpdatePasswordCommand = await request.json();

    const validationResult = updatePasswordSchema.safeParse(body);
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

    if (!body.tokenHash) {
      return new Response(
        JSON.stringify({
          error: {
            code: AUTH_ERROR_CODES.INVALID_RECOVERY_CODE,
            message: "Recovery token hash is required",
          },
        }),
        {
          status: 400,
          headers: JSON_HEADERS,
        }
      );
    }

    const { error: verifyError } = await supabase.auth.verifyOtp({
      token_hash: body.tokenHash,
      type: "recovery",
    });

    if (verifyError) {
      return new Response(
        JSON.stringify({
          error: {
            code: AUTH_ERROR_CODES.INVALID_RECOVERY_CODE,
            message: "Invalid or expired recovery token",
          },
        }),
        {
          status: 400,
          headers: JSON_HEADERS,
        }
      );
    }

    const { error } = await supabase.auth.updateUser({
      password: body.password,
    });

    if (error) {
      let errorCode: AuthErrorCode = AUTH_ERROR_CODES.UNEXPECTED_ERROR;
      let message = "An unexpected error occurred while updating password";

      if (error.message.includes("Password should be at least")) {
        errorCode = AUTH_ERROR_CODES.PASSWORD_TOO_WEAK;
        message = "Password does not meet security requirements";
      }

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
