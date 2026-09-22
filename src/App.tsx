import { useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, Check, ChevronLeft, ChevronRight, RotateCcw, Shuffle, X } from "lucide-react";
import { Badge } from "./components/ui/badge";
import { Button } from "./components/ui/button";
import { Card, CardContent, CardHeader } from "./components/ui/card";
import { Progress } from "./components/ui/progress";
import { loadQuestions, type Question, type QuestionSource } from "./lib/questions";
import {
  clearProgress,
  loadProgress,
  recordAttempt,
  saveProgress,
  type ProgressMap,
} from "./lib/progress";

type PracticeMode = "all" | QuestionSource | "review";

const modes: Array<{ value: PracticeMode; label: string }> = [
  { value: "all", label: "All questions" },
  { value: "general", label: "General" },
  { value: "general_hard", label: "Advanced General" },
  { value: "motorcycle", label: "Motorcycle" },
  { value: "motorcycle_hard", label: "Advanced Motorcycle" },
  { value: "review", label: "Needs review" },
];

function sourceLabel(source: QuestionSource) {
  return modes.find((mode) => mode.value === source)?.label ?? source;
}

function App() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [errors, setErrors] = useState<Partial<Record<QuestionSource, string>>>({});
  const [progress, setProgress] = useState<ProgressMap>(() => loadProgress());
  const [mode, setMode] = useState<PracticeMode>("all");
  const [questionIndex, setQuestionIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [submittedQuestion, setSubmittedQuestion] = useState<Question | null>(null);
  const [shuffle, setShuffle] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadFailure, setLoadFailure] = useState("");
  const resetDialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    let active = true;
    loadQuestions()
      .then((result) => {
        if (!active) return;
        setQuestions(result.questions);
        setErrors(result.errors);
      })
      .catch((error: unknown) => {
        if (active) setLoadFailure(error instanceof Error ? error.message : "Questions could not be loaded.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const visibleQuestions = useMemo(() => {
    if (mode === "review") return questions.filter((question) => progress[question.id]?.needsReview);
    if (mode === "all") return questions;
    return questions.filter((question) => question.source === mode);
  }, [mode, progress, questions]);

  const currentQuestion = submittedQuestion ?? visibleQuestions[questionIndex];
  const displayedQuestionCount = Math.max(visibleQuestions.length, questionIndex + 1);
  const attempted = questions.filter((question) => progress[question.id]?.attempts > 0).length;
  const firstTryCorrect = questions.filter((question) => progress[question.id]?.firstTryCorrect).length;
  const needsReview = questions.filter((question) => progress[question.id]?.needsReview).length;
  const completion = questions.length ? (attempted / questions.length) * 100 : 0;

  function changeMode(nextMode: PracticeMode) {
    setMode(nextMode);
    setQuestionIndex(0);
    setSelectedAnswer("");
    setSubmitted(false);
    setSubmittedQuestion(null);
  }

  function goToQuestion(nextIndex: number) {
    setQuestionIndex(nextIndex);
    setSelectedAnswer("");
    setSubmitted(false);
    setSubmittedQuestion(null);
  }

  function goToNextQuestion() {
    if (shuffle && visibleQuestions.length > 0) {
      const currentVisibleIndex = visibleQuestions.findIndex((question) => question.id === currentQuestion?.id);
      const candidateCount = visibleQuestions.length - (currentVisibleIndex >= 0 ? 1 : 0);
      if (candidateCount > 0) {
        const randomCandidate = Math.floor(Math.random() * candidateCount);
        const nextIndex = currentVisibleIndex >= 0 && randomCandidate >= currentVisibleIndex
          ? randomCandidate + 1
          : randomCandidate;
        goToQuestion(nextIndex);
        return;
      }
    }
    if (mode === "review") {
      const nextIndex = isCorrect
        ? Math.min(questionIndex, Math.max(visibleQuestions.length - 1, 0))
        : (questionIndex + 1) % visibleQuestions.length;
      goToQuestion(nextIndex);
      return;
    }
    goToQuestion(questionIndex + 1);
  }

  function submitAnswer() {
    if (!currentQuestion || !selectedAnswer || submitted) return;
    const correct = selectedAnswer === currentQuestion.answer;
    const nextProgress = {
      ...progress,
      [currentQuestion.id]: recordAttempt(progress[currentQuestion.id], selectedAnswer, correct),
    };
    setProgress(nextProgress);
    saveProgress(nextProgress);
    setSubmittedQuestion(currentQuestion);
    setSubmitted(true);
  }

  function resetAllProgress() {
    clearProgress();
    setProgress({});
    setQuestionIndex(0);
    setSelectedAnswer("");
    setSubmitted(false);
    setSubmittedQuestion(null);
    resetDialog.current?.close();
  }

  const isCorrect = submitted && selectedAnswer === currentQuestion?.answer;
  const canGoNext = mode === "review" || (shuffle ? visibleQuestions.length > 1 : questionIndex < visibleQuestions.length - 1);
  const sourceErrors = Object.entries(errors) as Array<[QuestionSource, string]>;

  useEffect(() => {
    function handleKeyboardShortcut(event: KeyboardEvent) {
      if (event.repeat || event.altKey || event.ctrlKey || event.metaKey || resetDialog.current?.open) return;

      const target = event.target;
      if (
        target instanceof HTMLElement &&
        target.closest("a, button, select, textarea, [contenteditable='true']")
      ) return;

      const choiceIndex = ["a", "b", "c"].indexOf(event.key.toLowerCase());
      if (!submitted && currentQuestion && choiceIndex >= 0 && currentQuestion.choices[choiceIndex]) {
        event.preventDefault();
        setSelectedAnswer(currentQuestion.choices[choiceIndex]);
        return;
      }

      if (event.key === "Enter") {
        if (!submitted && selectedAnswer) {
          event.preventDefault();
          submitAnswer();
        } else if (submitted && canGoNext) {
          event.preventDefault();
          goToNextQuestion();
        }
      }
    }

    window.addEventListener("keydown", handleKeyboardShortcut);
    return () => window.removeEventListener("keydown", handleKeyboardShortcut);
  });

  return (
    <div className="app-shell">
      <header className="site-header">
        <div className="header-inner">
          <a className="brand" href="#top" aria-label="California DMV Practice home">
            <span aria-hidden="true" className="brand-mark">CA</span>
            <span>
              <strong>DMV Practice</strong>
              <small>California knowledge test</small>
            </span>
          </a>
          <Button variant="outline" size="sm" onClick={() => resetDialog.current?.showModal()}>
            <RotateCcw aria-hidden="true" size={15} /> Reset progress
          </Button>
        </div>
      </header>

      <main id="top" className="page-grid">
        <aside className="sidebar" aria-label="Practice controls">
          <section aria-labelledby="practice-heading">
            <p className="eyebrow">Practice</p>
            <h1 id="practice-heading">Choose a test</h1>
            <div className="mode-list" role="group" aria-label="Question set">
              {modes.map((item) => {
                const count = item.value === "all"
                  ? questions.length
                  : item.value === "review"
                    ? needsReview
                    : questions.filter((question) => question.source === item.value).length;
                return (
                  <button
                    aria-pressed={mode === item.value}
                    className="mode-button"
                    key={item.value}
                    onClick={() => changeMode(item.value)}
                    type="button"
                  >
                    <span>{item.label}</span><span>{count}</span>
                  </button>
                );
              })}
            </div>
            <button
              aria-pressed={shuffle}
              className="shuffle-toggle"
              onClick={() => setShuffle((enabled) => !enabled)}
              type="button"
            >
              <Shuffle aria-hidden="true" size={15} />
              <span>Random next question</span>
              <span className="toggle-state">{shuffle ? "On" : "Off"}</span>
            </button>
          </section>

          <section className="sidebar-stats" aria-labelledby="progress-heading">
            <div className="section-row">
              <h2 id="progress-heading">Your progress</h2>
              <span>{Math.round(completion)}%</span>
            </div>
            <Progress value={completion} label={`${Math.round(completion)} percent attempted`} />
            <dl className="compact-stats">
              <div><dt>Attempted</dt><dd>{attempted}</dd></div>
              <div><dt>First-try correct</dt><dd>{firstTryCorrect}</dd></div>
              <div><dt>Needs review</dt><dd>{needsReview}</dd></div>
            </dl>
          </section>
        </aside>

        <div className="content-column">
          {sourceErrors.map(([source, message]) => (
            <div className="notice" key={source} role="status">
              <AlertCircle aria-hidden="true" size={17} />
              <span><strong>{sourceLabel(source)} questions unavailable.</strong> {message}</span>
            </div>
          ))}

          {loading ? (
            <Card><CardContent className="empty-state" aria-live="polite">Loading questions...</CardContent></Card>
          ) : loadFailure ? (
            <Card><CardContent className="empty-state"><h2>Questions could not be loaded</h2><p>{loadFailure}</p></CardContent></Card>
          ) : currentQuestion ? (
            <Card className="question-card">
              <CardHeader>
                <div className="question-meta">
                  <Badge>{sourceLabel(currentQuestion.source)}</Badge>
                  <span>Question {questionIndex + 1} of {displayedQuestionCount}</span>
                </div>
                <Progress
                  value={((questionIndex + 1) / displayedQuestionCount) * 100}
                  label={`Question ${questionIndex + 1} of ${displayedQuestionCount}`}
                />
              </CardHeader>
              <CardContent>
                <form onSubmit={(event) => { event.preventDefault(); submitAnswer(); }}>
                  <fieldset className="question-fieldset">
                    <legend>{currentQuestion.question}</legend>
                    <div className="answer-list">
                      {currentQuestion.choices.map((choice, index) => {
                        const answerCorrect = submitted && choice === currentQuestion.answer;
                        const answerWrong = submitted && choice === selectedAnswer && !answerCorrect;
                        return (
                          <label className={`answer ${answerCorrect ? "answer-correct" : ""} ${answerWrong ? "answer-wrong" : ""}`} key={choice}>
                            <input
                              checked={selectedAnswer === choice}
                              disabled={submitted}
                              name="answer"
                              onChange={() => setSelectedAnswer(choice)}
                              type="radio"
                              value={choice}
                            />
                            <span className="answer-letter" aria-hidden="true">{String.fromCharCode(65 + index)}</span>
                            <span>{choice}</span>
                            {answerCorrect && <Check className="answer-icon" aria-label="Correct answer" size={19} />}
                            {answerWrong && <X className="answer-icon" aria-label="Your answer is incorrect" size={19} />}
                          </label>
                        );
                      })}
                    </div>
                    <p className="keyboard-hint">
                      <span><kbd>A</kbd> <kbd>B</kbd> <kbd>C</kbd> choose an answer</span>
                      <span><kbd>Enter</kbd> {submitted ? "next question" : "check answer"}</span>
                    </p>
                  </fieldset>

                  {submitted && (
                    <div className={`feedback ${isCorrect ? "feedback-correct" : "feedback-wrong"}`} aria-live="polite">
                      <div className="feedback-title">
                        {isCorrect ? <Check aria-hidden="true" size={19} /> : <X aria-hidden="true" size={19} />}
                        <strong>{isCorrect ? "Correct" : "Not quite"}</strong>
                      </div>
                      {!isCorrect && <p>The correct answer is <strong>{currentQuestion.answer}</strong>.</p>}
                      {currentQuestion.reason && <p>{currentQuestion.reason}</p>}
                      {currentQuestion.reference && <p className="reference">Source: {currentQuestion.reference}</p>}
                    </div>
                  )}

                  <div className="question-actions">
                    <Button
                      aria-label="Previous question"
                      disabled={questionIndex === 0}
                      onClick={() => goToQuestion(questionIndex - 1)}
                      type="button"
                      variant="outline"
                    >
                      <ChevronLeft aria-hidden="true" size={17} /> Previous
                    </Button>
                    {!submitted ? (
                      <Button disabled={!selectedAnswer} type="submit">Check answer</Button>
                    ) : (
                      <Button
                        disabled={!canGoNext}
                        onClick={goToNextQuestion}
                        type="button"
                      >
                        Next <ChevronRight aria-hidden="true" size={17} />
                      </Button>
                    )}
                  </div>
                </form>
              </CardContent>
            </Card>
          ) : (
            <Card><CardContent className="empty-state">
              <h2>{mode === "review" ? "Nothing to review" : "No questions available"}</h2>
              <p>{mode === "review" ? "Questions you miss will appear here for another attempt." : "Choose another question set or check the data source."}</p>
              {mode === "review" && <Button onClick={() => changeMode("all")}>Practice all questions</Button>}
            </CardContent></Card>
          )}

          <section className="overview" aria-labelledby="overview-heading">
            <div className="overview-heading">
              <div>
                <p className="eyebrow">Overview</p>
                <h2 id="overview-heading">Question status</h2>
              </div>
              <span>{visibleQuestions.length} questions</span>
            </div>
            <div className="status-panel">
              <div className="status-legend" aria-label="Question status legend">
                <span><i className="legend-unanswered" /> Unanswered</span>
                <span><i className="legend-correct" /> First try correct</span>
                <span><i className="legend-incorrect" /> Missed first try</span>
              </div>
              {visibleQuestions.length > 0 ? (
                <div className="status-grid" aria-label="Question overview">
                  {visibleQuestions.map((question, index) => {
                    const itemProgress = progress[question.id];
                    const status = !itemProgress
                      ? "unanswered"
                      : itemProgress.firstTryCorrect
                        ? "correct"
                        : "incorrect";
                    return (
                      <button
                        aria-label={`Question ${index + 1}: ${question.question}. ${status === "unanswered" ? "Unanswered" : status === "correct" ? "Correct on first try" : "Missed on first try"}`}
                        aria-current={currentQuestion?.id === question.id ? "true" : undefined}
                        className={`status-cell status-cell-${status}`}
                        key={question.id}
                        onClick={() => goToQuestion(index)}
                        title={`Question ${index + 1}: ${question.question}`}
                        type="button"
                      >
                        {index + 1}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <p className="status-empty">No questions in this set.</p>
              )}
            </div>
          </section>
        </div>
      </main>

      <dialog className="reset-dialog" ref={resetDialog} onClick={(event) => {
        if (event.target === resetDialog.current) resetDialog.current.close();
      }}>
        <form method="dialog">
          <h2>Reset all progress?</h2>
          <p>This removes your saved answers and review list from this device. It cannot be undone.</p>
          <div className="dialog-actions">
            <Button value="cancel" variant="outline">Cancel</Button>
            <Button onClick={(event) => { event.preventDefault(); resetAllProgress(); }} variant="destructive">Reset progress</Button>
          </div>
        </form>
      </dialog>
    </div>
  );
}

export default App;
