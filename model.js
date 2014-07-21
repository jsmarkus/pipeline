/*global MicroEvent*/

function GUID() {
  return (new Date() | 0).toString(16) + ((Math.random() * 1e9) | 0).toString(16);
}



function PipelineModel() {
  this.firstStop = null;
  this._stopsByDay = {};
  this._stopsByGuid = {};
  this._attachInterval(new Interval(), null, null);
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

  // var intervalToSplit = this.getBoundingInterval(day);

  this._splitInterval(stop);
};

PipelineModel.prototype._detachInterval = function(interval) {
  if (interval.from) {
    interval.from.nextInterval = null;
    interval.from = null;
  }
  if (interval.to) {
    interval.to.nextInterval = null;
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
      throw new Error('cannot attach staring interval twice');
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
  var rightStop = leftInterval.to;
  this._detachInterval(rightInterval);
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
  var rightInterval = new Interval(insertedStop, nextStop);
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