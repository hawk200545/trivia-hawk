"use client";

import { useState, useEffect } from "react";

interface RoomCodeProps {
  code: string;
}

export function RoomCode({ code }: RoomCodeProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard not available
    }
  };

  const handleShare = async () => {
    try {
      await navigator.share({
        title: "Join Trivia Hawk",
        text: `Room code: ${code}`,
        url: `${window.location.origin}/room/${code}`,
      });
    } catch {
      // share cancelled or not available
    }
  };

  const [canShare, setCanShare] = useState(false);
  useEffect(() => {
    setCanShare(!!navigator.share);
  }, []);

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
      <div className="room-code">{code.split("").join(" ")}</div>
      <div style={{ display: "flex", gap: 8 }}>
        <button
          className="btn btn-secondary"
          onClick={handleCopy}
          style={{ fontSize: "0.7rem", padding: "4px 12px" }}
        >
          {copied ? "COPIED" : "COPY CODE"}
        </button>
        {canShare && (
          <button
            className="btn btn-secondary"
            onClick={handleShare}
            style={{ fontSize: "0.7rem", padding: "4px 12px" }}
          >
            SHARE
          </button>
        )}
      </div>
    </div>
  );
}
