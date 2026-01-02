import { BaseApiClient } from "./base-api-client";
import type {
  FlashcardDTO,
  FlashcardListResponse,
  CreateFlashcardCommand,
  UpdateFlashcardCommand,
  TagDTO,
  FlashcardsFilters,
} from "../../types";

/**
 * API Client for Flashcards operations
 */
export class FlashcardsApiClient extends BaseApiClient {
  /**
   * List flashcards with filtering, sorting, and pagination
   */
  async list(filters: FlashcardsFilters, cursor?: string | null, limit = 20): Promise<FlashcardListResponse> {
    const params = this.buildListParams(filters, cursor, limit);
    return this.get<FlashcardListResponse>("/flashcards", { params });
  }

  /**
   * Get a single flashcard by ID
   */
  async getById(id: string): Promise<FlashcardDTO> {
    return this.get<FlashcardDTO>(`/flashcards/${id}`);
  }

  /**
   * Create a new flashcard
   */
  async create(command: CreateFlashcardCommand): Promise<FlashcardDTO> {
    return this.post<FlashcardDTO, CreateFlashcardCommand>("/flashcards", command);
  }

  /**
   * Update an existing flashcard
   */
  async update(id: string, command: UpdateFlashcardCommand): Promise<FlashcardDTO> {
    // Separate tag_ids from the rest of the payload
    const { tag_ids, ...basePayload } = command;

    // First update base flashcard data if there's anything to update
    let updatedFlashcard: FlashcardDTO | null = null;

    const hasBaseUpdates = Object.keys(basePayload).length > 0;
    if (hasBaseUpdates) {
      updatedFlashcard = await this.patch<FlashcardDTO, Omit<UpdateFlashcardCommand, "tag_ids">>(
        `/flashcards/${id}`,
        basePayload
      );
    }

    // Then update tags if provided
    if (tag_ids !== undefined) {
      const tags = await this.setTags(id, tag_ids);

      // Merge tags into flashcard response
      if (updatedFlashcard) {
        updatedFlashcard = { ...updatedFlashcard, tags };
      } else {
        // If we didn't update base data, we need to fetch the flashcard
        updatedFlashcard = await this.getById(id);
        updatedFlashcard = { ...updatedFlashcard, tags };
      }
    }

    if (!updatedFlashcard) {
      // If nothing was updated, fetch current state
      updatedFlashcard = await this.getById(id);
    }

    return updatedFlashcard;
  }

  /**
   * Set tags for a flashcard (replaces all existing tags)
   */
  async setTags(id: string, tagIds: number[]): Promise<TagDTO[]> {
    return this.put<TagDTO[], { tag_ids: number[] }>(`/flashcards/${id}/tags`, { tag_ids: tagIds });
  }

  /**
   * Soft delete a flashcard
   */
  async deleteFlashcard(id: string): Promise<void> {
    await this.delete(`/flashcards/${id}`);
  }

  /**
   * Restore a soft-deleted flashcard
   */
  async restore(id: string): Promise<FlashcardDTO> {
    return this.post<FlashcardDTO>(`/flashcards/${id}/restore`);
  }

  /**
   * Build query parameters for list endpoint
   */
  private buildListParams(
    filters: FlashcardsFilters,
    cursor: string | null | undefined,
    limit: number
  ): Record<string, string | number | boolean | string[]> {
    const params: Record<string, string | number | boolean | string[]> = {
      limit,
    };

    if (cursor) {
      params.cursor = cursor;
    }

    const trimmedSearch = filters.search.trim().slice(0, 200);
    if (trimmedSearch.length > 0) {
      params.search = trimmedSearch;
    }

    if (typeof filters.categoryId === "number" && filters.categoryId > 0) {
      params.category_id = filters.categoryId;
    }

    if (typeof filters.contentSourceId === "number" && filters.contentSourceId > 0) {
      params.content_source_id = filters.contentSourceId;
    }

    // Filter and limit tag IDs
    const validTagIds = filters.tagIds.filter((id) => Number.isInteger(id) && id > 0).slice(0, 50);
    if (validTagIds.length > 0) {
      params.tag_ids = validTagIds.map(String);
    }

    if (filters.origin && ["manual", "ai-full", "ai-edited"].includes(filters.origin)) {
      params.origin = filters.origin;
    }

    if (filters.sort) {
      params.sort = filters.sort;
    } else {
      params.sort = "-created_at";
    }

    if (filters.includeDeleted) {
      params.include_deleted = true;
    }

    return params;
  }
}

export const flashcardsApiClient = new FlashcardsApiClient();
