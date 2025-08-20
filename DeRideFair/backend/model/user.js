var mongoose = require('mongoose');
var Schema = mongoose.Schema;

userSchema = new Schema( {
	username: String,
	password: String,
	createdAt: {
		type: Date,
		default: Date.now
	}
}),
user = mongoose.model('user', userSchema);

module.exports = user;