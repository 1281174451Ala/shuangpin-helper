import { describe, expect, it } from "vitest";
import { getShuangpinKey } from "./shuangpin";

describe("getShuangpinKey", () => {
  it("returns the Xiaohe final mapped to a keyboard key", () => {
    expect(getShuangpinKey("h")).toEqual({ key: "h", value: "ang", type: "final" });
  });

  it("returns undefined for an unmapped key", () => {
    expect(getShuangpinKey("q")).toBeUndefined();
  });
});

