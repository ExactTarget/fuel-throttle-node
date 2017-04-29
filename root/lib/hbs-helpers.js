"use strict";

var moment = require('moment');
var hbs = require('hbs');
var _ = require('underscore');
var blocks = {};

module.exports = {
	// add blocks of markup into views
	block(name) {
		var val = ( blocks[name] || [] ).join( '\n' );

		// clear the block
		blocks[name] = [];
		return val;
	},

	// extend views with code
	extend(name, context) {
		var block = blocks[name];
		if( !block ) {
			block = blocks[name] = [];
		}

		block.push( context( this ) );
	},

	// Format dates in Handlebars on the listing page
	dateFormat(context, block) {
		var f = block.hash.format || 'MMM Do, YYYY';
		return moment(context).format(f);
	},
	
	// Convert a string to lowercase in a handlebarsjs tempplate
	toLowerCase(value) {
		return _.isString(value) ? value.toLowerCase() : '';
	}
};
