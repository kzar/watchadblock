var elementTracker = {
  onBeforeload: function(event) {
    if (event.url == 'about:blank')
      return;

    var elType = typeForElement(event.target);
    if (!(elType & (ElementTypes.image | ElementTypes.subdocument | ElementTypes.object))) {
      if (elementTracker.picreplacement_enabled)
        picreplacement.augmentIfAppropriate({el: event.target});
    }
  },

  onPurgeRequest: function(request, sender, sendResponse) {
    if (request.command != 'purge-elements')
      return;

    if (!elementTracker.picreplacement_enabled && request.picreplacement_enabled)
      document.addEventListener("beforeload", elementTracker.onBeforeload, true);
    elementTracker.picreplacement_enabled = request.picreplacement_enabled;
    var myFrame = document.location.href.replace(/#.*$/, "");
    if (request.frameUrl != myFrame) {
      log('[DEBUG]', "My frame is", myFrame, "so I'm ignoring block results for", request.frameUrl);
      return;
    }

    // TODO remove next line once .blocked is no longer sent and purge-elements
    // is only sent for appropriate types.
    if (request.blocked !== false && (request.elType & (ElementTypes.image | ElementTypes.subdocument | ElementTypes.object)))
      window.setTimeout(function() { elementTracker._purgeElements(request.elType, request.url); }, 0);

    sendResponse({});
  },

  // Remove elements on the page of |elType| that request |url|.
  // Will try again if none are found unless |lastTry|.
  _purgeElements: function(elType, url, lastTry) {
    log("[DEBUG]", "Purging:", lastTry, elType, url);
    var tagdata = this._tagsForElType(elType);
    var srcdata = this._srcsFor(url);

    log("[DEBUG]", tagdata.length, srcdata.length);
    for (var j=0; j < tagdata.length; j++) {
      var tag = tagdata[j];
      for (var k=0; k < srcdata.length; k++) {
        var src = srcdata[k];
        var selector = tag.name + '[' + tag.attr + src.op + '"' + src.text + '"]';
        var results = document.querySelectorAll(selector);
        log("[DEBUG]", results.length, "results for selector:", selector);
        for (var i = 0; i < results.length; i++) {
          // this is weaker than before: img/object/iframe that are not ads but
          // that are within hidden sections will not be picreplaced.
          if (elementTracker.picreplacement_enabled)
            picreplacement.augmentIfAppropriate({el: el, elType: elType, blocked: true});
          destroyElement(results[i], elType);
          // The page probably doesn't express the same ad URL via two different 
          // src strings, so once we find a match it's probably safe to quit looking.
          return;
        }
      }
    }

    // No match; try later.
    if (!lastTry) {
      var that = this;
      setTimeout(function() { that._purgeElements(elType, url, true); }, 2000);
    }
  },

  _tagsForElType: function(elType) {
    var results = [];
    if (elType & ElementTypes.image) {
      results.push({name: "IMG", attr: "src"});
    }
    else if (elType & ElementTypes.subdocument) {
      results.push({name: "IFRAME", attr: "src"});
      results.push({name: "FRAME", attr: "src"});
    }
    else if (elType & ElementTypes.object) {
      results.push({name: "OBJECT", attr: "data"});
      results.push({name: "EMBED", attr: "src"});
    }
    return results;
  },

  // To enable testing
  page_location: document.location,

  // Return a list of { op, text }, where op is a CSS selector operator and
  // text is the text to select in a src attr, in order to match an IMG on this
  // page that could request the given absolute |url|.
  _srcsFor: function(url) {
    url = url.replace(/#.*$/, '');
    var url_parts = parseUri(url);
    var page_parts = this.page_location;
    var results = [];
    // Case 1: absolute (scheme-agnostic)
    results.push({ op:"$=", text: url.match(':(//.*)$')[1] });
    if (url_parts.hostname === page_parts.hostname) {
      // Case 2: The kind that starts with '/'
      results.push({ op:"=", text: url_parts.pathname+url_parts.search });
      // Case 3: Relative URL
      var page_dirs = page_parts.pathname.replace('#.*$', '').split('/');
      var url_dirs = url_parts.pathname.split('/');
      for (var i=0; page_dirs[i] === url_dirs[i] && i < page_dirs.length - 1 && i < url_dirs.length - 1; i++) {
        // i is set to first differing position
      }
      var dir = new Array(page_dirs.length - i).join("/..").substring(1);
      var path = url_dirs.slice(i).join("/") + url_parts.search;
      var src = dir + (dir ? "/" : "") + path;
      results.push({ op:"=", text: src });
    }

    return results;
  }
};

function adblock_begin_new_style() {
  chrome.extension.onRequest.addListener(elementTracker.onPurgeRequest);

  var opts = { 
    domain: document.location.hostname,
    style: "new"
  };
  BGcall('get_content_script_data', opts, function(data) {
    if (data.abort || data.page_is_whitelisted || data.adblock_is_paused) {
      // Our services aren't needed.  Stop all content script activity.
      document.removeEventListener("beforeload", elementTracker.onBeforeload, true);
      chrome.extension.onRequest.removeListener(elementTracker.onPurgeRequest);
      delete elementTracker;
      return;
    }

    if (data.settings.debug_logging)
      log = function() { 
        if (VERBOSE_DEBUG || arguments[0] != '[DEBUG]')
          console.log.apply(console, arguments); 
      };

    if (data.selectors.length != 0)
      block_list_via_css(data.selectors);

    if (data.settings.debug_logging) {
      onReady(function() { debug_print_selector_matches(data.selectors, "new"); });
    }

    // Run site-specific code to fix some errors, but only if the site has them
    if (typeof run_bandaids == "function")
      onReady(function() { run_bandaids("new"); });
  });
}


// Safari loads adblock on about:blank pages, which is a waste of RAM and cycles.
// If document.documentElement instanceof HTMLElement is false, we're not on an HTML page
// if document.documentElement doesn't exist, we're in Chrome 18
if (document.location != 'about:blank' && (!document.documentElement || document.documentElement instanceof HTMLElement)) {
  adblock_begin_new_style();
}
