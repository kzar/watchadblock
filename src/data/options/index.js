"use strict";

function load_options() {

    // Check or uncheck each option.
    BGcall("get_settings", function (settings) {
        optionalSettings = settings;

        localizePage();

        var currTabIndex = $.cookie('adblock_optiontab_index');
        if (!currTabIndex) {
            currTabIndex = 0;
            $.cookie('adblock_optiontab_index', currTabIndex, {expires: (1 / 48)});
        }
        $("#tabpages").tabs({
            active: currTabIndex,
            activate: function (event, ui) {
                $.cookie('adblock_optiontab_index', ui.newTab.index(), {expires: (1 / 48)});
            }
        }).show();
        if (!optionalSettings.show_advanced_options)
            $(".advanced").hide();

        //initialze each tab
        generalInit();
        filtersInit();
        customizeInit();
        supportInit();

    });
}

var language = "";
if ((typeof navigator.language !== 'undefined') &&
    navigator.language)
    language = navigator.language.match(/^[a-z]+/i)[0];


function rightToLeft() {
    if (language === "ar" || language === "he") {
        $(window).resize(function () {
            if ($(".social").is(":hidden")) {
                $("#translation_credits").css({margin: "0px 50%", width: "350px"});
                $("#paymentlink").css({margin: "0px 50%", width: "350px"});
                $("#version_number").css({margin: "20px 50%", width: "350px"});
            } else {
                $("#translation_credits").css("right", "0px");
                $("#paymentlink").css("right", "0px");
                $("#version_number").css({right: "0px", padding: "0px"});
            }
        });
        $("li").css("float", "right");
        $("#small_nav").css({right: "initial", left: "45px"});
        $(".ui-tabs .ui-tabs-nav li").css("float", "right");
    } else {
        $(".ui-tabs .ui-tabs-nav li").css("float", "left");
    }
}

function showMiniMenu() {
    $("#small_nav").click(function () {
        if ($(".ui-tabs-nav").is(":hidden")) {
            $(".ui-tabs .ui-tabs-nav li").css("float", "none");
            $(".ui-tabs-nav").fadeIn("fast");
            if (language === "ar" || language === "he") {
                $(".ui-tabs-nav").css({right: "auto", left: "40px"});
            }
        } else
            $(".ui-tabs-nav").fadeOut("fast");
    });
    $(window).resize(function () {
        if ($(".ui-tabs-nav").is(":hidden") && $("#small_nav").is(":hidden")) {
            if (language === "ar" || language === "he") {
                $(".ui-tabs .ui-tabs-nav li").css("float", "right");
                $(".ui-tabs-nav").css({right: "auto", left: "auto"});
            } else {
                $(".ui-tabs .ui-tabs-nav li").css("float", "left");
            }
            $(".ui-tabs-nav").show();
        } else if ($("#small_nav").is(":visible"))
            $(".ui-tabs-nav").hide();
    });
}

function setUserId() {
    BGcall("storage_get", "userid", function (userId) {
        var paymentHREFhref = "https://getadblock.com/pay/?source=O&u=" + userId;
        $("#paymentlink").attr("href", paymentHREFhref);
    });
}

function displayTranslationCredit() {

    if (navigator.language.substring(0, 2) != "en") {
        var translators = [];
        var xhr = new XMLHttpRequest();
        xhr.open("GET", "../translators.json", true);
        xhr.onload = function () {
            var fullLang = navigator.language.toLowerCase();
            var partialLang = fullLang.substring(0, 2);
            var chromeLang = partialLang + "-" + partialLang;
            var text = JSON.parse(xhr.responseText);

            for (var id in text) {
                if (partialLang === id) {
                    for (var translator in text[id].translators) {
                        var name = text[id].translators[translator].credit;
                        translators.push(" " + name);
                    }
                } else if (chromeLang === id) {
                    for (var translator in text[id].translators) {
                        var name = text[id].translators[translator].credit;
                        translators.push(" " + name);
                    }
                } else {
                    for (var translator in text[id].translators) {
                        if (fullLang === id) {
                            var name = text[fullLang].translators[translator].credit;
                            translators.push(" " + name);
                        }
                    }
                }
            }
            $("#translator_credit").text(translate("translator_credit"));
            $("#translator_names").text(translators.toString());
        };
        xhr.send();
    }
}

function displayVersionNumber() {
    BGcall("getFirefoxManifest", function (manifest) {
        $("#version_number").text(translate("optionsversion", [manifest.version]));
    });
}


var optionalSettings = {};
$(document).ready(function () {

    chrome.i18n.initializeL10nData(function () {

        load_options();
        rightToLeft();
        showMiniMenu();
        displayVersionNumber();
        setUserId();
        displayTranslationCredit();
    });
});
