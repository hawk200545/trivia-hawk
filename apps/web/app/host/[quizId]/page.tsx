"use client";

import { useEffect, useState, use } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Image from "next/image";
import { useWebSocket } from "../../hooks/useWebSocket";
import { TimerRing } from "../../components/TimerRing";
import { PlayerChip } from "../../components/PlayerChip";
import { Podium } from "../../components/Podium";
import { RoomCode } from "../../components/RoomCode";
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
        <div
          className="container"
          style={{ paddingTop: 40, maxWidth: 620, textAlign: "center" }}
        >
          <div className="back-btn-wrap" style={{ textAlign: "left" }}>
            <button
              className="btn btn-secondary"
              onClick={() => router.push("/")}
              style={{ fontSize: "0.7rem", padding: "6px 14px" }}
            >
              BACK
            </button>
          </div>

          {/* Room code */}
          <div className="animate-fade-in" style={{ marginBottom: 36 }}>
            <div className="label" style={{ marginBottom: 12 }}>Room Code</div>
            <RoomCode code={roomCode} />
            <p
              style={{
                color: "var(--muted)",
                fontSize: "0.75rem",
                marginTop: 10,
                letterSpacing: "0.05em",
              }}
            >
              Share this code with players
            </p>
          </div>

          {/* Players list */}
          <div
            className="panel animate-slide-up"
            style={{ padding: 24, marginBottom: 20 }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 16,
              }}
            >
              <span className="label" style={{ marginBottom: 0 }}>Players</span>
              <span
                style={{
                  fontFamily: "ui-monospace, monospace",
                  fontWeight: 900,
                  fontSize: "1.2rem",
                  color: players.length > 0 ? "var(--accent-green)" : "var(--muted)",
                }}
              >
                {players.length}
              </span>
            </div>

            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 8,
                justifyContent: "center",
                minHeight: 48,
              }}
            >
              {players.length === 0 && (
                <p style={{ color: "var(--muted)", fontSize: "0.85rem", alignSelf: "center" }}>
                  Waiting for players to join...
                </p>
              )}
              {players.map((p) => (
                <PlayerChip
                  key={p.userId}
                  username={p.username}
                  connected={p.connected}
                  isYou={p.userId === userId}
                  isHost={p.userId === hostId}
                />
              ))}
            </div>
          </div>

          <button
            className="btn btn-primary btn-lg"
            style={{ width: "100%", maxWidth: 280 }}
            onClick={handleStartGame}
            disabled={players.length < 1}
          >
            START GAME
          </button>

          {!connected && (
            <p
              style={{
                color: "var(--accent-amber)",
                fontSize: "0.75rem",
                marginTop: 12,
                letterSpacing: "0.08em",
              }}
            >
              CONNECTING...
            </p>
          )}
        </div>
      </div>
    );
  }

  // ─── QUESTION (Host View) ───
  if (phase === "question" && currentQuestion) {
    const q = currentQuestion;

    return (
      <div
        className="page-wrapper"
        style={{ justifyContent: "center", alignItems: "center" }}
      >
        <div className="container" style={{ maxWidth: 700, textAlign: "center" }}>
          {/* HUD strip */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 24,
            }}
          >
            <div
              style={{
                fontFamily: "ui-monospace, monospace",
                fontSize: "0.8rem",
                color: "var(--muted-light)",
                letterSpacing: "0.1em",
              }}
            >
              Q {q.questionIndex + 1} / {q.total}
            </div>
            <div
              style={{
                fontSize: "0.7rem",
                fontWeight: 700,
                letterSpacing: "0.15em",
                color: "var(--muted-light)",
              }}
            >
              HOST VIEW
            </div>
          </div>

          {/* Timer */}
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 24 }}>
            <TimerRing timeLeft={timeLeft} totalTime={q.timeLimitSecs} />
          </div>

          {/* Question */}
          <div
            className="panel animate-scale-in"
            style={{ padding: 28, marginBottom: 20 }}
          >
            {q.question.imageUrl && (
              <Image
                src={q.question.imageUrl}
                alt="Question"
                width={600}
                height={200}
                style={{
                  maxWidth: "100%",
                  maxHeight: 200,
                  borderRadius: "var(--radius)",
                  marginBottom: 16,
                  objectFit: "contain",
                }}
              />
            )}
            <h2 style={{ fontSize: "1.4rem", fontWeight: 700, lineHeight: 1.4 }}>
              {q.question.text}
            </h2>
          </div>

          {/* Options (display only) */}
          <div className="grid-2col" style={{ gap: 10 }}>
            {q.question.options.map((opt, i) => (
              <div key={i} className="option-btn" style={{ cursor: "default" }}>
                <span className="option-letter">{String.fromCharCode(65 + i)}</span>
                <span>{opt}</span>
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
      <div
        className="page-wrapper"
        style={{ justifyContent: "center", alignItems: "center" }}
      >
        <div className="container" style={{ maxWidth: 700, textAlign: "center" }}>
          <h2
            className="animate-scale-in"
            style={{ fontSize: "1.3rem", fontWeight: 900, marginBottom: 20, letterSpacing: "0.1em" }}
          >
            ROUND RESULTS
          </h2>

          {/* Correct answer */}
          <div
            className="panel animate-slide-up"
            style={{
              padding: 20,
              marginBottom: 20,
              borderColor: "var(--accent-green)",
            }}
          >
            <div className="label" style={{ marginBottom: 6 }}>Correct Answer</div>
            <p
              style={{
                fontSize: "1.1rem",
                fontWeight: 700,
                color: "var(--accent-green)",
                fontFamily: "ui-monospace, monospace",
              }}
            >
              {String.fromCharCode(65 + questionResult.correctIndex)}.{" "}
              {currentQuestion.question.options[questionResult.correctIndex]}
            </p>
          </div>

          {/* Player results */}
          <div className="panel animate-slide-up delay-100" style={{ padding: 0, overflow: "hidden" }}>
            <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)" }}>
              <span className="label" style={{ marginBottom: 0 }}>Player Results</span>
            </div>
            {questionResult.results.map((r) => (
              <div key={r.userId} className="lb-row">
                <span style={{ fontWeight: 500, fontSize: "0.9rem" }}>
                  {r.username}
                  {r.userId === hostId && (
                    <span style={{ color: "var(--accent-amber)", marginLeft: 6, fontSize: "0.7rem" }}>HOST</span>
                  )}
                </span>
                <span
                  className={r.correct ? "result-correct" : "result-incorrect"}
                  style={{
                    fontFamily: "ui-monospace, monospace",
                    fontWeight: 900,
                    fontSize: "0.9rem",
                  }}
                >
                  {r.correct ? `+${r.pointsEarned}` : "0"}
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
      <div
        className="page-wrapper"
        style={{ justifyContent: "center", alignItems: "center" }}
      >
        <div className="container" style={{ maxWidth: 560, textAlign: "center" }}>
          <h2
            className="animate-fade-in"
            style={{
              fontSize: "1.3rem",
              fontWeight: 900,
              letterSpacing: "0.15em",
              marginBottom: 24,
            }}
          >
            LEADERBOARD
          </h2>

          <div className="panel animate-slide-up" style={{ padding: 0, overflow: "hidden" }}>
            {leaderboard.map((entry, i) => (
              <div
                key={entry.userId}
                className={`lb-row animate-slide-up`}
                style={{ animationDelay: `${i * 60}ms` }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <span className={`lb-rank ${i < 3 ? "top3" : ""}`}>{i + 1}</span>
                  <span style={{ fontWeight: 500, fontSize: "0.9rem" }}>
                    {entry.username}
                    {entry.userId === hostId && (
                      <span style={{ color: "var(--accent-amber)", marginLeft: 6, fontSize: "0.7rem" }}>HOST</span>
                    )}
                  </span>
                </div>
                <span className="lb-pts">{entry.points}</span>
              </div>
            ))}
          </div>

          <p
            style={{
              color: "var(--muted)",
              marginTop: 14,
              fontSize: "0.75rem",
              letterSpacing: "0.1em",
            }}
          >
            NEXT QUESTION STARTING SOON...
          </p>
        </div>
      </div>
    );
  }

  // ─── GAME OVER ───
  if (phase === "gameover" && gameOver) {
    return (
      <div
        className="page-wrapper"
        style={{ justifyContent: "center", alignItems: "center" }}
      >
        <div className="container" style={{ maxWidth: 680, textAlign: "center" }}>
          <div className="hero-sub animate-fade-in" style={{ marginBottom: 6 }}>
            Game Over
          </div>
          <h1
            className="hero-title animate-scale-in"
            style={{ fontSize: "3rem", marginBottom: 4 }}
          >
            FINAL STANDINGS
          </h1>
          <p
            className="animate-fade-in delay-100"
            style={{
              color: "var(--accent-amber)",
              fontFamily: "ui-monospace, monospace",
              fontWeight: 900,
              marginBottom: 32,
              fontSize: "0.9rem",
              letterSpacing: "0.1em",
            }}
          >
            WINNER: {gameOver.winner.username.toUpperCase()} — {gameOver.winner.points} PTS
          </p>

          <Podium scores={gameOver.finalScores} />

          <div
            className="panel animate-slide-up delay-300"
            style={{ padding: 0, marginTop: 28, overflow: "hidden" }}
          >
            <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)" }}>
              <span className="label" style={{ marginBottom: 0 }}>Full Scores</span>
            </div>
            {gameOver.finalScores.map((s, i) => (
              <div key={s.userId} className="lb-row">
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <span className={`lb-rank ${i < 3 ? "top3" : ""}`}>{i + 1}</span>
                  <span style={{ fontWeight: 500, fontSize: "0.9rem" }}>
                    {s.username}
                    {s.userId === hostId && (
                      <span style={{ color: "var(--accent-amber)", marginLeft: 6, fontSize: "0.7rem" }}>HOST</span>
                    )}
                  </span>
                </div>
                <span className="lb-pts">{s.points}</span>
              </div>
            ))}
          </div>

          <button
            className="btn btn-primary btn-lg"
            style={{ marginTop: 28 }}
            onClick={() => router.push("/")}
          >
            BACK TO HOME
          </button>
        </div>
      </div>
    );
  }

  // Fallback
  return (
    <div className="page-wrapper" style={{ justifyContent: "center", alignItems: "center" }}>
      <p
        style={{
          color: "var(--muted-light)",
          fontFamily: "ui-monospace, monospace",
          fontSize: "0.8rem",
          letterSpacing: "0.15em",
        }}
      >
        CONNECTING...
      </p>
    </div>
  );
}
