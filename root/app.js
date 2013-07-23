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

// Helpers
var appHelpers		= require( './lib/app-helpers' );
var hbsHelpers		= require( './lib/hbs-helpers' );
var packageJSON		= require( './package.json' );

// Instantiate new TokenFactory for use
var tf = new TokenFactory({});

/****************************
	Custom Middleware
****************************/

/** tokenManager
 *	Manages connection instances with cookies and fuel-node
 *	@param {obj} req
 *	@param {obj} res
 *	@param {function} next
 */
var tokenManager = function( req, res, next ) {
	// If we don't have a valid session, create one
	if( !tf.isValidSession( req ) ) {
		tf.upsertSession( req, res, function( error, data ) {
			if( error ) {
				throw new Error( error );
			}
			next();
		});
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
	app.use(express.bodyParser());

	// Use the cookie-based session  middleware
	app.use(express.cookieParser('{%=name%}SignedCookieSecret'));

	// TODO: MaxAge for cookie based on token exp?
	app.use(express.cookieSession({secret: "{%=name%}PreventCookieTamperingSecret", cookie:{ httpOnly: true, signed: true }}));

	app.use( appHelpers.enableCORS );

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

	// Handle 500 errors
	app.use( function( err, req, res, next ) {
		res.status( 500 );
		res.render( '500', {title: '500: Internal Server Error', error: err} );
	});
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

// fuel-throttle was built with single page apps in mind.
// this is why below is set to "/"
// this value should match the value in appCenter
app.post('/', tokenManager, routes.login );

app.get('/logout', routes.logout );

// Data routes
app.post('/rest/item', dataRoutes.createItem );

// Local testing
app.get('/testform', function( req, res ) {
	res.render( 'testform', {
		jwt: req.query.jwt || ''
	});
});

// Create HTTP server with your app and listen
app.listen( app.get( 'port' ) );
console.log( 'Express server listening on port %d in %s mode', app.get('port'), process.env.NODE_ENV );
