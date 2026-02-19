interface PodiumEntry {
  username: string;
  points: number;
}

interface PodiumProps {
  scores: PodiumEntry[];
}

const RANK_LABELS = ["#1", "#2", "#3"];

export function Podium({ scores }: PodiumProps) {
  const top3 = scores.slice(0, 3);
  // Display order: 2nd, 1st, 3rd
  const displayOrder = [
    top3[1] ? { ...top3[1], rank: 1 } : null,
    top3[0] ? { ...top3[0], rank: 0 } : null,
    top3[2] ? { ...top3[2], rank: 2 } : null,
  ];
  const classes = ["podium-2nd", "podium-1st", "podium-3rd"];

  return (
    <div className="podium">
      {displayOrder.map((entry, i) =>
        entry ? (
          <div key={entry.rank} className={`podium-place ${classes[i]}`}>
            <div className="podium-name">{entry.username}</div>
            <div className="podium-bar">{RANK_LABELS[entry.rank]}</div>
            <div className="podium-pts">{entry.points} PTS</div>
          </div>
        ) : null
      )}
    </div>
  );
}
