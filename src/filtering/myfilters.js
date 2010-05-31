infinite_loop_workaround("myfilters");


// Requires jquery and 'utils.get_optional_features' method from background

// MyFilters class manages subscriptions and the FilterSet.

// Constructor: merge the stored subscription data and the total possible
// list of subscriptions into this._subscriptions.  Store to disk.
// Inputs: none.
function MyFilters() {
  MyFilters._temp_convert_from_old_system();
  this._event_handlers = { 'updated': [] };

  var subscriptions_json = localStorage.getItem('filter_lists');
  if (subscriptions_json == null)
    subscriptions_json = "null";
  var stored_subscriptions = JSON.parse(subscriptions_json);

  if (stored_subscriptions == null) {
    // Brand new user.  Install some filters for them.
    stored_subscriptions = MyFilters._load_hardcoded_subscriptions();
  }

  // In case a new version of AdBlock has removed or added some
  // subscription options, merge with MyFilters.__subscription_options.
  this._subscriptions = MyFilters.__merge_with_default(stored_subscriptions);

  this.update();
  
  // Anything over 3 days old, go ahead and fetch at Chrome startup.
  this.freshen_async(72);

  var hours = 1;
  var that = this;
  window.setInterval(
    function() { that.freshen_async(); }, 
    hours * 60 * 60 * 1000
  );
}

// Convert from localStorage.subscriptions, which maps urls to subs info, to
// localStorage.filter_lists, which maps ids to subs info
MyFilters._temp_convert_from_old_system = function() {
  var old_subs = localStorage.getItem('subscriptions');
  if (old_subs == null)
    return; // brand new user

  var converted = localStorage.getItem('converted_to_new_filters');
  if (converted)
    return;

  old_subs = JSON.parse(old_subs);

  var sub_options = MyFilters.__subscription_options;
  var new_subs = {};
  for (var url in old_subs) {
    var found = false;
    for (var id in sub_options) {
      if (sub_options[id].url == url) {
        new_subs[id] = old_subs[url];
        found = true;
      }
    }
    if (!found) { // user_submitted
      new_subs['url:' + url] = old_subs[url];
    }
  }

  // TODO: when everyone has converted, delete 'subscriptions' entirely.
  // and 'optimized_filters'.
  localStorage.setItem('converted_to_new_filters', true);
  localStorage.setItem('filter_lists', JSON.stringify(new_subs));
}

// Event fired when subscriptions have been updated, after the subscriptions
// have been persisted and filterset recalculated.
// Inputs: callback: fn(void)
MyFilters.prototype.updated = function(callback) {
  this._event_handlers.updated.push(callback);
}

// Save this._subscriptions to disk, create a new FilterSet instance, and fire 
// the "updated" handler.
// Inputs: none.
// Returns: null, after completion.
MyFilters.prototype.update = function() {
  localStorage.setItem('filter_lists', JSON.stringify(this._subscriptions));

  this.rebuild();

  // Fire updated event
  for (var i = 0; i < this._event_handlers.updated.length; i++)
    this._event_handlers.updated[i]();
}

// Rebuild this.filterset based on the current settings and subscriptions.
MyFilters.prototype.rebuild = function() {
  var texts = [];
  for (var id in this._subscriptions)
    if (this._subscriptions[id].subscribed)
      texts.push(this._subscriptions[id].text);
  texts = texts.join('\n').split('\n');

  // Remove duplicates.
  var hash = {}; for (var i = 0; i < texts.length; i++) hash[texts[i]] = 1;
  texts = []; for (var unique_text in hash) texts.push(unique_text);

  var options = utils.get_optional_features({});
  var ignored = Filter.adTypes.NONE;
  // TODO: don't do ignored ad type filtering here; do it at runtime when
  // you try to match a URL or when you want to know if a selector should
  // be applied.(?)  Then we don't have to rebuild the filters when they
  // change ad types.
  if (options.show_google_search_text_ads.is_enabled)
    ignored |= Filter.adTypes.GOOGLE_TEXT_AD;
  this.filterset = FilterSet.fromText(texts.join('\n'), ignored);
}

// If any subscribed filters are out of date, asynchronously load updated
// versions, then call this.update().  Asynchronous.
// Inputs: older_than?:int -- number of hours.  Any subscriptions staler
//         than this will be updated.  Defaults to 5 days.
// Returns: null (asynchronous)
MyFilters.prototype.freshen_async = function(older_than) {
  function out_of_date(subscription) {
    var hours_between_updates = (older_than == undefined ? 120 : older_than);
    var millis = new Date().getTime() - subscription.last_update;
    return (millis > 1000 * 60 * 60 * hours_between_updates);
  }
  // Fetch the latest filter text, put it in this._subscriptions, and update
  // ourselves.
  var that = this;
  function fetch_and_update(filter_id) {
    var url = that._subscriptions[filter_id].url;
    $.ajax({
      url: url,
      success: function(text) {
        log("Fetched " + url);
        if (!text || text.length == 0) // happens sometimes.  Weird, I know
          return;
        if (Filter.isComment(text) == false) // every legit list starts thus
          return;
          
        // In case the subscription disappeared while we were out
        // (which would happen if they unsubscribed to a user-submitted
        // filter)...
        if (that._subscriptions[filter_id] == undefined)
          return;

        that._subscriptions[filter_id].text = text;
        that._subscriptions[filter_id].last_update = new Date().getTime();
        that.update();
      },
      error: function() { log("Error fetching " + url); }
    });
  }
  for (var id in this._subscriptions) {
    if (this._subscriptions[id].subscribed &&
        out_of_date(this._subscriptions[id])) {
      fetch_and_update(id);
    }
  }
}

// Subscribe to a filter list.
// Inputs: id:string id of this filter -- either a well-known id, or "url:xyz",
//                   where xyz is the URL of a user-specified filterlist.
//         text:string value of the filter.  It's the caller's job to fetch
//                     and provide this.
// Returns: none, upon completion.
MyFilters.prototype.subscribe = function(id, text) {
  if (this._subscriptions[id] == undefined) {
    // New user-submitted filter.
    if (id.substring(0,4) != "url:")
      return; // dunno what went wrong, but let's quietly ignore it.
    // See if they accidentally subscribed to a URL that is already well-known.
    var wellKnownId = null;
    for (var existingId in this._subscriptions) {
      if (id == 'url:' + this._subscriptions[existingId].url)
        wellKnownId = existingId;
    }
    if (wellKnownId) {
      id = wellKnownId;
    } else {
      this._subscriptions[id] = {
        url: id.substring(4), // "url:xyz" -> "xyz"
        name: id.substring(4),
        user_submitted: true
      };
    }
  }
  this._subscriptions[id].subscribed = true;
  this._subscriptions[id].last_update = new Date().getTime();
  this._subscriptions[id].text = text;
  this.update();
}

// Unsubscribe from a filter list.  If the id is not a well-known list, remove
// it from _subscriptions completely.
// Inputs: id:string of filter list from which to unsubscribe.
//         del: (bool) if the filter should be removed or not
// Returns: none, upon completion.
MyFilters.prototype.unsubscribe = function(id, del) {
  if (this._subscriptions[id] == undefined)
    return;

  this._subscriptions[id].subscribed = false;
  delete this._subscriptions[id].text;
  delete this._subscriptions[id].last_update;

  if (!(id in MyFilters.__subscription_options) && del) {
    delete this._subscriptions[id];
  }
  this.update();
}

// Return a map from subscription id to
// {
//   subscribed:bool - whether user is subscribed to this subscription
//   url:string - url of this subscription
//   name:string - friendly name of this subscription
//   user_submitted:bool - true if this is a url typed in by the user
//   last_update?:number - if the subscription has ever been fetched,
//                         the ticks at which it was last fetched
// }
MyFilters.prototype.get_subscriptions_minus_text = function() {
  var result = {};
  for (var id in this._subscriptions) {
    result[id] = {
      url: this._subscriptions[id].url,
      subscribed: this._subscriptions[id].subscribed,
      user_submitted: this._subscriptions[id].user_submitted,
      name: ((MyFilters.__subscription_options[id] == undefined) ?
                   this._subscriptions[id].name :
                   MyFilters.__subscription_options[id].name),
      last_update: this._subscriptions[id].last_update
    }
  }
  return result;
}
// Return a map from subscription id to
// {
//   text:string - all filters from this subscription
// }
MyFilters.prototype.get_subscriptions_text = function() {
  var result = {};
  for (var id in this._subscriptions) {
    result[id] = {text: this._subscriptions[id].text}
  }
  return result;
}

// Return a new subscriptions object containing all available subscriptions,
// with EasyList and AdBlock custom filters subscribed from disk.
// Inputs: none.
MyFilters._load_hardcoded_subscriptions = function() {
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
      last_update: 0 // update ASAP
    };
  }

  result["adblock_custom"] = localfetch(
          "http://chromeadblock.com/filters/adblock_custom.txt",
          chrome.extension.getURL("filters/adblock_custom.txt"),
          "Chrome AdBlock custom filters (recommended)");

  result["easylist"] = localfetch(
          "http://adblockplus.mozdev.org/easylist/easylist.txt",
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
MyFilters.__merge_with_default = function(subscription_data) {
  for (var id in subscription_data) {
    if (MyFilters.__subscription_options[id] == undefined)
      subscription_data[id].user_submitted = true; // maybe already was
    // TODO: since the URLs in the official options are always canonical for
    // well-known lists, stop storing the url as a property in local storage,
    // and start calling MyFilters.urlForId(id), which parses url:xyz style
    // ids, or looks up the answer in the official options.  
    // But for now, make sure that any subscribed filters get their URLs
    // updated with the new address.
    else
      subscription_data[id].url = MyFilters.__subscription_options[id].url;
  }
  for (var id in MyFilters.__subscription_options) {
    if (subscription_data[id] == undefined) {
      subscription_data[id] = {
        url: MyFilters.__subscription_options[id].url,
        name: MyFilters.__subscription_options[id].name,
        user_submitted: false,
        subscribed: false
      };
    }
  }
  return subscription_data;
}
// Called below to fill MyFilters.__subscription_options.
MyFilters.__make_subscription_options = function() {
  var official_options = {
    "adblock_custom": {
      url: "http://chromeadblock.com/filters/adblock_custom.txt",
      name: "Chrome AdBlock custom filters (recommended)",
    },
    "__AdBlock_Advanced_Filters__": {
      url: "",
      name: "AdBlock advanced filters",
    },
    "easylist": {
      url: "http://adblockplus.mozdev.org/easylist/easylist.txt",
      name: "EasyList (recommended)",
    },
    "easylist_plus_bulgarian": {
      url: "http://stanev.org/abp/adblock_bg.txt",
      name: " - additional Bulgarian filters",
    },
    "dutch": { //id must not change!
      url: "http://sites.google.com/site/dutchadblockfilters/AdBlock_Dutch_hide.txt",
      name: " - additional Dutch filters",
    },
    "easylist_plus_finnish": {
      url: "http://www.wiltteri.net/wiltteri.txt",
      name: " - additional Finnish filters",
    },
    "easylist_plus_french": {
      url: "http://lian.info.tm/liste_fr.txt",
      name: " - additional French filters",
    },
    "easylist_plus_german": {
      url: "http://adblockplus.mozdev.org/easylist/easylistgermany.txt",
      name: " - additional German filters",
    },
    "easylist_plus_norwegian": {
      url: "http://home.online.no/~mlangsho/adblock.txt",
      name: " - additional Norwegian filters",
    },
    "easylist_plus_polish": {
      url: "http://adblocklist.org/adblock-pxf-polish.txt",
      name: " - additional Polish filters",
    },
    "easylist_plus_romanian": {
      url: "http://www.picpoc.ro/menetzrolist.txt",
      name: " - additional Romanian filters",
    },
    "easylist_plus_vietnamese": {
      url: "http://adblockplus-vietnam.googlecode.com/svn/trunk/abpvn.txt",
      name: " - additional Vietnamese filters",
    },
    "chinese": {
      url: "http://adblock-chinalist.googlecode.com/svn/trunk/adblock.txt",
      name: "Chinese filters",
    },
    "czech": {
      url: "http://adblock.dajbych.net/adblock.txt",
      name: "Czech filters",
    },
    "danish": {
      url: "http://adblock.schack.dk/block.txt",
      name: "Danish filters",
    },
    "german": {
      url: "http://chewey.de/mozilla/data/adblock.txt",
      name: "German filters",
    },
    "hungarian": {
      url: "http://pete.teamlupus.hu/hufilter.txt",
      name: "Hungarian filters",
    },
    "italian": {
      url: "http://mozilla.gfsolone.com/filtri.txt",
      name: "Italian filters",
    },
    "israeli": {
      url: "http://israellist.googlecode.com/files/IsraelList.txt",
      name: "Israeli filters",
    },
    "japanese": {
      url: "http://www.fanboy.co.nz/adblock/fanboy-adblocklist-jpn.txt",
      name: "Japanese filters",
    },
    "easylist_plun_korean": { // no longer w/ easylist, but ids mustn't change
      url: "http://abp-corset.googlecode.com/hg/corset.txt",
      name: "Korean filters",
    },
    "polish": {
      url: "http://www.niecko.pl/adblock/adblock.txt",
      name: "Polish filters",
    },
    "easylist_plus_spanish": { //id must not change!
      url: "abp.mozilla-hispano.org/nauscopio/filtros.txt",
      name: "Spanish filters",
    },
    "russian": {
      url: "http://ruadlist.googlecode.com/svn/trunk/adblock.txt",
      name: "Russian filters",
    },
     "ukranian": {
      url: "http://adblock.oasis.org.ua/banlist.txt",
      name: "Ukranian filters",
    },
  };
  var result = {};
  for (var id in official_options) {
    result[id] = {
      url: official_options[id].url,
      name: official_options[id].name,
      subscribed: false,
      user_submitted: false
    };
  }
  return result;
}
// The list of official subscription options.
MyFilters.__subscription_options = MyFilters.__make_subscription_options();
