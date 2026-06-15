import { Register } from './Register'

describe('<Register>', () => {

  it('mounts', () => {
    cy.mount(<Register />)
  })

  it('does not register without agreeing on terms', () => {
    cy.mount(<Register />)

    cy.get('[data-cy=submit-register]').click()
    cy.get('[data-cy=alert]').should('exist')
  })

})