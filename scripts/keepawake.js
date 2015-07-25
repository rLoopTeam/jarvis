module.exports = function (robot) {
	setInterval(function(){
		robot.adapter.client.setPresence("active", function (res) {
			console.log("keepalive res:");
			console.log(res);
		});
		robot.send({ room: 'slackbot' }, "Hi Slackbot! Just staying awake. The time is: " + new Date());
	}, 14 * 60 * 1000);
}
