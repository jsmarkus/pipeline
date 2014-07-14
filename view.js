/*global $,PipelineModel*/

var MS_IN_DAY = 60 * 60 * 24 * 1000;

var STATE_IDLE = 'idle';
var STATE_WAIT_DRAG = 'wait';
var STATE_DRAGGING = 'dragging';

var CLASS_ROOT = 'ppl-root';
var CLASS_STOP = 'ppl-stop-marker';
var CLASS_INTERVAL = 'ppl-interval';
var CLASS_INTERVAL_CONTAINER = 'ppl-interval-container';
var CLASS_STOP_CONTAINER = 'ppl-stop-container';
var CLASS_RULER_CONTAINER = 'ppl-ruler-container';

var ZOOMING_BASE_NUMBER = 128;
var ZOOMING_MAX = 7;
var ZOOMING_RESOLUTION = 5; //, px/unit

var DRAG_PAUSE = 200; //, ms

var START_DAY = timeToDay(new Date(2000, 0, 0));

function timeToDay(time) {
	return Math.floor(time / MS_IN_DAY);
}

function dayToTime(day) {
	return new Date(day * MS_IN_DAY);
}


function Pipeline() {
	this._onStopMarkerClick = this._onStopMarkerClick.bind(this);
	this._onStopMarkerMouseDown = this._onStopMarkerMouseDown.bind(this);
	this._onIntervalClick = this._onIntervalClick.bind(this);
	this._onMouseUp = this._onMouseUp.bind(this);
	this._onMouseMove = this._onMouseMove.bind(this);

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
// 	return new Stop();
// };
// Pipeline.prototype._createInterval = function() {
// 	return new Interval();
// };


Pipeline.prototype.render = function() {
	if (this.$) {
		return this.$.root;
	}

	this.$ = {};
	var root = this._renderRoot();


	var stopContainer = this.$.stopContainer = this._renderStopContainer();
	var intervalContainer = this.$.intervalContainer = this._renderIntervalContainer();
	var rulerContainer = this.$.rulerContainer = this._renderRulerContainer();

	root.append(rulerContainer);
	root.append(intervalContainer);
	root.append(stopContainer);
	this.$.root = root;

	return root;
};

Pipeline.prototype._renderRoot = function() {
	return $('<div class="' + CLASS_ROOT + '">');
};

Pipeline.prototype._renderStopContainer = function() {
	return $('<div class="' + CLASS_STOP_CONTAINER + '">');
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

Pipeline.prototype.setZoom = function(zoom) {
	if (zoom < 0 || zoom > ZOOMING_MAX) {
		throw new RangeError('zoom');
	}
	this._z = zoom;
	this._pixelsADay = Math.pow(2, zoom) * ZOOMING_RESOLUTION / ZOOMING_BASE_NUMBER;
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
	this._waitDragTimer = setTimeout(this._onWaitDragTimeout.bind(this), DRAG_PAUSE);
};

Pipeline.prototype.isStateWaitDrag = function() {
	return this._state === STATE_WAIT_DRAG;
};

Pipeline.prototype._initListeners = function(index) {
	var root = this.$.root;
	var body = $('body');
	root.on('click', '.' + CLASS_STOP, this._onStopMarkerClick);
	root.on('click', '.' + CLASS_INTERVAL, this._onIntervalClick);
	root.on('mousedown', '.' + CLASS_STOP, this._onStopMarkerMouseDown);

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
	console.log('change bounds');
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