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

if (!SAFARI) {
  // TODO I hate that I'm storing pointers to all these DOM elements.  Can this
  // be avoided?
  _loaded = {}; // maps urls to DOM elements that should be removed if blocked
  beforeLoadHandler = function(event) {
    var elType = ElementTypes.forNodeName(event.target.nodeName);
    if (!(elType & (ElementTypes.image | ElementTypes.subdocument | ElementTypes.object)))
      return;
    var key = elType + " " + event.url;
    if (_loaded[key] == undefined)
      _loaded[key] = [ event.target ];
    else
      _loaded[key].push(event.target);
  };

  chrome.extension.onRequest.addListener(function(request, sender, sendResponse) {
    if (request.command != 'block-result')
      return;
    var key = request.elType + " " + request.url;
    if (_loaded[key]) {
      if (request.blocked)
        _loaded[key].forEach(function(el) { destroyElement(el, request.elType); });
      delete _loaded[key];
    }
  });

}

if (SAFARI) {
  beforeLoadHandler = function(event) {
    var el = event.target;
    // Cancel the load if canLoad is false.
    var data = { 
      url: relativeToAbsoluteUrl(event.url),
      nodeName: el.nodeName,
      pageDomain: document.domain
    };
    // if (!SAFARI) // TODO move to background
      // GLOBAL_collect_resources[elType + ':|:' + data.url] = null;
    // TODO checking data.url here because we used to check it in
    // background before running .matches().  Why do we need this?
    if (!data.url)
      return;
    var result = safari.self.tab.canLoad(event, data);
    if (result.blockIt) {
      event.preventDefault();
      destroyElement(el, result.elType);
    }
  }
}

// TODO roll all this into removeAdRemains once the hide vs no-hide option
// has disappeared
function destroyElement(el, elType) {
  if (el.nodeName == "FRAME")
    removeFrame(el);
  else if (elType & ElementTypes.background)
    $(el).css("background-image", "none !important");
  else if (!(elType & (ElementTypes.script | ElementTypes.stylesheet)))
    removeAdRemains(el, event);
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
  document.addEventListener("beforeload", beforeLoadHandler, true);

  BGcall('get_content_script_data', document.domain, function(data) {
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
      return;
    }
    
    if (data.settings.hide_instead_of_remove)
      removeAdRemains.hide = true;

    if (data.selectors.length != 0)
      block_list_via_css(data.selectors);
  });
}

// Safari loads adblock on about:blank pages, which is a waste of RAM and cycles.
// until crbug.com/63397 is fixed, ignore SVG images
if (document.location != 'about:blank' && !/\.svg$/.test(document.location.href))
  adblock_begin();
