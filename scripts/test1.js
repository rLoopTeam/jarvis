module.exports = function(robot) {
	robot.respond(/test2/i, function(msg){
		msg.reply('Winner!!');
	})
	robot.respond(/king/i, function(msg){
		msg.reply('All Hail The King, Ari Porad!');
	})
}