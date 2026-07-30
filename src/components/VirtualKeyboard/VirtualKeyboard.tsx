import { Key } from "../Key/Key";
import { getShuangpinKey } from "../../engine/shuangpin";

const keyboardRows = ["qwertyuiop", "asdfghjkl", "zxcvbnm"];

/** 虚拟键盘的状态参数。 */
interface VirtualKeyboardProps {
  /** 当前已输入的第一个双拼键 */
  enteredKey?: string;
  /** 在输入首键后仍可输入的字母键 */
  availableKeys: string[];
}

/**
 * 显示 QWERTY 键盘及当前双拼输入状态。
 * @param props 当前输入及候选按键状态
 * @returns 虚拟键盘元素
 */
export const VirtualKeyboard = ({ enteredKey, availableKeys }: VirtualKeyboardProps) => {
  const hasEnteredKey = Boolean(enteredKey);

  return (
    <section aria-label="双拼虚拟键盘" className="keyboard">
      {keyboardRows.map((row) => (
        <div className="keyboard__row" key={row}>
          {[...row].map((letter) => {
            const mapping = getShuangpinKey(letter);
            const enabled = !hasEnteredKey || availableKeys.includes(letter) || letter === enteredKey;

            return (
              <Key
                active={letter === enteredKey}
                enabled={enabled}
                key={letter}
                label={letter}
                mapping={mapping?.value}
              />
            );
          })}
        </div>
      ))}
    </section>
  );
};
