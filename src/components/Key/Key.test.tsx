import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Key } from "./Key";

describe("Key", () => {
  it("makes finals the strongest visual cue on a candidate key", () => {
    render(<Key displayState="candidate" finals={["ai"]} label="e" />);

    expect(screen.getByRole("button", { name: /e/i })).toHaveClass(
      "border-[var(--candidate-border)]",
      "bg-[var(--candidate-bg)]",
    );
    expect(screen.getByText("ai")).toHaveClass(
      "text-[var(--candidate-text)]",
      "font-bold",
      "text-[0.2em]",
    );
  });
});
