import { useEffect } from "react";
import { VirtualKeyboard } from "./components/VirtualKeyboard/VirtualKeyboard";
import { SettingsView } from "./components/SettingsView/SettingsView";
import { useGlobalKeyListener } from "./hooks/useGlobalKeyListener";
import { useIdleFade } from "./hooks/useIdleFade";
import { useKeyboardInput } from "./hooks/useKeyboardInput";
import { useWindowInteraction } from "./hooks/useWindowInteraction";
import {
  type ApplicationSettings,
  useApplicationSettings,
} from "./store/applicationSettings";

/** 空闲多久后自动淡化（毫秒）。后续设置页可自定义。 */
const IDLE_DELAY_MS = 3000;
/** 空闲时的透明度。后续设置页可自定义。 */
const IDLE_OPACITY = 0.3;

/**
 * 渲染双拼学习悬浮窗口的最小界面。
 * @returns 应用根元素
 */
export const App = () => {
  const isSettingsWindow = new URLSearchParams(window.location.search).get("window") === "settings";

  if (isSettingsWindow) {
    return <SettingsView />;
  }

  return <FloatingWindow />;
};

/** 悬浮窗口已加载设置后的属性。 */
interface FloatingWindowContentProps {
  /** 原生层返回的当前应用设置 */
  settings: ApplicationSettings;
}

/**
 * 读取应用设置后挂载悬浮窗口，避免输入引擎使用未解析的方案。
 * @returns 悬浮窗口或设置读取错误
 */
const FloatingWindow = () => {
  const { settings, error } = useApplicationSettings(); //原生应用设置

  if (error) {
    return <main role="alert">读取应用设置失败</main>;
  }
  if (!settings) return null;

  return <FloatingWindowContent settings={settings} />;
};

/**
 * 渲染已按当前方案初始化的双拼学习悬浮窗口。
 * @param props 当前应用设置
 * @returns 悬浮窗口内容
 */
const FloatingWindowContent = ({ settings }: FloatingWindowContentProps) => {
  const { isIdle, reportActivity } = useIdleFade({ delay: IDLE_DELAY_MS });
  const { isListening } = useGlobalKeyListener();
  const { inputState, resetInput } = useKeyboardInput({
    isListening,
    reportActivity,
    schemeId: settings.schemeId,
  });
  const { cardRef, handleMouseDown } = useWindowInteraction({ reportActivity });

  // 空闲时重置状态
  useEffect(() => {
    isIdle && resetInput();
  }, [isIdle, resetInput]);

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
        <VirtualKeyboard inputState={inputState} schemeId={settings.schemeId} />
      </div>
    </main>
  );
};
