import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * 从小鹤方案映射生成待审定的声母类别与韵母笛卡尔积。
 * @param {unknown} scheme 已解析的方案配置。
 * @returns {Record<string, string[]>} 按声母类别分组的候选韵母集合。
 */
function createSyllableCandidates(scheme) {
  if (
    !scheme ||
    typeof scheme !== "object" ||
    !scheme.initials ||
    typeof scheme.initials !== "object" ||
    !scheme.finals ||
    typeof scheme.finals !== "object"
  ) {
    throw new Error("方案配置必须包含 initials 和 finals 对象。");
  }

  const initialCategories = [...new Set(Object.values(scheme.initials))].sort();
  const finalValues = [...new Set(Object.values(scheme.finals).flat())].sort();

  if (
    initialCategories.length === 0 ||
    finalValues.length === 0 ||
    !initialCategories.every(
      (value) => typeof value === "string" && value.length > 0,
    ) ||
    !finalValues.every(
      (value) => typeof value === "string" && value.length > 0,
    )
  ) {
    throw new Error("initials 和 finals 必须只包含非空字符串映射。");
  }

  return Object.fromEntries(
    initialCategories.map((initial) => [initial, finalValues]),
  );
}

/**
 * 生成待人工审定的音节候选文件。
 */
function main() {
  const sourcePath = resolve("config/shuangpin.json");
  const targetPath = resolve("config/syllables-candidates.json");
  const scheme = JSON.parse(readFileSync(sourcePath, "utf8"));
  const syllables = createSyllableCandidates(scheme);
  const initialCount = Object.keys(syllables).length;
  const finalCount = syllables[Object.keys(syllables)[0]].length;
  const candidateData = {
    formatVersion: 1,
    scheme: scheme.name,
    schemeVersion: scheme.version,
    status: "unreviewed-candidates",
    generatedFrom: "config/shuangpin.json",
    zeroInitials: ["a", "e", "o", "y", "w"],
    syllables,
  };

  writeFileSync(targetPath, `${JSON.stringify(candidateData, null, 2)}\n`);
  console.log(`已生成 ${initialCount * finalCount} 个待审定候选组合：${targetPath}`);
}

main();
