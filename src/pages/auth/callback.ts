import type { APIRoute } from "astro";

export const prerender = false;

export const GET: APIRoute = async ({ request, redirect }) => {
  const url = new URL(request.url);
  const type = url.searchParams.get("type");
  const tokenHash = url.searchParams.get("token_hash");
  const token = url.searchParams.get("token");

  if (type === "recovery" || tokenHash || token) {
    const redirectUrl = new URL("/auth/update-password", request.url);
    if (tokenHash) redirectUrl.searchParams.set("token_hash", tokenHash);
    if (token) redirectUrl.searchParams.set("token", token);
    if (type) redirectUrl.searchParams.set("type", type);

    return redirect(redirectUrl.toString(), 302);
  }

  return redirect("/", 302);
};
