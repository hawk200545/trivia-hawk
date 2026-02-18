"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { api } from "../../lib/api";

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
      <div className="page-wrapper" style={{ justifyContent: "center", alignItems: "center" }}>
        <p style={{ color: "var(--muted-light)" }}>Loading scores...</p>
      </div>
    );
  }

  const top3 = scores.slice(0, 3);

  return (
    <div className="page-wrapper">
      <div className="container" style={{ paddingTop: 40, paddingBottom: 60, maxWidth: 600, textAlign: "center" }}>
        <button
          className="btn btn-secondary"
          onClick={() => router.push("/")}
          style={{ position: "absolute", top: 20, left: 20 }}
        >
          ← Home
        </button>

        <h1 className="hero-title animate-scale-in" style={{ fontSize: "2rem", marginBottom: 32 }}>
          🏆 Final Scores
        </h1>

        {/* Podium */}
        {top3.length > 0 && (
          <div className="podium animate-slide-up">
            {top3[1] && (
              <div className="podium-place podium-2nd">
                <div className="podium-name">{top3[1].user.username}</div>
                <div className="podium-bar">🥈</div>
                <div className="podium-points">{top3[1].points} pts</div>
              </div>
            )}
            {top3[0] && (
              <div className="podium-place podium-1st">
                <div className="podium-name">{top3[0].user.username}</div>
                <div className="podium-bar">🥇</div>
                <div className="podium-points">{top3[0].points} pts</div>
              </div>
            )}
            {top3[2] && (
              <div className="podium-place podium-3rd">
                <div className="podium-name">{top3[2].user.username}</div>
                <div className="podium-bar">🥉</div>
                <div className="podium-points">{top3[2].points} pts</div>
              </div>
            )}
          </div>
        )}

        {/* Full List */}
        <div className="glass-card animate-slide-up delay-200" style={{ padding: 24, marginTop: 32 }}>
          {scores.length === 0 ? (
            <p style={{ color: "var(--muted)" }}>No scores recorded yet.</p>
          ) : (
            scores.map((s, i) => (
              <div
                key={s.id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "12px 16px",
                  borderBottom: i < scores.length - 1 ? "1px solid var(--border)" : "none",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <span style={{ fontWeight: 700, color: i < 3 ? "var(--accent-orange)" : "var(--muted)", width: 24 }}>
                    {i + 1}
                  </span>
                  <div>
                    <span style={{ fontWeight: 500 }}>{s.user.username}</span>
                    <span style={{ color: "var(--muted)", fontSize: "0.8rem", marginLeft: 8 }}>
                      {(s.answers || []).filter((a) => a.correct).length}/{(s.answers || []).length} correct
                    </span>
                  </div>
                </div>
                <span style={{ fontWeight: 700, color: "var(--accent-cyan)", fontSize: "1.1rem" }}>
                  {s.points}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
