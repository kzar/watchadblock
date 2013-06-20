function CheckboxForFilterList(filter_list, filter_list_type, index, container, checked) {
  this._container = container;
  this._filter_list = filter_list;
  this._filter_list_type = filter_list_type;
  this._id = this._filter_list_type + "_" + index;
  
  this._div = $("<div></div>").
      addClass("subscription").
      addClass(this._filter_list_type).
      attr("name", this._filter_list.id).
      css("display", this._filter_list_type === "language_filter_list" ?
        (this._filter_list.subscribed || checked?"block":"none") : "block");
      
  this._check_box = $('<input />').
      attr("type", "checkbox").
      attr("id", this._id).
      attr("checked", this._filter_list.subscribed || checked ? 'checked' : null).
      addClass("filter_list_control");
      
  this._label = $("<label></label>").
      text(this._filter_list.label || this._filter_list.url).
      attr("title", this._filter_list.url).
      attr("for", this._id);
      
  this._link = $("<a></a>").
      text(this._filter_list.label).
      css("margin-left", "6px").
      css("font-size", "10px").
      css("display", $("#btnShowLinks").prop("disabled") ? "inline" : "none").
      attr("target", "_blank").
      attr("class", "linkToList").
      attr("href", this._filter_list.url);
      
  this._infospan = $("<span></span>").
      addClass("subscription_info").
      text(this._filter_list.subscribed && !this._filter_list.last_update ? (translate("fetchinglabel")) : "");
      
  this._remove_filter_list_label = this._filter_list.user_submitted ?  $("<a>").
      css("font-size", "10px").
      css("display", this._filter_list.subscribed ? "none" : "inline").
      attr("href", "#").
      text(translate("removefromlist")).
      click(function(e) {
        event.preventDefault();
        var $parent = $(this).parent();
        var id = $parent.attr("name");
        SubscriptionUtil.unsubscribe(id, true);
        $parent.remove();
      }) : null;
};

CheckboxForFilterList.prototype = {
  _bindActions: function() {
    this._check_box.
      change(function() {
        var parent = $(this).parent();
        var checked = $(this).is(":checked");
        $(".remove_filter_list", parent).
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
      
    if(this._filter_list_type === "language_filter_list") {
      this._check_box.
        change(function() {
          var $this = $(this);
          $this.parent().toggle(500);
          if(!$this.is(":checked")) {
            var index = $this.attr("id").split("_")[3];
            var entry = filterListSections.language_filter_list.array[index];
            var option = new OptionForFilterList(entry, index);
            LanguageSelectUtil.insertOption(option.get(), index);
          }
        });
    };
    
    if(this._filter_list.user_submitted) {
      this._remove_filter_list_label.
        click(function(event) {
          event.preventDefault();
          var parent = $(this).parent();
          var id = parent.attr("name");
          SubscriptionUtil.unsubscribe(id, true);
          parent.remove();
        });
    };
  },
  
  createCheckbox: function(isChecked) {
    this._div.
      append(this._check_box).
      append(this._label).
      append(this._link).
      append(this._infospan).
      append(this._remove_filter_list_label);
    
    this._container.append(this._div);
    
    this._bindActions();
    
    if(isChecked) {
      this._check_box.attr("checked", "checked");
      this._check_box.trigger("change");
    }
  }
};


function OptionForFilterList(filter_list, index) {
  this._filter_list = filter_list;
  this._index = index;
  
  this._option = $("<option>", {
    value: this._filter_list.id,
    text: this._filter_list.label,
  }).data("index", this._index);
};
OptionForFilterList.prototype = {
  get: function() {
    return this._option;
  }
};

var filterListSections = {
  adblock_filter_list: {
    array: [],
    container: $("#add_blocking_list")
  },
  language_filter_list: {
    array: [],
    container: $("#language_list")
  },
  other_filter_list: {
    array: [],
    container: $("#other_filter_lists")
  },
  custom_filter_list: {
    array: [],
    container: $("#custom_filter_lists")
  }
};

function SectionHandler(filter_list_section, filter_list_type) {
  this._cached_subscriptions = filter_list_section.array;
  this._$section = filter_list_section.container;
  this._filter_list_type = filter_list_type;
};

SectionHandler.prototype = {
  _organize: function() {
    for(var i = 0; i < this._cached_subscriptions.length; i++) {
      var filter_list = this._cached_subscriptions[i];
      var checkbox = new CheckboxForFilterList(filter_list, this._filter_list_type, i, this._$section);
      checkbox.createCheckbox();
    }
  },
  
  initSection: function() {
    this._organize();
  }
};

function FilterListUtil() {};
FilterListUtil.sortFilterListArrays = function() {
  for(var filter_list in filterListSections) {
    filterListSections[filter_list].array.sort(function(a,b) {
      return a.label > b.label ? 1 : (a.label === b.label ? 0 : -1);
    });
  }
};
FilterListUtil.prepareSubscriptions = function(subs) {
  FilterListUtil.cached_subscriptions = subs;
  for(var id in subs) {
    var entry = subs[id];
    if (id === "adblock_custom" || id === "easylist") {
      filterListSections.adblock_filter_list.array.push(entry);
    } else if (id === "easyprivacy") {
      filterListSections.other_filter_list.array.push(entry);
    } else if (entry.user_submitted) {
      filterListSections.custom_filter_list.array.push(entry);
    } else{
      filterListSections.language_filter_list.array.push(entry);
    }
    entry.label = translate("filter" + id);
    entry.id = id;
  }
  FilterListUtil.sortFilterListArrays();
};
FilterListUtil.checkUrlForExistingFilterList = function(url) {
  var cached_subscriptions = FilterListUtil.cached_subscriptions
  for(var id in cached_subscriptions) {
    if(url === cached_subscriptions[id].url) {
      return cached_subscriptions[id];
    }
  }
  return;
};
FilterListUtil.updateSubscriptionInfoAll = function() {
  var cached_subscriptions = FilterListUtil.cached_subscriptions;
  for(var id in cached_subscriptions) {
    var div = $("[name='" + id + "']");
    var subscription = cached_subscriptions[id];
    var infoLabel = $(".subscription_info", div);
    var text = infoLabel.text();
    var last_update = subscription.last_update;
    if(infoLabel.text() === translate("invalidListUrl")) {
      continue;
    }
    if(subscription.last_update_failed_at) {
      if(subscription.user_submitted && 
        translate("failedtofetchfilter") === infoLabel.text()) {
        text = translate("invalidListUrl");
        $("input", div).attr("disabled", "disabled");
      } else {
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

function LanguageSelectUtil() {};
LanguageSelectUtil.insertOption = function(option, index) {
  var $language_select = $("#language_select");
  var options = $language_select.find("option");
  var i;
  for(i = 0; i < options.length; i++) {
    var list_option_index = options.eq(i).data("index");
    if(list_option_index && parseInt(list_option_index) > parseInt(index)) {
      break;
    }
  }
  if(options.eq(i).length > 0) {
    options.eq(i).before(option);
  } else {
    $language_select.append(option);
  }
};
LanguageSelectUtil.init = function(language_filter_list_section) {
  var language_filter_lists = language_filter_list_section.array;
  for(var i = 0; i < language_filter_lists.length; i++) {
    var language_filter_list = language_filter_lists[i];
    if(!language_filter_list.subscribed) {
      var option = new OptionForFilterList(language_filter_list, i);
      LanguageSelectUtil.insertOption(option.get(), i);
    }
  }
  
  $("#language_select").change(function() {
    var $this = $(this);
    var selected_option = $this.find(':selected');
    var index = $(selected_option).data("index");
    var entry = language_filter_lists[index];
    if(entry) {
      $this.find('option:first').attr('selected','selected');
      selected_option.remove();
      var $checkbox = $("[name='" + entry.id + "']").find("input");
      $checkbox.attr("checked", "checked");
      $checkbox.trigger("change");
    }
  });
};
LanguageSelectUtil.triggerChange = function(filter_list) {
  var $language_select = $("#language_select");
  $language_select.val(filter_list.id);
  $language_select.trigger("change");
};  

function SubscriptionUtil() {};
SubscriptionUtil.validateOverSubscription = function() {
  if ($(":checked", "#filter_list_subscriptions").length <= 6)
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
SubscriptionUtil.subscribe = function(id) {
  if(!SubscriptionUtil.validateOverSubscription()) {
    return;
  }
  var parameters = {id: id};
  if (FilterListUtil.cached_subscriptions[id] && FilterListUtil.cached_subscriptions[id].requiresList) {
    parameters.requires = FilterListUtil.cached_subscriptions[id].requiresList;
  }
  SubscriptionUtil._updateCacheValue(id);
  BGcall("subscribe", parameters);
};
SubscriptionUtil.unsubscribe = function(id, del) {
  SubscriptionUtil._updateCacheValue(id);
  BGcall("unsubscribe", {id:id, del:del});
};
SubscriptionUtil._updateCacheValue = function(id) {
  var sub = FilterListUtil.cached_subscriptions[id];
  if(sub) {
    delete sub.last_update_failed_at;
    delete sub.last_update;
  }
};

function CustomFilterListUploadUtil() {};
CustomFilterListUploadUtil._performUpload = function(url, subscribe_to) {
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
  var custom_filter_list = filterListSections.custom_filter_list;
  var checkbox = new CheckboxForFilterList(entry, "custom_filter_list", custom_filter_list.array.length, custom_filter_list.container);
  checkbox.createCheckbox(true);
};
CustomFilterListUploadUtil._updateExistingFilterList = function(existing_filter_list) {
  var containing_div = $("div[name='" + existing_filter_list.id + "']");
  var checkbox = $(containing_div).find("input");
  if(!checkbox.is(":checked")) {
    if(checkbox.attr("id").indexOf("language_filter_list") > 0) {
      LanguageSelectUtil.triggerChange(existing_filter_list);
    } else {
      checkbox.attr("checked", "checked");
      checkbox.trigger("change");
    }
  }
};
CustomFilterListUploadUtil.bindControls = function () {
  $("#btnNewSubscriptionUrl").click(function() {
    var url = $("#txtNewSubscriptionUrl").val();
    var abp_regex = /^abp.*\Wlocation=([^\&]+)/i;
    if (abp_regex.test(url)) {
      url = url.match(abp_regex)[1]; // the part after 'location='
      url = unescape(url);
    }
    url = url.trim();
    var subscribe_to = "url:" + url;
    
    var existing_filter_list = FilterListUtil.checkUrlForExistingFilterList(url);
    
    if (existing_filter_list) {  
      CustomFilterListUploadUtil._updateExistingFilterList(existing_filter_list);
    } else {
      if (/^https?\:\/\/[^\<]+$/.test(url)) {
        CustomFilterListUploadUtil._performUpload(url, subscribe_to);
      } else {
        alert(translate("failedtofetchfilter"));
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
};

$(function() {
  BGcall('get_subscriptions_minus_text', function(subs) {
    //initialize page using subscriptions from the background
    //copy from update subscription list + setsubscriptionlist
    FilterListUtil.prepareSubscriptions(subs);
    
    for(var id in filterListSections) {
      var sectionHandler = new SectionHandler(filterListSections[id], id);
      sectionHandler.initSection();
    }
    
    LanguageSelectUtil.init(filterListSections.language_filter_list);
  });
  
  window.setInterval(function() {
   FilterListUtil.updateSubscriptionInfoAll();
  }, 1000);
  
  $("#btnUpdateNow").click(function() {
    $(this).attr("disabled", "disabled");
    BGcall("update_subscriptions_now");
    setTimeout(function() {
      $("#btnUpdateNow").removeAttr("disabled");
    }, 300000); //re-enable after 5 minutes
  });
 
  $("#btnShowLinks").click(function() {
    $(".linkToList").css("display", "inline");
    $("#btnShowLinks").attr("disabled", "disabled");
  });
  
  CustomFilterListUploadUtil.bindControls();
  
  chrome.extension.onRequest.addListener(function(request, sender, sendResponse) {
    if (request.command !== "filters_updated")
      return;
    BGcall("get_subscriptions_minus_text", function(subs) {
      var cached_subscriptions = FilterListUtil.cached_subscriptions;
      for(var id in cached_subscriptions) {
        var entry = subs[id];
        var update_entry = cached_subscriptions[id];
        if(entry) {
          if(entry.subscribed) {
            if(entry.last_update && entry.last_update_failed_at) {
              if(parseInt(entry.last_update) > parseInt(entry.last_update_failed_at)) {
                delete subs[id].last_update_failed_at;
              } else {
                delete subs[id].last_update;
              }
            } 
            
            if(entry.last_update_failed_at) {
              cached_subscriptions[id].last_update_failed_at = entry.last_update_failed_at;
            } else if(entry.last_update) {
              cached_subscriptions[id].last_update = entry.last_update;
            }
          }
        }/*else if(confirm(translate("thereisanupdate"))) {
          window.location.reload();
        }*
        * Removed above part to avoid invoking reload when a custom filter list failed to fetch and
        * when there is a new subscription since it will not hurt the user.
        */
      }
    });
    sendResponse({});
  });
});
