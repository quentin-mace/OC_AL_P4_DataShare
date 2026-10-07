import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { setTokenProvider, setUnauthorizedHandler } from '../api/client'
import { isTokenExpired } from './jwt'

interface AuthState {
  token: string | null
  /** Vrai quand la session a pris fin sans que l'utilisateur se déconnecte. */
  sessionExpired: boolean
  login: (token: string) => void
  logout: (options?: { expired?: boolean }) => void
}

// localStorage : la session survit au rechargement et à la fermeture de
// l'onglet, jusqu'à l'expiration du token (une heure). Choix argumenté dans
// tech_stack.md, section "Stockage du JWT".
export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      sessionExpired: false,
      login: (token) => set({ token, sessionExpired: false }),
      logout: ({ expired = false } = {}) => set({ token: null, sessionExpired: expired }),
    }),
    { name: 'datashare-auth', partialize: ({ token }) => ({ token }) },
  ),
)

function expireSession(): void {
  useAuthStore.getState().logout({ expired: true })
}

/** Le token s'il est encore valable. Un token périmé met fin à la session. */
function currentToken(): string | null {
  const { token } = useAuthStore.getState()
  if (token && isTokenExpired(token)) {
    expireSession()
    return null
  }
  return token
}

export function useIsAuthenticated(): boolean {
  return useAuthStore((state) => state.token !== null && !isTokenExpired(state.token))
}

// localStorage étant synchrone, le store est déjà réhydraté ici : un token
// expiré depuis la dernière visite est écarté avant le premier rendu.
currentToken()

// Le client HTTP lit le token et signale ses refus sans dépendre du store.
// Sans token valable, la requête part sans Authorization, et la session
// prend fin pour que la garde renvoie vers la connexion.
setTokenProvider(currentToken)
setUnauthorizedHandler(expireSession)
