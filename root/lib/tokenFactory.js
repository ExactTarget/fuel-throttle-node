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
    this.activeSessions = {};
};

// Define this module's version based on the package
TokenFactory.VERSION = packageJSON.version;

/*******************************
PUBLIC METHODS
*******************************/

// Initialization for new cookieSession instances of fuel-node
/** upsertSession
 *  @param {obj} req The Express request object
 *  @param {obj} res The Express request object
 *  @param {function} callback Async function defined in constructor
 */
TokenFactory.prototype.upsertSession = function( req, res, callback ) {
    var paramsObj = this._fetchSessionParams( req, res, callback );
    this._fetchToken( req, res, paramsObj, callback );
};

/*******************************
INTERNAL METHODS
*******************************/

// Method to remove a client session from list of valid current sessions
/** _deleteClientSession
 *  @private
 *  @param {obj} req The Express request object
 *  @param {obj} res The Express request object
 *  @param {function} callback Async function defined in constructor
 *  @return {bool} deleted successfully == true, else error (use callback)
 */
TokenFactory.prototype._deleteClientSession = function( req, res, callback ) {
    if( this.isValidSession( req ) ) {
        res.clearCookie( 'clientSession' );
    }
};
// Will update or reset the Session Params if possible
/** _fetchSessionParams
 *  @private
 *  @param {obj} req The Express request object
 *  @param {obj} res The Express request object
 *  @param {function} callback Async function defined in constructor
 *  @return {obj} sessionParamsObj
 */
TokenFactory.prototype._fetchSessionParams = function( req, res, callback ) {
    var clientSessionId;
    var fuelSessionInstance;
    var paramsObj = {};
    var jwtValidator = new JwtDecoder();
    var jwtObj = {};

    // If a valid session exists, return its params
    if( this.isValidSession( req ) ) {
        clientSessionId = this._getSessionIdFromCookie( req );
        if( undefined === this._getActiveSessionFuelInstance( clientSessionId ) ) { 
            fuelSessionInstance = this._configureFuelInstance( jwtObj, callback );
        } else {
            fuelSessionInstance = this._getActiveSessionFuelInstance( clientSessionId );
        }
        return {tokenInstanceObj: fuelSessionInstance, clientSessionId };
    }

    // Create a new set of session params and return them
    jwtObj = jwtValidator.decode( req );
    
    // Create MD5 of of the JWT string and current time
    paramsObj.clientSessionId = this._configureSessionIdHash( jwtObj, callback );
    // Create a new instance of the fuel-node object
    paramsObj.tokenInstanceObj = this._configureFuelInstance( jwtObj.refresToken );
    // Add new client session to activeSessions collection, with id as key
    this._createNewActiveSession( req, paramsObj.clientSessionId, paramsObj.tokenInstanceObj );

    // Return the params obj 
    return paramsObj;
};

// Ensures a valid session which consists of a valid cookie and a valid activeSession property clientSession ID (MD5) to the fuel-node instance
/** isValidSession
 *  @private
 *  @param {obj} req The Express request object
 *  @param {function} callback Async method from contstructor
 *  @return {boolean} If valid session (cookie+activeSession prop)
 *  true, else false (one or the other is missing)
 */
TokenFactory.prototype.isValidSession = function( req ) {
    var csid = this._getSessionIdFromCookie( req );

    return ( csid && this.activeSessions.hasOwnProperty( csid ) );
};

// Add this new client to activeSessions object, which maps the clientSession ID (MD5) to the fuel-node instance
/** _createNewActiveSession
 *  @private
 *  @param {obj} req The Express request object
 *  @param {string} clientSessionId the MD5 id
 *  @param {function} tokenInstance fuel-node instance
 */
TokenFactory.prototype._createNewActiveSession = function( req, clientSessionId, tokenInstance ) {
    // TODO: Maybe have this return the instance like
    // _getActiveSessionInstance, merge the two?
    this.activeSessions[clientSessionId] = tokenInstance;
};

/** _configureFuelInstance
 *  @private
 *  @param {string} refreshToken refreshToken value obtained from JWT
 *  @return {function} New fuel-node instance
 */
TokenFactory.prototype._configureFuelInstance = refreshToken => {
    var tokenInstance = new fuel.token.configure({
        authUrl: config.environment.requestToken,
        clientId: config.environment.oAuth.clientId,
        clientSecret: config.environment.oAuth.clientSecret,
        refreshToken,
        accessType: 'offline'
    });

    return tokenInstance;
};


/** _fetchToken
 *  @private
 *  @param {obj} req The Express request object
 *  @param {obj} res The Express request object
 *  @param {obj} paramsObj Object containing the valid parameters to call the fuel-node instance
 *  @param {function} callback Async function defined in constructor
 *  @return {} Constructor's callback is fired with error or tokenData
 */
TokenFactory.prototype._fetchToken = (req, res, paramObj, callback) => {

    var fuelInstance = paramObj.tokenInstanceObj;
    var csid = paramObj.clientSessionId;
    if( _.isFunction( fuelInstance ) ) {
        fuelInstance( (error, response, tokenData) => {
            if( error ) {
                return callback( error );
            }

            if( tokenData ) {
                tokenData.clientSessionId = csid;
                res.cookie( '{%=name%}', {id: csid, oAuthToken: tokenData.accessToken }, {signed: true, expiresIn: tokenData.expiresIn} );
                return callback( null, tokenData );
            }
        });
    }
};

/** _configureSessionIdHash
 *  @private
 *  @param {string} jwt encoded JWT from SSO.aspx
 *  @param {function} callback Async function defined in constructor
 *  @return {string} MD5 sum of jwt and timestamp
 */
TokenFactory.prototype._configureSessionIdHash = (jwt, callback) => {
    // Generate a timestamp for uniqueness to the JWT
    var ts = Date.now();

    // Create timestamped unique key
    var tsJWT = jwt + ts;

    // Create an MD5 of the JWT + timestamp
    return crypto.createHash( 'md5' ).update( tsJWT ).digest( 'hex' );
};

/** _getSessionIdFromCookie
 *  @private
 *  @param {obj} req The Express request object
 *  @return {string} the id from existing cookie or false
 */
TokenFactory.prototype._getSessionIdFromCookie = req => {
    // Sanity check
    if( _.isEmpty( req.signedCookies ) ) {
        return false;
    }
    var clientSessionId = req.signedCookies['{%=name%}'].id;

    return clientSessionId;
};

// Method to get the proper client-associated fuel-node instance from activeSessions
/** _getActiveSessionFuelInstance
 *  @private
 *  @param {obj} req The Express request object
 *  @param {function} callback Async function defined in constructor
 *  @return {function} fuel-node instance associated with the valid cookie
 */
TokenFactory.prototype._getActiveSessionFuelInstance = function( csid ) {
    // Get the right instance based on the clientSession.id
    return this.activeSessions[csid];
};
