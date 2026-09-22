export type QuestionProgress = {
  attempts: number;
  firstAnswer: string;
  firstTryCorrect: boolean;
  lastAnswer: string;
  lastCorrect: boolean;
  needsReview: boolean;
};

export type ProgressMap = Record<string, QuestionProgress>;

const STORAGE_KEY = "dmvtest-progress-v1";

function isQuestionProgress(value: unknown): value is QuestionProgress {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }

  const progress = value as Record<string, unknown>;
  return (
    Number.isInteger(progress.attempts) &&
    (progress.attempts as number) >= 1 &&
    typeof progress.firstAnswer === "string" &&
    typeof progress.firstTryCorrect === "boolean" &&
    typeof progress.lastAnswer === "string" &&
    typeof progress.lastCorrect === "boolean" &&
    typeof progress.needsReview === "boolean"
  );
}

function storage(): Storage | undefined {
  try {
    return typeof localStorage === "undefined" ? undefined : localStorage;
  } catch {
    return undefined;
  }
}

export function loadProgress(): ProgressMap {
  try {
    const serialized = storage()?.getItem(STORAGE_KEY);
    if (serialized === undefined || serialized === null) {
      return {};
    }

    const parsed: unknown = JSON.parse(serialized);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      return {};
    }

    const progress: ProgressMap = {};
    for (const [questionId, value] of Object.entries(parsed)) {
      if (questionId !== "__proto__" && isQuestionProgress(value)) {
        progress[questionId] = { ...value };
      }
    }

    return progress;
  } catch {
    return {};
  }
}

export function saveProgress(progress: ProgressMap): void {
  try {
    storage()?.setItem(STORAGE_KEY, JSON.stringify(progress));
  } catch {
    // Storage may be unavailable or full; progress remains usable in memory.
  }
}

export function recordAttempt(
  existing: QuestionProgress | undefined,
  selectedAnswer: string,
  correct: boolean,
): QuestionProgress {
  if (existing === undefined) {
    return {
      attempts: 1,
      firstAnswer: selectedAnswer,
      firstTryCorrect: correct,
      lastAnswer: selectedAnswer,
      lastCorrect: correct,
      needsReview: !correct,
    };
  }

  return {
    ...existing,
    attempts: existing.attempts + 1,
    lastAnswer: selectedAnswer,
    lastCorrect: correct,
    needsReview: !correct,
  };
}

export function clearProgress(): void {
  try {
    storage()?.removeItem(STORAGE_KEY);
  } catch {
    // Clearing progress should be safe when storage is unavailable.
  }
}
