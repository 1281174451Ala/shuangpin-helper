import { describe, expect, it } from "vitest";
import { getKeyMappings } from "./shuangpin";

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

