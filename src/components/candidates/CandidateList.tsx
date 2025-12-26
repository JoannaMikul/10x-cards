import React from "react";
import {
  useReactTable,
  getCoreRowModel,
  getPaginationRowModel,
  type ColumnDef,
  flexRender,
} from "@tanstack/react-table";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table";
import { Button } from "../ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Badge } from "../ui/badge";
import { Loader2 } from "lucide-react";
import { CandidateItem } from "./CandidateItem";
import type { GenerationCandidateDTO, CandidateEditState, TagDTO } from "../../types";

interface CandidateListProps {
  candidates: GenerationCandidateDTO[];
  tagLookup?: Record<number, TagDTO>;
  loading: boolean;
  hasMore: boolean;
  editState: CandidateEditState | null;
  onEditStart: (candidateId: string, front: string, back: string) => void;
  onEditSave: (candidateId: string, changes: { front: string; back: string }) => void;
  onEditCancel: () => void;
  onAccept: (candidateId: string) => Promise<void>;
  onReject: (candidateId: string) => Promise<void>;
  onLoadMore: () => Promise<void>;
}

const columns: ColumnDef<GenerationCandidateDTO>[] = [
  {
    accessorKey: "id",
    header: "ID",
    cell: ({ row }) => <span className="font-mono text-xs text-muted-foreground">{row.original.id.slice(-8)}</span>,
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => {
      const status = row.original.status;
      const getStatusBadge = () => {
        if (status === "accepted") return <Badge variant="default">Accepted</Badge>;
        if (status === "rejected") return <Badge variant="destructive">Rejected</Badge>;
        return <Badge variant="secondary">Proposed</Badge>;
      };
      return getStatusBadge();
    },
  },
  {
    accessorKey: "front",
    header: "Question",
    cell: ({ row }) => (
      <div className="max-w-xs truncate" title={row.original.front}>
        {row.original.front}
      </div>
    ),
  },
  {
    accessorKey: "back",
    header: "Answer",
    cell: ({ row }) => (
      <div className="max-w-xs truncate" title={row.original.back}>
        {row.original.back}
      </div>
    ),
  },
  {
    accessorKey: "created_at",
    header: "Created",
    cell: ({ row }) => (
      <span className="text-xs text-muted-foreground">{new Date(row.original.created_at).toLocaleDateString()}</span>
    ),
  },
];

export function CandidateList({
  candidates,
  tagLookup = {},
  loading,
  hasMore,
  editState,
  onEditStart,
  onEditSave,
  onEditCancel,
  onAccept,
  onReject,
  onLoadMore,
}: CandidateListProps) {
  const table = useReactTable({
    data: candidates,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: {
      pagination: {
        pageSize: 10,
      },
    },
  });

  if (candidates.length === 0 && !loading) {
    return (
      <Card className="shadow-sm">
        <CardContent className="flex items-center justify-center py-12">
          <div className="text-center">
            <p className="text-muted-foreground text-lg">No candidates found</p>
            <p className="text-sm text-muted-foreground mt-2">Generate flashcards to see candidates here</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Table View */}
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle>Candidates Table</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border overflow-hidden">
            <Table>
              <TableHeader>
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id}>
                    {headerGroup.headers.map((header) => (
                      <TableHead key={header.id}>
                        {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                      </TableHead>
                    ))}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody>
                {table.getRowModel().rows?.length ? (
                  table.getRowModel().rows.map((row) => (
                    <TableRow key={row.id}>
                      {row.getVisibleCells().map((cell) => (
                        <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={columns.length} className="h-24 text-center">
                      No results.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Card View with Actions */}
      <div className="space-y-6">
        <h3 className="text-lg font-semibold">Detailed View</h3>
        <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-2 xl:grid-cols-3">
          {candidates.map((candidate) => (
            <CandidateItem
              key={candidate.id}
              candidate={candidate}
              tagLookup={tagLookup}
              editState={editState}
              onEditStart={onEditStart}
              onEditSave={onEditSave}
              onEditCancel={onEditCancel}
              onAccept={onAccept}
              onReject={onReject}
            />
          ))}
        </div>

        {loading && (
          <div className="flex items-center justify-center py-8">
            <div className="flex items-center space-x-2">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <span className="text-muted-foreground">Loading more candidates...</span>
            </div>
          </div>
        )}

        {hasMore && !loading && (
          <div className="flex justify-center py-6">
            <Button onClick={onLoadMore} variant="outline" size="lg">
              Load More Candidates
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
