import { useEffect, useRef, useState } from 'react'
import { useOutletContext } from 'react-router'
import { listFiles, type FileHistoryItem } from '../api/files'
import { DeleteFileDialog } from '../components/files/DeleteFileDialog'
import { FileRow } from '../components/files/FileRow'
import type { DashboardContext } from '../components/layout/DashboardLayout'
import { Button } from '../components/ui/Button'
import { Callout } from '../components/ui/Callout'
import { Switch } from '../components/ui/Switch'

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
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)
  const [toDelete, setToDelete] = useState<FileHistoryItem | null>(null)
  const [deleted, setDeleted] = useState<FileHistoryItem | null>(null)
  const headingRef = useRef<HTMLHeadingElement>(null)

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

  // Retrait local, sans recharger : la liste est déjà entière côté client.
  function handleDeleted(file: FileHistoryItem) {
    setState((current) =>
      current.kind === 'ready'
        ? { kind: 'ready', files: current.files.filter(({ id }) => id !== file.id) }
        : current,
    )
    setToDelete(null)
    setDeleted(file)
  }

  return (
    <div className="flex flex-col gap-5">
      <h1 ref={headingRef} tabIndex={-1} className="text-2xl font-bold text-ink">
        Mes fichiers
      </h1>
      {deleted && <Callout variant="success">Le fichier {deleted.name} a été supprimé.</Callout>}
      <div>
        <Switch
          label="Filtrer les fichiers"
          options={filters}
          value={filter}
          onChange={changeFilter}
        />
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
          filter={filter}
          visibleCount={visibleCount}
          onShowMore={() => setVisibleCount((count) => count + PAGE_SIZE)}
          onDelete={setToDelete}
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
  filter: Filter
  visibleCount: number
  onShowMore: () => void
  onDelete: (file: FileHistoryItem) => void
}

function FileList({ files, filter, visibleCount, onShowMore, onDelete }: FileListProps) {
  const matching = filter === 'all' ? files : files.filter((file) => file.status === filter)

  if (matching.length === 0) {
    const { empty } = filters.find(({ value }) => value === filter)!
    return <p className="text-sm">{empty}</p>
  }

  return (
    <>
      <ul className="flex flex-col gap-3">
        {matching.slice(0, visibleCount).map((file) => (
          <FileRow key={file.id} file={file} onDelete={onDelete} />
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
