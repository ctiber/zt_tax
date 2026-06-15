import { Button, Card, CardContent, Container, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, FormControl, FormControlLabel, FormLabel, Grid, IconButton, Input, InputLabel, MenuItem, Paper, Radio, RadioGroup, Select, Slider, Table, TableBody, TableCell, TableHead, TableRow, TextField, Tooltip, Typography } from "@material-ui/core";
import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { IBusinessProfile, IExercise, ISequence } from "../../store/types";
import DeleteIcon from "@material-ui/icons/Delete";
import ReportProblem from "@material-ui/icons/ReportProblem";
import SaveIcon from "@material-ui/icons/Save";
import { AddCircle, FindInPage } from "@material-ui/icons";
import { Link } from "react-router-dom";
import { Toast } from "../Main/Toast";
import styles from "./SequenceDetails.module.css";
import { useSelector } from "react-redux";
import { connectedUserSelector } from "../../store/selectors";

/**
 * React Component that displays a single profile as a list
 * @param param0 the profile to display
 * @returns A React component
 */
 function InLineProfileDisplay({ profile }: { profile: IBusinessProfile | undefined }) {
  const { t } = useTranslation();
  if (profile) {
    return (
      <ul className={styles.profileListDisplay}>
        <li>
          {t("SECTOR")}: {profile.sector}{" "}
        </li>
        <li>
          {t("JOB")}: {profile.job}{" "}
        </li>
        <li>
          {t("LEVEL")}: {profile.level}{" "}
        </li>
        <li>
          {t("LOCALE")}: {profile.locale}{" "}
        </li>
      </ul>
    );
  } else {
    return null;
  }
}


/**
 * A React component that displays a page allowing to see and modify a Sequence
 * @param param0 the sequence to display, all the profiles, all the exercices, the function called on save of the sequence, and the mode that can be creation or edition
 * @returns A React component
 */
export function SequenceDetailsComponent({
  seq,
  profiles,
  exercises,
  onSave,
  mode,
}: {
  seq: ISequence;
  profiles: IBusinessProfile[];
  exercises: IExercise[];
  onSave: (sequence: ISequence) => void;
  mode: string;
}) {
  //Page mode
  const creation = mode === "creation";

  const connectedUser = useSelector(connectedUserSelector)

  //LOCAL STATES
  //Allows modification on the page
  //Manages the profile selection dialog box
  const [openProfileDialog, setProfileDialogOpen] = useState(false);
  //Manages the save alert dialog box
  const [openSaveDialog, setSaveDialogOpen] = useState(false);
  //Manages the local representation of the sequence (Changes will be made on this copy before being spread to the store's version)
  const [sequence, setSequence] = useState<ISequence>(seq);

  const { t } = useTranslation();

  useEffect( () => {
    setSequence(seq)
  }, [seq])

  //Handles input text changes
  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSequence({ ...sequence, description: event.target.value });
  };

  //DIALOG BOX OPENNING / CLOSING
  //PROFILE
  const handleProfileDialogBoxOpening = () => {
    setProfileDialogOpen(true);
  };

  const handleProfileDialogBoxClosing = () => {
    setProfileDialogOpen(false);
  };

  const [errorMessage, setErrorMessage] = useState("")

  //SAVE
  const handleSaveDialogBoxOpening = () => {
    if(sequence.profile_id === -1){
      setErrorMessage("SEQUENCE_MISSING_PROFILE_ERROR")
    } else {
      setSaveDialogOpen(true);
    }
  };

  const handleSaveDialogBoxClosing = (discardChanges: boolean) => {
    setSaveDialogOpen(false);
    if (discardChanges) {
      handleDiscardChange();
    }
  };

  //USER INPUT HANDLERS
  //Profile selection
  const handleRadioChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSequence({ ...sequence, profile_id: +event.target.value });
  };

  /**
   * Exercise min rating selection
   * @param exerciseId the exercise to modify the min rating for
   * @param newValue the exercise's new minimal rating
   */
  const handleSlideInputChande = (exerciseId: number, newValue: number) => {
    let exercises = [...sequence.exercises];
    let index = exercises.findIndex((ex) => ex.exercise_id === exerciseId);
    let exercise = {
      ...exercises[index],
      min_rating: newValue,
    };
    exercises[index] = exercise;
    setSequence({ ...sequence, exercises: exercises });
  };

  /**
   * Called when an exercise is added to the list of chosen exercises
   * @param exerciseId the exercise to add
   */
  const handleAddExercise = (exerciseId: number) => {
    setSequence({
      ...sequence,
      exercises: [
        ...sequence.exercises,
        {
          exercise_id: exerciseId,
          rank: sequence.exercises.length + 1,
          min_rating: 0,
        },
      ],
    });
  };

  /**
   * Called when an exercise is deleted from the list of chosen exercises
   * @param exerciseId the exercise to delete
   */
  const handleDeleteExercise = (exerciseId: number) => {
    setSequence({
      ...sequence,
      exercises: sequence.exercises.filter((ex) => ex.exercise_id !== exerciseId),
    });
  };

  /**
   * Handles an exercise rank change in a sequence
   * @param exerciseId the exercise's id
   * @param newRank the new rank given to the exercise
   * @param actualRank the actual exercise's rank
   */
  const handleRankChange = (exerciseId: number, newRank: any, actualRank: number) => {
    //Handles a rank change for an exercise, then increments or decrements other (depends on the situation) then sorts the list by rank
    let exercises = [...sequence.exercises];
    let index = -1;
    exercises.forEach((exercise, i) => {
      if (exercise.exercise_id === exerciseId) {
        exercise.rank = 0;
        index = i;
      }
      if (newRank < actualRank) {
        if (exercise.rank >= newRank && exercise.rank < actualRank) {
          exercise.rank++;
        }
      } else {
        if (exercise.rank <= newRank && exercise.rank > actualRank) {
          exercise.rank--;
        }
      }
    });
    exercises[index].rank = newRank;

    exercises.sort((a, b) => a.rank - b.rank);

    setSequence({
      ...sequence,
      exercises: exercises,
    });
  };

  const isAuthor = (ex_id : number) => {
    if(!connectedUser) return false
    if(connectedUser.role_id === 1) return true
    return exercises.find( (ex) => (ex.ex_id === ex_id))?.author.user_id === connectedUser.user_id
  }

  const canEdit = () => {
    if(!connectedUser) return false
    if(connectedUser.role_id === 1) return true
    return seq.author_user_id === connectedUser.user_id
  }

  const handleDiscardChange = () => {
    setSequence(seq);
  };

  const handleSave = () => {
    onSave(sequence);
    setSaveDialogOpen(false);
  };

  /**
   * Used to determine if a given exercise is already belonging to the sequence
   * @param exerciseId the exercise to check
   * @returns A boolean that tells if the exercise has already been chosen
   */
  const isAlreadyChosen = (exerciseId: number): boolean => {
    return sequence.exercises.some((ex) => ex.exercise_id === exerciseId);
  };

  return (
    <Container>
      <Toast message={errorMessage ? errorMessage : ""} severity="error" clearState={ () => setErrorMessage("") } />
      {profiles && (
        <Dialog open={openProfileDialog} onClose={handleProfileDialogBoxClosing} color="primary">
          <DialogTitle id="form-dialog-title">{t("SELECT_A_PROFILE")}</DialogTitle>
          <DialogContent>
            <DialogContentText>{t("SELECT_A_PROFILE_DESCRIPTION")}</DialogContentText>
            <FormControl>
              <FormLabel>{t("PROFILES")}</FormLabel>
              <RadioGroup
                aria-label="profileRadioGroup"
                name="profileRadioGroup"
                value={sequence.profile_id.toString() || ""}
                onChange={handleRadioChange}
              >
                {profiles.map((profile) => (
                  <FormControlLabel
                    key={profile.p_id}
                    value={profile.p_id}
                    checked={sequence.profile_id.toString() === profile.p_id?.toString()}
                    control={<Radio />}
                    label={<InLineProfileDisplay profile={profile} />}
                  />
                ))}
              </RadioGroup>
            </FormControl>
          </DialogContent>
          <DialogActions className="dialog__item">
            <Button
              variant="contained"
              onClick={handleProfileDialogBoxClosing}
              className={styles.sequenceDetailsPrimaryButton}
            >
              {t("SELECT")}
            </Button>
          </DialogActions>
        </Dialog>
      )}
      <Dialog
        open={openSaveDialog}
        onClose={handleSaveDialogBoxClosing}
        aria-labelledby="save-alert-dialog-title"
        aria-describedby="save-alert-dialog-description"
      >
        <DialogTitle id="save-alert-dialog-title">{t("ARE_YOU_SURE")}</DialogTitle>
        <DialogContent>
          <DialogContentText id="save-alert-dialog-description">
            {t("ALMOST_FINISHED_DIALOG_MSG")}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button
            variant="contained"
            onClick={() => handleSaveDialogBoxClosing(true)}
            className={styles.sequenceDetailsPrimaryButton}
          >
            {t("DISCARD_CHANGES")}
          </Button>
          <Button
            variant="contained"
            onClick={() => handleSaveDialogBoxClosing(false)}
            className={styles.sequenceDetailsPrimaryButton}
          >
            {t("CONTINUE_EDITING")}
          </Button>
          <Button
            variant="contained"
            onClick={handleSave}
            autoFocus
            className={styles.sequenceDetailsPrimaryButton}
          >
            {t("SAVE")}
          </Button>
        </DialogActions>
      </Dialog>

      <div className={styles.header}>
        <Typography
              variant="h3"
              component="h1"
              className="title"
            >
              {creation ? t("SEQUENCE_CREATION") : t("SEQUENCE_DETAILS")}
        </Typography>
        {
          canEdit() ?
            <IconButton
              area-label="update"
              onClick={handleSaveDialogBoxOpening}
            >
              <SaveIcon fontSize="large" />
            </IconButton>
          :
            ""
        }

      </div>

      <Grid container spacing={3} direction="row" justify="space-evenly">
        <Grid item xs={12} >
          <Paper className={`${styles.sequenceExerciseListCard} ${styles.mainGrid}`}>
            <TextField
              data-cy="sequence-description-field"
              id="outlined-basic"
              label="Description"
              variant="outlined"
              InputLabelProps={{ shrink: true }}
              value={sequence.description || ""}
              onChange={handleInputChange}
              fullWidth={true}
              multiline={true}
              rows={4}
              disabled={!canEdit()}
            />
            <div>
              <Typography>{t("PROFILE")}<span style={{color: "red"}}>*</span></Typography>
              <InLineProfileDisplay
                profile={
                  sequence.profile_id !== 0
                    ? profiles.find((profile) => profile.p_id?.toString() === sequence.profile_id.toString())
                    : profiles.find((profile) => profile.p_id === sequence?.profile_id)
                }
              />
              {
                canEdit() ?
                  <Button
                    variant="contained"
                    onClick={handleProfileDialogBoxOpening}
                  >
                    {t("EDIT")}
                  </Button>
                :
                  ""
              }

            </div>
          </Paper>
          
        </Grid>
        {
          canEdit() ?
          <Grid item xs={4}>
          <Card className={styles.sequenceExerciseListCard}>
            <CardContent>
              <Typography variant="h5" component="h2" >
                {t("AVAILABLE_EXERCISES")}
              </Typography>
              <Table>
                <TableHead>
                  <TableRow className={styles.sequenceDetailsTableRow}>
                    <TableCell>{t("EXERCISE")} id</TableCell>
                    <TableCell>{t("NAME")}</TableCell>
                    <TableCell>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {exercises.map((ex) => (
                    <React.Fragment>
                      {
                      sequence.exercises.some(exo => exo.exercise_id === ex.ex_id) ? "" : (
                      <TableRow key={ex.ex_id} className={styles.sequenceDetailsTableRow}>
                        <TableCell>{ex.ex_id}</TableCell>
                        <TableCell>{ex.name}</TableCell>
                        <TableCell>
                          <Link to={"/exercise/" + ex.ex_id} >
                            <IconButton area-label="details" className={styles.sequenceDetailsPrimaryButton}>
                              <FindInPage />
                            </IconButton>
                          </Link>
                          <IconButton
                            area-label="details"
                            color="primary"
                            disabled={isAlreadyChosen(ex.ex_id)}
                            onClick={() => handleAddExercise(ex.ex_id)}
                            className={styles.sequenceDetailsPrimaryButton}
                          >
                            <AddCircle />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    )
                    }
                  </React.Fragment>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </Grid>
        : 
        ""
        }

        <Grid item xs={canEdit() ? 8 : 12}>
          <Card className={styles.sequenceExerciseListCard}>
            <CardContent>
              <Typography variant="h5" component="h2">
                {t("CHOSEN_EXERCISES")}
              </Typography>
              <Table>
                <TableHead>
                  <TableRow className={styles.sequenceDetailsTableRow}>
                    <TableCell>Id</TableCell>
                    <TableCell>{t("NAME")}</TableCell>
                    <TableCell>{t("RANK")}</TableCell>
                    <TableCell>{t("MIN_RATING")}</TableCell>
                    {
                      canEdit() ?
                        <TableCell>Actions</TableCell>
                      :
                        ""
                    }
                  </TableRow>
                </TableHead>
                <TableBody>
                  {sequence.exercises.map((exercise, index) => (
                    <TableRow key={exercise.exercise_id} className={styles.sequenceDetailsTableRow}>
                      <TableCell>{exercise.exercise_id}</TableCell>
                      <TableCell>{exercises.find((ex) => ex.ex_id === exercise.exercise_id)?.name}</TableCell>
                      <TableCell>
                        <FormControl variant="outlined">
                          <InputLabel id="RankSelector">{t("RANK")}</InputLabel>
                          <Select
                            disabled={!canEdit()}
                            labelId="RankSelector"
                            id="rank-selector"
                            value={exercise.rank}
                            onChange={(event) =>
                              handleRankChange(exercise.exercise_id, event.target.value, exercise.rank)
                            }
                            label="Rank"
                          >
                            {sequence.exercises.map((ex, index) => (
                              <MenuItem key={ex.exercise_id} value={index + 1}>
                                {index + 1}
                              </MenuItem>
                            ))}
                          </Select>
                        </FormControl>
                      </TableCell>
                      <TableCell>
                        <InputSlider
                          rating={exercise.min_rating}
                          exerciseId={exercise.exercise_id}
                          onChange={handleSlideInputChande}
                          disabled={!canEdit()}
                        />
                      </TableCell>
                      {
                        canEdit() ?
                          <TableCell>
                          <IconButton
                            area-label="delete"
                            color="secondary"
                            onClick={() => handleDeleteExercise(exercise.exercise_id)}
                            >
                            <DeleteIcon />
                          </IconButton>

                          {
                            !isAuthor(exercise.exercise_id) ?
                            <Tooltip title={t("EXERCISE_MAY_CHANGE")+""}>
                              <IconButton disableRipple>
                                <ReportProblem color="error" />
                              </IconButton>
                            </Tooltip>
                            : ""
                          }
                        </TableCell>
                        : ""
                      }

                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Container>
  );
}

/**
 * A React component that allow the user to select a minimal rating for an exercise
 * @param param0 the state that manages the rating, the exercise that'll be modified and tehe function called upon changes
 * @returns A React component
 */
 function InputSlider({
  rating,
  exerciseId,
  onChange,
  disabled
}: {
  rating: number;
  exerciseId: number;
  onChange: (exerciseId: number, value: number) => void;
  disabled: boolean;
}) {
  //LOCAL STATE
  const [value, setValue] = React.useState(Number(rating));

  const handleSliderChange = (event: React.ChangeEvent<{}>, newValue: number | number[]) => {
    if (typeof newValue === "number") {
      setValue(newValue);
      onChange(exerciseId, newValue);
    }
  };

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.value !== "") {
      const newValue = Number(event.target.value);
      setValue(newValue);
      onChange(exerciseId, newValue);
    }
  };

  //Sets value to 0 or to 100 when unallowed values are entered
  const handleBlur = () => {
    if (value < 0) {
      setValue(0);
    } else if (value > 100) {
      setValue(100);
    }
  };

  return (
    <div className="InputSliderMinRating">
      <Grid container spacing={1} alignItems="center">
        <Grid item xs={1}>
          <Typography>%</Typography>
        </Grid>
        <Grid item xs={8}>
          <Slider
            value={typeof value === "number" ? value : 0}
            onChange={handleSliderChange}
            aria-labelledby="input-slider"
            disabled={disabled}
          />
        </Grid>
        <Grid item xs={3}>
          <Input
            disabled={disabled}
            className={styles.InputMinRating}
            value={value}
            margin="dense"
            onChange={handleInputChange}
            onBlur={handleBlur}
            inputProps={{
              step: 5,
              min: 0,
              max: 100,
              type: "number",
              "aria-labelledby": "input-slider",
            }}
          />
        </Grid>
      </Grid>
    </div>
  );
}
