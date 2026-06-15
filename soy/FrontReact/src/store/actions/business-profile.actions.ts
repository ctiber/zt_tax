import {
  CLEAR_BUSINESS_PROFILE_ERROR,
  GET_BUSINESS_PROFILES_SUCCESS,
  GET_BUSINESS_PROFILES_FAILURE,
  DELETE_BUSINESS_PROFILE_FAILURE,
  DELETE_BUSINESS_PROFILE_SUCCESS,
  UPDATE_BUSINESS_PROFILE_FAILURE,
  UPDATE_BUSINESS_PROFILE_SUCCESS,
  ADD_BUSINESS_PROFILE_FAILURE,
  ADD_BUSINESS_PROFILE_SUCCESS,
} from "./types";
import { IBusinessProfile } from "./../types/business-profile.types";
import BusinessProfileService from "./../../services/BusinessProfileService";
import { Dispatch } from "../types";
import { AxiosError, AxiosResponse } from "axios";

/**
 * Add businessProfile action that calls the API with the associate service and then dispatch the result to the reducer
 * @param businessProfile
 */
export const addBusinessProfileAction =
  (businessProfile: IBusinessProfile) => (dispatch: Dispatch) => {
    BusinessProfileService.create(businessProfile)
      .then((res : AxiosResponse) => {
        businessProfile.p_id = res.data.p_id;
        dispatch({
          type: ADD_BUSINESS_PROFILE_SUCCESS,
          payload: businessProfile,
        });
      })
      .catch((err : AxiosError) => {
        dispatch({
          type: ADD_BUSINESS_PROFILE_FAILURE,
          payload: err.response && err.response.data && err.response.data.message ? err.response.data.message : undefined
        });
      });
  };

/**
 * Update businessProfile action that calls the API with the associate service and then dispatch the result to the reducer
 * @param businessProfile
 */
export const updateBusinessProfileAction =
  (businessProfile: IBusinessProfile) => (dispatch: Dispatch) => {
    if (businessProfile.p_id !== undefined) {
      BusinessProfileService.update(businessProfile.p_id, businessProfile)
        .then((res : AxiosResponse) => {
          dispatch({
            type: UPDATE_BUSINESS_PROFILE_SUCCESS,
            payload: res.data,
          });
        })
        .catch((err : AxiosError) => {
          dispatch({
            type: UPDATE_BUSINESS_PROFILE_FAILURE,
            payload: err.response && err.response.data && err.response.data.message ? err.response.data.message : undefined
          });
        });
    } else {
      dispatch({
        type: UPDATE_BUSINESS_PROFILE_FAILURE,
        payload: "businessProfileId is undefined",
      })
    }
  };

/**
 * Delete businessProfile action that calls the API with the associate service and then dispatch the result to the reducer
 * @param businessProfileId
 */
export const deleteBusinessProfileAction =
  (businessProfileId: number | undefined) => (dispatch: Dispatch) => {
    if (businessProfileId !== undefined) {
      BusinessProfileService.remove(businessProfileId)
        .then((res: AxiosResponse) => {
          dispatch({
            type: DELETE_BUSINESS_PROFILE_SUCCESS,
            payload: businessProfileId,
          });
        })
        .catch((err: AxiosError) => {
          dispatch({
            type: DELETE_BUSINESS_PROFILE_FAILURE,
            payload: err.response && err.response.data && err.response.data.message ? err.response.data.message : undefined
          });
        });
    } else {
      dispatch({
        type: DELETE_BUSINESS_PROFILE_FAILURE,
        payload: "businessProfileId is undefined",
      })
    }
  };

/**
 * Get all businessProfile action that calls the API with the associate service and then dispatch the result to the reducer
 * @returns
 */
export const getAllBusinessProfileAction = () => (dispatch: Dispatch) => {
  BusinessProfileService.getAll()
  .then((res : AxiosResponse) => {
    dispatch({
      type: GET_BUSINESS_PROFILES_SUCCESS,
      payload: res.data,
    });
  })
  .catch( (err : AxiosError) => {
    dispatch({
      type: GET_BUSINESS_PROFILES_FAILURE,
      payload: err.response && err.response.data && err.response.data.message ? err.response.data.message : undefined
    })
  })
};

export const clearBussinessProfileError = () => (dispatch : Dispatch) => {
  dispatch({
    type: CLEAR_BUSINESS_PROFILE_ERROR,
    payload: undefined
  })
}