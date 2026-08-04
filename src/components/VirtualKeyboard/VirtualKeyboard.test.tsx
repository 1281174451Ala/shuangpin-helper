import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { InputState } from "../../engine/stateMachine";
import { VirtualKeyboard } from "./VirtualKeyboard";

describe("VirtualKeyboard", () => {
  it("highlights candidates and disables unavailable keys while waiting for the second key", () => {
    const inputState: InputState = {
      phase: "waitingSecondKey",
      candidateKeys: new Set(["e", "h"]),
    };
    render(<VirtualKeyboard inputState={inputState} />);

    expect(screen.getByRole("button", { name: /^H/i })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: /^B/i })).toBeDisabled();
  });
});
