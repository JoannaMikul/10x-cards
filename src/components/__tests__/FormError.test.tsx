import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { FormError } from "../common/FormError";

describe("FormError", () => {
  it("renders error messages when provided", () => {
    const errorMessages = ["First error", "Second error"];
    render(<FormError errors={errorMessages} />);

    expect(screen.getByText("First error")).toBeInTheDocument();
    expect(screen.getByText("Second error")).toBeInTheDocument();
  });

  it("does not render when errors array is empty", () => {
    const { container } = render(<FormError errors={[]} />);

    expect(container.firstChild).toBeNull();
  });

  it("does not render when visible is false", () => {
    const errorMessages = ["Error message"];
    const { container } = render(<FormError errors={errorMessages} visible={false} />);

    expect(container.firstChild).toBeNull();
  });

  it("renders custom title when provided", () => {
    const errorMessages = ["Error message"];
    const customTitle = "Custom Error Title";
    render(<FormError errors={errorMessages} title={customTitle} />);

    expect(screen.getByText(customTitle)).toBeInTheDocument();
  });
});
