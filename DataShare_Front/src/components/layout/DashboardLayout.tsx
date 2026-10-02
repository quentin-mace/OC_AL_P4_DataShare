import { Link, NavLink, Outlet } from 'react-router'
import { paths } from '../../routes/paths'
import { Copyright } from './Copyright'

// Gabarit de l'espace personnel : sidebar en dégradé, barre du haut, contenu.
// Le menu mobile (sidebar repliable) viendra avec la page Mes fichiers.
export function DashboardLayout() {
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
        <header className="flex h-12 items-center justify-end border-b border-row-border bg-canvas-strong px-6" />
        <main className="flex-1 p-5">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
