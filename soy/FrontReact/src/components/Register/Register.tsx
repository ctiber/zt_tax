import {
  Checkbox, FormControl, FormControlLabel, FormHelperText, Input,
  InputAdornment,
  InputLabel,
  MenuItem,
  Select,
  TextField
} from "@material-ui/core";
import Button from "@material-ui/core/Button";
import IconButton from "@material-ui/core/IconButton";
import { Visibility, VisibilityOff } from "@material-ui/icons";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useDispatch } from "react-redux";
import { Link } from "react-router-dom";
import { getAvailableLangs } from "../../i18n";
import { Toast } from "../Main/Toast";
import { registerUserAction } from "./../../store/actions/user.actions";
import { IUser } from "./../../store/types/user.types";
import styles from "./Register.module.css";

export function Register() {
  const dispatch = useDispatch();

  const [lastName, setLastName] = useState("");
  const [firstName, setFirstName] = useState("");
  const [studentNumber, setStudentNumber] = useState("");
  const [email, setEmail] = useState("");
  const [password1, setPassword1] = useState("");
  const [password2, setPassword2] = useState("");
  const [organization, setOrganization] = useState("");
  const [country, setCountry] = useState("");
  const [locale, setLocale] = useState("en");
  const [tdGroup, ] = useState("");

  const [showPassword1, setShowPassword1] = useState(false);
  const [showPassword2, setShowPassword2] = useState(false);

  const [errorMessage, setErrorMessage] = useState("");
  const [hasAgreedTermsAndConditions, setHasAgreedTermsAndConditions] = useState(false);

  function handleClickShowPassword1() {
    setShowPassword1(!showPassword1);
  }

  function handleClickShowPassword2() {
    setShowPassword2(!showPassword2);
  }

  const { t } = useTranslation();

  const handleRegister = () => {
    if(!hasAgreedTermsAndConditions){
      setErrorMessage(t("NEED_TO_AGREE") + " " + t("TERMS_AND_CONDITIONS"))
      return
    }
    if (password1 === password2) {
      setErrorMessage("");
      const user: IUser = {
        user_id: undefined,
        lastname: lastName,
        firstname: firstName,
        tdgroup: tdGroup,
        email: email,
        enabled: false,
        role_id: 3,
        avatar: "",
        password: password1,
        organization: organization,
        country: country,
        locale: locale,
        student_number: studentNumber,
      };
      dispatch(registerUserAction(user));
    } else {
      setErrorMessage(t("PASSWORD_NOT_SAME"));
    }
  };

  useEffect(()  => {
    document.body.classList.add('bg_img');

    return () => {
        document.body.classList.remove('bg_img');
    };
  });

  const [langs, setLangs] = useState<any[]>([])

  useEffect( () => {

    const fetchLangs = async () => {
      setLangs(await getAvailableLangs())
    }
    if(langs.length === 0) fetchLangs()

  }, [langs])

  return (
    <div>
      <Toast message={errorMessage ? errorMessage : ""} severity="error" clearState={ () => setErrorMessage("")} />
      <div className={styles.register__card}>
        <form className={styles.register__form}>
          <h1>{t("CREATE_ACCOUNT")}</h1>
          <TextField
            required
            className={styles.input}
            label={t("FIRSTNAME")}
            placeholder="Chuck"
            value={firstName}
            onChange={(e) => {
              setFirstName(e.target.value);
            }}
          />
          <TextField
            required
            className={styles.input}
            label={t("LASTNAME")}
            value={lastName}
            placeholder="Norris"
            onChange={(e) => {
              setLastName(e.target.value);
            }}
          />
          <FormControl>
            <FormHelperText>
              <span className={styles.bold}>{t("STUDENTS")}</span>, {t("INDICATE_STUDENT_NUMBER")}
            </FormHelperText>
            <TextField
              className={styles.input}
              label={t("STUDENT_NUMBER")}
              value={studentNumber}
              placeholder="Ex : 123456789"
              onChange={(e) => {
                setStudentNumber(e.target.value);
              }}
            />
            <FormHelperText>
              <span className={styles.bold}>{t("INSTRUCTORS")}</span>, {t("REGISTER_FORM_INSTRUCTOR_HELPTEXT")}
            </FormHelperText>
          </FormControl>
          
          <TextField
            required
            className={styles.input}
            label={t("EMAIL")}
            placeholder="student@my.university.org"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
            }}
          />
          <FormControl>
            <InputLabel required className={styles.label} htmlFor="password1">
              {t("PASSWORD")}
            </InputLabel>
            <Input
              required
              className={styles.input}
              id="password1"
              type={showPassword1 ? "text" : "password"}
              value={password1}
              onChange={(e) => {
                setPassword1(e.target.value);
              }}
              endAdornment={
                <InputAdornment position="end">
                  <IconButton
                    aria-label="toggle password visibility"
                    onClick={handleClickShowPassword1}
                  >
                    {showPassword1 ? <Visibility /> : <VisibilityOff />}
                  </IconButton>
                </InputAdornment>
              }
            />
            <FormHelperText>
              {t("REGISTER_PASSWORD_HELPERTEXT")}
            </FormHelperText>
          </FormControl>
          <FormControl className="">
            <InputLabel
              required
              className={errorMessage === "" ? styles.label : styles.labelError}
              htmlFor="password2"
            >
              {t("PASSWORD_VALIDATION")}
            </InputLabel>
            <Input
              required
              className={styles.input}
              id="password2"
              type={showPassword2 ? "text" : "password"}
              value={password2}
              onChange={(e) => {
                setPassword2(e.target.value);
              }}
              endAdornment={
                <InputAdornment position="end">
                  <IconButton
                    aria-label="toggle password visibility"
                    onClick={handleClickShowPassword2}
                  >
                    {showPassword2 ? <Visibility /> : <VisibilityOff />}
                  </IconButton>
                </InputAdornment>
              }
            />
          </FormControl>
          <TextField
            className={styles.input}
            label={t("ORGANIZATION")}
            value={organization}
            placeholder="... University"
            onChange={(e) => {
              setOrganization(e.target.value);
            }}
          />
          <TextField
            className={styles.input}
            label={t("COUNTRY")}
            value={country}
            onChange={(e) => {
              setCountry(e.target.value);
            }}
          />
          <FormControl style={{width:"100%"}} required>
            <InputLabel>{t("LOCALE")}</InputLabel>
            <Select
              value={locale}
              label={t("LOCALE")}
              onChange={(e) => setLocale(e.target.value as string)}
            >
              {
                langs.length > 0 ?
                  langs.map( (item) => (
                    <MenuItem value={item.code}>{item.name}</MenuItem>
                  ))
                :
                  <MenuItem>Fetching data please wait...</MenuItem>
              }
            </Select>
          </FormControl>
          <p>
            {t("REGISTER_FORM_TERMS_AND_CONDITIONS")}
          </p>
          <FormControlLabel control={<Checkbox onClick={() => setHasAgreedTermsAndConditions(!hasAgreedTermsAndConditions)} value={hasAgreedTermsAndConditions} required></Checkbox>} label={t("I_AGREE_WITH_THE") + " " + t("TERMS_AND_CONDITIONS")} />
            
          <Button data-cy="submit-register" onClick={handleRegister} className={styles.buttonRegister}>
            {t("REGISTER")}
          </Button>
          <Link to="/login" className={styles.linkToLogin}>
            <Button className={styles.buttonToLogin}>{t("ALREADY_REGISTERED")}</Button>
          </Link>
        </form>
      </div>
    </div>
  );
}
