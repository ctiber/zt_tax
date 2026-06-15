import { CircularProgress, Container, FormControl, InputLabel, MenuItem, Paper, Select, Table, TableBody, TableCell, TableContainer, TablePagination, TableRow, TextField } from "@material-ui/core";
import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useDispatch, useSelector } from "react-redux";
import { changeRole, getAllUsers } from "../../store/actions/user.actions";
import { getAllUsersSelector } from "../../store/selectors";
import { IUser } from "../../store/types";
import { EnhancedTableHead, getComparator, HeadCell, Order, stableSort } from "../common/EnhancedTableHead";
import styles from './UsersList.module.css'


export const UsersList = () => {

  const { t } = useTranslation()

  const dispatch = useDispatch();

  useEffect(() => {
    dispatch(getAllUsers())
  }, [dispatch])

  const users = useSelector(getAllUsersSelector);

  const updateRole = (event : React.ChangeEvent<{value: unknown}>, user_id: number) => {
    
    let data : IUser = users.find( (user) => user.user_id === user_id)
    data.role_id = event.target.value as number
    dispatch(changeRole(user_id, data))
  }

  const [order, setOrder] = useState<Order>('asc');
  const [orderBy, setOrderBy] = useState('user_id');


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
      id: "user_id",
      label: "Id",
      sortable: true,
      disablePadding: false,
      numeric: false
    },
    {
      id: "email",
      label: "Email",
      sortable: true,
      disablePadding:false,
      numeric: false
    },
    {
      id: "enabled",
      label: t("VERIFIED"),
      sortable: true,
      disablePadding:false,
      numeric: false
    },
    {
      id: "firstname",
      label: t("FIRSTNAME"),
      sortable: true,
      disablePadding: false,
      numeric: false
    },
    {
      id: "lastname",
      label: t("LASTNAME"),
      sortable: true,
      disablePadding: false,
      numeric: false
    },
    {
      id: "tdgroup",
      label: t("GROUP"),
      sortable: true,
      disablePadding: false,
      numeric: false
    },
    {
      id: "role",
      label: t("ROLE"),
      sortable: true,
      disablePadding: false,
      numeric: false
    }
  ]


  const [columnFilter, setColumnFilter] = useState("");
  const [filter, setFilter] = useState("");
  const [filteredUsers, setFilteredUsers] = useState<IUser[]>([])

  useEffect( () => {
    setFilteredUsers(users)
  }, [users])

  useEffect( () => {
    
    setFilteredUsers(users.filter( ( user ) => {
      if(columnFilter === "role"){
        return (user[columnFilter as keyof IUser]["name"]).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").includes(filter.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""))
      }else{
        return (user[columnFilter as keyof IUser]+"").toLowerCase().includes(filter.toLowerCase())
      }
    }))
  }, [columnFilter, filter, users])

  if(users){
    return (
      <Container>
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
                <MenuItem value="user_id">{t("Id")}</MenuItem>
                <MenuItem value="email">{t("EMAIL")}</MenuItem>
                <MenuItem value="enabled">{t("VERIFIED")}</MenuItem>
                <MenuItem value="firstname">{t("FIRSTNAME")}</MenuItem>
                <MenuItem value="lastname">{t("LASTNAME")}</MenuItem>
                <MenuItem value="tdgroup">{t("GROUP")}</MenuItem>
                <MenuItem value="role">{t("ROLE")}</MenuItem>
              </Select>
            </FormControl>
            <TextField 
              disabled={columnFilter === ""}
              label={t("FILTER")}
              value={filter}
              onChange={(e) => setFilter(e.target.value as string)}
            />
            
          </div>
        </div>
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
                {
                  stableSort<any>(filteredUsers, getComparator(order, orderBy)).slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage).map( (user, index) => (
                    <TableRow key={index}>
                      <TableCell className="cell">
                        {user.user_id}
                      </TableCell>
                      <TableCell className="cell">
                        {user.email}
                      </TableCell>
                      <TableCell className="cell">
                        {user.enabled ? t("YES") : t("NO")}
                      </TableCell>
                      <TableCell className="cell">
                        {user.firstname}
                      </TableCell>
                      <TableCell className="cell">
                        {user.lastname}
                      </TableCell>
                      <TableCell className="cell">
                        {user.tdgroup}
                      </TableCell>
                      <TableCell className="cell">
                        <Select value={user.role.role_id} onChange={ (event) => updateRole(event, user.user_id)}>
                          <MenuItem value={1}>{t("ADMINISTRATOR")}</MenuItem>
                          <MenuItem value={2}>{t("TEACHER")}</MenuItem>
                          <MenuItem value={3}>{t("STUDENT")}</MenuItem>
                        </Select>
                      </TableCell>
                    </TableRow>
                  ))
                }
              </TableBody>
            </Table>
          </TableContainer>
          <TablePagination 
            rowsPerPageOptions={[10,25,100]}
            component="div"
            count={filteredUsers.length}
            rowsPerPage={rowsPerPage}
            page={page}
            onPageChange={handleChangePage}
            onRowsPerPageChange={handleChangeRowsPerPage}
            labelRowsPerPage={t("ROWS_PER_PAGE")}
            labelDisplayedRows={({from, to, count}) => `${from}-${to} ${t("OF")} ${count!== -1 ? count : `${t("MORE_THAN")} ${to}`}`}
          />
        </Paper>
      </Container>
    )
  }else{
    return (
      <div>
        <CircularProgress></CircularProgress>
      </div>
    )
  }
}