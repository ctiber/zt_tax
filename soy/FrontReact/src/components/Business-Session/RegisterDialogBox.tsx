import { Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, TextField } from "@material-ui/core";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useDispatch, useSelector } from "react-redux";
import { registerSessionAction } from "../../store/actions";
import { businessProfileSelector, connectedUserSelector } from "../../store/selectors";
import { IBusinessSession } from "../../store/types";


export const RegisterDialogBox = ({session, open, set} : 
  {session : IBusinessSession, open: boolean, set : React.Dispatch<React.SetStateAction<boolean>>}) => {

  const dispatch = useDispatch();
  const connectedUser = useSelector(connectedUserSelector)

  const handleDialogBoxClosing = () => {
    set(false);
  };

   /**
   * Dispatches a registerSessionAction in order for the connected user to register to the given session
   * @param session the session to register to.
   */
    const handleRegister = (session: IBusinessSession, secretKey: string) => {
      if (session.ps_id && connectedUser && connectedUser.user_id) {
        dispatch(registerSessionAction(session.ps_id, connectedUser.user_id, secretKey));
      }
      handleDialogBoxClosing(); //This function will only be called inside of a dialog box in order to "secure" the registering (the user won't register by accident)
    };

  return (
    <RegisterDialogBoxComponent 
      session={session}
      open={open}
      onClose={handleDialogBoxClosing}
      onRegister={handleRegister}
      />
  )
}


/**
 * A dialog box used when the user clicks the register button. It asks him for confirmation and if so, uses the onRegister function passed by props.
 * @param param0 The corresponding session, the boolean that determines if it's openned or closed, the onClose function (that toggles the boolean), the function called to register a user to a session.
 * @returns
 */
function RegisterDialogBoxComponent ({
  session,
  open,
  onClose,
  onRegister,
}: {
  session: IBusinessSession | undefined;
  open: boolean;
  onClose: () => void;
  onRegister: (session: IBusinessSession, secretKey: string) => void;
}) {
  //i18n TRANSLATION FUNCTION
  const { t } = useTranslation();
  const profiles = useSelector(businessProfileSelector);
  const [secretKey, setSecretKey] = useState("");

  if (session) {
    return (
      <Dialog
        open={open}
        onClose={onClose}
        aria-labelledby="register-dialog-title"
        aria-describedby="register-dialog-description"
      >
        <DialogTitle id="register-dialog-title">{t("SESSION_REGISTER_ALERT_TITLE")}</DialogTitle>
        <DialogContent>
          <DialogContentText id="register-dialog-description">
            {t("SESSION_REGISTER_ALERT_DESCRIPTION")}
          </DialogContentText>
          <DialogContentText id="session-name">
            <b>{t("NAME")} : </b>{session.name}
          </DialogContentText>
          <DialogContentText id="session-description">
            <b>{t("DESCRIPTION")} : </b>{session.description}
          </DialogContentText>
          <DialogContentText id="session-dates">
            <b>{t("AVAILABLE")} : </b>{new Date(session.start_date).toLocaleString()} - {new Date(session.end_date).toLocaleString()}
          </DialogContentText>
            <DialogContentText id="session-profile">
              <b>{t("AIMED_JOB")} : </b>{profiles.find((profile) => profile.p_id === session.p_id)?.job}
            </DialogContentText>

          {session.secret_key && (
            <TextField
              id="outlined-basic"
              label="Session's secret key"
              variant="outlined"
              InputLabelProps={{ shrink: true }}
              value={secretKey}
              onChange={(event) => setSecretKey(event?.target.value)}
              fullWidth={true}
              required={true}
              className="secret-key-input"
            />
          )}
        </DialogContent>
        <DialogActions>
          <Button variant="contained" onClick={onClose} autoFocus className="session-list-primary-button">
            {t("CANCEL")}
          </Button>
          <Button
            variant="contained"
            onClick={() => onRegister(session, secretKey)}
            autoFocus
            className="session-list-primary-button"
          >
            {t("REGISTER")}
          </Button>
        </DialogActions>
      </Dialog>
    );
  } else {
    return null;
  }
}