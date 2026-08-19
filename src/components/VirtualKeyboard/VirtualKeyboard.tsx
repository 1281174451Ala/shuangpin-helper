import { memo } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Key } from "../Key/Key";
import { getKeyMappings } from "../../engine/shuangpin";
import type { InputState } from "../../engine/stateMachine";

const keyboardRows = ["qwertyuiop", "asdfghjkl", "zxcvbnm"];

/** 退出键的韵母标签——模块级常量，保证引用稳定以配合 React.memo。 */
const exitFinals = ["关闭"];

/** 隐藏键的点击回调——模块级常量，避免每次渲染创建新函数引用。 */
const handleExit = () => invoke("hide_window").catch(console.error);

/** 虚拟键盘的状态参数。 */
interface VirtualKeyboardProps {
  /** 当前双拼输入状态 */
  inputState: InputState;
}

/**
 * 显示 QWERTY 键盘及当前双拼输入状态。
 * @param props 当前输入及候选按键状态
 * @returns 虚拟键盘元素
 */
export const VirtualKeyboard = memo(({ inputState }: VirtualKeyboardProps) => {
  return (
    <section aria-label="双拼虚拟键盘" className="grid gap-2">
      {keyboardRows.map((row, rowIndex) => (
        <div className="flex justify-center gap-1.5" key={row}>
          {[...row].map((letter) => {
            const mappings = getKeyMappings(letter);
            const candidateMode = inputState.phase === "waitingSecondKey";
            const displayState = !candidateMode
              ? "default"
              : inputState.candidateKeys.has(letter)
                ? "candidate"
                : "disabled";

            return (
              <Key
                candidateMode={candidateMode}
                displayState={displayState}
                finals={mappings.finals}
                initial={mappings.initial}
                key={letter}
                label={letter}
              />
            );
          })}
          {rowIndex === keyboardRows.length - 1 && (
            <Key
              displayState="exit"
              finals={exitFinals}
              key="exit"
              label="EXIT"
              onClick={handleExit}
            />
          )}
        </div>
      ))}
    </section>
  );
});
