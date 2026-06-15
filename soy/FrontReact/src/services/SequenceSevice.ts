import http from "../http-common";
import { ISequence } from "../store/types/sequence.types";

const getAll = () => {
  return http.get("/api/sequences");
};

const create = (data: ISequence) => {
  return http.post("/api/sequence", data);
};

const get = (SequenceId: number) => {
  return http.get(`/api/sequence/${SequenceId}`);
};

const update = (SequenceId: number, data: ISequence) => {
  return http.put(`/api/sequence/${SequenceId}`, data);
};

const remove = (SequenceId: number) => {
  return http.delete(`/api/sequence/${SequenceId}`);
};

const getAllExercises = (SequenceId: number) => {
  return http.get(`/api/sequence/${SequenceId}/exercises`);
};

const copy = (data: ISequence, copyExercises : boolean) => {
  return http.post(`/api/sequence/${data.sequence_id}/copy?exercises=${copyExercises}`, data)
}

const SequenceService = {
  getAll,
  get,
  create,
  update,
  remove,
  getAllExercises,
  copy
};

export default SequenceService;
