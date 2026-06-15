import {
  ADD_BUSINESS_SESSION_SUCCESS, 
  ADD_BUSINESS_SESSION_FAILURE, 
  CLEAR_CURRENT_BUSINESS_SESSION_STATS_ACTION, 
  CLEAR_BUSINESS_SESSION_ERROR, 
  DELETE_BUSINESS_SESSION_SUCCESS, 
  DELETE_BUSINESS_SESSION_FAILURE, 
  GET_ALL_BUSINESS_SESSIONS_SUCCESS,
  GET_ALL_BUSINESS_SESSIONS_FAILURE,
  GET_AVAILABLE_BUSINESS_SESSIONS_SUCCESS, 
  GET_AVAILABLE_BUSINESS_SESSIONS_FAILURE, 
  GET_BUSINESS_SESSION_SUCCESS, 
  GET_BUSINESS_SESSION_FAILURE, 
  GET_BUSINESS_SESSION_STATS_SUCCESS, 
  GET_BUSINESS_SESSION_STATS_FAILURE, 
  GET_EXERCISES_SESSION_SUCCESS, 
  GET_EXERCISES_SESSION_FAILURE, 
  GET_EXERCISE_PROD_SESSION_SUCCESS, 
  GET_EXERCISE_PROD_SESSION_FAILURE, 
  GET_REGISTERED_BUSINESS_SESSIONS_SUCCESS, 
  GET_REGISTERED_BUSINESS_SESSIONS_FAILURE, 
  REGISTER_BUSINESS_SESSIONS_SUCCESS, 
  REGISTER_BUSINESS_SESSIONS_FAILURE, 
  UPDATE_BUSINESS_SESSIONS_SUCCESS, 
  UPDATE_BUSINESS_SESSIONS_FAILURE, 
  UPDATE_BUSINESS_SESSIONS_PARTIAL_WARN,
  CLEAR_CURRENT_BUSINESS_SESSION_ACTION,
  CLEAR_EXERCISES_FOR_SESSSION_ACTION
} from "../actions";
import { Action, BusinessSessionState, IBusinessSession } from "../types";

const initialState = {
  sessions: [],
  availableSessions: [],
  registeredSessions: [],
  exerciseProductionsForSession: [],
  exercisesForSession: [],
  currentBusinessSession: undefined,
  currentBusinessSessionResults: undefined,
  error: undefined
};

export const BusinessSessionReducer = (state: BusinessSessionState = initialState, action: Action) => {
  const {payload, type} = action
  switch (type) {

    /**
     * ACTIONS
     */

    case ADD_BUSINESS_SESSION_SUCCESS:
      return {
        ...state,
        sessions: [...state.sessions, payload],
      };

    case GET_ALL_BUSINESS_SESSIONS_SUCCESS:
      return {
        ...state,
        sessions: payload,
      };

    case GET_AVAILABLE_BUSINESS_SESSIONS_SUCCESS:
      return {
        ...state,
        availableSessions: payload,
      };

    case GET_REGISTERED_BUSINESS_SESSIONS_SUCCESS:
      return {
        ...state,
        registeredSessions: payload,
      };

    case UPDATE_BUSINESS_SESSIONS_SUCCESS:
      return {
        ...state,
        error: payload.partial ? UPDATE_BUSINESS_SESSIONS_PARTIAL_WARN : undefined,
        sessions: state.sessions.map((session) =>
          session.ps_id === payload.session.ps_id ? payload.session : session
        ),
      };

    case REGISTER_BUSINESS_SESSIONS_SUCCESS:
      return {
        ...state,
        availableSessions: state.availableSessions.filter(
          (session: IBusinessSession) => session.ps_id !== payload.ps_id
        ),
        registeredSessions: [...state.registeredSessions, payload],
      };
    
    case DELETE_BUSINESS_SESSION_SUCCESS:
      return {
        ...state,
        sessions: state.sessions.filter((session: IBusinessSession) => session.ps_id !== payload),
      };

    case GET_EXERCISES_SESSION_SUCCESS:
      return {
        ...state,
        exercisesForSession: payload,
      };

    case GET_BUSINESS_SESSION_SUCCESS:
      return {
        ...state,
        currentBusinessSession: payload,
      };

    case GET_EXERCISE_PROD_SESSION_SUCCESS:
      return {
        ...state,
        exerciseProductionsForSession: payload
      }
    
    case GET_BUSINESS_SESSION_STATS_SUCCESS:
      return {
        ...state,
        currentBusinessSessionResults: payload
      }
      
    case CLEAR_CURRENT_BUSINESS_SESSION_STATS_ACTION:
      return {
        ...state,
        currentBusinessSessionResults: undefined
      }
    
    case CLEAR_CURRENT_BUSINESS_SESSION_ACTION:
      return {
        ...state,
        currentBusinessSession: undefined 
      }

    case CLEAR_EXERCISES_FOR_SESSSION_ACTION:
      return {
        ...state,
        exercisesForSession: []
      }
      

    /**
     * ERRORS
     */

    case ADD_BUSINESS_SESSION_FAILURE:
    case GET_ALL_BUSINESS_SESSIONS_FAILURE:
    case GET_AVAILABLE_BUSINESS_SESSIONS_FAILURE:
    case GET_REGISTERED_BUSINESS_SESSIONS_FAILURE:
    case UPDATE_BUSINESS_SESSIONS_FAILURE:
    case REGISTER_BUSINESS_SESSIONS_FAILURE:
    case DELETE_BUSINESS_SESSION_FAILURE:
    case GET_EXERCISES_SESSION_FAILURE:
    case GET_BUSINESS_SESSION_FAILURE:
    case GET_EXERCISE_PROD_SESSION_FAILURE:
    case GET_BUSINESS_SESSION_STATS_FAILURE:
      return{
        ...state,
        error: payload ? payload : type
      }


    case CLEAR_BUSINESS_SESSION_ERROR:
      return {
        ...state,
        error: undefined
      }
    
    default:
      return state;
  }
};
