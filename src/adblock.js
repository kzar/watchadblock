function debug_print_selector_matches() {
  if (!DEBUG)
    return;

  extension_call(
    "selectors_for_domain", 
    { domain: document.domain },
    function(selectors) {
      selectors.
        filter(function(selector) { return $(selector).length > 0; }).
        forEach(function(selector) {
          log("Debug: CSS '" + selector + "' hid:");
          $(selector).each(function(i, el) {
            log("       " + el.nodeName + "#" + el.id + "." + el.className);
          });
        });
    });
}

// Run special site-specific code.
function run_specials(features) {
  if (document.location.host.indexOf('mail.live.com') != -1) {
    //removing the space remaining in Hotmail/WLMail
    $(".Unmanaged .WithSkyscraper #MainContent").
      css("margin-right", "1px");
  }

  if (/youtube/.test(document.domain) && features.block_youtube.is_enabled) {
    // Based heavily off of AdThwart's YouTube in-video ad blocking.
    // Thanks, Tom!
    function adThwartBlockYouTube(elt) {
      elt = elt || $("#movie_player").get(0);
      if (!elt)
        return;
      log("Blocking YouTube ads");

      var origFlashVars = elt.getAttribute("flashvars");
      // In the new YouTube design, flashvars could be in a <param> child node
      var inParam = false;
      if(!origFlashVars) {
          origFlashVars = elt.querySelector('param[name="flashvars"]');
          // Give up if we still can't find it
          if(!origFlashVars)
              return;
          inParam = true;
          origFlashVars = origFlashVars.getAttribute("value");
      }
      // Don't mess with the movie player object if we don't actually find any ads
      var adCheckRE = /&(ad_|prerolls|invideo|interstitial).*?=.+?(&|$)/gi;
      if(!adCheckRE.test(origFlashVars))
          return;
      // WTF. replace() just gives up after a while, missing things near the end of the string. So we run it again.
      var re = /&(ad_|prerolls|invideo|interstitial|watermark|infringe).*?=.+?(&|$)/gi;
      var newFlashVars = origFlashVars.replace(re, "&").replace(re, "&") + "&invideo=false&autoplay=1";
      var replacement = elt.cloneNode(true); // Clone child nodes also
      // Doing this stuff fires a DOMNodeInserted, which will cause infinite recursion into this function.
      // So we inhibit it using have_blocked_youtube.
      have_blocked_youtube = true;
      if(inParam) {
          // Grab new <param> and set its flashvars
          newParam = replacement.querySelector('param[name="flashvars"]');;
          newParam.setAttribute("value", newFlashVars);
      } else {
          replacement.setAttribute("flashvars", newFlashVars);
      }
      elt.parentNode.replaceChild(replacement, elt);

      if (features.show_youtube_help_msg.is_enabled) {
        var disable_url = chrome.extension.getURL("options/index.html");
        var message = $("<div>").
          css({"font-size": "x-small", "font-style": "italic",
               "text-align": "center", "color": "black",
               "font-weight": "normal", "background-color": "white"}).
          append("<span>" + translate("youtubevideomessage", 
              ["<a target='_new' href='" + disable_url + "'>" + 
              translate("optionstitle") + "</a>"]) + "</span>");
        var closer = $("<a>", {href:"#"}).
          css({"font-style":"normal", "margin-left":"20px"}).
          text("[x]").
          click(function() {
            message.remove();
            extension_call(
              "set_optional_feature",
              {name: "show_youtube_help_msg", is_enabled: false}
            );
          });
        message.append(closer);
        $("#movie_player").before(message);
      }

      // It seems to reliably make the movie play if we hide then show it.
      // Doing that too quickly can leave the Flash player in place but
      // entirely white (and I can't figure out why.)  750ms seems to work
      // and is quick enough to not be bothersome; and the message we
      // display should handle it even if this turns out to not work all
      // of the time.
      $("#movie_player").hide();
      window.setTimeout(function() { $("#movie_player").show(); }, 750);
    }
    // movie_player doesn't appear in the originally loaded HTML, so I
    // suspect it is inserted right after startup.  This code may not be
    // needed (when I remove it ads are still removed) but I'll leave it
    // in to be safe.
    have_blocked_youtube = false;
    document.addEventListener("DOMNodeInserted", function(e) {
      if (e.target.id == "movie_player") {
        if (!have_blocked_youtube) { // avoid recursion
          adThwartBlockYouTube(e.target);
        }
      }
    }, false);
    adThwartBlockYouTube();
  }

}


function adblock_begin_part_2() {
  var opts = { domain: document.domain };
  if (window == window.top)
    opts.is_top_frame = true;

  extension_call('get_content_script_data', opts, function(data) {
    if (data.adblock_is_paused) {
      return;
    }
    
    if (data.page_is_whitelisted) {
      log("==== EXCLUDED PAGE: " + document.location.href);
      return;
    }

    log("==== ADBLOCKING PAGE: " + document.location.href);
    
    listen_for_broadcasts();

    if (SAFARI) {
      // Add entries to right click menu.  Unlike Chrome, we can make
      // the menu items only appear on non-whitelisted pages.
      window.addEventListener("contextmenu", function(event) {
        safari.self.tab.setContextMenuEventUserInfo(event, true);
      }, false);
    }

    run_specials(data.features);

    //Neither Chrome nor Safari blocks background images. So remove them
    //TODO: Remove background images for elements other than <body>
    var bgImage = $("body").css('background-image');
    var match = bgImage.match(/^url\((.*)\)$/);
    if (match)
      bgImage = match[1];
    if (bgImage && bgImage != "none") {
      var fakeEvent = {
        target: $("body")[0],
        url: bgImage,
        mustBePurged: true,
        preventDefault: function(){},
        type: "beforeload"
      }
      beforeLoadHandler(fakeEvent);
    }

    debug_print_selector_matches();
  });
}

// until crbug.com/63397 is fixed, ignore SVG images
if (window.location != 'about:blank' && !/\.svg$/.test(document.location.href)) {
  adblock_begin_part_2();

  //subscribe to the list when you click an abp: link
  $('[href^="abp:"], [href^="ABP:"]').click(function(event) {
    event.preventDefault();
    var match = $(this).attr('href').
        match(/^abp:(\/\/)?subscribe(\/)?\?(.*\&)?location\=([^\&]*).*$/i);
    if (match) {
      var url = match[4];
      extension_call('subscribe_popup', {url:url});
    }
  });
}
