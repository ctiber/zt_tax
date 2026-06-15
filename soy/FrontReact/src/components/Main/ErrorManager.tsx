import { useEffect, useState } from "react";
import { useSelector } from "react-redux";
import { clearBusinessSessionError, clearBussinessProfileError, clearExerciseError, clearSequenceErorr, clearSkillError } from "../../store/actions";
import { clearUserError } from "../../store/actions/user.actions";
import { businessProfileErrorSelector, userErrorSelector } from "../../store/selectors";
import { businessSessionErrorSelector } from "../../store/selectors/businessSessionSelector";
import { exerciseErrorSelector } from "../../store/selectors/exerciseSelector";
import { sequenceErrorSelector } from "../../store/selectors/sequenceSelector";
import { skillErrorSelector } from "../../store/selectors/skillSelector";
import { Dispatch } from "redux";
import { Color } from "@material-ui/lab";
import { Toast } from "./Toast";
import { feedbackErrorSelector } from "../../store/selectors/feedbackSelector";
import { clearFeedbackError } from "../../store/actions/feedback.actions";

/**
 * Listens for errors in the store, once it finds one it adds the error to a queue to create a Toast
 */
 export const ErrorManager = () => {
  
  // Add an error message in the array to change its severity
  const getSeverity = (error : string) => {
    const warningSeverity : string[] = ["UPDATE_BUSINESS_SESSIONS_PARTIAL_WARN"]
    if(warningSeverity.includes(error)) return "warning"
    return "error" 
  }

  /**
   * ERRORS
   */
  const businessProfileError = useSelector(businessProfileErrorSelector);
  const businessSessionError = useSelector(businessSessionErrorSelector);
  const exerciseError = useSelector(exerciseErrorSelector)
  const sequenceError = useSelector(sequenceErrorSelector)
  const userError = useSelector(userErrorSelector);
  const skillError = useSelector(skillErrorSelector)
  const feedbackError = useSelector(feedbackErrorSelector)

  interface ToastMessage{
    key: number,
    error: string,
    severity: Color,
    clear: () => (dispatch: Dispatch) => void,
  }
  
  const [messageQueue, setMessageQueue] = useState<ToastMessage[]>([])

  useEffect( () => {
    if(businessProfileError) setMessageQueue(prevMQ => [...prevMQ, {key: Date.now(), error: businessProfileError, severity: getSeverity(businessProfileError), clear: clearBussinessProfileError}])
    if(businessSessionError) setMessageQueue(prevMQ => [...prevMQ, {key: Date.now(), error: businessSessionError, severity: getSeverity(businessSessionError), clear: clearBusinessSessionError}])
    if(exerciseError) setMessageQueue(prevMQ => [...prevMQ, {key: Date.now(), error: exerciseError, severity: getSeverity(exerciseError), clear: clearExerciseError}])
    if(sequenceError) setMessageQueue(prevMQ => [...prevMQ, {key: Date.now(), error: sequenceError, severity: getSeverity(sequenceError), clear: clearSequenceErorr}])
    if(userError) setMessageQueue(prevMQ => [...prevMQ, {key: Date.now(), error: userError, severity: getSeverity(userError), clear: clearUserError}])
    if(skillError) setMessageQueue(prevMQ => [...prevMQ, {key: Date.now(), error: skillError, severity: getSeverity(skillError), clear: clearSkillError}])
    if(feedbackError) setMessageQueue(prevMQ => [...prevMQ, {key: Date.now(), error: feedbackError, severity: getSeverity(feedbackError), clear: clearFeedbackError}])
  }, [businessProfileError, businessSessionError, exerciseError, sequenceError, userError, skillError, feedbackError])

  const removeIndex = (index: number) => {
    setMessageQueue(messageQueue.filter((obj, i) => {return i !== index}))
  }

return (
  <div>
    {
      messageQueue.map( (item, index) => (
        <Toast key={item.key} offset={index} message={item.error} severity={item.severity} clearFromStore={item.clear} 
        onUnmount={ () => {removeIndex(index)} }/>
      ))
    }
  </div>

)
}