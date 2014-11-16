function Clean(data, obj) {
  // coerce each records data to reasonable
  // type and get domains for all scales in aes.
  var vars = {},
      dtypeDict = {"number": parseFloat, 
                  "integer": parseInt,
                  "string": String},
      dtypes = _.merge({}, obj.dtypes()),
      keys = _.keys(dtypes),
      // assume all records have same keys
      dkeys = _.keys(data[0]);

  dkeys.forEach(function(v){
    // if a data type has been declared, don't 
    // bother testing what it is.
    // this is necessary for dates and such.
    if(!_.contains(keys, v)) { vars[v] = []; }
  });
  data.forEach(function(d) {
    _.mapValues(vars, function(v,k) {
      return vars[k].push(d[k]);
    });
  });
  _.mapValues(vars, function(v,k) {
    vars[k] = dtype(v);
  });
  dtypes = _.merge(vars, dtypes);

  data = _.map(data, function(d,i) {
    return _.map(dtypes, function(v,k) {
      if(v[0] === "date" || 
         v[0] === "time"){
        var format = v[2];
        d[k] = ggd3.tools.dateFormatter(d[k], format);
      } else {
        d[k] = dtypeDict[dtypes[k][0]](d[k]);
      }
      return d;
    })[0];
  });
  function dtype(arr) {
    var numProp = [],
        dateProp = [],
        n = (arr.length > 1000 ? 1000: arr.length);
    // for now, looking at random 1000 obs.
    _.map(_.sample(arr, n), 
          function(d) {
            numProp.push(!_.isNaN(parseFloat(d)));
          });
    numProp = numProp.reduce(function(p,v) { 
      return p + v; }) / n;
    var lenUnique = _.unique(arr).length;
    // handle floats v. ints and Dates.
    // if a number variable has fewer than 20 unique values
    // I guess this will do...
    if(numProp > 0.8 && lenUnique > 20){
      return ["number", "many"];
    } else if (numProp > 0.95) {
      return ['number', 'few'];
    } else if (lenUnique > 20) {
      return ["string", "many"];
    } else if (lenUnique < 20) {
      return ["string", "few"];
    }
  }
  return {data: data, dtypes: dtypes};
}

ggd3.tools.clean = Clean;