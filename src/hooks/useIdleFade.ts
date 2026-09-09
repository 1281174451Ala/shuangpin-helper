import { useCallback, useEffect, useRef, useState } from "react";

/** useIdleFade 的配置项。 */
interface UseIdleFadeOptions {
  /** 无活动多久后进入空闲淡化状态（毫秒）；null 表示不淡化。默认 3000。 */
  delay?: number | null;
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
  const [isIdle, setIsIdle] = useState(false); //是否处于空闲状态
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null); //空闲定时器

  /**
   * （重新）排定空闲定时器：清掉旧定时器并在 delay 后置 isIdle=true。
   */
  const scheduleIdle = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setIsIdle(false);
    if (delay === null) {
      return;
    }
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      setIsIdle(true);
    }, delay);
  }, [delay]); //空闲定时排程

  /**
   * 上报用户活动：立即退出空闲并重置计时。
   */
  const reportActivity = useCallback(() => {
    setIsIdle(false);
    scheduleIdle();
  }, [scheduleIdle]); //活动上报处理

  // 挂载即开始空闲计时；卸载时清理定时器，避免泄漏与卸载后 setState
  useEffect(() => {
    scheduleIdle();
    return () => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [scheduleIdle]);

  return { isIdle, reportActivity };
}; // 空闲淡化检测 hook
