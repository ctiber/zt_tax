import React, { ComponentType } from 'react'
import configureStore from '.'
import { CircularProgress } from '@material-ui/core'

/**
 * HOC Component injecting the required reducers before rendering the component
 * @param reducers 
 * @returns 
 */
export const withReducer = ( reducers  : {key: string, reducer: any}[]) => (WrappedComponent : ComponentType<any>) => {
  class Extended extends React.Component{
    static WrappedComponent : ComponentType<any> = WrappedComponent
    state = {
      storeLoaded : false
    }

    componentDidMount() {
      const store = configureStore()

      reducers.forEach(reducer => {
        store.injectReducer(reducer.key, reducer.reducer)
      })

      this.setState({storeLoaded: true})
    }


    render(){
      if(this.state.storeLoaded) return (<WrappedComponent {...this.props} />)
      else return <CircularProgress color='secondary' />
    }
  }

  return Extended
}

export default withReducer;