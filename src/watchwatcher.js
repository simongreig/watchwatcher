'use strict';

var request = require('request');
var cheerio = require('cheerio');
var debug = require('debug')('watchwatcher');

var RateLimiter = require('limiter').RateLimiter;
var dbLimiter = new RateLimiter(1, 150);


var db = require ('./watchwatcher-db');

const baseURL = "http://www.watchfinder.co.uk"


function addToList (list, page, db, testMode, callback) {

  console.log ("Requesting page " + page + " ...")
  request('http://www.watchfinder.co.uk/all-watches?&orderby=PriceHighToLow&pageno='+page, function (error, response, html) {

    if (response.statusCode != 200) {
      callback(list);
    }
    else {

      if (error) {
        console.log (error);
      }

    if (!error && response.statusCode == 200) {

      var $ = cheerio.load(html);

      var stuffReturned = false;


      $('div.prods_item-card').each(function(i, element){
        stuffReturned = true;

        // Pull out the items.
        /*
        Product ID:	.prods_code
        Image URL:	a.data-src
        Item URL:		a
        Price:	.prods_price
        Brand:	.prods_brand
        Series:	.prods_series
        Model:	.prods_model
        Age:		.prods_age (sub bit)
        Box:		.prods_box
        Papers:	.prods_papers
        Offer: .prods_offer

        */

        //Pre-formatting.

        // Price from string to number:
        var currency = $(".prods_price", this).text();
        var price = Number(currency.replace(/[^0-9\.-]+/g,""));

        // Product code to number:
        var product = $(".prods_code", this).text();
        var productID = Number(product.replace(/[^0-9\.-]+/g,""));

        // Age to number.  Need to check if the number is > 0 because it needs
        // some manual extracting.
        var ageStr = $(".prods_age", this).text();

        var regExp = /\(([^)]+)\)/;
        var matches = regExp.exec(ageStr);
        var age = "";
        if (matches) {
          age = Number(matches[1]);
        } else {
          age = (new Date()).getFullYear() - Number(ageStr.replace(/[^0-9]+/g,""));
        }


        var item = {};


        // Pull out the "yes" or "no" for the box
        const regex = /(?:Yes|No)/gmi;
        matches = regex.exec($(".prods_papers", this).text());
        var hasPapers = "";
        if (matches) {
          hasPapers = String(matches[0]);
        }

        // Pull out the "yes" or "no" for the box
        const regex2 = /(?:Yes|No)/gmi;
        var boxStr = $(".prods_box", this).text();
        var matchesBox = regex2.exec(boxStr);
        var hasBox = "new";

        if (matchesBox) {
          hasBox = String(matchesBox[0]);
        }

        item.productID = productID;
        item.brand = $(".prods_brand", this).text();
        item.series = $(".prods_series", this).text();
        item.model = $(".prods_model", this).text();
        item.age = age;
        item.box = hasBox;
        item.papers = hasPapers;
        item.img = $(".redirect", this).attr("data-src");
        item.url = baseURL + $(".redirect", this).attr("href");


        item.lastPrice = {} ;
        item.lastPrice.price = price;
        if ($(".prods_offer", this).text()) {
          item.lastPrice.offer = Number($(".prods_offer", this).text().replace(/[^0-9\.-]+/g,""));
        } else {
          item.lastPrice.offer = null;
        }
        item.lastPrice.dateChecked = new Date ();
        item.oldPrices = [];
        item.oldPrices.push(item.lastPrice);




        // *** INSERT INTO THE DATABASE ****
        dbLimiter.removeTokens(1, function(err, remainingRequests) {
          dbAdd(item);
        });


        list.push (item);

        if (testMode) {
          // Uncomment for testing to only process one row.
          return (false);
        }


      });

      if (stuffReturned) {
        console.log ("Page " + page + " had content");
        if (!testMode) {
          addToList (list, ++page, db, testMode, printList);
        }
      } else {
        console.log ("No more content on page " + page + "! Stopping.");
      }
      callback (list);
    }
    }
  });
};

function printList (list) {
  console.log (list.length + " watches watched!");
}

function dbAdd (item) {
  item.key = String(item.productID);
  debug ("Adding " + item.productID + " at " + new Date ());
  db.addKeyObj (item, function(dbData){
    debug ("add:", dbData);
  });
}

function watchTheWatches (testMode) {
  // Start the main loop.
  var watchList = [];
  addToList (watchList, 1, db, testMode, printList);
}


 watchTheWatches(true);


db.getCount ("brand", function(err, body){
  if (!err) {
    body.rows.forEach(function(doc) {
      console.log(doc);
    });
  }
});



/*
db.searchSeries ("16710", function(data){
  for (var i = 0; i < data.length; i++) {
    console.log('  Doc id: %s, %s', data[i].obj.productID, data[i].obj.lastPrice.price);
  }
});*/