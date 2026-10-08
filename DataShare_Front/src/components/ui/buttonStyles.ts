import { joinClassNames } from './joinClassNames'

export type ButtonVariant = 'tinted' | 'outline' | 'ghost' | 'dark'
export type ButtonSize = 'sm' | 'md'

export interface ButtonStyleOptions {
  variant?: ButtonVariant
  size?: ButtonSize
  fullWidth?: boolean
}

// Chaque variante porte son état désactivé, tel que dessiné dans UI_components.png.
// "enabled:" limite le survol et le curseur main aux boutons actifs.
const variants: Record<ButtonVariant, string> = {
  tinted:
    'border-accent-border bg-accent-soft text-accent-strong enabled:hover:brightness-97 disabled:border-transparent disabled:bg-disabled disabled:text-disabled-ink',
  outline:
    'border-accent-border text-accent enabled:hover:bg-accent-soft disabled:border-disabled-ink/60 disabled:text-disabled-ink',
  // Fond translucide au survol : posé sur canvas-strong (barre de l'espace
  // personnel), accent-soft serait de la même teinte, donc invisible.
  ghost:
    'border-transparent text-accent enabled:hover:bg-accent/10 enabled:hover:text-accent-strong disabled:text-disabled-ink',
  dark: 'border-transparent bg-dark text-white enabled:hover:bg-ink disabled:bg-disabled/50 disabled:text-disabled-ink',
}

const sizes: Record<ButtonSize, string> = {
  sm: 'h-7 gap-1 px-2.5 text-xs',
  md: 'h-9 gap-1.5 px-3.5 text-sm',
}

/**
 * Classes d'un bouton, séparées du composant pour habiller aussi un lien
 * (<Link>) : un lien qui navigue doit rester un lien, pas un bouton.
 */
export function buttonStyles({
  variant = 'tinted',
  size = 'md',
  fullWidth = false,
}: ButtonStyleOptions = {}): string {
  return joinClassNames(
    'inline-flex items-center justify-center rounded-control border font-medium transition',
    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
    // Tailwind 4 rend aux boutons le curseur par défaut du navigateur, la flèche.
    'enabled:cursor-pointer disabled:cursor-not-allowed',
    variants[variant],
    sizes[size],
    fullWidth && 'w-full',
  )
}
