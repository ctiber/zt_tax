import { CircularProgress, Container, Paper, Typography } from "@material-ui/core";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useDispatch, useSelector } from "react-redux";
import { useParams } from "react-router-dom";
import { ExerciseReducer } from "../../store/reducers/exerciseReducer";
import i18n from "../../i18n";
import { getOneSkillForExercise, clearCurrentExercise, getOneExercise } from "../../store/actions";
import { skillsForExerciseSelector, oneExerciseSelector } from "../../store/selectors/exerciseSelector";
import withReducer from "../../store/withReducer";
import styles from './ExerciseDetails.module.css';

interface ParamType {
  exerciseId: string;
}

const ExerciseDetails = () => {

  const { t } = useTranslation();

  const { exerciseId } = useParams<ParamType>();
  const id: number = +exerciseId;

  const dispatch = useDispatch()
  const skillsSelected = useSelector(skillsForExerciseSelector)

  useEffect(() => {
      dispatch(getOneExercise(id))
      if(id) dispatch(getOneSkillForExercise(id, i18n.language));
      return () => {
        dispatch(clearCurrentExercise)
      }
  }, [dispatch, id])


  const exercise = useSelector(oneExerciseSelector);

  const download = (event: React.MouseEvent<HTMLButtonElement>, file : any) =>{
    var blob = new Blob([new Uint8Array(file.data.data)], {type: file.data.type})
    var url = URL.createObjectURL(blob)
    let link = document.createElement("a");
    if(link.download !== undefined){
      link.setAttribute("href", url)
      link.setAttribute("download", file.name)
      link.style.visibility = 'hidden'
      document.body.appendChild(link)
      link.click();
      document.body.removeChild(link)
    }
  }

  if(!exercise){
    return(
      <CircularProgress color="secondary" />
    )
  }else{
    return (
    <Container>
      <Paper className={styles.detailsPaper}>
        <div data-cy="exercise-name">{t("EXERCISE_NAME")} : {exercise.name}</div>
        <div>{t("EXERCISE_ID")} : {exercise.ex_id}</div>
        <div>{t("AUTHOR")} : {exercise.author.firstname + " " + exercise.author.lastname}</div>
        <div>{t("STATE")} : {exercise.state}</div>
        <br/>
        <div>
          <h3>{t("SKILLS_LINKED")}</h3>
          <ul>
            {
              skillsSelected.map(skill => (
                <li>{skill.skill_code} : {skill.name}</li>
              ))
            }
          </ul>
        </div>
        <Typography variant="h4">{t("EXERCISE_STATEMENT")} : </Typography>
        <div dangerouslySetInnerHTML={{__html: exercise.template_statement}} >
        </div>
        <div>{t("TEMPLATE_ARCHIVE")} : 
          {
            exercise.template_archive ? 
            <span>
              <button onClick={ (e) => {download(e, JSON.parse(exercise.template_archive as string))}}>{JSON.parse(exercise.template_archive).name}
              </button> 
              {t("SIZE")} {JSON.parse(exercise.template_archive).size} {t("BYTES")} 
            </span>
            :
            <span>
              {t("NO_ARCHIVE_FOUND")}
            </span>  
          } 
        </div>
        <div>{t("STATEMENT_SCRIPT")} : 
          {
            exercise.statement_creation_script ? 
            <span>
              <button onClick={ (e) => {download(e, JSON.parse(exercise.statement_creation_script as string) )}}>{JSON.parse(exercise.statement_creation_script).name}
              </button>, 
              {t("SIZE")} {JSON.parse(exercise.statement_creation_script).size} {t("BYTES")} 
            </span>
            :
            <span>
              {t("NO_ARCHIVE_FOUND")}
            </span> 
          }
        </div>
        <div>{t("CORRECTION_SCRIPT")} : 
          {
            exercise.marking_script ? 
            <span>
              <button onClick={ (e) => {download(e, JSON.parse(exercise.marking_script as string))}}>{JSON.parse(exercise.marking_script).name}
              </button>, 
              {t("SIZE")} {JSON.parse(exercise.marking_script).size} {t("BYTES")}
            </span> 
            : 
            <span>
              {t("NO_ARCHIVE_FOUND")}
            </span> 
          } 
        </div>
      </Paper>
    </Container>
    )
  }
}

export default withReducer([{key:'exercises',reducer: ExerciseReducer}])(ExerciseDetails)