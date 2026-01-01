import { config } from "dotenv";
import { supabaseServiceClient } from "../../src/db/supabase.client";
import type { Database } from "../../src/db/database.types";

config({ path: ".env.test" });

export interface TestFlashcardData {
  front: string;
  back: string;
  category?: string;
  source?: string;
  categoryId?: number;
  contentSourceId?: number;
  tags?: string[];
  origin?: Database["public"]["Enums"]["card_origin"];
}

export function generateTestFlashcard(index = 1, testId = ""): TestFlashcardData {
  const timestamp = Date.now();
  const randomId = Math.random().toString(36).substring(7);
  const uniqueId = testId ? `${testId}-${timestamp}-${randomId}` : `${timestamp}-${randomId}`;

  const hasCategory = index % 2 !== 0;
  const hasSource = index % 3 !== 0;

  return {
    front: `Test Question ${index}: ${uniqueId}`,
    back: `Test Answer ${index}: ${randomId}`,
    category: hasCategory ? "IT" : undefined,
    source: hasSource ? "Documentation" : undefined,
    categoryId: hasCategory ? 1 : undefined,
    contentSourceId: hasSource ? 1 : undefined,
  };
}

export async function createTestFlashcards(
  count: number,
  testUserId: string,
  testId = "",
  additionalFlashcards?: TestFlashcardData[]
): Promise<TestFlashcardData[]> {
  const flashcards: TestFlashcardData[] = [];

  for (let i = 1; i <= count; i++) {
    const flashcardData = generateTestFlashcard(i, testId);
    flashcards.push(flashcardData);

    const { error } = await supabaseServiceClient.from("flashcards").insert({
      front: flashcardData.front,
      back: flashcardData.back,
      category_id: flashcardData.categoryId,
      content_source_id: flashcardData.contentSourceId,
      origin: flashcardData.origin || "manual",
      owner_id: testUserId,
    });

    if (error) {
      throw new Error(`Failed to create test flashcard ${i}: ${error.message}`);
    }
  }

  if (additionalFlashcards) {
    for (let i = 0; i < additionalFlashcards.length; i++) {
      const flashcardData = additionalFlashcards[i];
      flashcards.push(flashcardData);

      const { data: insertedCard, error } = await supabaseServiceClient
        .from("flashcards")
        .insert({
          front: flashcardData.front,
          back: flashcardData.back,
          category_id: flashcardData.categoryId,
          content_source_id: flashcardData.contentSourceId,
          origin: flashcardData.origin || "manual",
          owner_id: testUserId,
        })
        .select("id")
        .single();

      if (error || !insertedCard) {
        throw new Error(`Failed to create additional test flashcard ${i}: ${error.message}`);
      }

      if (flashcardData.tags && flashcardData.tags.length > 0) {
        const tagIds: number[] = [];
        for (const tagName of flashcardData.tags) {
          const { data: tag, error: tagError } = await supabaseServiceClient
            .from("tags")
            .select("id")
            .eq("name", tagName)
            .single();

          if (tagError || !tag) {
            throw new Error(`Failed to find tag "${tagName}": ${tagError?.message}`);
          }

          tagIds.push(tag.id);
        }

        const { error: tagError } = await supabaseServiceClient.from("card_tags").insert(
          tagIds.map((tagId) => ({
            card_id: insertedCard.id,
            tag_id: tagId,
          }))
        );

        if (tagError) {
          throw new Error(`Failed to add tags to flashcard ${i}: ${tagError.message}`);
        }
      }
    }
  }

  return flashcards;
}

export async function cleanupTestFlashcards(testUserId: string): Promise<void> {
  const { error } = await supabaseServiceClient.from("flashcards").delete().eq("owner_id", testUserId);

  if (error) {
    throw new Error(`Failed to cleanup test flashcards: ${error.message}`);
  }
}

export async function createSingleTestFlashcard(
  testUserId: string,
  data?: Partial<TestFlashcardData>
): Promise<{ id: string; data: TestFlashcardData }> {
  const flashcardData = { ...generateTestFlashcard(), ...data };

  const { data: inserted, error } = await supabaseServiceClient
    .from("flashcards")
    .insert({
      front: flashcardData.front,
      back: flashcardData.back,
      category_id: flashcardData.categoryId,
      content_source_id: flashcardData.contentSourceId,
      origin: "manual",
      owner_id: testUserId,
    })
    .select("id")
    .single();

  if (error || !inserted) {
    throw new Error(`Failed to create single test flashcard: ${error?.message}`);
  }

  return { id: inserted.id, data: flashcardData };
}

export function getTestUserId(): string {
  const testUserId = process.env.E2E_USERNAME_ID;
  if (!testUserId) {
    throw new Error("E2E_USERNAME_ID environment variable is required");
  }
  return testUserId;
}
