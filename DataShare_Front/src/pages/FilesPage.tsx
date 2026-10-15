import { useEffect, useId, useRef, useState } from 'react'
import { useOutletContext } from 'react-router'
import { listFiles, type FileHistoryItem } from '../api/files'
import { DeleteFileDialog } from '../components/files/DeleteFileDialog'
import { EditTagsDialog } from '../components/files/EditTagsDialog'
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

function matchesFilters(file: FileHistoryItem, filter: Filter, tagFilter: string | null) {
  return (
    (filter === 'all' || file.status === filter) &&
    (tagFilter === null || file.tags.includes(tagFilter))
  )
}

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
  // Par identifiant : la modale suit les tags du fichier à chaque modification.
  const [editingId, setEditingId] = useState<number | null>(null)
  const [headingFocus, setHeadingFocus] = useState(0)
  const headingRef = useRef<HTMLHeadingElement>(null)
  const headingId = useId()

  const files = state.kind === 'ready' ? state.files : []
  const matching = files.filter((file) => matchesFilters(file, filter, tagFilter))
  const visible = matching.slice(0, visibleCount)
  const editing = files.find(({ id }) => id === editingId) ?? null
  // Un tag n'existe que tant qu'un fichier le porte, et l'historique est chargé
  // en entier : l'union des tags des fichiers est celle du compte.
  const accountTags = [...new Set(files.flatMap(({ tags }) => tags))].sort((a, b) =>
    a.localeCompare(b, 'fr'),
  )

  // Un tag qui ne porte plus aucun fichier n'existe plus côté serveur : son
  // filtre n'aurait plus rien à montrer, il est retiré. Ajusté pendant le
  // rendu plutôt que dans un effet, qui afficherait d'abord une liste vide.
  if (tagFilter && state.kind === 'ready' && !files.some(({ tags }) => tags.includes(tagFilter))) {
    setTagFilter(null)
    setVisibleCount(PAGE_SIZE)
  }

  // Le bouton qui avait ouvert la modale a disparu avec sa ligne (fichier
  // supprimé, ou qui ne passe plus les filtres) : le focus, que la modale lui
  // rendrait, irait se perdre sur <body>. Il va au titre, d'où la liste se
  // reparcourt. L'effet suit le démontage de la modale, donc le close() qui
  // aurait tenté de rendre le focus.
  useEffect(() => {
    if (headingFocus > 0) headingRef.current?.focus()
  }, [headingFocus])

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
  function updateFiles(update: (files: FileHistoryItem[]) => FileHistoryItem[]) {
    setState((current) =>
      current.kind === 'ready' ? { kind: 'ready', files: update(current.files) } : current,
    )
  }

  function handleDeleted(file: FileHistoryItem) {
    updateFiles((current) => current.filter(({ id }) => id !== file.id))
    setToDelete(null)
    setDeleted(file)
    setHeadingFocus((count) => count + 1)
  }

  function handleTagsChanged(id: number, tags: string[]) {
    updateFiles((current) => current.map((file) => (file.id === id ? { ...file, tags } : file)))
  }

  function closeTags() {
    if (editing && !visible.includes(editing)) setHeadingFocus((count) => count + 1)
    setEditingId(null)
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
          files={visible}
          hasMore={matching.length > visible.length}
          emptyMessage={
            // Le tag filtré porte toujours au moins un fichier : seul le cumul
            // des deux filtres peut vider la liste.
            tagFilter
              ? 'Aucun fichier ne correspond à ces filtres.'
              : filters.find(({ value }) => value === filter)!.empty
          }
          labelledBy={headingId}
          onShowMore={() => setVisibleCount((count) => count + PAGE_SIZE)}
          onDelete={setToDelete}
          onEditTags={(file) => setEditingId(file.id)}
          onTagSelect={changeTagFilter}
        />
      )}
      <DeleteFileDialog
        file={toDelete}
        onClose={() => setToDelete(null)}
        onDeleted={handleDeleted}
      />
      <EditTagsDialog
        file={editing}
        accountTags={accountTags}
        onClose={closeTags}
        onTagsChanged={handleTagsChanged}
      />
    </div>
  )
}

interface FileListProps {
  /** Fichiers à afficher, déjà filtrés et paginés par la page. */
  files: FileHistoryItem[]
  hasMore: boolean
  emptyMessage: string
  /** Titre de la page, qui nomme la liste : chaque ligne contient sa liste de tags. */
  labelledBy: string
  onShowMore: () => void
  onDelete: (file: FileHistoryItem) => void
  onEditTags: (file: FileHistoryItem) => void
  onTagSelect: (tag: string) => void
}

function FileList({
  files,
  hasMore,
  emptyMessage,
  labelledBy,
  onShowMore,
  onDelete,
  onEditTags,
  onTagSelect,
}: FileListProps) {
  if (files.length === 0) {
    return <p className="text-sm">{emptyMessage}</p>
  }

  return (
    <>
      <ul aria-labelledby={labelledBy} className="flex flex-col gap-3">
        {files.map((file) => (
          <FileRow
            key={file.id}
            file={file}
            onDelete={onDelete}
            onEditTags={onEditTags}
            onTagSelect={onTagSelect}
          />
        ))}
      </ul>
      {hasMore && (
        <Button className="self-center" onClick={onShowMore}>
          Afficher plus
        </Button>
      )}
    </>
  )
}
