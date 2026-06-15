import { SkillState } from "../types/skill.types";
import { Action } from "../types";
import {
  ADD_SKILL_SUCCESS,
  ADD_SKILL_FAILURE,
  GET_ALL_SKILLS_SUCCESS,
  GET_ALL_SKILLS_FAILURE,
  DELETE_SKILL_SUCCESS,
  DELETE_SKILL_FAILURE,
  UPDATE_SKILL_SUCCESS,
  UPDATE_SKILL_FAILURE,
  CLEAR_SKILL_ERROR,
} from "../actions";
import { ISkill } from "./../types/skill.types";

const initialState = {
  skills: [],
  error: undefined
};

export const SkillReducer = (state: SkillState = initialState, action: Action) => {
  const {payload, type} = action
  switch (type) {

    /**
     * ACTIONS
     */

    case ADD_SKILL_SUCCESS:
      return {
        ...state,
        skills: [...state.skills, payload],
      };
      
    case DELETE_SKILL_SUCCESS:
      return {
        ...state,
        skills: state.skills.filter(
          (skill: ISkill) => skill.skill_code !== payload
        ),
      };

    case UPDATE_SKILL_SUCCESS:
      let newState: ISkill[] = [];
      state.skills.forEach((skill: ISkill) => {
        if (skill.skill_code === payload.skill_code) {
          newState.push(payload);
        } else {
          newState.push(skill);
        }
      });
      return {
        ...state,
        skills: newState,
      };

    case GET_ALL_SKILLS_SUCCESS:
      return {
        ...state,
        skills: payload,
      };

    /**
     * ERRORS
     */

    case ADD_SKILL_FAILURE:
    case DELETE_SKILL_FAILURE:
    case UPDATE_SKILL_FAILURE:
    case GET_ALL_SKILLS_FAILURE:
      return{
        ...state,
        error: payload ? payload : type
      }
    
    case CLEAR_SKILL_ERROR:
      return {
        ...state,
        error: undefined
      }
    default:
      return state;
  }
};
