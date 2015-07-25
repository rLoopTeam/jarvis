var data = require('./roles.json');

module.exports = function(robot) {
	for (var i = 0; i < data.length; i++) {
		var user = robot.brain.userForName(data[i].name);
		console.log(data[i]);
		console.log(user);
		console.log('\n\n\n');
		if (!user) continue;
		user.roles = (user.roles || []).concat(data[i].roles.split(','), ['rolesLoaded']);
	}
}