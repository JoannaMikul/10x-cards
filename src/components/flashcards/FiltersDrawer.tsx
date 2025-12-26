import { FiltersForm, type FiltersControlsProps } from "./FiltersSidebar";
import { Sheet, SheetContent, SheetHeader, SheetDescription, SheetTitle } from "../ui/sheet";

interface FiltersDrawerProps extends FiltersControlsProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function FiltersDrawer({ open, onOpenChange, ...props }: FiltersDrawerProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="flex w-full max-w-sm flex-col gap-0 p-0">
        <SheetHeader className="px-5 pt-6 pb-0 text-left">
          <SheetTitle>Filters</SheetTitle>
          <SheetDescription id="filters-drawer-description">
            Refine the list of flashcards and save your preferred view.
          </SheetDescription>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto px-5 pb-6">
          <FiltersForm {...props} layout="drawer" />
        </div>
      </SheetContent>
    </Sheet>
  );
}
