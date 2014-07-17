var fmt = (function() {
  var fmt = {};

  fmt.months = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec'
  ];

  fmt.tick_year5 = function(time) {
    return time.getFullYear();
  };
  fmt.tick_year = function(time) {
    return time.getFullYear();
  };
  fmt.tick_quarter = function(time) {
    var month = time.getMonth();
    var parts = [this.getMonthName(time)];
    if (0 === month) {
      parts.push(time.getFullYear());
    }
    return parts.join('<br>');
  };
  fmt.tick_month = function(time) {
    var month = time.getMonth();
    var parts = [this.getMonthName(time)];
    if (0 === month) {
      parts.push(time.getFullYear());
    }
    return parts.join('<br>');
  };

  fmt.tick_decade = function(time) {
    var month = time.getMonth();
    var date = time.getDate();
    var parts = [date];
    if (1 === date) {
      parts.push(this.getMonthName(time));
      if (0 === month) {
        parts.push(time.getFullYear());
      }
    }
    return parts.join('<br>');
  };


  fmt.getMonthName = function(time) {
    return this.months[time.getMonth()];
  };

  fmt.tickLabel = function(day, time, unit) {
    var method = 'tick_' + unit;
    return this[method](time);
  };

  fmt.stopLabel = function(day, time) {
    var yearLabel = time.getFullYear();
    var dateLabel = time.getDate();

    var monthLabel = this.getMonthName(time);
    return [dateLabel, monthLabel, yearLabel].join('<br />');
  };

  return fmt;
}());