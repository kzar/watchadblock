// TODO note: gamestar.de has a good <object> tag with <embed> in it;
// thepiratebay.org [search for 'boots'] has good iframe tags.

function load_jquery_ui(callback) { 
  extension_call('readfile', 
      {file:"jquery/jquery-ui-1.7.2.custom.min.js"}, 
      function(result) {
        eval(result); // suck it, Trebek
        var src = "jquery/css/start/jquery-ui-1.7.2.custom.css";
        var url = chrome.extension.getURL(src);
        var link = $('<link rel="stylesheet" type="text/css" />').
            attr('href', url);
        $("head").append(link);
        callback();
      }
  );
}

if (window == window.top) {
  register_broadcast_listener('top_open_blacklist_ui', function(options) {
    if (!may_open_blacklist)
      return;

    stop_checking_for_blacklist_keypress();

    load_jquery_ui(function() {
      var blacklist_ui = new BlacklistUi();
      blacklist_ui.cancel(function() {
        blacklister_init();
      });
      blacklist_ui.block(function() {
        // We would call blacklister_init() if we weren't about to reload.
        document.location.reload();
      });
      blacklist_ui.show();
    });

  });
}

register_broadcast_listener('send_flash_to_back', function(options) {
  // Objects and embeds can catch our clicks unless we lay a div over
  // them.  But even then they can catch our clicks unless they were loaded
  // with wmode=transparent.  So, make them load that way, so that our
  // overlaid div catches the clicks instead.
  // We force a hide and show so they reload with wmode=transparent.  I've
  // seen cases (e.g. mtv3.fi's right side ad) where the show was so fast
  // that the wmode=transparent hadn't been applied; thus, we delay 250ms
  // before showing.
  $("object").each(function(i, el) {
      $(el).
        hide().
        append('<param name="wmode" value="transparent">');
      window.setTimeout(function() { log("showing"); $(el).show(); }, 250);
    });
  $("embed").each(function(i, el) {
      $(el).
        hide().
        attr('wmode', 'transparent');
      window.setTimeout(function() { log("showing"); $(el).show(); }, 250);
    });
});

function check_for_blacklist_keypress(e) { 
  if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.keyCode == 75) { // K
    extension_call('get_optional_features', {}, function(features) {
      if (features.blacklist_shortcut.is_enabled)
        page_broadcast('top_open_blacklist_ui', {});
    });
  }
}  

// For the extension icon, so we can't open more than once on a tab.
var may_open_blacklist = true;

function stop_checking_for_blacklist_keypress() {
  may_open_blacklist = false;
  $("body").unbind("keydown", check_for_blacklist_keypress);
}

function blacklister_init() {
  may_open_blacklist = true;
  $("body").
      unbind('keydown', check_for_blacklist_keypress). // just in case
      keydown(check_for_blacklist_keypress);
}
