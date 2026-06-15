import {
    FormControl, Input,
    InputAdornment,
    InputLabel
} from "@material-ui/core";
import Button from "@material-ui/core/Button";
import IconButton from "@material-ui/core/IconButton";
import { Visibility, VisibilityOff } from "@material-ui/icons";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useDispatch, useSelector } from "react-redux";
import { Link, useParams } from "react-router-dom";
import { changePasswordRequestStatusSelector, userErrorSelector } from "../../store/selectors";
import { changePassword } from "./../../store/actions/user.actions";
import styles from "./ChangePassword.module.css";

interface ParamType {
    token: string
}

export function ChangePassword() {
    const { token } = useParams<ParamType>();
    const dispatch = useDispatch();
    const [showPassword, setShowPassword] = useState(false);
    const [password, setPassword] = useState("");

    const [showPasswordConfirm, setShowPasswordConfirm] = useState(false);
    const [passwordConfirm, setPasswordConfirm] = useState("");

    const changePasswordRequestStatus = useSelector(changePasswordRequestStatusSelector);
    const error = useSelector(userErrorSelector);

    function handleClickShowPassword() {
        setShowPassword(!showPassword);
    }

    function handleClickShowPasswordConfirm() {
        setShowPasswordConfirm(!showPasswordConfirm);
    }

    const { t } = useTranslation();

    const handleChangePassword = (event: any) => {
        event.preventDefault();
        dispatch(changePassword(token, password, passwordConfirm));
    };

    return (
        <div>
            <div className={styles.change_password__card}>
                <form onSubmit={handleChangePassword} className={styles.change_password__form}>
                    <h1>{t("CHANGE_PASSWORD")}</h1>
                    
                    <FormControl>
                        <InputLabel className="label" htmlFor="password">
                            {t("PASSWORD")}
                        </InputLabel>
                        <Input
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
                    </FormControl>
                    
                    <FormControl >
                        <InputLabel htmlFor="passwordConfirm">
                            {t("PASSWORD")} (Confirmation)
                        </InputLabel>
                        <Input
                            id="passwordConfirm"
                            type={showPasswordConfirm ? "text" : "password"}
                            value={passwordConfirm}
                            onChange={(e) => {
                                setPasswordConfirm(e.target.value);
                            }}
                            endAdornment={
                                <InputAdornment position="end">
                                    <IconButton
                                        aria-label="toggle password visibility"
                                        onClick={handleClickShowPasswordConfirm}
                                    >
                                        {showPasswordConfirm ? <Visibility /> : <VisibilityOff />}
                                    </IconButton>
                                </InputAdornment>
                            }
                        />
                    </FormControl>

                    <p>
                        { changePasswordRequestStatus ?
                            <p className={styles.changePasswordRequestSuccess}>{t("CHANGE_PASSWORD_SUCCESS")}</p>
                        :
                            (changePasswordRequestStatus === false) &&
                                <p className={styles.changePasswordRequestFailed}>{t("CHANGE_PASSWORD_ERROR")}{error ? ": " + error : ""}</p>
                        }
                    </p>

                    <Button type="submit" className={styles.buttonChangePassword}>
                        {t("CHANGE_MY_PASSWORD")}
                    </Button>

                    <Link to="/login" className={styles.linkToRegisterLogin}>
                        <Button className={styles.buttonToRegisterLogin}>{t("LOGIN")}</Button>
                    </Link>
                    <Link to="/register" className={styles.linkToRegisterLogin}>
                        <Button className={styles.buttonToRegisterLogin}>{t("CREATE_ACCOUNT")}</Button>
                    </Link>
                </form>
            </div>
        </div>
    );
}
