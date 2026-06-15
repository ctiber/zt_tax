import { UsersList } from "./UsersList";
import users from '../../../cypress/fixtures/users/users.json'

describe('<UsersList>', () => {

  beforeEach(() => {
    cy.intercept('/api/auth/verify', { statusCode: 200 })
  })

  it('mounts', () => {
    cy.mount(<UsersList />)
  })

})