// TODO: Only include this file if user wants to use Mongo (app or sessions)
/*jshint node:true*/
'use strict';

var config = require( 'config' );
var mongoose = require( 'mongoose' );

// Need to capture database configurations from Stackato
var boundServices = process.env.STACKATO_SERVICES ? process.env.STACKATO_SERVICES : null;

function mongoConnStrBuilder() {
    var connectionStr = '';

    // Should only enter if we are on a Stackato service
    if( null !== boundServices ) {
        //boundServices = JSON.parse( boundServices );
        var credentials = boundServices[config.mongo.db];
        connectionStr += 'mongodb://';
        if( credentials['username'] ) {
            connectionStr += credentials['username'] + ':';
        }
        if( credentials['password'] ) {
            connectionStr += credentials['password'] + '@';
        }
        if( credentials['hostname'] ) {
            connectionStr += credentials['hostname'] + ':';
        }
        if( credentials['port'] ) {
            connectionStr += credentials['port'] + '/';
        }
        if( credentials['db'] ) {
            connectionStr += credentials['db'];
        }
    }

    return connectionStr;
}

// Make sure we only parse if we're on stackato
if( null !== boundServices ) {
    boundServices = JSON.parse( boundServices.replace( /\//g, '' ) );
    var credentials = boundServices[config.mongo.db];
    var mongoConnectionStr = mongoConnStrBuilder();
    mongoose.connect( mongoConnectionStr );
} else {
    mongoose.connect( 'mongodb://localhost/' + config.mongo.db );
}

mongoose.connection.on('open', function() {
    console.log( 'Connect to database ' + config.mongo.db + ' was successful' );
});

mongoose.connection.on('error', function( err ) {
    console.error( 'MongoDB Error: ', err );
});

exports.connection = mongoose.connection;
