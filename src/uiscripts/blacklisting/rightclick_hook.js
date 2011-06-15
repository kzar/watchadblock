// Record the last element to be right-clicked, since that information isn't
// passed to the contextmenu click handler that calls top_open_blacklist_ui
var rightclicked_item = null;
$("body").bind("contextmenu", function(e) {
  rightclicked_item = e.srcElement;
}).click(function() {
  rightclicked_item = null;
});
