var csv = require('csv-parse');
var fs = require('fs');

var hasStartedCheckAttendence = false;

module.exports = function(robot) {
	console.log(robot);
	
	robot.respond(/[\s\S]*/, function(msg){
		console.log(msg);
		message.envelope.user.lastSeen = new Date().setHours(24, 0, 0, 0);
	})
}

function checkAttendence(robot, isTimer){
	if (hasStartedCheckAttendence && !isTimer) return;

	var users = robot.brain.users;
	var now = new Date().setHours(24, 0, 0, 0);

	for (var i = 0; i < users.length; i++) {
		var user = users[i];
		user.lastSeen = user.lastSeen || now;
		if (user.exemptUntil) {
			return;
		} else if (user.exemptUntil.setHours(24, 0, 0, 0) === now) {
			user.lastSeen = now;
			user.exemptUntil = 0;
		} else if (now - user.lastSeen > 3 * 7 * 24 * 60 * 60 * 1000) {
			killUser(robot, user);
		} else if (now - user.lastSeen > 2 * 7 * 24 * 60 * 60 * 1000) {
			sendWarnings(robot, user);
		}
	}
	setTimeout(checkAttendence.bind(this, robot, true), 24 * 60 * 60 * 1000); // Run this daily
}

function sendWarnings(robot, user) {

}

function killUser(robot, user) {
	robot.adapter.client._apiCall('users.admin.setInactive', { user: user.id }, function(res) {
		console.log("User: " + user.name + " terminated with response: ");
		console.log(res);
	});
}