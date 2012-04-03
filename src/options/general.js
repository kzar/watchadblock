// Check or uncheck each loaded DOM option checkbox according to the 
// user's saved settings.
$(function() {
  for (var name in optionalSettings) {
    $("#enable_" + name).
      attr("checked", optionalSettings[name]);
  }
  $("input.feature:checkbox").change(function() {
    var is_enabled = $(this).is(':checked');
    var name = this.id.substring(7); // TODO: hack
    BGcall("set_setting", name, is_enabled);
  });
});


// TODO: This is a dumb race condition, and still has a bug where
// if the user reloads/closes the options page within a second
// of clicking this, the filters aren't rebuilt.  Call this inside
// the feature change handler if it's this checkbox being clicked.
$("#enable_show_google_search_text_ads").change(function() {
  // Give the setting a sec to get saved by the other
  // change handler before recalculating filters.
  window.setTimeout(function() { 
    BGcall("update_filters");
  }, 1000);
});

function init_picreplacement() {
  BGcall("picreplacement_show_on_options_page", function(show) {
    var p = $("#picreplacement");
    p.toggle(show);
    p.find("[i18n]").each(function() {
      $(this).text(picreplacement.translate($(this).attr("i18n")));
    });
    p.find("a").prop("href", picreplacement.translate("the_url"));
  });
}
init_picreplacement();
// Labels fall off on tab change for some reason: redo them.
$("#tabpages").bind("tabsshow", init_picreplacement);
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

$("#enable_show_advanced_options").change(function() {
  // Reload the page to show or hide the advanced options on the
  // options page -- after a moment so we have time to save the option.
  // Also, disable all advanced options, so that non-advanced users will
  // not end up with debug/beta/test options enabled.
  if (!this.checked)
    $(".advanced :checkbox:checked").each(function() {
      BGcall("set_setting", this.id.substr(7), false);
    });
  window.setTimeout(function() {
    window.location.reload();
  }, 50);
});

// picreplacement: Replace missing CatBlock checkbox with a message for those who are confused about where to find it.
if (Date.now() >= new Date(2012, 3, 4) && !storage_get("saw_catblock_explanation_options_msg")) {
  $("#catblock-explanation").show();
  $("#catblock-explanation-close").click(function() {
    $("#catblock-explanation").slideUp();
    storage_set('saw_catblock_explanation_options_msg', true);
  });
}
