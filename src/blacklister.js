// Global lock so we can't open more than once on a tab.
var blacklist_ui_open = false;

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

      if (SAFARI) {
        // chrome.i18n.getMessage() lazily loads a file from disk using xhr,
        // but the page itself doesn't have access to extension resources.
        // Since we'll be using getMessage(), we have to ask the background
        // page for the data.
        extension_call('get_l10n_data', {}, function(data) {
          chrome.i18n._setL10nData(data);
          callback();
        });
      }
      else {
        callback();
      }
    }
  );
}

if (window == window.top) {
  register_broadcast_listener('top_open_blacklist_ui', function(options) {
    if (blacklist_ui_open)
      return;

    blacklist_ui_open = true;

    load_jquery_ui(function() {
      var blacklist_ui = new BlacklistUi();
      blacklist_ui.cancel(function() {
        blacklist_ui_open = false;
      });
      blacklist_ui.block(function() {
        blacklist_ui_open = false; // no-op, actually, since we now reload
        document.location.reload();
      });
      blacklist_ui.show();

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


// Safari context menu support, until we unify Chrome & Safari
// support via port.js
if (SAFARI) {
  // Wait for right click
  window.addEventListener("contextmenu", function(event) {
    safari.self.tab.setContextMenuEventUserInfo(event, true);
  }, false);
  // Handle right click menu item click
  safari.self.addEventListener("message", function(event) {
    if (event.name != "show-blacklist-wizard")
      return;
    page_broadcast('top_open_blacklist_ui', {});
  }, false);
}

