import { describe, expect, it } from "vitest";
import { createStateMachine, type InputState } from "./stateMachine";

describe("createStateMachine", () => {
  it("enters waitingSecondKey for a valid first key", () => {
    const transition = createStateMachine(
      new Map([["d", new Set(["e", "h"])]]),
    );
    const initialState: InputState = { phase: "idle" };

    expect(transition(initialState, { type: "letter", key: "d" })).toEqual({
      phase: "waitingSecondKey",
      candidateKeys: new Set(["e", "h"]),
    });
  });

  it("returns to idle when Backspace cancels a pending first key", () => {
    const transition = createStateMachine(new Map());
    const pendingState: InputState = {
      phase: "waitingSecondKey",
      candidateKeys: new Set(["e", "h"]),
    };

    expect(transition(pendingState, { type: "backspace" })).toEqual({ phase: "idle" });
  });

  it("returns to idle after any second letter", () => {
    const transition = createStateMachine(new Map());
    const pendingState: InputState = {
      phase: "waitingSecondKey",
      candidateKeys: new Set(["e", "h"]),
    };

    expect(transition(pendingState, { type: "letter", key: "q" })).toEqual({ phase: "idle" });
  });

  it.each(["escape", "enter", "reset"] as const)(
    "returns to idle when %s clears a pending first key",
    (type) => {
      const transition = createStateMachine(new Map());
      const pendingState: InputState = {
        phase: "waitingSecondKey",
        candidateKeys: new Set(["e", "h"]),
      };

      expect(transition(pendingState, { type })).toEqual({ phase: "idle" });
    },
  );

  it("keeps a pending first key when space is pressed", () => {
    const transition = createStateMachine(new Map());
    const pendingState: InputState = {
      phase: "waitingSecondKey",
      candidateKeys: new Set(["e", "h"]),
    };

    expect(transition(pendingState, { type: "space" })).toBe(pendingState);
  });

  it.each(["backspace", "escape", "enter", "reset"] as const)(
    "keeps idle unchanged when %s is pressed",
    (type) => {
      const transition = createStateMachine(new Map());
      const idleState: InputState = { phase: "idle" };

      expect(transition(idleState, { type })).toBe(idleState);
    },
  );

  it("keeps idle unchanged for a letter without candidates", () => {
    const transition = createStateMachine(new Map());
    const idleState: InputState = { phase: "idle" };

    expect(transition(idleState, { type: "letter", key: "x" })).toBe(idleState);
  });

  it("processes repeated letters as consecutive double-pinyin pairs", () => {
    const transition = createStateMachine(new Map([["d", new Set(["e", "h"])]]));
    const idleState: InputState = { phase: "idle" };
    const waitingState = transition(idleState, { type: "letter", key: "d" });
    const resetState = transition(waitingState, { type: "letter", key: "d" });

    expect(resetState).toEqual({ phase: "idle" });
    expect(transition(resetState, { type: "letter", key: "d" })).toEqual({
      phase: "waitingSecondKey",
      candidateKeys: new Set(["e", "h"]),
    });
  });
});
