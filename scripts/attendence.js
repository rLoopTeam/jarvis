var csv = require('csv-parse');
var fs = require('fs');
var nodemailer = require('nodemailer');
var Snoocore = require('snoocore');
var debug = process.env.DEBUG == 'true';

if(debug) {
	function log(){
		console.log.apply(this, arguments);
	}
} else {
	function log(){
		// No op
	}
}

var reddit = new Snoocore({
  userAgent: 'Hubot:org.rLoop.Jarvis.Attendence:0.1.0 (by /u/ImAPyromaniac)',
  oauth: { 
    type: 'script',
    key: 'chTmUNw1Tqq2kg', 
    secret: '0grfdCAwvJo8yEqvzB4FXZ7shEQ',
    username: 'rLoop',
    password: process.env.REDDIT_PASSWORD,
    scope: [ 'identity', 'edit', 'flair', 'history', 'modconfig', 'modflair', 'modlog', 'modposts', 'modwiki', 'mysubreddits', 'privatemessages', 'read', 'report', 'save', 'submit', 'subscribe', 'vote', 'wikiedit', 'wikiread' ] 
  }
});

reddit.auth();

log(reddit);

var transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: 'rLoopTeam@gmail.com',
        pass: process.env.GMAIL_PASSWORD
    }
});

var hasStartedCheckAttendence = false;
var CheckAttendenceTimer;

var rolesAllowedToExcuse = ['lead', 'sublead', 'deptlead', 'hr', 'pm', 'apm', 'attendence', 'super'];

function now(){
	var d = new Date();
	d.setHours(24, -1 * d.getTimezoneOffset(), 0, 0);
	return d.getTime();
}

function canExcuse(user) {
	user.roles = user.roles || [];
	for (var i = 0; i < user.roles.length; i++) {
		if(rolesAllowedToExcuse.indexOf(user.roles[i]) > -1) return true;
	}

	return false;
}

module.exports = function(robot) {
	log(robot);
	
	robot.respond(/excuse @?(.*) for ([0-9]*) day(:?s)?/i, function(msg){
		var user = robot.brain.userForName(msg.match[1]);
		var boss = msg.envelope.user;
		var days = parseInt(msg.match[2]);

		if (!canExcuse(boss)) return msg.reply('You are not premitted to excuse people');
		if (user.id == boss.id && user.roles.indexOf('super') === -1) return msg.reply('You can not excuse yourself, please contact your manager or #hr');
		
		if (debug) {
			user.lastSeen = now() - (days * 24 * 60 * 60 * 1000);
			hasStartedCheckAttendence = false;
			checkAttendence(robot, true);
		} else {
			user.exemptUntil = now() + (days * 24 * 60 * 60 * 1000);
		}

		msg.reply('Ok. @' + user.name + ' is excused until ' + new Date(user.exemptUntil).toUTCString().replace('GMT', 'UTC') + '.\nHave a nice day!');
	});

	robot.hear(/[\s\S.]*/, function(msg){
		debug || msg.envelope.user.lastSeen = now();
	});

	robot.respond(/status (?:for|of) @?(.*)/i, function(msg){
		var user = robot.brain.userForName(msg.match[1]);
		if(!user) return msg.reply('User not found.')
		var absentUntil = new Date(user.exemptUntil);
		absentUntil.setMinutes(absentUntil.getTimezoneOffset())
		msg.reply('@' + user.name + ' is ' + (user.exemptUntil ? 'absent until ' + absentUntil : 'not absent'));
	});

	checkAttendence(robot, false);
}

function checkAttendence(robot, isTimer){
	if (hasStartedCheckAttendence && !isTimer) return;

	var users = robot.brain.users();

	// log(users);
	for (var id in users) {
		var user = users[id];
		user.lastSeen = user.lastSeen || now();
		if (user.exemptUntil === now()) {
			user.lastSeen = now();
			user.exemptUntil = 0;
		} else if (user.exemptUntil) {
			return;
		} else if (now() - user.lastSeen >= 3 * 7 * 24 * 60 * 60 * 1000) {
			return killUser(robot, user);
		} else if (now() - user.lastSeen >= 2 * 7 * 24 * 60 * 60 * 1000) {
			return sendWarnings(robot, user);
		}
	}
	CheckAttendenceTimer = setTimeout(checkAttendence.bind(this, robot, true), 24 * 60 * 60 * 1000); // Run once a day
}

function sendWarnings(robot, user) {
	log("Sending Warnings to: ");
	log(user);
	transporter.sendMail({
	    from: 'rLoop <rLoopTeam@gmail.com>',
	    to: user['email_address'],
	    subject: 'Just a friendly reminder, you must visit the rLoop project once every two weeks.',
	    text: "Hi!\n\nJust a friendy robot letting you know that it is a requirement to use Slack (rloop.slack.com) at least once every two weeks to maintain membership of the rLoop project. If you're on vacation, please just reply to this email or login to slack and let your leader know.\n\n\nThanks!\nJarvis\n\n\nP.S. If for some reason you'd like to leave, just ignore this email, and you'll automatically be removed in a week."
	}, function(error, info){
    if(error){
        log(error);
    }else{
        log('Message sent: ' + info.response);
    }
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
	log("Killing: ");
	log(user);
	robot.adapter.client._apiCall('users.admin.setInactive', { user: user.id }, function(res) {
		log("User: " + user.name + " terminated with response: ");
		log(res);
	});

	reddit('/api/compose').post({
		api_type: 'json',
		from_sr: 'rLoop',
		to: user.name,
		subject: 'Goodbye from the rLoop Project.',
		text: "We're so sorry to see you go!\n\nIf you've got a minute, do you think that you could fill out our [exit survey](bit.ly/byerloop)?\n\nThanks!\nJarvis\n\n\nP.S. If you want to come back, please reply to this message."
	}).then(function(arg){
		log("Reddit:");
		log(arg);
	});

	// reddit('/api/v1/me').get().then(log);

	transporter.sendMail({
	    from: 'rLoopTeam@gmail.com',
	    to: user['email_address'],
	    subject: 'Goodbye from rLoop',
	    text: "We're so sorry to see you go!\n\nIf you've got a minute, do you think that you could fill out our exit survey?: bit.ly/byerloop\n\nThanks!\nJarvis\n\n\nP.S. If you want to come back, please reply to this email or PM us on reddit."
	}, function(err, info){
	    if(err){
	        log(err);
	    }else{
	        log('Message sent: ' + info.response);
	    }
	});

}
