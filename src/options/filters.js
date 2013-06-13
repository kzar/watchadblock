function CheckboxForFilter(filter, filter_type, index, container, checked){
  this._container = container;
  this._filter = filter;
  this._filter_type = filter_type;
  this._id = this._filter_type + "_" + index;
  
  this._div = $("<div></div>").
      addClass("subscription").
      addClass(this._filter_type).
      attr("name", this._filter.id).
      css("display", this._filter_type === "language_filter" ?
        (this._filter.subscribed || checked?"block":"none") : "block");
      
  this._check_box = $('<input />').
      attr("type", "checkbox").
      attr("id", this._id).
      attr("checked", this._filter.subscribed || checked ? 'checked' : null).
      addClass("filter_control");
      
  this._label = $("<label></label>").
      text(this._filter.label || this._filter.url).
      attr("title", this._filter.url).
      attr("for", this._id);
      
  this._link = $("<a></a>").
      text(this._filter.label).
      css("margin-left", "6px").
      css("font-size", "10px").
      css("display", $("#btnShowLinks").prop("disabled") ? "inline" : "none").
      attr("target", "_blank").
      attr("class", "linkToList").
      attr("href", this._filter.url);
      
  this._infospan = $("<span></span>").
      addClass("subscription_info").
      text(this._filter.subscribed ? (translate("fetchinglabel")) : "");
      
  this._remove_filter_label = this._filter.user_submitted ?  $("<a>").
      css("font-size", "10px").
      css("display", this._filter.subscribed ? "none" : "inline").
      attr("href", "#").
      text(translate("removefromlist")).
      addClass("remove_filter") : null;
};

CheckboxForFilter.prototype = {
  _bindActions: function(){
    this._check_box.
      change(function(){
        var parent = $(this).parent();
        var checked = $(this).is(":checked");
        $(".remove_filter", parent).
          css("display", checked ? "none" : "inline");
        var id = parent.attr("name");
        if (checked) {
          $(".subscription_info", parent).text(translate("fetchinglabel"));
          SubscriptionUtil.subscribe(id);
          delete FilterListUtil.cached_subscriptions[id].unsubscribed;
        } else {
          SubscriptionUtil.unsubscribe(id, false);
          $(".subscription_info", parent).
            text(translate("unsubscribedlabel"));
          delete FilterListUtil.cached_subscriptions[id].subscribed;
        }
      });
      
    if(this._filter_type === "language_filter"){
      this._check_box.
        change(function(){
          var $this = $(this);
          $this.parent().toggle(500);
          if(!$this.is(":checked")){
            var index = $this.attr("id").split("_")[2];
            var entry = filterListSections.language_filter.array[index];
            var option = new OptionForFilter(entry, index);
            LanguageSelectUtil.insertOption(option.get(), index);
          }
        });
    };
    
    if(this._filter.user_submitted){
      this._remove_filter_label.
        click(function(event){
          event.preventDefault();
          var parent = $(this).parent();
          var id = parent.attr("name");
          SubscriptionUtil.unsubscribe(id, true);
          parent.remove();
        });
    };
  },
  
  createCheckbox: function(isChecked){
    this._div.
      append(this._check_box).
      append(this._label).
      append(this._link).
      append(this._infospan).
      append(this._remove_filter_label);
    
    this._container.append(this._div);
    
    this._bindActions();
    
    if(isChecked){
      this._check_box.attr("checked", "checked");
      this._check_box.trigger("change");
    }
  }
};


function OptionForFilter(filter, index){
  this._filter = filter;
  this._index = index;
  
  this._option = $("<option>", {
    value: this._filter.id,
    text: this._filter.label,
  }).data("index", this._index);
};
OptionForFilter.prototype = {
  get: function(){
    return this._option;
  }
};

var filterListSections = {
  adblock_filter: {
    array: [],
    container: $("#add_blocking_list")
  },
  language_filter: {
    array: [],
    container: $("#languange_list")
  },
  other_filter: {
    array: [],
    container: $("#other_filters")
  },
  custom_filter: {
    array: [],
    container: $("#custom_filters")
  }
};

function SectionHandler(filter_list_section, filter_type){
  this._cached_subscriptions = filter_list_section.array;
  this._$section = filter_list_section.container;
  this._filter_type = filter_type;
};

SectionHandler.prototype = {
  _organize: function(){
    for(var i = 0; i < this._cached_subscriptions.length; i++){
      var filter = this._cached_subscriptions[i];
      var checkbox = new CheckboxForFilter(filter, this._filter_type, i, this._$section);
      checkbox.createCheckbox();
    }
  },
  
  initSection: function(){
    this._organize();
  }
};

function FilterListUtil(){};
FilterListUtil.prototype = {};
FilterListUtil.sortFilterArrays = function(){
  for(var filterList in filterListSections){
    filterListSections[filterList].array.sort(function(a,b) {
      return a.label > b.label ? 1 : (a.label === b.label ? 0 : -1);
    });
  }
};
FilterListUtil.prepareSubscriptions = function(subs){
  FilterListUtil.cached_subscriptions = subs;
  for(var id in subs){
    var entry = subs[id];
    if (id === "adblock_custom" || id === "easylist") {
      filterListSections.adblock_filter.array.push(entry);
    } else if (id === "easyprivacy") {
      filterListSections.other_filter.array.push(entry);
    } else if (entry.user_submitted) {
      filterListSections.custom_filter.array.push(entry);
    } else{
      filterListSections.language_filter.array.push(entry);
    }
    entry.label = translate("filter" + id);
    entry.id = id;
  }
  FilterListUtil.sortFilterArrays();
};
FilterListUtil.checkUrlForExistingFilter = function(url){
  var cached_subscriptions = FilterListUtil.cached_subscriptions
  for(var id in cached_subscriptions){
    if(url === cached_subscriptions[id].url){
      return cached_subscriptions[id];
    }
  }
  return;
};
FilterListUtil.updateSubscriptionInfoAll = function(){
  var cached_subscriptions = FilterListUtil.cached_subscriptions;
  for(var id in cached_subscriptions){
    var div = $("[name='" + id + "']");
    var subscription = cached_subscriptions[id];
    var infoLabel = $(".subscription_info", div);
    var text = infoLabel.text();
    var last_update = subscription.last_update;
    if(infoLabel.text() === translate("invalidListUrl")){
      continue;
    }
    if(subscription.last_update_failed_at){
      if(subscription.user_submitted && 
        translate("failedtofetchfilter") === infoLabel.text()){
        text = translate("invalidListUrl");
        $("input", div).attr("disabled", "disabled");
      }else{
        text = translate("failedtofetchfilter");
      }
    } else if(last_update) {
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
    } 
    infoLabel.text(text);
  }
};

function LanguageSelectUtil(){
};
LanguageSelectUtil.prototype = {
};
LanguageSelectUtil.insertOption = function(option, index) {
  var $language_select = $("#language_select");
  var options = $language_select.find("option");
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
    $language_select.append(option);
  }
};
LanguageSelectUtil.init = function(language_filter_section){
  var language_filters = language_filter_section.array;
  for(var i = 0; i < language_filters.length; i++){
    var language_filter = language_filters[i];
    if(!language_filter.subscribed){
      var option = new OptionForFilter(language_filter, i);
      LanguageSelectUtil.insertOption(option.get(), i);
    }
  }
  
  $("#language_select").change( function(){
    var $this = $(this);
    var selected_option = $this.find(':selected');
    var index = $(selected_option).data("index");
    var entry = language_filters[index];
    if(entry){
      $this.find('option:first').attr('selected','selected');
      selected_option.remove();
      var $checkbox = $("[name='" + entry.id + "']").find("input");
      $checkbox.attr("checked", "checked");
      $checkbox.trigger("change");
    }
  });
};
LanguageSelectUtil.triggerChange = function(filter){
  var $language_select = $("#language_select");
  $language_select.val(filter.id);
  $language_select.trigger("change");
};  

function SubscriptionUtil(){};
SubscriptionUtil.prototype = {};
SubscriptionUtil.validateOverSubscription = function() {
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
}
SubscriptionUtil.subscribe = function(id){
  if(!SubscriptionUtil.validateOverSubscription()){
    return;
  }
  var parameters = {id: id};
  if (FilterListUtil.cached_subscriptions[id] && FilterListUtil.cached_subscriptions[id].requiresList){
    parameters.requires = FilterListUtil.cached_subscriptions[id].requiresList;
  }
  SubscriptionUtil._updateCacheValue(id);
  BGcall("subscribe", parameters);
};
SubscriptionUtil.unsubscribe = function(id, del){
  SubscriptionUtil._updateCacheValue(id);
  BGcall("unsubscribe", {id:id, del:del});
};
SubscriptionUtil._updateCacheValue = function(id){
  var cached_subscriptions = FilterListUtil.cached_subscriptions;
  var sub = cached_subscriptions[id];
  if(sub){
    delete cached_subscriptions[id].last_update_failed_at;
    delete cached_subscriptions[id].last_update;
  }
};

$(function() {
  BGcall('get_subscriptions_minus_text', function(subs) {
    //initialize page using subscriptions from the background
    //copy from update subscription list + setsubscriptionlist
    FilterListUtil.prepareSubscriptions(subs);
    
    for(var id in filterListSections){
      var sectionHandler = new SectionHandler(filterListSections[id], id);
      sectionHandler.initSection();
    }
    
    LanguageSelectUtil.init(filterListSections.language_filter);
  });
  
  window.setInterval(function() {
   FilterListUtil.updateSubscriptionInfoAll();
  }, 1000);
  
  $('.remove_filter').click(function(event) {
    event.preventDefault();
    var $parent = $(this).parent();
    var id = $parent.attr("name");
    SubscriptionUtil.unsubscribe(id, true);
    $parent.remove();
  });
  
  $("#btnUpdateNow").click(function() {
    $(this).attr("disabled", "disabled");
    BGcall("update_subscriptions_now");
    setTimeout(function() {
      $("#btnUpdateNow").removeAttr("disabled");
    }, 300000); //re-enable after 5 minutes
  });
 
  $("#btnNewSubscriptionUrl").click(function() {
    var url = $("#txtNewSubscriptionUrl").val();
    var abp_regex = /^abp.*\Wlocation=([^\&]+)/i;
    if (abp_regex.test(url)) {
      url = url.match(abp_regex)[1]; // the part after 'location='
      url = unescape(url);
    }
    url = url.trim();
    var subscribe_to = "url:" + url;
    
    var existingFilter = FilterListUtil.checkUrlForExistingFilter(url);
    
    if (!existingFilter){  
      if (/^https?\:\/\/[^\<]+$/.test(url)) {
        SubscriptionUtil.subscribe(subscribe_to);
        var entry = {
          id: subscribe_to,
          url: url,
          subscribed: true,
          unsubscribe: true,
          user_submitted: true,
          label: ""
        };
        FilterListUtil.cached_subscriptions[entry.id] = entry;
        var custom_filter = filterListSections.custom_filter;
        var checkbox = new CheckboxForFilter(entry, "custom_filter", custom_filter.array.length, custom_filter.container);
        checkbox.createCheckbox(true);
        
      } else
        alert(translate("failedtofetchfilter"));
    } else if(!existingFilter.subscribed){
      var containing_div = $("div[name='" + existingFilter.id + "']");
      if(containing_div.is(":visible")){
        var checkbox = containing_div.find("input");
        console.log(checkbox);
        checkbox.attr("checked", "checked");
        checkbox.trigger("change");
      }else{
        LanguageSelectUtil.triggerChange(existingFilter);
      }
    }
    $("#txtNewSubscriptionUrl").val("");
  });
  
  // Pressing enter will add the list too
  $('#txtNewSubscriptionUrl').keypress(function(event) {
    if (event.keyCode === 13) {
      event.preventDefault();
      $("#btnNewSubscriptionUrl").click();
    }
  });
  
  $("#btnShowLinks").click(function() {
    $(".linkToList").css("display", "inline");
    $("#btnShowLinks").attr("disabled", "disabled");
  });
  
  chrome.extension.onRequest.addListener(function(request, sender, sendResponse) {
    if (request.command !== "filters_updated")
      return;
    BGcall("get_subscriptions_minus_text", function(subs) {
      var cached_subscriptions = FilterListUtil.cached_subscriptions;
      for(var id in cached_subscriptions){
        var entry = subs[id];
        var update_entry = cached_subscriptions[id];
        if(entry){
          if(entry.subscribed){
            if(entry.last_update && entry.last_update_failed_at){
              if(parseInt(entry.last_update) > parseInt(entry.last_update_failed_at)){
                delete subs[id].last_update_failed_at;
              }else{
                delete subs[id].last_update;
              }
            } 
            
            if(entry.last_update_failed_at){
              cached_subscriptions[id].last_update_failed_at = entry.last_update_failed_at;
            } else if(entry.last_update){
              cached_subscriptions[id].last_update = entry.last_update;
            }
          }
        }else if(confirm(translate("thereisanupdate"))){
          window.location.reload();
        }
        //TODO: promp user that there is an update and ask to reload
      }
    });
    sendResponse({});
  });
});