// Importing Third Party Package
const express = require('express')
const {open} = require('sqlite')
const path = require('path')
const sqlite3 = require('sqlite3')
const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')

// Express Instance
const app = express()
app.use(express.json())

// Storing Database Connection Promise Object
let db = null

// Getting Database File Current Path
const dbPath = path.join(__dirname, 'covid19IndiaPortal.db')

// Database Connetion and Server Initialization
const databaseConnection = async () => {
  // Exception Handling for Database Connection Errors
  try {
    // Database Connection
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    })
    // Assining Server Port Code
    app.listen(3000, () => {
      console.log(`Server Running Successfully at http://localhost:3000/`)
    })
  } catch (error) {
    console.log(`Database Connection Error: ${error.message}`)
    process.exit(1)
  }
}
databaseConnection()

// Middleware Function
const authenticationToken = (request, response, next) => {
  const authorizationHeader = request.headers['authorization']
  let jwtToken
  if (authorizationHeader !== undefined) {
    jwtToken = authorizationHeader.split(' ')[1]
  }
  if (jwtToken !== undefined) {
    jwt.verify(jwtToken, 'MY_SECRET_TOKEN', async (error, payload) => {
      if (error) {
        response.status(401)
        response.send('Invalid JWT Token')
      } else {
        request.username = payload.username
        next()
      }
    })
  } else {
    response.status(401)
    response.send('Invalid JWT Token')
  }
}

// Register API
app.post('/register/', async (request, response) => {
  const {username, name, password, gender, location} = request.body
  const getUserQuery = `
    select
      *
    from 
      user
    where 
      username = '${username}'
  ;`
  const getUser = await db.get(getUserQuery)
  if (getUser === undefined) {
    const hashedPassword = await bcrypt.hash(password, 10)
    const addUserQuery = `
      insert into
        user (username,name,password,gender,location)
      values ('${username}','${name}','${hashedPassword}','${gender}','${location}')
    ;`
    await db.run(addUserQuery)
    response.send('Registred successfully!')
  } else {
    response.status(401)
    response.send('Unser already exists!')
  }
})

// 1.Login API
app.post(`/login/`, async (request, response) => {
  const {username, password} = request.body
  const getUserQuery = `
    select
      *
    from
      user
    where
      username = '${username}'
  ;`
  const getUser = await db.get(getUserQuery)
  // User Valid / Invalid
  if (getUser !== undefined) {
    const matchPassword = await bcrypt.compare(password, getUser.password)
    if (matchPassword) {
      const payload = {username: username}
      const jwtToken = jwt.sign(payload, 'MY_SECRET_TOKEN')
      response.send({jwtToken})
    } else {
      response.status(400)
      response.send('Invalid password')
    }
  } else {
    response.status(400)
    response.send('Invalid user')
  }
})

// 2.GET States API
app.get('/states/', authenticationToken, async (request, response) => {
  const sqlQuery = `
    select 
      state_id as stateId,
      state_name as stateName,
      population
    from 
      state
  ;`
  const getState = await db.all(sqlQuery)
  response.send(getState)
})

// 3.GET State API
app.get('/states/:stateId/', authenticationToken, async (request, response) => {
  const {stateId} = request.params
  const sqlQuery = `
    select 
      state_id as stateId,
      state_name as stateName,
      population
    from 
      state
    where
      state_id = ${stateId}
  ;`
  const getState = await db.get(sqlQuery)
  response.send(getState)
})

// 4.GET Districts API
app.post(`/districts/`, authenticationToken, async (request, response) => {
  const {districtName, stateId, cases, cured, active, deaths} = request.body
  const sqlQuery = `
    insert into
      district (district_name,state_id,cases,cured,active,deaths)
    values (
      '${districtName}',
      ${stateId},
      ${cases},
      ${cured},
      ${active},
      ${deaths}
    )
  ;`
  await db.run(sqlQuery)
  response.send('District Successfully Added')
})

// 5.GET District API
app.get(
  '/districts/:districtId/',
  authenticationToken,
  async (request, response) => {
    const {districtId} = request.params
    const sqlQuery = `
    select
      district_id as districtId,
      district_name as districtName,
      state_id as stateId,
      cases,
      cured,
      active,
      deaths
    from
      district
    where
      district_id = ${districtId}
  ;`
    const getDistrict = await db.get(sqlQuery)
    response.send(getDistrict)
  },
)

// 6.Remove District API
app.delete(
  '/districts/:districtId/',
  authenticationToken,
  async (request, response) => {
    const {districtId} = request.params
    const sqlQuery = `
    delete from
      district
    where
      district_id = ${districtId}
  ;`
    await db.run(sqlQuery)
    response.send('District Removed')
  },
)

// 7.Update District API
app.put(
  '/districts/:districtId/',
  authenticationToken,
  async (request, response) => {
    const {districtId} = request.params
    const {districtName, stateId, cases, cured, active, deaths} = request.body
    const sqlQuery = `
      update
        district
      set 
        district_name = '${districtName}',
        state_id = ${stateId},
        cases = ${cases},
        cured = ${cured},
        active = ${active},
        deaths = ${deaths}
      where
        district_id = ${districtId}
    ;`
    await db.run(sqlQuery)
    response.send('District Details Updated')
  },
)

// 8.GET Statistics of Total Cases, Cured, Active, Deaths API
app.get(
  '/states/:stateId/stats/',
  authenticationToken,
  async (request, response) => {
    const {stateId} = request.params
    const sqlQuery = `
    select
      sum(district.cases) as totalCases,
      sum(district.cured) as totalCured,
      sum(district.active) as totalActive,
      sum(district.deaths) as totalDeaths
    from
      state
    natural join
      district
    where
      state.state_id = ${stateId}
  ;`
    const getToalCCAD = await db.get(sqlQuery)
    response.send(getToalCCAD)
  },
)

// Exporting Express Instance
module.exports = app
