import { FileText } from 'lucide-react'
import { formatFileSize } from '../../format/fileSize'
import { joinClassNames } from './joinClassNames'

export interface FileSummaryProps {
  name: string
  /** Taille en octets. */
  size: number
  className?: string
}

/** Icône, nom et taille d'un fichier, le nom tronqué s'il déborde. */
export function FileSummary({ name, size, className }: FileSummaryProps) {
  return (
    <div className={joinClassNames('flex items-center gap-3', className)}>
      <FileText aria-hidden="true" className="size-5 shrink-0 text-ink" />
      <div className="min-w-0">
        <p className="truncate text-sm text-ink" title={name}>
          {name}
        </p>
        <p className="text-xs text-ink-muted">{formatFileSize(size)}</p>
      </div>
    </div>
  )
}
