import { IRootState } from "./../types/index";

/**
 * Get businessProfiles from the state
 * @param state current global state
 * @returns the selected property form the state
 */
export const businessProfileSelector = (state: IRootState) =>
  state.businessProfile.businessProfiles;

/**
 * Get message from the state
 * @param state
 * @returns the selected property form the state
 */
export const businessProfileErrorSelector = (state: IRootState) => state.businessProfile && state.businessProfile.error ? state.businessProfile.error : undefined;
