import { useCallback, useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { xiaoheCandidateIndex } from "../engine/shuangpin";
import {
  createStateMachine,
  type InputEvent,
  type InputState,
} from "../engine/stateMachine";

/** Rust 在任何窗口隐藏入口执行清理后发出的通知。 */
const WINDOW_HIDDEN_EVENT = "window-hidden";

/** Rust 后端发来的全局按键事件协议。 */
type RustKeyEvent =
  | { type: "letter"; key: string }
  | { type: "backspace" }
  | { type: "escape" }
  | { type: "space" }
  | { type: "enter" };

/** useKeyboardInput 的入参。 */
interface UseKeyboardInputOptions {
  /** Rust 全局监听是否正在运行。 */
  isListening: boolean;
  /** 用户操作时重置空闲淡化计时。 */
  reportActivity: () => void;
}

/** useKeyboardInput 的返回值。 */
interface UseKeyboardInputResult {
  /** 当前双拼输入状态。 */
  inputState: InputState;
  /** 清空当前双拼输入状态。 */
  resetInput: () => void;
}

const transition = createStateMachine(xiaoheCandidateIndex);

/**
 * 将应用内键盘事件转换为双拼状态机事件。
 * @param event 浏览器键盘事件
 * @returns 已归一化的输入事件；不支持的事件返回 null
 */
const normalizeKeyboardEvent = (event: KeyboardEvent): InputEvent | null => {
  if (event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return null;
  if (/^[a-z]$/.test(event.key)) return { type: "letter", key: event.key };
  if (event.key === "Backspace") return { type: "backspace" };
  if (event.key === "Escape") return { type: "escape" };
  if (event.key === " ") return { type: "space" };
  if (event.key === "Enter") return { type: "enter" };
  return null;
};

/**
 * 将 Rust 全局按键事件转换为前端状态机事件。
 * @param event Rust 后端事件
 * @returns 状态机事件；不支持的事件返回 null
 */
const rustEventToInputEvent = (event: RustKeyEvent): InputEvent | null => {
  switch (event.type) {
    case "letter": return { type: "letter", key: event.key };
    case "backspace": return { type: "backspace" };
    case "escape": return { type: "escape" };
    case "space": return { type: "space" };
    case "enter": return { type: "enter" };
    default: return null;
  }
};

/**
 * 统一处理 Rust 全局按键、窗口内 fallback 按键与窗口隐藏时的输入清理。
 * @param options 输入来源与活动上报依赖
 * @returns 双拼输入状态及重置操作
 */
export const useKeyboardInput = ({
  isListening,
  reportActivity,
}: UseKeyboardInputOptions): UseKeyboardInputResult => {
  const [inputState, setInputState] = useState<InputState>({ phase: "idle" }); //双拼输入状态

  /** 清空当前双拼输入状态。 */
  const resetInput = useCallback(() => {
    setInputState({ phase: "idle" });
  }, []);

  // 订阅 Rust 全局按键和原生窗口隐藏通知
  useEffect(() => {
    let disposed = false;
    const unlisteners: Array<() => void> = [];

    /** 保存或立即释放异步建立的订阅。 */
    const retainUnlisten = (unlisten: () => void) => {
      if (disposed) unlisten();
      else unlisteners.push(unlisten);
    };

    /** 建立 Rust 事件订阅。 */
    const setup = async () => {
      try {
        retainUnlisten(await listen<RustKeyEvent>("key-event", (event) => {
          reportActivity();
          const inputEvent = rustEventToInputEvent(event.payload);
          if (inputEvent) {
            setInputState((currentState) => transition(currentState, inputEvent));
          }
        }));
        retainUnlisten(await listen(WINDOW_HIDDEN_EVENT, resetInput));
      } catch (error) {
        console.warn("订阅 Rust 键盘事件失败", error);
      }
    };

    void setup();
    return () => {
      disposed = true;
      unlisteners.forEach((unlisten) => unlisten());
    };
  }, [reportActivity, resetInput]);

  // 全局监听停止时，使用浏览器 keydown 作为输入 fallback
  useEffect(() => {
    if (isListening) return;

    /** 推进应用内输入状态。 */
    const handleKeyDown = (event: KeyboardEvent) => {
      reportActivity();
      const inputEvent = normalizeKeyboardEvent(event);
      if (inputEvent) {
        setInputState((currentState) => transition(currentState, inputEvent));
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isListening, reportActivity]);

  return { inputState, resetInput };
};
