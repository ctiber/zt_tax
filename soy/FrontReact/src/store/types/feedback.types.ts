enum beneficial_type {
  knowledgeable = "knowledgable",
  unchanged = "unchanged",
  more_confused = "more confused",
}

export interface IFeedback {
  ex_id: number;
  user_id: number;
  level: number;
  theme: number;
  beneficial: beneficial_type;
  comment: string;
}

export type feedbackState = {
  feedbacks: IFeedback[],
  currentFeedback: IFeedback | undefined,
  error: string | undefined
};
