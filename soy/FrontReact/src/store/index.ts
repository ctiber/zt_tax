import { AnyAction, applyMiddleware, combineReducers, createStore, Reducer, Store } from "redux";
import { composeWithDevTools } from "redux-devtools-extension";
import thunk from "redux-thunk";
import { UserReducer } from "./reducers/userReducer";

import { logger } from "./middlewares/logger";
import { tokenRefresher } from './middlewares/token-refresh';


interface customStore extends Store{
  asyncReducers? : any,
  /**
   * Method that injects a new reducer defined by its key to the store.
   * If the key already exists, the method stops otherwise the reducer is injected.
   */
  injectReducer : (key: string, asyncReducer : any) => void,
  /**
   * ONLY AVAILABLE FOR CYPRESS :
   * This method resets the instance of the store.
   */
  resetStore : () => void
}


/**
 * We use a custom store which has additional properties to inject reducers when needed.
 * This custom store is a Singleton.
 */
let instance : customStore;

/**
 * Reducers loaded by default
 */
const staticReducers = {
  user: UserReducer,
}

const createInstance = () : customStore => {
  return {...createStore(createReducer(), composeWithDevTools(
    applyMiddleware(thunk, logger, tokenRefresher),
    )),
    injectReducer: (key : string, asyncReducer : any) => {
      if(instance.asyncReducers){
        if(key in asyncReducer) return;
        instance.asyncReducers[key] = asyncReducer
        instance.replaceReducer(createReducer(instance.asyncReducers))
      }
    },
    resetStore: () => {
      if((window as any).Cypress){
        instance = createInstance()
      }
    }
  }
}

function createReducer(asyncReducers? : Reducer<any, AnyAction>) : Reducer<any, AnyAction>{
  return combineReducers({
    ...staticReducers,
    ...asyncReducers
  })
}


/**
 * Creates an instance of a store if there is none
 * @returns instance of the store
 */
export default function configureStore(){
  if(instance) return instance
  instance = createInstance()

  instance.asyncReducers = {}

  return instance
}
