// Store the data that content scripts need
// This variable is deleted in adblock.js
// run_after_data_is_set can contain a function to run after the data was set,
// (only likely function: adblock_begin_part_2() from adblock.js)
GLOBAL_contentScriptData = {
  data: undefined,
  run_after_data_is_set: function() {},
}

// Browser-agnostic canLoad function.
// Returns false if data.url, data.elType, and data.frameDomain together
// should not be blocked.
function browser_canLoad(event, data) {
  if (SAFARI) {
    return safari.self.tab.canLoad(event, data);
  } else {
    // If we haven't yet asynchronously loaded our filters, store for later.
    if (typeof _local_block_filterset == "undefined") {
      if (!(data.elType & ElementTypes.script)) {
        event.mustBePurged = true;
        LOADED_TOO_FAST.push({data:event});
      }
      return true;
    }

    var isMatched = data.url && _local_block_filterset.matches(data.url, data.elType, data.frameDomain);
    if (isMatched && event.mustBePurged)
      log("Purging if possible " + data.url);
    return !isMatched;
  }
}

// Remove background images and purged elements.
// Return true if the element has been handled.
function weakDestroyElement(el, elType, mustBePurged) {
  if (elType & ElementTypes.background) {
    el.style.setProperty("background-image", "none", "important");
    return true;
  }
  else if (elType == ElementTypes.script) {
    return true; // nothing to do
  }
  else if (el.nodeName == "FRAME") {
    return false; // can't handle frames
  }
  else if (mustBePurged) {
    var replacement = document.createElement(el.nodeName);
    if (el.id) replacement.id = el.id;
    if (el.className) replacement.className = el.className;
    if (el.name) replacement.name = el.name;
    replacement.setAttribute("style", "display: none !important; visibility: hidden !important; opacity: 0 !important");
    el.parentNode.replaceChild(replacement, el);
    return true;
  }
  else {
    return false; // not handled by this function
  }
};

beforeLoadHandler = function(event) {
  var el = event.target;
  // Cancel the load if canLoad is false.
  var elType = typeForElement(el);
  var data = { 
    url: relativeToAbsoluteUrl(event.url),
    elType: elType,
    frameDomain: document.location.hostname
  };
  addResourceToList(elType + ':|:' + data.url);
  if (false == browser_canLoad(event, data)) {

    // Work around bugs.webkit.org/show_bug.cgi?id=65412
    // Allow the resource to load, but hide it afterwards.
    // Probably a normal site will never reach 250.
    beforeLoadHandler.blockCount++;
    if (beforeLoadHandler.blockCount > 250) {
      log("ABORTING: blocked over 250 requests, probably an infinite loading loop");
      beforeLoadHandler.blockCount = 0;
    } else
      event.preventDefault();

    if (!weakDestroyElement(el, elType, event.mustBePurged))
      destroyElement(el, elType);
  }
}
beforeLoadHandler.blockCount = 0;

function adblock_begin() {
  if (!SAFARI)
    LOADED_TOO_FAST = [];
  GLOBAL_collect_resources = {};
  addResourceToList = function(resource) {
    GLOBAL_collect_resources[resource] = null;
  }
  var isRockMelt = navigator.userAgent.match(/RockMelt/);
  if (SAFARI || isRockMelt)
    document.addEventListener("beforeload", beforeLoadHandler, true);

  var opts = { 
    domain: document.location.hostname,
    style: "old"
  };
  BGcall('get_content_script_data', opts, function(data) {
    // Stops all content script activity that we have started.
    function abort() {
      document.removeEventListener("beforeload", beforeLoadHandler, true);
      addResourceToList = function() { };
      delete LOADED_TOO_FAST;
      delete GLOBAL_collect_resources;
    }

    if (data.abort) { // We're using the webRequest API in Chrome.
      abort();
      return;
    }
    if (!SAFARI && !isRockMelt) {
      // Chrome 16 users still need this. Until we remove support for them,
      // at least give them some blocking. Startup ads will slip through, but
      // if they report it so we can say 'Update to v17+'.
      document.addEventListener("beforeload", beforeLoadHandler, true);
    }

    // Store the data for adblock.js
    // If adblock.js already installed its code, run it after we're done.
    window.setTimeout(function() { 
      GLOBAL_contentScriptData.data = data;
      GLOBAL_contentScriptData.run_after_data_is_set(); 
    }, 0);

    if (data.settings.debug_logging)
      log = function() { 
        if (VERBOSE_DEBUG || arguments[0] != '[DEBUG]')
          console.log.apply(console, arguments); 
      };

    if (data.page_is_whitelisted || data.adblock_is_paused) {
      abort();
      return;
    }

    // Safari users and Chrome users without the option to show advanced options
    // and subframes are not able to open resourceblock for the list of resources    
    if (!data.settings.show_advanced_options || window != window.top || SAFARI) {
      addResourceToList = function() {};
      delete GLOBAL_collect_resources;
    }

    if (data.selectors.length != 0)
      block_list_via_css(data.selectors);

    //Chrome can't block resources immediately. Therefore all resources
    //are cached first. Once the filters are loaded, simply remove them
    if (!SAFARI) {

      // Simplified FilterSet object that relies on all input filter texts being
      // definitely applicable to the current domain.
      function FakeFilterSet(serializedFilters) {
        var filters = [];
        for (var i = 0; i < serializedFilters.length; i++) {
          filters.push(PatternFilter.fromData(serializedFilters[i]));
        }
        this.filters = filters;
      };
      FakeFilterSet.prototype = {
        matches: function(url, loweredUrl, elementType, frameDomain, isThirdParty) {
          var f = this.filters, len = f.length;
          for (var i = 0; i < len; i++) {
            if (f[i].matches(url, loweredUrl, elementType, isThirdParty))
              return f[i];
          }
          return null;
        }
      }

      _local_block_filterset = new BlockingFilterSet(
        new FakeFilterSet(data.patternSerialized),
        new FakeFilterSet(data.whitelistSerialized)
      );

      for (var i=0; i < LOADED_TOO_FAST.length; i++)
        beforeLoadHandler(LOADED_TOO_FAST[i].data);
      delete LOADED_TOO_FAST;
    }

    if (data.settings.debug_logging) {
      onReady(function() { debug_print_selector_matches(data.selectors, "old"); });
    }

    // Run site-specific code to fix some errors, but only if the site has them
    if (typeof run_bandaids == "function")
      onReady(function() { run_bandaids("old"); });
  });
}

// Safari loads adblock on about:blank pages, which is a waste of RAM and cycles.
// If document.documentElement instanceof HTMLElement is false, we're not on an HTML page
// if document.documentElement doesn't exist, we're in Chrome 18
if (document.location != 'about:blank' && (!document.documentElement || document.documentElement instanceof HTMLElement)) {
  adblock_begin();
}
