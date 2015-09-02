var csv = require('csv-parse');
var fs = require('fs');
var pkg = require('./../package.json');
var nodemailer = require('nodemailer');
var Snoocore = require('snoocore');
var debug = process.env.NODE_ENV == 'development';

var hasStartedCheckAttendence = false;
var CheckAttendenceTimer;
var rolesAllowedToExcuse = ['lead', 'sublead', 'deptlead', 'hr', 'pm', 'apm',
                            'attendence', 'super'];

var logRobot;
function log() {
  !debug &&
  logRobot &&
  logRobot.send({ room: 'jarvis-logs' },
    Array.prototype.slice.call(arguments).map(function(a) {
      if (typeof a !== 'string') return JSON.stringify(a, 2);
      else return a;
    }).join('\n'));
  return console.log.apply(this, arguments);
}

function now() {
  var d = new Date();
  d.setHours(24, -1 * d.getTimezoneOffset(), 0, 0);
  return d.getTime();
}

function canExcuse(user) {
  user.roles = user.roles || [];
  for (var i = 0; i < user.roles.length; i++) {
    if (rolesAllowedToExcuse.indexOf(user.roles[i]) > -1) return true;
  }

  return false;
}

/*
 * Reddit
 */
var reddit = new Snoocore({
  userAgent: process.env.REDDIT_USER_AGENT ||
             'Hubot:org.rLoop.Jarvis.Attendence:' +
             pkg.version +
             ' (by /u/ImAPyromaniac)',
  oauth: {
    type: 'script',
    key: process.env.REDDIT_KEY,
    secret: process.env.REDDIT_SECRET,
    username: process.env.REDDIT_USERNAME,
    password: process.env.REDDIT_PASSWORD,
    scope: ['identity',
            'edit',
            'flair',
            'history',
            'modconfig',
            'modflair',
            'modlog',
            'modposts',
            'modwiki',
            'mysubreddits',
            'privatemessages',
            'read',
            'report',
            'save',
            'submit',
            'subscribe',
            'vote',
            'wikiedit',
            'wikiread']
  }
});
reddit.auth();

/*
 * Email
 */
var transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USERNAME,
    pass: process.env.GMAIL_PASSWORD
  }
});

/*
 * Message Sending
 */
function getMessage(type, name, callback) {
  fs.readFile(__dirname + '/messages/' + type + '-' + name + '.txt',
    { encoding: 'UTF-8' },
              function(err, data) {
                if (err) return callback(err);
                data = data.replace('${name}', process.env.NAME).split('\n');
                result = { subject: data.shift(), text: data.join('\n') };
                callback(null, result);
              });
}

function sendRedditMessage(name, to, callback) {
  getMessage('reddit', name, function(err, msg) {
    if (err) callback(err);
    reddit('/api/compose').post({
      api_type: 'json',
      from_sr: process.env.REDDIT_SUBREDDIT,
      to: to,
      subject: msg.subject,
      text: msg.text
    }).then(function(res) {
      log('[Reddit] (' + name + ') ' + to + ': Response: ');
      log(res.json.errors);
      if (res.json.errors != []) return callback(res.json.errors);
      log('[Reddit] (' + name + ') ' + to + ': Response: ');
      log(res);
      callback();
    });
  });
}

function sendEmail(name, to, callback) {
  getMessage('email', name, function(err, msg) {
    if (err) callback(err);
    transporter.sendMail({
      from: 'rLoop <' + process.env.GMAIL_USERNAME + '>',
      to: to,
      subject: msg.subject,
      text: msg.text
    }, function(err, info) {
      if (err) return callback(err);
      log('[Email] (' + name + ') ' + to + ': Response: ');
      log(info);
      callback();
    });
  });
}

function sendMessages(name, user, callback) {
  log('sending message: ');
  log(arguments);
  sendEmail(name, user['email_address'], function(err) {
    if (err) return callback(err);
    sendRedditMessage(name, user.name, function(err) {
      if (err) return callback(err);
      callback();
    });
  })
}


module.exports = function(robot) {

  robot.respond(/excuse @?(.*) for ([0-9]*) day(:?s)?/i, function(msg) {
    var user = robot.brain.userForName(msg.match[1]);
    var boss = msg.envelope.user;
    var days = parseInt(msg.match[2]);

    if (!canExcuse(boss)) {
      return msg.reply('You are not premitted to excuse people');
    }

    if (user.id == boss.id && user.roles.indexOf('super') === -1) {
      return msg.reply('You can not excuse yourself, please contact ' +
                       'your manager or #admin-hr');
    }

    if (debug) {
      user.lastSeen = now() - (days * 24 * 60 * 60 * 1000);
      user.killed = user.warned = false;
      hasStartedCheckAttendence = false;
      // checkAttendence(robot, true);
      log("User:");
      log(user);
      log("Boss:");
      log(boss);
    } else {
      user.exemptUntil = now() + (days * 24 * 60 * 60 * 1000);
    }

    msg.reply('Ok. @' + user.name + ' is excused until ' +
              new Date(user.exemptUntil).toUTCString().replace('GMT', 'UTC') +
              '.\nHave a nice day!');
  });

  robot.hear(/[\s\S.]*/, function(msg) {
    if (!debug) {
      msg.envelope.user.lastSeen = now();
    }
  });

  robot.respond(/check/, function() {
    checkAttendence(robot, true);
  });

  robot.respond(/status (?:for|of) @?(.*)/i, function(msg) {
    var user = robot.brain.userForName(msg.match[1]);
    if (!user) return msg.reply('User not found.')
    var absentUntil = new Date(user.exemptUntil);
    absentUntil.setMinutes(absentUntil.getTimezoneOffset())
    msg.reply('@' + user.name + ' is ' + (user.exemptUntil ? 'absent until '
              + absentUntil : 'not absent'));
  });

  checkAttendence(robot, false);
};

function checkAttendence(robot, isTimer) {
  logRobot = robot;
  log('check');
  var users = robot.brain.users();

  // log(users);
  for (var id in users) {
    var user = users[id];
    user.lastSeen = user.lastSeen || now();
    user.warned = user.killed = false;
    if (user.exemptUntil === now()) {
      user.lastSeen = now();
      user.exemptUntil = null;
    } else if (user.exemptUntil) { // noop
    } else if (now() -
               user.lastSeen >=
               3 *
               7 *
               24 *
               60 *
               60 *
               1000 &&
               !user.killed) {
      killUser(robot, user);
    } else if (now() -
               user.lastSeen >=
               2 *
               7 *
               24 *
               60 *
               60 *
               1000 &&
               !user.warned &&
               !user.killed) {
      sendWarnings(robot, user);
    }
  }
  CheckAttendenceTimer = setTimeout(checkAttendence.bind(this, robot, true),
                                    24 * 60 * 60 * 1000); // Run once a day
}

function sendWarnings(robot, user) {
  log('Sending Warnings to: ');
  log(user);
  sendMessages('warning', user, function(err) {
    if (err) return log(err);
  });
  user.warned = true;
}

function killUser(robot, user) {
  log('Killing: ');
  log(user);
  if (process.env.DELETE_USERS) {
    robot.adapter.client._apiCall('users.admin.setInactive', { user: user.id },
                                  function(res) {
                                    log('User: ' +
                                        user.name +
                                        ' terminated with response: ');
                                    log(res);
                                  });
  } else {
    console.log('WARNING: Not removing users. If you\'d like to, please set' +
                'DELETE_USERS to true');
  }

  sendMessages('goodbye', user, function(err) {
    if (err) return log(err);
  });

  user.killed = true;
}
