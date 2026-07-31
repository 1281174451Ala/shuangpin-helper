import { describe, expect, it } from "vitest";
import { createCandidateIndex, type ShuangpinScheme, type SyllableData } from "./shuangpin";

describe("createCandidateIndex", () => {
  it("derives all candidate keys for a valid first key", () => {
    const scheme: ShuangpinScheme = {
      name: "test-scheme",
      initials: { d: "d" },
      finals: {
        e: ["e"],
        h: ["ang"],
      },
    };
    const syllableData: SyllableData = {
      zeroInitials: [],
      syllables: { d: ["e", "ang"] },
    };

    expect([...(createCandidateIndex(scheme, syllableData).get("d") ?? [])].sort()).toEqual(["e", "h"]);
  });

  it("rejects a final mapped to more than one physical key", () => {
    const scheme: ShuangpinScheme = {
      name: "test-scheme",
      initials: { d: "d" },
      finals: {
        e: ["e"],
        r: ["e"],
      },
    };
    const syllableData: SyllableData = {
      zeroInitials: [],
      syllables: { d: ["e"] },
    };

    expect(() => createCandidateIndex(scheme, syllableData)).toThrow('Final "e" maps to multiple keys');
  });

  it("rejects a legal syllable final without a physical key mapping", () => {
    const scheme: ShuangpinScheme = {
      name: "test-scheme",
      initials: { d: "d" },
      finals: { e: ["e"] },
    };
    const syllableData: SyllableData = {
      zeroInitials: [],
      syllables: { d: ["ang"] },
    };

    expect(() => createCandidateIndex(scheme, syllableData)).toThrow('Final "ang" has no key mapping');
  });

  it("rejects a zero-initial category missing from the syllable data", () => {
    const scheme: ShuangpinScheme = {
      name: "test-scheme",
      initials: { d: "d" },
      finals: { e: ["e"] },
    };
    const syllableData: SyllableData = {
      zeroInitials: ["a"],
      syllables: { d: ["e"] },
    };

    expect(() => createCandidateIndex(scheme, syllableData)).toThrow('Zero initial "a" is missing syllable data');
  });

  it("rejects an initial category missing from the syllable data", () => {
    const scheme: ShuangpinScheme = {
      name: "test-scheme",
      initials: { d: "d" },
      finals: { e: ["e"] },
    };
    const syllableData: SyllableData = {
      zeroInitials: [],
      syllables: {},
    };

    expect(() => createCandidateIndex(scheme, syllableData)).toThrow('Initial "d" is missing syllable data');
  });
});
