if (/youtube/.test(document.location.hostname)) {  
  var url = document.location.href;
  
  window.onbeforeunload = function() {
    if (url.search("channel=") > 0)
      document.body.style.display = "none";
  }

  // Get enabled settings
  var enabled_settings = [];
  BGcall("get_settings", function(settings) {
    for (setting in settings) {
      if (settings[setting]) {
        enabled_settings.push(setting);
      }
    }
    // If YouTube whitelist is enabled in Options, add name of the channel on the end of URL
    if (enabled_settings.indexOf("youtube_channel_whitelist") >= 0) {
      // Don't run on main, search and feed page
      if ((url.search("channel=") < 0) && (/channel|watch/.test(url)) && (url.search("feed") < 0)) {           
        if (/channel/.test(url)) {
          var get_yt_name = document.querySelector(".qualified-channel-title-text a[href*='/user/']");
          if (!get_yt_name) {
            get_yt_name = document.querySelector(".epic-nav-item-heading").innerText;
            var extracted_name = get_yt_name.split('/').pop();
          } else {
            var extracted_name = get_yt_name.getAttribute("href").split('/').pop();
          }
          var new_url = url+"?&channel="+extracted_name;
        } else {
          var get_yt_name = document.querySelector("#watch7-user-header a[href*='/user/']");
          if (get_yt_name === null) { 
              //in Safari 5, the anchor has a different parent tag
              get_yt_name = document.querySelector("#ud a[href*='/user/']");
          }
          if (get_yt_name === null) {
            return;
          }
          var extracted_name = get_yt_name.getAttribute("href").split('/').pop();
          var new_url = url+"&channel="+extracted_name;
        }
        // Add the name of the channel to the end of URL
        window.history.replaceState(null,null,new_url);
        // Page must be reloaded, so AdBlock can properly whitelist the page
        document.location.reload(false);
      }
    }
  });
}