import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { AppearanceMode } from "../store/applicationSettings";
import { useResolvedAppearance } from "./useResolvedAppearance";

/** 创建可控制的系统外观媒体查询桩。 */
const createMediaQueryList = (matches: boolean): MediaQueryList & {
  /** 更新系统外观并触发变化监听器。 */
  setMatches: (nextMatches: boolean) => void;
} => {
  let currentMatches = matches;
  const listeners = new Set<(event: MediaQueryListEvent) => void>();
  const mediaQueryList = {
    get matches() {
      return currentMatches;
    },
    media: "(prefers-color-scheme: dark)",
    onchange: null,
    addEventListener: vi.fn((type: string, listener: EventListenerOrEventListenerObject) => {
      if (type === "change") listeners.add(listener as (event: MediaQueryListEvent) => void);
    }),
    removeEventListener: vi.fn((type: string, listener: EventListenerOrEventListenerObject) => {
      if (type === "change") listeners.delete(listener as (event: MediaQueryListEvent) => void);
    }),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(() => true),
    setMatches(nextMatches: boolean) {
      currentMatches = nextMatches;
      const event = { matches: nextMatches, media: "(prefers-color-scheme: dark)" } as MediaQueryListEvent;
      listeners.forEach((listener) => listener(event));
    },
  } as unknown as MediaQueryList & { setMatches: (nextMatches: boolean) => void };

  return mediaQueryList;
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe("useResolvedAppearance", () => {
  it("直接解析浅色和深色模式", () => {
    const initialProps: { appearance: AppearanceMode } = { appearance: "light" };
    const { result, rerender } = renderHook(({ appearance }) => useResolvedAppearance(appearance), {
      initialProps,
    });

    expect(result.current).toBe("light");

    rerender({ appearance: "dark" });
    expect(result.current).toBe("dark");
  });

  it("system 模式按初始系统外观解析", () => {
    const mediaQueryList = createMediaQueryList(true);
    vi.spyOn(window, "matchMedia").mockReturnValue(mediaQueryList);

    const { result } = renderHook(() => useResolvedAppearance("system"));

    expect(result.current).toBe("dark");
    expect(window.matchMedia).toHaveBeenCalledWith("(prefers-color-scheme: dark)");
  });

  it("system 模式跟随系统外观变化", () => {
    const mediaQueryList = createMediaQueryList(false);
    vi.spyOn(window, "matchMedia").mockReturnValue(mediaQueryList);
    const { result } = renderHook(() => useResolvedAppearance("system"));

    act(() => mediaQueryList.setMatches(true));
    expect(result.current).toBe("dark");

    act(() => mediaQueryList.setMatches(false));
    expect(result.current).toBe("light");
  });

  it("卸载时移除系统外观变化监听", () => {
    const mediaQueryList = createMediaQueryList(false);
    vi.spyOn(window, "matchMedia").mockReturnValue(mediaQueryList);
    const { unmount } = renderHook(() => useResolvedAppearance("system"));

    unmount();

    expect(mediaQueryList.removeEventListener).toHaveBeenCalledWith("change", expect.any(Function));
  });
});
