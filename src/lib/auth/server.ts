import { AUTH_ERROR_CODES, buildErrorResponse } from "../errors.ts";

export function getCurrentUser(context: {
  locals: { user?: { id: string; email: string } };
}): { id: string; email: string } | null {
  return context.locals.user ?? null;
}

export function requireUserId(context: { locals: { user?: { id: string; email: string } } }): string {
  const user = getCurrentUser(context);
  if (!user) {
    const descriptor = buildErrorResponse(401, AUTH_ERROR_CODES.UNAUTHORIZED, "Authentication required");
    throw descriptor;
  }
  return user.id;
}
