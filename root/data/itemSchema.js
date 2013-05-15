var mongoose = require( 'mongoose' );
var Schema = mongoose.Schema;

var itemSchema = new Schema({
    /* Example:
    key: Type
    Where Type is one of: String, Number, Date, Buffer, Boolean, Mixed, Objectid, Array
    For more info, please read: http://mongoosejs.com/docs/guide.html
    */

    name: String,
    description: String,
    clientId: String,
    item: String,
    meta: {
        comments: [{ body: String, date: Date }]
    }
});

// Bolt on any methods for this schema here
itemSchema.methods.findSimilarItems = function( cb ) {
    return this.model('Item').find({ type: this.type }, cb );
}

// Static constructor methods on Models is done here
itemSchema.statics.findByName = function( name, cb ) {
    this.find({ name: new RegExp( name, 'i' ) }, cb );
}
