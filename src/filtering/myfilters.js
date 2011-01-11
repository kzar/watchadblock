// Requires jquery.

// MyFilters class manages subscriptions and the FilterSet.

// Constructor: merge the stored subscription data and the total possible
// list of subscriptions into this._subscriptions.  Store to disk.
// Inputs: none.
function MyFilters() {
  this._event_handlers = { 'updated': [] };

  this._subscriptions = MyFilters._buildFilterLists();

  // temp code to normalize non-normalize filters, one time.
  // had to make a second pass when the [style] ignore was updated.
  // Installed 12/27/2010.  Remove after everyone has gotten this update.
  (function(that) {
    if (localStorage['twice_normalized_filters'])
      return;
    delete localStorage['once_normalized_filters'];
    for (var id in that._subscriptions) {
      if (that._subscriptions[id].text) {
        that._subscriptions[id].text = FilterNormalizer.normalizeList(
                                              that._subscriptions[id].text);
      }
    }
    localStorage['twice_normalized_filters'] = 'true';
  })(this);
  // end temp code

  this._onChange();

  // On startup, fetch new versions of expired filter list text
  this.freshen_async();

  var hours = 1;
  var that = this;
  window.setInterval(
    function() { that.freshen_async(); }, 
    hours * 60 * 60 * 1000
  );
}

// Combine any stored filter list data with the canonical filter list
// data and return a list of FilterList objects.
MyFilters._buildFilterLists = function() {
  var json = localStorage.getItem('filter_lists') || "null";
  var stored_data = JSON.parse(json);

  if (stored_data == null) {
    // Brand new user.  Install some filter lists for them.
    stored_data = MyFilters._load_default_subscriptions();
  }

  // In case a new version of AdBlock has removed or added some
  // subscription options, merge with MyFilters.__subscription_options.
  return MyFilters.__merge_with_default(stored_data);
}


// Event fired upon subscribe/unsubscribe/text update, after the subscriptions
// have been persisted and filterset recalculated.
// Inputs: callback: fn(void)
MyFilters.prototype.updated = function(callback) {
  this._event_handlers.updated.push(callback);
}

// Save this._subscriptions to disk, create a new FilterSet instance, and fire 
// the "updated" handler.
// Inputs: none.
// Returns: null, after completion.
MyFilters.prototype._onChange = function() {
  localStorage.setItem('filter_lists', JSON.stringify(this._subscriptions));

  this._rebuild();

  // Fire updated event
  for (var i = 0; i < this._event_handlers.updated.length; i++)
    this._event_handlers.updated[i]();
}

// Rebuild this.[non]global based on the current settings and subscriptions.
MyFilters.prototype._rebuild = function() {
  var texts = [];
  for (var id in this._subscriptions)
    if (this._subscriptions[id].subscribed)
      texts.push(this._subscriptions[id].text);

  // Include custom filters.
  var customfilters = utils.storage_get({key: 'custom_filters', default_value: ''});
  if (customfilters)
    texts.push(FilterNormalizer.normalizeList(customfilters));

  texts = texts.join('\n').split('\n');

  // Remove duplicates and empties.
  var hash = {}; for (var i = 0; i < texts.length; i++) hash[texts[i]] = 1;
  delete hash[''];
  texts = []; for (var unique_text in hash) texts.push(unique_text);

  var options = chrome.extension.getBackgroundPage().utils.get_optional_features({});
  var ignoreGoogleAds = options.show_google_search_text_ads.is_enabled;
  var filterset_data = FilterSet.fromText(texts.join('\n'), ignoreGoogleAds, true);
  this.nonglobal = filterset_data.nonglobal;
  this.global = filterset_data.global;
  // Chrome needs to send the same data about global filters to content
  // scripts over and over, so calculate it once and cache it.
  this.global.cached_getSelectors = this.global.getSelectors();
  this.global.cached_blockFiltersText = this.global.getBlockFilters().join('\n') + '\n';
}

// If any subscribed filter lists have expired, asynchronously fetch latest
// text, then call this._onChange().  Asynchronous.
// Inputs: force?:bool -- if true, fetch latest text for all subscribed lists
//         even if they aren't out of date.
// Returns: null (asynchronous)
MyFilters.prototype.freshen_async = function(force) {
  function out_of_date(subscription) {
    if (force) return true;

    var millis = new Date().getTime() - subscription.last_update;
    return (millis > 1000 * 60 * 60 * subscription.expiresAfterHours);
  }
  // Fetch the latest filter text, put it in this._subscriptions, and call
  // _onChange.
  var that = this;
  function fetch_and_update(filter_id) {
    var url = that._subscriptions[filter_id].url;
    $.ajax({
      url: url,
      cache: false,
      success: function(text) {
        // In case the subscription disappeared while we were out
        // (which would happen if they unsubscribed to a user-submitted
        // filter)...
        if (that._subscriptions[filter_id] == undefined)
          return;

        // Sometimes text is "". Happens sometimes.  Weird, I know.
        // Every legit list starts with a comment.
        if (text && text.length != 0 && Filter.isComment(text)) {
          log("Fetched " + url);
          that.setText(filter_id, text);
        } else {
          that._subscriptions[filter_id].last_update_failed = true;
          log("Fetched, but invalid list " + url);
        }

        that._onChange();
      },
      error: function() {
        if (that._subscriptions[filter_id]) {
          that._subscriptions[filter_id].last_update_failed = true;
          that._onChange();
        }
        log("Error fetching " + url);
      }
    });
  }
  for (var id in this._subscriptions) {
    if (this._subscriptions[id].subscribed &&
        out_of_date(this._subscriptions[id])) {
      fetch_and_update(id);
    }
  }
}

// Get a subscription with default settings that has to be updated ASAP
MyFilters.get_default_subscription = function(id) {
  var s_o = MyFilters.__subscription_options;
  return {
    url: s_o[id] ? s_o[id].url : id.substring(4),
    name: s_o[id] ? s_o[id].name : id.substring(4),
    user_submitted: s_o[id] ? false : true,
    subscribed: true,
    text: '',
    last_update: 0, // fetch latest text ASAP
    expiresAfterHours: 120
  }
}

// Subscribe to a filter list.
// Inputs: id:string id of this filter -- either a well-known id, or "url:xyz",
//                   where xyz is the URL of a user-specified filterlist.
//         text:string value of the filter.  It's the caller's job to fetch
//                     and provide this.
//         requiresList?: id of a list that is required by the current list
// Returns: none, upon completion.
MyFilters.prototype.subscribe = function(id, text, requiresList) {
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
        user_submitted: true,
        requiresList: requiresList
      };
    }
  } else {
    //default filter
    wellKnownId = id;
  }

  // Subscribe to another list too if required.

  // If a user clicks abp:subscribe?location=a&requiresLocation=b, then
  // even if our stored data about a doesn't mention b as a requiresList,
  // we should subscribe to it.
  var require = this._subscriptions[id].requiresList || requiresList;
  if (require && !(this._subscriptions[require] && 
                   this._subscriptions[require].subscribed)) {
    this._subscriptions[require] = MyFilters.get_default_subscription(require);
    this._onChange();
    this.freshen_async();
  }

  this._subscriptions[id].subscribed = true;
  this.setText(id, text);

  this._onChange();
}

// Set the text for the given filter list.  Normalizes the text, and possibly 
// modifies last_update, last_update_failed, expiresAfterHours, and url.
// Does nothing for unsubscribed filter_list_ids.
// Inputs:
//   filter_list_id: id of filter list
//   dirty_text: full text of filter list, possibly not normalized
// Returns: undefined
MyFilters.prototype.setText = function(filter_list_id, dirty_text) {
  var sub_data = this._subscriptions[filter_list_id];
  if (!sub_data)
    return;

  // Find a match to a regex in first 15 lines of dirty_text
  function extract(regex) {
    var checkLines = dirty_text.split('\n', 15); // 15 lines should be enough
    for (var i = 0; i < checkLines.length; i++) {
      if (!Filter.isComment(checkLines[i]))
        continue;
      var match = checkLines[i].match(regex);
      if (match)
        return match;
    }
    return null;
  }

  // Parse expires: header: days until we need to re-fetch the filter list text
  sub_data.expiresAfterHours = 120; // The default
  var match = extract(/(?:expires\:|expires\ after\ )\ *(\d*[1-9]\d*)\ ?(h?)/i);
  if (match) {
    var hours = parseInt(match[1]) * (match[2] == "h" ? 1 : 24);
    sub_data.expiresAfterHours = Math.min(hours, 21*24); // 3 week maximum
  }

  // Parse redirect: header: the correct URL
  match = extract(/(?:redirect\:|redirects\ to\ )\ *(https?\:\/\/\S+)/i);
  if (match) {
    sub_data.url = match[1]; // assuming the URL is always correct
    // TODO refactor how to handle this?  Maybe don't refetch till next time?
    sub_data.last_update = 0; // fetch new text ASAP
  }

  sub_data.last_update = new Date().getTime();
  delete sub_data.last_update_failed;
  sub_data.text = FilterNormalizer.normalizeList(dirty_text);
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
  delete this._subscriptions[id].last_update_failed;

  if (!(id in MyFilters.__subscription_options) && del) {
    delete this._subscriptions[id];
  }
  this._onChange();
}

// Return a map from subscription id to
// {
//   subscribed:bool - whether user is subscribed to this subscription
//   url:string - url of this subscription
//   name:string - friendly name of this subscription
//   user_submitted:bool - true if this is a url typed in by the user
//   last_update?:number - undefined if unsubscribed.  The ticks at which
//                         this filter list's text was last fetched.  0 if it 
//                         has never been fetched from the web.
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

// If the user wasn't subscribed to any lists, subscribe to
// EasyList, AdBlock custom and (if any) a localized subscription
// Inputs: none.
MyFilters._load_default_subscriptions = function() {
  var result = {};

  //returns the ID of a list for a given language code
  function langToList(lang) {
    switch(lang) {
      case 'bg': return 'easylist_plus_bulgarian';
      case 'cs': return 'czech';
      case 'cu': return 'easylist_plus_bulgarian';
      case 'da': return 'danish';
      case 'de': return 'easylist_plus_german';
      case 'es': return 'easylist_plus_spanish';
      case 'fi': return 'easylist_plus_finnish';
      case 'fr': return 'easylist_plus_french';
      case 'he': return 'israeli';
      case 'hu': return 'hungarian';
      case 'it': return 'italian';
      case 'ja': return 'japanese';
      case 'ko': return 'easylist_plun_korean';
      case 'nb': return 'easylist_plus_norwegian';
      case 'nl': return 'dutch';
      case 'nn': return 'easylist_plus_norwegian';
      case 'no': return 'easylist_plus_norwegian';
      case 'pl': return 'easylist_plus_polish';//sorry for the other polish list
      case 'ro': return 'easylist_plus_romanian';
      case 'ru': return 'russian';
      case 'uk': return 'ukranian';
      case 'vi': return 'easylist_plus_vietnamese';
      case 'zh': return 'chinese';
      default: return '';
    }
  }

  // Text for these will be fetched immediately after this function returns
  result["adblock_custom"] = MyFilters.get_default_subscription('adblock_custom');
  result["easylist"] = MyFilters.get_default_subscription('easylist');
  var language = navigator.language.match(/^([a-z]+).*/i)[1];
  var list_for_lang = langToList(language);
  if (list_for_lang)
    result[list_for_lang] = MyFilters.get_default_subscription(list_for_lang);

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
    else {
      subscription_data[id].url = MyFilters.__subscription_options[id].url;
      subscription_data[id].requiresList = 
                              MyFilters.__subscription_options[id].requiresList;
    }
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
      requiresList: "easylist",
    },
    "dutch": { //id must not change!
      url: "http://sites.google.com/site/dutchadblockfilters/AdBlock_Dutch_hide.txt",
      name: " - additional Dutch filters",
      requiresList: "easylist",
    },
    "easylist_plus_finnish": {
      url: "http://www.wiltteri.net/wiltteri.txt",
      name: " - additional Finnish filters",
      requiresList: "easylist",
    },
    "easylist_plus_french": {
      url: "http://lian.info.tm/liste_fr.txt",
      name: " - additional French filters",
      requiresList: "easylist",
    },
    "easylist_plus_german": {
      url: "http://adblockplus.mozdev.org/easylist/easylistgermany.txt",
      name: " - additional German filters",
      requiresList: "easylist",
    },
    "easylist_plus_norwegian": {
      url: "http://home.online.no/~mlangsho/adblock.txt",
      name: " - additional Norwegian filters",
      requiresList: "easylist",
    },
    "easylist_plus_polish": {
      url: "http://adblocklist.org/adblock-pxf-polish.txt",
      name: " - additional Polish filters",
      requiresList: "easylist",
    },
    "easylist_plus_romanian": {
      url: "http://www.zoso.ro/pages/rolist.txt",
      name: " - additional Romanian filters",
      requiresList: "easylist",
    },
    "russian": { //id must not change!
      url: "https://ruadlist.googlecode.com/svn/trunk/advblock.txt",
      name: " - additional Russian filters",
      requiresList: "easylist",
    },
    "easylist_plus_vietnamese": {
      url: "http://adblockplus-vietnam.googlecode.com/svn/trunk/abpvn.txt",
      name: " - additional Vietnamese filters",
      requiresList: "easylist",
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
    "hungarian": {
      url: "http://pete.teamlupus.hu/hufilter.txt",
      name: "Hungarian filters",
    },
    "israeli": {
      url: "https://secure.fanboy.co.nz/israelilist/IsraelList.txt",
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
      user_submitted: false,
      requiresList: official_options[id].requiresList
    };
  }
  return result;
}
// The list of official subscription options.
MyFilters.__subscription_options = MyFilters.__make_subscription_options();
