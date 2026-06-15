import { Button, Chip, Container, FormControl, Input, InputLabel, MenuItem, Paper, Select, TextField, Typography } from "@material-ui/core";
import { Editor } from "@tinymce/tinymce-react";
import React, { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useDispatch, useSelector } from "react-redux";
import { useParams } from "react-router";
import { Dispatch } from "redux";
import i18n, { getAvailableLangs } from "../../i18n";
import { addExerciseAction, getAllSkillsAction, getOneExercise, getOneSkillForExercise, updateExerciseAction } from "../../store/actions";
import { ExerciseReducer } from "../../store/reducers/exerciseReducer";
import { SkillReducer } from "../../store/reducers/skillReducer";
import { connectedUserSelector } from "../../store/selectors";
import { oneExerciseSelector, skillsForExerciseSelector } from "../../store/selectors/exerciseSelector";
import { skillSelector } from "../../store/selectors/skillSelector";
import { IExercise, ISkill } from "../../store/types";
import withReducer from "../../store/withReducer";
import { Toast } from "../Main/Toast";
import styles from './ExerciseForm.module.css';

interface ParamType {
  exerciseId: string;
}

export const FormComponent = ({exerciseState, id, exercise_skills, dispatch}: {exerciseState : any, id: number | undefined, exercise_skills: ISkill[], dispatch : Dispatch<any>}) => {
  const { t } = useTranslation()
  
  let emptyArr : ISkill[] = []
  const connectedUser = useSelector(connectedUserSelector)
  const skills = useSelector(skillSelector);
  let [currentExercise, setCurrentExercise] = useState(exerciseState);
  let [selectedSkills, setSelectedSkills] = useState(emptyArr);

  const [errorMessage, setErrorMessage] = useState("")
  
  useEffect( () => {
    setCurrentExercise(exerciseState)
  }, [exerciseState])
  
  useEffect( () => {
    if((skills && skills.length > 0) && (exercise_skills && exercise_skills.length > 0)){
      let prepopulate = []
      for(let i = 0 ; i < exercise_skills.length ; i++){
        for(let j = 0 ; j < skills.length ; j++){
          if(exercise_skills[i].skill_code === skills[j].skill_code){
            prepopulate.push(skills[j])
            break;
          }
        }
      }

      setSelectedSkills(prepopulate)
    }


  }, [exercise_skills, skills])

  const handleFormChange = (value: any, property: string) => {
    let exercise: IExercise = {
      ex_id: currentExercise.ex_id,
      name: currentExercise.name,
      author: currentExercise.author,
      state: currentExercise.state,
      template_archive: currentExercise.template_archive,
      template_statement: currentExercise.template_statement,
      marking_script: currentExercise.marking_script,
      statement_creation_script: currentExercise.statement_creation_script,
      ref_id: currentExercise.ref_id,
      skills: currentExercise.skills,
      locale: currentExercise.locale,
    };
    switch (property) {
      case "NAME":
        exercise.name = value;
        setCurrentExercise(exercise);
        break;
      case "AUTHOR":
        exercise.author = value;
        setCurrentExercise(exercise);
        break;
      case "STATE":
        exercise.state = value;
        setCurrentExercise(exercise);
        break;
      case "TEMP_ARCH":
        exercise.template_archive = value[0];
        setCurrentExercise(exercise);
        break;
      case "TEMP_STMT":
        exercise.template_statement = value;
        setCurrentExercise(exercise);
        break;
      case "MRK_SCRPT":
        exercise.marking_script = value[0];
        setCurrentExercise(exercise);
        break;
      case "STMT_SCRPT":
        exercise.statement_creation_script = value[0];
        setCurrentExercise(exercise);
        break;
      case "REF":
        exercise.ref_id = value;
        setCurrentExercise(exercise);
        break;
      case "LOCALE":
        exercise.locale = value;
        setCurrentExercise(exercise);
        break;
      default:
        break;
    }
  };

  const editorRef : any = useRef(null)

  const handleChange = (event: React.ChangeEvent<{value : unknown}>) => {
    setSelectedSkills(event.target.value as ISkill[])
  }

  const readFileAsArrayBuffer = async(file : File) => {
    let result_base64 = await new Promise( (resolve) => {
      let fileReader = new FileReader()
      fileReader.onload = (e) => resolve(fileReader.result)
      fileReader.readAsArrayBuffer(file)
    })
    return result_base64
    
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); //Empêche le refresh de la page

    if (id) {
      const newExercise: any = {
        ex_id: currentExercise.ex_id,
        name: currentExercise.name,
        author: currentExercise.author.user_id,
        state: currentExercise.state,
        template_archive: currentExercise.template_archive,
        template_statement: editorRef.current.getContent(),
        marking_script: currentExercise.marking_script,
        statement_creation_script: currentExercise.statement_creation_script,
        ref_id: -1,
        skills: currentExercise.skills,
        locale: currentExercise.locale,
      };
      
      if(currentExercise.template_archive){
        const file : File = currentExercise.template_archive
        
        let arrayBuffer = await readFileAsArrayBuffer(file);
        let array = new Uint8Array(arrayBuffer as ArrayBuffer);
        newExercise.template_archive = {data: array, name: file.name, size: file.size}
        
      }
      if(currentExercise.marking_script){
        const file : File = currentExercise.marking_script
          
        let arrayBuffer = await readFileAsArrayBuffer(file);
        let array = new Uint8Array(arrayBuffer as ArrayBuffer);
        newExercise.marking_script = {data: array, name: file.name, size: file.size}

      }
      if(currentExercise.statement_creation_script){
        const file : File = currentExercise.statement_creation_script

        let arrayBuffer = await readFileAsArrayBuffer(file);
        let array = new Uint8Array(arrayBuffer as ArrayBuffer);
        newExercise.statement_creation_script = {data: array, name: file.name, size: file.size}

      }
      
      dispatch(updateExerciseAction(newExercise, selectedSkills));
    } else {
      if(!currentExercise.name){
        setErrorMessage(t("MISSING_INPUTS"))
        return;
      }

      const newExercise: any = {
        ex_id: 0,
        name: currentExercise.name,
        author: connectedUser && connectedUser.user_id ? connectedUser.user_id : 0,
        state: currentExercise.state,
        template_archive: currentExercise.template_archive,
        template_statement: editorRef.current.getContent(),
        marking_script: currentExercise.marking_script,
        statement_creation_script: currentExercise.statement_creation_script,
        ref_id: -1,
        skills: currentExercise.skills,
        locale: currentExercise.locale,
      };

      if(currentExercise.template_archive){
        const file : File = currentExercise.template_archive
        
        let arrayBuffer = await readFileAsArrayBuffer(file);
        let array = new Uint8Array(arrayBuffer as ArrayBuffer);
        newExercise.template_archive = {data: array, name: file.name, size: file.size}
        
      }else{
        setErrorMessage(t("TEMPLATE_ARCHIVE_NEEDED"))
        return;
      }
      if(currentExercise.marking_script){
        const file : File = currentExercise.marking_script
          
        let arrayBuffer = await readFileAsArrayBuffer(file);
        let array = new Uint8Array(arrayBuffer as ArrayBuffer);
        newExercise.marking_script = {data: array, name: file.name, size: file.size}

      }else{
        setErrorMessage(t("STATEMENT_CREATION_SCRIPT_NEEDED"))
        return;
      }
      if(currentExercise.statement_creation_script){
        const file : File = currentExercise.statement_creation_script

        let arrayBuffer = await readFileAsArrayBuffer(file);
        let array = new Uint8Array(arrayBuffer as ArrayBuffer);
        newExercise.statement_creation_script = {data: array, name: file.name, size: file.size}

      }else{
        setErrorMessage(t("MARKING_SCRIPT_NEEDED"))
        return;
      }


      dispatch(addExerciseAction(newExercise, selectedSkills));
    }
  };


  const ITEM_HEIGHT = 48;
  const ITEM_PADDING_TOP = 8;
  const MenuProps = {
    PaperProps: {
      style: {
        maxHeight: ITEM_HEIGHT * 4.5 + ITEM_PADDING_TOP,
        width: 250,
      },
    },
  };

  const [langs, setLangs] = useState<any[]>([])

  useEffect( () => {

    const fetchLangs = async () => {
      setLangs(await getAvailableLangs())
    }
    if(langs.length === 0) fetchLangs()

  }, [langs])


  return (
    <Container className={styles.formContainer}>
      <Toast message={errorMessage} severity="info" clearState={ () => { setErrorMessage("") } }/>
      <Typography variant="h3" component="h1" color="primary" className="title">
        { id ? t("EXERCISE_UPDATE") : t("EXERCISE_CREATION")}
      </Typography>
      <Paper>
        <form>
          <TextField
            required
            data-cy='exercise-name'
            label={t("NAME")}
            value={currentExercise.name}
            type="string"
            onChange={(e) => handleFormChange(e.target.value, "NAME")}
          />
          <TextField
            required
            label={t("AUTHOR")}
            value={currentExercise && currentExercise.author ? `${currentExercise.author.firstname} ${currentExercise.author.lastname}` : ( connectedUser && `${connectedUser.firstname} ${connectedUser.lastname}`)}
            type="string"
            disabled
          />

          <FormControl className="selector">
            <InputLabel htmlFor="state-select" id="state-select-label">{t("STATE")}</InputLabel>
            <Select
              required
              labelId="state-select-label"
              id="state-select"
              value={currentExercise.state}
              onChange={(e) => handleFormChange(e.target.value, "STATE")}
            >
              <MenuItem value={"Draft in progress"}>{t("Draft in progress")}</MenuItem>
              <MenuItem value={"Need to be tested"}>{t("Need to be tested")}</MenuItem>
              <MenuItem value={"Available"}>{t("Available")}</MenuItem>
              <MenuItem value={"Require correction"}>{t("Require correction")}</MenuItem>
            </Select>
          </FormControl>
          <FormControl>
            <InputLabel>{t("LOCALE")}</InputLabel>
            <Select
              value={currentExercise.locale}
              label={t("LOCALE")}
              onChange={(e) => handleFormChange(e.target.value, "LOCALE")}
            >
              {
                langs.length > 0 ?
                  langs.map( (item) => (
                    <MenuItem value={item.code}>{item.name}</MenuItem>
                  ))
                :
                  <MenuItem>Fetching data please wait...</MenuItem>
              }
              <MenuItem value="other">Other</MenuItem>
            </Select>
          </FormControl>


          <FormControl className={styles.skillsSelector}>
            <InputLabel id="demo-mutiple-chip-label">{t("SKILLS")}</InputLabel>
            <Select
              labelId="demo-mutiple-chip-label"
              id="demo-mutiple-chip"
              multiple
              value={selectedSkills}
              onChange={handleChange}
              input={<Input id="select-multiple-chip" />}
              renderValue={(selected) => (
                <div className={styles.chips}>
                  {(selected as ISkill[]).map((skill) => (
                    <Chip key={skill.skill_code} label={skill.name} className={styles.chip}/>
                  ))}
                </div>
              )}
              MenuProps={MenuProps}
              >
              {skills.map((skill : ISkill) => (
                <MenuItem key={skill.skill_code} value={(skill as any)} >
                  {skill.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <div className={styles.fileInputs}>
            <div className="form-dialog__file-holder">
                {t("Template archive")} :
              <input
                type="file"
                onChange={(e) => handleFormChange(e.target.files, "TEMP_ARCH")}
                className="form-dialog__file-element"
              />
            </div>
            <div className="form-dialog__file-holder">
                {t("Statement  creation script")} :
              <input
                type="file"
                onChange={(e) => handleFormChange(e.target.files, "STMT_SCRPT")}
                className="form-dialog__file-element"
              />
            </div>
            <div className="form-dialog__file-holder">
                {t("Marking script")} :
              <input
                type="file"
                onChange={(e) => handleFormChange(e.target.files, "MRK_SCRPT")}
                className="form-dialog__file-element"
              />
            </div>
          </div>

          <Editor tinymceScriptSrc={process.env.REACT_APP_FRONT_URL+'tinymce/tinymce.min.js'}
            onInit={(evt, editor) => editorRef.current = editor} 
            initialValue={currentExercise.template_statement}
            init={{
              height: 500,
              skin: 'oxide-dark',
              content_css: 'dark',
              plugins: [
                'advlist', 'autolink', 'lists', 'link', 'image', 'charmap', 'preview',
                'anchor', 'searchreplace', 'visualblocks', 'code', 'fullscreen',
                'insertdatetime', 'media', 'table', 'code', 'help', 'wordcount'
              ],
              menubar: false,
              toolbar: 'undo redo | blocks | ' +
                'bold italic forecolor | alignleft aligncenter ' +
                'alignright alignjustify | bullist numlist outdent indent | ' +
                'removeformat | code | help' ,
              content_style: 'body { font-family:Helvetica,Arial,sans-serif; font-size:14px }'
            }}/>
          <Button variant="contained" onClick={handleSubmit} onSubmit={handleSubmit}>{t("SUBMIT")}</Button>

        </form>
      </Paper>
      
    </Container>
    
    )
}

const ExerciseForm = () => {
  
  const { exerciseId } = useParams<ParamType>();
  const id: number = +exerciseId;

  let initExercise: IExercise = {
    ex_id: 0,
    name: "",
    author: 0,
    state: "",
    template_archive: "",
    template_statement: "",
    marking_script: "",
    statement_creation_script: "",
    ref_id: 0,
    skills: [],
    locale: window.localStorage.getItem('i18nextLng') || 'en',
  };

  const dispatch = useDispatch()

  const exerciseSelected = useSelector(oneExerciseSelector)

  const skillsSelected = useSelector(skillsForExerciseSelector)
  

  useEffect( () => {
    dispatch(getAllSkillsAction(i18n.language))
    if(id) dispatch(getOneSkillForExercise(id, i18n.language));
    if(id) dispatch(getOneExercise(id))
  }, [dispatch, id])

  if(id && exerciseSelected && skillsSelected){
    let exerciseState = exerciseSelected
    // We cannot populate file inputs
    exerciseState.template_archive = ''
    exerciseState.marking_script = ''
    exerciseState.statement_creation_script = ''
    return(
      <React.Fragment>
        <FormComponent
          exerciseState={exerciseState}
          id={id}
          exercise_skills={skillsSelected}
          dispatch= {dispatch}
          />
      </React.Fragment>
     
    )
  }else{
    return(
      <React.Fragment>
        <FormComponent
          exerciseState={initExercise}
          id={id}
          exercise_skills={[]}
          dispatch= {dispatch}
          />
      </React.Fragment>
    )
  }
  
  
  
}

export default withReducer([{key:'exercises',reducer: ExerciseReducer}, {key:'skills', reducer: SkillReducer}])(ExerciseForm)