import { useCallback, useEffect, useRef, useState } from "react";

/** useIdleFade 的配置项。 */
interface UseIdleFadeOptions {
  /** 无活动多久后进入空闲淡化状态（毫秒）。默认 3000。后续设置页可自定义。 */
  delay?: number;
}

/** useIdleFade 的返回值。 */
interface UseIdleFadeResult {
  /** 是否处于空闲状态（距上次活动已超过 delay）。 */
  isIdle: boolean;
  /** 上报一次用户活动：立即退出空闲并重置空闲计时。 */
  reportActivity: () => void;
}

/**
 * 空闲淡化检测 hook。基于防抖 setTimeout：无活动超过 delay 后 isIdle 置 true。
 * 挂载即开始计时（保持原行为：从启动起 delay 内无按键也会淡化）。
 * @param options 配置项
 * @returns isIdle 状态与 reportActivity 上报函数
 */
export const useIdleFade = ({
  delay = 3000,
}: UseIdleFadeOptions = {}): UseIdleFadeResult => {
  const [isIdle, setIsIdle] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /**
   * （重新）排定空闲定时器：清掉旧定时器并在 delay 后置 isIdle=true。
   */
  const scheduleIdle = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
    }
    timerRef.current = setTimeout(() => {
      setIsIdle(true);
    }, delay);
  }, [delay]);

  /**
   * 上报用户活动：立即退出空闲并重置计时。
   */
  const reportActivity = useCallback(() => {
    setIsIdle(false);
    scheduleIdle();
  }, [scheduleIdle]);

  // 挂载即开始空闲计时；卸载时清理定时器，避免泄漏与卸载后 setState
  useEffect(() => {
    scheduleIdle();
    return () => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
      }
    };
  }, [scheduleIdle]);

  return { isIdle, reportActivity };
}; // 空闲淡化检测 hook
