infinite_loop_workaround("filters");

// Requires jquery, abp_filter_to_json_converter

// Inviolate rules about new Filters()._subscriptions:
//   - entries are mapped by url.
//   - if an entry exists, it will have the following values:
//     - url: the same url it's mapped by -- its online fetch url.
//     - user_submitted: bool.  If true, we have the right to delete this
//                       entry upon unsubscription.
//     - name: friendly name.  Currently I'm using url as name if
//             user_submitted a URL, but that's not guaranteed.
//     - subscribed: bool
//     - text: last fetched value of text.  If not subscribed, this may
//             be undefined; if subscribed, this must exist and be a valid
//             set of filters -- you can't subscribe without providing an
//             initial value for this property.
//     - last_update: ticks at which text was last updated.  Must be
//                    undefined if text is null.
// If a user_submitted subscription gets unsubscribed, we may (but might not)
// delete it from this._subscriptions.

// Filters class manages subscriptions and optimized filters.

// Constructor: merge the stored subscription data and the total possible
// list of subscriptions into this._subscriptions.  Store to disk, along
// with optimized version.
// Inputs: none.
function Filters() {
  this._event_handlers = { 'updated': [] };

  var subscriptions_json = localStorage.getItem('subscriptions');
  if (subscriptions_json == null)
    subscriptions_json = "null";
  var stored_subscriptions = JSON.parse(subscriptions_json);

  if (stored_subscriptions == null) {
    // Brand new user.  Install some filters for them.
    stored_subscriptions = Filters._load_hardcoded_subscriptions();
  }

  // In case a new version of AdBlock has removed or added some
  // subscription options, merge with Filters.__subscription_options.
  this._subscriptions = Filters.__merge_with_default(stored_subscriptions);
  this._persist_and_optimize();
  
  // Anything over 3 days old, go ahead and fetch at Chrome startup.
  this.freshen_async(72);

  var hours = 1;
  var that = this;
  window.setInterval(
    function() { that.freshen_async(); }, 
    hours * 60 * 60 * 1000
  );
}

// Event fired when subscriptions have been updated, after the subscriptions
// and the optimized filters have been persisted.
// Inputs: callback: fn(void)
Filters.prototype.updated = function(callback) {
  this._event_handlers.updated.push(callback);
}

// Save this._subscriptions to disk, as well as an optimized version.
// Inputs: none.
// Returns: null, after completion.
Filters.prototype._persist_and_optimize = function() {
  localStorage.setItem('subscriptions', JSON.stringify(this._subscriptions));
  this.optimize();
}

// Turn this._subscriptions into a set of optimized filters, and persist 
// to disk.
// Inputs: options?:object - if not specified, optional features that affect
//             optimization are loaded from storage.  If specified,
//             show_google_search_text_ads:bool is the only option.
// Returns: null, after completion.
Filters.prototype.optimize = function(options) {
  // TODO: this is ugly.  Make it not be ugly.
  if (options == undefined) {
    options = {};
    var optional_features = localStorage.getItem('optional_features');
    if (optional_features == null)
      options.show_google_search_text_ads = false;
    else {
      optional_features = JSON.parse(optional_features);
      if (optional_features.show_google_search_text_ads &&
          optional_features.show_google_search_text_ads.is_enabled)
        options.show_google_search_text_ads = true;
      else
        options.show_google_search_text_ads = false;
    }
  }

  var subscribed_texts = [];
  for (var url in this._subscriptions) {
    var subscription = this._subscriptions[url];
    if (this._subscriptions[url].subscribed)
      subscribed_texts.push(this._subscriptions[url].text);
  }

  var optimized = optimize_filter_texts(subscribed_texts, options);
  localStorage.setItem('optimized_filters', JSON.stringify(optimized));
  // Fire updated event
  for (var i = 0; i < this._event_handlers.updated.length; i++)
    this._event_handlers.updated[i]();
}

// If any subscribed filters are out of date, asynchronously load updated
// versions, then call this._persist_and_optimize().  Asynchronous.
// Inputs: older_than?:int -- number of hours.  Any subscriptions staler
//         than this will be updated.  Defaults to 5 days.
// Returns: null (asynchronous)
Filters.prototype.freshen_async = function(older_than) {
  function out_of_date(subscription) {
    var hours_between_updates = (older_than == undefined ? 120 : older_than);
    var millis = new Date().getTime() - subscription.last_update;
    return (millis > 1000 * 60 * 60 * hours_between_updates);
  }
  // Fetch the latest version of url, store it in this._subscriptions,
  // and call _persist_and_optimize().
  var that = this;
  function fetch_and_persist(url) {
    $.ajax({
      url: url,
      success: function(text) {
        var now = new Date().getTime();
        log("Fetched " + url);
        if (!text || text.length == 0) {
          localStorage.setItem('fetch_failed', url);
          return;
        }
        // In case the subscription disappeared while we were out
        // (which would happen if they unsubscribed to a user-submitted
        // filter)...
        if (that._subscriptions[url] == undefined) {
          that._subscriptions[url] = {
            url: url,
            name: url,
            user_submitted: true,
            subscribed: false
          };
        }
        that._subscriptions[url].text = text;
        that._subscriptions[url].last_update = now;
        that._persist_and_optimize();
      },
      error: function() { log("Error fetching " + url); }
    });
  }
  for (var url in this._subscriptions) {
    if (this._subscriptions[url].subscribed &&
        out_of_date(this._subscriptions[url])) {
      fetch_and_persist(url);
    }
  }
}

// Subscribe to a url.
// Inputs: url:string location of the filter text online
//         text:string value of the filter.  It's the caller's job to fetch
//                     and provide this.
// Returns: none, upon completion.
Filters.prototype.subscribe = function(url, text) {
  if (this._subscriptions[url] == undefined) {
    // New user-submitted filter.
    this._subscriptions[url] = {
      url: url,
      name: url,
      user_submitted: true
    };
  }
  this._subscriptions[url].subscribed = true;
  this._subscriptions[url].last_update = new Date().getTime();
  this._subscriptions[url].text = text;
  this._persist_and_optimize();
}

// Unsubscribe from a url.  If the url is not in the standard list of
// URLs, remove it from _subscriptions instead of just unsubscribing (to
// handle a filter list being deprecated.)
// Inputs: url:string from which to unsubscribe.
// Returns: none, upon completion.
Filters.prototype.unsubscribe = function(url) {
  if (this._subscriptions[url] == undefined)
    return;

  if (url in Filters.__subscription_options) {
    this._subscriptions[url].subscribed = false;
    // Don't need to do this, but makes the object easier to debug
    delete this._subscriptions[url].text;
    delete this._subscriptions[url].last_update;
  }
  else
    delete this._subscriptions[url];

  this._persist_and_optimize();
}

// Return a map from subscription url to
// {
//   subscribed:bool - whether user is subscribed to this subscription
//   url:string - url of this subscription
//   name:string - friendly name of this subscription
//   user_submitted:bool - true if this is a url typed in by the user
//   last_update?:number - if the subscription has ever been fetched,
//                         the ticks at which it was last fetched
// }
Filters.prototype.get_subscriptions_minus_text = function() {
  var result = {};
  for (var url in this._subscriptions) {
    result[url] = {
      url: url,
      subscribed: this._subscriptions[url].subscribed,
      user_submitted: this._subscriptions[url].user_submitted,
      name: this._subscriptions[url].name,
      last_update: this._subscriptions[url].last_update
    }
  }
  return result;
}

// Return a new subscriptions object containing all available subscriptions,
// with EasyList and AdBlock custom filters subscribed from disk.
// Inputs: none.
Filters._load_hardcoded_subscriptions = function() {
  var result = {};

  function localfetch(real_url, local_url, name) {
    // jQuery has a bug that keeps $.ajax() from loading local files.
    // Use plain old XHR.
    var ajax = new XMLHttpRequest();
    ajax.open("GET", local_url, false);
    ajax.send();
    var text = ajax.responseText;
    return {
      url: real_url,
      name: name, 
      user_submitted: false,
      subscribed: true,
      text: text,
      last_update: new Date().getTime()
    };
  }

  var real_url = "http://sites.google.com/site/chromeadblock/aux_filters.txt";
  result[real_url] = localfetch(
          real_url,
          chrome.extension.getURL("filters/adblock_custom.txt"),
          "Chrome AdBlock custom filters (recommended)");

  real_url = "http://adblockplus.mozdev.org/easylist/easylist.txt";
  result[real_url] = localfetch(
          real_url,
          chrome.extension.getURL("filters/easylist.txt"),
          "EasyList (recommended)");

  return result;
}
// Merge the given list of subscription data with the default list.  Any
// items marked as "user_submitted=false" in the data which is not in the
// default list are converted to user_submitted; any items in the default
// list that aren't in the user data are added as unsubscribed.
// Input: subscription_data:subscription object loaded from storage
// Returns: subscription_data object modified to be merged with the
// default subscription list.
Filters.__merge_with_default = function(subscription_data) {
  for (var url in subscription_data) {
    if (Filters.__subscription_options[url] == undefined &&
        subscription_data[url].user_submitted == false) {
      subscription_data[url].user_submitted = true;
    }
  }
  for (var url in Filters.__subscription_options) {
    if (subscription_data[url] == undefined) {
      subscription_data[url] = {
        url: url,
        name: Filters.__subscription_options[url].name,
        user_submitted: false,
        subscribed: false
      };
    }
  }
  return subscription_data;
}
// Called below to fill Filters.__subscription_options.
Filters.__make_subscription_options = function() {
  var official_options = {
    "http://sites.google.com/site/chromeadblock/aux_filters.txt": 
      "Chrome AdBlock custom filters (recommended)",
    "http://adblockplus.mozdev.org/easylist/easylist.txt":
      "EasyList (recommended)",
    "http://stanev.org/abp/adblock_bg.txt":
      " - additional Bulgarian filters",
    "http://lian.info.tm/liste_fr.txt":
      " - additional French filters",
    "http://adblockplus.mozdev.org/easylist/easylistgermany.txt":
      " - additional German filters",
    "http://brianyi.com/corset.txt":
      " - additional Korean filters",
    "http://www.picpoc.ro/menetzrolist.txt":
      " - additional Romanian filters",
    "http://s3.amazonaws.com/lcp/maty/myfiles/AdBlock-Nauscopio-maty.txt":
      " - additional Spanish filters",
    "http://adblockplus-vietnam.googlecode.com/svn/trunk/abpvn.txt":
      " - additional Vietnamese filters",
    "http://adblock-chinalist.googlecode.com/svn/trunk/adblock.txt":
      "Chinese filters",
    "http://adblock.schack.dk/block.txt":
      "Danish filters",
    "http://dutchmega.nl/dutchblock/list.txt":
      "Dutch filters",
    "http://chewey.de/mozilla/data/adblock.txt":
      "German filters",
    "http://israellist.googlecode.com/files/IsraelList.txt":
      "Israeli filters",
    "http://www.fanboy.co.nz/adblock/fanboy-adblocklist-jpn.txt":
      "Japanese filters",
    "http://www.bsi.info.pl/filtrABP.txt":
      "Polish filters",
    "http://ruadlist.googlecode.com/svn/trunk/adblock.txt":
      "Russian filters",
  };
  var result = {};
  for (var url in official_options) {
    result[url] = {
      url: url,
      name: official_options[url],
      subscribed: false,
      user_submitted: false
    };
  }
  return result;
}
// The list of official subscription options.
Filters.__subscription_options = Filters.__make_subscription_options();
