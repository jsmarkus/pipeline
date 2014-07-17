/*globals $,CLASS_TICK*/

var zoomTable = [{
  unit: 'year5'
}, {
  unit: 'year'
}, {
  unit: 'year'
}, {
  unit: 'quarter'
}, {
  unit: 'quarter'
}, {
  unit: 'month'
}, {
  unit: 'month'
}, {
  unit: 'decade'
}];

var isStartOf = {
  year5: function(date) {
    return (date.getYear() % 5) === 0 && date.getMonth() === 0 && date.getDate() === 1;
  },
  year: function(date) {
    return date.getMonth() === 0 && date.getDate() === 1;
  },
  quarter: function(date) {
    var month = date.getMonth();
    return date.getDate() === 1 && (month % 4) === 0;
  },
  month: function(date) {
    return date.getDate() === 1;
  },
  decade: function(date) {
    var day = date.getDate();
    return day === 1 || day === 11 || day === 21;
  }
};

function Ruler(masterView, element) {
  this.masterView = masterView;
  this.element = element;
}

Ruler.prototype.update = function(start, end) {
  console.time('a');
  this.element.children().remove();
  this.ticks = [];
  var date;
  var zoom = this.masterView.getZoom();
  var unit = zoomTable[zoom].unit;
  var ticker = isStartOf[unit];
  for (var d = start; d <= end; d++) {
    date = dayToTime(d);
    if (ticker(date)) {
      this.addTick(d, unit);
    }
  }
  console.timeEnd('a');
};

Ruler.prototype.addTick = function(day, unit) {
  var t = new TickMarker();
  t.render();
  t.setOffset(this.masterView.dayToOffset(day));
  t.setContent(this.masterView._fmt.tickLabel(day, dayToTime(day), unit));
  this.element.append(t.$);
};

//-----------------------------
function TickMarker() {};

TickMarker.prototype.render = function() {
  var root = $('<div class="' + CLASS_TICK + '">');
  var content = $('<div class="' + CLASS_TICK_DATE + '">');
  content.appendTo(root);
  this.$content = content;
  this.$ = root;
};

TickMarker.prototype.setOffset = function(off) {
  this.offset = off;
  this.$.css('left', off);
};

TickMarker.prototype.setContent = function(html) {
  this.$content.html(html);
};

TickMarker.prototype.getOffset = function() {
  return this.offset;
};