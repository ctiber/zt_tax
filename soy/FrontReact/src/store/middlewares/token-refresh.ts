import { AnyAction, Dispatch } from "redux";
import http from "../../http-common";
import { LOGOUT_USER_FAILURE, LOGOUT_USER_SUCCESS } from "../actions";

let time : number;

export const tokenRefresher = (store : any) => (next : Dispatch<AnyAction>) => async (action : any) =>  {
  if(action.type === LOGOUT_USER_SUCCESS || action.type === LOGOUT_USER_FAILURE) return next(action) // Do not verify on logout

  if(time === undefined || Date.now() - time > 5000){ // Only refresh every 5 seconds
    //console.log("Refreshing token...");
    
    await http.get('/api/auth/verify')
    time = Date.now();
  }
  return next(action)
}