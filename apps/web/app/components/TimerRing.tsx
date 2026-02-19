interface TimerRingProps {
  timeLeft: number;
  totalTime: number;
  size?: number;
}

export function TimerRing({ timeLeft, totalTime, size = 120 }: TimerRingProps) {
  const r = (size / 2) - 8;
  const circumference = 2 * Math.PI * r;
  const progress = totalTime > 0 ? (timeLeft / totalTime) * circumference : 0;
  const ratio = totalTime > 0 ? timeLeft / totalTime : 0;

  const timerClass =
    ratio <= 0.2 ? "timer-critical" :
    ratio <= 0.4 ? "timer-warning" :
    "";

  return (
    <div className={`timer-ring ${timerClass}`} style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle className="ring-bg" cx={size / 2} cy={size / 2} r={r} />
        <circle
          className="ring-progress"
          cx={size / 2}
          cy={size / 2}
          r={r}
          strokeDasharray={circumference}
          strokeDashoffset={circumference - progress}
        />
      </svg>
      <div className="timer-text">{timeLeft}</div>
    </div>
  );
}
