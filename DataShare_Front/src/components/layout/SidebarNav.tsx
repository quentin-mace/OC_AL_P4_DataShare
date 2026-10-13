import { NavLink } from 'react-router'
import { paths } from '../../routes/paths'

export interface SidebarNavProps {
  /** Appelé au clic sur un lien, pour refermer le menu mobile. */
  onNavigate?: () => void
}

/** Liens de l'espace personnel, partagés par la sidebar desktop et le menu mobile. */
export function SidebarNav({ onNavigate }: SidebarNavProps) {
  return (
    <nav aria-label="Navigation principale" className="mt-10 flex-1">
      <NavLink
        to={paths.files}
        onClick={onNavigate}
        className="block rounded-control bg-white/40 px-3 py-2 text-sm font-semibold text-accent-strong"
      >
        Mes fichiers
      </NavLink>
    </nav>
  )
}
