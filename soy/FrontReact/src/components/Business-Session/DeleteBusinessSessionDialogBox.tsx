import { Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle } from "@material-ui/core"
import { useTranslation } from "react-i18next";
import { useDispatch } from "react-redux";
import { deleteBusinessSessionAction } from "../../store/actions";
import { IBusinessSession } from "../../store/types"


export const DeleteBusinessSessionDialogBox = ({session, open, set} : 
  {session : IBusinessSession, open: boolean, set : React.Dispatch<React.SetStateAction<boolean>>}) => {

  const dispatch = useDispatch()

  const handleDeleteDialogBoxClosing = () => {
    set(false);
  };
  
  const handleDelete = () => {
    dispatch(deleteBusinessSessionAction(session.ps_id));
    handleDeleteDialogBoxClosing();
  };

  

  return (
    <DeleteBusinessSessionDialogBoxComponent 
      open={open}
      onClose={handleDeleteDialogBoxClosing}
      onDelete={handleDelete}
      />
  )
}

const DeleteBusinessSessionDialogBoxComponent = (
  {open, onClose, onDelete} : {  open: boolean, onClose: () => void, onDelete : () => void}
) => {
  const { t } = useTranslation()
  return (
    <Dialog
      open={open}
      onClose={onClose}
      aria-labelledby="delete-session-dialog-title"
      aria-describedby="delete-session-dialog-description"
    >
      <DialogTitle id="delete-session-dialog-title">{t("DELETE_SESSION")}</DialogTitle>
      <DialogContent>
        <DialogContentText id="delete-session-dialog-description">
          {t("DELETING_SESSION_DESCRIPTION")}
        </DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button
          variant="contained"
          onClick={onClose}
          autoFocus
          className="session-list-primary-button"
        >
          {t("CANCEL")}
        </Button>
        <Button
          variant="contained"
          onClick={() => onDelete()}
          autoFocus
          className="session-list-primary-button"
        >
          {t("DELETE")}
        </Button>
      </DialogActions>
    </Dialog>
  )
}