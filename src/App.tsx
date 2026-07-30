import { useEffect, useMemo, useState } from "react";
import { VirtualKeyboard } from "./components/VirtualKeyboard/VirtualKeyboard";

/**
 * 根据首键计算演示用的候选第二键。
 * @param enteredKey 已输入的第一个字母键
 * @returns 可作为第二键输入的字母键
 */
const getAvailableKeys = (enteredKey?: string): string[] => {
  if (!enteredKey) {
    return [];
  }

  return enteredKey === "d" ? ["a", "e", "h", "i", "n", "u"] : ["a", "e", "i", "o", "u"];
};

/**
 * 渲染双拼学习悬浮窗口的最小界面。
 * @returns 应用根元素
 */
export const App = () => {
  const [enteredKey, setEnteredKey] = useState<string>(); //当前已输入首键
  const availableKeys = useMemo(() => getAvailableKeys(enteredKey), [enteredKey]); //当前候选第二键

  //监听应用内键盘输入以展示状态流转
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();

      if (key === "escape" || key === "backspace" || key === " ") {
        setEnteredKey(undefined);
        return;
      }

      if (!/^[a-z]$/.test(key)) {
        return;
      }

      setEnteredKey((currentKey) => (currentKey ? undefined : key));
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <main className="app-shell">
      <header>
        <p className="eyebrow">小鹤双拼</p>
        <h1>双拼辅助键盘</h1>
        <p>{enteredKey ? `已输入 ${enteredKey.toUpperCase()}，请选择下一键` : "输入首键以查看合法候选"}</p>
      </header>
      <VirtualKeyboard availableKeys={availableKeys} enteredKey={enteredKey} />
    </main>
  );
};
