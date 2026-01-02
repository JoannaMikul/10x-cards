import { defineMiddleware } from "astro:middleware";

import { createSupabaseServerInstance, type SupabaseClient } from "../db/supabase.client.ts";

const PUBLIC_PATHS = [
  "/auth/login",
  "/auth/register",
  "/auth/reset-password",
  "/auth/update-password",
  "/auth/callback",
  "/api/auth/login",
  "/api/auth/register",
  "/api/auth/reset-password",
  "/api/auth/update-password",
  "/api/auth/logout",
];

const ADMIN_PATHS = ["/admin", "/admin/"];

/**
 * Checks if the current user has admin privileges.
 * @param supabase Supabase client instance
 * @returns Promise resolving to true if user is admin, false otherwise
 */
async function checkAdminStatus(supabase: SupabaseClient): Promise<boolean> {
  try {
    const { data, error } = await supabase.rpc("is_admin");

    if (error) {
      // eslint-disable-next-line no-console
      console.error("Failed to verify admin privileges:", error.message);
      return false;
    }

    return data === true;
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("Error checking admin status:", error);
    return false;
  }
}

export const onRequest = defineMiddleware(async ({ locals, cookies, url, request, redirect }, next) => {
  if (PUBLIC_PATHS.includes(url.pathname)) {
    return next();
  }

  const supabase = createSupabaseServerInstance({
    cookies,
    headers: request.headers,
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    locals.user = {
      email: user.email || "",
      id: user.id,
    };
    locals.supabase = supabase;
  } else if (!PUBLIC_PATHS.includes(url.pathname)) {
    return redirect("/auth/login");
  }

  // Check admin privileges for admin paths and API endpoints
  if (
    url.pathname.startsWith("/admin/") ||
    url.pathname.startsWith("/api/admin/") ||
    ADMIN_PATHS.includes(url.pathname)
  ) {
    if (!user) {
      return redirect("/auth/login");
    }

    const isAdmin = await checkAdminStatus(supabase);
    if (!isAdmin) {
      // For API endpoints, return 403 Forbidden
      if (url.pathname.startsWith("/api/")) {
        return new Response(
          JSON.stringify({
            error: {
              code: "insufficient_permissions",
              message: "Admin privileges required.",
            },
          }),
          {
            status: 403,
            headers: { "Content-Type": "application/json" },
          }
        );
      }
      // For pages, redirect to home page
      return redirect("/");
    }
  }

  return next();
});
