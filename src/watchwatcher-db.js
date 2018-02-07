/*jshint node: true*/

'use strict';

var Cloudant = require('cloudant');
var debug = require('debug')('watchwatcher-db');

var RateLimiter = require('limiter').RateLimiter;
var dbWriteLimiter = new RateLimiter(1, 150);
var dbReadLimiter = new RateLimiter(1, 100);




// Sort out the database connections and names.
var cloudant = initDBConnection();
var dbName = "watchwatcher";
if (process.env.NODE_ENV != "production") {
  dbName = dbName + "-" + process.env.NODE_ENV;
}
console.log ("Using DB:", dbName);
var db = cloudant.db.use(dbName);



//******************************************************************************
//
// Get the database parameters from the VCAP_SERVICES.  If running locally
// then get from the local environment.
//
//******************************************************************************
function initDBConnection() {
  var credentials = {} ;
  var vcapServices = {};
  if (process.env.VCAP_SERVICES) {
    vcapServices = JSON.parse(process.env.VCAP_SERVICES);
  } else {
    try {
      vcapServices = require('../local/VCAP_SERVICES.json');
      console.log ("Running with LOCAL VCAP_SERVICES", vcapServices);
    } catch (e) {
      debug(e);
    }
  }

	if(vcapServices) {
    credentials = vcapServices.cloudantNoSQLDB[0].credentials ;
    debug ("Using credentials", credentials);
	} else{
		debug ('VCAP_SERVICES environment variable not set!');
	}

  return Cloudant (credentials);

}

//******************************************************************************
//
// Simple database lookup with a key
//
//******************************************************************************
var get = function (key, callback) {
  debug ("get entered:", key);

  dbReadLimiter.removeTokens(1, function(err, remainingRequests) {
    db.get(key, function(err, data) {
      if (!data) {
        debug ("get ERROR returned:", err);
        callback(err);
      } else {
        debug ("get", data);
        if (data.value) {
          debug ("get returned:", data.value);
          callback (data.value);
        }
      }
    });
  });



};
exports.get = get;



//******************************************************************************
//
// Sets a simple key in the database
//
//******************************************************************************
var set = function (key, value, callback) {
  dbReadLimiter.removeTokens(1, function(err, remainingRequests) {

    db.get(key, function(err, data) {

      var updateData = {};
      if (data) {
        // Row exists so do an update.
        updateData._id = data._id;
        updateData._rev = data._rev;

        updateData.value = {};
        updateData.value = value;
      } else {
        // No row exists
        updateData._id = key;
        updateData.value = {};
        updateData.value = value;
      }

      dbWriteLimiter.removeTokens(1, function(err, remainingRequests) {
        dbAdd(updateData, callback);
      });


    });
  });

};
exports.set = set;


//******************************************************************************
//
// Add a key object to the database.
//
//******************************************************************************
var addKeyObj = function (obj, callback) {
  // Try to add the key by first reading it to make sure we don't duplicate.
  debug ("addKeyObj entered:", obj);
  db.get(obj.key, function(err, data) {

    debug ("addKeyObj PRE-GET:", err, data);


    var updateData = {};
    if (data) {
      // Row exists so do an update.
      updateData._id = data._id;
      updateData._rev = data._rev;

      var storedPrice = data.obj.lastPrice;

      updateData.obj = {};
      updateData.obj = data.obj;
      updateData.obj.lastPrice = obj.lastPrice;


      // Only add the new price if it has changed since last time.
      // Data is what was in the database.  Obj is what was returned from the web
      if (storedPrice.price != obj.lastPrice.price) {
        debug ("***Price changed***");
        updateData.obj.oldPrices.push (obj.lastPrice);
      }



    } else {
      // No row exists
      updateData._id = String(obj.key);
      updateData.obj = {};
      updateData.obj = obj;
    }

    updateData.obj.timestamp = new Date();


    dbWriteLimiter.removeTokens(1, function(err, remainingRequests) {
      dbAdd(updateData, callback);
    });


  });
};
exports.addKeyObj = addKeyObj;

//******************************************************************************
//
// Add to the database.  Separate function to support the rate limiting.
//
//******************************************************************************
function dbAdd (updateData, callback) {
      debug ("dbAdd entered:", updateData);
      db.insert(updateData, function(err, data) {
        debug ("dbAdd INSERT:", err, data);
        if (err) {
          if (callback) {
            callback (err);
          }
          else {
            debug (err);
          }

        } else {
          if (callback) {
            callback (data);
          }

        }
      });
}

//******************************************************************************
//
// Get all objects.
//
//******************************************************************************
var getKeyObjs = function (callback) {
    db.list(function(err, data) {
      if (err) {
        callback (err);
      } else {
        callback ( data.rows );
      }
  });
};
exports.getKeyObjs = getKeyObjs;

//******************************************************************************
//
// Get details about an object.
//
//******************************************************************************
var getWithKey = function (key, callback) {
  getWithID(key, callback);
};
exports.getWithKey = getWithKey;

//******************************************************************************
//
// Get details about an object and decrpyts the key.
//
//******************************************************************************
var getWithID = function (id, callback) {
  debug ("getWithID entered:", id);
  db.get(id, function(err, data) {
    if (!data) {
      debug ("getWithID ERROR returned:", err);
      callback(err);
    } else {
      debug ("getWithID", data);
      if (data.keyObj) {
        var keyObj = data.keyObj;
        debug ("getWithID returned:", data.keyObj);
        callback (data.keyObj);
      }
    }
  });
};
exports.getWithID = getWithID;

//******************************************************************************
//
// Delete a key object from the database
//
//******************************************************************************
var deleteKeyObj = function (key, callback) {

  db.get(key, function(err, data) {

    if (err) {
      debug ("deleteKeyObj: Error:", err);
      callback(err);
    } else {
      db.destroy(data._id, data._rev, function(err, data) {
        debug ("deleteKeyObj: Destroy:", err, data);
        if (err) {
          callback(err);
        } else {
          callback (data);
        }
      });
    }
  });
};
exports.deleteKeyObj = deleteKeyObj;


//******************************************************************************
//
// Search for a specific series
//
//******************************************************************************
var searchSeries = function (key, callback) {

  db.find({selector:{'obj.model': key},sort:[{"obj.lastPrice.price:number": "desc"}]}, function(er, result) {
    console.log (er);
    if (er) {
      throw er;
    }

    console.log('Found %d documents with key ' + key, result.docs.length);
    callback (result.docs);
  });

};
exports.searchSeries = searchSeries;


//******************************************************************************
//
// Get a count of all of the brands in the DB
//
//******************************************************************************
var getCount = function (designname, callback) {
  db.view (designname, 'new-view', {'group': true},callback);
}
exports.getCount = getCount;
