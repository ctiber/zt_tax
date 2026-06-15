export interface IExerciseProduction {
  ep_id: number;
  ex_id: number;
  user_id: number;
  comment: string;
  is_final: boolean;
  score: number;
  processing_log: string;
  working_time: string;
  production_data: Buffer;
  submission_date: Date;
}

export type ExerciseProductionState = {
  exerciseProductions: IExerciseProduction[];
  exerciseProduction: IExerciseProduction | undefined;
  grades: any[];
  error: string | undefined;
};
