/**
 * Lance le téléchargement par une simple navigation : l'URL présignée répond en
 * Content-Disposition attachment, la page reste donc affichée, et aucun appel
 * fetch ne passe par le stockage, qui n'a pas à autoriser le front en CORS.
 */
export function startDownload(url: string): void {
  window.location.assign(url)
}
