import type { MouseEvent } from "react";

/** 虚拟按键的展示状态。 */
export type KeyDisplayState = "default" | "candidate" | "disabled" | "exit";

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
  /** 是否处于等待第二键的候选态（隐藏全部声母并弱化标签） */
  candidateMode?: boolean;
  /** 可选的点击回调，用于特殊按键（如退出键） */
  onClick?: () => void;
}

/**
 * 渲染带有双拼映射说明的不可编辑虚拟按键。
 * @param props 虚拟按键的显示状态
 * @returns 虚拟按键元素
 */
export const Key = ({ label, initial, finals, displayState, candidateMode = false, onClick }: KeyProps) => {
  const isCandidate = displayState === "candidate"; //是否为候选第二键
  const isDisabled = displayState === "disabled"; //是否为不可用键
  const isExit = displayState === "exit"; //是否为退出键

  /**
   * 阻止可点击的特殊按键触发外层窗口拖动。
   * @param event 按键的鼠标按下事件
   */
  const handleMouseDown = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
  };

  return (
    <button
      aria-pressed={isCandidate}
      onClick={onClick}
      onMouseDown={onClick ? handleMouseDown : undefined}
      style={{ width: 'var(--key-size)', height: 'var(--key-size)', fontSize: 'var(--key-size)' }}
      className={`
        flex flex-col p-[0.075em] border rounded-[0.1em] text-inherit transition-colors duration-200
        ${isExit
          ? "border-red-500 bg-red-700 cursor-pointer"
          : isCandidate
            ? "border-[#f6c85f] bg-[#2b2417] cursor-default"
            : "border-[#475569] bg-[#1e293b] cursor-default disabled:opacity-28"
        }
      `}
      disabled={isDisabled && !isExit}
      type="button"
    >
      <div className="flex justify-between items-start mb-[0.05em]">
        <span className={`text-[0.1875em] font-semibold ${candidateMode && !isExit ? (isCandidate ? "opacity-60" : "opacity-35") : ""}`}>{label.toUpperCase()}</span>
        {/* 候选态时隐藏全部声母，避免干扰查找韵母 */}
        {!candidateMode && initial && <small className="text-[#f2858c] text-[0.1625em]">{initial}</small>}
      </div>
      {finals && finals.length > 0 && (
        <div className="flex flex-col items-center gap-[0.05em] w-full">
          {finals.map((final, index) => (
            <small
              key={index}
              className={`leading-normal ${isCandidate
                ? `text-[#fde68a] font-bold ${finals.length > 1 ? "text-[0.175em]" : "text-[0.2em]"}`
                : "text-[#93bfff] text-[0.1375em]"
              }`}
            >
              {final}
            </small>
          ))}
        </div>
      )}
    </button>
  );
};
