import { ArrowRight, Lock } from 'lucide-react'
import { Link } from 'react-router'
import type { FileHistoryItem } from '../../api/files'
import { daysUntil, expirationLabel } from '../../format/expiration'
import { fileIcon } from '../../format/fileIcon'
import { paths } from '../../routes/paths'
import { buttonStyles } from '../ui/buttonStyles'

export interface FileRowProps {
  file: FileHistoryItem
}

/** Une ligne de l'historique (US05) : type, nom, échéance, cadenas et lien de partage. */
export function FileRow({ file }: FileRowProps) {
  const Icon = fileIcon(file.mimeType)
  // L'état vient de l'API, seule à faire foi ; l'échéance n'est qu'un libellé.
  const expired = file.status === 'expired'

  return (
    <li className="flex items-center gap-3 rounded-control border border-row-border bg-row px-3 py-2.5">
      <Icon aria-hidden="true" className="size-5 shrink-0 text-ink" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-ink" title={file.name}>
          {file.name}
        </p>
        {expired ? (
          <p className="text-xs text-danger">Expiré</p>
        ) : (
          <p className="text-xs">{expirationLabel(daysUntil(file.expiresAt))}</p>
        )}
      </div>
      {file.hasPassword && (
        <Lock role="img" aria-label="Protégé par mot de passe" className="size-4 shrink-0" />
      )}
      {expired ? (
        <p className="hidden text-xs text-ink-muted/70 md:block">
          Ce fichier a expiré, il n'est plus stocké chez nous
        </p>
      ) : (
        // Sur mobile, la flèche seule : le libellé reste lu par les lecteurs d'écran.
        <Link
          to={paths.download(file.downloadToken)}
          className={buttonStyles({ variant: 'outline', size: 'sm' })}
        >
          <span className="sr-only md:not-sr-only">Accéder</span>
          <ArrowRight aria-hidden="true" className="size-4" />
        </Link>
      )}
    </li>
  )
}
