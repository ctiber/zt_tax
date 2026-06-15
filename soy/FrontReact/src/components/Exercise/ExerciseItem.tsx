import {
  Box,
  Button,
  Collapse,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  IconButton,
  TableCell,
  TableRow,
  TextField,
  Typography
} from "@material-ui/core";
import { FileCopy, Feedback } from "@material-ui/icons";
import DeleteIcon from "@material-ui/icons/Delete";
import EditIcon from "@material-ui/icons/Edit";
import KeyboardArrowDownIcon from "@material-ui/icons/KeyboardArrowDown";
import KeyboardArrowUpIcon from "@material-ui/icons/KeyboardArrowUp";
import { Rating } from "@material-ui/lab";
import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useDispatch, useSelector } from "react-redux";
import { Link, useHistory } from "react-router-dom";
import i18n, { getAvailableLangs } from "../../i18n";
import { AxiosError, AxiosResponse } from "axios";
import ExerciseService from "../../services/ExerciseService";
import { addExerciseAction, deleteExerciseAction } from "../../store/actions";
import { connectedUserSelector } from "../../store/selectors";
import { IExercise } from "../../store/types/exercise.types";
import { DisplaySkills } from "../Skill/SkillList";
import styles from "./ExerciseItem.module.css";


export const getLanguage = () => {
  return i18n.language;
};

export function ExerciseItem({
  exercise,
  index,
  stats
}: {
  exercise: IExercise;
  index: number;
  stats: any;
}) {
  const dispatch = useDispatch();

  const handleDelete = async (e: React.FormEvent) => {
    e.preventDefault(); //Empêche le refresh de la page
    await dispatch(deleteExerciseAction(exercise.ex_id));
  };

  const { t } = useTranslation();

  const [langs, setLangs] = useState<any[]>([])

  useEffect( () => {

    const fetchLangs = async () => {
      setLangs(await getAvailableLangs())
    }
    if(langs.length === 0) fetchLangs()

  }, [langs])

  const [expanded, setExpanded] = useState(false);

  // const skills = useSelector(skillExerciseSelector);

  const connectedUser = useSelector(connectedUserSelector);

  function isAdmin() {
    if (connectedUser && connectedUser.role_id === 1) {
      return true;
    } else {
      return false;
    }
  }

  useEffect(() => {
    // dispatch(getSkillsForExercise(exercise.ex_id, getLanguage()));
  }, [dispatch]);

  const history = useHistory()

  const redirectDetail = (id : number) => {
    history.push('/exercise/'+id)
  }

  
  const [open, setOpen] = useState(false)

  const handleCopy = () => {
    setOpen(true);
  };

  return (
    <React.Fragment>
      <CopyExerciseDialogBox 
        exerciseId={exercise.ex_id}
        open={open}
        onClose={() => setOpen(false)}
      />
      <TableRow data-cy="exercise-item" className="row">
        <TableCell className="cell">
          <IconButton
            aria-label="expand row"
            size="small"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? (
              <KeyboardArrowUpIcon />
            ) : (
              <KeyboardArrowDownIcon />
            )}
          </IconButton>
        </TableCell>
        <TableCell onClick={() => {redirectDetail(exercise.ex_id)}} className={`cell ${styles.displayClickableIcon}`} component="th" scope="row">
          {exercise.ex_id}
        </TableCell>
        <TableCell onClick={() => {redirectDetail(exercise.ex_id)}} className={`cell ${styles.displayClickableIcon}`} component="th" scope="row">
          {
              exercise.name
          }
        </TableCell>
          
        <TableCell className="cell" align="left">
          {
            stats ?
              <div className={styles.feedbacks}>
                <Box component="fieldset" sx={{display: 'flex',alignItems: 'center',marginBottom:"0px"}} borderColor="transparent">
                  <Rating precision={0.5} name="read-only" value={stats.avg} readOnly size="small" />
                  <Box sx={{ ml: 1 }}>({stats.count})</Box>
                </Box>
              </div>
            : ""
          }

        </TableCell>
        <TableCell className="cell" align="right">
          {`${exercise.author.firstname} ${exercise.author.lastname}`}
        </TableCell>
        <TableCell className="cell" align="right">
          {exercise.state}
        </TableCell>
        <TableCell style={{textAlign:"center"}} className="cell" align="right">
          {
            langs.length > 0 ?
              langs.find(item => {return item.code === exercise.locale}) ?
                <img style={{height:"20px"}} src={`data:image/png;base64,${langs.find(item => {return item.code === exercise.locale}).flag}`} alt=""/>
              :
                exercise.locale
            :
              exercise.locale
          }
        </TableCell>
        <TableCell className="cell" align="right">
          {
            exercise.ex_id !== exercise.ref_id && exercise.ref_exercise ?
              <Button className={styles.text1line} variant="contained" onClick={() => {redirectDetail(exercise.ref_id)}}>
                {exercise.ref_exercise.name}
              </Button>
            :
              t("NONE")
          }
        </TableCell>
        <TableCell className="cell" align="right">
          {isAdmin() || exercise.author.user_id === connectedUser?.user_id ? (
            <React.Fragment>
              <Link to={"/exercise/"+exercise.ex_id+"/update"}>
                <IconButton aria-label="edit and save exercise">
                  <EditIcon />
                </IconButton>
              </Link>
            
              <IconButton onClick={handleDelete} aria-label="delete skill">
                <DeleteIcon />
              </IconButton>
            </React.Fragment>

          ) : (
            " "
          )}
          <Link to={`/exercise/${exercise.ex_id}/feedbacks`}>
            <IconButton>
              <Feedback />
            </IconButton>
          </Link>
          <IconButton area-label="copy" className="copySequenceButton" onClick={() => handleCopy()}>
            <FileCopy className="icon" />
          </IconButton>
        </TableCell>
      </TableRow>
      <TableRow data-cy="exercise-item-collapsible" className="row">
        <TableCell className="cell" style={{paddingBottom:0, paddingTop:0}} colSpan={6}>
          <Collapse in={expanded} timeout="auto" unmountOnExit>
            <Box margin={1}>
              <Typography variant="h6" gutterBottom component="div">
                {t("SKILLS")}
              </Typography>
              <DisplaySkills
                skills={exercise.skills}
                setCurrentSkill={null}
                setOpen={null}
                setEditMode={null}
                t={t}
              />
            </Box>
          </Collapse>
        </TableCell>
      </TableRow>
    </React.Fragment>
  );
}


function CopyExerciseDialogBox({
  exerciseId,
  open,
  onClose,
}: {
  exerciseId: number;
  open: boolean;
  onClose: () => void;
}) {
  const dispatch = useDispatch()
  //i18n TRANSLATION FUNCTION
  const { t } = useTranslation();

  const [copyingExercise, setCopyExercise] = useState<IExercise | undefined>(undefined)
  const [copyingSkills, setCopyingSkills] = useState([])

  useEffect( () => {
    if(open){
      ExerciseService.get(exerciseId)
      .then( (resp : AxiosResponse) => {
        const ex = resp.data as IExercise
        ex.name = "copy of " + ex.name
        if(ex.marking_script === null) ex.marking_script = "" 
        if(ex.ref_id === null) ex.ref_id = 1
        if(ex.statement_creation_script === null) ex.statement_creation_script = "" 
        if(ex.template_archive === null) ex.template_archive = "" 
        if(ex.template_statement === null) ex.template_statement = "" 
        setCopyExercise(ex)
      })
      .catch( (err : AxiosError) => {
  
      })
      ExerciseService.getSkillsForExercise(exerciseId, i18n.language)
      .then( (resp : AxiosResponse) => {
        setCopyingSkills(resp.data)
      })
    }

  }, [exerciseId, open])

  //Handles input text changes
  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setCopyExercise({ ...copyingExercise as IExercise, name: event.target.value });
  };

  const copy = () => {
    dispatch(addExerciseAction(copyingExercise, copyingSkills));
  }

  if (copyingExercise) {
    return (
      <Dialog
        open={open}
        onClose={onClose}
        aria-labelledby="sequence-copy-dialog-title"
        aria-describedby="sequence-copy-dialog-description"
      >
        <DialogTitle id="sequence-copy-dialog-title">Copy exercise</DialogTitle>
        <DialogContent>
          <DialogContentText id="sequence-copy-dialog-description">
            Do you really want to copy the following exercise ?
          </DialogContentText>
          <div>
            <p>
              <b>{t("EX_ID")}:</b> {copyingExercise.ex_id}
            </p>
            <p>
              <b>{t("Name")}:</b> {copyingExercise.name}
            </p>
            <div className="DialogBoxInputText">
              <TextField
                id="outlined-basic"
                label="Copied exercise name"
                variant="outlined"
                InputLabelProps={{ shrink: true }}
                value={copyingExercise.name || ""}
                onChange={handleInputChange}
                fullWidth={true}
                className="description-input"
              />
            </div>
          </div>
        </DialogContent>
        <DialogActions>
          <Button
            variant="contained"
            onClick={onClose}
            autoFocus
            className="session-list-primary-button"
          >
            {t("CANCEL")}
          </Button>
          <Button
            variant="contained"
            onClick={() => {
              copy();
              onClose();
            }}
            autoFocus
            className="session-list-primary-button"
          >
            {t("CONFIRM")}
          </Button>
        </DialogActions>
      </Dialog>
    );
  } else {
    return null;
  }
}