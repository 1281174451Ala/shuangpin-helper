import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";
import type { ApplicationSettings } from "./store/applicationSettings";

/** Tauri mock 的共享状态（vi.hoisted 保证在 vi.mock 工厂之前初始化）。 */
const mocks = vi.hoisted(() => ({
  /** 原生层返回的应用设置。 */
  applicationSettings: {
    version: 1,
    schemeId: "xiaohe",
    appearance: "system",
    idleFadeDelayMs: 3000,
    idleOpacity: 0.3,
  } as ApplicationSettings,
  /** 本次启动是否从无效设置恢复。 */
  recoveredFromInvalidSettings: false,
  /** get_listener_status 的返回值，模拟后端监听是否已启动。 */
  listenerStatus: false,
  /** 按事件名捕获的 listen 回调，用于模拟 Rust 主动推送。 */
  handlers: {} as Record<string, (event: { payload: unknown }) => void>,
  invokedCommands: [] as string[],
  /** 传给保存命令的完整设置。 */
  savedSettings: [] as ApplicationSettings[],
  /** 系统外观媒体查询变化监听器。 */
  appearanceListeners: [] as Array<(event: MediaQueryListEvent) => void>,
}));

vi.mock("@tauri-apps/api/core", () => ({
  invoke: (cmd: string, args?: { settings?: ApplicationSettings }) => {
    mocks.invokedCommands.push(cmd);
    if (cmd === "get_application_settings") return Promise.resolve(mocks.applicationSettings);
    if (cmd === "get_application_settings_recovery_status") {
      return Promise.resolve(mocks.recoveredFromInvalidSettings);
    }
    if (cmd === "save_application_settings" && args?.settings) {
      mocks.savedSettings.push(args.settings);
      mocks.applicationSettings = args.settings;
      return Promise.resolve(args.settings);
    }
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
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: vi.fn().mockReturnValue({
      matches: false,
      media: "(prefers-color-scheme: dark)",
      addEventListener: vi.fn((name: string, listener: (event: MediaQueryListEvent) => void) => {
        if (name === "change") mocks.appearanceListeners.push(listener);
      }),
      removeEventListener: vi.fn(),
    }),
  });
  mocks.applicationSettings = {
    version: 1,
    schemeId: "xiaohe",
    appearance: "system",
    idleFadeDelayMs: 3000,
    idleOpacity: 0.3,
  };
  mocks.listenerStatus = false;
  mocks.recoveredFromInvalidSettings = false;
  mocks.handlers = {};
  mocks.invokedCommands.length = 0;
  mocks.savedSettings.length = 0;
  mocks.appearanceListeners.length = 0;
});

afterEach(() => {
  vi.useRealTimers();
  window.history.replaceState({}, "", "/");
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

  it("uses the configured idle delay and opacity", async () => {
    vi.useFakeTimers();
    mocks.applicationSettings = {
      ...mocks.applicationSettings,
      idleFadeDelayMs: 1000,
      idleOpacity: 0.55,
    };
    render(<App />);
    await act(async () => {});

    act(() => {
      vi.advanceTimersByTime(999);
    });
    expect(document.querySelector("main")).toHaveStyle({ opacity: "1" });

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(document.querySelector("main")).toHaveStyle({ opacity: "0.55" });
  });

  it("never lowers opacity when idle fading is disabled", async () => {
    vi.useFakeTimers();
    mocks.applicationSettings = {
      ...mocks.applicationSettings,
      idleFadeDelayMs: null,
    };
    render(<App />);
    await act(async () => {});

    act(() => {
      vi.advanceTimersByTime(60_000);
    });

    expect(document.querySelector("main")).toHaveStyle({ opacity: "1" });
  });

  it("restores full opacity on keyboard activity", async () => {
    vi.useFakeTimers();
    mocks.applicationSettings = {
      ...mocks.applicationSettings,
      idleFadeDelayMs: 1000,
      idleOpacity: 0.55,
    };
    render(<App />);
    await act(async () => {});

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(document.querySelector("main")).toHaveStyle({ opacity: "0.55" });

    fireEvent.keyDown(window, { key: "d" });

    expect(document.querySelector("main")).toHaveStyle({ opacity: "1" });
  });

  it("applies settings changes broadcast from another window", async () => {
    vi.useFakeTimers();
    render(<App />);
    await act(async () => {});

    act(() => {
      mocks.handlers["application-settings-changed"]({
        payload: {
          ...mocks.applicationSettings,
          appearance: "dark",
          idleFadeDelayMs: 1000,
          idleOpacity: 0.55,
        },
      });
    });
    expect(document.documentElement).toHaveAttribute("data-theme", "dark");

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(document.querySelector("main")).toHaveStyle({ opacity: "0.55" });
  });

  it("keeps following macOS appearance changes in system mode", async () => {
    render(<App />);
    await waitFor(() => expect(mocks.appearanceListeners).toHaveLength(1));
    expect(document.documentElement).toHaveAttribute("data-theme", "light");

    act(() => {
      mocks.appearanceListeners[0]({ matches: true } as MediaQueryListEvent);
    });

    expect(document.documentElement).toHaveAttribute("data-theme", "dark");
  });

  it("renders the shuangpin learning keyboard", async () => {
    await renderApp();

    // 检查虚拟键盘是否存在
    expect(screen.getByRole("region", { name: "双拼虚拟键盘" })).toBeInTheDocument();
  });

  it("reads the current scheme for the floating window", async () => {
    await renderApp();

    await waitFor(() => expect(mocks.invokedCommands).toContain("get_application_settings"));
  });

  it("renders the current scheme in the settings window", async () => {
    window.history.pushState({}, "", "/?window=settings");

    render(<App />);

    await waitFor(() => expect(mocks.invokedCommands).toContain("get_application_settings"));
    expect(document.querySelector("main")).toHaveClass("h-screen", "overflow-y-auto");
    expect(screen.getByText("当前方案")).toBeInTheDocument();
    expect(await screen.findByText("小鹤双拼")).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "双拼虚拟键盘" })).not.toBeInTheDocument();
  });

  it("immediately previews and persists an appearance selection", async () => {
    window.history.pushState({}, "", "/?window=settings");
    render(<App />);

    const appearanceGroup = await screen.findByRole("group", { name: "外观模式" });
    expect(within(appearanceGroup).getAllByRole("radio")).toHaveLength(3);
    expect(
      within(appearanceGroup).getByRole("radio", { name: "跟随系统" }).closest("label"),
    ).toHaveClass("whitespace-nowrap");
    fireEvent.click(await screen.findByRole("radio", { name: "浅色" }));

    await waitFor(() => expect(mocks.savedSettings[mocks.savedSettings.length - 1]).toMatchObject({
      appearance: "light",
    }));
    expect(document.documentElement).toHaveAttribute("data-theme", "light");
    expect(screen.queryByRole("button", { name: /保存|取消/ })).not.toBeInTheDocument();
  });

  it("uses radios and a bounded number input for idle fading", async () => {
    window.history.pushState({}, "", "/?window=settings");
    render(<App />);

    const fadeGroup = await screen.findByRole("group", { name: "空闲淡化" });
    const fadeRadio = within(fadeGroup).getByRole("radio", { name: "淡化" });
    const noFadeRadio = within(fadeGroup).getByRole("radio", { name: "不淡化" });
    const delayInput = within(fadeGroup).getByRole("spinbutton", { name: "淡化延时（秒）" });
    const opacityInput = screen.getByLabelText("空闲透明度");
    expect(fadeRadio).toBeChecked();
    expect(noFadeRadio).not.toBeChecked();
    expect(delayInput).toHaveValue(3);
    expect(delayInput).toHaveAttribute("min", "1");
    expect(delayInput).toHaveAttribute("max", "30");
    expect(delayInput).toHaveAttribute("step", "1");
    expect(screen.queryByRole("combobox", { name: "空闲淡化" })).not.toBeInTheDocument();
    expect(opacityInput).toHaveValue("30");
    expect(opacityInput).toHaveAttribute("min", "20");
    expect(opacityInput).toHaveAttribute("max", "100");
    expect(opacityInput).toHaveAttribute("step", "5");

    fireEvent.change(delayInput, { target: { value: "12" } });
    await waitFor(() => expect(mocks.savedSettings[mocks.savedSettings.length - 1]).toMatchObject({
      idleFadeDelayMs: 12_000,
    }));

    fireEvent.click(noFadeRadio);
    await waitFor(() => expect(mocks.savedSettings[mocks.savedSettings.length - 1]).toMatchObject({
      idleFadeDelayMs: null,
    }));
    expect(delayInput).toBeDisabled();
    expect(delayInput).toHaveValue(12);

    fireEvent.click(fadeRadio);
    await waitFor(() => expect(mocks.savedSettings[mocks.savedSettings.length - 1]).toMatchObject({
      idleFadeDelayMs: 12_000,
    }));
    expect(delayInput).toBeEnabled();

    fireEvent.change(delayInput, { target: { value: "30" } });
    await waitFor(() => expect(mocks.savedSettings[mocks.savedSettings.length - 1]).toMatchObject({
      idleFadeDelayMs: 30_000,
    }));

    const validSaveCount = mocks.savedSettings.length;
    fireEvent.change(delayInput, { target: { value: "31" } });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(mocks.savedSettings).toHaveLength(validSaveCount);

    fireEvent.change(opacityInput, { target: { value: "55" } });
    await waitFor(() => expect(mocks.savedSettings[mocks.savedSettings.length - 1]).toMatchObject({
      idleOpacity: 0.55,
    }));
  });

  it("reports when invalid settings were recovered", async () => {
    mocks.recoveredFromInvalidSettings = true;
    window.history.pushState({}, "", "/?window=settings");

    render(<App />);

    expect(await screen.findByRole("status")).toHaveTextContent(
      "设置文件无效，已恢复默认设置并保留诊断副本",
    );
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
