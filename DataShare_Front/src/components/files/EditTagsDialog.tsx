import { zodResolver } from '@hookform/resolvers/zod'
import { Check, Pencil, Plus, Trash2 } from 'lucide-react'
import { useEffect, useId, useRef, useState, type ReactNode, type RefObject } from 'react'
import { useForm } from 'react-hook-form'
import { addTag, removeTag, renameTag, type FileHistoryItem, type FileTags } from '../../api/files'
import { getStatus, getViolations } from '../../api/problem'
import {
  TAG_MAX_LENGTH,
  tagSchema,
  type TagFormInput,
  type TagFormValues,
} from '../../validation/tagSchema'
import { Button } from '../ui/Button'
import { Callout } from '../ui/Callout'
import { Input } from '../ui/Input'
import { Modal } from '../ui/Modal'
import { Tag } from '../ui/Tag'

export interface EditTagsDialogProps {
  /** Fichier dont on édite les tags : la modale est ouverte tant qu'il y en a un. */
  file: FileHistoryItem | null
  onClose: () => void
  /** Nouvel état des tags, renvoyé par l'API après chaque modification. */
  onTagsChanged: (id: number, tags: string[]) => void
}

/** Issue d'une requête, du point de vue du formulaire qui l'a lancée. */
type Outcome = { ok: true } | { ok: false; fieldError?: string }

// Le schéma a déjà écarté tout ce que le back refuse : un 422 ne peut venir que
// d'un état du fichier que la page ne connaît pas encore.
const serverTagMessage = `Tag refusé, ${TAG_MAX_LENGTH} caractères maximum et sans doublon sur ce fichier.`

function messageForStatus(status: number | null): string {
  // 404 : le fichier a été supprimé, ou le tag retiré, depuis un autre onglet.
  if (status === 404) return "Ce fichier ou ce tag n'existe plus, rechargez la page."
  return 'Modification impossible pour le moment, réessayez plus tard.'
}

/**
 * Ajout, renommage et retrait des tags d'un fichier (US08). Chaque action part
 * aussitôt vers l'API : il n'y a rien à enregistrer en fermant.
 */
export function EditTagsDialog({ file, onClose, onTagsChanged }: EditTagsDialogProps) {
  const fileNameId = useId()
  const addInputRef = useRef<HTMLInputElement>(null)
  // Boutons des lignes, par action et par tag ("rename:facture").
  const buttons = useRef(new Map<string, HTMLButtonElement>())
  const [renaming, setRenaming] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Bouton à focaliser dès qu'il est rendu et actif : sa ligne revient après
  // un renommage, et les boutons désactivés pendant une requête ont perdu le
  // focus. Chaque action se termine par un rendu (pending, renaming).
  const focusTarget = useRef<string | null>(null)

  useEffect(() => {
    const button = focusTarget.current && buttons.current.get(focusTarget.current)
    if (button && !button.disabled) {
      button.focus()
      focusTarget.current = null
    }
  })

  function buttonRef(key: string) {
    return (button: HTMLButtonElement | null) => {
      if (button) buttons.current.set(key, button)
      else buttons.current.delete(key)
    }
  }

  // Pendant une requête, la modale reste ouverte : la fermer laisserait croire
  // à une annulation alors que la modification peut encore aboutir.
  function close() {
    if (pending) return
    setRenaming(null)
    setError(null)
    onClose()
  }

  async function run(target: FileHistoryItem, request: () => Promise<FileTags>): Promise<Outcome> {
    setPending(true)
    setError(null)
    try {
      const { tags } = await request()
      onTagsChanged(target.id, tags)
      return { ok: true }
    } catch (failure) {
      if (getViolations(failure)?.some(({ propertyPath }) => propertyPath === 'tag')) {
        return { ok: false, fieldError: serverTagMessage }
      }
      // Un 401 ferme la session (intercepteur) : la garde renvoie vers la connexion.
      setError(messageForStatus(getStatus(failure)))
      return { ok: false }
    } finally {
      setPending(false)
    }
  }

  function stopRenaming(tag: string) {
    setRenaming(null)
    focusTarget.current = `rename:${tag}`
  }

  async function rename(target: FileHistoryItem, tag: string, newTag: string): Promise<Outcome> {
    // Même nom : le back répondrait 200 sans rien changer, inutile de l'appeler.
    if (newTag === tag) {
      stopRenaming(tag)
      return { ok: true }
    }
    const outcome = await run(target, () => renameTag(target.id, tag, newTag))
    if (outcome.ok) stopRenaming(newTag)
    return outcome
  }

  async function remove(target: FileHistoryItem, tag: string) {
    // Posé avant la requête : le rendu qui réactive le bouton en cas d'échec
    // peut précéder la suite de cette fonction.
    focusTarget.current = `remove:${tag}`
    const outcome = await run(target, () => removeTag(target.id, tag))
    if (outcome.ok) {
      // La ligne du tag a disparu avec lui : le focus va au champ d'ajout.
      focusTarget.current = null
      addInputRef.current?.focus()
    }
  }

  return (
    <Modal
      open={file !== null}
      title="Tags du fichier"
      descriptionId={fileNameId}
      initialFocus={addInputRef}
      onClose={close}
    >
      {file && (
        <div className="flex flex-col gap-4">
          <p id={fileNameId} className="text-sm font-semibold break-all text-ink">
            {file.name}
          </p>
          {file.tags.length === 0 ? (
            <p className="text-sm">Aucun tag sur ce fichier.</p>
          ) : (
            <ul aria-label="Tags" className="flex flex-col gap-2">
              {file.tags.map((tag) => (
                <li key={tag}>
                  {renaming === tag ? (
                    <TagForm
                      label={`Nouveau nom du tag ${tag}`}
                      defaultValue={tag}
                      focusOnMount
                      taken={file.tags.filter((other) => other !== tag)}
                      pending={pending}
                      submit={
                        <>
                          <Check aria-hidden="true" className="size-4" />
                          <span className="sr-only md:not-sr-only">Valider</span>
                        </>
                      }
                      onSubmit={(newTag) => rename(file, tag, newTag)}
                      onCancel={() => stopRenaming(tag)}
                    />
                  ) : (
                    <div className="flex items-center gap-2">
                      <div className="flex min-w-0 flex-1">
                        <Tag name={tag} />
                      </div>
                      <Button
                        ref={buttonRef(`rename:${tag}`)}
                        variant="ghost"
                        size="sm"
                        aria-label={`Renommer le tag ${tag}`}
                        disabled={pending}
                        onClick={() => setRenaming(tag)}
                      >
                        <Pencil aria-hidden="true" className="size-4" />
                        <span className="hidden md:inline">Renommer</span>
                      </Button>
                      <Button
                        ref={buttonRef(`remove:${tag}`)}
                        variant="ghost"
                        size="sm"
                        aria-label={`Retirer le tag ${tag}`}
                        disabled={pending}
                        onClick={() => void remove(file, tag)}
                      >
                        <Trash2 aria-hidden="true" className="size-4" />
                        <span className="hidden md:inline">Retirer</span>
                      </Button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
          <TagForm
            label="Ajouter un tag"
            taken={file.tags}
            pending={pending}
            inputRef={addInputRef}
            submit={
              <>
                <Plus aria-hidden="true" className="size-4" />
                Ajouter
              </>
            }
            onSubmit={(tag) => run(file, () => addTag(file.id, tag))}
          />
          {error && <Callout variant="error">{error}</Callout>}
        </div>
      )}
    </Modal>
  )
}

interface TagFormProps {
  label: string
  defaultValue?: string
  /** Focalise le champ, texte sélectionné, à l'ouverture d'un renommage. */
  focusOnMount?: boolean
  /** Tags que le fichier porte déjà, refusés comme doublons. */
  taken: string[]
  pending: boolean
  submit: ReactNode
  onSubmit: (tag: string) => Promise<Outcome>
  /** Présent pour un renommage : Échap ou "Annuler" rendent la ligne du tag. */
  onCancel?: () => void
  inputRef?: RefObject<HTMLInputElement | null>
}

/** Saisie d'un seul tag, pour l'ajout comme pour le renommage. */
function TagForm({
  label,
  defaultValue = '',
  focusOnMount = false,
  taken,
  pending,
  submit,
  onSubmit,
  onCancel,
  inputRef,
}: TagFormProps) {
  const {
    register,
    handleSubmit,
    reset,
    setError,
    setFocus,
    formState: { errors },
  } = useForm<TagFormInput, unknown, TagFormValues>({
    resolver: zodResolver(tagSchema(taken)),
    mode: 'onTouched',
    defaultValues: { tag: defaultValue },
  })
  const { ref, ...field } = register('tag')
  // Focus par l'élément lui-même : reset() vide le registre des champs de
  // react-hook-form jusqu'au rendu suivant, setFocus n'y trouverait plus rien.
  const input = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    if (focusOnMount) setFocus('tag', { shouldSelect: true })
  }, [focusOnMount, setFocus])

  async function submitTag({ tag }: TagFormValues) {
    const outcome = await onSubmit(tag)
    if (outcome.ok) {
      reset({ tag: '' })
      // Le champ d'ajout reste prêt pour le tag suivant.
      if (!onCancel) input.current?.focus()
    } else if (outcome.fieldError) {
      setError('tag', { type: 'server', message: outcome.fieldError }, { shouldFocus: true })
    } else {
      input.current?.focus()
    }
  }

  return (
    <form
      noValidate
      onSubmit={(event) => void handleSubmit(submitTag)(event)}
      className="flex items-start gap-2"
    >
      <Input
        label={label}
        autoComplete="off"
        // readOnly et non disabled : un champ désactivé perd le focus.
        readOnly={pending}
        error={errors.tag?.message}
        className="min-w-0 flex-1"
        ref={(element) => {
          ref(element)
          input.current = element
          if (inputRef) inputRef.current = element
        }}
        onKeyDown={(event) => {
          // Échap annule le renommage sans fermer la modale.
          if (onCancel && event.key === 'Escape') {
            event.preventDefault()
            event.stopPropagation()
            onCancel()
          }
        }}
        {...field}
      />
      {/* Aligné sur le champ, sous son label (mb-1 + text-sm). */}
      <div className="mt-6 flex shrink-0 gap-2">
        <Button type="submit" variant="tinted" disabled={pending}>
          {submit}
        </Button>
        {onCancel && (
          <Button variant="outline" disabled={pending} onClick={onCancel}>
            Annuler
          </Button>
        )}
      </div>
    </form>
  )
}
