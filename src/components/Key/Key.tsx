/** 单个虚拟按键的渲染参数。 */
interface KeyProps {
  /** 键盘上显示的字母 */
  label: string;
  /** 声母映射（右上角显示） */
  initial?: string;
  /** 韵母映射（下方居中显示，多个韵母换行） */
  finals?: string | string[];
  /** 是否可作为当前的下一次输入 */
  enabled: boolean;
  /** 是否为当前已输入的按键 */
  active: boolean;
}

/**
 * 渲染带有双拼映射说明的不可编辑虚拟按键。
 * @param props 虚拟按键的显示状态
 * @returns 虚拟按键元素
 */
export const Key = ({ label, initial, finals, enabled, active }: KeyProps) => {
  const finalsArray = typeof finals === "string" ? [finals] : finals;

  return (
    <button
      aria-pressed={active}
      className={`
        flex flex-col w-12 h-[60px] p-1.5 border rounded-lg text-inherit cursor-default
        ${active ? "border-[#f6c85f] bg-[#7a5b18]" : "border-[#52627f] bg-[#27344c]"}
        disabled:opacity-28
      `}
      disabled={!enabled}
      type="button"
    >
      <div className="flex justify-between items-start mb-1">
        <span className="text-[15px] font-semibold">{label.toUpperCase()}</span>
        {initial && <small className="text-[#93bfff] text-[11px]">{initial}</small>}
      </div>
      {finalsArray && finalsArray.length > 0 && (
        <div className="flex flex-col items-center gap-1 w-full">
          {finalsArray.map((final, index) => (
            <small key={index} className="text-[#93bfff] text-[11px] leading-normal">
              {final}
            </small>
          ))}
        </div>
      )}
    </button>
  );
};
