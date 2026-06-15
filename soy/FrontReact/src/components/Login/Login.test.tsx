import {Login} from "./Login";


describe("<App>" ,() => {
  it("mounts", () => {
    cy.mount(<Login />)
  });
})



