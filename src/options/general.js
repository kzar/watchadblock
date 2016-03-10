// Handle incoming clicks from bandaids.js & '/installed'
try {
  if (parseUri.parseSearch(location.search).aadisabled === "true") {
    $("#acceptable_ads_info").show();
  }
}
catch(ex) {}

// Check or uncheck each loaded DOM option checkbox according to the
// user's saved settings.
$(function() {

  function init_picreplacement() {
    BGcall("picreplacement_show_on_options_page", function(show) {
      var p = $("#picreplacement");
      p.toggle(show);
      p.find("[i18n]").each(function() {
        var today = new Date();
        var key = $(this).attr("i18n");
        if (today >= new Date(2016, 2, 13)) {
          key = $(this).attr("i18nafter") || $(this).attr("i18n");
        }
        $(this).html(picreplacement.translate(key));
      });
      $("#wikipedia_link").prop("href", "https://www.wikipedia.org/wiki/World_Day_Against_Cyber_Censorship");
      var _determineLanguage = function() {
          var lang = determineUserLanguage();
          if (lang === "en" ||
              lang === "fr" ||
              lang === "es" ||
              lang === "ru") {
              return lang;
          }
          return "en";
      };
      $("#adblock_link").prop("href", "http://getadblock.com/amnesty_url/?l=" + _determineLanguage() + "&v=adblock&s=");
    });
  }
  init_picreplacement();
  // Labels fall off on tab change for some reason: redo them.
  $( "#tabpages" ).on( "tabsactivate", init_picreplacement);

  // Don't use standard enable_ machinery: this is too complicated.
  BGcall("picreplacement_is_happening", function(enabled) {
    var cb = $("#picreplacement").find(":checkbox");
    cb.
      attr("checked", enabled).
      change(function() {
        var is_enabled = $(this).is(':checked');
        BGcall("set_setting", "do_picreplacement", is_enabled);
      });
  });

  BGcall("get_subscriptions_minus_text", function(subs) {
    //if the user is currently subscribed to AA
    //then 'check' the acceptable ads button.
    if (subs["acceptable_ads"].subscribed) {
      $("#acceptable_ads").prop("checked", true);
    }
  });

  for (var name in optionalSettings) {
    $("#enable_" + name).
      prop("checked", optionalSettings[name]);
  }
  //uncheck any incompatible options with the new safari content blocking, and then hide them
  if (optionalSettings["safari_content_blocking"]) {
    $(".exclude_safari_content_blocking > input").each(function(index) {
      $(this).prop("checked", false);
    });
    $(".exclude_safari_content_blocking").hide();
  }

  $("input.feature[type='checkbox']").change(function() {
    var is_enabled = $(this).is(':checked');
    if (this.id === "acceptable_ads") {
      if (is_enabled) {
        $("#acceptable_ads_info").slideUp();
        BGcall("subscribe", {id: "acceptable_ads"});
        // If the user has enabled AA, and Safari content blocking enabled
        // automatically unselect content blocking due to conflicts between AA and Content Blocking
        if (optionalSettings &&
            optionalSettings.safari_content_blocking) {
          $("#acceptable_ads_content_blocking_info").html(translate("content_blocking_acceptable_ads_disbled_message")).slideDown();
          $("#acceptable_ads_content_blocking_info a").attr("href", "http://help.getadblock.com/solution/articles/6000099239").attr("target", "_blank");
          $("#enable_safari_content_blocking").trigger("click");
        }
      } else {
        BGcall("get_settings", function(settings) {
            optionalSettings = settings;
            if (optionalSettings &&
                !optionalSettings.safari_content_blocking) {
              $("#acceptable_ads_content_blocking_info").text("").slideUp();
            }
        });
        $("#acceptable_ads_info").slideDown();
        $("#acceptable_ads_content_blocking_message").text("").slideUp();
        BGcall("unsubscribe", {id:"acceptable_ads", del:false});
      }
      return;
    }
    var name = this.id.substring(7); // TODO: hack
    BGcall("set_setting", name, is_enabled, true);
    // Rebuild filters, so matched filter text is returned
    // when using resource viewer page
    if (name === "show_advanced_options") {
      BGcall("update_filters");
    }
    // if the user enables/disable data collection update the filter lists, so that the
    // filter list data is retained, and any cached responses are cleared
    if (name === "data_collection") {
      BGcall("update_subscriptions_now");
    }
    BGcall("get_settings", function(settings) {
        optionalSettings = settings;
    });

    if (name === "safari_content_blocking") {
      if (is_enabled) {
        $(".exclude_safari_content_blocking").hide();
        $("#safari_content_blocking_bmessage").text("");
        // message to users on the Custom tab
        $("#safariwarning").text(translate("contentblockingwarning")).show();
        // uncheck any incompatable options, and then hide them
        $(".exclude_safari_content_blocking > input").each(function(index) {
          $(this).prop("checked", false);
        });
        // If the user has enabled Safari content blocking enabled, and subscribed to AA
        // automatically unselect unscribed to AA and Content Blocking
        if ($("#acceptable_ads").is(':checked')) {
            $("#acceptable_ads_content_blocking_info").html(translate("acceptable_ads_content_blocking_disbled_message")).slideDown();
            $("#acceptable_ads_content_blocking_info a").attr("href", "http://help.getadblock.com/solution/articles/6000099239").attr("target", "_blank");
            $("#acceptable_ads").trigger("click");
        }
      } else {
        if (!$("#acceptable_ads").is(':checked')) {
            $("#acceptable_ads_content_blocking_info").text("").slideUp();
        }
        $(".exclude_safari_content_blocking").show();
        $("#safari_content_blocking_bmessage").text(translate("browserestartrequired")).show();
        // message to users on the Custom tab
        $("#safariwarning").text("").hide();
      }
      BGcall("set_content_scripts");
      BGcall("update_subscriptions_now");
    }
  }); // end of change handler

  //if safari content blocking is available...
  //  - display option to user
  //  - check if any messages need to be displayed
  //  - add a listener to process any messages
  BGcall("isSafariContentBlockingAvailable", function(response) {
    if (response) {
      $("#safari_content_blocking").show();
      getSafariContentBlockingMessage();
      //once the filters have been updated see if there's an update to the message.
      chrome.extension.onRequest.addListener(function(request, sender, sendResponse) {
        if (request.command !== "contentblockingmessageupdated")
          return;
        getSafariContentBlockingMessage();
        sendResponse({});
      });
    }
  });

  BGcall("get_settings", function(settings) {
      if (settings.show_advanced_options &&
          !SAFARI &&
          chrome &&
          chrome.runtime &&
          chrome.runtime.onMessage) {
        $("#dropbox").show();
      } else {
        $("#dropbox").hide();
      }
  });

  update_db_icon();
  getDropboxMessage();
});

$("#enable_show_advanced_options").change(function() {
  // Reload the page to show or hide the advanced options on the
  // options page -- after a moment so we have time to save the option.
  // Also, disable all advanced options, so that non-advanced users will
  // not end up with debug/beta/test options enabled.
  if (!this.checked)
    $(".advanced input[type='checkbox']:checked").each(function() {
      BGcall("set_setting", this.id.substr(7), false);
    });
  window.setTimeout(function() {
    window.location.reload();
  }, 50);
});


function getSafariContentBlockingMessage() {
  BGcall('sessionstorage_get', 'contentblockingerror', function(messagecode) {
    //if the message exists, it should already be translated.
    if (messagecode) {
      $("#safari_content_blocking_bmessage").text(messagecode).show();
    } else {
      $("#safari_content_blocking_bmessage").text("").hide();
    }
  });
}

// Authenticate button for login/logoff with Dropbox
$("#dbauth").click(function() {
    BGcall("dropboxauth", function(status) {
        if (status === true) {
            BGcall("dropboxlogout");
        } else {
            BGcall("dropboxlogin");
        }
    });
});

$("#dbauthinfo").click(function() {
    BGcall("openTab",
           "http://help.getadblock.com/support/solutions/articles/6000087888-how-do-i-use-dropbox-synchronization-");
});

// Change Dropbox button, when user has been logged in/out
function update_db_icon() {
    if (!SAFARI &&
       chrome &&
       chrome.runtime &&
       chrome.runtime.onMessage) {
        BGcall("dropboxauth", function(status) {
            if (status === true) {
                $("#dbauth").addClass("authenticated");
                $("#dbauth").removeClass("not-authenticated");
            } else {
                $("#dbauth").addClass("not-authenticated");
                $("#dbauth").removeClass("authenticated");
            }
        });
    }
}

function getDropboxMessage() {
  BGcall('sessionstorage_get', 'dropboxerror', function(messagecode) {
    //if the message exists, it should already be translated.
    if (messagecode) {
      $("#dbmessage").text(messagecode);
    }
  });
}
// Listen for Dropbox sync changes
if (!SAFARI &&
   chrome &&
   chrome.runtime &&
   chrome.runtime.onMessage) {
    chrome.runtime.onMessage.addListener(
        function(request, sender, sendResponse) {
            if (request.message === "update_checkbox") {
                BGcall("get_settings", function(settings) {
                    $("input[id='enable_youtube_channel_whitelist']").prop("checked", settings.youtube_channel_whitelist);
                    $("input[id='enable_show_context_menu_items']").prop("checked", settings.show_context_menu_items);
                    $("input[id='enable_show_advanced_options']").prop("checked", settings.show_advanced_options);
                    $("input[id='enable_whitelist_hulu_ads']").prop("checked", settings.whitelist_hulu_ads);
                    $("input[id='enable_debug_logging']").prop("checked", settings.debug_logging);
                });
                sendResponse({});
            }
            if (request.message === "update_icon") {
                update_db_icon();
                sendResponse({});
            }
            if (request.message === "update_page") {
                document.location.reload();
                sendResponse({});
            }
            if (request.message === "dropboxerror" && request.messagecode) {
              $("#dbmessage").text(request.messagecode);
              sendResponse({});
            }
            if (request.message === "cleardropboxerror") {
              $("#dbmessage").text("");
              sendResponse({});
            }
        }
    );
}
