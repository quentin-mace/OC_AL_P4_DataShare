export interface ProgressBarProps {
  label: string
  /** Avancement, de 0 à 100. */
  value: number
}

// <progress> natif : rôle et valeur annoncés sans ARIA à écrire. Sa barre ne
// se style que par pseudo-éléments, propres à chaque moteur.
export function ProgressBar({ label, value }: ProgressBarProps) {
  const percent = Math.min(100, Math.max(0, Math.round(value)))

  return (
    <div>
      <div className="mb-1 flex justify-between text-xs text-ink-muted">
        <span>{label}</span>
        <span aria-hidden="true">{percent} %</span>
      </div>
      <progress
        aria-label={label}
        max={100}
        value={percent}
        className="block h-2 w-full appearance-none overflow-hidden rounded-full bg-accent-soft [&::-moz-progress-bar]:bg-accent [&::-webkit-progress-bar]:bg-accent-soft [&::-webkit-progress-value]:bg-accent [&::-webkit-progress-value]:transition-[width]"
      />
    </div>
  )
}
