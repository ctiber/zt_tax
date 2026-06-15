import http from "../http-common";
import { IBusinessProfile } from "../store/types/business-profile.types";

const getAll = () => {
  return http.get("/api/business-profiles");
};

const create = (data: IBusinessProfile) => {
  return http.post("/api/business-profile", data);
};

const get = (profileId: number) => {
  return http.get(`/api/business-profile/${profileId}`);
};

const update = (profileId: number, data: IBusinessProfile) => {
  return http.put(`/api/business-profile/${profileId}`, data);
};

const remove = (profileId: number) => {
  return http.delete(`/api/business-profile/${profileId}`);
};

const BusinessProfileService = {
  getAll,
  get,
  create,
  update,
  remove,
};

export default BusinessProfileService;
