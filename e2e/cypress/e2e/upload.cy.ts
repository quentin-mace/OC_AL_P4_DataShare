import { apiUrl, DOWNLOAD_LINK, uniqueUser } from '../support/data'

describe('Upload', () => {
  it("partage un fichier sans compte depuis l'accueil", () => {
    cy.visit('/')
    cy.findByRole('button', { name: 'Partager un fichier' }).click()

    cy.findByRole('dialog', { name: 'Ajouter un fichier' }).within(() => {
      // Les tags exigent un compte : le champ n'est pas propose.
      cy.findByLabelText('Tags').should('not.exist')
    })
    cy.uploadFromDialog({ fixture: 'e2e-sample.txt' }).then((link) => {
      expect(link).to.match(DOWNLOAD_LINK)
      const token = DOWNLOAD_LINK.exec(link)![1]

      // Cote API : le lien est actif, sans mot de passe.
      cy.request(`${apiUrl()}/downloads/${token}`).its('body').should('deep.include', {
        name: 'e2e-sample.txt',
        hasPassword: false,
      })
    })
  })

  it("ajoute un fichier tague depuis l'espace personnel", () => {
    const user = uniqueUser()
    cy.registerViaApi(user)
    cy.loginViaApi(user).as('token')

    cy.visit('/files')
    cy.findByRole('button', { name: 'Ajouter des fichiers' }).click()
    cy.uploadFromDialog({ fixture: 'e2e-sample.txt', tags: 'rapport' }).should(
      'match',
      DOWNLOAD_LINK,
    )
    cy.findByRole('dialog', { name: 'Ajouter un fichier' }).within(() => {
      cy.findByRole('button', { name: 'Fermer' }).click()
    })

    cy.contains('li', 'e2e-sample.txt').within(() => {
      cy.findByRole('list', { name: 'Tags' }).should('contain.text', 'rapport')
    })

    // Cote API : le fichier est rattache au compte, avec son tag.
    cy.get<string>('@token').then((token) => {
      cy.request({
        url: `${apiUrl()}/files`,
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      })
        .its('body')
        .should('have.length', 1)
        .its(0)
        .should('deep.include', { name: 'e2e-sample.txt', tags: ['rapport'] })
    })
  })
})
