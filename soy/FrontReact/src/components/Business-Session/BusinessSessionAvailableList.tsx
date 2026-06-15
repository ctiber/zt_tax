import {
  Button, Container, FormControl, IconButton, InputLabel, MenuItem, Paper, Select, Table,
  TableBody,
  TableCell, TableContainer,
  TablePagination,
  TableRow,
  TextField,
  Typography
} from "@material-ui/core";
import { AddCircle, FindInPage } from "@material-ui/icons";
import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useDispatch, useSelector } from "react-redux";
import { getAllBusinessProfileAction } from "../../store/actions";
import {
  getAllAvailableBusinessSessionsAction, getAllRegisteredBusinessSessionsAction,
} from "../../store/actions/business-session.actions";
import { businessProfileSelector, connectedUserSelector } from "../../store/selectors";
import {
  availableBusinessSessionsSelector,
  registeredBusinessSessionsSelector
} from "../../store/selectors/businessSessionSelector";
import { IBusinessProfile, IBusinessSession, IUser } from "../../store/types";
import ProfileDetailsDialogBox from "./ProfileDetailsDialogBox";

import withReducer from "../../store/withReducer";
import { BusinessSessionReducer } from "../../store/reducers/businessSessionReducer";
import { BusinessProfileReducer } from "../../store/reducers/businessProfileReducer";
import { EditBusinessSessionDialogBox } from "./EditBusinessSessionDialogBox";
import { SequenceReducer } from "../../store/reducers/sequenceReducer";
import { EnhancedTableHead, getComparator, HeadCell, Order, stableSort } from "../common/EnhancedTableHead";
import { RegisterDialogBox } from "./RegisterDialogBox";
import styles from './BusinessSessionAvailableList.module.css'
import moment from "moment";



/**
 * A React component that displays a list of sessions
 * @param param0 the list of sessions to be displayed, the associated profiles (by default, all the profiles) and the currently connected user
 * @returns A React component displaying a list of available sessions to the user.
 */
function BusinessSessionListAvailableComponent({
  availableSessions,
  registeredSessions,
  profiles,
  connectedUser,
}: {
  availableSessions: IBusinessSession[];
  registeredSessions: IBusinessSession[];
  profiles: IBusinessProfile[];
  connectedUser: IUser;
}) {
  //i18n TRANSLATION FUNCTION
  const { t } = useTranslation();

  //LOCAL STATES
  //DIALOG BOX MANAGEMENT
  const [openRegisterDialogBox, setRegisterDialogBoxOpen] = useState<boolean>(false);
  const [openProfileDetails, setProfileDetailsOpen] = useState<boolean>(false);
  //current session and profile are passed to the dialog box so that they can display them
  const [currentSession, setCurrentSession] = useState<IBusinessSession>();
  const [currentProfile, setCurrentProfile] = useState<IBusinessProfile>();

  //DIALOG BOX OPENNING AND CLOSING FUNCTIONS
  const handleProfileDetailsOpenning = (profile: IBusinessProfile | undefined) => {
    if (profile) {
      setCurrentProfile(profile);
      setProfileDetailsOpen(true);
    }
  };

  const handleProfileDetailsClosing = () => {
    setProfileDetailsOpen(false);
  };

  const handleDialogBoxOpenning = (session: IBusinessSession) => {
    setCurrentSession(session);
    setRegisterDialogBoxOpen(true);
  };

  const [openEditDialogBox, setOpenEditDialogBox] = useState<boolean>(false);

  const handleEditDialogBoxOpenning = () => {
    setOpenEditDialogBox(true);
  };

  const defaultSession: IBusinessSession = {
    ps_id: 0,
    p_id: 0,
    seq_id: 0,
    author: connectedUser.user_id || 0,
    name: "",
    secret_key: "",
    start_date: new Date(),
    end_date: new Date(),
    description: "",
    universe: "",
    is_timed: false,
  };

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
      id: "start_date",
      label: t("START_DATE"),
      sortable: true,
      disablePadding:false,
      numeric: false
    },
    {
      id: "end_date",
      label: t("END_DATE"),
      sortable: true,
      disablePadding:false,
      numeric: false
    },
    {
      id: "description",
      label: t("DESCRIPTION"),
      sortable: true,
      disablePadding: false,
      numeric: false
    },
    {
      id: "p_id",
      label: t("AIMED_JOB"),
      sortable: false,
      disablePadding:false,
      numeric: false
    },
    {
      id: "ACTIONS",
      label: t("ACTIONS"),
      disablePadding: true,
      numeric: false,
      sortable: false
    }
  ]

  const [columnFilter, setColumnFilter] = useState("");
  const [dateComparator, setDateComparator] = useState("after");
  const [filter, setFilter] = useState("");
  const [filteredSessions, setFilteredSessions] = useState<IBusinessSession[]>([])
  const [date, setDate] = useState(new Date(Date.now()))

  useEffect( () => {
    setFilteredSessions(availableSessions)
  }, [availableSessions])

  useEffect( () => {
    
    setFilteredSessions(availableSessions.filter( ( session ) => {
      if(columnFilter === "author"){
        return (session[columnFilter as keyof IBusinessSession]["firstname"]+" "+session[columnFilter as keyof IBusinessSession]["lastname"]).toLowerCase().includes(filter.toLowerCase())
      }else if(columnFilter === "start_date" || columnFilter === "end_date"){
        if(dateComparator === "after"){
          return new Date(session[columnFilter as keyof IBusinessSession]).getTime() > date.getTime()
        }else{
          return new Date(session[columnFilter as keyof IBusinessSession]).getTime() < date.getTime()
        }
      }
      else if(columnFilter === "p_id"){
        return profiles.find((profile) => profile.p_id === session.p_id)?.job.toLowerCase().includes(filter.toLowerCase())
      }
      else{
        return (session[columnFilter as keyof IBusinessSession]+"").toLowerCase().includes(filter.toLowerCase())
      }
    }))
  }, [columnFilter, filter, availableSessions, date, dateComparator, profiles])


  return (
    <Container>
      <Typography variant="h3" component="h1" color="primary" className="title">
        {t("AVAILABLE_SESSIONS")}
      </Typography>
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
                <MenuItem value="author">{t("AUTHOR")}</MenuItem>
                <MenuItem value="start_date">{t("START_DATE")}</MenuItem>
                <MenuItem value="end_date">{t("END_DATE")}</MenuItem>
                <MenuItem value="description">{t("DESCRIPTION")}</MenuItem>
                <MenuItem value="p_id">{t("AIMED_JOB")}</MenuItem>
              </Select>
            </FormControl>
            {
              columnFilter === "start_date" || columnFilter === "end_date" ?
                <React.Fragment>
                  <FormControl style={{width:"100%"}}>
                  <InputLabel>{t("COMPARATOR")}</InputLabel>
                  <Select
                    value={dateComparator}
                    label={t("COLUMN")}
                    onChange={(e) => setDateComparator(e.target.value as string)}
                  >
                    <MenuItem value="after">{t("AFTER")}</MenuItem>
                    <MenuItem value="before">{t("BEFORE")}</MenuItem>
                  </Select>
                </FormControl>
                  <TextField 
                    label={t("FILTER")}
                    value={moment(new Date(date)).format("YYYY-MM-DD")}
                    type="date"
                    onChange={(e) => setDate(new Date(e.target.value))}
                  />
                </React.Fragment>
                
              :
              <TextField 
              disabled={columnFilter === ""}
              label={t("FILTER")}
              value={filter}
              onChange={(e) => setFilter(e.target.value as string)}
            />
            }
            
          </div>
        { connectedUser.role_id !== 3 && 
          <IconButton
            area-label="create"
            onClick={() => handleEditDialogBoxOpenning()}
          >
            <AddCircle className="icon" />
        </IconButton>
        }
      </div>
      {
        currentSession ?
        <RegisterDialogBox
          session={currentSession}
          open={openRegisterDialogBox}
          set={setRegisterDialogBoxOpen}
        />
        : ""
      }

      <ProfileDetailsDialogBox
        profile={currentProfile}
        open={openProfileDetails}
        onClose={handleProfileDetailsClosing}
      />
      {
        connectedUser.role_id !== 3 ?
          <EditBusinessSessionDialogBox
            session={defaultSession}
            open={openEditDialogBox}
            set={setOpenEditDialogBox}
          />
        :
          ""
      }

      <TableContainer className="sessionListTableContainer">
          <Table className="sessionListTable">
            <EnhancedTableHead 
                  onRequestSort={handleRequestSort}
                  order={order}
                  orderBy={orderBy}
                  headCells={heads}
                  shiftRight={false}
                />
            <TableBody>
              {stableSort<IBusinessSession>(filteredSessions, getComparator(order, orderBy)).slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage).map((session) => (
                <TableRow key={session.ps_id} className="row">
                  <TableCell className="cell">{session.name}</TableCell>
                  <TableCell className="cell">{new Date(session.start_date).toLocaleDateString()}</TableCell>
                  <TableCell className="cell">{new Date(session.end_date).toLocaleDateString()}</TableCell>
                  <TableCell className="cell">{session.description}</TableCell>
                  <TableCell className="cell">
                    {profiles.find((profile) => profile.p_id === session.p_id)?.job}
                    <IconButton
                      area-label="details"
                      className="session-list-primary-button"
                      onClick={() =>
                        handleProfileDetailsOpenning(
                          profiles.find((profile) => profile.p_id === session.p_id)
                        )
                      }
                    >
                      <FindInPage />
                    </IconButton>
                  </TableCell>
                  <TableCell className="cell">
                    <Button
                      variant="contained"
                      onClick={() => handleDialogBoxOpenning(session)}
                      className="session-list-primary-button"
                    >
                      {t("REGISTER")}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
      </TableContainer>
      <TablePagination 
          rowsPerPageOptions={[10,25,100]}
          component="div"
          count={filteredSessions.length}
          rowsPerPage={rowsPerPage}
          page={page}
          onPageChange={handleChangePage}
          onRowsPerPageChange={handleChangeRowsPerPage}
          labelRowsPerPage={t("ROWS_PER_PAGE")}
          labelDisplayedRows={({from, to, count}) => `${from}-${to} ${t("OF")} ${count!== -1 ? count : `${t("MORE_THAN")} ${to}`}`}
        />
      </Paper>
    </Container>
  );
}

/**
 * This React component is linked to the Store. It retrieves the available sessions for the connected user and then display them thanks to a pure component.
 */
function BusinessSessionAvailableList() {
  //STORE FUNCTIONS
  const dispatch = useDispatch();

  const availableSessions = useSelector(availableBusinessSessionsSelector);
  const registeredSessions = useSelector(registeredBusinessSessionsSelector);
  const profiles = useSelector(businessProfileSelector);
  const connectedUser = useSelector(connectedUserSelector);

  useEffect(() => {
    dispatch(getAllBusinessProfileAction());
    //dispatch(getAllBusinessSessionsAction());
    dispatch(getAllAvailableBusinessSessionsAction(connectedUser?.user_id ? connectedUser.user_id : 0));
    dispatch(getAllRegisteredBusinessSessionsAction(connectedUser?.user_id ? connectedUser.user_id : 0));
  }, [dispatch, connectedUser]);

  if (availableSessions && connectedUser) {
    //Displays data only if data has been retrieved successfully
    return (
      <BusinessSessionListAvailableComponent
        availableSessions={availableSessions}
        registeredSessions={registeredSessions}
        profiles={profiles}
        connectedUser={connectedUser}
      />
    );
  } else {
    return null;
  }
}

export default withReducer([
  {key:'businessSessions',reducer: BusinessSessionReducer},
  {key:'businessProfile', reducer: BusinessProfileReducer},
  {key:'sequences', reducer: SequenceReducer}
])(BusinessSessionAvailableList)
