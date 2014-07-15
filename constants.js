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