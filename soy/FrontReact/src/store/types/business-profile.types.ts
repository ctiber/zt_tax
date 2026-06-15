export interface IBusinessProfile {
  p_id: number | undefined;
  job: string;
  level: string;
  sector: string;
  description: string;
  ref_id: number | undefined;
  locale: string;
}

export type BusinessProfileState = {
  businessProfiles: IBusinessProfile[];
  error: string | undefined;
};

