import { useEffect, useId, useRef, useState } from 'react'
import { useOutletContext } from 'react-router'
import { listFiles, type FileHistoryItem } from '../api/files'
import { DeleteFileDialog } from '../components/files/DeleteFileDialog'
import { FileRow } from '../components/files/FileRow'
import type { DashboardContext } from '../components/layout/DashboardLayout'
import { Button } from '../components/ui/Button'
import { Callout } from '../components/ui/Callout'
import { Switch } from '../components/ui/Switch'
import { Tag } from '../components/ui/Tag'

type Filter = 'all' | 'active' | 'expired'

const filters: { value: Filter; label: string; empty: string }[] = [
  { value: 'all', label: 'Tous', empty: "Vous n'avez encore envoyé aucun fichier." },
  { value: 'active', label: 'Actifs', empty: 'Aucun fichier actif.' },
  { value: 'expired', label: 'Expiré', empty: 'Aucun fichier expiré.' },
]

// Pagination côté client, sur la liste déjà chargée : voir contrat-api.md.
const PAGE_SIZE = 10

type PageState =
  { kind: 'loading' } | { kind: 'loadError' } | { kind: 'ready'; files: FileHistoryItem[] }

export function FilesPage() {
  const { filesVersion } = useOutletContext<DashboardContext>()
  // Après un envoi, la liste affichée reste en place jusqu'à l'arrivée de la
  // nouvelle : pas de retour à "Chargement...", qui la ferait clignoter.
  const [state, setState] = useState<PageState>({ kind: 'loading' })
  const [filter, setFilter] = useState<Filter>('all')
  // Se combine avec le filtre d'état, toujours côté client (US08).
  const [tagFilter, setTagFilter] = useState<string | null>(null)
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)
  const [toDelete, setToDelete] = useState<FileHistoryItem | null>(null)
  const [deleted, setDeleted] = useState<FileHistoryItem | null>(null)
  const headingRef = useRef<HTMLHeadingElement>(null)
  const headingId = useId()

  // Le bouton Supprimer a disparu avec sa ligne : le focus, que la modale lui
  // rendrait, irait se perdre sur <body>. Il va au titre, d'où la liste se
  // reparcourt. L'effet suit le démontage de la modale, donc le close() qui
  // aurait tenté de rendre le focus.
  useEffect(() => {
    if (deleted) headingRef.current?.focus()
  }, [deleted])

  useEffect(() => {
    const controller = new AbortController()

    listFiles({ signal: controller.signal })
      .then((files) => setState({ kind: 'ready', files }))
      .catch(() => {
        if (!controller.signal.aborted) setState({ kind: 'loadError' })
      })

    return () => controller.abort()
  }, [filesVersion])

  function changeFilter(value: Filter) {
    setFilter(value)
    setVisibleCount(PAGE_SIZE)
  }

  function changeTagFilter(tag: string | null) {
    setTagFilter(tag)
    setVisibleCount(PAGE_SIZE)
  }

  // Mise à jour locale, sans recharger : la liste est déjà entière côté client.
  // Un tag qui ne porte plus aucun fichier n'existe plus côté serveur : son
  // filtre n'aurait plus rien à montrer, il est retiré.
  function replaceFiles(update: (files: FileHistoryItem[]) => FileHistoryItem[]) {
    if (state.kind !== 'ready') return
    const files = update(state.files)
    setState({ kind: 'ready', files })
    if (tagFilter && !files.some(({ tags }) => tags.includes(tagFilter))) {
      changeTagFilter(null)
    }
  }

  function handleDeleted(file: FileHistoryItem) {
    replaceFiles((files) => files.filter(({ id }) => id !== file.id))
    setToDelete(null)
    setDeleted(file)
  }

  return (
    <div className="flex flex-col gap-5">
      <h1 id={headingId} ref={headingRef} tabIndex={-1} className="text-2xl font-bold text-ink">
        Mes fichiers
      </h1>
      {deleted && <Callout variant="success">Le fichier {deleted.name} a été supprimé.</Callout>}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <Switch
          label="Filtrer les fichiers"
          options={filters}
          value={filter}
          onChange={changeFilter}
        />
        {tagFilter && (
          <p className="flex min-w-0 items-center gap-1.5 text-sm">
            Filtré sur le tag
            <Tag
              name={tagFilter}
              onRemove={() => changeTagFilter(null)}
              removeLabel={`Retirer le filtre sur le tag ${tagFilter}`}
            />
          </p>
        )}
      </div>
      {state.kind === 'loading' && (
        <output className="text-sm text-ink-muted">Chargement...</output>
      )}
      {state.kind === 'loadError' && (
        <Callout variant="error">
          Impossible de charger vos fichiers pour le moment, réessayez plus tard.
        </Callout>
      )}
      {state.kind === 'ready' && (
        <FileList
          files={state.files}
          labelledBy={headingId}
          filter={filter}
          tagFilter={tagFilter}
          visibleCount={visibleCount}
          onShowMore={() => setVisibleCount((count) => count + PAGE_SIZE)}
          onDelete={setToDelete}
          onTagSelect={changeTagFilter}
        />
      )}
      <DeleteFileDialog
        file={toDelete}
        onClose={() => setToDelete(null)}
        onDeleted={handleDeleted}
      />
    </div>
  )
}

interface FileListProps {
  files: FileHistoryItem[]
  /** Titre de la page, qui nomme la liste : chaque ligne contient sa liste de tags. */
  labelledBy: string
  filter: Filter
  tagFilter: string | null
  visibleCount: number
  onShowMore: () => void
  onDelete: (file: FileHistoryItem) => void
  onTagSelect: (tag: string) => void
}

function FileList({
  files,
  labelledBy,
  filter,
  tagFilter,
  visibleCount,
  onShowMore,
  onDelete,
  onTagSelect,
}: FileListProps) {
  const matching = files.filter(
    (file) =>
      (filter === 'all' || file.status === filter) &&
      (tagFilter === null || file.tags.includes(tagFilter)),
  )

  if (matching.length === 0) {
    // Le tag filtré porte toujours au moins un fichier : seul le cumul des
    // deux filtres peut vider la liste.
    const { empty } = filters.find(({ value }) => value === filter)!
    return (
      <p className="text-sm">{tagFilter ? 'Aucun fichier ne correspond à ces filtres.' : empty}</p>
    )
  }

  return (
    <>
      <ul aria-labelledby={labelledBy} className="flex flex-col gap-3">
        {matching.slice(0, visibleCount).map((file) => (
          <FileRow key={file.id} file={file} onDelete={onDelete} onTagSelect={onTagSelect} />
        ))}
      </ul>
      {matching.length > visibleCount && (
        <Button className="self-center" onClick={onShowMore}>
          Afficher plus
        </Button>
      )}
    </>
  )
}
