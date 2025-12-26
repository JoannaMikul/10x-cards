import { FiltersForm, type FiltersControlsProps } from "./FiltersSidebar";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "../ui/dialog";

interface FiltersModalProps extends FiltersControlsProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function FiltersModal({ open, onOpenChange, ...props }: FiltersModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-h-[90vh] w-full max-w-4xl overflow-y-auto p-0 sm:p-6"
        aria-describedby="filters-modal-description"
      >
        <DialogHeader className="px-6 pt-6 text-left sm:px-0 sm:pt-0">
          <DialogTitle>Filters</DialogTitle>
          <DialogDescription id="filters-modal-description">
            Refine the list of flashcards and save your preferred view.
          </DialogDescription>
        </DialogHeader>
        <div className="px-6 pb-6 pt-2 sm:px-0 sm:pb-0 sm:pt-4">
          <FiltersForm {...props} layout="panel" />
        </div>
      </DialogContent>
    </Dialog>
  );
}
