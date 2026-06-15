import { IExercise } from "./exercise.types";

export interface IUser {
  user_id: number | undefined;
  lastname: string;
  firstname: string;
  tdgroup: string;
  email: string;
  enabled: boolean;
  role_id: number;
  avatar: string;
  password: string | undefined;
  organization: string;
  country: string;
  locale: string;
  student_number: string;
} 
export interface ILogin {
  email: string;
  password: string;
}

export type UserState = {
  connectedUser: IUser | undefined;
  error: string | undefined;
  passwordResetRequestStatus: boolean | undefined;
  activateAccountRequestStatus: boolean | undefined;
  changePasswordRequestStatus: boolean | undefined;
  users: any[]
  userSkills: {
    skill_code: number;
    name: string;
    exercises: IExercise[]
  }[]
  thanks: number
};
