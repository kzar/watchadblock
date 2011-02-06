// Requires jquery and 'utils.get_optional_features' method from background

// MyFilters class manages subscriptions and the FilterSet.

// Constructor: merge the stored subscription data and the total possible
// list of subscriptions into this._subscriptions.  Store to disk.
// Inputs: none.
function MyFilters() {
  var subscriptions_json = localStorage.getItem('filter_lists') || "null";
  this._subscriptions = JSON.parse(subscriptions_json);
  this._official_options = this._make_subscription_options();

  if (!this._subscriptions) {
    // Brand new user. Install some filters for them.
    this._subscriptions = this._load_default_subscriptions();
  }

  for (var id in this._subscriptions) {
    // In case a default subscription was removed from the default list,
    // change it to a user submitted list
    if (!this._official_options[id])
      this._subscriptions[id].user_submitted = true;
  }

  // Use the stored properties, and only add any new properties and/or lists
  // if they didn't exist in this._subscriptions
  for (var id in this._official_options) {
    if (!this._subscriptions[id])
      this._subscriptions[id] = {};
    this._subscriptions[id].url =
          this._subscriptions[id].url || this._official_options[id].url;
    this._subscriptions[id].name =
          this._subscriptions[id].name || this._official_options[id].name;
    this._subscriptions[id].user_submitted =
          this._subscriptions[id].user_submitted || false;
    this._subscriptions[id].requiresList =
          this._subscriptions[id].requiresList || 
          this._official_options[id].requiresList;
    this._subscriptions[id].subscribed = 
          this._subscriptions[id].subscribed || false;
  }

  // temp code to normalize non-normalized filters, one time.
  // had to make a second pass when the [style] ignore was updated.
  // and a third one when we started to throw errors on unsupported options
  // Installed 01/14/2011.  Remove after everyone has gotten this update.
  if (!localStorage['three_times_normalized_filters']) {
    delete localStorage['once_normalized_filters'];
    delete localStorage['twice_normalized_filters'];
    for (var id in that._subscriptions) {
      if (that._subscriptions[id].text) {
        that._subscriptions[id].text = FilterNormalizer.normalizeList(
                                              that._subscriptions[id].text);
      }
    }
    localStorage['three_times_normalized_filters'] = 'true';
  }
  // end temp code
  
  // Build the filter list
  this._onSubscriptionChange(true);

  // On startup and then every hour, check if a list is out of date and has to
  // be updated
  this.checkFilterUpdates();
  var that = this;
  window.setInterval(
    function() { that.checkFilterUpdates(); }, 
    60 * 60 * 1000
  );
}

// When a subscription property changes, this function stores it
// Inputs: rebuild? boolean, true if the filterset should be rebuilded
MyFilters.prototype._onSubscriptionChange = function(rebuild) {
  localStorage.setItem('filter_lists', JSON.stringify(this._subscriptions));

  if (rebuild)
    this.rebuild();

  utils.emit_broadcast({fn: 'filters_updated', options: {}});
}

// Rebuild this.[non]global based on the current settings and subscriptions.
MyFilters.prototype.rebuild = function() {
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

  var options = utils.get_optional_features({});
  var ignoreGoogleAds = options.show_google_search_text_ads.is_enabled;
  var filterset_data = FilterSet.fromText(texts.join('\n'), ignoreGoogleAds, true);
  this.nonglobal = filterset_data.nonglobal;
  this.global = filterset_data.global;
  // Chrome needs to send the same data about global filters to content
  // scripts over and over, so calculate it once and cache it.
  this.global.cached_getSelectors = this.global.getSelectors();
  this.global.cached_blockFiltersText = this.global.getBlockFilters().join('\n') + '\n';
}

// Change a property of a subscription or check if it has to be updated
// Inputs: id: the id of the subscription to change
//         subData: object containing all data that should be changed
//         fetch: if the subscriptions have to be fetched again forced
MyFilters.prototype.changeSubscription = function(id, subData, fetch) {
  var subscribeRequiredListToo = false;

  // Subscribing to an unknown list: create the list entry
  if (!this._subscriptions[id]) {
    for (var def in this._official_options)
      if (def.url == id.substr(4)) {
        id = def.id;
        break;
      }
    this._subscriptions[id] = {user_submitted: true};
    subscribeRequiredListToo = true;
  }

  // Subscribing to a well known list should also subscribe to a required list
  if (!this._subscriptions[id].subscribed && subData.subscribed)
    subscribeRequiredListToo = true;

  // Apply all changes from subData
  for (var property in subData) {
    this._subscriptions[id][property] = subData[property]
  }

  // Set the url and name if they didn't exist already
  if (!this._subscriptions[id].name)
    this._subscriptions[id].name = id.substr(4); //url:http...
  if (!this._subscriptions[id].url)
    this._subscriptions[id].url = id.substr(4); //url:http...

  if (this._subscriptions[id].subscribed) {
    // Check if the list has to be updated
    function out_of_date(subscription) {
      if (fetch) return true;
      var millis = new Date().getTime() - subscription.last_update;
      return (millis > 1000 * 60 * 60 * subscription.expiresAfterHours);
    }

    if (!this._subscriptions[id].text || out_of_date(this._subscriptions[id]))
      this.fetch_and_update(id);

  } else {
    // If unsubscribed, remove some properties
    delete this._subscriptions[id].text;
    delete this._subscriptions[id].last_update;
    delete this._subscriptions[id].expiresAfterHours;
    delete this._subscriptions[id].last_update_failed;
    if (this._subscriptions[id].deleteMe)
      delete this._subscriptions[id];
  }

  this._onSubscriptionChange();

  // Subscribe to a required list if nessecary
  if (subscribeRequiredListToo && this._subscriptions[id].requiresList)
    this.changeSubscription(this._subscriptions[id].requiresList, {subscribed:true});
}

// Fetch a filter list and parse it
MyFilters.prototype.fetch_and_update = function(id) {
  var url = this._subscriptions[id].url;
  var that = this;
  $.ajax({
    url: url,
    cache: false,
    success: function(text) {
      // In case the subscription disappeared while we were out
      if (!that._subscriptions[id] || 
          !that._subscriptions[id].subscribed)
        return;

      // Sometimes text is "". Happens sometimes.  Weird, I know.
      // Every legit list starts with a comment.
      if (text && text.length != 0 && Filter.isComment(text)) {
        log("Fetched " + url);
        that._updateSubscriptionText(id, text);
        that._onSubscriptionChange(true);
      } else {
        that._subscriptions[id].last_update_failed = true;
        log("Fetched, but invalid list " + url);
        that._onSubscriptionChange();
      }
    },
    error: function() {
      if (that._subscriptions[id]) {
        that._subscriptions[id].last_update_failed = true;
        that._onSubscriptionChange();
      }
      log("Error fetching " + url);
    }
  });
}

// Record that subscription_id is subscribed, was updated now, and has
// the given text.  Requires that this._subscriptions[subscription_id] exists.
MyFilters.prototype._updateSubscriptionText = function(id, text) {
  this._subscriptions[id].last_update = new Date().getTime();
  delete this._subscriptions[id].last_update_failed;

  // Record how many days until we need to update the subscription text
  this._subscriptions[id].expiresAfterHours = 120; // The default
  var checkLines = text.split('\n', 15); //15 lines should be enough
  var expiresRegex = /(?:expires\:|expires\ after\ )\ *(\d*[1-9]\d*)\ ?(h?)/i;
  var redirectRegex = /(?:redirect\:|redirects\ to\ )\ *(https?\:\/\/\S+)/i;
  for (var i = 0; i < checkLines.length; i++) {
    if (!Filter.isComment(checkLines[i]))
      continue;
    var match = checkLines[i].match(redirectRegex);
    if (match) {
      this._subscriptions[id].url = match[1]; //assuming the URL is always correct
      this._subscriptions[id].last_update = 0; //update ASAP
    }
    match = checkLines[i].match(expiresRegex);
    if (match) {
      var hours = parseInt(match[1]) * (match[2] == "h" ? 1 : 24);
      this._subscriptions[id].expiresAfterHours = Math.min(hours, 21*24); // 3 week maximum
    }
  }

  this._subscriptions[id].text = FilterNormalizer.normalizeList(text);
}

// Checks if subscriptions have to be updated
// Inputs: force? (boolean), true if every filter has to be updated
MyFilters.prototype.checkFilterUpdates = function(force) {
  for (var id in this._subscriptions) {
    if (this._subscriptions[id].subscribed) {
      this.changeSubscription(id, {}, force);
    }
  }
}

// If the user wasn't subscribed to any lists, subscribe to
// EasyList, AdBlock custom and (if any) a localized subscription
// Inputs: none.
// Returns an object containing the subscribed lists
MyFilters.prototype._load_default_subscriptions = function() {
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
      case 'pl': return 'easylist_plus_polish';//sorry for the other Polish list
      case 'ro': return 'easylist_plus_romanian';
      case 'ru': return 'russian';
      case 'uk': return 'ukranian';
      case 'vi': return 'easylist_plus_vietnamese';
      case 'zh': return 'chinese';
      default: return '';
    }
  }

  //Update will be done immediately after this function returns
  result["adblock_custom"] = { subscribed: true };
  result["easylist"] = { subscribed: true };
  
  var language = navigator.language.match(/^([a-z]+).*/i)[1];
  var list_for_lang = langToList(language);
  if (list_for_lang)
    result[list_for_lang] = { subscribed: true };

  return result;
}

// Used to create the list of default subscriptions
// Called when MyFilters is created, afterwards it gets deleted...
// Returns: that list
MyFilters.prototype._make_subscription_options = function() {
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
      requiresList: official_options[id].requiresList
    };
  }
  return result;
}

/* subscription properties:
url: url of subscription
name: name to display for subscription
user_submitted (bool): submitted by the user or not
requiresList: id of a list required for this list
subscribed (bool): if you are subscribed to the list or not
last_update (date): time of the last succesfull update
last_update_failed (bool): true if the last update attempt failed
text: the filters of the subscription
expiresAfterHours (int): the time after which the subscription expires
deleteMe (bool): if the subscription has to be deleted
*/