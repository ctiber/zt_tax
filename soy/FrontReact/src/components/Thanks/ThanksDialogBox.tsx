import { Button, Chip, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, FormControl, FormHelperText, TextField } from '@material-ui/core'
import { Autocomplete } from '@material-ui/lab'
import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useDispatch } from 'react-redux'
import { sendThank } from '../../store/actions/user.actions'

interface feedbackProps {
  open: boolean,
  setOpen: React.Dispatch<React.SetStateAction<boolean>>,
  sessionId: number,
  exerciseId: number,
}

const ThanksDialog = (props : feedbackProps) => {
  const {open, setOpen, sessionId, exerciseId} = props

  const [users, setUsers] = useState<number[]>([])

  const { t } = useTranslation()

  const handleClose = () => {
    setOpen(false)
  }

  const dispatch = useDispatch()

  const handleSubmit = () => {
    dispatch(sendThank({
      users: users,
      ps_id: sessionId,
      ex_id: exerciseId
    }))
    setOpen(false)
  }

  const handleChange= (event : any, values: any) => {
    setUsers(values.map( (value : any) => value * 1));
  }

  return (
      <Dialog open={open} onClose={handleClose} aria-labelledby="form-dialog-title">
        <DialogTitle id="form-dialog-title">{t("RECOMMEND")}</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {t("RECOMMEND_TEXT")}
          </DialogContentText>
          <FormControl style={{width:"100%"}}>
            <Autocomplete
              multiple
              id="tags-filled"
              options={[]} // no options
              defaultValue={[]}
              freeSolo
              onChange={handleChange}
              renderTags={(value: string[], getTagProps) =>
                value.map((option: string, index: number) => (
                  <Chip variant="outlined" label={option} {...getTagProps({ index })} />
                ))
              }
              renderInput={(params) => (
                <TextField type='number' {...params} variant="filled" label={t("USER_IDS")}  />
              )}
            />
            <FormHelperText>{t("PRESS_RETURN")}</FormHelperText>
          </FormControl>

        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose} color="primary">
          {t("CANCEL")}
          </Button>
          <Button disabled={ (users.length === 0 ) } onClick={handleSubmit} color="primary">
            {t("SUBMIT")}
          </Button>
        </DialogActions>
      </Dialog>
  )
}

export default ThanksDialog