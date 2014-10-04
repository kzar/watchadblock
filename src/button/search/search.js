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
	disable_if_not_paid();
    define_events();
    analytics();
    defaults_values();
  };

  function disable_if_not_paid() {
	if (localStorage.search_requires_payment=="true") {
	    if (localStorage.search_user_is_paid!="true") {
	    	TXT_SEARCH.prop('disabled', true);
	    	$('#omnibox-box').prop('disabled', true);
     	 	$('#everywhere-box').prop('disabled', true);
     	 	$('#btn_search').prop('disabled', true);
     	 	
     	 	localStorage.search_secure_enable = "false";
	    }
	}
  }

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
    $('#enable_show_secure_search').click(function() {
      var counter = JSON.parse(localStorage['search_chkbox_counter']);
      var is_checked = $(this).is(':checked');
      (is_checked) ? counter.popup.private.on++ : counter.popup.private.off++;
      localStorage['search_chkbox_counter'] = JSON.stringify(counter);
      localStorage['search_secure_enable'] = is_checked ? "true" : "false";
    });

    $('#omnibox-box').click(function() {
      var counter = JSON.parse(localStorage['search_chkbox_counter']);
      var is_checked = $(this).is(':checked');
      (is_checked) ? counter.popup.omnibox.on++ : counter.popup.omnibox.off++;
      localStorage['search_chkbox_counter'] = JSON.stringify(counter);
      localStorage['search_omnibox'] = is_checked ? "true" : "false";
    });

    $('#everywhere-box').click(function() {
      var counter = JSON.parse(localStorage['search_chkbox_counter']);
      var is_checked = $(this).is(':checked');
      (is_checked) ? counter.popup.seweb.on++ : counter.popup.seweb.off++;
      localStorage['search_chkbox_counter'] = JSON.stringify(counter);
      localStorage['search_everywhere'] = is_checked ? "true" : "false";
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

    // show the pitch page if need be!
    if (is_show_secure_search) {
    	if (localStorage.search_requires_payment=="true") {
    		if (localStorage.search_user_is_paid!="true") {
    			  var pitch_url = localStorage.search_group_repitch + "?u=" + JSON.parse(localStorage.userid);
    			  chrome.tabs.create({url: pitch_url}, function(tab) {
    				    localStorage.search_pitch_page_shown = "true";
    				    localStorage.search_show_form = "true";
    				    var pitch_page_counter = JSON.parse(localStorage['search_pitch_page_counter']);
    				    pitch_page_counter.total++;
    				    localStorage['search_pitch_page_counter'] = JSON.stringify(pitch_page_counter);
    				  });

    			  return;
    		}
    	}
    }

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
