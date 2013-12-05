"use strict";

var config      = require('config');
var fuel        = require('fuel');
var crypto      = require('crypto');
var _           = require('underscore');
var packageJSON = require('../package.json');
var JwtDecoder  = require( './jwtDecoder' );
var VERSION     = packageJSON.version;

/** TokenFactory
 *  @constructor {obj} req The Express request object
 *  @this {TokenFactory}
 *  @param {obj} options Initialization options for the TokenFactory
 */
var TokenFactory = module.exports = function TokenFactory( options ) {
    this.options = options || {};
};

// Define this module's version based on the package
TokenFactory.VERSION = packageJSON.version;

// Configure the JWTDecoder as a static var
TokenFactory.JWTDecoder = new JwtDecoder();

/*******************************
PUBLIC METHODS
*******************************/
// Method to remove a client session
/** _deleteSession
 *  @private
 *  @param {obj} req The Express request object
 *  @param {obj} res The Express request object
 *  @param {function} callback Async function defined in constructor
 */
TokenFactory.prototype.deleteSession = function( req, res, callback ) {
    res.session.jwtObj = null;
    res.session.fuelInstance = null;
};

// Initialization for new cookieSession instances of fuel-node
/** upsertSession
 *  @param {obj} req The Express request object
 *  @param {obj} res The Express request object
 *  @param {function} callback Async function defined in constructor
 */
TokenFactory.prototype.fetchToken = function( req, res, callback ) {
    
};

// Initialization for new cookieSession instances of fuel-node
/** upsertSession
 *  @param {obj} req The Express request object
 *  @param {obj} res The Express request object
 *  @param {function} callback Async function defined in constructor
 */
TokenFactory.prototype.upsertSession = function( req, res, callback ) {
    this._jwtHandler( req, res, callback );
};

// Keep it fresh
/** _refreshToken
 *  @public
 *  @param {obj} req The Express request object
 *  @param {obj} res The Express response object
 *  @param {function} callback Async method from contstructor
 */
TokenFactory.prototype.refreshToken = function( req, res, callback ) {
    /*
    TODO: Need to author the refresh flow
    var self = this;
    var now = null;

    if( !req.session.fuelInstance ) {
        callback( 'Error: Missing the fuelInstance!?' );
    } else {
        var fi = req.session.fuelInstance;
        fi( function( error, response, tokenData ) {
            if( error ) {
                console.error( 'Error: ' + error );
                callback( error );
            } else {
                callback( null, tokenData );
            }
        });
    }
    */
};
/*******************************
INTERNAL METHODS
*******************************/
// Convert JWT into something useful
/** _jwtHandler
 *  @private
 *  @param {obj} req The Express request object
 *  @param {obj} res The Express response object
 *  @param {function} callback Async method from contstructor
 */
TokenFactory.prototype._jwtHandler = function( req, res, callback ) {
    var self = this;
    if( !req.body.jwt ) {
        callback( 'Error: ' + 'No JWT provided with this call' );
    } else {
        var clientSessionId = this._configureSessionIdHash( req.body.jwt );
        
        // Create a new set of session params and return them
        TokenFactory.JWTDecoder.decode( req, function( error, parsedJWT ) {
            if( error ) {
                console.error( 'Error: ' + error );
                callback( 'Error: ' + error );
            } else {
                req.session.fuelInstance = self._configureFuelInstance( parsedJWT );
                req.session.jwtObj = parsedJWT;
                req.session.timeValidation = +new Date();
                callback( null, parsedJWT );
            }
        });
    }
};

/** _configureFuelInstance
 *  @private
 *  @param {string} refreshToken refreshToken value obtained from JWT
 *  @return {function} New fuel-node instance
 */
TokenFactory.prototype._configureFuelInstance = function( jwtObj ) {
    var tokenInstance = new fuel.token.configure({
        authUrl: config.environment.requestToken + '?legacy=1',
        clientId: config.environment.oAuth.clientId,
        clientSecret: config.environment.oAuth.clientSecret,
        refreshToken: jwtObj.refreshToken,
        accessType: 'offline'
    });

    //console.log( 'TOKEN INSTANCE: ', tokenInstance );

    return tokenInstance;
};

/** _configureSessionIdHash
 *  @private
 *  @param {string} jwt encoded JWT from SSO.aspx
 *  @param {function} callback Async function defined in constructor
 *  @return {string} MD5 sum of jwt and timestamp
 */
TokenFactory.prototype._configureSessionIdHash = function( jwt ) {
    // Create an MD5 of the JWT
    return crypto.createHash( 'md5' ).update( jwt ).digest( 'hex' );
};

