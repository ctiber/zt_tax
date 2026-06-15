import http from '../http-common'

const answerExercise = (production_data : any, ex_id: number, ps_id: number) => {
  return http.post('/api/exercise-production', 
  {
    production_data: production_data, 
    ex_id: ex_id, 
    ps_id: ps_id
  }, {
    headers:{
      'Content-Type': 'application/octet-stream'
    }
  })
}

const ExerciseProductionService = {
  answerExercise
};

export default ExerciseProductionService;
