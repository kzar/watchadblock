var BG = chrome.extension.getBackgroundPage();

// Set menu entries appropriately for the selected tab.
function customize_for_this_tab() {
  $(".menu-entry, .separator").hide();

  BG.getCurrentTabInfo(function(info) {
    var shown = {};
    function show(L) { L.forEach(function(x) { shown[x] = true;  }); }
    function hide(L) { L.forEach(function(x) { shown[x] = false; }); }

    show(["div_options", "separator2"]);
    if (BG.sessionStorage.getItem('adblock_is_paused')) {
      show(["div_status_paused", "separator0", "div_options"]);
    } else if (info.disabled_site) {
      show(["div_status_disabled", "separator0", "div_options", 
      "div_help_hide_start"]);
    } else if (info.whitelisted) {
      show(["div_status_whitelisted", "div_show_resourcelist", 
        "separator0", "div_pause_adblock", "separator1", 
      "div_options", "div_help_hide_start"]);
    } else {
      show(["div_pause_adblock", "div_blacklist", "div_whitelist", 
        "div_whitelist_page", "div_show_resourcelist", 
        "div_report_an_ad", "separator1", "div_options", 
      "div_help_hide_start", "separator3"]);
    }
    if (!BG.get_settings().show_advanced_options)
      hide(["separator3", "div_show_resourcelist", "div_report_an_ad"]);

    for (var div in shown)
      if (shown[div]) 
        $('#' + div).show();
      });
}

$(function() {
  customize_for_this_tab();
});
