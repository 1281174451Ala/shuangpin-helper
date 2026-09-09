import { type ChangeEvent, useEffect } from "react";
import { listShuangpinSchemes } from "../../engine/shuangpin";
import { useResolvedAppearance } from "../../hooks/useResolvedAppearance";
import {
  type ApplicationSettings,
  type AppearanceMode,
  useApplicationSettings,
} from "../../store/applicationSettings";

/** 设置页中的外观模式选项。 */
interface AppearanceOption {
  /** 持久化的外观模式值 */
  value: AppearanceMode;
  /** 向用户展示的模式名称 */
  label: string;
}

/** 设置页展示的外观模式。 */
const appearanceOptions: ReadonlyArray<AppearanceOption> = [
  { value: "system", label: "跟随系统" },
  { value: "light", label: "浅色" },
  { value: "dark", label: "深色" },
];

/** 可选的空闲淡化秒数。 */
const idleFadeDelaySeconds = Array.from({ length: 30 }, (_, index) => index + 1);

/**
 * 渲染独立设置窗口中当前可用的应用设置摘要。
 * @returns 设置窗口内容
 */
export const SettingsView = () => {
  const { settings, error, recoveredFromInvalidSettings, updateSettings } = useApplicationSettings(); //原生应用设置
  const resolvedAppearance = useResolvedAppearance(settings?.appearance ?? "system"); //当前有效外观
  const schemeName = listShuangpinSchemes().find(({ id }) => id === settings?.schemeId)?.displayName;

  /** 立即预览并持久化设置字段；失败留待设置恢复流程提示。 */
  const persistSettings = (patch: Partial<ApplicationSettings>) => {
    if (!settings) return;
    void updateSettings({ ...settings, ...patch }).catch(console.error);
  };

  /** 更新外观模式。 */
  const handleAppearanceChange = (event: ChangeEvent<HTMLInputElement>) => {
    persistSettings({ appearance: event.target.value as AppearanceMode });
  };

  /** 更新空闲淡化延时，none 表示不淡化。 */
  const handleIdleFadeDelayChange = (event: ChangeEvent<HTMLSelectElement>) => {
    persistSettings({
      idleFadeDelayMs: event.target.value === "none" ? null : Number(event.target.value),
    });
  };

  /** 更新空闲透明度百分比。 */
  const handleIdleOpacityChange = (event: ChangeEvent<HTMLInputElement>) => {
    persistSettings({ idleOpacity: Number(event.target.value) / 100 });
  };

  // 将设置解析后的主题应用到当前设置窗口
  useEffect(() => {
    document.documentElement.dataset.theme = resolvedAppearance;
  }, [resolvedAppearance]);

  return (
    <main className="min-h-screen bg-[var(--window-bg)] p-6 text-[var(--text-primary)]">
      <section aria-label="应用设置" className="mx-auto max-w-md space-y-5 rounded-xl border border-[var(--panel-border)] bg-[var(--panel-bg)] p-5">
        <h1 className="text-xl font-semibold">应用设置</h1>
        {recoveredFromInvalidSettings && (
          <p role="status" className="rounded-lg bg-amber-950 px-4 py-3 text-sm text-amber-100">
            设置文件无效，已恢复默认设置并保留诊断副本。
          </p>
        )}
        <div className="flex items-center justify-between rounded-lg bg-[var(--control-bg)] px-4 py-3">
          <span className="text-[var(--text-secondary)]">当前方案</span>
          <strong>{error ? "读取失败" : (schemeName ?? "正在读取…")}</strong>
        </div>

        {/* 外观模式为完整内置主题，不提供逐项颜色设置。 */}
        <fieldset className="space-y-2" disabled={!settings}>
          <legend className="font-medium">外观模式</legend>
          <div className="grid grid-cols-3 gap-2">
            {appearanceOptions.map(({ value, label }) => (
              <label className="cursor-pointer rounded-lg bg-[var(--control-bg)] px-3 py-2 text-center text-sm" key={value}>
                <input
                  checked={settings?.appearance === value}
                  className="mr-2 accent-[var(--accent)]"
                  name="appearance"
                  onChange={handleAppearanceChange}
                  type="radio"
                  value={value}
                />
                {label}
              </label>
            ))}
          </div>
        </fieldset>

        {/* 空闲淡化使用后端相同的整数秒与百分比约束。 */}
        <fieldset className="space-y-4" disabled={!settings}>
          <legend className="font-medium">空闲淡化</legend>
          <label className="flex items-center justify-between gap-4">
            <span className="text-[var(--text-secondary)]">空闲淡化</span>
            <select
              className="rounded-lg border border-[var(--panel-border)] bg-[var(--control-bg)] px-3 py-2"
              onChange={handleIdleFadeDelayChange}
              value={settings?.idleFadeDelayMs ?? "none"}
            >
              <option value="none">不淡化</option>
              {idleFadeDelaySeconds.map((seconds) => (
                <option key={seconds} value={seconds * 1000}>{seconds} 秒</option>
              ))}
            </select>
          </label>
          <div className="space-y-2">
            <span className="flex justify-between text-[var(--text-secondary)]">
              <label htmlFor="idle-opacity">空闲透明度</label>
              <span>{Math.round((settings?.idleOpacity ?? 0.3) * 100)}%</span>
            </span>
            <input
              className="w-full accent-[var(--accent)]"
              id="idle-opacity"
              max="100"
              min="20"
              onChange={handleIdleOpacityChange}
              step="5"
              type="range"
              value={(settings?.idleOpacity ?? 0.3) * 100}
            />
          </div>
        </fieldset>
      </section>
    </main>
  );
};
