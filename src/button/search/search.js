/* Paints the UI. */
window.onload = function() {
  const BG = chrome.extension.getBackgroundPage();
  const DESERIALIZE = BG.deserialize;
  const SEARCH_ENGINE_LABEL = 'search_engines';
  const CHK_MODE_SETTINGS_LABEL = 'search_chk_mode_set';
  const TXT_SEARCH = $('#txt_search');
  const TXT_DEFAULT_MESSAGE = 'Search privately';

  initialize();

  function initialize() {
    define_events();
    analytics();
    defaults_values();
  };

  function define_events() {
    $('.mode_settings').click(chkModeSettingsClick);
    $('#btn_search').click(submitSearch);
    $('#txt_search').keyup(submitSearch);
    $('#enable_show_secure_search').change(toggleActivateSearch);
    $(".question_mark").bind({
      mouseenter: showHelpImage,
      mouseleave: hideHelpImage
    });

    TXT_SEARCH.focus(function () { $(this).css('background-position', '0px -27px'); });
    TXT_SEARCH.blur(function () { $(this).css('background-position', '0px 0px'); });
  };

  function analytics() {
    //temporary omnibox/everywhere/secure usage analytics
    $('#omnibox-box').click(function() {
      var is_checked = $(this).is(':checked');
      localStorage.search_omnibox = is_checked ? "true" : "false";
      if (is_checked) {
        localStorage.search_omnibox_on = parseInt(localStorage.search_omnibox_on) + 1;
      } else {
        localStorage.search_omnibox_off = parseInt(localStorage.search_omnibox_off) + 1;
      }
    });

    $('#everywhere-box').click(function() {
      var is_checked = $(this).is(':checked');
      localStorage.search_everywhere = is_checked ? "true" : "false";
      if (is_checked) {
        localStorage.search_everywhere_on = parseInt(localStorage.search_everywhere_on) + 1;
      } else {
        localStorage.search_everywhere_off = parseInt(localStorage.search_everywhere_off) + 1;
      }
    });

    $('#enable_show_secure_search').click(function() {
      var is_checked = $(this).is(':checked');
      localStorage.search_secure_enable = is_checked ? "true" : "false";
      if (is_checked) {
        localStorage.search_secure_on = parseInt(localStorage.search_secure_on) + 1;
      } else {
        localStorage.search_secure_off = parseInt(localStorage.search_secure_off) + 1;
      }
    });
  };

  function defaults_values() {
    TXT_SEARCH.attr('placeholder', TXT_DEFAULT_MESSAGE);

    var ui = $("#search_page");
    var is_show_secure_search = $("#enable_show_secure_search");
    var show_search = (localStorage.search_secure_enable == "true") ? true : false;
    if (show_search) {
      ui.removeClass("isHidden");
      is_show_secure_search.prop("checked", true);
    } else {
      ui.addClass("isHidden");
      is_show_secure_search.prop("checked", false);
    }

    var disabled = !is_show_secure_search.is(':checked');
    TXT_SEARCH.prop('disabled', disabled);
    $('#omnibox-box').prop('disabled', disabled);
    $('#everywhere-box').prop('disabled', disabled);
    $('#btn_search').prop('disabled', disabled);

    var chkbox = '{"omnibox":false,"everywhere":false,"secure":false}';
    try {
      chkbox = JSON.parse(localStorage[CHK_MODE_SETTINGS_LABEL]);
    }catch(e){};
    $('#omnibox-box').attr('checked', chkbox['omnibox']);
    $('#everywhere-box').attr('checked', chkbox['everywhere']);

    if (chkbox['secure'] == false)
      $('#private_mode').attr('checked', true);
    else
      $('#secure_mode').attr('checked', true);

    var show = '{"omnibox":true,"everywhere":true,"secure":false}';
    try {
      show = JSON.parse(localStorage['search_show_mode_set']);
    }catch(e){};
    if (show['omnibox'] == false) $('#omnibox-box').parent().remove();
    if (show['everywhere'] == false) $('#everywhere-box').parent().remove();
    if ($('#search_settings ul li').length == 0) $('#search_settings').remove();

    TXT_SEARCH.focus();
  };

  function submitSearch(e) {
    e.which = e.which || e.keyCode;
    if (e.which != 13 && e.which != 1) return;
    if (TXT_SEARCH.val().trim() == "") return;

    const PREFIX_URL = "https://";
    var searchEngineIndex = DESERIALIZE(localStorage[SEARCH_ENGINE_LABEL]);
    var uri = null;

    if (searchEngineIndex == 0) uri = 'www.google.com/search?q=';
    else if (searchEngineIndex == 1) uri = 'us.bing.com/search?q=';
    else if (searchEngineIndex == 2) uri = 'search.yahoo.com/search?p=';
    else if (searchEngineIndex == 3) uri = 'blekko.com/ws?q=';
    else if (searchEngineIndex == 4) uri = 'duckduckgo.com/?q=';

    uri = PREFIX_URL + uri + encodeURIComponent(TXT_SEARCH.val()) + '&search_plus_one=popup';
    BG.openTab(uri);

    window.close();
  };

  function chkModeSettingsClick() {
    var omnibox = $('#omnibox-box');
    var everywhere = $('#everywhere-box');
    var secure = $('#secure_mode');

    var chk_box = {
      'omnibox': omnibox.is(':checked'),
      'everywhere': everywhere.is(':checked'),
      'secure': secure.is(':checked')
    };

    localStorage[CHK_MODE_SETTINGS_LABEL] = JSON.stringify(chk_box);

    var mode = 0;
    if      (chk_box.everywhere==false && chk_box.omnibox==true) mode = 1;
    else if (chk_box.everywhere==true && chk_box.omnibox==false) mode = 2;
    else if (chk_box.everywhere==true && chk_box.omnibox==true)  mode = 3;
    localStorage['search_mode_settings'] = DESERIALIZE(mode);

    if (secure.is(':checked') == true) {
      if (BG.bgPlusOne.hasProxy()) {
        BG.bgPlusOne.setProxy();
      }
    } else {
      chrome.tabs.query({active: true}, function (tabs) {
        if (!BG.bgPlusOne.isProxyTab(tabs[0].id)) {
          BG.bgPlusOne.removeProxy();
        }
      });
    }

    localStorage['search_full_secure'] = DESERIALIZE(secure.is(':checked'));
  };

  function toggleActivateSearch() {
    var is_show_secure_search = $(this).is(':checked');
    var ui = $("#search_page");

    localStorage.search_secure_enable = is_show_secure_search ? "true" : "false";
    if (is_show_secure_search) {
      ui.removeClass("isHidden");
    } else {
      ui.addClass("isHidden");
    }

    var disabled = !is_show_secure_search;
    TXT_SEARCH.prop('disabled', disabled);
    $('#omnibox-box').prop('disabled', disabled);
    $('#everywhere-box').prop('disabled', disabled);
    $('#btn_search').prop('disabled', disabled);

    // rebuild async filters
    setTimeout(function() {
      BG.update_filters();
    }, 100);
  };

  function showHelpImage() {
    var image = $(this).attr('id') == 'mode1_info' ? '#omnibox' : '#serp';
    $(image).show().css("opacity",0).stop(true,true).animate({
      opacity: 1,
      marginTop: 0
    });
  };
  function hideHelpImage() {
    var image = $(this).attr('id') == 'mode1_info' ? '#omnibox' : '#serp';
    $(image).stop(true,true).animate({
      opacity: 0,
      marginTop: 0
    }, function(){
      $(this).hide();
    });
  };

};