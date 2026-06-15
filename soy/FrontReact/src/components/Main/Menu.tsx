import { Link } from "react-router-dom";
import styles from './Menu.module.css';

import AccountCircleIcon from "@material-ui/icons/AccountCircle";
import { useTranslation } from "react-i18next";
import { useDispatch, useSelector } from "react-redux";
import logo from "../../assets/images/logo-hacker-nobg-small.png";
import { logoutUserAction } from "../../store/actions/user.actions";
import { connectedUserSelector } from "../../store/selectors";

const Menu = () => {

  const dispatch = useDispatch();

  const { t } = useTranslation();

  /**
   * Call the logout action.
   */
  const handleLogout = () => {
    dispatch(logoutUserAction());
  };

  /**
   * Get connectedUser from Selector
   */
  const connectedUser = useSelector(connectedUserSelector);

  /**
   * Return true if a user is connected, otherwise false
   * @returns boolean
   */
  function isConnected() {
    if (connectedUser) return true;
    else return false;
  }

  /**
   * Return true if the connected user is an Admin, otherwise false
   * @returns boolean
   */
  function isAdmin() {
    if (connectedUser && connectedUser.role_id === 1) {
      return true;
    } else {
      return false;
    }
  }

  /**
   * Return true if the connected user is an Teacher, otherwise false
   * @returns boolean
   */
  function isTeacher() {
    if (connectedUser && connectedUser.role_id === 2) {
      return true;
    } else {
      return false;
    }
  }

  return (
    <nav className={styles.menu}>
      {process.env.REACT_APP_LANDING_PAGE ?
        <a className={styles.logo__link} href={process.env.REACT_APP_LANDING_PAGE}>
          <img src={logo} alt="logo" />
        </a>
        :
        <Link className={styles.logo__link} to={"/"}>
          <img src={logo} alt="logo" />
        </Link>
      }
      <div className={styles.nav__links}>
        { isConnected() && (
          <Link data-cy="menu-home" to={ "/sessions"} className={`${styles.button} ${styles.effectPulse}`}>
            {t("HOME")}
          </Link>
        )}

        { (isConnected() && (isTeacher() || isAdmin())) && (
          <Link data-cy="menu-profiles" to={"/profiles"} className={`${styles.button} ${styles.effectPulse}`}>
            {t("PROFILES")}
          </Link>
        )}

        { (isConnected() && (isTeacher() || isAdmin())) && (
          <Link data-cy="menu-exercises" to={"/exercises"} className={`${styles.button} ${styles.effectPulse}`}>
            {t("EXERCISES")}
          </Link>
        )}

        { (isConnected() && (isTeacher() || isAdmin())) && (
          <Link data-cy="menu-sequences" to={"/sequences"} className={`${styles.button} ${styles.effectPulse}`}>
            {t("SEQUENCES")}
          </Link>
        )}

        { isConnected() && (
          <Link data-cy="menu-sessions" to={"/sessions/available"} className={`${styles.button} ${styles.effectPulse}`}>
            Sessions
          </Link>
        )}

        { (isConnected() && (isTeacher() || isAdmin())) && (
          <Link data-cy="menu-skills" to={"/skills"} className={`${styles.button} ${styles.effectPulse}`}>
            {t("SKILLS")}
          </Link>
        )}

        { (isConnected() && isAdmin()) && (
          <Link data-cy="menu-users" to={"/users"} className={`${styles.button} ${styles.effectPulse}`}>
            {t("USERS")}
          </Link>
        )}
      </div>

      <div className={styles.right}>
        {isConnected() && 
          <Link data-cy="menu-help" to={"/help"} className={`${styles.button} ${styles.effectPulse}`}>
            {t("HELP")}
          </Link>
        }
          
        <button data-cy="menu-dropdown" className={styles.dropdown}>
          <AccountCircleIcon />
        </button>
        <div data-cy="menu-dropdown-content" className={styles.dropdownContent}>
          {isConnected() ? <div>{t("MY_ID")} : {connectedUser?.user_id}</div> : ""}
          {/* {isConnected() && <Link to="/user/profile">{t("MY_PROFILE")}</Link>} */}
          
          {isConnected() ? "" : <Link to="/register">{t("REGISTER")}</Link>}
          {isConnected() ? (
            <Link onClick={handleLogout} to="#">
              {t("LOGOUT")}
            </Link>
          ) : (
            <Link to="/login">{t("LOGIN")}</Link>
          )}
        </div>
      </div>
      {/*<div className={styles.betacontainer}>
        <div className={styles.beta}>BETA</div>
          </div>*/}
    </nav>
    
  );
}

export default Menu