import SequenceService from "../../services/SequenceSevice";
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
} from "./types";
import { Dispatch, ISequence } from "../types";
import { AxiosError, AxiosResponse } from "axios";
import { history } from "../../helpers/history";

export const getAllSequencesAction = () => (dispatch: Dispatch) => {
  SequenceService.getAll()
  .then((res : AxiosResponse) => {
    dispatch({
      type: GET_ALL_SEQUENCES_SUCCESS,
      payload: res.data,
    });
  })
  .catch((err : AxiosError) => {
    dispatch({
      type: GET_ALL_SEQUENCES_FAILURE,
      payload: err.response && err.response.data && err.response.data.message ? err.response.data.message : undefined
    })
  });
};

export const copySequenceAction = (sequence: ISequence, doCopyExercises : boolean) => (dispatch : Dispatch) => {
  SequenceService.copy(sequence, doCopyExercises)
  .then( (res : AxiosResponse) => {
    dispatch({
      type: COPY_SEQUENCE_SUCCESS,
      payload: res.data,
    });
  })
  .catch( (err : AxiosError) => {
    dispatch({
      type: COPY_SEQUENCE_FAILURE,
      payload: err.response && err.response.data && err.response.data.message ? err.response.data.message : undefined
    })
  })
}

export const getSequenceAction = (sequenceId: number) => (dispatch: Dispatch) => {
  SequenceService.get(sequenceId)
  .then((res: AxiosResponse) => {
    dispatch({
      type: GET_ONE_SEQUENCE_SUCCESS,
      payload: res.data,
    });
  })
  .catch((err: AxiosError) => {
    if(err.response?.status === 404 && !history.location.pathname.match(/\/session\/.*\/exercises/g)){
      history.push('/sequences')
    }
    dispatch({
      type: GET_ONE_SEQUENCE_FAILURE,
      payload: err.response && err.response.data && err.response.data.message ? err.response.data.message : undefined
    })
  });
};

export const addSequenceAction = (sequence: ISequence) => (dispatch: Dispatch) => {
  SequenceService.create(sequence)
  .then((res: AxiosResponse) => {
    sequence.sequence_id = res.data.seq_id;
    dispatch({
      type: ADD_SEQUENCE_SUCCESS,
      payload: sequence,
    });
    history.push('/sequences')
  })
  .catch((err: AxiosError) => {
    dispatch({
      type: ADD_SEQUENCE_FAILURE,
      payload: err.response && err.response.data && err.response.data.message ? err.response.data.message : undefined
    })
  });
};

export const updateSequenceAction = (sequence: ISequence) => (dispatch: Dispatch) => {
  SequenceService.update(sequence.sequence_id, sequence)
  .then((res: AxiosResponse) => {
    dispatch({
      type: UPDATE_SEQUENCE_SUCCESS,
      payload: res.data,
    });
    history.push('/sequences')
  })
  .catch((err: AxiosError) => {
    dispatch({
      type: UPDATE_SEQUENCE_FAILURE,
      payload: err.response && err.response.data && err.response.data.message ? err.response.data.message : undefined
    })
  });
};

export const deleteSequenceAction = (sequenceId: number) => (dispatch: Dispatch) => {
  SequenceService.remove(sequenceId)
  .then((res: AxiosResponse) => {
    dispatch({
      type: DELETE_SEQUENCE_SUCCESS,
      payload: sequenceId,
    });
  })
  .catch((err: AxiosError) => {
    dispatch({
      type: DELETE_SEQUENCE_FAILURE,
      payload: err.response && err.response.data && err.response.data.message ? err.response.data.message : undefined
    })
  });
};

export const clearSequenceErorr = () => (dispatch : Dispatch) => {
  dispatch({
    type: CLEAR_SEQUENCE_ERROR,
    payload: null
  })
}