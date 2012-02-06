// We track two events:
//   A: beforeload -- an element has loaded which we should remove if blocked
//   B: block-results -- sent by onBeforeRequest telling us which URLs
//      were blocked and which were not.
//
// Because they can come in any order, and multiple As can come in for one B,
// and multiple identical Bs may come in for different groups of As, we must
// do the following:
//
//   When A arrives, store the element.  If we have both A and B, process them.
//   When B arrives, store the verdict.  If we have both A and B, process them.
//   function processMatch:
//       Unstore all A elements and one B verdict.
//       If verdict is 'blocked', remove the A elements from the DOM.
//
//   Running processMatch is actually deferred, so that if 5 As come after 1 B,
//   the first A gives the other 4 As a chance to store their elements before
//   processing their matching B.
//
// See issue chromium:97392 for more details.

var elementTracker = {
  onBeforeload: function(event) {
    if (event.url == 'about:blank')
      return;

    var elType = typeForElement(event.target);
    if (!(elType & (ElementTypes.image | ElementTypes.subdocument | ElementTypes.object)))
      return;

    elementTracker._store(elType, event.url, 'elements', event.target);
  },

  onBlockResults: function(request, sender, sendResponse) {
    if (request.command != 'block-results')
      return;

    var myFrame = document.location.href.replace(/#.*$/, "");
    if (request.frameUrl != myFrame) {
      log('[DEBUG]', "My frame is", myFrame, "so I'm ignoring block results for", request.frameUrl);
      return;
    }

    for (var i = 0; i < request.results.length; i++) {
      var result = request.results[i];
      var elType = result[0], url = result[1], blocked = result[2];
      elementTracker._store(elType, url, 'verdicts', blocked);
    }
    sendResponse({});
  },

  _store: function(elType, url, targetList, value) {
    var key = elType + " " + url;
    if (!elementTracker[key])
      elementTracker[key] = { elements: [], verdicts: [], elType: elType };
    var data = elementTracker[key];
    data[targetList].push(value);
    log("[DEBUG]", (targetList == 'elements' ? value.nodeName:value) + " is", targetList, "#", data[targetList].length, "for key", key.substring(0, 80));

    if (data.elements.length == 0 || data.verdicts.length == 0 || data.starting)
      return;

    // we have enough data to act (see above for why it's deferred)
    data.starting = true;
    window.setTimeout(function() {
      data.starting = false;
      elementTracker._processMatch(key);
    }, 0);
  },

  _processMatch: function(key) {
    var data = elementTracker[key];
    if (!data || data.verdicts.length == 0) {
      log("This shouldn't happen", data && data.verdicts);
      return; // shouldn't happen
    }

    var shouldBlock = data.verdicts[0];
    log("[DEBUG]", data.elements.length, shouldBlock?"elements will be REMOVED.":"elements are harmless.", key);
    if (shouldBlock)
      data.elements.forEach(function(el) { destroyElement(el, data.elType); });
    data.elements = [];
    data.verdicts.pop();
    if (data.verdicts.length == 0)
      delete elementTracker[key];
  }
};

function adblock_begin_new_style() {
  document.addEventListener("beforeload", elementTracker.onBeforeload, true);
  chrome.extension.onRequest.addListener(elementTracker.onBlockResults);

  var opts = { 
    domain: document.location.hostname,
    style: "new"
  };
  BGcall('get_content_script_data', opts, function(data) {
    if (data.abort || data.page_is_whitelisted || data.adblock_is_paused) {
      // Our services aren't needed.  Stop all content script activity.
      document.removeEventListener("beforeload", elementTracker.onBeforeload, true);
      chrome.extension.onRequest.removeListener(elementTracker.onBlockResults);
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
