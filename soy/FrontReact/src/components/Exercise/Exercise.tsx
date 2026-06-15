import Button from "@material-ui/core/Button";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useDispatch, useSelector } from "react-redux";
import { useParams } from "react-router-dom";
import { getOneExercise } from "../../store/actions";
import {
  oneExerciseSelector
} from "../../store/selectors/exerciseSelector";
import { IExercise } from "../../store/types";

function DisplayExercise({ exercise }: { exercise: IExercise | undefined }) {
  if (exercise?.template_statement) {
    return <div dangerouslySetInnerHTML={{ __html: exercise!.template_statement }} />;
  } else {
    return <p>No exercise</p>;
  }
}

interface ParamType {
  exerciseId: string;
}

export function Exercise() {
  const { exerciseId } = useParams<ParamType>();
  const exerciseIdNumber = +exerciseId;

  const exercise = useSelector(oneExerciseSelector);

  const [studentStatement, setStudentStatement] = useState("");

  const initExercise: IExercise = {
    ex_id: 0,
    name: "",
    author: 0,
    state: "",
    template_statement: "",
    template_archive: "",
    statement_creation_script: "",
    marking_script: "",
    ref_id: 0,
    skills: [],
    locale: "",
  };

  const [currentExercise] = useState(initExercise);
  const dispatch = useDispatch();

  const { t } = useTranslation();

  useEffect(() => {
    dispatch(getOneExercise(exerciseIdNumber));
  }, [dispatch]);

  const handleSubmit = () => {
    if (studentStatement !== "") {
    }
  };

  return (
    <div>
      <DisplayExercise exercise={exercise} />
      <div>
        {t("ANSWER")} :
        <input
          value={studentStatement}
          type="file"
          onChange={(e) => setStudentStatement(e.target.value)}
          className="form-dialog__file-element"
        />
        <Button onClick={handleSubmit} color="primary">
          {t("SUBMIT")}
        </Button>
      </div>
    </div>
  );
}
