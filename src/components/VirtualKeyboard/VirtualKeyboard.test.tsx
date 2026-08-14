import { fireEvent, render, screen } from "@testing-library/react";
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

  it("does not bubble mouse down from the exit key to the drag region", () => {
    let dragStartCount = 0;

    render(
      <div onMouseDown={() => { dragStartCount += 1; }}>
        <VirtualKeyboard inputState={{ phase: "idle" }} />
      </div>,
    );

    fireEvent.mouseDown(screen.getByRole("button", { name: /^EXIT/i }));

    expect(dragStartCount).toBe(0);
  });
});
