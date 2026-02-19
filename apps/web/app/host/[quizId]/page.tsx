"use client";

import { useEffect, useState, use } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Image from "next/image";
import { useWebSocket } from "../../hooks/useWebSocket";
import type {
  RoomStatePayload,
  QuestionStartPayload,
  QuestionEndPayload,
  LeaderboardPayload,
  GameOverPayload,
  Player,
  LeaderboardEntry,
} from "@repo/shared";

export default function HostPage({ params }: { params: Promise<{ quizId: string }> }) {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { quizId: _quizId } = use(params);
  const searchParams = useSearchParams();
  const router = useRouter();
  const roomCode = searchParams.get("roomCode") || "";
  const roomId = searchParams.get("roomId") || "";
  const userId = searchParams.get("userId") || "";
  const username = searchParams.get("username") || "";

  const { connect, sendMessage, on, connected } = useWebSocket();

  const [players, setPlayers] = useState<Player[]>([]);
  const [hostId, setHostId] = useState("");
  const [, setStatus] = useState<"LOBBY" | "ACTIVE" | "FINISHED">("LOBBY");
  const [currentQuestion, setCurrentQuestion] = useState<QuestionStartPayload | null>(null);
  const [questionResult, setQuestionResult] = useState<QuestionEndPayload | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [gameOver, setGameOver] = useState<GameOverPayload | null>(null);
  const [timeLeft, setTimeLeft] = useState(0);
  const [phase, setPhase] = useState<"lobby" | "question" | "result" | "leaderboard" | "gameover">("lobby");

  // Connect and join room
  useEffect(() => {
    connect();
  }, [connect]);

  useEffect(() => {
    if (!connected || !roomCode) return;
    sendMessage({
      type: "JOIN_ROOM",
      payload: { roomCode, userId, username },
    });
  }, [connected, roomCode, userId, username, sendMessage]);

  // Event handlers
  useEffect(() => {
    const unsubs = [
      on("ROOM_STATE", (msg) => {
        const payload = msg.payload as RoomStatePayload;
        setPlayers(payload.players);
        setStatus(payload.status);
        setHostId(payload.hostId);
      }),
      on("PLAYER_JOINED", (msg) => {
        const { userId: uid, username: uname } = msg.payload as { userId: string; username: string };
        setPlayers((prev) => {
          if (prev.find((p) => p.userId === uid)) return prev;
          return [...prev, { userId: uid, username: uname, connected: true }];
        });
      }),
      on("PLAYER_LEFT", (msg) => {
        const { userId: uid } = msg.payload as { userId: string };
        setPlayers((prev) => prev.map((p) => (p.userId === uid ? { ...p, connected: false } : p)));
      }),
      on("QUESTION_START", (msg) => {
        const payload = msg.payload as QuestionStartPayload;
        setCurrentQuestion(payload);
        setQuestionResult(null);
        setTimeLeft(payload.timeLimitSecs);
        setPhase("question");
      }),
      on("QUESTION_END", (msg) => {
        setQuestionResult(msg.payload as QuestionEndPayload);
        setPhase("result");
      }),
      on("LEADERBOARD", (msg) => {
        setLeaderboard((msg.payload as LeaderboardPayload).scores);
        setPhase("leaderboard");
      }),
      on("GAME_OVER", (msg) => {
        setGameOver(msg.payload as GameOverPayload);
        setPhase("gameover");
      }),
    ];
    return () => unsubs.forEach((u) => u());
  }, [on]);

  // Timer
  useEffect(() => {
    if (phase !== "question" || timeLeft <= 0) return;
    const timer = setInterval(() => setTimeLeft((t) => Math.max(0, t - 1)), 1000);
    return () => clearInterval(timer);
  }, [phase, timeLeft]);

  const handleStartGame = () => {
    sendMessage({ type: "START_GAME", payload: { roomId } });
  };

  // ─── LOBBY ───
  if (phase === "lobby") {
    return (
      <div className="page-wrapper">
        <div className="container" style={{ paddingTop: 40, maxWidth: 600, textAlign: "center" }}>
          <button className="btn btn-secondary" onClick={() => router.push("/")} style={{ position: "absolute", top: 20, left: 20 }}>
            ← Back
          </button>

          <div className="animate-fade-in" style={{ marginBottom: 40 }}>
            <p style={{ color: "var(--muted-light)", fontSize: "0.9rem", marginBottom: 8 }}>Room Code</p>
            <div className="room-code">{roomCode}</div>
            <p style={{ color: "var(--muted)", fontSize: "0.85rem", marginTop: 8 }}>
              Share this code with players to join
            </p>
          </div>

          <div className="glass-card animate-slide-up" style={{ padding: 32, marginBottom: 24 }}>
            <h3 style={{ fontSize: "1.1rem", fontWeight: 600, marginBottom: 16 }}>
              Players ({players.length})
            </h3>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center", minHeight: 50 }}>
              {players.length === 0 && (
                <p style={{ color: "var(--muted)" }}>Waiting for players to join...</p>
              )}
              {players.map((p) => (
                <div key={p.userId} className={`player-chip ${!p.connected ? "disconnected" : ""}`}>
                  <div className="avatar">{p.username[0]?.toUpperCase()}</div>
                  <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.1 }}>
                    <span>
                      {p.username}
                      {p.userId === hostId && <span title="Host"> 👑</span>}
                    </span>
                    {p.userId === userId && <span style={{ fontSize: "0.65rem", color: "var(--accent-cyan)" }}>(You)</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <button
            className="btn btn-primary btn-lg"
            style={{ width: "100%", maxWidth: 300 }}
            onClick={handleStartGame}
            disabled={players.length < 1}
          >
            🚀 Start Game
          </button>
        </div>
      </div>
    );
  }

  // ─── QUESTION (Host View) ───
  if (phase === "question" && currentQuestion) {
    const q = currentQuestion;
    const circumference = 2 * Math.PI * 52;
    const progress = (timeLeft / q.timeLimitSecs) * circumference;
    const timerClass = timeLeft <= 5 ? "timer-critical" : timeLeft <= 10 ? "timer-warning" : "";

    return (
      <div className="page-wrapper" style={{ justifyContent: "center", alignItems: "center" }}>
        <div className="container" style={{ maxWidth: 700, textAlign: "center" }}>
          <p style={{ color: "var(--muted-light)", marginBottom: 8 }}>
            Question {q.questionIndex + 1} of {q.total}
          </p>

          <div className={`timer-ring ${timerClass}`} style={{ margin: "0 auto 24px" }}>
            <svg width="120" height="120" viewBox="0 0 120 120">
              <circle className="ring-bg" cx="60" cy="60" r="52" />
              <circle
                className="ring-progress"
                cx="60" cy="60" r="52"
                strokeDasharray={circumference}
                strokeDashoffset={circumference - progress}
              />
            </svg>
            <div className="timer-text">{timeLeft}</div>
          </div>

          <div className="glass-card animate-scale-in" style={{ padding: 32, marginBottom: 24 }}>
            {q.question.imageUrl && (
              <Image
                src={q.question.imageUrl}
                alt="Question"
                width={600}
                height={200}
                style={{ maxWidth: "100%", maxHeight: 200, borderRadius: 8, marginBottom: 16, objectFit: "contain" }}
              />
            )}
            <h2 style={{ fontSize: "1.5rem", fontWeight: 700, lineHeight: 1.4 }}>
              {q.question.text}
            </h2>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            {q.question.options.map((opt, i) => (
              <div key={i} className="option-btn" style={{ cursor: "default" }}>
                <span className="option-letter">{String.fromCharCode(65 + i)}</span>
                {opt}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ─── RESULT ───
  if (phase === "result" && questionResult && currentQuestion) {
    return (
      <div className="page-wrapper" style={{ justifyContent: "center", alignItems: "center" }}>
        <div className="container" style={{ maxWidth: 700, textAlign: "center" }}>
          <h2 className="animate-scale-in" style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: 24 }}>
            Results
          </h2>

          <div className="glass-card animate-slide-up" style={{ padding: 24, marginBottom: 24 }}>
            <p style={{ color: "var(--muted-light)", marginBottom: 8 }}>Correct Answer</p>
            <p style={{ fontSize: "1.2rem", fontWeight: 600, color: "var(--accent-green)" }}>
              {String.fromCharCode(65 + questionResult.correctIndex)}.{" "}
              {currentQuestion.question.options[questionResult.correctIndex]}
            </p>
          </div>

          <div className="glass-card animate-slide-up delay-100" style={{ padding: 24 }}>
            <h3 style={{ marginBottom: 16, fontWeight: 600 }}>Player Results</h3>
            {questionResult.results.map((r) => (
              <div
                key={r.userId}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "10px 0",
                  borderBottom: "1px solid var(--border)",
                }}
              >
                <span>
                  {r.username}
                  {r.userId === hostId && <span title="Host"> 👑</span>}
                </span>
                <span className={r.correct ? "result-correct" : "result-incorrect"} style={{ fontWeight: 600 }}>
                  {r.correct ? `✓ +${r.pointsEarned}` : "✗ 0"}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ─── LEADERBOARD ───
  if (phase === "leaderboard") {
    return (
      <div className="page-wrapper" style={{ justifyContent: "center", alignItems: "center" }}>
        <div className="container" style={{ maxWidth: 600, textAlign: "center" }}>
          <h2 className="animate-fade-in" style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: 32 }}>
            🏆 Leaderboard
          </h2>

          <div className="glass-card animate-slide-up" style={{ padding: 24 }}>
            {leaderboard.map((entry, i) => (
              <div
                key={entry.userId}
                className="animate-slide-up"
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "12px 16px",
                  borderBottom: i < leaderboard.length - 1 ? "1px solid var(--border)" : "none",
                  animationDelay: `${i * 100}ms`,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <span style={{ fontWeight: 700, color: i < 3 ? "var(--accent-orange)" : "var(--muted)", width: 24 }}>
                    {i + 1}
                  </span>
                  <span style={{ fontWeight: 500 }}>{entry.username}</span>
                  {entry.userId === hostId && <span title="Host"> 👑</span>}
                </div>
                <span style={{ fontWeight: 700, color: "var(--accent-cyan)" }}>{entry.points}</span>
              </div>
            ))}
          </div>

          <p style={{ color: "var(--muted)", marginTop: 16, fontSize: "0.85rem" }}>
            Next question starting soon...
          </p>
        </div>
      </div>
    );
  }

  // ─── GAME OVER ───
  if (phase === "gameover" && gameOver) {
    const top3 = gameOver.finalScores.slice(0, 3);
    return (
      <div className="page-wrapper" style={{ justifyContent: "center", alignItems: "center" }}>
        <div className="container" style={{ maxWidth: 700, textAlign: "center" }}>
          <h1 className="hero-title animate-scale-in" style={{ fontSize: "2.5rem", marginBottom: 8 }}>
            🎉 Game Over!
          </h1>
          <p className="animate-fade-in delay-100" style={{ color: "var(--muted-light)", marginBottom: 40 }}>
            Winner: <strong style={{ color: "var(--accent-orange)" }}>{gameOver.winner.username}</strong> with {gameOver.winner.points} points!
          </p>

          {/* Podium */}
          <div className="podium animate-slide-up delay-200">
            {top3[1] && (
              <div className="podium-place podium-2nd">
                <div className="podium-name">{top3[1].username}</div>
                <div className="podium-bar">🥈</div>
                <div className="podium-points">{top3[1].points} pts</div>
              </div>
            )}
            {top3[0] && (
              <div className="podium-place podium-1st">
                <div className="podium-name">{top3[0].username}</div>
                <div className="podium-bar">🥇</div>
                <div className="podium-points">{top3[0].points} pts</div>
              </div>
            )}
            {top3[2] && (
              <div className="podium-place podium-3rd">
                <div className="podium-name">{top3[2].username}</div>
                <div className="podium-bar">🥉</div>
                <div className="podium-points">{top3[2].points} pts</div>
              </div>
            )}
          </div>

          {/* Full scores */}
          <div className="glass-card animate-slide-up delay-300" style={{ padding: 24, marginTop: 32 }}>
            <h3 style={{ marginBottom: 16, fontWeight: 600 }}>Final Scores</h3>
            {gameOver.finalScores.map((s, i) => (
              <div
                key={s.userId}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  padding: "10px 16px",
                  borderBottom: i < gameOver.finalScores.length - 1 ? "1px solid var(--border)" : "none",
                }}
              >
                <span>
                  {i + 1}. {s.username}
                  {s.userId === hostId && <span title="Host"> 👑</span>}
                </span>
                <span style={{ fontWeight: 700 }}>{s.points}</span>
              </div>
            ))}
          </div>

          <button
            className="btn btn-primary btn-lg"
            style={{ marginTop: 32 }}
            onClick={() => router.push("/")}
          >
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  // Fallback
  return (
    <div className="page-wrapper" style={{ justifyContent: "center", alignItems: "center" }}>
      <p style={{ color: "var(--muted)" }}>Connecting...</p>
    </div>
  );
}
