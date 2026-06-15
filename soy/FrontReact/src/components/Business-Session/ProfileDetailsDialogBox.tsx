import {
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Button,
} from "@material-ui/core";
import { useTranslation } from "react-i18next";
import { IBusinessProfile } from "../../store/types";

/**
 * Dialog box that displays details about a profile.
 * @param param0 the matching profile, the boolean that determines if the dialog box is openned and the onClose function that'll be called whenever the dialog box is closed
 * @returns A dialog box displaying details about the profile
 */
export default function ProfileDetailsDialogBox({
  profile,
  open,
  onClose,
}: {
  profile: IBusinessProfile | undefined;
  open: boolean;
  onClose: () => void;
}) {
  const { t } = useTranslation();

  if (profile) {
    return (
      <Dialog
        data-cy="profile-details-dialog"
        open={open}
        onClose={onClose}
        aria-labelledby="profile-details-dialog-title"
        aria-describedby="profile-details-dialog-description"
      >
        <DialogTitle id="profile-details-dialog-title">{t("PROFILE_DETAILS")}</DialogTitle>
        <DialogContent>
          <DialogContentText id="profile-details-dialog-description">{t("AIMED_PROFILE")}:</DialogContentText>
          <div>
            <p>
              <b>{t("AIMED_JOB")}:</b> {profile.job}
            </p>
            <p>
              <b>{t("SECTOR")}:</b> {profile.sector}
            </p>
            <p>
              <b>{t("LEVEL")}:</b> {profile.level}
            </p>
            <p>
              <b>{t("DESCRIPTION")}:</b> {profile.description}
            </p>
          </div>
        </DialogContent>
        <DialogActions>
          <Button data-cy="profile-details-cancel-button" variant="contained" onClick={onClose} autoFocus className="session-list-primary-button">
            {t("CANCEL")}
          </Button>
        </DialogActions>
      </Dialog>
    );
  } else {
    return null;
  }
}
