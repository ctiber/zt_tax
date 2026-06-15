import { useSelector } from "react-redux";
import { Redirect, Route, RouteProps} from "react-router";
import { connectedUserSelector } from "../../store/selectors";
import { IUser } from "../../store/types";

interface ProtectedRouteProps extends RouteProps {
  allowTeacher?: boolean
}

/**
 * Route component which protects the route from being accessible from students.
 * @param props react-router RouteProps plus one custom attributes allowTeacher (which defaults to true)
 */
export const ProtectedRoute = (
  {
    path,
    component : Component,
    allowTeacher = true
  } : ProtectedRouteProps
  ) => {
    
    
  /**
  * Get connectedUser from Selector
  */
  const connectedUser : IUser | undefined = useSelector(connectedUserSelector);
  
  /**
  * Return true if a user is connected, otherwise false
  * @returns boolean
  */
  function isConnected() {
    if (connectedUser) return true;
    else return false;
  }
  
  
  /**
  * Return true if the connected user is an Admin, otherwise false
  * @returns boolean
  */
  function isAdmin() {
    if (connectedUser && connectedUser.role_id === 1) {
      return true;
    } else {
      return false;
    }
  }
  
  /**
  * Return true if the connected user is an Teacher, otherwise false
  * @returns boolean
  */
  function isTeacher() {
    if (connectedUser && connectedUser.role_id === 2) {
      return true;
    } else {
      return false;
    }
  }
  
  if(!isConnected()){
    return <Redirect to={{pathname:'/login', state: {from: path}}} />
  }
  if( !isTeacher() && !isAdmin() ){
    return <Redirect to='/' />
  }
  if( !allowTeacher && isTeacher()){
    return <Redirect to='/' />
  }
  return <Route exact path={path} component={Component}/>
    
}