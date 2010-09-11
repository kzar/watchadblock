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

  // Check for subscriptions to be updated on startup
  this.freshen_async();

  var hours = 1;
  var that = this;
  window.setInterval(
    function() { that.freshen_async(); }, 
    hours * 60 * 60 * 1000
  );
}

// 7/24/2010: delete remnants of old filter system, now that everyone has
// been converted from old to new without losing their old filters.
// You can remove this code within a month or so -- no big deal if someone
// never runs it.
MyFilters._temp_convert_from_old_system = function() {
  localStorage.removeItem('subscriptions');
  localStorage.removeItem('optimized_filters');
  localStorage.removeItem('converted_to_new_filters');
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

  // Include custom filters.
  texts.push( utils.storage_get({key: 'custom_filters', default_value: ''}) );

  texts = texts.join('\n').split('\n');

  // Remove duplicates and empties.
  var hash = {}; for (var i = 0; i < texts.length; i++) hash[texts[i]] = 1;
  delete hash[''];
  texts = []; for (var unique_text in hash) texts.push(unique_text);

  var options = utils.get_optional_features({});
  // temp Until Chrome fixes their bug, we ignore certain patterns of
  // rules.
  var ignored = Filter.adTypes.STYLE_HIDE_BREAKING_GOOGLE_SERVICES;
  if (options.show_google_search_text_ads.is_enabled)
    ignored |= Filter.adTypes.GOOGLE_TEXT_AD;
  this.filterset = FilterSet.fromText(texts.join('\n'), ignored);
}

// If any subscribed filters are out of date, asynchronously load updated
// versions, then call this.update().  Asynchronous.
// Inputs: force?:bool -- if true, update all subscribed lists even if
//         they aren't out of date.
// Returns: null (asynchronous)
MyFilters.prototype.freshen_async = function(force) {
  var that = this; // temp along with 7/23/2010 code below
  function out_of_date(subscription) {
    // temp code to add .expiresAfterHours property to pre-7/23/2010 subscriptions.
    // Remove after you're confident everyone has updated since 7/23/2010.
    if (subscription.expiresAfterHours == undefined) {
      subscription.expiresAfterHours = 120;
      localStorage.setItem('filter_lists', JSON.stringify(that._subscriptions));
    } // end temp code

    if (force) return true;

    var millis = new Date().getTime() - subscription.last_update;
    return (millis > 1000 * 60 * 60 * subscription.expiresAfterHours);
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

        that._updateSubscriptionText(filter_id, text);
        
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

//Fetch a locally stored subscription!
function localfetch(real_url, local_url, name) {
  // jQuery has a bug that keeps $.ajax() from loading local files.
  // Use plain old XHR.
  try {
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
      last_update: 0, // update ASAP
      expiresAfterHours: 120
    };
  } catch(ex) {}
}

// Subscribe to a filter list.
// Inputs: id:string id of this filter -- either a well-known id, or "url:xyz",
//                   where xyz is the URL of a user-specified filterlist.
//         text:string value of the filter.  It's the caller's job to fetch
//                     and provide this.
// Returns: none, upon completion.
MyFilters.prototype.subscribe = function(id, text) {
  var wellKnownId = null;
  if (this._subscriptions[id] == undefined) {
    // New user-submitted filter.
    if (id.substring(0,4) != "url:")
      return; // dunno what went wrong, but let's quietly ignore it.
    // See if they accidentally subscribed to a URL that is already well-known.
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
  } else {
    //default filter
    wellKnownId = id;
  }

  //subscribe to EasyList too if the filter was an additional one...
  if (wellKnownId &&
      this._subscriptions[id].name.indexOf(' - additional') == 0 &&
      this._subscriptions['easylist'].subscribed == false) {
    var easylist_local = localfetch(
        MyFilters.__subscription_options['easylist'].url,
        chrome.extension.getURL("filters/easylist.txt"),
        MyFilters.__subscription_options['easylist'].name);
    if (easylist_local)
      this.subscribe('easylist', easylist_local.text);
  }

  this._updateSubscriptionText(id, text);

  this.update();
}

// Record that subscription_id is subscribed, was updated now, and has
// the given text.  Requires that this._subscriptions[subscription_id] exists.
MyFilters.prototype._updateSubscriptionText = function(subscription_id, text) {
  var sub_data = this._subscriptions[subscription_id];

  sub_data.subscribed = true;
  sub_data.text = text;
  sub_data.last_update = new Date().getTime();

  // Record how many days until we need to update the subscription text
  sub_data.expiresAfterHours = 120; // The default
  var expiresRegex = /(?:expires\:|expires\ after\ )\ *(\d*[1-9]\d*)\ ?(h?)/i;
  var redirectRegex = /(?:redirect\:|redirects\ to\ )\ *(https?\:\/\/\S+)/i;
  var checkLines = text.split('\n', 15); //15 lines should be enough
  for (var i = 0; i < checkLines.length; i++) {
    if (!Filter.isComment(checkLines[i]))
      continue;
    var match = checkLines[i].match(redirectRegex);
    if (match) {
      sub_data.url = match[1]; //assuming the URL is always correct
      sub_data.last_update = 0; //update ASAP
    }
    match = checkLines[i].match(expiresRegex);
    if (match) {
      var hours = parseInt(match[1]) * (match[2] == "h" ? 1 : 24);
      sub_data.expiresAfterHours = Math.min(hours, 21*24); // 3 week maximum
    }
  }
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
  delete this._subscriptions[id].expiresAfterHours;

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
//   last_update?:number - undefined if unsubscribed.  The ticks at which
//                         this subscription was last fetched.  0 if it was
//                         loaded off the hard drive and never successfully
//                         fetched from the web.
//   expiresAfterHours?:number - if subscribed, the number of hours after 
//                               which this subscription should be refetched
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
      last_update: this._subscriptions[id].last_update,
      expiresAfterHours: this._subscriptions[id].expiresAfterHours
    }
  }
  return result;
}

// Return a new subscriptions object containing all available subscriptions,
// with EasyList and AdBlock custom filters subscribed from disk.
// Inputs: none.
MyFilters._load_hardcoded_subscriptions = function() {
  var result = {};

  result["adblock_custom"] = localfetch(
          MyFilters.__subscription_options['adblock_custom'].url,
          chrome.extension.getURL("filters/adblock_custom.txt"),
          MyFilters.__subscription_options['adblock_custom'].name);

  result["easylist"] = localfetch(
          MyFilters.__subscription_options['easylist'].url,
          chrome.extension.getURL("filters/easylist.txt"),
          MyFilters.__subscription_options['easylist'].name);

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
      name: "AdBlock custom filters (recommended)",
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
    "russian": { //id must not change!
      url: "https://ruadlist.googlecode.com/svn/trunk/advblock.txt",
      name: " - additional Russian filters",
    },
    "easylist_plus_vietnamese": {
      url: "http://adblockplus-vietnam.googlecode.com/svn/trunk/abpvn.txt",
      name: " - additional Vietnamese filters",
    },
    "chinese": {
      url: "http://adblock-chinalist.googlecode.com/svn/trunk/adblock.txt",
      name: "Chinese filters",
    },
    "danish": {
      url: "http://adblock.schack.dk/block.txt",
      name: "Danish filters",
    },
    "hungarian": {
      url: "http://pete.teamlupus.hu/hufilter.txt",
      name: "Hungarian filters",
    },
    "israeli": {
      url: "http://israellist.googlecode.com/files/IsraelList.txt",
      name: "Israeli filters",
    },
    "italian": {
      url: "http://mozilla.gfsolone.com/filtri.txt",
      name: "Italian filters",
    },
    "japanese": {
      url: "https://secure.fanboy.co.nz/fanboy-japanese.txt",
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
      url: "http://abp.mozilla-hispano.org/nauscopio/filtros.txt",
      name: "Spanish filters",
    },
    "ukranian": {
      url: "http://adblock.oasis.org.ua/banlist.txt",
      name: "Ukranian filters",
    },
    "easyprivacy": {
      url: "https://easylist-downloads.adblockplus.org/easyprivacy.txt",
      name: "EasyPrivacy",
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
