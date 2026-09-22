import { afterEach, describe, expect, it, vi } from "vitest";

import { loadQuestions } from "./questions";

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

function response(body: string, ok = true) {
  return {
    ok,
    status: ok ? 200 : 404,
    text: vi.fn().mockResolvedValue(body),
  };
}

describe("loadQuestions", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("fetches, parses, and orders both runtime sources", async () => {
    const fetchMock = vi.fn(async (input: string | URL | Request) =>
      response(String(input) === "/general.yaml" ? generalYaml : motorcycleYaml),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await loadQuestions();

    expect(result.errors).toEqual({});
    expect(result.questions).toHaveLength(2);
    expect(result.questions.map(({ source }) => source)).toEqual(["general", "motorcycle"]);
    expect(result.questions[0]).toMatchObject({
      number: 1,
      question: "Who goes first at an uncontrolled intersection?",
      answer: "The first vehicle to arrive",
    });
    expect(fetchMock).toHaveBeenCalledWith("/general.yaml");
    expect(fetchMock).toHaveBeenCalledWith("/motorcycle.yaml");
  });

  it("keeps a valid source and reports a failed source", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL | Request) =>
        String(input) === "/general.yaml" ? response("not found", false) : response(motorcycleYaml),
      ),
    );

    const result = await loadQuestions();

    expect(result.questions).toHaveLength(1);
    expect(result.questions[0].source).toBe("motorcycle");
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
      vi.fn(async (input: string | URL | Request) =>
        response(String(input) === "/general.yaml" ? malformedYaml : motorcycleYaml),
      ),
    );

    const result = await loadQuestions();

    expect(result.questions.map(({ source }) => source)).toEqual(["motorcycle"]);
    expect(result.errors.general).toContain("answer");
  });

  it("assigns deterministic source-prefixed IDs", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL | Request) =>
        response(String(input) === "/general.yaml" ? generalYaml : motorcycleYaml),
      ),
    );

    const first = await loadQuestions();
    const second = await loadQuestions();

    expect(first.questions.map(({ id }) => id)).toEqual(second.questions.map(({ id }) => id));
    expect(first.questions[0].id).toMatch(/^general-/);
    expect(first.questions[1].id).toMatch(/^motorcycle-/);
  });
});
