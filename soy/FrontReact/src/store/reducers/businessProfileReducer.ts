import { Action, BusinessProfileState } from "../types";
import { IBusinessProfile } from "./../types/business-profile.types";
import { ADD_BUSINESS_PROFILE_SUCCESS,
  ADD_BUSINESS_PROFILE_FAILURE,
  UPDATE_BUSINESS_PROFILE_SUCCESS,
  UPDATE_BUSINESS_PROFILE_FAILURE,
  DELETE_BUSINESS_PROFILE_SUCCESS,
  DELETE_BUSINESS_PROFILE_FAILURE, 
  GET_BUSINESS_PROFILES_SUCCESS,
  GET_BUSINESS_PROFILES_FAILURE,
  CLEAR_BUSINESS_PROFILE_ERROR 
} from "./../actions/types";

const initBusinessProfile: IBusinessProfile = {
  p_id: 0,
  job: "",
  level: "",
  sector: "",
  description: "",
  ref_id: 5,
  locale: "",
};

const initialState = {
  businessProfiles: [],
  error: undefined,
  currentBusinessProfile: initBusinessProfile,
};

/**
 * The reducer handle all redux actions to update the state.
 * @param state current state
 * @param action action to handle
 * @returns new state
 */
export const BusinessProfileReducer = (
  state: BusinessProfileState = initialState,
  action: Action
) => {
  const {payload, type} = action
  switch (type) {

    /**
     * ACTIONS
     */

    case ADD_BUSINESS_PROFILE_SUCCESS:
      return {
        ...state,
        businessProfiles: [...state.businessProfiles, payload],
      };

    case UPDATE_BUSINESS_PROFILE_SUCCESS:
      let newState: IBusinessProfile[] = [];
      state.businessProfiles.forEach((businessProfile: IBusinessProfile) => {
        if (businessProfile.p_id === payload.p_id) {
          newState.push(payload);
        } else {
          newState.push(businessProfile);
        }
      });
      return {
        ...state,
        businessProfiles: newState,
      };

    case DELETE_BUSINESS_PROFILE_SUCCESS:
      return {
        ...state,
        businessProfiles: state.businessProfiles.filter(
          (businessProfile: IBusinessProfile) => businessProfile.p_id !== payload
        ),
      };
      
    case GET_BUSINESS_PROFILES_SUCCESS:
      return {
        ...state,
        businessProfiles: payload,
      };

    /** 
     * ERRORS
     */
    
    case ADD_BUSINESS_PROFILE_FAILURE:
    case UPDATE_BUSINESS_PROFILE_FAILURE:
    case DELETE_BUSINESS_PROFILE_FAILURE:
    case GET_BUSINESS_PROFILES_FAILURE:
      return {
        ...state,
        error: payload ? payload : type,
      };

    case CLEAR_BUSINESS_PROFILE_ERROR:
      return {
        ...state,
        error: undefined,
      };

    default:
      return state;
  }
};
