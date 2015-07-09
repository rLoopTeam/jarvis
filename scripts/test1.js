module.exports = function(robot) {
	robot.respond(/test/i, function(msg){
		msg.reply('Pizza');
	});
	robot.respond(/test2/i, function(msg){
		msg.reply('Winner!!');
	})
}