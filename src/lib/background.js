"use strict";

var functions = require("functions");
var port = require("port");
var CP = require("contentpolicy");
var ST = require("stats");
var BC = require("blockcounts");
var tabs = require("sdk/tabs");
var tabUtils = require("sdk/tabs/utils");
var self = require("sdk/self");
//TODO - add JavaScript error reporting...

// Send the file name and line number of any error message. This will help us
// to trace down any frequent errors we can't confirm ourselves.
//  window.addEventListener("error", function(e) {
//    var str = "Error: " +
//             (e.filename||"anywhere").replace(chrome.extension.getURL(""), "") +
//             ":" + (e.lineno||"anywhere");
//    if (chrome && chrome.runtime && (chrome.runtime.id === "pljaalgmajnlogcgiohkhdmgpomjcihk")) {
//        var stack = "-" + ((e.error && e.error.message)||"") +
//                    "-" + ((e.error && e.error.stack)||"");
//        stack = stack.replace(/:/gi, ";").replace(/\n/gi, "");
//        //check to see if there's any URL info in the stack trace, if so remove it
//        if (stack.indexOf("http") >= 0) {
//           stack = "-removed URL-";
//        }
//        str += stack;
//    }
//    STATS.msg(str);
//    sessionStorage.setItem("errorOccurred", true);
//    functions.logging.log(str);
//  });

//called from bandaids, for use on our getadblock.com site
var get_adblock_user_id = function () {
    return functions.storage_get("userid");
};
exports.get_adblock_user_id = get_adblock_user_id;

//called from bandaids, for use on our getadblock.com site
var get_first_run = function () {
    return ST.STATS.firstRun;
};
exports.get_first_run = get_first_run;

//called from bandaids, for use on our getadblock.com site
var set_first_run_to_false = function () {
    ST.STATS.firstRun = false;
};
exports.set_first_run_to_false = set_first_run_to_false;

// OPTIONAL SETTINGS

function Settings() {
    var defaults = {
        debug_logging: false,
        youtube_channel_whitelist: false,
        show_google_search_text_ads: false,
        whitelist_hulu_ads: false, // Issue 7178
        show_context_menu_items: true,
        show_advanced_options: false,
        display_stats: true,
        display_menu_stats: true,
        show_block_counts_help_link: true,
    };
    var settings = functions.storage_get('settings') || {};
    this._data = functions.extend(defaults, settings);

};
Settings.prototype = {
    set: function (name, is_enabled) {
        this._data[name] = is_enabled;
        // Don't store defaults that the user hasn't modified
        var stored_data = functions.storage_get("settings") || {};
        stored_data[name] = is_enabled;
        functions.storage_set('settings', stored_data);
    },
    get_all: function () {
        return this._data;
    }
};
var _settings = new Settings();
exports._settings = _settings;

// Open a new tab with a given URL.
// Inputs:
//   url: string - url for the tab
var openTab = function (url) {
    var tabs = require("sdk/tabs");
    var data = require("sdk/self").data;
    tabs.open(data.url(url));
};
exports.openTab = openTab;

//store the hidden element information on the tab.
//the resource information is then used by the resourceblock.js
//
var debug_report_elemhide = function (selector, matches, sender) {

    if ((typeof sender === 'undefined') &&
        (typeof sender.tab === 'undefined') &&
        (typeof sender.tab.id === 'undefined'))
        return;

    var selectedTab = tabUtils.getTabForId(sender.tab.id);
    if (!("_getadblock_com_resources" in selectedTab)) {
        return;
    }
    if (!(selectedTab._getadblock_com_resources[0])) {
        return;
    }
    selectedTab._getadblock_com_resources[0].resources['HIDE:|:' + selector] = null;
    BC.blockCounts.recordOneAdBlocked(sender.tab.id);
    functions.logging.log("hiding rule", selector, "matched:\n", matches);

};
exports.debug_report_elemhide = debug_report_elemhide;

// UNWHITELISTING
// Look for a custom filter that would whitelist options.url,
// and if any exist, remove the first one.
// Inputs: url:string - a URL that may be whitelisted by a custom filter
// Returns: true if a filter was found and removed; false otherwise.
var try_to_unwhitelist = function (url) {
    url = url.replace(/#.*$/, ''); // Whitelist ignores anchors
    var custom_filters = get_custom_filters_text().split('\n');
    for (var i = 0; i < custom_filters.length; i++) {
        var text = custom_filters[i];
        var whitelist = text.search(/@@\*\$document,domain=\~/);
        // Blacklist site, which is whitelisted by global @@*&document,domain=~ filter
        if (whitelist > -1) {
            // Remove protocols
            url = url.replace(/((http|https):\/\/)?(www.)?/, "").split(/[/?#]/)[0];

            text = text + "|~" + url;
            set_custom_filters_text(text);
            return true;
        } else {
            if (!CP.MY.Filter.isWhitelistFilter(text))
                continue;
            try {
                var filter = CP.MY.PatternFilter.fromText(text);
            } catch (ex) {
                continue;
            }
            if (!filter.matches(url, CP.MY.ElementTypes.document, false))
                continue;

            custom_filters.splice(i, 1); // Remove this whitelist filter text
            var new_text = custom_filters.join('\n');
            set_custom_filters_text(new_text);
            return true;
        }
    }
    return false;
};
exports.try_to_unwhitelist = try_to_unwhitelist;

// CUSTOM FILTERS

// Get the custom filters text as a \n-separated text string.
var get_custom_filters_text = function () {
    return functions.storage_get('custom_filters') || '';
};
exports.get_custom_filters_text = get_custom_filters_text;

// Set the custom filters to the given \n-separated text string, and
// rebuild the filterset.
// Inputs: filters:string the new filters.
var set_custom_filters_text = function (filters) {
    functions.storage_set('custom_filters', filters);
    port.chrome.extension.sendRequest({command: "filters_updated"});
    CP._myFilters.rebuild();
};
exports.set_custom_filters_text = set_custom_filters_text;

// Removes a custom filter entry.
// Inputs: host:domain of the custom filters to be reset.
var remove_custom_filter = function (host) {
    var text = get_custom_filters_text();
    var custom_filters_arr = text ? text.split("\n") : [];
    var new_custom_filters_arr = [];
    var identifier = host;

    for (var i = 0; i < custom_filters_arr.length; i++) {
        var entry = custom_filters_arr[i];
        //Make sure that the identifier is at the start of the entry
        if (entry.indexOf(identifier) === 0) {
            continue;
        }
        new_custom_filters_arr.push(entry);
    }

    text = new_custom_filters_arr.join("\n");
    set_custom_filters_text(text.trim());
};
exports.remove_custom_filter = remove_custom_filter;

// count_cache singleton.
var count_cache = (function (count_map) {
    var cache = count_map;
    // Update custom filter count stored in localStorage
    var _updateCustomFilterCount = function () {
        functions.storage_set("custom_filter_count", cache);
    };

    return {
        // Update custom filter count cache and value stored in localStorage.
        // Inputs: new_count_map:count map - count map to replace existing count cache
        updateCustomFilterCountMap: function (new_count_map) {
            cache = new_count_map || cache;
            _updateCustomFilterCount();
        },
        // Remove custom filter count for host
        // Inputs: host:string - url of the host
        removeCustomFilterCount: function (host) {
            if (host && cache[host]) {
                delete cache[host];
                _updateCustomFilterCount();
            }
        },
        // Get current custom filter count for a particular domain
        // Inputs: host:string - url of the host
        getCustomFilterCount: function (host) {
            return cache[host] || 0;
        },
        // Add 1 to custom filter count for the filters domain.
        // Inputs: filter:string - line of text to be added to custom filters.
        addCustomFilterCount: function (filter) {
            var host = filter.split("##")[0];
            cache[host] = this.getCustomFilterCount(host) + 1;
            _updateCustomFilterCount();
        }
    }
})(functions.storage_get("custom_filter_count") || {});
exports.count_cache = count_cache;
exports.getCustomFilterCount = count_cache.getCustomFilterCount;

// Entry point for customize.js, used to update custom filter count cache.
var updateCustomFilterCountMap = function (new_count_map) {
    count_cache.updateCustomFilterCountMap(new_count_map);
};
exports.updateCustomFilterCountMap = updateCustomFilterCountMap;

var remove_custom_filter_for_host = function (host) {
    if (count_cache.getCustomFilterCount(host)) {
        remove_custom_filter(host);
        count_cache.removeCustomFilterCount(host);
        tabs.activeTab.reload();
    }
};
exports.remove_custom_filter_for_host = remove_custom_filter_for_host;

var confirm_removal_of_custom_filters_on_host = function (host) {
    const {components} = require("chrome");
    var prompts = components.classes["@mozilla.org/embedcomp/prompt-service;1"].
                  getService(components.interfaces.nsIPromptService);

    var custom_filter_count = count_cache.getCustomFilterCount(host);
    var confirmation_text = functions.translate("confirm_undo_custom_filters", [custom_filter_count, host]);
    var result = prompts.confirm(null, "AdBlock", confirmation_text);
    if (!result) {
        return;
    }
    remove_custom_filter_for_host(host);
};
exports.confirm_removal_of_custom_filters_on_host = confirm_removal_of_custom_filters_on_host;

var get_settings = function () {
    return _settings.get_all();
};
exports.get_settings = get_settings;

var set_setting = function (name, is_enabled) {
    _settings.set(name, is_enabled);
    if (name === "debug_logging")
        functions.logging.setLogging(is_enabled);
};
exports.set_setting = set_setting;

// MYFILTERS PASSTHROUGHS

// Rebuild the filterset based on the current settings and subscriptions.
var update_filters = function () {
    CP._myFilters.rebuild();
};
exports.update_filters = update_filters;

// Fetch the latest version of all subscribed lists now.
var update_subscriptions_now = function () {
    CP._myFilters.checkFilterUpdates(true);
};
exports.update_subscriptions_now = update_subscriptions_now;

// Returns map from id to subscription object.  See filters.js for
// description of subscription object.
var get_subscriptions_minus_text = function () {
    var result = {};
    for (var id in CP._myFilters._subscriptions) {
        result[id] = {};
        for (var attr in CP._myFilters._subscriptions[id]) {
            if (attr === "text") continue;
            result[id][attr] = CP._myFilters._subscriptions[id][attr];
        }
    }
    return result;
};
exports.get_subscriptions_minus_text = get_subscriptions_minus_text;

// Subscribes to a filter subscription.
// Inputs: id: id to which to subscribe.  Either a well-known
//             id, or "url:xyz" pointing to a user-specified list.
//         requires: the id of a list if it is a supplementary list,
//                   or null if nothing required
// Returns: null, upon completion
var subscribe = function (options) {
    CP._myFilters.changeSubscription(options.id, {
        subscribed: true,
        requiresList: options.requires,
        title: options.title
    });
};
exports.subscribe = subscribe;

// Unsubscribes from a filter subscription.
// Inputs: id: id from which to unsubscribe.
//         del: (bool) if the filter should be removed or not
// Returns: null, upon completion.
var unsubscribe = function (options) {
    CP._myFilters.changeSubscription(options.id, {
        subscribed: false,
        deleteMe: (options.del ? true : undefined)
    });
};
exports.unsubscribe = unsubscribe;

// Returns true if the url cannot be blocked
var page_is_unblockable = function (url) {
    if (!url) { // Firefox empty/bookmarks/top sites page
        return true;
    } else {
        var scheme = functions.parseUri(url).protocol;
        return (scheme !== 'http:' && scheme !== 'https:' && scheme !== 'feed:');
    }
};
exports.page_is_unblockable = page_is_unblockable;

// Get or set if AdBlock is paused
// Inputs: newValue (optional boolean): if true, AdBlock will be paused, if
//                  false, AdBlock will not be paused.
// Returns: undefined if newValue was specified, otherwise it returns true
//          if paused, false otherwise.
var adblock_is_paused = function (newValue) {
    if (typeof sessionStorage === 'undefined') {
        if (newValue === undefined) {
            return (functions.storage_get('adblock_is_paused') === "true");
        }
        functions.storage_set('adblock_is_paused', newValue.toString());
    } else {
        if (newValue === undefined) {
            return (sessionStorage.getItem('adblock_is_paused') === "true");
        }
        sessionStorage.setItem('adblock_is_paused', newValue);
    }
};
exports.adblock_is_paused = adblock_is_paused;

// INFO ABOUT CURRENT PAGE
// Get interesting information about the current tab.
// Inputs:
//   callback: function(info).
//   info object passed to callback: {
//     tab: Tab object
//     whitelisted: bool - whether the current tab's URL is whitelisted.
//     disabled_site: bool - true if the url is e.g. about:blank or the
//                           Extension Gallery, where extensions don't run.
//     total_blocked: int - # of ads blocked since install
//     tab_blocked: int - # of ads blocked on this tab
//     display_stats: bool - whether block counts are displayed on button
//     display_menu_stats: bool - whether block counts are displayed on the popup menu
//   }
// Returns: null (asynchronous)
var getCurrentTabInfo = function (callback, secondTime) {
    return _getCurrentTabInfoForFirefox();

};
exports.getCurrentTabInfo = getCurrentTabInfo;

//Firefox specific function
var _getCurrentTabInfoForFirefox = function (callback, secondTime) {
    var tabs = require('sdk/tabs');
    if (tabs.activeTab && tabs.activeTab.url) {
        var disabled_site = page_is_unblockable(tabs.activeTab.url);
        var total_blocked = BC.blockCounts.getTotalAdsBlocked();
        var tab_blocked = BC.blockCounts.getTotalAdsBlocked(tabs.activeTab.id);
        var display_stats = get_settings().display_stats;
        var display_menu_stats = get_settings().display_menu_stats;

        var result = {
            disabled_site: disabled_site,
            total_blocked: total_blocked,
            tab_blocked: tab_blocked,
            display_stats: display_stats,
            display_menu_stats: display_menu_stats,
            tab: {
                url: tabs.activeTab.url,
                id: tabs.activeTab.id
            }
        };
        if (!disabled_site)
            result.whitelisted = CP.page_is_whitelisted(tabs.activeTab.url);
        return result;
    } else {
        return null;
    }
};

// These functions are usually only called by content scripts.

// Add a new custom filter entry.
// Inputs: filter:string line of text to add to custom filters.
// Returns: null if succesfull, otherwise an exception
var add_custom_filter = function (filter) {
    var custom_filters = get_custom_filters_text();
    try {
        if (CP.MY.FilterNormalizer.normalizeLine(filter)) {
            if (CP.MY.Filter.isSelectorFilter(filter)) {
                count_cache.addCustomFilterCount(filter);
            }
            custom_filters = custom_filters + '\n' + filter;
            set_custom_filters_text(custom_filters);
            return null;
        }
        return "This filter is unsupported";
    } catch (ex) {
        functions.logging.log("background.js::add_custom_filter EXCEPTION", ex);
        functions.logging.log(ex);
        dump(ex);
        return ex;
    }
};
exports.add_custom_filter = add_custom_filter;

// Creates a custom filter entry that whitelists a given page
// Inputs: url:string url of the page
// Returns: null if successful, otherwise an exception
var create_page_whitelist_filter = function (url) {

    url = url.replace(/#.*$/, '');  // Remove anchors
    var parts = url.match(/^([^\?]+)(\??)/); // Detect querystring
    var has_querystring = parts[2];
    var filter = '@@|' + parts[1] + (has_querystring ? '?' : '|') + '$document';
    return add_custom_filter(filter);
};
exports.create_page_whitelist_filter = create_page_whitelist_filter;

// Creates a custom filter entry that whitelists YouTube channel
// Inputs: url:string url of the page
// Returns: null if successful, otherwise an exception
var create_whitelist_filter_for_youtube_channel = function (url) {
    if (/channel/.test(url)) {
        var get_channel = url.match(/channel=([^]*)/)[1];
    } else {
        var get_channel = url.split('/').pop();
    }
    var filter = '@@||youtube.com/*' + get_channel + '$document';
    return add_custom_filter(filter);
};
exports.create_whitelist_filter_for_youtube_channel = create_whitelist_filter_for_youtube_channel;

// Inputs: options object containing:
//           domain:string the domain of the calling frame.
var get_content_script_data = function (options, sender) {
    var settings = get_settings();
    var runnable = !adblock_is_paused() && !page_is_unblockable(sender.tab.url);
    var running = runnable && !CP.page_is_whitelisted(sender.tab.url);
    var hiding = running && !CP.page_is_whitelisted(sender.tab.url,
            CP.MY.ElementTypes.elemhide);
    var result = {
        settings: settings,
        runnable: runnable,
        running: running,
        hiding: hiding
    };

    if (hiding) {
        result.selectors = CP._myFilters.hiding.filtersFor(options.domain);
    }
    return result;
};
exports.get_content_script_data = get_content_script_data;

// Open the resource blocker when requested
var launch_resourceblocker = function (query) {
    openTab("pages/resourceblock.html" + query, true);
};
exports.launch_resourceblocker = launch_resourceblocker;

// Open subscribe popup when new filter list was subscribed from site
var launch_subscribe_popup = function (loc) {
    if ((!functions.isFennec())) {
        var UI = require("uiwidgets");
        UI.openSubscribePanel(loc);
    }
};
exports.launch_subscribe_popup = launch_subscribe_popup;

// Get the framedata for resourceblock
var resourceblock_get_frameData = function (tabId) {
    var tabUtils = require('sdk/tabs/utils');
    var selectedTab = tabUtils.getTabForId(tabId);
    return selectedTab._getadblock_com_resources;
};
exports.resourceblock_get_frameData = resourceblock_get_frameData;

require("functions").logging.setLogging(get_settings().debug_logging);

// Record that we exist.

ST.STATS.startPinging();
functions.logging.log("background: stats:firstRun " + ST.STATS.firstRun);

// Reload the provide tab
// To be called from popup, and options pages.
var reloadTab = function (tabId) {
    if (tabId) {
            var tabs = require('sdk/tabs');
            for each (var tab in tabs) {
                if (tab.id === tabId) {
                    tab.reload();
                    tab.on('ready', function(tab){
                        port.chrome.extension.sendRequest({command: "reloadcomplete"});
                    });
                    return;
                }
            }
        }
  }
  exports.reloadTab = reloadTab;

// Get the current (loaded) malware domains from myfilters.
// if the user isn't subscribed to the Malware fitler list, the _myFilters.getMalwareDomains()
// will return null, in that case, load the file.
// This function should only be used by the adreport and resourceblock pages.
// Returns: an object with all of the malware domains
var getMalwareDomains = function (callbackFN) {
    let domains = CP._myFilters.getMalwareDomains();
    var sendResponse = function (domains) {
        if (callbackFN && (typeof callbackFN) === "function") {
            callbackFN(domains);
        } else {
            port.chrome.extension.sendRequest({command: "malware_domains", data: domains});
        }
    };
    var fetchMalware = function () {
        var url = "https://data.getadblock.com/filters/domains.json?timestamp=" + new Date().getTime();
        // Fetch file with malware-known domains
        const { XMLHttpRequest } = require("sdk/net/xhr");
        var xhr = new XMLHttpRequest();
        xhr.open("GET", url, true);
        xhr.onload = function () {
            domains = JSON.parse(xhr.responseText);
            sendResponse(domains);
            functions.logging.log("Fetched " + url);
        };
        xhr.onerror = function (err) {
            functions.logging.log("Error condition", xhr.status, "url", url, err);
        };
        xhr.send();
    };
    if ((typeof domains === "undefined") || !domains) {
        fetchMalware();
    } else {
        sendResponse(domains);
    }
};
exports.getMalwareDomains = getMalwareDomains;

// DEBUG INFO
// Create the debug info for the textbox or the bug report
var getDebugInfo = function () {
    // Get subscribed filter lists
    var subs = get_subscriptions_minus_text();
    var subscribed_filter_names = [];
    for (var id in subs) {
        if (subs[id].subscribed) {
            subscribed_filter_names.push(id);
            subscribed_filter_names.push("  last updated: " + new Date(subs[id].last_update).toUTCString());
        }
    }
    // Get settings
    var adblock_settings = [];
    var settings = get_settings();
    for (var setting in settings)
        adblock_settings.push(setting + ": " + get_settings()[setting] + "\n");

    adblock_settings.push("malware-notification: " + functions.storage_get('malware-notification') + "\n");
    adblock_settings = adblock_settings.join('');

    var info = [];
    info.push("==== Filter Lists ====");
    info.push(subscribed_filter_names.join('  \n'));
    info.push("");
    info.push("==== Custom Filters ====");
    info.push(functions.storage_get("custom_filters"));
    info.push("");
    if (get_exclude_filters_text()) {
        info.push("==== Exclude Filters ====");
        info.push(get_exclude_filters_text());
        info.push("");
    }
    info.push("==== Settings ====");
    info.push(adblock_settings);
    info.push("");
    info.push("==== Other info: ====");
    var manifest = require("firefox_bg").getFirefoxManifest();
    if (manifest && manifest.version)
        info.push("AdBlock version number: " + manifest.version);
    if (functions.storage_get("error"))
        info.push("Last known error: " + functions.storage_get("error"));
    info.push("Total pings: " + functions.storage_get("total_pings"));
    var system = require("sdk/system");
    info.push("Platform: " + system.platform);
    info.push("Architecture: " + system.architecture);
    info.push("Name: " + system.name);
    info.push("Version: " + system.version);
    info.push("Build: " + system.build);
    info.push("Navigator Language: " + require("functions").determineUserLanguage());
    return info.join('  \n');
};
exports.getDebugInfo = getDebugInfo;

// Get the user enterred exclude filters text as a \n-separated text string.
var get_exclude_filters_text = function () {
    return functions.storage_get('exclude_filters') || '';
};
exports.get_exclude_filters_text = get_exclude_filters_text;
// Set the exclude filters to the given \n-separated text string, and
// rebuild the filterset.
// Inputs: filters:string the new filters.
var set_exclude_filters = function (filters) {
    filters = filters.trim();
    filters = filters.replace(/\n\n/g, '\n');
    functions.storage_set('exclude_filters', filters);
    CP.MY.FilterNormalizer.setExcludeFilters(filters);
    update_subscriptions_now();
};
exports.set_exclude_filters = set_exclude_filters;
// Add / concatenate the exclude filter to the existing excluded filters, and
// rebuild the filterset.
// Inputs: filter:string the new filter.
var add_exclude_filter = function (filter) {
    var currentExcludedFilters = get_exclude_filters_text();
    if (currentExcludedFilters) {
        set_exclude_filters(currentExcludedFilters + "\n" + filter);
    } else {
        set_exclude_filters(filter);
    }
};
exports.add_exclude_filter = add_exclude_filter;

var createMalwareNotification = function () {
    if (functions.storage_get('malware-notification')) {
        //get the current tab, so we only create 1 notification per tab
        var tabs = require('sdk/tabs');
        if (tabs.activeTab) {
            var tab = tabs.activeTab;
            var notifiedTabs = functions.storage_get("malwareNotificationtabs") || {};
            if (notifiedTabs && notifiedTabs[tab.id]) {
                //we've already notified the user, just return.
                return;
            } else {
                notifiedTabs[tab.id] = true;
                functions.storage_set("malwareNotificationtabs", notifiedTabs);
            }
            var notification = require("notification-box").NotificationBox({
                'value': functions.translate('malwarenotificationtitle'),
                'label': functions.translate('malwarenotificationmessage'),
                'priority': 'WARNING_HIGH',
                'image': self.data.url("img/icon24.png"),
                'buttons': [{
                    'label': functions.translate('malwarenotificationlearnmore'),
                    'onClick': function () {
                        openTab("http://support.getadblock.com/kb/im-seeing-an-ad/im-seeing-similar-ads-on-every-website/");
                    }
                },
                    {
                        'label': functions.translate('malwarenotificationdisablethesemessages'),
                        'onClick': function () {
                            functions.storage_set('malware-notification', false);
                        }
                    }]
            });
        }
    }//end of if
};//end of createMalwareNotification function
exports.createMalwareNotification = createMalwareNotification;

var removeMalwareNotifications = function () {
    if (functions.storage_get('malware-notification')) {
        functions.storage_set("malwareNotificationtabs", {});
    }
};//end of removeMalwareNotifications function
exports.removeMalwareNotifications = removeMalwareNotifications;

functions.logging.log("\n===FINISHED LOADING===\n\n");
