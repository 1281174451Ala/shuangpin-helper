import { listShuangpinSchemes } from "../../engine/shuangpin";
import { useApplicationSettings } from "../../store/applicationSettings";

/**
 * 渲染独立设置窗口中当前可用的应用设置摘要。
 * @returns 设置窗口内容
 */
export const SettingsView = () => {
  const { settings, error, recoveredFromInvalidSettings } = useApplicationSettings(); //原生应用设置
  const schemeName = listShuangpinSchemes().find(({ id }) => id === settings?.schemeId)?.displayName;

  return (
    <main className="min-h-screen bg-slate-950 p-6 text-slate-100">
      <section aria-label="应用设置" className="mx-auto max-w-md space-y-4 rounded-xl bg-slate-900 p-5">
        <h1 className="text-xl font-semibold">应用设置</h1>
        {recoveredFromInvalidSettings && (
          <p role="status" className="rounded-lg bg-amber-950 px-4 py-3 text-sm text-amber-100">
            设置文件无效，已恢复默认设置并保留诊断副本。
          </p>
        )}
        <div className="flex items-center justify-between rounded-lg bg-slate-800 px-4 py-3">
          <span className="text-slate-300">当前方案</span>
          <strong>{error ? "读取失败" : (schemeName ?? "正在读取…")}</strong>
        </div>
      </section>
    </main>
  );
};
