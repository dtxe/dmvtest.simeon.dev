interface ProgressProps {
  value: number;
  label: string;
}

export function Progress({ value, label }: ProgressProps) {
  const normalized = Math.min(100, Math.max(0, value));
  return (
    <div
      aria-label={label}
      aria-valuemax={100}
      aria-valuemin={0}
      aria-valuenow={Math.round(normalized)}
      className="progress"
      role="progressbar"
    >
      <span style={{ width: `${normalized}%` }} />
    </div>
  );
}
