import React, { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { getAllSequencesAction } from "../../store/actions";
import { sequencesSelector } from "../../store/selectors/sequenceSelector";
import { ISequence } from "../../store/types/sequence.types";
import {
  copySequenceAction,
  deleteSequenceAction,
} from "../../store/actions/sequence.actions";

//MATERIAL-UI IMPORTS
import Table from "@material-ui/core/Table";
import TableBody from "@material-ui/core/TableBody";
import TableCell from "@material-ui/core/TableCell";
import TableContainer from "@material-ui/core/TableContainer";
import TableRow from "@material-ui/core/TableRow";
import IconButton from "@material-ui/core/IconButton";
import DeleteIcon from "@material-ui/icons/Delete";
import {
  Button,
  Container,
  Typography,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  TextField,
  Paper,
  TablePagination,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Checkbox,
} from "@material-ui/core";
import { FindInPage, AddCircle, FileCopy } from "@material-ui/icons";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";

import { SequenceReducer } from "../../store/reducers/sequenceReducer";
import withReducer from "../../store/withReducer";
import { EnhancedTableHead, getComparator, HeadCell, Order, stableSort } from "../common/EnhancedTableHead";
import styles from './SequenceList.module.css'
import { connectedUserSelector } from "../../store/selectors";

/**
 * React component that displays a sequence list item.
 * @param param0 Received props : the sequence to display on this row, the function called on delete, the function called on copy
 * @returns A table row React component that displays a sequence
 */
function SequenceListItem({
  sequence,
  handleDelete,
  handleCopy,
}: {
  sequence: any;
  handleDelete: (sequenceId: number) => void;
  handleCopy: (sequence: ISequence) => void;
}) {

  const connectedUser = useSelector(connectedUserSelector)

  const isAuthor = (sequenceAuthor : any) => {
    if(!connectedUser) return false
    if(connectedUser.role_id === 1) return true
    return sequenceAuthor.user_id === connectedUser.user_id
  }

  return (
    <TableRow data-cy="sequence-list-item" key={sequence.sequence_id} className="sequenceListRow row">
      <TableCell className="cell">{sequence.sequence_id}</TableCell>
      <TableCell className="cell">{sequence.description}</TableCell>
      <TableCell className="cell">{sequence.author.firstname + " " + sequence.author.lastname}</TableCell>
      <TableCell className="cell">{sequence.exercises.length}</TableCell>
      <TableCell className="cell">
        <IconButton area-label="copy" className="copySequenceButton" onClick={() => handleCopy(sequence)}>
          <FileCopy className="icon" />
        </IconButton>
        <Link to={`./sequence/${sequence.sequence_id}`}>
          <IconButton area-label="details" className="findOneSequenceButton">
            <FindInPage className="icon" />
          </IconButton>
        </Link>
        {
          isAuthor(sequence.author) ?
            <IconButton
              area-label="delete"
              color="secondary"
              onClick={() => handleDelete(sequence.sequence_id)}
            >
              <DeleteIcon className="icon" />
            </IconButton>
          :
          ""
        }
        
      </TableCell>
    </TableRow>
  );
}



/**
 * React component that displays a list of sequences
 * @param param0 received props : the sequences to display, the function called on delete of a sequence and the function called on copy of a sequence
 * @returns A Table React component displaying the given sequences
 */
function SequenceListComponent({
  sequences,
  handleDelete,
  handleCopy,
}: {
  sequences: ISequence[];
  handleDelete: (sequenceId: number) => void;
  handleCopy: (sequence: ISequence, doCopyExercises : boolean) => void;
}) {
  //i18n TRANSLATION FUNCTION
  const { t } = useTranslation();


  const heads : readonly HeadCell[] = [
    {
      id: "sequence_id",
      label: "Id",
      sortable: true,
      disablePadding: false,
      numeric:true
    },
    {
      id: "description",
      label: t("DESCRIPTION"),
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
      id: "exercises",
      label: "#"+t("EXERCISES"),
      sortable: true,
      disablePadding:false,
      numeric: true
    },
    {
      id: "ACTIONS",
      label: t("ACTIONS"),
      disablePadding: true,
      numeric: false,
      sortable: false
    }
  ]

  //LOCAL STATES
  const [open, setOpen] = useState(false); //Used to manage openning and closing of a dialog box
  const [currentSequence, setCurrentSequence] = useState<ISequence>(); //Used to pass information to the dialog box

  //DIALOG BOX OPENNING AND CLOSING FUNCTIONS
  const handleDialogBoxClosing = () => {
    setOpen(false);
    if (currentSequence) {
      let seq = sequences.find((seq) => seq.sequence_id === currentSequence.sequence_id);
      setCurrentSequence({
        ...currentSequence,
        description: seq?.description || currentSequence.description,
      });
    }
  };

  const handleDialogBoxOpenning = (sequence: ISequence) => {
    let seq = { ...sequence };
    seq.description = "copy of " + sequence.description;
    setCurrentSequence(seq);
    setOpen(true);
  };

  const [order, setOrder] = useState<Order>('asc');
  const [orderBy, setOrderBy] = useState('sequence_id');


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

  const [columnFilter, setColumnFilter] = useState("");
  const [filter, setFilter] = useState("");
  const [filteredSequences, setFilteredSequences] = useState<ISequence[]>([])

  useEffect( () => {
    setFilteredSequences(sequences)
  }, [sequences])

  useEffect( () => {
    setFilteredSequences(sequences.filter( ( sequence ) => {
      if(columnFilter === "exercises"){
        return ((sequence[columnFilter as keyof ISequence] as any[]).length+"").toLowerCase().includes(filter.toLowerCase())
      }else{
        return (sequence[columnFilter as keyof ISequence]+"").toLowerCase().includes(filter.toLowerCase())
      }
    }))
  }, [columnFilter, filter, sequences])



  return (
    <Container className="mainContainer">
      {currentSequence ? (
        <CopySequencesDialogBox
          sequence={currentSequence}
          setSequence={setCurrentSequence}
          open={open}
          onClose={handleDialogBoxClosing}
          onCopy={handleCopy}
        />
      ) : null}
      <Typography
        variant="h3"
        component="h1"
        color="primary"
        className="title"
      >
        {t("SEQUENCE_LIST")}
      </Typography>
      <Paper >
      <div className={styles.header}>
          <div>
            <FormControl style={{width:"100%"}}>
              <InputLabel>{t("COLUMN")}</InputLabel>
              <Select
                value={columnFilter}
                label={t("COLUMN")}
                onChange={(e) => setColumnFilter(e.target.value as string)}
              >
                <MenuItem value="sequence_id">{t("ID")}</MenuItem>
                <MenuItem value="description">{t("DESCRIPTION")}</MenuItem>
                <MenuItem value="exercises">{"#"+t("EXERCISES")}</MenuItem>
              </Select>
            </FormControl>
            <TextField 
              disabled={columnFilter === ""}
              label={t("FILTER")}
              value={filter}
              onChange={(e) => setFilter(e.target.value as string)}
            />
            
          </div>
        <Link to={"/sequence/create"}>
          <IconButton data-cy="sequence-create-button" area-label="details">
            <AddCircle className="icon" />
          </IconButton>
        </Link>
        </div>
        <div data-cy="sequence-list">
        {
          filteredSequences.length !== 0 ?
          <React.Fragment>
            <TableContainer className="tableContainer">
              <Table aria-label="a dense table" className="table">
                <EnhancedTableHead 
                  onRequestSort={handleRequestSort}
                  order={order}
                  orderBy={orderBy}
                  headCells={heads}
                  shiftRight={false}
                />
                <TableBody>
                  {stableSort<ISequence>(filteredSequences, getComparator(order, orderBy)).slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage).map(
                    (sequence: ISequence): JSX.Element => (
                      <SequenceListItem
                        key={sequence.sequence_id}
                        sequence={sequence}
                        handleDelete={handleDelete}
                        handleCopy={handleDialogBoxOpenning}
                      />
                    )
                  )}
                </TableBody>
              </Table>
            </TableContainer>
            <TablePagination 
              rowsPerPageOptions={[10,25,100]}
              component="div"
              count={filteredSequences.length}
              rowsPerPage={rowsPerPage}
              page={page}
              onPageChange={handleChangePage}
              onRowsPerPageChange={handleChangeRowsPerPage}
              labelRowsPerPage={t("ROWS_PER_PAGE")}
              labelDisplayedRows={({from, to, count}) => `${from}-${to} ${t("OF")} ${count!== -1 ? count : `${t("MORE_THAN")} ${to}`}`}
            />
          </React.Fragment>
          :
          "There is no sequence yet!"
        }
        </div>
      </Paper>
      
    </Container>
  );
}

/**
 * A React component linked to the store. It retrieves all the sequences and displays a list
 * @returns A React component that displays a list of all the sequences
 */
function SequenceList() {
  //REDUX STORE FUNCTIONS
  const dispatch = useDispatch();

  const sequences = useSelector(sequencesSelector);

  useEffect(() => {
    dispatch(getAllSequencesAction());
  }, [dispatch]);

  //Called upon delete of a sequence
  const handleDelete = (sequenceId: number) => {
    dispatch(deleteSequenceAction(sequenceId));
  };

  //Called upon copy of a sequence
  const handleCopy = (sequence: ISequence, doCopyExercises : boolean) => {
    dispatch(copySequenceAction(sequence, doCopyExercises));
  };

  return (
    <React.Fragment>
      <SequenceListComponent
        sequences={sequences}
        handleDelete={handleDelete}
        handleCopy={handleCopy}
      />
    </React.Fragment>

  );
}

export default withReducer([{key:'sequences',reducer: SequenceReducer}])(SequenceList)

/**
 *
 * @param param0 the sequence to copy must be a local state of the calling react component it must have a setter, open is the boolean that determines if the dialog box is openned or closed, and the functions are called respectively on close (of the dialog box) and on copy of the sequence
 * @returns A React Dialog Box component that allow the user to copy a sequence
 */
function CopySequencesDialogBox({
  sequence,
  setSequence,
  open,
  onClose,
  onCopy,
}: {
  sequence: ISequence;
  setSequence: (sequence: ISequence) => void;
  open: boolean;
  onClose: () => void;
  onCopy: (sequence: ISequence, doCopyExercises : boolean) => void;
}) {
  //i18n TRANSLATION FUNCTION
  const { t } = useTranslation();

  //Handles input text changes
  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSequence({ ...sequence, description: event.target.value });
  };

  const [copyExercises, setCopyExercises] = useState(false)

  if (sequence) {
    return (
      <Dialog
        data-cy="sequence-copy-dialog"
        open={open}
        onClose={onClose}
        aria-labelledby="sequence-copy-dialog-title"
        aria-describedby="sequence-copy-dialog-description"
      >
        <DialogTitle id="sequence-copy-dialog-title">Copy sequence</DialogTitle>
        <DialogContent>
          <DialogContentText id="sequence-copy-dialog-description">
            Do you really want to copy the following sequence ?
          </DialogContentText>
          <div>
            <p>
              <b>{t("SEQ_ID")}:</b> {sequence.sequence_id}
            </p>
            <p>
              <b>{t("DESCRIPTION")}:</b> {sequence.description}
            </p>
            <div className="DialogBoxInputText">
              <TextField
                id="outlined-basic"
                label="Copied sequence description"
                variant="outlined"
                InputLabelProps={{ shrink: true }}
                value={sequence.description || ""}
                onChange={handleInputChange}
                fullWidth={true}
                className="description-input"
              />
            </div>
          </div>
          <Checkbox checked={copyExercises} onChange={ (event) => setCopyExercises(!copyExercises)} /> Copy exercises ?
        </DialogContent>
        <DialogActions>
          <Button
            data-cy="sequence-copy-close-button"
            variant="contained"
            onClick={onClose}
            autoFocus
            className="session-list-primary-button"
          >
            {t("CANCEL")}
          </Button>
          <Button
            variant="contained"
            onClick={() => {
              onCopy(sequence, copyExercises);
              onClose();
            }}
            autoFocus
            className="session-list-primary-button"
          >
            {t("CONFIRM")}
          </Button>
        </DialogActions>
      </Dialog>
    );
  } else {
    return null;
  }
}
