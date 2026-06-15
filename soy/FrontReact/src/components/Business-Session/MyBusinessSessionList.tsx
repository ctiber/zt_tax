import { Box, Button, Container, FormControl, IconButton, InputLabel, MenuItem, Paper, Select, Tab, Table, TableBody, TableCell, TableContainer, TablePagination, TableRow, Tabs, TextField, Tooltip, Typography } from "@material-ui/core";
import { FindInPage, Help } from "@material-ui/icons";
import BarChartIcon from "@material-ui/icons/BarChart";
import DeleteIcon from "@material-ui/icons/Delete";
import EditIcon from "@material-ui/icons/Edit";
import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useDispatch, useSelector } from "react-redux";
import { Link } from "react-router-dom";
import { getAllBusinessProfileAction, getAllBusinessSessionsAction, getAllRegisteredBusinessSessionsAction } from "../../store/actions";
import { businessProfileSelector, connectedUserSelector, getNbrThanksSelector } from "../../store/selectors";
import { authoredSessionsSelector, registeredBusinessSessionsSelector } from "../../store/selectors/businessSessionSelector";
import { IBusinessProfile, IBusinessSession } from "../../store/types";
import withReducer from "../../store/withReducer";
import { UserAcquiredSkills } from "../UserAcquiredSkills/UserAcquiredSkills";
import { DeleteBusinessSessionDialogBox } from "./DeleteBusinessSessionDialogBox";
import { EditBusinessSessionDialogBox } from "./EditBusinessSessionDialogBox";
import ProfileDetailsDialogBox from "./ProfileDetailsDialogBox";
import { BusinessSessionReducer } from "../../store/reducers/businessSessionReducer";
import { BusinessProfileReducer } from "../../store/reducers/businessProfileReducer";
import { SequenceReducer } from "../../store/reducers/sequenceReducer";
import { EnhancedTableHead, getComparator, HeadCell, Order, stableSort } from "../common/EnhancedTableHead";
import moment from "moment";
import styles from './MyBusinessSessionList.module.css'
import { getNbrThanks } from "../../store/actions/user.actions";

const MyBusinessSessionList = () => {

  const { t } = useTranslation()
  const dispatch = useDispatch();
  const connectedUser = useSelector(connectedUserSelector);
  const registeredSessions = useSelector(registeredBusinessSessionsSelector);
  const profiles = useSelector(businessProfileSelector);
  // We need a custom equality check otherwise authoredSessions is updated every second
  const authoredSessions = useSelector(authoredSessionsSelector(connectedUser), (left, right) => JSON.stringify(left) === JSON.stringify(right))

  const thanks = useSelector(getNbrThanksSelector)

  useEffect( () => {
    dispatch(getAllBusinessSessionsAction());
    dispatch(getAllBusinessProfileAction());
    dispatch(getAllRegisteredBusinessSessionsAction(connectedUser?.user_id ? connectedUser.user_id : 0));
    dispatch(getNbrThanks(connectedUser?.user_id ? connectedUser.user_id : 0))
  }, [dispatch, connectedUser])


  const handleProfileDetailsOpenning = (profile: IBusinessProfile | undefined) => {
    if (profile) {
      setCurrentProfile(profile);
      setProfileDetailsOpen(true);
    }
  };

  const [openProfileDetails, setProfileDetailsOpen] = useState<boolean>(false);
  const [currentProfile, setCurrentProfile] = useState<IBusinessProfile>();

  const handleProfileDetailsClosing = () => {
    setProfileDetailsOpen(false);
  };

  
 
  function a11yProps(index: any) {
    return {
      id: `simple-tab-${index}`,
      'aria-controls': `simple-tabpanel-${index}`,
    };
  }

  const [showingTab, setShowingTab] = useState(0)


  const defaultSession: IBusinessSession = {
    ps_id: 0,
    p_id: 0,
    seq_id: 0,
    author: connectedUser?.user_id || 0,
    name: "",
    secret_key: "",
    start_date: new Date(),
    end_date: new Date(),
    description: "",
    universe: "",
    is_timed: false,
  };
  const [currentSession, setCurrentSession] = useState<IBusinessSession>(defaultSession);

  const [openEditDialogBox, setOpenEditDialogBox] = useState<boolean>(false);

  const handleEditDialogBoxOpening = (session: IBusinessSession) => {
    setCurrentSession(session);
    setOpenEditDialogBox(true);
  };

 
  const [openDeleteDialogBox, setOpenDeleteDialogBox] = useState<boolean>(false);
  const handleDeleteDialogBoxOpening = (session: IBusinessSession) => {
    setCurrentSession(session);
    setOpenDeleteDialogBox(true);
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


  const handleTabChange = (event: React.ChangeEvent<{}>, newValue: number) => {
    setPage(0)
    setOrderBy("name")
    setShowingTab(newValue);
  };


  const heads : readonly HeadCell[] = [
    {
      id: "name",
      label: t("NAME"),
      sortable: true,
      disablePadding: false,
      numeric:false
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
    if(showingTab === 1) setFilteredSessions(registeredSessions)
    else setFilteredSessions(authoredSessions)
  }, [registeredSessions, authoredSessions, showingTab])

  useEffect( () => {
    let sessions = showingTab === 1 ? registeredSessions : authoredSessions
    setFilteredSessions(sessions.filter( ( session ) => {
      if(columnFilter === "start_date" || columnFilter === "end_date"){
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
  }, [columnFilter, filter, registeredSessions, authoredSessions, date, dateComparator, showingTab, profiles])


  const header = (
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
    </div>
  )

  const title = (
    <div className={styles.title}>
      <Typography variant="h3" component="h1" color="primary" className="title">
        {t("MY_SESSIONS")}
      </Typography>
      <div className={styles.id}>
        <div>{t("NUMBER_OF_COMMENDS_RECEIVED")}</div>
        <div>
          {thanks}<Tooltip title={t("GIVE_FOR_COMMEND", {id: connectedUser?.user_id})+""}><IconButton disableRipple disableFocusRipple style={{fontSize:'0.6em', padding:'1px'}}><Help style={{height:'0.7em', width: '0.7em'}}></Help></IconButton></Tooltip>
        </div>
      </div>
    </div>

  )

  if(connectedUser && connectedUser.role_id === 3){
    return (
      <Container>
        {title}
        <Paper>

          <ProfileDetailsDialogBox
            profile={currentProfile}
            open={openProfileDetails}
            onClose={handleProfileDetailsClosing}
          />
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
                  {stableSort<IBusinessSession>(registeredSessions, getComparator(order, orderBy)).slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage).map((session) => (
                    <TableRow key={session.ps_id} className="row">
                      <TableCell className="cell">{session.name}</TableCell>
                      <TableCell className="cell">{new Date(session.start_date).toLocaleDateString()}</TableCell>
                      <TableCell className="cell">{new Date(session.end_date).toLocaleDateString()}</TableCell>
                      <TableCell className="cell">{session.description}</TableCell>
                      <TableCell className="cell">
                        {profiles.find((profile) => profile.p_id === session.p_id)?.job}
                        <IconButton
                          area-label="details"
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
                        <Link to={"/session/" + session.ps_id + "/exercises"}>
                          <Button variant="contained">
                            {t("SELECT")}
                          </Button>
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
          </TableContainer>
          <TablePagination 
              rowsPerPageOptions={[10,25,100]}
              component="div"
              count={registeredSessions.length}
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
  }else if(connectedUser && authoredSessions){
    return(
      
      <Container>
        <EditBusinessSessionDialogBox
          session={currentSession}
          open={openEditDialogBox}
          set={setOpenEditDialogBox}
        />
        <DeleteBusinessSessionDialogBox 
          session={currentSession}
          open={openDeleteDialogBox}
          set={setOpenDeleteDialogBox}
        />
        {title}
        <Paper>

          <ProfileDetailsDialogBox
            profile={currentProfile}
            open={openProfileDetails}
            onClose={handleProfileDetailsClosing}
          />
          <Tabs variant="fullWidth" value={showingTab} onChange={handleTabChange} aria-label="tab">
            <Tab label={<span style={{fontSize:"1.1rem"}}>{t("AUTHORED_SESSIONS")}</span>} {...a11yProps(0)} />
            <Tab data-cy="registered-sessions-button" label={<span style={{fontSize:"1.1rem"}}>{t("REGISTERED_SESSIONS")}</span>} {...a11yProps(1)} />
          </Tabs>
          {
            header
          }
          <TabPanel value={showingTab} index={1}>
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
                    <TableRow data-cy="registered-sessions-row" key={session.ps_id} className="row">
                      <TableCell className="cell">{session.name}</TableCell>
                      <TableCell className="cell">{new Date(session.start_date).toLocaleDateString()}</TableCell>
                      <TableCell className="cell">{new Date(session.end_date).toLocaleDateString()}</TableCell>
                      <TableCell className="cell">{session.description}</TableCell>
                      <TableCell className="cell">
                        {profiles.find((profile) => profile.p_id === session.p_id)?.job}
                        <IconButton
                          area-label="details"
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
                        <Link to={"/session/" + session.ps_id + "/exercises"}>
                          <Button variant="contained">
                            {t("SELECT")}
                          </Button>
                        </Link>
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
          </TabPanel>
          <TabPanel value={showingTab} index={0}>
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
                    <TableRow key={session.ps_id} className="row">
                      <TableCell className="cell">{session.name}</TableCell>
                      <TableCell className="cell">{new Date(session.start_date).toLocaleDateString()}</TableCell>
                      <TableCell className="cell">{new Date(session.end_date).toLocaleDateString()}</TableCell>
                      <TableCell className="cell">{session.description}</TableCell>
                      <TableCell className="cell">
                        {profiles.find((profile) => profile.p_id === session.p_id)?.job}
                        <IconButton
                          area-label="details"
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
                        <Link to={"/session/" + session.ps_id + "/exercises"}>
                          <Button variant="contained">
                            {t("SELECT")}
                          </Button>
                        </Link>
                        <IconButton href={"/session/" + session.ps_id + "/results"}>
                          <BarChartIcon></BarChartIcon>
                        </IconButton>
                        <IconButton
                          onClick={() => handleEditDialogBoxOpening(session)}
                        >
                          <EditIcon/>
                        </IconButton>
                        <IconButton
                          onClick={() => handleDeleteDialogBoxOpening(session)}
                        >
                          <DeleteIcon/>
                        </IconButton>
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
          </TabPanel>
        </Paper>
        <br/>
        <UserAcquiredSkills></UserAcquiredSkills>
      </Container>
    )
  }else{
    return null;
  }
}

interface TabPanelProps {
  children?: React.ReactNode;
  index: any;
  value: any;
}


function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`simple-tabpanel-${index}`}
      aria-labelledby={`simple-tab-${index}`}
      {...other}
    >
      {value === index && (
        <Box p={3}>
          {children}
        </Box>
      )}
    </div>
  );
}


export default withReducer([
  {key:'businessSessions',reducer: BusinessSessionReducer},
  {key:'businessProfile', reducer: BusinessProfileReducer},
  {key:'sequences', reducer: SequenceReducer}
])(MyBusinessSessionList)