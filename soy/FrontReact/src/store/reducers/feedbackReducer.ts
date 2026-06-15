import { CLEAR_FEEDBACK_ERROR, CREATE_ONE_FEEDBACK_FAILURE, GET_ALL_WITH_STATS_FAILURE, GET_ALL_WITH_STATS_SUCCESS, GET_FEEDBACKS_OF_EXERCISE_FAILURE, GET_FEEDBACKS_OF_EXERCISE_SUCCESS, GET_ONE_EXERCISE_FEEDBACKS_STATS_FAILURE, GET_ONE_EXERCISE_FEEDBACKS_STATS_SUCCESS, GET_ONE_FEEDBACK_FAILURE, GET_ONE_FEEDBACK_SUCCESS, UPDATE_ONE_FEEDBACK_FAILURE } from "../actions"
import { Action } from "../types"
import { feedbackState, IFeedback } from "../types/feedback.types"

const initialState : feedbackState = {
  feedbacks: [],
  currentFeedback: undefined,
  error: undefined
}

export const feedbackReducer = (state: feedbackState = initialState, action: Action) => {
  const {payload, type} = action

  switch(type){

    case GET_FEEDBACKS_OF_EXERCISE_SUCCESS:
      return {
        ...state,
        feedbacks: payload
      }

    case GET_ONE_FEEDBACK_SUCCESS:
      return {
        ...state,
        currentFeedback: payload
      }

    case GET_ALL_WITH_STATS_SUCCESS:
      return {
        ...state,
        feedbacks: payload
      }

    case GET_ONE_EXERCISE_FEEDBACKS_STATS_SUCCESS:
      return {
        ...state,
        feedbacks: state.feedbacks.map((feedback : IFeedback) => feedback.ex_id === payload.ex_id ? payload : feedback
        ),
      }

    case GET_ONE_FEEDBACK_FAILURE:
    case GET_FEEDBACKS_OF_EXERCISE_FAILURE:
    case GET_ALL_WITH_STATS_FAILURE:
    case GET_ONE_EXERCISE_FEEDBACKS_STATS_FAILURE:
    case CREATE_ONE_FEEDBACK_FAILURE:
    case UPDATE_ONE_FEEDBACK_FAILURE:
      return {
        ...state,
        error: payload ? payload : type
      }
    
    case CLEAR_FEEDBACK_ERROR:
      return {
        ...state,
        error: undefined
      }

    default:
      return state
  }
}