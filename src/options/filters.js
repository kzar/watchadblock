function CheckboxUtil() {};

CheckboxUtil.prototype = {

  _createContainer : function(parent_name, filter_type) {
    var div = $("<div></div>").
      addClass("subscription").
      addClass(filter_type).
      attr("name", parent_name);
    return div;
  },
  
  _createCheckbox : function(index, chkbox_id, is_subscribed, checked) {
    var checkbox = $('<input />').
      attr("type", "checkbox").
      attr("id", chkbox_id).
      attr("checked", is_subscribed || checked ? 'checked' : null).
      addClass("filter_control");
    
    return checkbox;
  },
  
  _createLabel : function(label_display, url, chkbox_id){
    var display = label_display || url;
    var label = $("<label></label>").
      text(display).
      attr("title", url).
      attr("for", chkbox_id);
     
    return label;
  },
  
  _createLink : function(label_display, url) {
    var link = $("<a></a>").
      text(label_display).
      css("margin-left", "6px").
      css("font-size", "10px").
      css("display", $("#btnShowLinks").prop("disabled") ? "inline" : "none").
      attr("target", "_blank").
      attr("class", "linkToList").
      attr("href", url);
  },
  
  _createInfospan : function() {
    var infospan = $("<span></span>").
      addClass("subscription_info");
    
    return infospan;
  },
  
  _createRemoveFilterLabel : function(entry) {
    var remove_anchor = $("<a>").
      css("font-size", "10px").
      css("display", entry.subscribed ? "none" : "inline").
      attr("href", "#").
      text(translate("removefromlist")).
      addClass("remove_filter");
    
    return remove_anchor;
  },
  
  createCheckbox: function(entry, index, filter_type, checked) {
    var chkbox_id = filter_type + "_" + index;
    //generate checkbox and all containers
    var container = this._createContainer(entry.id, filter_type);
    var chckbox = this._createCheckbox(index, chkbox_id, entry.subscribed, checked);
    
    var label_display = entry.label;
     
    var label = this._createLabel(label_display, entry.url, chkbox_id);
    var link = this._createLink(label_display, entry.url);
    var infospan = this._createInfospan();
     
    container.
      append(chckbox).
      append(label).
      append(link).
      append(infospan);
      
    if (entry.user_submitted) {
      var remove_label = this._createRemoveFilterLabel(entry);
      container.append(remove_label);
    }
      
    return container;
  }
};

function SelectboxUtil($language_select) {
  this.$_language_select = $language_select;
};

SelectboxUtil.prototype = {
  _createOption : function(text_value, id, url, index) {
    var option = $("<option>", {
      value: text_value,
      text: text_value
    }).data("index", index);
    
    return option;
  },
  
  //hope this works
  _insertOption : function(option, index) {
    var options = this.$_language_select.find("option");
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
      this.$_language_select.append(option);
    }
  },
  
  addOption: function(language_filter, index) {
      var option = this._createOption(language_filter.label, language_filter.id, language_filter.url, index);
      this._insertOption(option, index);
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
    return this.$_language_select;
  }
};

var FilterListSections = (function(checkboxUtil) {
  var _checkboxUtil = checkboxUtil;
  var organize_div = function(filter_section){
    for(var i = 0; i < filter_section.array.length; i++){
      var checkbox = _checkboxUtil.createCheckbox(filter_section.array[i], i, filter_section);
      filter_section.container.append(checkbox);
    }
  };
    
  var language_organize_div = function(filter_section){
    for(var i = 0; i < filter_section.array.length; i++){
      if(filter_section.array[i].subscribed){
        var checkbox = _checkboxUtil.createCheckbox(filter_section.array[i], i, filter_section);
        filter_section.container.append(checkbox);
      }
    }
  };
    
  return {
    adblock_filter: {
      array: [],
      container: $("#add_blocking_list"),
      type: "adblock_filter",
      organize: function(){
        organize_div(this);
      }
    },
    language_filter: {
      array: [],
      container: $("#languange_list"),
      type: "language_filter",
      organize: function(){
        language_organize_div(this);
      }
    },
    other_filter: {
      array: [],
      container: $("#other_filters"),
      type: "other_filter",
      organize: function(){
        organize_div(this);
      }
    },
    custom_filter: {
      array: [],
      container: $("#custom_filters"),
      type: "custom_filter",
      organize: function(){
        organize_div(this);
      }
    }
  }
})(new CheckboxUtil()); //Temporary Solution

function FilterManager(checkboxUtil, selectboxUtil, filterListSections){
  this._checkboxUtil = checkboxUtil;
  this._selectboxUtil = selectboxUtil;
  this._filterListSections = filterListSections;
  this._cached_subscriptions = null;
};

FilterManager.prototype = {
  _prepareSubscriptions: function() {
    var arr = this._cached_subscriptions;
    for(var id in arr){
      var entry = arr[id];
      if (id === "adblock_custom" || id === "easylist") {
        this._filterListSections.adblock_filter.array.push(entry);
      } else if (id === "easyprivacy") {
        this._filterListSections.other_filter.array.push(entry);
      } else if (entry.user_submitted) {
        this._filterListSections.custom_filter.array.push(entry);
      } else{
        this._filterListSections.language_filter.array.push(entry);
      }
      entry.label = translate("filter" + id);
      entry.id = id;
    }
    this._sortArrays();
  },
  
  //sorts array of subscriptions by using order attribute
  _sortArrays: function() {
    for (var id in this._filterListSections){
      this._filterListSections[id].array.sort(function(a,b) {
        return a.label > b.label ? 1 : (a.label === b.label ? 0 : -1);
      });
    }
  },
  
  _selectboxAction: function($this) {
    var language_filter_section = this._filterListSections.language_filter;
    var selected_option = $this.find(':selected');
    var index = $(selected_option).data("index");
    var entry = language_filter_section.array[index];
    if(entry){
      $this.find('option:first').attr('selected','selected');
      selected_option.remove();
      var checkbox = this._checkboxUtil.createCheckbox(entry, index, language_filter_section.type, true);
      language_filter_section.container.append(checkbox);
      this._subscribe(entry.id);
    }
  },
  
  _checkboxAction: function($this){
    var $parent = $this.parent();
    var checked = $this.is(":checked");
    var id = $parent.attr("name");
    if(checked){
      $(".subscription_info", $parent).text(translate("fetchinglabel"));
      this._subscribe(id);
    } else {
      this._unsubscribe(id, false);
      $(".subscription_info", $parent).
        text(translate("unsubscribedlabel"));
    }
  },
  
  _languageCheckboxAction: function(parent) {
    var $parent = parent;
    $parent.fadeOut();
    setTimeout(function(){
      var option = $parent.find("input");
      var index = $(option).attr("id").split("_")[2];
      var filter = this._filterListSections.language_filter.array[index];
      this._selectboxUtil.addOption(filter, index);
      $parent.empty().remove();
    }, 1000);
  },
  
  _uploadAction: function(){
    var url = $("#txtNewSubscriptionUrl").val();
    var abp_regex = /^abp.*\Wlocation=([^\&]+)/i;
    if (abp_regex.test(url)) {
      url = url.match(abp_regex)[1]; // the part after 'location='
      url = unescape(url);
    }
    url = url.trim();
    var subscribe_to = "url:" + url;
    if (/^https?\:\/\/[^\<]+$/.test(url)) {
      this._subscribe(subscribe_to);
      $("#txtNewSubscriptionUrl").val("");
      var entry = {
        id: subscribe_to,
        url: url,
        subscribed: true,
        unsubscribe: true,
        user_submitted: true,
        label: ""
      };
      
      var custom_filter = this._filterListSections.custom_filter;
      var checkbox = this._checkboxUtil.createCheckbox(entry, custom_filter.index, custom_filter.type, true);
      custom_filter.container.append(checkbox);
      
    } else
      alert(translate("failedtofetchfilter"));
  },
  
  _removeAction: function($this){
    var parent = $this.parent();
    var id = parent.attr("name");
    this._unsubscribe(id, true);
    parent.remove();
  },
  
  //TODO: Bind the controls lol
  _bindControls: function() {
    var _this = this;
    var selectbox = _this._selectboxUtil.getSelectbox();
    selectbox.on("change", function(){
      _this._selectboxAction($(this));
    });
    
    $("body").on("change", ".language_filter > .filter_control", function(){
      _this._languageCheckboxAction($(this).parent());
    });
    
    $("body").on("click", ".filter_control", function(){
      _this._checkboxAction($(this));
    });
    
    // In case a subscription changed (updated or subscribed via subscribe.html)
    // then update the subscription list.
    chrome.extension.onRequest.addListener(function(request, sender, sendResponse) {
      if (request.command !== "filters_updated")
        return;
      _this._updateSubscriptionList();
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
      _this._uploadAction();
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
      _this._removeAction($(this));
    });
    //bind unsubscribe all options,
    //bind subscribe all options,
    //bind links for filter list
  },
  
  _updateListitem: function(id, entry, update_entry){
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
  },
  
  _updateSubscriptionList: function(){
    BGcall("get_subscriptions_minus_text", function(subs) {
      for(var id in this.filterManager._cached_subscriptions){
        var entry = subs[id];
        if(entry){
          var update_entry = this.filterManager._cached_subscriptions[id];
          this.filterManager._updateListitem(id, entry, update_entry);
        }else{
          //TODO: promp user that there is an update and ask to reload
        }
      }
    });
  },
  
  _subscribe: function(id) {
    if(!this._validateOverSubscription()){
      return;
    }
    
    var parameters = {id: id};
    if (this._cached_subscriptions[id] && this._cached_subscriptions[id].requiresList){
      parameters.requires = this._cached_subscriptions[id].requiresList;
    }

    BGcall("subscribe", parameters);
  },
  
  _validateOverSubscription: function() {
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
  },
  
  _unsubscribe: function(id, del) {
    BGcall("unsubscribe", {id:id, del:del});
  },
  
  _getLastUpdateValue: function(last_update) {
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
  },
    
  //update information for each subscription
  updateSubscriptionInfoAll: function() {
    //copy from update subscription info all
    for(var id in this._cached_subscriptions){
      var div = $("[name='" + id + "']");
      var subscription = this._cached_subscriptions[id];
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
        text = this._getLastUpdateValue(subscription.last_update);
      }
      infoLabel.text(text);
    }
  }
};

$(function(){
  var checkboxUtil = new CheckboxUtil();
  var selectboxUtil = new SelectboxUtil($("#language_select"));
  var filterListSections = FilterListSections;
  window.filterManager = new FilterManager(checkboxUtil, selectboxUtil, filterListSections);
  
  BGcall('get_subscriptions_minus_text', function(subs) {
    //initialize page using subscriptions from the background
    //copy from update subscription list + setsubscriptionlist
    this.filterManager._cached_subscriptions = subs;
    this.filterManager._prepareSubscriptions();
    for(var id in this.filterManager._filterListSections){
      var filter_section = this.filterManager._filterListSections[id];
      filter_section.organize();
      //_organizeDiv(filter_section.array, filter_section.container, filter_section.type);
    }
    this.filterManager._selectboxUtil.initSelect(this.filterManager._filterListSections.language_filter.array);
    this.filterManager._bindControls();
  });
  
  //filterManager.initializePage();
  window.setInterval(function() {
    window.filterManager.updateSubscriptionInfoAll();
  }, 1000);
});
