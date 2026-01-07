import React, { useEffect } from "react";
import { Button } from "@/components/ui/button";
import type { ErrorPageViewModel } from "./error-types";

interface ErrorPageProps {
  vm: ErrorPageViewModel;
  focusTargetId?: string;
}

export const ErrorPage: React.FC<ErrorPageProps> = ({ vm, focusTargetId = "error-title" }) => {
  useEffect(() => {
    // Focus on the heading for accessibility
    const heading = document.getElementById(focusTargetId);
    if (heading) {
      heading.focus();
    }
  }, [focusTargetId]);

  return (
    <section className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4 py-12 md:py-16">
      <div className="w-full max-w-md mb-8">
        <img src={vm.image.src} alt={vm.image.alt} className="w-full h-auto object-contain mx-auto" />
      </div>

      <h1
        id={focusTargetId}
        tabIndex={-1}
        className="text-3xl md:text-4xl font-bold tracking-tight text-foreground mb-4 outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring"
      >
        {vm.title}
      </h1>

      <p className="text-lg text-muted-foreground max-w-[600px] mb-8">{vm.description}</p>

      <div className="flex flex-wrap items-center justify-center gap-4">
        {vm.links.map((link, index) => (
          <Button
            key={`${link.href}-${index}`}
            variant={link.variant || "default"}
            size={link.size || "default"}
            asChild
          >
            <a href={link.href}>{link.label}</a>
          </Button>
        ))}
      </div>
    </section>
  );
};
