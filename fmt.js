var fmt = (function() {
	var fmt = {};

	fmt.tickLabel = function(day, time, unit) {
		return '#' + day;
	};

	fmt.stopLabel = function(day, time) {
		return '#' + day;
	};

	return fmt;
}());