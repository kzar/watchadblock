infinite_loop_workaround("blacklister");

// TODO note: gamestar.de has a good <object> tag with <embed> in it;
// thepiratebay.org [search for 'boots'] has good iframe tags.

function load_jquery_ui(callback) { 
  if (typeof global_have_loaded_jquery_ui != "undefined") {
    callback();
    return; // don't inject stylesheets more than once
  }
  global_have_loaded_jquery_ui = true;

  function load_css(src) {
    var url = chrome.extension.getURL(src);
    var link = $('<link rel="stylesheet" type="text/css" />').
      attr('href', url);
    $("head").append(link);
  }
  extension_call('readfile', 
      {file:"jquery/jquery-ui-1.8.custom.min.js"}, 
      function(result) {
        eval(result); // suck it, Trebek

        load_css("jquery/css/custom-theme/jquery-ui-1.8.custom.css");
        load_css("jquery/css/override-page.css");

        var icon = chrome.extension.getURL("img/icon24.png");
        var css_chunk = document.createElement("style");
        css_chunk.innerText = ".ui-dialog-titlebar " +
            " { background: #2191C0 url(" + icon + ") " +
            " center left no-repeat !important; " +
            " padding-left: 38px !important; }";
        $("html").prepend(css_chunk);

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
      extension_call("get_subscriptions_minus_text", {}, function(subs) {

        var sub_names = [];
        for (var url in subs) {
          if (subs[url].subscribed)
            sub_names.push(subs[url].name);
        }

        var blacklist_ui = new BlacklistUi(sub_names);
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

  });
}

register_broadcast_listener('send_content_to_back', function(options) {
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

  // Also, anybody with a z-index over 1 million is going to get in our
  // way.  Decrease it.
  $('[style*="z-index"]').
    filter(function(i) {
        return $(this).css('z-index') >= 1000000;
      }).
    each(function(i, el) {
        $(el).css('z-index', 999999);
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
