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

// Find all elements that load a resource, find which ones are loading ad
// resources, and remove them.  Asynchronous.
// first_run:bool - true is passed the first time this is called.
function remove_ad_elements_by_url(first_run) {
  // TODO: more than just the list below?
  // TODO: handle background images in places other than BODY tag

  var start = new Date();

  // map indexes to elements, and those same indexes to info about the element.
  var els = $("img,script,embed,iframe,link,object,body");
  var elInfo = els.map(function(id, el) { 
      var elType = typeForElement(el);
      return {
        id: id, 
        url: relativeToAbsoluteUrl(urlForElement(el, elType)), 
        type: elType
      };
    });

  extension_call(
    'find_ads_in', 
    {domain: document.domain, elementInfo: elInfo.toArray()},
    function(ad_ids) {
      $(ad_ids).each(function(i, id) { purgeElement(els[id], elInfo[id]); });

      // TODO: I don't like this being stuck deep in here.  Collapse
      // some levels or make this superfluous.
      _done_with_cache("adblock");

      var end = new Date();
      time_log("adblock_main run time: " + (end - start) + " || " +
               document.location.href);

      if (first_run)
        debug_print_selector_matches();
    }
  );
}
function purgeElement(el, elInfo) {
  log("Purging " + el.nodeName + ": " + elInfo.url);
  // TODO: handle background images
  if (el.nodeName == "EMBED" && el.parentNode.nodeName == "OBJECT")
    $(el).parent().remove(); // removes el as well
  else if (el.nodeName == "BODY")
    $(el).css('background-image', null);
  else if (el.nodeName == "SCRIPT") {
    // Removing the element is useless as it has already run, and it makes
    // bankrate.com display a blank screen in Chrome 5 dev, so we basically do
    // nothing.
    el.src = ""; 
  }
  else
    $(el).remove();
  // TODO: i suspect i'm missing something else here... what did the old
  // code do?
}

// Author: Tom Joseph of AdThwart
function relativeToAbsoluteUrl(url) {
    if(!url)
        return url;
    // If URL is already absolute, don't mess with it
    if(url.match(/^http/))
        return url;
    // Leading / means absolute path
    if(url[0] == '/')
        return document.location.protocol + "//" + document.location.host + url;

    // Remove filename and add relative URL to it
    var base = document.baseURI.match(/.+\//);
    if(!base) return document.baseURI + "/" + url;
    return base[0] + url;
}
// Return the url tied to the given element.  null is OK if we can't find one.
function urlForElement(el, type) {
  // TODO: handle background images, based on 'type'.
  switch (el.nodeName) {
    case 'IMG': return el.src;
    case 'SCRIPT': return el.src;
    case 'EMBED': return el.src;
    case 'IFRAME': return el.src;
    case 'LINK': return el.href;
    case 'OBJECT': 
      var param = $('param[name="movie"][value]', el);
      if (param.length > 0)
        return param.get(0).value;
      else
        return null;
    case 'BODY':
      // TODO: make sure this isn't so slow that we must LBYL
      var bgImage = $(el).css('background-image');
      return (bgImage == "none" ? null: bgImage);
  }
}

// Return the ElementType element type of the given element.
function typeForElement(el) {
  // TODO: handle background images that aren't just the BODY.
  switch (el.nodeName) {
    case 'IMG': return ElementTypes.image;
    case 'SCRIPT': return ElementTypes.script;
    case 'OBJECT': 
    case 'EMBED': return ElementTypes.object;
    case 'IFRAME': return ElementTypes.subdocument;
    case 'LINK': return ElementTypes.stylesheet;
    case 'BODY': return ElementTypes.background;
    default: return ElementTypes.NONE;
  }
}
// Run special site-specific code.
function run_specials(features) {
  var domain = document.domain;

  if (domain.indexOf("chess.com") != -1) {
      // Their sucky HTML coders absolutely positioned the search box,
      // so blocking the top ad makes the search box appear too low on the
      // page.
      var search_form = $("#search_form").closest("div");
      search_form.css("top", "40px");
  }

  if (domain.indexOf("honestjohn.co.uk") != -1) {
    $(".sponsads1").closest(".pane").remove();
  }
  
  if (domain.indexOf("cbssports.com") != -1) {
      $("body").css("background-image", "url()");
  }

  if (domain.indexOf("songmeanings.net") != -1) {
      $("#rm_container").remove();
      $("body").css("overflow", "auto");
  }

  if (domain.indexOf("newgrounds.com") != -1) {
      $("div#main").css('background-image', '');
  }

  if (domain.indexOf("99.se") != -1) {
      $('div[id*="Banner"]').html("");
  }

  if (domain.indexOf("vanguard.com") != -1) {
      // Remove broken lack-of-JS check
      $(".hidePageIfJSdisabled").removeClass("hidePageIfJSdisabled");
  }

  if (domain.indexOf("imdb.com") != -1) {
      $("#top_ad_wrapper").remove(); // in case they aren't on EasyList
      $("#navbar").css('margin-top', 21);
  }

  if (domain.match("youtube") && features.block_youtube.is_enabled) {
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
      if(!origFlashVars.match(adCheckRE))
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
          append("<span>No video?  Reload the page.  If this happens a lot, disable YouTube ad blocking under <a target='_new' href='" + disable_url + "'>AdBlock Options</a>.</span>");
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


function element_is_empty(element) {
  //element is already removed or something like that
  if (element == undefined)
    return false;

  var test_regex = /[\x21-\xFF]/; //all normal characters except spaces
  for (var i=0;i<element.childNodes.length;i++) {
    //comments, non-visible texts, line breaks, scripts and style elements
    //do not show up on the page and count as 'empty'.
    switch (element.childNodes[i].nodeName) {
      case '#comment': break;
      case '#text':
       if (test_regex.test(element.childNodes[i].nodeValue))
          return false; else break;
      case 'SCRIPT': break;
      case 'STYLE': break;
      case 'BR': break;
      default: return false;
    }
  }
  return true;
}

function collapse_blocked_elements(data_selectors, data_user_filters) {
  log("Collapsing blocked elements");

  //create the list of selectors
  var selectors = data_selectors.join(',');
  var custom_filters = [];
  for (var i = 0; i < data_user_filters.length; i++) {
    if (new RegExp(data_user_filters[i].domain_regex).test(document.domain))
      custom_filters.push(data_user_filters[i].css_regex);
  }
  if (custom_filters.length > 0)
    selectors = selectors + ',' + custom_filters.join(',');

  var matched_selectors = $(selectors);
  for (var i=0; i<matched_selectors.length; i++) {
    if (matched_selectors[i] == undefined) 
      continue;

    //remove the ad
    var parent_of_selector = matched_selectors[i].parentElement;
    $(matched_selectors[i]).remove();

    while (element_is_empty(parent_of_selector)) {
      //remove the parent element(s)
      if (parent_of_selector.nodeName == 'BODY'
          || parent_of_selector.nodeName == 'FRAME')
        break;
      var new_parent_of_selector = parent_of_selector.parentElement;
      $(parent_of_selector).remove();
      parent_of_selector = new_parent_of_selector;
    }
  }
}


function adblock_begin_v2() {
  // TODO: opts code copied from adblock_start.js
  var opts = { domain: document.domain };
  if (window == window.top)
    opts.is_top_frame = true;

  extension_call('get_features_and_filters', opts, function(data) {
    log("==== ADBLOCKING PAGE: " + document.location.href);

    // TODO: why send the whitelist just to check it?  do it in background.
    if (page_is_whitelisted(data.whitelist, data.top_frame_domain,
        data.features.dont_block_on_https.is_enabled))
      return;

    listen_for_broadcasts();
    blacklister_init();
    whitelister_init();

    // GMail is already handled in adblock_start.
    // TODO: is this fast enough now that I don't need a special case?
    if (document.domain == "mail.google.com")
      return;

    run_specials(data.features);

    if (data.features.collapse_blocked_elements.is_enabled)
      collapse_blocked_elements(data.selectors, data.user_filters);

    remove_ad_elements_by_url(true);

    // If more elements are inserted later, run again.
    function handleInsertedNode(e) {
      log("Sweeping the page because a new node was inserted.");
      // So we don't fire a million times if the page is very active
      document.removeEventListener("DOMNodeInserted", handleInsertedNode);

      window.setTimeout(function() {
        document.addEventListener("DOMNodeInserted", handleInsertedNode);
        remove_ad_elements_by_url();
      }, 500);
    }
    document.addEventListener("DOMNodeInserted", handleInsertedNode);

  });
}
adblock_begin_v2();