"use strict";

var resources = {};
var chosenResource = {};


// Creates the table that shows all blockable items
function generateTable(results) {
    // Truncates a resource URL if it is too long. Also escapes some
    // characters when they have a special meaning in HTML.
    // Inputs: the string to truncate
    // Returns the truncated string
    function truncateI(j) {
        if (j.length > 90)
            if (j.indexOf('?') > 43 && j.indexOf('?') <= 85)
                j = j.substring(0, j.indexOf('?') + 1) + '[...]';
        if (j.length > 90)
            j = j.substring(0, 86) + '[...]';

        return j;
    }

    // Now create that table row-by-row

    if (!results.rows.length) {
        alert(translate('noresourcessend2'));
        if (self && self["close"])
            self.close();
        else if (window && window["close"])
            window.close();
        return;
    }
    $("#loading").remove();
    $(".initialHide").css('visibility', 'visible');


    $("#resourceslist tbody").empty();
    for (var i = 0; i < results.rows.length; i++) {
        var rowData = results.rows[i];
        var rowEl = $("<tr>");
        if (rowData.class) {
            rowEl.addClass(rowData.class);
        }
        var resIndex = rowData.cellTwo.text;
        resources[resIndex] = {};
        resources[resIndex].resource = resIndex;
        resources[resIndex].domain = rowData.cellTwo.domain;


        var cellOne = $("<td><input type='checkbox'/></td>").css("padding-left", "4px");
        if (rowData.cellOne.disabled)
            cellOne.find("input").prop("disabled", true);
        rowEl.append(cellOne);

        //Cell Two
        $("<td>").
            attr("title", rowData.cellTwo.text).
            attr("data-column", "url").
            text(truncateI(rowData.cellTwo.text)).
            appendTo(rowEl);

        // Cell 3: Type
        $("<td>").
            attr("data-column", "type").
            css("text-align", "center").
            text(translate(rowData.cellThree.text)).
            appendTo(rowEl);

        // Cell 4: hidden sorting field and matching filter
        var cellFour = $("<td>").
            attr("data-column", "filter").
            css("text-align", "center");
        $("<span>").
            addClass("sorter").
            text(rowData.cellFour.sorter).
            appendTo(cellFour);
        if (typeof rowData.cellFour.filterInfo !== "undefined") {
            $("<span>").
                text(truncateI(rowData.cellFour.filterInfo.matchingfilter)).
                attr('title', translate("filterorigin", rowData.cellFour.filterInfo.matchingListName)).
                appendTo(cellFour);
            resources[resIndex].filter = rowData.cellFour.filterInfo.matchingfilter;
            resources[resIndex].filterlist = rowData.cellFour.filterInfo.matchingListName;
        } else {
            resources[resIndex].filter = null;
            resources[resIndex].filterlist = "";
        }

        rowEl.append(cellFour);


        // Cell 5: third-party or not
        var cell = $("<td>").
            text(translate(rowData.cellFive.isThirdParty)).
            attr("title", translate("resourcedomain", rowData.cellFive.resourceDomain)).
            attr("data-column", "thirdparty").
            css("text-align", "center");
        rowEl.append(cell);
        resources[resIndex].isThirdParty = rowData.cellFive.isThirdParty;
        resources[resIndex].resourceDomain = rowData.cellFive.resourceDomain;

        // Cell 6: delete a custom filter
        if (typeof rowData.cellSix.title !== "undefined") {
            $("<td>").
                addClass("deleterule").
                attr("title", translate(rowData.cellSix.title)).
                appendTo(rowEl);
        } else {
            $("<td>").appendTo(rowEl);
        }

        $("#resourceslist tbody").append(rowEl);
    }
    // Make it sortable, initial sort sequence is first the filter column (4),
    // then the URL column (2)
    $("#resourceslist th:not(:empty)").click(sortTable);
    $("#resourceslist th[data-column='url']").click();
    $("#resourceslist th[data-column='filter']").click();

    $(".deleterule").click(function () {
        var resource = resources[$(this).prevAll('td[data-column="url"]')[0].title];
        BGcall('remove_custom_filter', custom_filters[resource.filter], function () {
            // If the filter was a hiding rule, it'll still show up since it's still in
            // frameData in the background. However, I consider that acceptable.
            if (getTypeName(resource.type) === "page") {
                alert(translate("excludefilterremoved"));
            }
        });
    });
}


// Converts the ElementTypes number back into an readable string
// or hiding or 'unknown' if it wasn't in ElementTypes.
// Inputs: One out of ElementTypes or 'undefined'
// Returns a string with the element type
function getTypeName(type) {
    switch (type) {
        case undefined:
            return "hiding";
        case ElementTypes.script:
            return "script";
        case ElementTypes.background:
        case ElementTypes.image:
            return "image";
        case ElementTypes.stylesheet:
            return "stylesheet";
        case ElementTypes.object:
            return "object";
        case ElementTypes.subdocument:
            return "subdocument";
        case ElementTypes.object_subrequest:
            return "object_subrequest";
        case ElementTypes.media:
            return "media";
        case ElementTypes.xmlhttprequest:
            return "xmlhttprequest";
        case ElementTypes.other:
            return "other";
        //Cheating with $document & $elemhide here to make it easier: they are considered 'the same'
        case ElementTypes.document | ElementTypes.elemhide:
            return "page";
        case ElementTypes.popup:
            return "popup";
        default:
            return "unknown";
    }
}

//Generate a list of pre-defined url filters
function generateFilterSuggestions() {
    var url = chosenResource.resource;
    url = url.replace(/\s{5}\(.*\)$/, '').replace(/\#.*$/, '');
    var isBlocked = ($(".selected").hasClass("blocked"));
    var isHidden = ($(".selected").hasClass("hiding"));
    var blocksuggestions = [];
    var strippedUrl = url.replace(/^[a-z\-]+\:\/\/(www\.)?/, '');
    blocksuggestions.push(strippedUrl);
    if (strippedUrl.indexOf("?") > 0 || strippedUrl.indexOf("#") > 0) {
        strippedUrl = strippedUrl.replace(/(\?|\#).*/, '');
        blocksuggestions.push(strippedUrl);
    }
    if (strippedUrl.indexOf("/") > 0 &&
        strippedUrl.lastIndexOf('/') !== strippedUrl.indexOf('/')) {
        strippedUrl = strippedUrl.substr(0, strippedUrl.lastIndexOf('/') + 1);
        blocksuggestions.push(strippedUrl);
    }
    if (strippedUrl.indexOf('/') > 0) {
        strippedUrl = strippedUrl.substr(0, strippedUrl.indexOf('/'));
        blocksuggestions.push(strippedUrl);
    }

    var minimumdomain = parseUri.secondLevelDomainOnly(strippedUrl, true);
    if (minimumdomain !== strippedUrl) {
        blocksuggestions.push(minimumdomain);
    }

    var suggestions = [];
    for (var i in blocksuggestions) {
        var inputBox = $("<input>").
            attr("type", "radio").
            attr("name", "urloption").
            attr("id", "suggest_" + i).
            val((isBlocked ? "@@||" : "||") + blocksuggestions[i]);
        var label = $("<label>").
            attr("for", "suggest_" + i).
            text(blocksuggestions[i]);
        suggestions.push(inputBox);
        suggestions.push(label);
        suggestions.push("<br/>");
    }

    $("#suggestions").empty();
    for (var i = 0; i < suggestions.length; i++)
        $("#suggestions").append(suggestions[i]);
    if (isHidden)
        $("#disable").find('input').prop('checked', true);
    else if ($("#suggestions").find('input:first-child').val().indexOf('?') > 0)
        $($("#suggestions").children('input')[1]).prop('checked', true);
    else
        $("#suggestions").find('input:first-child').prop('checked', true);

    if (!isBlocked && !isHidden)
        $("#status").text(translate("blockeverycontaining"));
    else if (isHidden)
        $("#status").text(translate("thisfilterwillbedisabled"));
    else
        $("#status").text(translate("whitelisteverycontaining"));

    $("label[for='disablefilter']").text(chosenResource.filter);

    var inputBox = $('<input>').
        attr("type", "text").
        attr("id", "customurl").
        attr("size", "99").
        attr("title", translate("wildcardhint")).
        val(url).
        bind("input", function () {
            $("#custom").click();
        });
    $("#custom + label").append(inputBox);
}


// Check an URL for it's validity
function validateUrl(url) {
    if (!/^https?:\/\//.test(url)) {
        window.close();
        return;
    }
}

// Create the filter that will be applied from the chosen options
// Returns the filter
function createfilter() {
    var matchedfilter = $("label[for='disablefilter']").text();
    var isBlocked = ($(".selected").hasClass("blocked"));
    var isHidden = ($(".selected").hasClass("hiding"));
    var filterwithoutdomain = '';
    var urlfilter = '';

    if ($('#selectblockableurl #customurl').length) {
        urlfilter = (isBlocked ? '@@' : '') + $('#customurl').val();
    } else if ($('#selectblockableurl label[for="disablefilter"]').length) {
        if (isBlocked) {
            urlfilter = '@@' + matchedfilter;
        } else if (isHidden) {
            var chosenfilter = chosenResource.filter.replace('##', '#@#');
            var domain = chosenfilter.substr(0, chosenfilter.lastIndexOf("#@"));
            filterwithoutdomain = chosenfilter.replace(domain, "");
            if (domain === "") {
                urlfilter = chosenfilter;
            } else {
                urlfilter = filterwithoutdomain;
            }
        } else {
            urlfilter = matchedfilter;
        }
    } else {
        urlfilter = $('#selectblockableurl input').val();
    }

    if ((/^(\@\@)?\/.*\/$/).test(urlfilter))
        urlfilter += '*';

    var options = [];
    var selector = "#chooseoptions > input:checked";
    if ($("#types > input:not(:checked):not(.implicitType)").length ||
        $("#types > input.implicitType:checked").length)
        selector += ", #types > input:checked";
    $(selector).each(function () {
        if ($(this).val())
            options.push($(this).val());
    });

    var option = '';
    if (options.length && !($("#disablefilter").is(":disabled"))) {
        option = '$' + options.join(',');
    } else if (options.length && $("#disablefilter").is(":disabled")) {
        if (urlfilter.indexOf('$') !== -1) {
            option = ',' + options.join(',')
        } else if (!isHidden) {
            option = '$' + options.join(',');
        }
        if (isHidden) {
            var chosenfilter = chosenResource.filter;
            urlfilter = chosenResource.domain + filterwithoutdomain;
            option = '';
        }
    } else {
        option = '';
    }

    return urlfilter + option;
}

// Checks if the text in the domain list textbox is valid or not
// Inputs: the text from the text box
// Returns true if the domain list was valid, false otherwise
function isValidDomainList(text) {
    if (!text)
        return false;
    try {
        var parsedDomains = Filter._domainInfo(text, "|");
        FilterNormalizer.verifyDomains(parsedDomains);
        return true;
    } catch (ex) {
        return false;
    }
}


// After getting annoyed by the time it takes to get the required data
// finally start generating some content for the user, and allowing him to
// do some things, instead of looking at 'LOADING'
var finally_it_has_loaded_its_stuff = function (results, opts) {
    // Create the table of resources
    generateTable(results);

    // Add another background color when hovering
    $("#resourceslist tbody tr").mouseenter(function () {
        if ($(this).hasClass('selected'))
            return;
        $(this).children(":not(:first-child)").
            css("-webkit-transition", "all 0.3s ease-out").
            css("background-color", "rgba(242, 242, 242, 0.3)");
    });
    $("#resourceslist tr").mouseleave(function () {
        $(this).children().
            css("-webkit-transition", "all 0.3s ease-out").
            css("background-color", "white");
    });

    if (opts.tabId) {
        $("#legend").show();
    } else {
        if ($("#resourceslist input").prop("disabled")) {
            // In case the resource has been whitelisted and can't be removed
            if ($(".deleterule").length === 0) {
                alert(translate('resourceiswhitelisted'));
                return;
            }
            $("#legend").show();
            // Make legend draggable
            $(function () {
                $("#legend").draggable();
            });
        } else {
            //wait a moment to allow the click handler to be attached.
            window.setTimeout(function () {
                $("#resourceslist input").click();
            }, 10);
        }
        $("#choosedifferentresource").remove();
    }


    // Close the legend
    $(".closelegend").click(function () {
        $("#legend").remove();
    });

    // Search a resource
    $('#search').on("keyup", function () {
        var patterns = $("#search").val().trim().replace(/\s+/g, ' ').split(" ");
        for (var i = 0; i < patterns.length; i++) {
            patterns[i] = new RegExp(patterns[i]
                .replace(/\*+/g, '*')
                .replace(/\W/g, '\\$&')
                .replace(/\\\*/g, '[^\\t]*'), "i");
        }
        $("#resourceslist tbody tr.noSearchMatch").removeClass("noSearchMatch");
        $("#nosearchresults").hide();

        if (!$("#search").val().trim()) return;
        $("#resourceslist tbody tr").each(function (i, el) {
            var keywords = [];
            var res = resources[$("[data-column='url']", el).attr('title')];
            keywords.push(res.domain);
            keywords.push(res.resource);
            if (res.filter) {
                keywords.push(res.filter);
                //if (custom_filters[res.filter] !== res.filter)
                //  keywords.push(custom_filters[res.filter]);
            }
            if (res.filterlist)
                keywords.push(res.filterlist);
            var typeName = getTypeName(res.type);
            keywords.push(typeName);
            if (/_/.test(typeName))
                keywords.push(typeName.replace('_', '-')); // $object-subrequest === $object_subrequest
            keywords.push(translate("type" + typeName));
            if (res.isThirdParty) {
                keywords.push(translate("thirdparty"));
                keywords.push("third-party");
                keywords.push("third_party");
            } else {
                // There are so many possible ways to call 'first-party' resources, that
                // I'm not going to worry about those (localized) matches.
                keywords.push("first-party");
                keywords.push("first_party");
            }
            keywords = keywords.join('\t');
            for (var j = 0; j < patterns.length; j++) {
                if (!patterns[j].test(keywords)) {
                    // Setting styles directly is terribly slow. Using classes is way faster.
                    $(el).addClass("noSearchMatch");
                    break;
                }
            }
        });
        if ($("#resourceslist tbody tr:visible").length === 0) {
            $("#nosearchresults").
                show().
                text(translate("nosearchresults"));
        }
    });// end of searchHandler

    // Auto-scroll to the bottom of the page
    $("#confirmUrl").click(function (event) {
        event.preventDefault();
        $("html, body").animate({scrollTop: 15000}, 50);
    });

    // An item has been selected
    $('.clickableRow, input:enabled', '#resourceslist').click(function () {
        if ($('.selected', '#resourceslist').length > 0)
            return; //already selected a resource
        $("#choosedifferentresource").css("opacity", "1");
        $("#choosedifferentresource").click(function () {
            document.location.reload();
        });
        $(this).parents('tr').addClass('selected');
        $("#resourceslist tr:not(.selected)").remove();
        $("#resourceslist tr input").
            prop('checked', true).
            prop('disabled', true);
        $('.clickableRow').removeClass('clickableRow');
        $('#legend').remove();
        chosenResource = resources[$(".selected td[data-column='url']").prop('title')];
        $(".selected td[data-column='thirdparty']").text(
            chosenResource.isThirdParty ? translate('thirdparty') : '');

        // Show the 'choose url' area
        $("#selectblockableurl").fadeIn();
        $("#resourceslist tbody tr td").css("background-color", "white");

        var isBlocked = ($(".selected").hasClass("blocked"));
        var isHidden = ($(".selected").hasClass("hiding"));
        var isWhitelisted = ($(".selected").hasClass("whitelisted"));
        if (isBlocked || isWhitelisted) {
            $("#disable").css("display", "block");
            $("#confirmUrl").before("<br>");
        } else if (isHidden) {
            $("#disable").css("display", "block");
            $("#selectblockableurl br").remove();
            $("[i18n='ordisablefilter'], #suggestions, #custom, label[for='custom']").remove();
            $("[i18n='blockeverycontaining']").attr("i18n", "thisfilterwillbedisabled");
            $("#confirmUrl").before("<br>");
        } else {
            $("#disable").css("display", "none");
        }

        generateFilterSuggestions();
        // If the user clicks the 'next' button
        $("#confirmUrl").click(function () {
            if ($('#custom').is(':checked') &&
                $('#customurl').val().trim() === '') {
                alert(translate('novalidurlpattern'));
                return;
            }
            if ($('#custom').is(':checked')) {
                var custom_corrected = $('#customurl').val().
                    replace(/\s/g, '').replace(/^\@\@/, '');
                // Check the URL only, therefore type image, so we don't end up with for
                // example 'popup', a non-default type.
                BGcall('filterMatchesResource', custom_corrected, chosenResource.resource,
                    2, chosenResource.domain, function (response) {
                        if (!response && !confirm(translate("doesntmatchoriginal"))) {
                            return;
                        }
                    });
                // Remove preceeding @@ and trailing spaces
                $('#customurl').val(custom_corrected);
            }

            // Hide unused stuff
            $("#selectblockableurl input[type='radio']:not(:checked) + label").remove();
            $("#selectblockableurl input[type='radio']:not(:checked)").remove();
            $("#confirmUrl").next().remove();
            $("#confirmUrl").remove();
            $("#selectblockableurl br").remove();
            $("#selectblockableurl *:not(br):not(b)").prop("disabled", true);
            if ($("#disablefilter").is(":disabled")) {
                $("#status").text(translate("thisfilterwillbedisabled"));
                $("label[for='domainis']").text(translate("onlypagesonthisdomain"));
                $("[i18n='appliedwhenbrowsing']").text(translate("disabledwhenbrowsing"));
                $("[i18n='ordisablefilter'], [i18n='casesensitive'], [i18n='onlyresourcetypes'], [id^='matchcase'], [for^='matchcase'], #chooseoptions br, #suggestions, #thirdparty, #types").remove();
                $("#onEverySite, #domainis").before("<br>");
                $("#addthefilter").before("<br><br>");
            } else {
                $("[i18n='ordisablefilter'], #suggestions br").remove();
            }

            // Show the options
            $("#chooseoptions").fadeIn();
            var isThirdParty = chosenResource.isThirdParty;
            if (!isThirdParty) {
                $("#thirdparty + * + *, #thirdparty + *, #thirdparty").remove();
            } else {
                // Use .find().text() so data from query string isn't injected as HTML
                $("#thirdparty + label").
                    text(translate("thirdpartycheckbox", "<i></i>")).
                    find("i").
                    text(parseUri.secondLevelDomainOnly(chosenResource.resourceDomain, true));
            }

            $("#domainlist").
                val(chosenResource.domain.replace(/^www\./, '')).
                click(function () {
                    $("#domainis").prop("checked", true);
                    $("#filterpreview").text(createfilter());
                }).
                bind("input", function () {
                    $("#domainis").prop("checked", true);
                    $(this).trigger("keyup");
                }).
                keyup(function () {
                    if (isValidDomainList($(this).val().trim().replace(/(\s|\,|\;)+/g, '|'))) {
                        $("#domainis").
                            val('domain=' + $(this).val().trim().replace(/(\s|\,|\;)+/g, '|'));
                        $("#domainlist").css('color', 'black');
                    } else {
                        $("#domainis").val('');
                        $("#domainlist").css('color', 'red');
                    }
                    $("#filterpreview").text(createfilter());
                });
            $("#domainis").
                val('domain=' + chosenResource.domain.replace(/^www\./, ''));

            var selectorForFixedType = '[value="' + getTypeName(chosenResource.type) + '"]';
            if (!$(selectorForFixedType).is(":checked")) {
                // Special non-default type. For example $popup
                $("#types > input").prop("checked", false);
            }
            $(selectorForFixedType).
                prop('disabled', true).
                prop('checked', true);

            // Update the preview filter
            $("#chooseoptions *").change(function () {
                $("#filterpreview").text(createfilter());
            });
            $("#filterpreview").text(createfilter());

            // Add the filter
            $("#addthefilter").click(function () {
                var generated_filter = createfilter();
                if (!isHidden) {
                    BGcall('filterMatchesResource', generated_filter, chosenResource.resource,
                        chosenResource.type, chosenResource.domain, function (response) {
                            if (!response) {
                                var userResponse = confirm(translate("doesntmatchoriginal"));
                                if (!userResponse) {
                                    return;
                                }
                            }
                            if (!isBlocked && isWhitelisted) {
                                BGcall("add_exclude_filter", generated_filter, function (ex) {
                                    if (!ex) {
                                        alert(translate("filterhasbeenadded"));
                                    } else {
                                        alert(translate("blacklistereditinvalid1", ex));
                                    }
                                });
                            } else {
                                BGcall('add_custom_filter', generated_filter, function (ex) {
                                    if (!ex) {
                                        alert(translate("filterhasbeenadded"));
                                    } else {
                                        alert(translate("blacklistereditinvalid1", ex));
                                    }
                                });//end add_custom_filter
                            }
                        });//end  filterMatchesResource
                } else {
                    BGcall('add_custom_filter', generated_filter, function (ex) {
                        if (!ex) {
                            alert(translate("filterhasbeenadded"));
                        } else {
                            alert(translate("blacklistereditinvalid1", ex));
                        }
                    });//end add_custom_filter
                }//end else
            });//end Addthefilter
        });//end confirmUrl click handler
    });//end click handler for row
};

// Click event for the column titles (<th>) of a table.
// It'll sort the table upon the contents of that column
var sortTable = function () {
    var table = $(this).closest('table');
    if (table.find('[colspan]').length)
        return; // can't handle the case where some columns have been merged locally
    var columnNumber = $(this).prevAll().length + 1;
    if ($(this).attr("data-sortDirection") === "ascending") {
        $(this).attr("data-sortDirection", "descending"); // Z->A
    } else {
        $(this).attr("data-sortDirection", "ascending"); // A->Z
    }
    var cellList = [];
    var rowList = [];
    $("td:nth-of-type(" + columnNumber + ")", table).each(function (index, element) {
        cellList.push(element.innerHTML.toLowerCase() + 'ÿÿÿÿÿ' + (index + 10000));
        rowList.push($(element).parent('tr').clone(true));
    });
    cellList.sort();
    if ($(this).attr("data-sortDirection") === "descending")
        cellList.reverse();
    $("tbody", table).empty();
    cellList.forEach(function (item) {
        var no = Number(item.match(/\d+$/)[0]) - 10000;
        $("tbody", table).append(rowList[no]);
    });
};

$(document).ready(function () {

    chrome.i18n.initializeL10nData(function () {

        // Translation
        localizePage();

        $("#choosedifferentresource").css("opacity", "0");

        var opts = {};
        if (window.location.search) {
            // Can be of the forms
            //  ?tabId=(tab ID)
            var qps = parseUri.parseSearch(window.location.search);
            if (qps.tabId) {
                opts.tabId = qps.tabId;
            } else {
                return;
            }
        } else {
            // Args can be of the forms
            //  url=(page url), itemType=(someElementType), itemUrl=(item url)
            //  tabId=(tab ID)
            if (args.itemUrl) {
                opts.domain = parseUri(args.url).hostname;
                opts.type = args.itemType;
                opts.resource = args.itemUrl;
                opts.url = args.url;
            } else {
                opts.tabId = args.tabId;
            }
        }
        BGcall('getResourceBlockData', opts, function (results) {
            //get JSONOjbect to display
            finally_it_has_loaded_its_stuff(results, opts);
        });

    });//end of chrome.i18n.initializeL10nData

});//end of document ready