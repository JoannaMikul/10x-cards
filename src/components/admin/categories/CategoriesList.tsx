import { Edit2, Trash2 } from "lucide-react";
import type { AdminCategoryListItemVM, ApiErrorResponse } from "../../../types";
import { Button } from "../../ui/button";
import { Badge } from "../../ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../ui/table";
import { Alert, AlertDescription, AlertTitle } from "../../ui/alert";
import { LoadMoreButton } from "../../flashcards/LoadMoreButton";
import { Tooltip, TooltipContent, TooltipTrigger } from "../../ui/tooltip";

interface CategoriesListProps {
  items: AdminCategoryListItemVM[];
  loading: boolean;
  error?: ApiErrorResponse | null;
  onEditClick: (id: number) => void;
  onDeleteClick: (id: number) => void;
  onLoadMore?: () => void;
  hasMore?: boolean;
}

export function CategoriesList({
  items,
  loading,
  error,
  onEditClick,
  onDeleteClick,
  onLoadMore,
  hasMore = false,
}: CategoriesListProps) {
  if (items.length === 0 && !loading) {
    return (
      <div className="text-center py-12">
        <div className="text-muted-foreground">
          <p className="text-lg font-medium">No categories found</p>
          <p className="text-sm mt-1">No categories match your search criteria.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error && (
        <Alert variant="destructive">
          <AlertTitle>Cannot load categories</AlertTitle>
          <AlertDescription>{error.error.message}</AlertDescription>
        </Alert>
      )}

      <div className="rounded-md border">
        <Table>
          <TableHeader className="bg-primary/90">
            <TableRow className="hover:bg-primary/90">
              <TableHead className="w-[200px] text-primary-foreground">Name</TableHead>
              <TableHead className="w-[150px] text-primary-foreground">Slug</TableHead>
              <TableHead className="text-primary-foreground">Description</TableHead>
              <TableHead className="w-[100px] text-primary-foreground">Color</TableHead>
              <TableHead className="w-[120px] text-right text-primary-foreground">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => (
              <TableRow key={item.id}>
                <TableCell className="font-medium">{item.name}</TableCell>
                <TableCell className="font-mono text-sm text-muted-foreground">{item.slug}</TableCell>
                <TableCell className="max-w-[300px]">
                  {item.description ? (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="truncate text-sm block">{item.description}</span>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="max-w-xs">{item.description}</p>
                      </TooltipContent>
                    </Tooltip>
                  ) : (
                    <span className="text-muted-foreground text-sm">No description</span>
                  )}
                </TableCell>
                <TableCell>
                  {item.color ? (
                    <Badge
                      variant="outline"
                      className="flex items-center gap-2"
                      style={{
                        borderColor: item.color,
                        color: item.color,
                      }}
                    >
                      <div
                        className="w-3 h-3 rounded-full border"
                        style={{ backgroundColor: item.color }}
                        aria-hidden="true"
                      />
                      {item.color}
                    </Badge>
                  ) : (
                    <span className="text-muted-foreground text-sm">No color</span>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onEditClick(item.id)}
                      aria-label={`Edit category ${item.name}`}
                    >
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onDeleteClick(item.id)}
                      disabled={!item.isDeletable}
                      aria-label={
                        item.isDeletable
                          ? `Delete category ${item.name}`
                          : `Cannot delete category ${item.name} - it is used by flashcards`
                      }
                      title={item.isDeletable ? undefined : "This category is used by flashcards and cannot be deleted"}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {hasMore && onLoadMore && (
        <div className="flex justify-center">
          <LoadMoreButton onClick={onLoadMore} loading={loading} hasMore={hasMore} />
        </div>
      )}
    </div>
  );
}
