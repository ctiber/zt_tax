import { AxiosError, AxiosResponse } from "axios";
import { history } from "../../helpers/history";
import BusinessSessionService from "../../services/BusinessSessionService";
import { Dispatch, IBusinessSession } from "../types";
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
  CLEAR_CURRENT_BUSINESS_SESSION_ACTION,
  CLEAR_EXERCISES_FOR_SESSSION_ACTION
} from "./types";

export const clearBusinessSessionError = () => (dispatch: Dispatch) => {
  dispatch({
    type: CLEAR_BUSINESS_SESSION_ERROR,
    payload: null
  })
}

export const addBusinessSessionAction = (session: IBusinessSession) => (dispatch: Dispatch, getState : any) => {
  BusinessSessionService.create(session)
    .then((res : AxiosResponse) => {
      dispatch({
        type: ADD_BUSINESS_SESSION_SUCCESS,
        payload: res.data.session,
      });
    })
    .catch((err : AxiosError) => {
      dispatch({
        type: ADD_BUSINESS_SESSION_FAILURE,
        payload: err.response && err.response.data && err.response.data.message ? err.response.data.message : undefined
      })
    });
};

export const getBusinessSessionAction = (sessionId: number) => (dispatch: Dispatch) => {
  BusinessSessionService.get(sessionId)
    .then((res : AxiosResponse) => {
      dispatch({
        type: GET_BUSINESS_SESSION_SUCCESS,
        payload: res.data,
      });
    })
    .catch((err : AxiosError) => {
      if(err.response?.status === 401){
        history.push('/')
        dispatch({
          type: GET_BUSINESS_SESSION_FAILURE,
          payload: "You are not registered to this session"
        })
      }else if(err.response?.status === 404){
        history.push('/')
        dispatch({
          type: GET_BUSINESS_SESSION_FAILURE,
          payload: "The session does not exist"
        })
      }else{
        dispatch({
          type: GET_BUSINESS_SESSION_FAILURE,
          payload: err.response && err.response.data && err.response.data.message ? err.response.data.message : undefined
        })
      }
    });
};

export const getAllBusinessSessionsAction = () => (dispatch: Dispatch) => {
  BusinessSessionService.getAll()
    .then((res : AxiosResponse) => {
      dispatch({
        type: GET_ALL_BUSINESS_SESSIONS_SUCCESS,
        payload: res.data,
      });
    })
    .catch((err : AxiosError) => {
      dispatch({
        type: GET_ALL_BUSINESS_SESSIONS_FAILURE,
        payload: err.response && err.response.data && err.response.data.message ? err.response.data.message : undefined
      })
    });
};

export const getAllAvailableBusinessSessionsAction = (userId: number) => (dispatch: Dispatch) => {
  BusinessSessionService.getAllAvailable(userId)
    .then((res : AxiosResponse) => {
      dispatch({
        type: GET_AVAILABLE_BUSINESS_SESSIONS_SUCCESS,
        payload: res.data,
      });
    })
    .catch((err : AxiosError) => {
      dispatch({
        type: GET_AVAILABLE_BUSINESS_SESSIONS_FAILURE,
        payload: err.response && err.response.data && err.response.data.message ? err.response.data.message : undefined
      })
    });
};

export const getAllRegisteredBusinessSessionsAction = (userId: number) => (dispatch: Dispatch) => {
  BusinessSessionService.getAllRegistered(userId)
    .then((res : AxiosResponse) => {
      dispatch({
        type: GET_REGISTERED_BUSINESS_SESSIONS_SUCCESS,
        payload: res.data,
      });
    })
    .catch((err : AxiosError) => {
      dispatch({
        type: GET_REGISTERED_BUSINESS_SESSIONS_FAILURE,
        payload: err.response && err.response.data && err.response.data.message ? err.response.data.message : undefined
      })
    });
};

export const getExercisesForSessionAction = (sessionId: number) => (dispatch: Dispatch) => {
  BusinessSessionService.getExercisesForSession(sessionId)
    .then((res : AxiosResponse) => {
      dispatch({
        type: GET_EXERCISES_SESSION_SUCCESS,
        payload: res.data,
      });
    })
    .catch((err : AxiosError) => {
      dispatch({
        type: GET_EXERCISES_SESSION_FAILURE,
        payload: err.response && err.response.data && err.response.data.message ? err.response.data.message : undefined
      })
    });
};

export const getExerciseProductionForSessionAction =
  (sessionId: number, userId: number) => (dispatch: Dispatch) => {
    BusinessSessionService.getExercisesProductionForSession(sessionId, userId)
      .then((res : AxiosResponse) => {
        dispatch({
          type: GET_EXERCISE_PROD_SESSION_SUCCESS,
          payload: res.data,
        });
      })
      .catch((err : AxiosError) => {
        dispatch({
          type: GET_EXERCISE_PROD_SESSION_FAILURE,
          payload: err.response && err.response.data && err.response.data.message ? err.response.data.message : undefined
        })
      });
  };

export const updateBusinessSessionAction = (session: IBusinessSession) => (dispatch: Dispatch, getState : any) => {
  BusinessSessionService.update(session.ps_id, session)
    .then((res : AxiosResponse) => {
      dispatch({
        type: UPDATE_BUSINESS_SESSIONS_SUCCESS,
        payload: {
          partial: res.data.partial,
          session: res.data.session
        }
      });
    })
    .catch((err: AxiosError) => {
      dispatch({
        type: UPDATE_BUSINESS_SESSIONS_FAILURE,
        payload: err.response && err.response.data && err.response.data.message ? err.response.data.message : undefined
      });
    });
};



export const registerSessionAction =
  (sessionId: number, userId: number, secretKey: string) => (dispatch: Dispatch) => {
    BusinessSessionService.register(sessionId, userId, secretKey)
      .then((res : AxiosResponse) => {
        BusinessSessionService.get(res.data).then((result) => {
          dispatch({
            type: REGISTER_BUSINESS_SESSIONS_SUCCESS,
            payload: result.data,
          });
        });
      })
      .catch((err : AxiosError) => {
        dispatch({
          type: REGISTER_BUSINESS_SESSIONS_FAILURE,
          payload: err.response && err.response.data && err.response.data.message ? err.response.data.message : undefined
        });
      });
  };

export const deleteBusinessSessionAction = (sessionId: number) => (dispatch: Dispatch) => {
  BusinessSessionService.remove(sessionId)
    .then((res: AxiosResponse) => {
      dispatch({
        type: DELETE_BUSINESS_SESSION_SUCCESS,
        payload: sessionId,
      });
    })
    .catch((err : AxiosError) => {
      dispatch({
        type: DELETE_BUSINESS_SESSION_FAILURE,
        payload: err.response && err.response.data && err.response.data.message ? err.response.data.message : undefined
      })
    });
};


export const clearCurrentBusinessSessionStats = (dispatch : Dispatch) => {
  dispatch({
    type: CLEAR_CURRENT_BUSINESS_SESSION_STATS_ACTION,
    payload: undefined
  })
}

export const clearCurrentBusinessSessionAction = (dispatch : Dispatch) => {
  dispatch({
    type: CLEAR_CURRENT_BUSINESS_SESSION_ACTION,
    payload: undefined
  })
}

export const clearExercisesForSession = (dispatch : Dispatch) => {
  dispatch({
    type: CLEAR_EXERCISES_FOR_SESSSION_ACTION,
    payload: undefined
  })
}

export const getBusinessSessionStats = (sessionId: number) => (dispatch: Dispatch) => {
  BusinessSessionService.getStats(sessionId)
    .then((res : AxiosResponse) => {
      dispatch({
        type: GET_BUSINESS_SESSION_STATS_SUCCESS,
        payload: res.data,
      });
    })
    .catch( (err : AxiosError ) => {
      dispatch({
        type: GET_BUSINESS_SESSION_STATS_FAILURE,
        payload: err.response && err.response.data && err.response.data.message ? err.response.data.message : undefined
      })
    })
};