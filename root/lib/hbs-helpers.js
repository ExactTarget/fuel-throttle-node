"use strict";

var moment = require('moment'),
	hbs = require('hbs'),
	_ = require('underscore'),
	blocks = {}
	;
	
module.exports = {
	// add blocks of markup into views
	block: function( name ) {
		var val = ( blocks[name] || [] ).join( '\n' );

		// clear the block
		blocks[name] = [];
		return val;
	},

	// extend views with code
	extend: function( name, context ) {
		var block = blocks[name];
		if( !block ) {
			block = blocks[name] = [];
		}

		block.push( context( this ) );
	},

	// Format dates in Handlebars on the listing page
	dateFormat: function(context, block) {
		var f = block.hash.format || 'MMM Do, YYYY';
		return moment(context).format(f);
	},
	
	// Convert a string to lowercase in a handlebarsjs tempplate
	toLowerCase: function(value) {
		return _.isString(value) ? value.toLowerCase() : '';
	}
};
