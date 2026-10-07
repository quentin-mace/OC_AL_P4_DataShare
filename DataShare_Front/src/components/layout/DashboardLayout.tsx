import { LogOut } from 'lucide-react'
import { Link, NavLink, Outlet, useNavigate } from 'react-router'
import { useAuthStore } from '../../auth/authStore'
import { paths } from '../../routes/paths'
import { Button } from '../ui/Button'
import { Copyright } from './Copyright'

// Gabarit de l'espace personnel : sidebar en dégradé, barre du haut, contenu.
// Le menu mobile (sidebar repliable) viendra avec la page Mes fichiers.
export function DashboardLayout() {
  const navigate = useNavigate()
  const logout = useAuthStore((auth) => auth.logout)

  // Quitter la page avant d'effacer le token : sinon la garde réagirait la
  // première et renverrait vers la connexion plutôt que vers l'accueil.
  async function handleLogout() {
    await navigate(paths.home)
    logout()
  }

  return (
    <div className="flex min-h-screen bg-canvas">
      <aside className="hidden w-56 shrink-0 flex-col bg-linear-to-b from-brand-from to-brand-to p-5 md:flex">
        <Link to={paths.home} className="text-2xl font-bold text-white">
          DataShare
        </Link>
        <nav aria-label="Navigation principale" className="mt-10 flex-1">
          <NavLink
            to={paths.files}
            className="block rounded-control bg-white/40 px-3 py-2 text-sm font-semibold text-accent-strong"
          >
            Mes fichiers
          </NavLink>
        </nav>
        <Copyright className="text-sm text-white" />
      </aside>
      <div className="flex flex-1 flex-col">
        <header className="flex h-12 items-center justify-end border-b border-row-border bg-canvas-strong px-6">
          <Button
            variant="ghost"
            size="sm"
            leadingIcon={<LogOut className="size-4" />}
            onClick={handleLogout}
          >
            Déconnexion
          </Button>
        </header>
        <main className="flex-1 p-5">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
