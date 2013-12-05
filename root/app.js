"use strict";

// Application Dependencies
var config			= require('config');
var dbLib			= require('./lib/database');
var express			= require('express');
var fs				= require('fs');
var http			= require('http');
var https			= require('https');
var hbs				= require('hbs');
var path			= require('path');
var mongoose		= require('mongoose');
var query			= require('querystring');
var TokenFactory	= require('./lib/tokenFactory');

// Import REST Handlers
var routes = require( './routes' );
var dataRoutes = require( './routes/dataRoutes' );

// Application variables
var app	= module.exports = express();

// TODO: Configure app defaults from config
// TODO: If user chooses to implement MongoDB, need to implement
// Session Store
//var MongoStore		= require('connect-mongo')(express);

// Helpers
var appHelpers		= require( './lib/app-helpers' );
var hbsHelpers		= require( './lib/hbs-helpers' );
var packageJSON		= require( './package.json' );

/****************************
	Custom Middleware
****************************/
// Instantiate new TokenFactory for use
var tf = new TokenFactory({});

/** tokenManager
 *	Manages connection instances with cookies and fuel-node
 *	@param {obj} req
 *	@param {obj} res
 *	@param {function} next
 */
var tokenManager = function( req, res, next ) {
	if( !req.session || !req.session.jwtObj ) {
	// There is a JWT present, let's use that
		//console.log( 'IS NOT VALID SESSION...' );
		tf.upsertSession( req, res, function( error, data ) {
			if( error ) {
				console.error( 'Error: ' + error );
				next();
			} else {
				//console.log( 'SUCCESS NEW SESSION: ', req.session );
				next();
			}
		});
	} else {
	// Valid request from an authenticated client
		var now =  +new Date();
		var tokenExpiration = req.session.timeValidation;
		var jwtTokenExpires = req.session.jwtObj.expires;
		if( ( now - tokenExpiration ) > jwtTokenExpires ) {
			tf.refreshToken( req, res, function( error, data ) {
				if( error ) {
					console.error( 'Error: ' + error );
					next();
				} else {
					//console.log( 'SUCCESS UPDATED SESSION' );
					next();
				}
			});
		} else {
			next();
		}
	}
};

// Configure Express
app.configure( function() {
	// Determine base endpoint for static assets
	config.staticBase = config.endpoints.defaultStaticBase + ( config.endpoints.versionedDir ? packageJSON.version + '/' : '' );

	// Webfonts need mime types, too!
	express.static.mime.define({'application/x-font-woff':		['woff']});
	express.static.mime.define({'application/x-font-ttf':		['ttf']});
	express.static.mime.define({'application/vnd.ms-fontobject':['eot']});
	express.static.mime.define({'font/opentype':				['otf']});
	express.static.mime.define({'image/svg+xml':				['svg']});

	// Implement logging
	app.use(express.logger());

	// Setup gzip distribution
	app.use( express.compress() );

	// Configure app to use the port from process or 3000
	app.set('port', process.env.PORT || 3000);

	// Set the view engine
	app.set('view engine', 'hbs');

	// Set the directory that contains the views
	app.set('views', __dirname + '/views');

	// Allow Express to behave like a RESTful app
	app.use(express.methodOverride());

	// Use the bodyParser middleware.
	// TODO: Ask for prompt values and do not user bodyParser
	app.use(express.bodyParser());

	// CORS
	app.use( appHelpers.enableCORS );

// TODO: Ask user if they want cookie-based or persistent storage
// The following is cookie-based
	// Use the cookie-based session  middleware
	app.use(express.cookieParser('{%=name%}SignedCookieSecret'));

	// TODO: MaxAge for cookie based on token exp?
	app.use(express.cookieSession({secret: "{%=name%}PreventCookieTamperingSecret", cookie:{ httpOnly: true, signed: true }}));
// TODO: Ask user if they want cookie-based or persistent storage
// The following is persistent storage
// TODO: Prompt user for maxAge of cookies EX: 24 * 360000
	app.use(express.session({
		store: new MongoStore({
			mongoose_connection: database.connection
		}),
		secret: '{%=name%}PreventCookieTamperingSecret',
		cookie: {
			maxAge: {%=maxAgeSession%},
			signed: true
		}
	}));

	// Use the router middleware
	app.use(app.router);

	// Use static middleware
	app.use(express.static(__dirname + config.endpoints.uiBaseDir));

	// Comment Error pages
	// Handle 404
	app.use( function( req, res ) {
		res.status( 404 );
		res.render( '400', {title: '404: File Not Found', error: 'The file you are seeking is not here'} );
	});

/* TODO: Figure out why this isn't working
	// Handle 500 errors
	app.use( function( err, req, res, next ) {
		res.status( 500 );
		res.render( '500', {title: '500: Internal Server Error', error: err} );
	});
*/
});

// Express should do this stuff in development environment
app.configure('development', function() {
	app.use( express.errorHandler({ dumpException: true, showStack: true }));
});

// Express should do this stuff in production environment
app.configure('production', function() {
	console.log( 'Node in production mode' );
});

// handlebars helpers
hbs.registerHelper('block', hbsHelpers.block);
hbs.registerHelper('dateFormat', hbsHelpers.dateFormat);
hbs.registerHelper('extend', hbsHelpers.extend);
hbs.registerHelper('toLowerCase', hbsHelpers.toLowerCase);

// Required Route Configuration
app.get('/', routes.getIndex );

app.post('/login', tokenManager, routes.login );

app.get('/logout', routes.logout );

/*
TODO: Prompt user if they want to use MongoDB in their app, if they do...implement
// Data routes
app.post('/rest/item', dataRoutes.createItem );
*/

// Local testing
app.get('/testform', function( req, res ) {
	res.render( 'testform', {
		jwt: req.query.jwt || ''
	});
});

// Create HTTP server with your app and listen
app.listen( app.get( 'port' ) );
console.log( 'Express server listening on port %d in %s mode', app.get('port'), process.env.NODE_ENV );
