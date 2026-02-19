"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "../lib/api";

interface QuestionForm {
  text: string;
  options: string[];
  correctIndex: number;
  timeLimitSecs: number;
  imageUrl: string;
}

const emptyQuestion = (): QuestionForm => ({
  text: "",
  options: ["", "", "", ""],
  correctIndex: 0,
  timeLimitSecs: 30,
  imageUrl: "",
});

export default function CreateQuizPage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [questions, setQuestions] = useState<QuestionForm[]>([emptyQuestion()]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const user =
    typeof window !== "undefined"
      ? JSON.parse(localStorage.getItem("trivia-user") || "null")
      : null;

  const updateQuestion = (idx: number, updates: Partial<QuestionForm>) => {
    setQuestions((prev) =>
      prev.map((q, i) => (i === idx ? { ...q, ...updates } : q))
    );
  };

  const updateOption = (qIdx: number, oIdx: number, value: string) => {
    setQuestions((prev) =>
      prev.map((q, i) => {
        if (i !== qIdx) return q;
        const newOpts = [...q.options];
        newOpts[oIdx] = value;
        return { ...q, options: newOpts };
      })
    );
  };

  const addQuestion = () => {
    setQuestions((prev) => [...prev, emptyQuestion()]);
  };

  const removeQuestion = (idx: number) => {
    if (questions.length <= 1) return;
    setQuestions((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      setError("Please login first");
      return;
    }

    for (let i = 0; i < questions.length; i++) {
      const q = questions[i]!;
      if (!q.text.trim()) {
        setError(`Question ${i + 1} is empty`);
        return;
      }
      const filledOptions = q.options.filter((o) => o.trim());
      if (filledOptions.length < 2) {
        setError(`Question ${i + 1} needs at least 2 options`);
        return;
      }
    }

    setLoading(true);
    setError("");

    try {
      const quiz = await api<{ id: string }>("/api/quiz", {
        method: "POST",
        body: JSON.stringify({
          title,
          hostId: user.id,
          questions: questions.map((q, i) => ({
            text: q.text,
            options: q.options.filter((o) => o.trim()),
            correctIndex: q.correctIndex,
            timeLimitSecs: q.timeLimitSecs,
            imageUrl: q.imageUrl || undefined,
            order: i,
          })),
        }),
      });

      const room = await api<{ code: string; id: string }>("/api/room", {
        method: "POST",
        body: JSON.stringify({ quizId: quiz.id, hostId: user.id }),
      });

      router.push(
        `/host/${quiz.id}?roomCode=${room.code}&roomId=${room.id}&userId=${user.id}&username=${user.username}`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create quiz");
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    router.push("/");
    return null;
  }

  return (
    <div className="page-wrapper">
      <div className="container" style={{ paddingTop: 32, paddingBottom: 60, maxWidth: 760 }}>

        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 16,
            marginBottom: 32,
          }}
        >
          <button
            className="btn btn-secondary"
            onClick={() => router.push("/")}
            style={{ padding: "6px 14px", fontSize: "0.7rem" }}
          >
            BACK
          </button>
          <div>
            <div className="hero-sub">Quiz Builder</div>
            <h1 style={{ fontSize: "1.6rem", fontWeight: 900, lineHeight: 1 }}>
              CREATE QUIZ
            </h1>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Title */}
          <div className="panel animate-fade-in" style={{ padding: 20, marginBottom: 16 }}>
            <label className="label">Quiz Title</label>
            <input
              className="input"
              type="text"
              placeholder="e.g., Science Trivia Night"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              style={{ fontSize: "1rem", fontWeight: 700 }}
            />
          </div>

          {/* Questions */}
          {questions.map((q, qIdx) => (
            <div
              key={qIdx}
              className="panel animate-slide-up"
              style={{ padding: 20, marginBottom: 12 }}
            >
              {/* Q header */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 16,
                }}
              >
                <div
                  style={{
                    fontSize: "0.65rem",
                    fontWeight: 700,
                    letterSpacing: "0.15em",
                    textTransform: "uppercase",
                    color: "var(--accent-blue)",
                  }}
                >
                  Question {qIdx + 1}
                </div>
                {questions.length > 1 && (
                  <button
                    type="button"
                    className="btn btn-danger"
                    style={{ padding: "4px 12px", fontSize: "0.7rem" }}
                    onClick={() => removeQuestion(qIdx)}
                  >
                    REMOVE
                  </button>
                )}
              </div>

              {/* Question text */}
              <div style={{ marginBottom: 14 }}>
                <label className="label">Question</label>
                <input
                  className="input"
                  type="text"
                  placeholder="Enter your question..."
                  value={q.text}
                  onChange={(e) => updateQuestion(qIdx, { text: e.target.value })}
                  required
                />
              </div>

              {/* Image URL */}
              <div style={{ marginBottom: 14 }}>
                <label className="label">Image URL (optional)</label>
                <input
                  className="input"
                  type="url"
                  placeholder="https://example.com/image.jpg"
                  value={q.imageUrl}
                  onChange={(e) => updateQuestion(qIdx, { imageUrl: e.target.value })}
                />
              </div>

              {/* Options */}
              <div style={{ marginBottom: 14 }}>
                <label className="label">
                  Answer Options — correct:{" "}
                  <span style={{ color: "var(--accent-green)", fontFamily: "monospace" }}>
                    {String.fromCharCode(65 + q.correctIndex)}
                  </span>
                </label>
                <div className="grid-2col" style={{ gap: 8 }}>
                  {q.options.map((opt, oIdx) => {
                    const isCorrect = q.correctIndex === oIdx;
                    return (
                      <div key={oIdx} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <button
                          type="button"
                          style={{
                            width: 30,
                            height: 30,
                            borderRadius: "var(--radius)",
                            border: "1px solid",
                            borderColor: isCorrect ? "var(--accent-green)" : "var(--border-accent)",
                            background: isCorrect
                              ? "rgba(0, 255, 136, 0.15)"
                              : "var(--card)",
                            color: isCorrect ? "var(--accent-green)" : "var(--muted-light)",
                            cursor: "pointer",
                            fontWeight: 900,
                            fontSize: "0.75rem",
                            fontFamily: "ui-monospace, monospace",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            flexShrink: 0,
                          }}
                          onClick={() => updateQuestion(qIdx, { correctIndex: oIdx })}
                          title="Mark as correct answer"
                        >
                          {String.fromCharCode(65 + oIdx)}
                        </button>
                        <input
                          className="input"
                          type="text"
                          placeholder={`Option ${String.fromCharCode(65 + oIdx)}`}
                          value={opt}
                          onChange={(e) => updateOption(qIdx, oIdx, e.target.value)}
                          style={{ padding: "8px 12px" }}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Time limit */}
              <div>
                <label className="label">
                  Time Limit:{" "}
                  <span
                    style={{
                      fontFamily: "ui-monospace, monospace",
                      color: "var(--accent-amber)",
                    }}
                  >
                    {q.timeLimitSecs}s
                  </span>
                </label>
                <input
                  type="range"
                  min="10"
                  max="60"
                  step="5"
                  value={q.timeLimitSecs}
                  onChange={(e) =>
                    updateQuestion(qIdx, { timeLimitSecs: Number(e.target.value) })
                  }
                  style={{ width: "100%", accentColor: "var(--accent-amber)" }}
                />
              </div>
            </div>
          ))}

          {/* Add Question */}
          <button
            type="button"
            className="btn btn-secondary"
            style={{ width: "100%", marginBottom: 20 }}
            onClick={addQuestion}
          >
            + ADD QUESTION
          </button>

          {/* Error */}
          {error && (
            <p
              style={{
                color: "var(--accent-red)",
                fontSize: "0.8rem",
                fontWeight: 700,
                letterSpacing: "0.05em",
                marginBottom: 14,
                textAlign: "center",
              }}
            >
              {error.toUpperCase()}
            </p>
          )}

          {/* Submit */}
          <button
            type="submit"
            className="btn btn-primary btn-lg"
            style={{ width: "100%" }}
            disabled={loading}
          >
            {loading ? "CREATING..." : "CREATE QUIZ & OPEN ROOM"}
          </button>
        </form>
      </div>
    </div>
  );
}
