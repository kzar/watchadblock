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

function adblock_begin_part_2() {
  var data = GLOBAL_contentScriptData.data;
  delete GLOBAL_contentScriptData;

  if (data.adblock_is_paused)
    return;

  if (data.settings.show_advanced_options && !SAFARI && window == window.top) {
    // To open the list with the resources, even if whitelisted
    chrome.extension.onRequest.addListener(function(request) {
      if (request != "open_resourcelist")
        return;
      var resources = {};
      if (typeof GLOBAL_collect_resources != "undefined") 
        resources = Object.keys(GLOBAL_collect_resources);
      BGcall("show_resourceblocker", resources);
    });
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

  // Run site-specific code to fix some errors, but only if the site has them
  if (typeof run_bandaids == "function")
    run_bandaids(data.settings);

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
  if (GLOBAL_contentScriptData.data)
    adblock_begin_part_2();
  else
    GLOBAL_contentScriptData.run_after_data_is_set = adblock_begin_part_2;
    
  // Subscribe to the list when you click an abp: link
  $('[href^="abp:"], [href^="ABP:"]').click(function(event) {
    event.preventDefault();
    var searchquery = $(this).attr("href").replace(/^.+?\?/, '');
    if (searchquery)
      BGcall('subscribe_popup', searchquery);
  });
}