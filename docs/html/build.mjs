// Rend le README en une page HTML autonome, lisible hors ligne par simple
// double-clic. Lancer "make html" depuis la racine du depot.
//
// marked est appele par npx et n'est pas une dependance du projet : aucun des
// trois package.json n'a a connaitre cet outil de documentation.

import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const MARKED_VERSION = 'marked@16'

const here = dirname(fileURLToPath(import.meta.url))
const repoRoot = join(here, '..', '..')

const readmePath = join(repoRoot, 'README.md')
const templatePath = join(here, 'template.html')
const outputPath = join(here, 'index.html')

const markdown = readFileSync(readmePath, 'utf8')

// Le README vit a la racine, la page generee deux niveaux plus bas. Ses liens
// relatifs vers docs/ pointeraient donc a cote ; on les ramene sur leur cible.
const relocated = markdown.replace(/\]\((?!https?:|#|\/)([^)]+)\)/g, (match, target) => {
  if (target.startsWith('docs/html/')) {
    return `](${target.slice('docs/html/'.length)})`
  }

  return `](${target.startsWith('docs/') ? `../${target.slice('docs/'.length)}` : `../../${target}`})`
})

const body = execFileSync('npx', ['--yes', MARKED_VERSION, '--gfm'], {
  input: relocated,
  encoding: 'utf8',
  cwd: repoRoot,
})

const template = readFileSync(templatePath, 'utf8')

if (!template.includes('<!--CONTENT-->')) {
  throw new Error(`${templatePath} ne contient plus le marqueur <!--CONTENT-->`)
}

writeFileSync(outputPath, template.replace('<!--CONTENT-->', body.trim()))

console.log(`Ecrit ${outputPath}`)
