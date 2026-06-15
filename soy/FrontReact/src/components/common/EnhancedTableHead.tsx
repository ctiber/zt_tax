import { makeStyles, TableCell, TableHead, TableRow, TableSortLabel } from "@material-ui/core";

export type Order = 'asc' | 'desc';
interface EnhancedTableProps{
  onRequestSort: (event: React.MouseEvent<unknown>, property: any) => void;
  order: Order;
  orderBy: string;
  headCells: readonly HeadCell[];
  shiftRight: boolean;
}


export interface HeadCell {
  disablePadding: boolean;
  label: string;
  id: string;
  numeric: boolean;
  sortable: boolean;
}

const useStyles = makeStyles((theme) => ({
  visuallyHidden: {
    border: 0,
    clip: 'rect(0 0 0 0)',
    height: 1,
    margin: -1,
    overflow: 'hidden',
    padding: 0,
    position: 'absolute',
    top: 20,
    width: 1,
  },
}));


export function EnhancedTableHead(props: EnhancedTableProps) {
  const classes = useStyles()

  const { order, orderBy, onRequestSort, headCells, shiftRight} = props;

  const createSortHandler = (property: any) => (event: React.MouseEvent<unknown>) => {
    onRequestSort(event, property);
  };

  return (
    <TableHead>
      <TableRow className="row">
        {
          shiftRight? 
            <TableCell className="cell" />
          :
            ""
        }
        {
          headCells.map( (headCell) => (
            <TableCell 
              key={headCell.id} 
              className="cell"
              padding={headCell.disablePadding ? 'none' : 'normal'}
            >
              {
                headCell.sortable ?
                <TableSortLabel
                  active={orderBy === headCell.id}
                  direction={orderBy === headCell.id ? order : 'asc'}
                  onClick={createSortHandler(headCell.id)}
                >
                  {headCell.label}
                  {
                    orderBy === headCell.id && (
                      <span className={classes.visuallyHidden}>
                    {order === 'desc' ? 'sorted descending' : 'sorted ascending'}
                  </span>
                    )
                  }
                </TableSortLabel>
                :
                headCell.label
              }
              
            </TableCell>
          ))
        }
      </TableRow>
    </TableHead>
  )
}

export function descendingComparator<T>(a: T, b: T, orderBy: keyof T) {
  let compareA
  let compareB
  if(orderBy === "author"){
    compareA = (a[orderBy] as any)["firstname"] + (a[orderBy] as any)["lastname"]
    compareB = (b[orderBy] as any)["firstname"] + (b[orderBy] as any)["lastname"]
  }
  else if(orderBy === "role"){
    compareA = (a[orderBy] as any)["role_id"]
    compareB = (b[orderBy] as any)["role_id"]
  }
  else{
    compareA = a[orderBy]
    compareB = b[orderBy]
  }

  if (compareB < compareA) {
    return -1;
  }
  if (compareB > compareA) {
    return 1;
  }
  return 0;
}

export function getComparator<Key extends keyof any>(
  order: Order,
  orderBy: Key,
): (a: { [key in Key]: any }, b: { [key in Key]: any }) => number {
  return order === 'desc'
    ? (a, b) => descendingComparator(a, b, orderBy)
    : (a, b) => -descendingComparator(a, b, orderBy);
}

export function stableSort<T>(array: T[], comparator: (a: T, b: T) => number) {
  const stabilizedThis = array.map((el, index) => [el, index] as [T, number]);
  stabilizedThis.sort((a, b) => {
    const order = comparator(a[0], b[0]);
    if (order !== 0) return order;
    return a[1] - b[1];
  });
  return stabilizedThis.map((el) => el[0]);
}