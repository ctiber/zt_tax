
import {Toast} from "./Toast";


describe("<App>" ,() => {


  it("mounts", () => {
    cy.mount(<Toast message="testing" severity="error"/>)
  });

  it('clears state', () => {
    let message = "this is an error message"
    expect(message).to.eq('this is an error message')

    cy.mount(<Toast message={message} severity="error" clearState={ () => message= ""}/>)
    
    cy.wait(5000).then( () => {
      expect(message).to.eq('')
    })
  })

  const alertComponent = '[data-cy=alert]'

  it('shows translated message', () => {
    let key = "CONNECT"
    cy.mount(<Toast message={key} severity="error"/>)

    cy.get(alertComponent).should('have.text', 'Log in')

  })

})



