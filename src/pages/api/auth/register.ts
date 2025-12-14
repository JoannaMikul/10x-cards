import type { APIRoute } from "astro";
import { createSupabaseServerInstance } from "../../../db/supabase.client.ts";
import { AUTH_ERROR_CODES, type AuthErrorCode } from "../../../lib/errors.ts";
import { registerApiSchema } from "../../../lib/validation/auth.schema.ts";
import type { RegisterCommand, CurrentUserDTO } from "../../../types";

export const prerender = false;

const JSON_HEADERS = { "Content-Type": "application/json" } as const;

export const POST: APIRoute = async ({ request, cookies }) => {
  try {
    const body: RegisterCommand = await request.json();

    const validationResult = registerApiSchema.safeParse(body);
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

    const { data, error } = await supabase.auth.signUp({
      email: body.email,
      password: body.password,
    });

    if (error) {
      let errorCode: AuthErrorCode = AUTH_ERROR_CODES.UNEXPECTED_ERROR;
      let message = "An unexpected error occurred during registration";

      if (error.message.includes("User already registered")) {
        errorCode = AUTH_ERROR_CODES.EMAIL_ALREADY_REGISTERED;
        message = "Email address is already registered";
      }

      return new Response(
        JSON.stringify({
          error: { code: errorCode, message },
        }),
        {
          status: 409,
          headers: JSON_HEADERS,
        }
      );
    }

    if (!data.user) {
      return new Response(
        JSON.stringify({
          error: {
            code: AUTH_ERROR_CODES.UNEXPECTED_ERROR,
            message: "Registration failed - no user data returned",
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
