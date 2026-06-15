import { CircularProgress } from "@material-ui/core";
import React, { Suspense } from "react";
import ReactDOM from "react-dom";
import { Provider } from "react-redux";
import App from "./App";
import http from './http-common';
import "./i18n";
import "./index.css";
import reportWebVitals from "./reportWebVitals";
import configureStore from "./store";
import { LOGIN_USER_SUCCESS } from "./store/actions";

const store = configureStore()
ReactDOM.render(<div id="loading"><CircularProgress color="secondary" /></div>, document.getElementById('root'))
http.get('/api/auth/verify').then( async (resp) => {
  // Wrap in a promise to wait because executing finally
  const promise = new Promise((resolve, reject) => {
    if(resp.data !== "Unauthenticated"){
      (store.dispatch({
        type: LOGIN_USER_SUCCESS,
        payload: {
          token: resp.data
        }
      }) as any).then( () => {
        resolve(true)      
      })
    }else{
      resolve(false)
    }
  })
  await promise
}).catch( (e) => {} ) 
.finally( () => {
  ReactDOM.render(
    <React.StrictMode>
      <Suspense fallback={<div id="loading"><CircularProgress color="secondary" /></div>}>
        <Provider store={store}>
          <App />
        </Provider>
      </Suspense>
    </React.StrictMode>,
    document.getElementById("root")
  );
})



// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
if(process.env.NODE_ENV === 'development') reportWebVitals(console.log);
