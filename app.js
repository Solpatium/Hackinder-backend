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

function validRequest(req, res) {
  return new Promise(function (resolve, reject) {
    const [login, token] = req.get('Authorization').split(':');
    resolve(db.validAccess(login, token));
  })
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
    });
}

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/login/:user/:passwordHash', function (req, res, next) {
  const username = req.params.user;
  const passwordHash = req.params.passwordHash;

  db.createToken(username, passwordHash)
    .then(token => {
      res.setHeader('Content-Type', 'application/json');
      res.send(JSON.stringify({
        token: token
      }));
    })
    .catch(e => {
      console.log(e);
      res.status(500);
      res.send('Invalid credentials')
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

app.get('/matches', function (req, res, next) {
  validRequest(req, res)
    .then((u) => {
      return Promise.all([
        db.getUserIdeas(u.login),
        db.getUserMatches(u.login),
      ]);
    })
    .then( ([userIdeas, userMatches]) => {
      res.setHeader('Content-Type', 'application/json');
      res.send(JSON.stringify({
        ideas: [...userIdeas, ...userMatches]
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
  console.log("CONNECTION-------")
  socket.on('login', function (msg) {
    console.log("RECEIVED IN CHAT " + msg)
    try {
      const user = JSON.parse(msg);
      db.validAccess(user.login, user.token)
        .then(u => {
          userName = user.login;
          return Promise.all([
            db.getUserIdeas(user.login),
            db.getUserMatches(user.login),
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
    console.log("GET MESSAGES" + msg)

    if (!userName) return;

    const { ideaId } = JSON.parse(msg);
    socket.join(ideaId)
    db.getMessages(ideaId)
      .then(messages => {
        console.log(messages)
        messages.reverse();
        socket.emit('newMessages', JSON.stringify({ messages: messages }))
      }
      )
      .catch(e => console.log(e));
  });

  socket.on('addMessage', function (msg) {
    if (!userName) return;
    console.log("USER " + userName)
    console.log(msg)

    const { idea, content } = JSON.parse(msg);
    db.addMessage(idea, userName, content);

    const messageBody = {
      date: + new Date(),
      sender: userName,
      content: content
    }
    io.to(idea).emit('newMessages', JSON.stringify({ messages: [messageBody] }));
  });
});

http.listen(4000, '0.0.0.0', function () {
  console.log('listening on *:4000');
});


module.exports = app;
