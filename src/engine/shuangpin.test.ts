import { describe, expect, it } from "vitest";
import {
  getCandidateIndex,
  getKeyMappings,
  listShuangpinSchemes,
} from "./shuangpin";

describe("scheme registry", () => {
  it("registers only Xiaohe Shuangpin for the first release", () => {
    expect(listShuangpinSchemes()).toEqual([
      { id: "xiaohe", displayName: "小鹤双拼" },
    ]);
  });
});

describe("getKeyMappings", () => {
  it("returns both initial and final mappings for a key", () => {
    expect(getKeyMappings("h", "xiaohe")).toEqual({
      key: "h",
      initial: "h",
      finals: ["ang"],
    });
  });

  it("handles multiple finals in array", () => {
    expect(getKeyMappings("r", "xiaohe")).toEqual({
      key: "r",
      initial: "r",
      finals: ["uan", "van"],
    });
  });

  it("returns single final mapping as array", () => {
    expect(getKeyMappings("q", "xiaohe")).toEqual({
      key: "q",
      initial: "q",
      finals: ["iu"],
    });
  });
});

describe("getCandidateIndex", () => {
  it("contains a non-empty candidate set for every lowercase letter", () => {
    const letters = "abcdefghijklmnopqrstuvwxyz";
    const candidateIndex = getCandidateIndex("xiaohe");

    expect([...letters].every((letter) => (candidateIndex.get(letter)?.size ?? 0) > 0)).toBe(true);
  });
});
