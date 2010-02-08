// Don't inspect past this far into a URL, because it makes for some
// painful regexes.
var LENGTH_CUTOFF = 200;

var domain = document.domain;

function run_blacklist(user_filters) {
  var blacklist_matches = [];
  $.each(user_filters, function(i, filter) {
    if (new RegExp(filter.domain_regex).test(document.domain)) {
      var targets = $(filter.css_regex);
      if (targets.length > 0) {
        log("domain '" + filter.domain_regex + "' user filter '" + 
            filter.css_regex + " removing " + targets.length + " items");
        $(filter.css_regex).remove();

        blacklist_matches.push(filter.css_regex);
      }
    }
  });

  if (blacklist_matches.length > 0) {
    // Block via CSS.
    $("html").prepend($("<style></style>").text(
          blacklist_matches.join(",") + " { visibility:hidden; }"));
  }
}


function adblock_begin_v2(features) {
  // Return true if 'target' matches any of 'patterns'.
  function matches(target, patterns, is_regex) {
    // Avoid realllly slow checking on huge strings -- google
    // image search results being one example.
    target = target.substring(0, LENGTH_CUTOFF);

    for (var i = 0; i < patterns.length; i++) {
      if ( (!is_regex && substring_match(patterns[i], target)) ||
           ( is_regex && regex_match(patterns[i], target)) ) {
        log("  * " + (is_regex ? "regex" : "substring") + " match: '" + 
            patterns[i] + "' matches '" + target + "'");
        return true;
      }
    }
    return false;
  }
  // Split out for profiling's sake.
  function substring_match(pattern, target) {
      // See matches() for reason
      pattern = pattern.substring(0, LENGTH_CUTOFF);

      return target.indexOf(pattern) != -1;
  }
  // TODO: see dev/TODO -- this is slow.  Speed it up.
  function regex_match(pattern, target) {
      return pattern.test(target);
  }

  // Return a jQuery object containing all [src] and [value] elements that
  // match one of the given regex (if is_regex) or substring patterns.
  // If skip_srcs, skip [src] (because we already handled this case in 
  // adblock_start via CSS selectors.)
  function get_url_matches(patterns, is_regex, skip_srcs) {
    var result = $([]);

    log("SRC matches:");
    if (!skip_srcs) {
      result = $("[src]").
        filter(function(i) {
            if (this.src == undefined) // e.g. <span src="foo"/> does this
              return false;
            return matches(this.src.toLowerCase(), patterns, is_regex);
          });
    }

    if (features.debug_logging.is_enabled && skip_srcs) {
      log("Here are the [src]s that I won't block because adblock_start " +
          "does it for me:");
      var temp_stuff = $("[src]").
        filter(function(i) {
            if (this.src == undefined) // e.g. <span src="foo"/> does this
              return false;
            var yep = matches(this.src.toLowerCase(), patterns, is_regex);
            if (yep)
              log(" -- that was a " + this.nodeName);
            return yep;
          });
    }

    log("OBJECT PARAM matches:");
    $("object param[value]").
      filter(function(i) {
          if (this.value == undefined)
            return false;
          return matches(this.value.toLowerCase(), patterns, is_regex);
        }).
      each(function(i, el) {
          result = result.add($(el).closest("object"));
        });

    return result;
  }

  // Return a jQuery object containing all [src] and [value] elements that
  // match the given regex and substring lists of filters.
  // If skip_src_substrings, only check object params for substrings.
  function get_regex_and_substring_matches(regex_list, substring_list,
                                           skip_src_substrings) {
    var regexes = add_includes_and_excludes(regex_list);
    for (var i = 0; i < regexes.length; i++)
      regexes[i] = new RegExp(regexes[i]);

    var result = get_url_matches(regexes, true, false);

    var substrings = add_includes_and_excludes(substring_list, false);

    var substring_matches = get_url_matches(substrings, false, 
                                            skip_src_substrings);

    result = result.add(substring_matches);

    return result;
  }

  function run_selector_blocklist(f, whitelisted) {
    var selectors = add_includes_and_excludes(f.selectors);
    // TODO: I'd love to avoid joining these guys, but jQuery doesn't
    // accept an array of strings and interpret them correctly.
    var candidates = $(selectors.join(','));

    var to_block = candidates.not(whitelisted);

  
    if (features.debug_logging.is_enabled) {
      log("SELECTOR SEARCH");
      log("# selector rules: " + selectors.length);
      log("matched elements: " + candidates.length);
      log("whitelist length: " + whitelisted.length);
      log("without whitelisted: " + to_block.length);
      // List which selectors removed which ads.
      for (var i = 0; i < selectors.length; i++) {
          var dead = $(selectors[i]);
          if (dead.length > 0) {
            for (var j = 0; j < dead.length; j++) {
              log("  * css match: '" + selectors[i].substring(0,80) +
                  "' matches '" + 
                  $(dead[j]).html().substring(0,80).replace(/\n/g, '') +
                  "...'");
            }
          }
      }
      log("SELECTOR BLOCKED: " + to_block.length + " (plus " +
          (candidates.length - to_block.length) + " whitelisted)");
    }

    to_block.remove();
  }

  // Run special site-specific code.
  function run_specials() {
    // TODO make this a hashtable lookup by domain to run a function.
  
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
        log("Blocking YouTube ads");
        elt = elt || $("#movie_player").get(0);
        if (!elt)
          return;
        var re = /&(ad_|prerolls|watermark|invideo|interstitial|watermark|infringe).*?=.+?(&|$)/gi;
        // WTF. replace() just gives up after a while, missing things 
        // near the end of the string. So we run it again.
        var newFlashVars = elt.getAttribute("flashvars");
        if (!newFlashVars)
          return;
        newFlashVars = newFlashVars.
                replace(re, "&").
                replace(re, "&");
        var replacement = elt.cloneNode(true);
        replacement.setAttribute("flashvars", newFlashVars + 
                "&invideo=false&autoplay=1");
        blocking_youtube = true; // avoid recursion upon DOMNodeInserted
        elt.parentNode.replaceChild(replacement, elt);
        blocking_youtube = false;
        $('style[title="youtube_hack"]').remove();
      }
      // movie_player doesn't appear in the originally loaded HTML, so I
      // suspect it is inserted right after startup.  This code may not be
      // needed (when I remove it ads are still removed) but I'll leave it
      // in to be safe.
      document.addEventListener("DOMNodeInserted", function(e) {
        if (e.target.id == "movie_player") {
            if (!blocking_youtube) // avoid recursion
              adThwartBlockYouTube(e.target);
        }
      }, false);
      adThwartBlockYouTube();
    }

    if (domain.indexOf("acidtests.org") != -1) {
        alert("Hi, this is an alert from AdBlock.  AdBlock horks the ACID test, partially because AdBlock is designed to change the layout of your web pages.  To check Chrome's ACID rating, you'll need to temporarily disable AdBlock; with AdBlock enabled this page will display about a 66/100 and then hang.  (Also, you'll see this alert a few times; just click the 'Stop showing me alerts!' checkbox when it appears).  Sorry for the interruption! -- Michael");
    }

  }

  // TODO: opts code copied from adblock_start.js
  var opts = {};
  if (window == window.top)
    opts.top_frame_domain = document.domain;

  cached_extension_call('get_user_demands_v2', opts, function(demands) {
    var start = new Date();
    log("==== ADBLOCKING PAGE: " + document.location.href);

    // Do nothing if we're whitelisted.
    if (page_is_whitelisted(demands.whitelist, demands.top_frame_domain)) {
      // We need to kill the listeners on every frame, but we'll have to
      // make do with just this frame.
      stop_checking_for_blacklist_keypress();
      stop_checking_for_whitelist_keypress();
      return;
    }

    // GMail is already handled in adblock_start.
    if (document.domain == "mail.google.com")
      return;

    var f = demands.filters;

    var whitelisted = get_regex_and_substring_matches(
                        f.whitelisted_src_regexes,
                        f.whitelisted_src_substrings,
                        false);
    log("WHITELISTED: " + whitelisted.length);

    if (features.early_blocking.is_enabled) {
      // We don't take the whitelist into account when early blocking,
      // so anything in the whitelist has been hidden.  Now let's show them.
      // TODO: this doesn't handle items that arrive on the page after
      // it has loaded.  We might instead add a CSS rule (to the BOTTOM of
      // the page) explicitly showing these elements, but that doesn't work
      // for regex matches or src substrings within OBJECTs.  Perhaps the
      // current approach will so rarely be a problem that we don't have 
      // to worry about adding a DOMElementAdded listener.
      whitelisted.show();
      // TODO: this doesn't actually work half the time, because Chrome
      // has two conflicting directives.  Really I need to make
      // :not(.adblock_innocent) be on every freaking rule.
    }

    log("PATTERN SEARCH");
    var skip_src_substrings = (
        whitelisted.length == 0 &&
        features.early_blocking.is_enabled &&
        features.early_block_src_substrings.is_enabled
    );

    var pattern_blocklist = get_regex_and_substring_matches(
                                f.src_regexes,
                                f.src_substrings,
                                skip_src_substrings);

    var to_block = pattern_blocklist.not(whitelisted);
    log("PATTERN BLOCKED: " + to_block.length + " (plus " +
        (pattern_blocklist.length - to_block.length) + " whitelisted)");
    to_block.remove();

    if (features.early_blocking.is_enabled &&
        whitelisted.length == 0) {
      // There are no whitelisted elements on the page; that means that
      // there were no false positives among the items caught by
      // early blocking.  Thus, there's no reason to again find and remove
      // those items from the page!
      if (features.debug_logging.is_enabled) {
        log("Skipping SELECTOR SEARCH -- here's what adblock_start covered:");
        log(" (this won't show items that arrived after the page loaded)");
        var selectors = add_includes_and_excludes(f.selectors);
        var candidates = $(selectors.join(','));
        var to_block = candidates.not(whitelisted);
        // List which selectors removed which ads.
        for (var i = 0; i < selectors.length; i++) {
            var dead = $(selectors[i]);
            if (dead.length > 0) {
              for (var j = 0; j < dead.length; j++) {
                log("  * css match: '" + selectors[i].substring(0,80) +
                    "' matches '" + 
                    $(dead[j]).html().substring(0,80).replace(/\n/g, '') +
                    "...'");
              }
            }
        }
        log("[end of skipped SELECTOR SEARCH]");
      }
    } else {
      run_selector_blocklist(f, whitelisted);
    }

    run_specials();

    // Blacklist is handled already if they are early blocking --
    // assuming we never remove that style element.
    if (features.early_blocking.is_enabled == false)
      run_blacklist(demands.user_filters);

    // TODO if whitelist.length > 0 and we early_blocked, remove our
    // style elements.

    var end = new Date();
    time_log("Total running time (v2): " + (end - start) + " || " +
             document.location.href);
    _done_with_cache("adblock");
  });
}

listen_for_broadcasts();
blacklister_init();
whitelister_init();

cached_extension_call('get_optional_features', {}, function(features) {
  adblock_begin_v2(features);
});
