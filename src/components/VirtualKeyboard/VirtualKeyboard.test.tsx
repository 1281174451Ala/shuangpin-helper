import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { VirtualKeyboard } from "./VirtualKeyboard";

describe("VirtualKeyboard", () => {
  it("marks unavailable keys as disabled after the first input", () => {
    render(<VirtualKeyboard enteredKey="d" availableKeys={["h", "e"]} />);

    expect(screen.getByRole("button", { name: /H ang/i })).toBeEnabled();
    expect(screen.getByRole("button", { name: /Q/i })).toBeDisabled();
  });
});
