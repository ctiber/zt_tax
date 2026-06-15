import {
  Button, Container, FormControl, InputLabel, MenuItem, Paper, Select, Table,
  TableBody,
  TableCell, TableContainer,
  TablePagination,
  TableRow, TextField, Typography
} from "@material-ui/core";
import IconButton from "@material-ui/core/IconButton";
import { AddCircle, FindInPage } from "@material-ui/icons";
import DeleteIcon from "@material-ui/icons/Delete";
import EditIcon from "@material-ui/icons/Edit";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useDispatch, useSelector } from "react-redux";
import { getAllBusinessProfileAction, getAllSequencesAction } from "../../store/actions";
import {
  getAllBusinessSessionsAction,
  getAllRegisteredBusinessSessionsAction
} from "../../store/actions/business-session.actions";
import { businessProfileSelector, connectedUserSelector } from "../../store/selectors";
import { allBusinessSessionsSelector, registeredBusinessSessionsSelector } from "../../store/selectors/businessSessionSelector";
import { sequencesSelector } from "../../store/selectors/sequenceSelector";
import { IBusinessProfile, IBusinessSession, ISequence, IUser } from "../../store/types";
import ProfileDetailsDialogBox from "./ProfileDetailsDialogBox";

import React from "react";
import { BusinessSessionReducer } from "../../store/reducers/businessSessionReducer";
import { DeleteBusinessSessionDialogBox } from "./DeleteBusinessSessionDialogBox";
import { EditBusinessSessionDialogBox } from "./EditBusinessSessionDialogBox";
import { RegisterDialogBox } from "./RegisterDialogBox";
import withReducer from "../../store/withReducer";
import { BusinessProfileReducer } from "../../store/reducers/businessProfileReducer";
import { SequenceReducer } from "../../store/reducers/sequenceReducer";
import { EnhancedTableHead, getComparator, HeadCell, Order, stableSort } from "../common/EnhancedTableHead";
import moment from "moment";
import styles from './BusinessSessionList.module.css'


/**
 *
 * This component receives a list of sessions as props and displays them
 * @param param0 a list of sessions : IBusinessSession[]
 */
function BusinessSessionListComponent({
  sessions,
  profiles,
  sequences,
  connectedUser,
}: {
  sessions: IBusinessSession[];
  profiles: IBusinessProfile[];
  sequences: ISequence[];
  connectedUser: IUser;
}) {
  //i18n TRANSLATION FUNCTION
  const { t } = useTranslation();

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
  const [currentSession, setCurrentSession] = useState<IBusinessSession>(defaultSession);
  //dialog boxes
  const [openProfileDetails, setProfileDetailsOpen] = useState<boolean>(false);
 

  const registeredSessions = useSelector(registeredBusinessSessionsSelector)

  //current session and profile are passed to the dialog box so that they can display them
  const [currentProfile, setCurrentProfile] = useState<IBusinessProfile>();
  

  //DIALOG BOX OPENNING AND CLOSING FUNCTIONS
  //PROFILE
  const handleProfileDetailsOpenning = (profile: IBusinessProfile | undefined) => {
    if (profile) {
      setCurrentProfile(profile);
      setProfileDetailsOpen(true);
    }
  };

  const handleProfileDetailsClosing = () => {
    setProfileDetailsOpen(false);
  };

  const [openEditDialogBox, setOpenEditDialogBox] = useState<boolean>(false);

  const handleEditDialogBoxOpenning = (session: IBusinessSession) => {
    setCurrentSession(session);
    setOpenEditDialogBox(true);
  };

 
  const [openDeleteDialogBox, setOpenDeleteDialogBox] = useState<boolean>(false);
  const handleDeleteDialogBoxOpenning = (session: IBusinessSession) => {
    setCurrentSession(session);
    setOpenDeleteDialogBox(true);
  };

  

  const [openRegisterDialogBox, setRegisterDialogBoxOpen] = useState<boolean>(false);

  const handleDialogBoxOpenning = (session: IBusinessSession) => {
    setCurrentSession(session);
    setRegisterDialogBoxOpen(true);
  };


  //HANDLERS



  /**
   *
   * @param session the session to check
   * @returns a boolean that determines if the current user is able to modify a given session (i.e. if he's the session's author)
   */
  const authorizedModification = (session: IBusinessSession) => {
    return connectedUser.user_id === session.author.user_id;
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
      id: "author",
      label: t("AUTHOR"),
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
      id: "password",
      label: t("PASSWORD"),
      sortable: false,
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
    setFilteredSessions(sessions)
  }, [sessions])

  useEffect( () => {
    
    setFilteredSessions(sessions.filter( ( session ) => {
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
  }, [columnFilter, filter, sessions, date, dateComparator, profiles])


  return (
    <React.Fragment>
      <Container>
      <Typography variant="h3" component="h1" color="primary" className="title">
        Sessions
      </Typography>
      <ProfileDetailsDialogBox
        profile={currentProfile}
        open={openProfileDetails}
        onClose={handleProfileDetailsClosing}
      />
      <EditBusinessSessionDialogBox
        session={currentSession}
        open={openEditDialogBox}
        set={setOpenEditDialogBox}
      />
      <RegisterDialogBox
        session={currentSession}
        open={openRegisterDialogBox}
        set={setRegisterDialogBoxOpen}
      />
      <DeleteBusinessSessionDialogBox 
        session={currentSession}
        open={openDeleteDialogBox}
        set={setOpenDeleteDialogBox}
      />

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
          <IconButton
            area-label="create"
            data-cy="session-create-button"
            onClick={() => handleEditDialogBoxOpenning(defaultSession)}
          >
            <AddCircle className="icon" />
          </IconButton>
        </div>
        
        <div data-cy="sessions-list">
          {
            filteredSessions.length !== 0 ?
            <React.Fragment>
              <TableContainer>
                <Table>
                  <EnhancedTableHead 
                    onRequestSort={handleRequestSort}
                    order={order}
                    orderBy={orderBy}
                    headCells={heads}
                    shiftRight={false}
                  />
                  <TableBody>
                    {stableSort<IBusinessSession>(filteredSessions, getComparator(order, orderBy)).slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage).map((session) => (
                      <TableRow data-cy="session-item" key={session.ps_id} className="row">
                        <TableCell className="cell">{session.name}</TableCell>
                        <TableCell className="cell">{session.author.firstname} {session.author.lastname}</TableCell>
                        <TableCell className="cell">{new Date(session.start_date).toLocaleDateString()}</TableCell>
                        <TableCell className="cell">{new Date(session.end_date).toLocaleDateString()}</TableCell>
                        <TableCell className="cell">{session.description}</TableCell>
                        <TableCell className="cell">{session.secret_key}</TableCell>
                        <TableCell className="cell">
                          {profiles.find((profile) => profile.p_id === session.p_id)?.job}
                          <IconButton
                            area-label="details"
                            onClick={() =>
                              handleProfileDetailsOpenning(profiles.find((profile) => profile.p_id === session.p_id))
                            }
                          >
                            <FindInPage />
                          </IconButton>
                        </TableCell>
                        {
                        connectedUser.role_id !== 1 ?
                          authorizedModification(session) ? (
                            <TableCell className="cell">
                              <IconButton
                                data-cy="session-edit-button"
                                onClick={() => handleEditDialogBoxOpenning(session)}
                                disabled={!authorizedModification(session)}
                              >
                                <EditIcon />
                              </IconButton>
                              <IconButton
                                color="secondary"
                                onClick={() => handleDeleteDialogBoxOpenning(session)}
                                disabled={!authorizedModification(session)}
                              >
                                <DeleteIcon />
                              </IconButton>
                            </TableCell>
                          ) : 
                          (registeredSessions.some(regSession => regSession.ps_id === session.ps_id) ? 
                          <TableCell className="cell">
                            {t("ALREADY_REGISTERED")}
                          </TableCell>
                          :
                          <TableCell className="cell">
                          
                          { new Date(session.end_date).getTime() > new Date().getTime() && 
                            <Button
                              variant="contained"
                              onClick={() => handleDialogBoxOpenning(session)}
                            >
                              {t("REGISTER")}
                            </Button>
                          }
                        </TableCell>
                          )
                      :
                        (registeredSessions.some(regSession => regSession.ps_id === session.ps_id) ? 
                        <TableCell className="cell">
                          {t("ALREADY_REGISTERED")}
                          <IconButton
                            data-cy="session-edit-button"
                            onClick={() => handleEditDialogBoxOpenning(session)}
                        >
                          <EditIcon className="icon" />
                        </IconButton>
                        <IconButton
                          color="secondary"
                          onClick={() => handleDeleteDialogBoxOpenning(session)}
                        >
                          <DeleteIcon />
                        </IconButton>
                        </TableCell>          
                        :
                        <TableCell className="cell">
                        
                        
                        { new Date(session.end_date).getTime() > new Date().getTime() && 
                          <Button
                            variant="contained"
                            onClick={() => handleDialogBoxOpenning(session)}
                          >
                            {t("REGISTER")}
                          </Button>
                        }
                        <IconButton
                          data-cy="session-edit-button"
                          onClick={() => handleEditDialogBoxOpenning(session)}
                        >
                          <EditIcon />
                        </IconButton>
                        <IconButton
                          color="secondary"
                          onClick={() => handleDeleteDialogBoxOpenning(session)}
                        >
                          <DeleteIcon />
                        </IconButton>
                      </TableCell>
                        )
                      
                      }
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
            </React.Fragment>
          :
            "There is no session yet!"
          }
          
        </div>
      </Paper>
      
    </Container>
    </React.Fragment>
    
  );
}



/**
 * This React component is linked to the Store. It retrieves the list of all sessions and displays it.
 * It's used to manage all the app's session (CRUD)
 */
function BusinessSessionList() {
  //STORE FUNCTIONS
  const dispatch = useDispatch();

  const sessions = useSelector(allBusinessSessionsSelector);
  const profiles = useSelector(businessProfileSelector);
  const sequences = useSelector(sequencesSelector);
  const connectedUser = useSelector(connectedUserSelector);

  useEffect(() => {
    dispatch(getAllRegisteredBusinessSessionsAction(connectedUser?.user_id ? connectedUser.user_id : 0));
    dispatch(getAllBusinessSessionsAction());
    dispatch(getAllBusinessProfileAction());
    dispatch(getAllSequencesAction());
  }, [dispatch, connectedUser]);

  if (sessions && connectedUser) {
    return (
      <BusinessSessionListComponent
        sessions={sessions}
        profiles={profiles}
        sequences={sequences}
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
])(BusinessSessionList)
