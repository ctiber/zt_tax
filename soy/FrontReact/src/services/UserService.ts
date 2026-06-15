import http, { instanceWithCache } from "../http-common";
import i18n from "../i18n";
import { ILogin, IUser } from "./../store/types/user.types";

const getAll = () => {
  return http.get("/api/users");
};

const create = (data: IUser) => {
  return http.post("/api/user", {...data, password2: data.password});
};

const get = (userId: number) => {
  return http.get(`/api/user/${userId}`);
};

const update = (userId: number, data: IUser) => {
  return http.put(`/api/user/${userId}`, data);
};

const remove = (userId: number) => {
  return http.delete(`/api/user/${userId}`);
};

const updateProfile = (userId: number, data: IUser) => {
  return http.put(`/api/user/${userId}/profile`, data);
};

const login = (data: ILogin) => {
  return http.post("/api/user/login", data);
};

const logout = () => {
  return http.delete("/api/user/logout");
};

const requestPasswordReset = (email: string) => {
  return http.post("/api/user/password", {email: email})
}

const activateAccount = (activation_token: string) => {
  return http.post("/api/user/activate/" + activation_token)
}

const changePassword = (token: string, password: string, passwordConfirm: string) => {
  return http.put("/api/user/password/" + token, {pwd: password, pwd2: passwordConfirm})
}

const changeRole = (user_id: number, data: IUser) => {
  data.password = undefined
  return update(user_id, data)
}

const getUserSkills = (user_id: number) => {
  return instanceWithCache.get("/api/user/" + user_id + "/skills?locale=" + i18n.language)
}

const BusinessProfileService = {
  getAll,
  get,
  create,
  update,
  remove,
  updateProfile,
  login,
  logout,
  requestPasswordReset,
  activateAccount,
  changePassword,
  changeRole,
  getUserSkills
};

export default BusinessProfileService;
