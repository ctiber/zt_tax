import { Container, Paper } from '@material-ui/core'
import { useEffect, useState } from 'react'
import http from '../../http-common'
import styles from './Help.module.css'

export const Help = () => {


  const [body, setBody] = useState("")
  useEffect( () => {
    if(body === ""){
      http.get("/api/help/list")
      .then( (res) => {
        setBody(res.data)
      })
    }
  }, [body])

  if(body) return (
    <Container>
      <Paper className={styles.help_paper}>
        <div dangerouslySetInnerHTML={{__html: body}}></div>
      </Paper>
    </Container>
  )
  return null;
}