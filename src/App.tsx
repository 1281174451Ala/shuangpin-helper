import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { VirtualKeyboard } from "./components/VirtualKeyboard/VirtualKeyboard";
import { xiaoheCandidateIndex } from "./engine/shuangpin";
import {
  createStateMachine,
  type InputEvent,
  type InputState,
} from "./engine/stateMachine";
import { useIdleFade } from "./hooks/useIdleFade";

/**
 * 将应用内键盘事件转换为双拼状态机事件。
 * @param event 浏览器键盘事件
 * @returns 已归一化的输入事件；不支持的事件返回 null
 */
const normalizeKeyboardEvent = (event: KeyboardEvent): InputEvent | null => {
  if (event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) {
    return null;
  }

  if (/^[a-z]$/.test(event.key)) {
    return { type: "letter", key: event.key };
  }

  if (event.key === "Backspace") {
    return { type: "backspace" };
  }

  if (event.key === "Escape") {
    return { type: "escape" };
  }

  if (event.key === " ") {
    return { type: "space" };
  }

  if (event.key === "Enter") {
    return { type: "enter" };
  }

  return null;
};

/** Rust 后端发来的全局按键事件协议。 */
type RustKeyEvent =
  | { type: "letter"; key: string }
  | { type: "backspace" }
  | { type: "escape" }
  | { type: "space" }
  | { type: "enter" };

/**
 * 将 Rust 全局按键事件转换为前端状态机事件。
 * @param event Rust 后端事件
 * @returns 状态机事件；不支持的事件返回 null
 */
const rustEventToInputEvent = (event: RustKeyEvent): InputEvent | null => {
  switch (event.type) {
    case "letter":
      return { type: "letter", key: event.key };
    case "backspace":
      return { type: "backspace" };
    case "escape":
      return { type: "escape" };
    case "space":
      return { type: "space" };
    case "enter":
      return { type: "enter" };
    default:
      return null;
  }
};

const transition = createStateMachine(xiaoheCandidateIndex);

/** 空闲多久后自动淡化（毫秒）。后续设置页可自定义。 */
const IDLE_DELAY_MS = 3000;
/** 空闲时的透明度。后续设置页可自定义。 */
const IDLE_OPACITY = 0.3;

/**
 * 渲染双拼学习悬浮窗口的最小界面。
 * @returns 应用根元素
 */
export const App = () => {
  const [inputState, setInputState] = useState<InputState>({ phase: "idle" });
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [isListening, setIsListening] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  // 用户是否已手动切换过监听状态：初始化同步到的过期结果不得覆盖用户操作
  const userToggledListeningRef = useRef(false);
  const { isIdle, reportActivity } = useIdleFade({ delay: IDLE_DELAY_MS });

  // 根据卡片实际内容区（已扣除 padding）动态计算按键大小，使键盘始终与窗口等比匹配
  useEffect(() => {
    const el = cardRef.current;
    if (!el) return;

    const computeKeySize = () => {
      const style = getComputedStyle(el);
      const padX = parseFloat(style.paddingLeft) + parseFloat(style.paddingRight);
      const padY = parseFloat(style.paddingTop) + parseFloat(style.paddingBottom);
      const keySize = Math.min(
        (el.clientWidth - padX - 54) / 10, // 10 列按键 + 9×6px 水平间隙
        (el.clientHeight - padY - 16) / 3, // 3 行按键 + 2×8px 垂直间隙
      );
      el.style.setProperty("--key-size", `${Math.floor(keySize)}px`);
    };

    computeKeySize();
    const observer = new ResizeObserver(computeKeySize);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // 初始化：订阅 Rust 事件、查询权限、同步后端监听状态（不自动启动监听，避免一打开 App 就注册系统钩子）
  useEffect(() => {
    let disposed = false;
    const unlisteners: Array<() => void> = [];

    const setup = async () => {
      // 1. 订阅按键事件最先建立且独立容错：即使后续状态查询失败，Rust 按键也不会丢失
      try {
        const unlistenKeys = await listen<RustKeyEvent>("key-event", (event) => {
          reportActivity();
          if (import.meta.env.DEV) {
            console.log("[来源:Rust 全局监听] key-event:", JSON.stringify(event.payload));
          }
          const inputEvent = rustEventToInputEvent(event.payload);
          if (inputEvent) {
            setInputState((currentState) => transition(currentState, inputEvent));
          }
        });

        // StrictMode 下 effect 会执行两次：若第一次的订阅在卸载后才建立，立即取消，避免重复订阅
        if (disposed) {
          unlistenKeys();
        } else {
          unlisteners.push(unlistenKeys);
        }
      } catch (error) {
        console.warn("订阅 Rust key-event 失败", error);
      }
      if (disposed) return;

      // 2. 订阅监听状态推送：后端监听线程异常退出时回退到窗口内监听，保持双向状态一致
      try {
        const unlistenStatus = await listen<boolean>("listener-status", (event) => {
          setIsListening(Boolean(event.payload));
        });
        if (disposed) {
          unlistenStatus();
        } else {
          unlisteners.push(unlistenStatus);
        }
      } catch (error) {
        console.warn("订阅 Rust listener-status 失败", error);
      }
      if (disposed) return;

      // 3. 查询权限（失败不影响事件订阅）
      try {
        const permission = await invoke<boolean>("get_accessibility_permission");
        setHasPermission(permission);

        if (!permission) {
          // 尝试弹出系统提示；对从终端启动的 dev 二进制通常不会弹窗
          await invoke("request_accessibility_permission");
          const granted = await invoke<boolean>("get_accessibility_permission");
          setHasPermission(granted);
        }
      } catch (error) {
        console.warn("查询辅助功能权限失败", error);
      }
      if (disposed) return;

      // 4. 同步后端实际监听状态：Rust 在 setup 中可能已自动启动全局监听，
      // 前端需据此设置 isListening，否则 window keydown fallback 会与
      // 全局监听重复触发，导致候选键高亮一闪即逝（BUG-001）。
      // 若用户已手动切换过监听，则丢弃该结果，避免过期的 false 覆盖用户操作（竞态）。
      try {
        const listening = await invoke<boolean>("get_listener_status");
        if (!disposed && !userToggledListeningRef.current) {
          setIsListening(listening);
        }
      } catch (error) {
        console.warn("同步后端监听状态失败", error);
      }
    };

    setup();

    return () => {
      disposed = true;
      unlisteners.forEach((unlisten) => unlisten());
    };
  }, []);

  // 监听应用内键盘输入，仅作为全局监听未启动时的 fallback
  // （全局监听启动后若仍监听 window keydown 会导致同一按键触发两次事件）
  useEffect(() => {
    if (isListening) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      reportActivity();
      const inputEvent = normalizeKeyboardEvent(event);
      if (import.meta.env.DEV) {
        console.log("[来源:浏览器 keydown]", event.key, inputEvent);
      }
      if (!inputEvent) {
        return;
      }

      setInputState((currentState) => transition(currentState, inputEvent));
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isListening]);

  const handleOpenSettings = () => {
    invoke("open_accessibility_settings");
  };

  const handleRefreshPermission = async () => {
    const granted = await invoke<boolean>("get_accessibility_permission");
    setHasPermission(granted);
  };

  const handleStartListening = async () => {
    try {
      // 标记用户已手动切换：初始化同步若尚未完成，不得用过期结果覆盖此次操作
      userToggledListeningRef.current = true;
      const started = await invoke<boolean>("start_key_listener");
      setIsListening(started);
    } catch (error) {
      console.error("启动全局监听失败", error);
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    // 点击到按钮、输入框等交互元素时不触发拖拽
    if (target.closest("input, select, textarea")) return;
    const win = getCurrentWindow();
    win.setFocus();
    win.startDragging();
  };

  return (
    <main
      onMouseDown={handleMouseDown}
      className="flex flex-col items-center justify-center w-screen h-screen p-2 select-none"
      style={{
        filter: "drop-shadow(0 2px 6px rgba(0,0,0,0.4))",
        opacity: isIdle ? IDLE_OPACITY : 1,
        transition: `opacity ${isIdle ? "0.8s" : "0.15s"} ease`,
      }}
    >
      <div
        ref={cardRef}
        className="w-full h-full p-2 border border-white/[0.18] rounded-2xl bg-[rgb(20,28,43,0.92)] flex flex-col items-center justify-center"
      >
        {/* 权限调试面板（临时注释以测试布局，排查滚动条问题） */}
        {/*
        {hasPermission === false && (
          <div className="mb-4 px-3 py-2 rounded-lg bg-yellow-500/20 text-yellow-200 text-xs">
            <p className="mb-2">需要 macOS 辅助功能权限才能监听全局键盘。</p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleOpenSettings}
                className="px-2 py-1 rounded bg-yellow-500/30 hover:bg-yellow-500/50 transition-colors"
              >
                打开系统设置
              </button>
              <button
                type="button"
                onClick={handleRefreshPermission}
                className="px-2 py-1 rounded bg-white/10 hover:bg-white/20 transition-colors"
              >
                已授权，刷新
              </button>
            </div>
          </div>
        )}
        {hasPermission === true && !isListening && (
          <div className="mb-4 px-3 py-2 rounded-lg bg-blue-500/20 text-blue-200 text-xs">
            <p className="mb-2">已获取权限。全局监听需要手动启动。</p>
            <button
              type="button"
              onClick={handleStartListening}
              className="px-2 py-1 rounded bg-blue-500/30 hover:bg-blue-500/50 transition-colors"
            >
              启动全局监听
            </button>
          </div>
        )}
        {isListening && (
          <div className="mb-4 px-3 py-2 rounded-lg bg-green-500/20 text-green-200 text-xs">
            全局监听运行中
          </div>
        )}
        */}
        <VirtualKeyboard inputState={inputState} />
      </div>
    </main>
  );
};
