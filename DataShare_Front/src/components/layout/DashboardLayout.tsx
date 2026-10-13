import { LogOut, Menu } from 'lucide-react'
import { useState } from 'react'
import { Link, Outlet, useNavigate } from 'react-router'
import { useAuthStore } from '../../auth/authStore'
import { paths } from '../../routes/paths'
import { Button } from '../ui/Button'
import { UploadDialog } from '../upload/UploadDialog'
import { Copyright } from './Copyright'
import { MobileMenu } from './MobileMenu'
import { SidebarNav } from './SidebarNav'

/** Contexte transmis aux pages de l'espace personnel par <Outlet>. */
export interface DashboardContext {
  /** Change à chaque fichier envoyé : la liste s'en sert pour se recharger. */
  filesVersion: number
}

// Gabarit de l'espace personnel : sidebar en dégradé, barre du haut, contenu.
// Sur mobile, la sidebar laisse place à un menu repliable, ouvert par le burger.
export function DashboardLayout() {
  const navigate = useNavigate()
  const logout = useAuthStore((auth) => auth.logout)
  const [uploadOpen, setUploadOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [filesVersion, setFilesVersion] = useState(0)

  // Quitter la page avant d'effacer le token, sinon la garde réagit la première
  // et renvoie vers la connexion. flushSync est indispensable : le routeur
  // applique une navigation en transition, donc après la mise à jour du store,
  // même attendue avec await.
  function handleLogout() {
    void navigate(paths.home, { flushSync: true })
    logout()
  }

  return (
    <div className="flex min-h-screen bg-canvas">
      <aside className="hidden w-56 shrink-0 flex-col bg-linear-to-b from-brand-from to-brand-to p-5 md:flex">
        <Link to={paths.home} className="text-2xl font-bold text-white">
          DataShare
        </Link>
        <SidebarNav />
        <Copyright className="text-sm text-white" />
      </aside>
      <div className="flex flex-1 flex-col">
        <header className="flex h-12 items-center gap-3 border-b border-row-border bg-canvas-strong px-4 md:px-6">
          <Button
            variant="ghost"
            size="sm"
            aria-label="Ouvrir le menu"
            aria-expanded={menuOpen}
            className="md:hidden"
            onClick={() => setMenuOpen(true)}
          >
            <Menu aria-hidden="true" className="size-5" />
          </Button>
          <Button variant="dark" size="sm" className="ml-auto" onClick={() => setUploadOpen(true)}>
            Ajouter des fichiers
          </Button>
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
          <Outlet context={{ filesVersion } satisfies DashboardContext} />
        </main>
      </div>
      <MobileMenu open={menuOpen} onClose={() => setMenuOpen(false)} />
      <UploadDialog
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        onUploaded={() => setFilesVersion((version) => version + 1)}
      />
    </div>
  )
}
