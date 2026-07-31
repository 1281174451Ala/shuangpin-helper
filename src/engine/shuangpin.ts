import scheme from "../../config/shuangpin.json";
import candidats from "../../config/syllables-candidates.json";

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
export interface ShuangpinScheme {
  /** 方案标识 */
  name: string;
  /** 声母键映射 */
  initials: Record<string, string>;
  /** 韵母键映射（统一为数组） */
  finals: Record<string, string[]>;
}

/** 已审定的合法音节数据。 */
export interface SyllableData {
  /** 零声母拼写类别 */
  zeroInitials: string[];
  /** 声母类别到合法韵母集合的映射 */
  syllables: Record<string, string[]>;
}

const shuangpinScheme = scheme as ShuangpinScheme;

/**
 * 根据方案和已审定音节数据预生成首键候选索引。
 * @param shuangpin 双拼方案映射
 * @param syllableData 合法音节数据
 * @returns 物理首键到合法第二键集合的映射
 */
export const createCandidateIndex = (
  shuangpin: ShuangpinScheme,
  syllableData: SyllableData,
): ReadonlyMap<string, ReadonlySet<string>> => {
  for (const initial of syllableData.zeroInitials) {
    if (!(initial in syllableData.syllables)) {
      throw new Error(`Zero initial "${initial}" is missing syllable data`);
    }
  }

  const finalToKey = new Map<string, string>(); // 韵母到物理键的反向映射

  for (const [key, finals] of Object.entries(shuangpin.finals)) {
    for (const final of finals) {
      if (finalToKey.has(final)) {
        throw new Error(`Final "${final}" maps to multiple keys`);
      }

      finalToKey.set(final, key);
    }
  }

  const candidateIndex = new Map<string, ReadonlySet<string>>(); // 首键到候选第二键集合
  for (const [key, initial] of Object.entries(shuangpin.initials)) {
    if (!(initial in syllableData.syllables)) {
      throw new Error(`Initial "${initial}" is missing syllable data`);
    }

    const candidateKeys = new Set<string>();

    for (const final of syllableData.syllables[initial]) {
      const finalKey = finalToKey.get(final);
      if (!finalKey) {
        throw new Error(`Final "${final}" has no key mapping`);
      }

      candidateKeys.add(finalKey);
    }

    if (candidateKeys.size > 0) {
      candidateIndex.set(key, candidateKeys);
    }
  }

  return candidateIndex;
};

/** 已审定小鹤配置预生成的首键候选索引。 */
export const xiaoheCandidateIndex = createCandidateIndex(
  shuangpinScheme,
  candidats as SyllableData,
);

/** 一个键的声母和韵母映射。 */
export interface KeyMappings {
  /** 键盘上的字母键 */
  key: string;
  /** 声母映射（如果有） */
  initial?: string;
  /** 韵母映射（如果有，统一为数组） */
  finals?: string[];
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
