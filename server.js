const express = require('express');
const bcrypt = require('bcryptjs');
const cors = require('cors');
const knex = require('knex');
const imagedetect = require('./image');
const { get } = require('express/lib/response');

const db = knex({
  client: 'pg',
  connection: {
    connectionString : process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  }
});

const corsOption = {
  origin:['https://smart-brain-face-recognition-v.herokuapp.com', 'http://localhost:3000'], 
  credentials:false,
  methods: ['GET','POST','OPTIONS','PUT','DELETE'],
  allowedHeaders : ['Content-Type','Origin','X-Requested-With','Accept'],
  preflightContinue: true,
  optionSuccessStatus:200,
}

const app = express();

app.use(cors(corsOption));
app.use(express.json()); // latest version of exressJS now comes with Body-Parser!

app.get('/', (req, res)=> {
  res.send('it is working!');
})

app.post('/signin', (req, res) => {
  console.log('signin is triggered')
  const {email,password} = req.body;
  db.select('email', 'hash').from('login')
    .where('email', '=', email)
    .then(data => {
      const isValid = bcrypt.compareSync(`${password}`, data[0].hash);
      if (isValid) {
        return db.select('*').from('users')
          .where('email', '=', email)
          .then(user => {
            res.json(user[0])
          })
          .catch(err => res.status(400).json('unable to get user'))
      } else {
        res.status(400).json('wrong credentials')
      }
    })
    .catch(err => res.status(400).json('wrong credentials'))
})

app.post('/register', (req, res) => {
  const { email, name, password } = req.body;
  const hash = bcrypt.hashSync(password);
    db.transaction(trx => {
      trx.insert({
        hash: hash,
        email: email
      })
      .into('login')
      .returning('email')
      .then(loginEmail => {
        return trx('users')
          .returning('*')
          .insert({
            email: loginEmail[0].email,
            name: name,
            joined: new Date()
          })
          .then(user => {
            res.json(user[0]);
          })
      })
      .then(trx.commit)
      .catch(trx.rollback)
    })
    .catch(err => console.log(err))
})

app.get('/profile/:id', (req, res) => {
  const { id } = req.params;
  db.select('*').from('users').where({id})
    .then(user => {
      if (user.length) {
        res.json(user[0])
      } else {
        res.status(400).json('Not found')
      }
    })
    .catch(err => res.status(400).json('error getting user'))
})


app.post('/imageurl', (req, res) => { imagedetect.handleApiCall(req, res)})

app.put('/image', (req, res) => {
  const { id } = req.body;
  db('users').where('id', '=', id)
  .increment('entries', 1)
  .returning('entries')
  .then(entries => {
    res.json(entries[0].entries);
  })
  .catch(err => {
    console.log(err);
    res.status(400).json('unable to get entries')})
})

app.listen(process.env.PORT || 3000, ()=> {
  console.log(`app is running on port ${process.env.PORT}`);
})