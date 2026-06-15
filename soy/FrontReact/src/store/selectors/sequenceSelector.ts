import { IRootState } from "../types";

export const sequencesSelector = (state: IRootState) => state.sequences.sequences;

export const currentSequenceSelector = (state: IRootState) => state.sequences.current;

export const sequenceErrorSelector = (state: IRootState) => state.sequences && state.sequences.error ? state.sequences.error : undefined

