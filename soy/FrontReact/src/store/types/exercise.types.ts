import { ISkill } from "./skill.types";

export interface IExercise {
  ex_id: number;
  template_statement: string;
  template_archive: string | undefined;
  state: string;
  author: any;
  statement_creation_script: string | undefined;
  name: string;
  marking_script: string | undefined;
  ref_id: number;
  ref_exercise?: {ex_id: number, name: string}
  skills: ISkill[];
  locale: string;
}

export interface ISessionExercise{
  availability_date: any;
  deadline_date: any,
  ex_id: number;
  file: string,
  is_sended: boolean,
  ps_id: number,
  statement: string,
  user_id: string,
  created: Date
}

export type ExerciseState = {
  error: string | undefined;
  exercises: IExercise[];
  skills: ISkill[][];
  exercise: IExercise | undefined;
  sessionExercise : ISessionExercise | undefined;
  selectedSkills: ISkill[]
};
