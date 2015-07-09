var csv = require('csv-parse');
var fs = require('fs');
var nodemailer = require('nodemailer');

var transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: 'rLoopTeam@gmail.com',
        pass: process.env.GMAIL_PASSWORD
    }
});

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
	transporter.sendMail({
	    from: 'rLoopTeam@gmail.com',
	    to: user.email,
	    subject: 'Just a friendly reminder, you must visit the rLoop project once every two weeks.',
	    text: "Hi!\n\nJust a friendy robot letting you know that it is a requirement to use Slack (rloop.slack.com) at least once every two weeks to maintain membership of the rLoop project. If you're on vacation, please just reply to this email or login to slack and let your leader know.\n\n\nThanks!\nJarvis\n\n\nP.S. If for some reason you'd like to leave, just ignore this email, and you'll automatically be removed in a week."
	});
}

function killUser(robot, user) {
	robot.adapter.client._apiCall('users.admin.setInactive', { user: user.id }, function(res) {
		console.log("User: " + user.name + " terminated with response: ");
		console.log(res);
	});
	
	transporter.sendMail({
	    from: 'rLoopTeam@gmail.com',
	    to: user.email,
	    subject: 'Goodbye from rLoop',
	    text: "We're so sorry to see you go!\n\nIf you've got a minute, do you think that you could fill out our exit survey?: bit.ly/byerloop\n\nThanks!\nJarvis\n\n\nP.S. If you want to come back, please reply to this email or PM us on reddit."
	}, function(err, info){
	    if(err){
	        console.log(err);
	    }else{
	        console.log('Message sent: ' + info.response);
	    }
	});

}
