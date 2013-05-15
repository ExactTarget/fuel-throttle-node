define( function( require ) {
    var Backbone = require( 'backbone' );
    var BaseModel = require( 'data/base-model' );
    var Config = require( 'config' );

    return BaseModel.extend({
        // TODO: Dynamic hostname needs configured
        // TODO: urlRoot: Config.appProxy + 'item'
    });
});
