import { afterEach, describe, expect, it, vi } from "vitest";

import { loadQuestions, shuffleQuestionChoices, type Question } from "./questions";

describe("shuffleQuestionChoices", () => {
  it("shuffles a copy without changing the correct answer or the source choices", () => {
    const question: Question = {
      id: "general-1", source: "general", number: 1, question: "Example?",
      choices: ["Correct", "Second", "Third"], answer: "Correct",
    };
    vi.spyOn(Math, "random").mockReturnValue(0);
    try {
      const displayed = shuffleQuestionChoices(question);
      expect(displayed.choices).toEqual(["Second", "Third", "Correct"]);
      expect(displayed.answer).toBe("Correct");
      expect(question.choices).toEqual(["Correct", "Second", "Third"]);
      expect(displayed.choices).not.toBe(question.choices);
    } finally {
      vi.restoreAllMocks();
    }
  });
});

const generalYaml = `
- question: Who goes first at an uncontrolled intersection?
  choices:
    - The first vehicle to arrive
    - The largest vehicle
  answer: The first vehicle to arrive
  reference: California Driver's Handbook, Intersections
  reason: The first vehicle to arrive should proceed first.
`;

const motorcycleYaml = `
- question: What should a rider wear?
  choices:
    - An approved helmet
    - A baseball cap
  answer: An approved helmet
  reference: California Motorcycle Handbook, Preparing to Ride
  reason: An approved helmet reduces the risk of head injury.
`;

const generalHardYaml = `
- question: How far may a driver travel in a center left-turn lane?
  choices:
    - No more than 200 feet
    - No more than 100 feet
  answer: No more than 200 feet
`;

const motorcycleHardYaml = `
- question: What should a rider do if the front wheel locks during a hard stop?
  choices:
    - Release and reapply the front brake
    - Keep the front wheel locked
  answer: Release and reapply the front brake
`;

const sourceYaml: Record<string, string> = {
  "/general.yaml": generalYaml,
  "/general_hard.yaml": generalHardYaml,
  "/motorcycle.yaml": motorcycleYaml,
  "/motorcycle_hard.yaml": motorcycleHardYaml,
};

function response(body: string, ok = true) {
  return {
    ok,
    status: ok ? 200 : 404,
    text: vi.fn().mockResolvedValue(body),
  };
}

describe("loadQuestions", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("fetches, parses, and orders all runtime sources", async () => {
    const fetchMock = vi.fn(async (input: string | URL | Request) => response(sourceYaml[String(input)]));
    vi.stubGlobal("fetch", fetchMock);

    const result = await loadQuestions();

    expect(result.errors).toEqual({});
    expect(result.questions).toHaveLength(4);
    expect(result.questions.map(({ source }) => source)).toEqual([
      "general",
      "general_hard",
      "motorcycle",
      "motorcycle_hard",
    ]);
    expect(result.questions[0]).toMatchObject({
      number: 1,
      question: "Who goes first at an uncontrolled intersection?",
      answer: "The first vehicle to arrive",
    });
    expect(fetchMock).toHaveBeenCalledWith("/general.yaml");
    expect(fetchMock).toHaveBeenCalledWith("/general_hard.yaml");
    expect(fetchMock).toHaveBeenCalledWith("/motorcycle.yaml");
    expect(fetchMock).toHaveBeenCalledWith("/motorcycle_hard.yaml");
  });

  it("keeps a valid source and reports a failed source", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL | Request) => {
        const path = String(input);
        return path === "/general.yaml" ? response("not found", false) : response(sourceYaml[path]);
      }),
    );

    const result = await loadQuestions();

    expect(result.questions).toHaveLength(3);
    expect(result.questions.map(({ source }) => source)).toEqual([
      "general_hard",
      "motorcycle",
      "motorcycle_hard",
    ]);
    expect(result.errors.general).toContain("404");
  });

  it("rejects a malformed source without discarding the valid source", async () => {
    const malformedYaml = `
- question: Missing its required answer
  choices:
    - One
    - Two
`;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL | Request) => {
        const path = String(input);
        return response(path === "/general.yaml" ? malformedYaml : sourceYaml[path]);
      }),
    );

    const result = await loadQuestions();

    expect(result.questions.map(({ source }) => source)).toEqual([
      "general_hard",
      "motorcycle",
      "motorcycle_hard",
    ]);
    expect(result.errors.general).toContain("answer");
  });

  it("assigns deterministic source-prefixed IDs", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL | Request) => response(sourceYaml[String(input)])),
    );

    const first = await loadQuestions();
    const second = await loadQuestions();

    expect(first.questions.map(({ id }) => id)).toEqual(second.questions.map(({ id }) => id));
    expect(first.questions[0].id).toMatch(/^general-/);
    expect(first.questions[1].id).toMatch(/^general_hard-/);
    expect(first.questions[2].id).toMatch(/^motorcycle-/);
    expect(first.questions[3].id).toMatch(/^motorcycle_hard-/);
  });
});
