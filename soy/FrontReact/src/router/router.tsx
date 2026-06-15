import { Switch } from "react-router-dom";
import { AuthRoute } from '../components/router/AuthRoute';
import { ProtectedRoute } from "../components/router/ProtectedRoute";
import { useSelector } from "react-redux";
import { connectedUserSelector } from "../store/selectors";

/** Component imports */
import { ActivateAccount } from "../components/ActivateAccount/ActivateAccount";
import BusinessProfileList from "../components/Business-Profile/BusinessProfileList";
import BusinessSessionAvailableList from "../components/Business-Session/BusinessSessionAvailableList";
import BusinessSessionList from "../components/Business-Session/BusinessSessionList";
import BusinessSessionResults from "../components/Business-Session/BusinessSessionResults";
import MyBusinessSessionList from "../components/Business-Session/MyBusinessSessionList";
import { ChangePassword } from "../components/ChangePassword/ChangePassword";
import { PageNotFound } from "../components/Error/PageNotFound";
import ExerciseDetails from "../components/Exercise/ExerciseDetails";
import ExerciseForm from "../components/Exercise/ExerciseForm";
import ExerciseList from "../components/Exercise/ExerciseList";
import ExerciseListForSessionParent from "../components/Exercise/ExerciseListForSession";
import { Help } from "../components/Help/Help";
import { Login } from "../components/Login/Login";
import { Register } from "../components/Register/Register";
import { ResetPassword } from "../components/ResetPassword/ResetPassword";
import { NonAuthRoute } from "../components/router/NonAuthRoute";
import CreateSequence from "../components/Sequence/SequenceForm";
import SequenceDetails from "../components/Sequence/SequenceDetails";
import SequenceList from "../components/Sequence/SequenceList";
import SkillList from "../components/Skill/SkillList";
import StudementStatementDetails from "../components/Student-Statement/StudentStatementDetails";
import { UsersList } from "../components/Users/UsersList";
import FeedbackList from "../components/Feedback/FeedbackList";

export const RouterLink = () => {

   const connectedUser = useSelector(connectedUserSelector)

    return (
        <Switch>

          <NonAuthRoute exact path="/login" component={Login} />
          <NonAuthRoute exact path="/resetpassword" component={ResetPassword} />
          <NonAuthRoute exact path="/changepassword/:token" component={ChangePassword} />
          <NonAuthRoute exact path="/register" component={Register} />
          <NonAuthRoute exact path="/activate/:activation_token" component={ActivateAccount} />

          <AuthRoute exact path="/" component={MyBusinessSessionList} />
          <AuthRoute exact path="/sessions" component={MyBusinessSessionList} />
          {
            connectedUser && (connectedUser.role_id !== 1) ? 
            <AuthRoute exact path="/sessions/available" component={BusinessSessionAvailableList} />
             : 
            <ProtectedRoute exact path="/sessions/available" component={BusinessSessionList} />

          }
          <AuthRoute exact path="/session/:sessionId/exercises" component={ExerciseListForSessionParent} />
          <ProtectedRoute exact path="/session/:sessionId/results" component={BusinessSessionResults} />

          <AuthRoute exact path="/studentstatement/:sessionId/:exerciseId" component={StudementStatementDetails}/>

          <ProtectedRoute exact path="/sequences" component={SequenceList} />
          <ProtectedRoute exact path="/sequence/create" component={CreateSequence} />
          <ProtectedRoute exact path="/sequence/:sequenceId" component={SequenceDetails} />

          <ProtectedRoute exact path='/profiles' component={BusinessProfileList} />

          <ProtectedRoute exact path="/exercises" component={ExerciseList} />
          <ProtectedRoute exact path="/exercise/create" component={ExerciseForm} />
          <AuthRoute exact path="/exercise/:exerciseId" component={ExerciseDetails} />
          <ProtectedRoute exact path="/exercise/:exerciseId/update" component={ExerciseForm} />
          <ProtectedRoute exact path="/exercise/:exerciseId/feedbacks" component={FeedbackList} />

          <ProtectedRoute exact path="/skills" component={SkillList} />
          <ProtectedRoute exact path="/users" allowTeacher={false} component={UsersList} />

          <AuthRoute exact path="/help" component={Help} />

          <AuthRoute exact path="/user/profile" component={PageNotFound} />

          <AuthRoute exact path="*" component={PageNotFound} />

      </Switch>
    );
}