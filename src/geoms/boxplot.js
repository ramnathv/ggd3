// 
function Boxplot(spec) {
  if(!(this instanceof Geom)){
    return new Boxplot(spec);
  }
  Geom.apply(this);
  var attributes = {
    name: "boxplot",
    stat: "boxplot",
    position: "jitter",
    upper: 0.95,
    lower: 0.05,
    tail: null,
    outliers: true,
    mean: false,
  };

  var r = function(d) { return ggd3.tools.round(d, 2);};
  function tooltip(sel, s, opts) {
    var that = this;
    sel.each(function(d) {
        var el = d3.select(this);
        _.mapValues(d.quantiles, function(v, k) {
          el.append('h5')
            .text(k + ": " + r(v));
        });
    });
  }
  attributes.tooltip = _.bind(tooltip, this);

  this.attributes = _.merge(this.attributes, attributes);

  for(var attr in this.attributes){
    if((!this[attr] && this.attributes.hasOwnProperty(attr))){
      this[attr] = createAccessor(attr);
    }
  }
}

Boxplot.prototype = new Geom();


Boxplot.prototype.constructor = Boxplot;

// Boxplot.prototype.tooltip = 

Boxplot.prototype.determineOrdinal = function(s) {
  // this is dumb, this logic needs to happen when scales are created;
  if(s.plot.xScale().single.scaleType() === "ordinal"){
    return 'x';
  } else {
    return 'y';
  }
};

Boxplot.prototype.domain = function(data, a) {

  var s = this.setup(),
      factor = this.determineOrdinal(s),
      number = factor === 'x' ? 'y': 'x',
      domain,
      extent;
  if(a === factor) {
    domain = _.sortBy(_.map(data, function(d) {
      return _.unique(_.pluck(d.data, s.aes[a]));
    }));
  } else {
    domain = d3.extent(_.flatten(_.map(data, function(d) {
      return _.pluck(d.data, s.aes[a]);
    })));
    extent = domain[1] - domain[0];
    domain[0] -= extent*0.1;
    domain[1] += extent*0.1;
  }
  return domain;
};

Boxplot.prototype.positionBar = function() {

};

Boxplot.prototype.draw = function(sel, data, i, layerNum) {
  var s = this.setup(),
      that = this,
      o, n, o2, rb,
      size, width,
      line,
      scales = that.scalesAxes(sel, s, data.selector, layerNum,
                               this.drawX(), this.drawY()),
      vertical = scales.x.scaleType() === "ordinal",
      factor = vertical ? "x": "y",
      number = vertical ? "y": "x";

  ggd3.tools.removeElements(sel, layerNum, "geom-" + this.name());

  data = this.unNest(this.compute(data.data, s));
  o = scales[factor].scale();
  rb = o.rangeBand();
  n = scales[number].scale();
  line = d3.svg.line();

  if(vertical){
    // vertical boxes
    size = {s: "height", p: 'y', c: "cy"};
    width = {s: "width", p: 'x', c: "cx"};
    // point scales;
    px = function(d) { return (d._jitter * rb/2) + rb/2; };
    py = function(d) { return n(d[s.aes[number]]); };
    // box scales
    rx = function(d) { return 0; };
    ry = function(d) { 
      return n(d.quantiles["75th percentile"] ); };
    rw = function() { return rb; };
    rh = function(d) { 
      return (n(d.quantiles["25th percentile"]) - 
              n(d.quantiles["75th percentile"])); };
  } else {
    // horizontal boxes
    size = {s: "width", p:'x', c: "cx"};
    width = {s:"height", p: 'y', c: "cy"};
    py = function(d) { return (d._jitter * rb/2) + rb/2; };
    px = function(d) { return n(d[s.aes[number]]); };
    ry = function(d) { return 0; };
    rx = function(d) { 
      return n(d.quantiles["25th percentile"] ); };
    rh = function() { return rb; };
    rw = function(d) { 
      return (n(d.quantiles["75th percentile"]) - 
              n(d.quantiles["25th percentile"])); };
  }
  if(s.grouped) {
    s.groups = _.sortBy(_.unique(_.flatten(_.map(data, function(d) {
      return _.pluck(d.data, s.group);
    }))));
    o2 = d3.scale.ordinal()
            .rangeBands([0, o.rangeBand()], 0.1, 0)
            .domain(s.groups);
    rb = o2.rangeBand();
  } else {
    o2 = function() {
      return 0;
    };
    o2.rangeBand = function() { return 0; };
  }

  function whisker(d, dir) {
    var out;
    switch(dir){
      case "upper":
        out = [[rb/2, n(d.upper)],
          [rb/2, n(d.quantiles["75th percentile"])]];
        break;
      case "lower":
        out = [[rb/2, n(d.lower)],
        [rb/2, n(d.quantiles["25th percentile"])]];
        break;
      case "median":
        out = [[0, n(d.quantiles["50th percentile"])], 
        [rb, n(d.quantiles["50th percentile"])]];
        break;
    }
    if(!vertical) { 
      out = _.map(out, function(d){
                  return d.reverse();
              }); 
    }
    return out;
  }

  function draw(box) {
    var d = box.datum(),
    rect = box.selectAll('rect')
              .data([d]);
    box.select(".upper")
      .datum(whisker(d, 'upper'))
      .attr('d', line)
      .attr('stroke', 'black');
    box.select(".lower")
      .datum(whisker(d, 'lower'))
      .attr('d', line)
      .attr('stroke', 'black');
    box.select(".median")
      .datum(whisker(d, 'median'))
      .attr('d', line)
      .attr('stroke', 'black');
    box
      .attr("transform", function(d) {
        var v = o(d[s.aes[factor]]) + o2(d[s.group]);
        if(!vertical) { 
          // v -= rb/2; // add rb the other way
          return "translate(0," + v + ")";
        } 
        return "translate(" + v + ",0)" ;
      });
    var r = ggd3.geoms.box(),
        tt = ggd3.tooltip()
                .content(that.tooltip())
                .geom(that);
    rect.call(r.drawGeom, rx, ry, rw, rh, s, layerNum);
    rect.enter().append('rect')
      .attr('class', 'quantile-box')
      .call(r.drawGeom, rx, ry, rw, rh, s, layerNum)
      .each(function(d) {
        tt.tooltip(d3.select(this));
      });
    if(that.outliers()) {
      var p = ggd3.geoms.point();
      s.x = px;
      s.y = py;
      p.draw(box, d.data, i, layerNum, s);
    }
  }
  var boxes = sel.select('.plot')
                .selectAll('.geom g' + layerNum)
                .data(data);

  boxes.each(function(d) {
    d3.select(this).call(draw);
  });
  boxes.enter().append('g').each(function(d) {
    var b = d3.select(this);
    b.attr('class', 'geom g' + layerNum + ' geom-' + that.name());
    b.append('path').attr('class', 'upper');
    b.append('path').attr('class', 'lower');
    b.append('path').attr('class', 'median');
    b.call(draw);
  });
  boxes.exit().transition()
    .style("opacity", 0)
    .remove();
};

ggd3.geoms.boxplot = Boxplot;