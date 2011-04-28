
function adblock_begin_part_2() {
  var data = GLOBAL_contentScriptData.data;
  delete GLOBAL_contentScriptData;

  if (data.adblock_is_paused)
    return;

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

  // TODO: To block Safari background images in <body>,
  // do BGcall("shouldBlock") and if true then call 
  // $(el).css("background-image", "none !important");
}

// until crbug.com/63397 is fixed, ignore SVG images
if (window.location != 'about:blank' && !/\.svg$/.test(document.location.href)) {

  if (GLOBAL_contentScriptData.data)
    adblock_begin_part_2();
  else
    GLOBAL_contentScriptData.run_after_data_is_set = adblock_begin_part_2;

  //subscribe to the list when you click an abp: link
  $('[href^="abp:"], [href^="ABP:"]').click(function(event) {
    event.preventDefault();
    var searchquery = $(this).attr("href").replace(/^.+?\?/, '');
    if (searchquery)
      BGcall('subscribe_popup', searchquery);
  });
}
