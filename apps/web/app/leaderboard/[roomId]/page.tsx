"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { api } from "../../lib/api";
import { Podium } from "../../components/Podium";

interface ScoreEntry {
  id: string;
  points: number;
  user: { id: string; username: string };
  answers: Array<{
    questionId: string;
    answerIndex: number;
    correct: boolean;
    timeMs: number;
  }>;
}

export default function LeaderboardPage({
  params,
}: {
  params: Promise<{ roomId: string }>;
}) {
  const { roomId } = use(params);
  const router = useRouter();
  const [scores, setScores] = useState<ScoreEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api<ScoreEntry[]>(`/api/scores/${roomId}`)
      .then(setScores)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [roomId]);

  if (loading) {
    return (
      <div className="page-wrapper">
        <div className="container" style={{ paddingTop: 40, paddingBottom: 60, maxWidth: 560, textAlign: "center" }}>
          <div className="back-btn-wrap" style={{ textAlign: "left" }}>
            <button
              className="btn btn-secondary"
              onClick={() => router.push("/")}
              style={{ fontSize: "0.7rem", padding: "6px 14px" }}
            >
              HOME
            </button>
          </div>
          <div className="hero-sub animate-fade-in" style={{ marginBottom: 6 }}>Final Scores</div>
          <h1 className="hero-title animate-scale-in" style={{ fontSize: "2.2rem", marginBottom: 32 }}>
            LEADERBOARD
          </h1>
          <div className="panel" style={{ padding: 0, overflow: "hidden" }}>
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="lb-row" style={{ gap: 12 }}>
                <div className="skeleton" style={{ width: 24, height: 16 }} />
                <div className="skeleton" style={{ width: 120, height: 16 }} />
                <div className="skeleton" style={{ width: 48, height: 16, marginLeft: "auto" }} />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const podiumScores = scores.map((s) => ({
    username: s.user.username,
    points: s.points,
  }));

  return (
    <div className="page-wrapper">
      <div
        className="container"
        style={{ paddingTop: 40, paddingBottom: 60, maxWidth: 560, textAlign: "center" }}
      >
        <div className="back-btn-wrap" style={{ textAlign: "left" }}>
          <button
            className="btn btn-secondary"
            onClick={() => router.push("/")}
            style={{ fontSize: "0.7rem", padding: "6px 14px" }}
          >
            HOME
          </button>
        </div>

        <div className="hero-sub animate-fade-in" style={{ marginBottom: 6 }}>
          Final Scores
        </div>
        <h1
          className="hero-title animate-scale-in"
          style={{ fontSize: "2.2rem", marginBottom: 32 }}
        >
          LEADERBOARD
        </h1>

        {/* Podium */}
        {scores.length > 0 && (
          <Podium scores={podiumScores} />
        )}

        {/* Full List */}
        <div
          className="panel animate-slide-up delay-200"
          style={{ padding: 0, marginTop: 28, overflow: "hidden" }}
        >
          {scores.length === 0 ? (
            <p
              style={{
                color: "var(--muted)",
                padding: 20,
                fontSize: "0.85rem",
                letterSpacing: "0.05em",
              }}
            >
              NO SCORES RECORDED YET.
            </p>
          ) : (
            scores.map((s, i) => (
              <div key={s.id} className="lb-row">
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <span className={`lb-rank ${i < 3 ? "top3" : ""}`}>{i + 1}</span>
                  <div>
                    <span style={{ fontWeight: 500, fontSize: "0.9rem" }}>
                      {s.user.username}
                    </span>
                    <span
                      style={{
                        color: "var(--muted)",
                        fontSize: "0.75rem",
                        marginLeft: 8,
                        fontFamily: "ui-monospace, monospace",
                      }}
                    >
                      {(s.answers || []).filter((a) => a.correct).length}/
                      {(s.answers || []).length}
                    </span>
                  </div>
                </div>
                <span className="lb-pts">{s.points}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
