import { BusinessProfileState } from "./business-profile.types";
import { BusinessSessionState } from "./business-session.types";
import { ExerciseProductionState } from "./exercise-production.types";
import { ExerciseState } from "./exercise.types";
import { feedbackState } from "./feedback.types";
import { SequenceState } from "./sequence.types";
import { SkillState } from "./skill.types";
import { UserState } from "./user.types";

//Specific types
export * from "./business-profile.types";
export * from "./business-session.types";
export * from "./exercise-production.types";
export * from "./exercise.types";
export * from "./sequence.types";
export * from "./skill.types";
export * from "./user.types";

//Global types
export interface IRootState {
  sequences: SequenceState;
  businessProfile: BusinessProfileState;
  businessSessions: BusinessSessionState;
  user: UserState;
  skills: SkillState;
  exercises: ExerciseState;
  exerciseProductions: ExerciseProductionState;
  feedbacks: feedbackState;
}

export type Dispatch = (args: Action) => Action;

export type Action = {
  type: string;
  payload: any;
};
