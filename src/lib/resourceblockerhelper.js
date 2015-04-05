"use strict";

var background = require("background");
var functions = require("functions");
var CP = require("contentpolicy");

var resources = {};
var custom_filters = {};
var chosenResource = {};
var local_filtersets = {};

// Converts the ElementTypes number back into an readable string
// or hiding or 'unknown' if it wasn't in ElementTypes.
// Inputs: One out of ElementTypes or 'undefined'
// Returns a string with the element type
var getTypeName = function (type) {
    switch (type) {
        case undefined:
            return "hiding";
        case CP.MY.ElementTypes.script:
            return "script";
        case CP.MY.ElementTypes.background:
        case CP.MY.ElementTypes.image:
            return "image";
        case CP.MY.ElementTypes.stylesheet:
            return "stylesheet";
        case CP.MY.ElementTypes.object:
            return "object";
        case CP.MY.ElementTypes.subdocument:
            return "subdocument";
        case CP.MY.ElementTypes.object_subrequest:
            return "object_subrequest";
        case CP.MY.ElementTypes.media:
            return "media";
        case CP.MY.ElementTypes.xmlhttprequest:
            return "xmlhttprequest";
        case CP.MY.ElementTypes.other:
            return "other";
        //Cheating with $document & $elemhide here to make it easier: they are considered 'the same'
        case CP.MY.ElementTypes.document | CP.MY.ElementTypes.elemhide:
            return "page";
        case CP.MY.ElementTypes.popup:
            return "popup";
        default:
            return "unknown";
    }
};

// Create filtersets for resourceblock and put them in the local_filtersets
// object. Similar to MyFilters.prototype.rebuild(), but keeps every list
// separate. Inputs
//   id: identifier of the list
//   text: array containing all filters in the list
var createResourceblockFilterset = function (id, text) {
    local_filtersets[id] = {};
    var w = {}, b = {}, h = {};

    for (var i = 0; i < text.length; i++) {
        var filter = CP.MY.Filter.fromText(text[i], true);
        if (CP.MY.Filter.isSelectorFilter(text[i]))
            h[filter.id] = filter;
        else if (CP.MY.Filter.isWhitelistFilter(text[i]))
            w[filter.id] = filter;
        else if (text[i])
            b[filter.id] = filter;
    }
    local_filtersets[id].hiding = CP.MY.FilterSet.fromFilters(h);
    local_filtersets[id].blocking =
        new CP.MY.BlockingFilterSet(CP.MY.FilterSet.fromFilters(b), CP.MY.FilterSet.fromFilters(w));
    if (id === "malware") {
        local_filtersets["malware"].blocking.setMalwareDomains(background.getMalwareDomains());
    }
};

var getResourceBlockData = function (opts) {

    //reset variables.
    resources = {};
    custom_filters = {};
    chosenResource = {};
    local_filtersets = {};
    //clear the filter cache
    CP.MY.Filter._cache = {};

    var filter_lists = functions.storage_get('filter_lists');
    for (var id in filter_lists) {
        if (filter_lists[id].subscribed &&
            filter_lists[id].text &&
            id !== "malware") {
            createResourceblockFilterset(id, filter_lists[id].text.split('\n'));

        } else if (id === "malware" &&
            filter_lists[id].subscribed) {
            createResourceblockFilterset(id, []);
        }
    }
    var sender = {tab: {url: opts.url}};

    var data = background.get_content_script_data(opts, sender);
    createResourceblockFilterset("build_in_filters", CP.MY.MyFilters.prototype.getExtensionFilters(data.settings));

    if (data.adblock_is_paused) {
        return {"msg": "adblock_is_paused"};
    }

    if (opts.tabId) {
        // Load all stored resources.
        var loaded_frames = background.resourceblock_get_frameData(opts.tabId);
        loaded_frames = loaded_frames || {};
        for (var thisFrame in loaded_frames) {
            var frame = loaded_frames[thisFrame];

            if (Number(thisFrame) === 0) {
                // We don't parse $document and $elemhide rules for subframes
                resources[frame.url] = {
                    type: CP.MY.ElementTypes.document | CP.MY.ElementTypes.elemhide,
                    domain: frame.domain,
                    resource: frame.url
                };
            }

            for (var res in frame.resources) {
                if (/^HIDE\:\|\:.+/.test(res)) {
                    var filter = "##" + res.substring(7);
                    resources[filter] = {
                        filter: filter,
                        domain: frame.domain,
                        resource: filter
                    };
                } else {
                    if (/\<|\"/.test(res)) continue;
                    var blockmatches = res.split(':|:');
                    //if (blockmatches[1].indexOf(port.chrome.extension.getURL("")) === 0)
                    //    continue; // Blacklister resources shouldn't be visible
                    if (!/^[a-z\-]+\:\/\//.test(blockmatches[1]))
                        continue; // Ignore about: and data: urls
                    var elemType = Number(blockmatches[0]);
                    if (elemType === CP.MY.ElementTypes.document)
                        continue;
                    resources[blockmatches[1]] = {
                        type: elemType,
                        domain: frame.domain,
                        resource: blockmatches[1]
                    };
                }
            }
        }
    } else {
        resources[opts.resource] = {
            type: CP.MY.ElementTypes[opts.itemType],
            domain: functions.parseUri(opts.url).hostname,
            resource: opts.resource
        };
    }

    var filters = background.get_custom_filters_text();
    filters = filters.split('\n');
    for (var i = 0; i < filters.length; i++) {
        try {
            var normalized = CP.MY.FilterNormalizer.normalizeLine(filters[i]);
            if (normalized) // filter out comments and ignored filters
                custom_filters[normalized] = filters[i];
        } catch (ex) {
        } //Broken filter
    }

    createResourceblockFilterset("user_custom_filters", Object.keys(custom_filters));

    var results = {rows: []};

    for (var i in resources) {
        var matchingfilter = resources[i].filter;
        var matchingListID = "", matchingListName = "";
        var typeName = getTypeName(resources[i].type);

        if (matchingfilter) {
            // If matchingfilter is already set, it's a hiding rule or a bug.
            // However, we only know the selector part (e.g. ##.ad) not the full
            // selector (e.g., domain.com##.ad). Neither do we know the filter list
            for (var fset in local_filtersets) {
                // Slow? Yeah, for sure! But usually you have very few hiding rule
                // matches, not necessary for the same domain. And we can be slow in
                // resourceblock, so there is no need to cache this.
                var hidingset = local_filtersets[fset].hiding;
                var hidingrules = hidingset.filtersFor(resources[i].domain, true);
                if (hidingrules.indexOf(matchingfilter.substr(2)) !== -1) {
                    var subdomain = resources[i].domain;
                    var k = 0;
                    while (subdomain) {
                        k++;
                        if (k > 100) break;
                        if (hidingset.items[subdomain]) {
                            for (var j = 0; j < hidingset.items[subdomain].length; j++) {
                                if (hidingset.items[subdomain][j].selector === matchingfilter.substr(2)) {
                                    // Ignore the case that a list contains both
                                    // ##filter
                                    // ~this.domain.com,domain.com##filter
                                    matchingfilter = hidingset.items[subdomain][j]._text;
                                }
                            }
                        }
                        if (subdomain === "global") {
                            break;
                        }
                        subdomain = subdomain.replace(/^.+?(\.|$)/, '') || "global";
                    }
                    matchingListID = fset;
                    break;
                }
            }
        } else {
            for (var fset in local_filtersets) {
                var currentlist_matchingfilter = local_filtersets[fset].blocking.
                    matches(i, resources[i].type, resources[i].domain, true);
                if (currentlist_matchingfilter) {
                    matchingListID = fset;
                    matchingfilter = currentlist_matchingfilter;
                    if (CP.MY.Filter.isWhitelistFilter(currentlist_matchingfilter))
                        break;
                }
            }
        }

        if (matchingListID) {
            if (matchingListID === "user_custom_filters") {
                matchingListName = "tabcustomize";
            } else if (matchingListID === "build_in_filters") {
                matchingListName = "AdBlock";
            } else {
                matchingListName = "filter" + matchingListID;
                if (!matchingListName) {
                    matchingListName = matchingListID.substr(4);
                    validateUrl(matchingListName);
                }
            }
        }

        var type = {sort: 3, name: undefined};

        if (matchingfilter) {
            if (CP.MY.Filter.isWhitelistFilter(matchingfilter))
                type = {sort: 2, name: 'whitelisted'};
            else if (CP.MY.Filter.isSelectorFilter(i)) {
                // TODO: report excluded hiding rules
                type = {sort: 0, name: 'hiding'};
            } else
                type = {sort: 1, name: 'blocked'};
        } else {
            matchingfilter = "";
        }

        // TODO: When crbug 80230 is fixed, allow $other again
        var disabled = (typeName === 'other' || typeName === 'unknown');

        // We don't show the page URL unless it's excluded by $document or $elemhide
        if (typeName === 'page' && !matchingfilter)
            continue;

        //var row = $("<tr>");
        var row = {};
        if (type.name)
            row.class = type.name;

        // Cell 1: Checkbox
        var cellOne = {};
        cellOne.disabled = disabled;
        row.cellOne = cellOne;

        // Cell 2: URL
        var cellTwo = {};
        cellTwo.text = i;
        cellTwo.title = i;
        cellTwo.domain = resources[i].domain;
        row.cellTwo = cellTwo;

        // Cell 3: Type
        var cellThree = {};
        cellThree.text = 'type' + typeName;
        row.cellThree = cellThree;

        // Cell 4: hidden sorting field and matching filter
        var cellFour = {};
        cellFour.sorter = type.name ? type.sort : 3;
        row.cellFour = cellFour;

        if (type.name) {
            var filterInfo = {};
            filterInfo.matchingfilter = custom_filters[matchingfilter] || matchingfilter;
            filterInfo.matchingListName = matchingListName;
            row.cellFour.filterInfo = filterInfo;
        }
        // Cell 5: third-party or not
        var resourceDomain = functions.parseUri(i).hostname;
        var isThirdParty = (type.name === 'hiding' ? false :
            CP.MY.BlockingFilterSet.checkThirdParty(resources[i].domain, resourceDomain));
        var cellFive = {};
        cellFive.isThirdParty = isThirdParty ? 'yes' : 'no';
        cellFive.resourceDomain = resources[i].domain || resourceDomain;
        row.cellFive = cellFive;

        var cellSix = {};
        row.cellSix = cellSix;
        // Cell 6: delete a custom filter
        if (custom_filters[matchingfilter]) {
            row.cellSix.title = "removelabel";
        }

        results.rows.push(row);
    }//end of for() loop
    return results;
};
exports.getResourceBlockData = getResourceBlockData;

// Checks if a resource matches a filter
// Inputs: filter: the filter to test the match against
//         url: the resource URL
//         type: the resource type
//         domain: the resource domain
// Returns: boolean: should it continue?
var filterMatchesResource = function (filter, url, type, domain) {
    var temp_filterset = new CP.MY.BlockingFilterSet(
        CP.MY.FilterSet.fromFilters({1: CP.MY.Filter.fromText(filter)}),
        CP.MY.FilterSet.fromFilters({}));
    return (!temp_filterset.matches(url, type, domain));
};
exports.filterMatchesResource = filterMatchesResource;