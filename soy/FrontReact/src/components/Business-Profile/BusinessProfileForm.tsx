import {
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  TextField,
} from "@material-ui/core";
import Button from "@material-ui/core/Button";
import { updateBusinessProfileAction } from "../../store/actions";
import { IBusinessProfile } from "./../../store/types/business-profile.types";
import { addBusinessProfileAction } from "./../../store/actions/business-profile.actions";
import { useDispatch } from "react-redux";
import { useTranslation } from "react-i18next";
import styles from './BusinessProfile.module.css'
import { useEffect, useState } from "react";
import { getAvailableLangs } from "../../i18n";

export function BusinessProfileForm({
  open,
  handleClose,
  currentBusinessProfile,
  setCurrentBusinessProfile,
  editMode,
}: {
  open: boolean;
  handleClose: () => void;
  currentBusinessProfile: IBusinessProfile;
  setCurrentBusinessProfile: (profile: IBusinessProfile) => void;
  editMode: boolean;
}) {
  const dispatch = useDispatch();

  const { t } = useTranslation();

  /**
   * Handle the edit/create form submission, so it calls the upadte or create businessProfile action
   * @param e Form event
   */
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault(); //Empêche le refresh de la page

    if (editMode) {
      const newBusinessProfile: IBusinessProfile = {
        p_id: currentBusinessProfile.p_id,
        job: currentBusinessProfile.job,
        level: currentBusinessProfile.level,
        sector: currentBusinessProfile.sector,
        description: currentBusinessProfile.description,
        ref_id: currentBusinessProfile.ref_id,
        locale: currentBusinessProfile.locale,
      };
      dispatch(updateBusinessProfileAction(newBusinessProfile));
    } else {
      const newBusinessProfile: IBusinessProfile = {
        p_id: 0,
        job: currentBusinessProfile.job,
        level: currentBusinessProfile.level,
        sector: currentBusinessProfile.sector,
        description: currentBusinessProfile.description,
        ref_id: currentBusinessProfile.ref_id,
        locale: currentBusinessProfile.locale,
      };
      dispatch(addBusinessProfileAction(newBusinessProfile));
    }
    handleClose();
  };

  /**
   * Manage the modification of entries by modifying the local states
   * @param value New value to set up
   * @param property Property to set up
   */
  const handleFormChange = (value: any, property: string) => {
    let profile: IBusinessProfile = {
      p_id: currentBusinessProfile.p_id,
      job: currentBusinessProfile.job,
      level: currentBusinessProfile.level,
      sector: currentBusinessProfile.sector,
      description: currentBusinessProfile.description,
      ref_id: currentBusinessProfile.ref_id,
      locale: currentBusinessProfile.locale,
    };
    switch (property) {
      case "JOB":
        profile.job = value;
        setCurrentBusinessProfile(profile);
        break;
      case "LEVEL":
        profile.level = value;
        setCurrentBusinessProfile(profile);
        break;
      case "SECTOR":
        profile.sector = value;
        setCurrentBusinessProfile(profile);
        break;
      case "DESCRIPTION":
        profile.description = value;
        setCurrentBusinessProfile(profile);
        break;
      case "LOCALE":
        profile.locale = value;
        setCurrentBusinessProfile(profile);
        break;
      default:
        break;
    }
  };


  const [langs, setLangs] = useState<any[]>([])

  useEffect( () => {

    const fetchLangs = async () => {
      setLangs(await getAvailableLangs())
    }
    if(langs.length === 0) fetchLangs()

  }, [langs])

  return (
    <Dialog
      data-cy="profile-form"
      className="dialog__box"
      open={open}
      onClose={handleClose}
      aria-labelledby="form-dialog-title"
    >
      <DialogTitle className={styles.dialog__item} id="form-dialog-title">
        {t("PROFILE_CREATION")}
      </DialogTitle>
      <DialogContent className={styles.dialog__item}>
        <DialogContentText className={styles.dialog__content}>
          {t("PROFILE_CREATION_DESCRIPTION")}
        </DialogContentText>
        <TextField
          className={styles.dialog__content}
          required
          id="job"
          label={t("JOB")}
          value={currentBusinessProfile.job}
          type="text"
          onChange={(e) => handleFormChange(e.target.value, "JOB")}
          fullWidth
        />
        <TextField
          className={styles.dialog__content}
          id="level"
          label={t("LEVEL")}
          value={currentBusinessProfile.level}
          type="text"
          onChange={(e) => handleFormChange(e.target.value, "LEVEL")}
          fullWidth
        />
        <TextField
          className={styles.dialog__content}
          required
          id="sector"
          label={t("SECTOR")}
          value={currentBusinessProfile.sector}
          type="text"
          onChange={(e) => handleFormChange(e.target.value, "SECTOR")}
          fullWidth
        />
        <TextField
          className={styles.dialog__content}
          label={t("DESCRIPTION")}
          id="description"
          value={currentBusinessProfile.description}
          type="text"
          onChange={(e) => handleFormChange(e.target.value, "DESCRIPTION")}
          fullWidth
        />
        <FormControl className={styles.dialog__content} style={{width:"100%"}}>
          <InputLabel>{t("LOCALE")}</InputLabel>
          <Select
            value={currentBusinessProfile.locale}
            label={t("LOCALE")}
            onChange={(e) => handleFormChange(e.target.value, "LOCALE")}
          >
            {
              langs.length > 0 ?
                langs.map( (item) => (
                  <MenuItem value={item.code}>{item.name}</MenuItem>
                ))
              :
                <MenuItem>Fetching data please wait...</MenuItem>
            }
            <MenuItem value="other">Other</MenuItem>
          </Select>
        </FormControl>
      </DialogContent>
      <DialogActions className={styles.dialog__content}>
        <Button data-cy="profile-form-cancel" color="secondary" onClick={handleClose} >
          {t("CANCEL")}
        </Button>
        <Button id="submit" variant="contained" onClick={handleSubmit} >
          {editMode ? t("EDIT") : t("CREATE")}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
