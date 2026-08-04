import { useEffect, useState } from "react";
import { VirtualKeyboard } from "./components/VirtualKeyboard/VirtualKeyboard";
import { xiaoheCandidateIndex } from "./engine/shuangpin";
import {
  createStateMachine,
  type InputEvent,
  type InputState,
} from "./engine/stateMachine";

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

const transition = createStateMachine(xiaoheCandidateIndex);

/**
 * 渲染双拼学习悬浮窗口的最小界面。
 * @returns 应用根元素
 */
export const App = () => {
  const [inputState, setInputState] = useState<InputState>({ phase: "idle" }); //当前双拼输入状态

  //监听应用内键盘输入以展示状态流转
  useEffect(() => {
    /**
     * 将浏览器键盘事件交给纯状态机处理。
     * @param event 浏览器键盘事件
     */
    const handleKeyDown = (event: KeyboardEvent) => {
      const inputEvent = normalizeKeyboardEvent(event);
      if (!inputEvent) {
        return;
      }

      setInputState((currentState) => transition(currentState, inputEvent));
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <main className="flex items-center justify-center w-screen h-screen">
      <div className="w-fit p-5 border border-white/[0.18] rounded-[18px] bg-[rgb(20,28,43,0.92)] shadow-[0_16px_40px_rgb(0,0,0,0.25)]">
        {/* <header>
          <p className="m-0 text-[#8bb8ff] text-xs font-bold tracking-widest">小鹤双拼</p>
          <h1 className="my-1.5 text-2xl">双拼辅助键盘</h1>
          <p className="mb-[18px] text-[#b8c6de] text-sm">{enteredKey ? `已输入 ${enteredKey.toUpperCase()}，请选择下一键` : "输入首键以查看合法候选"}</p>
        </header> */}
        <VirtualKeyboard inputState={inputState} />
      </div>
    </main>
  );
};
