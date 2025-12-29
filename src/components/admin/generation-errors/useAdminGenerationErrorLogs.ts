import { useState, useCallback, useRef, useMemo } from "react";
import { toast } from "sonner";
import type {
  AdminGenerationErrorLogsViewState,
  AdminGenerationErrorLogsFilters,
  AdminGenerationErrorLogListItemVM,
  GenerationErrorLogListResponse,
  GenerationErrorLogDTO,
  ApiErrorResponse,
  GenerationErrorLogsExportFormat,
  UseAdminGenerationErrorLogsReturn,
  AdminGenerationErrorLogsDetailsState,
} from "@/types";

const DEFAULT_LIMIT = 20;
const MAX_EXPORT_RECORDS = 10000;

const formatCreatedAt = (isoString: string): string => {
  const date = new Date(isoString);
  return date.toLocaleString("en-US", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
};

const mapDTOToVM = (dto: GenerationErrorLogDTO): AdminGenerationErrorLogListItemVM => ({
  id: String(dto.id),
  userId: dto.user_id,
  model: dto.model,
  errorCode: dto.error_code,
  errorMessage: dto.error_message,
  sourceTextHash: dto.source_text_hash,
  sourceTextLength: Number(dto.source_text_length) || 0,
  createdAt: dto.created_at,
  createdAtFormatted: formatCreatedAt(dto.created_at),
});

const isValidUUID = (str: string): boolean => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
};

const validateFilters = (filters: AdminGenerationErrorLogsFilters): string[] => {
  const errors: string[] = [];

  if (filters.userId.trim() && !isValidUUID(filters.userId.trim())) {
    errors.push("User UUID must be in valid format");
  }

  if (filters.model.length > 200) {
    errors.push("Model name cannot exceed 200 characters");
  }

  if (filters.from && filters.to) {
    const fromDate = new Date(filters.from);
    const toDate = new Date(filters.to);
    if (fromDate > toDate) {
      errors.push("From date cannot be later than to date");
    }

    const diffTime = Math.abs(toDate.getTime() - fromDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    if (diffDays > 90) {
      errors.push("Date range cannot exceed 90 days");
    }
  }

  return errors;
};

const parseApiError = (response: Response, fallbackMessage: string): ApiErrorResponse => {
  return {
    error: {
      code: "network_error",
      message: fallbackMessage,
    },
  };
};

const defaultFilters: AdminGenerationErrorLogsFilters = {
  userId: "",
  model: "",
};

export const useAdminGenerationErrorLogs = (): UseAdminGenerationErrorLogsReturn & {
  detailsState: AdminGenerationErrorLogsDetailsState;
} => {
  const [state, setState] = useState<AdminGenerationErrorLogsViewState>({
    items: [],
    loading: false,
    error: null,
    filters: defaultFilters,
    nextCursor: null,
    hasMore: false,
    validationErrors: [],
    isExporting: false,
  });

  const [detailsState, setDetailsState] = useState<AdminGenerationErrorLogsDetailsState>({
    open: false,
    selectedLog: null,
  });

  const abortControllerRef = useRef<AbortController | null>(null);

  const buildParams = (filters: AdminGenerationErrorLogsFilters, cursor?: string | null) => {
    const params = new URLSearchParams();
    params.set("limit", DEFAULT_LIMIT.toString());

    if (filters.userId.trim()) {
      params.set("user_id", filters.userId.trim());
    }
    if (filters.model.trim()) {
      params.set("model", filters.model.trim());
    }
    if (filters.from) {
      params.set("from", filters.from);
    }
    if (filters.to) {
      params.set("to", filters.to);
    }
    if (cursor) {
      params.set("cursor", cursor);
    }

    return params;
  };

  const loadData = useCallback(
    async (filters: AdminGenerationErrorLogsFilters, cursor?: string | null, append = false): Promise<void> => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      abortControllerRef.current = new AbortController();

      setState((prev) => ({
        ...prev,
        loading: true,
        error: null,
        ...(append ? {} : { items: [], nextCursor: null, hasMore: false }),
      }));

      try {
        const params = buildParams(filters, cursor);
        const response = await fetch(`/api/admin/generation-error-logs?${params}`, {
          signal: abortControllerRef.current.signal,
          headers: {
            Accept: "application/json",
          },
        });

        if (!response.ok) {
          if (response.status === 401 || response.status === 403) {
            const error = await parseApiError(response, "Insufficient permissions to view generation error logs");
            setState((prev) => ({
              ...prev,
              loading: false,
              authorizationError: error,
              lastStatusCode: response.status,
            }));
            return;
          }

          const error = await parseApiError(response, "Error fetching generation error logs");
          setState((prev) => ({
            ...prev,
            loading: false,
            error,
          }));
          return;
        }

        const data: GenerationErrorLogListResponse = await response.json();
        const newItems = data.data.map(mapDTOToVM);

        setState((prev) => ({
          ...prev,
          loading: false,
          items: append ? [...prev.items, ...newItems] : newItems,
          nextCursor: data.page.next_cursor,
          hasMore: data.page.has_more,
        }));
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") {
          return;
        }

        const apiError: ApiErrorResponse = {
          error: {
            code: "network_error",
            message: "Network error while fetching generation error logs",
          },
        };

        setState((prev) => ({
          ...prev,
          loading: false,
          error: apiError,
        }));
      }
    },
    []
  );

  const loadInitial = useCallback(async (): Promise<void> => {
    await loadData(defaultFilters);
  }, [loadData]);

  const applyFilters = useCallback(async (): Promise<void> => {
    const errors = validateFilters(state.filters);
    if (errors.length > 0) {
      setState((prev) => ({ ...prev, validationErrors: errors }));
      toast.error("Please correct filter errors before searching");
      return;
    }

    setState((prev) => ({ ...prev, validationErrors: [] }));
    await loadData(state.filters);
  }, [state.filters, loadData]);

  const resetFilters = useCallback(async (): Promise<void> => {
    setState((prev) => ({
      ...prev,
      filters: defaultFilters,
      validationErrors: [],
    }));
    await loadData(defaultFilters);
  }, [loadData]);

  const loadMore = useCallback(async (): Promise<void> => {
    if (!state.hasMore || state.loading || !state.nextCursor) return;
    await loadData(state.filters, state.nextCursor, true);
  }, [state.hasMore, state.loading, state.nextCursor, state.filters, loadData]);

  const setFilters = useCallback(
    (updater: (prev: AdminGenerationErrorLogsFilters) => AdminGenerationErrorLogsFilters) => {
      setState((prev) => ({
        ...prev,
        filters: updater(prev.filters),
        validationErrors: [],
      }));
    },
    []
  );

  const openDetails = useCallback((log: AdminGenerationErrorLogListItemVM) => {
    setDetailsState({
      open: true,
      selectedLog: log,
    });
  }, []);

  const closeDetails = useCallback(() => {
    setDetailsState({
      open: false,
      selectedLog: null,
    });
  }, []);

  const exportLogs = useCallback(
    async (format: GenerationErrorLogsExportFormat): Promise<void> => {
      if (state.items.length === 0) {
        toast.error("No data to export");
        return;
      }

      setState((prev) => ({ ...prev, isExporting: true }));

      try {
        let allItems: AdminGenerationErrorLogListItemVM[] = [];
        let cursor: string | null = null;
        let hasMore = true;

        while (hasMore && allItems.length < MAX_EXPORT_RECORDS) {
          const params = buildParams(state.filters, cursor);
          const response = await fetch(`/api/admin/generation-error-logs?${params}`);

          if (!response.ok) {
            throw new Error("Error fetching export data");
          }

          const data: GenerationErrorLogListResponse = await response.json();
          const newItems = data.data.map(mapDTOToVM);
          allItems = [...allItems, ...newItems];

          cursor = data.page.next_cursor;
          hasMore = data.page.has_more;
        }

        if (allItems.length >= MAX_EXPORT_RECORDS) {
          toast.warning(`Export limited to first ${MAX_EXPORT_RECORDS} records`);
        }

        let blob: Blob;
        let filename: string;

        if (format === "json") {
          blob = new Blob([JSON.stringify(allItems, null, 2)], { type: "application/json" });
          filename = `generation-errors-${new Date().toISOString().split("T")[0]}.json`;
        } else {
          const headers = [
            "ID",
            "User ID",
            "Model",
            "Error Code",
            "Error Message",
            "Source Text Hash",
            "Source Text Length",
            "Created At",
          ];
          const csvContent = [
            headers.join(","),
            ...allItems.map((item) =>
              [
                `"${item.id}"`,
                `"${item.userId}"`,
                `"${item.model}"`,
                `"${item.errorCode}"`,
                `"${item.errorMessage.replace(/"/g, '""')}"`,
                `"${item.sourceTextHash}"`,
                item.sourceTextLength,
                `"${item.createdAt}"`,
              ].join(",")
            ),
          ].join("\n");

          blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
          filename = `generation-errors-${new Date().toISOString().split("T")[0]}.csv`;
        }

        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        toast.success(`Export completed successfully (${allItems.length} records)`);
      } catch {
        toast.error("Error occurred during export");
      } finally {
        setState((prev) => ({ ...prev, isExporting: false }));
      }
    },
    [state.items.length, state.filters]
  );

  return useMemo(
    () => ({
      state,
      detailsState,
      loadInitial,
      applyFilters,
      setFilters,
      resetFilters,
      loadMore,
      openDetails,
      closeDetails,
      exportLogs,
    }),
    [
      state,
      detailsState,
      loadInitial,
      applyFilters,
      setFilters,
      resetFilters,
      loadMore,
      openDetails,
      closeDetails,
      exportLogs,
    ]
  );
};
