import { IRootState } from "../types";

export const exerciseSelector = (state: IRootState) => state.exercises.exercises;

export const oneExerciseSelector = (state: IRootState) => state.exercises.exercise;

export const sessionExerciseSelector = (state : IRootState) => state.exercises.sessionExercise;

export const skillExerciseSelector = (state: IRootState) => {
  return state.exercises.skills;
};

export const skillsForExerciseSelector = (state : IRootState) => state.exercises.selectedSkills

export const exerciseErrorSelector = (state : IRootState) => state.exercises && state.exercises.error ? state.exercises.error : undefined