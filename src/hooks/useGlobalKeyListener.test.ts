import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useGlobalKeyListener } from "./useGlobalKeyListener";

/** Tauri mock 的共享状态。 */
const mocks = vi.hoisted(() => ({
  /** 后端当前监听状态。 */
  listenerStatus: false,
  /** 辅助功能权限状态。 */
  hasPermission: true,
  /** 已调用的命令。 */
  invokedCommands: [] as string[],
  /** 按事件名捕获的监听回调。 */
  handlers: {} as Record<string, (event: { payload: unknown }) => void>,
  /** 窗口焦点变化回调。 */
  focusHandler: undefined as ((event: { payload: boolean }) => void) | undefined,
}));

vi.mock("@tauri-apps/api/core", () => ({
  invoke: (command: string) => {
    mocks.invokedCommands.push(command);
    if (command === "get_accessibility_permission") {
      return Promise.resolve(mocks.hasPermission);
    }
    if (command === "get_listener_status") {
      return Promise.resolve(mocks.listenerStatus);
    }
    return Promise.resolve(true);
  },
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: (name: string, handler: (event: { payload: unknown }) => void) => {
    mocks.handlers[name] = handler;
    return Promise.resolve(() => {});
  },
}));

vi.mock("@tauri-apps/api/window", () => ({
  getCurrentWindow: () => ({
    onFocusChanged: (handler: (event: { payload: boolean }) => void) => {
      mocks.focusHandler = handler;
      return Promise.resolve(() => {});
    },
  }),
}));

beforeEach(() => {
  mocks.listenerStatus = false;
  mocks.hasPermission = true;
  mocks.invokedCommands.length = 0;
  mocks.handlers = {};
  mocks.focusHandler = undefined;
});

describe("useGlobalKeyListener", () => {
  it("synchronizes the backend listener status on mount", async () => {
    mocks.listenerStatus = true;
    const { result } = renderHook(() => useGlobalKeyListener());

    await waitFor(() => expect(result.current.isListening).toBe(true));

    expect(result.current.hasPermission).toBe(true);
    expect(mocks.invokedCommands).toContain("get_listener_status");
  });

  it("starts listening again when the window regains focus and permission is granted", async () => {
    renderHook(() => useGlobalKeyListener());

    await waitFor(() => expect(mocks.focusHandler).toBeDefined());
    mocks.invokedCommands.length = 0;
    await act(async () => {
      mocks.focusHandler?.({ payload: true });
    });

    expect(mocks.invokedCommands).toContain("start_key_listener");
  });

  it("marks the listener as stopped after the native window-hidden event", async () => {
    mocks.listenerStatus = true;
    const { result } = renderHook(() => useGlobalKeyListener());

    await waitFor(() => expect(mocks.handlers["window-hidden"]).toBeDefined());
    await waitFor(() => expect(result.current.isListening).toBe(true));
    await act(async () => {
      mocks.handlers["window-hidden"]({ payload: undefined });
    });

    expect(result.current.isListening).toBe(false);
  });
});
