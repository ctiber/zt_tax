import { AnyAction } from "redux";
import { Action, IUser, UserState } from "../types";
import {
  LOGIN_USER_SUCCESS, 
  LOGIN_USER_FAILURE,
  REQUEST_PASSWORD_RESET_SUCCESS, 
  REQUEST_PASSWORD_RESET_FAILURE ,
  ACTIVATE_ACCOUNT_SUCCESS,
  ACTIVATE_ACCOUNT_FAILURE,
  CHANGE_PASSWORD_SUCCESS,
  CHANGE_PASSWORD_FAILURE,
  CLEAR_USER_ERROR, 
  GET_ALL_USERS_SUCCESS, 
  GET_ALL_USERS_FAILURE, 
  GET_USER_SKILLS_SUCCESS, 
  GET_USER_SKILLS_FAILURE, 
  LOGOUT_USER_SUCCESS, 
  LOGOUT_USER_FAILURE, 
  REGISTER_USER_SUCCESS, 
  REGISTER_USER_FAILURE, 
  UPDATE_USER_SUCCESS,
  UPDATE_USER_FAILURE,
  GET_NBR_THANKS_SUCCESS,
  GET_NBR_THANKS_FAILURE,
  SEND_THANK_FAILURE
} from "./../actions/types";

const initialState = {
  connectedUser: undefined,
  error: undefined,
  passwordResetRequestStatus: undefined,
  activateAccountRequestStatus: undefined,
  changePasswordRequestStatus: undefined,
  users: [],
  userSkills: [],
  thanks: -1
};

export const UserReducer = (state: UserState = initialState, action: AnyAction) => {
  const { type, payload } = (action as Action)
  switch (type) {

    /**
     * ACTIONS
     */
    case LOGIN_USER_SUCCESS:
      return {
        ...state,
        connectedUser: payload.token,
      };
    
    case LOGOUT_USER_SUCCESS:
      return {
        ...state,
        connectedUser: undefined,
      };
    
    case REGISTER_USER_SUCCESS:
      return {
        ...state,
      };
    
    case GET_ALL_USERS_SUCCESS:
      return {
        ...state,
        users: [...payload],
      };

    case UPDATE_USER_SUCCESS:
      return {
        ...state,
        users: state.users.map((user : IUser) => user.user_id === payload.user_id ? payload : user
        ),
      }
    case REQUEST_PASSWORD_RESET_SUCCESS:
      return {
        ...state,
        passwordResetRequestStatus: true
      };
    
    case CHANGE_PASSWORD_SUCCESS:
      return {
        ...state,
        changePasswordRequestStatus: true
      };
    
    case ACTIVATE_ACCOUNT_SUCCESS:
      return {
        ...state,
        activateAccountRequestStatus: true
      };
    
    case GET_USER_SKILLS_SUCCESS:
      return {
        ...state,
        userSkills: payload
      }

    case GET_NBR_THANKS_SUCCESS:
      return{
        ...state,
        thanks: payload.count
      }

    
    /**
     * ERRORS
     */

    case LOGIN_USER_FAILURE:
      return {
        ...state,
        connectedUser: undefined,
        error: payload,
      };

    case LOGOUT_USER_FAILURE:
      return {
        ...state,
        connectedUser: undefined,
        error: "Logout error",
      };

    case REGISTER_USER_FAILURE:
      return {
        ...state,
        error: "Register error",
      };
    
    case GET_USER_SKILLS_FAILURE:
    case SEND_THANK_FAILURE:
    case GET_NBR_THANKS_FAILURE:
    case GET_ALL_USERS_FAILURE:
    case UPDATE_USER_FAILURE:
      return {
        ...state,
        error: payload ? payload : type
      };

    case REQUEST_PASSWORD_RESET_FAILURE:
      return {
        ...state,
        passwordResetRequestStatus: false
      };

    case CHANGE_PASSWORD_FAILURE:
      return {
        ...state,
        changePasswordRequestStatus: false,
        error: payload ? payload : state.error
      };


    
    
    case ACTIVATE_ACCOUNT_FAILURE:
      return {
        ...state,
        activateAccountRequestStatus: state.activateAccountRequestStatus !== undefined ? state.activateAccountRequestStatus : false // does not change the status
      };


    case CLEAR_USER_ERROR:
      return {
        ...state,
        error: undefined,
      };

    default:
      return state;
  }
};
