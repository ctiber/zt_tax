import { IRootState } from "../types";


export const currentFeedbackSelector = (state: IRootState) => state.feedbacks.currentFeedback;

export const feedbacksSelector = (state: IRootState) => state.feedbacks.feedbacks;

export const feedbackErrorSelector = (state: IRootState) => state.feedbacks && state.feedbacks.error ? state.feedbacks.error : undefined