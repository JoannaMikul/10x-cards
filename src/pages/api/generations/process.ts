import type { APIRoute } from "astro";
import { supabaseClient } from "../../../db/supabase.client.ts";
import { processPendingGenerations } from "../../../lib/services/generation-processor.service.ts";

export const prerender = false;

export const POST: APIRoute = async ({ locals }) => {
  const supabase = locals.supabase ?? supabaseClient;

  if (!supabase) {
    return new Response(
      JSON.stringify({
        error: {
          code: "missing_supabase_client",
          message: "Supabase client is not available in the current context.",
        },
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  try {
    const result = await processPendingGenerations(supabase);

    return new Response(
      JSON.stringify({
        processed: result.processed,
        succeeded: result.succeeded,
        failed: result.failed,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: {
          code: "processing_error",
          message: error instanceof Error ? error.message : "Failed to process pending generations",
        },
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
};
