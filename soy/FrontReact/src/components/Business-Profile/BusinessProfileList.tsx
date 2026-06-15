import React, { useEffect, useState } from "react";
import { useSelector, useDispatch } from "react-redux";
import { IBusinessProfile } from "../../store/types/business-profile.types";
import styles from "./BusinessProfile.module.css";

import { getAllBusinessProfileAction } from "./../../store/actions/business-profile.actions";
import {
  businessProfileSelector,
} from "./../../store/selectors/businessProfileSelector";

import IconButton from "@material-ui/core/IconButton";
import AddCircleIcon from "@material-ui/icons/AddCircle";
import { BusinessProfileItem } from "./BusinessProfileItem";
import { useTranslation } from "react-i18next";
import { BusinessProfileForm } from "./BusinessProfileForm";
import { connectedUserSelector } from "../../store/selectors";
import { Container, Divider, Paper, Typography } from "@material-ui/core";
import { BusinessProfileReducer } from "../../store/reducers/businessProfileReducer";
import withReducer from "../../store/withReducer";


/**
 * It is a functional component that makes a BusinessProfile list
 * @returns The BusinessProfile list HTML element
 */
function BusinessProfileList() {
  const dispatch = useDispatch();
  const initBusinessProfile: IBusinessProfile = {
    p_id: undefined,
    job: "",
    level: "",
    sector: "",
    description: "",
    ref_id: undefined,
    locale: "",
  };
  const { t } = useTranslation();

  /**
   * Get businessProfiles from Selector
   */
  const businessProfiles = useSelector(businessProfileSelector);

  /* ------------ STATE ------------ */
  /**
   * Manage the edit/create opening
   */
  const [open, setOpen] = useState(false);

  /**
   * Manage the businessProfile that fill the edit/create form
   */
  const [currentBusinessProfile, setCurrentBusinessProfile] =
    useState(initBusinessProfile);

  /**
   * Manage the edit/create mode
   */
  const [editMode, setEditMode] = useState(false);

  /* ------------ FUNCTIONS ------------ */
  /**
   * Open and fill the create form
   */
  const handleClickOpen = () => {
    setCurrentBusinessProfile(initBusinessProfile);
    setEditMode(false);
    setOpen(true);
  };

  /**
   * Manage the edit/create form closing
   */
  const handleClose = () => {
    setOpen(false);
  };

  /**
   * Call the get all the BusinessProfile action
   */
  useEffect(() => {
    dispatch(getAllBusinessProfileAction());
  }, [dispatch]);

  const connectedUser = useSelector(connectedUserSelector);

  function isAdmin() {
    if (connectedUser && connectedUser.role_id === 1) {
      return true;
    } else {
      return false;
    }
  }

  /* ------------ RENDER ------------ */
  return (
    <React.Fragment>
      <Container>

        <Typography variant="h3" component="h1" color="primary" className="title">
            {t("PROFILES")}
          </Typography>
        <Paper>
          <div className={styles.header}>
            <Typography variant="h6" component="h3" className="title">
              {t("BUSINESS_PROFILE_EXPLANATION_TEXT")}
            </Typography>
            {isAdmin() && (
              <React.Fragment>
                <IconButton data-cy="profile-create" onClick={handleClickOpen}>
                  <AddCircleIcon />
                </IconButton>
                <BusinessProfileForm
                  open={open}
                  handleClose={handleClose}
                  currentBusinessProfile={currentBusinessProfile}
                  setCurrentBusinessProfile={setCurrentBusinessProfile}
                  editMode={editMode}
                />
              </React.Fragment>
            )}
          </div>
          
            
              <Divider />
          <div data-cy="list" id="list" className={styles.businessProfileList}>
            {
            businessProfiles.length !== 0 ? 
              businessProfiles.map((businessProfile) => (
                <BusinessProfileItem
                  businessProfile={businessProfile}
                  key={businessProfile.p_id}
                  setCurrentBusinessProfile={setCurrentBusinessProfile}
                  setOpen={setOpen}
                  setEditMode={setEditMode}
                  isAdmin={isAdmin}
                />
              ))
            : 
              "There is no profile yet"
            }
            
          </div>
        </Paper>
      </Container>
    </React.Fragment>
  );
}


export default withReducer([{key:'businessProfile',reducer: BusinessProfileReducer}])(BusinessProfileList)