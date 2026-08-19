import { VirtualKeyboard } from "./components/VirtualKeyboard/VirtualKeyboard";
import { useGlobalKeyListener } from "./hooks/useGlobalKeyListener";
import { useIdleFade } from "./hooks/useIdleFade";
import { useKeyboardInput } from "./hooks/useKeyboardInput";
import { useWindowInteraction } from "./hooks/useWindowInteraction";

/** 空闲多久后自动淡化（毫秒）。后续设置页可自定义。 */
const IDLE_DELAY_MS = 3000;
/** 空闲时的透明度。后续设置页可自定义。 */
const IDLE_OPACITY = 0.3;

/**
 * 渲染双拼学习悬浮窗口的最小界面。
 * @returns 应用根元素
 */
export const App = () => {
  const { isIdle, reportActivity } = useIdleFade({ delay: IDLE_DELAY_MS });
  const { isListening } = useGlobalKeyListener();
  const { inputState } = useKeyboardInput({ isListening, reportActivity });
  const { cardRef, handleMouseDown } = useWindowInteraction({ reportActivity });

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
        <VirtualKeyboard inputState={inputState} />
      </div>
    </main>
  );
};
