"use client";

import { useEffect, useState, use } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Image from "next/image";
import { useWebSocket } from "../../hooks/useWebSocket";
import { TimerRing } from "../../components/TimerRing";
import { OptionButton } from "../../components/OptionButton";
import { PlayerChip } from "../../components/PlayerChip";
import { Podium } from "../../components/Podium";
import { RoomCode } from "../../components/RoomCode";
import type { OptionState } from "../../components/OptionButton";
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

  useEffect(() => {
    if (phase !== "question" || timeLeft <= 0 || answerSubmitted) return;
    const timer = setInterval(() => setTimeLeft((t) => Math.max(0, t - 1)), 1000);
    return () => clearInterval(timer);
  }, [phase, timeLeft, answerSubmitted]);

  useEffect(() => {
    if (phase === "question") {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [phase]);

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
    sendMessage({ type: "LEAVE_ROOM", payload: { roomCode, userId } });
    disconnect();
    router.push("/");
  };

  // ─── Error ───
  if (error) {
    return (
      <div className="page-wrapper" style={{ justifyContent: "center", alignItems: "center" }}>
        <div className="panel" style={{ padding: 36, textAlign: "center", maxWidth: 380 }}>
          <p
            style={{
              color: "var(--accent-red)",
              marginBottom: 20,
              fontWeight: 700,
              letterSpacing: "0.05em",
            }}
          >
            {error.toUpperCase()}
          </p>
          <button className="btn btn-primary" onClick={() => router.push("/")}>
            BACK TO HOME
          </button>
        </div>
      </div>
    );
  }

  // ─── LOBBY ───
  if (phase === "lobby") {
    return (
      <div className="page-wrapper" style={{ justifyContent: "center", alignItems: "center" }}>
        <div className="container" style={{ maxWidth: 480, textAlign: "center" }}>
          <div className="animate-fade-in" style={{ marginBottom: 28 }}>
            <div className="label" style={{ marginBottom: 8 }}>Joined Room</div>
            <RoomCode code={roomCode} />
          </div>

          <div className="panel animate-slide-up" style={{ padding: 24, marginBottom: 16 }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 16,
              }}
            >
              <span
                style={{
                  fontFamily: "ui-monospace, monospace",
                  fontSize: "0.8rem",
                  color: "var(--muted-light)",
                  letterSpacing: "0.08em",
                }}
              >
                WAITING FOR HOST...
              </span>
              <span
                style={{
                  fontFamily: "ui-monospace, monospace",
                  fontWeight: 900,
                  color: players.length > 0 ? "var(--accent-green)" : "var(--muted)",
                }}
              >
                {players.length} PLAYERS
              </span>
            </div>

            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center" }}>
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
            className="btn btn-secondary"
            onClick={handleLeaveRoom}
            style={{ fontSize: "0.75rem" }}
          >
            LEAVE ROOM
          </button>
        </div>
      </div>
    );
  }

  // ─── QUESTION ───
  if (phase === "question" && currentQuestion) {
    const q = currentQuestion;

    const getOptionState = (i: number): OptionState => {
      if (answerSubmitted && selectedAnswer === i) return "selected";
      return "idle";
    };

    return (
      <div className="page-wrapper" style={{ justifyContent: "center", alignItems: "center" }}>
        <div className="container" style={{ maxWidth: 580, textAlign: "center" }}>
          {/* HUD top */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 20,
            }}
          >
            <span
              style={{
                fontFamily: "ui-monospace, monospace",
                fontSize: "0.8rem",
                color: "var(--muted-light)",
                letterSpacing: "0.1em",
              }}
            >
              Q {q.questionIndex + 1} / {q.total}
            </span>
            <span
              style={{
                fontFamily: "ui-monospace, monospace",
                fontSize: "0.75rem",
                color: "var(--muted)",
              }}
            >
              ROOM {roomCode}
            </span>
          </div>

          {/* Timer */}
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 20 }}>
            <TimerRing timeLeft={timeLeft} totalTime={q.timeLimitSecs} />
          </div>

          {/* Question */}
          <div className="panel animate-scale-in" style={{ padding: 24, marginBottom: 16 }}>
            {q.question.imageUrl && (
              <Image
                src={q.question.imageUrl}
                alt="Question"
                width={500}
                height={180}
                style={{
                  maxWidth: "100%",
                  maxHeight: 180,
                  borderRadius: "var(--radius)",
                  marginBottom: 12,
                  objectFit: "contain",
                }}
              />
            )}
            <h2 style={{ fontSize: "1.2rem", fontWeight: 700, lineHeight: 1.5 }}>
              {q.question.text}
            </h2>
          </div>

          {/* Answers / Submitted state */}
          {answerSubmitted ? (
            <div
              className="panel animate-fade-in"
              style={{
                padding: 20,
                borderColor: "var(--accent-blue)",
              }}
            >
              <div
                style={{
                  fontFamily: "ui-monospace, monospace",
                  fontWeight: 900,
                  color: "var(--accent-blue)",
                  fontSize: "0.85rem",
                  letterSpacing: "0.12em",
                  marginBottom: 6,
                }}
              >
                ANSWER LOCKED IN
              </div>
              <p style={{ color: "var(--muted-light)", fontSize: "0.85rem" }}>
                {String.fromCharCode(65 + (selectedAnswer ?? 0))}:{" "}
                {q.question.options[selectedAnswer ?? 0]}
              </p>
              <p style={{ color: "var(--muted)", fontSize: "0.75rem", marginTop: 6, letterSpacing: "0.05em" }}>
                Waiting for others...
              </p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {q.question.options.map((opt, i) => (
                <OptionButton
                  key={i}
                  letter={String.fromCharCode(65 + i)}
                  text={opt}
                  state={getOptionState(i)}
                  disabled={answerSubmitted}
                  onClick={() => handleSelectAnswer(i)}
                />
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
        <div className="container" style={{ maxWidth: 480, textAlign: "center" }}>
          {myResult ? (
            <div className="animate-scale-in" style={{ marginBottom: 24 }}>
              <div
                style={{
                  fontSize: "4rem",
                  lineHeight: 1,
                  marginBottom: 12,
                  fontWeight: 900,
                  color: myResult.correct ? "var(--accent-green)" : "var(--accent-red)",
                }}
              >
                {myResult.correct ? "+" : "—"}
              </div>
              <h2
                style={{
                  fontSize: "1.6rem",
                  fontWeight: 900,
                  letterSpacing: "0.1em",
                  color: myResult.correct ? "var(--accent-green)" : "var(--accent-red)",
                  marginBottom: 6,
                }}
              >
                {myResult.correct ? "CORRECT" : "INCORRECT"}
              </h2>
              {myResult.correct && (
                <div
                  className="score-pop"
                  style={{
                    fontSize: "2.4rem",
                    fontWeight: 900,
                    fontFamily: "ui-monospace, monospace",
                    color: "var(--accent-amber)",
                  }}
                >
                  +{myResult.points}
                </div>
              )}
            </div>
          ) : (
            <div className="animate-fade-in" style={{ marginBottom: 24 }}>
              <h2
                style={{
                  fontSize: "1.4rem",
                  fontWeight: 900,
                  color: "var(--accent-amber)",
                  letterSpacing: "0.12em",
                }}
              >
                TIME&apos;S UP
              </h2>
            </div>
          )}

          <div
            className="panel animate-slide-up delay-200"
            style={{
              padding: 16,
              borderColor: "var(--accent-green)",
            }}
          >
            <div className="label" style={{ marginBottom: 6 }}>Correct Answer</div>
            <p
              style={{
                fontWeight: 700,
                color: "var(--accent-green)",
                fontFamily: "ui-monospace, monospace",
              }}
            >
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
        <div className="container" style={{ maxWidth: 480, textAlign: "center" }}>
          <h2
            className="animate-fade-in"
            style={{
              fontSize: "1.3rem",
              fontWeight: 900,
              letterSpacing: "0.15em",
              marginBottom: 6,
            }}
          >
            LEADERBOARD
          </h2>
          {myScore && (
            <p
              className="animate-fade-in delay-100"
              style={{
                fontFamily: "ui-monospace, monospace",
                color: "var(--accent-blue)",
                fontWeight: 900,
                marginBottom: 20,
                fontSize: "0.85rem",
                letterSpacing: "0.1em",
              }}
            >
              YOU ARE #{myRank} — {myScore.points} PTS
            </p>
          )}

          <div className="panel animate-slide-up delay-100" style={{ padding: 0, overflow: "hidden" }}>
            {leaderboard.map((entry, i) => (
              <div
                key={entry.userId}
                className={`lb-row animate-slide-up ${entry.userId === userId ? "is-you" : ""}`}
                style={{ animationDelay: `${i * 60}ms` }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <span className={`lb-rank ${i < 3 ? "top3" : ""}`}>{i + 1}</span>
                  <span style={{ fontWeight: entry.userId === userId ? 700 : 400, fontSize: "0.9rem" }}>
                    {entry.username}
                    {entry.userId === userId && (
                      <span style={{ color: "var(--accent-blue)", marginLeft: 6, fontSize: "0.7rem" }}>YOU</span>
                    )}
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
            NEXT QUESTION COMING SOON...
          </p>
        </div>
      </div>
    );
  }

  // ─── GAME OVER ───
  if (phase === "gameover" && gameOver) {
    const myRank = gameOver.finalScores.findIndex((e) => e.userId === userId) + 1;
    const myScore = gameOver.finalScores.find((e) => e.userId === userId);

    return (
      <div className="page-wrapper" style={{ justifyContent: "center", alignItems: "center" }}>
        <div className="container" style={{ maxWidth: 580, textAlign: "center" }}>
          <div className="hero-sub animate-fade-in" style={{ marginBottom: 6 }}>
            Game Over
          </div>
          <h1
            className="hero-title animate-scale-in"
            style={{ fontSize: "2.6rem", marginBottom: 8 }}
          >
            FINAL RESULTS
          </h1>

          {myScore && (
            <p
              className="animate-fade-in delay-100"
              style={{
                fontFamily: "ui-monospace, monospace",
                fontWeight: 900,
                color: "var(--accent-blue)",
                fontSize: "0.9rem",
                letterSpacing: "0.1em",
                marginBottom: 28,
              }}
            >
              YOU FINISHED #{myRank} — {myScore.points} PTS
            </p>
          )}

          <Podium scores={gameOver.finalScores} />

          <div
            className="panel animate-slide-up delay-300"
            style={{ padding: 0, marginTop: 24, overflow: "hidden" }}
          >
            {gameOver.finalScores.map((s, i) => (
              <div
                key={s.userId}
                className={`lb-row ${s.userId === userId ? "is-you" : ""}`}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <span className={`lb-rank ${i < 3 ? "top3" : ""}`}>{i + 1}</span>
                  <span style={{ fontWeight: s.userId === userId ? 700 : 400, fontSize: "0.9rem" }}>
                    {s.username}
                    {s.userId === userId && (
                      <span style={{ color: "var(--accent-blue)", marginLeft: 6, fontSize: "0.7rem" }}>YOU</span>
                    )}
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
            style={{ marginTop: 24 }}
            onClick={() => router.push("/")}
          >
            PLAY AGAIN
          </button>
        </div>
      </div>
    );
  }

  // Fallback
  return (
    <div className="page-wrapper" style={{ justifyContent: "center", alignItems: "center" }}>
      <div className="panel" style={{ padding: 28, textAlign: "center" }}>
        <p
          style={{
            color: "var(--muted-light)",
            fontFamily: "ui-monospace, monospace",
            fontSize: "0.8rem",
            letterSpacing: "0.15em",
          }}
        >
          CONNECTING TO GAME...
        </p>
      </div>
    </div>
  );
}
