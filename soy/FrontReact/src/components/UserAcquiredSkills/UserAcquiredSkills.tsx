import { Card, CardContent, Grid, makeStyles, Paper, Typography } from '@material-ui/core';
import { Star, StarBorder } from '@material-ui/icons';
import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';
import { getUserSkills } from '../../store/actions/user.actions';
import { connectedUserSelector, getUserSkillsSelector } from '../../store/selectors';


const useStyles = makeStyles({
  root: {
    minWidth: 275,
    color: "white",
    background: "#292929 !important",
    height: "100%",
  },
  bullet: {
    display: 'inline-block',
    margin: '0 2px',
    transform: 'scale(0.8)',
  },
  title: {
    color: "#05E205"
  },
  pos: {
    marginBottom: 12,
  },
});


export const UserAcquiredSkills = () => {
  const classes = useStyles();

  const { t } = useTranslation()

  const dispatch = useDispatch();

  const connectedUser = useSelector(connectedUserSelector)
  const nbStarsMax = 5

  useEffect(() => {
    if(connectedUser && connectedUser.user_id){
      dispatch(getUserSkills(connectedUser.user_id))
    }
  }, [dispatch, connectedUser])

  const userSkills = useSelector(getUserSkillsSelector);

  return (
    <React.Fragment>
      <Typography variant="h3" component="h1" color="primary" className="title">
        { t("ACQUIRED_SKILLS")}
      </Typography>
      <Paper className="userprofile-paper">
        <Grid container alignItems="stretch" spacing={3}>
        { userSkills.map((v) => (
          <Grid item xs={4}>
            <Card variant="outlined" className={classes.root}>
              <CardContent>
                <Typography variant="h5" component="h2" className={classes.title}>
                  { v.name } ({ v.skill_code })
                </Typography>
                <Typography className={classes.pos} color="textSecondary">
                  {[...Array(Math.min(v.exercises.length, nbStarsMax))].map(() => (
                    <Star style={{color: "gold"}}></Star>
                  ))}
                  {[...Array(nbStarsMax - Math.min(v.exercises.length, nbStarsMax))].map(() => (
                    <StarBorder></StarBorder>
                  ))}
                </Typography>
                <Typography variant="body2" component="p">
                  { t("EXERCISES_THAT_ACQUIRED_SKILLS") }
                  <ul>
                  { v.exercises.map((e) => (
                    <li><a href={"/exercise/" + e.ex_id}>{e.name}</a></li>
                  )) }
                  </ul>
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        )) }
        {
          userSkills.length === 0 && <p>{t("NO_SKILLS")}</p>
        }
        </Grid>
      </Paper>
    </React.Fragment>
  )
}