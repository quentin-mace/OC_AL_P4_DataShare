import { Outlet } from 'react-router'
import { Copyright } from './Copyright'
import { Header } from './Header'

// Gabarit des pages publiques : dégradé de marque, en-tête, contenu centré.
export function PublicLayout() {
  return (
    <div className="flex min-h-screen flex-col bg-linear-to-b from-brand-from to-brand-to px-6 py-4 md:px-14">
      <Header />
      <main className="flex flex-1 items-center justify-center py-8">
        <Outlet />
      </main>
      <Copyright className="hidden text-sm text-white md:block" />
    </div>
  )
}
