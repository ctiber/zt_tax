import { Button, CircularProgress, Container, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography } from "@material-ui/core"
import { RateReview } from "@material-ui/icons"
import React, { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { useDispatch, useSelector } from "react-redux"
import { useParams } from "react-router"
import { createExerciseProduction } from "../../store/actions"
import { clearSessionExercise, getExerciseFromSession } from "../../store/actions/exercise.actions"
import { ExerciseProductionReducer } from "../../store/reducers/exerciseProductionReducer"
import { ExerciseReducer } from "../../store/reducers/exerciseReducer"
import { feedbackReducer } from "../../store/reducers/feedbackReducer"
import { connectedUserSelector } from "../../store/selectors"
import { gradeReceivedSelector } from "../../store/selectors/exerciseProductionSelector"
import { sessionExerciseSelector } from "../../store/selectors/exerciseSelector"
import withReducer from "../../store/withReducer"
import FeedbackDialog from "../Feedback/FeedbackDialog"
import styles from './StudentStatementDetails.module.css'

interface ParamType{
  sessionId: string,
  exerciseId: string
}

const StudementStatementDetails = () => {

  const { t } = useTranslation();

  const { sessionId, exerciseId } = useParams<ParamType>();
  const idEx: number = +exerciseId;
  const idSess: number = +sessionId

  const dispatch = useDispatch()

  const connectedUser = useSelector(connectedUserSelector)


  useEffect( () => {
    if(connectedUser && connectedUser.user_id) dispatch(getExerciseFromSession(idEx, idSess, connectedUser.user_id,))
    return () => {
      dispatch(clearSessionExercise())
    }
  }, [connectedUser, dispatch, idEx, idSess])

  const exercise = useSelector(sessionExerciseSelector)

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

  let file : any | undefined = undefined

  const handleFile = (event : any) => {
    file = event.target.files[0];
    let fileReader = new FileReader();
    let filetype = 'not gzip compressed file'
    fileReader.onloadend = function(e) {
      if ((e.target != null) && (e.target.result != null)) {
          let arr = (new Uint8Array(e.target.result as ArrayBuffer)).subarray(0, 4); // 4 first elements
          let header = "";
          for(let i = 0; i < arr.length; i++) {
            header += arr[i].toString(16);
          }
          console.log(header);
          if (header.startsWith("1f8b")) { filetype = 'gzip' }
      }
      console.log(filetype);
      if (filetype != 'gzip') {
        alert(t("NOT A GZIPPED FILE"))
        if (document.getElementById("upload-file") != null) {
          (document.getElementById("upload-file") as HTMLInputElement).value = "" ;
        }
      }
      else { console.log("Uploaded file is a gzipped file");
        // Now looking at whether this a gzip of a **tar archive**
        // TO DO (using react-zlib-js e.g., https://codesandbox.io/s/eager-lehmann-ehxe0i)

      }
    }
    fileReader.readAsArrayBuffer(file);
  }

  const sendFile = () => {
    let reader = new FileReader();
    
    reader.onload = function() {
      let arrayBuffer = this.result;
      let array = new Uint8Array(arrayBuffer as ArrayBuffer);
      
      dispatch(createExerciseProduction( {data: array, name: file.name, size: file.size}, idEx, idSess))
      
    }
    if(file) reader.readAsArrayBuffer(file)
  }

  const getTimeDiff = (from : Date, to : Date) => {
    const fromTimestamp = new Date(from).getTime()
    const toTimestamp = new Date(to).getTime()
    
    let difference = Math.floor((toTimestamp - fromTimestamp)/1000)

    const days = Math.floor(difference / 86400)
    difference = difference - (days*86400)

    const hours = Math.floor(difference / 3600)
    difference = difference - (hours*3600)

    const minutes = Math.floor(difference / 60)
    difference = difference - (minutes*60)

    const seconds = difference

    return [days, hours, minutes, seconds]
  }

  const getTimeDiffToString = (from: Date, to : Date) => {
    let timeArray = getTimeDiff(from, to)
    
    let string = ""
    string = timeArray[3]+"s" + string 

    if(timeArray[2] !== 0) string = timeArray[2]+"m " + string
    if(timeArray[1] !== 0) string = timeArray[1]+"h " + string
    if(timeArray[0] !== 0) string = timeArray[0]+"d " + string
    return string
  }
  
  const response = useSelector(gradeReceivedSelector(idEx))

  const [open, setOpen] = useState<boolean>(false)

  const openFeedback = () => {
    setOpen(true)
  }

  useEffect( () => {
    if(response && response.grade === 100) setOpen(true)
  }, [response])

  if(exercise && exercise.file){
    return (
      <Container>
        {
          exercise.created ?
          <div className={styles.dateHeader}>
            {t("STARTED_ON")} : {new Date(exercise.created).toLocaleString()}
          </div>
          :
          ""
        }

        <Paper className={styles.stmtPaper}>
          <Typography variant="h4">{t("DOWNLOAD_ARCHIVE")}</Typography>
          <button data-cy="archive-download" onClick={ (e) => {download(e, exercise.file)}}>Archive</button>
          <Typography variant="h4">{t("EXERCISE_STATEMENT")}</Typography>
          <div dangerouslySetInnerHTML={{__html:exercise.statement}}></div>
          <Typography variant="h4">{t("PRODUCTION")}</Typography>
          <p>{t("UPLOAD_WHEN_DONE")}</p>
          <input id="upload-file" name="upload-file" type="file" onChange={handleFile} required></input>    
          <Button data-cy="send-file" variant="contained" onClick={sendFile}>{t("SUBMIT")}</Button>
          {
            response && (
              
              <React.Fragment>
                {connectedUser && connectedUser.user_id ?
                  <FeedbackDialog open={open} setOpen={ setOpen } userId={connectedUser.user_id} exerciseId={exercise.ex_id} fromStatement={true}></FeedbackDialog>
                  :
                  ""
                }
                <p><Typography variant="h5">{t("SCORE")}: {response.grade}</Typography></p>
                <Button onClick={openFeedback} size="small">How did you find this exercise  <RateReview /></Button>
                {
                !Array.isArray(response.comment) ?
                <div className={styles.error}>{response.comment}</div>
                :
                <TableContainer data-cy="file-response">
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell className="cell">Detail</TableCell>
                        <TableCell className="cell">Verification</TableCell>
                        <TableCell className="cell">Status</TableCell>
                        <TableCell className="cell">Explanation</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {
                      
                        response.comment.map( (comment :any, index: number) => (
                          <TableRow key={index}>
                            <TableCell className="cell">
                              {comment.numQ}
                            </TableCell>
                            <TableCell className="cell" dangerouslySetInnerHTML={{__html:comment.verif}}>
                            </TableCell>
                            <TableCell className="cell">
                              {comment.status}
                            </TableCell>
                            <TableCell className="cell" dangerouslySetInnerHTML={{__html:comment.expl}}>
                            </TableCell>
                          </TableRow>
                        ))
                      }
                    </TableBody>
                  </Table>
                </TableContainer>
                }

              </React.Fragment>
            
            )
          }
        </Paper>
      </Container>
    )
  }else{
    return (
      <CircularProgress></CircularProgress>
    )
  }
  
}

export default withReducer([
  {key:'exercises', reducer: ExerciseReducer},
  {key:'exerciseProductions', reducer: ExerciseProductionReducer},
  {key:'feedbacks', reducer: feedbackReducer}
])(StudementStatementDetails)