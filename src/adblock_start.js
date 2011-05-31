// Store the data that content scripts need
// This variable is deleted in adblock.js
// run_after_data_is_set can contain a function to run after the data was set,
// (only likely function: adblock_begin_part_2() from adblock.js)
GLOBAL_contentScriptData = {
  data: undefined,
  run_after_data_is_set: function() {},
}

// If url is relative, convert to absolute.
function relativeToAbsoluteUrl(url) {
    // Author: Tom Joseph of AdThwart

    if (!url)
      return url;

    // If URL is already absolute, don't mess with it
    if (/^[a-z\-]+\:\/\//.test(url))
      return url;

    if (url[0] == '/') {
      // Leading // means only the protocol is missing
      if (url[1] && url[1] == "/")
        return document.location.protocol + url;

      // Leading / means absolute path
      return document.location.protocol + "//" + document.location.host + url;
    }

    // Remove filename and add relative URL to it
    var base = document.baseURI.match(/.+\//);
    if (!base) 
      return document.baseURI + "/" + url;
    return base[0] + url;
}

// Return the ElementType element type of the given element.
function typeForElement(el) {
  // TODO: handle background images that aren't just the BODY.
  switch (el.nodeName.toUpperCase()) {
    case 'INPUT': 
    case 'IMG': return ElementTypes.image;
    case 'SCRIPT': return ElementTypes.script;
    case 'OBJECT': 
    case 'EMBED': return ElementTypes.object;
    case 'VIDEO': 
    case 'AUDIO': 
    case 'SOURCE': return ElementTypes.media;
    case 'FRAME': 
    case 'IFRAME': return ElementTypes.subdocument;
    case 'LINK': return ElementTypes.stylesheet;
    case 'BODY': return ElementTypes.background;
    default: return ElementTypes.NONE;
  }
}

// Browser-agnostic canLoad function.
// Returns false if data.url, data.elType, and data.pageDomain together
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

    var isMatched = data.url && _local_block_filterset.matches(data.url, data.elType, data.pageDomain);
    if (isMatched && event.mustBePurged)
      log("Purging if possible " + data.url);
    else if (isMatched)
      log("CHROME TRUE BLOCK " + data.url);
    return !isMatched;
  }
}

//Do not make the frame display a white area
//Not calling .remove(); as this causes some sites to reload continuesly
function removeFrame(el) {
  var parentEl = $(el).parent();
  var cols = (parentEl.attr('cols').indexOf(',') > 0);
  if (!cols && parentEl.attr('rows').indexOf(',') <= 0)
    return;
  cols = (cols ? 'cols' : 'rows');
  // Convert e.g. '40,20,10,10,10,10' into '40,20,10,0,10,10'
  var sizes = parentEl.attr(cols).split(',');
  sizes[$(el).prevAll().length] = 0;
  parentEl.attr(cols, sizes.join(','));
}

beforeLoadHandler = function(event) {
  var el = event.target;
  // Cancel the load if canLoad is false.
  var elType = typeForElement(el);
  var data = { 
    url: relativeToAbsoluteUrl(event.url),
    elType: elType,
    pageDomain: document.location.hostname
  };
  addResourceToList(elType + ':|:' + data.url);
  if (false == browser_canLoad(event, data)) {
    event.preventDefault();
    if (el.nodeName == "FRAME")
      removeFrame(el);
    else if (elType & ElementTypes.background)
      $(el).css("background-image", "none !important");
    else if (!(elType & (ElementTypes.script | ElementTypes.stylesheet)))
      removeAdRemains(el, event);
  }
}

// Return the CSS text that will hide elements matching the given 
// array of selectors.
function css_hide_for_selectors(selectors) {
  var result = [];
  var GROUPSIZE = 1000; // Hide in smallish groups to isolate bad selectors
  for (var i = 0; i < selectors.length; i += GROUPSIZE) {
    var line = selectors.slice(i, i + GROUPSIZE);
    var rule = " { visibility:hidden !important; display:none !important; }";
    result.push(line.join(',') + rule);
  }
  return result.join(' ');
}

// Add style rules hiding the given list of selectors.
function block_list_via_css(selectors) {
  var d = document.documentElement;
  var css_chunk = document.createElement("style");
  css_chunk.type = "text/css";
  css_chunk.innerText = "/*This block of style rules is inserted by AdBlock*/" 
                        + css_hide_for_selectors(selectors);
  d.insertBefore(css_chunk, null);
}

// As long as the new way to get rid of ads is optional, we have to keep it
// in this optional function. When the option is the default, put this back in 
// the beforeloadHandler
removeAdRemains = function(el, event) {
  if (!removeAdRemains.hide) {
    $(el).remove()
    return;
  }
  if (event.mustBePurged) {
    var replacement = document.createElement(el.nodeName);
    if (el.id) replacement.id = el.id;
    if (el.className) replacement.className = el.className;
    if (el.name) replacement.name = el.name;
    replacement.setAttribute("style", "display: none !important; visibility: hidden !important; opacity: 0 !important");
    $(el).replaceWith(replacement);
  } else {
    // There probably won't be many sites that modify all of these.
    // However, if we get issues, we might get to setting the location
    // (css: position, left, top), and/or the width/height (el.width = 0)
    // The latter will maybe even work when the page uses element.style = "";
    $(el).css({
      "display": "none !important",
      "visibility": "hidden !important",
      "opacity": "0 !important",
    });
  }
}

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
  matches: function(url, loweredUrl, elementType, pageDomain, isThirdParty) {
    var f = this.filters, len = f.length;
    for (var i = 0; i < len; i++) {
      if (f[i].matches(url, loweredUrl, elementType, isThirdParty))
        return f[i];
    }
    return null;
  }
}

function adblock_begin() {
  if (!SAFARI)
    LOADED_TOO_FAST = [];
  GLOBAL_collect_resources = {};
  addResourceToList = function(resource) {
    GLOBAL_collect_resources[resource] = null;
  }
  document.addEventListener("beforeload", beforeLoadHandler, true);

  var opts = { 
    domain: document.location.hostname
  };
  BGcall('get_content_script_data', opts, function(data) {
    // Store the data for adblock.js
    // If adblock.js already installed its code, run it after we're done.
    window.setTimeout(function() { 
      GLOBAL_contentScriptData.data = data;
      GLOBAL_contentScriptData.run_after_data_is_set(); 
    }, 0);

    if (data.settings.debug_logging)
      log = function(text) { console.log(text); };

    if (data.page_is_whitelisted || data.adblock_is_paused) {
      document.removeEventListener("beforeload", beforeLoadHandler, true);
      delete LOADED_TOO_FAST;
      delete GLOBAL_collect_resources;
      return;
    }

    // Safari users and Chrome users without the option to show advanced options
    // and subframes are not able to open resourceblock for the list of resources    
    if (!data.settings.show_advanced_options || window != window.top || SAFARI) {
      addResourceToList = function() {};
      delete GLOBAL_collect_resources;
    }

    if (data.settings.hide_instead_of_remove)
      removeAdRemains.hide = true;

    if (data.selectors.length != 0)
      block_list_via_css(data.selectors);

    //Chrome can't block resources immediately. Therefore all resources
    //are cached first. Once the filters are loaded, simply remove them
    if (!SAFARI) {
      // TODO speed: is there a faster way to do this?  e.g. send over a jsonified PatternFilter rather
      // than the pattern text to reparse?  we should time those.  jsonified filter takes way more space
      // but is much quicker to reparse.
      _local_block_filterset = new BlockingFilterSet(
        new FakeFilterSet(data.patternSerialized),
        new FakeFilterSet(data.whitelistSerialized)
      );

      for (var i=0; i < LOADED_TOO_FAST.length; i++)
        beforeLoadHandler(LOADED_TOO_FAST[i].data);
      delete LOADED_TOO_FAST;
    }
  });
}

// Safari loads adblock on about:blank pages, which is a waste of RAM and cycles.
// until crbug.com/63397 is fixed, ignore SVG images
if (document.location != 'about:blank' && !/\.svg$/.test(document.location.href))
  adblock_begin();
