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

export default function RoomPage({ params }: { params: Promise<{ code: string }> }) {
  const { code: roomCode } = use(params);
  const searchParams = useSearchParams();
  const router = useRouter();
  const userId = searchParams.get("userId") || "";
  const username = searchParams.get("username") || "";

  const { connect, disconnect, sendMessage, on, connected } = useWebSocket();

  const [roomId, setRoomId] = useState("");
  const [hostId, setHostId] = useState("");
  const [players, setPlayers] = useState<Player[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState<QuestionStartPayload | null>(null);
  const [questionResult, setQuestionResult] = useState<QuestionEndPayload | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [gameOver, setGameOver] = useState<GameOverPayload | null>(null);
  const [timeLeft, setTimeLeft] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [answerSubmitted, setAnswerSubmitted] = useState(false);
  const [answerStartTime, setAnswerStartTime] = useState(0);
  const [myResult, setMyResult] = useState<{ correct: boolean; points: number } | null>(null);
  const [phase, setPhase] = useState<"lobby" | "question" | "result" | "leaderboard" | "gameover">("lobby");
  const [error, setError] = useState("");

  // Connect
  useEffect(() => {
    connect();
  }, [connect]);

  // Join room
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
        setRoomId(payload.roomId);
        setHostId(payload.hostId);
        if (payload.status === "ACTIVE") setPhase("question");
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
        setSelectedAnswer(null);
        setAnswerSubmitted(false);
        setMyResult(null);
        setTimeLeft(payload.timeLimitSecs);
        setAnswerStartTime(Date.now());
        setPhase("question");
      }),
      on("QUESTION_END", (msg) => {
        const result = msg.payload as QuestionEndPayload;
        setQuestionResult(result);
        // Find my result
        const mine = result.results.find((r) => r.userId === userId);
        if (mine) {
          setMyResult({ correct: mine.correct, points: mine.pointsEarned });
        }
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
      on("ERROR", (msg) => {
        setError((msg.payload as { message: string }).message);
      }),
    ];
    return () => unsubs.forEach((u) => u());
  }, [on, userId]);

  // Timer
  useEffect(() => {
    if (phase !== "question" || timeLeft <= 0 || answerSubmitted) return;
    const timer = setInterval(() => setTimeLeft((t) => Math.max(0, t - 1)), 1000);
    return () => clearInterval(timer);
  }, [phase, timeLeft, answerSubmitted]);

  const handleSelectAnswer = (idx: number) => {
    if (answerSubmitted || !currentQuestion) return;
    setSelectedAnswer(idx);
    setAnswerSubmitted(true);

    const timeMs = Date.now() - answerStartTime;
    sendMessage({
      type: "SUBMIT_ANSWER",
      payload: {
        roomId,
        questionId: currentQuestion.question.id,
        answerIndex: idx,
        timeMs,
      },
    });
  };

  const handleLeaveRoom = () => {
    sendMessage({
      type: "LEAVE_ROOM",
      payload: { roomCode, userId },
    });
    disconnect();
    router.push("/");
  };

  // ─── Error ───
  if (error) {
    return (
      <div className="page-wrapper" style={{ justifyContent: "center", alignItems: "center" }}>
        <div className="glass-card" style={{ padding: 40, textAlign: "center", maxWidth: 400 }}>
          <div style={{ fontSize: "3rem", marginBottom: 16 }}>😕</div>
          <p style={{ color: "var(--accent-red)", marginBottom: 24 }}>{error}</p>
          <button className="btn btn-primary" onClick={() => router.push("/")}>
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  // ─── LOBBY ───
  if (phase === "lobby") {
    return (
      <div className="page-wrapper" style={{ justifyContent: "center", alignItems: "center" }}>
        <div className="container" style={{ maxWidth: 500, textAlign: "center" }}>
          <div className="animate-fade-in" style={{ marginBottom: 32 }}>
            <p style={{ color: "var(--muted-light)", marginBottom: 4 }}>Joined room</p>
            <div className="room-code" style={{ fontSize: "2.2rem" }}>{roomCode}</div>
          </div>

          <div className="glass-card animate-slide-up" style={{ padding: 32, marginBottom: 24 }}>
            <div style={{ fontSize: "2.5rem", marginBottom: 16 }}>⏳</div>
            <h2 style={{ fontSize: "1.3rem", fontWeight: 600, marginBottom: 8 }}>
              Waiting for host to start...
            </h2>
            <p style={{ color: "var(--muted-light)", fontSize: "0.9rem", marginBottom: 20 }}>
              {players.length} player{players.length !== 1 ? "s" : ""} in the lobby
            </p>

            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center" }}>
              {players.map((p) => (
                <div key={p.userId} className={`player-chip ${!p.connected ? "disconnected" : ""}`}>
                  <div className="avatar">{p.username[0]?.toUpperCase()}</div>
                  <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.1 }}>
                    <span>
                      {p.username}
                      {p.userId === hostId && <span title="Host"> 👑</span>}
                    </span>
                    {p.userId === userId && (
                      <span style={{ fontSize: "0.65rem", color: "var(--accent-cyan)" }}>(You)</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <button
            className="btn btn-secondary"
            style={{ marginTop: 8 }}
            onClick={handleLeaveRoom}
          >
            🚪 Leave Room
          </button>
        </div>
      </div>
    );
  }

  // ─── QUESTION ───
  if (phase === "question" && currentQuestion) {
    const q = currentQuestion;
    const circumference = 2 * Math.PI * 52;
    const progress = (timeLeft / q.timeLimitSecs) * circumference;
    const timerClass = timeLeft <= 5 ? "timer-critical" : timeLeft <= 10 ? "timer-warning" : "";

    return (
      <div className="page-wrapper" style={{ justifyContent: "center", alignItems: "center" }}>
        <div className="container" style={{ maxWidth: 600, textAlign: "center" }}>
          <p style={{ color: "var(--muted-light)", marginBottom: 8 }}>
            Question {q.questionIndex + 1} of {q.total}
          </p>

          <div className={`timer-ring ${timerClass}`} style={{ margin: "0 auto 20px" }}>
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

          <div className="glass-card animate-scale-in" style={{ padding: 24, marginBottom: 20 }}>
            {q.question.imageUrl && (
              <Image
                src={q.question.imageUrl}
                alt="Question"
                width={500}
                height={180}
                style={{ maxWidth: "100%", maxHeight: 180, borderRadius: 8, marginBottom: 12, objectFit: "contain" }}
              />
            )}
            <h2 style={{ fontSize: "1.3rem", fontWeight: 700, lineHeight: 1.4 }}>
              {q.question.text}
            </h2>
          </div>

          {answerSubmitted ? (
            <div className="glass-card animate-fade-in" style={{ padding: 24 }}>
              <div style={{ fontSize: "2rem", marginBottom: 8 }}>✅</div>
              <p style={{ fontWeight: 600 }}>Answer submitted!</p>
              <p style={{ color: "var(--muted-light)", fontSize: "0.9rem" }}>
                You selected: {String.fromCharCode(65 + (selectedAnswer ?? 0))}. {q.question.options[selectedAnswer ?? 0]}
              </p>
              <p style={{ color: "var(--muted)", fontSize: "0.85rem", marginTop: 8 }}>
                Waiting for time to expire...
              </p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {q.question.options.map((opt, i) => (
                <button
                  key={i}
                  className={`option-btn ${selectedAnswer === i ? "selected" : ""}`}
                  onClick={() => handleSelectAnswer(i)}
                  disabled={answerSubmitted}
                >
                  <span className="option-letter">{String.fromCharCode(65 + i)}</span>
                  {opt}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ─── RESULT ───
  if (phase === "result" && questionResult && currentQuestion) {
    const correctOpt = currentQuestion.question.options[questionResult.correctIndex];

    return (
      <div className="page-wrapper" style={{ justifyContent: "center", alignItems: "center" }}>
        <div className="container" style={{ maxWidth: 500, textAlign: "center" }}>
          {myResult ? (
            <div className="animate-scale-in">
              <div style={{ fontSize: "4rem", marginBottom: 16 }}>
                {myResult.correct ? "🎉" : "😔"}
              </div>
              <h2
                style={{
                  fontSize: "1.6rem",
                  fontWeight: 700,
                  color: myResult.correct ? "var(--accent-green)" : "var(--accent-red)",
                  marginBottom: 8,
                }}
              >
                {myResult.correct ? "Correct!" : "Incorrect"}
              </h2>
              {myResult.correct && (
                <p className="score-pop" style={{ fontSize: "2rem", fontWeight: 800, color: "var(--accent-cyan)" }}>
                  +{myResult.points}
                </p>
              )}
            </div>
          ) : (
            <div className="animate-fade-in">
              <div style={{ fontSize: "3rem", marginBottom: 12 }}>⏰</div>
              <h2 style={{ fontSize: "1.4rem", fontWeight: 600, color: "var(--accent-orange)" }}>
                Time&apos;s Up!
              </h2>
            </div>
          )}

          <div className="glass-card animate-slide-up delay-200" style={{ padding: 20, marginTop: 24 }}>
            <p style={{ color: "var(--muted-light)", fontSize: "0.85rem", marginBottom: 4 }}>
              Correct Answer
            </p>
            <p style={{ fontWeight: 600, color: "var(--accent-green)" }}>
              {String.fromCharCode(65 + questionResult.correctIndex)}. {correctOpt}
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ─── LEADERBOARD ───
  if (phase === "leaderboard") {
    const myRank = leaderboard.findIndex((e) => e.userId === userId) + 1;
    const myScore = leaderboard.find((e) => e.userId === userId);

    return (
      <div className="page-wrapper" style={{ justifyContent: "center", alignItems: "center" }}>
        <div className="container" style={{ maxWidth: 500, textAlign: "center" }}>
          <h2 className="animate-fade-in" style={{ fontSize: "1.3rem", fontWeight: 700, marginBottom: 8 }}>
            🏆 Leaderboard
          </h2>
          {myScore && (
            <p className="animate-fade-in delay-100" style={{ color: "var(--accent-cyan)", fontWeight: 600, marginBottom: 24 }}>
              You&apos;re #{myRank} with {myScore.points} points
            </p>
          )}

          <div className="glass-card animate-slide-up delay-200" style={{ padding: 20 }}>
            {leaderboard.map((entry, i) => (
              <div
                key={entry.userId}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "10px 12px",
                  borderBottom: i < leaderboard.length - 1 ? "1px solid var(--border)" : "none",
                  background: entry.userId === userId ? "rgba(139, 92, 246, 0.1)" : "transparent",
                  borderRadius: 8,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontWeight: 700, color: i < 3 ? "var(--accent-orange)" : "var(--muted)", width: 20, fontSize: "0.9rem" }}>
                    {i + 1}
                  </span>
                  <span style={{ fontWeight: entry.userId === userId ? 700 : 400, fontSize: "0.95rem" }}>
                    {entry.username}
                    {entry.userId === userId && " (You)"}
                  </span>
                  {entry.userId === hostId && <span title="Host">👑</span>}
                </div>
                <span style={{ fontWeight: 700, color: "var(--accent-cyan)", fontSize: "0.95rem" }}>
                  {entry.points}
                </span>
              </div>
            ))}
          </div>

          <p style={{ color: "var(--muted)", marginTop: 16, fontSize: "0.8rem" }}>
            Next question coming soon...
          </p>
        </div>
      </div>
    );
  }

  // ─── GAME OVER ───
  if (phase === "gameover" && gameOver) {
    const top3 = gameOver.finalScores.slice(0, 3);
    const myRank = gameOver.finalScores.findIndex((e) => e.userId === userId) + 1;
    const myScore = gameOver.finalScores.find((e) => e.userId === userId);

    return (
      <div className="page-wrapper" style={{ justifyContent: "center", alignItems: "center" }}>
        <div className="container" style={{ maxWidth: 600, textAlign: "center" }}>
          <h1 className="hero-title animate-scale-in" style={{ fontSize: "2.2rem", marginBottom: 8 }}>
            🎉 Game Over!
          </h1>

          {myScore && (
            <p className="animate-fade-in delay-100" style={{ color: "var(--accent-cyan)", fontSize: "1.1rem", fontWeight: 600, marginBottom: 32 }}>
              You finished #{myRank} with {myScore.points} points!
            </p>
          )}

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

          {/* Full Scores */}
          <div className="glass-card animate-slide-up delay-300" style={{ padding: 20, marginTop: 32 }}>
            {gameOver.finalScores.map((s, i) => (
              <div
                key={s.userId}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  padding: "10px 12px",
                  borderBottom: i < gameOver.finalScores.length - 1 ? "1px solid var(--border)" : "none",
                  background: s.userId === userId ? "rgba(139, 92, 246, 0.1)" : "transparent",
                  borderRadius: 8,
                }}
              >
                <span style={{ fontWeight: s.userId === userId ? 700 : 400 }}>
                  {i + 1}. {s.username}{s.userId === userId ? " (You)" : ""}
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
      <div className="glass-card" style={{ padding: 32, textAlign: "center" }}>
        <div style={{ fontSize: "2rem", marginBottom: 12 }}>🔌</div>
        <p style={{ color: "var(--muted-light)" }}>Connecting to game...</p>
      </div>
    </div>
  );
}
