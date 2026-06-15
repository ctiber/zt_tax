import axios from "axios";

let instance = axios.create({
  baseURL: process.env.REACT_APP_PLAGE_ENV,
  headers: {
    "Cache-Control": 'no-cache',
    "Content-type": "application/json"
  },
  withCredentials: true,
});

instance.interceptors.request.use((config) => {
  config.headers["Content-Language"] = window.localStorage.getItem("i18nextLng")
  return config
})

export default instance


let instanceWithCache = axios.create({
  baseURL: process.env.REACT_APP_PLAGE_ENV,
  headers: {
    "Cache-Control": 'private, max-age=600000',
    "Content-type": "application/json"
  },
  withCredentials: true,
});

instanceWithCache.interceptors.request.use((config) => {
  config.headers["Content-Language"] = window.localStorage.getItem("i18nextLng")
  return config
})

export { instanceWithCache };

