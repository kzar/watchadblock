// If url is relative, convert to absolute.
function relativeToAbsoluteUrl(url) {
    // Author: Tom Joseph of AdThwart
    
    if(!url)
        return url;
    // If URL is already absolute, don't mess with it
    if(url.match(/^http/))
        return url;
    // Leading / means absolute path
    if(url[0] == '/')
        return document.location.protocol + "//" + document.location.host + url;

    // Remove filename and add relative URL to it
    var base = document.baseURI.match(/.+\//);
    if(!base) return document.baseURI + "/" + url;
    return base[0] + url;
}
// Return the url tied to the given element.  null is OK if we can't find one.
function urlForElement(el, type) {
  // TODO: handle background images, based on 'type'.
  switch (el.nodeName) {
    case 'IMG': return el.src;
    case 'SCRIPT': return el.src;
    case 'EMBED': return el.src;
    case 'IFRAME': return el.src;
    case 'LINK': return el.href;
    case 'OBJECT': 
      var param = $('param[name="movie"][value]', el);
      if (param.length > 0)
        return param.get(0).value;
      else
        return null;
    case 'BODY':
      // TODO: make sure this isn't so slow that we must LBYL
      var bgImage = $(el).css('background-image');
      return (bgImage == "none" ? null: bgImage);
  }
}
// Return the ElementType element type of the given element.
function typeForElement(el) {
  // TODO: handle background images that aren't just the BODY.
  switch (el.nodeName) {
    case 'IMG': return ElementTypes.image;
    case 'SCRIPT': return ElementTypes.script;
    case 'OBJECT': 
    case 'EMBED': return ElementTypes.object;
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
    // The first time this is called we must build our filters.
    if (typeof _local_filterset == "undefined") {
      _local_filterset = FilterSet.fromText(__sourceText);
      delete __sourceText;
    }

    // TODO: copied from background.html from Safari section.
    var limited = _local_filterset.limitedToDomain(data.pageDomain);
    var isMatched = data.url && limited.matches(data.url, data.elType);
    if (isMatched)
      log("CHROME TRUE BLOCK " + data.url);
    return !isMatched;
  }
}

function enableTrueBlocking() {
  document.addEventListener("beforeload", function(event) {
    const el = event.target;
    // Cancel the load if canLoad is false.
    var elType = typeForElement(el);
    var url = relativeToAbsoluteUrl(urlForElement(el, elType));
    if (false == browser_canLoad(event, { url: url, elType: elType, pageDomain: document.domain })) {
      event.preventDefault();
      if (el.nodeName != "BODY") {
        // TODO: temp workaround Safari crashing bug.
        // $(el).remove();
        window.setTimeout(function() {
          $(el).remove();
        }, 0);
      }
    }
  }, true);
}

// Add style rules hiding the given list of selectors.
// If title is specified, apply this title to the style element for later
// identification.
function block_list_via_css(selectors, title) {
  var d = document.documentElement;
  // Setting this small chokes Chrome -- don't do it!  I set it back to
  // 10000 from 100 on 1/10/2010 -- at some point you should just get rid
  // of the while loop if you never use chunking again.
  var chunksize = 10000;
  while (selectors.length > 0) {
    var css_chunk = document.createElement("style");
    if (title)
      css_chunk.title = title;
    css_chunk.type = "text/css";
    css_chunk.innerText += selectors.splice(0, chunksize).join(',') +
                               " { visibility:hidden !important; " +
                               "   display:none !important; }";
    d.insertBefore(css_chunk, null);
  }
}

var opts = { domain: document.domain };
// The top frame should tell the background what domain it's on.  The
// subframes will be told what domain the top is on.
if (window == window.top)
  opts.is_top_frame = true;
    
extension_call('get_features_and_filters', opts, function(data) {
  var start = new Date();
  __sourceText = data.filtertext;

  if (data.features.debug_logging.is_enabled) {
    DEBUG = true;
    log = function(text) { console.log(text); };
  }
  if (data.features.debug_time_logging.is_enabled)
    time_log = function(text) { console.log(text); };

  if (page_is_whitelisted(data.whitelist, data.top_frame_domain))
    return;

  if (SAFARI || data.features.true_blocking_support.is_enabled)
    enableTrueBlocking();

  block_list_via_css(data.selectors);

  var end = new Date();
  time_log("adblock_start run time: " + (end - start) + " || " +
           document.location.href);
});
