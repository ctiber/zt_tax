import { IExerciseProduction } from "./exercise-production.types";
import { IExercise } from "./exercise.types";

export interface IBusinessSession {
  ps_id: number; //session's id
  p_id: number; //profile's id
  seq_id: number; //sequence's id
  author: any;
  name: string;
  secret_key: string;
  start_date: Date;
  end_date: Date;
  description: string;
  universe: string;
  is_timed: boolean;
  timezone?: any
}

export interface IBusinessSessionResultsExerciseProduction {
  stats: {
    round: number;
    max: number;
    min: number;
  },
  user: {user_id: number, firstname: string, lastname: string},
  productions: IExerciseProduction[]
}

export interface IBusinessSessionResultsExercise extends IExercise {
  user_productions: {[user_id: number]: IBusinessSessionResultsExerciseProduction};
  stats: {
    round: number;
    max: number;
    min: number;
  };
}

export interface IBusinessSessionResults {
  session: IBusinessSession;
  exercises: IBusinessSessionResultsExercise[]
}

export type BusinessSessionState = {
  error: string | undefined;
  sessions: IBusinessSession[];
  availableSessions: IBusinessSession[];
  registeredSessions: IBusinessSession[];
  exerciseProductionsForSession: IExerciseProduction[];
  exercisesForSession: IExercise[];
  currentBusinessSession: IBusinessSession | undefined;
  currentBusinessSessionResults: IBusinessSessionResults | undefined;
};
