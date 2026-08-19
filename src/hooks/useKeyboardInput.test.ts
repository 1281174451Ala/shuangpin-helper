import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useKeyboardInput } from "./useKeyboardInput";

/** Tauri 事件 mock 的共享状态。 */
const mocks = vi.hoisted(() => ({
  /** 按事件名捕获的监听回调。 */
  handlers: {} as Record<string, (event: { payload: unknown }) => void>,
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: (name: string, handler: (event: { payload: unknown }) => void) => {
    mocks.handlers[name] = handler;
    return Promise.resolve(() => {});
  },
}));

beforeEach(() => {
  mocks.handlers = {};
});

describe("useKeyboardInput", () => {
  it("advances the input state and reports activity for a Rust key event", async () => {
    const reportActivity = vi.fn();
    const { result } = renderHook(() => useKeyboardInput({ isListening: true, reportActivity }));

    await waitFor(() => expect(mocks.handlers["key-event"]).toBeDefined());
    await act(async () => {
      mocks.handlers["key-event"]({ payload: { type: "letter", key: "d" } });
    });

    expect(result.current.inputState.phase).toBe("waitingSecondKey");
    expect(reportActivity).toHaveBeenCalledOnce();
  });

  it("only accepts browser keydown events while the global listener is stopped", () => {
    const reportActivity = vi.fn();
    const { result, rerender } = renderHook(
      ({ isListening }) => useKeyboardInput({ isListening, reportActivity }),
      { initialProps: { isListening: true } },
    );

    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "d" }));
    });
    expect(result.current.inputState.phase).toBe("idle");

    rerender({ isListening: false });
    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "d" }));
    });

    expect(result.current.inputState.phase).toBe("waitingSecondKey");
    expect(reportActivity).toHaveBeenCalledOnce();
  });

  it("ignores browser keys with modifiers while the fallback is active", () => {
    const { result } = renderHook(() => useKeyboardInput({ isListening: false, reportActivity: vi.fn() }));

    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "d", metaKey: true }));
    });

    expect(result.current.inputState.phase).toBe("idle");
  });

  it("resets input after the native window-hidden event", async () => {
    const { result } = renderHook(() => useKeyboardInput({ isListening: true, reportActivity: vi.fn() }));

    await waitFor(() => expect(mocks.handlers["key-event"]).toBeDefined());
    await act(async () => {
      mocks.handlers["key-event"]({ payload: { type: "letter", key: "d" } });
    });
    expect(result.current.inputState.phase).toBe("waitingSecondKey");

    await waitFor(() => expect(mocks.handlers["window-hidden"]).toBeDefined());
    await act(async () => {
      mocks.handlers["window-hidden"]({ payload: undefined });
    });

    expect(result.current.inputState.phase).toBe("idle");
  });
});
