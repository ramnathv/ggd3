// aes is an object literal with 
// x, y, yintercept, xintercept, shape, size, 
// color, etc.
function Plot(aes) {
  var attributes = {
    data: null,
    layers: [],
    facet: new ggd3.facet(),
    xScale: {single: new ggd3.scale()}, 
    yScale: {single: new ggd3.scale()},
    colorScale: {single: new ggd3.scale()},
    sizeScale: {single: new ggd3.scale()},
    opts: {},
    theme: "ggd3",
    margins: {left:20, right:20, top:20, bottom:20},
    width: 400,
    height: 400,
    aes: null,
    legends: null, // strings corresponding to scales
    // that need legends or legend objects
    xAdjust: false,
    yAdjust: false,
    dtypes: {},
  };
  // aesthetics I might like to support:
// ["alpha", "angle", "color", "fill", "group", "height", "label", "linetype", "lower", "order", "radius", "shape", "size", "slope", "width", "x", "xmax", "xmin", "xintercept", "y", "ymax", "ymin", "yintercept"] 
  this.attributes = attributes;
  // if the data method has been handed a new dataset, 
  // dataNew will be true, after the plot is drawn the
  // first time, dataNew is set to false
  this.dataNew = true;
  // when cycling through data, need to know if 
  // data are nested or not.
  this.nested = false;
  // explicitly declare which attributes get a basic
  // getter/setter
  var getSet = ["opts", "theme", "margins", 
    "width", "height", "xAdjust", "yAdjust"];

  for(var attr in attributes){
    if((!this[attr] && 
       _.contains(getSet, attr))){
      this[attr] = createAccessor(attr);
    }
  }
}

function scaleConfig(type) {
  var scale;
  switch(type){
    case "x":
      scale = 'xScale';
      break;
    case "y":
      scale = 'yScale';
      break;
    case "color":
      scale = 'colorScale';
      break;
    case "size":
      scale = 'sizeScale';
      break;
  }
  function scaleGetter(obj){
    if(!arguments.length) {
      return this.attributes[scale];
    }
    // reset to user specified entire scale object
    if(obj instanceof ggd3.scale){
      this.attributes[scale] = {};
      this.attributes[scale].single = obj;
      return this;
    }
    // pass null to reset scales entirely;
    if(_.isNull(obj)){
      this.attributes[scale] = {single: new ggd3.scale() };
      return this;
    }
    // 
    if(!_.isUndefined(obj)) {
      // merge additional options with old options
      if(this.attributes[scale].single instanceof ggd3.scale){
        obj = _.merge(this.attributes[scale].single._userOpts,
                           obj);
      }
      this.attributes[scale].single = new ggd3.scale(obj).plot(this);
      return this;
    }
  }
  return scaleGetter;
}

Plot.prototype.xScale = scaleConfig('x');

Plot.prototype.yScale = scaleConfig('y');

Plot.prototype.colorScale = scaleConfig('color');

Plot.prototype.sizeScale = scaleConfig('size');

Plot.prototype.layers = function(layers) {
  if(!arguments.length) { return this.attributes.layers; }
  if(_.isArray(layers)) {
    // allow reseting of layers by passing empty array
    if(layers.length === 0){
      this.attributes = layers;
      return this;
    }
    var layer;
    _.each(layers, function(l) {
      if(_.isString(l)){
        // passed string to get geom with default settings
        layer = new ggd3.layer()
                      .aes(this.aes())
                      .plot(this)
                      .geom(l);

        this.attributes.layers.push(layer);
      } else if ( l instanceof ggd3.layer ){
        // user specified layer
        this.attributes.push(l.ownData(true).plot(this));
      }
    }, this);
  }
  return this;
};

Plot.prototype.dtypes = function(dtypes) {
  if(!arguments.length) { return this.attributes.dtypes; }
  this.attributes.dtypes = _.merge(this.attributes.dtypes, dtypes);
  return this;
};

// custom data getter setter to pass data to layer if null
Plot.prototype.data = function(data) {
  if(!arguments.length) { return this.attributes.data; }
  // clean data according to data types
  // and set top level ranges of scales.
  // dataset is passed through once here.
  // must have passed a datatypes object in before.
  data = ggd3.tools.clean(data, this);
  // after data is declared, nest it according to facets.
  this.attributes.data = this.nest(data.data);
  this.dtypes(data.dtypes);
  this.nested = true;
  this.dataNew = true;
  return this;
};


Plot.prototype.facet = function(spec) {
  if(!arguments.length) { return this.attributes.facet; }
  var data;
  if(spec instanceof ggd3.facet){
    this.attributes.facet = spec.plot(this);
    if(this.nested){
      // unnest from old facets
      console.log('nested');
      data = ggd3.tools.unNest(this.data());
      // nest according to new facets
      this.attributes.data = this.nest(data);
    } else {
      console.log('not nested');
      this.attributes.data = this.nest(this.data());
    }
  } else {
    this.attributes.facet = new ggd3.facet(spec)
                                    .plot(this);
    if(this.nested){
      data = ggd3.tools.unNest(this.data());
      this.attributes.data = this.nest(data);
    } else {
      this.attributes.data = this.nest(this.data());
    }
  }
  this.nested = true;
  return this;
};

Plot.prototype.aes = function(aes) {
  if(!arguments.length) { return this.attributes.aes; }
  _.each(this.layers(), function(l) {
    if(_.isNull(l.aes())){
      l.aes(aes);
    }
  }, this);
  this.attributes.aes = aes;
  return this;
};

Plot.prototype.plotDim = function() {
  var margins = this.margins();
  if(this.facet().type() === "grid"){
    return {x: this.width() - this.facet().margins().x, 
      y: this.height() - this.facet().margins().y};
  }
  return {x: this.width() - margins.left - margins.right,
   y: this.height() - margins.top - margins.bottom};
};

Plot.prototype.draw = function() {
  var that = this;
  // should the first layer be special? its stat and the top-level
  // data would be used to calculate the scale ranges.
  // or, if any of the geoms have 'identity' as the stat
  // use identity, otherwise use the stat summary.
  // get basic info about scales/aes;
  this.setScales();
  // set fixed/free domains
  this.setDomains();
  function draw(sel) {
    sel.call(that.facet().updateFacet());
    // kinda labored way to get rid of unnecessary facets
    // empty cells are nice to have so the axes are hung
    // consistently
    // var divs = [],
    //     facets = _.pluck(that.dataList(), "selector");
    // sel.selectAll('.plot-div')
    //   .each(function(d) {
    //     divs.push(d3.select(this).attr('id'));
    //   });
    // divs = divs.filter(function(d) { return !_.contains(facets, d);});
    // divs.forEach(function(d) {
    //   sel.select("#" + d).select('svg.plot-svg').selectAll('*').remove();
    // });

    // drawing layers

    _.each(that.layers(), function(l, i) {
      sel.call(l.draw(i));
    });
  }
  this.dataNew = false;
  return draw;
};


Plot.prototype.nest = function(data) {
  if(_.isNull(data)) { return data; }
  var nest = d3.nest(),
      that = this,
      facet = this.facet();
  if(!_.isNull(facet.x())){
    nest.key(function(d) { return d[facet.x()]; });
  }
  if(!_.isNull(facet.y())){
    nest.key(function(d) { return d[facet.y()]; });
  }
  if(!_.isNull(facet.by())){
    nest.key(function(d) { return d[facet.by()]; });
  }
  data = nest.entries(data);
  return data; 
};

// returns array of faceted objects {selector: s, data: data} 
Plot.prototype.dataList = DataList;

// update method for actions requiring redrawing plot
Plot.prototype.update = function() {

};

ggd3.plot = Plot;