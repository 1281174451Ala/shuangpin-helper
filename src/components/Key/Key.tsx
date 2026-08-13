/** 虚拟按键的展示状态。 */
export type KeyDisplayState = "default" | "candidate" | "disabled";

/** 单个虚拟按键的渲染参数。 */
interface KeyProps {
  /** 键盘上显示的字母 */
  label: string;
  /** 声母映射（右上角显示） */
  initial?: string;
  /** 韵母映射（下方居中显示，多个韵母换行） */
  finals?: string[];
  /** 按键当前展示状态 */
  displayState: KeyDisplayState;
}

/**
 * 渲染带有双拼映射说明的不可编辑虚拟按键。
 * @param props 虚拟按键的显示状态
 * @returns 虚拟按键元素
 */
export const Key = ({ label, initial, finals, displayState }: KeyProps) => {
  const isCandidate = displayState === "candidate"; //是否为候选第二键
  const isDisabled = displayState === "disabled"; //是否为不可用键

  return (
    <button
      aria-pressed={isCandidate}
      style={{ width: 'var(--key-size)', height: 'var(--key-size)', fontSize: 'var(--key-size)' }}
      className={`
        flex flex-col p-[0.075em] border rounded-[0.1em] text-inherit cursor-default
        ${isCandidate ? "border-[#f6c85f] bg-[#7a5b18]" : "border-[#52627f] bg-[#27344c]"}
        disabled:opacity-28
      `}
      disabled={isDisabled}
      type="button"
    >
      <div className="flex justify-between items-start mb-[0.05em]">
        <span className="text-[0.1875em] font-semibold">{label.toUpperCase()}</span>
        {/* 候选时不显示声母 */}
        {!isCandidate && initial && <small className="text-[#f2858c] text-[0.1625em]">{initial}</small>}
      </div>
      {finals && finals.length > 0 && (
        <div className="flex flex-col items-center gap-[0.05em] w-full">
          {finals.map((final, index) => (
            <small key={index} className={`text-[#93bfff] ${isCandidate ? 'text-[0.15em]' : 'text-[0.1375em]'}  leading-normal`}>
              {final}
            </small>
          ))}
        </div>
      )}
    </button>
  );
};
