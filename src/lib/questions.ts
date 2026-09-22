import { parse } from "yaml";

export type QuestionSource = "general" | "general_hard" | "motorcycle" | "motorcycle_hard";

export type Question = {
  id: string;
  source: QuestionSource;
  number: number;
  question: string;
  choices: string[];
  answer: string;
  reference?: string;
  reason?: string;
};

type QuestionData = Omit<Question, "id" | "source" | "number">;

const SOURCES: readonly QuestionSource[] = ["general", "general_hard", "motorcycle", "motorcycle_hard"];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function validateItem(value: unknown, source: QuestionSource, index: number): QuestionData {
  const location = `${source}.yaml item ${index + 1}`;

  if (!isRecord(value)) {
    throw new Error(`${location} must be an object`);
  }

  if (typeof value.question !== "string" || value.question.trim() === "") {
    throw new Error(`${location} has an invalid question`);
  }

  if (
    !Array.isArray(value.choices) ||
    value.choices.length === 0 ||
    !value.choices.every((choice) => typeof choice === "string" && choice.trim() !== "")
  ) {
    throw new Error(`${location} has invalid choices`);
  }

  if (typeof value.answer !== "string" || !value.choices.includes(value.answer)) {
    throw new Error(`${location} answer must match one of its choices`);
  }

  if (value.reference !== undefined && typeof value.reference !== "string") {
    throw new Error(`${location} has an invalid reference`);
  }

  if (value.reason !== undefined && typeof value.reason !== "string") {
    throw new Error(`${location} has an invalid reason`);
  }

  return {
    question: value.question,
    choices: [...value.choices],
    answer: value.answer,
    ...(value.reference !== undefined ? { reference: value.reference } : {}),
    ...(value.reason !== undefined ? { reason: value.reason } : {}),
  };
}

function stableHash(value: string): string {
  let hash = 0x811c9dc5;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }

  return (hash >>> 0).toString(36);
}

async function loadSource(source: QuestionSource): Promise<Question[]> {
  const response = await fetch(`/${source}.yaml`);

  if (!response.ok) {
    throw new Error(`Failed to fetch ${source}.yaml (${response.status})`);
  }

  const parsed: unknown = parse(await response.text());
  if (!Array.isArray(parsed)) {
    throw new Error(`${source}.yaml must contain a list of questions`);
  }

  const duplicateCounts = new Map<string, number>();

  return parsed.map((item, index) => {
    const question = validateItem(item, source, index);
    const baseId = `${source}-${stableHash(`${source}\u0000${question.question}`)}`;
    const occurrence = (duplicateCounts.get(baseId) ?? 0) + 1;
    duplicateCounts.set(baseId, occurrence);

    return {
      id: occurrence === 1 ? baseId : `${baseId}-${occurrence}`,
      source,
      number: index + 1,
      ...question,
    };
  });
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export async function loadQuestions(): Promise<{
  questions: Question[];
  errors: Partial<Record<QuestionSource, string>>;
}> {
  const results = await Promise.all(
    SOURCES.map(async (source) => {
      try {
        return { source, questions: await loadSource(source) } as const;
      } catch (error) {
        return { source, error: errorMessage(error) } as const;
      }
    }),
  );

  const questions: Question[] = [];
  const errors: Partial<Record<QuestionSource, string>> = {};

  for (const result of results) {
    if (result.questions !== undefined) {
      questions.push(...result.questions);
    } else {
      errors[result.source] = result.error;
    }
  }

  return { questions, errors };
}
