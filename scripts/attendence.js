var csv = require('csv-parse');
var fs = require('fs');
var nodemailer = require('nodemailer');
var Snoocore = require('snoocore');

var reddit = new Snoocore({
  userAgent: 'Jarvis by /u/ImAPyromaniac v0.1.0',
  oauth: { 
    type: 'script',
    key: 'chTmUNw1Tqq2kg', 
    secret: '0grfdCAwvJo8yEqvzB4FXZ7shEQ',
    username: 'rLoop',
    password: process.env.REDDIT_PASSWORD,
    scope: [ 'privatemessages', 'read' ] 
  }
});

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
	
	robot.hear(/[\s\S]*/, function(msg){
		console.log(msg);
		msg.envelope.user.lastSeen = new Date().setHours(24, 0, 0, 0);
		console.log(msg.envelope.user);
	});

	robot.respond(/repl/i, function(msg) {
		require('repl').start({}).context = this;
	})

	checkAttendence(robot, false);
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

	reddit('/api/compose').post({
		api_type: 'json',
		from_sr: 'rLoop',
		to: user.name,
		subject: 'Reminder that you must use slack once every two weeks to remain a member of the rLoop Project.',
		text: "Hi!\n\nJust a friendy robot letting you know that it is a requirement to use [Slack](http://rloop.slack.com/) \
at least once every two weeks to maintain membership of the rLoop project. \
If you're on vacation, please just reply to this message or login to slack and let your leader know.\
\n\nThanks!\n\nJarvis\n\nP.S. If for some reason you'd like to leave, just ignore this email, and you'll automatically \
be removed in a week."
	});
}

function killUser(robot, user) {
	robot.adapter.client._apiCall('users.admin.setInactive', { user: user.id }, function(res) {
		console.log("User: " + user.name + " terminated with response: ");
		console.log(res);
	});

	reddit('/api/compose').post({
		api_type: 'json',
		from_sr: 'rLoop',
		to: user.name,
		subject: 'Goodbye from the rLoop Project.',
		text: "We're so sorry to see you go!\n\nIf you've got a minute, do you think that you could fill out our [exit survey](bit.ly/byerloop)?\n\nThanks!\nJarvis\n\n\nP.S. If you want to come back, please reply to this message."
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
