import { Navigate, Outlet, useLocation } from 'react-router'
import { useIsAuthenticated } from '../auth/authStore'
import type { LoginLocationState } from '../pages/LoginPage'
import { paths } from './paths'

// Garde des routes réservées aux comptes : un visiteur est renvoyé vers la
// connexion, qui le ramènera ici une fois connecté. Elle réagit aussi à une
// session qui prend fin en cours de route (401, token expiré).
export function RequireAuth() {
  const isAuthenticated = useIsAuthenticated()
  const { pathname } = useLocation()

  if (!isAuthenticated) {
    const state: LoginLocationState = { from: pathname }
    return <Navigate to={paths.login} replace state={state} />
  }
  return <Outlet />
}
