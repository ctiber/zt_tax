import Button from "@material-ui/core/Button";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useDispatch, useSelector } from "react-redux";
import { Link, useParams } from "react-router-dom";
import { activateAccountRequestStatusSelector } from "../../store/selectors";
import { activateAccount } from "./../../store/actions/user.actions";
import styles from "./ActivateAccount.module.css";

interface ParamType {
    activation_token: string
}

export function ActivateAccount() {
    const { activation_token } = useParams<ParamType>();
    const dispatch = useDispatch();

    const activateAccountRequestStatus = useSelector(activateAccountRequestStatusSelector);

    const { t } = useTranslation();

    dispatch(activateAccount(activation_token));

    useEffect(()  => {
        document.body.classList.add('bg_img');
    
        return () => {
            document.body.classList.remove('bg_img');
        };
      });

    return (
        <div>
            <div className={styles.activate_account__card}>
                <div className={styles.activate_account__form}>
                    <h1>{t("ACTIVATE_ACCOUNT")}</h1>
                    <div data-cy="activation-information">
                        { activateAccountRequestStatus !== undefined ?
                            (activateAccountRequestStatus === false) ?
                                <p className={styles.activate_accountRequestFailed}>{t("ACTIVATE_ACCOUNT_ERROR")}</p>
                            :
                                <p className={styles.activate_accountRequestSuccess}>{t("ACTIVATE_ACCOUNT_SUCCESS")}</p>
                                
                        :
                            t("PLEASE_WAIT_A_MOMENT")
                        }
                    </div>

                    <Link to="/login" className={styles.linkToRegisterLogin}>
                        <Button className={styles.buttonToRegisterLogin}>{t("LOGIN")}</Button>
                    </Link>
                    <Link to="/register" className={styles.linkToRegisterLogin}>
                        <Button className={styles.buttonToRegisterLogin}>{t("CREATE_ACCOUNT")}</Button>
                    </Link>
                </div>
            </div>
        </div>
    );
}