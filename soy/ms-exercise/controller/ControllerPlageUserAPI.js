const debug = require("debug")("ControllerPlageUserAPI");
const ModelPlageUser = require("../model/ModelPlageUser");
const jwt = require("jsonwebtoken");
const ModelDB = require("../model/ModelDB");
const tokenList = {};

module.exports.tokenList = tokenList

module.exports.readAll = async function (req, res) {
  debug("Read all users with their roles");
  const users = await ModelPlageUser.getAllUsers();
  const roles = await ModelPlageUser.getAllRoles();

  if (users) {
    for (i = 0; i < users.length; i++) {
      for (j = 0; j < roles.length; j++) {
        if (users[i].role_id === roles[j].role_id) {
          users[i].role = roles[j];
          delete users[i].role_id;
          delete users[i].name;
        }
      }
    }
    res.status(200).json(users);
  } else {
    res.status(500).end();
  }
};

module.exports.getSkills = async function (req, res) {
  debug("Get user skills")
  let user_id = req.params.userId
  let locale = req.i18n.getLocale()
  
  let skills = await ModelPlageUser.getSkills(user_id, locale)
  
  if(skills){
    res.set("Cache-control", "private, max-age=600000")
    res.status(200).json(skills)
  } else {
    res.status(404).end()
  }
}

module.exports.read = async function (req, res) {
  debug("Read a user");
  const user = await ModelPlageUser.read(req.params.userId);
  if (user) {
    delete user.nonce;
    delete user.salt;
    res.status(200).json(user);
  } else {
    res.status(500).end();
  }
};

module.exports.update = async function (req, res) {
  debug("Update a user");

  if (!req.body) {

    //Invalid request
    res.status(400).end();
  } else {

    //Check if userId is right
    const currentUser = await ModelPlageUser.read(req.params.userId);

  

    if (currentUser) {
      const data = {
        user_id: req.params.userId,
        lastname: req.body.lastname,
        firstname: req.body.firstname,
        tdgroup: req.body.tdgroup,
        email: req.body.email,
        enabled: req.body.enabled,
        role_id: req.body.role_id,
        avatar: req.body.avatar,
        password: currentUser.password,
        organization: req.body.organization,
        country: req.body.country,
        locale: req.body.locale,
        student_number: req.body.student_number,
        salt: currentUser.salt,
        nonce: currentUser.nonce
      };
      const user = new ModelPlageUser(data);
      const success = await user.update();
      if (success) {

        //Get the updated User
        const newUser = await ModelPlageUser.read(req.params.userId);
        const roles = await ModelPlageUser.getAllRoles();
        for (let i = 0; i < roles.length; i++) {
          if (newUser.role_id === roles[i].role_id) {
            newUser.role = roles[i];
            delete newUser.role_id;
            delete newUser.name;
          }
        }

        //Return the updated User
        res.status(200).json(newUser);
      } else {
        res.status(500).end();
      }
    } else {
      res.status(404).end();
    }
  }
};

module.exports.updateProfile = async function (req, res) {
  debug("Update user's profile");

  if (!req.body) {

    //Invalid request
    res.status(400).end();
  } else {

    //Check if userId is right
    const currentUser = await ModelPlageUser.read(req.params.userId);

    let passData = undefined;
    if (req.body.password !== undefined) {
      passData = await ModelPlageUser.saltPepperHashPassword(req.body.password);
    }
    if (currentUser) {
      const data = {
        user_id: req.params.userId,
        lastname: req.body.lastname,
        firstname: req.body.firstname,
        tdgroup: req.body.tdgroup,
        email: req.body.email,
        avatar: req.body.avatar,
        password: passData ? passData.passwordHash : undefined,
        organization: req.body.organization,
        country: req.body.country,
        locale: req.body.locale,
        student_number: req.body.student_number
      };
      const user = new ModelPlageUser(data);
      const success = await user.update();
      if (success) {

        //Get the updated User
        const newUser = await ModelPlageUser.read(req.params.userId);

        //Return the updated User
        res.status(200).json(newUser);
      } else {
        res.status(500).end();
      }
    } else {
      res.status(404).end();
    }
  }
};

module.exports.verify = async function (req, res) {
  console.debug("Verifying token");
  let foundRefresh = false;
  if (req.headers.cookie) {
    const cookies = req.headers.cookie.split(";");
    cookies.forEach(async (cookie) => {
      const cookieArray = cookie.split("=");
      let key;
      if (cookieArray[0][0] === " ") {
        key = cookieArray[0].substring(1);
      } else {
        key = cookieArray[0];
      }
      if (key === "refresh_token") {
        foundRefresh = true;
        const refresh_token = cookieArray[1];
        try {
          const decoded = jwt.verify(refresh_token, process.env.SECRET_JWT);
          const resp = await ModelPlageUser.getUserByEmailId(decoded.email);
          const data = {
            user_id: resp.user_id,
            email: resp.email,
            lastname: resp.lastname,
            firstname: resp.firstname,
            locale: resp.locale,
            role_id: resp.role_id
          };
          let access_token_expiration = process.env.ACCESS_TOKEN_DURATION || "300000"
          const token = jwt.sign(data, process.env.SECRET_JWT, { expiresIn: access_token_expiration });
          tokenList[refresh_token] = { access_token: token, refresh_token: refresh_token };
          res.cookie("access_token", token, { maxAge: access_token_expiration, httpOnly: true, SameSite: "Strict" }).status(200).json(data);
        } catch (err) {
          res.status(401).json(err);
        }
      }
    });
  }
  if (!foundRefresh) {
    res.status(401).send("Unauthenticated");
  }
};
