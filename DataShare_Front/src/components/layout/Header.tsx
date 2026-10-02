import { Link } from 'react-router'
import { paths } from '../../routes/paths'
import { buttonStyles } from '../ui/buttonStyles'

export interface HeaderProps {
  isAuthenticated?: boolean
}

// Les quatre états de la maquette se réduisent à un composant : l'action dépend
// de la connexion, la largeur des marges du breakpoint.
export function Header({ isAuthenticated = false }: HeaderProps) {
  return (
    <header className="flex items-center justify-between gap-4">
      <Link to={paths.home} className="text-2xl font-bold text-ink">
        DataShare
      </Link>
      {isAuthenticated ? (
        <Link to={paths.files} className={buttonStyles({ variant: 'dark', size: 'sm' })}>
          Mon espace
        </Link>
      ) : (
        <Link to={paths.login} className={buttonStyles({ variant: 'dark', size: 'sm' })}>
          Se connecter
        </Link>
      )}
    </header>
  )
}
