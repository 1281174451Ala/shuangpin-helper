import { invoke } from "@tauri-apps/api/core";
import { Key } from "../Key/Key";
import { getKeyMappings } from "../../engine/shuangpin";
import type { InputState } from "../../engine/stateMachine";

const keyboardRows = ["qwertyuiop", "asdfghjkl", "zxcvbnm"];

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
export const VirtualKeyboard = ({ inputState }: VirtualKeyboardProps) => {
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
              finals={["关闭"]}
              key="exit"
              label="EXIT"
              onClick={() => invoke("exit_app").catch(console.error)}
            />
          )}
        </div>
      ))}
    </section>
  );
};
