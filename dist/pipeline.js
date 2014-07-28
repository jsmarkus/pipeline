/*! pipeline - v0.0.0 - 2014-07-28
* Copyright (c) 2014 Plarium; Licensed MIT */
window.Pipeline = (function() {
function timeToDay(time) {
  return Math.floor(time / MS_IN_DAY);
}

function dayToTime(day) {
  return new Date(day * MS_IN_DAY);
}



function debounce(func, wait, immediate) {
  var timeout;
  return function() {
    var context = this,
      args = arguments;
    clearTimeout(timeout);
    timeout = setTimeout(function() {
      timeout = null;
      if (!immediate) {
        func.apply(context, args);
      }
    }, wait);
    if (immediate && !timeout) {
      func.apply(context, args);
    }
  };
};
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
var MS_IN_DAY = 60 * 60 * 24 * 1000;
var START_DAY = timeToDay(new Date(2000, 0, 0));

var STATE_IDLE = 'idle';
var STATE_WAIT_DRAG = 'wait';
var STATE_DRAGGING = 'dragging';

var CLASS_ROOT = 'ppl-root ppl-root-scrollbody';
var CLASS_STOP = 'ppl-stop';
var CLASS_STOP_DATE = 'ppl-stop-date';
var CLASS_STOP_LINE = 'ppl-stop-line';
var CLASS_TICK = 'ppl-ruler-tick base';
var CLASS_TICK_DATE = 'base-item';
var CLASS_INTERVAL = 'ppl-interval';
var CLASS_INTERVAL_CONTAINER = 'ppl-interval-container';
var CLASS_STOP_CONTAINER = 'ppl-stop-container';
var CLASS_RULER_CONTAINER = 'ppl-ruler';
var CLASS_WRAPPER = 'ppl-root-wrapper';
var CLASS_HAIR = 'ppl-hair';

var CLASS_DRAGGING = 'draggable';
var CLASS_HOVER = 'hover';
var CLASS_ACTIVE = 'active';

var ZOOMING_BASE_NUMBER = 128;
var ZOOMING_MAX = 7;
var ZOOMING_RESOLUTION = 5; //, px/unit
var ZOOMING_ANIMATION_DURATION = 150; //, ms

var DRAG_TIMEOUT = 200; //, ms
var SCROLL_TIMEOUT = 300; //, ms

var WIDTH_MARGIN = 200; //, px
var MicroEvent = function() {};
MicroEvent.prototype = {
  bind: function(event, fct) {
    this._events = this._events || {};
    this._events[event] = this._events[event] || [];
    this._events[event].push(fct);
  },
  unbind: function(event, fct) {
    this._events = this._events || {};
    if (event in this._events === false) {
      return;
    }
    this._events[event].splice(this._events[event].indexOf(fct), 1);
  },
  trigger: function(event /* , args... */ ) {
    this._events = this._events || {};
    if (event in this._events === false) {
      return;
    }
    for (var i = 0; i < this._events[event].length; i++) {
      this._events[event][i].apply(this, Array.prototype.slice.call(arguments, 1));
    }
  }
};


MicroEvent.mixin = function(destObject) {
  var props = ['bind', 'unbind', 'trigger'];
  for (var i = 0; i < props.length; i++) {
    if (typeof destObject === 'function') {
      destObject.prototype[props[i]] = MicroEvent.prototype[props[i]];
    } else {
      destObject[props[i]] = MicroEvent.prototype[props[i]];
    }
  }
};
function GUID() {
  return (new Date() | 0).toString(16) + ((Math.random() * 1e9) | 0).toString(16);
}



function PipelineModel() {
  this.firstStop = null;
  this._stopsByDay = {};
  this._stopsByGuid = {};
  this._intervalsByGuid = {};
  this._attachInterval(this._createInterval(), null, null);
}

PipelineModel.prototype._createInterval = function(fromStop, toStop) {
  var interval = new Interval(fromStop, toStop);
  this._registerInterval(interval);
  return interval;
};

PipelineModel.prototype.addStop = function(day) {
  if (this.stopByDay(day)) {
    throw new Error('day exists');
  }

  var prev = this.findPreviousStop(day);
  var stop = new Stop(day);
  this._insertStopAfter(stop, prev);
  this._registerStop(stop);

  this.syncBounds();
  this.trigger('addStop', stop);

  // var intervalToSplit = this.getBoundingInterval(day);

  this._splitInterval(stop);
};

PipelineModel.prototype._detachInterval = function(interval) {
  if (interval.from) {
    interval.from.nextInterval = null;
    interval.from = null;
  }
  if (interval.to) {
    interval.to.prevInterval = null;
    interval.to = null;
  }
  if (interval === this._startInterval) {
    this._startInterval = null;
  }
};

PipelineModel.prototype._attachInterval = function(interval, fromStop, toStop) {
  if (!fromStop) {
    if (!this._startInterval) {
      this._startInterval = interval;
    } else {
      throw new Error('cannot attach starting interval twice');
    }
  } else {
    fromStop.nextInterval = interval;
  }

  if (toStop) {
    toStop.prevInterval = interval;
  }

  interval.from = fromStop;
  interval.to = toStop;

  this.trigger('changeInterval', interval);
};

PipelineModel.prototype._joinIntervals = function(removingStop) {
  var leftInterval = removingStop.prevInterval;
  var rightInterval = removingStop.nextInterval;
  var leftStop = leftInterval.from;
  var rightStop = rightInterval.to;
  this._detachInterval(rightInterval);
  this.trigger('removeInterval', rightInterval);
  this._unregisterInterval(rightInterval);
  this._detachInterval(leftInterval);
  this._attachInterval(leftInterval, leftStop, rightStop);
};

PipelineModel.prototype._splitInterval = function(insertedStop) {
  var prevStop = insertedStop.prev;
  var nextStop = insertedStop.next;
  var leftInterval = prevStop ? prevStop.nextInterval : this._startInterval;
  if (!leftInterval) {
    throw new Error('integrity error: interval not found');
  }
  this._detachInterval(leftInterval);
  var rightInterval = this._createInterval(insertedStop, nextStop);
  this._attachInterval(rightInterval, insertedStop, nextStop);
  this._attachInterval(leftInterval, prevStop, insertedStop);
};

// PipelineModel.prototype._addInterval = function(fromStop, toStop) {
//   var interval = new Interval(fromStop, toStop);
//   this._attachInterval(interval, fromStop, toStop);
// };

PipelineModel.prototype.getBoundingInterval = function(value) {
  var prevStop = this.findPreviousStop(value);
  var interval;
  if (!prevStop) {
    interval = this._startInterval;
  } else {
    interval = prevStop.nextInterval;
  }
  if (!interval) {
    throw new Error('integrity error: interval not found');
  }
  return interval;
};

PipelineModel.prototype._registerStop = function(stop) {
  this._stopsByDay[stop.value] = stop;
  this._stopsByGuid[stop.guid] = stop;
};

PipelineModel.prototype._registerInterval = function(interval) {
  this._intervalsByGuid[interval.guid] = interval;
};

PipelineModel.prototype._unregisterInterval = function(interval) {
  delete this._intervalsByGuid[interval.guid];
};

PipelineModel.prototype._unregisterStop = function(stop) {
  delete this._stopsByDay[stop.value];
  delete this._stopsByGuid[stop.guid];
};


PipelineModel.prototype.stopByDay = function(day) {
  return this._stopsByDay[day] || null;
};

PipelineModel.prototype.stopByGuid = function(guid) {
  return this._stopsByGuid[guid] || null;
};

PipelineModel.prototype.intervalByGuid = function(guid) {
  return this._intervalsByGuid[guid] || null;
};

PipelineModel.prototype.removeStop = function(stop) {
  //TODO: check if it is mine
  var nextStop = stop.next;
  var prevStop = stop.prev;

  this._joinIntervals(stop);


  if (nextStop) {
    nextStop.prev = prevStop;
  }
  if (prevStop) {
    prevStop.next = nextStop;
  } else {
    this.firstStop = nextStop;
  }

  if (stop === this.lastStop) {
    this.lastStop = stop.prev;
  }

  stop.prev = null;
  stop.next = null;


  this.syncBounds();
  this.trigger('removeStop', stop);

  this._unregisterStop(stop);

};


PipelineModel.prototype._getLowerBound = function() {
  if (this.firstStop) {
    return this.firstStop.value;
  } else {
    return 10955; //TODO: encode year 2000 in other way!
  }
};

PipelineModel.prototype._getHigherBound = function() {
  if (this.lastStop) {
    return this.lastStop.value;
  } else {
    return 10955 + 20 * 365; //TODO: encode year 2020 in other way!
  }
};


PipelineModel.prototype.syncBounds = function() {
  var actualLowerBound = this._getLowerBound();
  var changed = false;
  if (actualLowerBound !== this.lowerBound) {
    this.lowerBound = actualLowerBound;
    changed = true;
  }

  var actualHigherBound = this._getHigherBound();
  if (actualHigherBound !== this.higherBound) {
    this.higherBound = actualHigherBound;
    changed = true;
  }

  if (changed) {
    this.trigger('boundsChange');
  }
};

PipelineModel.prototype.changeStopDay = function(stop, day) {
  day = day | 0;
  if (day === stop.value) {
    return;
  }
  var prevStop = stop.prev;
  if (prevStop && day <= prevStop.value) {
    throw new RangeError('lower bound');
  }
  var nextStop = stop.next;
  if (nextStop && day >= nextStop.value) {
    throw new RangeError('higher bound');
  }

  delete this._stopsByDay[stop.value];
  stop.value = day;
  this._stopsByDay[day] = stop;
  this.syncBounds();
  this.trigger('changeStopDay', stop);
};

PipelineModel.prototype._insertStopAfter = function(stop, prevStop) {
  if (!prevStop) {
    if (this.firstStop) {
      this.firstStop.prev = stop;
      stop.next = this.firstStop;
    }
    this.firstStop = stop;
    this.lastStop = stop;
    return;
  }

  var nextStop = prevStop.next;
  if (nextStop) {
    nextStop.prev = stop;
  }
  prevStop.next = stop;
  stop.prev = prevStop;
  stop.next = nextStop;
  if (prevStop === this.lastStop) {
    this.lastStop = stop;
  }
};

PipelineModel.prototype.findPreviousStop = function(value) {
  var cur = this.firstStop;
  while (cur) {
    if (!cur.next && cur.value < value) {
      return cur;
    }
    if (cur.value > value) {
      return cur.prev;
    }
    cur = cur.next;
  }
  return cur;
};

MicroEvent.mixin(PipelineModel);

//--------------

function Stop(value) {
  this.value = value;
  this.next = null;
  this.prev = null;
  this.guid = GUID();
}
//--------------

function Interval(from, to) {
  this.from = from;
  this.to = to;
  this.guid = GUID();
}
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
function Pipeline() {
  this._onStopContainerDoubleClick = this._onStopContainerDoubleClick.bind(this);
  this._onStopMarkerMouseDown = this._onStopMarkerMouseDown.bind(this);
  this._onStopMarkerDoubleClick = this._onStopMarkerDoubleClick.bind(this);
  this._onIntervalClick = this._onIntervalClick.bind(this);
  this._onMouseUp = this._onMouseUp.bind(this);
  this._onMouseMove = this._onMouseMove.bind(this);
  this._onRootScroll = debounce(this._onRootScroll.bind(this), SCROLL_TIMEOUT);

  this._onAddStop = this._onAddStop.bind(this);
  this._onRemoveStop = this._onRemoveStop.bind(this);
  this._onChangeStopDay = this._onChangeStopDay.bind(this);
  this._onBoundsChange = this._onBoundsChange.bind(this);
  this._onChangeInterval = this._onChangeInterval.bind(this);
  this._onRemoveInterval = this._onRemoveInterval.bind(this);

  this._state = STATE_IDLE;

  this._stopMarkersByGuid = {};
  this._intervalMarkersByGuid = {};
  this._fmt = {};

  this.setFormatters(fmt);

  this.model = new PipelineModel();
  this.render();
  this.model.syncBounds();

  this._initListeners();

  this.setZoom(7);
}


Pipeline.prototype.setFormatters = function(formatters) {
  for (var fmtName in formatters) {
    if (formatters.hasOwnProperty(fmtName)) {
      this._fmt[fmtName] = formatters[fmtName];
    }
  }
};

Pipeline.prototype.render = function() {
  if (this.$) {
    return this.$.root;
  }

  this.$ = {};
  var root = this._renderRoot();


  var wrapper = this.$.wrapper = this._renderWrapper();
  var hair = this.$.hair = this._renderHair();
  var stopContainer = this.$.stopContainer = this._renderStopContainer();
  var intervalContainer = this.$.intervalContainer = this._renderIntervalContainer();
  var rulerContainer = this.$.rulerContainer = this._renderRulerContainer();

  this.ruler = new Ruler(this, rulerContainer);

  root.append(wrapper);
  wrapper.append(rulerContainer);
  wrapper.append(intervalContainer);
  wrapper.append(stopContainer);
  wrapper.append(hair);

  this.$.root = root;

  setTimeout(this._updateViewportInfo.bind(this), 100);
  // this._updateViewportInfo();

  return root;
};

Pipeline.prototype._renderRoot = function() {
  return $('<div class="' + CLASS_ROOT + '">');
};

Pipeline.prototype._renderStopContainer = function() {
  return $('<div class="' + CLASS_STOP_CONTAINER + '">');
};

Pipeline.prototype._renderWrapper = function() {
  return $('<div class="' + CLASS_WRAPPER + '">');
};

Pipeline.prototype._renderHair = function() {
  return $('<div class="' + CLASS_HAIR + '">');
};

Pipeline.prototype._renderIntervalContainer = function() {
  return $('<div class="' + CLASS_INTERVAL_CONTAINER + '">');
};

Pipeline.prototype._renderRulerContainer = function() {
  return $('<div class="' + CLASS_RULER_CONTAINER + '">');
};

Pipeline.prototype._unselectAnyStop = function() {
  this._selectedStop = null;
};

Pipeline.prototype.selectStop = function(stop) {
  if (this._selectedStop) {
    this._stopMarkerByStop(this._selectedStop).setSelected(false);
  }

  this._selectedStop = stop;
  this._stopMarkerByStop(stop).setSelected(true);
};

Pipeline.prototype.getSelectedStopValue = function() {
  var stop = this._selectedStop;
  if (!stop) {
    return null;
  }
  return stop.value || null;
};

Pipeline.prototype.getCenter = function() {
  return ((this.dayStart + this.dayEnd) / 2) | 0;
};

Pipeline.prototype.setCenter = function(value) {
  var currentCenterPx = this.dayToOffset(this.getCenter());
  var newCenterPx = this.dayToOffset(value);
  var deltaScrollPx = currentCenterPx - newCenterPx;
  this._scrollByPx(-deltaScrollPx);
};

Pipeline.prototype.getZoom = function() {
  return this._z;
};

Pipeline.prototype.setZoom = function(zoom) {
  if (zoom < 0 || zoom > ZOOMING_MAX) {
    throw new RangeError('zoom');
  }
  this._z = zoom;
  this._pixelsADay = Math.pow(2, zoom) * ZOOMING_RESOLUTION / ZOOMING_BASE_NUMBER;

  var center = this.getSelectedStopValue();
  if (null === center) {
    center = this.getCenter();
  }


  this._updateViewportInfo();
  this._recalculatePositions(true);
  this._updateWidth();

  setTimeout(this.setCenter.bind(this, center), ZOOMING_ANIMATION_DURATION);

};

Pipeline.prototype.zoomPlus = function() {
  var zoom = this.getZoom();
  if (zoom < ZOOMING_MAX) {
    this.setZoom(zoom + 1);
  }
};

Pipeline.prototype.zoomMinus = function() {
  var zoom = this.getZoom();
  if (zoom > 0) {
    this.setZoom(zoom - 1);
  }
};

Pipeline.prototype.offsetToDay = function(offset) {
  var daysFromStart = offset / this._pixelsADay;
  var day = daysFromStart + START_DAY;
  return day | 0;
};

Pipeline.prototype.dayToOffset = function(day) {
  var daysFromStart = day - START_DAY;
  var offset = this._pixelsADay * daysFromStart;
  return offset | 0;
};

Pipeline.prototype.setStateDragging = function() {
  console.log('STATE_DRAGGING');
  this._state = STATE_DRAGGING;
  this._stopMarkerByStop(this._selectedStop).setDragging(true);


  var prevStop = this._selectedStop.prev;
  var nextStop = this._selectedStop.next;

  this._dragMinOffset = null;
  this._dragMaxOffset = null;
  if (prevStop) {
    this._dragMinOffset = this.dayToOffset(prevStop.value + 1);
  }
  if (nextStop) {
    this._dragMaxOffset = this.dayToOffset(nextStop.value - 1);
  }

  this._dragIntervalLeft = this._selectedStop.prevInterval;
  this._dragIntervalRight = this._selectedStop.nextInterval;
};

Pipeline.prototype.isStateDragging = function() {
  return this._state === STATE_DRAGGING;
};

Pipeline.prototype.setStateIdle = function() {
  console.log('STATE_IDLE');
  this._state = STATE_IDLE;
  this._dragIntervalLeft = null;
  this._dragIntervalRight = null;
};

Pipeline.prototype.isStateIdle = function() {
  return this._state === STATE_IDLE;
};

Pipeline.prototype.setStateWaitDrag = function() {
  console.log('STATE_WAIT_DRAG');
  this._state = STATE_WAIT_DRAG;
  this._waitDragTimer = setTimeout(this._onWaitDragTimeout.bind(this), DRAG_TIMEOUT);
};

Pipeline.prototype.isStateWaitDrag = function() {
  return this._state === STATE_WAIT_DRAG;
};

Pipeline.prototype._recalculatePositions = function(animate) {
  var currentStop = this.model.firstStop;
  this._updateIntervalMarker(this.model._startInterval);
  while (currentStop) {
    var marker = this._stopMarkerByStop(currentStop);
    marker.setOffset(this.dayToOffset(currentStop.value), animate);

    this._updateIntervalMarker(currentStop.nextInterval);

    currentStop = currentStop.next;
  }
  this._updateHair();
};

Pipeline.prototype._scrollByPx = function(delta) {
  var div = this.$.root[0];
  div.scrollLeft = div.scrollLeft + delta;
};

Pipeline.prototype._getScrollPx = function() {
  return this.$.root[0].scrollLeft;
};

Pipeline.prototype._getWidthPx = function() {
  return this.$.root[0].clientWidth;
};

Pipeline.prototype._updateViewportInfo = function() {
  var scrollStart = this._getScrollPx();
  var width = this._getWidthPx();
  var scrollEnd = scrollStart + width;
  var dayStart = this.offsetToDay(scrollStart);
  var dayEnd = this.offsetToDay(scrollEnd);
  this.dayStart = dayStart;
  this.dayEnd = dayEnd;
  // console.log(dayStart, dayEnd);
  this._updateRuler();
};

Pipeline.prototype._updateWidth = function() {
  var minWidth = this.dayToOffset(this.model.higherBound) + WIDTH_MARGIN;
  var viewWidth = this.$.root[0].clientWidth;
  this.$.wrapper.css('width', Math.max(minWidth, viewWidth));
};

Pipeline.prototype._updateHair = function() {
  var now = timeToDay(new Date());
  var offset = this.dayToOffset(now);
  this.$.hair.css({
    'left': offset
  });
};

Pipeline.prototype._updateRuler = function() {
  this.ruler.update(this.dayStart, this.dayEnd);
};

Pipeline.prototype._initListeners = function() {
  var root = this.$.root;
  var body = $('body');
  root.on('click', '.' + CLASS_INTERVAL, this._onIntervalClick);
  root.on('mousedown', '.' + CLASS_STOP, this._onStopMarkerMouseDown);
  root.on('dblclick', '.' + CLASS_STOP_CONTAINER, this._onStopContainerDoubleClick);
  root.on('dblclick', '.' + CLASS_STOP, this._onStopMarkerDoubleClick);
  root.on('scroll', this._onRootScroll);

  body.on('mouseup', this._onMouseUp);
  body.on('mousemove', this._onMouseMove);

  this.model.bind('addStop', this._onAddStop);
  this.model.bind('removeStop', this._onRemoveStop);
  this.model.bind('changeStopDay', this._onChangeStopDay);
  this.model.bind('boundsChange', this._onBoundsChange);
  this.model.bind('changeInterval', this._onChangeInterval);
  this.model.bind('removeInterval', this._onRemoveInterval);
};

Pipeline.prototype._onWaitDragTimeout = function() {
  this.setStateDragging();
};

Pipeline.prototype._stopFromEvent = function(e) {
  var guid = $(e.currentTarget).attr('guid');
  if (!guid) {
    throw new Error('no guid in event.target');
  }
  var stop = this.model.stopByGuid(guid);
  if (!stop) {
    throw new Error('stop not found');
  }
  return stop;
};

Pipeline.prototype._intervalFromEvent = function(e) {
  var guid = $(e.currentTarget).attr('guid');
  if (!guid) {
    throw new Error('no guid in event.target');
  }
  var interval = this.model.intervalByGuid(guid);
  if (!interval) {
    throw new Error('interval not found');
  }
  return interval;
};

Pipeline.prototype._onStopMarkerDoubleClick = function(e) {
  e.preventDefault();
  var stop = this._stopFromEvent(e);
  this.model.removeStop(stop);
};

Pipeline.prototype._onStopContainerDoubleClick = function(e) {
  if (e.target !== this.$.stopContainer[0]) {
    return;
  }

  var day = this.offsetToDay(this._localOffsetFromEvent(e));
  this.model.addStop(day);
};

Pipeline.prototype._onStopMarkerMouseDown = function(e) {
  e.preventDefault();
  var stop = this._stopFromEvent(e);
  this.selectStop(stop);

  if (this.isStateIdle()) {
    this.setStateWaitDrag();
    return;
  }
};

Pipeline.prototype._onRootScroll = function() {
  this._updateViewportInfo();
};

Pipeline.prototype._onIntervalClick = function(e) {
  var interval = this._intervalFromEvent(e);
  debugger
};

Pipeline.prototype._onMouseUp = function() {
  if (this.isStateWaitDrag()) {
    clearTimeout(this._waitDragTimer);
    this.setStateIdle();
    return;
  }
  if (this.isStateDragging()) {
    this._onDrop(this._selectedStop);
    this.setStateIdle();
    return;
  }
};


Pipeline.prototype._onDrop = function(stop) {
  var marker = this._stopMarkerByStop(stop);
  marker.setDragging(false);
  var offset = marker.getOffset();
  var day = this.offsetToDay(offset);

  try {
    this.model.changeStopDay(stop, day);
  } catch (e) {
    marker.setOffset(this.dayToOffset(stop.value));
  }
};

Pipeline.prototype._localOffsetFromEvent = function(e) {
  var root = this.$.root;
  var box = root[0].getBoundingClientRect();
  var left = box.left;
  var clientX = e.clientX;
  var scroll = root[0].scrollLeft;
  return clientX - left + scroll;
  // e.clientX;
};

Pipeline.prototype._onMouseMove = function(e) {
  if (this.isStateDragging()) {
    var offset = this._localOffsetFromEvent(e);
    var day = this.offsetToDay(offset);
    offset = this.dayToOffset(day); //<- rounding to one day

    if (this._dragMaxOffset !== null && offset >= this._dragMaxOffset) {
      offset = this._dragMaxOffset;
    }
    if (this._dragMinOffset !== null && offset <= this._dragMinOffset) {
      offset = this._dragMinOffset;
    }

    day = this.offsetToDay(offset); //TODO: store only min/max day, not offset, to avoid double conversion

    this._updateStopMarker(
      this._stopMarkerByStop(this._selectedStop),
      day);

    this._updateIntervalMarkerStart(this._dragIntervalRight, day);
    this._updateIntervalMarkerEnd(this._dragIntervalLeft, day);

    return;
  }
};

Pipeline.prototype._onAddStop = function(stop) {
  this._addStopMarker(stop);
};

Pipeline.prototype._onRemoveStop = function(stop) {
  this._removeStopMarker(stop);
};

Pipeline.prototype._onChangeInterval = function(interval) {
  this._updateIntervalMarker(interval);
};

Pipeline.prototype._onRemoveInterval = function(interval) {
  this._removeIntervalMarker(interval);
};

Pipeline.prototype._onBoundsChange = function() {
  this._updateWidth();
};

Pipeline.prototype._onChangeStopDay = function(stop) {
  var offset = this.dayToOffset(stop.value);
  var marker = this._stopMarkerByStop(stop);
  marker.setOffset(offset);
};


Pipeline.prototype._removeStopMarker = function(stop) {
  var marker = this._stopMarkerByStop(stop);
  if (this._selectedStop === stop) {
    this._unselectAnyStop();
  }
  marker.$.remove();
  this._unregisterStopMarker(marker);
};


Pipeline.prototype._removeIntervalMarker = function(interval) {
  var marker = this._intervalMarkerByInterval(interval);
  this._unregisterIntervalMarker(interval);
  marker.$.remove();
};


Pipeline.prototype._updateIntervalMarkerStart = function(interval, value) {
  var marker = this._intervalMarkerByInterval(interval);
  var start = this.dayToOffset(value);
  var end = interval.to ? this.dayToOffset(interval.to.value) : Infinity;
  marker.setBounds(start, end);
};

Pipeline.prototype._updateIntervalMarkerEnd = function(interval, value) {
  var marker = this._intervalMarkerByInterval(interval);
  var start = interval.from ? this.dayToOffset(interval.from.value) : 0;
  var end = this.dayToOffset(value);
  marker.setBounds(start, end);
};

Pipeline.prototype._updateIntervalMarker = function(interval, animate) {
  var marker = this._intervalMarkerByInterval(interval);
  if (!marker) {
    marker = new IntervalMarker({
      guid: interval.guid
    });
    this.$.intervalContainer.append(marker.$);
    this._registerIntervalMarker(marker, interval);
  }

  var left = interval.from ? this.dayToOffset(interval.from.value) : 0;
  var right = interval.to ? this.dayToOffset(interval.to.value) : Infinity;
  marker.setBounds(left, right, animate);
};

Pipeline.prototype._addStopMarker = function(stop) {
  var day = stop.value;
  var marker = new StopMarker({
    guid: stop.guid
  });


  this.$.stopContainer.append(marker.$);
  this._registerStopMarker(marker, stop);

  this._updateStopMarker(marker, day);
};

Pipeline.prototype._updateStopMarker = function(marker, day) {
  marker.setOffset(this.dayToOffset(day));
  marker.setContent(this._fmt.stopLabel(day, dayToTime(day)));
};

Pipeline.prototype._stopMarkerByStop = function(stop) {
  return this._stopMarkersByGuid[stop.guid];
};

Pipeline.prototype._intervalMarkerByInterval = function(interval) {
  return this._intervalMarkersByGuid[interval.guid];
};

Pipeline.prototype._registerIntervalMarker = function(marker, interval) {
  this._intervalMarkersByGuid[interval.guid] = marker;
};

Pipeline.prototype._registerStopMarker = function(marker, stop) {
  this._stopMarkersByGuid[stop.guid] = marker;
};

Pipeline.prototype._unregisterIntervalMarker = function(interval) {
  delete this._intervalMarkersByGuid[interval.guid];
};

Pipeline.prototype._unregisterStopMarker = function(stop) {
  delete this._stopMarkersByGuid[stop.guid];
};


Pipeline.prototype.destroy = function() {
  this.$.off('click');
  this.$.off('mousedown');
  this.$.off('mouseup');
  this.$.off('mousemove');
  //TODO: review
};

//-----------------------------

function StopMarker(options) {
  if (!options) {
    throw new Error('no options');
  }
  if (!options.guid) {
    throw new Error('no guid');
  }

  this.$ = this.render();
  this.$.attr('guid', this.guid = options.guid);
}

StopMarker.prototype.render = function() {
  var root = $('<div class="' + CLASS_STOP + '">');
  var date = $('<div class="' + CLASS_STOP_DATE + '">');
  var line = $('<div class="' + CLASS_STOP_LINE + '">');
  this.$content = date;
  root.append(line);
  root.append(date);
  return root;
};

StopMarker.prototype.setContent = function(html) {
  this.$content.html(html);
};

StopMarker.prototype.setOffset = function(offset, animate) {
  this.offset = offset;
  if (animate) {
    this.$.animate({
      'left': offset
    }, ZOOMING_ANIMATION_DURATION);
  } else {
    this.$.css('left', offset);
  }
};

StopMarker.prototype.getOffset = function() {
  return this.offset;
};


StopMarker.prototype.setSelected = function(value) {
  value && this.$.addClass(CLASS_ACTIVE) || this.$.removeClass(CLASS_ACTIVE);
};

StopMarker.prototype.setDragging = function(value) {
  value && this.$.addClass(CLASS_DRAGGING) || this.$.removeClass(CLASS_DRAGGING);
};
//-----------------------------

function IntervalMarker(options) {
  if (!options) {
    throw new Error('no options');
  }
  if (!options.guid) {
    throw new Error('no guid');
  }

  this.$ = this.render();
  this.$.attr('guid', this.guid = options.guid);
}

IntervalMarker.prototype.setBounds = function(left, right, animate) {
  var func;
  var el = this.$;
  if (animate) {
    func = function(params) {
      el.animate(params, ZOOMING_ANIMATION_DURATION);
    };
  } else {
    func = function(params) {
      el.css(params);
    };
  }


  func({
    'left': left
  });
  if (right === Infinity) {
    func({
      'width': '',
      'right': 0
    });
  } else {
    func({
      'width': right - left,
      'right': ''
    });
  }
};

IntervalMarker.prototype.render = function() {
  return $('<div class="' + CLASS_INTERVAL + '">');
};
return Pipeline;
}());