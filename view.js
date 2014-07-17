/*global $,PipelineModel,debounce,Ruler,fmt*/



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

Pipeline.prototype._recalculatePositions = function(animate) {
  var currentStop = this.model.firstStop;
  while (currentStop) {
    var marker = this._stopMarkerByStop(currentStop);
    marker.setOffset(this.dayToOffset(currentStop.value), animate);
    currentStop = currentStop.next;
  }
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

    return;
  }
};

Pipeline.prototype._onAddStop = function(stop) {
  this._addStopMarker(stop);
};

Pipeline.prototype._onRemoveStop = function(stop) {};

Pipeline.prototype._onBoundsChange = function() {
  this._updateWidth();
};

Pipeline.prototype._onChangeStopDay = function(stop) {
  var offset = this.dayToOffset(stop.value);
  var marker = this._stopMarkerByStop(stop);
  marker.setOffset(offset);
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

function Interval() {}

Interval.prototype.render = function() {
  return $('<div class="' + CLASS_INTERVAL + '">');
};