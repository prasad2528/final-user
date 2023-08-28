const express = require("express");
const path = require("path");
const jwt = require("jsonwebtoken");
const app = express();
app.use(express.json());
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const bcrypt = require("bcrypt");
const dbPath = path.join(__dirname, "covid19IndiaPortal.db");
let db = null;
const intializeDbAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("Server Running At http://localhost:3000/");
    });
  } catch (e) {
    console.log(`DB Error:${e.message}`);
    process.exit(1);
  }
};
intializeDbAndServer();
const convertToCamelcase = (dbObject) => {
  return {
    stateId: dbObject.state_id,
    stateName: dbObject.state_name,
    population: dbObject.population,
  };
};
const convertToCamelcaseDistrict = (dbObject) => {
  return {
    districtId: dbObject.district_id,
    districtName: dbObject.district_name,
    stateId: dbObject.state_id,
    cases: dbObject.cases,
    cured: dbObject.cured,
    active: dbObject.active,
    deaths: dbObject.deaths,
  };
};
const authenticateToken = (request, response, next) => {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "it_is_my_token", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        next();
      }
    });
  }
};
app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const loginAUser = `SELECT * FROM user WHERE username = '${username}';`;
  const dbUser = await db.get(loginAUser);
  if (dbUser === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const isPasswordMatched = await bcrypt.compare(password, dbUser.password);
    if (isPasswordMatched) {
      const payload = { username: username };
      const jwtToken = jwt.sign(payload, "it_is_my_token");
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});
module.exports = app;
app.get("/states/", authenticateToken, async (request, response) => {
  const getStates = `SELECT * FROM state;`;
  const dbResponse = await db.all(getStates);
  response.send(dbResponse.map((each) => convertToCamelcase(each)));
});
app.get("/states/:stateId/", authenticateToken, async (request, response) => {
  const { stateId } = request.params;
  const getStates = `SELECT * FROM state WHERE state_id = ${stateId};`;
  const dbResponse = await db.get(getStates);
  response.send(convertToCamelcase(dbResponse));
});
app.post("/districts/", authenticateToken, async (request, response) => {
  const { districtName, stateId, cases, cured, active, deaths } = request.body;
  const craeteADistrict = `
    INSERT INTO
      district (district_name,state_id,cases,cured,active,deaths)
    VALUES
        (
           '${districtName}',
           ${stateId},
           ${cases},
           ${cured},
           ${active},
           ${deaths}
        );`;
  const dbResponse = await db.run(craeteADistrict);
  response.send("District Successfully Added");
});
app.get(
  "/districts/:districtId",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const getADistrict = `
    SELECT *
    FROM district
    WHERE district_id = ${districtId};`;
    const dbResponse = await db.get(getADistrict);
    response.send(convertToCamelcaseDistrict(dbResponse));
  }
);
app.delete(
  "/districts/:districtId",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const deleteADistrict = `DELETE FROM district WHERE district_id = ${districtId};`;
    await db.run(deleteADistrict);
    response.send("District Removed");
  }
);
app.put(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const {
      districtName,
      stateId,
      cases,
      cured,
      active,
      deaths,
    } = request.body;
    const updateADistrict = `
    UPDATE
       district
    SET
       district_name= '${districtName}',
       state_id = ${stateId},
       cases = ${cases},
       cured = ${cured},
       active = ${active},
       deaths = ${deaths};`;
    await db.run(updateADistrict);
    response.send("District Details Updated");
  }
);
app.get(
  "/states/:stateId/stats/",
  authenticateToken,
  async (request, response) => {
    const { stateId } = request.params;
    const { cases, cured, active, deaths } = request.body;
    const getAStats = `
    SELECT
       SUM(cases) AS totalCases,
       SUM(cured) AS totalCured,
       SUM(active) AS totalActive,
       SUM(deaths) AS totalDeaths
    FROM district
    WHERE state_id = ${stateId};`;
    const dbResponse = await db.get(getAStats);
    response.send(dbResponse);
  }
);
