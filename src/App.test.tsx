import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";

/** Tauri mock 的共享状态（vi.hoisted 保证在 vi.mock 工厂之前初始化）。 */
const mocks = vi.hoisted(() => ({
  /** get_listener_status 的返回值，模拟后端监听是否已启动。 */
  listenerStatus: false,
  /** 按事件名捕获的 listen 回调，用于模拟 Rust 主动推送。 */
  handlers: {} as Record<string, (event: { payload: unknown }) => void>,
  invokedCommands: [] as string[],
  focusHandler: undefined as ((event: { payload: boolean }) => void) | undefined,
}));

vi.mock("@tauri-apps/api/core", () => ({
  invoke: (cmd: string) => {
    mocks.invokedCommands.push(cmd);
    if (cmd === "get_accessibility_permission") return Promise.resolve(true);
    if (cmd === "get_listener_status") return Promise.resolve(mocks.listenerStatus);
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
    setFocus: () => Promise.resolve(),
    startDragging: () => Promise.resolve(),
    onFocusChanged: (handler: (event: { payload: boolean }) => void) => {
      mocks.focusHandler = handler;
      return Promise.resolve(() => {});
    },
  }),
}));

beforeEach(() => {
  mocks.listenerStatus = false;
  mocks.invokedCommands.length = 0;
  mocks.focusHandler = undefined;
});

/** 渲染应用并等待异步初始化完成，避免断言结束后仍有状态更新。 */
const renderApp = async () => {
  render(<App />);
  await waitFor(() => expect(mocks.invokedCommands).toContain("get_listener_status"));
};

describe("App", () => {
  it("hides instead of exiting when the virtual EXIT key is clicked", async () => {
    await renderApp();

    fireEvent.click(screen.getByRole("button", { name: /^EXIT/i }));

    await waitFor(() => expect(mocks.invokedCommands).toContain("hide_window"));
    expect(mocks.invokedCommands).not.toContain("exit_app");
  });

  it("starts the global listener when the window regains focus after permission is granted", async () => {
    await renderApp();

    await waitFor(() => expect(mocks.focusHandler).toBeDefined());
    mocks.invokedCommands.length = 0;
    await act(async () => {
      mocks.focusHandler?.({ payload: true });
    });

    expect(mocks.invokedCommands).toContain("start_key_listener");
  });

  it("resets candidate keys after the native window-hidden event", async () => {
    await renderApp();

    fireEvent.keyDown(window, { key: "d" });
    expect(screen.getByRole("button", { name: /^H/i })).toHaveAttribute("aria-pressed", "true");

    await waitFor(() => expect(mocks.handlers["window-hidden"]).toBeDefined());
    await act(async () => {
      mocks.handlers["window-hidden"]({ payload: undefined });
    });

    expect(screen.getByRole("button", { name: /^H/i })).toHaveAttribute("aria-pressed", "false");
  });

  it("renders the shuangpin learning keyboard", async () => {
    await renderApp();

    // 检查虚拟键盘是否存在
    expect(screen.getByRole("region", { name: "双拼虚拟键盘" })).toBeInTheDocument();
  });

  it("renders candidate keys after a first letter and resets after the second letter", async () => {
    await renderApp();

    fireEvent.keyDown(window, { key: "d" });
    expect(screen.getByRole("button", { name: /^H/i })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: /^B/i })).toBeDisabled();

    fireEvent.keyDown(window, { key: "q" });
    expect(screen.getByRole("button", { name: /^H/i })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("button", { name: /^B/i })).toBeEnabled();
  });

  it("ignores uppercase letters and letters typed with modifiers", async () => {
    await renderApp();

    fireEvent.keyDown(window, { key: "D", shiftKey: true });
    fireEvent.keyDown(window, { key: "d", metaKey: true });

    expect(screen.getByRole("button", { name: /^H/i })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("button", { name: /^B/i })).toBeEnabled();
  });

  it("clears candidates for space and Enter", async () => {
    await renderApp();

    fireEvent.keyDown(window, { key: "d" });
    expect(screen.getByRole("button", { name: /^H/i })).toHaveAttribute("aria-pressed", "true");

    fireEvent.keyDown(window, { key: " " });
    expect(screen.getByRole("button", { name: /^H/i })).toHaveAttribute("aria-pressed", "false");

    fireEvent.keyDown(window, { key: "d" });
    fireEvent.keyDown(window, { key: "Enter" });
    expect(screen.getByRole("button", { name: /^H/i })).toHaveAttribute("aria-pressed", "false");
  });

  it("ignores in-window keys when the backend global listener is already running (BUG-001 regression)", async () => {
    mocks.listenerStatus = true;
    await renderApp();

    // 等待初始化同步完成，isListening 应已置为 true
    await waitFor(() => {
      expect(mocks.handlers["key-event"]).toBeDefined();
      expect(mocks.handlers["listener-status"]).toBeDefined();
    });
    await act(async () => {});

    // 全局监听运行中：窗口内按键不得触发候选高亮（否则会与 Rust 事件重复触发）
    fireEvent.keyDown(window, { key: "d" });
    expect(screen.getByRole("button", { name: /^H/i })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("button", { name: /^B/i })).toBeEnabled();
  });

  it("falls back to in-window keys after the backend listener stops", async () => {
    mocks.listenerStatus = true;
    await renderApp();

    await waitFor(() => {
      expect(mocks.handlers["listener-status"]).toBeDefined();
    });
    await act(async () => {});

    // 后端监听线程退出并推送 listener-status=false，前端应回退到窗口内监听
    await act(async () => {
      mocks.handlers["listener-status"]({ payload: false });
    });

    fireEvent.keyDown(window, { key: "d" });
    expect(screen.getByRole("button", { name: /^H/i })).toHaveAttribute("aria-pressed", "true");
  });
});
