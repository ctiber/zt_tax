import { CLEAR_EXERCISE_PRODUCTION_ERROR, SEND_EXERCISE_PRODUCTION_SUCCESS, SEND_EXERCISE_PRODUCTION_FAILURE } from "../actions";
import { Action, ExerciseProductionState } from "../types";


const initialState = {
  exerciseProductions: [],
  exerciseProduction: undefined,
  grades: [],
  error: undefined
};

export const ExerciseProductionReducer = (state: ExerciseProductionState = initialState, action: Action) => {
  const {payload, type} = action
  switch (type) {

    /**
     * ACTIONS
     */

    case SEND_EXERCISE_PRODUCTION_SUCCESS:
      state.grades.push(payload)
      return {
        ...state,
      }

    /**
     * ERRORS
     */

    case SEND_EXERCISE_PRODUCTION_FAILURE:
      return{
        ...state,
        error: payload ? payload : type
      }

    case CLEAR_EXERCISE_PRODUCTION_ERROR:
      return{
        ...state,
        error: undefined
      }

    default:
      return state
  }

}