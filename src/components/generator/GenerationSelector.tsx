import React from "react";
import { useGenerationsList } from "../hooks/useGenerationsList";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Badge } from "../ui/badge";
import { Skeleton } from "../ui/skeleton";
import { AlertTriangle, Clock, CheckCircle, XCircle, Loader2 } from "lucide-react";
import type { GenerationDTO } from "../../types";

interface GenerationSelectorProps {
  onSelectGeneration: (generationId: string) => void;
}

function getStatusIcon(status: GenerationDTO["status"]) {
  switch (status) {
    case "pending":
      return <Clock className="h-4 w-4 text-yellow-500" />;
    case "running":
      return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />;
    case "succeeded":
      return <CheckCircle className="h-4 w-4 text-green-500" />;
    case "failed":
      return <XCircle className="h-4 w-4 text-red-500" />;
    case "cancelled":
      return <XCircle className="h-4 w-4 text-gray-500" />;
    default:
      return <AlertTriangle className="h-4 w-4 text-gray-500" />;
  }
}

function getStatusBadge(status: GenerationDTO["status"]) {
  const variants = {
    pending: "secondary" as const,
    running: "default" as const,
    succeeded: "default" as const,
    failed: "destructive" as const,
    cancelled: "outline" as const,
  };

  return <Badge variant={variants[status] || "outline"}>{status.charAt(0).toUpperCase() + status.slice(1)}</Badge>;
}

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleString("pl-PL", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function truncateText(text: string | undefined | null, maxLength = 100) {
  if (!text || text.length <= maxLength) return text || "";
  return text.substring(0, maxLength) + "...";
}

export function GenerationSelector({ onSelectGeneration }: GenerationSelectorProps) {
  const { generations, loading, error } = useGenerationsList();

  if (loading) {
    return (
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle>Available Generations</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="border rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-6 w-20" />
              </div>
              <Skeleton className="h-4 w-full mb-2" />
              <Skeleton className="h-4 w-24" />
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle>Available Generations</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center text-muted-foreground py-8">
            <AlertTriangle className="h-8 w-8 mx-auto mb-2 text-red-500" />
            <p>Failed to load generations</p>
            <p className="text-sm mt-1">{error.error.message}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (generations.length === 0) {
    return (
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle>Available Generations</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center text-muted-foreground py-8">
            <p>No generations found</p>
            <p className="text-sm mt-1">
              Create your first generation on the{" "}
              <a href="/generator" className="text-primary hover:underline">
                generator page
              </a>
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-sm">
      <CardHeader>
        <CardTitle>Available Generations</CardTitle>
        <p className="text-sm text-muted-foreground">
          Select a generation to view its candidates. Click on any generation below.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {generations.map((generation) => (
          <div
            key={generation.id}
            className="border rounded-lg p-4 hover:bg-muted/50 cursor-pointer transition-colors"
            onClick={() => onSelectGeneration(generation.id)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onSelectGeneration(generation.id);
              }
            }}
            tabIndex={0}
            role="button"
            aria-label={`Select generation ${generation.model} created ${formatDate(generation.created_at)}`}
          >
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-center gap-2">
                {getStatusIcon(generation.status)}
                <span className="font-medium text-sm">
                  {generation.model} {generation.temperature && `(temp: ${generation.temperature})`}
                </span>
              </div>
              {getStatusBadge(generation.status)}
            </div>

            <p className="text-sm text-muted-foreground mb-2">{truncateText(generation.sanitized_input_text)}</p>

            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Created: {formatDate(generation.created_at)}</span>
              <span>{generation.sanitized_input_length} chars</span>
            </div>

            {generation.error_message && (
              <div className="mt-2 text-xs text-red-600 bg-red-50 p-2 rounded">Error: {generation.error_message}</div>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
