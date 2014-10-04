const C_PROXY_SEARCH = "search.disconnect.me"; // "adblock.disconnect.me";
const C_HOUR_IN_MS = 1000 * 60 * 60;
const BG = chrome.extension.getBackgroundPage();
var search_chkbox_counter_default = {
  "popup":   { "omnibox":{"on":0,"off":0}, "seweb":{"on":0,"off":0}, "private":{"on":0,"off":0} },
  "welcome": { "omnibox":{"on":0,"off":0}, "seweb":{"on":0,"off":0} },
  "dialog":  { "omnibox":{"on":0,"off":0}, "seweb":{"on":0,"off":0} }
};
var search_pitch_page_counter_default = { "yes":0,"no":0,"learn_more":0,"total":0,"paid":0,"trial":0 };

function DMSP1() {
  this.page_focus = false;
};

DMSP1.prototype.search_init_variables = function() {
  const newInstallt = this.deserialize(localStorage['search_new_install']);
  var firstInstall = (typeof newInstallt === 'undefined');
  if (firstInstall) {
    localStorage['search_new_install'] = "false";
    localStorage['search_secure_enable'] = "false";

    localStorage['search_install'] = new Date();
    localStorage['search_user_is_paid'] = "false";
    localStorage['search_trial_expire'] = "false";

    localStorage['search_chk_mode_set'] = JSON.stringify({'omnibox':false, 'everywhere':false});
    localStorage['search_omnibox'] = "false";
    localStorage['search_everywhere'] = "false";

    localStorage['search_engines'] = "0";
    localStorage['search_mode_settings'] = "0";
    localStorage['search_cohort'] = "7";

    localStorage['search_secure_reminder_show'] = "true";
    localStorage['search_qty_sr_show'] = "0";
    localStorage['search_last_time_sr_show'] = "0";

    localStorage['search_pwyw'] = JSON.stringify({date: new Date(), bucket: "viewed"});
    localStorage['search_chkbox_counter'] = JSON.stringify(search_chkbox_counter_default);
    localStorage['search_pitch_page_counter'] = JSON.stringify(search_pitch_page_counter_default);
    localStorage['search_total'] = "0";
    localStorage['search_show_form'] = "false";
    localStorage['search_pitch_page_shown'] = "false";

    localStorage['adblock_build_version'] = BG.STATS.version || chrome.app.getDetails().version.toString();
    localStorage['search_build_version'] = "2.0.0";
    if (localStorage['search_group'] == undefined) localStorage['search_group'] = 'gadblock';
    localStorage['search_product'] = 'adblock';
  }
  return firstInstall;
};

DMSP1.prototype.getHostname = function(href) {
  var l = window.document.createElement("a");
  l.href = href;
  return l.hostname;
};

DMSP1.prototype.deserialize = function(object) {
  return (typeof object == 'string') ? JSON.parse(object) : object;
};

DMSP1.prototype.get_user_id = function() {
  return (BG.get_adblock_user_id() || '0');
};

DMSP1.prototype.reportUsage = function() {
  const oneDayAsMsec = 24 * C_HOUR_IN_MS;
  
  var now = new Date();
  var firstPing   = new Date(localStorage.search_first_ping || now);
  var firstUpdate = (firstPing.getTime() == now.getTime());

  var dailyPing      = new Date(localStorage.search_daily_ping || now);
  var weeklyPing     = new Date(localStorage.search_weekly_ping || now);
  var monthlyPing    = new Date(localStorage.search_monthly_ping || now);
  var quarterlyPing  = new Date(localStorage.search_quarterly_ping || now);
  var semiannualPing = new Date(localStorage.search_semiannual_ping || now);
  var yearlyPing     = new Date(localStorage.search_yearly_ping || now);

  var daily      = ((now.getTime() - dailyPing.getTime()) >= oneDayAsMsec);
  var weekly     = ((now.getTime() - weeklyPing.getTime()) >= 7*oneDayAsMsec);
  var monthly    = ((now.getTime() - monthlyPing.getTime()) >= 30*oneDayAsMsec);
  var quarterly  = ((now.getTime() - quarterlyPing.getTime()) >= 90*oneDayAsMsec);
  var semiannual = ((now.getTime() - semiannualPing.getTime()) >= 180*oneDayAsMsec);
  var yearly     = ((now.getTime() - yearlyPing.getTime()) >= 365*oneDayAsMsec);

  var report_update_type;
  if      (yearly)     report_update_type = 0x20 | 0x10 | 0x08 | 0x04 | 0x01;
  else if (semiannual) report_update_type = 0x10 | 0x08 | 0x04 | 0x01;
  else if (quarterly)  report_update_type = 0x08 | 0x04 | 0x01;
  else if (monthly)    report_update_type = 0x04 | 0x01;
  else if (weekly)     report_update_type = 0x02 | 0x01;
  else if (daily)      report_update_type = 0x01;
  else                 report_update_type = 0x00; 

  var data = {
    conn: 'https://hits.disconnect.me',
    password: 'dirthavepure',
    time: new Date().toUTCString(),
    path: '/partnership_analytics.json?',
    ua: navigator.userAgent,
    host: 'disconnect.me',
    method: 'POST',
    status: 200
  };
  data.path = data.path + [
    'group_id=' + localStorage.search_group,
    'product_id=' + localStorage.search_product,  
    'user_id=' + (BG.get_adblock_user_id() || '0'),
    'build=' + localStorage.adblock_build_version,
    'search_build=' + localStorage.search_build_version,
    'cohort=' + localStorage.search_cohort
  ].join('&');

  var search_chkbox_counter = {};
  try {
    search_chkbox_counter = JSON.parse(localStorage['search_chkbox_counter']);
  } catch(e) {
    // if there is some problem with counter we just reset the variable.
    localStorage['search_chkbox_counter'] = JSON.stringify(search_chkbox_counter_default);
    search_chkbox_counter = JSON.parse(localStorage['search_chkbox_counter']);
  }
  
  var search_pitch_page_counter = {};
  try {
    search_pitch_page_counter = JSON.parse(localStorage['search_pitch_page_counter']);
  } catch(e) {
    // if there is some problem with counter we just reset the variable.
    localStorage['search_pitch_page_counter'] = JSON.stringify(search_pitch_page_counter_default);
    search_pitch_page_counter = JSON.parse(localStorage['search_pitch_page_counter']);
  }

  var report_values_to_send = {
    first_update: firstUpdate || false,
    search_engine: localStorage.search_engines || 0,
    omnibox: localStorage.search_omnibox || false,
    everywhere: localStorage.search_everywhere || false,
    show_secure_search: localStorage.search_secure_enable || false,
    omnibox_on: search_chkbox_counter.popup.omnibox.on || 0,
    omnibox_off: search_chkbox_counter.popup.omnibox.off || 0,
    everywhere_on: search_chkbox_counter.popup.seweb.on || 0,
    everywhere_off: search_chkbox_counter.popup.seweb.off || 0,
    secure_search_on: search_chkbox_counter.popup.private.on || 0,
    secure_search_off: search_chkbox_counter.popup.private.off || 0,
    omnibox_welcome_on: search_chkbox_counter.welcome.omnibox.on || 0,
    omnibox_welcome_off: search_chkbox_counter.welcome.omnibox.off || 0,
    everywhere_welcome_on: search_chkbox_counter.welcome.seweb.on || 0,
    everywhere_welcome_off: search_chkbox_counter.welcome.seweb.off || 0,
    omnibox_dialog_on: search_chkbox_counter.dialog.omnibox.on || 0,
    omnibox_dialog_off: search_chkbox_counter.dialog.omnibox.off || 0,
    everywhere_dialog_on: search_chkbox_counter.dialog.seweb.on || 0,
    everywhere_dialog_off: search_chkbox_counter.dialog.seweb.off || 0,
    pitch_page_total: search_pitch_page_counter.total || 0,
    pitch_page_yes: search_pitch_page_counter.yes || 0,
    pitch_page_no: search_pitch_page_counter.no || 0,
    pitch_page_paid: search_pitch_page_counter.paid || 0,
    pitch_page_trial: search_pitch_page_counter.trial || 0,
    pitch_page_learnmore: search_pitch_page_counter.learn_more || 0,
    searches_total: localStorage.search_total || 0
  }

  data.path = data.path + '&' + [
    'first_update=' + firstUpdate.toString(),
    'updated_type=' + report_update_type.toString(),
    'search_engine=' + report_values_to_send.search_engine.toString(),
    'omnibox=' + report_values_to_send.omnibox.toString(),
    'everywhere=' + report_values_to_send.everywhere.toString(),
    'show_secure_search=' + report_values_to_send.show_secure_search.toString(),
    'omnibox_on=' + report_values_to_send.omnibox_on.toString(),
    'omnibox_off=' + report_values_to_send.omnibox_off.toString(),
    'everywhere_on=' + report_values_to_send.everywhere_on.toString(),
    'everywhere_off=' + report_values_to_send.everywhere_off.toString(),
    'secure_search_on=' + report_values_to_send.secure_search_on.toString(),
    'secure_search_off=' + report_values_to_send.secure_search_off.toString(),
    'omnibox_welcome_on=' + report_values_to_send.omnibox_welcome_on.toString(),
    'omnibox_welcome_off=' + report_values_to_send.omnibox_welcome_off.toString(),
    'everywhere_welcome_on=' + report_values_to_send.everywhere_welcome_on.toString(),
    'everywhere_welcome_off=' + report_values_to_send.everywhere_welcome_off.toString(),
    'omnibox_dialog_on=' + report_values_to_send.omnibox_dialog_on.toString(),
    'omnibox_dialog_off=' + report_values_to_send.omnibox_dialog_off.toString(),
    'everywhere_dialog_on=' + report_values_to_send.everywhere_dialog_on.toString(),
    'everywhere_dialog_off=' + report_values_to_send.everywhere_dialog_off.toString(),
    'pitch_page_total=' + report_values_to_send.pitch_page_total.toString(),
    'pitch_page_yes=' + report_values_to_send.pitch_page_yes.toString(),
    'pitch_page_no=' + report_values_to_send.pitch_page_no.toString(),
    'pitch_page_paid=' + report_values_to_send.pitch_page_paid.toString(),
    'pitch_page_trial=' + report_values_to_send.pitch_page_trial.toString(),
    'pitch_page_learnmore=' + report_values_to_send.pitch_page_learnmore.toString(),
    'searches_total=' + report_values_to_send.searches_total.toString(),
  ].join('&');

  $.ajax(data.conn, {
    type: data.method,
    data: data,
    success: function(data, textStatus, jqXHR) {
      if (firstUpdate)               localStorage.search_first_ping      = now;
      if (daily || firstUpdate)      localStorage.search_daily_ping      = now;
      if (weekly || firstUpdate)     localStorage.search_weekly_ping     = now;
      if (monthly || firstUpdate)    localStorage.search_monthly_ping    = now;
      if (quarterly || firstUpdate)  localStorage.search_quarterly_ping  = now;
      if (semiannual || firstUpdate) localStorage.search_semiannual_ping = now;
      if (yearly || firstUpdate)     localStorage.search_yearly_ping     = now;

      var search_chkbox_counter = JSON.parse(localStorage['search_chkbox_counter']);
      var search_pitch_page_counter = JSON.parse(localStorage['search_pitch_page_counter']);
      localStorage.search_total = parseInt(localStorage.search_total) - report_values_to_send.searches_total;
      search_chkbox_counter.popup.omnibox.on -= report_values_to_send.omnibox_on;
      search_chkbox_counter.popup.omnibox.off -= report_values_to_send.omnibox_off;
      search_chkbox_counter.popup.seweb.on -= report_values_to_send.everywhere_on;
      search_chkbox_counter.popup.seweb.off -= report_values_to_send.everywhere_off;
      search_chkbox_counter.popup.private.on -= report_values_to_send.secure_search_on;
      search_chkbox_counter.popup.private.off -= report_values_to_send.secure_search_off;
      search_chkbox_counter.welcome.omnibox.on -= report_values_to_send.omnibox_welcome_on;
      search_chkbox_counter.welcome.omnibox.off -= report_values_to_send.omnibox_welcome_off;
      search_chkbox_counter.welcome.seweb.on -= report_values_to_send.everywhere_welcome_on;
      search_chkbox_counter.welcome.seweb.off -= report_values_to_send.everywhere_welcome_off;
      search_chkbox_counter.dialog.omnibox.on -= report_values_to_send.omnibox_dialog_on;
      search_chkbox_counter.dialog.omnibox.off -= report_values_to_send.omnibox_dialog_off;
      search_chkbox_counter.dialog.seweb.on -= report_values_to_send.everywhere_dialog_on;
      search_chkbox_counter.dialog.seweb.off -= report_values_to_send.everywhere_dialog_off;
      search_pitch_page_counter.total -= report_values_to_send.pitch_page_total;
      search_pitch_page_counter.yes -= report_values_to_send.pitch_page_yes;
      search_pitch_page_counter.no -= report_values_to_send.pitch_page_no;
      search_pitch_page_counter.paid -= report_values_to_send.pitch_page_paid;
      search_pitch_page_counter.trial -= report_values_to_send.pitch_page_trial;
      search_pitch_page_counter.learn_more -= report_values_to_send.pitch_page_learnmore;
      localStorage['search_chkbox_counter'] = JSON.stringify(search_chkbox_counter);
      localStorage['search_pitch_page_counter'] = JSON.stringify(search_pitch_page_counter);
    }
  });
};

DMSP1.prototype.onWebRequestBeforeRequest = function(details) {
  const TYPE = details.type;
  const T_MAIN_FRAME = (TYPE == 'main_frame');
  const T_OTHER = (TYPE == 'other');
  const T_SCRIPT = (TYPE == 'script');
  const T_XMLHTTPREQUEST = (TYPE == 'xmlhttprequest');
  
  const REGEX_URL = /[?|&]q=(.+?)(&|$)/;
  const REGEX_URL_YAHOO = /[?|&]p=(.+?)(&|$)/;
  const REQUESTED_URL = details.url;
  const CHILD_DOMAIN = this.getHostname(REQUESTED_URL);
  const C_EXTENSION_PARAMETER = "&source=extension&extension=chrome"

  var modeSettings = this.deserialize(localStorage['search_mode_settings']);
  var blockingResponse = {cancel: false};
  var blocking = false;

  if (localStorage['search_secure_enable']!="true") return blockingResponse;

  var isGoogle = (CHILD_DOMAIN.search("google.") > -1) && true;
  var isBing = (CHILD_DOMAIN.search("bing.") > -1) && false;
  var isYahoo = (CHILD_DOMAIN.search("yahoo.") > -1) && false;
  var isBlekko = (CHILD_DOMAIN.search("blekko.") > -1) && false;
  var isDuckDuckGo = (CHILD_DOMAIN.search("duckduckgo.") > -1) && false;
  var hasSearch = (REQUESTED_URL.search("/search") > -1);
  var hasMaps = (REQUESTED_URL.search("/maps") > -1);
  var hasWsOrApi = (REQUESTED_URL.search("/ws") > -1) || (REQUESTED_URL.search("/api") > -1);
  var hasGoogleImgApi = (REQUESTED_URL.search("tbm=isch") > -1);

  var isOmniboxSearch = (this.page_focus == false);
  var isSearchByPage = new RegExp("search_plus_one=form").test(REQUESTED_URL);
  var isSearchByPopUp = new RegExp("search_plus_one=popup").test(REQUESTED_URL);
  var isProxied = ( 
    (modeSettings == 0 && isSearchByPopUp) ||
    (modeSettings == 1 && (isSearchByPopUp || isOmniboxSearch) ) ||
    (modeSettings == 2 && (isSearchByPopUp || isSearchByPage ) ) ||
    (modeSettings == 3 && (isSearchByPopUp || isOmniboxSearch || !isOmniboxSearch || isSearchByPage ) )
  );

  // blocking autocomplete
  var isChromeInstant = ( isGoogle && T_MAIN_FRAME && (REQUESTED_URL.search("chrome-instant") > -1) );
  var isGoogleOMBSearch = ( isGoogle && T_OTHER && (REQUESTED_URL.search("/complete/") > -1) );
  var hasGoogleReviewDialog = (REQUESTED_URL.search("reviewDialog") > -1);
  var isGoogleSiteSearch = (!T_MAIN_FRAME && isGoogle && !hasGoogleImgApi && !hasGoogleReviewDialog &&
    ((REQUESTED_URL.search("suggest=") > -1) || (REQUESTED_URL.indexOf("output=search") > -1) || (REQUESTED_URL.indexOf("/s?") > -1) ||
    (REQUESTED_URL.search("/complete/search") > -1) || (REQUESTED_URL.search("/search") > -1)));
  var isBingOMBSearch = ( isBing && T_OTHER && (REQUESTED_URL.search("osjson.aspx") > -1) );
  var isBingSiteSearch = ( isBing && T_SCRIPT && (REQUESTED_URL.search("qsonhs.aspx") > -1) );
  var isBlekkoSearch = ( isBlekko && (T_OTHER || T_XMLHTTPREQUEST) && (REQUESTED_URL.search("autocomplete") > -1) );
  var isYahooSearch = ( isYahoo && T_SCRIPT && (REQUESTED_URL.search("search.yahoo") > -1) && ((REQUESTED_URL.search("jsonp") > -1) || (REQUESTED_URL.search("gossip") > -1)) );
  
  if ( (isProxied && (isChromeInstant || isGoogleOMBSearch || isGoogleSiteSearch || isBingOMBSearch || isBingSiteSearch || isBlekkoSearch || isYahooSearch)) || 
    (modeSettings==2||modeSettings==3) && (isBingOMBSearch || isBingSiteSearch || isYahooSearch) ) {
    blocking = true;
    blockingResponse = { cancel: true };
  }

  var match = REGEX_URL.exec(REQUESTED_URL);
  if (isYahoo) match = REGEX_URL_YAHOO.exec(REQUESTED_URL);

  var foundQuery = ((match != null) && (match.length > 1));
  var URLToProxy = ((isGoogle && (hasSearch || hasMaps)) || (isBing && hasSearch) || (isYahoo && hasSearch) || (isBlekko && hasWsOrApi) || isDuckDuckGo);
  if (isProxied && T_MAIN_FRAME && URLToProxy && foundQuery && !blocking) { 
    //console.log("%c Search by OminiBox/Everywhere", 'background: #33ffff;');
    localStorage.search_total = parseInt(localStorage.search_total) + 1;

    var isUserPaid = (localStorage['search_user_is_paid']=="true");
    var isTrialExpire = (localStorage['search_trial_expire']=="true");
    if (!isUserPaid && isTrialExpire) {
      var pitch_page_counter = JSON.parse(localStorage['search_pitch_page_counter']);
      pitch_page_counter.trial++;
      localStorage['search_pitch_page_counter'] = JSON.stringify(pitch_page_counter);
      return { redirectUrl: localStorage['search_payment_page'] };
    }

    var searchEngineIndex = this.deserialize(localStorage['search_engines']);
    var searchEngineName = null;
    if      ( (searchEngineIndex == 0 && !isSearchByPage) || (isGoogle && isSearchByPage) )     searchEngineName = 'Google';
    else if ( (searchEngineIndex == 1 && !isSearchByPage) || (isBing && isSearchByPage) )       searchEngineName = 'Bing';
    else if ( (searchEngineIndex == 2 && !isSearchByPage) || (isYahoo && isSearchByPage) )      searchEngineName = 'Yahoo';
    else if ( (searchEngineIndex == 3 && !isSearchByPage) || (isBlekko && isSearchByPage) )     searchEngineName = 'Blekko';
    else if ( (searchEngineIndex == 4 && !isSearchByPage) || (isDuckDuckGo && isSearchByPage) ) searchEngineName = 'DuckDuckGo';
    else searchEngineName = 'Google';

    var url_redirect = 'https://' + C_PROXY_SEARCH + '/searchTerms/search?query=' + match[1] + C_EXTENSION_PARAMETER + '&ses=' + searchEngineName;
    blockingResponse = { redirectUrl: url_redirect };
  } else if (!blocking) {
    var isWebSearch = (REQUESTED_URL.search(C_PROXY_SEARCH + "/searchTerms/search?") > -1);
    var hasNotParametersExtension = (REQUESTED_URL.search(C_EXTENSION_PARAMETER) == -1);
    if (isWebSearch && hasNotParametersExtension) {
      blockingResponse = { redirectUrl: REQUESTED_URL + C_EXTENSION_PARAMETER };
    }else if ((modeSettings==2 || modeSettings==3) && T_SCRIPT && isBlekko && hasWsOrApi) {
      var jsCode = "window.location = '" + REQUESTED_URL + '&search_plus_one=form'+ "';";
      chrome.tabs.executeScript(details.tabId, {code: jsCode, runAt: "document_start"}, function(){});
    }
  } else if(blocking) {
    //console.log("%c BLOCKED",'background: #333333; color:#ff0000');
  }

  return blockingResponse;
};

DMSP1.prototype.onWebRequestBeforeSendHeaders = function(details) {
  if ((localStorage['search_secure_enable']=="true") && (details.url.indexOf(C_PROXY_SEARCH)>=0)) {
    var XDST = {name: 'X-Disconnect-Stats', value: JSON.stringify({
      group_id: localStorage.search_group,
      product_id: localStorage.search_product,
      user_id: this.get_user_id()
    })};
    details.requestHeaders.push(XDST);
  }

  return {requestHeaders: details.requestHeaders};
};

DMSP1.prototype.onWebNavCreatedNavigationTarget = function(details) {
  this.page_focus = true;
};

DMSP1.prototype.onTabsCreated = function(tab) {
  this.page_focus = false;
  this.showPitchPage(tab);
};

DMSP1.prototype.onWebNavCompleted = function(details) {
  this.injectJavascript(details);
};

DMSP1.prototype.onRuntimeMessage = function(request, sender, sendResponse) {
  var context = this;
  var submitValues = function(request, sender, sendResponse) {
    var remove = false;
    var checked = (request.value == true);
    var needSubmit = (request.needSubmit == "true") ? true : false;
    var byPitchPage = (sender.url.indexOf(context.getHostname(localStorage['search_group_pitch']))>=0);

    var form = {};
    try { form = JSON.parse(localStorage['search_form_submit']); }catch(e){};

    if (request.pitch_page == "searchOmnibox")
      form.searchOmnibox = checked;
    if (request.pitch_page == "searchWebsite")
      form.searchWebsite = checked;
    if (request.pitch_page == "nothanks")
      needSubmit = remove = true;

    if ( (!needSubmit) || (request.pitch_page == "submit") ) {
      var counter = JSON.parse(localStorage['search_chkbox_counter']);
      var counterPos = (byPitchPage) ? counter.welcome : counter.dialog;

      if (form.searchOmnibox != undefined) {
        var is_checked = form.searchOmnibox;
        (is_checked) ? counterPos.omnibox.on++ : counterPos.omnibox.off++;
        localStorage['search_omnibox'] = is_checked ? "true" : "false";
      }

      if (form.searchWebsite != undefined) {
        var is_checked = form.searchWebsite;
        (is_checked) ? counterPos.seweb.on++ : counterPos.seweb.off++;
        localStorage['search_everywhere'] = is_checked ? "true" : "false";
      }
      localStorage['search_chkbox_counter'] = JSON.stringify(counter);

      var chk_box = {
        'omnibox': context.deserialize(localStorage['search_omnibox']),
        'everywhere': context.deserialize(localStorage['search_everywhere'])
      };
      localStorage['search_chk_mode_set'] = JSON.stringify(chk_box);

      var mode = 0;
      if      (chk_box.everywhere==false && chk_box.omnibox==true) mode = 1;
      else if (chk_box.everywhere==true && chk_box.omnibox==false) mode = 2;
      else if (chk_box.everywhere==true && chk_box.omnibox==true)  mode = 3;
      localStorage['search_mode_settings'] = context.deserialize(mode);

      remove = true;
    }

    localStorage['search_form_submit'] = JSON.stringify(form);
    if (remove) delete localStorage['search_form_submit'];
  };

  if (request.page_focus == false || request.page_focus == true) {
    if (sender.tab && sender.tab.active == true) {
      this.page_focus = request.page_focus;
    }
  } else if (request.action == 'get_search_dialog_url') {
    sendResponse({ search_dialog_url: localStorage['search_dialog_url'] });
  } else if (request.action == 'get_extension_information') {
    sendResponse({
      group_id: localStorage['search_group'],
      user_id: this.get_user_id(),
      adblock_ui: localStorage['search_adblock_ui']
   });
  } else if (request.action == 'show_search_dialog') {
    localStorage['search_qty_sr_show'] = parseInt(localStorage['search_qty_sr_show']) + 1;
    localStorage['search_last_date_sr_show'] = new Date();
  }else if (request.action == 'serp_result') {
    var incognito = this.deserialize(localStorage.getItem("search_incognito")) || false;
    if(incognito) {
      chrome.windows.create({"url": request.source, "incognito":true})
    } else {
      chrome.tabs.update({
        url: request.source
      })
    }
  } else if (request.action == 'serp_result_tab') {
    var incognito = this.deserialize(localStorage.getItem("search_incognito")) || false;
    if(incognito) {
      chrome.windows.create({"url": request.source, "incognito":true})
    } else {
      chrome.tabs.create({url: request.source});
    }
  } else if (request.pitch_page != undefined) {
    if (request.pitch_page == 'noPrivateSearch') {
      localStorage.search_secure_enable = "false";
      var pitch_page_counter = JSON.parse(localStorage['search_pitch_page_counter']);
      pitch_page_counter.no++;
      localStorage['search_pitch_page_counter'] = JSON.stringify(pitch_page_counter);
    } else if (request.pitch_page == 'yesPrivateSearch') {
      localStorage.search_secure_enable = "true";
      var pitch_page_counter = JSON.parse(localStorage['search_pitch_page_counter']);
      pitch_page_counter.yes++;
      localStorage['search_pitch_page_counter'] = JSON.stringify(pitch_page_counter);
    } else if (request.pitch_page == 'getExtSearch') {
      var pitch_page_counter = JSON.parse(localStorage['search_pitch_page_counter']);
      pitch_page_counter.yes++;
      localStorage['search_pitch_page_counter'] = JSON.stringify(pitch_page_counter);
    } else if (request.pitch_page == 'learnmore') {
      var pitch_page_counter = JSON.parse(localStorage['search_pitch_page_counter']);
      pitch_page_counter.learn_more++;
      localStorage['search_pitch_page_counter'] = JSON.stringify(pitch_page_counter);
    } else if (request.pitch_page == 'userPaid') {
      var pitch_page_counter = JSON.parse(localStorage['search_pitch_page_counter']);
      pitch_page_counter.paid++;
      localStorage['search_pitch_page_counter'] = JSON.stringify(pitch_page_counter);
      localStorage['search_user_is_paid'] = "true";
    } else {
      submitValues(request, sender, sendResponse);
    }

    var isSearchExternal = (localStorage.search_external=="true");
    if (isSearchExternal) context.reportUsage();

    BG.update_filters();
  }
};

DMSP1.prototype.onAlarm = function(alarm) {
  if (alarm.name=='search_trial_expire') {
    localStorage['search_trial_expire'] = "true";
  }
};

DMSP1.prototype.injectJavascript = function(details) {
  var CHILD_DOMAIN = this.getHostname(details.url);

  chrome.tabs.executeScript(details.tabId, {file:"search/focus.js", allFrames:true, runAt:"document_start"});
  chrome.tabs.executeScript(details.tabId, {file:"search/serp.js", allFrames:true, runAt:"document_end"});
  chrome.tabs.executeScript(details.tabId, {file:"search/incognito.js", allFrames:true, runAt:"document_end"});

  var pitch_page_host = this.getHostname(localStorage.search_group_pitch);
  if (CHILD_DOMAIN.indexOf(pitch_page_host)>=0) {
    chrome.tabs.executeScript(details.tabId, {file:"search/pitchpage.js", allFrames:false, runAt:"document_end"});
  }

  this.showSerpPopup(details);
}

DMSP1.prototype.showPitchPage = function(tab) { 
  var context = this;
  var pitch_page_show = localStorage['search_pitch_page_shown'];
  if ( (pitch_page_show=="true") || (tab.url.indexOf('chrome-devtools://')>=0) ||
     ( (tab.url.indexOf('chrome://')>=0) && !(tab.url.indexOf('chrome://newtab/')>=0) ) ) return;

  var pitch_url = localStorage['search_group_pitch'] + "?u=" + this.get_user_id();
  chrome.tabs.update(tab.id, {url: pitch_url}, function(tab) {
    var isSearchExternal = (localStorage['search_external']=="true");
    localStorage['search_pitch_page_shown'] = "true";
    localStorage['search_show_form'] = (isSearchExternal) ? "false" : "true";

    var pitch_page_counter = JSON.parse(localStorage['search_pitch_page_counter']);
    pitch_page_counter.total++;
    localStorage['search_pitch_page_counter'] = JSON.stringify(pitch_page_counter);

    if (isSearchExternal) context.reportUsage();
  });
};

DMSP1.prototype.showSerpPopup = function(details) {
  const oneDayAsMsec = 24 * C_HOUR_IN_MS;
  const REQUESTED_URL = details.url;
  const TAB_ID = details.tabId;
  const CHILD_DOMAIN = this.getHostname(REQUESTED_URL);

  var isGoogle = ((CHILD_DOMAIN.search(".google.")>=0) && (CHILD_DOMAIN.search("plus.google.")==-1));
  if ( (REQUESTED_URL.indexOf('chrome-devtools://')>=0) || (REQUESTED_URL.indexOf('chrome://')>=0) ) return;
  if ((!isGoogle) || TAB_ID<=0) return;

  var showSecureReminder = (localStorage['search_secure_reminder_show'] == "true");
  var enableSS = (localStorage['search_secure_enable'] == "true");
  var search_chk_mode_set = JSON.parse(localStorage['search_chk_mode_set']);
  var enableOmniBox = (search_chk_mode_set['omnibox'] == true);
  var enableSESite = (search_chk_mode_set['everywhere'] == true);
  var isConfInsecure = enableSS && !enableOmniBox && !enableSESite;
  if (!(showSecureReminder && isConfInsecure)) return;

  var now = new Date();
  var qty_dialog_show = parseInt(localStorage['search_qty_sr_show']);
  var last_time_show = new Date(localStorage['search_last_date_sr_show'] || now);
  var one = ( qty_dialog_show==0 && ((now.getTime() - last_time_show.getTime())>=0*oneDayAsMsec) );
  var two = ( qty_dialog_show==1 && ((now.getTime() - last_time_show.getTime())>=1*oneDayAsMsec) );
  var three = ( qty_dialog_show==2 && ((now.getTime() - last_time_show.getTime())>=2*oneDayAsMsec) );
  var four = ( qty_dialog_show==3 && ((now.getTime() - last_time_show.getTime())>=7*oneDayAsMsec) );
  var showOften = (one || two || three || four);
  if (!showOften) return;

  chrome.tabs.executeScript(TAB_ID, {file: "jquery/jquery.min.js", allFrames:false, runAt: "document_start"}, function() {
    chrome.tabs.executeScript(TAB_ID, {file: "search/pitchpage.js", allFrames:false, runAt: "document_start"}, function() {
      chrome.tabs.executeScript(TAB_ID, {file: "search/secure_reminder.js", allFrames:false, runAt: "document_end"}, function() {});
    });
  });
};

DMSP1.prototype.search_load_alarms = function() {
  // Verify version is a trial version
  if (localStorage['search_payment_page']==undefined) return;
  
  if (localStorage['search_trial_expire']!="true") {
    var dateInstall = new Date(localStorage['search_install'] || new Date());
    var dateExpire = new Date(dateInstall);
    dateExpire.setDate(dateInstall.getDate()+3);
    
    chrome.alarms.create('search_trial_expire', {when: dateExpire.getTime()});
  }
};

DMSP1.prototype.search_load_events = function(context) {
  var runtimeOrExtension = chrome.runtime && chrome.runtime.sendMessage ? 'runtime':'extension';
  chrome.webRequest.onBeforeRequest.addListener(context.onWebRequestBeforeRequest.bind(context), {urls: ['http://*/*', 'https://*/*']}, ['blocking']);
  chrome.webRequest.onBeforeSendHeaders.addListener(context.onWebRequestBeforeSendHeaders.bind(context), {urls: ['http://*/*', 'https://*/*']}, ['blocking', "requestHeaders"]);  
  chrome.webNavigation.onCompleted.addListener(context.onWebNavCompleted.bind(context));
  chrome.webNavigation.onCreatedNavigationTarget.addListener(context.onWebNavCreatedNavigationTarget.bind(context));
  chrome.tabs.onCreated.addListener(context.onTabsCreated.bind(context));
  chrome.alarms.onAlarm.addListener(context.onAlarm.bind(context));
  chrome[runtimeOrExtension].onMessage.addListener(context.onRuntimeMessage.bind(context));
};

DMSP1.prototype.search_initialize = function(context) {
  this.search_init_variables();
  this.search_load_events(context);
  this.search_load_alarms();

  this.reportUsage();
  setInterval(this.reportUsage, C_HOUR_IN_MS);
};