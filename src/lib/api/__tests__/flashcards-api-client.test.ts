import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { FlashcardsApiClient } from "../flashcards-api-client";
import type {
  FlashcardDTO,
  FlashcardListResponse,
  CreateFlashcardCommand,
  UpdateFlashcardCommand,
} from "../../../types";

describe("FlashcardsApiClient", () => {
  let client: FlashcardsApiClient;
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    client = new FlashcardsApiClient();
    mockFetch = vi.fn();
    global.fetch = mockFetch as typeof global.fetch;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("list", () => {
    it("should fetch flashcards with default filters", async () => {
      const mockResponse: FlashcardListResponse = {
        data: [
          {
            id: "1",
            front: "Question 1",
            back: "Answer 1",
            origin: "manual",
            tags: [],
            metadata: {},
            category_id: null,
            content_source_id: null,
            owner_id: "owner-1",
            created_at: "2024-01-01T00:00:00Z",
            updated_at: "2024-01-01T00:00:00Z",
            deleted_at: null,
          } as FlashcardDTO,
        ],
        page: {
          next_cursor: null,
          has_more: false,
        },
        aggregates: {
          total: 1,
          by_origin: { manual: 1 },
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
        headers: new Headers(),
      });

      const result = await client.list(
        {
          search: "",
          tagIds: [],
          categoryId: undefined,
          contentSourceId: undefined,
          origin: undefined,
          sort: "-created_at",
          includeDeleted: false,
        },
        null,
        20
      );

      expect(result).toEqual(mockResponse);
      expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining("/api/flashcards"), expect.anything());
    });

    it("should include search parameter", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [], page: { next_cursor: null, has_more: false } }),
        headers: new Headers(),
      });

      await client.list(
        {
          search: "test query",
          tagIds: [],
          categoryId: undefined,
          contentSourceId: undefined,
          origin: undefined,
          sort: "-created_at",
          includeDeleted: false,
        },
        null,
        20
      );

      const url = mockFetch.mock.calls[0][0] as string;
      expect(url).toContain("search=test+query");
    });

    it("should include tag_ids as array parameters", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [], page: { next_cursor: null, has_more: false } }),
        headers: new Headers(),
      });

      await client.list(
        {
          search: "",
          tagIds: [1, 2, 3],
          categoryId: undefined,
          contentSourceId: undefined,
          origin: undefined,
          sort: "-created_at",
          includeDeleted: false,
        },
        null,
        20
      );

      const url = mockFetch.mock.calls[0][0] as string;
      expect(decodeURIComponent(url)).toContain("tag_ids[]=1");
      expect(decodeURIComponent(url)).toContain("tag_ids[]=2");
      expect(decodeURIComponent(url)).toContain("tag_ids[]=3");
    });

    it("should include cursor for pagination", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [], page: { next_cursor: null, has_more: false } }),
        headers: new Headers(),
      });

      await client.list(
        {
          search: "",
          tagIds: [],
          categoryId: undefined,
          contentSourceId: undefined,
          origin: undefined,
          sort: "-created_at",
          includeDeleted: false,
        },
        "cursor-123",
        20
      );

      const url = mockFetch.mock.calls[0][0] as string;
      expect(url).toContain("cursor=cursor-123");
    });
  });

  describe("create", () => {
    it("should create a flashcard", async () => {
      const command: CreateFlashcardCommand = {
        front: "New question",
        back: "New answer",
        origin: "manual",
        tag_ids: [1, 2],
      };

      const mockResponse: FlashcardDTO = {
        id: "new-id",
        ...command,
        tags: [],
        metadata: {},
        category_id: null,
        content_source_id: null,
        owner_id: "owner-1",
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-01T00:00:00Z",
        deleted_at: null,
      } as FlashcardDTO;

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
        headers: new Headers(),
      });

      const result = await client.create(command);

      expect(result).toEqual(mockResponse);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/flashcards"),
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify(command),
        })
      );
    });
  });

  describe("update", () => {
    it("should update flashcard base fields only", async () => {
      const command: UpdateFlashcardCommand = {
        front: "Updated question",
        back: "Updated answer",
      };

      const mockResponse: FlashcardDTO = {
        id: "1",
        ...command,
        origin: "manual",
        tags: [],
        metadata: {},
        category_id: null,
        content_source_id: null,
        owner_id: "owner-1",
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-01T00:00:00Z",
        deleted_at: null,
      } as FlashcardDTO;

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
        headers: new Headers(),
      });

      const result = await client.update("1", command);

      expect(result).toEqual(mockResponse);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/flashcards/1"),
        expect.objectContaining({
          method: "PATCH",
        })
      );
    });

    it("should update tags separately", async () => {
      const command: UpdateFlashcardCommand = {
        tag_ids: [1, 2, 3],
      };

      const mockTags = [
        { id: 1, name: "Tag 1" },
        { id: 2, name: "Tag 2" },
        { id: 3, name: "Tag 3" },
      ];

      const mockFlashcard: FlashcardDTO = {
        id: "1",
        front: "Question",
        back: "Answer",
        origin: "manual",
        tags: mockTags,
        metadata: {},
        category_id: null,
        content_source_id: null,
        owner_id: "owner-1",
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-01T00:00:00Z",
        deleted_at: null,
      } as FlashcardDTO;

      // First call to set tags
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockTags,
        headers: new Headers(),
      });

      // Second call to get flashcard
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockFlashcard,
        headers: new Headers(),
      });

      const result = await client.update("1", command);

      expect(result.tags).toEqual(mockTags);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/flashcards/1/tags"),
        expect.objectContaining({
          method: "PUT",
        })
      );
    });

    it("should update both base fields and tags", async () => {
      const command: UpdateFlashcardCommand = {
        front: "Updated question",
        tag_ids: [1, 2],
      };

      const mockFlashcard: FlashcardDTO = {
        id: "1",
        front: "Updated question",
        back: "Answer",
        origin: "manual",
        tags: [],
        metadata: {},
        category_id: null,
        content_source_id: null,
        owner_id: "owner-1",
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-01T00:00:00Z",
        deleted_at: null,
      } as FlashcardDTO;

      const mockTags = [
        { id: 1, name: "Tag 1" },
        { id: 2, name: "Tag 2" },
      ];

      // First call - update base fields
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockFlashcard,
        headers: new Headers(),
      });

      // Second call - update tags
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockTags,
        headers: new Headers(),
      });

      await client.update("1", command);

      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });

  describe("delete", () => {
    it("should soft delete a flashcard", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 204,
        headers: new Headers(),
      });

      await client.deleteFlashcard("1");

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/flashcards/1"),
        expect.objectContaining({
          method: "DELETE",
        })
      );
    });
  });

  describe("restore", () => {
    it("should restore a soft-deleted flashcard", async () => {
      const mockResponse: FlashcardDTO = {
        id: "1",
        front: "Question",
        back: "Answer",
        origin: "manual",
        deleted_at: null,
        tags: [],
        metadata: {},
        category_id: null,
        content_source_id: null,
        owner_id: "owner-1",
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-01T00:00:00Z",
      } as FlashcardDTO;

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
        headers: new Headers(),
      });

      const result = await client.restore("1");

      expect(result).toEqual(mockResponse);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/flashcards/1/restore"),
        expect.objectContaining({
          method: "POST",
        })
      );
    });
  });
});
