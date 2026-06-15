
import { AxiosError, AxiosResponse } from "axios";
import ExerciseProductionService from "../../services/ExerciseProductionService";
import { Dispatch } from "./../types";
import { CLEAR_EXERCISE_PRODUCTION_ERROR, SEND_EXERCISE_PRODUCTION_SUCCESS, SEND_EXERCISE_PRODUCTION_FAILURE } from "./types";

export const createExerciseProduction = (production_data : any , ex_id: number, ps_id: number) => (dispatch : Dispatch) => {
  ExerciseProductionService.answerExercise(production_data, ex_id, ps_id)
  .then( (res : AxiosResponse) => {
    dispatch({
      type: SEND_EXERCISE_PRODUCTION_SUCCESS,
      payload: res.data
    })
  })
  .catch( (err : AxiosError) => {
    dispatch({
      type: SEND_EXERCISE_PRODUCTION_FAILURE,
      payload: err.response && err.response.data && err.response.data.message ? err.response.data.message : undefined
    })
  })
}

export const clearExerciseProductionError = () => (dispatch : Dispatch) => {
  dispatch({
    type: CLEAR_EXERCISE_PRODUCTION_ERROR,
    payload: undefined
  })
}