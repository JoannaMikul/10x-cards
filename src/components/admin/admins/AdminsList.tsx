import { UserX, UserPlus } from "lucide-react";
import type { AdminUserListItemVM, ApiErrorResponse, UserRolesErrorCode } from "../../../types";
import { Button } from "../../ui/button";
import { Badge } from "../../ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../ui/table";
import { Alert, AlertDescription, AlertTitle } from "../../ui/alert";
import { Tooltip, TooltipContent, TooltipTrigger } from "../../ui/tooltip";

interface AdminsListProps {
  items: AdminUserListItemVM[];
  loading: boolean;
  error?: ApiErrorResponse<UserRolesErrorCode> | null;
  search: string;
  onRevokeClick: (userId: string) => void;
  onAutoGrantClick?: (userId: string) => void;
}

export function AdminsList({ items, loading, error, search, onRevokeClick, onAutoGrantClick }: AdminsListProps) {
  if (items.length === 0 && !loading && !search.trim()) {
    return (
      <div className="text-center py-12">
        <div className="text-muted-foreground">
          <p className="text-lg font-medium">No users with roles found</p>
          <p className="text-sm mt-1">Users who have been assigned administrator roles will appear here.</p>
        </div>
      </div>
    );
  }

  if (items.length === 0 && !loading && search.trim()) {
    return (
      <div className="text-center py-12">
        <div className="text-muted-foreground">
          <p className="text-lg font-medium">No users found</p>
          <p className="text-sm mt-1">No users match your search for &ldquo;{search}&rdquo;.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error && (
        <Alert variant="destructive">
          <AlertTitle>Cannot load administrators</AlertTitle>
          <AlertDescription>{error.error.message}</AlertDescription>
        </Alert>
      )}

      <div className="rounded-md border">
        <Table>
          <TableHeader className="bg-primary/90">
            <TableRow className="hover:bg-primary/90">
              <TableHead className="w-[200px] text-primary-foreground">User ID</TableHead>
              <TableHead className="w-[250px] text-primary-foreground">Email</TableHead>
              <TableHead className="w-[100px] text-primary-foreground">Role</TableHead>
              <TableHead className="w-[150px] text-primary-foreground">Created At</TableHead>
              <TableHead className="w-[120px] text-right text-primary-foreground">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => (
              <TableRow key={item.userId}>
                <TableCell className="font-mono text-sm">{item.userId}</TableCell>
                <TableCell className="text-sm">{item.email}</TableCell>
                <TableCell>
                  {item.hasAdminRole ? <Badge variant="secondary">admin</Badge> : <Badge variant="outline">user</Badge>}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {new Date(item.createdAt).toLocaleDateString()}
                </TableCell>
                <TableCell className="text-right">
                  {item.hasAdminRole ? (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => onRevokeClick(item.userId)}
                            disabled={!item.isRevocable}
                            className="border-red-500 bg-red-50 hover:bg-red-100 cursor-pointer"
                            aria-label={
                              item.isRevocable
                                ? `Revoke administrator role from ${item.userId}`
                                : `Cannot revoke administrator role from ${item.userId} - cannot remove the last administrator`
                            }
                          >
                            <UserX className="h-4 w-4" />
                          </Button>
                        </div>
                      </TooltipTrigger>
                      {!item.isRevocable && (
                        <TooltipContent>
                          <p>Cannot revoke administrator role - cannot remove the last administrator</p>
                        </TooltipContent>
                      )}
                    </Tooltip>
                  ) : (
                    onAutoGrantClick && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onAutoGrantClick(item.userId)}
                        className="border-green-500 bg-green-50 hover:bg-green-100 cursor-pointer"
                        aria-label={`Grant administrator role to ${item.userId}`}
                      >
                        <UserPlus className="h-4 w-4" />
                      </Button>
                    )
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
