import http from "../http-common";

const getAll = () => {
  return http.get("/API/feedbacks");
};

const getAllWithStats = () => {
  return http.get("/API/feedbacks/stats")
}

const getOneStats = (exerciseId: number) => {
  return http.get(`/API/feedback/exercise/${exerciseId}/stats`)
}

const create = (data : any) => {
  return http.post("/API/feedback", data)
}

const update = (userId: number, exerciseId: number, data : any) => {
  return http.put(`API/feedback/user/${userId}/exercise/${exerciseId}`, data)
}

const getOne = (userId: number, exerciseId : number) => {
  return http.get(`/API/feedback/user/${userId}/exercise/${exerciseId}`)
}

const getAllOfExercise = (exerciseId: number) => {
  return http.get('/API/feedbacks/exercise/'+exerciseId)
}

const getAllOfUser = (userId: number) => {
  return http.get('/API/feedbacks/user/'+userId)
}

const FeedbackService = {
  getAll,
  getAllWithStats,
  getOneStats,
  getAllOfExercise,
  getAllOfUser,
  create,
  getOne,
  update
};

export default FeedbackService;
