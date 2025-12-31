import { config } from "dotenv";
import { supabaseServiceClient } from "./src/db/supabase.client";

// Load test environment variables
config({ path: ".env.test" });

/**
 * Global teardown function for E2E tests
 * Cleans up test data from Supabase database created by the test user
 * TODO: Refactor to use authenticated client with RLS when environment variables
 * are properly passed to global teardown process
 */
async function globalTeardown() {
  console.log("🧹 GLOBAL TEARDOWN STARTED - E2E test cleanup...");
  console.log("Process env keys:", Object.keys(process.env));
  console.log("E2E_USERNAME_ID:", process.env.E2E_USERNAME_ID);

  const testUserId = process.env.E2E_USERNAME_ID;

  if (!testUserId) {
    console.warn("⚠️  E2E_USERNAME_ID not found in environment variables. Skipping cleanup.");
    console.log(
      "Available env vars:",
      Object.keys(process.env).filter((key) => key.includes("E2E"))
    );
    return;
  }

  try {
    console.log(`🧹 Cleaning up data for test user: ${testUserId}`);

    // Clean up flashcards created by test user (this will cascade to card_tags)
    const { error: flashcardsError } = await supabaseServiceClient
      .from("flashcards")
      .delete()
      .eq("owner_id", testUserId);

    if (flashcardsError) {
      console.error("❌ Error cleaning flashcards:", flashcardsError);
    } else {
      console.log("✅ Cleaned flashcards for test user");
    }

    // Clean up generations created by test user
    const { error: generationsError } = await supabaseServiceClient
      .from("generations")
      .delete()
      .eq("owner_id", testUserId);

    if (generationsError) {
      console.error("❌ Error cleaning generations:", generationsError);
    } else {
      console.log("✅ Cleaned generations for test user");
    }

    // Clean up generation candidates created by test user
    const { error: candidatesError } = await supabaseServiceClient
      .from("generation_candidates")
      .delete()
      .eq("owner_id", testUserId);

    if (candidatesError) {
      console.error("❌ Error cleaning generation_candidates:", candidatesError);
    } else {
      console.log("✅ Cleaned generation_candidates for test user");
    }

    // Clean up generation error logs created by test user
    const { error: errorLogsError } = await supabaseServiceClient
      .from("generation_error_logs")
      .delete()
      .eq("user_id", testUserId);

    if (errorLogsError) {
      console.error("❌ Error cleaning generation_error_logs:", errorLogsError);
    } else {
      console.log("✅ Cleaned generation_error_logs for test user");
    }

    // Clean up review events created by test user
    const { error: reviewEventsError } = await supabaseServiceClient
      .from("review_events")
      .delete()
      .eq("user_id", testUserId);

    if (reviewEventsError) {
      console.error("❌ Error cleaning review_events:", reviewEventsError);
    } else {
      console.log("✅ Cleaned review_events for test user");
    }

    // Clean up review stats for test user
    const { error: reviewStatsError } = await supabaseServiceClient
      .from("review_stats")
      .delete()
      .eq("user_id", testUserId);

    if (reviewStatsError) {
      console.error("❌ Error cleaning review_stats:", reviewStatsError);
    } else {
      console.log("✅ Cleaned review_stats for test user");
    }

    console.log("🎉 E2E test cleanup completed successfully!");
  } catch (error) {
    console.error("💥 Error during E2E test cleanup:", error);
    throw error;
  }
}

export default globalTeardown;
