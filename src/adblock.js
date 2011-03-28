function debug_print_selector_matches(selectors) {
  selectors.
    filter(function(selector) { return $(selector).length > 0; }).
    forEach(function(selector) {
      log("Debug: CSS '" + selector + "' hid:");
      if (!SAFARI)
        GLOBAL_collect_resources['HIDE:' + selector] = null;
      $(selector).each(function(i, el) {
        log("       " + el.nodeName + "#" + el.id + "." + el.className);
      });
    });
}

function adblock_begin_part_2(data) {
  console.warn("If you see this first, adblock.js was late.");
  if (data.adblock_is_paused) {
    return;
  }

  if (data.page_is_whitelisted) {
    log("==== EXCLUDED PAGE: " + document.location.href);
    return;
  }

  log("==== ADBLOCKING PAGE: " + document.location.href);

  if (SAFARI) {
    // Add entries to right click menu.  Unlike Chrome, we can make
    // the menu items only appear on non-whitelisted pages.
    window.addEventListener("contextmenu", function(event) {
      safari.self.tab.setContextMenuEventUserInfo(event, true);
    }, false);
  }

  //Neither Chrome nor Safari blocks background images. So remove them
  //TODO: Remove background images for elements other than <body>
  var bgImage = $("body").css('background-image');
  var match = bgImage.match(/^url\((.*)\)$/);
  if (match)
    bgImage = match[1];
  if (bgImage && bgImage != "none") {
    var fakeEvent = {
      target: $("body")[0],
      url: bgImage,
      mustBePurged: true,
      preventDefault: function(){},
      type: "beforeload"
    };
    beforeLoadHandler(fakeEvent);
  }

  if (data.settings.debug_logging)
    debug_print_selector_matches(data.selectors);
}

// until crbug.com/63397 is fixed, ignore SVG images
if (window.location != 'about:blank' && !/\.svg$/.test(document.location.href)) {

  GLOBAL_contentScriptData.onReady(adblock_begin_part_2);
  console.warn("If you see this first, adblock.js was early.");

  //subscribe to the list when you click an abp: link
  $('[href^="abp:"], [href^="ABP:"]').click(function(event) {
    event.preventDefault();
    var searchquery = $(this).attr("href").replace(/^.+?\?/, '');
    if (searchquery)
      BGcall('subscribe_popup', searchquery);
  });
}
