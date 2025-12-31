import { useMemo } from "react";
import sanitizeHtml from "sanitize-html";
import { MIN_SANITIZED_TEXT_LENGTH, MAX_SANITIZED_TEXT_LENGTH } from "../../lib/validation/generations.schema";

export interface SanitizedTextResult {
  sanitized: string;
  isValid: boolean;
  error?: string;
  characterCount: number;
}

export interface UseTextValidationOptions {
  minLength?: number;
  maxLength?: number;
  allowedTags?: string[];
  allowedAttributes?: Record<string, string[]>;
}

export interface UseTextValidationReturn {
  sanitizeAndValidate: (text: string) => SanitizedTextResult;
  isValidLength: (text: string) => boolean;
}

const DEFAULT_ALLOWED_TAGS = [
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "p",
  "span",
  "div",
  "br",
  "strong",
  "b",
  "em",
  "i",
  "ul",
  "ol",
  "li",
  "a",
  "code",
  "pre",
  "blockquote",
  "hr",
  "mark",
  "sup",
  "sub",
];

const DEFAULT_ALLOWED_ATTRIBUTES = {
  a: ["href", "target", "rel", "title"],
  "*": ["class", "id", "style"],
};

export function useTextValidation(options: UseTextValidationOptions = {}): UseTextValidationReturn {
  const {
    minLength = MIN_SANITIZED_TEXT_LENGTH,
    maxLength = MAX_SANITIZED_TEXT_LENGTH,
    allowedTags = DEFAULT_ALLOWED_TAGS,
    allowedAttributes = DEFAULT_ALLOWED_ATTRIBUTES,
  } = options;

  const sanitizeAndValidate = useMemo(
    () =>
      (text: string): SanitizedTextResult => {
        const sanitized = sanitizeHtml(text, {
          allowedTags,
          allowedAttributes,
          allowedSchemes: ["http", "https", "ftp", "mailto"],
        })
          .replace(/\r\n?/g, "\n")
          .replace(/[ \t]{2,}/g, " ")
          .replace(/\n{3,}/g, "\n\n")
          .trim();

        const characterCount = sanitized.length;

        if (characterCount < minLength) {
          return {
            sanitized,
            isValid: false,
            error: `Text must have at least ${minLength} characters (after cleaning)`,
            characterCount,
          };
        }

        if (characterCount > maxLength) {
          return {
            sanitized,
            isValid: false,
            error: `Text can have maximum ${maxLength} characters (after cleaning)`,
            characterCount,
          };
        }

        return {
          sanitized,
          isValid: true,
          characterCount,
        };
      },
    [minLength, maxLength, allowedTags, allowedAttributes]
  );

  const isValidLength = useMemo(
    () =>
      (text: string): boolean => {
        return sanitizeAndValidate(text).isValid;
      },
    [sanitizeAndValidate]
  );

  return {
    sanitizeAndValidate,
    isValidLength,
  };
}
