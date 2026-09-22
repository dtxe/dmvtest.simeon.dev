import { describe, expect, it } from "vitest";

import { clearProgress, loadProgress, recordAttempt, saveProgress, type ProgressMap } from "./progress";

describe("progress", () => {
  it("starts empty and round-trips progress through versioned storage", () => {
    expect(loadProgress()).toEqual({});
    const progress: ProgressMap = {
      "general-id": {
        attempts: 1,
        firstAnswer: "Yes",
        firstTryCorrect: true,
        lastAnswer: "Yes",
        lastCorrect: true,
        needsReview: false,
      },
    };

    saveProgress(progress);

    expect(loadProgress()).toEqual(progress);
    expect(localStorage.key(0)).toContain("v1");
  });

  it("records first and latest answers while clearing a mastered review item", () => {
    const first = recordAttempt(undefined, "Wrong", false);
    const reviewed = recordAttempt(first, "Correct", true);

    expect(reviewed).toEqual({
      attempts: 2,
      firstAnswer: "Wrong",
      firstTryCorrect: false,
      lastAnswer: "Correct",
      lastCorrect: true,
      needsReview: false,
    });
  });

  it("preserves a correct first attempt after a later incorrect attempt", () => {
    const first = recordAttempt(undefined, "Correct", true);
    const second = recordAttempt(first, "Wrong", false);

    expect(second.firstTryCorrect).toBe(true);
    expect(second.firstAnswer).toBe("Correct");
    expect(second).toMatchObject({ attempts: 2, lastCorrect: false, needsReview: true });
  });

  it("ignores corrupt and invalid stored entries", () => {
    localStorage.setItem("dmvtest-progress-v1", "{not-json");
    expect(loadProgress()).toEqual({});

    localStorage.setItem("dmvtest-progress-v1", JSON.stringify({ bad: { attempts: 0 } }));
    expect(loadProgress()).toEqual({});
  });

  it("clears persisted progress", () => {
    saveProgress({
      q: {
        attempts: 1,
        firstAnswer: "A",
        firstTryCorrect: false,
        lastAnswer: "A",
        lastCorrect: false,
        needsReview: true,
      },
    });

    clearProgress();

    expect(loadProgress()).toEqual({});
    expect(localStorage.length).toBe(0);
  });
});
