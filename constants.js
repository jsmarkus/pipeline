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