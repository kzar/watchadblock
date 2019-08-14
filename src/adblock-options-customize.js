var originalCustomFilters;

function cleanCustomFilter(filters)
{
  // Remove the global pause white-list item if adblock is paused
  if (backgroundPage.adblockIsPaused())
  {
    var index = filters.indexOf(backgroundPage.pausedFilterText1);
    if (index >= 0)
    {
      filters.splice(index, 1);
    }
    var index = filters.indexOf(backgroundPage.pausedFilterText2);
    if (index >= 0)
    {
      filters.splice(index, 1);
    }
  }

  // Remove the domain pause white-list items
  var domainPauses = backgroundPage.adblockIsDomainPaused();
  for (var aDomain in domainPauses)
  {
    var index = filters.indexOf("@@" + aDomain + "$document");
    if (index >= 0)
    {
      filters.splice(index, 1);
    }
  }

  return filters;
}

function onFilterChange()
{
  if (syncErrorCode >= 400) {
    // disable all the buttons on the page
    // refreshing the page will re-enable the buttons, etc.
    $(".accordion-icon .material-icons").css("color", "grey");
    $('button').removeClass("red").css("background-color", "grey");
    const newStyle = document.createElement('style');
    newStyle.type = "text/css";
    newStyle.appendChild(document.createTextNode(""));
    document.head.appendChild(newStyle);
    newStyle.sheet.insertRule('.btn:hover { font-weight: normal !important; cursor: unset !important; box-shadow: none !important; }', 0);
    return;
  }
  var userFilters = backgroundPage.getUserFilters();
  if (userFilters &&
    userFilters.length)
  {
    originalCustomFilters = cleanCustomFilter(userFilters);
    $('#txtFiltersAdvanced').val(originalCustomFilters.join('\n'));
  } else {
    $('#txtFiltersAdvanced').val("");
  }
}

$(function ()
{
  $('#tutorlink').attr('href',  backgroundPage.Utils.getDocLink("filterdoc"));

  var getExcludeFilters = function() {
    var excludeFiltersKey = 'exclude_filters';
    chrome.storage.local.get(excludeFiltersKey, function(response)
    {
      if (response[excludeFiltersKey])
      {
        $('#txtExcludeFiltersAdvanced').val(response[excludeFiltersKey]);
        $('#divExcludeFilters').show();
      }
    });
  };
  getExcludeFilters();

  // Display any migration error messages to the user
  chrome.storage.local.get('custom_filters_errors', function(response) {
    if (response['custom_filters_errors'])
    {
      $("#txtMigrationErrorMessage").val(response['custom_filters_errors']);
      $("#migrationErrorMessageDiv").show();
      $('#btnDeleteMigrationErrorMessage').click(function ()
      {
        chrome.storage.local.remove('custom_filters_errors');
        $("#migrationErrorMessageDiv").hide();
      });
    }
  });

  // Add a custom filter to the list
  function appendCustomFilter(filter)
  {
    var $customFilter = $('#txtFiltersAdvanced');
    $customFilter.val(filter + '\n' + $('#txtFiltersAdvanced').val());
    saveFilters();
    $('.addControls').slideUp();
  }

  // Convert a messy list of domains to ~domain1.com|~domain2.com format
  function toTildePipeFormat(domainList)
  {
    domainList = domainList.trim().replace(/[\ \,\;\|]+\~?/g, '|~');
    if (domainList && domainList[0] != '~')
    {
      domainList = '~' + domainList;
    }

    return domainList;
  }

  $('#txtBlacklist').focus(function ()
  {
    // Find the blacklist entry in the user's filters, and put it
    // into the blacklist input.
    var customFilterText = $('#txtFiltersAdvanced').val();
    var match            = customFilterText.match(/^@@\*\$document,domain\=(~.*)$/m);
    if (match && $(this).val() == '')
    {
      $(this).val(match[1]);
    }
  });

  // The add_filter functions
  $('#btnAddUserFilter').click(checkForSyncError(function(event)
  {
    var blockCss    = $('#txtUserFilterCss').val().trim();
    var blockDomain = $('#txtUserFilterDomain').val().trim();

    if (blockDomain == '.*' || blockDomain == '*' || blockDomain == '')
    {
      appendCustomFilter('##' + blockCss);
    } else
    {
      appendCustomFilter(blockDomain + '##' + blockCss);
    }

    $(event.target).closest('.customize-entry-table').find('input[type=\'text\']').val('');
    $(event.target).prop('disabled', true);
  }));

  $('#btnAddExcludeFilter').click(checkForSyncError(function(event)
  {
    var excludeUrl = $('#txtUnblock').val().trim();

    //prevent regexes
    if (/^\/.*\/$/.test(excludeUrl))
    {
      excludeUrl = excludeUrl + '*';
    }

    appendCustomFilter('@@' + excludeUrl + '$document');

    $(event.target).closest('.customize-entry-table').find('input[type=\'text\']').val('');
    $(event.target).prop('disabled', true);
  }));

  $('#btnAddBlacklist').click(checkForSyncError(function(event)
  {
    var blacklist = toTildePipeFormat($('#txtBlacklist').val());

    var filters = $('#txtFiltersAdvanced').val().trim() + '\n';

    // Delete the first likely line
    filters = filters.replace(/^@@\*\$document,domain\=~.*\n/m, '').trim();
    $('#txtFiltersAdvanced').val(filters);

    // Add our line in its place, or if it was empty, remove the filter
    if (blacklist)
    {
      appendCustomFilter('@@*$document,domain=' + blacklist);
    } else
    {
      saveFilters();
    } // just record the deletion

    $('#btnAddBlacklist').prop('disabled', true);
  }));

  $('#btnAddUrlBlock').click(checkForSyncError(function(event)
  {
    var blockUrl    = $('#txtBlockUrl').val().trim();
    var blockDomain = $('#txtBlockUrlDomain').val().trim();
    if (blockDomain == '*')
    {
      blockDomain = '';
    }

    //prevent regexes
    if (/^\/.*\/$/.test(blockUrl))
    {
      blockUrl = blockUrl + '*';
    }

    if (blockDomain == '')
    {
      appendCustomFilter(blockUrl);
    } else
    {
      appendCustomFilter(blockUrl + '$domain=' + blockDomain);
    }

    $(event.target).closest('.customize-entry-table').find('input[type=\'text\']').val('');
    $(event.target).prop('disabled', true);
  }));

  // The validation functions
  $('#txtBlacklist').bind('input', checkForSyncError(function(event)
  {
    var blacklist = toTildePipeFormat($('#txtBlacklist').val());

    if (blacklist)
    {
      blacklist = '@@*$document,domain=' + blacklist;
    }

    var filterErrorMessage = '';
    $('#messageBlacklist').text(filterErrorMessage);
    $('#messageBlacklist').hide();
    var result = parseFilter(blacklist);

    if (result.error)
    {
      $('#btnAddBlacklist').prop('disabled', true);
      filterErrorMessage = translate('customfilterserrormessage', [$('#txtBlacklist').val(), result.error]);
      $('#messageBlacklist').text(filterErrorMessage);
      $('#messageBlacklist').show();
      return;
    }

    $('#btnAddBlacklist').prop('disabled', false);

  }));

  $('#divUrlBlock input[type=\'text\']').bind('input', checkForSyncError(function(event)
  {
    var blockUrl    = $('#txtBlockUrl').val().trim();
    var blockDomain = $('#txtBlockUrlDomain').val().trim();
    if (blockDomain == '*')
    {
      blockDomain = '';
    }

    if (blockDomain)
    {
      blockDomain = '$domain=' + blockDomain;
    }

    var result = parseFilter(blockUrl + blockDomain);
    $('#btnAddUrlBlock').prop('disabled', (result.error) ? true : null);
  }));

  $('#divCssBlock input[type=\'text\']').bind('input', checkForSyncError(function(event)
  {
    var blockCss    = $('#txtUserFilterCss').val().trim();
    var blockDomain = $('#txtUserFilterDomain').val().trim();
    if (blockDomain == '*')
    {
      blockDomain = '';
    }

    var result = parseFilter(blockDomain + '##' + blockCss);
    $('#btnAddUserFilter').prop('disabled', (result.error) ? true : null);
  }));

  $('#divExcludeBlock input[type=\'text\']').bind('input', checkForSyncError(function(event)
  {
    var unblockUrl = $('#txtUnblock').val().trim();
    var result     = parseFilter('@@' + unblockUrl + '$document');
    if (!unblockUrl || isSelectorFilter(unblockUrl))
    {
      result.error = true;
    }

    $('#btnAddExcludeFilter').prop('disabled', (result.error) ? true : null);
  }));

  // When one presses 'Enter', pretend it was a click on the 'add' button
  $('.customize-entry-table input[type=\'text\']').keypress(checkForSyncError(function(event)
  {
    var submitButton = $(event.target).closest('.customize-entry-table').find('input[type=\'button\']');
    if (event.keyCode === 13 && !submitButton.prop('disabled'))
    {
      event.preventDefault();
      submitButton.click();
    }
  }));

  $('a.controlsLink').click(checkForSyncError(function(event)
  {
    event.preventDefault();
    var $myControls = $(event.target).parent('div').find('.addControls');
    $('.addControls').not($myControls).slideUp({
      complete: function() {
        $(event.target).parent('div').find('.accordion-icon').removeClass('upward');
      }
    });
    $myControls.slideToggle({
      complete: function() {
        let $icon = $(event.target).parent('div').find('.accordion-icon');
        let isExpanded = $(event.target).css('display') !== 'none';

        if (isExpanded) {
          $icon.addClass('upward');
        } else {
          $icon.removeClass('upward');
        }
      }
    });
  }));

  $('#btnEditAdvancedFilters').click(checkForSyncError(function(event)
  {
    let headerOffset = $("#header").height() + 10;
    $("body, html").animate({
      scrollTop: $(event.target).offset().top - headerOffset
    }, 1000);
    $('#txtFiltersAdvanced').prop('disabled', false);
    $('#spanSaveButton').show();
    $('#btnEditAdvancedFilters').hide();
    $('#txtFiltersAdvanced').focus();
  }));


  $('#btnEditExcludeAdvancedFilters').click(checkForSyncError(function(event)
  {
    let headerOffset = $("#header").height() + 10;
    $("body, html").animate({
      scrollTop: $(event.target).offset().top - headerOffset
    }, 1000);
    $('#txtExcludeFiltersAdvanced').removeAttr('disabled');
    $('#spanSaveExcludeButton').show();
    $('#btnEditExcludeAdvancedFilters').hide();
    $('#txtExcludeFiltersAdvanced').focus();
  }));

  // Update custom filter count in the background.
  // Inputs: customFiltersText:string - string representation of the custom filters
  // delimited by new line.
  function updateCustomFiltersCount(customFiltersText)
  {
    var customFiltersArray  = customFiltersText.split('\n');
    var newCount           = {};
    var tempFilterTracker = [];
    for (var i = 0; i < customFiltersArray.length; i++)
    {
      var filter = customFiltersArray[i];

      //Check if filter is a duplicate and that it is a hiding filter.
      if (tempFilterTracker.indexOf(filter) < 0 && filter.indexOf('##') > -1)
      {
        tempFilterTracker.push(filter);
        var host        = filter.split('##')[0];
        newCount[host] = (newCount[host] || 0) + 1;
      }
    }

    backgroundPage.updateCustomFilterCountMap(newCount);
  }

  function saveFilters()
  {
    var customFiltersText  = $('#txtFiltersAdvanced').val();
    var customFiltersArray = customFiltersText.split('\n');
    var filterErrorMessage = '';
    $('#messagecustom').html(filterErrorMessage);
    for (var i = 0; (!filterErrorMessage && i < customFiltersArray.length); i++)
    {
      var filter = customFiltersArray[i];
      filter     = filter.trim();
      if (filter.length > 0)
      {
        var result = parseFilter(filter);
        if (result.error)
        {
          filterErrorMessage = translate('customfilterserrormessage', [filter, result.error.reason || result.error]);
        }
      }
    }

    if (filterErrorMessage)
    {
      $('#messagecustom').html(filterErrorMessage);
      $('#messagecustom').removeClass('do-not-display');
    }
    else
    {
      if (backgroundPage.adblockIsPaused())
      {
        customFiltersArray.push("@@");
        customFiltersArray.push("@@^$document");
      }
      for (var i = 0; (i < customFiltersArray.length); i++)
      {
        var filter = customFiltersArray[i];
        filter     = filter.trim();
        if (filter.length > 0)
        {
          var result = parseFilter(filter);
          if (result.filter)
          {
            filterStorage.addFilter(result.filter);
          }
        }
      }

      // Delete / remove filters the user removed...
      if (originalCustomFilters)
      {
        for (var i = 0; (i < originalCustomFilters.length); i++)
        {
          var filter = originalCustomFilters[i];
          if (customFiltersArray.indexOf(filter) === -1)
          {
            filter = filter.trim();
            if (filter.length > 0)
            {
              var result = parseFilter(filter);
              if (result.filter)
              {
                filterStorage.removeFilter(result.filter);
              }
            }
          }
        }
      }

      originalCustomFilters = customFiltersArray;
      updateCustomFiltersCount(customFiltersText);
      $('#divAddNewFilter').slideDown();
      $('#txtFiltersAdvanced').prop('disabled', true);
      $('#spanSaveButton').hide();
      $('#btnEditAdvancedFilters').show();
    }
  }

  $('#btnSaveAdvancedFilters').click(saveFilters);

  $('#btnSaveExcludeAdvancedFilters').click(checkForSyncError(function(event)
  {
    var exclude_filters_text = $('#txtExcludeFiltersAdvanced').val();
    backgroundPage.ExcludeFilter.setExcludeFilters(exclude_filters_text);
    $('#divAddNewFilter').slideDown();
    $('#txtExcludeFiltersAdvanced').attr('disabled', 'disabled');
    $('#spanSaveExcludeButton').hide();
    $('#btnEditExcludeAdvancedFilters').show();
    getExcludeFilters();
  }));

  var userFilters = backgroundPage.getUserFilters();
  if (userFilters &&
    userFilters.length)
  {
    originalCustomFilters = cleanCustomFilter(userFilters);
    $('#txtFiltersAdvanced').val(originalCustomFilters.join('\n'));
  }

  if (optionalSettings &&
      optionalSettings.show_advanced_options &&
      !optionalSettings.safari_content_blocking)
  {
    $('#divExcludeFilters').show();
  }

  if (optionalSettings &&
      optionalSettings.safari_content_blocking)
  {
    $('#safariwarning').text(translate('contentblockingwarning')).show();
  }

  filterNotifier.on("save", onFilterChange);
  window.addEventListener("unload", function() {
    filterNotifier.off("save", onFilterChange);
  });
});
