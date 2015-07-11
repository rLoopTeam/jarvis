module.exports = function (robot) {
	setInterval(function(){
		robot.adapter.client.setPresence("active", function (res) {
			console.log("keepalive res:");
			console.log(res);
		});
	}, 14 * 60 * 1000);
}
