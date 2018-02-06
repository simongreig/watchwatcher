# Watch Price Watcher

When it is finished this will be an app that looks at the price trends for Swiss watches. Handy for investment buyers.

At the moment it is all a work in progress.

## How it will work

There are two parts to the app:
1. A crawler that will periodically crawl a popular watch reseller site to grab prices (currently pointing at a UK one)
2. A user interface to allow the data to be seen - preferably with pretty graphs and the like.

## Tech Stack

Currently testing on Cloudant as eventually when it is run it will run on IBM Cloud.

## Planned features

### Under the covers
* Screen scrape the website into JSON **[done]**
* Store the JSON in a database that is persistent (and not duplicated) between runs **[done]**
* Create a cronjob style schedule to crawl once per day

### User Interface

* Simple watch brand based navigation - list of brands and then drill down to each series and model - using images where possible.
* For each brand, see which watches are increasing and decreasing in value
* For each watch type, see the price history over time for each model type and aggregated for the overall model
* For each model type, see the price history over time
* Biggest gainers and looser brands
* Search by series name (e.g. "Submariner") or reference (e.g. "14060M") to get stats on a particular watch type

Written by Simon Greig.