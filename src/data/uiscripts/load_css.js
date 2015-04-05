"use strict";

//Binds keypress enter to trigger click action on
//default button or trigger click action on focused
//button.
function bind_enter_click_to_default(){
  if (window.GLOBAL_ran_bind_enter_click_to_default)
    return;
  window.GLOBAL_ran_bind_enter_click_to_default = true;
  $('html').bind('keypress', function(event){
    if (event.keyCode === 13 && $('button:focus').size() <= 0){
      event.preventDefault();
      $('.adblock_default_button').filter(':visible').click();
    }
  });
}

function load_jquery_ui(callback) {
    function addCSSLinks(src) {
            load_css(src);
    }
    addCSSLinks("jquery/css/override-page.css");
    addCSSLinks("jquery/css/jquery-ui.css");

    callback();
}

// Set RTL for Arabic and Hebrew users in blacklist and whitelist wizards
var text_direction = (function() {
    var language = "";
    if ((typeof navigator.language !== 'undefined') &&
        navigator.language)
        language = navigator.language.match(/^[a-z]+/i)[0];
    return language === "ar" || language === "he" ? "rtl":"ltr";
})();

function changeTextDirection($selector) {
    $selector.attr("dir", text_direction);
    if (text_direction === "rtl") {
        $(".ui-dialog .ui-dialog-buttonpane .ui-dialog-buttonset").css("float", "left");
        $(".ui-dialog .ui-dialog-title").css("float", "right");
        $(".ui-dialog .ui-dialog-titlebar").css("background-position", "right center");
        $(".ui-dialog .ui-dialog-titlebar-close").css({left: "0.3em", right: "initial"});
    }
}
