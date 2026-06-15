import http from "../http-common";
import { ISkill } from "../store/types/skill.types";

const getAll = (locale: string) => {
  return http.get(`/api/skills?locale=${locale}`);
};

const create = (data: ISkill) => {
  return http.post("/api/skill", data);
};

const get = (skillCode: string) => {
  return http.get(`/api/skill/${skillCode}`);
};

const update = (skillCode: string, data: ISkill) => {
  return http.put(`/api/skill/${skillCode}`, data);
};

const remove = (skillCode: string) => {
  return http.delete(`/api/skill/${skillCode}`);
};

const SkillService = {
  getAll,
  get,
  create,
  update,
  remove,
};

export default SkillService;
