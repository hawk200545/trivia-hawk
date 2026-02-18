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
      <div className="page-wrapper" style={{ justifyContent: "center", alignItems: "center" }}>
        <div className="container" style={{ maxWidth: 420 }}>
          <div style={{ textAlign: "center", marginBottom: 40 }}>
            <h1 className="hero-title" style={{ fontSize: "2.5rem", marginBottom: 8 }}>
              🦅 Trivia Hawk
            </h1>
            <p className="hero-subtitle" style={{ margin: "0 auto" }}>
              Real-time multiplayer trivia
            </p>
          </div>

          <div className="glass-card animate-slide-up" style={{ padding: 32 }}>
            <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
              <button
                className={`btn ${isLogin ? "btn-primary" : "btn-secondary"}`}
                style={{ flex: 1 }}
                onClick={() => { setIsLogin(true); setError(""); }}
              >
                Login
              </button>
              <button
                className={`btn ${!isLogin ? "btn-primary" : "btn-secondary"}`}
                style={{ flex: 1 }}
                onClick={() => { setIsLogin(false); setError(""); }}
              >
                Register
              </button>
            </div>

            <form onSubmit={handleAuth}>
              <div style={{ marginBottom: 16 }}>
                <label className="label">Username</label>
                <input
                  className="input"
                  type="text"
                  placeholder="Enter username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                />
              </div>
              <div style={{ marginBottom: 20 }}>
                <label className="label">Password</label>
                <input
                  className="input"
                  type="password"
                  placeholder="Enter password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              {error && (
                <p style={{ color: "var(--accent-red)", fontSize: "0.85rem", marginBottom: 16 }}>
                  {error}
                </p>
              )}
              <button className="btn btn-primary btn-lg" style={{ width: "100%" }} type="submit">
                {isLogin ? "Login" : "Create Account"}
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
      <div className="container" style={{ paddingTop: 60, paddingBottom: 60 }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 60 }}>
          <div>
            <h1 className="hero-title animate-fade-in">🦅 Trivia Hawk</h1>
            <p className="hero-subtitle animate-fade-in delay-100">
              Real-time multiplayer trivia game
            </p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div className="player-chip">
              <div className="avatar">{user.username[0]?.toUpperCase()}</div>
              {user.username}
            </div>
            <button className="btn btn-secondary" onClick={handleLogout} style={{ padding: "8px 16px", fontSize: "0.85rem" }}>
              Logout
            </button>
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, maxWidth: 800, margin: "0 auto" }}>
          {/* Create Quiz */}
          <div className="glass-card animate-slide-up" style={{ padding: 40, textAlign: "center" }}>
            <div style={{ fontSize: "3rem", marginBottom: 16 }}>🎯</div>
            <h2 style={{ fontSize: "1.4rem", fontWeight: 700, marginBottom: 8 }}>
              Create a Quiz
            </h2>
            <p style={{ color: "var(--muted-light)", marginBottom: 24, fontSize: "0.9rem" }}>
              Build your own quiz and host it for friends
            </p>
            <button
              className="btn btn-primary btn-lg"
              style={{ width: "100%" }}
              onClick={() => router.push("/create")}
            >
              Create Quiz
            </button>
          </div>

          {/* Join Room */}
          <div className="glass-card animate-slide-up delay-100" style={{ padding: 40, textAlign: "center" }}>
            <div style={{ fontSize: "3rem", marginBottom: 16 }}>🎮</div>
            <h2 style={{ fontSize: "1.4rem", fontWeight: 700, marginBottom: 8 }}>
              Join a Game
            </h2>
            <p style={{ color: "var(--muted-light)", marginBottom: 24, fontSize: "0.9rem" }}>
              Enter a room code to join a live quiz
            </p>
            <form onSubmit={handleJoinRoom}>
              <input
                className="input input-lg"
                type="text"
                placeholder="ROOM CODE"
                maxLength={6}
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                style={{ marginBottom: 12 }}
              />
              <button
                className="btn btn-primary btn-lg"
                style={{ width: "100%" }}
                type="submit"
                disabled={roomCode.length < 6}
              >
                Join Game
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
