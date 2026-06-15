import {
  CircularProgress,
} from "@material-ui/core";

import React, { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useParams } from "react-router-dom";
import {
  getAllBusinessProfileAction,
  getAllExercises,
  getSequenceAction,
  updateSequenceAction
} from "../../store/actions";
import { businessProfileSelector } from "../../store/selectors/businessProfileSelector";
import { exerciseSelector } from "../../store/selectors/exerciseSelector";
import { currentSequenceSelector } from "../../store/selectors/sequenceSelector";
import { ISequence } from "../../store/types/sequence.types";

import { SequenceReducer } from "../../store/reducers/sequenceReducer";
import withReducer from "../../store/withReducer";
import { SequenceDetailsComponent } from "./SequenceDetailsComponent";
import { BusinessProfileReducer } from "../../store/reducers/businessProfileReducer";
import { ExerciseReducer } from "../../store/reducers/exerciseReducer";


interface ParamType {
  sequenceId: string;
}


/**
 * A React component linked to the store that retrieves a single sequence and all profiles and exercises to display details about that sequence and allow the user to modify it
 * @returns A React component
 */
function SequenceDetails(): JSX.Element {
  //The sequence's id is passed by the URI's params
  const { sequenceId } = useParams<ParamType>();
  const id: number = +sequenceId;

  //REDUX STORE FUNCTIONS
  const dispatch = useDispatch();

  let sequence = useSelector(currentSequenceSelector);
  let profiles = useSelector(businessProfileSelector);
  let exercises = useSelector(exerciseSelector);

  useEffect(() => {
    dispatch(getAllBusinessProfileAction());
    dispatch(getAllExercises());
    dispatch(getSequenceAction(id));
  }, [dispatch, id]);

  /**
   * Function called when the sequence is updated
   * @param sequence the sequence to be updated
   */
  const onUpdate = (sequence: ISequence) => {
    dispatch(updateSequenceAction(sequence));
  };

  if (sequence && profiles && (sequence.sequence_id === id)) {
    return (
      <React.Fragment>
        <SequenceDetailsComponent
          seq={sequence}
          profiles={profiles}
          exercises={exercises}
          onSave={onUpdate}
          mode="edition"
        />
      </React.Fragment>
      
    );
  } else {
    return <CircularProgress color="secondary"></CircularProgress>
  }
}

export default withReducer([
  {key:'sequences',reducer: SequenceReducer}, 
  {key: 'businessProfile', reducer: BusinessProfileReducer},
  {key: 'exercises', reducer: ExerciseReducer}
])(SequenceDetails)


