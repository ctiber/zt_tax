import { ActivateAccount } from "./ActivateAccount";
import configureStore from "../../store"


describe("<ActivateAccount>", () => {

  beforeEach( () => {
    cy.intercept('/api/auth/verify', {statusCode: 200})
  })

  it('mounts', () => {
    cy.mount(<ActivateAccount />)
  })

  it('shows successful message if validated' , () => {
    cy.intercept('/api/user/activate/*', {statusCode: 200})
    
    cy.mount(<ActivateAccount />)

    cy.get('[data-cy=activation-information]').should('have.text', 'Your account has been activated ! You can now log into it.')
  })

  it('shows error message if invalid token', () => {
    configureStore().resetStore()
    cy.intercept('/api/user/activate/*', {statusCode: 400})

    cy.mount(<ActivateAccount />)

    cy.get('[data-cy=activation-information]').should('have.text', 'We could not activate your account, this may be because your link has expired or an error occured. Please contact an administrator.')

  })

})