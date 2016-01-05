var malwareDomains = null;
var extensionsDisabled = [];
$(function() {
    localizePage();

    //Shows the instructions for how to enable all extensions according to the browser of the user
    if (SAFARI) {
        $(".chrome_only").hide();
    } else {
        $(".safari_only").hide();
        var messageElement = $("li[i18n='disableforchromestepone']");
        messageElement.find("a").click(function() {
            if (OPERA) {
                chrome.tabs.create({url: 'opera://extensions/'});
            } else {
                chrome.tabs.create({url: 'chrome://extensions/'});
            }
        });
    }

    // Sort the languages list
    var languageOptions = $("#step_language_lang option");
    languageOptions.sort(function(a,b) {
        if (!a.text) return -1; if (!b.text) return 1; // First one is empty
        if (!a.value) return 1; if (!b.value) return -1; // 'Other' at the end
        if (a.getAttribute("i18n") == "lang_english") return -1; // English second
        if (b.getAttribute("i18n") == "lang_english") return 1;
        return (a.text > b.text) ? 1 : -1;
    });
    $("#step_language_lang").empty().append(languageOptions);
    languageOptions[0].selected = true;

    // add the link to the anchor in "adreport2"
    $("a", "#info").
      attr("href", "http://support.getadblock.com/kb/im-seeing-an-ad/how-do-i-block-an-ad").
      attr("target", "_blank");
});

// Fetching the options...
var options = parseUri.parseSearch(document.location.search);

// Get the list of all unsubscribed default filters
var unsubscribed_default_filters = [];
BGcall("get_subscriptions_minus_text", function(subs) {
    for (var id in subs)
        if (!subs[id].subscribed && !subs[id].user_submitted)
            unsubscribed_default_filters[id] = subs[id];
});

// Get debug info
var debug_info = BGcall("getDebugInfo", function(info) {
    debug_info = info;
});

//generate the URL to the issue tracker
function generateReportURL() {
    var result = "https://adblock.tenderapp.com/discussion/new" +
        "?category_id=ad-report&discussion[private]=1&discussion[title]=";

    var domain = "<enter URL of webpage here>";
    if (options.url)
        domain = parseUri(options.url).hostname;
    result = result + encodeURIComponent("Ad report: " + domain);

    var body = [];
    var count = 1;
    body.push("Last step -- point me to the ad so I can fix the bug! " +
              "Don't leave anything out or I'll probably " +
              "have to ignore your report. Thanks!");
    body.push("");
    body.push("Also, if you can put your name (or a screen name) " +
              "and a contact email access in the boxes above, that would be great!");
    body.push("");
    body.push("We need the email so that we can contact you if we need more information " +
              "than what you give us in your report. Otherwise, we might not be able to fix it.");
    body.push("");
    if (!options.url) {
        body.push("**" + count + ". Paste the URL of the webpage showing an ad:** ");
        body.push("");
        body.push("");
        count++;
    }
    body.push("**" + count + ". Exactly where on that page is the ad? What does it " +
              "look like? Attach a screenshot, with the ad clearly marked, " +
              "if you can.**");
    body.push("");
    body.push("");
    count++;
    body.push("**" + count + ". If you have created the filter which removes reported ad, please paste it here:** ");
    body.push("");
    body.push("");
    count++;
    body.push("**" + count + ". Any other information that would be helpful, besides " +
              "what is listed below:** ");
    body.push("");
    body.push("");
    body.push("-------- Please don't touch below this line. ---------");
    body.push("");
    body.push("```");
    if (options.url) {
        body.push("=== URL with ad ===");
        body.push(options.url);
        body.push("");
    }
    body.push(debug_info);
    body.push("");
    body.push("=== Question Responses ===");
    var answers = $('span[class="answer"]');
    var text = $('div[class="section"]:visible');
    for (var i=0, n=1; i<answers.length, i<text.length; i++, n++) {
        body.push(n+"."+text[i].id+": "+answers[i].getAttribute("chosen"));
    }
    body.push("```");
    body.push("");

    result = result + "&discussion[body]=" + encodeURIComponent(body.join('  \n')); // Two spaces for Markdown newlines

    return result;
}

// Check every domain of downloaded resource against malware-known domains
var checkmalware = function() {
    BGcall("get_frameData", tabId, function(frameData) {
        if (!frameData)
            return;

        var frames = [];
        var loaded_resources = [];
        var extracted_domains = [];
        var infected = null;

        // Get all loaded frames
        if (!SAFARI) {
            // Get all loaded frames
            for (var object in frameData) {
                if (!isNaN(object))
                    frames.push(object);
            }
            // Push loaded resources from each frame into an array
            for (var i=0; i < frames.length; i++) {
                if (Object.keys(frameData[frames[i]].resources).length !== 0)
                    loaded_resources.push(frameData[frames[i]].resources);
            }
        } else {
            // Push loaded resources into an array
            if (Object.keys(frameData.resources).length !== 0)
                loaded_resources.push(frameData.resources);
        }

        // Extract domains from loaded resources
        for (var i=0; i < loaded_resources.length; i++) {
            for (var key in loaded_resources[i]) {
                // Push just domains, which are not already in extracted_domains array
                if (SAFARI) {
                    var resource = key.split(':|:');
                    if (resource &&
                        resource.length === 2 &&
                        extracted_domains.indexOf(parseUri(resource[1]).hostname) === -1) {
                        extracted_domains.push(parseUri(resource[1]).hostname);
                    }
                } else {
                    if (extracted_domains.indexOf(parseUri(key).hostname) === -1) {
                        extracted_domains.push(parseUri(key).hostname);
                    }
                }
            }
        }

        // Compare domains of loaded resources with domain.json
        for (var i=0; i < extracted_domains.length; i++) {
            if (malwareDomains &&
                extracted_domains[i] &&
                malwareDomains[extracted_domains[i].charAt(0)] &&
                malwareDomains[extracted_domains[i].charAt(0)].indexOf(extracted_domains[i]) > -1) {
                // User is probably infected by some kind of malware,
                // because resource has been downloaded from malware/adware/spyware site.
                var infected = true;
            }
        }
        $('.loader').hide();
        if (infected) {
            $('#step_update_filters_DIV').hide();
            $("#malwarewarning").html(translate("malwarewarning"));
            $("a", "#malwarewarning").attr("href", "http://support.getadblock.com/kb/im-seeing-an-ad/im-seeing-similar-ads-on-every-website/");
        } else {
            $('#step_update_filters_DIV').show();
            $("#malwarewarning").html(translate("malwarenotfound"));
        }
        $('#malwarewarning').show();
    });
}

// Auto-scroll to bottom of the page
$("input, select").change(function(event) {
    event.preventDefault();
    $("html, body").animate({ scrollTop: 15000 }, 50);
});



// STEP 1: Malware/adware detection
var checkAdvanceOptions = function() {
    // Check, if downloaded resources are available,
    // if not, just reload tab with parsed tabId
    BGcall("get_settings", function(settings) {

        // We can't do a malware check when content blocking is enabled, so skip it.
        if (settings.safari_content_blocking) {
            $("#step_malware_checking_DIV").hide();
            $('#step_update_filters_DIV').show();
            return;
        } else if (SAFARI) {
            $("#step_malware_checking_DIV").show();
        }

        if (settings.show_advanced_options) {
            checkmalware();
        } else {
            BGcall("set_setting", "show_advanced_options");
            BGcall("reloadTab", parseInt(tabId));
            chrome.extension.onRequest.addListener(
                function(message, sender, sendResponse) {
                    if (message.command  === "reloadcomplete") {
                        BGcall("disable_setting", "show_advanced_options");
                        checkmalware();
                        sendResponse({});
                    }
                }
            );
        }
    });
}

// Fetch file with malware-known domains
var fetchMalware = function() {
    var xhr = new XMLHttpRequest();
    // The timestamp is add to the URL to prevent caching by the browser
    xhr.open("GET", "https://data.getadblock.com/filters/domains.json?timestamp=" + new Date().getTime(), true);
    xhr.onload = function() {
        if (xhr.readyState === 4 && xhr.status === 200) {
            var parsedText = JSON.parse(xhr.responseText);
            var domains = parsedText.adware;
            var result = {};
            for (var i=0; i < domains.length; i++) {
                var domain = domains[i];
                var char = domain.charAt(0);
                if (!result[char]) {
                    result[char] = [];
                }
                result[char].push(domain);
            }
            malwareDomains = result;
            checkAdvanceOptions();
        }
    };
    xhr.send();
}
//Attempt to get the malwareDomains from the background page first
//if the returned domains is null, then fetch them directly from the host.
BGcall('getMalwareDomains', function(domains) {
    if (domains) {
        malwareDomains = domains;
        checkAdvanceOptions();
    } else {
        fetchMalware();
    }
});

var domain = parseUri(options.url).hostname.replace(/((http|https):\/\/)?(www.)?/g, "");
var tabId = options.tabId.replace(/[^0-9]/g,'');

// STEP 2: update filters

//Updating the users filters
$("#UpdateFilters").click(function() {
    $(this).prop("disabled", true);
    BGcall("update_subscriptions_now", function() {
        $(".afterFilterUpdate input").prop('disabled', false);
        $(".afterFilterUpdate").removeClass('afterFilterUpdate');
    });
});
//if the user clicks a radio button
$("#step_update_filters_no").click(function() {
    $("#step_update_filters").html("<span class='answer' chosen='no'>" + translate("no") + "</span>");
    $("#checkupdate").text(translate("adalreadyblocked"));
});
$("#step_update_filters_yes").click(function() {
    $("#step_update_filters").html("<span class='answer' chosen='yes'>" + translate("yes") + "</span>");
    // If the user is subscribed to Acceptable Ads, ask them to unsubscribe, and recheck the page
    BGcall('get_subscriptions_minus_text', function(subs) {
        //if the user is subscribed to Acceptable-Ads, ask them to disable it
        if (subs && subs["acceptable_ads"] && subs["acceptable_ads"].subscribed) {
          $('#step_update_aa_DIV').show();
          $(".odd").css("background-color", "#f8f8f8");
        } else {
          $("#step_disable_extensions_DIV").fadeIn().css("display", "block");
          $(".even").css("background-color", "#f8f8f8");
        }
        $("#malwarewarning").html(translate("malwarenotfound"));
    });
});

// STEP 3: disable AA - IF enabled...

$("#DisableAA").click(function() {
    $(this).prop("disabled", true);
    BGcall("unsubscribe", {id:"acceptable_ads", del:false}, function() {
        // display the Yes/No buttons
        $(".afterDisableAA input").prop('disabled', false);
        $(".afterDisableAA").removeClass('afterDisableAA');
    });
});

//if the user clicks a radio button
$("#step_update_aa_no").click(function() {
    $("#step_update_aa").html("<span class='answer' chosen='no'>" + translate("no") + "</span>");
    $("#checkupdate").text(translate("aamessageadreport"));
    $("#checkupdatelink").text(translate("aalinkadreport"));
    $("#checkupdatelink_DIV").fadeIn().css("display", "block");

});
$("#step_update_aa_yes").click(function() {
    $("#step_update_aa").html("<span class='answer' chosen='yes'>" + translate("yes") + "</span>");
    $("#step_disable_extensions_DIV").fadeIn().css("display", "block");
});

// STEP 4: disable all extensions

//Code for displaying the div is in the $function() that contains localizePage()
//after user disables all extensions except for AdBlock
//if the user clicks a radio button
$("#step_disable_extensions_no").click(function() {
  $("#step_disable_extensions").html("<span class='answer' chosen='no'>" + translate("no") + "</span>");
  $("#checkupdate").text(translate("reenableadsonebyone"));
});
$("#step_disable_extensions_yes").click(function() {
  $("#step_disable_extensions").html("<span class='answer' chosen='yes'>" + translate("yes") + "</span>");
  $("#step_language_DIV").fadeIn().css("display", "block");
  if (extensionsDisabled.length > 0) {
    chrome.permissions.request({
        permissions: ['management']
    }, function(granted) {
        // The callback argument will be true if the user granted the permissions.
        if (granted) {
          for (var i = 0; i < extensionsDisabled.length; i++) {
            chrome.management.setEnabled(extensionsDisabled[i], true);
          }
          alert(translate('enableotherextensionscomplete'));
        } else {
          alert(translate('manuallyenableotherextensions'));
        }
    });
  }
});
//Automatically disable / enable other extensions
$("#OtherExtensions").click(function() {
    $("#OtherExtensions").prop("disabled", true);
    if (!SAFARI) {
      chrome.permissions.request({
          permissions: ['management']
      }, function(granted) {
          // The callback argument will be true if the user granted the permissions.
          if (granted) {
            //remove the Yes/No buttons, so users don't click them to soon.
            $("#step_disable_extensions").fadeOut().css("display", "none");
            chrome.management.getAll(function(result) {
              for (var i = 0; i < result.length; i++) {
                if (result[i].enabled &&
                    result[i].mayDisable &&
                    result[i].id !== "gighmmpiobklfepjocnamgkkbiglidom" &&
                    result[i].id !== "aobdicepooefnbaeokijohmhjlleamfj" &&
                    result[i].id !== "pljaalgmajnlogcgiohkhdmgpomjcihk") {
                  //if the extension is a developer version, continue, don't disable.
                  if (result[i].installType === "development" &&
                      result[i].type === "extension" &&
                      result[i].name === "AdBlock") {
                    continue;
                  }
                  chrome.management.setEnabled(result[i].id, false);
                  extensionsDisabled.push(result[i].id);
                }
              }
              chrome.permissions.remove({
                  permissions: ['management']
              }, function(removed) { });
              var alertDisplayed = false;
              alert(translate('disableotherextensionscomplete'));
              chrome.extension.onRequest.addListener(
                function(message, sender, sendResponse) {
                  if (!alertDisplayed && message.command  === "reloadcomplete") {
                    alertDisplayed = true;
                    alert(translate('tabreloadcomplete'));
                    //we're done, redisplay the Yes/No buttons
                    $("#step_disable_extensions").fadeIn().css("display", "block");
                    sendResponse({});
                  }
                }
              );
              BGcall("reloadTab", parseInt(tabId));
            });// end of chrome.management.getAll()
          } else {
            $("#OtherExtensions").prop("disabled", false);
          }
      });// end of chrome.permissions.request()
    }
});

// STEP 5: language

//if the user clicks an item
var contact = "";
$("#step_language_lang").change(function() {
    var selected = $("#step_language_lang option:selected");
    $("#step_language").html("<span class='answer'>"+ selected.text() +"</span>");
    $("#step_language span").attr("chosen",selected.attr("i18n"));
    if (selected.text() == translate("other")) {
        $("#checkupdate").html(translate("nodefaultfilter1"));
        $("#link").html(translate("here")).attr("href", "https://adblockplus.org/en/subscriptions");
        return;
    } else {
        var required_lists = selected.attr('value').split(';');
        for (var i=0; i < required_lists.length - 1; i++) {
            if (unsubscribed_default_filters[required_lists[i]]) {
                $("#checkupdate").text(translate("retryaftersubscribe", [translate("filter" + required_lists[i])]));
                return;
            }
        }
    }
    contact = required_lists[required_lists.length-1];

    $("#step_firefox_DIV").fadeIn().css("display", "block");
    $("#checkinfirefox1").html(translate("checkinfirefox_1"));
    $("#checkinfirefox2").html(translate("checkinfirefox_2"));
    $("#checkinfirefox").html(translate("checkinfirefoxtitle"));
    if (SAFARI) {
        $("#chrome1, #chrome2").html(translate("orchrome"));
        $("#adblockforchrome").html(translate("oradblockforchrome"));
    }
});

// STEP 6: also in Firefox

//If the user clicks a radio button
$("#step_firefox_yes").click(function() {
    $("#step_firefox").html("<span class='answer' chosen='yes'>" + translate("yes") + "</span>");
    if (/^mailto\:/.test(contact))
        contact = contact.replace(" at ", "@");
    var reportLink = "<a href='" + contact + "'>" + contact.replace(/^mailto\:/, '') + "</a>";
    $("#checkupdate").html(translate("reportfilterlistproblem", [reportLink]));
    $("#privacy").show();
});
$("#step_firefox_no").click(function() {
    $("#step_firefox").html("<span class='answer' chosen='no'>" + translate("no") + "</span>");
    if (SAFARI) {
        // Safari can't block video ads
        $("#step_flash_DIV").fadeIn().css("display", "block");
    } else {
        $("#checkupdate").html(translate("reporttous2"));
        $("#privacy").show();
        $("a", "#checkupdate").attr("href", generateReportURL());
        $("a", "#checkupdate").click(function(event) {
          //we have our own click handler for the anchor tag, so that we
          //can ask retrieve other extension info.
          event.preventDefault();
          var currentHREF = $("a", "#checkupdate").attr("href");
          var askUserToGatherExtensionInfo = function() {
            chrome.permissions.request({
              permissions: ['management']
            }, function(granted) {
              // The callback argument will be true if the user granted the permissions.
              if (granted) {
                chrome.management.getAll(function(result) {
                  var extInfo = [];
                  extInfo.push("");
                  extInfo.push("```");
                  extInfo.push("==== Extension and App Information ====");
                  for (var i = 0; i < result.length; i++) {
                    extInfo.push("Number " + (i + 1));
                    extInfo.push("  name: " + result[i].name);
                    extInfo.push("  id: " + result[i].id);
                    extInfo.push("  version: " + result[i].version);
                    extInfo.push("  enabled: " + result[i].enabled)
                    extInfo.push("  type: " + result[i].type);
                    extInfo.push("");
                  }
                  extInfo.push("```");
                  extInfo.push("");
                  currentHREF = currentHREF + encodeURIComponent(extInfo.join('  \n'));
                  chrome.permissions.remove({
                    permissions: ['management']
                  }, function(removed) {});
                  document.location.href = currentHREF;
                });
              } else {
                //user didn't grant us permission, just go to site...
                document.location.href = currentHREF;
              }
            });
        };//end of permission request
        if (chrome &&
            chrome.tabs &&
            chrome.tabs.detectLanguage) {
          chrome.tabs.detectLanguage(parseInt(tabId), function(language) {
            if (language) {
              var extInfo = [];
              extInfo.push("");
              extInfo.push("```");
              extInfo.push("Detected language of page: ");
              extInfo.push(language);
              extInfo.push("```");
              extInfo.push("");
              currentHREF = currentHREF + encodeURIComponent(extInfo.join('  \n'));
            }
            askUserToGatherExtensionInfo();
          });//end of detectLanguage
        } else {
          askUserToGatherExtensionInfo();
        }
      });//end of click handler
    }
});
$("#step_firefox_wontcheck").click(function() {
    if (!SAFARI) {
        // Chrome blocking is good enough to assume the answer is 'yes'
        $("#step_firefox_yes").click();
    } else {
        // Safari can't do this.
        $("#checkupdate").text(translate("fixityourself"));
    }
    $("#step_firefox").html("<span class='answer' chosen='wont_check'>" + translate("refusetocheck") + "</span>");
});

// STEP 7: video/flash ad (Safari-only)

//If the user clicks a radio button
$("#step_flash_yes").click(function() {
    $("#step_flash").html("<span class='answer' chosen='yes'>" + translate("yes") + "</span>");
    $("#checkupdate").text(translate("cantblockflash"));
});
$("#step_flash_no").click(function() {
    $("#step_flash").html("<span class='answer' chosen='no'>" + translate("no") + "</span>");
    $("#checkupdate").html(translate("reporttous2"));
    $("a", "#checkupdate").attr("href", generateReportURL());
    $("#privacy").show();
});

checkupdates("adreport");
