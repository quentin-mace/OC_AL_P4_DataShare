import { describe, expect, it } from 'vitest'
import {
  fileExtension,
  MAX_FILE_SIZE,
  parseTags,
  uploadSchema,
  type UploadFormInput,
} from './uploadSchema'

const file = new File(['contenu'], 'rapport.pdf', { type: 'application/pdf' })

const valid: UploadFormInput = { file, password: '', expiresInDays: '7', tags: '' }

// Un vrai fichier de 1 Go ne tient pas en mémoire de test : seule la taille compte.
function fileOfSize(size: number, name = 'video.mp4'): File {
  const big = new File(['x'], name)
  Object.defineProperty(big, 'size', { value: size })
  return big
}

function messagesFor(input: Partial<UploadFormInput>) {
  const result = uploadSchema.safeParse({ ...valid, ...input })
  return result.success
    ? []
    : result.error.issues.map((issue) => [issue.path.join('.'), issue.message])
}

describe('uploadSchema', () => {
  it('accepts a file with the default options', () => {
    expect(uploadSchema.parse(valid)).toEqual({
      file,
      password: undefined,
      expiresInDays: '7',
      tags: [],
    })
  })

  it('requires a file', () => {
    expect(messagesFor({ file: undefined })).toEqual([['file', 'Choisissez un fichier.']])
  })

  it('rejects an empty file', () => {
    expect(messagesFor({ file: new File([], 'vide.txt') })).toEqual([
      ['file', 'Ce fichier est vide.'],
    ])
  })

  it('accepts exactly 1 GB but not one byte more', () => {
    expect(messagesFor({ file: fileOfSize(MAX_FILE_SIZE) })).toEqual([])
    expect(messagesFor({ file: fileOfSize(MAX_FILE_SIZE + 1) })).toEqual([
      ['file', 'Le fichier ne peut pas dépasser 1 Go.'],
    ])
  })

  it.each(['setup.exe', 'SCRIPT.JS', 'archive.tar.sh'])('rejects the forbidden file %s', (name) => {
    expect(messagesFor({ file: new File(['x'], name) })).toEqual([
      ['file', `Les fichiers .${fileExtension(name)} ne sont pas acceptés.`],
    ])
  })

  it.each(['notes', 'photo.jpeg', 'exe.txt'])('accepts the file %s', (name) => {
    expect(messagesFor({ file: new File(['x'], name) })).toEqual([])
  })

  it('accepts a password of 6 characters or more', () => {
    expect(uploadSchema.parse({ ...valid, password: 'secret' }).password).toBe('secret')
  })

  it('rejects a password shorter than 6 characters', () => {
    expect(messagesFor({ password: 'abcde' })).toEqual([
      ['password', 'Le mot de passe doit contenir au moins 6 caractères.'],
    ])
  })

  it.each(['0', '8', ''])('rejects the duration "%s"', (expiresInDays) => {
    expect(
      messagesFor({ expiresInDays: expiresInDays as UploadFormInput['expiresInDays'] }),
    ).toEqual([['expiresInDays', 'Durée invalide.']])
  })

  it('splits the tags like the back does', () => {
    expect(uploadSchema.parse({ ...valid, tags: ' facture , client-x,, ' }).tags).toEqual([
      'facture',
      'client-x',
    ])
  })

  it('accepts a tag of 30 characters but not 31', () => {
    expect(messagesFor({ tags: 'a'.repeat(30) })).toEqual([])
    expect(messagesFor({ tags: `ok, ${'a'.repeat(31)}` })).toEqual([
      ['tags', `Un tag ne peut pas dépasser 30 caractères ("${'a'.repeat(31)}").`],
    ])
  })

  it('rejects a duplicated tag', () => {
    expect(messagesFor({ tags: 'facture, facture ' })).toEqual([
      ['tags', 'Un même tag ne peut pas être saisi deux fois.'],
    ])
  })
})

describe('parseTags', () => {
  it('returns no tag for a blank field', () => {
    expect(parseTags('  , ')).toEqual([])
  })
})
