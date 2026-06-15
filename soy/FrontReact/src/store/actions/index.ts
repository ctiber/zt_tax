import { Dispatch } from "../types";
import { CLEAR_MESSAGE_ACTION } from "./types";

export * from "./types";
export * from "./business-profile.actions";
export * from "./business-session.actions";
export * from "./sequence.actions";
export * from "./exercise.actions";
export * from "./skill.actions";
export * from "./exercise-production.actions"

export const clearMessageAction = (dispatch: Dispatch) => {
  dispatch({
    type: CLEAR_MESSAGE_ACTION,
    payload: null,
  });
};
