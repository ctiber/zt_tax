import React, { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useDispatch, useSelector } from "react-redux";
import { addSequenceAction, getAllBusinessProfileAction, getAllExercises } from "../../store/actions";
import { BusinessProfileReducer } from "../../store/reducers/businessProfileReducer";
import { ExerciseReducer } from "../../store/reducers/exerciseReducer";
import { SequenceReducer } from "../../store/reducers/sequenceReducer";
import { businessProfileSelector } from "../../store/selectors";
import { exerciseSelector } from "../../store/selectors/exerciseSelector";
import { ISequence } from "../../store/types";
import withReducer from "../../store/withReducer";
import { SequenceDetailsComponent } from "./SequenceDetailsComponent";

/**
 * A React component linked to the store that retrieves all profiles and exercises and allow the user to create a new sequence
 * @returns A React component
 */
 function CreateSequence(): JSX.Element {
  const { t } = useTranslation();

  //REDUX STORE FUNCTIONS
  const dispatch = useDispatch();

  let profiles = useSelector(businessProfileSelector);
  let exercises = useSelector(exerciseSelector);


  useEffect(() => {
    dispatch(getAllBusinessProfileAction());
    dispatch(getAllExercises());
  }, [dispatch]);

  /**
   * Called upon sequence creation
   * @param sequence the sequence to be created
   */
  const onSave = (sequence: ISequence) => {
    dispatch(addSequenceAction(sequence));
  };

  const sequence: ISequence = {
    sequence_id: -1,
    description: "",
    exercises: [],
    profile_id: -1,
  };

  if (profiles) {
    return (
      <React.Fragment>
        <SequenceDetailsComponent
          seq={sequence}
          profiles={profiles}
          exercises={exercises}
          onSave={onSave}
          mode="creation"
        />
      </React.Fragment>
      
    );
  } else {
    return <h1>{t("FETCHING_DATA")}</h1>;
  }
}

export default withReducer([
  {key:'sequences',reducer: SequenceReducer}, 
  {key: 'businessProfile', reducer: BusinessProfileReducer},
  {key: 'exercises', reducer: ExerciseReducer}
])(CreateSequence)
