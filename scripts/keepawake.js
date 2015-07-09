module.exports = function (robot) {
	setInterval(function(){
		robot.adapter.client.setPresence("active", function(){});
	}, 14 * 60 * 1000);
}
