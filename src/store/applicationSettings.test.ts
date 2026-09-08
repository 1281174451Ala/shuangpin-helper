import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  saveApplicationSettings,
  subscribeApplicationSettings,
  type ApplicationSettings,
  useApplicationSettings,
} from "./applicationSettings";

/** Tauri 命令 mock 的共享状态。 */
const mocks = vi.hoisted(() => ({
  /** 记录命令及参数。 */
  invoke: vi.fn(),
  /** 记录事件订阅。 */
  listen: vi.fn(),
  /** 按事件名保存订阅回调。 */
  handlers: {} as Record<string, (event: { payload: ApplicationSettings }) => void>,
}));

vi.mock("@tauri-apps/api/core", () => ({
  invoke: mocks.invoke,
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: mocks.listen,
}));

beforeEach(() => {
  mocks.invoke.mockReset();
  mocks.listen.mockReset();
  mocks.handlers = {};
});

describe("applicationSettings bridge", () => {
  it("persists a complete application settings update", async () => {
    const settings: ApplicationSettings = {
      version: 1,
      schemeId: "xiaohe",
      appearance: "system",
      idleFadeDelayMs: 3000,
      idleOpacity: 0.3,
    };
    mocks.invoke.mockResolvedValue(settings);

    await expect(saveApplicationSettings(settings)).resolves.toEqual(settings);
    expect(mocks.invoke).toHaveBeenCalledWith("save_application_settings", { settings });
  });

  it("receives application settings changes from another window", async () => {
    const settings: ApplicationSettings = {
      version: 1,
      schemeId: "xiaohe",
      appearance: "dark",
      idleFadeDelayMs: null,
      idleOpacity: 0.5,
    };
    const onSettingsChanged = vi.fn();
    mocks.listen.mockImplementation((_name, handler) => {
      handler({ payload: settings });
      return Promise.resolve(() => {});
    });

    await subscribeApplicationSettings(onSettingsChanged);

    expect(mocks.listen).toHaveBeenCalledWith("application-settings-changed", expect.any(Function));
    expect(onSettingsChanged).toHaveBeenCalledWith(settings);
  });

  it("keeps a mounted consumer synchronized with settings changes", async () => {
    const initialSettings: ApplicationSettings = {
      version: 1,
      schemeId: "xiaohe",
      appearance: "system",
      idleFadeDelayMs: 3000,
      idleOpacity: 0.3,
    };
    const changedSettings = { ...initialSettings, appearance: "dark" };
    mocks.invoke.mockImplementation((command) => Promise.resolve(
      command === "get_application_settings_recovery_status" ? false : initialSettings,
    ));
    mocks.listen.mockImplementation((name, handler) => {
      mocks.handlers[name] = handler;
      return Promise.resolve(() => {});
    });

    const { result } = renderHook(() => useApplicationSettings());
    await waitFor(() => expect(result.current.settings).toEqual(initialSettings));
    await waitFor(() => expect(mocks.handlers["application-settings-changed"]).toBeDefined());

    act(() => {
      mocks.handlers["application-settings-changed"]({ payload: changedSettings });
    });

    expect(result.current.settings).toEqual(changedSettings);
  });

  it("still reads settings when the change subscription is unavailable", async () => {
    const settings: ApplicationSettings = {
      version: 1,
      schemeId: "xiaohe",
      appearance: "system",
      idleFadeDelayMs: 3000,
      idleOpacity: 0.3,
    };
    mocks.listen.mockRejectedValue(new Error("events unavailable"));
    mocks.invoke.mockImplementation((command) => Promise.resolve(
      command === "get_application_settings_recovery_status" ? false : settings,
    ));
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    const { result } = renderHook(() => useApplicationSettings());

    await waitFor(() => expect(result.current.settings).toEqual(settings));
    warn.mockRestore();
  });
});
