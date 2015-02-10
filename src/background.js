  // Send the file name and line number of any error message. This will help us
  // to trace down any frequent errors we can't confirm ourselves.
  window.addEventListener("error", function(e) {
    var str = "Error: " +
             (e.filename||"anywhere").replace(chrome.extension.getURL(""), "") +
             ":" + (e.lineno||"anywhere");
    STATS.msg(str);
    sessionStorage.setItem("errorOccurred", true);
  });
  
  if (!SAFARI) {
    // Records how many ads have been blocked by AdBlock.  This is used
    // by the AdBlock app in the Chrome Web Store to display statistics
    // to the user.
    var blockCounts = (function() {
      var key = "blockage_stats";
      var data = storage_get(key);
      if (!data) 
        data = {};
      if (data.start === undefined)
        data.start = Date.now();
      if (data.total === undefined)
        data.total = 0;
      data.version = 1;
      storage_set(key, data);

      return {
        recordOneAdBlocked: function(tabId) {
          var data = storage_get(key);
          data.total += 1;
          storage_set(key, data);
          
          //code for incrementing ad blocks
          currentTab = frameData.get(tabId);
          if(currentTab){
            currentTab.blockCount++;
          }
        },
        get: function() { 
          return storage_get(key); 
        },
        getTotalAdsBlocked: function(tabId){
          if(tabId){
            currentTab = frameData.get(tabId);
            return currentTab ? currentTab.blockCount : 0;
          }
          return this.get().total;
        }
      };
    })();
  }

  // OPTIONAL SETTINGS

  function Settings() {
    var defaults = {
      debug_logging: false,
      show_google_search_text_ads: false,
      whitelist_hulu_ads: false, // Issue 7178
      show_context_menu_items: true,
      show_advanced_options: false,
      new_safari_hiding: false,
      display_stats: true,
      show_block_counts_help_link: true,
    };
    var settings = storage_get('settings') || {};
    this._data = $.extend(defaults, settings);

    // new_safari_hiding should NEVER be set to true outside Safari 6.  Leaving
    // this code here to remember this when we switch new_safari_hiding from
    // opt-in to opt-out in Safari 6: even if somehow a non-Safari-6 user gets
    // this set to true, it will be reset when they restart their browser.
    if (!SAFARI6)
      this._data.new_safari_hiding = false;
  };
  Settings.prototype = {
    set: function(name, is_enabled) {
      this._data[name] = is_enabled;
      // Don't store defaults that the user hasn't modified
      var stored_data = storage_get("settings") || {};
      stored_data[name] = is_enabled;
      storage_set('settings', stored_data);
    },
    get_all: function() {
      return this._data;
    }
  };
  _settings = new Settings();

  // Open a new tab with a given URL.
  // Inputs:
  //   url: string - url for the tab
  //   nearActive: bool - open the tab near currently active (instead of at the end). optional, defaults to false
  //   safariWindow (Safari only): window object - window where the tab will be created. optional, defaults
  //     to active window. Because Safari supports clickthrough on extension elements, Safari code will almost
  //    always need to pass this argument. Chrome doesn't support it, so leave this argument empty in Chrome code.
  function openTab(url, nearActive, safariWindow) {
    if (!SAFARI) {
      if (!nearActive) {
        chrome.tabs.create({url: url});
      } else {
        chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
           chrome.tabs.create({ url: url, index: (tabs[0] ? tabs[0].index + 1 : undefined) });
        });
      }
    } else {
      safariWindow = safariWindow || safari.application.activeBrowserWindow;
      var index = undefined;
      if (nearActive && safariWindow && safariWindow.activeTab) {
        for (var i = 0; i < safariWindow.tabs.length; i++) {
          if (safariWindow.tabs[i] === safariWindow.activeTab) {
            index = i + 1;
            break;
          }
        }
      }
      var tab;
      if (safariWindow) {
        tab = safariWindow.openTab("foreground", index); // index may be undefined
        if (!safariWindow.visible) {
          safariWindow.activate();
        }
      } else {
        tab = safari.application.openBrowserWindow().tabs[0];
      }
      var relative = (!/:\/\//.test(url)); // fix relative URLs
      tab.url = (relative ? chrome.extension.getURL(url) : url);
    }
  };

  // Implement blocking via the Chrome webRequest API.
  if (!SAFARI) {
    // Stores url, whitelisting, and blocking info for a tabid+frameid
    // TODO: can we avoid making this a global?
    frameData = {
      // Returns the data object for the frame with ID frameId on the tab with
      // ID tabId. If frameId is not specified, it'll return the data for all
      // frames on the tab with ID tabId. Returns undefined if tabId and frameId
      // are not being tracked.
      get: function(tabId, frameId) {
        if (frameId !== undefined)
          return (frameData[tabId] || {})[frameId];
        return frameData[tabId];
      },

      // Record that |tabId|, |frameId| points to |url|.
      record: function(tabId, frameId, url) {
        var fd = frameData;
        if (!fd[tabId]) fd[tabId] = {};
        fd[tabId][frameId] = {
          url: url,
          // Cache these as they'll be needed once per request
          domain: parseUri(url).hostname,
          resources: {}
        };
        if (frameId === 0) {
          fd[tabId][frameId].whitelisted = page_is_whitelisted(url);
        }
      },
      
      // Watch for requests for new tabs and frames, and track their URLs.
      // Inputs: details: object from onBeforeRequest callback
      // Returns false if this request's tab+frame are not trackable.
      track: function(details) {
        var fd = frameData, tabId = details.tabId;

        if (tabId == -1) // A hosted app's background page
          return false;

        if (details.type == 'main_frame') { // New tab
          delete fd[tabId];
          fd.record(tabId, 0, details.url);
          fd[tabId].blockCount = 0;
          log("\n-------", fd.get(tabId, 0).domain, ": loaded in tab", tabId, "--------\n\n");
          return true;
        }

        // Request from a tab opened before AdBlock started, or from a
        // chrome:// tab containing an http:// iframe
        if (!fd[tabId]) {
          log("[DEBUG]", "Ignoring unknown tab:", tabId, details.frameId, details.url);
          return false;
        }

        // Some times e.g. Youtube create empty iframes via JavaScript and
        // inject code into them.  So requests appear from unknown frames.
        // Treat these frames as having the same URL as the tab.
        var potentialEmptyFrameId = (details.type == 'sub_frame' ? details.parentFrameId: details.frameId);
        if (undefined === fd.get(tabId, potentialEmptyFrameId)) {
          fd.record(tabId, potentialEmptyFrameId, fd.get(tabId, 0).url);
          log("[DEBUG]", "Null frame", tabId, potentialEmptyFrameId, "found; giving it the tab's URL.");
        }

        if (details.type == 'sub_frame') { // New frame
          fd.record(tabId, details.frameId, details.url);
          log("[DEBUG]", "=========== Tracking frame", tabId, details.parentFrameId, details.frameId, details.url);
        }

        return true;
      },

      // Record a resource for the resource blocker.
      storeResource: function(tabId, frameId, url, elType) {
        if (!get_settings().show_advanced_options)
          return;
        var data = frameData.get(tabId, frameId);
        if (data !== undefined)
          data.resources[elType + ':|:' + url] = null;
      },

      // When a tab is closed, delete all its data
      onTabClosedHandler: function(tabId) {
        log("[DEBUG]", "----------- Closing tab", tabId);
        delete frameData[tabId];
      }
    };

    // When a request starts, perhaps block it.
    function onBeforeRequestHandler(details) {
      if (adblock_is_paused())
        return { cancel: false };

      if (!frameData.track(details))
        return { cancel: false };

      var tabId = details.tabId;
      var elType = ElementTypes.fromOnBeforeRequestType(details.type);

      if (frameData.get(tabId, 0).whitelisted) {
        log("[DEBUG]", "Ignoring whitelisted tab", tabId, details.url.substring(0, 100));
        return { cancel: false };
      }

      // For most requests, Chrome and we agree on who sent the request: the frame.
      // But for iframe loads, we consider the request to be sent by the outer
      // frame, while Chrome claims it's sent by the new iframe.  Adjust accordingly.
      var requestingFrameId = (details.type == 'sub_frame' ? details.parentFrameId : details.frameId);

      frameData.storeResource(tabId, requestingFrameId, details.url, elType);

      // May the URL be loaded by the requesting frame?
      var frameDomain = frameData.get(tabId, requestingFrameId).domain;
      var blocked = _myfilters.blocking.matches(details.url, elType, frameDomain);

      // Issue 7178
      if (blocked && frameDomain === "www.hulu.com") {
        if (frameData.get(tabId, 0).domain !== "www.hulu.com"
            && /ads\.hulu\.com/.test(details.url)) // good enough
          blocked = false;
      }

      var canPurge = (elType & (ElementTypes.image | ElementTypes.subdocument | ElementTypes.object));
      if (canPurge && blocked) {
        // frameUrl is used by the recipient to determine whether they're the frame who should
        // receive this or not.  Because the #anchor of a page can change without navigating
        // the frame, ignore the anchor when matching.
        var frameUrl = frameData.get(tabId, requestingFrameId).url.replace(/#.*$/, "");
        var data = { command: "purge-elements", tabId: tabId, frameUrl: frameUrl, url:details.url, elType: elType };
        chrome.tabs.sendRequest(tabId, data); 
      }

      if (blocked){
        blockCounts.recordOneAdBlocked(tabId);
        updateBadge(tabId);
      }
      log("[DEBUG]", "Block result", blocked, details.type, frameDomain, details.url.substring(0, 100));
      if (blocked && elType === ElementTypes.image) {
        // 1x1 px transparant image.
        // Same URL as ABP and Ghostery to prevent conflict warnings (issue 7042)
        return {redirectUrl: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAACklEQVR4nGMAAQAABQABDQottAAAAABJRU5ErkJggg=="};
      }
      if (blocked && elType === ElementTypes.subdocument) {
        return { redirectUrl: "about:blank" };
      }
      return { cancel: blocked };
    }

    // Popup blocking
    function onCreatedNavigationTargetHandler(details) {
      var opener = frameData.get(details.sourceTabId, details.sourceFrameId);
      if (opener === undefined)
        return;
      if (frameData.get(details.sourceTabId, 0).whitelisted)
        return;
      // Change to opener's url in so that it would still be tested against the
      // blocking filter's regex rule. Github issue # 69
      if (details.url === "about:blank")
        details.url = opener.url;
      var match = _myfilters.blocking.matches(details.url, ElementTypes.popup, opener.domain);
      if (match)
        chrome.tabs.remove(details.tabId);
      frameData.storeResource(details.sourceTabId, details.sourceFrameId, details.url, ElementTypes.popup);
    };
  }

  debug_report_elemhide = function(selector, matches, sender) {
    if (!window.frameData)
      return;
    frameData.storeResource(sender.tab.id, 0, selector, "HIDE");
    var data = frameData.get(sender.tab.id, 0);
    if (data)
      log(data.domain, ": hiding rule", selector, "matched:\n", matches);
  }

  // UNWHITELISTING

  // Look for a custom filter that would whitelist options.url,
  // and if any exist, remove the first one.
  // Inputs: url:string - a URL that may be whitelisted by a custom filter
  // Returns: true if a filter was found and removed; false otherwise.
  try_to_unwhitelist = function(url) {
    url = url.replace(/#.*$/, ''); // Whitelist ignores anchors
    var custom_filters = get_custom_filters_text().split('\n');
    for (var i = 0; i < custom_filters.length; i++) {
      var text = custom_filters[i];
      if (!Filter.isWhitelistFilter(text))
        continue;
      try {
        var filter = PatternFilter.fromText(text);
      } catch (ex) { 
        continue; 
      }
      if (!filter.matches(url, ElementTypes.document, false))
        continue;

      custom_filters.splice(i, 1); // Remove this whitelist filter text
      var new_text = custom_filters.join('\n');
      set_custom_filters_text(new_text);
      return true;
    }
    return false;
  }

  // Called when Chrome blocking needs to clear the in-memory cache.
  // No-op for Safari.
  handlerBehaviorChanged = function() {
    if (SAFARI)
      return;
    try {
      chrome.webRequest.handlerBehaviorChanged();
    } catch (ex) {
    }
  }

  // CUSTOM FILTERS
  
  // Get the custom filters text as a \n-separated text string.
  get_custom_filters_text = function() {
    return storage_get('custom_filters') || '';
  }

  // Set the custom filters to the given \n-separated text string, and
  // rebuild the filterset.
  // Inputs: filters:string the new filters.
  set_custom_filters_text = function(filters) {
    storage_set('custom_filters', filters);
    chrome.extension.sendRequest({command: "filters_updated"});
    _myfilters.rebuild();
  }

  // Removes a custom filter entry.
  // Inputs: host:domain of the custom filters to be reset.
  remove_custom_filter = function(host) {
    var text = get_custom_filters_text();
    var custom_filters_arr = text ? text.split("\n"):[];
    var new_custom_filters_arr = [];
    var identifier = host + "##"; //append delimiter to make sure it is the identifier
    
    for(var i = 0; i < custom_filters_arr.length; i++) {
      var entry = custom_filters_arr[i];
      //Make sure that the identifier is at the start of the entry
      if(entry.indexOf(identifier) === 0) { continue; }
      new_custom_filters_arr.push(entry);
    }
    
    text = new_custom_filters_arr.join("\n");
    set_custom_filters_text(text.trim());
  }
  
  // count_cache singleton.
  var count_cache = (function(count_map) {
    var cache = count_map;
    // Update custom filter count stored in localStorage
    var _updateCustomFilterCount = function() {
      storage_set("custom_filter_count", cache);
    };
    
    return {
      // Update custom filter count cache and value stored in localStorage.
      // Inputs: new_count_map:count map - count map to replace existing count cache
      updateCustomFilterCountMap: function(new_count_map) {
        cache = new_count_map || cache;
        _updateCustomFilterCount();
      },
      // Remove custom filter count for host
      // Inputs: host:string - url of the host
      removeCustomFilterCount: function(host) {
        if(host && cache[host]) {
          delete cache[host];
          _updateCustomFilterCount();
        }
      },
      // Get current custom filter count for a particular domain
      // Inputs: host:string - url of the host
      getCustomFilterCount: function(host) {
        return cache[host] || 0;
      },
      // Add 1 to custom filter count for the filters domain.
      // Inputs: filter:string - line of text to be added to custom filters.
      addCustomFilterCount: function(filter) {
        var host = filter.split("##")[0];
        cache[host] = this.getCustomFilterCount(host) + 1;
        _updateCustomFilterCount();
      }
    }
  })(storage_get("custom_filter_count") || {});
  
  // Entry point for customize.js, used to update custom filter count cache.
  updateCustomFilterCountMap = function(new_count_map) {
    count_cache.updateCustomFilterCountMap(new_count_map);
  }
  
  remove_custom_filter_for_host = function(host) {
    if(count_cache.getCustomFilterCount(host)) {
      remove_custom_filter(host);
      count_cache.removeCustomFilterCount(host);
    } 
  }

  confirm_removal_of_custom_filters_on_host = function(host) {
    var custom_filter_count = count_cache.getCustomFilterCount(host);
    var confirmation_text   = translate("confirm_undo_custom_filters", [custom_filter_count, host]);
    if (!confirm(confirmation_text)) { return; }
    remove_custom_filter_for_host(host);
    chrome.tabs.reload();
  };

  get_settings = function() {
    return _settings.get_all();
  }

  set_setting = function(name, is_enabled) {
    _settings.set(name, is_enabled);

    if (name === "debug_logging")
      logging(is_enabled);

    if (name === "new_safari_hiding")
      update_filters();
  }

  // MYFILTERS PASSTHROUGHS

  // Rebuild the filterset based on the current settings and subscriptions.
  update_filters = function() {
    _myfilters.rebuild();
  }

  // Fetch the latest version of all subscribed lists now.
  update_subscriptions_now = function() {
    _myfilters.checkFilterUpdates(true);
  }

  // Returns map from id to subscription object.  See filters.js for
  // description of subscription object.
  get_subscriptions_minus_text = function() {
    var result = {};
    for (var id in _myfilters._subscriptions) {
      result[id] = {};
      for (var attr in _myfilters._subscriptions[id]) {
        if (attr == "text") continue;
        result[id][attr] = _myfilters._subscriptions[id][attr];
      }
    }
    return result;
  }
  
  // Subscribes to a filter subscription.
  // Inputs: id: id to which to subscribe.  Either a well-known
  //             id, or "url:xyz" pointing to a user-specified list.
  //         requires: the id of a list if it is a supplementary list,
  //                   or null if nothing required
  // Returns: null, upon completion
  subscribe = function(options) {
    _myfilters.changeSubscription(options.id, {
      subscribed: true,
      requiresList: options.requires
    });
  }

  // Unsubscribes from a filter subscription.
  // Inputs: id: id from which to unsubscribe.
  //         del: (bool) if the filter should be removed or not
  // Returns: null, upon completion.
  unsubscribe = function(options) {
    _myfilters.changeSubscription(options.id, {
      subscribed: false,
      deleteMe: (options.del ? true : undefined)
    });
  }

  // Returns true if the url cannot be blocked
  page_is_unblockable = function(url) {
    if (!url) { // Safari empty/bookmarks/top sites page
      return true;
    } else {
      var scheme = parseUri(url).protocol;
      return (scheme !== 'http:' && scheme !== 'https:' && scheme !== 'feed:');
    }
  }
  
  // Get or set if AdBlock is paused
  // Inputs: newValue (optional boolean): if true, AdBlock will be paused, if
  //                  false, AdBlock will not be paused.
  // Returns: undefined if newValue was specified, otherwise it returns true
  //          if paused, false otherwise.
  adblock_is_paused = function(newValue) {
    if (newValue === undefined) {
      return sessionStorage.getItem('adblock_is_paused') === "true";
    }
    sessionStorage.setItem('adblock_is_paused', newValue);
    if (_myfilters.styleSheetRegistrar)
      _myfilters.styleSheetRegistrar.pause(newValue);
  }

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
  //   }
  // Returns: null (asynchronous)
  getCurrentTabInfo = function(callback, secondTime) {
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      if (tabs.length === 0)
        return; // For example: only the background devtools or a popup are opened
      var tab = tabs[0];

      if (tab && !tab.url) {
        // Issue 6877: tab URL is not set directly after you opened a window
        // using window.open()
        if (!secondTime)
          window.setTimeout(function() {
            getCurrentTabInfo(callback, true);
          }, 250);
        return;
      }

      var disabled_site = page_is_unblockable(tab.url);
      var total_blocked = blockCounts.getTotalAdsBlocked();
      var tab_blocked = blockCounts.getTotalAdsBlocked(tab.id);
      var display_stats = get_settings().display_stats;
      
      var result = {
        tab: tab,
        disabled_site: disabled_site,
        total_blocked: total_blocked,
        tab_blocked: tab_blocked,
        display_stats: display_stats
      };
      if (!disabled_site)
        result.whitelisted = page_is_whitelisted(tab.url);

      callback(result);
    });
  }
  
  // Returns true if anything in whitelist matches the_domain.
  //   url: the url of the page
  //   type: one out of ElementTypes, default ElementTypes.document,
  //         to check what the page is whitelisted for: hiding rules or everything
  page_is_whitelisted = function(url, type) {
    if (!url) { // Safari empty/bookmarks/top sites page
      return true;
    }
    url = url.replace(/\#.*$/, ''); // Remove anchors
    if (!type)
      type = ElementTypes.document;
    var whitelist = _myfilters.blocking.whitelist;
    return whitelist.matches(url, type, parseUri(url).hostname, false);
  }

  updateDisplayStats = function(isChecked, tabId) {
    set_setting("display_stats", isChecked);
    updateBadge(tabId);
  }
  
  if (!SAFARI) {
    updateBadge = function(tabId) {
      var display = get_settings().display_stats;
      var badge_text = "";
      var main_frame = frameData.get(tabId, 0);
      // main_frame is undefined if the tab is a new one, so no use updating badge.
      if (!main_frame) return;
      
      var isBlockable = !page_is_unblockable(main_frame.url) && !page_is_whitelisted(main_frame.url);
      
      if(display && (main_frame && isBlockable) && !adblock_is_paused()){
        badge_text = blockCounts.getTotalAdsBlocked(tabId).toString();
        if (badge_text === "0")
          badge_text = ""; // Only show the user when we've done something useful
      }
      chrome.browserAction.setBadgeText({text: badge_text, tabId: tabId});
      chrome.browserAction.setBadgeBackgroundColor({ color: "#555" });
    };

    // Set the button image and context menus according to the URL
    // of the current tab.
    updateButtonUIAndContextMenus = function() {

      function setContextMenus(info) {
        chrome.contextMenus.removeAll();
        if (!get_settings().show_context_menu_items)
          return;

        if (adblock_is_paused() || info.whitelisted || info.disabled_site)
          return;

        function addMenu(title, callback) {
          chrome.contextMenus.create({
            title: title,
            contexts: ["all"],
            onclick: function(clickdata, tab) { callback(tab, clickdata); }
          });
        }
        
        addMenu(translate("block_this_ad"), function(tab, clickdata) {
          emit_page_broadcast(
            {fn:'top_open_blacklist_ui', options:{info: clickdata}},
            {tab: tab}
          );
        });

        addMenu(translate("block_an_ad_on_this_page"), function(tab) {
          emit_page_broadcast(
            {fn:'top_open_blacklist_ui', options:{nothing_clicked: true}},
            {tab: tab}
          );
        });
        
        var host                = parseUri(info.tab.url).host;
        var custom_filter_count = count_cache.getCustomFilterCount(host);
        if (custom_filter_count) {
          addMenu(translate("undo_last_block"), function(tab) {
            confirm_removal_of_custom_filters_on_host(host);
          });
        }
      }

      function setBrowserButton(info) {
        var tabId = info.tab.id;
        chrome.browserAction.setBadgeText({text: "", tabId: tabId});
        if (adblock_is_paused()) {
          chrome.browserAction.setIcon({path:{'19': "img/icon19-grayscale.png", '38': "img/icon38-grayscale.png"}, tabId: tabId});
        } else if (info.disabled_site &&
            !/^chrome-extension:.*pages\/install\//.test(info.tab.url)) {
          // Show non-disabled icon on the installation-success page so it
          // users see how it will normally look. All other disabled pages
          // will have the gray one
          chrome.browserAction.setIcon({path:{'19': "img/icon19-grayscale.png", '38': "img/icon38-grayscale.png"}, tabId: tabId});
        } else if (info.whitelisted) {
          chrome.browserAction.setIcon({path:{'19': "img/icon19-whitelisted.png", '38': "img/icon38-whitelisted.png"}, tabId: tabId});
        } else {
          chrome.browserAction.setIcon({path:{'19': "img/icon19.png", '38': "img/icon38.png"}, tabId: tabId});
          updateBadge(tabId);
        }
      }

      getCurrentTabInfo(function(info) {
        setContextMenus(info);
        setBrowserButton(info);
      });
    }
  }

  // These functions are usually only called by content scripts.

  // Add a new custom filter entry.
  // Inputs: filter:string line of text to add to custom filters.
  // Returns: null if succesfull, otherwise an exception
  add_custom_filter = function(filter) {
    var custom_filters = get_custom_filters_text();
    try {
      if (FilterNormalizer.normalizeLine(filter)) {
        if (Filter.isSelectorFilter(filter)) {
          count_cache.addCustomFilterCount(filter);
          if (!SAFARI)
            updateButtonUIAndContextMenus();
        }
        custom_filters = custom_filters + '\n' + filter;
        set_custom_filters_text(custom_filters);
        return null;
      }
      return "This filter is unsupported";
    } catch(ex) {
      return ex;
    }
  };

  // Return the contents of a local file.
  // Inputs: file:string - the file relative address, eg "js/foo.js".
  // Returns: the content of the file.
  readfile = function(file) {
    // A bug in jquery prevents local files from being read, so use XHR.
    var xhr = new XMLHttpRequest();
    xhr.open("GET", chrome.extension.getURL(file), false);
    xhr.send();
    return xhr.responseText;
  };

  // Creates a custom filter entry that whitelists a given page
  // Inputs: url:string url of the page
  // Returns: null if successful, otherwise an exception
  create_page_whitelist_filter = function(url) {
    var url = url.replace(/#.*$/, '');  // Remove anchors
    var parts = url.match(/^([^\?]+)(\??)/); // Detect querystring
    var has_querystring = parts[2];
    var filter = '@@|' + parts[1] + (has_querystring ? '?' : '|') + '$document';
    return add_custom_filter(filter);
  }

  // Inputs: options object containing:
  //           domain:string the domain of the calling frame.
  get_content_script_data = function(options, sender) {
    var settings = get_settings();
    var runnable = !adblock_is_paused() && !page_is_unblockable(sender.tab.url);
    var running = runnable && !page_is_whitelisted(sender.tab.url);
    var hiding = running && !page_is_whitelisted(sender.tab.url,
                                                        ElementTypes.elemhide);
    var result = {
      settings: settings,
      runnable: runnable,
      running: running,
      hiding: hiding
    };
    if (_myfilters.styleSheetRegistrar) {
      _myfilters.styleSheetRegistrar.prepareFor(options.domain);
      result.avoidHidingClass = StyleSheetRegistrar.avoidHidingClass;
      if (settings.debug_logging && hiding) {
        var filters = _myfilters.styleSheetRegistrar._filters;
        var filterset = FilterSet.fromFilters(filters);
        result.selectors = filterset.filtersFor(options.domain);
      }
    }
    if (!_myfilters.styleSheetRegistrar && hiding) {
      result.selectors = _myfilters.hiding.filtersFor(options.domain);
    }
    return result;
  };

  // Bounce messages back to content scripts.
  if (!SAFARI) {
    emit_page_broadcast = (function() {
      var injectMap = {
        'top_open_whitelist_ui': {
          allFrames: false,
          include: [
            "jquery/jquery.min.js",
            "jquery/jquery-ui.custom.min.js",
            "uiscripts/load_jquery_ui.js",
            "uiscripts/top_open_whitelist_ui.js"
            ]
        },
        'top_open_blacklist_ui': {
          allFrames: false,
          include: [
            "jquery/jquery.min.js",
            "jquery/jquery-ui.custom.min.js",
            "uiscripts/load_jquery_ui.js",
            "uiscripts/blacklisting/overlay.js",
            "uiscripts/blacklisting/clickwatcher.js",
            "uiscripts/blacklisting/elementchain.js",
            "uiscripts/blacklisting/blacklistui.js",
            "uiscripts/top_open_blacklist_ui.js"
            ]
        },
        'send_content_to_back': {
          allFrames: true,
          include: [
            "uiscripts/send_content_to_back.js"
            ]
        }
      };
      // Inject the required scripts to execute fn_name(parameter) in
      // the current tab.
      // Inputs: fn_name:string name of function to execute on tab.
      //         fn_name must exist in injectMap above.
      //         parameter:object to pass to fn_name.  Must be JSON.stringify()able.
      //         injectedSoFar?:int used to recursively inject required scripts.
      var executeOnTab = function(fn_name, parameter, injectedSoFar) {
        injectedSoFar = injectedSoFar || 0;
        var data = injectMap[fn_name];
        var details = { allFrames: data.allFrames };
        // If there's anything to inject, inject the next item and recurse.
        if (data.include.length > injectedSoFar) {
          details.file = data.include[injectedSoFar];
          chrome.tabs.executeScript(undefined, details, function() {
            executeOnTab(fn_name, parameter, injectedSoFar + 1);
          });
        }
        // Nothing left to inject, so execute the function.
        else {
          var param = JSON.stringify(parameter);
          details.code = fn_name + "(" + param + ");";
          chrome.tabs.executeScript(undefined, details);
        }
      };

      // The emit_page_broadcast() function
      var theFunction = function(request) {
        executeOnTab(request.fn, request.options);
      };
      return theFunction;
    })();
  }

  // Open the resource blocker when requested from the Chrome popup.
  launch_resourceblocker = function(query) {
    openTab("pages/resourceblock.html" + query, true);
  }

  // Get the framedata for resourceblock
  resourceblock_get_frameData = function(tabId) {
    return frameData.get(tabId);
  }

  // Return chrome.i18n._getL10nData() for content scripts who cannot
  // call that function (since it loads extension files from disk.)
  // Only defined in Safari.
  get_l10n_data = (SAFARI ? chrome.i18n._getL10nData : undefined);


  // BGcall DISPATCH
  (function() {
    chrome.extension.onRequest.addListener(
      function(request, sender, sendResponse) {
        if (request.command != "call")
          return; // not for us
        // +1 button in browser action popup loads a frame which
        // runs content scripts.  Ignore their cries for ad blocking.
        if (sender.tab == null)
          return;
        var fn = window[request.fn];
        request.args.push(sender);
        var result = fn.apply(window, request.args);
        sendResponse(result);
      }
    );
  })();
  
  // BROWSER ACTION AND CONTEXT MENU UPDATES
  (function() {
    if (SAFARI)
      return;
    
    //TEMP: until crbug.com/60435 is fixed, check if chrome.tabs exists.
    //Otherwise the extension doesn't work (e.g. doesn't block ads)
    if (chrome.tabs) {
      chrome.tabs.onUpdated.addListener(function(tabid, changeInfo, tab) {
        if (tab.active && changeInfo.status === "loading")
          updateButtonUIAndContextMenus();
      });
      chrome.tabs.onActivated.addListener(function() {
        updateButtonUIAndContextMenus();
      });
    }
  })();

  if (get_settings().debug_logging)
    logging(true);

  _myfilters = new MyFilters();
  _myfilters.init();
  // Record that we exist.
  STATS.startPinging();

  if (STATS.firstRun) {
    openTab("https://getadblock.com/installed/?u=" + STATS.userId);
  }

  if (!SAFARI) {
    // Chrome blocking code.  Near the end so synchronous request handler
    // doesn't hang Chrome while AdBlock initializes.
    chrome.webRequest.onBeforeRequest.addListener(onBeforeRequestHandler, {urls: ["http://*/*", "https://*/*"]}, ["blocking"]);
    chrome.tabs.onRemoved.addListener(frameData.onTabClosedHandler);
    // Popup blocking
    if (chrome.webNavigation)
      chrome.webNavigation.onCreatedNavigationTarget.addListener(onCreatedNavigationTargetHandler);

    var handleEarlyOpenedTabs = function(tabs) {
      log("Found", tabs.length, "tabs that were already opened");
      for (var i=0; i<tabs.length; i++) {
        var currentTab = tabs[i], tabId = currentTab.id;
        if (!frameData.get(tabId)) // unknown tab
          frameData.track({url: currentTab.url, tabId: tabId, type: "main_frame"});
        updateBadge(tabId);
        // TODO: once we're able to get the parentFrameId, call
        // chrome.webNavigation.getAllFrames to 'load' the subframes
      }
    }
    chrome.tabs.query({url: "http://*/*"}, handleEarlyOpenedTabs);
    chrome.tabs.query({url: "https://*/*"}, handleEarlyOpenedTabs);
  }
  
  log("\n===FINISHED LOADING===\n\n");
