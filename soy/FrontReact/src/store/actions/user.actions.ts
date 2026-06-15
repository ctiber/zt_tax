import { AxiosError, AxiosResponse } from "axios";
import ThanksService from "../../services/ThanksService";
import { Dispatch } from "../types";
import { ILogin } from "../types/user.types";
import { history } from "./../../helpers/history";
import UserService from "./../../services/UserService";
import { IUser } from "./../types/user.types";
import {
  ACTIVATE_ACCOUNT_SUCCESS,
  ACTIVATE_ACCOUNT_FAILURE,
  CHANGE_PASSWORD_SUCCESS,
  CHANGE_PASSWORD_FAILURE,
  CLEAR_USER_ERROR,
  GET_ALL_USERS_SUCCESS,
  GET_ALL_USERS_FAILURE,
  GET_USER_SKILLS_SUCCESS,
  GET_USER_SKILLS_FAILURE,
  LOGIN_USER_SUCCESS,
  LOGIN_USER_FAILURE,
  LOGOUT_USER_SUCCESS,
  LOGOUT_USER_FAILURE,
  REGISTER_USER_SUCCESS,
  REGISTER_USER_FAILURE, 
  REQUEST_PASSWORD_RESET_SUCCESS, 
  REQUEST_PASSWORD_RESET_FAILURE,
  UPDATE_USER_SUCCESS,
  UPDATE_USER_FAILURE,
  GET_NBR_THANKS_SUCCESS,
  SEND_THANK_SUCESS,
  GET_NBR_THANKS_FAILURE,
  SEND_THANK_FAILURE
} from "./types";

export const clearUserError = () => (dispatch: Dispatch) => {
  dispatch({
    type: CLEAR_USER_ERROR,
    payload: null
  })
}

export const loginUserAction = (data: ILogin) => (dispatch: Dispatch) => {
  UserService.login(data)
    .then((res : AxiosResponse) => {
        (dispatch({
          type: LOGIN_USER_SUCCESS,
          payload: {token: res.data},
        }) as any).then( () => {
          history.push("/");
        })
    })
    .catch((err : AxiosError) => {
      let error = "Unknown error, API could be stopped"
      
      if (err.response && err.response.data && err.response.data.message) {
        // Request made and server responded
        error = err.response.data.message
      }

      dispatch({
        type: LOGIN_USER_FAILURE,
        payload: error,
      });
    });
};

export const logoutUserAction = () => (dispatch: Dispatch) => {
  UserService.logout()
    .then((res : AxiosResponse) => {
      dispatch({
        type: LOGOUT_USER_SUCCESS,
        payload: null,
      })
    })
    .catch((err: AxiosError) => {
      dispatch({
        type: LOGOUT_USER_FAILURE,
        payload: err.response && err.response.data && err.response.data.message ? err.response.data.message : undefined
      });
    });
};

export const registerUserAction = (data: IUser) => (dispatch: Dispatch) => {
  UserService.create(data)
    .then((res : AxiosResponse) => {
      dispatch({
        type: REGISTER_USER_SUCCESS,
        payload: null,
      });
      history.push("/login");
    })
    .catch((err: AxiosError) => {
      dispatch({
        type: REGISTER_USER_FAILURE,
        payload: err.response && err.response.data && err.response.data.message ? err.response.data.message : undefined
      });
    });
};

export const activateAccount = (activation_token: string) => (dispatch: Dispatch) => {
  UserService.activateAccount(activation_token)
    .then((res : AxiosResponse) => {
      dispatch({
        type: ACTIVATE_ACCOUNT_SUCCESS,
        payload: null,
      });
    })
    .catch((err : AxiosError) => {
      dispatch({
        type: ACTIVATE_ACCOUNT_FAILURE,
        payload: err.response && err.response.data && err.response.data.message ? err.response.data.message : undefined
      });
    });
}

export const requestPasswordReset = (email: string) => (dispatch: Dispatch) => {
  UserService.requestPasswordReset(email)
      .then((res : AxiosResponse) => {
        dispatch({
          type: REQUEST_PASSWORD_RESET_SUCCESS,
          payload: null,
        });
      })
      .catch((err : AxiosError) => {
        dispatch({
          type: REQUEST_PASSWORD_RESET_FAILURE,
          payload: err.response && err.response.data && err.response.data.message ? err.response.data.message : undefined
        });
      });
}

export const getAllUsers = () => (dispatch: Dispatch) => {
  UserService.getAll()
  .then( (res : AxiosResponse) => {
    dispatch({
      type: GET_ALL_USERS_SUCCESS,
      payload: res.data
    })
  })
  .catch( (err : AxiosError) => {
    dispatch({
      type: GET_ALL_USERS_FAILURE,
      payload: err.response && err.response.data && err.response.data.message ? err.response.data.message : undefined
    })
  })
}

export const getUserSkills = (user_id: number) => (dispatch: Dispatch) => {
  UserService.getUserSkills(user_id)
  .then( (res : AxiosResponse) => {
    dispatch({
      type: GET_USER_SKILLS_SUCCESS,
      payload: res.data
    })
  })
  .catch( (err : AxiosError) => {
    dispatch({
      type: GET_USER_SKILLS_FAILURE,
      payload: err.response && err.response.data && err.response.data.message ? err.response.data.message : undefined
    })
  })
}

export const updateUser = (user_id: number, data : IUser) => (dispatch: Dispatch) => {
  UserService.update(user_id,data)
  .then( (res : AxiosResponse) => {
    dispatch({
      type: UPDATE_USER_SUCCESS,
      payload: res.data
    })
  })
  .catch( (err : AxiosError) => {
    dispatch({
      type: UPDATE_USER_FAILURE,
      payload: err.response && err.response.data && err.response.data.message ? err.response.data.message : undefined
    })
  })
}

export const changeRole = (user_id: number, data: IUser) => (dispatch: Dispatch) => {
  UserService.changeRole(user_id, data)
  .then( (res : AxiosResponse) => {
    dispatch({
      type: UPDATE_USER_SUCCESS,
      payload: res.data
    })
  })
  .catch( (err : AxiosError) => {
    dispatch({
      type: UPDATE_USER_FAILURE,
      payload: err.response && err.response.data && err.response.data.message ? err.response.data.message : undefined
    })
  })
}

export const changePassword = (token: string, password: string, passwordConfirm: string) => (dispatch: Dispatch) => {
  UserService.changePassword(token, password, passwordConfirm)
    .then((res : AxiosResponse) => {
      dispatch({
        type: CHANGE_PASSWORD_SUCCESS,
        payload: null,
      });
    })
    .catch((err : AxiosError) => {
      dispatch({
        type: CHANGE_PASSWORD_FAILURE,
        payload: err.response && err.response.data && err.response.data.message ? err.response.data.message : undefined
      });
    });
}

export const getNbrThanks = (user_id: number) => (dispatch: Dispatch) => {
  ThanksService.getNbrThanksOfUser(user_id)
  .then( (res : AxiosResponse) => {
    dispatch({
      type: GET_NBR_THANKS_SUCCESS,
      payload: res.data
    })
  })
  .catch( (err : AxiosError) => {
    dispatch({
      type: GET_NBR_THANKS_FAILURE,
      payload: err.response && err.response.data && err.response.data.message ? err.response.data.message : undefined
    })
  })
}

export const sendThank = (data : any) => (dispatch: Dispatch) => {
  ThanksService.create(data)
  .then( (res : AxiosResponse) => {
    dispatch({
      type: SEND_THANK_SUCESS,
      payload: res.data
    })
  })
  .catch( (err : AxiosError) => {
    dispatch({
      type: SEND_THANK_FAILURE,
      payload: err.response && err.response.data && err.response.data.message ? err.response.data.message : undefined
    })
  })
}