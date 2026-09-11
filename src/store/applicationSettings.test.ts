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
    const changedSettings: ApplicationSettings = { ...initialSettings, appearance: "dark" };
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

  it("previews a complete settings update before persistence finishes", async () => {
    const initialSettings: ApplicationSettings = {
      version: 1,
      schemeId: "xiaohe",
      appearance: "system",
      idleFadeDelayMs: 3000,
      idleOpacity: 0.3,
    };
    const changedSettings: ApplicationSettings = { ...initialSettings, appearance: "light" };
    mocks.invoke.mockImplementation((command) => {
      if (command === "save_application_settings") return new Promise(() => {});
      return Promise.resolve(
        command === "get_application_settings_recovery_status" ? false : initialSettings,
      );
    });
    mocks.listen.mockResolvedValue(() => {});
    const { result } = renderHook(() => useApplicationSettings());
    await waitFor(() => expect(result.current.settings).toEqual(initialSettings));

    act(() => {
      void result.current.updateSettings(changedSettings);
    });

    expect(result.current.settings).toEqual(changedSettings);
    await waitFor(() => {
      expect(mocks.invoke).toHaveBeenCalledWith("save_application_settings", {
        settings: changedSettings,
      });
    });
  });

  it("keeps the runtime preview and reports a persistence failure", async () => {
    const initialSettings: ApplicationSettings = {
      version: 1,
      schemeId: "xiaohe",
      appearance: "system",
      idleFadeDelayMs: 3000,
      idleOpacity: 0.3,
    };
    const changedSettings: ApplicationSettings = { ...initialSettings, appearance: "dark" };
    mocks.invoke.mockImplementation((command) => {
      if (command === "save_application_settings") {
        return Promise.reject(new Error("disk full"));
      }
      return Promise.resolve(
        command === "get_application_settings_recovery_status" ? false : initialSettings,
      );
    });
    mocks.listen.mockResolvedValue(() => {});
    const { result } = renderHook(() => useApplicationSettings());
    await waitFor(() => expect(result.current.settings).toEqual(initialSettings));

    await act(async () => {
      await expect(result.current.updateSettings(changedSettings)).rejects.toThrow("disk full");
    });

    expect(result.current.settings).toEqual(changedSettings);
    expect(result.current.saveError).toEqual(new Error("disk full"));
  });

  it("serializes rapid settings writes while keeping the latest preview", async () => {
    const initialSettings: ApplicationSettings = {
      version: 1,
      schemeId: "xiaohe",
      appearance: "system",
      idleFadeDelayMs: 3000,
      idleOpacity: 0.3,
    };
    const firstSettings: ApplicationSettings = { ...initialSettings, idleOpacity: 0.35 };
    const latestSettings: ApplicationSettings = { ...initialSettings, idleOpacity: 0.4 };
    let finishFirstSave: (settings: ApplicationSettings) => void = () => {};
    const firstSave = new Promise<ApplicationSettings>((resolve) => {
      finishFirstSave = resolve;
    });
    mocks.invoke.mockImplementation((command, args) => {
      if (command === "get_application_settings_recovery_status") return Promise.resolve(false);
      if (command === "get_application_settings") return Promise.resolve(initialSettings);
      const saveCalls = mocks.invoke.mock.calls.filter(([name]) => {
        return name === "save_application_settings";
      });
      return saveCalls.length === 1 ? firstSave : Promise.resolve(args.settings);
    });
    mocks.listen.mockResolvedValue(() => {});
    const { result } = renderHook(() => useApplicationSettings());
    await waitFor(() => expect(result.current.settings).toEqual(initialSettings));

    let firstResult = Promise.resolve(firstSettings);
    let latestResult = Promise.resolve(latestSettings);
    act(() => {
      firstResult = result.current.updateSettings(firstSettings);
      latestResult = result.current.updateSettings(latestSettings);
    });

    expect(result.current.settings).toEqual(latestSettings);
    await waitFor(() => {
      expect(mocks.invoke.mock.calls.filter(([name]) => name === "save_application_settings"))
        .toHaveLength(1);
    });

    await act(async () => {
      finishFirstSave(firstSettings);
      await firstResult;
    });
    await latestResult;

    expect(mocks.invoke.mock.calls.filter(([name]) => name === "save_application_settings"))
      .toHaveLength(2);
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
