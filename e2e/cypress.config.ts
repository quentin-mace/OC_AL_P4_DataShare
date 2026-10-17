import { rmSync } from 'node:fs'
import { defineConfig } from 'cypress'

// Les tests visent l'application entiere telle que la stack compose la sert :
// le front, l'API et le stockage S3 (URL presignee du telechargement). Pour viser
// une autre instance : cypress run --config baseUrl=... --expose apiUrl=...
export default defineConfig({
  e2e: {
    baseUrl: 'http://localhost:5173',
    specPattern: 'cypress/e2e/**/*.cy.ts',
    supportFile: 'cypress/support/e2e.ts',
    setupNodeEvents(on, config) {
      on('task', {
        // Un telechargement precedent du meme nom fausserait la verification.
        clearDownloads() {
          rmSync(config.downloadsFolder, { recursive: true, force: true })
          return null
        },
      })
    },
  },
  // Valeur publique lue par les specs (Cypress.expose remplace Cypress.env en v16).
  expose: {
    apiUrl: 'http://localhost:8080/api',
  },
  downloadsFolder: 'cypress/downloads',
  video: false,
  // Un upload de quelques octets traverse front, API et S3 : la marge par
  // defaut (4 s) est juste sur un runner de CI qui demarre a froid.
  defaultCommandTimeout: 10000,
  retries: { runMode: 1, openMode: 0 },
})
