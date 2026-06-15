import { IRootState } from "./../types/index";

export const connectedUserSelector = (state: IRootState) => state.user.connectedUser;

export const userErrorSelector = (state: IRootState) => state.user && state.user.error ? state.user.error : undefined;

export const passwordResetRequestStatusSelector = (state: IRootState) => state.user.passwordResetRequestStatus

export const changePasswordRequestStatusSelector = (state: IRootState) => state.user.changePasswordRequestStatus

export const activateAccountRequestStatusSelector = (state: IRootState) => state.user.activateAccountRequestStatus

export const getUserSkillsSelector = (state: IRootState) => state.user.userSkills

export const getAllUsersSelector = (state : IRootState) => state.user.users;

export const getNbrThanksSelector = (state: IRootState) => state.user.connectedUser ? state.user.thanks : -1