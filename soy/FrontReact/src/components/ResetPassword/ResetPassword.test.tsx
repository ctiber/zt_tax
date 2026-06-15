import { ResetPassword } from "./ResetPassword";

describe('<ResetPassword>', () => {

  beforeEach( () => {
    cy.intercept('/api/auth/verify', {statusCode: 200})
  })

  it('mounts', () => {
    cy.mount(<ResetPassword />)
  })

  it('should show a message on send and success', () => {
    cy.intercept('/api/user/password', {
      statusCode: 202,
    })

    cy.mount(<ResetPassword />)

    cy.get('[data-cy=resetpassword-button]').click()
    cy.get('[data-cy=reset-information]').should('have.text', "If an account was registered with this email, you will receive a mail on it")
  })

  it('should show an error message on send and api error', () => {
    cy.intercept('/api/user/password', {
      statusCode: 500,
    })

    cy.mount(<ResetPassword />)

    cy.get('[data-cy=resetpassword-button]').click()
    cy.get('[data-cy=reset-error]').should('have.text', "An error occured while trying to send a password reset request for your account")
    
  })

})