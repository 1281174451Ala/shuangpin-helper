import { renderHook, act } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useIdleFade } from "./useIdleFade";

describe("useIdleFade", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("is idle=false on mount and becomes true after delay with no activity", () => {
    const { result } = renderHook(() => useIdleFade({ delay: 3000 }));

    expect(result.current.isIdle).toBe(false);

    act(() => {
      vi.advanceTimersByTime(3000);
    });

    expect(result.current.isIdle).toBe(true);
  });

  it("uses default delay of 3000ms when no option is given", () => {
    const { result } = renderHook(() => useIdleFade());

    expect(result.current.isIdle).toBe(false);

    act(() => {
      vi.advanceTimersByTime(2999);
    });
    expect(result.current.isIdle).toBe(false);

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(result.current.isIdle).toBe(true);
  });

  it("reportActivity resets the idle timer", () => {
    const { result } = renderHook(() => useIdleFade({ delay: 3000 }));

    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(result.current.isIdle).toBe(false);

    act(() => {
      result.current.reportActivity();
    });
    expect(result.current.isIdle).toBe(false);

    // 距上次活动 2000ms，尚未到 delay
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(result.current.isIdle).toBe(false);

    // 再过 1000ms（累计 3000ms），进入空闲
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(result.current.isIdle).toBe(true);
  });

  it("reportActivity immediately exits idle", () => {
    const { result } = renderHook(() => useIdleFade({ delay: 3000 }));

    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(result.current.isIdle).toBe(true);

    act(() => {
      result.current.reportActivity();
    });
    expect(result.current.isIdle).toBe(false);
  });

  it("rapid reportActivity keeps isIdle false", () => {
    const { result } = renderHook(() => useIdleFade({ delay: 3000 }));

    for (let i = 0; i < 5; i++) {
      act(() => {
        result.current.reportActivity();
        vi.advanceTimersByTime(1000);
      });
    }
    expect(result.current.isIdle).toBe(false);

    // 停止活动后过 delay，进入空闲
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(result.current.isIdle).toBe(true);
  });

  it("cleans up timer on unmount without throwing", () => {
    const { result, unmount } = renderHook(() => useIdleFade({ delay: 3000 }));

    act(() => {
      result.current.reportActivity();
    });

    expect(() => unmount()).not.toThrow();
  });

  it("does not enter idle when delay is null", () => {
    const { result } = renderHook(() => useIdleFade({ delay: null }));

    act(() => {
      vi.advanceTimersByTime(10_000);
    });

    expect(result.current.isIdle).toBe(false);
  });

  it("cancels the timer and exits idle when delay changes to null", () => {
    const { result, rerender } = renderHook(
      ({ delay }: { delay: number | null }) => useIdleFade({ delay }),
      { initialProps: { delay: 3000 as number | null } },
    );

    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(result.current.isIdle).toBe(true);

    rerender({ delay: null });
    act(() => {
      vi.advanceTimersByTime(10_000);
    });

    expect(result.current.isIdle).toBe(false);
  });

  it("cancels a pending timer when delay changes to null", () => {
    const { result, rerender } = renderHook(
      ({ delay }: { delay: number | null }) => useIdleFade({ delay }),
      { initialProps: { delay: 3000 as number | null } },
    );

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    rerender({ delay: null });

    act(() => {
      vi.advanceTimersByTime(10_000);
    });

    expect(result.current.isIdle).toBe(false);
  });

  it("starts a timer when delay changes from null to a number", () => {
    const { result, rerender } = renderHook(
      ({ delay }: { delay: number | null }) => useIdleFade({ delay }),
      { initialProps: { delay: null as number | null } },
    );

    act(() => {
      vi.advanceTimersByTime(10_000);
    });
    expect(result.current.isIdle).toBe(false);

    rerender({ delay: 2000 });
    act(() => {
      vi.advanceTimersByTime(1999);
    });
    expect(result.current.isIdle).toBe(false);

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(result.current.isIdle).toBe(true);
  });

  it("restarts the timer when an enabled delay changes", () => {
    const { result, rerender } = renderHook(
      ({ delay }: { delay: number | null }) => useIdleFade({ delay }),
      { initialProps: { delay: 3000 as number | null } },
    );

    act(() => {
      vi.advanceTimersByTime(2000);
    });
    rerender({ delay: 5000 });

    act(() => {
      vi.advanceTimersByTime(2999);
    });
    expect(result.current.isIdle).toBe(false);

    act(() => {
      vi.advanceTimersByTime(2001);
    });
    expect(result.current.isIdle).toBe(true);
  });

  it("exits idle while an updated enabled delay starts counting", () => {
    const { result, rerender } = renderHook(
      ({ delay }: { delay: number | null }) => useIdleFade({ delay }),
      { initialProps: { delay: 1000 as number | null } },
    );
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(result.current.isIdle).toBe(true);

    rerender({ delay: 5000 });

    expect(result.current.isIdle).toBe(false);
  });

  it("reportActivity exits idle without scheduling when delay is null", () => {
    const { result } = renderHook(() => useIdleFade({ delay: null }));

    act(() => {
      result.current.reportActivity();
    });
    act(() => {
      vi.advanceTimersByTime(10_000);
    });

    expect(result.current.isIdle).toBe(false);
  });
});
