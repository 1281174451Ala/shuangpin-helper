/** 候选索引：物理首键到合法第二键集合的映射。 */
export type CandidateIndex = ReadonlyMap<string, ReadonlySet<string>>;

/** 空闲状态。 */
export interface IdleState {
  /** 当前输入阶段 */
  phase: "idle";
}

/** 等待第二键状态。 */
export interface WaitingSecondKeyState {
  /** 当前输入阶段 */
  phase: "waitingSecondKey";
  /** 合法第二键集合 */
  candidateKeys: ReadonlySet<string>;
}

/** 双拼输入状态。 */
export type InputState = IdleState | WaitingSecondKeyState;

/** 字母输入事件。 */
export interface LetterInputEvent {
  /** 事件类别 */
  type: "letter";
  /** 已归一化的小写字母键 */
  key: string;
}

/** 非字母输入事件类别。 */
export type NonLetterInputEventType = "backspace" | "escape" | "space" | "enter" | "reset";

/** 非字母输入事件。 */
export interface NonLetterInputEvent {
  /** 事件类别 */
  type: NonLetterInputEventType;
}

/** 状态机接收的输入事件。 */
export type InputEvent = LetterInputEvent | NonLetterInputEvent;

/** 状态转换函数。 */
export type StateTransition = (state: InputState, event: InputEvent) => InputState;

/**
 * 创建依赖候选索引的纯状态转换函数。
 * @param candidateIndex 物理首键到合法第二键集合的映射
 * @returns 输入事件对应的新状态
 */
export const createStateMachine = (candidateIndex: CandidateIndex): StateTransition => {
  /**
   * 根据当前状态和输入事件计算下一个状态。
   * @param state 当前输入状态
   * @param event 已归一化的输入事件
  * @returns 下一个输入状态
  */
  return (state, event) => {
    if (
      state.phase === "waitingSecondKey" &&
      (event.type === "backspace" || event.type === "escape" || event.type === "enter" || event.type === "reset")
    ) {
      return { phase: "idle" };
    }

    if (event.type !== "letter") {
      return state;
    }

    if (state.phase === "waitingSecondKey") {
      return { phase: "idle" };
    }

    const candidateKeys = candidateIndex.get(event.key);
    if (!candidateKeys || candidateKeys.size === 0) {
      return state;
    }

    return { phase: "waitingSecondKey", candidateKeys };
  };
};
