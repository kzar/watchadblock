GLOBAL_contentScriptData = (function() {
  // The data
  var _data = undefined;
  // How many times will onReady be called?
  var _uses_left = 2;
  // Holds onReady callers before setData() is called
  var _callbacks = [];
  var _notify_callback = function(callback) {
    console.warn("" + _uses_left + " callbacks left.  Notifying one.");
    callback(_data);
    _uses_left -= 1;
    if (_uses_left == 0) {
      console.warn("All callbacks called; deleting content script data");
      delete _data;
    }
  }
  return {
    // When the data is set, we notify interested parties asynchronously.
    setData: function(value) { 
      _data = value;
      for (var i = 0; i < _callbacks.length; i++) {
        window.setTimeout(function() { _notify_callback(_callbacks[i]) }, 0);
      }
    },
    // Takes a function(data) to call when data is available (maybe immediately)
    onReady: function(callback) {
      if (_data)
        _notify_callback(callback);
      else
        _callbacks.push(callback);
    }
  };
})();

// If url is relative, convert to absolute.
function relativeToAbsoluteUrl(url) {
    // Author: Tom Joseph of AdThwart
    
    if(!url)
        return url;
    // If URL is already absolute, don't mess with it
    if(/^[a-z\-]+\:\/\//.test(url))
        return url;
    // Leading / means absolute path
    if(url[0] == '/')
        return document.location.protocol + "//" + document.location.host + url;

    // Remove filename and add relative URL to it
    var base = document.baseURI.match(/.+\//);
    if(!base) return document.baseURI + "/" + url;
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

    var isMatched = data.url && _local_block_filterset.matches(data.url, data.elType, document.domain);
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
    pageDomain: document.domain
  };
  if (!SAFARI)
    GLOBAL_collect_resources[elType + ':|:' + data.url] = null;
  if (false == browser_canLoad(event, data)) {
    event.preventDefault();
    if (el.nodeName == "FRAME")
      removeFrame(el);
    else if (elType & ElementTypes.background)
      $(el).css("background-image", "none !important");
    else if (!(elType & (ElementTypes.script | ElementTypes.stylesheet)))
      $(el).remove();
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

function adblock_begin() {
  if (!SAFARI) {
    GLOBAL_collect_resources = {};
    LOADED_TOO_FAST = [];
  }
  document.addEventListener("beforeload", beforeLoadHandler, true);

  var opts = { 
    domain: document.domain, 
    include_filters: true
  };
  BGcall('get_content_script_data', opts, function(data) {
    GLOBAL_contentScriptData.setData(data);

    if (data.settings.debug_logging)
      log = function(text) { console.log(text); };

    if (data.page_is_whitelisted || data.adblock_is_paused) {
      document.removeEventListener("beforeload", beforeLoadHandler, true);
      delete LOADED_TOO_FAST;
      delete GLOBAL_collect_resources;
      return;
    }

    if (data.selectors)
      block_list_via_css(data.selectors);

    //Chrome can't block resources immediately. Therefore all resources
    //are cached first. Once the filters are loaded, simply remove them
    if (!SAFARI) {
      // TODO speed: is there a faster way to do this?  e.g. send over a jsonified PatternFilter rather
      // than the pattern text to reparse?  we should time those.  jsonified filter takes way more space
      // but is much quicker to reparse.
      _local_block_filterset = FilterSet.fromText(data.block, undefined, false);

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
