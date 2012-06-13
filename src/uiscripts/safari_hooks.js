// This file is only loaded by Safari.  Chrome uses chrome.tabs.executeScript
// in lieu of broadcasts, and registers context menus in background.html.

// TODO: free to make this Safari-specific if that's helpful
(function() {
  // Handle broadcasted instructions
  var dispatcher = {};
  dispatcher['send_content_to_back'] = send_content_to_back;

  var port = chrome.extension.connect({name: "Broadcast receiver"});
  port.onMessage.addListener(function(request) {
    if (dispatcher[request.fn])
      dispatcher[request.fn](request.options);
  });
})();

if (window == window.top) {
  safari.self.addEventListener("message", function(event) {
    // Handle message event generated in toolbar button and right click menu
    // item "command" event handler
    if (event.name == "show-whitelist-wizard")
      top_open_whitelist_ui({});
    else if (event.name == "show-blacklist-wizard")
      top_open_blacklist_ui({});
    else if (event.name == "show-clickwatcher-ui")
      top_open_blacklist_ui({nothing_clicked:true});
  }, false);
}
