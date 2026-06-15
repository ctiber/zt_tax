import {
    Box, Collapse,
    Grid,
    IconButton,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableRow,
    Typography
} from "@material-ui/core";
import KeyboardArrowDownIcon from "@material-ui/icons/KeyboardArrowDown";
import KeyboardArrowUpIcon from "@material-ui/icons/KeyboardArrowUp";
import React, { useEffect, useState } from "react";
import { Bar, Line } from "react-chartjs-2";
import { useTranslation } from "react-i18next";
import { useDispatch } from "react-redux";
import { useHistory } from "react-router-dom";
import i18n from "../../i18n";
import { IBusinessSessionResultsExercise, IBusinessSessionResultsExerciseProduction } from "../../store/types";
import styles from "./BusinessSessionResultsExerciseItem.module.css";

export const getLanguage = () => {
    return i18n.language;
};

export function DisplayExerciseProductionsItem({
    user_production,
    t,
}: {
    user_production: IBusinessSessionResultsExerciseProduction;
    t: any;
}) {
    const [expanded, setExpanded] = useState(false);

    

    const retriesChartOptions = {
        responsive: true,
        plugins: {
            legend: {
                position: 'top' as const,
            },
            title: {
                display: true,
                text: t("STUDENT_RESULTS_RETRIES_CHART"),
            },
        },
    };

    const studentsScoreData = {
        labels: Array.from(Array(user_production.productions.length).keys()).map(v => `Submission ${v+1}`),
        datasets: [
            {
                label: "Score's evolution",
                data: Object.values(user_production.productions.map(v => v.score)),
                backgroundColor: "blue",
                borderColor: "blue"
            }
        ]
    }

    return (
        <React.Fragment>
            <TableRow className="row">
                <TableCell className="cell">
                    <IconButton
                        aria-label="expand row"
                        size="small"
                        onClick={() => setExpanded(!expanded)}
                    >
                        {expanded ? (
                            <KeyboardArrowUpIcon />
                        ) : (
                            <KeyboardArrowDownIcon />
                        )}
                    </IconButton>
                </TableCell>
                <TableCell className="cell" component="th" scope="row">            
                    {user_production.user.firstname} {user_production.user.lastname}
                </TableCell>
                <TableCell className="cell" component="th" scope="row">
                    {user_production.stats.min}
                </TableCell>
                <TableCell className="cell" component="th" scope="row">
                    {user_production.stats.max}
                </TableCell>
                <TableCell className="cell" component="th" scope="row">
                    {user_production.stats.round}
                </TableCell>
            </TableRow>
            <TableRow className={"row "+styles.exerciseStudentProductionTable}>
                <TableCell className="cell" style={{ paddingBottom: 0, paddingTop: 0 }} colSpan={6}>
                    <Collapse in={expanded} timeout="auto" unmountOnExit>
                        <Box margin={1}>
                            <Grid container alignItems="center" justify="center" spacing={0}>
                                <Grid item xs={12} md={6}>
                                    <Line options={retriesChartOptions} data={studentsScoreData}></Line>
                                </Grid>
                            </Grid>
                            <Typography variant="h6" gutterBottom component="div">
                                {t("STUDENT_EXERCISE_PRODUCTIONS")}
                            </Typography>
                            <Table className="table" aria-label="simple table">
                                <TableHead>
                                    <TableRow className="row">
                                        <TableCell className="cell">ID</TableCell>
                                        <TableCell className="cell">Score</TableCell>
                                        <TableCell className="cell">Date</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {user_production.productions.map((production) => (
                                        <React.Fragment>
                                            <TableRow className="row">
                                                <TableCell className="cell" component="th" scope="row">            
                                                    {production.ep_id}
                                                </TableCell>
                                                <TableCell className="cell" component="th" scope="row">            
                                                    {production.score}
                                                </TableCell>
                                                <TableCell className="cell" component="th" scope="row">            
                                                    {new Date(production.submission_date).toLocaleDateString()}
                                                </TableCell>
                                            </TableRow>
                                            <TableRow className="row">
                                                <TableCell className="cell" style={{ paddingBottom: 0, paddingTop: 0 }} colSpan={6}>
                                                    <Collapse in={expanded} timeout="auto" unmountOnExit>
                                                        <Box margin={1}>
                                                        </Box>
                                                    </Collapse>
                                                </TableCell>
                                            </TableRow>
                                        </React.Fragment>
                                    ))}
                                </TableBody>
                            </Table>
                        </Box>
                    </Collapse>
                </TableCell>
            </TableRow>
        </React.Fragment>
    );
}

export function DisplayExerciseProductions({
    exercise,
    t,
}: {
    exercise: IBusinessSessionResultsExercise;
    t: any;
}) {
    return (
        <Table className="table" aria-label="simple table">
            <TableHead>
                <TableRow className="row">
                    <TableCell className="cell"></TableCell>
                    <TableCell className="cell">{t("NAME")}</TableCell>
                    <TableCell className="cell">Min</TableCell>
                    <TableCell className="cell">Max</TableCell>
                    <TableCell className="cell">Avg</TableCell>
                </TableRow>
            </TableHead>
            <TableBody>
                {Object.values(exercise.user_productions).map((user_production) => (
                    <DisplayExerciseProductionsItem
                        user_production={user_production}
                        t={t}
                    />
                ))}
            </TableBody>
        </Table>
    );
}

export function BusinessSessionResultsExerciseItem({
    exercise,
    index
}: {
    exercise: IBusinessSessionResultsExercise;
    index: number;
}) {
    const dispatch = useDispatch();

    const { t } = useTranslation();

    const [expanded, setExpanded] = useState(false);

    // const skills = useSelector(skillExerciseSelector);

    useEffect(() => {
        // dispatch(getSkillsForExercise(exercise.ex_id, getLanguage()));
    }, [dispatch]);

    const history = useHistory()

    const redirectDetail = (id: number) => {
        history.push('/exercise/' + id)
    }

    let nbStudentsPerScore: {[user_id: string]: number} = {}
    for (let i = 0; i < 21; i++) {
        nbStudentsPerScore[String(Math.round(i / 20 * 100))] = 0
    }

    for (const user_id in exercise.user_productions) {
        if (Object.prototype.hasOwnProperty.call(exercise.user_productions, user_id)) {
            const productions = exercise.user_productions[user_id];
            const bestScore = Math.floor(productions.stats.max / 5) * 5
            nbStudentsPerScore[String(bestScore)] += 1
        }
    }
    
    const studentsScoreData = {
        labels: Array.from(Array(21).keys()).map(v => v === 20 ? `${Math.round(v / 20 * 100)}` : `[${Math.round(v / 20 * 100)}; ${Math.round((v+1) / 20 * 100)}[`),
        datasets: [
            {
                label: "Number of students",
                data: Object.values(nbStudentsPerScore),
                backgroundColor: "blue",
                borderColor: "blue"
            }
        ]
    }

    const studentsScoreChartOptions = {
        responsive: true,
        scales: {
            y: {ticks: {color: "black"}},
            x: {ticks: {color: "black"}},
        },
        plugins: {
            legend: {
                labels: {color: "black"},
                position: 'top' as const,
            },
            title: {
                color: "black",
                display: true,
                text: t("EXERCISE_RESULTS_STUDENTS_SCORE_CHART"),

            },
        },
    };

    return (
        <React.Fragment>
            <TableRow className="row">
                <TableCell className="cell">
                    <IconButton
                        aria-label="expand row"
                        size="small"
                        onClick={() => setExpanded(!expanded)}
                    >
                        {expanded ? (
                            <KeyboardArrowUpIcon className="icon" />
                        ) : (
                            <KeyboardArrowDownIcon className="icon" />
                        )}
                    </IconButton>
                </TableCell>
                <TableCell onClick={() => { redirectDetail(exercise.ex_id) }} className={"cell "+styles.displayClickableIcon} component="th" scope="row">
                    {" "}
                    {exercise.ex_id}
                </TableCell>
                <TableCell onClick={() => { redirectDetail(exercise.ex_id) }} className={"cell "+styles.displayClickableIcon} component="th" scope="row">
                    {" "}
                    {exercise.name}
                </TableCell>
                <TableCell className="cell" component="th" scope="row">
                    {exercise.stats.min}
                </TableCell>
                <TableCell className="cell" component="th" scope="row">
                    {exercise.stats.max}
                </TableCell>
                <TableCell className="cell" component="th" scope="row">
                    {exercise.stats.round}
                </TableCell>
            </TableRow>
            <TableRow className={"row "+styles.exerciseStudentTable}>
                <TableCell className="cell" style={{ paddingBottom: 0, paddingTop: 0 }} colSpan={6}>
                    <Collapse in={expanded} timeout="auto" unmountOnExit>
                        <Box margin={1}>
                            <Grid container alignItems="center" justify="center" spacing={0}>
                                <Grid item xs={12} md={6}>
                                    <Bar options={studentsScoreChartOptions} data={studentsScoreData}></Bar>
                                </Grid>
                            </Grid>
                            <Typography variant="h6" gutterBottom component="div">
                                {t("STUDENTS")}
                            </Typography>
                            <DisplayExerciseProductions
                                exercise={exercise}
                                t={t}
                            />
                        </Box>
                    </Collapse>
                </TableCell>
            </TableRow>
        </React.Fragment>
    );
}  