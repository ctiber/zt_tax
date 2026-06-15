import http from "../http-common";

const getAll = () => {
  return http.get("/API/thanks");
};

const getNbrThanksOfUser = (userId: number) => {
  return http.get(`/API/user/${userId}/thanks`)
}

const create = (data : any) => {
  return http.post("/API/thanks", data)
}

const ThanksService = {
  getAll,
  getNbrThanksOfUser,
  create,
};

export default ThanksService;
