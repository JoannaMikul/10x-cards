import { useCallback } from "react";
import { useAdminCategories } from "./useAdminCategories";
import { CategoryToolbar } from "./CategoryToolbar";
import { CategoriesList } from "./CategoriesList";
import { CategoryFormModal } from "./CategoryFormModal";
import { ConfirmDialog } from "./ConfirmDialog";
import { Skeleton } from "../../ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "../../ui/alert";
import { AlertTriangle } from "lucide-react";
import { Button } from "../../ui/button";
import { RefreshCw } from "lucide-react";

export function AdminCategoriesPage() {
  const {
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
  } = useAdminCategories();

  const handleCreateClick = useCallback(() => {
    openCreateModal();
  }, [openCreateModal]);

  const handleSearchChange = useCallback(
    (search: string) => {
      searchCategories(search);
    },
    [searchCategories]
  );

  const handleEditClick = useCallback(
    (id: number) => {
      const category = state.items.find((item) => item.id === id);
      if (category) {
        openEditModal(category);
      }
    },
    [state.items, openEditModal]
  );

  const handleDeleteClick = useCallback(
    (id: number) => {
      requestDelete(id);
    },
    [requestDelete]
  );

  const handleRetry = useCallback(() => {
    loadInitial();
  }, [loadInitial]);

  const renderContent = () => {
    if (state.loading && state.items.length === 0) {
      return (
        <div className="space-y-4">
          <div className="flex items-center space-x-4">
            <Skeleton className="h-6 w-full" />
          </div>
        </div>
      );
    }

    if (state.loading && state.items.length > 0) {
      return (
        <div className="space-y-4">
          {Array.from({ length: Math.min(state.items.length, 3) }).map((_, i) => (
            <div key={i} className="flex items-center space-x-4">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-20" />
              <div className="flex space-x-2 ml-auto">
                <Skeleton className="h-8 w-16" />
                <Skeleton className="h-8 w-16" />
              </div>
            </div>
          ))}
        </div>
      );
    }

    if (state.error) {
      return (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Error loading categories</AlertTitle>
          <AlertDescription className="space-y-2">
            <p>{state.error.error.message}</p>
            <Button variant="outline" size="sm" onClick={handleRetry} className="mt-2">
              <RefreshCw className="h-4 w-4 mr-2" />
              Try again
            </Button>
          </AlertDescription>
        </Alert>
      );
    }

    return (
      <CategoriesList
        items={state.items}
        loading={state.loading}
        error={state.error}
        onEditClick={handleEditClick}
        onDeleteClick={handleDeleteClick}
        onLoadMore={state.hasMore ? loadMore : undefined}
        hasMore={state.hasMore}
      />
    );
  };

  return (
    <main className="container mx-auto px-0 py-3 space-y-6" role="main" aria-labelledby="admin-categories-title">
      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {state.loading && "Loading categories..."}
        {state.error && "Error loading categories"}
        {!state.loading && !state.error && "Categories loaded successfully"}
      </div>

      <div className="space-y-2">
        <h1 id="admin-categories-title" className="text-2xl font-bold tracking-tight">
          Category Management
        </h1>
        <p className="text-muted-foreground">Manage global categories used as metadata for flashcards.</p>
      </div>

      <CategoryToolbar search={state.search} onDebouncedChange={handleSearchChange} onCreateClick={handleCreateClick} />

      <div className="space-y-6">{renderContent()}</div>

      <CategoryFormModal
        open={!!state.formState}
        mode={state.formState?.mode ?? "create"}
        initialValues={state.formState?.values}
        existingSlugs={state.items.map((item) => item.slug)}
        onSubmit={submitForm}
        onClose={closeModal}
        submitting={state.formState?.isSubmitting ?? false}
        apiError={state.formState?.apiError}
        fieldErrors={state.formState?.fieldErrors ?? []}
      />

      <ConfirmDialog
        open={!!state.deleteCandidateId}
        title="Delete Category"
        description={
          state.deleteCandidateId
            ? `Are you sure you want to delete the category "${state.items.find((item) => item.id === state.deleteCandidateId)?.name}"? This action cannot be undone.`
            : "Are you sure you want to delete this category? This action cannot be undone."
        }
        confirmLabel="Delete"
        cancelLabel="Cancel"
        onConfirm={confirmDelete}
        onCancel={cancelDelete}
        loading={state.deleting}
      />
    </main>
  );
}
