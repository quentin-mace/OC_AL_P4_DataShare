import { ArrowRight, Lock, Trash2 } from 'lucide-react'
import { Link } from 'react-router'
import type { FileHistoryItem } from '../../api/files'
import { daysUntil, expirationLabel } from '../../format/expiration'
import { paths } from '../../routes/paths'
import { Button } from '../ui/Button'
import { buttonStyles } from '../ui/buttonStyles'
import { Tag } from '../ui/Tag'
import { FileTypeIcon } from './FileTypeIcon'

export interface FileRowProps {
  file: FileHistoryItem
  /** Demande la suppression du fichier ; la confirmation revient à la page. */
  onDelete: (file: FileHistoryItem) => void
  /** Filtre l'historique sur un tag, choisi en cliquant sa pastille. */
  onTagSelect: (tag: string) => void
}

/**
 * Une ligne de l'historique (US05) : type, nom, échéance, tags (US08),
 * cadenas, suppression (US06) et lien de partage.
 */
export function FileRow({ file, onDelete, onTagSelect }: FileRowProps) {
  // L'état vient de l'API, seule à faire foi ; l'échéance n'est qu'un libellé.
  const expired = file.status === 'expired'

  return (
    <li className="flex items-center gap-3 rounded-control border border-row-border bg-row px-3 py-2.5">
      <FileTypeIcon mimeType={file.mimeType} className="size-5 shrink-0 text-ink" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-ink" title={file.name}>
          {file.name}
        </p>
        {expired ? (
          <p className="text-xs text-danger">Expiré</p>
        ) : (
          <p className="text-xs">{expirationLabel(daysUntil(file.expiresAt))}</p>
        )}
        {file.tags.length > 0 && (
          <ul aria-label="Tags" className="mt-1 flex flex-wrap gap-1">
            {file.tags.map((tag) => (
              <li key={tag} className="max-w-full">
                <Tag
                  name={tag}
                  onClick={() => onTagSelect(tag)}
                  clickLabel={`Filtrer sur le tag ${tag}`}
                />
              </li>
            ))}
          </ul>
        )}
      </div>
      {file.hasPassword && (
        <span title="Protégé par mot de passe" className="shrink-0">
          <Lock aria-hidden="true" className="size-4" />
          <span className="sr-only">Protégé par mot de passe</span>
        </span>
      )}
      {expired && (
        <p className="hidden text-xs text-ink-muted/70 md:block">
          Ce fichier a expiré, il n'est plus stocké chez nous
        </p>
      )}
      {/* Aussi sur une ligne expirée, contrairement à la maquette : c'est le seul
          moyen de retirer de l'historique un fichier dont l'objet a été purgé.
          Sur mobile, l'icône seule, comme la flèche d'"Accéder" ci-dessous. */}
      <Button variant="outline" size="sm" onClick={() => onDelete(file)}>
        <Trash2 aria-hidden="true" className="size-4" />
        <span className="sr-only md:not-sr-only">Supprimer</span>
      </Button>
      {!expired && (
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
