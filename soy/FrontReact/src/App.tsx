import { Router } from "react-router-dom";
import "./App.css";
import Menu from "./components/Main/Menu";
import { RouterLink } from './router/router'
import { history } from './helpers/history'
import { Footer } from "./components/Main/Footer";
import { createTheme, ThemeProvider } from "@material-ui/core";
import { ErrorManager } from "./components/Main/ErrorManager";

function App() {

  const darkTheme = createTheme({
    palette: {
      primary:{
        main: '#05E205'
      },
      type: 'dark',
    },
  });



  return (
    <ThemeProvider theme={darkTheme}>
      <div className='App'>
        <Router history={history}>
          <ErrorManager />

          <Menu />
          <main >
            <RouterLink />
          </main>
          <Footer />
        </Router>
      </div>
    </ThemeProvider>
    
  );
}

export default App;

