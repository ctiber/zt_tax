import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useDispatch, useSelector } from "react-redux";
import { Link, useParams } from "react-router-dom";
import { currentSequenceSelector } from "../../store/selectors/sequenceSelector";
import {
  clearCurrentBusinessSessionAction,
  clearExercisesForSession,
  getBusinessSessionAction,
  getExerciseProductionForSessionAction,
  getExercisesForSessionAction
} from "./../../store/actions/business-session.actions";
import {
  exerciseProductionsBestScoreSelector,
  getExercisesForSessionSelector,
  getSessionSelector
} from "./../../store/selectors/businessSessionSelector";
import { IBusinessSession } from "./../../store/types/business-session.types";
import { IExercise } from "./../../store/types/exercise.types";

import {
  Box,
  Button,
  CircularProgress,
  Container,
  IconButton,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Typography
} from "@material-ui/core";
import { Alert, Rating } from "@material-ui/lab";
import { getSequenceAction } from "../../store/actions";
import { BusinessSessionReducer } from "../../store/reducers/businessSessionReducer";
import { SequenceReducer } from "../../store/reducers/sequenceReducer";
import { connectedUserSelector } from "../../store/selectors";
import withReducer from "../../store/withReducer";
import { ISequence } from "./../../store/types/sequence.types";
import FeedbackDialog from "../Feedback/FeedbackDialog";
import { RateReview, ThumbUp } from "@material-ui/icons";
import { feedbackReducer } from "../../store/reducers/feedbackReducer";
import { getAllFeedbacksWithStats } from "../../store/actions/feedback.actions";
import { feedbacksSelector } from "../../store/selectors/feedbackSelector";
import styles from './ExerciseListForSession.module.css'
import ThanksDialog from "../Thanks/ThanksDialogBox";
import http from '../../http-common'
import { AxiosError, AxiosResponse } from "axios";
//import { debug } from "console";
//const debug = require("debug")("ExerciseListForSession");

function ExerciseItemForSession({
  exercise,
  sequence,
  session,
  previousExercise,
  stats
}: {
  exercise: IExercise;
  sequence: ISequence;
  session: IBusinessSession;
  previousExercise: IExercise;
  stats: any;
}) {
  const dispatch = useDispatch();

  const exerciseProductionsBestScore = useSelector(exerciseProductionsBestScoreSelector(exercise.ex_id));
  const previousExerciseBestScore = useSelector(exerciseProductionsBestScoreSelector(previousExercise ? previousExercise.ex_id : undefined))
  const user = useSelector(connectedUserSelector)

  useEffect( () => {
    if(user && user.user_id) dispatch(getExerciseProductionForSessionAction(session.ps_id, user.user_id))
  }, [dispatch, user, session])

  const sessionIsOver = () => {
    const now : number = Date.now() //.setHours(0, 0, 0, 0);
    const end : number = Date.parse(session.end_date.toString())  //.setHours(0, 0, 0, 0)

    // Zeroes out h,m,s,ms in dates
    console.log("\n\n\t Dates :")
    console.log("now = " + now)
    const endPlus = end + 86400000
    console.log("end  + 86400000 = " + endPlus)

    // return end % 100000 < now % 100000 // compare dates only (zeroes h,m,s,ms)
    return endPlus  < now 
  }

  const getTodaySessionDay = () => {
    const now : number = Date.now();
    const start : number = Date.parse(session.start_date.toString())
    const end : number = Date.parse(session.end_date.toString())
    
    if(start <= now && now <= (end+86400000)){
      // computing nb of days between start <-> now
      let dist = (now-start)/86400000 
      console.log("dist ="+dist)
      const nbDaysGap : number =  Math.floor(dist) + 1 // add +1 as exercise ranks start at 1!
      console.log("Math.floor(dist) ="+nbDaysGap)
      return nbDaysGap
    }
    return -1
  }

  const [openReviewDialog, setOpenReviewDialog] = useState<boolean>(false)
  const [openCommendDialog, setOpenCommendDialog] = useState<boolean>(false)
  
  const [isDeleting, setIsDeleting] = useState(false)



  const handleDelete= () => {
    setIsDeleting(true)
    http.delete(`/api/student-statement/user/${user?.user_id}/business-session/${session.ps_id}/exercise/${exercise.ex_id}`)
    .then( (response : AxiosResponse) => {
      setIsDeleting(false)
    })
    .catch( (error : AxiosError) => {
      setIsDeleting(false)
    })
  }

  const { t } = useTranslation();
  let ex = sequence.exercises.find((ex) => ex.exercise_id === exercise.ex_id)
  return (
    <TableRow data-cy="exercise-item-for-session" className="row">

      <TableCell className="cell">          
              {exercise.name}
      </TableCell>
      <TableCell className="cell">
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
      <TableCell className="cell">{exercise.locale}</TableCell>
      <TableCell className="cell">{exerciseProductionsBestScore}</TableCell>
      <TableCell className="cell">
        {sequence.exercises.find((ex) => ex.exercise_id === exercise.ex_id)?.min_rating ||
          -1}
      </TableCell>
      <TableCell className="cell">
        {
          sessionIsOver() ?
          <div>{t("SESSION_IS_OVER")}</div>
          :
          session.is_timed ?
            ex?.rank === getTodaySessionDay() ?
              <Link to={"/studentstatement/" + session.ps_id + "/" + exercise.ex_id} >
                {t("GO_TO_EXERCISE")}
              </Link>
            : 
              (ex && ex.rank < getTodaySessionDay()) ? 
                "Not available anymore" 
              : 
                "Not yet available"
            :
              previousExerciseBestScore !== undefined ? 
                (sequence.exercises.find( (ex) => ex.exercise_id === previousExercise.ex_id)?.min_rating || -1) <= previousExerciseBestScore ?
                  <Link to={"/studentstatement/" + session.ps_id + "/" + exercise.ex_id} >
                    {t("GO_TO_EXERCISE")}
                  </Link>
                :
                <div>
                  {t("INSUFFICIENT_SCORE")}
                </div>
              :
                <Link to={"/studentstatement/" + session.ps_id + "/" + exercise.ex_id} >
                  {t("GO_TO_EXERCISE")}
                </Link>
          }
        </TableCell>

        { (user && user.user_id) ?
          <TableCell className="cell">
            <Tooltip title={t("WRITE_REVIEW")+""} placement="top">
              <IconButton onClick={ () => setOpenReviewDialog(true)}>
                <RateReview />
              </IconButton>
            </Tooltip>
            <Tooltip title={t("RECOMMEND_USER")+""} placement="top">
              <IconButton onClick={ () => setOpenCommendDialog(true)}>
                <ThumbUp />
              </IconButton>
            </Tooltip>
            <FeedbackDialog open={openReviewDialog} setOpen={setOpenReviewDialog} userId={user.user_id} exerciseId={exercise.ex_id}></FeedbackDialog>
            <ThanksDialog open={openCommendDialog} setOpen={setOpenCommendDialog} sessionId={session.ps_id} exerciseId={exercise.ex_id}/>
            {
              (user && user.user_id === session.author ) && (
                isDeleting === false ? 
                  <Button variant="contained" onClick={handleDelete}>Delete your statement</Button>
                :
                  "Deleting ..."
              )
            }
          </TableCell> : <TableCell></TableCell>
        } 
    </TableRow>
  );
}

interface ParamType {
  sessionId: string;
}

function calcTime(tz: string) {
  let formatter = new Intl.DateTimeFormat([], {
    timeZone: tz,
    day: "numeric",
    month: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
  });
  return formatter.format(new Date());
}

export function ExerciseListForSession({ session }: { session: IBusinessSession }) {
  const dispatch = useDispatch();

  const { t } = useTranslation();

  const exercises = useSelector(getExercisesForSessionSelector);
  const sequence = useSelector(currentSequenceSelector);
  const stats = useSelector(feedbacksSelector)

  useEffect(() => {    
    dispatch(getExercisesForSessionAction(session.ps_id));
    dispatch(getSequenceAction(session.seq_id));
    dispatch(getAllFeedbacksWithStats())
    return () => {
      dispatch(clearExercisesForSession)
    }
  }, [dispatch, session]);

  if (session) {
    return (
      <Container>
        <Typography data-cy="session-title" variant="h3" component="h1" color="primary" className="title">Session {session.name}</Typography>
        <Paper id="paper-list">
          <p>
            <Alert severity="warning">{t("SESSION_TIMEZONE_WARNING")}: {session.timezone} ({calcTime(session.timezone!)})</Alert>
          </p>
          {session.is_timed && 
            <p>
              <Alert severity="warning">{t("TIMED_SESSION")}</Alert>
            </p>
          }
          <p>
            {t("AVAILABLE")} : {new Date(session.start_date).toLocaleDateString()} -- 
            {new Date(session.end_date).toLocaleDateString()}
          </p>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow className="row">
                  <TableCell className="cell">{t("EXERCISE")}</TableCell>
                  <TableCell align="center" className="cell">{t("DIFFICULTY")}</TableCell>
                  <TableCell className="cell">{t("LOCALE")}</TableCell>
                  <TableCell className="cell">{t("YOUR_BEST_SCORE")}</TableCell>
                  <TableCell className="cell">{t("MINIMAL_SCORE_REQUIRED")}</TableCell>
                  <TableCell className="cell">Actions</TableCell>
                  <TableCell className="cell"></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                { sequence ?
                  exercises.map((exercise: IExercise, index : number) => (
                    <ExerciseItemForSession
                      key={exercise.ex_id}
                      sequence={sequence}
                      exercise={exercise}
                      session={session}
                      previousExercise={exercises[index-1]}
                      stats={stats.find( (stat) => ( stat.ex_id === exercise.ex_id ))}
                    />
                  ))
                : 
                  "Can not find a sequence for this session"
                }
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
        
      </Container>
    );
  } else {
    return null;
  }
}

function ExerciseListForSessionParent() {
  const dispatch = useDispatch();

  const { sessionId } = useParams<ParamType>();
  const sessionIdNumber = +sessionId;

  const session = useSelector(getSessionSelector);

  useEffect(() => {
    dispatch(getBusinessSessionAction(sessionIdNumber));
    return () => {
      dispatch(clearCurrentBusinessSessionAction)
    }
  }, [dispatch, sessionIdNumber]);

  if (session && sessionIdNumber === session.ps_id) {
    return <ExerciseListForSession session={session} />;
  } else {
    return <CircularProgress></CircularProgress>
  }
}

export default withReducer([
  {key:'businessSessions', reducer: BusinessSessionReducer},
  {key:'sequences', reducer: SequenceReducer},
  {key:'feedbacks', reducer: feedbackReducer}
])(ExerciseListForSessionParent)