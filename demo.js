/*global Pipeline*/


var pv = new Pipeline();

pv.setZoom(7);
pv.model.addStop(11000);
pv.model.addStop(11050);
pv.model.addStop(11100);


pv.render().appendTo('.app');

function zoomPlus() {
  pv.zoomPlus();
}

function zoomMinus() {
  pv.zoomMinus();
}