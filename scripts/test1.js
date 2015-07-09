module.exports = function(robot) {
	robot.respond(/test/i, function(msg){
		msg.reply('Pizza');
	})
}