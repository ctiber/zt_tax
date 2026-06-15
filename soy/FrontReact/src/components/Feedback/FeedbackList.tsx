import { CircularProgress, Container, Paper, Table, TableBody, TableCell, TableHead, TableRow, Typography } from "@material-ui/core";
import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useParams } from "react-router";
import { getFeedbacksOfExercise } from "../../store/actions/feedback.actions";
import { feedbackReducer } from "../../store/reducers/feedbackReducer";
import { feedbacksSelector } from "../../store/selectors/feedbackSelector";
import withReducer from "../../store/withReducer";

interface ParamType {
  exerciseId: string;
}

const FeedbackList = () => {

  const { exerciseId } = useParams<ParamType>();
  const ex_id: number = +exerciseId;

  const dispatch = useDispatch()

  const feedbacks = useSelector(feedbacksSelector)

  useEffect( () => {
    dispatch(getFeedbacksOfExercise(ex_id))
  }, [dispatch, ex_id])

  if(feedbacks){
    return (
    <Container>
      <Typography variant="h3" component="h1" color="primary" className="title">
          Feedbacks of exercise {ex_id}
        </Typography>
      <Paper>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>User</TableCell>
              <TableCell>Level</TableCell>
              <TableCell>Theme</TableCell>
              <TableCell>Beneficial</TableCell>
              <TableCell>Comment</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {
              feedbacks.map( (feedback) => (
                <TableRow>
                  <TableCell>{feedback.user_id}</TableCell>
                  <TableCell>{feedback.level}</TableCell>
                  <TableCell>{feedback.theme ? feedback.theme : "n/a"}</TableCell>
                  <TableCell>{feedback.beneficial ? feedback.beneficial : "n/a"}</TableCell>
                  <TableCell>{feedback.comment ? feedback.comment : "n/a"}</TableCell>
                </TableRow>
              ))
            }
          </TableBody>
        </Table>
      </Paper>
    </Container>
    )
  }
  else{
    return <CircularProgress />
  }
  
}

export default withReducer([
  {key:'feedbacks', reducer: feedbackReducer}
])(FeedbackList)