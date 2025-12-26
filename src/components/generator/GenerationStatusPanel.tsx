import React from "react";
import { Progress } from "../ui/progress";
import { Button } from "../ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { Alert, AlertDescription } from "../ui/alert";
import { Loader2, CheckCircle, XCircle, Clock, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import type { GenerationDTO, ApiErrorResponse } from "../../types";

interface GenerationStatusPanelProps {
  generation: GenerationDTO | null;
  isPolling: boolean;
  onCancel: () => void;
  onNavigateToCandidates: () => void;
  error: ApiErrorResponse | null;
  onClearError: () => void;
}

export function GenerationStatusPanel({
  generation,
  isPolling,
  onCancel,
  onNavigateToCandidates,
  error,
  onClearError,
}: GenerationStatusPanelProps) {
  React.useEffect(() => {
    if (error) {
      const message = error.error.message;
      toast.error("Generation error", {
        description: message,
        action: {
          label: "Close",
          onClick: onClearError,
        },
      });
    }
  }, [error, onClearError]);

  React.useEffect(() => {
    if (generation?.status === "succeeded") {
      toast.success("Generation completed!", {
        description: "Flashcard candidates created successfully. Redirecting to review...",
      });
    }
  }, [generation?.status]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "pending":
        return <Clock className="h-5 w-5 text-yellow-500" />;
      case "running":
        return <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />;
      case "succeeded":
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case "cancelled":
        return <XCircle className="h-5 w-5 text-gray-500" />;
      case "failed":
        return <XCircle className="h-5 w-5 text-red-500" />;
      default:
        return <AlertTriangle className="h-5 w-5 text-orange-500" />;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case "pending":
        return "Waiting to start";
      case "running":
        return "Generation in progress...";
      case "succeeded":
        return "Generation completed";
      case "cancelled":
        return "Generation cancelled";
      case "failed":
        return "Generation error";
      default:
        return "Unknown status";
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending":
        return "bg-yellow-100 text-yellow-800";
      case "running":
        return "bg-blue-100 text-blue-800";
      case "succeeded":
        return "bg-green-100 text-green-800";
      case "cancelled":
        return "bg-gray-100 text-gray-800";
      case "failed":
        return "bg-red-100 text-red-800";
      default:
        return "bg-orange-100 text-orange-800";
    }
  };

  const canCancel = generation?.status === "pending" || generation?.status === "running";

  return (
    <div className="w-full">
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <span>Generation status</span>
            {isPolling && <Loader2 className="h-4 w-4 animate-spin" />}
          </CardTitle>
          <CardDescription>Monitor AI flashcard generation progress</CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          {!generation && !error && (
            <div className="text-center py-8 text-muted-foreground">
              <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No active generation task</p>
              <p className="text-sm">Fill out the form to start</p>
            </div>
          )}

          {generation && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span
                  className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium border-0 ${getStatusColor(generation.status)}`}
                >
                  {getStatusIcon(generation.status)}
                  {getStatusText(generation.status)}
                </span>

                {canCancel && (
                  <Button variant="outline" size="sm" onClick={onCancel}>
                    Cancel
                  </Button>
                )}
              </div>

              {generation.status === "running" && (
                <div className="space-y-2">
                  <Progress value={undefined} className="w-full" />
                  <p className="text-sm text-muted-foreground text-center">
                    AI is analyzing text and creating flashcards...
                  </p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="font-medium">Model:</span>
                  <p className="text-muted-foreground">{generation.model}</p>
                </div>
                <div>
                  <span className="font-medium">Temperature:</span>
                  <p className="text-muted-foreground">{generation.temperature}</p>
                </div>
                <div>
                  <span className="font-medium">Text length:</span>
                  <p className="text-muted-foreground">{generation.sanitized_input_length} characters</p>
                </div>
                <div>
                  <span className="font-medium">Started:</span>
                  <p className="text-muted-foreground">
                    {generation.started_at ? new Date(generation.started_at).toLocaleString("pl-PL") : "Not started"}
                  </p>
                </div>
              </div>

              {generation.status === "succeeded" && (
                <div className="space-y-3">
                  <div className="text-center text-sm text-muted-foreground">
                    Generation completed! Review your AI-generated flashcards.
                  </div>
                  <Button onClick={onNavigateToCandidates} variant="outline" className="w-full">
                    Go to review now
                  </Button>
                </div>
              )}
            </div>
          )}

          {error && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <div className="space-y-2">
                  <p className="font-medium">An error occurred during generation:</p>
                  <p>{error.error.message}</p>
                  <Button variant="outline" size="sm" onClick={onClearError} className="mt-2">
                    Close message
                  </Button>
                </div>
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
