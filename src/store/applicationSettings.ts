import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { useEffect, useState } from "react";

/** 原生层广播应用设置变化时使用的事件名。 */
const APPLICATION_SETTINGS_CHANGED_EVENT = "application-settings-changed";

/** 应用设置变化订阅者。 */
export type ApplicationSettingsListener = (settings: ApplicationSettings) => void;

/** 原生层持久化的应用设置。 */
export interface ApplicationSettings {
  /** 设置格式版本 */
  version: number;
  /** 当前双拼方案标识 */
  schemeId: string;
  /** 外观模式 */
  appearance: string;
  /** 空闲淡化延时；null 表示不淡化 */
  idleFadeDelayMs: number | null;
  /** 空闲时的窗口不透明度 */
  idleOpacity: number;
}

/** 应用设置读取状态。 */
interface ApplicationSettingsState {
  /** 最近读取的应用设置 */
  settings: ApplicationSettings | null;
  /** 读取失败原因 */
  error: Error | null;
}

/**
 * 从原生设置存储读取当前应用设置。
 * @returns 当前持久化设置
 */
export const readApplicationSettings = (): Promise<ApplicationSettings> => {
  return invoke<ApplicationSettings>("get_application_settings");
};

/**
 * 将完整应用设置交给原生唯一来源持久化。
 * @param settings 要立即生效并持久化的设置
 * @returns 原生层确认保存后的设置
 */
export const saveApplicationSettings = (
  settings: ApplicationSettings,
): Promise<ApplicationSettings> => {
  return invoke<ApplicationSettings>("save_application_settings", { settings });
};

/**
 * 订阅任一窗口成功保存后的应用设置变化。
 * @param listener 接收最新完整设置的回调
 * @returns 取消订阅函数
 */
export const subscribeApplicationSettings = (
  listener: ApplicationSettingsListener,
): Promise<UnlistenFn> => {
  return listen<ApplicationSettings>(APPLICATION_SETTINGS_CHANGED_EVENT, (event) => {
    listener(event.payload);
  });
};

/**
 * 读取当前应用设置并维护组件生命周期内的状态。
 * @returns 当前设置及读取错误
 */
export const useApplicationSettings = (): ApplicationSettingsState => {
  const [settings, setSettings] = useState<ApplicationSettings | null>(null); //当前应用设置
  const [error, setError] = useState<Error | null>(null); //设置读取错误

  // 挂载时从原生唯一来源读取应用设置
  useEffect(() => {
    let disposed = false;
    let receivedChange = false;
    let unlisten: UnlistenFn | undefined;

    /** 先建立变化订阅，再读取初始值，避免窗口启动期间漏掉保存事件。 */
    const setup = async () => {
      try {
        unlisten = await subscribeApplicationSettings((nextSettings) => {
          receivedChange = true;
          if (!disposed) setSettings(nextSettings);
        });
      } catch (reason: unknown) {
        console.warn("订阅应用设置变化失败", reason);
      }

      try {
        const initialSettings = await readApplicationSettings();
        if (!disposed && !receivedChange) setSettings(initialSettings);
      } catch (reason: unknown) {
        if (!disposed) {
          setError(reason instanceof Error ? reason : new Error(String(reason)));
        }
      }
    };

    void setup();

    return () => {
      disposed = true;
      unlisten?.();
    };
  }, []);

  return { settings, error };
};
