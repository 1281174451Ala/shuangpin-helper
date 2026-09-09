import { useEffect, useState } from "react";
import type { AppearanceMode } from "../store/applicationSettings";

/** 解析后供主题组件使用的外观模式。 */
export type ResolvedAppearance = "light" | "dark";

/** macOS 系统深色外观媒体查询。 */
const DARK_MODE_QUERY = "(prefers-color-scheme: dark)";

/** 读取当前系统外观。 */
const readSystemAppearance = (): ResolvedAppearance => {
  return window.matchMedia(DARK_MODE_QUERY).matches ? "dark" : "light";
};

/**
 * 将用户外观偏好解析为当前有效外观，并持续跟随系统变化。
 * @param appearance 用户选择的外观模式
 * @returns 当前有效的浅色或深色外观
 */
export const useResolvedAppearance = (appearance: AppearanceMode): ResolvedAppearance => {
  const [resolvedAppearance, setResolvedAppearance] = useState<ResolvedAppearance>(() => {
    return appearance === "system" ? readSystemAppearance() : appearance;
  }); //当前解析后的外观

  // 监听用户外观模式及系统外观变化
  useEffect(() => {
    if (appearance !== "system") {
      setResolvedAppearance(appearance);
      return;
    }

    const mediaQueryList = window.matchMedia(DARK_MODE_QUERY);
    /** 将系统媒体查询事件转换为解析后的外观。 */
    const handleSystemAppearanceChange = (event: MediaQueryListEvent) => {
      setResolvedAppearance(event.matches ? "dark" : "light");
    };

    setResolvedAppearance(mediaQueryList.matches ? "dark" : "light");
    mediaQueryList.addEventListener("change", handleSystemAppearanceChange);

    return () => {
      mediaQueryList.removeEventListener("change", handleSystemAppearanceChange);
    };
  }, [appearance]);

  return resolvedAppearance;
};
