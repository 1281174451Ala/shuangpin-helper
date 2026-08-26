import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useWindowInteraction } from "./useWindowInteraction";

/** 窗口 API mock 的共享状态。 */
const mocks = vi.hoisted(() => ({
  /** 已调用的 Tauri 命令。 */
  invokedCommands: [] as string[],
  /** 原生窗口操作。 */
  window: {
    setFocus: vi.fn(() => Promise.resolve()),
    startDragging: vi.fn(() => Promise.resolve()),
  },
  /** 原生窗口事件对应的前端处理函数。 */
  windowEventHandlers: {} as Record<string, (event: { payload: unknown }) => void>,
}));

vi.mock("@tauri-apps/api/core", () => ({
  invoke: (command: string) => {
    mocks.invokedCommands.push(command);
    return Promise.resolve();
  },
}));

vi.mock("@tauri-apps/api/window", () => ({
  getCurrentWindow: () => mocks.window,
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: (eventName: string, handler: (event: { payload: unknown }) => void) => {
    mocks.windowEventHandlers[eventName] = handler;
    return Promise.resolve(() => {
      delete mocks.windowEventHandlers[eventName];
    });
  },
}));

beforeEach(() => {
  mocks.invokedCommands.length = 0;
  mocks.window.setFocus.mockClear();
  mocks.window.startDragging.mockClear();
  for (const eventName of Object.keys(mocks.windowEventHandlers)) {
    delete mocks.windowEventHandlers[eventName];
  }
  Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
});

afterEach(() => {
  Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
});

describe("useWindowInteraction", () => {
  it("reports activity before starting a window drag", () => {
    const reportActivity = vi.fn();
    const { result } = renderHook(() => useWindowInteraction({ reportActivity }));

    act(() => {
      result.current.handleMouseDown({ target: document.body } as unknown as React.MouseEvent);
    });

    expect(reportActivity).toHaveBeenCalledOnce();
    expect(mocks.window.setFocus).toHaveBeenCalledOnce();
    expect(mocks.window.startDragging).toHaveBeenCalledOnce();
  });

  it("reports activity while the native window is moving", async () => {
    const reportActivity = vi.fn();
    renderHook(() => useWindowInteraction({ reportActivity }));

    await waitFor(() => expect(mocks.windowEventHandlers["window-moved"]).toBeDefined());
    act(() => {
      mocks.windowEventHandlers["window-moved"]({ payload: undefined });
    });

    expect(reportActivity).toHaveBeenCalledOnce();
  });

  it("does not start dragging from a form control", () => {
    const reportActivity = vi.fn();
    const input = document.createElement("input");
    const { result } = renderHook(() => useWindowInteraction({ reportActivity }));

    act(() => {
      result.current.handleMouseDown({ target: input } as unknown as React.MouseEvent);
    });

    expect(reportActivity).not.toHaveBeenCalled();
    expect(mocks.window.startDragging).not.toHaveBeenCalled();
  });

  it("delegates hiding to Rust when the document becomes hidden", () => {
    renderHook(() => useWindowInteraction({ reportActivity: vi.fn() }));
    Object.defineProperty(document, "visibilityState", { configurable: true, value: "hidden" });

    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });

    expect(mocks.invokedCommands).toContain("hide_window");
  });

  it("reports activity when the document becomes visible again", () => {
    const reportActivity = vi.fn();
    renderHook(() => useWindowInteraction({ reportActivity }));

    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });

    expect(reportActivity).toHaveBeenCalledOnce();
  });
});
