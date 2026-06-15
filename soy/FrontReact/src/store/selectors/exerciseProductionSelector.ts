import { IRootState } from "../types";

export const oneExerciseProductionSelector = (state: IRootState) => state.exerciseProductions.exerciseProduction;

export const gradeReceivedSelector = (idEx : number) => (state: IRootState) : any | undefined => {
  let g = undefined;
  state.exerciseProductions.grades.forEach((grade) => {
    if(grade.ex_id === idEx) g = grade
  })
  return g;
}

export const exerciseProductionErrorSelector = (state: IRootState) => state.exerciseProductions.error