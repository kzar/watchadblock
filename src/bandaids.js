var run_bandaids = function() {
  // Tests to determine whether a particular bandaid should be applied
  var apply_bandaid_for = "";
  if (/mail\.live\.com/.test(document.location.host))
    apply_bandaid_for = "hotmail";
  else if (/\.hk-pub\.com\/forum\/thread\-/.test(document.location.href))
    apply_bandaid_for = "hkpub";
  else if (/youtube/.test(document.location.hostname))
    apply_bandaid_for = "youtube";

  // TODO: once old-style Chrome blocking is dead, move youtube into 
  // Safari-specific file.

  var bandaids = {
    hotmail: function() {
      //removing the space remaining in Hotmail/WLMail
      $(".Unmanaged .WithSkyscraper #MainContent").
        css("margin-right", "1px");
      $(".Managed .WithSkyscraper #MainContent").
        css("right", "1px");
    },

    hkpub: function() {
      //issue 3971: due to 'display:none' the page isn't displayed correctly
      $("#AutoNumber1").
        css("width", "100%").
        css("margin", "0px");
    },

    youtube: function() {
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
            newParam = replacement.querySelector('param[name="flashvars"]');
            newParam.setAttribute("value", flashVars);
        } else {
            replacement.setAttribute("flashvars", flashVars);
        }
        videoplayer.parentNode.replaceChild(replacement, videoplayer);
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

  }; // end bandaids

  if (apply_bandaid_for) {
    log("Running bandaid for " + apply_bandaid_for);
    bandaids[apply_bandaid_for]();
  }
}
