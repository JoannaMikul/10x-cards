import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { TagDTO, TagListResponse } from "../../types";

const DEFAULT_PAGE_LIMIT = 100;

interface UseTagsCatalogResult {
  tags: TagDTO[];
  tagsById: Record<number, TagDTO>;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

interface UseTagsCatalogOptions {
  enabled?: boolean;
  initialTags?: TagDTO[];
}

export function useTagsCatalog(limit = DEFAULT_PAGE_LIMIT, options?: UseTagsCatalogOptions): UseTagsCatalogResult {
  const enabled = options?.enabled ?? true;
  const [tags, setTags] = useState<TagDTO[]>(() => options?.initialTags ?? []);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isMountedRef = useRef(true);

  const normalizedLimit = Math.min(Math.max(Math.trunc(limit) || DEFAULT_PAGE_LIMIT, 1), DEFAULT_PAGE_LIMIT);

  const fetchAllTags = useCallback(async (): Promise<TagDTO[]> => {
    let cursor: string | null = null;
    const aggregated: TagDTO[] = [];

    while (true) {
      const params = new URLSearchParams();
      params.set("limit", String(normalizedLimit));
      params.set("sort", "name");
      if (cursor) {
        params.set("cursor", cursor);
      }

      const payload = await fetchTagsPage(params);
      aggregated.push(...payload.data);

      const nextCursor = payload.page.next_cursor;
      if (!payload.page.has_more || !nextCursor) {
        break;
      }

      cursor = nextCursor;
    }

    return aggregated;
  }, [normalizedLimit]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const allTags = await fetchAllTags();
      if (isMountedRef.current) {
        setTags(allTags);
      }
    } catch (err) {
      if (isMountedRef.current) {
        setTags([]);
        setError(err instanceof Error ? err.message : "Failed to fetch tags catalog.");
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, [fetchAllTags]);

  useEffect(() => {
    isMountedRef.current = true;
    if (!enabled) {
      return () => {
        isMountedRef.current = false;
      };
    }
    void load();
    return () => {
      isMountedRef.current = false;
    };
  }, [enabled, load]);

  const tagsById = useMemo(() => {
    return tags.reduce<Record<number, TagDTO>>((acc, tag) => {
      acc[tag.id] = tag;
      return acc;
    }, {});
  }, [tags]);

  return {
    tags,
    tagsById,
    loading,
    error,
    refresh: load,
  };
}

async function fetchTagsPage(params: URLSearchParams): Promise<TagListResponse> {
  const response = await fetch(`/api/tags?${params.toString()}`, {
    headers: { "Content-Type": "application/json" },
  });

  if (!response.ok) {
    let message = "Failed to fetch tags catalog.";
    try {
      const body = await response.json();
      message = body?.error?.message ?? message;
    } catch {
      // ignore parse errors and use default message
    }
    throw new Error(message);
  }

  return (await response.json()) as TagListResponse;
}
