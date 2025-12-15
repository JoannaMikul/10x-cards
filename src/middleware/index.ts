import { defineMiddleware } from "astro:middleware";

import { createSupabaseServerInstance } from "../db/supabase.client.ts";

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

  return next();
});
