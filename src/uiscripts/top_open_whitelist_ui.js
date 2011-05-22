// Global lock so we can't open more than once on a tab.
if (typeof may_open_dialog_ui === "undefined")
    may_open_dialog_ui = true;

function top_open_whitelist_ui() {
  if (!may_open_dialog_ui)
    return;
  var domain = document.location.hostname;

  // defined in blacklister.js
  load_jquery_ui(function() {
    may_open_dialog_ui = false;

    var btns = {};
    btns[translate("buttoncancel")] = function() { page.dialog('close');}
    btns[translate("buttonexclude")] = 
        function() {
          var filter = '@@||' + generateUrl() + '$document';
          BGcall('add_custom_filter', filter, function() {
            document.location.reload();
          });
        }

    var page = $("<div>").
      append(translate('whitelistertext1')).
      append('<br/><i></i>').
      append('<br/><br/><div id="modifydomain">' + translate('modifydomain') +
      "<input id='domainslider' type='range' min='0' value='0'/></div>").
      append('<div id="modifylocation">' + translate('modifylocation') +
      "<input id='locationslider' type='range' min='0' value='0'/></div>").
      dialog({
        title: translate("whitelistertitle"),
        width: "400px",
        minHeight: 50,
        buttons: btns,
        close: function() {
          may_open_dialog_ui = true;
          page.remove();
        }
      });

    var domainparts = domain.split('.');
    if (domainparts[domainparts.length - 2] == "co") {
      var newTLD = "co." + domainparts[domainparts.length - 1];
      domainparts.splice(domainparts.length - 2, 2, newTLD);
    }
    var location = document.location.href.match(/\w+\:\/\/[^\/]+(.*?)(\/?)(\?|$)/);
    var locationparts = location[1].split('/');

    // Don't show the domain slider on
    // - sites without a third level domain name (e.g. foo.com)
    // - sites with an ip domain (e.g. 1.2.3.4)
    // Don't show the location slider on domain-only locations
    if (domainparts.length == 2 || /^(\d+\.){3}\d+$/.test(domain))
      $("#modifydomain", page).css("display", "none !important");
    if (!location[1])
      $("#modifylocation", page).css("display", "none !important");
    
    $("#domainslider", page).
      css('width', '354px').
      attr("max", Math.max(domainparts.length - 2, 1)).
      change(function() {generateUrl(true);});
    $("#locationslider", page).
      css('width', '354px').
      attr("max", Math.max(locationparts.length - 1, 1)).
      change(function() {generateUrl(true);});


    // Generate the URL. If forDisplay is true, then it will truncate long URLs
    function generateUrl(forDisplay) {
      var result = "";
      var domainsliderValue = $("#domainslider", page)[0].valueAsNumber;
      var locationsliderValue = $("#locationslider", page)[0].valueAsNumber;

      // Make clear that it includes subdomains
      if (forDisplay && domainsliderValue != 0)
        result = "*.";

      // Append the chosen parts of a domain
      for (var i = domainsliderValue; i<=(domainparts.length - 2); i++) 
        result += domainparts[i] + '.';
      result += domainparts[domainparts.length - 1];
      for (var i = 1; i<=locationsliderValue; i++) 
        result += '/' + locationparts[i];

      // Append a final slash for for example filehippo.com/download_dropbox/
      if (locationparts.length != locationsliderValue + 1 || !location[1]) {
        result += "/";
        if (forDisplay)
          result += "*";
      } else {
        if (location[2])
          result += location[2];
      }

      if (forDisplay) {
        result = result.replace(/(\/[^\/]{6})[^\/]{3,}([^\/]{6})/g, '$1...$2');
        if (result.indexOf("/") > 30 && result.length >=60)
          result = result.replace(/^([^\/]{20})[^\/]+([^\/]{6}\/)/, '$1...$2')
        while (result.length >= 60)
          result = result.replace(/(\/.{4}).*?\/.*?(.{4})(?:\/|$)/, '$1...$2/');
        $("i", page).text(result);
      } else
        return result;
    }
    generateUrl(true);
  });
}
