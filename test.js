/*global PipelineModel*/

var fs = require('fs');
var vm = require('vm');

function include(file) {
  var src = fs.readFileSync(file);
  vm.runInThisContext(src, file);
}

function dump(pl) {
  console.log('\ndump');
  var cur = pl.firstStop;
  while (cur) {
    console.log(cur.value);
    cur = cur.next;
  }
  console.log('end');
}

include('./event.js');
include('./model.js');

var pl = new PipelineModel();

pl.bind('addStop', console.log.bind(console, 'add'));
pl.bind('removeStop', console.log.bind(console, 'remove'));
pl.bind('changeStopDay', console.log.bind(console, 'changeDay'));

pl.addStop(1);
pl.addStop(12);
pl.addStop(500);
pl.addStop(30);

dump(pl);

pl.changeStopDay(pl.stopByDay(30), 13);

dump(pl);