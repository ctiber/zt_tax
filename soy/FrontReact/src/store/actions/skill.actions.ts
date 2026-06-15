import {
  ADD_SKILL_SUCCESS,
  ADD_SKILL_FAILURE,
  UPDATE_SKILL_SUCCESS,
  UPDATE_SKILL_FAILURE,
  GET_ALL_SKILLS_SUCCESS,
  GET_ALL_SKILLS_FAILURE,
  DELETE_SKILL_SUCCESS,
  DELETE_SKILL_FAILURE,
  CLEAR_SKILL_ERROR,
} from "./types";

import { ISkill } from "./../types/skill.types";
import { Dispatch } from "./../types";
import SkillService from "./../../services/SkillService";
import { AxiosError, AxiosResponse } from "axios";


export const addSkillAction = (skill: ISkill) => async (dispatch: Dispatch) => {
  SkillService.create(skill)
  .then( (res: AxiosResponse) => {
    skill.skill_code = res.data.skill_code;
    dispatch({
      type: ADD_SKILL_SUCCESS,
      payload: skill,
    });
  })
  .catch( (err: AxiosError) => {
    dispatch({
      type: ADD_SKILL_FAILURE,
      payload: err.response && err.response.data && err.response.data.message ? err.response.data.message : undefined
    })
  })
};

export const updateSkillAction = (skill: ISkill) => async (dispatch: Dispatch) => {
  SkillService.update(skill.skill_code, skill)
  .then( (res: AxiosResponse) => {
    dispatch({
      type: UPDATE_SKILL_SUCCESS,
      payload: skill,
    });
  })
  .catch( (err: AxiosError) => {
    dispatch({
      type: UPDATE_SKILL_FAILURE,
      payload: err.response && err.response.data && err.response.data.message ? err.response.data.message : undefined
    })
  })
};

export const deleteSkillAction = (skillCode: string) => async (dispatch: Dispatch) => {
  SkillService.remove(skillCode)
  .then( (res : AxiosResponse) => {
    dispatch({
      type: DELETE_SKILL_SUCCESS,
      payload: skillCode,
    });
  })
  .catch( (err: AxiosError) => {
    dispatch({
      type: DELETE_SKILL_FAILURE,
      payload: err.response && err.response.data && err.response.data.message ? err.response.data.message : undefined
    })
  })
};

export const getAllSkillsAction = (locale: string) => async (dispatch: Dispatch) => {
  SkillService.getAll(locale)
  .then( (res: AxiosResponse) => {
    dispatch({
      type: GET_ALL_SKILLS_SUCCESS,
      payload: res.data,
    });
  })
  .catch( (err: AxiosError) => {
    dispatch({
      type: GET_ALL_SKILLS_FAILURE,
      payload: err.response && err.response.data && err.response.data.message ? err.response.data.message : undefined
    })
  })
};

export const clearSkillError = () => (dispatch : Dispatch) => {
  dispatch({
    type: CLEAR_SKILL_ERROR,
    payload: null
  })
}