$(function() {
  localizePage();

  $("#disable_update_check").click(function() {
    BGcall("disableUpdateCheck");
    window.close();
  });

  $("#close").click(function() {
    window.close();
  })
});
