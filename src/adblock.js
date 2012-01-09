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

  //Neither Chrome nor Safari blocks background images. So remove them
  //TODO: Remove background images for elements other than <body>
  var bgImage = window.getComputedStyle(document.body)["background-image"] || "";
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
      var hiddenImage = document.createElement("img");
        hiddenImage.src = bgImage;
        hiddenImage.width = 0;
        hiddenImage.height = 0;
        hiddenImage.style.display = "none !important";
        hiddenImage.style.visibility = "hidden !important";
      document.body.insertBefore(hiddenImage, null);
      window.setTimeout(function() {
        if (hiddenImage.style.opacity === 0) {
          document.body.style["background-image"] = "none !important";
        }
        document.body.removeChild(hiddenImage);
      }, 1);
    }
  }

}

// If document.documentElement instanceof HTMLElement, we're on a HTML/XML page,
// or on a page that Chrome converted to HTML (txt). Fails for svg for example.
if (window.location != 'about:blank' && document.documentElement instanceof HTMLElement) {
  if (GLOBAL_contentScriptData.data)
    adblock_begin_part_2();
  else
    GLOBAL_contentScriptData.run_after_data_is_set = adblock_begin_part_2;
}
