"use strict";

var request = require('request');
var	config = require('config');
var	jwtLib = require('jwt-simple');
var	packageJson = require('../package.json');
var	_ = require('underscore');

module.exports = {
	clientConfig: function (session) {
		return {
			rest: config.endpoints.rest,
			staticBase: config.staticBase,
			loginUrl: config.environment.loginUrl,
			version: packageJson.version

		};
	},
	
	// Firefox has cross domain problems with web fonts so we need a little middleware to help with that
	// This is applied to the fonts directory when we set up Express below
	// Enable CORS
	enableCORS: function( req, res, next ) {
		res.header( 'Access-Control-Allow-Origin', '*' );
		res.header( 'Access-Control-Allow-Method', 'POST, GET, PUT, DELETE, OPTIONS' );
		res.header( 'Access-Control-Allow-Headers', 'Origin, X-Requested-With, X-File-Name, Content-Type, Cache-Control' );

		if( 'OPTIONS' === req.method ) {
			res.send( 203, 'OK' );
		}

		next();
	}
};
