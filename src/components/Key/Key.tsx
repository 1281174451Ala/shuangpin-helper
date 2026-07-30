/** 单个虚拟按键的渲染参数。 */
interface KeyProps {
  /** 键盘上显示的字母 */
  label: string;
  /** 双拼映射说明 */
  mapping?: string;
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
export const Key = ({ label, mapping, enabled, active }: KeyProps) => (
  <button
    aria-pressed={active}
    className={`key${active ? " key--active" : ""}`}
    disabled={!enabled}
    type="button"
  >
    <span>{label.toUpperCase()}</span>
    {mapping && <small>{mapping}</small>}
  </button>
);
