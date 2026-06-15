import { AxiosError, AxiosResponse } from "axios";
import { Dispatch } from "redux";
import FeedbackService from "../../services/FeedbackService";
import { CLEAR_FEEDBACK_ERROR, CREATE_ONE_FEEDBACK_FAILURE, GET_ALL_WITH_STATS_FAILURE, GET_ALL_WITH_STATS_SUCCESS, GET_FEEDBACKS_OF_EXERCISE_FAILURE, GET_FEEDBACKS_OF_EXERCISE_SUCCESS, GET_ONE_EXERCISE_FEEDBACKS_STATS_FAILURE, GET_ONE_EXERCISE_FEEDBACKS_STATS_SUCCESS, GET_ONE_FEEDBACK_FAILURE, GET_ONE_FEEDBACK_SUCCESS, UPDATE_ONE_FEEDBACK_FAILURE } from "./types";

export const getOneFeedback = (userId : number, exerciseId : number) => async (dispatch: Dispatch) => {
  FeedbackService.getOne(userId, exerciseId)
  .then( (res : AxiosResponse) => {
    dispatch( {
      type: GET_ONE_FEEDBACK_SUCCESS,
      payload: res.data
    })
  })
  .catch( (err : AxiosError) => {
    /*dispatch({
      type: GET_ONE_FEEDBACK_FAILURE,
      payload: err.response && err.response.data && err.response.data.message ? err.response.data.message : undefined
    })*/
  })

}

export const getFeedbacksOfExercise = (exerciseId: number) => async (dispatch : Dispatch) => {
  FeedbackService.getAllOfExercise(exerciseId)
  .then ( (res : AxiosResponse) => {
    dispatch({
      type: GET_FEEDBACKS_OF_EXERCISE_SUCCESS,
      payload: res.data
    })
  })
  .catch( (err : AxiosError) => {
    dispatch({
      type: GET_FEEDBACKS_OF_EXERCISE_FAILURE,
      payload: err.response && err.response.data && err.response.data.message ? err.response.data.message : undefined
    })
  })
}

export const getAllFeedbacksWithStats = () => async (dispatch : Dispatch) => {
  FeedbackService.getAllWithStats()
  .then( (res: AxiosResponse) => {
    dispatch({
      type: GET_ALL_WITH_STATS_SUCCESS,
      payload: res.data
    })
  })
  .catch( (err: AxiosError) => {
    dispatch({
      type: GET_ALL_WITH_STATS_FAILURE,
      payload: err.response && err.response.data && err.response.data.message ? err.response.data.message : undefined
    })
  })
}

export const getOneExerciseFeedbackStats = (exerciseId: number) => async (dispatch : Dispatch) => {
  FeedbackService.getOneStats(exerciseId)
  .then( (res: AxiosResponse) => {
    dispatch({
      type: GET_ONE_EXERCISE_FEEDBACKS_STATS_SUCCESS,
      payload: {...res.data, ex_id: Number(exerciseId)}
    })
  })
  .catch( (err: AxiosError) => {
    dispatch({
      type: GET_ONE_EXERCISE_FEEDBACKS_STATS_FAILURE,
      payload: err.response && err.response.data && err.response.data.message ? err.response.data.message : undefined
    })
  })
}

export const createFeedback = (data : any) => async (dispatch : Dispatch) => {
  FeedbackService.create(data)
  .then( (res: AxiosResponse) => {
    getOneExerciseFeedbackStats(res.data.ex_id)(dispatch)
  })
  .catch( (err: AxiosError) => {
    dispatch({
      type: CREATE_ONE_FEEDBACK_FAILURE,
      payload: err.response && err.response.data && err.response.data.message ? err.response.data.message : undefined
    })
  })
}

export const updateFeedback = (userId: number, exerciseId: number, data: any) => async (dispatch : Dispatch) => {
  FeedbackService.update(userId, exerciseId,data)
  .then( (res: AxiosResponse) => {
    getOneExerciseFeedbackStats(res.data.ex_id)(dispatch)
  })
  .catch( (err: AxiosError) => {
    dispatch({
      type: UPDATE_ONE_FEEDBACK_FAILURE,
      payload: err.response && err.response.data && err.response.data.message ? err.response.data.message : undefined
    })
  })
}

export const clearFeedbackError = () => (dispatch: Dispatch) => {
  dispatch({
    type: CLEAR_FEEDBACK_ERROR,
    payload: null
  })
}