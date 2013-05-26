CheckboxUtil = (function() {
  //event binders should be handled separately
  var _createContainer = function(parent_name, filter_type) {
    var div = $("<div></div>").
      addClass("subscription").
      addClass(filter_type).
      attr("name", parent_name);
    return div;
  };
  
  var _createCheckbox = function(index, chkbox_id, is_subscribed, checked) {
    var checkbox = $('<input />').
      attr("type", "checkbox").
      attr("id", chkbox_id).
      attr("checked", is_subscribed || checked ? 'checked' : null).
      addClass("filter_control");
    
    return checkbox;
  };
  
  var _createLabel = function(label_display, url, chkbox_id){
    var display = label_display || url;
    var label = $("<label></label>").
      text(display).
      attr("title", url).
      attr("for", chkbox_id);
     
    return label;
  };
  
  var _createLink = function(label_display, url) {
    var link = $("<a></a>").
      text(label_display).
      css("margin-left", "6px").
      css("font-size", "10px").
      css("display", $("#btnShowLinks").prop("disabled") ? "inline" : "none").
      attr("target", "_blank").
      attr("class", "linkToList").
      attr("href", url);
  };
  
  var _createInfospan = function() {
    var infospan = $("<span></span>").
      addClass("subscription_info");
    
    return infospan;
  }
  
  var _createRemoveFilterLabel = function(entry) {
    var remove_anchor = $("<a>").
      css("font-size", "10px").
      css("display", entry.subscribed ? "none" : "inline").
      attr("href", "#").
      text(translate("removefromlist")).
      addClass("remove_filter");
    
    return remove_anchor;
  }
      
  return {
    createCheckbox: function(entry, index, filter_type, checked) {
      var chkbox_id = filter_type + "_" + index;
      //generate checkbox and all containers
      var container = _createContainer(entry.id, filter_type);
      var chckbox = _createCheckbox(index, chkbox_id, entry.subscribed, checked);
      
      var label_display = entry.label;
      
      var label = _createLabel(label_display, entry.url, chkbox_id);
      var link = _createLink(label_display, entry.url);
      var infospan = _createInfospan();
      
      container.
        append(chckbox).
        append(label).
        append(link).
        append(infospan);
      
      if (entry.user_submitted) {
        var remove_label = _createRemoveFilterLabel(entry);
        container.append(remove_label);
      }
      
      return container;
    }
  }
})();

SelectboxUtil = (function(){
  var $_language_select = $("#language_select");
  
  var _createOption = function(text_value, id, url, index) {
    
    var option = $("<option>", {
      value: text_value,
      text: text_value
    }).data("index", index);
    
    return option;
  };
  
  //hope this works
  var _insertOption = function(option, index) {
    var options = $_language_select.find("option");
    var i;
    for(i = 0; i < options.length; i++){
      var list_option_index = options.eq(i).data("index");
      if(list_option_index && parseInt(list_option_index) > parseInt(index)){
        break;
      }
    }
    if(options.eq(i).length > 0){
      options.eq(i).before(option);
    }else{
      $_language_select.append(option);
    }
  };
  
  return {
    addOption: function(language_filter, index) {
      var option = _createOption(language_filter.label, language_filter.id, language_filter.url, index);
      _insertOption(option, index);
    },
    
    initSelect: function(language_list) {
      for(var i = 0; i < language_list.length; i++){
        var language_filter = language_list[i];
        if(!language_filter.subscribed){
          this.addOption(language_filter, i);
        }
      }
    },
    
    getSelectbox: function(){
      return $_language_select;
    }
  }
})();

FilterManager = (function (){
  var _cached_subscriptions;
  
  var _filterlist_sections = {
    adblock_filter: {
      array: [],
      container: $("#add_blocking_list"),
      type: "adblock_filter"
    },
    language_filter: {
      array: [],
      container: $("#languange_list"),
      type: "language_filter"
    },
    other_filter: {
      array: [],
      container: $("#other_filters"),
      type: "other_filter"
    },
    custom_filter: {
      array: [],
      container: $("#custom_filters"),
      type: "custom_filter"
    }
  };
    
  var _prepareSubscriptions = function (arr) {
    for(var id in arr){
      var entry = arr[id];
      if (id === "adblock_custom" || id === "easylist") {
        _filterlist_sections.adblock_filter.array.push(entry);
      } else if (id === "easyprivacy") {
        _filterlist_sections.other_filter.array.push(entry);
      } else if (entry.user_submitted) {
        _filterlist_sections.custom_filter.array.push(entry);
      } else{
        _filterlist_sections.language_filter.array.push(entry);
      }
      entry.label = translate("filter" + id);
      entry.id = id;
    }
    _sortArrays();
  };
  
  //duplicate organize div exclusive for language filters
  var _organizeDivForLanguage = function(arr, container, filter_type){
    for(var i = 0; i < arr.length; i++){
      if(arr[i].subscribed){
        var checkbox = CheckboxUtil.createCheckbox(arr[i], i, filter_type);
        container.append(checkbox);
      }
    }
  };
  
  //populate div with data from array
  var _organizeDiv = function (arr, container, filter_type){
    if(filter_type === _filterlist_sections.language_filter.type){
      _organizeDivForLanguage(arr, container, filter_type);
    }else{
      for(var i = 0; i < arr.length; i++){
        var checkbox = CheckboxUtil.createCheckbox(arr[i], i, filter_type);
        container.append(checkbox);
      }
    }
  };
  //sorts array of subscriptions by using order attribute
  var _sortArrays = function() {
    for (var id in _filterlist_sections){
      _filterlist_sections[id].array.sort(function(a,b) {
        return a.label > b.label ? 1 : (a.label === b.label ? 0 : -1);
      });
    }
  };
  
  var _selectboxAction = function($this) {
    var language_filter_section = _filterlist_sections.language_filter;
    var selected_option = $this.find(':selected');
    var index = $(selected_option).data("index");
    var entry = language_filter_section.array[index];
    if(entry){
      $this.find('option:first').attr('selected','selected');
      selected_option.remove();
      var checkbox = CheckboxUtil.createCheckbox(entry, index, language_filter_section.type, true);
      language_filter_section.container.append(checkbox);
      _subscribe(entry.id);
    }
  };
  
  var _checkboxAction = function($this){
    var $parent = $this.parent();
    var checked = $this.is(":checked");
    var id = $parent.attr("name");
    if(checked){
      $(".subscription_info", $parent).text(translate("fetchinglabel"));
      _subscribe(id);
    } else {
      _unsubscribe(id, false);
      $(".subscription_info", $parent).
        text(translate("unsubscribedlabel"));
    }
  };
  
  var _languageCheckboxAction = function(parent) {
    var $parent = parent;
    $parent.fadeOut();
    setTimeout(function(){
      var option = $parent.find("input");
      var index = $(option).attr("id").split("_")[2];
      var filter = _filterlist_sections.language_filter.array[index];
      SelectboxUtil.addOption(filter, index);
      $parent.empty().remove();
    }, 1000);
  };
  
  var _createCustomCheckbox = function(entry){
    var custom_filter = _filterlist_sections.custom_filter;
    var index = custom_filter.length;
    var checkbox = CheckboxUtil.createCheckbox(entry, index, custom_filter.type, true);
    custom_filter.container.append(checkbox);
  };
  
  var _uploadAction = function(){
    var url = $("#txtNewSubscriptionUrl").val();
    var abp_regex = /^abp.*\Wlocation=([^\&]+)/i;
    if (abp_regex.test(url)) {
      url = url.match(abp_regex)[1]; // the part after 'location='
      url = unescape(url);
    }
    url = url.trim();
    var subscribe_to = "url:" + url;
    if (/^https?\:\/\/[^\<]+$/.test(url)) {
      _subscribe(subscribe_to);
      $("#txtNewSubscriptionUrl").val("");
      var entry = {
        id: subscribe_to,
        url: url,
        subscribed: true,
        unsubscribe: true,
        user_submitted: true,
        label: ""
      };
      _createCustomCheckbox(entry);
    } else
      alert(translate("failedtofetchfilter"));
  };
  
  var _removeAction = function($this){
    var parent = $this.parent();
    var id = parent.attr("name");
    _unsubscribe(id, true);
    parent.remove();
  };
  
  //TODO: Bind the controls lol
  var _bindControls = function() {
    var selectbox = SelectboxUtil.getSelectbox();
    selectbox.on("change", function(){
      _selectboxAction($(this));
    });
    
    $("body").on("change", ".language_filter > .filter_control", function(){
      _languageCheckboxAction($(this).parent());
    });
    
    $("body").on("click", ".filter_control", function(){
      _checkboxAction($(this));
    });
    
    // In case a subscription changed (updated or subscribed via subscribe.html)
    // then update the subscription list.
    chrome.extension.onRequest.addListener(function(request, sender, sendResponse) {
      if (request.command !== "filters_updated")
        return;
      _updateSubscriptionList();
      sendResponse({});
    });
    
    // If the user presses the update now button, update all subscriptions
    $("#btnUpdateNow").click(function() {
      $(this).attr("disabled", "disabled");
      BGcall("update_subscriptions_now");
      setTimeout(function() {
        $("#btnUpdateNow").removeAttr("disabled");
      }, 300000); //re-enable after 5 minutes
    });
    
    // Add a new subscription URL
    $("#btnNewSubscriptionUrl").click(function() {
      _uploadAction();
    });
    
    // Pressing enter will add the list too
    $('#txtNewSubscriptionUrl').keypress(function(event) {
      if (event.keyCode === 13) {
        event.preventDefault();
        $("#btnNewSubscriptionUrl").click();
      }
    });
    
    // Pressing enter will add the list too
    $('#txtNewSubscriptionUrl').keypress(function(event) {
      if (event.keyCode === 13) {
        event.preventDefault();
        $("#btnNewSubscriptionUrl").click();
      }
    });
    
    $('.remove_filter').click(function(event) {
      event.preventDefault();
      _removeAction($(this));
    });
    //bind unsubscribe all options,
    //bind subscribe all options
    //bind remove filter span,
    //bind links for filter list,
    //bind listeners
  };
  
  var _updateListitem = function(id, entry, update_entry){
    for(var prop in entry){
      if(update_entry[prop] !== entry[prop]){
        update_entry[prop] = entry[prop];
        if(entry.subscribed && prop === 'last_update'){
          //work around to remove Fetching Label since fetching label is not remove automatically
          var div = $("[name='" + id + "']");
          $(".subscription_info", div).text("");
        }
      };
    }
  };
  
  var _updateSubscriptionList = function(){
    BGcall("get_subscriptions_minus_text", function(subs) {
      for(var id in _cached_subscriptions){
        var entry = subs[id];
        if(entry){
          var update_entry = _cached_subscriptions[id];
          _updateListitem(id, entry, update_entry);
        }else{
          //TODO: promp user that there is an update and ask to reload
        }
      }
    });
  };
  
  var _subscribe = function(id) {
    if(!_validateOverSubscription()){
      return;
    }
    
    var parameters = {id: id};
    if (_cached_subscriptions[id] && _cached_subscriptions[id].requiresList){
      parameters.requires = _cached_subscriptions[id].requiresList;
    }

    BGcall("subscribe", parameters);
  };
  
  var _validateOverSubscription = function() {
    if ($(":checked", "#filter_subscriptions").length <= 6)
      return true;
    if (optionalSettings.show_advanced_options) {
      // In case of an advanced user, only warn once every 30 minutes, even
      // if the options page wasn't open all the time. 30 minutes = 1/48 day
      if ($.cookie('noOversubscriptionWarning'))
        return true;
      else
        $.cookie('noOversubscriptionWarning', 'true', {expires: (1/48)});
    }
    return confirm(translate("you_know_thats_a_bad_idea_right"));
  };
  
  var _unsubscribe = function(id, del) {
    BGcall("unsubscribe", {id:id, del:del});
  };
  
  var _getLastUpdateValue = function(last_update) {
    var how_long_ago = Date.now() - last_update;
    var seconds = Math.round(how_long_ago / 1000);
    var minutes = Math.round(seconds / 60);
    var hours = Math.round(minutes / 60);
    var days = Math.round(hours / 24);
    var text = "";
      if (seconds < 10)
        text += translate("updatedrightnow");
      else if (seconds < 60)
        text += translate("updatedsecondsago", [seconds]);
      else if (minutes === 1)
        text += translate("updatedminuteago");
      else if (minutes < 60)
        text += translate("updatedminutesago", [minutes]);
      else if (hours === 1)
        text += translate("updatedhourago");
      else if (hours < 24)
        text += translate("updatedhoursago", [hours]);
      else if (days === 1)
        text += translate("updateddayago");
      else
        text += translate("updateddaysago", [days]);
    return text;
  }
  
  return {
    initializePage: function(){
      BGcall('get_subscriptions_minus_text', function(subs) {
        //initialize page using subscriptions from the background
        //copy from update subscription list + setsubscriptionlist
        _cached_subscriptions = subs;
        _prepareSubscriptions(_cached_subscriptions);
        
        for(var id in _filterlist_sections){
          var filter_section = _filterlist_sections[id];
          _organizeDiv(filter_section.array, filter_section.container, filter_section.type);
        }
        SelectboxUtil.initSelect(_filterlist_sections.language_filter.array);
        _bindControls();
      });
    },
    
    //update information for each subscription
    updateSubscriptionInfoAll: function() {
      //copy from update subscription info all
      for(var id in _cached_subscriptions){
        var div = $("[name='" + id + "']");
        var subscription = _cached_subscriptions[id];
        var infoLabel = $(".subscription_info", div);
        var text = "";
        var fetching = translate("fetchinglabel");
        if (!$("input", div).is(":checked")) {
          if (infoLabel.text() === translate("unsubscribedlabel"))
            continue;
          text = "";
        } else if (!subscription.last_update_failed_at && !subscription.last_update) {
          text = translate("fetchinglabel");
        } else if (subscription.last_update_failed_at && !subscription.last_update) {
          text = translate("failedtofetchfilter");
        } else {
          if(infoLabel.text() === fetching){
            text = fetching;
            continue;
          }
          text = _getLastUpdateValue(subscription.last_update);
        }
        infoLabel.text(text);
      }
    }
  }
})();

$(function(){
  FilterManager.initializePage();
  window.setInterval(function() {
    FilterManager.updateSubscriptionInfoAll();
  }, 1000);
});
