import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Key } from "./Key";

describe("Key", () => {
  it("makes finals the strongest visual cue on a candidate key", () => {
    render(<Key displayState="candidate" finals={["ai"]} label="e" />);

    expect(screen.getByRole("button", { name: /e/i })).toHaveClass(
      "border-[#35d0bc]",
      "bg-[#123f46]",
      "ring-2",
      "ring-[#5eead4]/70",
    );
    expect(screen.getByText("ai")).toHaveClass(
      "text-[#e6fffb]",
      "font-bold",
      "text-[0.175em]",
    );
  });
});
