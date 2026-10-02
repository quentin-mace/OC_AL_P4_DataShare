// Seule source des URLs de l'application : les liens et les redirections
// passent par ici plutôt que par des chaînes écrites à la main.
export const paths = {
  home: '/',
  login: '/login',
  register: '/register',
  files: '/files',
  download: (downloadToken: string) => `/download/${downloadToken}`,
} as const
