import scheme from "../../config/shuangpin.json";

/** 双拼键的分类。 */
export type ShuangpinKeyType = "initial" | "final";

/** 双拼键映射信息。 */
export interface ShuangpinKey {
  /** 键盘上的字母键 */
  key: string;
  /** 小鹤双拼对应的拼音片段 */
  value: string;
  /** 拼音片段的分类 */
  type: ShuangpinKeyType;
}

/** 双拼方案的可配置映射。 */
interface ShuangpinScheme {
  /** 方案标识 */
  name: string;
  /** 声母键映射 */
  initials: Record<string, string>;
  /** 韵母键映射 */
  finals: Record<string, string | string[]>;
}

const shuangpinScheme = scheme as ShuangpinScheme;

/**
 * 查询一个键对应的小鹤双拼映射。
 * @param key 要查询的英文字母键
 * @returns 映射信息；未配置时返回 undefined
 */
export const getShuangpinKey = (key: string): ShuangpinKey | undefined => {
  const normalizedKey = key.toLowerCase();
  const initial = shuangpinScheme.initials[normalizedKey];

  if (initial) {
    return { key: normalizedKey, value: initial, type: "initial" };
  }

  const final = shuangpinScheme.finals[normalizedKey];
  if (final) {
    // 将数组转为字符串显示
    const finalValue = Array.isArray(final) ? final.join("/") : final;
    return { key: normalizedKey, value: finalValue, type: "final" };
  }

  return undefined;
};

/** 一个键的声母和韵母映射。 */
export interface KeyMappings {
  /** 键盘上的字母键 */
  key: string;
  /** 声母映射（如果有） */
  initial?: string;
  /** 韵母映射（如果有） */
  finals?: string | string[];
}

/**
 * 查询一个键的声母和韵母映射。
 * @param key 要查询的英文字母键
 * @returns 包含声母和韵母的映射信息
 */
export const getKeyMappings = (key: string): KeyMappings => {
  const normalizedKey = key.toLowerCase();
  const initial = shuangpinScheme.initials[normalizedKey];
  const finals = shuangpinScheme.finals[normalizedKey];

  return {
    key: normalizedKey,
    initial,
    finals,
  };
};
