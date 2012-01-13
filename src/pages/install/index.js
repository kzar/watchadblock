
var installPageVersion = 2;
BGcall("storage_set", "saw_install_page", installPageVersion);
$(function() {
  localizePage();

  // Slide cards upon nav link click
  $(".nav a").click(function() {
    var pad = 100; // Make darn sure elements slide offscreen
    $("body").css("overflow", "hidden"); // No scrollbars while sliding things around

    // Control whether things slide to the left or downward
    var edge = $(this).hasClass("down") ? "top" : "left";
    var diameterFn = $(this).hasClass("down") ? "height" : "width";

    // Where new content slides to
    var marker = $("#wrapper").position();

    // Put target card in place offscreen.
    var target = $("#" + this.name);
    // Give the payment card more room.
    if (this.name == 'last-step') {
      marker.top -= 90;
      $("#header").animate({"margin-bottom": 5, "margin-top": 5});
    }
    target.css(marker);
    target.css(edge, $(document)[diameterFn]() + pad);
    target.show();


    // Slide my card off screen
    var myCard = $(this).closest(".card");
    myCard.css("z-index", 1);
    var how = {};
    how[edge] = (myCard[diameterFn]() + pad) * -1;
    myCard.animate(how, function() { myCard.hide(); });

    // Slide target card onscreen
    target.css("z-index", 2);
    var that = this;
    target.animate(marker, function() {
      $("body").css("overflow", "auto");
      if (that.name == "last-step")
        $("#last-step #payment-types").each(function(el) { this.scrollIntoView(true); });
      });

      return false;
    });
  });

  // Called after progress bar finishes
  function begin() {
    $("#header").fadeIn();
    var startCard = (SAFARI ? "#start-safari": "#start-chrome");
    $(startCard).css($("#wrapper").position()).fadeIn();
  }



  $(function() {
    $("#cleaner-warning a").click(function() {
      alert(translate("filecleanerwarning"));
    });
  });



  var start = new Date();
  var steps = 0;
  (function() {
    // Show a loading progress indicator for a few seconds while the user
    // gets her bearings.

    var runLength = 2500; // Should take this many ms
    var pctTime = (new Date() - start) / runLength; // Goes from 0 to 1

    // Start slow, then speed up.
    var pctDone = Math.pow(pctTime, 4);

    var bar = $("#chrome-loading-progress");
    bar[0].value = pctDone;
    if (SAFARI) { // progress bar not yet supported
      $("#chrome-loading-progress").css({"background-color": "#ccc", "border": "1px solid black"});
      $("#safari-loading-progress").css("width", Math.min(100, Math.round(pctDone * 100)) + "%");
    }

    if (pctDone < 1) {
      window.setTimeout(arguments.callee, 20);
      return;
    }

    window.setTimeout(function() {
      // Loaded
      $("#loading-wrapper").
      find("#done").fadeIn().end().
      delay(1800).
      fadeOut(function() {
        begin();
      });
    }, 200);
  })();


  $("#start-chrome.card input").change(function() {
    BGcall("set_setting", "show_google_search_text_ads", this.checked, function() {
      BGcall("update_filters");
    });
  });



  $(function() {
    var userId = (document.location.search.match(/\u\=(\w+)/) || [])[1];
    var iframe = $("<iframe>", {
      src: "http://chromeadblock.com/pay/?source=I&header=install&u=" + userId,
      width: 750, height: 450, 
      frameBorder: 0, scrolling: "no" 
    });
    $("#iframe-slot").html(iframe);
  });
