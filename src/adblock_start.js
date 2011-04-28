// Store the data that content scripts need
// This variable is deleted in adblock.js
// run_after_data_is_set can contain a function to run after the data was set,
// (only likely function: adblock_begin_part_2() from adblock.js)
GLOBAL_contentScriptData = {
  data: undefined,
  run_after_data_is_set: function() {},
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

if (!SAFARI) {
  beforeLoadHandler = function(event) {
    var elType = ElementTypes.forNodeName(event.target.nodeName);
    if (elType & (ElementTypes.image | ElementTypes.subdocument | ElementTypes.object))
      mightRemove.add(elType, event.target, event.url);
  };
  chrome.extension.onRequest.addListener(function(request, sender, sendResponse) {
    if (request.command == 'block-result')
      mightRemove.process(request.elType, request.url, request.blocked);
  });
}

if (SAFARI) {
  beforeLoadHandler = function(event) {
    // TODO checking url here because we used to check it in
    // background before running .matches().  Why do we need this?
    if (!event.url)
      return;
    var elType = ElementTypes.forNodeName(event.target.nodeName);
    mightRemove.add(elType, event.target, event.url);
    var result = safari.self.tab.canLoad(event, {
      url: event.url, elType: elType, pageDomain: document.domain
    });
    if (result.blocked)
      event.preventDefault();
    mightRemove.process(result.elType, result.url, result.blocked);
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

    if (data.selectors.length != 0) {
      block_list_via_css(data.selectors);
      if (data.settings.debug_logging) {
        data.selectors.
          filter(function(selector) { return $(selector).length > 0; }).
          forEach(function(selector) {
            log("Debug: CSS '" + selector + "' hid:");
            $(selector).each(function(i, el) {
              log("       " + el.nodeName + "#" + el.id + "." + el.className);
            });
          });
      }
    }
  });
}

// Safari loads adblock on about:blank pages, which is a waste of RAM and cycles.
// until crbug.com/63397 is fixed, ignore SVG images
if (document.location != 'about:blank' && !/\.svg$/.test(document.location.href))
  adblock_begin();
