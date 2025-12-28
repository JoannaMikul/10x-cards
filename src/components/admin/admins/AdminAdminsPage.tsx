import { useCallback, useEffect } from "react";
import { useAdminUsers } from "./useAdminUsers";
import { useCurrentUser } from "../../hooks/useCurrentUser";
import { AdminsToolbar } from "./AdminsToolbar";
import { AdminsList } from "./AdminsList";
import { RevokeAdminConfirmDialog } from "./RevokeAdminConfirmDialog";
import { Skeleton } from "../../ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "../../ui/alert";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "../../ui/button";

export function AdminAdminsPage() {
  const { state, loadInitial, searchUsers, autoGrantRole, openRevokeDialog, confirmRevoke, cancelRevoke } =
    useAdminUsers();
  const { user: currentUser, loading: currentUserLoading } = useCurrentUser();

  useEffect(() => {
    if (
      state.items.length === 0 &&
      !state.loading &&
      !state.error &&
      !state.authorizationError &&
      !currentUserLoading &&
      currentUser
    ) {
      loadInitial();
    }
  }, [
    state.items.length,
    state.loading,
    state.error,
    state.authorizationError,
    currentUserLoading,
    currentUser,
    loadInitial,
  ]);

  const handleSearchChange = useCallback(
    (search: string) => {
      searchUsers(search);
    },
    [searchUsers]
  );

  const handleRevokeClick = useCallback(
    (userId: string) => {
      openRevokeDialog(userId);
    },
    [openRevokeDialog]
  );

  const handleAutoGrantClick = useCallback(
    (userId: string) => {
      autoGrantRole(userId);
    },
    [autoGrantRole]
  );

  const handleRetry = useCallback(() => {
    if (currentUser && !currentUserLoading) {
      loadInitial();
    }
  }, [loadInitial, currentUser, currentUserLoading]);

  const renderContent = () => {
    if (state.loading && state.items.length === 0) {
      return (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center space-x-4">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-20" />
              <div className="flex space-x-2 ml-auto">
                <Skeleton className="h-8 w-20" />
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
          <AlertTitle>Error loading administrators</AlertTitle>
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

    if (state.items.length === 0 && !state.loading) {
      return (
        <div className="text-center py-12">
          <div className="text-muted-foreground">
            <p className="text-lg font-medium">No users found</p>
            <p className="text-sm mt-1">
              Set the <code className="bg-muted px-1 py-0.5 rounded text-xs">SUPABASE_SERVICE_ROLE_KEY</code>{" "}
              environment variable to see all users in the system.
            </p>
          </div>
        </div>
      );
    }

    return (
      <AdminsList
        items={state.items.filter(
          (item) =>
            item.userId.toLowerCase().includes(state.search.toLowerCase().trim()) ||
            item.email.toLowerCase().includes(state.search.toLowerCase().trim())
        )}
        loading={state.loading}
        error={state.error}
        search={state.search}
        onRevokeClick={handleRevokeClick}
        onAutoGrantClick={handleAutoGrantClick}
      />
    );
  };

  return (
    <main className="container mx-auto px-0 py-3 space-y-6" role="main" aria-labelledby="admin-admins-title">
      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {state.loading && "Loading administrators..."}
        {state.error && "Error loading administrators"}
        {!state.loading && !state.error && "Administrators loaded successfully"}
      </div>

      <div className="space-y-2">
        <h1 id="admin-admins-title" className="text-2xl font-bold tracking-tight">
          User & Administrator Management
        </h1>
        <p className="text-muted-foreground">Manage users and their administrator privileges in the system.</p>
      </div>

      <AdminsToolbar search={state.search} onSearchChange={handleSearchChange} />

      <div className="space-y-6">{renderContent()}</div>

      <RevokeAdminConfirmDialog state={state.revokeDialogState} onConfirm={confirmRevoke} onCancel={cancelRevoke} />
    </main>
  );
}
