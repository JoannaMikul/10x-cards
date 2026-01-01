import { useCallback, useState } from "react";
import type { FlashcardDTO, FlashcardFormMode, FlashcardFormValues } from "../../types";
import { createEmptyFormValues, mapCardToFormValues } from "../../lib/utils/flashcard-form-mappers";

interface FormState {
  open: boolean;
  mode: FlashcardFormMode;
  cardId?: string;
  initialValues?: FlashcardFormValues;
}

interface ConfirmState {
  open: boolean;
  mode: "delete" | "restore";
  card?: FlashcardDTO;
  isProcessing: boolean;
}

interface UseFlashcardModalsReturn {
  formState: FormState;
  confirmState: ConfirmState;
  handleOpenCreateModal: () => void;
  handleOpenEditModal: (card: FlashcardDTO) => void;
  handleCloseFormModal: () => void;
  handleRequestDelete: (card: FlashcardDTO) => void;
  handleRequestRestore: (card: FlashcardDTO) => void;
  closeConfirmDialog: () => void;
  setConfirmProcessing: (isProcessing: boolean) => void;
}

export function useFlashcardModals(canRestoreCards: boolean): UseFlashcardModalsReturn {
  const [formState, setFormState] = useState<FormState>({
    open: false,
    mode: "create",
    initialValues: createEmptyFormValues(),
  });

  const [confirmState, setConfirmState] = useState<ConfirmState>({
    open: false,
    mode: "delete",
    isProcessing: false,
  });

  const handleOpenCreateModal = useCallback(() => {
    setFormState({
      open: true,
      mode: "create",
      initialValues: createEmptyFormValues(),
    });
  }, []);

  const handleOpenEditModal = useCallback((card: FlashcardDTO) => {
    setFormState({
      open: true,
      mode: "edit",
      cardId: card.id,
      initialValues: mapCardToFormValues(card),
    });
  }, []);

  const handleCloseFormModal = useCallback(() => {
    setFormState((prev) => ({ ...prev, open: false }));
  }, []);

  const handleRequestDelete = useCallback((card: FlashcardDTO) => {
    setConfirmState({
      open: true,
      mode: "delete",
      card,
      isProcessing: false,
    });
  }, []);

  const handleRequestRestore = useCallback(
    (card: FlashcardDTO) => {
      if (!canRestoreCards) {
        return;
      }
      setConfirmState({
        open: true,
        mode: "restore",
        card,
        isProcessing: false,
      });
    },
    [canRestoreCards]
  );

  const closeConfirmDialog = useCallback(() => {
    setConfirmState((prev) => ({
      ...prev,
      open: false,
      isProcessing: false,
    }));
  }, []);

  const setConfirmProcessing = useCallback((isProcessing: boolean) => {
    setConfirmState((prev) => ({ ...prev, isProcessing }));
  }, []);

  return {
    formState,
    confirmState,
    handleOpenCreateModal,
    handleOpenEditModal,
    handleCloseFormModal,
    handleRequestDelete,
    handleRequestRestore,
    closeConfirmDialog,
    setConfirmProcessing,
  };
}
