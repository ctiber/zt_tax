export interface ISequence {
  sequence_id: number;
  exercises: {
    exercise_id: number;
    rank: number;
    min_rating: number;
  }[];
  profile_id: number;
  description: string;
  author_user_id?: number;
}

export type SequenceState = {
  sequences: ISequence[];
  current: ISequence | undefined;
  error: string | undefined;
};

