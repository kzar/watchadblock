// Global lock so we can't open more than once on a tab.
var may_open_blacklist_ui = false;

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

// Record the last element to be right-clicked, since that information isn't
// passed to the contextmenu click handler that calls top_open_blacklist_ui
var rightclicked_item = null;
$("body").bind("contextmenu", function(e) {
  rightclicked_item = e.srcElement;
}).click(function() {
  rightclicked_item = null;
});
if (window == window.top) {
  register_broadcast_listener('top_open_blacklist_ui', function(options) {
    if (!may_open_blacklist_ui)
      return;

    may_open_blacklist_ui = false;

    load_jquery_ui(function() {
      // If they chose "Block an ad on this page..." ask them to click the ad
      if (options.nothing_clicked)
        rightclicked_item = null;

      // If they right clicked in a frame in Chrome, use the frame instead
      if (options.info && options.info.frameUrl) {
        var frame = $("iframe").filter(function(i, el) {
          return el.src == options.info.frameUrl;
        });
        if (frame.length == 1)
          rightclicked_item = frame[0];
      }
      var blacklist_ui = new BlacklistUi(rightclicked_item);
      blacklist_ui.cancel(function() {
        may_open_blacklist_ui = true;
      });
      blacklist_ui.block(function() {
        may_open_blacklist_ui = true; // no-op, actually, since we now reload
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
  // Handle right click menu item click
  safari.self.addEventListener("message", function(event) {
    if (event.name == "show-blacklist-wizard")
      page_broadcast('top_open_blacklist_ui', {});
    else if (event.name == "show-clickwatcher-ui")
      page_broadcast('top_open_blacklist_ui', {nothing_clicked:true});
  }, false);
}
