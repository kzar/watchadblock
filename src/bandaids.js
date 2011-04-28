BGcall("get_settings_and_enabled_state", function(data) {
  // Tests to determine whether a particular bandaid should be applied
  if (!data.enabled)
    return;
  var apply_bandaid_for = "";
  if (/mail\.live\.com/.test(document.location.host))
    apply_bandaid_for = "hotmail";
  else if (/\.hk-pub\.com\/forum\/thread\-/.test(document.location.href))
    apply_bandaid_for = "hkpub";

  var bandaids = {
    hotmail: function() {
      //removing the space remaining in Hotmail/WLMail
      $(".Unmanaged .WithSkyscraper #MainContent").
        css("margin-right", "1px");
      $(".Managed .WithSkyscraper #MainContent").
        css("right", "1px");
    },

    hkpub: function() {
      //issue 3971: due to 'display:none' the page isn't displayed correctly
      $("#AutoNumber1").
        css("width", "100%").
        css("margin", "0px");
    }

  }; // end bandaids

  if (apply_bandaid_for) {
    log("Running bandaid for " + apply_bandaid_for);
    bandaids[apply_bandaid_for]();
  }
});
