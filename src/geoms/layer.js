function Layer(aes) {
  var attributes = {
    plot:     null,
    data:     null,
    geom:     null,
    stat:     null, // identity, sum, mean, percentile, etc.
    position: null, // jitter, dodge, stack, etc.
    aes:      null,
    ownData: false,
  };
  this.attributes = attributes;
  var getSet = ["plot", "data", "position", "aes"];
  for(var attr in this.attributes){
    if(!this[attr] && _.contains(getSet, attr) ){
      this[attr] = createAccessor(attr);
    }
  }
}

Layer.prototype.ownData = function(tf) {
  if(!arguments.length) { return this.attributes.ownData; }
  // eventually, when called, this may
  // nest the data appropriately
  // ie.
  // this.attributes.data = this.plot().nest(this.data());
  this.attributes.ownData = tf;
  return tf;
};

Layer.prototype.stat = function(stat) {
  if(!arguments.length) { return this.attributes.stat; }
  this.attributes.stat = stat;
  // usually, default stat is accepted from geom
  // but you can choose a stat and get a default geom
  if(_.isNull(this.attributes.geom)) {
    this.attributes.geom = stat.defaultGeom();
  }
  return this;
};

Layer.prototype.draw = function() {
  var that = this,
      facet = this.plot().facet();
  function draw(sel) {

    var dataList = that.ownData() ? that.dataList():that.plot().dataList();
    _.each(dataList, function(data){
      var s = sel.select("#" + data.selector);
      s.call(that.geom().draw(), data.data);
    });
  }
  return draw;
};
Layer.prototype.dataList = DataList;

Layer.prototype.geom = function(geom) {
  if(!arguments.length) { return this.attributes.geom; }
  geom = new ggd3.geoms[geom]()
                .layer(this);
  if(_.isNull(this.attributes.stat)) {
    this.attributes.stat = geom.defaultStat();
  }
  this.attributes.geom = geom;
  return this;
};

ggd3.layer = Layer;
