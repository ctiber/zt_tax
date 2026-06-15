import { IRootState } from "../types";

export const skillSelector = (state: IRootState) =>
  state.skills.skills; 

export const skillErrorSelector = (state: IRootState) => state.skills && state.skills.error ? state.skills.error : undefined