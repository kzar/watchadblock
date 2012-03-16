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
    case 'LINK': 
      // favicons are reported as 'other' by onBeforeRequest.
      // if this is changed, we should update this too.
      if (/(^|\s)icon($|\s)/i.test(el.rel))
        return ElementTypes.other;
      return ElementTypes.stylesheet;
    case 'BODY': return ElementTypes.background;
    default: return ElementTypes.NONE;
  }
}

// If url is relative, convert to absolute.
function relativeToAbsoluteUrl(url) {
  // Author: Tom Joseph of AdThwart

  if (!url)
    return url;

  // If URL is already absolute, don't mess with it
  if (/^[a-zA-Z\-]+\:/.test(url))
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

//Do not make the frame display a white area
//Not calling .remove(); as this causes some sites to reload continuesly
function removeFrame(el) {
  var parentEl = el.parentNode;
  var cols = ((parentEl.getAttribute('cols') || "").indexOf(',') > 0);
  if (!cols && (parentEl.getAttribute('rows') || "").indexOf(',') <= 0)
    return;
  // Figure out which column or row to hide
  var index = 0;
  while (el.previousElementSibling) {
    index++;
    el = el.previousElementSibling;
  }
  // Convert e.g. '40,20,10,10,10,10' into '40,20,10,0,10,10'
  var attr = (cols ? 'cols' : 'rows');
  var sizes = parentEl.getAttribute(attr).split(',');
  sizes[index] = "0";
  parentEl.setAttribute(attr, sizes.join(','));
}

// Remove an element from the page.
function destroyElement(el, elType) {
  if (el.nodeName == "FRAME") {
    removeFrame(el);
  }
  else if (elType != ElementTypes.script) {
    // There probably won't be many sites that modify all of these.
    // However, if we get issues, we might have to set the location and size
    // via the css properties position, left, top, width and height
    el.style.setProperty("display", "none", "important");
    el.style.setProperty("visibility", "hidden", "important");
    el.style.setProperty("opacity", "0", "important");
    el.setAttribute("width", 0);
    el.setAttribute("height", 0);
  }
}

// Add style rules hiding the given list of selectors.
function block_list_via_css(selectors) {
  var d = document.head || document.documentElement;
  if (!d) {
    // See http://crbug.com/109272
    // in Chrome 18: document.documentElement is null on document_start
    window.setTimeout(function() {
      block_list_via_css(selectors);
    }, 0);
    return;
  }

  // Issue 6480: inserting a <style> tag too quickly made it be ignored.
  // Use ABP's approach: a <link> tag that we can check for .sheet.
  var css_chunk = document.createElement("link");
  css_chunk.type = "text/css";
  css_chunk.rel = "stylesheet";
  css_chunk.href = "data:text/css,";
  d.insertBefore(css_chunk, null);

  function fill_in_css_chunk() {
    if (!css_chunk.sheet) {
      window.setTimeout(fill_in_css_chunk, 0);
      return;
    }
    var GROUPSIZE = 1000; // Hide in smallish groups to isolate bad selectors
    for (var i = 0; i < selectors.length; i += GROUPSIZE) {
      var line = selectors.slice(i, i + GROUPSIZE);
      // picreplacement
      var rule = line.join(",") + " { display:none !important; orphans: 4321 !important; }";
      css_chunk.sheet.insertRule(rule);
    }
  }
  fill_in_css_chunk();
}

function debug_print_selector_matches(selectors, style) {
  selectors.
    filter(function(selector) { return document.querySelector(selector); }).
    forEach(function(selector) {
      var matches = "";
      var elems = document.querySelectorAll(selector);
      for (var i=0; i<elems.length; i++) {
        var el = elems[i];
        matches += "        " + el.nodeName + "#" + el.id + "." + el.className + "\n";
      }
      if (style == 'old') {
        log("Debug: CSS '" + selector + "' hid:");
        console.log(matches);
        addResourceToList('HIDE:|:' + selector);
      }
      else
        BGcall("debug_report_elemhide", selector, matches);
    });
}

// Safari loads adblock on about:blank pages, which is a waste of RAM and cycles.
// If document.documentElement instanceof HTMLElement is false, we're not on a html page and can't run
// if document.documentElement doesn't exist, we're in Chrome 18
if (document.location != 'about:blank' && (!document.documentElement || document.documentElement instanceof HTMLElement)) {
  onReady(function() {
    // Subscribe to the list when you click an abp: link
    var elems = document.querySelectorAll('[href^="abp:"], [href^="ABP:"]');
    var abplinkhandler = function(event) {
      event.preventDefault();
      var searchquery = this.href.replace(/^.+?\?/, '');
      if (searchquery)
        window.open(chrome.extension.getURL('pages/subscribe.html?' +
                    searchquery), "_blank",
                    'scrollbars=0,location=0,resizable=0,width=450,height=140');
    };
    for (var i=0; i<elems.length; i++) {
      elems[i].addEventListener("click", abplinkhandler, false);
    }
  });
}
