CheckboxUtil = (function() {
  //event binders should be handled separately
  var create_container = function(parent_name, filter_type) {
    var div = $("<div></div>").
      addClass("subscription").
      addClass(filter_type).
      attr("name", parent_name);
    return div;
  };
  
  var create_checkbox = function(index, chkbox_id, is_subscribed, checked) {
    var checkbox = $('<input />').
      attr("type", "checkbox").
      attr("id", chkbox_id).
      attr("checked", is_subscribed || checked ? 'checked' : null).
      addClass("filter_control");
    
    return checkbox;
  };
  
  var create_label = function(label_display, url, chkbox_id){
    var display = label_display || url;
    var label = $("<label></label>").
      text(display).
      attr("title", url).
      attr("for", chkbox_id);
     
    return label;
  };
  
  var create_link = function(label_display, url) {
    var link = $("<a></a>").
      text(label_display).
      css("margin-left", "6px").
      css("font-size", "10px").
      css("display", $("#btnShowLinks").prop("disabled") ? "inline" : "none").
      attr("target", "_blank").
      attr("class", "linkToList").
      attr("href", url);
  };
  
  var create_infospan = function() {
    var infospan = $("<span></span>").
      addClass("subscription_info");
    
    return infospan;
  }
  
  var create_remove_filter_label = function(entry) {
    var remove_anchor = $("<a>").
      css("font-size", "10px").
      css("display", entry.subscribed ? "none" : "inline").
      attr("href", "#").
      text(translate("removefromlist")).
      addClass("remove_filter");
    
    return remove_anchor
  }
      
  return {
    createCheckbox: function(entry, index, filter_type, checked) {
      var chkbox_id = filter_type + "_" + index;
      //generate checkbox and all containers
      var container = create_container(entry.id, filter_type);
      var chckbox = create_checkbox(index, chkbox_id, entry.subscribed, checked);
      
      var label_display = entry.label;
      
      var label = create_label(label_display, entry.url, chkbox_id);
      var link = create_link(label_display, entry.url);
      var infospan = create_infospan();
      
      container.
        append(chckbox).
        append(label).
        append(link).
        append(infospan);
      
      if (entry.user_submitted) {
        var remove_label = create_remove_filter_label(entry);
        container.append(remove_label);
      }
      
      return container;
    }
  }
}());

SelectboxUtil = (function(){
  var $language_select = $("#language_select");
  
  var create_option = function(text_value, id, url, position) {
    var data_container = {
      id: id,
      url: url,
      index: position
    };
    
    var option = $("<option>", {
      value: text_value,
      text: text_value
    }).data("values", data_container);
    
    return option;
  };
  
  //hope this works
  var insert_option = function(option, position) {
    var options = $language_select.find("option");
    var failed_insert = true;
    failed_insert = $.each(options, function(){
      var $this = $(this);
      
      var this_values = $this.data("values");
      var next_values = $this.next().data("values");
      
      var base_obj = { index: position };
      if(is_greater(base_obj, this_values) 
        && is_greater(next_values, base_obj)) {
        $this.after(option);
        return false;
      }
    })
    if(failed_insert){
      $language_select.append(option);
    }
  };
  
  var is_greater = function(obj, comp_obj) {
    var bool = false;
    if(obj && (!comp_obj || obj.index > comp_obj.index)){
      bool = true;
    }
    return bool;
  };
  
  return {
    addOption: function(language_filter, position) {
      var option = create_option(language_filter.label, language_filter.id, language_filter.url, position);
      insert_option(option, position);
    },
    
    initSelect: function(language_list) {
      for(var x = 0; x < language_list.length; x++){
        var language_filter = language_list[x];
        if(!language_filter.subscribed){
          this.addOption(language_filter, x);
        }
      }
    },
    
    getSelectbox: function(){
      return $language_select;
    }
  }
}());

//TODO: Get all major functions, design in semi object oriented manner...
FilterManager = (function (){
  var global_cached_subscriptions;
  var adblock_filters = [];
  var language_filters = [];
  var other_filters = [];
  var custom_filters = [];
  
  var filter_types = {
    ADBLOCK: "adblock_filter",
    LANGUAGE: "language_filter",
    OTHERS: "other_filter",
    CUSTOM: "custom_filter"
  };
  
  var filter_array = [{
      array: adblock_filters, 
      type: filter_types.ADBLOCK,
      container: $("#add_blocking_list")
    },{
      array: language_filters,
      type: filter_types.LANGUAGE,
      container: $("#languange_list")
    },{
      array: other_filters,
      type: filter_types.OTHERS,
      container: $("#other_filters")
    },{
      array: custom_filters,
      type: filter_types.CUSTOM,
      container: $("#custom_filters")
    }];
    
  var prepare_subscriptions = function (arr) {
    for(var id in arr){
      var entry = arr[id];
      if (id === "adblock_custom" || id === "easylist") {
        adblock_filters.push(entry);
      } else if (id === "easyprivacy") {
        other_filters.push(entry);
      } else if (entry.user_submitted) {
        custom_filters.push(entry);
      } else{
        language_filters.push(entry);
      }
      entry.label = translate("filter" + id);
      entry.id = id;
    }
    sort_arrays();
  };
  
  //populate div with data from array
  var organizeDiv = function (arr, container, chkbox){
    if(chkbox === filter_types.LANGUAGE){
      arr = $(arr).filter(function(index){
        return arr[index].subscribed;
      });
    }
    for(var x = 0; x < arr.length; x++){
      var checkbox = CheckboxUtil.createCheckbox(arr[x], x, chkbox);
      container.append(checkbox);
    }
  };
  //sorts array of subscriptions by using order attribute
  var sort_arrays = function() {
    for (var x = 0; x < filter_array.length; x++){
      filter_array[x].array.sort(function(a,b) {
        return a.label > b.label ? 1 : (a.label === b.label ? 0 : -1);
      });
    }
  };
  
  var selectbox_action = function($this) {
    var selected_option = $this.find('option').filter(':selected');
    var index = $(selected_option).data("values").index;
    var entry = language_filters[index];
    if(entry){
      var checkbox = CheckboxUtil.createCheckbox(entry, index, filter_types.LANGUAGE, true);
      filter_array[1].container.append(checkbox);
      $this.find('option:first').attr('selected','selected');
      selected_option.remove();
    }
    subscribe(entry.id);
  }
  
  var checkbox_action = function($this, language_filter){
    var $parent = $this.parent();
    var checked = $this.is(":checked");
    var id = $parent.attr("name");
    if(checked){
      $(".subscription_info", $parent).text(translate("fetchinglabel"));
      subscribe(id);
    } else {
      unsubscribe(id, false);
      $(".subscription_info", $parent).
            text(translate("unsubscribedlabel"));
      if(language_filter){
        //TODO: re insert in select box
        $parent.fadeOut();
        setTimeout(function(){
          $parent.empty().remove();
        }, 1000);
      }
    }
  }
  //TODO: Bind the controls lol
  var bind_controls = function() {
    var selectbox = SelectboxUtil.getSelectbox();
    selectbox.on("change", function(){
      selectbox_action($(this));
    });
    
    $('.language_filter > .filter_control').change(function(){
      checkbox_action($(this), true);
    });
    
    $('.filter_control').not('.language_filter > .filter_control').change(function(){
      checkbox_action($(this));
    });
    
    // In case a subscription changed (updated or subscribed via subscribe.html)
    // then update the subscription list.
    chrome.extension.onRequest.addListener(function(request, sender, sendResponse) {
      if (request.command !== "filters_updated")
        return;
      update_subscription_list();
      sendResponse({});
    });
    //bind checkbox options,
    //bind unsubscribe all options,
    //bind subscribe all options
    //bind remove filter span,
    //bind links for filter list,
    //bind listeners
  };
  
  var update_list_item = function(id, entry, update_entry){
    for(var prop in entry){
      if(update_entry[prop] !== entry[prop]){
        update_entry[prop] = entry[prop];
        if(entry.subscribed && prop === 'last_update'){
          var div = $("[name='" + id + "']");
          $(".subscription_info", div).text("");
        }
      };
    }
  };
  
  var update_subscription_list = function(){
    BGcall("get_subscriptions_minus_text", function(subs) {
      for(var id in global_cached_subscriptions){
        var entry = subs[id];
        if(entry){
          var update_entry = global_cached_subscriptions[id];
          update_list_item(id, entry, update_entry);
        }else{
          //promp user that there is an update and ask to reload
        }
      }
    });
  };
  
  var subscribe = function(id) {
    var parameters = {id: id};
    if (global_cached_subscriptions[id] && global_cached_subscriptions[id].requiresList){
      parameters.requires = global_cached_subscriptions[id].requiresList;
    }

    BGcall("subscribe", parameters);
  };
  
  var validate_over_subscription = function() {
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
  
  var unsubscribe = function(id, del) {
    BGcall("unsubscribe", {id:id, del:del});
  };
  
  var get_last_update_value = function(last_update) {
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
        global_cached_subscriptions = subs;
        prepare_subscriptions(global_cached_subscriptions);
        for(obj in filter_array){
          var filter = filter_array[obj];
          organizeDiv(filter.array, filter.container, filter.type);
        }
        SelectboxUtil.initSelect(language_filters);
        bind_controls();
      });
    },
    
    //update information for each subscription
    updateSubscriptionInfoAll: function() {
      //copy from update subscription info all
      for(var id in global_cached_subscriptions){
        var div = $("[name='" + id + "']");
        var subscription = global_cached_subscriptions[id];
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
          text = get_last_update_value(subscription.last_update);
        }
        infoLabel.text(text);
      }
    }
  }
}());

$(function(){
  FilterManager.initializePage();
  window.setInterval(function() {
    FilterManager.updateSubscriptionInfoAll();
  }, 1000);
});
