/*! pipeline - v0.0.0 - 2014-07-15
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
var MS_IN_DAY = 60 * 60 * 24 * 1000;
var START_DAY = timeToDay(new Date(2000, 0, 0));

var STATE_IDLE = 'idle';
var STATE_WAIT_DRAG = 'wait';
var STATE_DRAGGING = 'dragging';

var CLASS_ROOT = 'ppl-root';
var CLASS_STOP = 'ppl-stop-marker';
var CLASS_TICK = 'ppl-tick-marker';
var CLASS_INTERVAL = 'ppl-interval';
var CLASS_INTERVAL_CONTAINER = 'ppl-interval-container';
var CLASS_STOP_CONTAINER = 'ppl-stop-container';
var CLASS_RULER_CONTAINER = 'ppl-ruler-container';
var CLASS_WRAPPER = 'ppl-wrapper';

var ZOOMING_BASE_NUMBER = 128;
var ZOOMING_MAX = 7;
var ZOOMING_RESOLUTION = 5; //, px/unit

var DRAG_TIMEOUT = 200; //, ms
var SCROLL_TIMEOUT = 300; //, ms
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
}

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
};

PipelineModel.prototype._registerStop = function(stop) {
  this._stopsByDay[stop.value] = stop;
  this._stopsByGuid[stop.guid] = stop;
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

PipelineModel.prototype.removeStop = function(stop) {
  //TODO: check if it is mine
  var nextStop = stop.next;
  var prevStop = stop.prev;

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
    var date = dayToTime(d);
    if (ticker(date)) {
      this.addTick(d);
    }
  }
  console.timeEnd('a');
};

Ruler.prototype.addTick = function(day) {
  var t = new TickMarker();
  t.render();
  t.setOffset(this.masterView.dayToOffset(day));
  this.element.append(t.$);
};

//-----------------------------
function TickMarker() {
  this.$ = this.render();
}

TickMarker.prototype.render = function() {
  return $('<div class="' + CLASS_TICK + '">');
};

TickMarker.prototype.setOffset = function(off) {
  this.offset = off;
  this.$.css('left', off);
};

TickMarker.prototype.getOffset = function() {
  return this.offset;
};
function Pipeline() {
  this._onStopMarkerClick = this._onStopMarkerClick.bind(this);
  this._onStopMarkerMouseDown = this._onStopMarkerMouseDown.bind(this);
  this._onIntervalClick = this._onIntervalClick.bind(this);
  this._onMouseUp = this._onMouseUp.bind(this);
  this._onMouseMove = this._onMouseMove.bind(this);
  this._onRootScroll = debounce(this._onRootScroll.bind(this), SCROLL_TIMEOUT);

  this._onAddStop = this._onAddStop.bind(this);
  this._onRemoveStop = this._onRemoveStop.bind(this);
  this._onChangeStopDay = this._onChangeStopDay.bind(this);
  this._onBoundsChange = this._onBoundsChange.bind(this);

  this._state = STATE_IDLE;

  this._stopMarkersByGuid = [];

  this.model = new PipelineModel();
  this.render();
  this.model.syncBounds();

  this._initListeners();

  this.setZoom(7);
}

// Pipeline.prototype._createStop = function() {
//  return new Stop();
// };
// Pipeline.prototype._createInterval = function() {
//  return new Interval();
// };


Pipeline.prototype.render = function() {
  if (this.$) {
    return this.$.root;
  }

  this.$ = {};
  var root = this._renderRoot();


  var wrapper = this.$.wrapper = this._renderWrapper();
  var stopContainer = this.$.stopContainer = this._renderStopContainer();
  var intervalContainer = this.$.intervalContainer = this._renderIntervalContainer();
  var rulerContainer = this.$.rulerContainer = this._renderRulerContainer();

  this.ruler = new Ruler(this, rulerContainer);

  root.append(wrapper);
  wrapper.append(rulerContainer);
  wrapper.append(intervalContainer);
  wrapper.append(stopContainer);

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

Pipeline.prototype._renderIntervalContainer = function() {
  return $('<div class="' + CLASS_INTERVAL_CONTAINER + '">');
};

Pipeline.prototype._renderRulerContainer = function() {
  return $('<div class="' + CLASS_RULER_CONTAINER + '">');
};

// Pipeline.prototype.getStopByIndex = function(index) {};

// Pipeline.prototype.getStopByDay = function(day) {};

// Pipeline.prototype.getIntervalByIndex = function(index) {};

// Pipeline.prototype.getIntervalByDay = function(day) {};

// Pipeline.prototype.addStop = function(day) {

// };

// Pipeline.prototype.removeStop = function(stop) {};

Pipeline.prototype.selectStop = function(stop) {
  if (this._selectedStop) {
    this._stopMarkerByStop(this._selectedStop).setSelected(false);
  }

  this._selectedStop = stop;
  this._stopMarkerByStop(stop).setSelected(true);
};

// Pipeline.prototype.selectInterval = function(interval) {};

Pipeline.prototype.getZoom = function() {
  return this._z;
};

Pipeline.prototype.setZoom = function(zoom) {
  if (zoom < 0 || zoom > ZOOMING_MAX) {
    throw new RangeError('zoom');
  }
  this._z = zoom;
  this._pixelsADay = Math.pow(2, zoom) * ZOOMING_RESOLUTION / ZOOMING_BASE_NUMBER;

  this._updateViewportInfo();
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
};

Pipeline.prototype.isStateDragging = function() {
  return this._state === STATE_DRAGGING;
};

Pipeline.prototype.setStateIdle = function() {
  console.log('STATE_IDLE');
  this._state = STATE_IDLE;
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

Pipeline.prototype._updateViewportInfo = function() {
  var scrollStart = this.$.root[0].scrollLeft;
  var width = this.$.root[0].clientWidth;
  var scrollEnd = scrollStart + width;
  var dayStart = this.offsetToDay(scrollStart);
  var dayEnd = this.offsetToDay(scrollEnd);
  this.dayStart = dayStart;
  this.dayEnd = dayEnd;
  // console.log(dayStart, dayEnd);
  this._updateRuler();
};

Pipeline.prototype._updateRuler = function() {
  this.ruler.update(this.dayStart, this.dayEnd);
};

Pipeline.prototype._initListeners = function() {
  var root = this.$.root;
  var body = $('body');
  root.on('click', '.' + CLASS_STOP, this._onStopMarkerClick);
  root.on('click', '.' + CLASS_INTERVAL, this._onIntervalClick);
  root.on('mousedown', '.' + CLASS_STOP, this._onStopMarkerMouseDown);
  root.on('scroll', this._onRootScroll);

  body.on('mouseup', this._onMouseUp);
  body.on('mousemove', this._onMouseMove);

  this.model.bind('addStop', this._onAddStop);
  this.model.bind('removeStop', this._onRemoveStop);
  this.model.bind('changeStopDay', this._onChangeStopDay);
  this.model.bind('boundsChange', this._onBoundsChange);
};

Pipeline.prototype._onWaitDragTimeout = function() {
  this.setStateDragging();
};

Pipeline.prototype._stopFromEvent = function(e) {
  var guid = $(e.target).attr('guid');
  if (!guid) {
    throw new Error('no guid in event.target');
  }
  var stop = this.model.stopByGuid(guid);
  if (!stop) {
    throw new Error('stop not found');
  }
  return stop;
};

Pipeline.prototype._onStopMarkerClick = function(e) {
  var stop = this._stopFromEvent(e);
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

Pipeline.prototype._onIntervalClick = function() {};

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
    offset = this.dayToOffset(this.offsetToDay(offset));
    if (this._dragMaxOffset !== null && offset >= this._dragMaxOffset) {
      offset = this._dragMaxOffset;
    }
    if (this._dragMinOffset !== null && offset <= this._dragMinOffset) {
      offset = this._dragMinOffset;
    }
    this._stopMarkerByStop(this._selectedStop).setOffset(offset);
    return;
  }
};

Pipeline.prototype._onAddStop = function(stop) {
  this._addStopMarker(stop);
};

Pipeline.prototype._onRemoveStop = function(stop) {};

Pipeline.prototype._onBoundsChange = function() {
  this.setBounds(this.model.lowerBound, this.model.higherBound);
};

Pipeline.prototype.setBounds = function(lower, higher) {
  var higherOffset = this.dayToOffset(higher);
  var lowerOffset = this.dayToOffset(lower);
  console.log('lowerOffset', lowerOffset);
  console.log('higherOffset', higherOffset);
};

Pipeline.prototype._onChangeStopDay = function(stop) {
  var offset = this.dayToOffset(stop.value);
  var marker = this._stopMarkerByStop(stop);
  marker.setOffset(offset);
};


Pipeline.prototype._addStopMarker = function(stop) {
  var day = stop.value;
  var offset = this.dayToOffset(day);
  var marker = new StopMarker({
    guid: stop.guid
  });
  marker.setOffset(offset);
  this.$.stopContainer.append(marker.$);
  this._registerStopMarker(marker, stop);

};

Pipeline.prototype._stopMarkerByStop = function(stop) {
  return this._stopMarkersByGuid[stop.guid];
};

Pipeline.prototype._registerStopMarker = function(marker, stop) {
  this._stopMarkersByGuid[stop.guid] = marker;
};

Pipeline.prototype._unregisterStopMarker = function(stop) {
  delete this._stopMarkersByGuid[stop.guid];
};


Pipeline.prototype.destroy = function() {
  this.$.off('click');
  this.$.off('mousedown');
  this.$.off('mouseup');
  this.$.off('mousemove');
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
  return $('<div class="' + CLASS_STOP + '">');
};

StopMarker.prototype.setOffset = function(off) {
  this.offset = off;
  this.$.css('left', off);
};

StopMarker.prototype.getOffset = function() {
  return this.offset;
};


StopMarker.prototype.setSelected = function(value) {
  value && this.$.addClass('active') || this.$.removeClass('active');
};

StopMarker.prototype.setDragging = function(value) {
  value && this.$.addClass('dragging') || this.$.removeClass('dragging');
};
//-----------------------------

function Interval() {}

Interval.prototype.render = function() {
  return $('<div class="' + CLASS_INTERVAL + '">');
};
return Pipeline;
}());