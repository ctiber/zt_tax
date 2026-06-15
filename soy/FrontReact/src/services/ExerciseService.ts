import http from "../http-common";
import { ISkill } from "../store/types";
import { IExercise } from "../store/types/exercise.types";

const getAll = () => {
  return http.get("/api/exercises");
};

const create = (data: IExercise, skills : ISkill[]) => {
  return http.post("/api/exercise", {exercise: data, skills : skills});
};

const get = (exerciseId: number) => {
  return http.get(`/api/exercise/${exerciseId}`);
};

const update = (exerciseId: number, data: any, skills : ISkill[]) => {
  return http.put(`/api/exercise/${exerciseId}`, {exercise: data, skills : skills});
};

const remove = (exerciseId: number) => {
  return http.delete(`/api/exercise/${exerciseId}`);
};

const getSkillsForExercise = (exerciseId: number, loc: string) => {
  return http.get(`/api/exercise/${exerciseId}/skills?locale=${loc}`);
};

const getExerciseFromSessionForUser = (exerciseId : number, sessionId : number, userId: number) => {
  return http.get(`/api/student-statement/user/${userId}/exercise/${exerciseId}/business-session/${sessionId}`)
}

const ExerciseService = {
  getAll,
  get,
  create,
  update,
  remove,
  getSkillsForExercise,
  getExerciseFromSessionForUser,
};

export default ExerciseService;
