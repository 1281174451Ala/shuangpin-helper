import { describe, expect, it } from "vitest";
import { getKeyMappings, xiaoheCandidateIndex } from "./shuangpin";

describe("getKeyMappings", () => {
  it("returns both initial and final mappings for a key", () => {
    expect(getKeyMappings("h")).toEqual({
      key: "h",
      initial: "h",
      finals: ["ang"],
    });
  });

  it("handles multiple finals in array", () => {
    expect(getKeyMappings("r")).toEqual({
      key: "r",
      initial: "r",
      finals: ["uan", "van"],
    });
  });

  it("returns single final mapping as array", () => {
    expect(getKeyMappings("q")).toEqual({
      key: "q",
      initial: "q",
      finals: ["iu"],
    });
  });
});

describe("xiaoheCandidateIndex", () => {
  it("contains a non-empty candidate set for every lowercase letter", () => {
    const letters = "abcdefghijklmnopqrstuvwxyz";

    expect([...letters].every((letter) => (xiaoheCandidateIndex.get(letter)?.size ?? 0) > 0)).toBe(true);
  });
});
