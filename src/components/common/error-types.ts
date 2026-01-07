export type ErrorPageVariant = "not-found" | "forbidden";

export type ErrorCtaHref = "/" | "/generator" | "/flashcards";

export interface ErrorCtaLinkVM {
  label: string;
  href: ErrorCtaHref;
  variant?: "default" | "outline" | "secondary" | "link";
  size?: "default" | "sm" | "lg";
}

export interface ErrorPageViewModel {
  title: string;
  description: string;
  image: { src: string; alt: string };
  links: ErrorCtaLinkVM[];
}
