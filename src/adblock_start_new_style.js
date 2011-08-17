// Elements that, if blocked, should be removed from the page.
var mightRemove = {
  // Add an element that we'll later decide to remove from the page (or not).
  // Inputs: elType:ElementType of el: an element. 
  //         url: the full URL of the resource el wants to load.
  add: function(elType, el, url) {
    var key = elType + " " + url;
    if (mightRemove[key] == undefined)
      mightRemove[key] = [ el ];
    else
      mightRemove[key].push(el);
  },
  // If the element matching url+elType was blocked, remove from the page.
  // Inputs: elType:ElementType.  url: as in .add().  blocked:bool.
  process: function(elType, url, blocked) {
    var key = elType + " " + url;
    if (mightRemove[key]) {
      if (blocked)
        mightRemove[key].forEach(function(el) { destroyElement(el, elType); });
      delete mightRemove[key];
    }
  }
};

// Record each element that loads a resource, in case it must be destroyed
function trackElements(event) {
  // TODO: needs ElementTypes.forNodeName
  var elType = ElementTypes.forNodeName(event.target.nodeName);
  if (elType & (ElementTypes.image | ElementTypes.subdocument | ElementTypes.object))
    mightRemove.add(elType, event.target, event.url);
};

// Destroy elements when we learn they are blocked
function blockResultsHandler(request, sender, sendResponse) {
  // TODO: needs code in background.html
  if (request.command == 'block-result')
    mightRemove.process(request.elType, request.url, request.blocked);
}

document.addEventListener("beforeload", trackElements, true);
chrome.extension.onRequest.addListener(blockResultsHandler);

function adblock_begin_new_style() {
  var opts = { 
    domain: document.location.hostname,
    style: "new"
  };
  BGcall('get_content_script_data', opts, function(data) {
    if (data.abort || data.page_is_whitelisted || data.adblock_is_paused) {
      // Our services aren't needed.  Stop all content script activity.
      document.removeEventListener("beforeload", trackElements, true);
      chrome.extension.onRequest.removeListener(blockResultsHandler);
      delete mightRemove;
      return;
    }

    if (data.settings.debug_logging)
      log = function(text) { console.log(text); };

    if (data.selectors.length != 0)
      block_list_via_css(data.selectors);

    if (data.settings.debug_logging) {
      $(function() { 
        debug_print_selector_matches(data.selectors);
      });
    }
  });
}


// Safari loads adblock on about:blank pages, which is a waste of RAM and cycles.
// If $ (jquery) is undefined, we're on a xml or svg page and can't run
if (document.location != 'about:blank' && typeof $ != "undefined") {
  adblock_begin_new_style();
}
