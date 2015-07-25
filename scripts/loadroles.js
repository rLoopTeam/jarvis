var data = require('./roles.json');

module.exports = function(robot) {
	for (var i = 0; i < data.length; i++) {
		var user = robot.userForName(data[i].name);
		user.roles = user.roles.concat(data[i].split(','));
	}
}