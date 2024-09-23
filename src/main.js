const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const partials = require('express-partials');
const session = require('express-session');
const morgan = require('morgan');
const helmet = require('helmet');
const passport = require('passport');

const { Issuer, Strategy } = require('openid-client');

const mongoose = require('mongoose');

const config = require('./config.json');

const viewsRouter = require('./routes/views');
const proposalRouter = require('./routes/proposal');

const app = express();

databaseConfig = config.database

mongodbURI = process.env.MONGODB_URI || `mongodb://${databaseConfig.user}:${databaseConfig.password}@${databaseConfig.host}:${databaseConfig.port}/${databaseConfig.dbName}`;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// view engine setup
app.set('views', path.join(__dirname, 'templates'));
app.set('view engine', 'ejs');

// Produce logs via morgan's middleware.
app.use(morgan('common'));

// Middleware for reading form-encoded POST payloads.
app.use(express.json());

app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

// Serve the frontend files.
app.use(express.static(path.join(__dirname, 'templates/static')));
app.use(partials());

// Let Express know if we are using a reverse proxy.
if (config.server.usingProxy) app.set('trust proxy', 1);

app.use(session({
	secret: config.server.sessionSecret,
	resave: false,
	proxy: config.server.usingProxy,
	saveUninitialized: true,
	//store: sessionStore,
	cookie: {
		// Make the cookies HTTPS-only if this is a production deployment.
		secure: process.env.NODE_ENV === 'production',
		// The cookie shouldn't be valid after 20 minutes of inactivity.
		maxAge: 20 * 60 * 1000, // milliseconds
	},
	sameSite: '',
}));

// Use helmet headers to secure our application.
app.use(helmet());
// Use passport middlewares for authentication.
app.use(passport.initialize());
app.use(passport.session());

passport.serializeUser((user, done) => {
	console.log('-----------------------------');
	console.log('Serialize user');
	console.log(user);
	console.log('-----------------------------');
	done(null, user);
});
passport.deserializeUser((user, done) => {
	console.log('-----------------------------');
	console.log('Deserialize user');
	console.log(user);
	console.log('-----------------------------');
	done(null, user);
});

Issuer.discover(config.sso.wellKnownEndpoint)
	.then((keycloakIssuer) => {
		const keycloak = new keycloakIssuer.Client({
			client_id: config.sso.client,
			client_secret: config.sso.secret,
			redirect_uris: config.sso.redirectUris,
			response_types: ['code'],
		});

		passport.use(
			'oidc',
			new Strategy({ client: keycloak, passReqToCallback: true }, (req, tokenSet, userinfo, done) => {
				console.log('tokenSet', tokenSet);
				console.log('userinfo', userinfo);
				req.session.tokenSet = tokenSet;
				req.session.userinfo = userinfo;
				return done(null, tokenSet.claims());
			}),
		);
	});

// Login routes.
app.get('/login', (req, res, next) => { req.session.referer = req.headers.referer; next(); }, passport.authenticate('oidc', { scope: config.sso.scope }));

app.get('/login/callback', (req, res, next) => passport.authenticate('oidc', (err, user) => {
	if (err) { console.log(err); return res.status(500); }
	if (user) { req.session.userInfo = user; return next(); }
	console.log(err); return res.status(500);
})(req, res, next), (req, res) => {
	return res.redirect('/admin');
});

/*app.get('/login/callback', (req, res, next) => passport.authenticate('oidc', (err, user) => {
	if (err) { console.log(err); return res.status(500); }
	if (user) { req.session.userInfo = user; return next(); }
	console.log(err); return res.status(500);
})(req, res, next), loginController.handleLogin, (req, res) => {
	const redirectTo = req.session.referer;
	req.session.referer = null;
	return res.redirect(redirectTo || '/');
});*/

app.use('/', viewsRouter);
app.use('/api/proposals', proposalRouter);

try {
    mongoose.connect(mongodbURI);
    console.log('Connected to database');

    const port = config.server.port || 3000

    app.listen(port, () => {
        console.log(`Server is running on port ${port}`);
    });
} catch(error) {
    console.log('Error connecting to database', err);
    throw err;
}
