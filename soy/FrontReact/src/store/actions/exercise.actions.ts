import {
  ADD_EXERCISE_SUCCESS,
  ADD_EXERCISE_FAILURE,
  UPDATE_EXERCISE_SUCCESS,
  UPDATE_EXERCISE_FAILURE,
  GET_EXERCISE_SUCCESS,
  GET_EXERCISE_FAILURE,
  DELETE_EXERCISE_SUCCESS,
  DELETE_EXERCISE_FAILURE,
  GET_ONE_EXERCISE_SUCCESS,
  GET_ONE_EXERCISE_FAILURE,
  GET_ONE_EXERCISE_SESSION_SUCCESS,
  GET_ONE_EXERCISE_SESSION_FAILURE,
  GET_ONE_EXERCISE_SKILLS_SUCCESS,
  GET_ONE_EXERCISE_SKILLS_FAILURE,
  CLEAR_CURRENT_EXERCISE_ACTION,
  CLEAR_EXERCISE_SESSION_ACTION,
  CLEAR_EXERCISE_ERROR
} from "./types";

import { Dispatch, ISkill } from "./../types";
import ExerciseService from "./../../services/ExerciseService";
import { history } from "../../helpers/history";
import { AxiosError, AxiosResponse } from "axios";


export const addExerciseAction = (exercise: any, skills : ISkill[]) => async (dispatch: Dispatch, getState : any) => {
  ExerciseService.create(exercise, skills)
  .then( (res : AxiosResponse) => {

    exercise.ex_id = res.data.id;
    exercise.author = {user_id: getState().user.connectedUser.user_id, lastname: getState().user.connectedUser.lastname, firstname: getState().user.connectedUser.firstname}
    dispatch({
      type: ADD_EXERCISE_SUCCESS,
      payload: exercise,
    });
    history.push('/exercises')
  })
  .catch( (err: AxiosError) => {
    dispatch({
      type: ADD_EXERCISE_FAILURE,
      payload: err.response && err.response.data && err.response.data.message ? err.response.data.message : undefined
    })
  })
};

export const updateExerciseAction = (exercise: any, skills : ISkill[]) => async (dispatch: Dispatch) => {
  ExerciseService.update(exercise.ex_id, exercise, skills)
  .then( (res: AxiosResponse) => {
    dispatch({
      type: UPDATE_EXERCISE_SUCCESS,
      payload: exercise,
    });
    history.push('/exercises')
  })
  .catch( (err : AxiosError) => {
    dispatch({
      type: UPDATE_EXERCISE_FAILURE,
      payload: err.response && err.response.data && err.response.data.message ? err.response.data.message : undefined
    })
  })    
};

export const deleteExerciseAction = (exerciseId: number) => async (dispatch: Dispatch) => {
  ExerciseService.remove(exerciseId)
  .then( (res: AxiosResponse) => {
    dispatch({
      type: DELETE_EXERCISE_SUCCESS,
      payload: exerciseId,
    });
  })
  .catch( (err: AxiosError) => {
    dispatch({
      type: DELETE_EXERCISE_FAILURE,
      payload: err.response && err.response.data && err.response.data.message ? err.response.data.message : undefined
    })
  })
};

export const getAllExercises = () => async (dispatch: Dispatch) => {
  ExerciseService.getAll()
  .then( (res : AxiosResponse) => {
    dispatch({
      type: GET_EXERCISE_SUCCESS,
      payload: res.data,
    });
  })
  .catch( (err: AxiosError) => {
    dispatch({
      type: GET_EXERCISE_FAILURE,
      payload: err.response && err.response.data && err.response.data.message ? err.response.data.message : undefined
    })
  })
};


export const getOneSkillForExercise = (exerciseId: number, locale: string) => (dispatch: Dispatch) => {
  ExerciseService.getSkillsForExercise(exerciseId, locale)
    .then((res : AxiosResponse) => {
      dispatch({
        type: GET_ONE_EXERCISE_SKILLS_SUCCESS,
        payload: res.data,
      });
    })
    .catch((err: AxiosError) => {
      dispatch({
        type: GET_ONE_EXERCISE_SKILLS_FAILURE,
        payload: err.response && err.response.data && err.response.data.message ? err.response.data.message : undefined
      })
    });
};

export const getOneExercise = (exerciseId: number) => (dispatch: Dispatch) => {
  ExerciseService.get(exerciseId)
  .then((res : AxiosResponse) => {
    dispatch({
      type: GET_ONE_EXERCISE_SUCCESS,
      payload: res.data,
    });
  })
  .catch( (err : AxiosError) => {
    dispatch({
      type: GET_ONE_EXERCISE_FAILURE,
      payload: err.response && err.response.data && err.response.data.message ? err.response.data.message : undefined
    })    
  })
};

export const getExerciseFromSession = (exerciseId: number, sessionId: number, userId: number) => (dispatch: Dispatch) => {
  ExerciseService.getExerciseFromSessionForUser(exerciseId, sessionId, userId)
  .then( (res: AxiosResponse) => {
    dispatch({
      type: GET_ONE_EXERCISE_SESSION_SUCCESS,
      payload: res.data
    })
  })
  .catch( (err: AxiosError) => {
    if(err.response?.status !== 200){
      history.push('/session/'+history.location.pathname.split('/')[2]+'/exercises')
    }
    dispatch({
      type: GET_ONE_EXERCISE_SESSION_FAILURE,
      payload: err.response && err.response.data && err.response.data.message ? err.response.data.message : undefined
    })
  })
}

export const clearSessionExercise = () => (dispatch: Dispatch) => {
  dispatch({
    type: CLEAR_EXERCISE_SESSION_ACTION,
    payload: undefined
  })
}

export const clearCurrentExercise = (dispatch : Dispatch) => {
  dispatch({
    type: CLEAR_CURRENT_EXERCISE_ACTION,
    payload: undefined
  })
}

export const clearExerciseError = () => (dispatch: Dispatch) => {
  dispatch({
    type: CLEAR_EXERCISE_ERROR,
    payload: null
  })
}