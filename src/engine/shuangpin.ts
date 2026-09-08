import xiaoheSchemeData from "../../config/shuangpin.json";
import candidates from "../../config/syllables-candidates.json";

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

/** 一个键的声母和韵母映射。 */
export interface KeyMappings {
  /** 键盘上的字母键 */
  key: string;
  /** 声母映射（如果有） */
  initial?: string;
  /** 韵母映射（如果有，统一为数组） */
  finals?: string[];
}

/** 可供设置窗口展示的方案摘要。 */
export interface ShuangpinSchemeSummary {
  /** 稳定的方案标识 */
  id: string;
  /** 面向用户的方案名称 */
  displayName: string;
}

/** 已校验并预计算的方案注册项。 */
interface RegisteredShuangpinScheme extends ShuangpinSchemeSummary {
  /** 物理首键到合法第二键的索引 */
  candidateIndex: ReadonlyMap<string, ReadonlySet<string>>;
  /** 物理键到声韵母标签的索引 */
  keyMappings: ReadonlyMap<string, KeyMappings>;
}

/**
 * 为一个方案生成键帽显示索引。
 * @param shuangpin 双拼方案映射
 * @returns 物理键到声韵母标签的索引
 */
const createKeyMappingsIndex = (
  shuangpin: ShuangpinScheme,
): ReadonlyMap<string, KeyMappings> => {
  const index = new Map<string, KeyMappings>(); //方案键帽映射索引

  for (const key of "abcdefghijklmnopqrstuvwxyz") {
    index.set(key, {
      key,
      initial: shuangpin.initials[key],
      finals: shuangpin.finals[key],
    });
  }

  return index;
};

/** 首版内置方案注册表，仅登记小鹤双拼。 */
const schemeRegistry: ReadonlyMap<string, RegisteredShuangpinScheme> = new Map([
  [
    "xiaohe",
    {
      id: "xiaohe",
      displayName: "小鹤双拼",
      candidateIndex: createCandidateIndex(
        xiaoheSchemeData as ShuangpinScheme,
        candidates as SyllableData,
      ),
      keyMappings: createKeyMappingsIndex(xiaoheSchemeData as ShuangpinScheme),
    },
  ],
]);

/**
 * 解析已登记的双拼方案。
 * @param schemeId 应用设置中的方案标识
 * @returns 对应的方案注册项
 */
const resolveScheme = (schemeId: string): RegisteredShuangpinScheme => {
  const registeredScheme = schemeRegistry.get(schemeId);
  if (!registeredScheme) {
    throw new Error(`Unknown shuangpin scheme "${schemeId}"`);
  }
  return registeredScheme;
};

/**
 * 列出可供设置窗口展示的内置双拼方案。
 * @returns 已登记方案的稳定标识和显示名称
 */
export const listShuangpinSchemes = (): ShuangpinSchemeSummary[] => {
  return [...schemeRegistry.values()].map(({ id, displayName }) => ({ id, displayName }));
};

/**
 * 取得指定方案的候选第二键索引。
 * @param schemeId 应用设置中的方案标识
 * @returns 物理首键到合法第二键集合的映射
 */
export const getCandidateIndex = (
  schemeId: string,
): ReadonlyMap<string, ReadonlySet<string>> => {
  return resolveScheme(schemeId).candidateIndex;
};

/**
 * 查询一个键的声母和韵母映射（结果来自模块级缓存，无运行时分配）。
 * @param key 要查询的英文字母键
 * @returns 包含声母和韵母的映射信息
 */
export const getKeyMappings = (key: string, schemeId: string): KeyMappings => {
  const normalizedKey = key.toLowerCase();
  return resolveScheme(schemeId).keyMappings.get(normalizedKey) ?? { key: normalizedKey };
};
