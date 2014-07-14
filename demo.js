/*global Pipeline*/


var pv = new Pipeline();

pv.model.addStop(11000);
pv.model.addStop(11050);
pv.model.addStop(11100);

pv.render().appendTo('.app');