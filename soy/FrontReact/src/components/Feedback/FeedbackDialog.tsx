import { Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, FormControl, FormControlLabel, FormLabel, MenuItem, Radio, RadioGroup, Select, Slider, TextField } from "@material-ui/core";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useDispatch, useSelector } from "react-redux";
import http from '../../http-common'
import i18n from "../../i18n";
import { createFeedback, getOneFeedback, updateFeedback } from "../../store/actions/feedback.actions";
import { currentFeedbackSelector } from "../../store/selectors/feedbackSelector";

interface feedbackProps {
  open: boolean,
  setOpen: React.Dispatch<React.SetStateAction<boolean>>,
  userId : number,
  exerciseId : number,
  fromStatement? : boolean
}

const FeedbackDialog = (props : feedbackProps) => {

  const { open, setOpen, userId, exerciseId, fromStatement = false } = props

  const handleClose = () => {
    setOpen(false);
  };


  const marks = [
    {
      value: 1,
      label: '1',
    },
    {
      value: 2,
      label: '2',
    },
    {
      value: 3,
      label: '3',
    },
    {
      value: 4,
      label: '4',
    },
    {
      value: 5,
      label: '5',
    },
  ];

  const [alreadySubmitted, setAlreadySubmitted] = useState<boolean>(false)

  const [level, setLevel] = useState<number>(1);
  const handleChange = (event: any, newValue: number | number[]) => {
    if(newValue !== level){
      setLevel(newValue as number);
    }
  };

  const { t } = useTranslation()

  const [selectedTheme, setSelectedTheme] = useState<number>(0)

  const [themes, setThemes] = useState<any[]>([])

  useEffect( () => {

    if(themes.length === 0){
      http.get('/api/themes?locale='+i18n.language).then( (res) => {
        if(res.data.length > 0){
          setThemes(res.data)
        }
      })
    }
  }, [themes])

  const [selectedOpinion, setSelectedOpinion] = useState<string>("")

  const [comment, setComment] = useState<string>("")

  const getLength = () => {
    return 500-comment.length+" "+t("CHARACTER")+"s"
  }


  const handleSubmit = () => {
    let data = {
      ex_id : exerciseId,
      user_id: userId,
      level : level,
      theme : selectedTheme === 0 ? undefined : selectedTheme,
      beneficial: selectedOpinion === "" ? undefined : selectedOpinion,
      comment: comment === "" ? undefined : comment
    }
    if(alreadySubmitted) dispatch(updateFeedback(userId, exerciseId, data))
    else dispatch(createFeedback(data))
    setOpen(false)
  }

  const dispatch = useDispatch()

  const feedback = useSelector(currentFeedbackSelector)

  useEffect( () => {
    if(feedback && feedback.ex_id === exerciseId){
      setAlreadySubmitted(true)

      setLevel(feedback.level)
      if(feedback.theme) setSelectedTheme(feedback.theme)
      if(feedback.beneficial) setSelectedOpinion(feedback.beneficial)
      if(feedback.comment) setComment(feedback.comment)
    }
  }, [feedback, exerciseId])

  useEffect( () => {
    if(open) dispatch(getOneFeedback(userId, exerciseId))
  }, [dispatch, open, userId, exerciseId])

  return (
    <div>
      <Dialog open={open} onClose={handleClose} aria-labelledby="form-dialog-title">
        <DialogTitle id="form-dialog-title">Feedback</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {alreadySubmitted ? 
                fromStatement ?
                  t("FEEDBACK_CONGRATULATIONS_UPDATE_MESSAGE") 
                :
                  t("FEEDBACK_UPDATE_MESSAGE") 
              : 
                fromStatement ?
                  t("FEEDBACK_CONGRATULATIONS_MESSAGE")
                :
                  t("FEEDBACK_MESSAGE")
            }
          </DialogContentText>
          <FormControl style={{width:'100%'}}>
            <FormLabel style={{fontSize:'1.2rem'}}>{t("HOW_DIFFICULT")}</FormLabel>
            <Slider
              value={level}
              onChange={handleChange}
              defaultValue={1}
              aria-labelledby="discrete-slider"
              valueLabelDisplay="auto"
              step={1}
              marks={marks}
              min={1}
              max={5}
            />
          </FormControl>

          <FormControl style={{width:'100%', marginTop:'3%'}}>
            <FormLabel style={{fontSize:'1.2rem'}}>{t("BELONGING_THEME")}</FormLabel>
            <Select style={{marginTop:'4px'}}
              value={selectedTheme}
              label={t("LOCALE")}
              onChange={(e) => setSelectedTheme(e.target.value as number)}
            >
              <MenuItem disabled value={0}>{t("PLEASE_SELECT_THEME")}</MenuItem>
              {
                themes.length > 0 ?
                themes.map( (item) => (
                    <MenuItem key={item.th_id} value={item.th_id}>{item.name}</MenuItem>
                  ))
                :
                  <MenuItem disabled>Fetching data please wait...</MenuItem>
              }
            </Select>
          </FormControl>
          <FormControl style={{width:'100%', marginTop:'4%'}} component="fieldset">
            <FormLabel style={{fontSize:'1.2rem'}}>{t("FEELING_AFTER_EXERCISE")}</FormLabel>
            <RadioGroup
              value={selectedOpinion}
              onChange={(e) => setSelectedOpinion(e.target.value as string)}
            >
              <FormControlLabel control={<Radio />} value="knowledgeable" label={t("KNOWLEDGEABLE")}/>
              <FormControlLabel control={<Radio />} value="unchanged" label={t("UNCHANGED")}/>
              <FormControlLabel control={<Radio />} value="more confused" label={t("MORE_CONFUSED")}/>
            </RadioGroup>
          </FormControl>
          <TextField
            style={{width:'100%'}}
            id="comment"
            label={t("COMMENT")}
            value={comment}
            multiline
            onChange={ (e) => setComment(e.target.value as string)}
            helperText={getLength()}
            inputProps={{ maxLength: 500, maxRows:5 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose} color="primary">
          {t("CANCEL")}
          </Button>
          <Button disabled={ !(selectedTheme !== 0 || selectedOpinion!== "")} onClick={handleSubmit} color="primary">
            {alreadySubmitted ? t("UPDATE") : t("SUBMIT")}
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  )
}

export default FeedbackDialog