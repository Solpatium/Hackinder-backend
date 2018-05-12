const db = require("./db");
var createError = require('http-errors');
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
const bodyParser = require('body-parser');
var logger = require('morgan');

var app = express();

// app.use(bodyParser.json());
// app.use(bodyParser.urlencoded({ extended: true }));

// view engine setup

app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');


// app.use('/', function(err, req, res, next) {
//   console.log('Time:', Date.now())
//   next()
//   console.log('dadasdasdas')
//   next( createError(403));
//   const login = req.query.login;
//   const password = req.query.password;
//   console.log('tesdasdsadsdsadst')
//   db.validateUser(login, password)
//     .then(r => {
//       console.log(r);
//       if(e.length > 0 ) {
//         next();
//       } else {
//         res.status(403);
//       }
//     })
// })

function validRequest(req, res) {
  const login = req.query.login;
  const password = req.query.password;
  return db.validateUser(login, password)
    .then(r => {
      if (r.length > 0) {
        return r[0];
      } else {
        res.status(403)
        res.send('Authentication failed')
      }
    })
    .catch((r) => {
      console.log(r)
    })
}

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/login', function (req, res, next) {
  validRequest(req, res)
    .then((u) => {
      return Promise.all([
        u,
        db.getUserIdeas(u.login),
        db.getUserMatches(u.login)
      ])
    })
    .then(([user, userIdeas, matches]) => {
      console.log(userIdeas)
      res.setHeader('Content-Type', 'application/json');
      res.send(JSON.stringify({
        user: user,
        ideas: userIdeas,
        matches: matches
      }));
    })
    .catch(e => {
      console.log(e);
      res.status(500);
      res.send('Error')
    })
});

app.get('/all_ideas', function (req, res, next) {
  db.getIdeasForUser('dsadas')
    .then(ideas => {
      res.setHeader('Content-Type', 'application/json');
      res.send(JSON.stringify({
        ideas
      }));
    })
    .catch(e => {
      console.log(e);
      res.status(500);
      res.send('Error')
    })
});

app.post('/swipe/:id/:val', function (req, res, next) {
  const id = req.params.id;
  const direction = req.params.val

  if (direction != 'left' && direction != 'right') {
    res.status(400);
    res.send('Invalid direction');
    return;
  }

  validRequest(req, res)
    .then((u) => {
      return db.addSwipe(id, u.login, direction);
    })
    .then((s) => {
      console.log(s);
      res.setHeader('Content-Type', 'application/json');
      res.send(JSON.stringify({
        s
      }));
    })
});

app.get('/ideas', function (req, res, next) {
  validRequest(req, res)
    .then((u) => {
      return db.getIdeasForUser(u.login);
    })
    .then(ideas => {
      res.setHeader('Content-Type', 'application/json');
      res.send(JSON.stringify({
        ideas
      }));
    })
    .catch(e => {
      console.log(e);
      res.status(500);
      res.send('Error')
    })
});

var urlencodedParser = bodyParser.urlencoded({ extended: false })
var jsonParser = bodyParser.json()

app.post('/ideas', urlencodedParser, function (req, res, next) {
  const title = req.body.title;
  const description = req.body.description;
  const localization = 'cracow';
  const image = 'https://picsum.photos/303';

  console.log(req.body);
  console.log(title);
  console.log(description);

  if (!(description && description)) {
    res.status(400);
    res.send('Invalid request');
    return;
  }

  validRequest(req, res)
    .then((u) => {
      return db.addIdea(
        u.login,
        title,
        description,
        image,
        localization
      );
    })
    .then(idea => {
      res.setHeader('Content-Type', 'application/json');
      res.send(JSON.stringify({
        idea
      }));
    })
    .catch(e => {
      console.log(e);
      res.status(500);
      res.send('Error')
    })
});

// catch 404 and forward to error handler
app.use(function (req, res, next) {
  next(createError(404));
});

// error handler
app.use(function (err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.listen(3001, '0.0.0.0')

// CHAT
var app = require('express')();
var http = require('http').Server(app);
var io = require('socket.io')(http);
io.on('connection', function (socket) {
  let userName = null;

  socket.on('login', function (msg) {
    console.log("RECEIVED IN CHAT " + msg)
    try {
      const user = JSON.parse(msg);
      db.validateUser(user.login, user.password)
        .then(u => {
          userName = u.login;
          return Promise.all([
            db.getUserIdeas(user),
            db.getUserMatches(user),
          ]);
        })
        .then(([ideas, matches]) => {
          const all = [...ideas, ...matches];
          const ids = all.map(i => i._id);
          ids.forEach(id => socket.join(id));
          socket.emit('response', 'ok');
        })
        .catch(e => console.log(e));
    } catch (e) {
      socket.emit('response', 'fail');
      return;
    }
  });

  socket.on('getMessages', function (msg) {
    if (!userName) return;

    const { ideaId } = JSON.parse(msg);
    db.getMessages(ideaId)
      .then(messages => socket.emit('newMessages', messages))
      .catch(e => console.log(e));
  });

  socket.on('addMessage', function (msg) {
    if (!userName) return;

    const { idea, content } = JSON.parse(msg);
    io.to(idea).emit('newMessages', [content]);
    db.addMessage(idea, userName, content);
  });
});

http.listen(4000, function () {
  console.log('listening on *:4000');
});


module.exports = app;
