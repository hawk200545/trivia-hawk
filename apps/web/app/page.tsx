"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "./lib/api";

export default function Home() {
  const router = useRouter();
  const [roomCode, setRoomCode] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isLogin, setIsLogin] = useState(true);
  const [error, setError] = useState("");
  const [user, setUser] = useState<{ id: string; username: string } | null>(
    () => {
      if (typeof window !== "undefined") {
        const saved = localStorage.getItem("trivia-user");
        return saved ? JSON.parse(saved) : null;
      }
      return null;
    }
  );

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      const endpoint = isLogin ? "/api/login" : "/api/register";
      const data = await api<{ id: string; username: string }>(endpoint, {
        method: "POST",
        body: JSON.stringify({ username, password }),
      });
      setUser(data);
      localStorage.setItem("trivia-user", JSON.stringify(data));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    }
  };

  const handleJoinRoom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!roomCode.trim() || !user) return;
    router.push(
      `/room/${roomCode.toUpperCase()}?userId=${user.id}&username=${user.username}`
    );
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem("trivia-user");
  };

  // ─── Auth Screen ───
  if (!user) {
    return (
      <div
        className="page-wrapper"
        style={{ justifyContent: "center", alignItems: "center" }}
      >
        <div style={{ width: "100%", maxWidth: 400, padding: "0 24px" }}>
          {/* Wordmark */}
          <div style={{ textAlign: "center", marginBottom: 40 }}>
            <div className="hero-sub" style={{ marginBottom: 8 }}>
              Real-Time Multiplayer Trivia
            </div>
            <h1 className="hero-title">TRIVIA HAWK</h1>
          </div>

          {/* Card */}
          <div className="panel-accent animate-slide-up" style={{ padding: 28 }}>
            {/* Tab toggle */}
            <div
              style={{
                display: "flex",
                gap: 2,
                marginBottom: 24,
                background: "var(--background)",
                padding: 3,
                borderRadius: "var(--radius)",
                border: "1px solid var(--border)",
              }}
            >
              <button
                type="button"
                className={`btn ${isLogin ? "btn-primary" : "btn-secondary"}`}
                style={{ flex: 1, border: "none" }}
                onClick={() => { setIsLogin(true); setError(""); }}
              >
                LOGIN
              </button>
              <button
                type="button"
                className={`btn ${!isLogin ? "btn-primary" : "btn-secondary"}`}
                style={{ flex: 1, border: "none" }}
                onClick={() => { setIsLogin(false); setError(""); }}
              >
                REGISTER
              </button>
            </div>

            <form onSubmit={handleAuth}>
              <div style={{ marginBottom: 14 }}>
                <label className="label">Username</label>
                <input
                  className="input"
                  type="text"
                  placeholder="enter username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  autoComplete="username"
                />
              </div>
              <div style={{ marginBottom: 20 }}>
                <label className="label">Password</label>
                <input
                  className="input"
                  type="password"
                  placeholder="enter password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete={isLogin ? "current-password" : "new-password"}
                />
              </div>

              {error && (
                <p
                  style={{
                    color: "var(--accent-red)",
                    fontSize: "0.8rem",
                    marginBottom: 14,
                    fontWeight: 600,
                    letterSpacing: "0.05em",
                  }}
                >
                  {error.toUpperCase()}
                </p>
              )}

              <button
                className="btn btn-primary btn-lg"
                style={{ width: "100%" }}
                type="submit"
              >
                {isLogin ? "LOGIN" : "CREATE ACCOUNT"}
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  // ─── Dashboard ───
  return (
    <div className="page-wrapper">
      <div className="container" style={{ paddingTop: 48, paddingBottom: 60 }}>
        {/* Header */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            marginBottom: 56,
          }}
        >
          <div>
            <div className="hero-sub" style={{ marginBottom: 6 }}>
              Real-Time Multiplayer Trivia
            </div>
            <h1 className="hero-title animate-fade-in">TRIVIA HAWK</h1>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, paddingTop: 6 }}>
            <div className="player-chip is-you">
              <div className="avatar">{user.username[0]?.toUpperCase()}</div>
              <span>{user.username}</span>
              <span className="status-dot connected" />
            </div>
            <button
              className="btn btn-secondary"
              onClick={handleLogout}
              style={{ fontSize: "0.7rem", padding: "6px 14px" }}
            >
              LOGOUT
            </button>
          </div>
        </div>

        {/* Action cards */}
        <div
          className="grid-2col"
          style={{
            maxWidth: 760,
            margin: "0 auto",
          }}
        >
          {/* Create Quiz */}
          <div
            className="panel animate-slide-up"
            style={{ padding: 36 }}
          >
            <div
              style={{
                fontSize: "0.65rem",
                fontWeight: 700,
                letterSpacing: "0.15em",
                textTransform: "uppercase",
                color: "var(--accent-red)",
                marginBottom: 12,
              }}
            >
              HOST
            </div>
            <h2
              style={{
                fontSize: "1.6rem",
                fontWeight: 900,
                marginBottom: 8,
                lineHeight: 1,
              }}
            >
              CREATE
              <br />
              A QUIZ
            </h2>
            <p
              style={{
                color: "var(--muted-light)",
                marginBottom: 28,
                fontSize: "0.85rem",
                lineHeight: 1.5,
              }}
            >
              Build questions, set a room, invite players to compete.
            </p>
            <button
              className="btn btn-primary btn-lg"
              style={{ width: "100%" }}
              onClick={() => router.push("/create")}
            >
              CREATE QUIZ
            </button>
          </div>

          {/* Join Game */}
          <div
            className="panel animate-slide-up delay-100"
            style={{ padding: 36 }}
          >
            <div
              style={{
                fontSize: "0.65rem",
                fontWeight: 700,
                letterSpacing: "0.15em",
                textTransform: "uppercase",
                color: "var(--accent-blue)",
                marginBottom: 12,
              }}
            >
              PLAYER
            </div>
            <h2
              style={{
                fontSize: "1.6rem",
                fontWeight: 900,
                marginBottom: 8,
                lineHeight: 1,
              }}
            >
              JOIN
              <br />A GAME
            </h2>
            <p
              style={{
                color: "var(--muted-light)",
                marginBottom: 20,
                fontSize: "0.85rem",
                lineHeight: 1.5,
              }}
            >
              Enter the room code to jump into a live quiz.
            </p>
            <form onSubmit={handleJoinRoom}>
              <input
                className="input input-mono"
                type="text"
                placeholder="XXXXXX"
                maxLength={6}
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                style={{ marginBottom: 10 }}
              />
              <button
                className="btn btn-primary btn-lg"
                style={{ width: "100%" }}
                type="submit"
                disabled={roomCode.length < 6}
              >
                JOIN GAME
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
