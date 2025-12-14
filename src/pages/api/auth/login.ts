import type { APIRoute } from "astro";

import { createSupabaseServerInstance } from "../../../db/supabase.client.ts";
import { AUTH_ERROR_CODES, type AuthErrorCode } from "../../../lib/errors.ts";
import { loginSchema } from "../../../lib/validation/auth.schema.ts";
import type { LoginCommand, CurrentUserDTO } from "../../../types";

export const prerender = false;

const JSON_HEADERS = { "Content-Type": "application/json" } as const;

export const POST: APIRoute = async ({ request, cookies }) => {
  try {
    const body: LoginCommand = await request.json();

    const validationResult = loginSchema.safeParse(body);
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

    const { data, error } = await supabase.auth.signInWithPassword({
      email: body.email,
      password: body.password,
    });

    if (error) {
      let errorCode: AuthErrorCode = AUTH_ERROR_CODES.UNEXPECTED_ERROR;
      let message = "An unexpected error occurred during login";

      if (error.message.includes("Invalid login credentials")) {
        errorCode = AUTH_ERROR_CODES.INVALID_CREDENTIALS;
        message = "Invalid email or password";
      }

      return new Response(
        JSON.stringify({
          error: { code: errorCode, message },
        }),
        {
          status: 401,
          headers: JSON_HEADERS,
        }
      );
    }

    if (!data.user) {
      return new Response(
        JSON.stringify({
          error: {
            code: AUTH_ERROR_CODES.UNEXPECTED_ERROR,
            message: "Login failed - no user data returned",
          },
        }),
        {
          status: 500,
          headers: JSON_HEADERS,
        }
      );
    }

    const userResponse: CurrentUserDTO = {
      id: data.user.id,
      email: data.user.email || "",
      created_at: data.user.created_at,
    };

    return new Response(JSON.stringify({ user: userResponse }), {
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
