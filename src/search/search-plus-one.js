function DMSP1() {
  // background
  this.BG = chrome.extension.getBackgroundPage();

  // variables
  this.C_PROXY_INVISIBLE = "inv-adclick.disconnect.me:3000";
  this.C_PROXY_PRESETTING = "search.disconnect.me/activation";
  this.C_PROXY_SEARCH = "search.disconnect.me";

  // configuration to set our proxy server
  this.config_proxied = {
    mode: "pac_script",
    pacScript: {
      data: "function FindProxyForURL(url, host) {\n" +
            "  return 'PROXY " + this.C_PROXY_INVISIBLE + "';\n" +  
            "}"
      }
  };

  this.page_focus = false;
                    
  // configuration to clear our proxy server 
  this.config_direct = { mode: "system" };
               
  // timer - alarm (disconnect proxy)
  this.timer = null;
  this.expiryTimer = 10000; //(10 seconds)

  // variable for proxy tabs
  this.proxy_tabs = [];

  // variables proxy_actived
  this.proxy_actived = false;
  
  // variable to fix the 403 Forbidden problem on chrome startup
  this.startup_verify = true;

  // send value in header: X-Disconnect-Auth: 'value'
  this.XDHR = {name: 'X-Disconnect-Auth', value: 'none'};

  this.iconChange = this.sendXDIHR = false;
  this.C_MN = 'd2hhdGlmaWRpZHRoaXMx';
  this.HOUR_MS = 60 * 60 * 1000;
};

function deserialize(object) {
  if (typeof object === 'undefined')
    return undefined;
  else if (typeof object == 'string') 
    return JSON.parse(object);
  else
    return object;
};

DMSP1.prototype.getHostname = function(href) {
  var l = window.document.createElement("a");
  l.href = href;
  return l.hostname;
};

DMSP1.prototype.buildParameters = function(requested_url, searchEngineName, isOmnibox) {
  var paramJSON = {};
  
  while(requested_url.indexOf("+") != -1)
    requested_url = requested_url.replace("+", " ");
  
  var parameters = requested_url.split("?")[1].split("&");
  
  var excludeParam = new Array;
  var url_params = "/?s=" + this.C_MN;
  
  if(requested_url.indexOf("se=") == -1)
    url_params += "&se=" + searchEngineName;

  var alreadyHasQ = false;

  for (var i=0; i<parameters.length; i++) {
    var aux = parameters[i].split("=");
    if (isOmnibox && aux[0] == "q"){
      url_params += "&q=" + escape(aux[1]);
      break;
    }
    
    if(aux[0] == "q" && searchEngineName == "google" && !isOmnibox){
      url_params += "&q=" + escape(aux[1]);
      break;
    }
    
    if (aux[0] == "q" || aux[0] == "p") {
      if (searchEngineName == 'yahoo') aux[0] = "q";

      var plus = false;
      aux[1] = unescape(aux[1]);

      if (aux[1].indexOf("'") != -1){
        aux[1] = aux[1].replace(/'/g, "&#39;");
        plus = true;
      }
      if (aux[1].indexOf("+") != -1){
        aux[1] = aux[1].replace("\\+","&#43;");
        while(aux[1].indexOf("+") != -1)
          aux[1] = aux[1].replace("+","&#43;");
        plus = true;
      }

      aux[1] = escape(aux[1]);
      
      while(aux[1].indexOf("%2520") != -1)
          aux[1] = aux[1].replace("%2520"," ");
        
      if (!plus) {
        aux[1] = unescape(aux[1]);
        aux[1] = unescape(aux[1]);
      }
      
    }
    if (aux[0] == "q") {
      if (!alreadyHasQ) paramJSON[aux[0]] = aux[1];
      alreadyHasQ = true;
    } else {
     paramJSON[aux[0]] = aux[1];
    }
  }
  for (var i=0; i<excludeParam.length; i++) {
    delete paramJSON[excludeParam[i]];
  }
  for(var x in paramJSON) {
    url_params += "&" + x + "=" + paramJSON[x];
  }

  if (searchEngineName == 'google') {
    if (requested_url.search("/maps")>-1)
      url_params += "&tbm=maps";
  }
  
  return url_params;
};

/* Traps and selectively cancels or redirects a request. */
DMSP1.prototype.onWebRequestBeforeRequest = function(details) {
  const PROXY_REDIRECT_BY_PRESETTING = "https://" + this.C_PROXY_PRESETTING;
  const PROXY_REDIRECT = "https://" + this.C_PROXY_SEARCH + "/search";
  const REGEX_URL = /[?|&]q=(.+?)(&|$)/;
  const REGEX_URL_YAHOO = /[?|&]p=(.+?)(&|$)/;
  const TYPE = details.type;
  const T_MAIN_FRAME = (TYPE == 'main_frame');
  const T_OTHER = (TYPE == 'other');
  const T_SCRIPT = (TYPE == 'script');
  const T_XMLHTTPREQUEST = (TYPE == 'xmlhttprequest');
  var REQUESTED_URL = details.url;
  const CHILD_DOMAIN = this.getHostname(REQUESTED_URL);
  
  var blockingResponse = {cancel: false};
  var blocking = presetting = false;
  var isGoogle = (CHILD_DOMAIN.search("google.") > -1);
  var isBing = (CHILD_DOMAIN.search("bing.") > -1);
  var isYahoo = (CHILD_DOMAIN.search("yahoo.") > -1);
  var isBlekko = (CHILD_DOMAIN.search("blekko.") > -1);
  var isDisconnectSite = (CHILD_DOMAIN.search("disconnect.me") > -1);
  var isDuckDuckGo = (CHILD_DOMAIN.search("duckduckgo.") > -1);
  var hasSearch = (REQUESTED_URL.search("/search") > -1);
  var hasMaps = (REQUESTED_URL.search("/maps") > -1);
  var hasWsOrApi = (REQUESTED_URL.search("/ws") > -1) || (REQUESTED_URL.search("/api") > -1);
  var hasGoogleImgApi = (REQUESTED_URL.search("tbm=isch") > -1);
  var isDisconnect = this.isProxySearchUrl(REQUESTED_URL);
  var isDisconnectSearchPage = (REQUESTED_URL.search("search.disconnect.me/stylesheets/injected.css") > -1);

  if (localStorage.search_secure_enable === "false") return blockingResponse;
  if (isDisconnectSearchPage) localStorage.search_total = parseInt(localStorage.search_total) + 1;
  if (isDisconnectSite) {
    var CONTROL = document.getElementById('input-type');
    var BUCKET = CONTROL && CONTROL.getAttribute('value');
    localStorage.search_pwyw = JSON.stringify({pwyw: true, bucket: BUCKET});
  }

  //if (T_MAIN_FRAME) console.log("onBeforeRequest:", details.url);
  // Search proxied
  var modeSettings = deserialize(localStorage['search_mode_settings']);
  //var isSecureMode = (deserialize(localStorage['search_full_secure']) == true);
  var isOmniboxSearch = (this.page_focus == false);
  var isSearchByPage = new RegExp("search_plus_one=form").test(REQUESTED_URL);
  var isSearchByPopUp = new RegExp("search_plus_one=popup").test(REQUESTED_URL);
  var isProxied = ( 
    (modeSettings == 0 && isSearchByPopUp) ||
    (modeSettings == 1 && (isSearchByPopUp || isOmniboxSearch) ) ||
    (modeSettings == 2 && (isSearchByPopUp || isSearchByPage ) ) ||
    (modeSettings == 3 && (isSearchByPopUp || isOmniboxSearch || !isOmniboxSearch || isSearchByPage ) ) ||
    (modeSettings >= 0 && (this.isProxyTab(details.tabId) && this.proxy_actived) && !isOmniboxSearch )
  );

  // blocking autocomplete by OminiBox or by Site URL
  var isChromeInstant = ( isGoogle && T_MAIN_FRAME && (REQUESTED_URL.search("chrome-instant") > -1) );
  var isGoogleOMBSearch = ( isGoogle && T_OTHER && (REQUESTED_URL.search("/complete/") > -1) );
  var hasGoogleReviewDialog = (REQUESTED_URL.search("reviewDialog") > -1);
  var isGoogleSiteSearch = (!T_MAIN_FRAME && isGoogle && !hasGoogleImgApi && !hasGoogleReviewDialog && ((REQUESTED_URL.search("suggest=") > -1) || (REQUESTED_URL.indexOf("output=search") > -1) || (REQUESTED_URL.indexOf("/s?") > -1) || (REQUESTED_URL.search("/complete/search") > -1) || (REQUESTED_URL.search("/search") > -1) ));
  var isDisconnectSearch = (!T_MAIN_FRAME && isDisconnect && (REQUESTED_URL.search("/complete/search")>-1) && (REQUESTED_URL.search("client=serp")>-1) );

  var isBingOMBSearch = ( isBing && T_OTHER && (REQUESTED_URL.search("osjson.aspx") > -1) );
  var isBingSiteSearch = ( (isBing || isDisconnect) && T_SCRIPT && (REQUESTED_URL.search("qsonhs.aspx") > -1) );
  var isBlekkoSearch = ( (isBlekko || isDisconnect) && (T_OTHER || T_XMLHTTPREQUEST) && (REQUESTED_URL.search("autocomplete") > -1) );
  var isYahooSearch = ( (isYahoo || isDisconnect) && T_SCRIPT && (REQUESTED_URL.search("search.yahoo") > -1) && ((REQUESTED_URL.search("jsonp") > -1) || (REQUESTED_URL.search("gossip") > -1)) );
  if ( isProxied && (isChromeInstant || isGoogleOMBSearch || isGoogleSiteSearch || isBingOMBSearch || isBingSiteSearch || isBlekkoSearch || isYahooSearch || isDisconnectSearch) ) {
    blocking = true;
    blockingResponse = { cancel: true };
  }
  
  // Redirect URL -> Proxied
  //var URLToProxy = ((isGoogle && (hasSearch || hasMaps)) || (isBing && hasSearch) || (isYahoo && hasSearch) || (isBlekko && hasWsOrApi) || isDuckDuckGo);
  var URLToProxy = (isGoogle && (hasSearch || hasMaps));
  if (isProxied && T_MAIN_FRAME && URLToProxy && !blocking) { 
    //console.log("%c Search by OminiBox", 'background: #33ffff;');
    //console.log(details);

    // get query in URL string
    var match = REGEX_URL.exec(REQUESTED_URL);
    if (isYahoo) match = REGEX_URL_YAHOO.exec(REQUESTED_URL);

    if ((match != null) && (match.length > 1)) {
      //console.log("%c Search by OminiBox Found Match Needs Redirecting", 'background: #33ffff;');
      //console.log(details);

      var searchEngineIndex = deserialize(localStorage['search_engines']);
      var searchEngineName = null;
      if      ( (searchEngineIndex == 0 && !isSearchByPage) || (isGoogle && isSearchByPage) )     searchEngineName = 'google';
      else if ( (searchEngineIndex == 1 && !isSearchByPage) || (isBing && isSearchByPage) )       searchEngineName = 'bing';
      else if ( (searchEngineIndex == 2 && !isSearchByPage) || (isYahoo && isSearchByPage) )      searchEngineName = 'yahoo';
      else if ( (searchEngineIndex == 3 && !isSearchByPage) || (isBlekko && isSearchByPage) )     searchEngineName = 'blekko';
      else if ( (searchEngineIndex == 4 && !isSearchByPage) || (isDuckDuckGo && isSearchByPage) ) searchEngineName = 'duckduckgo';
      else searchEngineName = 'google';
      
      if (searchEngineIndex == 4){
        if (isGoogle){
          searchEngineName = 'google';
        }else if (isBing){
          searchEngineName = 'bing';
        }else if (isYahoo){
          searchEngineName = 'yahoo';
        }else if (isBlekko || (REQUESTED_URL.indexOf("!blekko") != -1) ){
          REQUESTED_URL = REQUESTED_URL.replace("!blekko","");
          searchEngineName = 'blekko';
        }
      }

      var isOmnibox = isOmniboxSearch && !isSearchByPopUp;
      var url_params = this.buildParameters(REQUESTED_URL, searchEngineName, isOmnibox);
      
      var url_redirect = null;
      if (!this.proxy_actived && !this.isProxyTabActived(details.tabId, REQUESTED_URL)) {
        url_redirect = PROXY_REDIRECT_BY_PRESETTING + url_params;
        presetting = true;
      } else {
        url_redirect = PROXY_REDIRECT + url_params;
        presetting = false;
      }
      //register the tab as a proxy tab passing in the url we will use as the base search
      this.registerProxiedTab(details.tabId, PROXY_REDIRECT + url_params, details.requestId, presetting);

      blockingResponse = {
        redirectUrl: url_redirect
      };
    }
  } else if (T_MAIN_FRAME && isDisconnect && !this.isProxyTab(details.tabId) && !blocking) {
    //console.log("%c Disconnect Search Page",'background: #33ffff;');
    var isHidden = (REQUESTED_URL.search("/browse/") > -1);
    var url_params = "/?s=" + this.C_MN + "&" + REQUESTED_URL.split("?")[1]
    var url_redirect = PROXY_REDIRECT_BY_PRESETTING + url_params;

    if (!isHidden) {
      this.registerProxiedTab(details.tabId, PROXY_REDIRECT + url_params, details.requestId, true);
      blockingResponse = { redirectUrl: url_redirect };
    } else {
      this.registerProxiedTab(details.tabId, REQUESTED_URL, details.requestId, false);
    }
  } else if (!blocking){
    //console.log("%c No Search by OminiBox Just pass through plus one",'background: #33ffff;');
    //console.log(details);

    // BEGIN - HACK blekko redirect - only FORM use
    if (modeSettings==2 && T_SCRIPT && isBlekko && hasWsOrApi) {
        var jsCode = "window.location = '" + REQUESTED_URL + '&search_plus_one=form'+ "';";
        chrome.tabs.executeScript(details.tabId, {code: jsCode, runAt: "document_start"}, function(){});
    }
    // END - HACK blekko redirect - only FORM use

    // BEGIN - HACK duckduckgo redirect - +1 result
    if (T_MAIN_FRAME && isDuckDuckGo && (REQUESTED_URL.indexOf("http://r.duckduckgo.com/l/?kh=") > -1))
      return blockingResponse;
    // END - HACK duckduckgo redirect - +1 result

    this.onWebBeforeRequest(details);
  } else {
    //console.log("%c BLOCKED",'background: #333333; color:#ff0000');
  }

  return blockingResponse;
};

DMSP1.prototype.onWebBeforeRequest = function(details) {
  const PARENT = details.type == 'main_frame';
  var isPrivateMode = (deserialize(localStorage['search_full_secure']) == false);
  var context = this;
  //console.log('%c WebReq.onBeforeRequest:', 'color: #FF07FA; background: #000000');
  //console.log("Type %s -> URL:%s", details.type, details.url);

  if (this.isProxyTab(details.tabId)) {
    //console.log("Current tab shoudl be proxied");            
    if (!PARENT) { // request images, css, styles, javascript (passed by proxy) -> tab proxied
      //console.log("Getting files for page: %s", details.url);
    } else {
      //console.log('%c New page entered: %s', 'background: #99ffcc;', details.url);
      var tabObj = this.proxy_tabs[details.tabId];
      var isProxied = this.isProxyTabActived(details.tabId, details.url);
      //console.log("This page is actively proxied " + isProxied);
      if (isProxied) {
        // this is already a registered url for this proxy tab
        //console.log('%c Accessing Pages registered in proxy tab (search/plusOne/plusTwo/ProxyUrl/PreSetting) URL: %s', 'color: #0033FF', details.url);
        if(!this.updateCurrentProxyUrl(details.tabId, details.url))
          this.resetPlusTwoIfPlusOne(details.tabId, details.url);

        chrome.tabs.query({currentWindow: true, active: true}, function (tabs) {
          if (tabs[0].id == details.tabId) context.setProxy();
        });

      } else if ((tabObj.plus_one.url == "") || (tabObj.plus_one.id_request >= 0)) {
        //console.log('%c Saving search Plus One URL: %s', 'color: #0033FF', details.url);
        tabObj.plus_one.url = details.url;
        tabObj.plus_one.id_request = details.requestId;

        chrome.tabs.query({currentWindow: true, active: true}, function (tabs) {
          if (tabs[0].id == details.tabId) context.setProxy();
        });

      } else if ((tabObj.plus_two.url == "") || (tabObj.plus_two.id_request >= 0)) {
        //console.log('%c Saving search Plus Two URL: %s', 'color: #0033FF', details.url);
        tabObj.plus_two.url = details.url;
        tabObj.plus_two.id_request = details.requestId;

        if (isPrivateMode) {
        } else {
          this.setProxy();
          this.disableProxyIfNecessary(true);
        }
        
      } else {
        //console.log('%c Removing proxy tab, tabId: %s - Url: %s', 'background: #FF0000; color: #BADA55', details.tabId, details.url);
        if (isPrivateMode) {
          chrome.tabs.query({currentWindow: true, active: true}, function (tabs) {
            if (tabs[0].id == details.tabId) context.removeProxy();
          });
        }
      }

      // set current tab page
      tabObj.current_page = details.url;
    }
  }
};

DMSP1.prototype.onWebRequestBeforeSendHeaders = function(details) {
  //console.log('%c WebReq.onBeforeSendHeaders:', 'color: #FF07FA; background: #000000');

  // insert new header (if with proxy set)
  if (this.proxy_actived == true) {
    details.requestHeaders.push(this.XDHR);
  }
  // header for disconnect page
  if (details.url.indexOf(this.C_PROXY_SEARCH) >= 0) {
    var XDST = {name: 'X-Disconnect-Stats', value: JSON.stringify({
      group_id: localStorage.search_group,
      product_id: localStorage.search_product,
      user_id: (this.BG.get_adblock_user_id() || '0')
    })};
    details.requestHeaders.push(XDST);
  }

  // delete the Referer header from all search requests
  for (var i=0; i<details.requestHeaders.length; ++i) {
    if (details.requestHeaders[i].name.toLowerCase() === 'referer') {
      var headerValue = details.requestHeaders[i].value;
      if (headerValue.indexOf(this.C_PROXY_SEARCH) >= 0) {
        //console.log("Deleted the Referer header value", headerValue, "from", details.url);
        details.requestHeaders.splice(i, 1);
      }
      break;
    }
  }

  // delete the Cookie header from all search requests
  if ( (details.url.indexOf(this.C_PROXY_SEARCH)<0) && this.isProxyTab(details.tabId) && this.proxy_tabs[details.tabId].current_page && (this.proxy_tabs[details.tabId].current_page.indexOf(this.C_PROXY_SEARCH)>=0) ){
    for (var i=0; i<details.requestHeaders.length; ++i) {
      if (details.requestHeaders[i].name.toLowerCase() === 'cookie') {
        //console.log("Deleted the Cookie header", "tabId:", details.tabId, "from:", details.url);
        //console.log(details.requestHeaders[i].value);
        details.requestHeaders.splice(i, 1);
        break;
      }
    }
  }

  // get more information
  if (this.sendXDIHR == true) {
    details.requestHeaders.push({name: 'XDIHR', value: 'trace'});
  }

  return {requestHeaders: details.requestHeaders};
};

DMSP1.prototype.onWebRequestHeadersReceived = function(details) {
  //console.log('%c WebRequest.onHeadersReceived:', 'color: #FF07FA; background: #000000');
  //console.log(details.url);

  // received XDHR from search servers
  var tabObj = this.proxy_tabs[details.tabId];
  if (tabObj && details.url.indexOf(this.C_PROXY_SEARCH+"/search")>=0) { 
    for (var i=0; i<details.responseHeaders.length; ++i) {
      var objHeader = details.responseHeaders[i];
      if (objHeader && (objHeader.name.toLowerCase() === this.XDHR.name.toLowerCase())) {
        this.XDHR.value = objHeader.value;
        //console.log(objHeader);
      }
    }
  }

  return {responseHeaders: details.responseHeaders};
};

DMSP1.prototype.onWebRequestCompleted = function(details) {
  //console.log('%c WebReq.onCompleted:', 'color: #FF07FA; background: #000000');
  //console.log(details);

  var tabObj = this.proxy_tabs[details.tabId];
  if (tabObj) {
    //console.log('%c Found a proxied tab', 'background: #cccc33');
    //console.log(tabObj);
    if ((tabObj.search.id_request == details.requestId) && (tabObj.preset_in_progress == true)) {
      //tabObj.search.url = details.url.replace(this.C_PROXY_PRESETTING, this.C_PROXY_SEARCH);
      this.proxy_tabs[details.tabId].search.id_request = -1;
      //console.log('%c Search Changed URL After response: %s', 'background: #99ffcc;', tabObj.search.url);
    } else if (tabObj.plus_one.id_request == details.requestId) {
      tabObj.plus_one.url = details.url;
      tabObj.plus_one.id_request = -1;
      //console.log('%c PlusOne Changed URL After response: %s', 'background: #99ffcc;', details.url);
    } else if (tabObj.plus_two.id_request == details.requestId) {
      tabObj.plus_two.url = details.url;
      tabObj.plus_two.id_request = -1;

      this.disableProxyIfNecessary(true);  // update timer
      //console.log('%c PlusTwo Changed URL After response: %s', 'background: #99ffcc;', details.url);
    }
  } 
};

DMSP1.prototype.onWebCompleted = function(details) {
  //console.log('%c WebNav.onCompleted:', 'color: #FF07FA; background: #000000');
  //console.log(details.url);
  //console.log(this.proxy_tabs);

  if (this.isProxyTabActived(details.tabId, details.url)) {
    var tabObj = this.proxy_tabs[details.tabId];
    if (tabObj && (tabObj.preset_in_progress == true)) {
      var jsCode = "window.location = '" + tabObj.search.url + "';";
      chrome.tabs.executeScript(details.tabId, {code: jsCode, runAt: "document_end"}, function(){
        tabObj.preset_in_progress = false;
        //console.log("Injecting JavaScript Redirected to proxy search \n%s", tabObj.search.url);
      });
    }
  }

  if (details.tabId > 0)
    this.injectJsInSearchForm(details.tabId, details.url, details.type);
};

DMSP1.prototype.onWebCreatedNavigationTarget = function(details) {
  //console.log('%c WebNav.onCreatedNavigationTarget:', 'color: #FF07FA; background: #000000');
  //console.log(details);
  //console.log(this.proxy_tabs);
  this.page_focus = true;
  this.cloneTabObject(details.sourceTabId, details.tabId, false);
  //console.log(this.proxy_tabs);
};

DMSP1.prototype.onWebTabReplaced = function(details) {
  //console.log('%c WebNav.onReplaced:', 'color: #FF07FA; background: #000000');
  //console.log(details);
  //console.log(this.proxy_tabs);

  this.cloneTabObject(details.replacedTabId, details.tabId, true);
  //chrome.tabs.reload(details.tabId, {}, function(){}); // force reload to set plusOne or PlusTwo
  var tabObj = this.proxy_tabs[details.tabId];
  if (tabObj) {
    chrome.tabs.get(details.tabId, function(tab) {
      //console.log('%c %s', 'color: #FF07FA; background: #000000', tab.url);
      if (tabObj.plus_one.id_request == 0 && tabObj.plus_one.url == "") {
        tabObj.plus_one.url = tab.url;
        tabObj.plus_one.id_request = -1;
      } else if (tabObj.plus_two.id_request == 0 && tabObj.plus_two.url == "") {
        tabObj.plus_two.url = tab.url;
        tabObj.plus_two.id_request = -1;
      }
    });
  }

  var context = this;
  chrome.tabs.get(details.tabId, function(tab) {
    //console.log("injecting by webTabReplace!");
    context.injectJsInSearchForm(tab.id, tab.url, 'main_frame');
  });

  //console.log(this.proxy_tabs);
};

DMSP1.prototype.onTabCreated = function(tab) {
  //console.log('%c TAB.onCreated', 'color: #FF07FA; background: #000000');
  this.page_focus = false;
  this.showPitchPage(tab);
};

// function to reload and hide the Forbidden at chrome startup
DMSP1.prototype.onTabUpdated = function(tabId, changeInfo, tab) {
  //console.log('%c TAB.onUpdated', 'color: #FF07FA; background: #000000');
  if (tab.title.indexOf("Forbidden")>=0 && this.startup_verify) {
    chrome.tabs.insertCSS(tabId, {code: "body {display: none;}"}, function(){});
    chrome.tabs.reload(tabId);
  }
};

DMSP1.prototype.onTabRemoved = function(tabId, removeInfo) {
  //console.log('%c TAB.onRemoved', 'color: #FF07FA; background: #000000');
  this.removeProxyTab(tabId);
  //console.log(this.proxy_tabs);
};

DMSP1.prototype.onTabHighlighted = function(highlightInfo) {
  //console.log('%c TAB.onHighlighted', 'color: #FF07FA; background: #000000');
  //console.log(this.proxy_tabs);

  this.disableProxyIfNecessary(true);
};

DMSP1.prototype.onTabActivated = function(activeInfo) {
  //console.log('%c TAB.onActivated', 'color: #FF07FA; background: #000000');
  //console.log(this.proxy_tabs);

  var isPrivateMode = (deserialize(localStorage['search_full_secure']) == false);
  if (isPrivateMode) {
    var context = this;

    window.clearTimeout(this.timer); // clear timer
    if (this.isProxyTab(activeInfo.tabId)) {
      chrome.tabs.get(activeInfo.tabId, function(tab) {
        if ( context.isProxyTabActived(tab.id, tab.url) || (context.proxy_tabs[tab.id].plus_two.url == "") )
          context.setProxy();
        else
          context.removeProxy();
      });
    } else {
      this.removeProxy();
    }
  }
};

DMSP1.prototype.injectJsInSearchForm = function(tabId, url, type) {
  // Access Search Page Enginer without params
  if (type == 'main_frame' || type == undefined) {
    var found = false;
    var CHILD_DOMAIN = this.getHostname(url);

    if (CHILD_DOMAIN.indexOf(".google.")>=0) found = true;
    else if (CHILD_DOMAIN.indexOf("bing.com")>=0) found = true;
    else if (CHILD_DOMAIN.indexOf("yahoo.com")>=0) found = true;
    else if (CHILD_DOMAIN.indexOf("blekko.com")>=0) found = true;
    else if (CHILD_DOMAIN.indexOf("duckduckgo.com")>=0) found = true;

    var isDisconnect = (CHILD_DOMAIN.indexOf(this.C_PROXY_SEARCH)>=0);
    if (found && !isDisconnect) {
      chrome.tabs.executeScript(tabId, {file: "search/serp.js", runAt: "document_end"});
    }

    var pitch_page_host = this.getHostname(localStorage.search_group_pitch);
    if (CHILD_DOMAIN.indexOf(pitch_page_host)>=0) {
      chrome.tabs.executeScript(tabId, {file: "search/pitchpage.js", allFrames: false, runAt: "document_end"});
    }
  }

  this.doSecureReminder(tabId, url);
};

DMSP1.prototype.doSecureReminder = function(tabId, url) {
  const oneDayAsMsec = 24 * this.HOUR_MS;
  const REQUESTED_URL = url;
  const CHILD_DOMAIN = this.getHostname(REQUESTED_URL);

  var showSecureReminder = (localStorage['search_secure_reminder_show'] == "true");
  var enableSS = (localStorage['search_secure_enable'] == "true");
  var search_chk_mode_set = JSON.parse(localStorage['search_chk_mode_set']);
  var enableOmniBox = (search_chk_mode_set['omnibox'] == true);
  var enableSESite = (search_chk_mode_set['everywhere'] == true);
  var isConfInsecure = enableSS && !enableOmniBox && !enableSESite;

  if (!(showSecureReminder && isConfInsecure)) return;

  var isGoogle = (CHILD_DOMAIN.search(".google.") > -1);
  if (!(isGoogle)) return;

  var now = new Date();
  var qty_dialog_show = parseInt(localStorage['search_qty_sr_show']);
  var last_time_show = new Date(localStorage['search_last_date_sr_show'] || now);
  var one = ( qty_dialog_show==0 && ((now.getTime() - last_time_show.getTime())>=0*oneDayAsMsec) );
  var two = ( qty_dialog_show==1 && ((now.getTime() - last_time_show.getTime())>=1*oneDayAsMsec) );
  var three = ( qty_dialog_show==2 && ((now.getTime() - last_time_show.getTime())>=2*oneDayAsMsec) );
  var four = ( qty_dialog_show==3 && ((now.getTime() - last_time_show.getTime())>=7*oneDayAsMsec) );
  var showOften = (one || two || three || four);

  if (!showOften) return;

  chrome.tabs.executeScript(tabId, {file: "jquery/jquery.min.js", runAt: "document_start"}, function() {
    chrome.tabs.executeScript(tabId, {file: "search/pitchpage.js", runAt: "document_start"}, function() {
      chrome.tabs.executeScript(tabId, {file: "search/secure_reminder.js", runAt: "document_start"}, function() {});
    });
  });
};

// register proxy tab id and set proxy
DMSP1.prototype.registerProxiedTab = function(tabId, searchUrl, idRequest, presetting) {
  //if not already a proxy tab then register it and set the preset in progress to true
  // other wise no need to do preset just need to update the objects contents
    
  //console.log("Current Proxy Tabs:");
  //console.log(this.proxy_tabs);
  var isProxyTAB = this.isProxyTab(tabId);
  if (tabId>0 && !isProxyTAB) {
    //console.log("register new tab.");
    this.proxy_tabs[tabId] = {
      "preset_in_progress": presetting,
      "search": {"url": (searchUrl ? searchUrl:""), "id_request": (idRequest ? idRequest:0)},
      "plus_one": {"url": "", "id_request": 0},
      "plus_two": {"url": "", "id_request": 0}
    };
    this.coveringPlusOneTwo(this.proxy_tabs[tabId]);

    this.setProxy(); // set proxy
  } else if (isProxyTAB){
    //console.log("Update tab search");
    this.proxy_tabs[tabId].preset_in_progress = presetting;
    this.proxy_tabs[tabId].search = {
      "url": (searchUrl ? searchUrl:""),
      "id_request": (idRequest ? idRequest:0)
    }
  }
  //console.log("Updated Proxy Tabs:");
  //console.log(this.proxy_tabs);
};

DMSP1.prototype.cloneTabObject = function(tabIdSrc, tabIdDst, withTabSrcDelete) {
  if (this.isProxyTab(tabIdSrc)) {
    var tabIdSrcObj = this.proxy_tabs[tabIdSrc];
    this.proxy_tabs[tabIdDst] = {
      "preset_in_progress": tabIdSrcObj.preset_in_progress,
      "search": {"url": tabIdSrcObj.search.url, "id_request": tabIdSrcObj.search.id_request},
      "plus_one": {"url": tabIdSrcObj.plus_one.url, "id_request": tabIdSrcObj.plus_one.id_request},
      "plus_two": {"url": tabIdSrcObj.plus_two.url, "id_request": tabIdSrcObj.plus_two.id_request}
    };
    if (withTabSrcDelete == true)
      this.removeProxyTab(tabIdSrc);
    return true;
  }
  return false;
};

DMSP1.prototype.updateCurrentProxyUrl = function(tabId, url) {
  //reset plus one and plus 2 (if search change)
  var tabObj = this.proxy_tabs[tabId];
  if (tabObj && this.isProxyUrl(url)) {
    tabObj.search.url = url;
    tabObj.plus_one = {"url": "", "id_request": 0};
    tabObj.plus_two = {"url": "", "id_request": 0};

    this.coveringPlusOneTwo(tabObj);
    //console.log('%c Updating registered proxy url: %s', 'color: #cc33FF', url);
    //console.log(tabObj);
    return true;
  }
  return false;
};

DMSP1.prototype.coveringPlusOneTwo = function(tabObj) {
  if (tabObj && (deserialize(localStorage['search_coverage_plus_one_two']) == false) ) {
    var url = "https://disabled";
    tabObj.plus_one = {"url": url, "id_request": -1};
    tabObj.plus_two = {"url": url, "id_request": -1};
  }
};

DMSP1.prototype.resetPlusTwoIfPlusOne = function(tabId, url) {
  // reset plus two if plus one
  var tabObj = this.proxy_tabs[tabId];
  if (tabObj && (tabObj.plus_one.url == url)) {
    tabObj.plus_two = {"url": "", "id_request": 0};
    //console.log('%c resetting plus 2 url: %s', 'color: #cc33FF', url);
    //console.log(tabObj);
    return true;
  }
  return false;
};

DMSP1.prototype.removeProxyTab = function(tabId) {
  var value = false
  if (this.proxy_tabs[tabId]) {
    delete this.proxy_tabs[tabId];
    value = true;
  }

  this.disableProxyIfNecessary(true);
  return value;
};

DMSP1.prototype.matchesCurrentProxyUrl = function(tabId, url) {
  var tabObj = this.proxy_tabs[tabId];
  return (tabObj) ? (tabObj.search.url == url) : false;
};

DMSP1.prototype.isProxyUrl = function(url) {
  return (url != null) ? ((url.indexOf(this.C_PROXY_SEARCH)>=0 && url.indexOf(this.C_PROXY_PRESETTING)<0)) : false;
};

DMSP1.prototype.isProxySearchUrl = function(url) {
  var value = false;
  if (url != null)
    if (url.indexOf(this.C_PROXY_SEARCH) >= 0) {
      value = true;
      if ((url == "http://"+this.C_PROXY_SEARCH+"/") || (url == "https://"+this.C_PROXY_SEARCH+"/"))
        value = false;
    }
  return value;
};

DMSP1.prototype.isProxyTab = function(tabId) {
  return (this.proxy_tabs[tabId]==null) ? false : true;
};

DMSP1.prototype.isProxyTabActived = function(tabId, url) {
  var tabObj = this.proxy_tabs[tabId];
  if (tabObj)
    return (
      (tabObj.search.url == url) || 
      (tabObj.plus_one.url == url) ||
      (tabObj.plus_two.url == url) ||
      (tabObj.preset_in_progress == true) ||
      (this.isProxyUrl(url))
    );
  return false;
};

DMSP1.prototype.hasProxy = function() {
  // proxy must be active. While there is some plus_two empty!
  var tabs = this.proxy_tabs;
  for (var key in tabs) {
    var tabObj = tabs[key];
    if (tabObj) {
      if (!tabObj.plus_two.url || (tabObj.plus_two.url && tabObj.plus_two.url == ""))
        return true;
    }
  }
  return false;
};

DMSP1.prototype.disableProxyIfNecessary = function(withTimer) {
  var isPrivateMode = (deserialize(localStorage['search_full_secure']) == false);
  if (isPrivateMode) {

  } else { // secure mode
    if (this.hasProxy() == false) {
      if (withTimer == true)
        this.setProxyTimer();
      else
        this.removeProxy();
    }
  }
};

DMSP1.prototype.resetProxyTimer = function() {
  window.clearTimeout(this.timer);
};

DMSP1.prototype.setProxyTimer = function() {
  this.resetProxyTimer();
  this.timer = window.setTimeout(this.onAlarm.bind(this), this.expiryTimer);
  //console.log("DEACTIVING: PROXY - WITH TIMER");
};

// set the proxy
DMSP1.prototype.setProxy = function() {
  var context = this;
  this.proxy_actived = true;
  this.resetProxyTimer();
  chrome.proxy.settings.set({value: this.config_proxied, scope: 'regular'}, function() {
    context.updateIcon(true);
    //console.log("ACTIVED: PROXY");
  });
};

// unset the proxy
DMSP1.prototype.removeProxy = function() {
  var context = this;
  this.resetProxyTimer();
  chrome.proxy.settings.set({value: this.config_direct, scope: 'regular'}, function() {
    context.proxy_actived = false;
    context.updateIcon(false);
    //console.log("DEACTIVED: PROXY");
  });
};

DMSP1.prototype.reportUsage = function() {
  const oneDayAsMsec = 24 * this.HOUR_MS;
  
  // Ensure we have valid dates.
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

  //yearly|semiannual|quarterly|monthly|weekly|daily
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
    'user_id=' + (get_adblock_user_id() || '0'),
    'build=' + localStorage.adblock_build_version,
    'search_build=' + localStorage.search_build_version,
    'cohort=' + (localStorage.search_cohort || 'none')
  ].join('&');

  var search_chkbox_counter = JSON.parse(localStorage['search_chkbox_counter']);
  var search_pitch_page_counter = JSON.parse(localStorage['search_pitch_page_counter']);
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
    pitch_page_no: search_pitch_page_counter.no  || 0,
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
      search_pitch_page_counter.learn_more -= report_values_to_send.pitch_page_learnmore;
      localStorage['search_chkbox_counter'] = JSON.stringify(search_chkbox_counter);
      localStorage['search_pitch_page_counter'] = JSON.stringify(search_pitch_page_counter);
    }
  });
};

DMSP1.prototype.onAlarm = function() {
  this.removeProxy();
};

DMSP1.prototype.onMgmUninstalled = function(id) {
  //console.log('%c Management Uninstall', 'color: #FF07FA; background: #000000');
  this.removeProxy();
};

DMSP1.prototype.onMgmDisabled = function(info) {
  //console.log('%c Management Disabled', 'color: #FF07FA; background: #000000');
  this.removeProxy();
};

String.prototype.count = function(s1) { 
  return (this.length - this.replace(new RegExp(s1,"g"), '').length) / s1.length;
};

DMSP1.prototype.updateIcon = function(enabled) {
  if (this.iconChange == true) {
    var icon_name = (enabled) ? '/img/icon48_green.png' : '/img/icon48.png';
    chrome.browserAction.setIcon({path: icon_name});
  }
};

// Message communication
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
        'omnibox': deserialize(localStorage['search_omnibox']),
        'everywhere': deserialize(localStorage['search_everywhere']),
        'secure': deserialize(localStorage['search_full_secure'])
      };
      localStorage['search_chk_mode_set'] = JSON.stringify(chk_box);

      var mode = 0;
      if      (chk_box.everywhere==false && chk_box.omnibox==true) mode = 1;
      else if (chk_box.everywhere==true && chk_box.omnibox==false) mode = 2;
      else if (chk_box.everywhere==true && chk_box.omnibox==true)  mode = 3;
      localStorage['search_mode_settings'] = deserialize(mode);

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
  } else if (request.action == 'show_search_dialog') {
    localStorage['search_qty_sr_show'] = parseInt(localStorage['search_qty_sr_show']) + 1;
    localStorage['search_last_date_sr_show'] = new Date();
  } else if (request.pitch_page != undefined) {
    if (request.pitch_page == 'pageOptions') {
      var showCurrentOptions = JSON.parse(localStorage['search_show_mode_set']);
      var pageOptions = request.value.split("|");

      showCurrentOptions.omnibox = showCurrentOptions.everywhere = true;
      for (i=0; i<pageOptions.length; i++) {
        if (pageOptions[i] == 'hideSearchOmnibox') {
          showCurrentOptions.omnibox = false;
        } else if (pageOptions[i] == 'hideSearchWebsite') {
          showCurrentOptions.everywhere = false;
        }
      }
      localStorage['search_show_mode_set'] = JSON.stringify(showCurrentOptions);
    } else if (request.pitch_page == 'noPrivateSearch') {
      localStorage.search_secure_enable = "false";
      var pitch_page_counter = JSON.parse(localStorage['search_pitch_page_counter']);
      pitch_page_counter.no++;
      localStorage['search_pitch_page_counter'] = JSON.stringify(pitch_page_counter);
    } else if (request.pitch_page == 'yesPrivateSearch') {
      localStorage.search_secure_enable = "true";
      var pitch_page_counter = JSON.parse(localStorage['search_pitch_page_counter']);
      pitch_page_counter.yes++;
      localStorage['search_pitch_page_counter'] = JSON.stringify(pitch_page_counter);
    } else if (request.pitch_page == 'learnmore') {
      var pitch_page_counter = JSON.parse(localStorage['search_pitch_page_counter']);
      pitch_page_counter.learn_more++;
      localStorage['search_pitch_page_counter'] = JSON.stringify(pitch_page_counter);
    } else {
      submitValues(request, sender, sendResponse);
    }

    this.BG.update_filters();
  }
};

DMSP1.prototype.showPitchPage = function(tab) {    
  var pitch_page_show = localStorage.search_pitch_page_shown;
  if ( (pitch_page_show=="true") || (tab.url.indexOf('chrome-devtools://')>=0) ||
     ( (tab.url.indexOf('chrome://')>=0) && !(tab.url.indexOf('chrome://newtab/')>=0) ) ) return;

  chrome.tabs.update(tab.id, {url: localStorage.search_group_pitch}, function(tab) {
    localStorage.search_pitch_page_shown = "true";
    localStorage.search_show_form = "true";
    var pitch_page_counter = JSON.parse(localStorage['search_pitch_page_counter']);
    pitch_page_counter.total++;
    localStorage['search_pitch_page_counter'] = JSON.stringify(pitch_page_counter);
  });
};

//Function to cancel the startup verifications
DMSP1.prototype.onExtensionStartup = function() {
  var context = this;
  setTimeout(function() {
      context.startup_verify = false;
  }, 10000);
};

DMSP1.prototype.onWindowsFocusChanged = function(windowId) {
  //console.log('%c Windows.onFocusChanged:', 'color: #FF07FA; background: #000000');

  var context = this;
  chrome.windows.getLastFocused({populate: true}, function(win) {
    var foundProxyTab = false;
    var tabs = win.tabs;

    for (var i=0; i<tabs.length; ++i) {
      var tab = tabs[i];
      if ((tab.selected == true) && context.isProxyTab(tab.id)) {
        if (context.isProxyTabActived(tab.id, tab.url) || (context.proxy_tabs[tab.id].plus_two.url == "") ) {
          foundProxyTab = true;
        }
        break;
      }
    }

    if (foundProxyTab)
      context.setProxy();
    else
      context.removeProxy();
  });
};

DMSP1.prototype.search_init_variables = function() {
  this.proxy_tabs = [];

  const newInstallt = deserialize(localStorage['search_new_install']);
  if (typeof newInstallt === 'undefined') {
    localStorage['search_new_install'] = "false";
    localStorage['search_secure_enable'] = "false";

    localStorage['search_show_mode_set'] = '{"omnibox":true,"everywhere":true,"secure":false}';
    localStorage['search_chk_mode_set'] = '{"ominibox":false,"everywhere":false,"secure":false}';
    localStorage['search_omnibox'] = "false";
    localStorage['search_everywhere'] = "false";

    localStorage['search_engines'] = "0";       // google
    localStorage['search_mode_settings'] = "0"; // popup only

    localStorage['search_secure_reminder_show'] = "true";   // open dialog
    localStorage['search_qty_sr_show'] = "0";
    localStorage['search_last_time_sr_show'] = "0";
    localStorage['search_coverage_plus_one_two'] = "false"; // coverage +1 & +2
    localStorage['search_full_secure'] = "false";
    localStorage['search_cohort'] = "7";

    localStorage['search_pwyw'] = JSON.stringify({date: new Date(), bucket: "viewed"});
    localStorage['search_chkbox_counter'] = JSON.stringify({
      "popup":   { "omnibox":{"on":0,"off":0}, "seweb":{"on":0,"off":0}, "private":{"on":0,"off":0} },
      "welcome": { "omnibox":{"on":0,"off":0}, "seweb":{"on":0,"off":0} },
      "dialog":  { "omnibox":{"on":0,"off":0}, "seweb":{"on":0,"off":0} }
    });
    localStorage['search_pitch_page_counter'] = JSON.stringify({"yes":0,"no":0,"learn_more":0,"total":0});
    localStorage['search_total'] = "0";
    localStorage['search_show_form'] = "false";
    localStorage['search_pitch_page_shown'] = "false";

    localStorage['adblock_build_version'] = this.BG.STATS.version || "2.6.18";
    localStorage['search_build_version'] = "1.5.0";
    if (localStorage['search_group'] === 'undefined') localStorage['search_group'] = 'gadblock';
    localStorage['search_product'] = 'adblock';
  }
};

function fix_forbidden_page(context) {
  context.onExtensionStartup();
  var timeToWait = 3 * 700;
  setTimeout(function() {
   //console.log("verifing 403 pages ...", new Date());
    chrome.windows.getAll({populate: true}, function(wins) {
      for (var i=0; i<wins.length; ++i) {
        var win = wins[i];
        for (var j=0; j<win.tabs.length; ++j) {
          var tab = win.tabs[j];
          if (tab.title.indexOf("Forbidden")>=0) {
            chrome.tabs.insertCSS(tab.id, {code: "body {display: none;}"}, function(){});
            chrome.tabs.reload(tab.id);
          }
        }
      }
    });
  }, timeToWait);
};

DMSP1.prototype.search_load_listeners = function(context) {
  //console.log('%c Load Listerners', 'color: #FF07FA; background: #000000');
  var runtimeOrExtension = chrome.runtime && chrome.runtime.sendMessage ? 'runtime' : 'extension';
  chrome.webRequest.onBeforeRequest.addListener(context.onWebRequestBeforeRequest.bind(context), {urls: ['http://*/*', 'https://*/*']}, ['blocking']);
  chrome.webRequest.onCompleted.addListener(context.onWebRequestCompleted.bind(context), {urls: ['http://*/*', 'https://*/*']});
  chrome.webRequest.onBeforeSendHeaders.addListener(context.onWebRequestBeforeSendHeaders.bind(context), {urls: ['http://*/*', 'https://*/*']}, ['blocking', "requestHeaders"]);
  chrome.webRequest.onHeadersReceived.addListener(context.onWebRequestHeadersReceived.bind(context), {urls: ['http://*/*', 'https://*/*']}, ['blocking', "responseHeaders"]);
  chrome.webNavigation.onCompleted.addListener(context.onWebCompleted.bind(context));
  chrome.webNavigation.onCreatedNavigationTarget.addListener(context.onWebCreatedNavigationTarget.bind(context));
  chrome.webNavigation.onTabReplaced.addListener(context.onWebTabReplaced.bind(context));
  chrome.tabs.onCreated.addListener(context.onTabCreated.bind(context));
  chrome.tabs.onRemoved.addListener(context.onTabRemoved.bind(context));
  chrome.tabs.onActivated.addListener(context.onTabActivated.bind(context));
  chrome.tabs.onHighlighted.addListener(context.onTabHighlighted.bind(context));
  chrome.tabs.onUpdated.addListener(context.onTabUpdated.bind(context));

  chrome.windows.onFocusChanged.addListener(context.onWindowsFocusChanged.bind(context));
  chrome[runtimeOrExtension].onMessage.addListener(context.onRuntimeMessage.bind(context));
  chrome[runtimeOrExtension].onStartup.addListener(context.onExtensionStartup.bind(context));
};

DMSP1.prototype.search_initialize = function(context) {
  this.search_init_variables();
  this.search_load_listeners(context);

  context.removeProxy();
  fix_forbidden_page(context);

  this.reportUsage();
  setInterval(this.reportUsage, this.HOUR_MS);
};