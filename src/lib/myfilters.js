"use strict";

var functions = require("functions");
var port = require("port");
var background = require("background");
var idlehandler = require("idlehandler");

// must be on a page with access to the background page

// MyFilters class manages subscriptions and the FilterSet.

// Constructor: merge the stored subscription data and the total possible
// list of subscriptions into this._subscriptions.  Store to disk.
// Inputs: none.
var HOUR_IN_MS = 1000 * 60 * 60;

var MyFilters = function () {
    this._subscriptions = functions.storage_get('filter_lists');
    this._official_options = this._make_subscription_options();
};

// Update _subscriptions and _official_options in case there are changes.
// Should be invoked right after creating a MyFilters object.
MyFilters.prototype.init = function () {

    var newUser = !this._subscriptions;
    this._updateDefaultSubscriptions();

    this._updateFieldsFromOriginalOptions();

    // Build the filter list
    this._onSubscriptionChange(true);

    // On startup and then every hour, check if a list is out of date and has to
    // be updated
    var that = this;

    if (newUser) {
        this.checkFilterUpdates();
    } else
        idlehandler.idleHandler.scheduleItemOnce(
            function () {
                that.checkFilterUpdates();
            },
            60
        );

    var scheduleCheckFilterUpdates = function () {
        idlehandler.idleHandler.scheduleItemOnce(function () {
            that.checkFilterUpdates();
        });
    };
    if (typeof window !== "undefined") {
        window.setTimeout(scheduleCheckFilterUpdates, 60 * 60 * 1000);
    } else {
        require('sdk/timers').setTimeout(scheduleCheckFilterUpdates, 60 * 60 * 1000);
    }

};
// Update the url and requiresList for entries in _subscriptions using values from _official_options.
MyFilters.prototype._updateFieldsFromOriginalOptions = function () {
    // Use the stored properties, and only add any new properties and/or lists
    // if they didn't exist in this._subscriptions
    for (var id in this._official_options) {
        if (!this._subscriptions[id])
            this._subscriptions[id] = {};

        var sub = this._subscriptions[id];
        var official = this._official_options[id];

        sub.initialUrl = sub.initialUrl || official.url;
        sub.url = sub.url || official.url;
        if (sub.initialUrl !== official.url) {
            // The official URL was changed. Use it. In case of a redirect, this
            // doesn't happen as only sub.url is changed, not sub.initialUrl.
            sub.initialUrl = official.url;
            sub.url = official.url;
        }

        var isMissingRequiredList = (sub.requiresList !== official.requiresList);
        if (official.requiresList && isMissingRequiredList && sub.subscribed) {
            // A required list was added.  Make sure main list subscribers get it.
            if (this._subscriptions[official.requiresList])
                this.changeSubscription(official.requiresList, {subscribed: true});
        }
        sub.requiresList = official.requiresList;
        sub.subscribed = sub.subscribed || false;
    }
};
// Update default subscriptions in the browser storage.
// Removes subscriptions that are no longer in the official list, not user submitted and no longer subscribed.
// Also, converts user submitted subscriptions to recognized one if it is already added to the official list
// and vice-versa.
MyFilters.prototype._updateDefaultSubscriptions = function () {

    if (!this._subscriptions) {

        // Brand new user. Install some filters for them.
        this._subscriptions = this._load_default_subscriptions();
        return;
    }

    for (var id in this._subscriptions) {
        // Delete unsubscribed ex-official lists.
        if (!this._official_options[id] && !this._subscriptions[id].user_submitted
            && !this._subscriptions[id].subscribed) {
            delete this._subscriptions[id];
        }
        // Convert subscribed ex-official lists into user-submitted lists.
        // Convert subscribed ex-user-submitted lists into official lists.
        else {
            // TODO: Remove this logic after a few releases
            if (id === "easylist_plus_spanish" || id === "norwegian") {
                delete this._subscriptions[id];
                continue;
            }
            // Cache subscription that needs to be checked.
            var sub_to_check = this._subscriptions[id];
            var is_user_submitted = true;
            var update_id = id;
            if (!this._official_options[id]) {
                // If id is not in official options, check if there's a matching url in the
                // official list. If there is, then the subscription is not user submitted.
                for (var official_id in this._official_options) {
                    var official_url = this._official_options[official_id].url;
                    if (sub_to_check.initialUrl === official_url
                        || sub_to_check.url === official_url) {
                        is_user_submitted = false;
                        update_id = official_id;
                        break;
                    }
                }
            } else {
                is_user_submitted = false;
            }

            sub_to_check.user_submitted = is_user_submitted;

            // Function that will add a new entry with updated id,
            // and will remove old entry with outdated id.
            var that = this;
            var renameSubscription = function (old_id, new_id) {
                that._subscriptions[new_id] = that._subscriptions[old_id];
                delete that._subscriptions[old_id];
            };

            // Create new id and check if new id is the same as id.
            // If not, update entry in subscriptions.
            var new_id = is_user_submitted ? ("url:" + sub_to_check.url) : update_id;

            if (new_id !== id) {
                renameSubscription(id, new_id);
            }
        }
    }
};
// When a subscription property changes, this function stores it
// Inputs: rebuild? boolean, true if the filterset should be rebuilt
MyFilters.prototype._onSubscriptionChange = function (rebuild) {
    functions.storage_set('filter_lists', this._subscriptions);

    // The only reasons to (re)build the filter set are
    // - when AdBlock starts
    // - when a filter list text is changed ([un]subscribed or updated a list)
    if (rebuild)
        this.rebuild();

    port.chrome.extension.sendRequest({command: "filters_updated"});
};

// get filters that are defined in the extension
MyFilters.prototype.getExtensionFilters = function (settings) {
    //Exclude google search results ads if the user has checked that option
    var texts = [];
    if (settings.show_google_search_text_ads) {
        // Standard search
        texts.push("@@||google.*/search?$elemhide");
        // Google Instant: go to google.com, type 'hotel' and don't press Enter
        texts.push("@@||www.google.*/|$elemhide");
        // Google Instant: open a Chrome tab, type 'hotel' and don't press Enter
        texts.push("@@||google.*/webhp?*sourceid=*instant&$elemhide");
    }
    if (settings.whitelist_hulu_ads) {
        // Issue 7178: FilterNormalizer removes EasyList's too-broad Hulu whitelist
        // entries.  If the user enables whitelist_hulu_ads, just add them back.
        // This workaround can be removed when EasyList changes its Hulu strategy.
        texts.push("@@||ads.hulu.com/published/*.flv");
        texts.push("@@||ads.hulu.com/published/*.mp4");
        texts.push("@@||ll.a.hulu.com/published/*.flv");
        texts.push("@@||ll.a.hulu.com/published/*.mp4");
    }
    // Exclude private search results ads
    if (functions.storage_get("search_secure_enable") === "true")
        texts.push("@@||search.disconnect.me/$document");

    return texts;
};

// Rebuild filters based on the current settings and subscriptions.
MyFilters.prototype.rebuild = function () {

    var texts = [];

    for (var id in this._subscriptions) {
        if (this._subscriptions[id].subscribed)
            texts.push(this._subscriptions[id].text);
    }

    // Include custom filters.
    var customfilters = background.get_custom_filters_text(); // from background
    if (customfilters)
        texts.push(FilterNormalizer.normalizeList(customfilters));

    texts = texts.concat(this.getExtensionFilters(background.get_settings()));

    texts = texts.join('\n').split('\n');
    // Remove duplicates and empties.
    var unique = {};
    for (var i = 0; i < texts.length; i++)
        unique[texts[i]] = 1;
    delete unique[''];

    var filters = {
        hidingUnmerged: [], hiding: {}, exclude: {},
        pattern: {}, whitelist: {}
    };
    for (var text in unique) {
        var filter = Filter.fromText(text);
        if (Filter.isSelectorExcludeFilter(text))
            functions.setDefault(filters.exclude, filter.selector, []).push(filter);
        else if (Filter.isSelectorFilter(text))
            filters.hidingUnmerged.push(filter);
        else if (Filter.isWhitelistFilter(text)) {
            filters.whitelist[filter.id] = filter;
        } else
            filters.pattern[filter.id] = filter;
    }

    for (var i = 0; i < filters.hidingUnmerged.length; i++) {
        filter = filters.hidingUnmerged[i];
        var hider = SelectorFilter.merge(filter, filters.exclude[filter.selector]);
        filters.hiding[hider.id] = hider;
    }

    this.hiding = FilterSet.fromFilters(filters.hiding);

    this.blocking = new BlockingFilterSet(
        FilterSet.fromFilters(filters.pattern),
        FilterSet.fromFilters(filters.whitelist)
    );

    //if the user is subscribed to malware, then get it
    if (this._subscriptions &&
        this._subscriptions.malware &&
        this._subscriptions.malware.subscribed && !this.getMalwareDomains()) {
        this._initializeMalwareDomains();
    }

    // After 90 seconds, delete the cache. That way the cache is available when
    // rebuilding multiple times in a row (when multiple lists have to update at
    // the same time), but we save memory during all other times.
    var clearFilterCache = function () {
        Filter._cache = {};
    };
    if (typeof window !== "undefined") {
        window.setTimeout(clearFilterCache, 90000);
    } else {
        require('sdk/timers').setTimeout(clearFilterCache, 90000);
    }
};

// Change a property of a subscription or check if it has to be updated
// Inputs: id: the id of the subscription to change
//         subData: object containing all data that should be changed
//         forceFetch: if the subscriptions have to be fetched again forced
MyFilters.prototype.changeSubscription = function (id, subData, forceFetch) {
    var subscribeRequiredListToo = false;
    var listDidntExistBefore = false;

    // Check if the list has to be updated
    function out_of_date(subscription) {
        if (forceFetch) return true;
        // After a failure, wait at least a day to refetch (overridden below if
        // it's a new filter list, having no .text)
        var failed_at = subscription.last_update_failed_at || 0;
        if (Date.now() - failed_at < HOUR_IN_MS * 24)
            return false;
        // Don't let expiresAfterHours delay indefinitely (Issue 7443)
        var hardStop = subscription.expiresAfterHoursHard || 240;
        var smallerExpiry = Math.min(subscription.expiresAfterHours, hardStop);
        var millis = Date.now() - subscription.last_update;
        return (millis > HOUR_IN_MS * smallerExpiry);
    }

    //since the malware ID isn't really a filter list, we need to process it seperately
    if (id === "malware") {
        // Apply all changes from subData
        for (var property in subData) {
            if (subData[property] !== undefined) {
                this._subscriptions[id][property] = subData[property];
            }
        }

        if (this._subscriptions[id].subscribed) {
            //if forceFetch, set the last update timestamp of the malware to zero, so it's updated now.
            if (forceFetch) {
                this._subscriptions.malware.last_update = 0;
            }
            //load the malware domains
            this._loadMalwareDomains();
        } else {
            this.blocking.setMalwareDomains(null);
            // If unsubscribed, remove properties
            delete this._subscriptions[id].text;
            delete this._subscriptions[id].last_update;
            delete this._subscriptions[id].expiresAfterHours;
            delete this._subscriptions[id].last_update_failed_at;
            delete this._subscriptions[id].last_modified;
        }
        this._onSubscriptionChange((typeof subData.subscribed !== 'undefined') && (subData.subscribed === false));
        return;
    }

    // Working with an unknown list: create the list entry
    if (!this._subscriptions[id]) {

        id = this.customToDefaultId(id);
        if (/^url\:.*/.test(id)) {
            listDidntExistBefore = true;
            this._subscriptions[id] = {
                user_submitted: true,
                initialUrl: id.substr(4),
                url: id.substr(4),
                title: subData.title
            };
        }
        subscribeRequiredListToo = true;
    }

    // Subscribing to a well known list should also subscribe to a required list
    if (!this._subscriptions[id].subscribed && subData.subscribed)
        subscribeRequiredListToo = true;

    // Apply all changes from subData
    for (var property in subData)
        if (subData[property] !== undefined)
            this._subscriptions[id][property] = subData[property];

    // Check if the required list is a well known list, but only if it is changed
    if (subData.requiresList)
        this._subscriptions[id].requiresList =
            this.customToDefaultId(this._subscriptions[id].requiresList);

    if (forceFetch)
        delete this._subscriptions[id].last_modified;

    if (this._subscriptions[id].subscribed) {

        if (!this._subscriptions[id].text || out_of_date(this._subscriptions[id]))
            this.fetch_and_update(id, listDidntExistBefore);

    } else {
        // If unsubscribed, remove some properties
        delete this._subscriptions[id].text;
        delete this._subscriptions[id].last_update;
        delete this._subscriptions[id].expiresAfterHours;
        delete this._subscriptions[id].last_update_failed_at;
        delete this._subscriptions[id].last_modified;
        if (this._subscriptions[id].deleteMe)
            delete this._subscriptions[id];
    }

    // Notify of change.  If we subscribed, we rebuilt above; so we
    // only force a rebuild if we unsubscribed.
    //
    this._onSubscriptionChange((typeof subData.subscribed !== 'undefined') && (subData.subscribed === false));

    // Subscribe to a required list if nessecary
    if (subscribeRequiredListToo && this._subscriptions[id] && this._subscriptions[id].requiresList)
        this.changeSubscription(this._subscriptions[id].requiresList, {subscribed: true});
};

// Fetch a filter list and parse it
// id:        the id of the list
// isNewList: true when the list is completely new and must succeed or
//            otherwise it'll be deleted.
MyFilters.prototype.fetch_and_update = function (id, isNewList) {
    var url = this._subscriptions[id].url;
    var that = this;

    function onError() {
        if (that._subscriptions[id]) {
            that._subscriptions[id].last_update_failed_at = Date.now();
            that._onSubscriptionChange();
        }
    }

    const { XMLHttpRequest } = require("sdk/net/xhr");
    var xhr = new XMLHttpRequest();
    xhr.open("GET", url, true);
    xhr.overrideMimeType("text/plain");
    xhr.channel.loadFlags = xhr.channel.loadFlags | xhr.channel.INHIBIT_CACHING | xhr.channel.VALIDATE_ALWAYS;
    xhr.onload = function () {
        if (!that._subscriptions[id] || !that._subscriptions[id].subscribed)
            return;

        // Sometimes text is "". Happens sometimes.  Weird, I know.
        // Every legit list starts with a comment.
        if (xhr.status == 304) {
            functions.logging.log("List not modified " + url);
            that._updateSubscriptionText(id, that._subscriptions[id].text);
            that._onSubscriptionChange(true);
        } else if (xhr.response && xhr.response.length != 0 && Filter.isComment(xhr.response.trim())) {
            that._updateSubscriptionText(id, xhr.response, xhr);
            that._onSubscriptionChange(true);
            functions.logging.log("Fetched " + url);
        } else {
            functions.logging.log("Filter List fetched, but invalid list " + url);
            onError();
        }
    };
    xhr.onerror = function (err) {
        functions.logging.log("Error condition, url", url, "status", xhr.status, "statusText", xhr.statusText, "error", JSON.stringify(err));
        onError();
    };
    functions.logging.log("Fetching " + url);
    xhr.send();
};

// Record that subscription_id is subscribed, was updated now, and has
// the given text.  Requires that this._subscriptions[subscription_id] exists.
// The xhr variable can be used to search the response headers
MyFilters.prototype._updateSubscriptionText = function (id, text, xhr) {
    this._subscriptions[id].last_update = Date.now();
    delete this._subscriptions[id].last_update_failed_at;

    // In case the resource wasn't modified, there is no need to reparse this.
    // xhr isn't send in this case. Do reparse .text, in case we had some update
    // which modified the checks in filternormalizer.js.
    if (xhr) {
        // Store the last time a resource was modified on the server, so we won't re-
        // fetch if it wasn't modified. It is null if the server doesn't support this.
        this._subscriptions[id].last_modified = xhr.getResponseHeader("Last-Modified");
        // Record how many hours until we need to update the subscription text. This
        // can be specified in the file. Defaults to 120.
        this._subscriptions[id].expiresAfterHours = 120;
        var checkLines = text.split('\n', 15); //15 lines should be enough
        var expiresRegex = /(?:expires\:|expires\ after\ )\ *(\d+)\ ?(h?)/i;
        var redirectRegex = /(?:redirect\:|redirects\ to\ )\ *(https?\:\/\/\S+)/i;
        for (var i = 0; i < checkLines.length; i++) {
            if (!Filter.isComment(checkLines[i]))
                continue;
            var match = checkLines[i].match(redirectRegex);
            if (match && match[1] !== this._subscriptions[id].url) {
                this._subscriptions[id].url = match[1]; //assuming the URL is always correct
                // Force an update.  Even if our refetch below fails we'll have to
                // fetch the new URL in the future until it succeeds.
                this._subscriptions[id].last_update = 0;
            }
            match = checkLines[i].match(expiresRegex);
            if (match && parseInt(match[1], 10)) {
                var hours = parseInt(match[1], 10) * (match[2] == "h" ? 1 : 24);
                this._subscriptions[id].expiresAfterHours = Math.min(hours, 21 * 24); // 3 week maximum
            }
        }
        // Smear expiry (Issue 7443)
        this._subscriptions[id].expiresAfterHoursHard = this._subscriptions[id].expiresAfterHours * 2;
        var smear = Math.random() * 0.4 + 0.8;
        this._subscriptions[id].expiresAfterHours *= smear;
    }

    this._subscriptions[id].text = FilterNormalizer.normalizeList(text);

    // The url changed. Simply refetch...
    if (this._subscriptions[id].last_update === 0)
        this.changeSubscription(id, {}, true);
};

// Checks if subscriptions have to be updated
// Inputs: force? (boolean), true if every filter has to be updated
MyFilters.prototype.checkFilterUpdates = function (force) {
    var key = 'last_subscriptions_check';
    var now = Date.now();
    var delta = now - (functions.storage_get(key) || now);
    var delta_hours = delta / HOUR_IN_MS;
    functions.storage_set(key, now);
    if (delta_hours > 24) {
        // Extend expiration of subscribed lists (Issue 7443)
        for (var id in this._subscriptions) {
            if (this._subscriptions[id].subscribed) {
                this._subscriptions[id].expiresAfterHours += delta_hours;
            }
        }
        this._onSubscriptionChange(); // Store the change
    }

    for (var id in this._subscriptions) {
        if (this._subscriptions[id].subscribed) {
            this.changeSubscription(id, {}, force);
        }
    }
};
//Retreive the list of malware domains from our site.
//and set the response (list of domains) on the blocking
//filter set for processing.
MyFilters.prototype._loadMalwareDomains = function () {
    function out_of_date(subscription) {
        // After a failure, wait at least a day to refetch (overridden below if
        // it has no .text)
        var failed_at = subscription.last_update_failed_at || 0;
        if (Date.now() - failed_at < HOUR_IN_MS * 24)
            return false;
        var hardStop = subscription.expiresAfterHoursHard || 240;
        var smallerExpiry = Math.min((subscription.expiresAfterHours || 24), hardStop);
        var millis = Date.now() - (subscription.last_update || 0);
        return (millis > HOUR_IN_MS * smallerExpiry);
    }

    if (!this._subscriptions.malware.text || !this.getMalwareDomains() ||
        out_of_date(this._subscriptions.malware)) {
        //the timestamp is add to the URL to prevent caching by the browser
        var url = this._subscriptions.malware.url + "?timestamp=" + new Date().getTime();
        // Fetch file with malware-known domains
        const { XMLHttpRequest } = require("sdk/net/xhr");
        var xhr = new XMLHttpRequest();
        var that = this;
        xhr.open("GET", url, true);
        xhr.onload = function () {
            that.blocking.setMalwareDomains(JSON.parse(xhr.responseText));
            //set the response text on the 'text' property so it's persisted to storage
            that._subscriptions.malware.text = that.blocking.getMalwareDomains();
            that._subscriptions.malware.last_update = Date.now();
            that._subscriptions.malware.last_modified = Date.now();
            delete that._subscriptions.malware.last_update_failed_at;
            //since the AdBlock Malware Domains.json file is only updated once a day
            //on the server, expiration is around 24 hours.
            that._subscriptions.malware.expiresAfterHours = 24;
            var smear = Math.random() * 0.4 + 0.8;
            that._subscriptions.malware.expiresAfterHours *= smear;
            port.chrome.extension.sendRequest({command: "filters_updated"});
            functions.logging.log("Fetched " + url);
        };
        xhr.onerror = function (err) {
            that._subscriptions.malware.last_update_failed_at = Date.now();
            functions.logging.log("Error condition", xhr.status, "url", url, err);
        };
        xhr.send();
    }
};
//Retreive the list of malware domains from our site.
//and set the response (list of domains) on the blocking
//filter set for processing.
MyFilters.prototype._initializeMalwareDomains = function () {

    if (this._subscriptions.malware.text) {
        this.blocking.setMalwareDomains(this._subscriptions.malware.text);
    } else {
        this._loadMalwareDomains();
    }
};
//Get the current list of malware domains
//will return undefined, if the user is not subscribed to the Malware 'filter list'.
MyFilters.prototype.getMalwareDomains = function () {
    return this.blocking.getMalwareDomains();
};
// Checks if a custom id is of a known list
// Inputs: id: the list id to compare
// Returns the id that should be used
MyFilters.prototype.customToDefaultId = function (id) {
    var urlOfCustomList = id.substr(4);
    for (var defaultList in this._official_options)
        if (this._official_options[defaultList].url == urlOfCustomList)
            return defaultList;
    return id;
};

// If the user wasn't subscribed to any lists, subscribe to
// EasyList, AdBlock custom and (if any) a localized subscription
// Inputs: none.
// Returns an object containing the subscribed lists
MyFilters.prototype._load_default_subscriptions = function () {
    var result = {};
    // Returns the ID of the list appropriate for the user's locale, or ''
    function listIdForThisLocale() {
        var language = functions.determineUserLanguage();
        switch (language) {
            case 'bg':
                return 'easylist_plus_bulgarian';
            case 'cs':
                return 'czech';
            case 'cu':
                return 'easylist_plus_bulgarian';
            case 'da':
                return 'danish';
            case 'de':
                return 'easylist_plus_german';
            case 'el':
                return 'easylist_plus_greek';
            case 'fi':
                return 'easylist_plus_finnish';
            case 'fr':
                return 'easylist_plus_french';
            case 'he':
                return 'israeli';
            case 'hu':
                return 'hungarian';
            case 'it':
                return 'italian';
            case 'id':
                return 'easylist_plus_indonesian';
            case 'ja':
                return 'japanese';
            case 'ko':
                return 'easylist_plun_korean';
            case 'lv':
                return 'latvian';
            case 'nl':
                return 'dutch';
            case 'pl':
                return 'easylist_plus_polish';
            case 'ro':
                return 'easylist_plus_romanian';
            case 'ru':
                return 'russian';
            case 'sk':
                return 'czech';
            case 'sv':
                return 'swedish';
            case 'tr':
                return 'turkish';
            case 'uk':
                return 'russian';
            case 'zh':
                return 'chinese';
            default:
                return '';
        }
    }

    //Update will be done immediately after this function returns
    result["adblock_custom"] = {subscribed: true};
    result["easylist"] = {subscribed: true};

    var list_for_lang = listIdForThisLocale();
    if (list_for_lang)
        result[list_for_lang] = {subscribed: true};
    return result;
};

// Used to create the list of default subscriptions
// Called when MyFilters is created.
// Returns: that list
MyFilters.prototype._make_subscription_options = function () {
    // When modifying a list, IDs mustn't change!
    return {
        "adblock_custom": { // AdBlock custom filters
            url: "https://data.getadblock.com/filters/adblock_custom.txt",
        },
        "easylist": { // EasyList
            url: "https://easylist-downloads.adblockplus.org/easylist.txt"
        },
        "easylist_plus_bulgarian": { // Additional Bulgarian filters
            url: "http://stanev.org/abp/adblock_bg.txt",
            requiresList: "easylist",
        },
        "dutch": { // Additional Dutch filters
            url: "https://easylist-downloads.adblockplus.org/easylistdutch.txt",
            requiresList: "easylist",
        },
        "easylist_plus_finnish": { // Additional Finnish filters
            url: "https://raw.githubusercontent.com/wiltteri/wiltteri.txt/master/wiltteri.txt",
            requiresList: "easylist",
        },
        "easylist_plus_french": { // Additional French filters
            url: "https://easylist-downloads.adblockplus.org/liste_fr.txt",
            requiresList: "easylist",
        },
        "easylist_plus_german": { // Additional German filters
            url: "https://easylist-downloads.adblockplus.org/easylistgermany.txt",
            requiresList: "easylist",
        },
        "easylist_plus_greek": { // Additional Greek filters
            url: "https://www.void.gr/kargig/void-gr-filters.txt",
            requiresList: "easylist",
        },
        "easylist_plus_indonesian": { // Additional Indonesian filters
            url: "https://indonesianadblockrules.googlecode.com/hg/subscriptions/abpindo.txt",
            requiresList: "easylist",
        },
        "easylist_plus_polish": { // Additional Polish filters
            url: "https://raw.githubusercontent.com/adblockpolska/Adblock_PL_List/master/adblock_polska.txt",
            requiresList: "easylist",
        },
        "easylist_plus_romanian": { // Additional Romanian filters
            url: "http://www.zoso.ro/pages/rolist.txt",
            requiresList: "easylist",
        },
        "russian": { // Additional Russian filters
            url: "https://easylist-downloads.adblockplus.org/advblock.txt",
            requiresList: "easylist",
        },
        "chinese": { // Additional Chinese filters
            url: "https://easylist-downloads.adblockplus.org/easylistchina.txt",
            requiresList: "easylist",
        },
        "czech": { // Additional Czech and Slovak filters
            url: "https://raw.github.com/tomasko126/easylistczechandslovak/master/filters.txt",
            requiresList: "easylist",
        },
        "danish": { // Danish filters
            url: "http://adblock.schack.dk/block.txt",
        },
        "hungarian": { // Hungarian filters
            url: "http://pete.teamlupus.hu/hufilter.txt",
        },
        "israeli": { // Israeli filters
            url: "https://easylist-downloads.adblockplus.org/israellist+easylist.txt",
        },
        "italian": { // Italian filters
            url: "http://mozilla.gfsolone.com/filtri.txt",
        },
        "japanese": { // Japanese filters
            url: "https://raw.githubusercontent.com/k2jp/abp-japanese-filters/master/abpjf.txt",
        },
        "easylist_plun_korean": {  // Korean filters
            url: "https://secure.fanboy.co.nz/fanboy-korean.txt",
        },
        "latvian": {  // Latvian filters
            url: "https://gitorious.org/adblock-latvian/adblock-latvian/blobs/raw/master/lists/latvian-list.txt",
        },
        "swedish": {  // Swedish filters
            url: "http://fanboy.co.nz/fanboy-swedish.txt",
        },
        "turkish": {  // Turkish filters
            url: "http://fanboy.co.nz/fanboy-turkish.txt",
        },
        "easyprivacy": { // EasyPrivacy
            url: "https://easylist-downloads.adblockplus.org/easyprivacy.txt",
        },
        "antisocial": { // Antisocial
            url: "https://easylist-downloads.adblockplus.org/fanboy-social.txt",
        },
        "malware": { // Malware protection
            url: "https://data.getadblock.com/filters/domains.json",
        },
        "annoyances": { // Fanboy's Annoyances
            url: "https://easylist-downloads.adblockplus.org/fanboy-annoyance.txt",
        },
        "warning_removal": { // AdBlock warning removal
            url: "https://easylist-downloads.adblockplus.org/antiadblockfilters.txt",
        },
    };
};

/* subscription properties:
 url (string): url of subscription
 initialUrl (string): the hardcoded url. Same as .url except when redirected
 user_submitted (bool): submitted by the user or not
 requiresList (string): id of a list required for this list
 subscribed (bool): if you are subscribed to the list or not
 last_update (date): time of the last succesfull update
 last_modified (string): time of the last change on the server
 last_update_failed_at (date): if set, when the last update attempt failed
 text (string): the filters of the subscription
 expiresAfterHours (int): the time after which the subscription expires
 expiresAfterHoursHard (int): we must redownload subscription after this delay
 deleteMe (bool): if the subscription has to be deleted
 */
exports.MyFilters = MyFilters;
// DomainSet: a subset of all domains.
//
// It can represent any subset of all domains.  Some examples:
//  - all domains
//  - all domains except foo
//  - only sub.foo
//  - only a, b, and c, excluding sub.a or sub.b (but including sub.sub.b)

// Create a new DomainSet from the given |data|.
//
// Each key in |data| is a subdomain, domain, or the required pseudodomain
// "DomainSet.ALL" which represents all domains.
// Each value is true/false, meaning "This domain is/is not in the set, and
// all of its subdomains not otherwise mentioned are/are not in the set."
function DomainSet(data) {
    if (data[DomainSet.ALL] === undefined)
        throw Error("DomainSet: data[DomainSet.ALL] is undefined.");
    this.has = data; // The internal representation of our set of domains.
}

// The pseudodomain representing all domains.
DomainSet.ALL = '';

// Return the parent domain of |domain|, or DomainSet.ALL.
DomainSet._parentDomainOf = function (domain) {
    return domain.replace(/^.+?(?:\.|$)/, '');
};

// Return an object whose keys are |domain| and all of its parent domains, up
// to and including the TLD.
DomainSet.domainAndParents = function (domain) {
    var result = {};
    var parts = domain.split('.');
    var nextDomain = parts[parts.length - 1];
    for (var i = parts.length - 1; i >= 0; i--) {
        result[nextDomain] = 1;
        if (i > 0)
            nextDomain = parts[i - 1] + '.' + nextDomain;
    }
    return result;
};

DomainSet.prototype = {

    // Returns a new identical DomainSet.
    clone: function () {
        return new DomainSet(JSON.parse(JSON.stringify(this.has)));
    },

    // Returns true if this set contains all domains.
    full: function () {
        for (var k in this.has) {
            if (!this.has[k])
                return false;
        }
        return true;
    },

    // Modify |this| by set-subtracting |other|.
    // |this| will contain the subset that was in |this| but not in |other|.
    subtract: function (other) {
        var subtract_operator = function (a, b) {
            return a && !b
        };
        this._apply(subtract_operator, other);
    },

    // NB: If we needed them, intersect and union are just like subtract, but use
    // a&&b and a||b respectively.  Union could be used to add two DomainSets.

    // Modify |this| to be the result of applying the given set |operator| (a
    // 2-param boolean function) to |this| and |other|. Returns undefined.
    _apply: function (operator, other) {
        var d; // represents a domain -- an element in .has

        // Make sure there's an entry in .has for every entry in other.has, so
        // that we examine every pairing in the next for loop.
        for (d in other.has)
            this.has[d] = this._computedHas(d);
        // Apply the set operation to each pair of entries.  Use
        // other._computedHas() to derive any missing other.has entries.
        for (d in this.has)
            this.has[d] = operator(this.has[d], other._computedHas(d));
        // Optimization: get rid of redundant entries that now exist in this.has.
        // E.g. if DomainSet.ALL, a, and sub.a all = true, delete the last 2.
        var newHas = {};
        newHas[DomainSet.ALL] = this.has[DomainSet.ALL];
        for (d in this.has)
            if (this.has[d] !== this._computedHas(DomainSet._parentDomainOf(d)))
                newHas[d] = this.has[d];
        this.has = newHas;
    },

    // True if |domain| is in the subset of all domains represented by |this|.
    //
    // E.g. if |this| DomainSet is the set of all domains other than a, then 'b'
    // will yield true, and both 'a' and 'sub.a' will yield false.
    _computedHas: function (domain) {
        if (this.has[domain] !== undefined)
            return this.has[domain];
        else
            return this._computedHas(DomainSet._parentDomainOf(domain));
    },

};
exports.DomainSet = DomainSet;

var FilterNormalizer = {

    userExcludedFilterArray: [],

    setExcludeFilters: function (text) {
        if (text) {
            this.userExcludedFilterArray = text.split('\n');
        } else {
            this.userExcludedFilterArray = null;
        }
    },

    // Normalize a set of filters.
    // Remove broken filters, useless comments and unsupported things.
    // Input: text:string filter strings separated by '\n'
    //        keepComments:boolean if true, comments will not be removed
    // Returns: filter strings separated by '\n' with invalid filters
    //          removed or modified
    normalizeList: function (text, keepComments) {
        var lines = text.toString().split('\n');
        var result = [];
        var ignoredFilterCount = 0;
        for (var i = 0; i < lines.length; i++) {
            try {
                var newfilter = FilterNormalizer.normalizeLine(lines[i]);
                if (newfilter)
                    result.push(newfilter);
                else if (newfilter !== false)
                    ignoredFilterCount++;
                else if (keepComments)
                    result.push(lines[i]);
            } catch (ex) {
                functions.logging.log("Filter '" + lines[i] + "' could not be parsed: " + ex);
                ignoredFilterCount++;
            }
        }
        if (ignoredFilterCount)
            functions.logging.log('Ignoring ' + ignoredFilterCount + ' rule(s)');
        return result.join('\n') + '\n';
    },

    // Normalize a single filter.
    // Input: filter:string a single filter
    // Return: normalized filter string if the filter is valid, null if the filter
    //         will be ignored or false if it isn't supposed to be a filter.
    // Throws: exception if filter could not be parsed.
    //
    // Note that 'Expires' comments are considered valid comments that
    // need retention, because they carry information.
    normalizeLine: function (filter) {
        // Some rules are separated by \r\n; and hey, some rules may
        // have leading or trailing whitespace for some reason.
        filter = filter.replace(/\r$/, '').trim();

        // Remove comment/empty filters.
        if (Filter.isComment(filter))
            return false;

        // Convert old-style hiding rules to new-style.
        if (/#[\*a-z0-9_\-]*(\(|$)/.test(filter) && !/\#\@?\#./.test(filter)) {
            // Throws exception if unparseable.
            var oldFilter = filter;
            filter = FilterNormalizer._old_style_hiding_to_new(filter);
            functions.logging.log('Converted ' + oldFilter + ' to ' + filter);
        }

        //check to see if the filter should be excluded,
        //if so, return null
        if (typeof this.userExcludedFilterArray !== 'undefined' &&
            this.userExcludedFilterArray &&
            this.userExcludedFilterArray.length > 0 &&
            this.userExcludedFilterArray.indexOf(filter) >= 0) {
            return null;
        }
        // If it is a hiding rule...
        if (Filter.isSelectorFilter(filter)) {
            // The filter must be of a correct syntax

            try {
                // Throws if the filter is invalid...
                var selectorPart = filter.replace(/^.*?\#\@?\#/, '');
                if ((typeof document !== 'undefined') && (document.querySelector(selectorPart + ',html').length === 0))
                    throw "Causes other filters to fail";
            } catch (ex) {
                // ...however, the thing it throws is not human-readable. This is.
                throw "Invalid CSS selector syntax";
            }

            var parsedFilter = SelectorFilter.fromText(filter);

        } else { // If it is a blocking rule...

            var parsedFilter = PatternFilter.fromText(filter); // throws if invalid

            var types = parsedFilter._allowedElementTypes;

            var whitelistOptions = (ElementTypes.document | ElementTypes.elemhide);
            var hasWhitelistOptions = types & whitelistOptions;

            if (!Filter.isWhitelistFilter(filter) && hasWhitelistOptions)
                throw "$document and $elemhide may only be used on whitelist filters";

            // We are ignoring Hulu whitelist filter, so user won't see ads in videos
            // but just a message about using AdBlock - Issue 7178
            // We are also ignoring Google whitelist filter to prevent whitelisting some ads
            // e.g. on YouTube by Danish filter list - Issue #264
            // Issue 7178
            if (/^\@\@\|\|hulu\.com\/published\/\*\.(flv|mp4)$/.test(filter) ||
                /^\@\@\googleads.g.doubleclick.net/.test(filter)) {
                return null; // background.js implements this rule more specifically
            }

        }

        // Ignore filters whose domains aren't formatted properly.
        FilterNormalizer.verifyDomains(parsedFilter._domains);

        // Ensure filter doesn't break AdBlock
        FilterNormalizer._checkForObjectProperty(filter);

        // Nothing's wrong with the filter.
        return filter;
    },
    //
    //used by option pages, content scripts, etc
    //since exceptions will not be thrown from the addon to them.
    validateLine: function (filter) {
        try {
            return FilterNormalizer.normalizeLine(filter)
        } catch (ex) {
            return false;
        }
    },

    // Return |selectorFilterText| modified if necessary so that it applies to no
    // domain in the |excludedDomains| list.
    // Throws if |selectorFilterText| is not a valid filter.
    // Example: ("a.com##div", ["sub.a.com", "b.com"]) -> "a.com,~sub.a.com##div"
    _ensureExcluded: function (selectorFilterText, excludedDomains) {
        var text = selectorFilterText;
        var filter = SelectorFilter.fromText(text);
        var mustExclude = excludedDomains.filter(function (domain) {
            return filter._domains._computedHas(domain);
        });
        if (mustExclude.length > 0) {
            var toPrepend = "~" + mustExclude.join(",~");
            if (text[0] != "#") toPrepend += ",";
            text = toPrepend + text;
        }
        return text;
    },

    // Convert an old-style hiding rule to a new one.
    // Input: filter:string old-style filter
    // Returns: string new-style filter
    // Throws: exception if filter is unparseable.
    _old_style_hiding_to_new: function (filter) {
        // Old-style is domain#node(attr=value) or domain#node(attr)
        // domain and node are optional, and there can be many () parts.
        filter = filter.replace('#', '##');
        var parts = filter.split('##'); // -> [domain, rule]
        var domain = parts[0];
        var rule = parts[1];

        // Make sure the rule has only the following two things:
        // 1. a node -- this is optional and must be '*' or alphanumeric
        // 2. a series of ()-delimited arbitrary strings -- also optional
        //    the ()s can't be empty, and can't start with '='
        if (rule.length == 0 || !/^(?:\*|[a-z0-9\-_]*)(?:\([^=][^\)]*?\))*$/i.test(rule))
            throw "bad selector filter";

        var first_segment = rule.indexOf('(');

        if (first_segment == -1)
            return domain + '##' + rule;

        var node = rule.substring(0, first_segment);
        var segments = rule.substring(first_segment);

        // turn all (foo) groups into [foo]
        segments = segments.replace(/\((.*?)\)/g, "[$1]");
        // turn all [foo=bar baz] groups into [foo="bar baz"]
        // Specifically match:    = then not " then anything till ]
        segments = segments.replace(/\=([^"][^\]]*)/g, '="$1"');
        // turn all [foo] into .foo, #foo
        // #div(adblock) means all divs with class or id adblock
        // class must be a single class, not multiple (not #*(ad listitem))
        // I haven't ever seen filters like #div(foo)(anotherfoo), so ignore these
        var resultFilter = node + segments;
        var match = resultFilter.match(/\[([^\=]*?)\]/);
        if (match)
            resultFilter = resultFilter.replace(match[0], "#" + match[1]) +
            "," + resultFilter.replace(match[0], "." + match[1]);

        return domain + "##" + resultFilter;
    },

    // Checks if the filter is an object property, which we should not overwrite.
    // See Issue 7117.
    // Throw an exeption if that's the case
    // Input: text (string): the item to check
    _checkForObjectProperty: function (text) {
        if (text in Object)
            throw "Filter causes problems in the code";
    },

    // Throw an exception if the DomainSet |domainSet| contains invalid domains.
    verifyDomains: function (domainSet) {
        if (typeof domainSet === 'undefined')
            return;
        for (var domain in domainSet.has) {
            if (domain === DomainSet.ALL)
                continue;
            if (/^([a-z0-9\-_\u00DF-\u00F6\u00F8-\uFFFFFF]+\.)*[a-z0-9\u00DF-\u00F6\u00F8-\uFFFFFF]+\.?$/i.test(domain) == false)
                throw Error("Invalid domain: " + domain);
            // Ensure domain doesn't break AdBlock
            FilterNormalizer._checkForObjectProperty(domain);
        }
    }
};
//Initialize the exclude filters at startup
FilterNormalizer.setExcludeFilters(functions.storage_get('exclude_filters'));

exports.FilterNormalizer = FilterNormalizer;
// The options that can be specified on filters.  The first several options
// specify the type of a URL request.

var ElementTypes = {
    NONE: 0,
    script: 1,
    image: 2,
    background: 4,
    stylesheet: 8,
    'object': 16,
    subdocument: 32,
    object_subrequest: 64,
    media: 128,
    other: 256,
    xmlhttprequest: 512,
    'document': 1024,
    elemhide: 2048,
    popup: 4096,
    // If you add something here, update .DEFAULTTYPES below.
};
// The types that are implied by a filter that doesn't explicitly specify types
ElementTypes.DEFAULTTYPES = 1023;

ElementTypes.FireFoxElementTypes = {
    TYPE_OTHER: 1,
    TYPE_SCRIPT: 2,
    TYPE_IMAGE: 3,
    TYPE_CSSIMAGE: 31,  // Custom type
    TYPE_FAVICON: 32,  // Custom type
    TYPE_STYLESHEET: 4,
    TYPE_OBJECT: 5,
    TYPE_DOCUMENT: 6,
    TYPE_SUBDOCUMENT: 7,
    TYPE_REDIRECT: 71,  // Custom type
    TYPE_REFRESH: 8,  // Unused
    TYPE_XBL: 9,  // Unused
    TYPE_PING: 10,  // Unused
    TYPE_XMLHTTPREQUEST: 11,
    TYPE_OBJECT_SUBREQUEST: 12,
};

ElementTypes.convertFireFoxContentType = function (contentType, node) {
    switch (contentType) {
        case ElementTypes.FireFoxElementTypes.TYPE_OTHER:
            return ElementTypes.other;
        case ElementTypes.FireFoxElementTypes.TYPE_SCRIPT:
            return ElementTypes.script;
        case ElementTypes.FireFoxElementTypes.TYPE_IMAGE:
            return ElementTypes.image;
        case ElementTypes.FireFoxElementTypes.TYPE_CSSIMAGE:
            return ElementTypes.image;
        case ElementTypes.FireFoxElementTypes.TYPE_FAVICON:
            return ElementTypes.image;
        case ElementTypes.FireFoxElementTypes.TYPE_STYLESHEET:
            return ElementTypes.stylesheet;
        case ElementTypes.FireFoxElementTypes.TYPE_OBJECT:
            return ElementTypes.object;
        case ElementTypes.FireFoxElementTypes.TYPE_DOCUMENT:
            return ElementTypes.document;
        case ElementTypes.FireFoxElementTypes.TYPE_SUBDOCUMENT:
            return ElementTypes.subdocument;
        case ElementTypes.FireFoxElementTypes.TYPE_REDIRECT:
            return ElementTypes.NONE;
        case ElementTypes.FireFoxElementTypes.TYPE_REFRESH:
            return ElementTypes.NONE;
        case ElementTypes.FireFoxElementTypes.TYPE_XBL:
            return ElementTypes.NONE;
        case ElementTypes.FireFoxElementTypes.TYPE_PING:
            return ElementTypes.NONE;
        case ElementTypes.FireFoxElementTypes.TYPE_XMLHTTPREQUEST:
            return ElementTypes.xmlhttprequest;
        case ElementTypes.FireFoxElementTypes.TYPE_OBJECT_SUBREQUEST:
            return ElementTypes.object_subrequest;
        default:
            return ElementTypes.NONE;
    }
};

var FilterOptions = {
    NONE: 0,
    THIRDPARTY: 1,
    MATCHCASE: 2,
    FIRSTPARTY: 4
};
exports.ElementTypes = ElementTypes;
exports.FilterOptions = FilterOptions;

function FilterSet() {
    // Map from domain (e.g. 'mail.google.com', 'google.com', or special-case
    // 'global') to list of filters that specify inclusion on that domain.
    // E.g. /f/$domain=sub.foo.com,bar.com will appear in items['sub.foo.com']
    // and items['bar.com'].
    this.items = {'global': []};
    // Map from domain to set of filter ids that specify exclusion on that domain.
    // Each filter will also appear in this.items at least once.
    // Examples:
    //   /f/$domain=~foo.com,~bar.com would appear in
    //     items['global'], exclude['foo.com'], exclude['bar.com']
    //   /f/$domain=foo.com,~sub.foo.com would appear in
    //     items['foo.com'], exclude['sub.foo.com']
    this.exclude = {};
}

// Construct a FilterSet from the Filters that are the values in the |data|
// object.  All filters should be the same type (whitelisting PatternFilters,
// blocking PatternFilters, or SelectorFilters.)
FilterSet.fromFilters = function (data) {
    var result = new FilterSet();

    for (var _ in data) {
        var filter = data[_];

        for (var d in filter._domains.has) {
            if (filter._domains.has[d]) {
                var key = (d === DomainSet.ALL ? 'global' : d);
                functions.setDefault(result.items, key, []).push(filter);
            }
            else if (d !== DomainSet.ALL)
                functions.setDefault(result.exclude, d, {})[filter.id] = true;
        }
    }

    return result;
};

FilterSet.prototype = {
    // Return a new FilterSet containing the subset of this FilterSet's entries
    // which relate to the given domain or any of its superdomains.  E.g.
    // sub.foo.com will get items['global', 'foo.com', 'sub.foo.com'] and
    // exclude['foo.com', 'sub.foo.com'].
    _viewFor: function (domain) {
        var result = new FilterSet();
        result.items['global'] = this.items['global'];
        for (var nextDomain in DomainSet.domainAndParents(domain)) {
            if (this.items[nextDomain])
                result.items[nextDomain] = this.items[nextDomain];
            if (this.exclude[nextDomain])
                result.exclude[nextDomain] = this.exclude[nextDomain];
        }
        return result;
    },

    // Get a list of all Filter objects that should be tested on the given
    // domain, and return it with the given map function applied. This function
    // is for hiding rules only
    filtersFor: function (domain) {
        var limited = this._viewFor(domain);

        var data = {};
        // data = set(limited.items)
        for (var subdomain in limited.items) {
            var entry = limited.items[subdomain];
            for (var i = 0; i < entry.length; i++) {
                var filter = entry[i];
                data[filter.id] = filter;
            }
        }

        // data -= limited.exclude
        for (var subdomain in limited.exclude) {
            for (var filterId in limited.exclude[subdomain]) {
                delete data[filterId];
            }
        }
        var result = [];
        for (var k in data)
            result.push(data[k].selector);

        return result;
    },

    // Return the filter that matches this url+elementType on this frameDomain:
    // the filter in a relevant entry in this.items who is not also in a
    // relevant entry in this.exclude.
    // isThirdParty: true if url and frameDomain have different origins.
    matches: function (url, elementType, frameDomain, isThirdParty) {
        var limited = this._viewFor(frameDomain);
        for (var k in limited.items) {
            var entry = limited.items[k];
            for (var i = 0; i < entry.length; i++) {
                var filter = entry[i];
                // calls matches in filtertypes.js
                if (typeof filter.matches !== 'function') {
                    console.log("filter matches not a function", filter);
                }
                if (!filter.matches(url, elementType, isThirdParty))
                    continue; // no match
                // Maybe filter shouldn't match because it is excluded on our domain?
                var excluded = false;
                for (var k2 in limited.exclude) {
                    if (limited.exclude[k2][filter.id]) {
                        excluded = true;
                        break;
                    }
                }
                if (!excluded)
                    return filter;
            }
        }

        return null;
    }
};


var BlockingFilterSet = function (patternFilterSet, whitelistFilterSet) {
    this.pattern = patternFilterSet;
    this.whitelist = whitelistFilterSet;

    // Caches results for this.matches()
    this._matchCache = {};
};

// Checks if the two domains have the same origin
// Inputs: the two domains
// Returns: true if third-party, false otherwise
BlockingFilterSet.checkThirdParty = function (domain1, domain2) {
    var match1 = functions.parseUri.secondLevelDomainOnly(domain1, false);
    var match2 = functions.parseUri.secondLevelDomainOnly(domain2, false);
    return (match1 !== match2);
};

BlockingFilterSet.prototype = {
    // True if the url is blocked by this filterset.
    // Inputs:
    //   url:string - The URL of the resource to possibly block
    //   elementType:ElementType - the type of element that is requesting the
    //                             resource
    //   frameDomain:string - domain of the frame on which the element resides
    //   returnFilter?:bool - see Returns
    // Returns:
    //   if returnFilter is true:
    //       text of matching pattern/whitelist filter, null if no match
    //   if returnFilter is false:
    //       true if the resource should be blocked, false otherwise
    matches: function (url, elementType, frameDomain, returnFilter) {
        var urlDomain = functions.parseUri(url).hostname;
        var isThirdParty = BlockingFilterSet.checkThirdParty(urlDomain, frameDomain);

        // matchCache approach taken from ABP
        var key = url + " " + elementType + " " + isThirdParty;
        if (key in this._matchCache)
            return this._matchCache[key];

        var match = this.whitelist.matches(url, elementType, frameDomain, isThirdParty);
        if (match) {
            functions.logging.log(frameDomain, ": whitelist rule", match._rule, "exempts url", url);
            this._matchCache[key] = (returnFilter ? match._text : false);
            return this._matchCache[key];
        }
        match = this.pattern.matches(url, elementType, frameDomain, isThirdParty);
        if (match) {
            functions.logging.log(frameDomain, ": matched", match._rule, "to url", url);
            this._matchCache[key] = (returnFilter ? match._text : true);
            return this._matchCache[key];
        }
        if (this.malwareDomains &&
            this.malwareDomains.adware &&
            this.malwareDomains.adware.indexOf(urlDomain) > -1) {
            functions.logging.log("matched malware domain", urlDomain);
            background.createMalwareNotification();
            this._matchCache[key] = (returnFilter ? urlDomain : true);
            return this._matchCache[key];
        }
        this._matchCache[key] = false;
        return this._matchCache[key];
    },
    setMalwareDomains: function (malwareDoms) {
        this.malwareDomains = malwareDoms;
    },
    getMalwareDomains: function () {
        if (typeof this.malwareDomains !== 'undefined') {
            return this.malwareDomains;
        } else {
            return undefined;
        }
    },
    deleteMalwareDomains: function () {
        if (typeof this.malwareDomains !== 'undefined') {
            delete this.malwareDomains;
        }
    },
};
exports.FilterSet = FilterSet;
exports.BlockingFilterSet = BlockingFilterSet;

var Filter = function () {
    this.id = ++Filter._lastId;
};
Filter._lastId = 0;

// Maps filter text to Filter instances.  This is important, as it allows
// us to throw away and rebuild the FilterSet at will.
// Will be cleared after a fixed time interval
Filter._cache = {};


// Return a Filter instance for the given filter text.
// Throw an exception if the filter is invalid.
Filter.fromText = function (text, preserveText) {

    var cache = Filter._cache;
    if (!(text in cache)) {

        if (Filter.isSelectorFilter(text))
            cache[text] = new SelectorFilter(text, preserveText);
        else
            cache[text] = PatternFilter.fromText(text, preserveText);
    }
    return cache[text];
};

// Test if pattern#@#pattern or pattern##pattern
Filter.isSelectorFilter = function (text) {
    // This returns true for both hiding rules as hiding whitelist rules
    // This means that you'll first have to check if something is an excluded rule
    // before checking this, if the difference matters.
    return /\#\@?\#./.test(text);
};

Filter.isSelectorExcludeFilter = function (text) {
    return /\#\@\#./.test(text);
};

Filter.isWhitelistFilter = function (text) {
    return /^\@\@/.test(text);
};

Filter.isComment = function (text) {
    return text.length === 0 ||
        text[0] === '!' ||
        (/^\[adblock/i.test(text)) ||
        (/^\(adblock/i.test(text));
};

// Convert a comma-separated list of domain includes and excludes into a
// DomainSet.
Filter._toDomainSet = function (domainText, divider) {
    var domains = domainText.split(divider);

    var data = {};
    data[DomainSet.ALL] = true;

    if (domains == '') {
        return new DomainSet(data);
    }

    for (var i = 0; i < domains.length; i++) {
        var domain = domains[i];
        if (domain[0] == '~') {
            data[domain.substring(1)] = false;
        } else {
            data[domain] = true;
            data[DomainSet.ALL] = false;
        }
    }
    return new DomainSet(data);
};

// Filters that block by CSS selector.
var SelectorFilter = function (text, preserveText) {
    Filter.call(this); // call base constructor

    var parts = text.match(/(^.*?)\#\@?\#(.+$)/);
    this._domains = Filter._toDomainSet(parts[1], ',');
    this.selector = parts[2];
    // Preserve _text for resource block page
    if (typeof preserveText !== 'undefined' &&
        preserveText) {
        this._text = text;
    }
};

//Factory method for the SelectorFilter
SelectorFilter.fromText = function (text) {
    var result = new SelectorFilter(text);
    return result;
};


// If !|excludeFilters|, returns filter.
// Otherwise, returns a new SelectorFilter that is the combination of
// |filter| and each selector exclusion filter in the given list.
SelectorFilter.merge = function (filter, excludeFilters) {
    if (!excludeFilters)
        return filter;

    var domains = filter._domains.clone();
    for (var i = 0; i < excludeFilters.length; i++) {
        domains.subtract(excludeFilters[i]._domains);
    }

    var result = new SelectorFilter("_##_");
    result.selector = filter.selector;
    if (filter._text)
        result._text = filter._text;
    result._domains = domains;

    return result;
};

// Inherit from Filter.
SelectorFilter.prototype = Object.create(Filter.prototype);

// Filters that block by URL regex or substring.
var PatternFilter = function () {
    Filter.call(this); // call base constructor
};
// Data is [rule text, allowed element types, options].
PatternFilter.fromData = function (data) {
    var result = new PatternFilter();
    result._rule = new RegExp(data[0]);
    result._allowedElementTypes = data[1];
    result._options = data[2];
    var domains = {};
    domains[DomainSet.ALL] = true;
    result._domains = new DomainSet(domains);
    return result;
};
// Text is the original filter text of a blocking or whitelist filter.
// Throws an exception if the rule is invalid.
PatternFilter.fromText = function (text, preserveText) {
    var data = PatternFilter._parseRule(text);

    var result = new PatternFilter();
    result._domains = Filter._toDomainSet(data.domainText, '|');
    result._allowedElementTypes = data.allowedElementTypes;
    result._options = data.options;
    result._rule = data.rule;
    result._key = data.key;
    // Preserve _text for resourceblock.
    if (typeof preserveText !== 'undefined' &&
        preserveText) {
        result._text = text;
    }
    return result;
};

// Return a { rule, domainText, allowedElementTypes } object
// for the given filter text.  Throws an exception if the rule is invalid.
PatternFilter._parseRule = function (text) {

    var result = {
        domainText: '',
        // TODO: when working on this code again, consider making options a
        // dictionary with boolean values instead of a bitset. This would
        // - make more sense, because these options are only checked individually
        // - collapse the two bitwise checks in Filter.matches into a single
        // boolean compare
        options: FilterOptions.NONE
    };

    var optionsRegex = /\$~?[\w\-]+(?:=[^,\s]+)?(?:,~?[\w\-]+(?:=[^,\s]+)?)*$/;
    var optionsText = text.match(optionsRegex);
    var allowedElementTypes;
    if (!optionsText) {
        var rule = text;
        var options = [];
    } else {
        var options = optionsText[0].substring(1).toLowerCase().split(',');
        var rule = text.replace(optionsText[0], '');
    }

    for (var i = 0; i < options.length; i++) {
        var option = options[i];

        if (/^domain\=/.test(option)) {
            result.domainText = option.substring(7);
            continue;
        }

        var inverted = (option[0] == '~');
        if (inverted)
            option = option.substring(1);

        option = option.replace(/\-/, '_');

        // See crbug.com/93542 -- object-subrequest is reported as 'object',
        // so we treat them as synonyms.  TODO issue 5935: we must address
        // false positives/negatives due to this.
        if (option == 'object_subrequest')
            option = 'object';

        // 'background' is a synonym for 'image'.
        if (option == 'background')
            option = 'image';

        if (option in ElementTypes) { // this option is a known element type
            if (inverted) {
                if (allowedElementTypes === undefined)
                    allowedElementTypes = ElementTypes.DEFAULTTYPES;
                allowedElementTypes &= ~ElementTypes[option];
            } else {
                if (allowedElementTypes === undefined)
                    allowedElementTypes = ElementTypes.NONE;
                allowedElementTypes |= ElementTypes[option];
            }
        }
        else if (option === 'third_party') {
            result.options |=
                (inverted ? FilterOptions.FIRSTPARTY : FilterOptions.THIRDPARTY);
        }
        else if (option === 'match_case') {
            //doesn't have an inverted function
            result.options |= FilterOptions.MATCHCASE;
        }
        else if (option === 'collapse') {
            // We currently do not support this option. However I've never seen any
            // reports where this was causing issues. So for now, simply skip this
            // option, without returning that the filter was invalid.
        }
        else {
            throw "Unknown option in filter " + option;
        }
    }
    // If no element types are mentioned, the default set is implied.
    // Otherwise, the element types are used, which can be ElementTypes.NONE
    if (allowedElementTypes === undefined)
        result.allowedElementTypes = ElementTypes.DEFAULTTYPES;
    else
        result.allowedElementTypes = allowedElementTypes;

    // We parse whitelist rules too, in which case we already know it's a
    // whitelist rule so can ignore the @@s.
    if (Filter.isWhitelistFilter(rule))
        rule = rule.substring(2);

    // Convert regexy stuff.

    // First, check if the rule itself is in regex form.  If so, we're done.
    var matchcase = (result.options & FilterOptions.MATCHCASE) ? "" : "i";
    if (/^\/.+\/$/.test(rule)) {
        result.rule = rule.substr(1, rule.length - 2); // remove slashes
        result.rule = new RegExp(result.rule, matchcase);
        return result;
    }

    var key = rule.match(/[\w&=]{5,}/);

    if (key)
        result.key = key[0];

    // ***** -> *
    //replace, excessive wildcard sequences with a single one
    rule = rule.replace(/\*-\*-\*-\*-\*/g, '*');

    rule = rule.replace(/\*\*+/g, '*');

    // Some chars in regexes mean something special; escape it always.
    // Escaped characters are also faster.
    // - Do not escape a-z A-Z 0-9 and _ because they can't be escaped
    // - Do not escape | ^ and * because they are handled below.
    rule = rule.replace(/([^a-zA-Z0-9_\|\^\*])/g, '\\$1');
    //^ is a separator char in ABP
    rule = rule.replace(/\^/g, '[^\\-\\.\\%a-zA-Z0-9_]');
    //If a rule contains *, replace that by .*
    rule = rule.replace(/\*/g, '.*');
    // Starting with || means it should start at a domain or subdomain name, so
    // match ://<the rule> or ://some.domains.here.and.then.<the rule>
    rule = rule.replace(/^\|\|/, '^[^\\/]+\\:\\/\\/([^\\/]+\\.)?');
    // Starting with | means it should be at the beginning of the URL.
    rule = rule.replace(/^\|/, '^');
    // Rules ending in | means the URL should end there
    rule = rule.replace(/\|$/, '$');
    // Any other '|' within a string should really be a pipe.
    rule = rule.replace(/\|/g, '\\|');
    // If it starts or ends with *, strip that -- it's a no-op.
    rule = rule.replace(/^\.\*/, '');
    rule = rule.replace(/\.\*$/, '');

    result.rule = new RegExp(rule, matchcase);
    return result;
};

// Blocking and whitelist rules both become PatternFilters.
// Inherit from Filter.
PatternFilter.prototype = Object.create(Filter.prototype);

// Returns true if an element of the given type loaded from the given URL
// would be matched by this filter.
//   url:string the url the element is loading.
//   elementType:ElementTypes the type of DOM element.
//   isThirdParty: true if the request for url was from a page of a
//       different origin
PatternFilter.prototype.matches = function (url, elementType, isThirdParty) {

    if (!(elementType & this._allowedElementTypes))
        return false;

    // If the resource is being loaded from the same origin as the document,
    // and your rule applies to third-party loads only, we don't care what
    // regex your rule contains, even if it's for someotherserver.com.
    if ((this._options & FilterOptions.THIRDPARTY) && !isThirdParty)
        return false;

    if ((this._options & FilterOptions.FIRSTPARTY) && isThirdParty)
        return false;

    if (this._key && url.indexOf(this._key) < 0)
        return false;

    return this._rule.test(url);
};
exports.PatternFilter = PatternFilter;
exports.SelectorFilter = SelectorFilter;
exports.Filter = Filter;