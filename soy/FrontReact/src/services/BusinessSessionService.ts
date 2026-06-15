import http from "../http-common";
import { IBusinessSession } from "../store/types/business-session.types";

const getAll = () => {
  return http.get("/api/business-sessions");
};

const getAllAvailable = (userId: number) => {
  return http.get(`/api/business-sessions/user/${userId}/available`);
};

const getAllRegistered = (userId: number) => {
  return http.get(`/api/user/${userId}/business-sessions`);
};

const create = (data: IBusinessSession) => {
  data.start_date.setUTCHours(0,0,0,0) // zeroes out hours, minutes, seconds, and milliseconds (sets to midnight) : If start_time isn't edited in the calendar, it will default to the current time
  return http.post("/api/business-session", data);
};

const get = (sessionId: number) => {
  return http.get(`/api/business-session/${sessionId}`);
};

const update = (sessionId: number, data: IBusinessSession) => {
  return http.put(`/api/business-session/${sessionId}`, data);
};

const remove = (sessionId: number) => {
  return http.delete(`/api/business-session/${sessionId}`);
};

const getExercisesForSession = (sessionId: number) => {
  return http.get(`/api/business-session/${sessionId}/exercises`);
};

const getExercisesProductionForSession = (sessionId: number, userId: number) => {
  return http.get(`/api/business-session/${sessionId}/user/${userId}/exercise-productions`);
};

const register = (sessionId: number, userId: number, secretKey: string) => {
  return http.post("/api/business-session/register", {
    ps_id: sessionId,
    user_id: userId,
    secret_key: secretKey,
  });
};

const getStats = (sessionId: number) => {
  return http.get(`/api/business-session/${sessionId}/stats`);
};

const BusinessSessionService = {
  getAll,
  getAllAvailable,
  getAllRegistered,
  get,
  create,
  update,
  remove,
  register,
  getExercisesForSession,
  getExercisesProductionForSession,
  getStats,
};

export default BusinessSessionService;
