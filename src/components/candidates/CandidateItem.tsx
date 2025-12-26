import React, { useRef } from "react";
import { Badge } from "../ui/badge";
import { Card, CardContent, CardHeader, CardFooter } from "../ui/card";
import { Button } from "../ui/button";
import { Edit, Check, X } from "lucide-react";
import { CandidateEditor, type CandidateEditorRef } from "./CandidateEditor";
import { AcceptRejectBar } from "./AcceptRejectBar";
import type { GenerationCandidateDTO, CandidateEditState } from "../../types";

function CandidateEditActions({ onSave, onCancel }: { onSave: () => void; onCancel: () => void }) {
  return (
    <div className="flex items-center gap-2">
      <Button type="button" variant="outline" size="sm" onClick={onCancel} className="gap-2">
        <X className="h-4 w-4" />
        Cancel
      </Button>
      <Button size="sm" onClick={onSave} className="gap-2">
        <Check className="h-4 w-4" />
        Save Changes
      </Button>
    </div>
  );
}

interface CandidateItemProps {
  candidate: GenerationCandidateDTO;
  editState: CandidateEditState | null;
  onEditStart: (candidateId: string, front: string, back: string) => void;
  onEditSave: (candidateId: string, changes: { front: string; back: string }) => void;
  onEditCancel: () => void;
  onAccept: (candidateId: string) => Promise<void>;
  onReject: (candidateId: string) => Promise<void>;
}

function CandidateContent({
  candidate,
  isEditing,
  editState,
  onEditSave,
  onEditCancel,
  editorRef,
}: {
  candidate: GenerationCandidateDTO;
  isEditing: boolean;
  editState: CandidateEditState | null;
  onEditSave: (candidateId: string, changes: { front: string; back: string }) => void;
  onEditCancel: () => void;
  editorRef: React.RefObject<CandidateEditorRef | null>;
}) {
  if (isEditing) {
    return (
      <CandidateEditor
        ref={editorRef}
        candidate={candidate}
        onSave={(changes) => onEditSave(candidate.id, changes)}
        onCancel={onEditCancel}
        errors={editState?.errors || []}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <h4 className="text-sm font-medium text-muted-foreground">Question</h4>
        <div className="rounded-md border bg-muted/50 p-3 min-h-[66px] overflow-y-auto">
          <p className="text-sm whitespace-pre-wrap">{candidate.front}</p>
        </div>
      </div>
      <div className="space-y-2">
        <h4 className="text-sm font-medium text-muted-foreground">Answer</h4>
        <div className="rounded-md border bg-muted/50 p-3 min-h-[120px] overflow-y-auto">
          <p className="text-sm whitespace-pre-wrap">{candidate.back}</p>
        </div>
      </div>
    </div>
  );
}

export function CandidateItem({
  candidate,
  editState,
  onEditStart,
  onEditSave,
  onEditCancel,
  onAccept,
  onReject,
}: CandidateItemProps) {
  const editorRef = useRef<CandidateEditorRef>(null);
  const isEditing = !!(editState?.isEditing && editState.candidateId === candidate.id);
  const isPending = candidate.status === "proposed" || candidate.status === "edited";
  const isAccepted = candidate.status === "accepted";
  const isRejected = candidate.status === "rejected";

  const getStatusBadge = () => {
    if (isAccepted) return <Badge variant="default">Accepted</Badge>;
    if (isRejected) return <Badge variant="destructive">Rejected</Badge>;
    return <Badge variant="secondary">Proposed</Badge>;
  };

  const getStatusColor = () => {
    if (isAccepted) return "text-green-600";
    if (isRejected) return "text-red-600";
    return "text-blue-600";
  };

  return (
    <Card className="w-full shadow-sm hover:shadow-md transition-shadow duration-200">
      <CardHeader className="h-10 pb-4 md:pb-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className={`text-sm font-medium ${getStatusColor()}`}>ID: #{candidate.id.slice(-8)}</span>
            {getStatusBadge()}
          </div>
          {!isEditing && isPending && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onEditStart(candidate.id, candidate.front, candidate.back)}
              className="h-8 w-8 p-0"
            >
              <Edit className="h-4 w-4" />
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="flex-1 space-y-4">
        <CandidateContent
          candidate={candidate}
          isEditing={isEditing}
          editState={editState}
          onEditSave={onEditSave}
          onEditCancel={onEditCancel}
          editorRef={editorRef}
        />

        {candidate.suggested_category_id && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>Category:</span>
            <Badge variant="outline" className="text-xs">
              Category #{candidate.suggested_category_id}
            </Badge>
          </div>
        )}

        {candidate.suggested_tags && Array.isArray(candidate.suggested_tags) && candidate.suggested_tags.length > 0 && (
          <div className="flex flex-col gap-2 text-xs text-muted-foreground">
            <span>Tags:</span>
            <div className="flex gap-1 flex-wrap">
              {candidate.suggested_tags.map((tagId, index) => {
                const tagName = String(tagId).replace(/^Tag #/, "");
                return (
                  <Badge key={index} variant="outline" className="text-xs">
                    {tagName}
                  </Badge>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>
      {isPending && (
        <CardFooter className="mt-auto justify-end">
          {isEditing ? (
            <CandidateEditActions onSave={() => editorRef.current?.submit()} onCancel={onEditCancel} />
          ) : (
            <AcceptRejectBar
              candidateId={candidate.id}
              onAccept={onAccept}
              onReject={onReject}
              disabled={!!isEditing}
            />
          )}
        </CardFooter>
      )}
    </Card>
  );
}
