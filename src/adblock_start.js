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
  if (event.mustBePurged) {
    var replacement = document.createElement(el.nodeName);
    replacement.id = el.id;
    replacement.className = el.className;
    replacement.name = el.name;
    replacement.style = "display: none !important; visibility: hidden !important; opacity: 0 !important";
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
  extension_call('get_content_script_data', opts, function(data) {
    if (data.settings.debug_logging)
      log = function(text) { console.log(text); };

    if (data.page_is_whitelisted || data.adblock_is_paused) {
      document.removeEventListener("beforeload", beforeLoadHandler, true);
      delete LOADED_TOO_FAST;
      delete GLOBAL_collect_resources;
      return;
    }
    
    if (!data.settings.hide_instead_of_remove) {
      // If it isn't enabled, simply call .remove() on it, like we used to do
      removeAdRemains = function(el) {
        $(el).remove();
      }
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
