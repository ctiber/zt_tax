import { AnyAction, Dispatch } from "redux";

export const logger = (store : any) => (next : Dispatch<AnyAction>) => (action :any) => {
  //console.log('dispatching ', action);
  let result = next(action)
  //console.log('next state ', store.getState());
  return result
}