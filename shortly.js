var express = require('express');
var util = require('./lib/utility');
var partials = require('express-partials');
var bodyParser = require('body-parser');
var session = require('express-session');
// passport
var passport = require('passport');
var GitHubStrategy = require('passport-github2').Strategy;

var GITHUB_CLIENT_ID = "d1cd07060fe831923f32";
var GITHUB_CLIENT_SECRET = "a9584cea99ccb9de7f3859de96693033c288e2cb";

var db = require('./app/config');
var Users = require('./app/collections/users');
var User = require('./app/models/user');
var Links = require('./app/collections/links');
var Link = require('./app/models/link');
var Click = require('./app/models/click');

var app = express();


passport.serializeUser(function(user, done) {
  done(null, user);
});

passport.deserializeUser(function(obj, done) {
  done(null, obj);
});

passport.use(new GitHubStrategy({
    clientID: GITHUB_CLIENT_ID,
    clientSecret: GITHUB_CLIENT_SECRET,
    callbackURL: "http://127.0.0.1:4568/auth/github/callback"
  },
  function(accessToken, refreshToken, profile, done) {
    // asynchronous verification, for effect...
    new User({ username: profile.id }).fetch().then(function(found) {
      if (found) {
        return done(null, found);
      }
      else {
        var user = new User({username: profile.id});
        user.save().then(function(newUser) {
          return done(null, newUser);
        });
      }
    });
  }
));

function ensureAuthenticated(req, res, next) {
  console.log(req.isAuthenticated());
  if (req.isAuthenticated()) { return next(); }
  res.redirect('/login');
}
app.use(session({
  secret: 'keyboard cat',
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false }
}));
// passport
app.use(passport.initialize());
app.use(passport.session());

app.get('/auth/github',
  passport.authenticate('github', { scope: [ 'user:email' ] }));

// GET /auth/github/callback
//   Use passport.authenticate() as route middleware to authenticate the
//   request.  If authentication fails, the user will be redirected back to the
//   login page.  Otherwise, the primary route function function will be called,
//   which, in this example, will redirect the user to the home page.
app.get('/auth/github/callback',
  passport.authenticate('github', { failureRedirect: '/signup' }),
  function(req, res) {
    console.log('successfully authenticated');
    res.redirect('/');
  });

app.set('views', __dirname + '/views');
app.set('view engine', 'ejs');
app.use(partials());
// Parse JSON (uniform resource locators)
app.use(bodyParser.json());
// Parse forms (signup/login)
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(__dirname + '/public'));



var sess;

// function restrict(req, res, next) {
//   if (req.session.user) {
//     next();
//   } else {
//     req.session.error = 'Access denied!';
//     res.redirect('/login');
//   }
// }

app.get('/', ensureAuthenticated, function(req, res) {
  res.render('index');
});
// app.get('/', restrict, function(req, res) {
//   res.render('index');
// });

app.get('/create',
function(req, res) {
  res.render('index');
});

// app.get('/create', restrict,
// function(req, res) {
//   res.render('index');
// });

app.get('/links',
function(req, res) {
  Links.reset().fetch().then(function(links) {
    res.send(200, links.models);
  });
});

app.post('/links',
function(req, res) {
  var uri = req.body.url;

  if (!util.isValidUrl(uri)) {
    console.log('Not a valid url: ', uri);
    return res.send(404);
  }
  // fetch gets a model from the database. it is like a SELECT query
  new Link({ url: uri }).fetch().then(function(found) {
    if (found) {
      console.log(found);
      res.send(200, found.attributes);
    } else {
      util.getUrlTitle(uri, function(err, title) {
        if (err) {
          console.log('Error reading URL heading: ', err);
          return res.send(404);
        }

        var link = new Link({
          url: uri,
          title: title,
          base_url: req.headers.origin
        });
        // save() is used to perform insert/update on a bookshelf model
        link.save().then(function(newLink) {
          Links.add(newLink);
          res.send(200, newLink);
        });
      });
    }
  });
});

/************************************************************/
// Write your authentication routes here
/************************************************************/
app.get('/login',
function(req, res) {
  res.render('login');
});

app.post('/login', function(req, res){
  var username = req.body.username;
  var password = req.body.password;

  new User({ username: username }).fetch().then(function(model) {
    if (!model) {
      console.log('you don\'t exist');
      res.redirect('/login');
    } else {
      var oldSalt = model.get('salt')
      var oldPassword = model.get('password');  //salted + hashed
      var newPassword = password; // not salted + not hashed

      var hashed = model.decrypt(newPassword, oldSalt);
      if (oldPassword !== hashed){
        res.redirect('/login');
      }
      else{ // entered the correct password
        sess = req.session;
        sess.user = username;
        res.redirect('/create');
      }

    }
  });
});

app.get('/signup',
function(req, res) {
  res.render('signup');
});

app.post('/signup', function(req, res){
  var username = req.body.username;
  var password = req.body.password;

  new User({ username: username }).fetch().then(function(found) {
    if (found) {
      res.redirect('/login');
    } else {
      var user = new User({
        username: username,
        password: password,
      });

      //save() is used to perform insert/update on a bookshelf model
      user.save().then(function(newUser) {
        console.log('newUser ', newUser);
        Users.add(newUser);
        // create session
        sess = req.session;
        // identify session as this user's
        sess.user = username;
        // signing up is a successful login
        res.redirect('/create');

        res.send(200);
      });

    }
  });
});

app.get('/logout', function(req, res){
  // sess.destroy(function(){
  //   res.redirect('login');
  // });
  req.logout();
  res.redirect('/login');
});




/************************************************************/
// Handle the wildcard route last - if all other routes fail
// assume the route is a short code and try and handle it here.
// If the short-code doesn't exist, send the user to '/'
/************************************************************/

app.get('/*', function(req, res) {
  new Link({ code: req.params[0] }).fetch().then(function(link) {
    if (!link) {
      res.redirect('/');
    } else {
      var click = new Click({
        link_id: link.get('id')
      });

      click.save().then(function() {
        db.knex('urls')
          .where('code', '=', link.get('code'))
          .update({
            visits: link.get('visits') + 1,
          }).then(function() {
            return res.redirect(link.get('url'));
          });
      });
    }
  });
});

console.log('Shortly is listening on 4568');
app.listen(4568);
