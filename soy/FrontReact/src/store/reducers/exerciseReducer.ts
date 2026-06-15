import { ExerciseState, IExercise } from "../types/exercise.types";
import { Action } from "../types";
import {
  ADD_EXERCISE_SUCCESS,
  ADD_EXERCISE_FAILURE,
  DELETE_EXERCISE_SUCCESS,
  DELETE_EXERCISE_FAILURE,
  GET_EXERCISE_SUCCESS,
  GET_EXERCISE_FAILURE,
  UPDATE_EXERCISE_SUCCESS,
  UPDATE_EXERCISE_FAILURE,
  GET_ONE_EXERCISE_SUCCESS,
  GET_ONE_EXERCISE_FAILURE,
  GET_ONE_EXERCISE_SESSION_SUCCESS,
  GET_ONE_EXERCISE_SESSION_FAILURE,
  GET_ONE_EXERCISE_SKILLS_SUCCESS,
  GET_ONE_EXERCISE_SKILLS_FAILURE,
  CLEAR_CURRENT_EXERCISE_ACTION,
  CLEAR_EXERCISE_SESSION_ACTION,
  CLEAR_EXERCISE_ERROR
} from "../actions";


const initialState = {
  exercises: [],
  skills: [],
  exercise: undefined,
  sessionExercise: undefined,
  selectedSkills : [],
  error: undefined
};

export const ExerciseReducer = (state: ExerciseState = initialState, action: Action) => {
  const {payload, type} = action
  switch (action.type) {

    /**
     * ACTIONS
     */

    case ADD_EXERCISE_SUCCESS:
      return {
        ...state,
        exercises: [...state.exercises, action.payload],
      };
      
    case DELETE_EXERCISE_SUCCESS:
      return {
        ...state,
        exercises: state.exercises.filter(
          (exercise: IExercise) => exercise.ex_id !== action.payload
        ),
      };
      
    case GET_EXERCISE_SUCCESS:
      return {
        ...state,
        exercises: action.payload,
      };

    case UPDATE_EXERCISE_SUCCESS:
      let newState: IExercise[] = [];
      state.exercises.forEach((exercise: IExercise) => {
        if (exercise.ex_id === action.payload.ex_id) {
          newState.push(action.payload);
        } else {
          newState.push(exercise);
        }
      });
      return {
        ...state,
        skills: newState,
      };

    case GET_ONE_EXERCISE_SUCCESS:
      return {
        ...state,
        exercise: action.payload,
      };

    case GET_ONE_EXERCISE_SESSION_SUCCESS:
      return {
        ...state,
        sessionExercise: action.payload
      }

    case GET_ONE_EXERCISE_SKILLS_SUCCESS:
      return {
        ...state,
        selectedSkills: action.payload
      }

    case CLEAR_CURRENT_EXERCISE_ACTION:
      return {
        ...state,
        exercise: undefined
      }

    case CLEAR_EXERCISE_SESSION_ACTION:
      return {
        ...state,
        sessionExercise: undefined
      }

    /**
     * ERRORS
     */

    case ADD_EXERCISE_FAILURE:
    case DELETE_EXERCISE_FAILURE:
    case GET_EXERCISE_FAILURE:
    case UPDATE_EXERCISE_FAILURE:
    case GET_ONE_EXERCISE_FAILURE:
    case GET_ONE_EXERCISE_SESSION_FAILURE:
    case GET_ONE_EXERCISE_SKILLS_FAILURE:
      return{
        ...state,
        error: payload ? payload : type
      }

    case CLEAR_EXERCISE_ERROR:
      return {
        ...state,
        error: undefined
      }
    default:
      return state;
  }
};
