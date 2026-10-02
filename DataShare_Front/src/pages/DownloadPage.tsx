import { useParams } from 'react-router'

export function DownloadPage() {
  // Le token servira à interroger GET /downloads/{downloadToken} (US02).
  const { downloadToken } = useParams()

  return (
    <h1 className="text-2xl font-bold text-ink" data-download-token={downloadToken}>
      Télécharger un fichier
    </h1>
  )
}
