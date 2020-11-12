const express = require('express');
const cors = require('cors');
const client = require('./client.js');
const app = express();
const morgan = require('morgan');
const ensureAuth = require('./auth/ensure-auth');
const createAuthRoutes = require('./auth/create-auth-routes');
const request = require('superagent');

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(morgan('dev')); // http logging

const authRoutes = createAuthRoutes();

// setup authentication routes to give user an auth token
// creates a /auth/signin and a /auth/signup POST route. 
// each requires a POST body with a .email and a .password
app.use('/auth', authRoutes);

// everything that starts with "/api" below here requires an auth token!
app.use('/api', ensureAuth);

// and now every request that has a token in the Authorization header will have a `req.userId` property for us to see who's talking
app.get('/api/test', (req, res) => {
  res.json({
    message: `in this proctected route, we get the user's id like so: ${req.userId}`
  });
});

app.get('/movies/:id', async(req, res) => {
  try {
    const data = await request.get(`https://api.themoviedb.org/3/movie/${req.params.id}?api_key=${process.env.MOVIE_KEY}`);
    
    res.json(data.body);
  } catch(e) {
    
    res.status(500).json({ error: e.message });
  }
});

app.get('/search', async(req, res) => {
  try {
    const data = await request.get(`https://api.themoviedb.org/3/search/movie?api_key=${process.env.MOVIE_KEY}&language=en-US&query=${req.query.query}&page=${req.query.page || 1}&include_adult=false`);
    
    res.json(data.body);
  } catch(e) {
    
    res.status(500).json({ error: e.message });
  }
});

// this is the endpoint to save a user's new favorite movie
app.post('/api/favorites', async(req, res) => {
  try {
    // we add the current user if and the selected movie id to SQL
    const data = await client.query(`
      INSERT into favorites (movie_api_id, title, owner_id)
      VALUES ($1, $2, $3)
      RETURNING *;
    `, [req.body.movie_api_id, req.body.title, req.userId]);
    
    res.json(data.rows[0]);
  } catch(e) {
    
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/favorites', async(req, res) => {
  try {
    const data = await client.query(`
      SELECT * FROM favorites 
      WHERE favorites.owner_id = $1
    `, [req.userId]);
    
    res.json(data.rows);
  } catch(e) {
    
    res.status(500).json({ error: e.message });
  }
});

app.use(require('./middleware/error'));

module.exports = app;
