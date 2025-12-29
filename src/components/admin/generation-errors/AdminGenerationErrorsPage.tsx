import React, { useEffect } from "react";
import { useAdminGenerationErrorLogs } from "./useAdminGenerationErrorLogs";
import { ErrorFilters } from "./ErrorFilters";
import { GenerationErrorsList } from "./GenerationErrorsList";
import { ExportButton } from "./ExportButton";
import { ErrorDetailsModal } from "./ErrorDetailsModal";

export const AdminGenerationErrorsPage: React.FC = () => {
  const { state, detailsState, loadInitial, ...actions } = useAdminGenerationErrorLogs();

  useEffect(() => {
    loadInitial();
  }, [loadInitial]);

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Generation Errors Diagnostics</h1>
        <p className="text-muted-foreground mt-2">Monitor and diagnose AI flashcard generation errors</p>
      </div>

      <div className="mb-6">
        <ErrorFilters
          filters={state.filters}
          onChange={actions.setFilters}
          onSubmit={actions.applyFilters}
          onReset={actions.resetFilters}
          validationErrors={state.validationErrors}
        />
      </div>

      <div className="mb-6">
        <GenerationErrorsList
          items={state.items}
          loading={state.loading}
          error={state.error}
          hasMore={state.hasMore}
          onLoadMore={actions.loadMore}
          onSelect={actions.openDetails}
          onRetry={loadInitial}
        />
      </div>

      <div className="flex justify-end">
        <ExportButton
          disabled={state.items.length === 0 || state.isExporting}
          isExporting={state.isExporting}
          onExport={actions.exportLogs}
        />
      </div>

      <ErrorDetailsModal open={detailsState.open} log={detailsState.selectedLog} onClose={actions.closeDetails} />
    </div>
  );
};
