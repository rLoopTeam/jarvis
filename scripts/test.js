var room = "G06H0KVPE";

module.exports = function(robot) {
	setTimeout(function() {
	console.log(robot.adapter.client.getGroupByID(room).invite("U078ZF162"));
	console.log(robot.adapter.client.getGroupByID(room)._onInvite.toString());
	console.log('testing');
	}, 10000);

}
