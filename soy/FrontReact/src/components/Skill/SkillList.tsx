import React, { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { ISkill } from "../../store/types/skill.types";
import { SkillItem } from "./SkillItem";

import {
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  TablePagination,
  TextField,
  Typography
} from "@material-ui/core";
import Button from "@material-ui/core/Button";
import IconButton from "@material-ui/core/IconButton";
import AddCircleIcon from "@material-ui/icons/AddCircle";

import Paper from "@material-ui/core/Paper";
import Table from "@material-ui/core/Table";
import TableBody from "@material-ui/core/TableBody";
import TableContainer from "@material-ui/core/TableContainer";
import styles from './SkillList.module.css'

import {
  addSkillAction, getAllSkillsAction,
  updateSkillAction
} from "./../../store/actions/skill.actions";

import { useTranslation } from "react-i18next";
import { skillSelector } from "./../../store/selectors/skillSelector";

import i18n, { getAvailableLangs } from "../../i18n";
import { connectedUserSelector } from "../../store/selectors";

import withReducer from "../../store/withReducer";
import { SkillReducer } from "../../store/reducers/skillReducer";
import { EnhancedTableHead, getComparator, HeadCell, Order, stableSort } from "../common/EnhancedTableHead";


export const getLanguage = () => {
  return i18n.language;
};

export function DisplaySkills({
  skills,
  setCurrentSkill,
  setOpen,
  setEditMode,
  t,
}: {
  skills: ISkill[];
  setCurrentSkill: any;
  setOpen: any;
  setEditMode: any;
  t: any;
}) {
  const connectedUser = useSelector(connectedUserSelector);

  function isAdmin() {
    if (connectedUser && connectedUser.role_id === 1) {
      return true;
    } else {
      return false;
    }
  }


  const [order, setOrder] = useState<Order>('asc');
  const [orderBy, setOrderBy] = useState('name');


  const handleRequestSort = (event : any, property : any) => {
    const isAsc = orderBy === property && order === 'asc';
    setOrder(isAsc ? 'desc' : 'asc');
    setOrderBy(property);
  };

  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);

  const handleChangePage = (event: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };


  const heads : readonly HeadCell[] = [
    {
      id: "name",
      label: t("NAME"),
      sortable: true,
      disablePadding: false,
      numeric: false
    },
    {
      id: "theme",
      label: t("THEME"),
      sortable: true,
      disablePadding:false,
      numeric: false
    },
    {
      id: "skill_code",
      label: t("SKILL_CODE"),
      sortable: true,
      disablePadding:false,
      numeric: false
    },
    {
      id: "locale",
      label: t("LOCALE"),
      sortable: true,
      disablePadding: false,
      numeric: false
    }
  ]

  const adminHeads : readonly HeadCell[] = [
    ...heads,
    {
      id: "update",
      label: t("UPDATE"),
      sortable: false,
      disablePadding:false,
      numeric: false
    },
    {
      id: "delete",
      label: t("DELETE"),
      sortable: false,
      disablePadding: false,
      numeric: false
    }
  ]


  if (setCurrentSkill === null && setOpen === null && setEditMode === null) {
    return (
      <Table aria-label="simple table">
        <TableContainer>
          <EnhancedTableHead 
            onRequestSort={handleRequestSort}
            order={order}
            orderBy={orderBy}
            headCells={heads}
            shiftRight={false}
          />
          <TableBody>
            {stableSort<ISkill>(skills, getComparator(order, orderBy)).slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage).map((skill) => (
              <SkillItem
                skill={skill}
                key={skill.skill_code}
                setCurrentSkill={setCurrentSkill}
                setOpen={setOpen}
                setEditMode={setEditMode}
              />
            ))}
          </TableBody>
        </TableContainer>
        <TablePagination 
          rowsPerPageOptions={[10,25,100]}
          component="div"
          count={skills.length}
          rowsPerPage={rowsPerPage}
          page={page}
          onPageChange={handleChangePage}
          onRowsPerPageChange={handleChangeRowsPerPage}
          labelRowsPerPage={t("ROWS_PER_PAGE")}
          labelDisplayedRows={({from, to, count}) => `${from}-${to} ${t("OF")} ${count!== -1 ? count : `${t("MORE_THAN")} ${to}`}`}
        />
      </Table>
    );
  } else {
    return (
      <Table aria-label="simple table">
        <TableContainer>
          <EnhancedTableHead 
            onRequestSort={handleRequestSort}
            order={order}
            orderBy={orderBy}
            headCells={isAdmin() ? adminHeads : heads }
            shiftRight={false}
          />
          <TableBody>
            {stableSort<ISkill>(skills, getComparator(order, orderBy)).slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage).map((skill) => (
              <SkillItem
                skill={skill}
                key={skill.skill_code}
                setCurrentSkill={setCurrentSkill}
                setOpen={setOpen}
                setEditMode={setEditMode}
              />
            ))}
          </TableBody>
        </TableContainer>
        <TablePagination 
          rowsPerPageOptions={[10,25,100]}
          component="div"
          count={skills.length}
          rowsPerPage={rowsPerPage}
          page={page}
          onPageChange={handleChangePage}
          onRowsPerPageChange={handleChangeRowsPerPage}
          labelRowsPerPage={t("ROWS_PER_PAGE")}
          labelDisplayedRows={({from, to, count}) => `${from}-${to} ${t("OF")} ${count!== -1 ? count : `${t("MORE_THAN")} ${to}`}`}
        />
      </Table>
    );
  }
}

function SkillList() {
  const dispatch = useDispatch();
  const initSkill: ISkill = {
    skill_code: "",
    name: "",
    th_id: 0,
    description: "",
    ref_code: "",
    locale: "",
  };

  // Get skills from Selector
  const skills = useSelector(skillSelector);

  const { t } = useTranslation();


  /* ---- STATE ---- */
  const [open, setOpen] = useState(false);
  const [currentSkill, setCurrentSkill] = useState(initSkill);
  const [editMode, setEditMode] = useState(false);

  /* ---- Functions ---- */
  // Function open create form
  const handleClickOpen = () => {
    setCurrentSkill(initSkill);
    setEditMode(false);
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
  };

  const connectedUser = useSelector(connectedUserSelector);

  function isAdmin() {
    if (connectedUser && connectedUser.role_id === 1) {
      return true;
    } else {
      return false;
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault(); //Empêche le refresh de la page

    if (editMode) {
      const newSkill: ISkill = {
        skill_code: currentSkill.skill_code,
        name: currentSkill.name,
        th_id: currentSkill.th_id,
        theme: currentSkill.theme,
        description: currentSkill.description,
        ref_code: currentSkill.ref_code,
        locale: currentSkill.locale,
      };
      dispatch(updateSkillAction(newSkill));
    } else {
      const newSkill: ISkill = {
        skill_code: currentSkill.skill_code,
        name: currentSkill.name,
        th_id: currentSkill.th_id,
        theme: currentSkill.theme,
        description: currentSkill.description,
        ref_code: currentSkill.ref_code,
        locale: currentSkill.locale,
      };
      dispatch(addSkillAction(newSkill));
    }
    handleClose();
  };

  const handleFormChange = (value: any, property: string) => {
    let skill: ISkill = {
      skill_code: currentSkill.skill_code,
      name: currentSkill.name,
      th_id: currentSkill.th_id,
      theme: currentSkill.theme,
      description: currentSkill.description,
      ref_code: currentSkill.ref_code,
      locale: currentSkill.locale,
    };
    switch (property) {
      case "SKILL_CODE":
        skill.skill_code = value;
        setCurrentSkill(skill);
        break;
      case "NAME":
        skill.name = value;
        setCurrentSkill(skill);
        break;
      case "THEME":
        skill.th_id = value;
        setCurrentSkill(skill);
        break;
      case "REF":
        skill.ref_code = value;
        setCurrentSkill(skill);
        break;
      case "DESCRIPTION":
        skill.description = value;
        setCurrentSkill(skill);
        break;
      case "LOCALE":
        skill.locale = value;
        setCurrentSkill(skill);
        break;
      default:
        break;
    }
  };

  useEffect(() => {
    dispatch(getAllSkillsAction(getLanguage()));
  }, [dispatch]);

  const [langs, setLangs] = useState<any[]>([])

  useEffect( () => {

    const fetchLangs = async () => {
      setLangs(await getAvailableLangs())
    }
    if(langs.length === 0) fetchLangs()

  }, [langs])


  const [columnFilter, setColumnFilter] = useState("");
  const [filter, setFilter] = useState("");
  const [filteredSkills, setFilteredSkills] = useState<ISkill[]>([])

  useEffect( () => {
    setFilteredSkills(skills)
  }, [skills])

  useEffect( () => {
    setFilteredSkills(skills.filter( ( skill ) => {
      if(columnFilter === 'theme'){
        let name : string
        if(skill["theme"] && skill["theme"]["name"]){
          name = skill["theme"]["name"] 
          return name.toLowerCase().includes(filter.toLowerCase())
        }
        return false
      }else{
        return (skill[columnFilter as keyof ISkill]+"").toLowerCase().includes(filter.toLowerCase())
      }
    }))
  }, [columnFilter, filter, skills])


  /* ---- Render ---- */

  return (
      <Container>
        <Typography variant="h3" component="h1" color="primary" className="title">
        {t("SKILLS")}
        </Typography>
        
        {
          isAdmin() && 
          <Dialog
          open={open}
          onClose={handleClose}
          aria-labelledby="form-dialog-title"
        >
          <DialogTitle id="form-dialog-title">
            {t("SKILL_CREATION")}
          </DialogTitle>
          <DialogContent>
            <TextField
              required
              label={t("SKILL_CODE")}
              value={currentSkill.skill_code}
              type="text"
              onChange={(e) => handleFormChange(e.target.value, "SKILL_CODE")}
              fullWidth
            />
            <TextField
              required
              label={t("NAME")}
              value={currentSkill.name}
              type="text"
              onChange={(e) => handleFormChange(e.target.value, "NAME")}
              fullWidth
            />
            <TextField
              required
              label={t("THEME")}
              value={currentSkill.theme?.name}
              type="number"
              onChange={(e) => handleFormChange(e.target.value, "THEME")}
              fullWidth
            />
            <TextField
              label={t("DESCRIPTION")}
              value={currentSkill.description}
              type="text"
              onChange={(e) => handleFormChange(e.target.value, "DESCRIPTION")}
              fullWidth
            />
            <TextField
              required
              label={t("REF_CODE")}
              value={currentSkill.ref_code}
              type="text"
              onChange={(e) => handleFormChange(e.target.value, "REF")}
              fullWidth
            />
            <FormControl style={{width:"100%"}} required>
              <InputLabel>{t("LOCALE")}</InputLabel>
              <Select
                value={currentSkill.locale}
                label={t("LOCALE")}
                onChange={(e) => handleFormChange(e.target.value, "LOCALE")}
              >
                {
                  langs.length > 0 ?
                    langs.map( (item) => (
                      <MenuItem value={item.code}>{item.name}</MenuItem>
                    ))
                  :
                    <MenuItem>Fetching data please wait...</MenuItem>
                }
                <MenuItem value="other">Other</MenuItem>
              </Select>
            </FormControl>
          </DialogContent>
          <DialogActions >
            <Button onClick={handleClose} color="secondary">
              {t("CANCEL")}
            </Button>
            <Button onClick={handleSubmit} variant="contained">
              {editMode ? t("EDIT") : t("CREATE")}
            </Button>
          </DialogActions>
        </Dialog>
        }
        
        <Paper>
        <div className={styles.header}>
          <div>
            <FormControl style={{width:"100%"}}>
              <InputLabel>{t("COLUMN")}</InputLabel>
              <Select
                value={columnFilter}
                label={t("COLUMN")}
                onChange={(e) => setColumnFilter(e.target.value as string)}
              >
                <MenuItem value="name">{t("NAME")}</MenuItem>
                <MenuItem value="theme">{t("THEME")}</MenuItem>
                <MenuItem value="skill_code">{t("SKILL_CODE")}</MenuItem>
              </Select>
            </FormControl>
            <TextField 
              disabled={columnFilter === ""}
              label={t("FILTER")}
              value={filter}
              onChange={(e) => setFilter(e.target.value as string)}
            />
            
          </div>
          {
            isAdmin() &&
            <IconButton onClick={handleClickOpen}>
              <AddCircleIcon />
            </IconButton>
          }
        </div>

          <DisplaySkills
            skills={filteredSkills}
            setCurrentSkill={setCurrentSkill}
            setOpen={setOpen}
            setEditMode={setEditMode}
            t={t}
          />
        </Paper>
      </Container>
  );
}


export default withReducer([{key:'skills', reducer: SkillReducer}])(SkillList)