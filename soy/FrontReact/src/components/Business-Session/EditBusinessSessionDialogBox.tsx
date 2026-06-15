import { Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, FormControl, InputLabel, MenuItem, Select, Switch, TextField } from "@material-ui/core";
import moment from "moment";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useDispatch, useSelector } from "react-redux";
import { addBusinessSessionAction, getAllSequencesAction, updateBusinessSessionAction } from "../../store/actions";
import { sequencesSelector } from "../../store/selectors/sequenceSelector";
import { IBusinessSession, ISequence } from "../../store/types";
import styles from './EditBusinessSessionDialogBox.module.css'


export const EditBusinessSessionDialogBox = ({session, open, set} : 
  {session : IBusinessSession, open: boolean, set : React.Dispatch<React.SetStateAction<boolean>>}) => {
  const dispatch = useDispatch();

  const sequences = useSelector(sequencesSelector);
  useEffect(() => {
    if(!sequences || sequences.length === 0) dispatch(getAllSequencesAction());
  }, [dispatch, sequences]);

  const handleEditDialogBoxClosing = () => {
    set(false);
  };

  const [currentSession, setCurrentSession] = useState(session ? {...session} : undefined)

  useEffect( () => {
    setCurrentSession(session)
  }, [session])

  if(currentSession)
  return (
    <EditBusinessSessionDialogBoxComponent
        session={currentSession as IBusinessSession}
        sequences={sequences}
        open={open}
        onClose={handleEditDialogBoxClosing}
      />
  )
  else return null;
}


const EditBusinessSessionDialogBoxComponent = ({
  session,
  sequences,
  open,
  onClose,
}: {
  session: IBusinessSession;
  sequences: ISequence[];
  open: boolean;
  onClose: () => void;
}) => {
  const dispatch = useDispatch();
  const { t } = useTranslation();

  const previousSession = { ...session };

  const [currentSession, setCurrentSession] = useState<IBusinessSession>(session);
  
  const handleSelectChange = (event: any) => {
    onChange({ ...currentSession, seq_id: +event.target.value });
  };
  useEffect( () => {
    setCurrentSession(session)
  }, [session])

  //True if create mode
  const createMode = previousSession.ps_id === 0;

  const onChange = (newValue: IBusinessSession) => {
    setCurrentSession(newValue);
  };

  const onUpdate = (session: IBusinessSession) => {
    let dupe = {...session}
    dupe.author = dupe.author.user_id
    dispatch(updateBusinessSessionAction(dupe));
    onClose();
  };


  const onCreate = (session: IBusinessSession) => {
    const profileId = sequences.find((seq) => seq.sequence_id === session.seq_id)?.profile_id;
    if (profileId) {
      session.p_id = profileId;
      dispatch(addBusinessSessionAction(currentSession));
      onClose();
    }
  };

  const onSave = createMode ? onCreate : onUpdate;

  return (
    <Dialog
      data-cy="session-edit-dialog"
      open={open}
      onClose={onClose}
      aria-labelledby="edit-session-dialog-title"
      aria-describedby="edit-session-dialog-description"
    >
      <DialogTitle id="edit-session-dialog-title">{createMode ? t("CREATE") : t("EDIT")} session</DialogTitle>
      <DialogContent>
        <DialogContentText id="edit-session-dialog-description">
          {createMode ? t("CREATING_SESSION_DESCRIPTION") : t("EDITING_SESSION_DESCRIPTION")}
        </DialogContentText>
        <div className={styles.dialogContentFlexContainer}>
          <TextField
            data-cy="session-dialog-name-field"
            id="name"
            className={styles.dialogContentFlexItem}
            label={t("NAME")}
            fullWidth={true}
            value={currentSession.name}
            onChange={(event) => onChange({ ...currentSession, name: event.target.value })}
            InputLabelProps={{
              shrink: true,
            }}
          />

          <TextField
            id="start-date"
            className={styles.dialogContentFlexItem}
            type="date"
            label={t("START_DATE")}
            value={moment(new Date(currentSession.start_date)).format("YYYY-MM-DD")}
            onChange={(event) => onChange({ ...currentSession, start_date: new Date(event.target.value) })}
            InputLabelProps={{
              shrink: true,
            }}
          />

          <TextField
            id="end-date"
            className={styles.dialogContentFlexItem}
            type="date"
            label={t("END_DATE")}
            value={moment(new Date(currentSession.end_date)).format("YYYY-MM-DD")}
            onChange={(event) => onChange({ ...currentSession, end_date: new Date(event.target.value) })}
            InputLabelProps={{
              shrink: true,
            }}
          />

          <TextField
            id="outlined-basic"
            className={styles.dialogContentFlexItem}
            label={t("DESCRIPTION")}
            variant="outlined"
            fullWidth={true}
            multiline={true}
            rows={4}
            value={currentSession.description}
            onChange={(event) => onChange({ ...currentSession, description: event.target.value })}
            InputLabelProps={{
              shrink: true,
            }}
          />

          <TextField
            id="secret-key"
            className={styles.dialogContentFlexItem}
            label={t("SECRET_KEY_OPTIONNAL")}
            fullWidth={true}
            value={currentSession.secret_key}
            onChange={(event) => onChange({ ...currentSession, secret_key: event.target.value })}
            InputLabelProps={{
              shrink: true,
            }}
          />

          <div className={styles.dialogContentFlexItem}>
            {t("IS_TIMED")}?
            <Switch
              checked={currentSession.is_timed}
              onChange={(event) => onChange({ ...currentSession, is_timed: event.target.checked })}
              color="primary"
              name="isTimed"
            />
          </div>

          <div className={styles.dialogContentFlexItem}>
            <FormControl fullWidth={true}>
              <InputLabel id="sequence-select-label">Sequence</InputLabel>
              <Select
                labelId="sequence-select-label"
                id="sequence-select"
                value={currentSession.seq_id}
                onChange={handleSelectChange}
              >
                {sequences.map((seq) => (
                  <MenuItem key={seq.sequence_id} value={seq.sequence_id}>
                    {seq.description}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </div>
        </div>
      </DialogContent>
      <DialogActions>
        <Button data-cy="session-dialog-cancel-button" color="secondary" onClick={onClose} autoFocus>
          {t("CANCEL")}
        </Button>
        <Button
          variant="contained"
          onClick={() => onSave(currentSession)}
          autoFocus
          className="session-list-primary-button"
        >
          {t("SAVE")}
        </Button>
      </DialogActions>
    </Dialog>
  );
}