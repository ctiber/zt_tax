import { Footer } from './Footer'

describe('<Footer>', () => {
  

  it('mounts', () => {
    cy.mount(<Footer />)
  })

  it('changes languages', () => {
    cy.mount(<Footer />)
    // Language change
    cy.get('footer').contains('a').first().should('have.text', "Terms and conditions")
    cy.get('[data-cy=french-flag-button]').click()
    cy.get('footer').contains('a').first().should('have.text', "Conditions Générales d'Utilisation")
    cy.get('[data-cy=english-flag-button]').click()
    cy.get('footer').contains('a').first().should('have.text', "Terms and conditions")
  })
})

export {}