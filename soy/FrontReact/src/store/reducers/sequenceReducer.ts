import { SequenceState, Action } from "../types";
import {
  ADD_SEQUENCE_SUCCESS,
  ADD_SEQUENCE_FAILURE,
  CLEAR_SEQUENCE_ERROR,
  DELETE_SEQUENCE_SUCCESS,
  DELETE_SEQUENCE_FAILURE,
  GET_ALL_SEQUENCES_SUCCESS,
  GET_ALL_SEQUENCES_FAILURE,
  GET_ONE_SEQUENCE_SUCCESS,
  GET_ONE_SEQUENCE_FAILURE,
  UPDATE_SEQUENCE_SUCCESS,
  UPDATE_SEQUENCE_FAILURE,
  COPY_SEQUENCE_SUCCESS,
  COPY_SEQUENCE_FAILURE,
} from "../actions";
import { ISequence } from "./../types/sequence.types";

const initialState = {
  sequences: [],
  current: undefined,
  error: undefined
};

export const SequenceReducer = (state: SequenceState = initialState, action: Action) => {
  const {payload, type} = action
  switch (type) {

    /**
     * ACTIONS
     */

    case GET_ALL_SEQUENCES_SUCCESS:
      return {
        ...state,
        sequences: payload,
      };

    case GET_ONE_SEQUENCE_SUCCESS:
      return {
        ...state,
        current: payload,
      };

    case COPY_SEQUENCE_SUCCESS:
    case ADD_SEQUENCE_SUCCESS:
      return {
        ...state,
        sequences: [...state.sequences, payload],
      };

    case UPDATE_SEQUENCE_SUCCESS:
      return {
        ...state,
        sequences: state.sequences.map((seq) =>
          seq.sequence_id === payload.sequence_id ? payload : seq
        ),
      };

    case DELETE_SEQUENCE_SUCCESS:
      return {
        ...state,
        sequences: state.sequences.filter(
          (seq: ISequence) => seq.sequence_id !== payload
        ),
      };


    /**
     * ERRORS
     */

    case COPY_SEQUENCE_FAILURE:
    case GET_ALL_SEQUENCES_FAILURE:
    case GET_ONE_SEQUENCE_FAILURE:
    case ADD_SEQUENCE_FAILURE:
    case UPDATE_SEQUENCE_FAILURE:
    case DELETE_SEQUENCE_FAILURE:
      return{
        ...state,
        error: payload ? payload : type
      }


    case CLEAR_SEQUENCE_ERROR:
      return {
        ...state,
        error: undefined
      }
    default:
      return state;
  }
};
