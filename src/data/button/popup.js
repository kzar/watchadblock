"use strict";

// Set menu entries appropriately for the selected tab.
var shown = {};
const ADBLOCK_BUTTON_PANEL_WIDTH = 275;

function customize_for_this_tab(info) {
    shown = {};
    $(".menu-entry, .menu-status, .separator").hide();

    function show(L) {
        L.forEach(function (x) {
            shown[x] = true;
        });
    }

    function hide(L) {
        L.forEach(function (x) {
            shown[x] = false;
        });
    }

    show(["div_options", "separator2"]);
    if (info.adblock_is_paused) {
        show(["div_status_paused", "separator0", "div_paused_adblock", "div_options"]);
        hide(["block_counts"]);
    } else if (info.disabled_site) {
        show(["div_status_disabled", "separator0", "div_pause_adblock",
            "div_options", "div_help_hide_start"]);
        hide(["block_counts"]);
    } else if (info.whitelisted) {
        show(["div_status_whitelisted", "div_enable_adblock_on_this_page", "div_show_resourcelist",
            "separator0", "div_pause_adblock", "separator1",
            "div_options", "div_help_hide_start"]);
        hide(["block_counts"]);
    } else {
        show(["div_pause_adblock", "div_blacklist", "div_whitelist",
            "div_whitelist_page", "div_show_resourcelist",
            "div_report_an_ad", "separator1", "div_options",
            "div_help_hide_start", "separator3", "block_counts"]);

        var page_count = info.tab_blocked || "0";
        $("#page_blocked_count").text(page_count);
        $("#total_blocked_count").text(info.total_blocked);

        // Show help link until it is clicked.
        if (info.settings.show_block_counts_help_link) {
            $("#block_counts_help").click(function () {
                BGcall("set_setting", "show_block_counts_help_link", false);
                var url = $(this).attr("href");
                BGcall("openTab", url);
                $(this).hide();
            });
        }
    }

    if (!info.display_menu_stats) {
        hide(["block_counts"]);
    }

    if (info.tab) {
        var url = info.tab.url;
        var host = parseUri(url).host;
        var eligible_for_undo = !info.adblock_is_paused && (info.disabled_site || !info.whitelisted);
        if (eligible_for_undo) {
            var url_to_check_for_undo = info.disabled_site ? undefined : host;
            BGcall("getCustomFilterCount", url_to_check_for_undo, function(count) {
                if (count > 0) {
                    var popupHeight = parseInt(document.body.offsetHeight) + 40;
                    addon.port.emit("resizePopup", {width: ADBLOCK_BUTTON_PANEL_WIDTH, height: popupHeight});
                    $("#div_undo, #separator0").show();
                }
            });
        }

        if (!info.show_advanced_options) {
            hide(["div_show_resourcelist"]);
        }

        var url = info.tab.url;
        if (host === "www.youtube.com" &&
            /channel|user/.test(url) &&
            /ab_channel/.test(url) &&
            eligible_for_undo &&
            info &&
            info.youtube_channel_whitelist) {
            $("#div_whitelist_channel").html(translate("whitelist_youtube_channel",
                parseUri.parseSearch(url).ab_channel));
            show(["div_whitelist_channel"]);
        }
    }

    for (var div in shown) {
        if (shown[div])
            $('#' + div).show();
        else
            $('#' + div).hide();
    }

}

// Click handlers
$(function () {
    $("#div_enable_adblock_on_this_page").click(function () {
        BGcall("getCurrentTabInfo", function (info) {
            BGcall("try_to_unwhitelist", (info.tab.url), function (whitelist_info) {
                if (whitelist_info) {
                    BGcall("reloadTab", info.tab.id);
                    BGcall("updateButtonUIAndContextMenus");
                    addon.port.emit("close");
                } else {
                    $("#div_status_whitelisted").
                        replaceWith(translate("disabled_by_filter_lists"));
                }
            });
        });
    });

    $("#div_paused_adblock").click(function () {
        BGcall("adblock_is_paused", false);
        BGcall("updateButtonUIAndContextMenus");
        addon.port.emit("close");
    });

    $("#div_undo").click(function () {
        BGcall("getCurrentTabInfo", function (info) {
            var host = parseUri(info.tab.url).host;
            BGcall("confirm_removal_of_custom_filters_on_host", host);
            BGcall("updateButtonUIAndContextMenus");
            addon.port.emit("close");
        });
    });

    $("#div_whitelist_channel").click(function () {
        BGcall("getCurrentTabInfo", function (info) {
            BGcall("create_whitelist_filter_for_youtube_channel", info.tab.url);
            BGcall("reloadTab", info.tab.id);
            BGcall("updateButtonUIAndContextMenus");
            addon.port.emit("close");
        });
    });

    $("#div_pause_adblock").click(function () {
        BGcall("adblock_is_paused", true);
        BGcall("updateButtonUIAndContextMenus");
        addon.port.emit("close");
    });

    $("#div_blacklist").click(function () {
        BGcall("getCurrentTabInfo", function (info) {
            BGcall("emit_page_broadcast",
                {fn: 'top_open_blacklist_ui', options: {nothing_clicked: true}},
                {tab: info.tab} // fake sender to determine target page
            );
            addon.port.emit("close");
        });
    });

    $("#div_whitelist_page").click(function () {
        BGcall("getCurrentTabInfo", function (info) {
            BGcall("create_page_whitelist_filter", (info.tab.url), function (response) {
                BGcall("reloadTab", info.tab.id);
                BGcall("updateButtonUIAndContextMenus");
                addon.port.emit("close");
            });
        });
    });

    $("#div_whitelist").click(function () {
        BGcall("getCurrentTabInfo", function (info) {
            BGcall("emit_page_broadcast",
                {fn: 'top_open_whitelist_ui', options: {}},
                {tabId: info.tab.id} // fake sender to determine target page
            );
            addon.port.emit("close");
        });
    });

    $("#div_report_an_ad").click(function () {
        BGcall("getCurrentTabInfo", function (info) {
            var query = {
                tabId: info.tab.id,
                url: info.tab.url
            };
            BGcall("openAdReportTab", JSON.stringify(query));
            addon.port.emit("close");
        });
    });

    $("#div_show_resourcelist").click(function () {
        BGcall("getCurrentTabInfo", function (info) {
            var query = {tabId: info.tab.id};
            BGcall("openResourceBlockTab", JSON.stringify(query));
            addon.port.emit("close");
        });
    });

    $("#div_options").click(function () {
        BGcall("openOptionsTab");
        addon.port.emit("close");
    });

    $("#div_help_hide").click(function () {
        if ($("#help_hide_explanation").is(":visible")) {
            $("#help_hide_explanation").slideToggle(function () {
                var popupHeight = parseInt(document.body.offsetHeight) + 5;
                addon.port.emit("resizePopup", {width: ADBLOCK_BUTTON_PANEL_WIDTH, height: popupHeight});
            });
        } else {
            var popupHeight = parseInt(document.body.offsetHeight) + 60;
            addon.port.emit("resizePopup", {width: ADBLOCK_BUTTON_PANEL_WIDTH, height: popupHeight});
            $("#help_hide_explanation").slideToggle();
        }
    });

    //// Share - social links page click handlers
    $("#link_open").click(function () {
        addon.port.emit("openExternalTab", "https://getadblock.com/share/");
        addon.port.emit("close");
    });

    $("#titletext").click(function () {
        addon.port.emit("openExternalTab", "https://getadblock.com/");
        addon.port.emit("close");
    });

});

//initialization of listeners and internationalizations
$(document).ready(function () {
    addon.port.on("update_content", function (info) {
        customize_for_this_tab(info);
        localizePage();
        var popupHeight = parseInt(document.body.offsetHeight) + 5;
        addon.port.emit("resizePopup", {width: ADBLOCK_BUTTON_PANEL_WIDTH, height: popupHeight});
    });

    chrome.i18n.initializeL10nData(function () {
        localizePage();
    });
});
