define( function( require ) {
	var Backbone = require( 'backbone' );
	var Config = require( 'config' );

	return Backbone.Collection.extend({
		parse: function(data) {
			this.paging = {
				page: data.page || 1,
				pageSize: data.pageSize,
				count: data.count || 0,
				pages: data.count && data.pageSize && Math.ceil(data.count / data.pageSize) || 0,
				start: data.page - 1 * data.pageSize || 0,
				end: Math.min(data.page * data.pageSize, data.count) || 0
			};
		
			return data.items || data;
		}
	});
});
