import { useCallback, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";

/** useWindowInteraction 的入参。 */
interface UseWindowInteractionOptions {
  /** 用户操作时重置空闲淡化计时。 */
  reportActivity: () => void;
}

/** useWindowInteraction 的返回值。 */
interface UseWindowInteractionResult {
  /** 用于根据容器尺寸计算虚拟键盘按键大小的元素引用。 */
  cardRef: React.RefObject<HTMLDivElement | null>;
  /** 主窗口区域的鼠标按下处理函数。 */
  handleMouseDown: (event: React.MouseEvent) => void;
}

/**
 * 管理窗口拖动、尺寸适配和浏览器可见性变化。
 * @param options 窗口交互依赖
 * @returns 容器引用及拖动事件处理函数
 */
export const useWindowInteraction = ({ reportActivity }: UseWindowInteractionOptions): UseWindowInteractionResult => {
  const cardRef = useRef<HTMLDivElement>(null); //键盘容器引用

  // 根据卡片实际内容区动态计算按键尺寸
  useEffect(() => {
    const element = cardRef.current;
    if (!element) return;

    /** 根据内容区的宽高更新 CSS 按键尺寸变量。 */
    const computeKeySize = () => {
      const style = getComputedStyle(element);
      const padX = parseFloat(style.paddingLeft) + parseFloat(style.paddingRight);
      const padY = parseFloat(style.paddingTop) + parseFloat(style.paddingBottom);
      const keySize = Math.min(
        (element.clientWidth - padX - 54) / 10,
        (element.clientHeight - padY - 16) / 3,
      );
      element.style.setProperty("--key-size", `${Math.floor(keySize)}px`);
    };

    computeKeySize();
    const observer = new ResizeObserver(computeKeySize);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  // 响应 macOS 应用隐藏和重新可见，隐藏后的状态由 Rust window-hidden 统一清理
  useEffect(() => {
    /** 转发浏览器可见性变化到原生窗口生命周期。 */
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        void invoke("hide_window");
      } else {
        reportActivity();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [reportActivity]);

  /**
   * 报告窗口拖动活动，并启动原生窗口拖动。
   * @param event 鼠标按下事件
   */
  const handleMouseDown = useCallback((event: React.MouseEvent) => {
    const target = event.target as HTMLElement;
    if (target.closest("input, select, textarea")) return;
    reportActivity();
    const window = getCurrentWindow();
    void window.setFocus();
    void window.startDragging();
  }, [reportActivity]);

  return { cardRef, handleMouseDown };
};
