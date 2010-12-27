function debug_print_selector_matches(selectors) {
  if (!DEBUG)
    return;

  selectors.
    filter(function(selector) { return $(selector).length > 0; }).
    forEach(function(selector) {
      log("Debug: CSS '" + selector + "' hid:");
      $(selector).each(function(i, el) {
        log("       " + el.nodeName + "#" + el.id + "." + el.className);
      });
    });
}

// Run special site-specific code.
function run_specials(features) {
  if (document.location.host.indexOf('mail.live.com') != -1) {
    //removing the space remaining in Hotmail/WLMail
    $(".Unmanaged .WithSkyscraper #MainContent").
      css("margin-right", "1px");
    $(".Managed .WithSkyscraper #MainContent").
      css("right", "1px");
  }
  if (/\.hk-pub\.com\/forum\/thread\-/.test(document.location.href)) {
    //issue 3971: due to 'display:none' the page isn't displayed correctly
    $("#AutoNumber1").
      css("width", "100%").
      css("margin", "0px");
  }

  if (/youtube/.test(document.domain) && features.block_youtube.is_enabled) {
    function blockYoutubeAds(videoplayer) {
      var flashVars = $(videoplayer).attr('flashvars');
      var inParam = false;
      if(!flashVars) {
          flashVars = videoplayer.querySelector('param[name="flashvars"]');
          // Give up if we still can't find it
          if(!flashVars)
              return;
          inParam = true;
          flashVars = flashVars.getAttribute("value");
      }
      var adRegex = /(^|\&)((ad_.+?|prerolls|interstitial)\=.+?|invideo\=true)(\&|$)/gi;
      if(!adRegex.test(flashVars))
          return;

      log("Removing YouTube ads");
      var adReplaceRegex = /\&((ad_\w+?|prerolls|interstitial|watermark|infringe)\=[^\&]*)+/gi;
      flashVars = flashVars.replace(adReplaceRegex, '');
      flashVars = flashVars.replace(/\&invideo\=True/i, '&invideo=False');
      flashVars = flashVars.replace(/\&ad3_module\=[^\&]*/i, '&ad3_module=about:blank');
      var replacement = videoplayer.cloneNode(true);
      if (inParam) {
          // Grab new <param> and set its flashvars
          newParam = replacement.querySelector('param[name="flashvars"]');;
          newParam.setAttribute("value", flashVars);
      } else {
          replacement.setAttribute("flashvars", flashVars);
      }
      videoplayer.parentNode.replaceChild(replacement, videoplayer);

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
    }
    
    if ($("#movie_player").length > 0) {
      //the movie player is already inserted
      blockYoutubeAds($("#movie_player")[0]);
    } else {
      //otherwise it has to be inserted yet
      document.addEventListener("DOMNodeInserted", function(e) {
        if (e.target.id != "movie_player")
          return;
        blockYoutubeAds(e.target);
        this.removeEventListener('DOMNodeInserted', arguments.callee, false);
      }, false);
    }
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

    debug_print_selector_matches(data.selectors);
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
