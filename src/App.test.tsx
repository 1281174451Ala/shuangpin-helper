import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";

/** Tauri mock 的共享状态（vi.hoisted 保证在 vi.mock 工厂之前初始化）。 */
const mocks = vi.hoisted(() => ({
  /** get_listener_status 的返回值，模拟后端监听是否已启动。 */
  listenerStatus: false,
  /** 按事件名捕获的 listen 回调，用于模拟 Rust 主动推送。 */
  handlers: {} as Record<string, (event: { payload: unknown }) => void>,
  invokedCommands: [] as string[],
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
      return Promise.resolve(() => {});
    },
  }),
}));

beforeEach(() => {
  mocks.listenerStatus = false;
  mocks.invokedCommands.length = 0;
});

afterEach(() => {
  vi.useRealTimers();
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

  it("restores full opacity when dragging an idle window", async () => {
    vi.useFakeTimers();
    render(<App />);
    await act(async () => {});

    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(document.querySelector("main")).toHaveStyle({ opacity: "0.3" });

    await act(async () => {
      fireEvent.mouseDown(document.querySelector("main")!);
    });

    expect(document.querySelector("main")).toHaveStyle({ opacity: "1" });
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

});
