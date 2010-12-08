// If url is relative, convert to absolute.
function relativeToAbsoluteUrl(url) {
    // Author: Tom Joseph of AdThwart
    
    if(!url)
        return url;
    // If URL is already absolute, don't mess with it
    if(/^http/.test(url))
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
    if (typeof _limited_to_domain == "undefined") {
      if (!(data.elType & ElementTypes.script)) {
        event.mustBePurged = true;
        LOADED_TOO_FAST.push({data:event});
      }
      return true;
    }

    // every time browser_canLoad is called on this page, the pageDomain will
    // be the same -- so we can just check _limited_to_domain which we
    // calculated once.  This takes less memory than storing local_filterset
    // on the page.
    var isMatched = data.url && _limited_to_domain.matches(data.url, data.elType);
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
  var sizes = parentEl.attr(cols).split(',');
  sizes[$(el).prevUntil(parentEl).length] = 0;
  parentEl.attr(cols, sizes.join(','));
}

beforeLoadHandler = function(event) {
  var el = event.target;
  // Cancel the load if canLoad is false.
  var elType = typeForElement(el);
  var data = { 
    url: relativeToAbsoluteUrl(event.url),
    elType: elType,
    pageDomain: document.domain, 
    isTopFrame: (window == window.top) 
  };
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
  if (!SAFARI)
    LOADED_TOO_FAST = [];

  document.addEventListener("beforeload", beforeLoadHandler, true);

  var opts = { 
    domain: document.domain, 
    from_adblock_start: true,
    is_top_frame: (window == window.top)
  };
  extension_call('get_content_script_data', opts, function(data) {
    if (data.features.debug_logging.is_enabled) {
      DEBUG = true;
      log = function(text) { console.log(text); };
    }

    if (data.page_is_whitelisted || data.adblock_is_paused) {
      document.removeEventListener("beforeload", beforeLoadHandler, true);
      delete LOADED_TOO_FAST;
      return;
    }

    // TEMP: until we know how to use insertCSS properly in Chrome,
    // Chrome needs to manually block CSS just like Safari.
    // if (SAFARI) // Chrome does this in background.html
    block_list_via_css(data.selectors);

    //Chrome can't block resources immediately. Therefore all resources
    //are cached first. Once the filters are loaded, simply remove them
    if (!SAFARI) {
      var local_filterset = FilterSet.fromText(data.filtertext);
      _limited_to_domain = local_filterset.limitedToDomain(document.domain);

      // We don't need these locally, so delete them to save memory.
      delete _limited_to_domain._selectorFilters;
      delete _limited_to_domain._domainLimitedCache;

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
