"use strict";

//get the list of subscribed filters and
//all unsubscribed default filters
var unsubscribed_default_filters = [];
var subscribed_filter_names = [];
var enabled_settings = [];
var malwareDomains = {};

// Get debug info
var debug_info;
BGcall("getDebugInfo", function (info) {
    debug_info = info;
});

// Auto-scroll to bottom of the page
$('input[type=radio]').click(function (event) {
    event.preventDefault();
    $("html, body").animate({scrollTop: $(document).height()}, "slow");
});

// Auto-scroll to bottom of the page
$('select').change(function (event) {
    event.preventDefault();
    $("html, body").animate({scrollTop: $(document).height()}, "slow");
});


$(document).ready(function () {

    chrome.i18n.initializeL10nData(function () {

        localizePage();

        BGcall("get_subscriptions_minus_text", function (subs) {
            for (var id in subs)
                if (!subs[id].subscribed && !subs[id].user_submitted)
                    unsubscribed_default_filters[id] = subs[id];
                else if (subs[id].subscribed)
                    subscribed_filter_names.push(id);
        });

        BGcall("get_settings", function (settings) {
            for (var setting in settings)
                if (settings[setting])
                    enabled_settings.push(setting);
        });

        //Shows the instructions for how to enable all extensions according to the browser of the user
        $(".chrome_only").hide();

        // Sort the languages list
        var languageOptions = $("#step_language_lang option");
        var currentlySelectedOption = $("#step_language_lang > option[selected]");
        languageOptions.sort(function (a, b) {
            if (!a.text) return -1;
            if (!b.text) return 1; // First one is empty
            if (!a.value) return 1;
            if (!b.value) return -1; // 'Other' at the end
            if (a.getAttribute("i18n") == "lang_english") return -1; // English second
            if (b.getAttribute("i18n") == "lang_english") return 1;
            return (a.text > b.text) ? 1 : -1;
        });
        $("#step_language_lang").empty().append(languageOptions);
        $("#step_language_lang").val(currentlySelectedOption.val());

        var domain = parseUri(args.url).hostname.replace(/((http|https):\/\/)?(www.)?/g, "");
        var tabId = args.tabId;
        // STEP 1: Malware/adware detection
        // Fetch file with malware-known domains
        chrome.extension.onRequest.addListener(function (request, sender) {
            if (request && request.command === "malware_domains") {
                malwareDomains = request.data;
                // Check, if downloaded resources are available,
                // if not, just reload tab with parsed tabId
                BGcall("get_settings", "show_advanced_options", function (status) {
                    if (status.show_advanced_options) {
                        checkForMalware();
                    } else {
                        BGcall("set_setting", "show_advanced_options", true);
                        BGcall("reloadTab", tabId);
                        chrome.extension.onRequest.addListener(function (request, sender) {
                            if (request && request.command === "reloadcomplete") {
                                checkForMalware();
                                BGcall("set_setting", "show_advanced_options", false);
                            }
                        });
                    }
                });
            }
        });
        BGcall("getMalwareDomains");
    });
});

// STEP 2: update filters

//Updating the users filters
$("#UpdateFilters").click(function () {
    $(this).attr("disabled", "disabled");
    BGcall("update_subscriptions_now", function () {
        $(".afterFilterUpdate input").removeAttr('disabled');
        $(".afterFilterUpdate").removeClass('afterFilterUpdate');
    });
});
//if the user clicks a radio button
$("#step_update_filters_no").click(function () {
    $("#step_update_filters").children().remove();
    var newSpan = document.createElement("span");
    newSpan.setAttribute("class", "answer");
    newSpan.setAttribute("chosen", "no");
    var textNode = document.createTextNode(translate("no"));
    newSpan.appendChild(textNode);
    $("#step_update_filters").append(newSpan);
    $("#checkupdate").text(translate("adalreadyblocked"));
});
$("#step_update_filters_yes").click(function () {
    $("#step_update_filters").children().remove();
    var newSpan = document.createElement("span");
    newSpan.setAttribute("class", "answer");
    newSpan.setAttribute("chosen", "yes");
    var textNode = document.createTextNode(translate("yes"));
    newSpan.appendChild(textNode);

    $("#step_update_filters").append(newSpan);
    $("#step_disable_extensions_DIV").fadeIn().css("display", "block");
});

// STEP 3: disable all extensions

//Code for displaying the div is in the $function() that contains localizePage()
//after user disables all extensions except for AdBlock
//if the user clicks a radio button
$("#step_disable_extensions_no").click(function () {
    $("#step_disable_extensions").children().remove();
    var newSpan = document.createElement("span");
    newSpan.setAttribute("class", "answer");
    newSpan.setAttribute("chosen", "no");
    var textNode = document.createTextNode(translate("no"));
    newSpan.appendChild(textNode);
    $("#step_disable_extensions").append(newSpan);
    $("#checkupdate").text(translate("reenableadsonebyone"));
});
$("#step_disable_extensions_yes").click(function () {
    $("#step_disable_extensions").children().remove();
    var newSpan = document.createElement("span");
    newSpan.setAttribute("class", "answer");
    newSpan.setAttribute("chosen", "yes");
    var textNode = document.createTextNode(translate("yes"));
    newSpan.appendChild(textNode);
    $("#step_disable_extensions").append(newSpan);
    $("#step_language_DIV").fadeIn().css("display", "block");
});

// STEP 4: language
//if the user clicks an item
var contact = "";
$("#step_language_lang").change(function () {
    var selected = $("#step_language_lang option:selected");
    $("#step_language").children().remove();
    var newSpan = document.createElement("span");
    newSpan.setAttribute("class", "answer");
    var textNode = document.createTextNode(selected.text());
    newSpan.appendChild(textNode);
    $("#step_language").append(newSpan);
    $("#step_language span").attr("chosen", selected.attr("i18n"));
    if (selected.text() == translate("other")) {
        $("#checkupdate").text(translate("nodefaultfilter1"));
        $("#link").text(translate("here")).attr("href", "https://adblockplus.org/en/subscriptions");
        return;
    } else {
        var required_lists = selected.attr('value').split(';');
        for (var i = 0; i < required_lists.length - 1; i++) {
            if (unsubscribed_default_filters[required_lists[i]]) {
                $("#checkupdate").text(translate("retryaftersubscribe", [translate("filter" + required_lists[i])]));
                return;
            }
        }
    }
    contact = required_lists[required_lists.length - 1];

    $("#step_chrome_DIV").fadeIn().css("display", "block");
    $("#checkinchrome").text(translate("ff_checkinchrometitle"));
});

// STEP 5: also in Chrome

//If the user clicks a radio button
$("#step_other_browser_yes").click(function () {
    $("#step_other_browser").children().remove();
    var newSpan = document.createElement("span");
    newSpan.setAttribute("class", "answer");
    newSpan.setAttribute("chosen", "yes");
    var textNode = document.createTextNode(translate("yes"));
    newSpan.appendChild(textNode);
    $("#step_other_browser").append(newSpan);

    if (/^mailto\:/.test(contact))
        contact = contact.replace(" at ", "@");
    //var reportLink = "<a href='" + contact + "'>" + contact.replace(/^mailto\:/, '') + "</a>";
    var reportLink = "<a></a>";

    $("#checkupdate").append(translate("reportfilterlistproblem", [reportLink]));
    $("#checkupdate > a").prop("href", contact);
    $("#checkupdate > a").text(contact.replace(/^mailto\:/, ''));
    $("#privacy").show();
});

$("#step_other_browser_no").click(function () {
    $("#step_other_browser").children().remove();
    var newSpan = document.createElement("span");
    newSpan.setAttribute("class", "answer");
    newSpan.setAttribute("chosen", "no");
    var textNode = document.createTextNode(translate("no"));
    newSpan.appendChild(textNode);
    $("#step_other_browser").append(newSpan);

    $("#checkupdate").append(translate("reporttous2"));
    $("#checkupdate > a").prop("href", generateReportURL());
    $("#privacy").show();
});

$("#step_other_browser_wontcheck").click(function () {
    $("#step_other_browser_yes").click();
    var newSpan = document.createElement("span");
    newSpan.setAttribute("class", "answer");
    newSpan.setAttribute("chosen", "wont_check");
    var textNode = document.createTextNode(translate("refusetocheck"));
    newSpan.appendChild(textNode);
    $("#step_other_browser").append(newSpan);
});

// Check every domain of downloaded resource against malware-known domains
var checkForMalware = function () {
    BGcall("resourceblock_get_frameData", args.tabId, function (tab_frameData) {
        if (!tab_frameData)
            return;

        var frames = [];
        var loaded_resources = [];
        var extracted_domains = [];
        var infected = null;

        // Get all loaded frames
        for (var object in tab_frameData) {
            if (!isNaN(object))
                frames.push(object);
        }
        // Push loaded resources from each frame into an array
        for (var i = 0; i < frames.length; i++) {
            if (Object.keys(tab_frameData[frames[i]].resources).length !== 0)
                loaded_resources.push(tab_frameData[frames[i]].resources);
        }

        // Extract domains from loaded resources
        for (var i = 0; i < loaded_resources.length; i++) {
            for (var key in loaded_resources[i]) {
                // Push just domains, which are not already in extracted_domains array
                var resource = key.split(':|:');
                if (resource &&
                    resource.length == 2 &&
                    extracted_domains.indexOf(parseUri(resource[1]).hostname) === -1) {
                    extracted_domains.push(parseUri(resource[1]).hostname);
                }
            }
        }

        // Compare domains of loaded resources with domain.json
        for (var i = 0; i < extracted_domains.length; i++) {
            if (malwareDomains && malwareDomains.adware.indexOf(extracted_domains[i]) > -1) {
                // User is probably infected by some kind of malware,
                // because resource has been downloaded from malware/adware/spyware site.
                var infected = true;
            }
        }
        $('.gifloader').hide();
        if (infected) {
            $('#step_update_filters_DIV').hide();
            $("#malwarewarning").html(translate("malwarewarning"));
            $("a", "#malwarewarning").attr("href", "http://support.getadblock.com/kb/im-seeing-an-ad/im-seeing-similar-ads-on-every-website/")
        } else {
            $('#step_update_filters_DIV').show();
            $("#malwarewarning").html(translate("malwarenotfound"));
        }
        $('#malwarewarning').show();
    });
};

//generate the URL to the issue tracker
function generateReportURL() {
    var result = "https://adblock.tenderapp.com/discussion/new" +
        "?category_id=ad-report&discussion[private]=1&discussion[title]=";

    var domain = "<enter URL of webpage here>";

    if (args && args.url)
        domain = parseUri(args.url).hostname;
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
    if (!args || !args.url) {
        body.push(count + ". Paste the URL of the webpage showing an ad: ");
        body.push("");
        body.push("");
        count++;
    }
    body.push(count + ". Exactly where on that page is the ad? What does it " +
    "look like? Attach a screenshot, with the ad clearly marked, " +
    "if you can.");
    body.push("");
    body.push("");
    count++;
    body.push(count + ". If you have created the filter which removes reported ad, please paste it here: ");
    body.push("");
    body.push("");
    count++;
    body.push(count + ". Any other information that would be helpful, besides " +
    "what is listed below: ");
    body.push("");
    body.push("");
    body.push("-------- Please don't touch below this line. ---------");
    if (args && args.url) {
        body.push("=== URL with ad ===");
        body.push(args.url);
        body.push("");
    }
    body.push(debug_info);
    body.push("");
    body.push("=== Question Responses ===");
    var answers = $('span[class="answer"]');
    var text = $('div[class="section"]:visible');
    for (var i = 0, n = 1; i < answers.length, i < text.length; i++, n++) {
        body.push(n + "." + text[i].id + ": " + answers[i].getAttribute("chosen"));
    }
    body.push("");

    result = result + "&discussion[body]=" + encodeURIComponent(body.join('  \n')); // Two spaces for Markdown newlines

    return result;
}