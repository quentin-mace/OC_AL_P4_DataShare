import axios, { isAxiosError } from 'axios'

type TokenProvider = () => string | null
type UnauthorizedHandler = () => void

let getToken: TokenProvider = () => null
let onUnauthorized: UnauthorizedHandler = () => {}

/**
 * Branche la source du JWT sans que le client en dépende : le store
 * d'authentification s'y enregistrera, et les tests y injectent un token.
 */
export function setTokenProvider(provider: TokenProvider): void {
  getToken = provider
}

/** Branche la réaction à un token refusé par l'API, sur le même principe. */
export function setUnauthorizedHandler(handler: UnauthorizedHandler): void {
  onUnauthorized = handler
}

// Pas de Content-Type par défaut : axios le déduit du corps, et le fixer en
// JSON casserait l'upload multipart, dont la frontière doit être générée.
export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  headers: { Accept: 'application/json' },
})

// L'en-tête n'est ajouté qu'avec un token : sur POST /files, un Authorization
// invalide renvoie 401 au lieu d'un envoi anonyme.
apiClient.interceptors.request.use((config) => {
  const token = getToken()
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Un 401 ne met fin à la session que s'il répond à une requête authentifiée :
// POST /login (identifiants faux) et POST /downloads/{token} (mot de passe du
// fichier faux) renvoient aussi 401, sans que le token soit en cause.
// L'erreur est toujours propagée, l'appelant reste maître de son affichage.
apiClient.interceptors.response.use(undefined, (error: unknown) => {
  if (
    isAxiosError(error) &&
    error.response?.status === 401 &&
    error.config?.headers?.Authorization
  ) {
    onUnauthorized()
  }
  return Promise.reject(error)
})
