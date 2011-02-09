// This code exists to make the Browser Button extension work.  Once we don't need the
// browser button extension, we should be able to integrate by
// deleting this file
// deleting button_extension_id from functions.js
// deleting reference to this file from background.html
// adding the browser_action back into manifest.json
// removing the options/general reference to installing the second extension
// Changing the donation request in options/index


if (!SAFARI) {
  chrome.extension.onRequestExternal.addListener(function(request, sender, sendResponse) {
    if (sender.id != button_extension_id)
      return;
    var result = utils[request.fn](request.options, sender);
    sendResponse(result);
  });

  utils.pause_adblock = function(options) {
    localStorage.setItem('adblock_is_paused', true);
    updateButtonUIAndContextMenus();
  }

  utils.unpause_adblock = function(options) {
    localStorage.removeItem('adblock_is_paused');
    updateButtonUIAndContextMenus();
  }
  
  utils.get_whitelist = function(options) {
    var custom_filters = utils.get_custom_filters_text({}).split('\n');
    // Down-convert custom filters into old whitelist entries
    var whitelist = custom_filters.map(function(text) {
      var dot_match = text.match(/^@@\|\|\*\.([a-zA-Z0-9-.]+)\^\$document$/);
      if (dot_match)
        return '.' + dot_match[1];
      var domain_match = text.match(/^@@\|\|([a-zA-Z0-9-.]+)\^\$document$/);
      if (domain_match)
        return domain_match[1];
      else
        return null; // Not a whitelist entry
    });
    // Remove non-whitelist entries
    return whitelist.filter(function(text) { return text != null; });
  }

  utils.add_to_whitelist = function(options) {
    utils.add_custom_filter({filter: '@@||' + options.domain + '^$document'});
  }

  utils.remove_from_whitelist = function(options) {
    utils.try_to_unwhitelist({url:"http://" + options.domain});
  }


  // Since we've pulled out the browser action temporarily, make API calls noops
  // instead of crashing.
  chrome.browserAction = {
    setPopup: function() {},
    setTitle: function() {},
    setIcon: function() {},
  };
}
