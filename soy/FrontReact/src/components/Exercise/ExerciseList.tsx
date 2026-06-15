import React, { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { exerciseSelector } from "../../store/selectors/exerciseSelector";
import { IExercise } from "../../store/types/exercise.types";
import styles from "./ExerciseList.module.css";
import { ExerciseItem } from "./ExerciseItem";
import http from '../../http-common'

import {
  getAllExercises
} from "./../../store/actions/exercise.actions";

import {
  Container, FormControl, InputLabel, MenuItem, Select, Table,
  TableBody,
  TableContainer,
  TablePagination,
  TextField, Typography
} from "@material-ui/core";
import IconButton from "@material-ui/core/IconButton";
import Paper from "@material-ui/core/Paper";
import AddCircleIcon from "@material-ui/icons/AddCircle";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { ExerciseReducer } from "../../store/reducers/exerciseReducer";
import withReducer from "../../store/withReducer";
import { feedbacksSelector } from "../../store/selectors/feedbackSelector";
import { feedbackReducer } from "../../store/reducers/feedbackReducer";
import { getAllFeedbacksWithStats } from "../../store/actions/feedback.actions";
import { EnhancedTableHead, getComparator, HeadCell, Order, stableSort } from "../common/EnhancedTableHead";






function DisplayExercises({
  exercises,
  t,
}: {
  exercises: IExercise[];
  t: any;
}) {

  const headCells: readonly HeadCell[] = [
    {
      id: "ex_id",
      label: t("ID"),
      disablePadding: false,
      numeric: true,
      sortable: true
    },
    {
      id: "name",
      label: t("NAME"),
      disablePadding: false,
      numeric: false,
      sortable: true
    },
    {
      id: "difficulty",
      label: t("DIFFICULTY"),
      disablePadding: true,
      numeric: false,
      sortable: false
    },
    {
      label: t("AUTHOR"),
      id: "author",
      disablePadding: false,
      numeric: false,
      sortable: true
    },
    {
      label: t("STATE"),
      id: "state",
      disablePadding: false,
      numeric: false,
      sortable: true
    },
    {
      label: t("LOCALE"),
      id: "locale",
      disablePadding: false,
      numeric: false,
      sortable: true
    },
    {
      id: "LINKED_EXERCISE",
      label: t("LINKED_EXERCISE"),
      disablePadding: false,
      numeric: true,
      sortable: false
    },
    {
      id: "ACTIONS",
      label: t("ACTIONS"),
      disablePadding: true,
      numeric: false,
      sortable: false
    }
  ]
  

  const [order, setOrder] = useState<Order>('asc');
  const [orderBy, setOrderBy] = useState('ex_id');

  const handleRequestSort = (event : any, property : any) => {
    const isAsc = orderBy === property && order === 'asc';
    setOrder(isAsc ? 'desc' : 'asc');
    setOrderBy(property);
  };

  const stats = useSelector(feedbacksSelector)
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);

  const handleChangePage = (event: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  return (
    <div data-cy="exercise-list" className={styles.table__container}>
      {
        exercises.length !== 0 ?
        <React.Fragment>
          <TableContainer>
            <Table aria-label="collapsible table">
              <EnhancedTableHead 
                order={order}
                orderBy={orderBy}
                headCells={headCells}
                onRequestSort={handleRequestSort}
                shiftRight={true}
              />
              <TableBody className={styles.exerciseBody}>
                {
                stableSort<IExercise>(exercises, getComparator(order, orderBy)).slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage).map((exercise, index) => (
                  <ExerciseItem
                    exercise={exercise}
                    index={index}
                    key={exercise.ex_id}
                    stats={ stats.find( (stat) => ( stat.ex_id === exercise.ex_id ))}
                  ></ExerciseItem>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          <TablePagination 
            rowsPerPageOptions={[10,25,100]}
            component="div"
            count={exercises.length}
            rowsPerPage={rowsPerPage}
            page={page}
            onPageChange={handleChangePage}
            onRowsPerPageChange={handleChangeRowsPerPage}
            labelRowsPerPage={t("ROWS_PER_PAGE")}
            labelDisplayedRows={({from, to, count}) => `${from}-${to} ${t("OF")} ${count!== -1 ? count : `${t("MORE_THAN")} ${to}`}`}
          />
        </React.Fragment>
        :
        "There is no exercise yet!"
      }

    </div>
  );
}

function ExerciseList() {
  const dispatch = useDispatch();
  // Get exercises from Selector
  const exercises = useSelector(exerciseSelector);

  const { t } = useTranslation();

  useEffect(() => {
    dispatch(getAllExercises());
    dispatch(getAllFeedbacksWithStats())
  }, [dispatch]);

  const [fileInfo, setFileInfo] = useState<any>()
  
  useEffect( () => {
    if(!fileInfo){
      http.get("/api/exercise/lib")
      .then( (res) => {
        setFileInfo(res.data)
      })
    }
  }, [fileInfo])


  const downloadLib = () =>{
    var blob = new Blob([new Uint8Array(fileInfo.data.data)], {type: fileInfo.data.type})
    var url = URL.createObjectURL(blob)
    let link = document.createElement("a");
    if(link.download !== undefined){
      link.setAttribute("href", url)
      link.setAttribute("download", fileInfo.name)
      link.style.visibility = 'hidden'
      document.body.appendChild(link)
      link.click();
      document.body.removeChild(link)
    }
  }

  const [columnFilter, setColumnFilter] = useState("");
  const [filter, setFilter] = useState("");

  const [filteredExercises, setFilteredExercises] = useState<IExercise[]>([])

  useEffect( () => {
    setFilteredExercises(exercises)
  }, [exercises])

  useEffect( () => {
    
    setFilteredExercises(exercises.filter( ( exercise ) => {
      if(columnFilter === "author"){
        return (exercise[columnFilter as keyof IExercise]["firstname"]+" "+exercise[columnFilter as keyof IExercise]["lastname"]).toLowerCase().includes(filter.toLowerCase())

      }else{
        return (exercise[columnFilter as keyof IExercise]+"").toLowerCase().includes(filter.toLowerCase())
      }
    }))
  }, [columnFilter, filter, exercises])


  return (
    <Container>
      <Typography variant="h3" component="h1" color="primary" className="title">
        {t("EXERCISES")}
      </Typography>
      {
        fileInfo &&
          <p style={{textAlign: "left"}}>{t("USED_LIBRARY")} <button style={{cursor:"pointer"}} onClick={downloadLib}>plageLib-v{fileInfo.version}.py</button> </p>

      }
      <Paper className={styles.exercise__littleHeader}>
        <div className={styles.header}>
          <div>
            <FormControl style={{width:"100%"}}>
              <InputLabel>{t("COLUMN")}</InputLabel>
              <Select
                value={columnFilter}
                label={t("COLUMN")}
                onChange={(e) => setColumnFilter(e.target.value as string)}
              >
                <MenuItem value="ex_id">Id</MenuItem>
                <MenuItem value="name">{t("NAME")}</MenuItem>
                <MenuItem value="author">{t("AUTHOR")}</MenuItem>
                <MenuItem value="state">{t("STATE")}</MenuItem>
                <MenuItem value="locale">{t("LOCALE")}</MenuItem>
              </Select>
            </FormControl>
            <TextField 
              disabled={columnFilter === ""}
              label={t("FILTER")}
              value={filter}
              onChange={(e) => setFilter(e.target.value as string)}
            />
          </div>

          <Link to="/exercise/create">
            <IconButton data-cy="exercise-create-button" className={styles.exercise__add_button}>
              <AddCircleIcon/>
            </IconButton>
          </Link>
        </div>

        <DisplayExercises
          exercises={filteredExercises}
          t={t}
        />
      </Paper>

       
    </Container>
  );
}


export default withReducer([{key:'exercises',reducer: ExerciseReducer},{key:'feedbacks', reducer: feedbackReducer}])(ExerciseList)