// Temp code to handle incoming clicks from acceptable-ads-announcement.html
try {
  if (parseUri.parseSearch(location.search).aadisabled === "true") {
    $("#acceptable_ads_info").show();
  }
}
catch(ex) {}

// Check or uncheck each loaded DOM option checkbox according to the
// user's saved settings.
$(function() {

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
  $("input.feature[type='checkbox']").change(function() {
    var is_enabled = $(this).is(':checked');
    var name = this.id.substring(7); // TODO: hack
    BGcall("set_setting", name, is_enabled, true);
    // if the user enables/disable data collection update the filter lists, so that the
    // filter list data is retained, and any cached responses are cleared
    if (name === "data_collection") {
      BGcall("update_subscriptions_now");
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

$("#acceptable_ads").change(function() {
  var is_enabled = $(this).is(':checked');
  if (is_enabled) {
    $("#acceptable_ads_info").slideUp();
    BGcall("subscribe", {id: "acceptable_ads"});
  } else {
    $("#acceptable_ads_info").slideDown();
    BGcall("unsubscribe", {id:"acceptable_ads", del:false});
  }
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
           "http://support.getadblock.com/kb/technical-questions/how-do-i-use-the-dropbox-synchronization-feature");
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
