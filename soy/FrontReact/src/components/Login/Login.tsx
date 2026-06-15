import {
  Container,
  FormControl, FormHelperText,
  Input,
  InputAdornment,
  InputLabel,
  TextField
} from "@material-ui/core";
import Button from "@material-ui/core/Button";
import IconButton from "@material-ui/core/IconButton";
import { Visibility, VisibilityOff } from "@material-ui/icons";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useDispatch } from "react-redux";
import { Link } from "react-router-dom";
import { ILogin } from "../../store/types";
import { loginUserAction } from "./../../store/actions/user.actions";
import styles from "./Login.module.css";

export function Login() {
  const dispatch = useDispatch();
  const [showPassword, setShowPassword] = useState(false);
  const [password, setPassword] = useState("");
  const [email, setEmail] = useState("");

  const { t } = useTranslation();


  function handleClickShowPassword() {
    setShowPassword(!showPassword);
  }

  useEffect(()  => {
    document.body.classList.add('bg_img');

    return () => {
        document.body.classList.remove('bg_img');
    };
  });

  const handleLogin = (event : any) => {
    event.preventDefault();
    const data: ILogin = {
      email: email,
      password: password,
    };
    dispatch(loginUserAction(data));
  };

  return (
    <Container className={styles.center}>
        <form onSubmit={handleLogin} className={styles.login__form}>
          <h1>{t("CONNECT")}</h1>
          <TextField
            className="input"
            id="email"
            label={t("EMAIL")}
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
            }}
          />
          <FormControl className="">
            <InputLabel className={styles.label} htmlFor="password">
              {t("PASSWORD")}
            </InputLabel>
            <Input
              className="input"
              id="password"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
              }}
              endAdornment={
                <InputAdornment position="end">
                  <IconButton
                    aria-label="toggle password visibility"
                    onClick={handleClickShowPassword}
                  >
                    {showPassword ? <Visibility /> : <VisibilityOff />}
                  </IconButton>
                </InputAdornment>
              }
            />

            <FormHelperText>
              <Link to="/resetpassword">
                {t("FORGOT_PASSWORD_?")}
              </Link>
            </FormHelperText>
          </FormControl>
          <Button id="login" type="submit" className={styles.button_login}>
            {t("LOGIN")}
          </Button>
          <Link to="/register" className={styles.link_to_register}>
            <Button className={styles.button_to_register}>{t("CREATE_ACCOUNT")}</Button>
          </Link>
        </form>
    </Container>
  );
}
