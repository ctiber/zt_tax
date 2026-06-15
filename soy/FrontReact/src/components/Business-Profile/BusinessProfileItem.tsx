import React, { useState } from "react";
import { useDispatch } from "react-redux";
import { deleteBusinessProfileAction } from "./../../store/actions/business-profile.actions";
import { IBusinessProfile } from "./../../store/types/business-profile.types";
import Card from "@material-ui/core/Card";
import CardContent from "@material-ui/core/CardContent";
import CardActions from "@material-ui/core/CardActions";
import IconButton from "@material-ui/core/IconButton";
import EditIcon from "@material-ui/icons/Edit";
import DeleteIcon from "@material-ui/icons/Delete";
import ExpandMoreIcon from "@material-ui/icons/ExpandMore";
import { Collapse, Divider } from "@material-ui/core";
import Typography from "@material-ui/core/Typography";
import { useTranslation } from "react-i18next";
import styles from './BusinessProfile.module.css'

/**
 * It is a functional component that makes a BusinessProfile
 * @param businessProfile The BusinessProfile to display
 * @param setCurrentBusinessProfile Function to send the current businessProfile data to the edit form
 * @param setOpen Function to open the edit form
 * @param setEditMode Function to tell the form that you are doing an edit and not a create
 * @returns A BusinessProfile Item HTML
 */
export function BusinessProfileItem({
  businessProfile,
  setCurrentBusinessProfile,
  setOpen,
  setEditMode,
  isAdmin,
}: {
  businessProfile: IBusinessProfile;
  setCurrentBusinessProfile: (arg0: IBusinessProfile) => void;
  setOpen: (arg0: boolean) => void;
  setEditMode: (arg0: boolean) => void;
  isAdmin: () => boolean;
}) {
  const dispatch = useDispatch();

  /* ------------ STATE ------------ */
  /**
   * Local state expanded which allows to manage the extension of the card to see the description
   */
  const [expanded, setExpanded] = useState(false);

  /* ------------ FUNCTIONS ------------ */
  /**
   * Call the delete businessProfile action
   */
  const handleDelete = () => {
    dispatch(deleteBusinessProfileAction(businessProfile.p_id));
  };

  const { t } = useTranslation();

  /**
   * Open and fill the edit form
   */
  const handleEditClick = () => {
    setEditMode(true);
    setCurrentBusinessProfile(businessProfile);
    setOpen(true);
  };

  /**
   * Manage the extension or not of the card to see the description
   */
  const handleExpandClick = () => {
    setExpanded(!expanded);
  };

  /* ------------ RENDER ------------ */
  return (
    <Card className={styles.card} variant="outlined">
      <CardContent>
        <div className={styles.card__content}>
          <span className={styles.card__title}>{businessProfile.job}</span>
          <div className={styles.card__item}>
            <span>{t("LEVEL")}</span>
            <span>{businessProfile.level}</span>
          </div>
          <div className={styles.card__item}>
            <span>{t("SECTOR")}</span>
            <span>{businessProfile.sector}</span>
          </div>
          <div className={styles.card__item}>
            <span>Ref_id : </span>
            <span>{businessProfile.ref_id}</span>
          </div>
          <div className={styles.card__item}>
            <span>{t("LOCALE")}</span>
            <span>{businessProfile.locale}</span>
          </div>
        </div>
      </CardContent>
      <Divider />
      <CardActions className={styles.card__actions}>
        {isAdmin() && (
          <React.Fragment>
            <IconButton
              data-cy="profile-edit-button"
              onClick={handleEditClick}
              aria-label="edit and save business profile"
            >
              <EditIcon />
            </IconButton>
            <IconButton id="delete" color="secondary" onClick={handleDelete} aria-label="delete business profile">
              <DeleteIcon />
            </IconButton>
          </React.Fragment>
        )}
        <IconButton
          data-cy="profile-expand-button"
          className={expanded ? styles.card__expanded : styles.card__expand}
          onClick={handleExpandClick}
          aria-expanded={expanded}
          aria-label="show more"
        >
          <ExpandMoreIcon />
        </IconButton>
      </CardActions>
      <Divider />

      <Collapse data-cy="profile-collapsible" className={styles.card__collapse} in={expanded} timeout="auto" unmountOnExit>
        <CardContent>
          <Typography paragraph>{t("DESCRIPTION")}</Typography>
          <span className={styles.card__titleInput}>{businessProfile.description}</span>
        </CardContent>
      </Collapse>
    </Card>
  );
}
