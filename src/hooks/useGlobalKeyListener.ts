import { useCallback, useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";

/** Rust 在任何窗口隐藏入口执行清理后发出的通知。 */
const WINDOW_HIDDEN_EVENT = "window-hidden";

/** 全局按键监听 Hook 的公开状态与操作。 */
interface UseGlobalKeyListenerResult {
  /** 当前是否正在接收 Rust 转发的全局按键。 */
  isListening: boolean;
  /** 当前是否拥有 macOS 辅助功能权限。 */
  hasPermission: boolean | null;
  /** 用户主动启动全局按键监听。 */
  startListening: () => Promise<void>;
  /** 重新检查权限，并在授权后启动监听。 */
  refreshPermission: () => Promise<void>;
}

/**
 * 管理 macOS 辅助功能权限与 Rust 全局按键监听的完整生命周期。
 * @returns 监听状态、权限状态和控制方法
 */
export const useGlobalKeyListener = (): UseGlobalKeyListenerResult => {
  const [hasPermission, setHasPermission] = useState<boolean | null>(null); //辅助功能权限状态
  const [isListening, setIsListening] = useState(false); //全局监听是否正在转发事件
  const userToggledListeningRef = useRef(false); //用户是否手动切换过监听

  /**
   * 查询权限，并在已授权时请求 Rust 启动全局监听。
   * @returns 完成后的 Promise
   */
  const refreshPermission = useCallback(async () => {
    const granted = await invoke<boolean>("get_accessibility_permission");
    setHasPermission(granted);
    if (granted) {
      const started = await invoke<boolean>("start_key_listener");
      setIsListening(started);
    }
  }, []);

  /**
   * 记录用户主动操作并启动全局监听，防止初始化状态覆盖结果。
   * @returns 完成后的 Promise
   */
  const startListening = useCallback(async () => {
    try {
      userToggledListeningRef.current = true;
      const started = await invoke<boolean>("start_key_listener");
      setIsListening(started);
    } catch (error) {
      console.error("启动全局监听失败", error);
    }
  }, []);

  // 初始化订阅 Rust 监听状态，并查询权限和后端当前状态
  useEffect(() => {
    let disposed = false;
    const unlisteners: Array<() => void> = [];

    /** 将异步取得的取消订阅函数安全地加入清理队列。 */
    const retainUnlisten = (unlisten: () => void) => {
      if (disposed) {
        unlisten();
      } else {
        unlisteners.push(unlisten);
      }
    };

    /** 初始化 Rust 事件订阅和权限状态。 */
    const setup = async () => {
      try {
        retainUnlisten(await listen<boolean>("listener-status", (event) => {
          setIsListening(Boolean(event.payload));
        }));
        retainUnlisten(await listen(WINDOW_HIDDEN_EVENT, () => {
          setIsListening(false);
        }));
      } catch (error) {
        console.warn("订阅全局监听状态失败", error);
      }
      if (disposed) return;

      try {
        let granted = await invoke<boolean>("get_accessibility_permission");
        if (disposed) return;
        setHasPermission(granted);

        if (!granted) {
          await invoke("request_accessibility_permission");
          granted = await invoke<boolean>("get_accessibility_permission");
          if (disposed) return;
          setHasPermission(granted);
          if (granted) {
            const started = await invoke<boolean>("start_key_listener");
            if (!disposed) setIsListening(started);
          }
        }
      } catch (error) {
        console.warn("查询辅助功能权限失败", error);
      }
      if (disposed) return;

      try {
        const listening = await invoke<boolean>("get_listener_status");
        if (!disposed && !userToggledListeningRef.current) {
          setIsListening(listening);
        }
      } catch (error) {
        console.warn("同步后端监听状态失败", error);
      }
    };

    void setup();
    return () => {
      disposed = true;
      unlisteners.forEach((unlisten) => unlisten());
    };
  }, []);

  // 窗口获得焦点时重新检查权限，并恢复全局监听
  useEffect(() => {
    let disposed = false;
    let unlistenFocus: (() => void) | undefined;

    /** 检查辅助功能权限，并在已授权时恢复全局键盘事件转发。 */
    const resumeWhenPermitted = async () => {
      try {
        const granted = await invoke<boolean>("get_accessibility_permission");
        if (disposed) return;
        setHasPermission(granted);
        if (!granted) {
          setIsListening(false);
          return;
        }
        const started = await invoke<boolean>("start_key_listener");
        if (!disposed) setIsListening(started);
      } catch (error) {
        console.warn("恢复全局监听失败", error);
      }
    };

    getCurrentWindow().onFocusChanged(({ payload: focused }) => {
      if (focused) void resumeWhenPermitted();
    }).then((unlisten) => {
      if (disposed) {
        unlisten();
      } else {
        unlistenFocus = unlisten;
      }
    }).catch((error) => console.warn("订阅窗口焦点变化失败", error));

    return () => {
      disposed = true;
      unlistenFocus?.();
    };
  }, []);

  return { hasPermission, isListening, refreshPermission, startListening };
};
