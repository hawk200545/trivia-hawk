interface PlayerChipProps {
  username: string;
  connected?: boolean;
  isYou?: boolean;
  isHost?: boolean;
}

export function PlayerChip({ username, connected = true, isYou, isHost }: PlayerChipProps) {
  return (
    <div className={`player-chip ${isYou ? "is-you" : ""} ${!connected ? "disconnected" : ""}`}>
      <div className="avatar">{username[0]?.toUpperCase()}</div>
      <span>
        {username}
        {isHost && <span style={{ color: "var(--accent-amber)", marginLeft: 4 }}>HOST</span>}
        {isYou && <span style={{ color: "var(--accent-blue)", marginLeft: 4 }}>YOU</span>}
      </span>
      <span className={`status-dot ${connected ? "connected" : ""}`} />
    </div>
  );
}
