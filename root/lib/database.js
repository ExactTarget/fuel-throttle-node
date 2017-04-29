/*jshint node:true*/
'use strict';

var mongoose = require( 'mongoose' );

// Need to capture database configurations from Stackato
var boundServices = process.env.STACKATO_SERVICES ? process.env.STACKATO_SERVICES : null;

function mongoConnStrBuilder() {
    var connectionStr = '';

    // Should only enter if we are on a Stackato service
    if( null !== boundServices ) {
        //boundServices = JSON.parse( boundServices );
        var credentials = boundServices['{%=name%}-db'];
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

    // TODO: Allow user to define the database name in scaffolding
    var credentials = boundServices['{%=name%}-db'];
    // generate mongo connection URI
    var mongoConnectionStr = mongoConnStrBuilder();
    var connection = mongoose.createConnection( mongoConnectionStr );
} else {
    connection = mongoose.createConnection( 'localhost', '{%=name%}-db' );
}

connection.on( 'open', () => {
    //console.log( 'Connection opened to mongodb' );
});

connection.on( 'error', err => {
    //console.log( err );
});

exports.connection = connection;
