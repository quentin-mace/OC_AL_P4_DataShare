import { Link, Outlet } from 'react-router'
import { paths } from '../../routes/paths'
import { Copyright } from './Copyright'

// Gabarit des pages publiques : dégradé de marque, en-tête, contenu centré.
// L'en-tête définitif (composant Header des maquettes) arrive avec les composants UI.
export function PublicLayout() {
  return (
    <div className="flex min-h-screen flex-col bg-linear-to-b from-brand-from to-brand-to px-6 py-4 md:px-14">
      <header className="flex items-center justify-between">
        <Link to={paths.home} className="text-2xl font-bold text-ink">
          DataShare
        </Link>
        <Link to={paths.login} className="rounded-control bg-dark px-3 py-1.5 text-sm text-white">
          Se connecter
        </Link>
      </header>
      <main className="flex flex-1 items-center justify-center py-8">
        <Outlet />
      </main>
      <Copyright className="hidden text-sm text-white md:block" />
    </div>
  )
}
