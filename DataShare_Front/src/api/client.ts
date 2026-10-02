import axios from 'axios'

type TokenProvider = () => string | null

let getToken: TokenProvider = () => null

/**
 * Branche la source du JWT sans que le client en dépende : le store
 * d'authentification s'y enregistrera, et les tests y injectent un token.
 */
export function setTokenProvider(provider: TokenProvider): void {
  getToken = provider
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
