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
    log("[DEBUG] Whitelisted frame:", document.location.href);
    return;
  }

  log("[DEBUG] Tracking frame:", document.location.href);

  if (SAFARI) {
    // Add entries to right click menu.  Unlike Chrome, we can make
    // the menu items only appear on non-whitelisted pages.
    window.addEventListener("contextmenu", function(event) {
      safari.self.tab.setContextMenuEventUserInfo(event, true);
    }, false);
  }

  //Neither Chrome nor Safari blocks background images. So remove them
  //TODO: Remove background images for elements other than <body>
  var bgImage = $("body").css('background-image') || "";
  var match = bgImage.match(/^url\((.*)\)$/);
  if (match)
    bgImage = match[1];
  if (bgImage && bgImage != "none") {
    if (!SAFARI) {
      var fakeEvent = {
        target: document.body,
        url: bgImage,
        mustBePurged: true,
        preventDefault: function(){},
        type: "beforeload"
      };
      beforeLoadHandler(fakeEvent);
    } else {
      var hiddenImage = $("<img>").
        attr("src", bgImage).
        attr("width", "0").
        attr("height", "0").
        css("display", "none !important").
        css("visibility", "hidden !important");
      $(document.body).append(hiddenImage);
      window.setTimeout(function() {
        if ($(hiddenImage).css("opacity") == 0)
          $(document.body).css("background-image", "none !important");
        $(hiddenImage).remove();
      }, 1);
    }
  }

}

// If $ (jquery) is undefined, we're on a xml or svg page and can't run
if (window.location != 'about:blank' && typeof $ != "undefined") {
  if (GLOBAL_contentScriptData.data)
    adblock_begin_part_2();
  else
    GLOBAL_contentScriptData.run_after_data_is_set = adblock_begin_part_2;
}
