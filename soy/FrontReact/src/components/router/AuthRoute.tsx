import { useSelector } from "react-redux";
import { Redirect, Route, RouteProps} from "react-router";
import { connectedUserSelector } from "../../store/selectors";
import { IUser } from "../../store/types";

/**
 * Route component which protects the route from being accessible to non authenticated users
 * @param param0 react-router RouteProps
 * @returns 
 */
export const AuthRoute = (
	{
		path,
		component : Component
	} : RouteProps
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
	
	if(!isConnected()){
		return <Redirect to={{pathname:'/login', state: {from: path}}} />
	}
	return (
		<Route exact path={path} component={Component}/>
	);
}