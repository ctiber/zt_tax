import { Snackbar } from "@material-ui/core";
import { Alert, Color } from "@material-ui/lab";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useDispatch } from "react-redux";
import { Dispatch } from "redux";


/**
 * Custom Toast component that will be appear an Alert in the bottom right corner.
 * You can pass the props of the message and severity
 * but also some cleanup methods that will be called once the error has appeared.
 */
export function Toast({ offset, message, severity, clearState, clearFromStore, onUnmount }: { offset?: number, message: string, severity: Color, clearState?: () => void ,clearFromStore?: () => (dispatch: Dispatch) => void , onUnmount? : () => void}) {
  let style;
  if(offset) {
    style = {
      bottom: (offset*50)+24+"px"
    }
  }

  const {t, i18n} = useTranslation()

  const dispatch = useDispatch()

  const [open, setOpen] = useState(false)
  const [errorMessage, setErrorMessage] = useState("")

  const handleClose = (event?: React.SyntheticEvent, reason?: string) => {
    if (reason === 'clickaway') {
      return;
    }
    if(onUnmount) onUnmount()
    setOpen(false);
  };

  useEffect( () => {
    if(message !== ""){
      if(i18n.exists(message)){
        setErrorMessage(t(message))
      }else{
        setErrorMessage(message)
      }
      setOpen(true)
      if(clearFromStore) dispatch(clearFromStore())
      if(clearState) clearState()
    }


  }, [message, dispatch, t, i18n, clearFromStore, clearState])

  return (
    <Snackbar style={style} anchorOrigin={{vertical:'bottom', horizontal:'right'}} open={open} autoHideDuration={4000} onClose={handleClose}>
        <Alert data-cy="alert" onClose={handleClose} severity={severity}>{errorMessage}</Alert>
    </Snackbar>
  );
}

