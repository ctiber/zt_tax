import { IBusinessSession, IRootState, IUser } from "../types";

export const availableBusinessSessionsSelector = (state: IRootState) =>
  state.businessSessions.availableSessions;
export const registeredBusinessSessionsSelector = (state: IRootState) =>
  state.businessSessions.registeredSessions;
export const allBusinessSessionsSelector = (state: IRootState) =>
  state.businessSessions.sessions;

export const businessSessionErrorSelector = (state: IRootState) => state.businessSessions && state.businessSessions.error ? state.businessSessions.error : undefined

export const getExercisesForSessionSelector = (state: IRootState) =>
  state.businessSessions.exercisesForSession;

export const getCurrentBusinessSessionStatsSelector = (state: IRootState) => state.businessSessions.currentBusinessSessionResults

export const exerciseProductionsBestScoreSelector = (idEx: number | undefined) => (state: IRootState) => {
  if (!idEx) return undefined;
  let res = 0;
  state.businessSessions.exerciseProductionsForSession.forEach((ep) => {
    if (ep.ex_id === idEx && Number(ep.score) > res) {
      res = Number(ep.score);
    }
  });
  return res;
};

export const getSessionSelector = (state: IRootState) =>
  state.businessSessions.currentBusinessSession;

export const authoredSessionsSelector = (user: IUser | undefined) => (state: IRootState) => {
  if(!user) return []
  if(user.role_id === 3) return [];

  let sessions : IBusinessSession[] = []
  state.businessSessions.sessions.forEach((session) => {
    if(session.author.user_id === user.user_id) sessions.push(session)
  })
  return sessions
}