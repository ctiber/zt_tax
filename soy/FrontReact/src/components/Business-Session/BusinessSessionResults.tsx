import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { BusinessSessionResultsExerciseItem } from "./BusinessSessionResultsExerciseItem";

import {
    CircularProgress,
    Container, Grid, Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow, Typography
} from "@material-ui/core";
import Paper from "@material-ui/core/Paper";
import { Alert } from "@material-ui/lab";
import {
    BarController,
    BarElement,
    CategoryScale, Chart as ChartJS, ChartData, Legend, LinearScale, LineElement, PointElement, Title,
    Tooltip
} from "chart.js";
import { Bar, Line } from "react-chartjs-2";
import { useTranslation } from "react-i18next";
import { useParams } from "react-router-dom";
import http from '../../http-common';
import { clearCurrentBusinessSessionStats as clearCurrentBusinessSessionStatsAction, getBusinessSessionStats as getBusinessSessionStatsAction } from "../../store/actions";
import { BusinessSessionReducer } from "../../store/reducers/businessSessionReducer";
import { getCurrentBusinessSessionStatsSelector } from "../../store/selectors/businessSessionSelector";
import { IBusinessSessionResultsExercise } from "../../store/types";
import withReducer from "../../store/withReducer";


ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    BarController,
    BarElement,
    Title,
    Tooltip,
    Legend
);

function DisplayExercises({
    exercises,
    t,
}: {
    exercises: IBusinessSessionResultsExercise[];
    t: any;
}) {
    return (
        <div className="table__container">
            <TableContainer>
                <Table aria-label="collapsible table">
                    <TableHead>
                        <TableRow className="row">
                            <TableCell className="cell" />
                            <TableCell className="cell"> {t("ID")} </TableCell>
                            <TableCell className="cell"> {t("NAME")} </TableCell>
                            <TableCell className="cell"> Min </TableCell>
                            <TableCell className="cell"> Max </TableCell>
                            <TableCell className="cell"> Avg </TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody className="exercise-body">
                        {exercises.map((exercise, index) => (
                            <BusinessSessionResultsExerciseItem
                                exercise={exercise}
                                index={index}
                                key={exercise.ex_id}
                            ></BusinessSessionResultsExerciseItem>
                        ))}
                    </TableBody>
                </Table>
            </TableContainer>
        </div>
    );
}


interface ParamType {
    sessionId: string;
}

function BusinessSessionResults() {
    const { sessionId } = useParams<ParamType>();
    const id: number = +sessionId;

    const { t } = useTranslation()

    const dispatch = useDispatch()

    useEffect(() => {
        dispatch(getBusinessSessionStatsAction(id))
        return () => {
            dispatch(clearCurrentBusinessSessionStatsAction)
        }
    }, [dispatch, id])

    const results = useSelector(getCurrentBusinessSessionStatsSelector);

    useEffect(() => {
        if (results) {
            let exercise_names = []
            let min = []
            let max = []
            let avg = []
            let retriesAvg = []
            let retriesMax = []
            let retriesMin = []

            for (let i = 0; i < results.exercises.length; i++) {
                const exercise = results.exercises[i];
                exercise_names.push(exercise.name)
                min.push(Number(exercise.stats.min))
                max.push(Number(exercise.stats.max))
                avg.push(Number(exercise.stats.round))
                let nb_retries = Object.values(exercise.user_productions).map(u => u.productions.length)
                retriesAvg.push(nb_retries.reduce((a, b) => a + b, 0) / nb_retries.length || 0)
                retriesMin.push(Math.min(...nb_retries))
                retriesMax.push(Math.max(...nb_retries))
            }

            setRetriesData({
                labels: exercise_names,
                datasets: [
                    {
                        label: "Min #trials",
                        data: retriesMin,
                        backgroundColor: "red",
                        borderColor: "red"
                    },
                    {
                        label: "Avge #trials",
                        data: retriesAvg,
                        backgroundColor: "blue",
                        borderColor: "blue"
                    },
                    {
                        label: "Max #trials",
                        data: retriesMax,
                        backgroundColor: "green",
                        borderColor: "green"
                    }
                ]
            })

            setScoreData({
                labels: exercise_names,
                datasets: [
                    {
                        label: "Min score",
                        data: min,
                        borderColor: "red",
                        backgroundColor: "red"
                    },
                    {
                        label: "Avg score",
                        data: avg,
                        borderColor: "blue",
                        backgroundColor: "blue"
                    },
                    {
                        label: "Max score",
                        data: max,
                        borderColor: "green",
                        backgroundColor: "green"
                    }
                ]
            })
        }
    }, [results])

    const [scoreData, setScoreData] = useState<ChartData<"line">>({ labels: [], datasets: [] })
    const [retriesData, setRetriesData] = useState<ChartData<"bar">>({ labels: [], datasets: [] })
    const [numberRegistered, setNumberRegistered] = useState(undefined)

    useEffect( () => {
        http.get("/api/business-session/"+id+"/registered")
        .then( (res) => {
            setNumberRegistered(res.data)
        })
    }, [id])
    

    if (results) {
        if (results.exercises.length > 0) {

            const scoreChartOptions = {
                responsive: true,
                plugins: {
                    legend: {
                        position: 'top' as const,
                    },
                    title: {
                        display: true,
                        text: t("SESSION_RESULTS_SCORE_CHART"),
                    },
                },
            };

            const retriesChartOptions = {
                responsive: true,
                plugins: {
                    legend: {
                        position: 'top' as const,
                    },
                    title: {
                        display: true,
                        text: t("SESSION_RESULTS_RETRIES_CHART"),
                    },
                },
            };

            

            return (
                <Container>
                    <Typography variant="h3" component="h1" color="primary" className="title">
                        {t("BUSINESS_SESSION_EXERCISES_STATS")}
                    </Typography>
                    <Paper className="exercise__little-header">
                        <div>
                            {t("NUMBER_STUDENTS_REGISTERED")}: {numberRegistered ? numberRegistered : t("CALCULATING")+"..."}
                        </div>
                        <Grid container alignItems="stretch" spacing={2}>
                            <Grid item xs={12} md={6}>
                                <p>
                                    <Alert severity="info">{t("INFO_SCORE_CHART")}</Alert>
                                </p>
                                <Line options={scoreChartOptions} data={scoreData}></Line>
                            </Grid>
                            <Grid item xs={12} md={6}>
                                <p>
                                    <Alert severity="info">{t("INFO_RETRIES_CHART")}</Alert>
                                </p>
                                <Bar options={retriesChartOptions} data={retriesData}></Bar>
                            </Grid>
                        </Grid>
                        <DisplayExercises
                            exercises={results.exercises}
                            t={t}
                        />
                    </Paper>
                </Container>
            );
        } else {
            return (
                <Container>
                    <Paper className="exercise__little-header" style={{ color: "white", textAlign: "center" }}>
                        {t("NO_RESULTS_YET")}
                    </Paper>
                </Container>
            )
        }
    } else {
        return (
            <CircularProgress color="secondary" />
        )
    }
}

export default withReducer([
    {key: 'businessSessions', reducer: BusinessSessionReducer}
])(BusinessSessionResults)
