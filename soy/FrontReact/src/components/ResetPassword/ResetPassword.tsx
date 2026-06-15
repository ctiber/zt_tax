import {
    TextField
} from "@material-ui/core";
import Button from "@material-ui/core/Button";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useDispatch, useSelector } from "react-redux";
import { Link } from "react-router-dom";
import { passwordResetRequestStatusSelector } from "../../store/selectors";
import { requestPasswordReset } from "./../../store/actions/user.actions";
import styles from "./ResetPassword.module.css";

export function ResetPassword() {
    const dispatch = useDispatch();
    const [email, setEmail] = useState("");

    const passwordResetRequestSent = useSelector(passwordResetRequestStatusSelector);

    const { t } = useTranslation();

    const handlePasswordReset = (event : any) => {
        event.preventDefault();
        dispatch(requestPasswordReset(email));
    };

    useEffect(()  => {
        document.body.classList.add('bg_img');
    
        return () => {
            document.body.classList.remove('bg_img');
        };
      });

    return (
        <div>
            <div className={styles.reset_password__card}>
                <form onSubmit={handlePasswordReset} className={styles.reset_password__form}>
                    <h1>{t("PASSWORD_RESET")}</h1>
                    <p>
                        {t("PASSWORD_RESET_EXPLANATION")}
                    </p>
                    <TextField
                        label={t("EMAIL")}
                        value={email}
                        onChange={(e) => {
                            setEmail(e.target.value);
                        }}
                    />
                    <Button data-cy="resetpassword-button" type="submit" className={styles.buttonReset_password}>
                        {t("RESET_MY_PASSWORD")}
                    </Button>

                    { passwordResetRequestSent ?
                        <p data-cy="reset-information" className={styles.passwordResetRequestSuccess}>{t("PASSWORD_RESET_SUCESS")}</p>
                    :
                        (passwordResetRequestSent === false) &&
                            <p data-cy="reset-error" className={styles.passwordResetRequestFailed}>{t("PASSWORD_RESET_FAILED")}</p>
                    }

                    <Link to="/login" className={styles.linkToLogin}>
                        <Button className={styles.buttonToRegisterLogin}>{t("LOGIN")}</Button>
                    </Link>
                    <Link to="/register" className={styles.linkToRegister}>
                        <Button className={styles.buttonToRegisterLogin}>{t("CREATE_ACCOUNT")}</Button>
                    </Link>
                </form>
            </div>
        </div>
    );
}
