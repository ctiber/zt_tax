export interface ISkill {
  skill_code: string;
  name: string;
  th_id: number;
  theme?: {name: string};
  description: string;
  locale: string;
  ref_code: string;
}

export type SkillState = {
  skills: ISkill[];
  error: string | undefined
};
