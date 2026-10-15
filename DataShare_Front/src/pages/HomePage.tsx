import { CloudUpload } from 'lucide-react'
import { useState } from 'react'
import { useIsAuthenticated } from '../auth/authStore'
import { UploadDialog } from '../components/upload/UploadDialog'

// Envoi sans compte (US07). Un utilisateur connecté qui passe par ici fait un
// envoi ordinaire (US01), rattaché à son compte : il garde donc ses tags.
export function HomePage() {
  const isAuthenticated = useIsAuthenticated()
  const [uploadOpen, setUploadOpen] = useState(false)

  return (
    <div className="flex flex-col items-center gap-8 text-center">
      <h1 className="text-2xl text-ink">Tu veux partager un fichier ?</h1>
      <button
        type="button"
        aria-label="Partager un fichier"
        onClick={() => setUploadOpen(true)}
        className="flex size-14 cursor-pointer items-center justify-center rounded-full bg-upload text-white ring-14 ring-upload/15 transition hover:ring-upload/25 focus-visible:outline-2 focus-visible:outline-offset-16 focus-visible:outline-upload"
      >
        <CloudUpload aria-hidden="true" className="size-7" />
      </button>
      <UploadDialog
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        withTags={isAuthenticated}
      />
    </div>
  )
}
