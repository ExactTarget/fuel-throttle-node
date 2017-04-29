"use strict";

var helpers = require( '../lib/app-helpers' );
var config  = require( 'config' );
var _       = require( 'underscore' );

var getIndex = (req, res) => {
    var clientConfig = helpers.clientConfig( req.session );
    var options = _.extend({
        config: JSON.stringify( clientConfig ),
        title: 'Dashboard',
        appDisplayName: '{%=title%}'
    }, clientConfig);
    res.render( 'index', options );
};

module.exports = {
    getIndex,
    login(req, res) {
        getIndex( req, res );
    },

    logout(req, res) {
        req.clearCookie( '{%=name%}' );
    }
};
