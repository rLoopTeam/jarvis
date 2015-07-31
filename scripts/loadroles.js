var data = require('./roles.json');

module.exports = function(robot) {
	return; // disable this.
	setTimeout(function(){
		for (var i = 0; i < data.length; i++) {
			var user = robot.brain.userForName(data[i].name);
			console.log(data[i]);
			console.log(user);
			console.log('\n\n\n');
			if (!user) continue;
			user.roles = data[i].roles.split(',').concat(['rolesLoaded']);
		}
	}, 10000);
	
}