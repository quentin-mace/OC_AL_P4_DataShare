import { uniqueUser } from '../support/data'

describe('Inscription et connexion', () => {
  it("cree un compte depuis le formulaire puis s'y connecte", () => {
    const user = uniqueUser()

    cy.visit('/register')
    cy.findByRole('heading', { name: 'Créer un compte' })
    cy.findByLabelText('Email').type(user.email)
    cy.findByLabelText('Prénom').type(user.firstName)
    cy.findByLabelText('Nom').type(user.lastName)
    cy.findByLabelText('Mot de passe').type(user.password, { log: false })
    cy.findByLabelText('Vérification du mot de passe').type(user.password, { log: false })
    cy.findByRole('button', { name: 'Créer mon compte' }).click()

    cy.location('pathname').should('eq', '/login')
    cy.contains('Compte créé, vous pouvez vous connecter.')

    cy.findByLabelText('Email').type(user.email)
    cy.findByLabelText('Mot de passe').type(user.password, { log: false })
    cy.findByRole('button', { name: 'Connexion' }).click()

    cy.location('pathname').should('eq', '/files')
    cy.findByRole('button', { name: 'Déconnexion' })
  })

  it('refuse un mot de passe incorrect', () => {
    const user = uniqueUser()
    cy.registerViaApi(user)

    cy.visit('/login')
    cy.findByLabelText('Email').type(user.email)
    cy.findByLabelText('Mot de passe').type('pas-le-bon-mot-de-passe')
    cy.findByRole('button', { name: 'Connexion' }).click()

    cy.contains('Email ou mot de passe incorrect.')
    cy.location('pathname').should('eq', '/login')
  })

  it("renvoie vers la connexion l'acces a l'espace personnel sans session", () => {
    cy.visit('/files')
    cy.location('pathname').should('eq', '/login')
  })
})
