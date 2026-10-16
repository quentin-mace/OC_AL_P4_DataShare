const FILE_PASSWORD = 'secret-e2e'

describe('Téléchargement protégé par mot de passe', () => {
  beforeEach(() => {
    cy.task('clearDownloads')
    cy.visit('/')
    cy.findByRole('button', { name: 'Partager un fichier' }).click()
    cy.uploadFromDialog({ fixture: 'e2e-sample.txt', password: FILE_PASSWORD }).then((link) => {
      cy.wrap(new URL(link).pathname).as('downloadPath')
    })
  })

  it('refuse un mauvais mot de passe puis telecharge le fichier avec le bon', () => {
    cy.get<string>('@downloadPath').then((path) => cy.visit(path))
    cy.findByRole('heading', { name: 'Télécharger un fichier' })
    cy.contains('e2e-sample.txt')
    cy.findByRole('button', { name: 'Télécharger' }).should('be.disabled')

    cy.findByLabelText('Mot de passe').type('mauvais-mot-de-passe')
    cy.findByRole('button', { name: 'Télécharger' }).click()
    cy.contains('Mot de passe incorrect.')

    cy.findByLabelText('Mot de passe').clear().type(FILE_PASSWORD)
    cy.findByRole('button', { name: 'Télécharger' }).click()

    // Le navigateur suit l'URL presignee du stockage S3 : le contenu recu doit
    // etre celui envoye, ce qui valide toute la chaine front, API et stockage.
    cy.fixture('e2e-sample.txt').then((expected: string) => {
      cy.readFile(`${Cypress.config('downloadsFolder')}/e2e-sample.txt`).should('eq', expected)
    })
  })
})

describe('Lien de téléchargement inconnu', () => {
  it("annonce que le fichier n'est plus disponible", () => {
    cy.visit(`/download/${'0'.repeat(32)}`)
    cy.contains("Ce fichier n'est plus disponible en téléchargement car il a expiré.")
  })
})
