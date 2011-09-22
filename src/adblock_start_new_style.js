// Elements that, if blocked, should be removed from the page.
var mightRemove = {
  // Maps key (elType + url) -> { blocked, count_of_times_key_was_sent_early }
  // See issue chromium:97392
  sentEarly: {},

  // Add an element that we'll later decide to remove from the page (or not).
  // Inputs: key: how to find the element when block results arrive
  add: function(key, el) { 
    if (mightRemove[key] == undefined)
      mightRemove[key] = [ el ];
    else
      mightRemove[key].push(el);
  },

  // Record each element that loads a resource, in case it must be destroyed
  trackElement: function(event) {
    if (event.url == 'about:blank')
      return;

    var elType = typeForElement(event.target);
    if (!(elType & (ElementTypes.image | ElementTypes.subdocument | ElementTypes.object)))
      return;

    var key = elType + " " + event.url;
    var early = mightRemove.sentEarly[key];
    if (early) {
      log("Processed early block result:", key, early.blocked);
      early.count -= 1;
      if (early.count == 0) {
        delete mightRemove.sentEarly[key];
        log("Deleted early block result key", key);
      }
      if (early.blocked)
        destroyElement(event.target, elType);
    }
    else {
      mightRemove.add(key, event.target);
    }
  },

  // When the background sends us the block results for some elements, remove
  // the blocked ones.
  // Inputs:
  //   request: { results: array of [elType, url, blocked:bool] triples }
  blockResultsHandler: function(request, sender, sendResponse) {
    if (request.command != 'block-results')
      return;
    var myFrame = document.location.href.replace(/#.*$/, "");
    if (request.frameUrl != myFrame) {
      log("My frame is", myFrame, "so I'm ignoring block results for", request.frameUrl);
      return;
    }
    for (var i = 0; i < request.results.length; i++) {
      var result = request.results[i];
      var elType = result[0], url = result[1], blocked = result[2];
      var key = elType + " " + url;
      if (mightRemove[key]) {
        log("Got block result", blocked, "for", key);
        if (blocked)
          mightRemove[key].forEach(function(el) { destroyElement(el, elType); });
        delete mightRemove[key];
      }
      else {
        // See issue chromium:97392
        log("Received early block result:", key, blocked);
        if (mightRemove.sentEarly[key] == undefined)
          mightRemove.sentEarly[key] = { blocked: blocked, count: 0};
        mightRemove.sentEarly[key].count += 1;
      }

    }
    sendResponse({});
  },
};


function adblock_begin_new_style() {
  document.addEventListener("beforeload", mightRemove.trackElement, true);
  chrome.extension.onRequest.addListener(mightRemove.blockResultsHandler);

  var opts = { 
    domain: document.location.hostname,
    style: "new"
  };
  BGcall('get_content_script_data', opts, function(data) {
    if (data.abort || data.page_is_whitelisted || data.adblock_is_paused) {
      // Our services aren't needed.  Stop all content script activity.
      document.removeEventListener("beforeload", mightRemove.trackElement, true);
      chrome.extension.onRequest.removeListener(mightRemove.blockResultsHandler);
      delete mightRemove;
      return;
    }

    if (data.settings.debug_logging)
      log = function() { console.log.apply(console, arguments); };

    if (data.selectors.length != 0)
      block_list_via_css(data.selectors);

    if (data.settings.debug_logging) {
      $(function() { 
        debug_print_selector_matches(data.selectors);
      });
    }

    // Run site-specific code to fix some errors, but only if the site has them
    if (typeof run_bandaids == "function")
      $(function() { run_bandaids("new"); });
  });
}


// Safari loads adblock on about:blank pages, which is a waste of RAM and cycles.
// If $ (jquery) is undefined, we're on a xml or svg page and can't run
if (document.location != 'about:blank' && typeof $ != "undefined") {
  adblock_begin_new_style();
}
