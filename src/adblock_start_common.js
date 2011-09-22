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
      if (/(^|\s)icon($|\s)/i.test(el.rel))
        return ElementTypes.other;
      return ElementTypes.stylesheet;
    case 'BODY': return ElementTypes.background;
    default: return ElementTypes.NONE;
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

// Remove an element from the page.
function destroyElement(el, elType) {
  if (el.nodeName == "FRAME") {
    removeFrame(el);
  }
  else if (elType != ElementTypes.script) {
    // There probably won't be many sites that modify all of these.
    // However, if we get issues, we might have to set the location and size
    // via the css properties position, left, top, width and height
    $(el).css({
        "display": "none !important",
        "visibility": "hidden !important",
        "opacity": "0 !important",
      }).
      attr("width", "0px").
      attr("height", "0px");
  }
}

// Return the CSS text that will hide elements matching the given 
// array of selectors.
function css_hide_for_selectors(selectors) {
  var result = [];
  var GROUPSIZE = 1000; // Hide in smallish groups to isolate bad selectors
  for (var i = 0; i < selectors.length; i += GROUPSIZE) {
    var line = selectors.slice(i, i + GROUPSIZE);
    var rule = " { display:none !important; }";
    result.push(line.join(',') + rule);
  }
  return result.join(' ');
}

// Add style rules hiding the given list of selectors.
function block_list_via_css(selectors) {
  var d = document.documentElement;
  var css_chunk = document.createElement("style");
  css_chunk.type = "text/css";
  // Handle issue 5643
  css_chunk.style.display = "none !important";
  css_chunk.innerText = "/*This block of style rules is inserted by AdBlock*/" 
                        + css_hide_for_selectors(selectors);
  d.insertBefore(css_chunk, null);
}

function debug_print_selector_matches(selectors) {
  selectors.
    filter(function(selector) { return $(selector).length > 0; }).
    forEach(function(selector) {
      log("Debug: CSS '" + selector + "' hid:");
      addResourceToList('HIDE:' + selector);
      $(selector).each(function(i, el) {
        log("       " + el.nodeName + "#" + el.id + "." + el.className);
      });
    });
}

// Safari loads adblock on about:blank pages, which is a waste of RAM and cycles.
// If $ (jquery) is undefined, we're on a xml or svg page and can't run
if (document.location != 'about:blank' && typeof $ != "undefined") {
  $(function() {
    // Subscribe to the list when you click an abp: link
    $('[href^="abp:"], [href^="ABP:"]').click(function(event) {
      event.preventDefault();
      var searchquery = $(this).attr("href").replace(/^.+?\?/, '');
      if (searchquery)
        window.open(chrome.extension.getURL('pages/subscribe.html?' +
                    searchquery), "_blank",
                    'scrollbars=0,location=0,resizable=0,width=450,height=140');
    });
  });
}
