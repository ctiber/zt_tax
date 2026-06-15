import IconButton from "@material-ui/core/IconButton";
import TableCell from "@material-ui/core/TableCell";
import TableRow from "@material-ui/core/TableRow";
import DeleteIcon from "@material-ui/icons/Delete";
import EditIcon from "@material-ui/icons/Edit";
import { useDispatch, useSelector } from "react-redux";
import { deleteSkillAction } from "./../../store/actions/skill.actions";
import { ISkill } from "./../../store/types/skill.types";

import { useTranslation } from "react-i18next";
import { connectedUserSelector } from "../../store/selectors";

function DisplaySkill({
  skill,
  setCurrentSkill,
  t,
  handleDelete,
  handleEditClick,
}: {
  skill: ISkill;
  setCurrentSkill: any;
  t: any;
  handleDelete: any;
  handleEditClick: any;
}) {
  const connectedUser = useSelector(connectedUserSelector);

  function isAdmin() {
    if (connectedUser && connectedUser.role_id === 1) {
      return true;
    } else {
      return false;
    }
  }

  if (setCurrentSkill === null) {
    return (
      <TableRow className="row" key={skill.skill_code}>
        <TableCell className="cell" component="th" scope="row">
          {skill.name}
        </TableCell>
        <TableCell className="cell" align="right">
          {skill.theme?.name}
        </TableCell>
        <TableCell className="cell" align="right">
          {skill.skill_code}
        </TableCell>
        <TableCell className="cell" align="right">
          {skill.locale}
        </TableCell>
      </TableRow>
    );
  } else {
    return (
      <TableRow className="row" key={skill.skill_code}>
        <TableCell className="cell" component="th" scope="row">
          {skill.name}
        </TableCell>
        <TableCell className="cell" align="right">
          {skill.theme?.name}
        </TableCell>
        <TableCell className="cell" align="right">
          {skill.skill_code}
        </TableCell>
        <TableCell className="cell" align="right">
          {skill.locale}
        </TableCell>
        {isAdmin() ? (
          <TableCell className="cell" align="right">
            <IconButton onClick={handleEditClick} aria-label="edit and save skill">
              <EditIcon className="icon" />
            </IconButton>
          </TableCell>
        ) : (
          " "
        )}
        {isAdmin() ? (
          <TableCell className="cell" align="right">
            <IconButton onClick={handleDelete} aria-label="delete skill">
              <DeleteIcon className="icon" />
            </IconButton>
          </TableCell>
        ) : (
          " "
        )}
      </TableRow>
    );
  }
}

export function SkillItem({
  skill,
  setCurrentSkill,
  setOpen,
  setEditMode,
}: {
  skill: ISkill;
  setCurrentSkill: (arg0: ISkill) => void;
  setOpen: (arg0: boolean) => void;
  setEditMode: (arg0: boolean) => void;
}) {
  const dispatch = useDispatch();

  /* ---- Function ---- */
  const handleDelete = () => {
    dispatch(deleteSkillAction(skill.skill_code));
  };

  const { t } = useTranslation();

  const handleEditClick = () => {
    setEditMode(true);
    setCurrentSkill(skill);
    setOpen(true);
  };

  return (
    <DisplaySkill
      skill={skill}
      setCurrentSkill={setCurrentSkill}
      t={t}
      handleDelete={handleDelete}
      handleEditClick={handleEditClick}
    />
  );
}
