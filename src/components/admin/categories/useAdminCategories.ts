import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import type {
  AdminCategoryListItemVM,
  ApiErrorResponse,
  CategoriesAdminViewState,
  CategoryDTO,
  CategoryFormValues,
  CategoryListResponse,
  CreateCategoryCommand,
  UpdateCategoryCommand,
} from "../../../types";

interface UseAdminCategoriesReturn {
  state: CategoriesAdminViewState;
  loadInitial: () => Promise<void>;
  searchCategories: (term: string) => Promise<void>;
  loadMore: () => Promise<void>;
  openCreateModal: () => void;
  openEditModal: (category: AdminCategoryListItemVM) => void;
  closeModal: () => void;
  submitForm: (values: CategoryFormValues) => Promise<void>;
  requestDelete: (id: number) => void;
  confirmDelete: () => Promise<void>;
  cancelDelete: () => void;
}

const DEFAULT_LIMIT = 20;
const NETWORK_ERROR_MESSAGE = "A network error occurred.";
const LOGIN_PATH = "/auth/login";

export function useAdminCategories(): UseAdminCategoriesReturn {
  const [state, setState] = useState<CategoriesAdminViewState>({
    items: [],
    loading: false,
    error: null,
    search: "",
    sort: "name",
    nextCursor: null,
    hasMore: false,
    formState: null,
    deleteCandidateId: undefined,
    deleting: false,
    authorizationError: undefined,
  });

  const abortControllerRef = useRef<AbortController | null>(null);
  const redirectToLoginRef = useRef(() => {
    window.location.href = LOGIN_PATH;
  });

  const parseApiError = useCallback(async (response: Response): Promise<ApiErrorResponse> => {
    try {
      const data = await response.json();
      return data as ApiErrorResponse;
    } catch {
      return {
        error: {
          code: "parse_error",
          message: "Failed to parse error response",
        },
      };
    }
  }, []);

  const mapCategoryDtoToVm = useCallback(
    (dto: CategoryDTO): AdminCategoryListItemVM => ({
      id: dto.id,
      name: dto.name,
      slug: dto.slug,
      description: dto.description ?? undefined,
      color: dto.color ?? undefined,
      createdAt: dto.created_at,
      updatedAt: dto.updated_at,
      isDeletable: true,
    }),
    []
  );

  const fetchCategories = useCallback(
    async (searchTerm: string, cursor: string | null = null, append = false) => {
      abortControllerRef.current?.abort();
      const controller = new AbortController();
      abortControllerRef.current = controller;

      setState((prev) => ({
        ...prev,
        loading: true,
        error: null,
        ...(append ? {} : { items: [] }),
      }));

      try {
        const params = new URLSearchParams();
        if (searchTerm.trim()) {
          params.append("search", searchTerm.trim());
        }
        params.append("limit", DEFAULT_LIMIT.toString());
        params.append("sort", "name");
        if (cursor) {
          params.append("cursor", cursor);
        }

        const response = await fetch(`/api/categories?${params.toString()}`, {
          method: "GET",
          signal: controller.signal,
        });

        if (!response.ok) {
          if (response.status === 401 || response.status === 403) {
            const errorData = await parseApiError(response);
            setState((prev) => ({
              ...prev,
              loading: false,
              authorizationError: errorData,
            }));
            redirectToLoginRef.current();
            return;
          }

          const errorData = await parseApiError(response);
          setState((prev) => ({
            ...prev,
            loading: false,
            error: errorData,
          }));
          toast.error("Failed to fetch categories", {
            description: errorData.error.message,
          });
          return;
        }

        const data: CategoryListResponse = await response.json();

        setState((prev) => ({
          ...prev,
          loading: false,
          error: null,
          items: append ? [...prev.items, ...data.data.map(mapCategoryDtoToVm)] : data.data.map(mapCategoryDtoToVm),
          nextCursor: data.page.next_cursor,
          hasMore: data.page.has_more,
          search: searchTerm,
        }));
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }

        const fallbackError: ApiErrorResponse = {
          error: {
            code: "network_error",
            message: error instanceof Error ? error.message : NETWORK_ERROR_MESSAGE,
          },
        };

        setState((prev) => ({
          ...prev,
          loading: false,
          error: fallbackError,
        }));

        toast.error("Network error", {
          description: fallbackError.error.message,
        });
      }
    },
    [mapCategoryDtoToVm, parseApiError]
  );

  const loadInitial = useCallback(async () => {
    await fetchCategories("", null, false);
  }, [fetchCategories]);

  const searchCategories = useCallback(
    async (term: string) => {
      await fetchCategories(term, null, false);
    },
    [fetchCategories]
  );

  const loadMore = useCallback(async () => {
    if (!state.hasMore || state.loading || !state.nextCursor) {
      return;
    }
    await fetchCategories(state.search, state.nextCursor, true);
  }, [state.hasMore, state.loading, state.nextCursor, state.search, fetchCategories]);

  const openCreateModal = useCallback(() => {
    setState((prev) => ({
      ...prev,
      formState: {
        mode: "create",
        values: {
          name: "",
          slug: "",
          description: "",
          color: "",
        },
        isSubmitting: false,
        fieldErrors: [],
        apiError: undefined,
      },
    }));
  }, []);

  const openEditModal = useCallback((category: AdminCategoryListItemVM) => {
    setState((prev) => ({
      ...prev,
      formState: {
        mode: "edit",
        values: {
          name: category.name,
          slug: category.slug,
          description: category.description ?? "",
          color: category.color ?? "",
        },
        categoryId: category.id,
        isSubmitting: false,
        fieldErrors: [],
        apiError: undefined,
      },
    }));
  }, []);

  const closeModal = useCallback(() => {
    setState((prev) => ({
      ...prev,
      formState: null,
    }));
  }, []);

  const submitForm = useCallback(
    async (values: CategoryFormValues) => {
      if (!state.formState) return;

      setState((prev) => ({
        ...prev,
        formState: prev.formState ? { ...prev.formState, isSubmitting: true, apiError: undefined } : null,
      }));

      try {
        let response: Response;
        let successMessage: string;

        if (state.formState.mode === "create") {
          const command: CreateCategoryCommand = {
            name: values.name,
            slug: values.slug,
            description: values.description || undefined,
            color: values.color || undefined,
          };

          response = await fetch("/api/categories", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(command),
          });
          successMessage = "Category created successfully";
        } else {
          if (!state.formState.categoryId) {
            throw new Error("Category ID is required for editing");
          }

          const command: UpdateCategoryCommand = {
            name: values.name,
            slug: values.slug,
            description: values.description || undefined,
            color: values.color || undefined,
          };

          response = await fetch(`/api/categories/${state.formState.categoryId}`, {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(command),
          });
          successMessage = "Category updated successfully";
        }

        if (!response.ok) {
          if (response.status === 401 || response.status === 403) {
            const errorData = await parseApiError(response);
            setState((prev) => ({
              ...prev,
              authorizationError: errorData,
              formState: prev.formState ? { ...prev.formState, isSubmitting: false, apiError: errorData } : null,
            }));
            redirectToLoginRef.current();
            return;
          }

          const errorData = await parseApiError(response);
          setState((prev) => ({
            ...prev,
            formState: prev.formState ? { ...prev.formState, isSubmitting: false, apiError: errorData } : null,
          }));

          if (response.status === 400 && errorData.error.details) {
            toast.error("Validation failed", {
              description: errorData.error.message,
            });
          } else {
            toast.error("Failed to save category", {
              description: errorData.error.message,
            });
          }
          return;
        }

        const savedCategory: CategoryDTO = await response.json();

        setState((prev) => {
          const newItem = mapCategoryDtoToVm(savedCategory);
          let newItems: AdminCategoryListItemVM[];

          if (state.formState?.mode === "create") {
            newItems = [...prev.items, newItem].sort((a, b) => a.name.localeCompare(b.name));
          } else {
            newItems = prev.items.map((item) => (item.id === newItem.id ? newItem : item));
          }

          return {
            ...prev,
            items: newItems,
            formState: null,
          };
        });

        toast.success(successMessage);
      } catch (error) {
        const fallbackError: ApiErrorResponse = {
          error: {
            code: "network_error",
            message: error instanceof Error ? error.message : NETWORK_ERROR_MESSAGE,
          },
        };

        setState((prev) => ({
          ...prev,
          formState: prev.formState ? { ...prev.formState, isSubmitting: false, apiError: fallbackError } : null,
        }));

        toast.error("Network error", {
          description: fallbackError.error.message,
        });
      }
    },
    [state.formState, mapCategoryDtoToVm, parseApiError]
  );

  const requestDelete = useCallback((id: number) => {
    setState((prev) => ({
      ...prev,
      deleteCandidateId: id,
    }));
  }, []);

  const confirmDelete = useCallback(async () => {
    if (!state.deleteCandidateId) return;

    setState((prev) => ({
      ...prev,
      deleting: true,
    }));

    try {
      const response = await fetch(`/api/categories/${state.deleteCandidateId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          const errorData = await parseApiError(response);
          setState((prev) => ({
            ...prev,
            deleting: false,
            authorizationError: errorData,
          }));
          redirectToLoginRef.current();
          return;
        }

        const errorData = await parseApiError(response);

        if (response.status === 409 && errorData.error.code === "category_in_use") {
          setState((prev) => ({
            ...prev,
            deleting: false,
            deleteCandidateId: undefined,
            items: prev.items.map((item) =>
              item.id === state.deleteCandidateId ? { ...item, isDeletable: false } : item
            ),
          }));
          toast.error("Cannot delete category", {
            description: "This category is being used by flashcards and cannot be deleted.",
          });
          return;
        }

        setState((prev) => ({
          ...prev,
          deleting: false,
          deleteCandidateId: undefined,
        }));

        toast.error("Failed to delete category", {
          description: errorData.error.message,
        });
        return;
      }

      setState((prev) => ({
        ...prev,
        deleting: false,
        deleteCandidateId: undefined,
        items: prev.items.filter((item) => item.id !== state.deleteCandidateId),
      }));

      toast.success("Category deleted successfully");
    } catch (error) {
      const fallbackError: ApiErrorResponse = {
        error: {
          code: "network_error",
          message: error instanceof Error ? error.message : NETWORK_ERROR_MESSAGE,
        },
      };

      setState((prev) => ({
        ...prev,
        deleting: false,
        deleteCandidateId: undefined,
      }));

      toast.error("Network error", {
        description: fallbackError.error.message,
      });
    }
  }, [state.deleteCandidateId, parseApiError]);

  const cancelDelete = useCallback(() => {
    setState((prev) => ({
      ...prev,
      deleteCandidateId: undefined,
    }));
  }, []);

  useEffect(() => {
    loadInitial();
  }, [loadInitial]);

  return {
    state,
    loadInitial,
    searchCategories,
    loadMore,
    openCreateModal,
    openEditModal,
    closeModal,
    submitForm,
    requestDelete,
    confirmDelete,
    cancelDelete,
  };
}
