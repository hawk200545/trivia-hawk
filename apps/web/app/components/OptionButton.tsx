export type OptionState = "idle" | "selected" | "correct" | "incorrect";

interface OptionButtonProps {
  letter: string;
  text: string;
  state?: OptionState;
  disabled?: boolean;
  onClick?: () => void;
}

export function OptionButton({ letter, text, state = "idle", disabled, onClick }: OptionButtonProps) {
  return (
    <button
      className={`option-btn ${state !== "idle" ? state : ""}`}
      disabled={disabled}
      onClick={onClick}
    >
      <span className="option-letter">{letter}</span>
      <span>{text}</span>
    </button>
  );
}
