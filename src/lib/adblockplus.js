/******/ (function(modules) { // webpackBootstrap
/******/ 	// The module cache
/******/ 	var installedModules = {};
/******/
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/
/******/ 		// Check if module is in cache
/******/ 		if(installedModules[moduleId]) {
/******/ 			return installedModules[moduleId].exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = installedModules[moduleId] = {
/******/ 			i: moduleId,
/******/ 			l: false,
/******/ 			exports: {}
/******/ 		};
/******/
/******/ 		// Execute the module function
/******/ 		modules[moduleId].call(module.exports, module, module.exports, __webpack_require__);
/******/
/******/ 		// Flag the module as loaded
/******/ 		module.l = true;
/******/
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/
/******/
/******/ 	// expose the modules object (__webpack_modules__)
/******/ 	__webpack_require__.m = modules;
/******/
/******/ 	// expose the module cache
/******/ 	__webpack_require__.c = installedModules;
/******/
/******/ 	// define getter function for harmony exports
/******/ 	__webpack_require__.d = function(exports, name, getter) {
/******/ 		if(!__webpack_require__.o(exports, name)) {
/******/ 			Object.defineProperty(exports, name, {
/******/ 				configurable: false,
/******/ 				enumerable: true,
/******/ 				get: getter
/******/ 			});
/******/ 		}
/******/ 	};
/******/
/******/ 	// getDefaultExport function for compatibility with non-harmony modules
/******/ 	__webpack_require__.n = function(module) {
/******/ 		var getter = module && module.__esModule ?
/******/ 			function getDefault() { return module['default']; } :
/******/ 			function getModuleExports() { return module; };
/******/ 		__webpack_require__.d(getter, 'a', getter);
/******/ 		return getter;
/******/ 	};
/******/
/******/ 	// Object.prototype.hasOwnProperty.call
/******/ 	__webpack_require__.o = function(object, property) { return Object.prototype.hasOwnProperty.call(object, property); };
/******/
/******/ 	// __webpack_public_path__
/******/ 	__webpack_require__.p = "";
/******/
/******/ 	// Load entry module and return exports
/******/ 	return __webpack_require__(__webpack_require__.s = 29);
/******/ })
/************************************************************************/
/******/ ([
/* 0 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";
/*
 * This file is part of Adblock Plus <https://adblockplus.org/>,
 * Copyright (C) 2006-present eyeo GmbH
 *
 * Adblock Plus is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3 as
 * published by the Free Software Foundation.
 *
 * Adblock Plus is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with Adblock Plus.  If not, see <http://www.gnu.org/licenses/>.
 */



/**
 * @fileOverview Definition of Filter class and its subclasses.
 */

const {FilterNotifier} = __webpack_require__(1);
const {extend} = __webpack_require__(19);
const {filterToRegExp} = __webpack_require__(32);

/**
 * Abstract base class for filters
 *
 * @param {string} text   string representation of the filter
 * @constructor
 */
function Filter(text)
{
  this.text = text;
  this.subscriptions = [];
}
exports.Filter = Filter;

Filter.prototype =
{
  /**
   * String representation of the filter
   * @type {string}
   */
  text: null,

  /**
   * Filter subscriptions the filter belongs to
   * @type {Subscription[]}
   */
  subscriptions: null,

  /**
   * Filter type as a string, e.g. "blocking".
   * @type {string}
   */
  get type()
  {
    throw new Error("Please define filter type in the subclass");
  },

  /**
   * Serializes the filter to an array of strings for writing out on the disk.
   * @param {string[]} buffer  buffer to push the serialization results into
   */
  serialize(buffer)
  {
    buffer.push("[Filter]");
    buffer.push("text=" + this.text);
  },

  toString()
  {
    return this.text;
  }
};

/**
 * Cache for known filters, maps string representation to filter objects.
 * @type {Map.<string,Filter>}
 */
Filter.knownFilters = new Map();

/**
 * Regular expression that element hiding filters should match
 * @type {RegExp}
 */
Filter.elemhideRegExp = /^([^/*|@"!]*?)#([@?])?#(.+)$/;
/**
 * Regular expression that RegExp filters specified as RegExps should match
 * @type {RegExp}
 */
Filter.regexpRegExp = /^(@@)?\/.*\/(?:\$~?[\w-]+(?:=[^,\s]+)?(?:,~?[\w-]+(?:=[^,\s]+)?)*)?$/;
/**
 * Regular expression that options on a RegExp filter should match
 * @type {RegExp}
 */
Filter.optionsRegExp = /\$(~?[\w-]+(?:=[^,]+)?(?:,~?[\w-]+(?:=[^,]+)?)*)$/;
/**
 * Regular expression that matches an invalid Content Security Policy
 * @type {RegExp}
 */
Filter.invalidCSPRegExp = /(;|^) ?(base-uri|referrer|report-to|report-uri|upgrade-insecure-requests)\b/i;

/**
 * Creates a filter of correct type from its text representation - does the
 * basic parsing and calls the right constructor then.
 *
 * @param {string} text   as in Filter()
 * @return {Filter}
 */
Filter.fromText = function(text)
{
  let filter = Filter.knownFilters.get(text);
  if (filter)
    return filter;

  let match = (text.includes("#") ? Filter.elemhideRegExp.exec(text) : null);
  if (match)
  {
    let propsMatch;
    if (!match[2] &&
        (propsMatch = /\[-abp-properties=(["'])([^"']+)\1\]/.exec(match[3])))
    {
      // This is legacy CSS properties syntax, convert to current syntax
      let prefix = match[3].substr(0, propsMatch.index);
      let expression = propsMatch[2];
      let suffix = match[3].substr(propsMatch.index + propsMatch[0].length);
      return Filter.fromText(`${match[1]}#?#` +
          `${prefix}:-abp-properties(${expression})${suffix}`);
    }

    filter = ElemHideBase.fromText(
      text, match[1], match[2], match[3]
    );
  }
  else if (text[0] == "!")
    filter = new CommentFilter(text);
  else
    filter = RegExpFilter.fromText(text);

  Filter.knownFilters.set(filter.text, filter);
  return filter;
};

/**
 * Deserializes a filter
 *
 * @param {Object}  obj map of serialized properties and their values
 * @return {Filter} filter or null if the filter couldn't be created
 */
Filter.fromObject = function(obj)
{
  let filter = Filter.fromText(obj.text);
  if (filter instanceof ActiveFilter)
  {
    if ("disabled" in obj)
      filter._disabled = (obj.disabled == "true");
    if ("hitCount" in obj)
      filter._hitCount = parseInt(obj.hitCount, 10) || 0;
    if ("lastHit" in obj)
      filter._lastHit = parseInt(obj.lastHit, 10) || 0;
  }
  return filter;
};

/**
 * Removes unnecessary whitespaces from filter text, will only return null if
 * the input parameter is null.
 * @param {string} text
 * @return {string}
 */
Filter.normalize = function(text)
{
  if (!text)
    return text;

  // Remove line breaks, tabs etc
  text = text.replace(/[^\S ]+/g, "");

  // Don't remove spaces inside comments
  if (/^ *!/.test(text))
    return text.trim();

  // Special treatment for element hiding filters, right side is allowed to
  // contain spaces
  if (Filter.elemhideRegExp.test(text))
  {
    let [, domains, separator, selector] = /^(.*?)(#[@?]?#?)(.*)$/.exec(text);
    return domains.replace(/ +/g, "") + separator + selector.trim();
  }

  // For most regexp filters we strip all spaces, but $csp filter options
  // are allowed to contain single (non trailing) spaces.
  let strippedText = text.replace(/ +/g, "");
  if (!strippedText.includes("$") || !/\bcsp=/i.test(strippedText))
    return strippedText;

  let optionsMatch = Filter.optionsRegExp.exec(strippedText);
  if (!optionsMatch)
    return strippedText;

  // For $csp filters we must first separate out the options part of the
  // text, being careful to preserve its spaces.
  let beforeOptions = strippedText.substring(0, optionsMatch.index);
  let strippedDollarIndex = -1;
  let dollarIndex = -1;
  do
  {
    strippedDollarIndex = beforeOptions.indexOf("$", strippedDollarIndex + 1);
    dollarIndex = text.indexOf("$", dollarIndex + 1);
  }
  while (strippedDollarIndex != -1);
  let optionsText = text.substr(dollarIndex + 1);

  // Then we can normalize spaces in the options part safely
  let options = optionsText.split(",");
  for (let i = 0; i < options.length; i++)
  {
    let option = options[i];
    let cspMatch = /^ *c *s *p *=/i.exec(option);
    if (cspMatch)
    {
      options[i] = cspMatch[0].replace(/ +/g, "") +
                   option.substr(cspMatch[0].length).trim().replace(/ +/g, " ");
    }
    else
      options[i] = option.replace(/ +/g, "");
  }

  return beforeOptions + "$" + options.join();
};

/**
 * @see filterToRegExp
 */
Filter.toRegExp = filterToRegExp;

/**
 * Class for invalid filters
 * @param {string} text see Filter()
 * @param {string} reason Reason why this filter is invalid
 * @constructor
 * @augments Filter
 */
function InvalidFilter(text, reason)
{
  Filter.call(this, text);

  this.reason = reason;
}
exports.InvalidFilter = InvalidFilter;

InvalidFilter.prototype = extend(Filter, {
  type: "invalid",

  /**
   * Reason why this filter is invalid
   * @type {string}
   */
  reason: null,

  /**
   * See Filter.serialize()
   * @inheritdoc
   */
  serialize(buffer) {}
});

/**
 * Class for comments
 * @param {string} text see Filter()
 * @constructor
 * @augments Filter
 */
function CommentFilter(text)
{
  Filter.call(this, text);
}
exports.CommentFilter = CommentFilter;

CommentFilter.prototype = extend(Filter, {
  type: "comment",

  /**
   * See Filter.serialize()
   * @inheritdoc
   */
  serialize(buffer) {}
});

/**
 * Abstract base class for filters that can get hits
 * @param {string} text
 *   see Filter()
 * @param {string} [domains]
 *   Domains that the filter is restricted to separated by domainSeparator
 *   e.g. "foo.com|bar.com|~baz.com"
 * @constructor
 * @augments Filter
 */
function ActiveFilter(text, domains)
{
  Filter.call(this, text);

  this.domainSource = domains;
}
exports.ActiveFilter = ActiveFilter;

ActiveFilter.prototype = extend(Filter, {
  _disabled: false,
  _hitCount: 0,
  _lastHit: 0,

  /**
   * Defines whether the filter is disabled
   * @type {boolean}
   */
  get disabled()
  {
    return this._disabled;
  },
  set disabled(value)
  {
    if (value != this._disabled)
    {
      let oldValue = this._disabled;
      this._disabled = value;
      FilterNotifier.triggerListeners("filter.disabled", this, value, oldValue);
    }
    return this._disabled;
  },

  /**
   * Number of hits on the filter since the last reset
   * @type {number}
   */
  get hitCount()
  {
    return this._hitCount;
  },
  set hitCount(value)
  {
    if (value != this._hitCount)
    {
      let oldValue = this._hitCount;
      this._hitCount = value;
      FilterNotifier.triggerListeners("filter.hitCount", this, value, oldValue);
    }
    return this._hitCount;
  },

  /**
   * Last time the filter had a hit (in milliseconds since the beginning of the
   * epoch)
   * @type {number}
   */
  get lastHit()
  {
    return this._lastHit;
  },
  set lastHit(value)
  {
    if (value != this._lastHit)
    {
      let oldValue = this._lastHit;
      this._lastHit = value;
      FilterNotifier.triggerListeners("filter.lastHit", this, value, oldValue);
    }
    return this._lastHit;
  },

  /**
   * String that the domains property should be generated from
   * @type {?string}
   */
  domainSource: null,

  /**
   * Separator character used in domainSource property, must be
   * overridden by subclasses
   * @type {string}
   */
  domainSeparator: null,

  /**
   * Determines whether the trailing dot in domain names isn't important and
   * should be ignored, must be overridden by subclasses.
   * @type {boolean}
   */
  ignoreTrailingDot: true,

  /**
   * Determines whether domainSource is already upper-case,
   * can be overridden by subclasses.
   * @type {boolean}
   */
  domainSourceIsUpperCase: false,

  /**
   * Map containing domains that this filter should match on/not match
   * on or null if the filter should match on all domains
   * @type {?Map.<string,boolean>}
   */
  get domains()
  {
    // Despite this property being cached, the getter is called
    // several times on Safari, due to WebKit bug 132872
    let prop = Object.getOwnPropertyDescriptor(this, "domains");
    if (prop)
      return prop.value;

    let domains = null;

    if (this.domainSource)
    {
      let source = this.domainSource;
      if (!this.domainSourceIsUpperCase)
      {
        // RegExpFilter already have uppercase domains
        source = source.toUpperCase();
      }
      let list = source.split(this.domainSeparator);
      if (list.length == 1 && list[0][0] != "~")
      {
        // Fast track for the common one-domain scenario
        if (this.ignoreTrailingDot)
          list[0] = list[0].replace(/\.+$/, "");
        domains = new Map([["", false], [list[0], true]]);
      }
      else
      {
        let hasIncludes = false;
        for (let i = 0; i < list.length; i++)
        {
          let domain = list[i];
          if (this.ignoreTrailingDot)
            domain = domain.replace(/\.+$/, "");
          if (domain == "")
            continue;

          let include;
          if (domain[0] == "~")
          {
            include = false;
            domain = domain.substr(1);
          }
          else
          {
            include = true;
            hasIncludes = true;
          }

          if (!domains)
            domains = new Map();

          domains.set(domain, include);
        }
        if (domains)
          domains.set("", !hasIncludes);
      }

      this.domainSource = null;
    }

    Object.defineProperty(this, "domains", {value: domains, enumerable: true});
    return this.domains;
  },

  /**
   * Array containing public keys of websites that this filter should apply to
   * @type {?string[]}
   */
  sitekeys: null,

  /**
   * Checks whether this filter is active on a domain.
   * @param {string} [docDomain] domain name of the document that loads the URL
   * @param {string} [sitekey] public key provided by the document
   * @return {boolean} true in case of the filter being active
   */
  isActiveOnDomain(docDomain, sitekey)
  {
    // Sitekeys are case-sensitive so we shouldn't convert them to
    // upper-case to avoid false positives here. Instead we need to
    // change the way filter options are parsed.
    if (this.sitekeys &&
        (!sitekey || this.sitekeys.indexOf(sitekey.toUpperCase()) < 0))
    {
      return false;
    }

    // If no domains are set the rule matches everywhere
    if (!this.domains)
      return true;

    // If the document has no host name, match only if the filter
    // isn't restricted to specific domains
    if (!docDomain)
      return this.domains.get("");

    if (this.ignoreTrailingDot)
      docDomain = docDomain.replace(/\.+$/, "");
    docDomain = docDomain.toUpperCase();

    while (true)
    {
      let isDomainIncluded = this.domains.get(docDomain);
      if (typeof isDomainIncluded != "undefined")
        return isDomainIncluded;

      let nextDot = docDomain.indexOf(".");
      if (nextDot < 0)
        break;
      docDomain = docDomain.substr(nextDot + 1);
    }
    return this.domains.get("");
  },

  /**
   * Checks whether this filter is active only on a domain and its subdomains.
   * @param {string} docDomain
   * @return {boolean}
   */
  isActiveOnlyOnDomain(docDomain)
  {
    if (!docDomain || !this.domains || this.domains.get(""))
      return false;

    if (this.ignoreTrailingDot)
      docDomain = docDomain.replace(/\.+$/, "");
    docDomain = docDomain.toUpperCase();

    for (let [domain, isIncluded] of this.domains)
    {
      if (isIncluded && domain != docDomain)
      {
        if (domain.length <= docDomain.length)
          return false;

        if (!domain.endsWith("." + docDomain))
          return false;
      }
    }

    return true;
  },

  /**
   * Checks whether this filter is generic or specific
   * @return {boolean}
   */
  isGeneric()
  {
    return !(this.sitekeys && this.sitekeys.length) &&
            (!this.domains || this.domains.get(""));
  },

  /**
   * See Filter.serialize()
   * @inheritdoc
   */
  serialize(buffer)
  {
    if (this._disabled || this._hitCount || this._lastHit)
    {
      Filter.prototype.serialize.call(this, buffer);
      if (this._disabled)
        buffer.push("disabled=true");
      if (this._hitCount)
        buffer.push("hitCount=" + this._hitCount);
      if (this._lastHit)
        buffer.push("lastHit=" + this._lastHit);
    }
  }
});

/**
 * Abstract base class for RegExp-based filters
 * @param {string} text see Filter()
 * @param {string} regexpSource
 *   filter part that the regular expression should be build from
 * @param {number} [contentType]
 *   Content types the filter applies to, combination of values from
 *   RegExpFilter.typeMap
 * @param {boolean} [matchCase]
 *   Defines whether the filter should distinguish between lower and upper case
 *   letters
 * @param {string} [domains]
 *   Domains that the filter is restricted to, e.g. "foo.com|bar.com|~baz.com"
 * @param {boolean} [thirdParty]
 *   Defines whether the filter should apply to third-party or first-party
 *   content only
 * @param {string} [sitekeys]
 *   Public keys of websites that this filter should apply to
 * @constructor
 * @augments ActiveFilter
 */
function RegExpFilter(text, regexpSource, contentType, matchCase, domains,
                      thirdParty, sitekeys)
{
  ActiveFilter.call(this, text, domains, sitekeys);

  if (contentType != null)
    this.contentType = contentType;
  if (matchCase)
    this.matchCase = matchCase;
  if (thirdParty != null)
    this.thirdParty = thirdParty;
  if (sitekeys != null)
    this.sitekeySource = sitekeys;

  if (regexpSource.length >= 2 &&
      regexpSource[0] == "/" &&
      regexpSource[regexpSource.length - 1] == "/")
  {
    // The filter is a regular expression - convert it immediately to
    // catch syntax errors
    let regexp = new RegExp(regexpSource.substr(1, regexpSource.length - 2),
                            this.matchCase ? "" : "i");
    Object.defineProperty(this, "regexp", {value: regexp});
  }
  else
  {
    // No need to convert this filter to regular expression yet, do it on demand
    this.regexpSource = regexpSource;
  }
}
exports.RegExpFilter = RegExpFilter;

RegExpFilter.prototype = extend(ActiveFilter, {
  /**
   * @see ActiveFilter.domainSourceIsUpperCase
   */
  domainSourceIsUpperCase: true,

  /**
   * Number of filters contained, will always be 1 (required to
   * optimize Matcher).
   * @type {number}
   */
  length: 1,

  /**
   * @see ActiveFilter.domainSeparator
   */
  domainSeparator: "|",

  /**
   * Expression from which a regular expression should be generated -
   * for delayed creation of the regexp property
   * @type {string}
   */
  regexpSource: null,
  /**
   * Regular expression to be used when testing against this filter
   * @type {RegExp}
   */
  get regexp()
  {
    // Despite this property being cached, the getter is called
    // several times on Safari, due to WebKit bug 132872
    let prop = Object.getOwnPropertyDescriptor(this, "regexp");
    if (prop)
      return prop.value;

    let source = Filter.toRegExp(this.regexpSource);
    let regexp = new RegExp(source, this.matchCase ? "" : "i");
    Object.defineProperty(this, "regexp", {value: regexp});
    delete this.regexpSource;
    return regexp;
  },
  /**
   * Content types the filter applies to, combination of values from
   * RegExpFilter.typeMap
   * @type {number}
   */
  contentType: 0x7FFFFFFF,
  /**
   * Defines whether the filter should distinguish between lower and
   * upper case letters
   * @type {boolean}
   */
  matchCase: false,
  /**
   * Defines whether the filter should apply to third-party or
   * first-party content only. Can be null (apply to all content).
   * @type {?boolean}
   */
  thirdParty: null,

  /**
   * String that the sitekey property should be generated from
   * @type {?string}
   */
  sitekeySource: null,

  /**
   * @see ActiveFilter.sitekeys
   */
  get sitekeys()
  {
    // Despite this property being cached, the getter is called
    // several times on Safari, due to WebKit bug 132872
    let prop = Object.getOwnPropertyDescriptor(this, "sitekeys");
    if (prop)
      return prop.value;

    let sitekeys = null;

    if (this.sitekeySource)
    {
      sitekeys = this.sitekeySource.split("|");
      this.sitekeySource = null;
    }

    Object.defineProperty(
      this, "sitekeys", {value: sitekeys, enumerable: true}
    );
    return this.sitekeys;
  },

  /**
   * Tests whether the URL matches this filter
   * @param {string} location URL to be tested
   * @param {number} typeMask bitmask of content / request types to match
   * @param {string} [docDomain] domain name of the document that loads the URL
   * @param {boolean} [thirdParty] should be true if the URL is a third-party
   *                               request
   * @param {string} [sitekey] public key provided by the document
   * @return {boolean} true in case of a match
   */
  matches(location, typeMask, docDomain, thirdParty, sitekey)
  {
    if (this.contentType & typeMask &&
        (this.thirdParty == null || this.thirdParty == thirdParty) &&
        this.isActiveOnDomain(docDomain, sitekey) && this.regexp.test(location))
    {
      return true;
    }
    return false;
  }
});

// Required to optimize Matcher, see also RegExpFilter.prototype.length
Object.defineProperty(RegExpFilter.prototype, "0", {
  get() { return this; }
});

/**
 * Creates a RegExp filter from its text representation
 * @param {string} text   same as in Filter()
 * @return {Filter}
 */
RegExpFilter.fromText = function(text)
{
  let blocking = true;
  let origText = text;
  if (text.indexOf("@@") == 0)
  {
    blocking = false;
    text = text.substr(2);
  }

  let contentType = null;
  let matchCase = null;
  let domains = null;
  let sitekeys = null;
  let thirdParty = null;
  let collapse = null;
  let csp = null;
  let rewrite = null;
  let options;
  let match = (text.indexOf("$") >= 0 ? Filter.optionsRegExp.exec(text) : null);
  if (match)
  {
    options = match[1].split(",");
    text = match.input.substr(0, match.index);
    for (let option of options)
    {
      let value = null;
      let separatorIndex = option.indexOf("=");
      if (separatorIndex >= 0)
      {
        value = option.substr(separatorIndex + 1);
        option = option.substr(0, separatorIndex);
      }
      option = option.replace(/-/, "_").toUpperCase();
      if (option in RegExpFilter.typeMap)
      {
        if (contentType == null)
          contentType = 0;
        contentType |= RegExpFilter.typeMap[option];

        if (option == "CSP" && value)
          csp = value;
      }
      else if (option[0] == "~" && option.substr(1) in RegExpFilter.typeMap)
      {
        if (contentType == null)
          ({contentType} = RegExpFilter.prototype);
        contentType &= ~RegExpFilter.typeMap[option.substr(1)];
      }
      else if (option == "MATCH_CASE")
        matchCase = true;
      else if (option == "~MATCH_CASE")
        matchCase = false;
      else if (option == "DOMAIN" && value)
        domains = value.toUpperCase();
      else if (option == "THIRD_PARTY")
        thirdParty = true;
      else if (option == "~THIRD_PARTY")
        thirdParty = false;
      else if (option == "COLLAPSE")
        collapse = true;
      else if (option == "~COLLAPSE")
        collapse = false;
      else if (option == "SITEKEY" && value)
        sitekeys = value.toUpperCase();
      else if (option == "REWRITE" && value)
        rewrite = value;
      else
        return new InvalidFilter(origText, "filter_unknown_option");
    }
  }

  // For security reasons, never match $rewrite filters
  // against requests that might load any code to be executed.
  if (rewrite != null)
  {
    if (contentType == null)
      ({contentType} = RegExpFilter.prototype);
    contentType &= ~(RegExpFilter.typeMap.SCRIPT |
                     RegExpFilter.typeMap.SUBDOCUMENT |
                     RegExpFilter.typeMap.OBJECT |
                     RegExpFilter.typeMap.OBJECT_SUBREQUEST);
  }

  try
  {
    if (blocking)
    {
      if (csp && Filter.invalidCSPRegExp.test(csp))
        return new InvalidFilter(origText, "filter_invalid_csp");

      return new BlockingFilter(origText, text, contentType, matchCase, domains,
                                thirdParty, sitekeys, collapse, csp, rewrite);
    }
    return new WhitelistFilter(origText, text, contentType, matchCase, domains,
                               thirdParty, sitekeys);
  }
  catch (e)
  {
    return new InvalidFilter(origText, "filter_invalid_regexp");
  }
};

/**
 * Maps type strings like "SCRIPT" or "OBJECT" to bit masks
 */
RegExpFilter.typeMap = {
  OTHER: 1,
  SCRIPT: 2,
  IMAGE: 4,
  STYLESHEET: 8,
  OBJECT: 16,
  SUBDOCUMENT: 32,
  DOCUMENT: 64,
  WEBSOCKET: 128,
  WEBRTC: 256,
  CSP: 512,
  XBL: 1,
  PING: 1024,
  XMLHTTPREQUEST: 2048,
  OBJECT_SUBREQUEST: 4096,
  DTD: 1,
  MEDIA: 16384,
  FONT: 32768,

  BACKGROUND: 4,    // Backwards compat, same as IMAGE

  POPUP: 0x10000000,
  GENERICBLOCK: 0x20000000,
  ELEMHIDE: 0x40000000,
  GENERICHIDE: 0x80000000
};

// CSP, DOCUMENT, ELEMHIDE, POPUP, GENERICHIDE and GENERICBLOCK options
// shouldn't be there by default
RegExpFilter.prototype.contentType &= ~(RegExpFilter.typeMap.CSP |
                                        RegExpFilter.typeMap.DOCUMENT |
                                        RegExpFilter.typeMap.ELEMHIDE |
                                        RegExpFilter.typeMap.POPUP |
                                        RegExpFilter.typeMap.GENERICHIDE |
                                        RegExpFilter.typeMap.GENERICBLOCK);

/**
 * Class for blocking filters
 * @param {string} text see Filter()
 * @param {string} regexpSource see RegExpFilter()
 * @param {number} [contentType] see RegExpFilter()
 * @param {boolean} [matchCase] see RegExpFilter()
 * @param {string} [domains] see RegExpFilter()
 * @param {boolean} [thirdParty] see RegExpFilter()
 * @param {string} [sitekeys] see RegExpFilter()
 * @param {boolean} [collapse]
 *   defines whether the filter should collapse blocked content, can be null
 * @param {string} [csp]
 *   Content Security Policy to inject when the filter matches
 * @param {?string} [rewrite]
 *   The (optional) rule specifying how to rewrite the URL. See
 *   BlockingFilter.prototype.rewrite.
 * @constructor
 * @augments RegExpFilter
 */
function BlockingFilter(text, regexpSource, contentType, matchCase, domains,
                        thirdParty, sitekeys, collapse, csp, rewrite)
{
  RegExpFilter.call(this, text, regexpSource, contentType, matchCase, domains,
                    thirdParty, sitekeys);

  this.collapse = collapse;
  this.csp = csp;
  this.rewrite = rewrite;
}
exports.BlockingFilter = BlockingFilter;

BlockingFilter.prototype = extend(RegExpFilter, {
  type: "blocking",

  /**
   * Defines whether the filter should collapse blocked content.
   * Can be null (use the global preference).
   * @type {?boolean}
   */
  collapse: null,

  /**
   * Content Security Policy to inject for matching requests.
   * @type {?string}
   */
  csp: null,

  /**
   * The rule specifying how to rewrite the URL.
   * The syntax is similar to the one of String.prototype.replace().
   * @type {?string}
   */
  rewrite: null,

  /**
   * Rewrites an URL.
   * @param {string} url the URL to rewrite
   * @return {string} the rewritten URL, or the original in case of failure
   */
  rewriteUrl(url)
  {
    try
    {
      let rewrittenUrl = new URL(url.replace(this.regexp, this.rewrite), url);
      if (rewrittenUrl.origin == new URL(url).origin)
        return rewrittenUrl.href;
    }
    catch (e)
    {
    }

    return url;
  }
});

/**
 * Class for whitelist filters
 * @param {string} text see Filter()
 * @param {string} regexpSource see RegExpFilter()
 * @param {number} [contentType] see RegExpFilter()
 * @param {boolean} [matchCase] see RegExpFilter()
 * @param {string} [domains] see RegExpFilter()
 * @param {boolean} [thirdParty] see RegExpFilter()
 * @param {string} [sitekeys] see RegExpFilter()
 * @constructor
 * @augments RegExpFilter
 */
function WhitelistFilter(text, regexpSource, contentType, matchCase, domains,
                         thirdParty, sitekeys)
{
  RegExpFilter.call(this, text, regexpSource, contentType, matchCase, domains,
                    thirdParty, sitekeys);
}
exports.WhitelistFilter = WhitelistFilter;

WhitelistFilter.prototype = extend(RegExpFilter, {
  type: "whitelist"
});

/**
 * Base class for element hiding filters
 * @param {string} text see Filter()
 * @param {string} [domains] Host names or domains the filter should be
 *                           restricted to
 * @param {string} selector   CSS selector for the HTML elements that should be
 *                            hidden
 * @constructor
 * @augments ActiveFilter
 */
function ElemHideBase(text, domains, selector)
{
  ActiveFilter.call(this, text, domains || null);

  // Braces are being escaped to prevent CSS rule injection.
  this.selector = selector.replace("{", "\\7B ").replace("}", "\\7D ");
}
exports.ElemHideBase = ElemHideBase;

ElemHideBase.prototype = extend(ActiveFilter, {
  /**
   * @see ActiveFilter.domainSeparator
   */
  domainSeparator: ",",

  /**
   * @see ActiveFilter.ignoreTrailingDot
   */
  ignoreTrailingDot: false,

  /**
   * CSS selector for the HTML elements that should be hidden
   * @type {string}
   */
  selector: null
});

/**
 * Creates an element hiding filter from a pre-parsed text representation
 *
 * @param {string} text         same as in Filter()
 * @param {string} [domains]
 *   domains part of the text representation
 * @param {string} [type]
*    rule type, either empty or @ (exception) or ? (emulation rule)
 * @param {string} selector     raw CSS selector
 * @return {ElemHideFilter|ElemHideException|
 *          ElemHideEmulationFilter|InvalidFilter}
 */
ElemHideBase.fromText = function(text, domains, type, selector)
{
  // We don't allow ElemHide filters which have any empty domains.
  // Note: The ElemHide.prototype.domainSeparator is duplicated here, if that
  // changes this must be changed too.
  if (domains && /(^|,)~?(,|$)/.test(domains))
    return new InvalidFilter(text, "filter_invalid_domain");

  if (type == "@")
    return new ElemHideException(text, domains, selector);

  if (type == "?")
  {
    // Element hiding emulation filters are inefficient so we need to make sure
    // that they're only applied if they specify active domains
    if (!/,[^~][^,.]*\.[^,]/.test("," + domains))
      return new InvalidFilter(text, "filter_elemhideemulation_nodomain");

    return new ElemHideEmulationFilter(text, domains, selector);
  }

  return new ElemHideFilter(text, domains, selector);
};

/**
 * Class for element hiding filters
 * @param {string} text see Filter()
 * @param {string} [domains]  see ElemHideBase()
 * @param {string} selector see ElemHideBase()
 * @constructor
 * @augments ElemHideBase
 */
function ElemHideFilter(text, domains, selector)
{
  ElemHideBase.call(this, text, domains, selector);
}
exports.ElemHideFilter = ElemHideFilter;

ElemHideFilter.prototype = extend(ElemHideBase, {
  type: "elemhide"
});

/**
 * Class for element hiding exceptions
 * @param {string} text see Filter()
 * @param {string} [domains]  see ElemHideBase()
 * @param {string} selector see ElemHideBase()
 * @constructor
 * @augments ElemHideBase
 */
function ElemHideException(text, domains, selector)
{
  ElemHideBase.call(this, text, domains, selector);
}
exports.ElemHideException = ElemHideException;

ElemHideException.prototype = extend(ElemHideBase, {
  type: "elemhideexception"
});

/**
 * Class for element hiding emulation filters
 * @param {string} text           see Filter()
 * @param {string} domains        see ElemHideBase()
 * @param {string} selector       see ElemHideBase()
 * @constructor
 * @augments ElemHideBase
 */
function ElemHideEmulationFilter(text, domains, selector)
{
  ElemHideBase.call(this, text, domains, selector);
}
exports.ElemHideEmulationFilter = ElemHideEmulationFilter;

ElemHideEmulationFilter.prototype = extend(ElemHideBase, {
  type: "elemhideemulation"
});


/***/ }),
/* 1 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";
/*
 * This file is part of Adblock Plus <https://adblockplus.org/>,
 * Copyright (C) 2006-present eyeo GmbH
 *
 * Adblock Plus is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3 as
 * published by the Free Software Foundation.
 *
 * Adblock Plus is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with Adblock Plus.  If not, see <http://www.gnu.org/licenses/>.
 */



/**
 * @fileOverview This component manages listeners and calls them to distributes
 * messages about filter changes.
 */

const {EventEmitter} = __webpack_require__(13);
const {desc} = __webpack_require__(19);

const CATCH_ALL = "__all";

/**
 * @callback FilterNotifierCatchAllListener
 * @param {string} action
 * @param {Subscription|Filter} item
 * @param {...*} additionalInfo
 */

/**
 * This class allows registering and triggering listeners for filter events.
 * @class
 */
exports.FilterNotifier = Object.create(new EventEmitter(), desc({
  /**
   * Adds a listener
   *
   * @deprecated use FilterNotifier.on(action, callback)
   * @param {FilterNotifierCatchAllListener} listener
   */
  addListener(listener)
  {
    let listeners = this._listeners.get(CATCH_ALL);
    if (!listeners || listeners.indexOf(listener) == -1)
      this.on(CATCH_ALL, listener);
  },

  /**
   * Removes a listener that was previosly added via addListener
   *
   * @deprecated use FilterNotifier.off(action, callback)
   * @param {FilterNotifierCatchAllListener} listener
   */
  removeListener(listener)
  {
    this.off(CATCH_ALL, listener);
  },

  /**
   * Notifies listeners about an event
   * @param {string} action event code ("load", "save", "elemhideupdate",
   *                 "subscription.added", "subscription.removed",
   *                 "subscription.disabled", "subscription.title",
   *                 "subscription.lastDownload", "subscription.downloadStatus",
   *                 "subscription.homepage", "subscription.updated",
   *                 "filter.added", "filter.removed", "filter.moved",
   *                 "filter.disabled", "filter.hitCount", "filter.lastHit")
   * @param {Subscription|Filter} item item that the change applies to
   * @param {*} param1
   * @param {*} param2
   * @param {*} param3
   * @deprecated use FilterNotifier.emit(action)
   */
  triggerListeners(action, item, param1, param2, param3)
  {
    this.emit(action, item, param1, param2, param3);
    this.emit(CATCH_ALL, action, item, param1, param2, param3);
  }
}));


/***/ }),
/* 2 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";
/*
 * This file is part of Adblock Plus <https://adblockplus.org/>,
 * Copyright (C) 2006-present eyeo GmbH
 *
 * Adblock Plus is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3 as
 * published by the Free Software Foundation.
 *
 * Adblock Plus is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with Adblock Plus.  If not, see <http://www.gnu.org/licenses/>.
 */

/** @module prefs */



const {EventEmitter} = __webpack_require__(13);

const keyPrefix = "pref:";

let eventEmitter = new EventEmitter();
let overrides = Object.create(null);

/** @lends module:prefs.Prefs */
let defaults = Object.create(null);

/**
 * Only for compatibility with core code. Please do not change!
 *
 * @type {boolean}
 */
defaults.enabled = true;
/**
 * The application version as set during initialization. Used to detect updates.
 *
 * @type {string}
 */
defaults.currentVersion = "";
/**
 * Only for compatibility with core code. Please do not change!
 *
 * @type {string}
 */
defaults.data_directory = "";
/**
 * @see https://adblockplus.org/en/preferences#patternsbackups
 * @type {number}
 */
defaults.patternsbackups = 0;
/**
 * @see https://adblockplus.org/en/preferences#patternsbackupinterval
 * @type {number}
 */
defaults.patternsbackupinterval = 24;
/**
 * Only for compatibility with core code. Please do not change!
 *
 * @type {boolean}
 */
defaults.savestats = false;
/**
 * Only for compatibility with core code. Please do not change!
 *
 * @type {boolean}
 */
defaults.privateBrowsing = false;
/**
 * @see https://adblockplus.org/en/preferences#subscriptions_fallbackerrors
 * @type {number}
 */
defaults.subscriptions_fallbackerrors = 5;
/**
 * @see https://adblockplus.org/en/preferences#subscriptions_fallbackurl
 * @type {string}
 */
defaults.subscriptions_fallbackurl = "https://adblockplus.org/getSubscription?version=%VERSION%&url=%SUBSCRIPTION%&downloadURL=%URL%&error=%ERROR%&channelStatus=%CHANNELSTATUS%&responseStatus=%RESPONSESTATUS%";
/**
 * @see https://adblockplus.org/en/preferences#subscriptions_autoupdate
 * @type {boolean}
 */
defaults.subscriptions_autoupdate = true;
/**
 * @see https://adblockplus.org/en/preferences#subscriptions_exceptionsurl
 * @type {string}
 */
defaults.subscriptions_exceptionsurl = "https://easylist-downloads.adblockplus.org/exceptionrules.txt";
/**
 * @see https://adblockplus.org/en/preferences#subscriptions_exceptionsurl_privacy
 * @type {string}
 */
defaults.subscriptions_exceptionsurl_privacy = "https://easylist-downloads.adblockplus.org/exceptionrules-privacy-friendly.txt";
/**
 * @see https://adblockplus.org/en/preferences#subscriptions_antiadblockurl
 * @type {string}
 */
defaults.subscriptions_antiadblockurl = "https://easylist-downloads.adblockplus.org/antiadblockfilters.txt";
/**
 * @see https://adblockplus.org/en/preferences#documentation_link
 * @type {string}
 */
defaults.documentation_link = "https://adblockplus.org/redirect?link=%LINK%&lang=%LANG%";
/**
 * @see https://adblockplus.org/en/preferences#notificationdata
 * @type {object}
 */
defaults.notificationdata = {};
/**
 * @see https://adblockplus.org/en/preferences#notificationurl
 * @type {string}
 */
defaults.notificationurl = "https://notification.adblockplus.org/notification.json";
/**
 * The total number of requests blocked by the extension.
 *
 * @type {number}
 */
defaults.blocked_total = 0;
/**
 * Whether to show a badge in the toolbar icon indicating the number
 * of blocked ads.
 *
 * @type {boolean}
 */
defaults.show_statsinicon = true;
/**
 * Whether to show the number of blocked ads in the popup.
 *
 * @type {boolean}
 */
defaults.show_statsinpopup = true;
/**
 * Whether to show the "Block element" context menu entry.
 *
 * @type {boolean}
 */
defaults.shouldShowBlockElementMenu = true;
/**
 * Whether to collapse placeholders for blocked elements.
 *
 * @type {boolean}
 */
defaults.hidePlaceholders = true;

/**
 * Whether notification opt-out UI should be shown.
 * @type {boolean}
 */
defaults.notifications_showui = false;

/**
 * Whether to show tracking warning in options page when both
 * Acceptable Ads and subscription of type "Privacy" are enabled.
 *
 * @type {boolean}
 */
defaults.ui_warn_tracking = true;

/**
 * Determines whether data has been cleaned up after upgrading from the legacy
 * extension on Firefox.
 *
 * @type {boolean}
 */
defaults.data_cleanup_done = false;

/**
 * Notification categories to be ignored.
 *
 * @type {string[]}
 */
defaults.notifications_ignoredcategories = [];

/**
 * Whether to show the developer tools panel.
 *
 * @type {boolean}
 */
defaults.show_devtools_panel = true;

/**
 * Whether to suppress the first run and updates page. This preference isn't
 * set by the extension but can be pre-configured externally.
 *
 * @see https://adblockplus.org/development-builds/suppressing-the-first-run-page-on-chrome
 * @type {boolean}
 */
defaults.suppress_first_run_page = false;

/**
 * Additonal subscriptions to be automatically added when the extension is
 * loaded. This preference isn't set by the extension but can be pre-configured
 * externally.
 *
 * @type {string[]}
 */
defaults.additional_subscriptions = [];

/**
 * The version of major updates that the user is aware of. If it's too low,
 * the updates page will be shown to inform the user about intermediate changes.
 *
 * @type {number}
 */
defaults.last_updates_page_displayed = 0;

/**
  * @namespace
  * @static
  */
let Prefs = exports.Prefs = {
  /**
   * Sets the given preference.
   *
   * @param {string} preference
   * @param {any}    value
   * @return {Promise} A promise that resolves when the underlying
                       browser.storage.local.set/remove() operation completes
   */
  set(preference, value)
  {
    let defaultValue = defaults[preference];

    if (typeof value != typeof defaultValue)
      throw new Error("Attempt to change preference type");

    if (value == defaultValue)
    {
      delete overrides[preference];
      return browser.storage.local.remove(prefToKey(preference));
    }

    overrides[preference] = value;
    return (customSave.get(preference) || savePref)(preference);
  },

  /**
   * Adds a callback that is called when the
   * value of a specified preference changed.
   *
   * @param {string}   preference
   * @param {function} callback
   */
  on(preference, callback)
  {
    eventEmitter.on(preference, callback);
  },

  /**
   * Removes a callback for the specified preference.
   *
   * @param {string}   preference
   * @param {function} callback
   */
  off(preference, callback)
  {
    eventEmitter.off(preference, callback);
  },

  /**
   * A promise that is fullfilled when all preferences have been loaded.
   * Wait for this promise to be fulfilled before using preferences during
   * extension initialization.
   *
   * @type {Promise}
   */
  untilLoaded: null
};

function keyToPref(key)
{
  if (key.indexOf(keyPrefix) != 0)
    return null;

  return key.substr(keyPrefix.length);
}

function prefToKey(pref)
{
  return keyPrefix + pref;
}

function savePref(pref)
{
  return browser.storage.local.set({[prefToKey(pref)]: overrides[pref]});
}

let customSave = new Map();
if (__webpack_require__(3).platform == "gecko")
{
  // Saving one storage value causes all others to be saved as well on Gecko.
  // Make sure that updating ad counter doesn't cause the filters data to be
  // saved frequently as a side-effect.
  const MIN_UPDATE_INTERVAL = 60 * 1000;
  let lastUpdate = -MIN_UPDATE_INTERVAL;
  let promise = null;
  customSave.set("blocked_total", pref =>
  {
    if (!promise)
    {
      promise = new Promise((resolve, reject) =>
      {
        setTimeout(
          () =>
          {
            lastUpdate = performance.now();
            promise = null;
            savePref(pref).then(resolve, reject);
          },
          lastUpdate + MIN_UPDATE_INTERVAL - performance.now()
        );
      });
    }
    return promise;
  });
}

function addPreference(pref)
{
  Object.defineProperty(Prefs, pref, {
    get() { return (pref in overrides ? overrides : defaults)[pref]; },
    set(value)
    {
      Prefs.set(pref, value);
    },
    enumerable: true
  });
}

function init()
{
  let prefs = Object.keys(defaults);
  prefs.forEach(addPreference);

  let localLoaded = browser.storage.local.get(prefs.map(prefToKey)).then(
    items =>
    {
      for (let key in items)
        overrides[keyToPref(key)] = items[key];
    }
  );

  let managedLoaded;
  if ("managed" in browser.storage)
  {
    managedLoaded = browser.storage.managed.get(null).then(
      items =>
      {
        for (let key in items)
          defaults[key] = items[key];
      },

      // Opera doesn't support browser.storage.managed, but instead of simply
      // removing the API, it gives an asynchronous error which we ignore here.
      () => {}
    );
  }
  else
  {
    managedLoaded = Promise.resolve();
  }

  function onLoaded()
  {
    browser.storage.onChanged.addListener(changes =>
    {
      for (let key in changes)
      {
        let pref = keyToPref(key);
        if (pref && pref in defaults)
        {
          let change = changes[key];
          if ("newValue" in change && change.newValue != defaults[pref])
            overrides[pref] = change.newValue;
          else
            delete overrides[pref];

          eventEmitter.emit(pref);
        }
      }
    });
  }

  Prefs.untilLoaded = Promise.all([localLoaded, managedLoaded]).then(onLoaded);
}

init();


/***/ }),
/* 3 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */



let platformVersion = null;
let application = null;
let applicationVersion;

let regexp = /(\S+)\/(\S+)(?:\s*\(.*?\))?/g;
let match;

while (match = regexp.exec(navigator.userAgent))
{
  let app = match[1];
  let ver = match[2];

  if (app == "Chrome")
  {
    platformVersion = ver;
  }
  else if (app != "Mozilla" && app != "AppleWebKit" && app != "Safari")
  {
    // For compatibility with legacy websites, Chrome's UA
    // also includes a Mozilla, AppleWebKit and Safari token.
    // Any further name/version pair indicates a fork.
    application = app == "OPR" ? "opera" : app.toLowerCase();
    applicationVersion = ver;
  }
}

// not a Chromium-based UA, probably modifed by the user
if (!platformVersion)
{
  application = "unknown";
  applicationVersion = platformVersion = "0";
}

// no additional name/version, so this is upstream Chrome
if (!application)
{
  application = "chrome";
  applicationVersion = platformVersion;
}


exports.addonName = "adblockforchrome";
exports.addonVersion = "3.32.1";

exports.application = application;
exports.applicationVersion = applicationVersion;

exports.platform = "chromium";
exports.platformVersion = platformVersion;

/***/ }),
/* 4 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";
/*
 * This file is part of Adblock Plus <https://adblockplus.org/>,
 * Copyright (C) 2006-present eyeo GmbH
 *
 * Adblock Plus is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3 as
 * published by the Free Software Foundation.
 *
 * Adblock Plus is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with Adblock Plus.  If not, see <http://www.gnu.org/licenses/>.
 */



/**
 * @fileOverview FilterStorage class responsible for managing user's
 *               subscriptions and filters.
 */

const {IO} = __webpack_require__(31);
const {Prefs} = __webpack_require__(2);
const {Filter, ActiveFilter} = __webpack_require__(0);
const {Subscription, SpecialSubscription,
       ExternalSubscription} = __webpack_require__(5);
const {FilterNotifier} = __webpack_require__(1);

/**
 * Version number of the filter storage file format.
 * @type {number}
 */
let formatVersion = 5;

/**
 * This class reads user's filters from disk, manages them in memory
 * and writes them back.
 * @class
 */
let FilterStorage = exports.FilterStorage =
{
  /**
   * Will be set to true after the initial loadFromDisk() call completes.
   * @type {boolean}
   */
  initialized: false,

  /**
   * Version number of the patterns.ini format used.
   * @type {number}
   */
  get formatVersion()
  {
    return formatVersion;
  },

  /**
   * File containing the filter list
   * @type {string}
   */
  get sourceFile()
  {
    return "patterns.ini";
  },

  /**
   * Will be set to true if no patterns.ini file exists.
   * @type {boolean}
   */
  firstRun: false,

  /**
   * Map of properties listed in the filter storage file before the sections
   * start. Right now this should be only the format version.
   */
  fileProperties: Object.create(null),

  /**
   * List of filter subscriptions containing all filters
   * @type {Subscription[]}
   */
  subscriptions: [],

  /**
   * Map of subscriptions already on the list, by their URL/identifier
   * @type {Object}
   */
  knownSubscriptions: Object.create(null),

  /**
   * Finds the filter group that a filter should be added to by default. Will
   * return null if this group doesn't exist yet.
   * @param {Filter} filter
   * @return {?SpecialSubscription}
   */
  getGroupForFilter(filter)
  {
    let generalSubscription = null;
    for (let subscription of FilterStorage.subscriptions)
    {
      if (subscription instanceof SpecialSubscription && !subscription.disabled)
      {
        // Always prefer specialized subscriptions
        if (subscription.isDefaultFor(filter))
          return subscription;

        // If this is a general subscription - store it as fallback
        if (!generalSubscription &&
            (!subscription.defaults || !subscription.defaults.length))
        {
          generalSubscription = subscription;
        }
      }
    }
    return generalSubscription;
  },

  /**
   * Adds a filter subscription to the list
   * @param {Subscription} subscription filter subscription to be added
   */
  addSubscription(subscription)
  {
    if (subscription.url in FilterStorage.knownSubscriptions)
      return;

    FilterStorage.subscriptions.push(subscription);
    FilterStorage.knownSubscriptions[subscription.url] = subscription;
    addSubscriptionFilters(subscription);

    FilterNotifier.triggerListeners("subscription.added", subscription);
  },

  /**
   * Removes a filter subscription from the list
   * @param {Subscription} subscription filter subscription to be removed
   */
  removeSubscription(subscription)
  {
    for (let i = 0; i < FilterStorage.subscriptions.length; i++)
    {
      if (FilterStorage.subscriptions[i].url == subscription.url)
      {
        removeSubscriptionFilters(subscription);

        FilterStorage.subscriptions.splice(i--, 1);
        delete FilterStorage.knownSubscriptions[subscription.url];
        FilterNotifier.triggerListeners("subscription.removed", subscription);
        return;
      }
    }
  },

  /**
   * Moves a subscription in the list to a new position.
   * @param {Subscription} subscription filter subscription to be moved
   * @param {Subscription} [insertBefore] filter subscription to insert before
   *        (if omitted the subscription will be put at the end of the list)
   */
  moveSubscription(subscription, insertBefore)
  {
    let currentPos = FilterStorage.subscriptions.indexOf(subscription);
    if (currentPos < 0)
      return;

    let newPos = -1;
    if (insertBefore)
      newPos = FilterStorage.subscriptions.indexOf(insertBefore);

    if (newPos < 0)
      newPos = FilterStorage.subscriptions.length;

    if (currentPos < newPos)
      newPos--;
    if (currentPos == newPos)
      return;

    FilterStorage.subscriptions.splice(currentPos, 1);
    FilterStorage.subscriptions.splice(newPos, 0, subscription);
    FilterNotifier.triggerListeners("subscription.moved", subscription);
  },

  /**
   * Replaces the list of filters in a subscription by a new list
   * @param {Subscription} subscription filter subscription to be updated
   * @param {Filter[]} filters new filter list
   */
  updateSubscriptionFilters(subscription, filters)
  {
    removeSubscriptionFilters(subscription);
    subscription.oldFilters = subscription.filters;
    subscription.filters = filters;
    addSubscriptionFilters(subscription);
    FilterNotifier.triggerListeners("subscription.updated", subscription);
    delete subscription.oldFilters;
  },

  /**
   * Adds a user-defined filter to the list
   * @param {Filter} filter
   * @param {SpecialSubscription} [subscription]
   *   particular group that the filter should be added to
   * @param {number} [position]
   *   position within the subscription at which the filter should be added
   */
  addFilter(filter, subscription, position)
  {
    if (!subscription)
    {
      if (filter.subscriptions.some(s => s instanceof SpecialSubscription &&
                                         !s.disabled))
      {
        return;   // No need to add
      }
      subscription = FilterStorage.getGroupForFilter(filter);
    }
    if (!subscription)
    {
      // No group for this filter exists, create one
      subscription = SpecialSubscription.createForFilter(filter);
      this.addSubscription(subscription);
      return;
    }

    if (typeof position == "undefined")
      position = subscription.filters.length;

    if (filter.subscriptions.indexOf(subscription) < 0)
      filter.subscriptions.push(subscription);
    subscription.filters.splice(position, 0, filter);
    FilterNotifier.triggerListeners("filter.added", filter, subscription,
                                    position);
  },

  /**
   * Removes a user-defined filter from the list
   * @param {Filter} filter
   * @param {SpecialSubscription} [subscription] a particular filter group that
   *      the filter should be removed from (if ommited will be removed from all
   *      subscriptions)
   * @param {number} [position]  position inside the filter group at which the
   *      filter should be removed (if ommited all instances will be removed)
   */
  removeFilter(filter, subscription, position)
  {
    let subscriptions = (
      subscription ? [subscription] : filter.subscriptions.slice()
    );
    for (let i = 0; i < subscriptions.length; i++)
    {
      let currentSubscription = subscriptions[i];
      if (currentSubscription instanceof SpecialSubscription)
      {
        let positions = [];
        if (typeof position == "undefined")
        {
          let index = -1;
          do
          {
            index = currentSubscription.filters.indexOf(filter, index + 1);
            if (index >= 0)
              positions.push(index);
          } while (index >= 0);
        }
        else
          positions.push(position);

        for (let j = positions.length - 1; j >= 0; j--)
        {
          let currentPosition = positions[j];
          if (currentSubscription.filters[currentPosition] == filter)
          {
            currentSubscription.filters.splice(currentPosition, 1);
            if (currentSubscription.filters.indexOf(filter) < 0)
            {
              let index = filter.subscriptions.indexOf(currentSubscription);
              if (index >= 0)
                filter.subscriptions.splice(index, 1);
            }
            FilterNotifier.triggerListeners(
              "filter.removed", filter, currentSubscription, currentPosition
            );
          }
        }
      }
    }
  },

  /**
   * Moves a user-defined filter to a new position
   * @param {Filter} filter
   * @param {SpecialSubscription} subscription filter group where the filter is
   *                                           located
   * @param {number} oldPosition current position of the filter
   * @param {number} newPosition new position of the filter
   */
  moveFilter(filter, subscription, oldPosition, newPosition)
  {
    if (!(subscription instanceof SpecialSubscription) ||
        subscription.filters[oldPosition] != filter)
    {
      return;
    }

    newPosition = Math.min(Math.max(newPosition, 0),
                           subscription.filters.length - 1);
    if (oldPosition == newPosition)
      return;

    subscription.filters.splice(oldPosition, 1);
    subscription.filters.splice(newPosition, 0, filter);
    FilterNotifier.triggerListeners("filter.moved", filter, subscription,
                                    oldPosition, newPosition);
  },

  /**
   * Increases the hit count for a filter by one
   * @param {Filter} filter
   */
  increaseHitCount(filter)
  {
    if (!Prefs.savestats || !(filter instanceof ActiveFilter))
      return;

    filter.hitCount++;
    filter.lastHit = Date.now();
  },

  /**
   * Resets hit count for some filters
   * @param {Filter[]} filters  filters to be reset, if null all filters will
   *                            be reset
   */
  resetHitCounts(filters)
  {
    if (!filters)
      filters = Filter.knownFilters.values();
    for (let filter of filters)
    {
      filter.hitCount = 0;
      filter.lastHit = 0;
    }
  },

  /**
   * @callback TextSink
   * @param {string?} line
   */

  /**
   * Allows importing previously serialized filter data.
   * @param {boolean} silent
   *    If true, no "load" notification will be sent out.
   * @return {TextSink}
   *    Function to be called for each line of data. Calling it with null as
   *    parameter finalizes the import and replaces existing data. No changes
   *    will be applied before finalization, so import can be "aborted" by
   *    forgetting this callback.
   */
  importData(silent)
  {
    let parser = new INIParser();
    return line =>
    {
      parser.process(line);
      if (line === null)
      {
        let knownSubscriptions = Object.create(null);
        for (let subscription of parser.subscriptions)
          knownSubscriptions[subscription.url] = subscription;

        this.fileProperties = parser.fileProperties;
        this.subscriptions = parser.subscriptions;
        this.knownSubscriptions = knownSubscriptions;
        Filter.knownFilters = parser.knownFilters;
        Subscription.knownSubscriptions = parser.knownSubscriptions;

        if (!silent)
          FilterNotifier.triggerListeners("load");
      }
    };
  },

  /**
   * Loads all subscriptions from the disk.
   * @return {Promise} promise resolved or rejected when loading is complete
   */
  loadFromDisk()
  {
    let tryBackup = backupIndex =>
    {
      return this.restoreBackup(backupIndex, true).then(() =>
      {
        if (this.subscriptions.length == 0)
          return tryBackup(backupIndex + 1);
      }).catch(error =>
      {
        // Give up
      });
    };

    return IO.statFile(this.sourceFile).then(statData =>
    {
      if (!statData.exists)
      {
        this.firstRun = true;
        return;
      }

      let parser = this.importData(true);
      return IO.readFromFile(this.sourceFile, parser).then(() =>
      {
        parser(null);
        if (this.subscriptions.length == 0)
        {
          // No filter subscriptions in the file, this isn't right.
          throw new Error("No data in the file");
        }
      });
    }).catch(error =>
    {
      Cu.reportError(error);
      return tryBackup(1);
    }).then(() =>
    {
      this.initialized = true;
      FilterNotifier.triggerListeners("load");
    });
  },

  /**
   * Constructs the file name for a patterns.ini backup.
   * @param {number} backupIndex
   *    number of the backup file (1 being the most recent)
   * @return {string} backup file name
   */
  getBackupName(backupIndex)
  {
    let [name, extension] = this.sourceFile.split(".", 2);
    return (name + "-backup" + backupIndex + "." + extension);
  },

  /**
   * Restores an automatically created backup.
   * @param {number} backupIndex
   *    number of the backup to restore (1 being the most recent)
   * @param {boolean} silent
   *    If true, no "load" notification will be sent out.
   * @return {Promise} promise resolved or rejected when restoring is complete
   */
  restoreBackup(backupIndex, silent)
  {
    let backupFile = this.getBackupName(backupIndex);
    let parser = this.importData(silent);
    return IO.readFromFile(backupFile, parser).then(() =>
    {
      parser(null);
      return this.saveToDisk();
    });
  },

  /**
   * Generator serializing filter data and yielding it line by line.
   */
  *exportData()
  {
    // Do not persist external subscriptions
    let subscriptions = this.subscriptions.filter(
      s => !(s instanceof ExternalSubscription)
    );

    yield "# Adblock Plus preferences";
    yield "version=" + formatVersion;

    let saved = new Set();
    let buf = [];

    // Save subscriptions
    for (let subscription of subscriptions)
    {
      yield "";

      subscription.serialize(buf);
      if (subscription.filters.length)
      {
        buf.push("", "[Subscription filters]");
        subscription.serializeFilters(buf);
      }
      for (let line of buf)
        yield line;
      buf.splice(0);
    }

    // Save filter data
    for (let subscription of subscriptions)
    {
      for (let filter of subscription.filters)
      {
        if (!saved.has(filter.text))
        {
          filter.serialize(buf);
          saved.add(filter.text);
          for (let line of buf)
            yield line;
          buf.splice(0);
        }
      }
    }
  },

  /**
   * Will be set to true if saveToDisk() is running (reentrance protection).
   * @type {boolean}
   */
  _saving: false,

  /**
   * Will be set to true if a saveToDisk() call arrives while saveToDisk() is
   * already running (delayed execution).
   * @type {boolean}
   */
  _needsSave: false,

  /**
   * Saves all subscriptions back to disk
   * @return {Promise} promise resolved or rejected when saving is complete
   */
  saveToDisk()
  {
    if (this._saving)
    {
      this._needsSave = true;
      return;
    }

    this._saving = true;

    return Promise.resolve().then(() =>
    {
      // First check whether we need to create a backup
      if (Prefs.patternsbackups <= 0)
        return false;

      return IO.statFile(this.sourceFile).then(statData =>
      {
        if (!statData.exists)
          return false;

        return IO.statFile(this.getBackupName(1)).then(backupStatData =>
        {
          if (backupStatData.exists &&
              (Date.now() - backupStatData.lastModified) / 3600000 <
                Prefs.patternsbackupinterval)
          {
            return false;
          }
          return true;
        });
      });
    }).then(backupRequired =>
    {
      if (!backupRequired)
        return;

      let ignoreErrors = error =>
      {
        // Expected error, backup file doesn't exist.
      };

      let renameBackup = index =>
      {
        if (index > 0)
        {
          return IO.renameFile(this.getBackupName(index),
                               this.getBackupName(index + 1))
                   .catch(ignoreErrors)
                   .then(() => renameBackup(index - 1));
        }

        return IO.renameFile(this.sourceFile, this.getBackupName(1))
                 .catch(ignoreErrors);
      };

      // Rename existing files
      return renameBackup(Prefs.patternsbackups - 1);
    }).catch(error =>
    {
      // Errors during backup creation shouldn't prevent writing filters.
      Cu.reportError(error);
    }).then(() =>
    {
      return IO.writeToFile(this.sourceFile, this.exportData());
    }).then(() =>
    {
      FilterNotifier.triggerListeners("save");
    }).catch(error =>
    {
      // If saving failed, report error but continue - we still have to process
      // flags.
      Cu.reportError(error);
    }).then(() =>
    {
      this._saving = false;
      if (this._needsSave)
      {
        this._needsSave = false;
        this.saveToDisk();
      }
    });
  },

  /**
   * @typedef FileInfo
   * @type {object}
   * @property {number} index
   * @property {number} lastModified
   */

  /**
   * Returns a promise resolving in a list of existing backup files.
   * @return {Promise.<FileInfo[]>}
   */
  getBackupFiles()
  {
    let backups = [];

    let checkBackupFile = index =>
    {
      return IO.statFile(this.getBackupName(index)).then(statData =>
      {
        if (!statData.exists)
          return backups;

        backups.push({
          index,
          lastModified: statData.lastModified
        });
        return checkBackupFile(index + 1);
      }).catch(error =>
      {
        // Something went wrong, return whatever data we got so far.
        Cu.reportError(error);
        return backups;
      });
    };

    return checkBackupFile(1);
  }
};

/**
 * Joins subscription's filters to the subscription without any notifications.
 * @param {Subscription} subscription
 *   filter subscription that should be connected to its filters
 */
function addSubscriptionFilters(subscription)
{
  if (!(subscription.url in FilterStorage.knownSubscriptions))
    return;

  for (let filter of subscription.filters)
    filter.subscriptions.push(subscription);
}

/**
 * Removes subscription's filters from the subscription without any
 * notifications.
 * @param {Subscription} subscription filter subscription to be removed
 */
function removeSubscriptionFilters(subscription)
{
  if (!(subscription.url in FilterStorage.knownSubscriptions))
    return;

  for (let filter of subscription.filters)
  {
    let i = filter.subscriptions.indexOf(subscription);
    if (i >= 0)
      filter.subscriptions.splice(i, 1);
  }
}

/**
 * Listener returned by FilterStorage.importData(), parses filter data.
 * @constructor
 */
function INIParser()
{
  this.fileProperties = this.curObj = {};
  this.subscriptions = [];
  this.knownFilters = new Map();
  this.knownSubscriptions = Object.create(null);
}
INIParser.prototype =
{
  linesProcessed: 0,
  subscriptions: null,
  knownFilters: null,
  knownSubscriptions: null,
  wantObj: true,
  fileProperties: null,
  curObj: null,
  curSection: null,

  process(val)
  {
    let origKnownFilters = Filter.knownFilters;
    Filter.knownFilters = this.knownFilters;
    let origKnownSubscriptions = Subscription.knownSubscriptions;
    Subscription.knownSubscriptions = this.knownSubscriptions;
    let match;
    try
    {
      if (this.wantObj === true && (match = /^(\w+)=(.*)$/.exec(val)))
        this.curObj[match[1]] = match[2];
      else if (val === null || (match = /^\s*\[(.+)\]\s*$/.exec(val)))
      {
        if (this.curObj)
        {
          // Process current object before going to next section
          switch (this.curSection)
          {
            case "filter":
              if ("text" in this.curObj)
                Filter.fromObject(this.curObj);
              break;
            case "subscription": {
              let subscription = Subscription.fromObject(this.curObj);
              if (subscription)
                this.subscriptions.push(subscription);
              break;
            }
            case "subscription filters":
              if (this.subscriptions.length)
              {
                let subscription = this.subscriptions[
                  this.subscriptions.length - 1
                ];
                for (let text of this.curObj)
                {
                  let filter = Filter.fromText(text);
                  subscription.filters.push(filter);
                  filter.subscriptions.push(subscription);
                }
              }
              break;
          }
        }

        if (val === null)
          return;

        this.curSection = match[1].toLowerCase();
        switch (this.curSection)
        {
          case "filter":
          case "subscription":
            this.wantObj = true;
            this.curObj = {};
            break;
          case "subscription filters":
            this.wantObj = false;
            this.curObj = [];
            break;
          default:
            this.wantObj = undefined;
            this.curObj = null;
        }
      }
      else if (this.wantObj === false && val)
        this.curObj.push(val.replace(/\\\[/g, "["));
    }
    finally
    {
      Filter.knownFilters = origKnownFilters;
      Subscription.knownSubscriptions = origKnownSubscriptions;
    }
  }
};


/***/ }),
/* 5 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";
/*
 * This file is part of Adblock Plus <https://adblockplus.org/>,
 * Copyright (C) 2006-present eyeo GmbH
 *
 * Adblock Plus is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3 as
 * published by the Free Software Foundation.
 *
 * Adblock Plus is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with Adblock Plus.  If not, see <http://www.gnu.org/licenses/>.
 */



/**
 * @fileOverview Definition of Subscription class and its subclasses.
 */

const {ActiveFilter, BlockingFilter,
       WhitelistFilter, ElemHideBase} = __webpack_require__(0);
const {FilterNotifier} = __webpack_require__(1);
const {desc, extend} = __webpack_require__(19);

/**
 * Abstract base class for filter subscriptions
 *
 * @param {string} url    download location of the subscription
 * @param {string} [title]  title of the filter subscription
 * @constructor
 */
function Subscription(url, title)
{
  this.url = url;
  this.filters = [];
  if (title)
    this._title = title;
  Subscription.knownSubscriptions[url] = this;
}
exports.Subscription = Subscription;

Subscription.prototype =
{
  /**
   * Download location of the subscription
   * @type {string}
   */
  url: null,

  /**
   * Filters contained in the filter subscription
   * @type {Filter[]}
   */
  filters: null,

  _title: null,
  _fixedTitle: false,
  _disabled: false,

  /**
   * Title of the filter subscription
   * @type {string}
   */
  get title()
  {
    return this._title;
  },
  set title(value)
  {
    if (value != this._title)
    {
      let oldValue = this._title;
      this._title = value;
      FilterNotifier.triggerListeners("subscription.title",
                                      this, value, oldValue);
    }
    return this._title;
  },

  /**
   * Determines whether the title should be editable
   * @type {boolean}
   */
  get fixedTitle()
  {
    return this._fixedTitle;
  },
  set fixedTitle(value)
  {
    if (value != this._fixedTitle)
    {
      let oldValue = this._fixedTitle;
      this._fixedTitle = value;
      FilterNotifier.triggerListeners("subscription.fixedTitle",
                                      this, value, oldValue);
    }
    return this._fixedTitle;
  },

  /**
   * Defines whether the filters in the subscription should be disabled
   * @type {boolean}
   */
  get disabled()
  {
    return this._disabled;
  },
  set disabled(value)
  {
    if (value != this._disabled)
    {
      let oldValue = this._disabled;
      this._disabled = value;
      FilterNotifier.triggerListeners("subscription.disabled",
                                      this, value, oldValue);
    }
    return this._disabled;
  },

  /**
   * Serializes the subscription to an array of strings for writing
   * out on the disk.
   * @param {string[]} buffer  buffer to push the serialization results into
   */
  serialize(buffer)
  {
    buffer.push("[Subscription]");
    buffer.push("url=" + this.url);
    if (this._title)
      buffer.push("title=" + this._title);
    if (this._fixedTitle)
      buffer.push("fixedTitle=true");
    if (this._disabled)
      buffer.push("disabled=true");
  },

  serializeFilters(buffer)
  {
    for (let filter of this.filters)
      buffer.push(filter.text.replace(/\[/g, "\\["));
  },

  toString()
  {
    let buffer = [];
    this.serialize(buffer);
    return buffer.join("\n");
  }
};

/**
 * Cache for known filter subscriptions, maps URL to subscription objects.
 * @type {Object}
 */
Subscription.knownSubscriptions = Object.create(null);

/**
 * Returns a subscription from its URL, creates a new one if necessary.
 * @param {string} url
 *   URL of the subscription
 * @return {Subscription}
 *   subscription or null if the subscription couldn't be created
 */
Subscription.fromURL = function(url)
{
  if (url in Subscription.knownSubscriptions)
    return Subscription.knownSubscriptions[url];

  if (url[0] != "~")
    return new DownloadableSubscription(url, null);
  return new SpecialSubscription(url);
};

/**
 * Deserializes a subscription
 *
 * @param {Object}  obj
 *   map of serialized properties and their values
 * @return {Subscription}
 *   subscription or null if the subscription couldn't be created
 */
Subscription.fromObject = function(obj)
{
  let result;
  if (obj.url[0] != "~")
  {
    // URL is valid - this is a downloadable subscription
    result = new DownloadableSubscription(obj.url, obj.title);
    if ("downloadStatus" in obj)
      result._downloadStatus = obj.downloadStatus;
    if ("lastSuccess" in obj)
      result.lastSuccess = parseInt(obj.lastSuccess, 10) || 0;
    if ("lastCheck" in obj)
      result._lastCheck = parseInt(obj.lastCheck, 10) || 0;
    if ("expires" in obj)
      result.expires = parseInt(obj.expires, 10) || 0;
    if ("softExpiration" in obj)
      result.softExpiration = parseInt(obj.softExpiration, 10) || 0;
    if ("errors" in obj)
      result._errors = parseInt(obj.errors, 10) || 0;
    if ("version" in obj)
      result.version = parseInt(obj.version, 10) || 0;
    if ("requiredVersion" in obj)
      result.requiredVersion = obj.requiredVersion;
    if ("homepage" in obj)
      result._homepage = obj.homepage;
    if ("lastDownload" in obj)
      result._lastDownload = parseInt(obj.lastDownload, 10) || 0;
    if ("downloadCount" in obj)
      result.downloadCount = parseInt(obj.downloadCount, 10) || 0;
  }
  else
  {
    result = new SpecialSubscription(obj.url, obj.title);
    if ("defaults" in obj)
      result.defaults = obj.defaults.split(" ");
  }
  if ("fixedTitle" in obj)
    result._fixedTitle = (obj.fixedTitle == "true");
  if ("disabled" in obj)
    result._disabled = (obj.disabled == "true");

  return result;
};

/**
 * Class for special filter subscriptions (user's filters)
 * @param {string} url see Subscription()
 * @param {string} [title]  see Subscription()
 * @constructor
 * @augments Subscription
 */
function SpecialSubscription(url, title)
{
  Subscription.call(this, url, title);
}
exports.SpecialSubscription = SpecialSubscription;

SpecialSubscription.prototype = extend(Subscription, {
  /**
   * Filter types that should be added to this subscription by default
   * (entries should correspond to keys in SpecialSubscription.defaultsMap).
   * @type {string[]}
   */
  defaults: null,

  /**
   * Tests whether a filter should be added to this group by default
   * @param {Filter} filter filter to be tested
   * @return {boolean}
   */
  isDefaultFor(filter)
  {
    if (this.defaults && this.defaults.length)
    {
      for (let type of this.defaults)
      {
        if (filter instanceof SpecialSubscription.defaultsMap[type])
          return true;
        if (!(filter instanceof ActiveFilter) && type == "blacklist")
          return true;
      }
    }

    return false;
  },

  /**
   * See Subscription.serialize()
   * @inheritdoc
   */
  serialize(buffer)
  {
    Subscription.prototype.serialize.call(this, buffer);
    if (this.defaults && this.defaults.length)
    {
      buffer.push("defaults=" +
        this.defaults.filter(
          type => type in SpecialSubscription.defaultsMap
        ).join(" ")
      );
    }
    if (this._lastDownload)
      buffer.push("lastDownload=" + this._lastDownload);
  }
});

SpecialSubscription.defaultsMap = Object.create(null, desc({
  whitelist: WhitelistFilter,
  blocking: BlockingFilter,
  elemhide: ElemHideBase
}));

/**
 * Creates a new user-defined filter group.
 * @param {string} [title]  title of the new filter group
 * @return {SpecialSubscription}
 */
SpecialSubscription.create = function(title)
{
  let url;
  do
  {
    url = "~user~" + Math.round(Math.random() * 1000000);
  } while (url in Subscription.knownSubscriptions);
  return new SpecialSubscription(url, title);
};

/**
 * Creates a new user-defined filter group and adds the given filter to it.
 * This group will act as the default group for this filter type.
 * @param {Filter} filter
 * @return {SpecialSubscription}
 */
SpecialSubscription.createForFilter = function(filter)
{
  let subscription = SpecialSubscription.create();
  subscription.filters.push(filter);
  for (let type in SpecialSubscription.defaultsMap)
  {
    if (filter instanceof SpecialSubscription.defaultsMap[type])
      subscription.defaults = [type];
  }
  if (!subscription.defaults)
    subscription.defaults = ["blocking"];
  return subscription;
};

/**
 * Abstract base class for regular filter subscriptions (both
 * internally and externally updated)
 * @param {string} url    see Subscription()
 * @param {string} [title]  see Subscription()
 * @constructor
 * @augments Subscription
 */
function RegularSubscription(url, title)
{
  Subscription.call(this, url, title || url);
}
exports.RegularSubscription = RegularSubscription;

RegularSubscription.prototype = extend(Subscription, {
  _homepage: null,
  _lastDownload: 0,

  /**
   * Filter subscription homepage if known
   * @type {string}
   */
  get homepage()
  {
    return this._homepage;
  },
  set homepage(value)
  {
    if (value != this._homepage)
    {
      let oldValue = this._homepage;
      this._homepage = value;
      FilterNotifier.triggerListeners("subscription.homepage",
                                      this, value, oldValue);
    }
    return this._homepage;
  },

  /**
   * Time of the last subscription download (in seconds since the
   * beginning of the epoch)
   * @type {number}
   */
  get lastDownload()
  {
    return this._lastDownload;
  },
  set lastDownload(value)
  {
    if (value != this._lastDownload)
    {
      let oldValue = this._lastDownload;
      this._lastDownload = value;
      FilterNotifier.triggerListeners("subscription.lastDownload",
                                      this, value, oldValue);
    }
    return this._lastDownload;
  },

  /**
   * See Subscription.serialize()
   * @inheritdoc
   */
  serialize(buffer)
  {
    Subscription.prototype.serialize.call(this, buffer);
    if (this._homepage)
      buffer.push("homepage=" + this._homepage);
    if (this._lastDownload)
      buffer.push("lastDownload=" + this._lastDownload);
  }
});

/**
 * Class for filter subscriptions updated externally (by other extension)
 * @param {string} url    see Subscription()
 * @param {string} [title]  see Subscription()
 * @constructor
 * @augments RegularSubscription
 */
function ExternalSubscription(url, title)
{
  RegularSubscription.call(this, url, title);
}
exports.ExternalSubscription = ExternalSubscription;

ExternalSubscription.prototype = extend(RegularSubscription, {
  /**
   * See Subscription.serialize()
   * @inheritdoc
   */
  serialize(buffer)
  {
    throw new Error(
      "Unexpected call, external subscriptions should not be serialized"
    );
  }
});

/**
 * Class for filter subscriptions updated externally (by other extension)
 * @param {string} url  see Subscription()
 * @param {string} [title]  see Subscription()
 * @constructor
 * @augments RegularSubscription
 */
function DownloadableSubscription(url, title)
{
  RegularSubscription.call(this, url, title);
}
exports.DownloadableSubscription = DownloadableSubscription;

DownloadableSubscription.prototype = extend(RegularSubscription, {
  _downloadStatus: null,
  _lastCheck: 0,
  _errors: 0,

  /**
   * Status of the last download (ID of a string)
   * @type {string}
   */
  get downloadStatus()
  {
    return this._downloadStatus;
  },
  set downloadStatus(value)
  {
    let oldValue = this._downloadStatus;
    this._downloadStatus = value;
    FilterNotifier.triggerListeners("subscription.downloadStatus",
                                    this, value, oldValue);
    return this._downloadStatus;
  },

  /**
   * Time of the last successful download (in seconds since the beginning of the
   * epoch).
   */
  lastSuccess: 0,

  /**
   * Time when the subscription was considered for an update last time
   * (in seconds since the beginning of the epoch). This will be used
   * to increase softExpiration if the user doesn't use Adblock Plus
   * for some time.
   * @type {number}
   */
  get lastCheck()
  {
    return this._lastCheck;
  },
  set lastCheck(value)
  {
    if (value != this._lastCheck)
    {
      let oldValue = this._lastCheck;
      this._lastCheck = value;
      FilterNotifier.triggerListeners("subscription.lastCheck",
                                      this, value, oldValue);
    }
    return this._lastCheck;
  },

  /**
   * Hard expiration time of the filter subscription (in seconds since
   * the beginning of the epoch)
   * @type {number}
   */
  expires: 0,

  /**
   * Soft expiration time of the filter subscription (in seconds since
   * the beginning of the epoch)
   * @type {number}
   */
  softExpiration: 0,

  /**
   * Number of download failures since last success
   * @type {number}
   */
  get errors()
  {
    return this._errors;
  },
  set errors(value)
  {
    if (value != this._errors)
    {
      let oldValue = this._errors;
      this._errors = value;
      FilterNotifier.triggerListeners("subscription.errors", this,
                                      value, oldValue);
    }
    return this._errors;
  },

  /**
   * Version of the subscription data retrieved on last successful download
   * @type {number}
   */
  version: 0,

  /**
   * Minimal Adblock Plus version required for this subscription
   * @type {string}
   */
  requiredVersion: null,

  /**
   * Number indicating how often the object was downloaded.
   * @type {number}
   */
  downloadCount: 0,

  /**
   * See Subscription.serialize()
   * @inheritdoc
   */
  serialize(buffer)
  {
    RegularSubscription.prototype.serialize.call(this, buffer);
    if (this.downloadStatus)
      buffer.push("downloadStatus=" + this.downloadStatus);
    if (this.lastSuccess)
      buffer.push("lastSuccess=" + this.lastSuccess);
    if (this.lastCheck)
      buffer.push("lastCheck=" + this.lastCheck);
    if (this.expires)
      buffer.push("expires=" + this.expires);
    if (this.softExpiration)
      buffer.push("softExpiration=" + this.softExpiration);
    if (this.errors)
      buffer.push("errors=" + this.errors);
    if (this.version)
      buffer.push("version=" + this.version);
    if (this.requiredVersion)
      buffer.push("requiredVersion=" + this.requiredVersion);
    if (this.downloadCount)
      buffer.push("downloadCount=" + this.downloadCount);
  }
});


/***/ }),
/* 6 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";
/*
 * This file is part of Adblock Plus <https://adblockplus.org/>,
 * Copyright (C) 2006-present eyeo GmbH
 *
 * Adblock Plus is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3 as
 * published by the Free Software Foundation.
 *
 * Adblock Plus is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with Adblock Plus.  If not, see <http://www.gnu.org/licenses/>.
 */

/** @module url */



const {getDomain} = __webpack_require__(34);

/**
 * Gets the IDN-decoded hostname from the URL of a frame.
 * If the URL don't have host information (like "about:blank"
 * and "data:" URLs) it falls back to the parent frame.
 *
 * @param {?Frame}  frame
 * @param {URL}    [originUrl]
 * @return {string}
 */
exports.extractHostFromFrame = (frame, originUrl) =>
{
  for (; frame; frame = frame.parent)
  {
    let hostname = frame.url.hostname;
    if (hostname)
      return hostname;
  }

  return originUrl ? originUrl.hostname : "";
};

function isDomain(hostname)
{
  // No hostname or IPv4 address, also considering hexadecimal octets.
  if (/^((0x[\da-f]+|\d+)(\.|$))*$/i.test(hostname))
    return false;

  // IPv6 address. Since there can't be colons in domains, we can
  // just check whether there are any colons to exclude IPv6 addresses.
  return hostname.indexOf(":") == -1;
}

/**
 * Checks whether the request's origin is different from the document's origin.
 *
 * @param {URL}    url           The request URL
 * @param {string} documentHost  The IDN-decoded hostname of the document
 * @return {Boolean}
 */
exports.isThirdParty = (url, documentHost) =>
{
  let requestHost = url.hostname.replace(/\.+$/, "");
  documentHost = documentHost.replace(/\.+$/, "");

  if (requestHost == documentHost)
    return false;

  if (!isDomain(requestHost) || !isDomain(documentHost))
    return true;

  return getDomain(requestHost) != getDomain(documentHost);
};


/***/ }),
/* 7 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";
/*
 * This file is part of Adblock Plus <https://adblockplus.org/>,
 * Copyright (C) 2006-present eyeo GmbH
 *
 * Adblock Plus is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3 as
 * published by the Free Software Foundation.
 *
 * Adblock Plus is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with Adblock Plus.  If not, see <http://www.gnu.org/licenses/>.
 */

/** @module messaging */



const {EventEmitter} = __webpack_require__(13);

/**
 * Communication port wrapping ext.onMessage to receive messages.
 *
 * @constructor
 */
function Port()
{
  this._eventEmitter = new EventEmitter();
  this._onMessage = this._onMessage.bind(this);
  ext.onMessage.addListener(this._onMessage);
}

Port.prototype = {
  _onMessage(message, sender, sendResponse)
  {
    let async = false;
    let callbacks = this._eventEmitter.listeners(message.type);

    for (let callback of callbacks)
    {
      let response = callback(message, sender);

      if (response && typeof response.then == "function")
      {
        response.then(
          sendResponse,
          reason =>
          {
            console.error(reason);
            sendResponse(undefined);
          }
        );
        async = true;
      }
      else if (typeof response != "undefined")
      {
        sendResponse(response);
      }
    }

    return async;
  },

  /**
   * Function to be called when a particular message is received.
   *
   * @callback Port~messageCallback
   * @param {object} message
   * @param {object} sender
   * @return The callback can return undefined (no response),
   *         a value (response to be sent to sender immediately)
   *         or a promise (asynchronous response).
   */

  /**
   * Adds a callback for the specified message.
   *
   * The return value of the callback (if not undefined) is sent as response.
   * @param {string}   name
   * @param {Port~messageCallback} callback
   */
  on(name, callback)
  {
    this._eventEmitter.on(name, callback);
  },

  /**
   * Removes a callback for the specified message.
   *
   * @param {string}   name
   * @param {Port~messageCallback} callback
   */
  off(name, callback)
  {
    this._eventEmitter.off(name, callback);
  },

  /**
   * Disables the port and makes it stop listening to incoming messages.
   */
  disconnect()
  {
    ext.onMessage.removeListener(this._onMessage);
  }
};

/**
 * The default port to receive messages.
 *
 * @type {Port}
 */
exports.port = new Port();

/**
 * Creates a new port that is disconnected when the given window is unloaded.
 *
 * @param {Window} window
 * @return {Port}
 */
exports.getPort = function(window)
{
  let port = new Port();
  window.addEventListener("unload", () =>
  {
    port.disconnect();
  });
  return port;
};



/***/ }),
/* 8 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";
/*
 * This file is part of Adblock Plus <https://adblockplus.org/>,
 * Copyright (C) 2006-present eyeo GmbH
 *
 * Adblock Plus is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3 as
 * published by the Free Software Foundation.
 *
 * Adblock Plus is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with Adblock Plus.  If not, see <http://www.gnu.org/licenses/>.
 */

/** @module whitelisting */



const {defaultMatcher} = __webpack_require__(9);
const {Filter, RegExpFilter} = __webpack_require__(0);
const {FilterNotifier} = __webpack_require__(1);
const {FilterStorage} = __webpack_require__(4);
const {extractHostFromFrame, isThirdParty} = __webpack_require__(6);
const {port} = __webpack_require__(7);
const {logWhitelistedDocument} = __webpack_require__(11);
const {verifySignature} = __webpack_require__(35);

let sitekeys = new ext.PageMap();

function match(page, url, typeMask, docDomain, sitekey)
{
  let thirdParty = !!docDomain && isThirdParty(url, docDomain);

  if (!docDomain)
    docDomain = url.hostname;

  let filter = defaultMatcher.whitelist.matchesAny(
    url.href, typeMask, docDomain, thirdParty, sitekey
  );

  if (filter && page)
    logWhitelistedDocument(page.id, url.href, typeMask, docDomain, filter);

  return filter;
}

let checkWhitelisted =
/**
 * Gets the active whitelisting filter for the document associated
 * with the given page/frame, or null if it's not whitelisted.
 *
 * @param {?Page}   page
 * @param {?Frame} [frame]
 * @param {?URL}   [originUrl]
 * @param {number} [typeMask=RegExpFilter.typeMap.DOCUMENT]
 * @return {?WhitelistFilter}
 */
exports.checkWhitelisted = (page, frame, originUrl,
                            typeMask = RegExpFilter.typeMap.DOCUMENT) =>
{
  if (frame || originUrl)
  {
    while (frame)
    {
      let parentFrame = frame.parent;
      let filter = match(page, frame.url, typeMask,
                         extractHostFromFrame(parentFrame, originUrl),
                         getKey(page, frame, originUrl));

      if (filter)
        return filter;

      frame = parentFrame;
    }

    return originUrl && match(page, originUrl, typeMask, null,
                              getKey(null, null, originUrl));
  }

  return page && match(page, page.url, typeMask);
};

port.on("filters.isWhitelisted", message =>
{
  return !!checkWhitelisted(new ext.Page(message.tab));
});

port.on("filters.whitelist", message =>
{
  let page = new ext.Page(message.tab);
  let host = page.url.hostname.replace(/^www\./, "");
  let filter = Filter.fromText("@@||" + host + "^$document");
  if (filter.subscriptions.length && filter.disabled)
  {
    filter.disabled = false;
  }
  else
  {
    filter.disabled = false;
    FilterStorage.addFilter(filter);
  }
});

port.on("filters.unwhitelist", message =>
{
  let page = new ext.Page(message.tab);
  // Remove any exception rules applying to this URL
  let filter = checkWhitelisted(page);
  while (filter)
  {
    FilterStorage.removeFilter(filter);
    if (filter.subscriptions.length)
      filter.disabled = true;
    filter = checkWhitelisted(page);
  }
});

function revalidateWhitelistingState(page)
{
  FilterNotifier.emit(
    "page.WhitelistingStateRevalidate",
    page, checkWhitelisted(page)
  );
}

FilterNotifier.on("filter.behaviorChanged", () =>
{
  browser.tabs.query({}, tabs =>
  {
    for (let tab of tabs)
      revalidateWhitelistingState(new ext.Page(tab));
  });
});

ext.pages.onLoading.addListener(revalidateWhitelistingState);

let getKey =
/**
 * Gets the public key, previously recorded for the given page
 * and frame, to be considered for the $sitekey filter option.
 *
 * @param {?Page}   page
 * @param {?Frame}  frame
 * @param {URL}    [originUrl]
 * @return {string}
 */
exports.getKey = (page, frame, originUrl) =>
{
  if (page)
  {
    let keys = sitekeys.get(page);
    if (keys)
    {
      for (; frame; frame = frame.parent)
      {
        let key = keys.get(frame.url.href);
        if (key)
          return key;
      }
    }
  }

  if (originUrl)
  {
    for (let keys of sitekeys._map.values())
    {
      let key = keys.get(originUrl.href);
      if (key)
        return key;
    }
  }

  return null;
};

function checkKey(token, url)
{
  let parts = token.split("_");
  if (parts.length < 2)
    return false;

  let key = parts[0].replace(/=/g, "");
  let signature = parts[1];
  let data = url.pathname + url.search + "\0" +
             url.host + "\0" +
             window.navigator.userAgent;
  if (!verifySignature(key, signature, data))
    return false;

  return key;
}

function recordKey(key, page, url)
{
  let keys = sitekeys.get(page);
  if (!keys)
  {
    keys = new Map();
    sitekeys.set(page, keys);
  }
  keys.set(url.href, key);
}

port.on("filters.addKey", (message, sender) =>
{
  let key = checkKey(message.token, sender.frame.url);
  if (key)
    recordKey(key, sender.page, sender.frame.url);
});

function onHeadersReceived(details)
{
  let page = new ext.Page({id: details.tabId});

  for (let header of details.responseHeaders)
  {
    if (header.name.toLowerCase() == "x-adblock-key" && header.value)
    {
      let url = new URL(details.url);
      let key = checkKey(header.value, url);
      if (key)
      {
        recordKey(key, page, url);
        break;
      }
    }
  }
}

if (typeof browser == "object")
{
  browser.webRequest.onHeadersReceived.addListener(
    onHeadersReceived,
    {
      urls: ["http://*/*", "https://*/*"],
      types: ["main_frame", "sub_frame"]
    },
    ["responseHeaders"]
  );
}


/***/ }),
/* 9 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";
/*
 * This file is part of Adblock Plus <https://adblockplus.org/>,
 * Copyright (C) 2006-present eyeo GmbH
 *
 * Adblock Plus is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3 as
 * published by the Free Software Foundation.
 *
 * Adblock Plus is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with Adblock Plus.  If not, see <http://www.gnu.org/licenses/>.
 */



/**
 * @fileOverview Matcher class implementing matching addresses against
 *               a list of filters.
 */

const {Filter, WhitelistFilter} = __webpack_require__(0);

/**
 * Blacklist/whitelist filter matching
 * @constructor
 */
function Matcher()
{
  this.clear();
}
exports.Matcher = Matcher;

Matcher.prototype = {
  /**
   * Lookup table for filters by their associated keyword
   * @type {Map.<string,(Filter|Filter[])>}
   */
  filterByKeyword: null,

  /**
   * Lookup table for keywords by the filter
   * @type {Map.<Filter,string>}
   */
  keywordByFilter: null,

  /**
   * Removes all known filters
   */
  clear()
  {
    this.filterByKeyword = new Map();
    this.keywordByFilter = new Map();
  },

  /**
   * Adds a filter to the matcher
   * @param {RegExpFilter} filter
   */
  add(filter)
  {
    if (this.keywordByFilter.has(filter))
      return;

    // Look for a suitable keyword
    let keyword = this.findKeyword(filter);
    let oldEntry = this.filterByKeyword.get(keyword);
    if (typeof oldEntry == "undefined")
      this.filterByKeyword.set(keyword, filter);
    else if (oldEntry.length == 1)
      this.filterByKeyword.set(keyword, [oldEntry, filter]);
    else
      oldEntry.push(filter);
    this.keywordByFilter.set(filter, keyword);
  },

  /**
   * Removes a filter from the matcher
   * @param {RegExpFilter} filter
   */
  remove(filter)
  {
    let keyword = this.keywordByFilter.get(filter);
    if (typeof keyword == "undefined")
      return;

    let list = this.filterByKeyword.get(keyword);
    if (list.length <= 1)
      this.filterByKeyword.delete(keyword);
    else
    {
      let index = list.indexOf(filter);
      if (index >= 0)
      {
        list.splice(index, 1);
        if (list.length == 1)
          this.filterByKeyword.set(keyword, list[0]);
      }
    }

    this.keywordByFilter.delete(filter);
  },

  /**
   * Chooses a keyword to be associated with the filter
   * @param {Filter} filter
   * @return {string} keyword or an empty string if no keyword could be found
   */
  findKeyword(filter)
  {
    let result = "";
    let {text} = filter;
    if (Filter.regexpRegExp.test(text))
      return result;

    // Remove options
    let match = Filter.optionsRegExp.exec(text);
    if (match)
      text = match.input.substr(0, match.index);

    // Remove whitelist marker
    if (text[0] == "@" && text[1] == "@")
      text = text.substr(2);

    let candidates = text.toLowerCase().match(
      /[^a-z0-9%*][a-z0-9%]{3,}(?=[^a-z0-9%*])/g
    );
    if (!candidates)
      return result;

    let hash = this.filterByKeyword;
    let resultCount = 0xFFFFFF;
    let resultLength = 0;
    for (let i = 0, l = candidates.length; i < l; i++)
    {
      let candidate = candidates[i].substr(1);
      let filters = hash.get(candidate);
      let count = typeof filters != "undefined" ? filters.length : 0;
      if (count < resultCount ||
          (count == resultCount && candidate.length > resultLength))
      {
        result = candidate;
        resultCount = count;
        resultLength = candidate.length;
      }
    }
    return result;
  },

  /**
   * Checks whether a particular filter is being matched against.
   * @param {RegExpFilter} filter
   * @return {boolean}
   */
  hasFilter(filter)
  {
    return this.keywordByFilter.has(filter);
  },

  /**
   * Returns the keyword used for a filter, null for unknown filters.
   * @param {RegExpFilter} filter
   * @return {?string}
   */
  getKeywordForFilter(filter)
  {
    let keyword = this.keywordByFilter.get(filter);
    return typeof keyword != "undefined" ? keyword : null;
  },

  /**
   * Checks whether the entries for a particular keyword match a URL
   * @param {string} keyword
   * @param {string} location
   * @param {number} typeMask
   * @param {string} docDomain
   * @param {boolean} thirdParty
   * @param {string} sitekey
   * @param {boolean} specificOnly
   * @return {?Filter}
   */
  _checkEntryMatch(keyword, location, typeMask, docDomain, thirdParty, sitekey,
                   specificOnly)
  {
    let list = this.filterByKeyword.get(keyword);
    if (typeof list == "undefined")
      return null;
    for (let i = 0; i < list.length; i++)
    {
      let filter = list[i];

      if (specificOnly && filter.isGeneric() &&
          !(filter instanceof WhitelistFilter))
        continue;

      if (filter.matches(location, typeMask, docDomain, thirdParty, sitekey))
        return filter;
    }
    return null;
  },

  /**
   * Tests whether the URL matches any of the known filters
   * @param {string} location
   *   URL to be tested
   * @param {number} typeMask
   *   bitmask of content / request types to match
   * @param {string} docDomain
   *   domain name of the document that loads the URL
   * @param {boolean} thirdParty
   *   should be true if the URL is a third-party request
   * @param {string} sitekey
   *   public key provided by the document
   * @param {boolean} specificOnly
   *   should be true if generic matches should be ignored
   * @return {?RegExpFilter}
   *   matching filter or null
   */
  matchesAny(location, typeMask, docDomain, thirdParty, sitekey, specificOnly)
  {
    let candidates = location.toLowerCase().match(/[a-z0-9%]{3,}/g);
    if (candidates === null)
      candidates = [];
    candidates.push("");
    for (let i = 0, l = candidates.length; i < l; i++)
    {
      let result = this._checkEntryMatch(candidates[i], location, typeMask,
                                         docDomain, thirdParty, sitekey,
                                         specificOnly);
      if (result)
        return result;
    }

    return null;
  }
};

/**
 * Combines a matcher for blocking and exception rules, automatically sorts
 * rules into two Matcher instances.
 * @constructor
 * @augments Matcher
 */
function CombinedMatcher()
{
  this.blacklist = new Matcher();
  this.whitelist = new Matcher();
  this.resultCache = new Map();
}
exports.CombinedMatcher = CombinedMatcher;

/**
 * Maximal number of matching cache entries to be kept
 * @type {number}
 */
CombinedMatcher.maxCacheEntries = 1000;

CombinedMatcher.prototype =
{
  /**
   * Matcher for blocking rules.
   * @type {Matcher}
   */
  blacklist: null,

  /**
   * Matcher for exception rules.
   * @type {Matcher}
   */
  whitelist: null,

  /**
   * Lookup table of previous matchesAny results
   * @type {Map.<string,Filter>}
   */
  resultCache: null,

  /**
   * @see Matcher#clear
   */
  clear()
  {
    this.blacklist.clear();
    this.whitelist.clear();
    this.resultCache.clear();
  },

  /**
   * @see Matcher#add
   * @param {Filter} filter
   */
  add(filter)
  {
    if (filter instanceof WhitelistFilter)
      this.whitelist.add(filter);
    else
      this.blacklist.add(filter);

    this.resultCache.clear();
  },

  /**
   * @see Matcher#remove
   * @param {Filter} filter
   */
  remove(filter)
  {
    if (filter instanceof WhitelistFilter)
      this.whitelist.remove(filter);
    else
      this.blacklist.remove(filter);

    this.resultCache.clear();
  },

  /**
   * @see Matcher#findKeyword
   * @param {Filter} filter
   * @return {string} keyword
   */
  findKeyword(filter)
  {
    if (filter instanceof WhitelistFilter)
      return this.whitelist.findKeyword(filter);
    return this.blacklist.findKeyword(filter);
  },

  /**
   * @see Matcher#hasFilter
   * @param {Filter} filter
   * @return {boolean}
   */
  hasFilter(filter)
  {
    if (filter instanceof WhitelistFilter)
      return this.whitelist.hasFilter(filter);
    return this.blacklist.hasFilter(filter);
  },

  /**
   * @see Matcher#getKeywordForFilter
   * @param {Filter} filter
   * @return {string} keyword
   */
  getKeywordForFilter(filter)
  {
    if (filter instanceof WhitelistFilter)
      return this.whitelist.getKeywordForFilter(filter);
    return this.blacklist.getKeywordForFilter(filter);
  },

  /**
   * Checks whether a particular filter is slow
   * @param {RegExpFilter} filter
   * @return {boolean}
   */
  isSlowFilter(filter)
  {
    let matcher = (
      filter instanceof WhitelistFilter ? this.whitelist : this.blacklist
    );
    if (matcher.hasFilter(filter))
      return !matcher.getKeywordForFilter(filter);
    return !matcher.findKeyword(filter);
  },

  /**
   * Optimized filter matching testing both whitelist and blacklist matchers
   * simultaneously. For parameters see Matcher.matchesAny().
   * @see Matcher#matchesAny
   * @inheritdoc
   */
  matchesAnyInternal(location, typeMask, docDomain, thirdParty, sitekey,
                     specificOnly)
  {
    let candidates = location.toLowerCase().match(/[a-z0-9%]{3,}/g);
    if (candidates === null)
      candidates = [];
    candidates.push("");

    let blacklistHit = null;
    for (let i = 0, l = candidates.length; i < l; i++)
    {
      let substr = candidates[i];
      let result = this.whitelist._checkEntryMatch(
        substr, location, typeMask, docDomain, thirdParty, sitekey
      );
      if (result)
        return result;
      if (blacklistHit === null)
      {
        blacklistHit = this.blacklist._checkEntryMatch(
          substr, location, typeMask, docDomain, thirdParty, sitekey,
          specificOnly
        );
      }
    }
    return blacklistHit;
  },

  /**
   * @see Matcher#matchesAny
   * @inheritdoc
   */
  matchesAny(location, typeMask, docDomain, thirdParty, sitekey, specificOnly)
  {
    let key = location + " " + typeMask + " " + docDomain + " " + thirdParty +
      " " + sitekey + " " + specificOnly;

    let result = this.resultCache.get(key);
    if (typeof result != "undefined")
      return result;

    result = this.matchesAnyInternal(location, typeMask, docDomain,
                                     thirdParty, sitekey, specificOnly);

    if (this.resultCache.size >= CombinedMatcher.maxCacheEntries)
      this.resultCache.clear();

    this.resultCache.set(key, result);

    return result;
  }
};

/**
 * Shared CombinedMatcher instance that should usually be used.
 * @type {CombinedMatcher}
 */
exports.defaultMatcher = new CombinedMatcher();


/***/ }),
/* 10 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";
/*
 * This file is part of Adblock Plus <https://adblockplus.org/>,
 * Copyright (C) 2006-present eyeo GmbH
 *
 * Adblock Plus is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3 as
 * published by the Free Software Foundation.
 *
 * Adblock Plus is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with Adblock Plus.  If not, see <http://www.gnu.org/licenses/>.
 */



let Utils = exports.Utils = {
  systemPrincipal: null,
  runAsync(callback)
  {
    if (document.readyState == "loading")
    {
      // Make sure to not run asynchronous actions before all
      // scripts loaded. This caused issues on Opera in the past.
      let onDOMContentLoaded = () =>
      {
        document.removeEventListener("DOMContentLoaded", onDOMContentLoaded);
        callback();
      };
      document.addEventListener("DOMContentLoaded", onDOMContentLoaded);
    }
    else
    {
      setTimeout(callback, 0);
    }
  },
  get appLocale()
  {
    let locale = browser.i18n.getUILanguage();
    Object.defineProperty(this, "appLocale", {value: locale, enumerable: true});
    return this.appLocale;
  },
  get readingDirection()
  {
    let direction = browser.i18n.getMessage("@@bidi_dir");
    // This fallback is only necessary for Microsoft Edge
    if (!direction)
      direction = /^(?:ar|fa|he|ug|ur)\b/.test(this.appLocale) ? "rtl" : "ltr";
    Object.defineProperty(
      this,
      "readingDirection",
      {value: direction, enumerable: true}
    );
    return this.readingDirection;
  },
  generateChecksum(lines)
  {
    // We cannot calculate MD5 checksums yet :-(
    return null;
  },

  getDocLink(linkID)
  {
    let docLink = __webpack_require__(2).Prefs.documentation_link;
    return docLink.replace(/%LINK%/g, linkID)
                  .replace(/%LANG%/g, Utils.appLocale);
  },

  yield()
  {
  }
};


/***/ }),
/* 11 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";
/*
 * This file is part of Adblock Plus <https://adblockplus.org/>,
 * Copyright (C) 2006-present eyeo GmbH
 *
 * Adblock Plus is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3 as
 * published by the Free Software Foundation.
 *
 * Adblock Plus is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with Adblock Plus.  If not, see <http://www.gnu.org/licenses/>.
 */

/** @module hitLogger */



const {extractHostFromFrame} = __webpack_require__(6);
const {EventEmitter} = __webpack_require__(13);
const {FilterStorage} = __webpack_require__(4);
const {port} = __webpack_require__(7);
const {RegExpFilter,
       ElemHideFilter} = __webpack_require__(0);

const nonRequestTypes = exports.nonRequestTypes = [
  "DOCUMENT", "ELEMHIDE", "GENERICBLOCK", "GENERICHIDE", "CSP"
];

let eventEmitter = new EventEmitter();

/**
 * @namespace
 * @static
 */
let HitLogger = exports.HitLogger = {
  /**
   * Adds a listener for requests, filter hits etc related to the tab.
   *
   * Note: Calling code is responsible for removing the listener again,
   *       it will not be automatically removed when the tab is closed.
   *
   * @param {number} tabId
   * @param {function} listener
   */
  addListener: eventEmitter.on.bind(eventEmitter),

  /**
   * Removes a listener for the tab.
   *
   * @param {number} tabId
   * @param {function} listener
   */
  removeListener: eventEmitter.off.bind(eventEmitter),

  /**
   * Checks whether a tab is being inspected by anything.
   *
   * @param {number} tabId
   * @return {boolean}
   */
  hasListener(tabId)
  {
    let listeners = eventEmitter._listeners.get(tabId);
    return listeners && listeners.length > 0;
  }
};

/**
 * Logs a request associated with a tab or multiple tabs.
 *
 * @param {number[]} tabIds
 *   The tabIds associated with the request
 * @param {Object} request
 *   The request to log
 * @param {string} request.url
 *   The URL of the request
 * @param {string} request.type
 *  The request type
 * @param {string} request.docDomain
 *  The hostname of the document
 * @param {boolean} request.thirdParty
 *   Whether the origin of the request and document differs
 * @param {?string} request.sitekey
 *   The active sitekey if there is any
 * @param {?boolean} request.specificOnly
 *   Whether generic filters should be ignored
 * @param {?BlockingFilter} filter
 *  The matched filter or null if there is no match
 */
exports.logRequest = (tabIds, request, filter) =>
{
  for (let tabId of tabIds)
    eventEmitter.emit(tabId, request, filter);
};

/**
 * Logs active element hiding filters for a tab.
 *
 * @param {number}   tabId      The ID of the tab, the elements were hidden in
 * @param {string[]} selectors  The selectors of applied ElemHideFilters
 * @param {string[]} filters    The text of applied ElemHideEmulationFilters
 * @param {string}   docDomain  The hostname of the document
 */
function logHiddenElements(tabId, selectors, filters, docDomain)
{
  if (HitLogger.hasListener(tabId))
  {
    for (let subscription of FilterStorage.subscriptions)
    {
      if (subscription.disabled)
        continue;

      for (let filter of subscription.filters)
      {
        // We only know the exact filter in case of element hiding emulation.
        // For regular element hiding filters, the content script only knows
        // the selector, so we have to find a filter that has an identical
        // selector and is active on the domain the match was reported from.
        let isActiveElemHideFilter = filter instanceof ElemHideFilter &&
                                     selectors.includes(filter.selector) &&
                                     filter.isActiveOnDomain(docDomain);

        if (isActiveElemHideFilter || filters.includes(filter.text))
          eventEmitter.emit(tabId, {type: "ELEMHIDE", docDomain}, filter);
      }
    }
  }
}

/**
 * Logs a whitelisting filter that disables (some kind of)
 * blocking for a particular document.
 *
 * @param {number}       tabId     The tabId the whitelisting is active for
 * @param {string}       url       The url of the whitelisted document
 * @param {number}       typeMask  The bit mask of whitelisting types checked
 *                                 for
 * @param {string}       docDomain The hostname of the parent document
 * @param {WhitelistFilter} filter The matched whitelisting filter
 */
exports.logWhitelistedDocument = (tabId, url, typeMask, docDomain, filter) =>
{
  if (HitLogger.hasListener(tabId))
  {
    for (let type of nonRequestTypes)
    {
      if (typeMask & filter.contentType & RegExpFilter.typeMap[type])
        eventEmitter.emit(tabId, {url, type, docDomain}, filter);
    }
  }
};

port.on("hitLogger.traceElemHide", (message, sender) =>
{
  logHiddenElements(
    sender.page.id, message.selectors, message.filters,
    extractHostFromFrame(sender.frame)
  );
});


/***/ }),
/* 12 */
/***/ (function(module, exports) {

﻿// Log an 'error' message on GAB log server.
let ServerMessages = exports.ServerMessages = (function()
{
  var recordErrorMessage = function (msg, callback, additionalParams)
  {
    recordMessageWithUserID(msg, 'error', callback, additionalParams);
  };

  // Log an 'status' related message on GAB log server.
  var recordStatusMessage = function (msg, callback, additionalParams)
  {
    recordMessageWithUserID(msg, 'stats', callback, additionalParams);
  };

  // Log a 'general' message on GAB log server.
  var recordGeneralMessage = function (msg, callback, additionalParams)
  {
    recordMessageWithUserID(msg, 'general', callback, additionalParams);
  };

  // Log a 'adreport' message on GAB log server.
  var recordAdreportMessage = function (msg, callback, additionalParams)
  {
    recordMessageWithUserID(msg, 'adreport', callback, additionalParams);
  };

  var postFilterStatsToLogServer = function(data, callback)
  {
    if (!data)
    {
      return;
    }
    var payload = {'event':  'filter_stats', 'payload': data };
    $.ajax({
      jsonp: false,
      type: 'POST',
      url: "https://log.getadblock.com/v2/record_log.php",
      data: JSON.stringify(payload),
      success: function (text, status, xhr)
      {
        if (typeof callback === "function")
        {
          callback(text, status, xhr);
        }
      },
      error : function(xhr, textStatus, errorThrown)
      {
        log('message server returned error: ', textStatus, errorThrown);
        if (callback)
        {
          callback(errorThrown, textStatus, xhr);
        }
      },
    });
  };

  // Log a message on GAB log server. The user's userid will be prepended to the
  // message.
  // If callback() is specified, call callback() after logging has completed
  var recordMessageWithUserID = function (msg, queryType, callback, additionalParams)
  {
    if (!msg || !queryType)
    {
      return;
    }
    var payload = {
      "u": STATS.userId(),
      "f": STATS.flavor,
      "o": STATS.os,
      "l": determineUserLanguage(),
      "t": queryType,
    };
    if (typeof additionalParams === "object") {
      for (var prop in additionalParams) {
        payload[prop] = additionalParams[prop];
      }
    }
    var payload = {'event':  msg, 'payload': payload};
    sendMessageToLogServer(payload, callback);
  };

  // Log a message on GAB log server.
  // If callback() is specified, call callback() after logging has completed
  var recordAnonymousMessage = function (msg, queryType, callback, additionalParams)
  {
    if (!msg || !queryType)
    {
      return;
    }

    var payload = {
      "f": STATS.flavor,
      "o": STATS.os,
      "l": determineUserLanguage(),
      "t": queryType,
    };
    if (typeof additionalParams === "object") {
      for (var prop in additionalParams) {
        payload[prop] = additionalParams[prop];
      }
    }
    var payload = {'event':  msg, 'payload': payload};
    sendMessageToLogServer(payload, callback);
  };

  // Log a message on GAB log server. The user's userid will be prepended to the
  // message.
  // If callback() is specified, call callback() after logging has completed
  var sendMessageToLogServer = function (payload, callback)
  {
    $.ajax({
      jsonp: false,
      type: 'POST',
      url: "https://log.getadblock.com/v2/record_log.php",
      data: JSON.stringify(payload),
      success: function ()
      {
        if (typeof callback === "function")
        {
          callback();
        }
      },

      error: function (e)
      {
        log('message server returned error: ', e.status);
      },
    });
  };

  return {
    recordErrorMessage : recordErrorMessage,
    recordAnonymousMessage: recordAnonymousMessage,
    postFilterStatsToLogServer: postFilterStatsToLogServer,
    recordStatusMessage: recordStatusMessage,
    recordGeneralMessage: recordGeneralMessage,
    recordAdreportMessage: recordAdreportMessage,
  };
})();


/***/ }),
/* 13 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";
/*
 * This file is part of Adblock Plus <https://adblockplus.org/>,
 * Copyright (C) 2006-present eyeo GmbH
 *
 * Adblock Plus is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3 as
 * published by the Free Software Foundation.
 *
 * Adblock Plus is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with Adblock Plus.  If not, see <http://www.gnu.org/licenses/>.
 */



/**
 * Registers and emits named events.
 *
 * @constructor
 */
exports.EventEmitter = function()
{
  this._listeners = new Map();
};

exports.EventEmitter.prototype = {
  /**
   * Adds a listener for the specified event name.
   *
   * @param {string}   name
   * @param {function} listener
   */
  on(name, listener)
  {
    let listeners = this._listeners.get(name);
    if (listeners)
      listeners.push(listener);
    else
      this._listeners.set(name, [listener]);
  },

  /**
   * Removes a listener for the specified event name.
   *
   * @param {string}   name
   * @param {function} listener
   */
  off(name, listener)
  {
    let listeners = this._listeners.get(name);
    if (listeners)
    {
      let idx = listeners.indexOf(listener);
      if (idx != -1)
        listeners.splice(idx, 1);
    }
  },

  /**
   * Adds a one time listener and returns a promise that
   * is resolved the next time the specified event is emitted.
   * @param {string} name
   * @return {Promise}
   */
  once(name)
  {
    return new Promise(resolve =>
    {
      let listener = () =>
      {
        this.off(name, listener);
        resolve();
      };

      this.on(name, listener);
    });
  },

  /**
   * Returns a copy of the array of listeners for the specified event.
   *
   * @param {string} name
   * @return {function[]}
   */
  listeners(name)
  {
    let listeners = this._listeners.get(name);
    return listeners ? listeners.slice() : [];
  },

  /**
   * Calls all previously added listeners for the given event name.
   *
   * @param {string} name
   * @param {...*}   [arg]
   */
  emit(name, ...args)
  {
    let listeners = this.listeners(name);
    for (let listener of listeners)
      listener(...args);
  }
};


/***/ }),
/* 14 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";
/*
 * This file is part of Adblock Plus <https://adblockplus.org/>,
 * Copyright (C) 2006-present eyeo GmbH
 *
 * Adblock Plus is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3 as
 * published by the Free Software Foundation.
 *
 * Adblock Plus is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with Adblock Plus.  If not, see <http://www.gnu.org/licenses/>.
 */



/**
 * @fileOverview Element hiding implementation.
 */

const {ElemHideException} = __webpack_require__(0);
const {FilterNotifier} = __webpack_require__(1);

/**
 * Lookup table, active flag, by filter by domain.
 * (Only contains filters that aren't unconditionally matched for all domains.)
 * @type {Map.<string,Map.<Filter,boolean>>}
 */
let filtersByDomain = new Map();

/**
 * Lookup table, filter by selector. (Only used for selectors that are
 * unconditionally matched for all domains.)
 * @type {Map.<string,Filter>}
 */
let filterBySelector = new Map();

/**
 * This array caches the keys of filterBySelector table (selectors
 * which unconditionally apply on all domains). It will be null if the
 * cache needs to be rebuilt.
 * @type {?string[]}
 */
let unconditionalSelectors = null;

/**
 * Map to be used instead when a filter has a blank domains property.
 * @type {Map.<string,boolean>}
 * @const
 */
let defaultDomains = new Map([["", true]]);

/**
 * Set containing known element hiding and exception filters
 * @type {Set.<ElemHideBase>}
 */
let knownFilters = new Set();

/**
 * Lookup table, lists of element hiding exceptions by selector
 * @type {Map.<string,Filter[]>}
 */
let exceptions = new Map();

/**
 * Adds a filter to the lookup table of filters by domain.
 * @param {Filter} filter
 */
function addToFiltersByDomain(filter)
{
  let domains = filter.domains || defaultDomains;
  for (let [domain, isIncluded] of domains)
  {
    // There's no need to note that a filter is generically disabled.
    if (!isIncluded && domain == "")
      continue;

    let filters = filtersByDomain.get(domain);
    if (!filters)
      filtersByDomain.set(domain, filters = new Map());
    filters.set(filter, isIncluded);
  }
}

/**
 * Returns a list of selectors that apply on each website unconditionally.
 * @returns {string[]}
 */
function getUnconditionalSelectors()
{
  if (!unconditionalSelectors)
    unconditionalSelectors = [...filterBySelector.keys()];

  return unconditionalSelectors;
}

/**
 * Container for element hiding filters
 * @class
 */
exports.ElemHide = {
  /**
   * Removes all known filters
   */
  clear()
  {
    for (let collection of [filtersByDomain, filterBySelector,
                            knownFilters, exceptions])
    {
      collection.clear();
    }
    unconditionalSelectors = null;
    FilterNotifier.emit("elemhideupdate");
  },

  /**
   * Add a new element hiding filter
   * @param {ElemHideBase} filter
   */
  add(filter)
  {
    if (knownFilters.has(filter))
      return;

    if (filter instanceof ElemHideException)
    {
      let {selector} = filter;
      let list = exceptions.get(selector);
      if (list)
        list.push(filter);
      else
        exceptions.set(selector, [filter]);

      // If this is the first exception for a previously unconditionally
      // applied element hiding selector we need to take care to update the
      // lookups.
      let unconditionalFilterForSelector = filterBySelector.get(selector);
      if (unconditionalFilterForSelector)
      {
        addToFiltersByDomain(unconditionalFilterForSelector);
        filterBySelector.delete(selector);
        unconditionalSelectors = null;
      }
    }
    else if (!(filter.domains || exceptions.has(filter.selector)))
    {
      // The new filter's selector is unconditionally applied to all domains
      filterBySelector.set(filter.selector, filter);
      unconditionalSelectors = null;
    }
    else
    {
      // The new filter's selector only applies to some domains
      addToFiltersByDomain(filter);
    }

    knownFilters.add(filter);
    FilterNotifier.emit("elemhideupdate");
  },

  /**
   * Removes an element hiding filter
   * @param {ElemHideBase} filter
   */
  remove(filter)
  {
    if (!knownFilters.has(filter))
      return;

    // Whitelisting filters
    if (filter instanceof ElemHideException)
    {
      let list = exceptions.get(filter.selector);
      let index = list.indexOf(filter);
      if (index >= 0)
        list.splice(index, 1);
    }
    // Unconditially applied element hiding filters
    else if (filterBySelector.get(filter.selector) == filter)
    {
      filterBySelector.delete(filter.selector);
      unconditionalSelectors = null;
    }
    // Conditionally applied element hiding filters
    else
    {
      let domains = filter.domains || defaultDomains;
      for (let domain of domains.keys())
      {
        let filters = filtersByDomain.get(domain);
        if (filters)
          filters.delete(filter);
      }
    }

    knownFilters.delete(filter);
    FilterNotifier.emit("elemhideupdate");
  },

  /**
   * Checks whether an exception rule is registered for a filter on a particular
   * domain.
   * @param {Filter} filter
   * @param {?string} docDomain
   * @return {?ElemHideException}
   */
  getException(filter, docDomain)
  {
    let list = exceptions.get(filter.selector);
    if (!list)
      return null;

    for (let i = list.length - 1; i >= 0; i--)
    {
      if (list[i].isActiveOnDomain(docDomain))
        return list[i];
    }

    return null;
  },

  /**
   * Determines from the current filter list which selectors should be applied
   * on a particular host name.
   * @param {string} domain
   * @param {boolean} [specificOnly] true if generic filters should not apply.
   * @returns {string[]} List of selectors.
   */
  getSelectorsForDomain(domain, specificOnly = false)
  {
    let selectors = [];

    let excluded = new Set();
    let currentDomain = domain ? domain.toUpperCase() : "";

    // This code is a performance hot-spot, which is why we've made certain
    // micro-optimisations. Please be careful before making changes.
    while (true)
    {
      if (specificOnly && currentDomain == "")
        break;

      let filters = filtersByDomain.get(currentDomain);
      if (filters)
      {
        for (let [filter, isIncluded] of filters)
        {
          if (!isIncluded)
          {
            excluded.add(filter);
          }
          else if ((excluded.size == 0 || !excluded.has(filter)) &&
                   !this.getException(filter, domain))
          {
            selectors.push(filter.selector);
          }
        }
      }

      if (currentDomain == "")
        break;

      let nextDot = currentDomain.indexOf(".");
      currentDomain = nextDot == -1 ? "" : currentDomain.substr(nextDot + 1);
    }

    if (!specificOnly)
      selectors = getUnconditionalSelectors().concat(selectors);

    return selectors;
  }
};


/***/ }),
/* 15 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";
/*
 * This file is part of Adblock Plus <https://adblockplus.org/>,
 * Copyright (C) 2006-present eyeo GmbH
 *
 * Adblock Plus is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3 as
 * published by the Free Software Foundation.
 *
 * Adblock Plus is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with Adblock Plus.  If not, see <http://www.gnu.org/licenses/>.
 */



/**
 * @fileOverview Manages synchronization of filter subscriptions.
 */

const {Downloader, Downloadable,
       MILLIS_IN_SECOND, MILLIS_IN_MINUTE,
       MILLIS_IN_HOUR, MILLIS_IN_DAY} = __webpack_require__(22);
const {Filter} = __webpack_require__(0);
const {FilterStorage} = __webpack_require__(4);
const {FilterNotifier} = __webpack_require__(1);
const {Prefs} = __webpack_require__(2);
const {Subscription,
       DownloadableSubscription} = __webpack_require__(5);
const {Utils} = __webpack_require__(10);

const INITIAL_DELAY = 1 * MILLIS_IN_MINUTE;
const CHECK_INTERVAL = 1 * MILLIS_IN_HOUR;
const DEFAULT_EXPIRATION_INTERVAL = 5 * MILLIS_IN_DAY;

/**
 * The object providing actual downloading functionality.
 * @type {Downloader}
 */
let downloader = null;

/**
 * This object is responsible for downloading filter subscriptions whenever
 * necessary.
 * @class
 */
let Synchronizer = exports.Synchronizer =
{
  /**
   * Called on module startup.
   */
  init()
  {
    downloader = new Downloader(this._getDownloadables.bind(this),
                                INITIAL_DELAY, CHECK_INTERVAL);
    onShutdown.add(() =>
    {
      downloader.cancel();
    });

    downloader.onExpirationChange = this._onExpirationChange.bind(this);
    downloader.onDownloadStarted = this._onDownloadStarted.bind(this);
    downloader.onDownloadSuccess = this._onDownloadSuccess.bind(this);
    downloader.onDownloadError = this._onDownloadError.bind(this);
  },

  /**
   * Checks whether a subscription is currently being downloaded.
   * @param {string} url  URL of the subscription
   * @return {boolean}
   */
  isExecuting(url)
  {
    return downloader.isDownloading(url);
  },

  /**
   * Starts the download of a subscription.
   * @param {DownloadableSubscription} subscription
   *   Subscription to be downloaded
   * @param {boolean} manual
   *   true for a manually started download (should not trigger fallback
   *   requests)
   */
  execute(subscription, manual)
  {
    downloader.download(this._getDownloadable(subscription, manual));
  },

  /**
   * Yields Downloadable instances for all subscriptions that can be downloaded.
   */
  *_getDownloadables()
  {
    if (!Prefs.subscriptions_autoupdate)
      return;

    for (let subscription of FilterStorage.subscriptions)
    {
      if (subscription instanceof DownloadableSubscription)
        yield this._getDownloadable(subscription, false);
    }
  },

  /**
   * Creates a Downloadable instance for a subscription.
   * @param {Subscription} subscription
   * @param {boolean} manual
   * @return {Downloadable}
   */
  _getDownloadable(subscription, manual)
  {
    let result = new Downloadable(subscription.url);
    if (subscription.lastDownload != subscription.lastSuccess)
      result.lastError = subscription.lastDownload * MILLIS_IN_SECOND;
    result.lastCheck = subscription.lastCheck * MILLIS_IN_SECOND;
    result.lastVersion = subscription.version;
    result.softExpiration = subscription.softExpiration * MILLIS_IN_SECOND;
    result.hardExpiration = subscription.expires * MILLIS_IN_SECOND;
    result.manual = manual;
    result.downloadCount = subscription.downloadCount;
    return result;
  },

  _onExpirationChange(downloadable)
  {
    let subscription = Subscription.fromURL(downloadable.url);
    subscription.lastCheck = Math.round(
      downloadable.lastCheck / MILLIS_IN_SECOND
    );
    subscription.softExpiration = Math.round(
      downloadable.softExpiration / MILLIS_IN_SECOND
    );
    subscription.expires = Math.round(
      downloadable.hardExpiration / MILLIS_IN_SECOND
    );
  },

  _onDownloadStarted(downloadable)
  {
    let subscription = Subscription.fromURL(downloadable.url);
    FilterNotifier.triggerListeners("subscription.downloading", subscription);
  },

  _onDownloadSuccess(downloadable, responseText, errorCallback,
                     redirectCallback)
  {
    let lines = responseText.split(/[\r\n]+/);
    let headerMatch = /\[Adblock(?:\s*Plus\s*([\d.]+)?)?\]/i.exec(lines[0]);
    if (!headerMatch)
      return errorCallback("synchronize_invalid_data");
    let minVersion = headerMatch[1];

    // Don't remove parameter comments immediately but add them to a list first,
    // they need to be considered in the checksum calculation.
    let remove = [];
    let params = {
      redirect: null,
      homepage: null,
      title: null,
      version: null,
      expires: null
    };
    for (let i = 0; i < lines.length; i++)
    {
      let match = /^\s*!\s*(\w+)\s*:\s*(.*)/.exec(lines[i]);
      if (match)
      {
        let keyword = match[1].toLowerCase();
        let value = match[2];
        if (keyword in params)
        {
          params[keyword] = value;
          remove.push(i);
        }
        else if (keyword == "checksum")
        {
          lines.splice(i--, 1);
          let checksum = Utils.generateChecksum(lines);
          if (checksum && checksum != value.replace(/=+$/, ""))
            return errorCallback("synchronize_checksum_mismatch");
        }
      }
    }

    if (params.redirect)
      return redirectCallback(params.redirect);

    // Handle redirects
    let subscription = Subscription.fromURL(downloadable.redirectURL ||
                                            downloadable.url);
    if (downloadable.redirectURL &&
        downloadable.redirectURL != downloadable.url)
    {
      let oldSubscription = Subscription.fromURL(downloadable.url);
      subscription.title = oldSubscription.title;
      subscription.disabled = oldSubscription.disabled;
      subscription.lastCheck = oldSubscription.lastCheck;

      let listed = (oldSubscription.url in FilterStorage.knownSubscriptions);
      if (listed)
        FilterStorage.removeSubscription(oldSubscription);

      delete Subscription.knownSubscriptions[oldSubscription.url];

      if (listed)
        FilterStorage.addSubscription(subscription);
    }

    // The download actually succeeded
    subscription.lastSuccess = subscription.lastDownload = Math.round(
      Date.now() / MILLIS_IN_SECOND
    );
    subscription.downloadStatus = "synchronize_ok";
    subscription.downloadCount = downloadable.downloadCount;
    subscription.errors = 0;

    // Remove lines containing parameters
    for (let i = remove.length - 1; i >= 0; i--)
      lines.splice(remove[i], 1);

    // Process parameters
    if (params.homepage)
    {
      let url;
      try
      {
        url = new URL(params.homepage);
      }
      catch (e)
      {
        url = null;
      }

      if (url && (url.protocol == "http:" || url.protocol == "https:"))
        subscription.homepage = url.href;
    }

    if (params.title)
    {
      subscription.title = params.title;
      subscription.fixedTitle = true;
    }
    else
      subscription.fixedTitle = false;

    subscription.version = (params.version ? parseInt(params.version, 10) : 0);

    let expirationInterval = DEFAULT_EXPIRATION_INTERVAL;
    if (params.expires)
    {
      let match = /^(\d+)\s*(h)?/.exec(params.expires);
      if (match)
      {
        let interval = parseInt(match[1], 10);
        if (match[2])
          expirationInterval = interval * MILLIS_IN_HOUR;
        else
          expirationInterval = interval * MILLIS_IN_DAY;
      }
    }

    let [
      softExpiration,
      hardExpiration
    ] = downloader.processExpirationInterval(expirationInterval);
    subscription.softExpiration = Math.round(softExpiration / MILLIS_IN_SECOND);
    subscription.expires = Math.round(hardExpiration / MILLIS_IN_SECOND);

    if (minVersion)
      subscription.requiredVersion = minVersion;
    else
      delete subscription.requiredVersion;

    // Process filters
    lines.shift();
    let filters = [];
    for (let line of lines)
    {
      line = Filter.normalize(line);
      if (line)
        filters.push(Filter.fromText(line));
    }

    FilterStorage.updateSubscriptionFilters(subscription, filters);

    return undefined;
  },

  _onDownloadError(downloadable, downloadURL, error, channelStatus,
                   responseStatus, redirectCallback)
  {
    let subscription = Subscription.fromURL(downloadable.url);
    subscription.lastDownload = Math.round(Date.now() / MILLIS_IN_SECOND);
    subscription.downloadStatus = error;

    // Request fallback URL if necessary - for automatic updates only
    if (!downloadable.manual)
    {
      subscription.errors++;

      if (redirectCallback &&
          subscription.errors >= Prefs.subscriptions_fallbackerrors &&
          /^https?:\/\//i.test(subscription.url))
      {
        subscription.errors = 0;

        let fallbackURL = Prefs.subscriptions_fallbackurl;
        const {addonVersion} = __webpack_require__(3);
        fallbackURL = fallbackURL.replace(/%VERSION%/g,
                                          encodeURIComponent(addonVersion));
        fallbackURL = fallbackURL.replace(/%SUBSCRIPTION%/g,
                                          encodeURIComponent(subscription.url));
        fallbackURL = fallbackURL.replace(/%URL%/g,
                                          encodeURIComponent(downloadURL));
        fallbackURL = fallbackURL.replace(/%ERROR%/g,
                                          encodeURIComponent(error));
        fallbackURL = fallbackURL.replace(/%CHANNELSTATUS%/g,
                                          encodeURIComponent(channelStatus));
        fallbackURL = fallbackURL.replace(/%RESPONSESTATUS%/g,
                                          encodeURIComponent(responseStatus));

        let request = new XMLHttpRequest();
        request.mozBackgroundRequest = true;
        request.open("GET", fallbackURL);
        request.overrideMimeType("text/plain");
        request.channel.loadFlags = request.channel.loadFlags |
                                    request.channel.INHIBIT_CACHING |
                                    request.channel.VALIDATE_ALWAYS;
        request.addEventListener("load", ev =>
        {
          if (onShutdown.done)
            return;

          if (!(subscription.url in FilterStorage.knownSubscriptions))
            return;

          let match = /^(\d+)(?:\s+(\S+))?$/.exec(request.responseText);
          if (match && match[1] == "301" &&    // Moved permanently
              match[2] && /^https?:\/\//i.test(match[2]))
          {
            redirectCallback(match[2]);
          }
          else if (match && match[1] == "410") // Gone
          {
            let data = "[Adblock]\n" +
              subscription.filters.map(f => f.text).join("\n");
            redirectCallback("data:text/plain," + encodeURIComponent(data));
          }
        }, false);
        request.send(null);
      }
    }
  }
};
Synchronizer.init();


/***/ }),
/* 16 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";
/*
 * This file is part of Adblock Plus <https://adblockplus.org/>,
 * Copyright (C) 2006-present eyeo GmbH
 *
 * Adblock Plus is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3 as
 * published by the Free Software Foundation.
 *
 * Adblock Plus is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with Adblock Plus.  If not, see <http://www.gnu.org/licenses/>.
 */



/**
 * @fileOverview Handles notifications.
 */

const {Prefs} = __webpack_require__(2);
const {Downloader, Downloadable,
       MILLIS_IN_MINUTE, MILLIS_IN_HOUR,
       MILLIS_IN_DAY} = __webpack_require__(22);
const {Utils} = __webpack_require__(10);
const {Matcher, defaultMatcher} = __webpack_require__(9);
const {Filter, RegExpFilter, WhitelistFilter} = __webpack_require__(0);

const INITIAL_DELAY = 1 * MILLIS_IN_MINUTE;
const CHECK_INTERVAL = 1 * MILLIS_IN_HOUR;
const EXPIRATION_INTERVAL = 1 * MILLIS_IN_DAY;
const TYPE = {
  information: 0,
  question: 1,
  relentless: 2,
  critical: 3
};

let showListeners = [];
let questionListeners = {};

function getNumericalSeverity(notification)
{
  if (notification.type in TYPE)
    return TYPE[notification.type];
  return TYPE.information;
}

function saveNotificationData()
{
  // HACK: JSON values aren't saved unless they are assigned a different object.
  Prefs.notificationdata = JSON.parse(JSON.stringify(Prefs.notificationdata));
}

function localize(translations, locale)
{
  if (locale in translations)
    return translations[locale];

  let languagePart = locale.substring(0, locale.indexOf("-"));
  if (languagePart && languagePart in translations)
    return translations[languagePart];

  let defaultLocale = "en-US";
  return translations[defaultLocale];
}

function parseVersionComponent(comp)
{
  if (comp == "*")
    return Infinity;
  return parseInt(comp, 10) || 0;
}

function compareVersion(v1, v2)
{
  let regexp = /^(.*?)([a-z].*)?$/i;
  let [, head1, tail1] = regexp.exec(v1);
  let [, head2, tail2] = regexp.exec(v2);
  let components1 = head1.split(".");
  let components2 = head2.split(".");

  for (let i = 0; i < components1.length ||
                  i < components2.length; i++)
  {
    let result = parseVersionComponent(components1[i]) -
                 parseVersionComponent(components2[i]) || 0;

    if (result != 0)
      return result;
  }

  // Compare version suffix (e.g. 0.1alpha < 0.1b1 < 01.b2 < 0.1).
  // However, note that this is a simple string comparision, meaning: b10 < b2
  if (tail1 == tail2)
    return 0;
  if (!tail1 || tail2 && tail1 > tail2)
    return 1;
  return -1;
}

/**
 * The object providing actual downloading functionality.
 * @type {Downloader}
 */
let downloader = null;
let localData = [];

/**
 * Regularly fetches notifications and decides which to show.
 * @class
 */
let Notification = exports.Notification =
{
  /**
   * Called on module startup.
   */
  init()
  {
    downloader = new Downloader(this._getDownloadables.bind(this),
                                INITIAL_DELAY, CHECK_INTERVAL);
    downloader.onExpirationChange = this._onExpirationChange.bind(this);
    downloader.onDownloadSuccess = this._onDownloadSuccess.bind(this);
    downloader.onDownloadError = this._onDownloadError.bind(this);
    onShutdown.add(() => downloader.cancel());
  },

  /**
   * Yields a Downloadable instances for the notifications download.
   */
  *_getDownloadables()
  {
    let downloadable = new Downloadable(Prefs.notificationurl);
    if (typeof Prefs.notificationdata.lastError === "number")
      downloadable.lastError = Prefs.notificationdata.lastError;
    if (typeof Prefs.notificationdata.lastCheck === "number")
      downloadable.lastCheck = Prefs.notificationdata.lastCheck;
    if (typeof Prefs.notificationdata.data === "object" &&
        "version" in Prefs.notificationdata.data)
    {
      downloadable.lastVersion = Prefs.notificationdata.data.version;
    }
    if (typeof Prefs.notificationdata.softExpiration === "number")
      downloadable.softExpiration = Prefs.notificationdata.softExpiration;
    if (typeof Prefs.notificationdata.hardExpiration === "number")
      downloadable.hardExpiration = Prefs.notificationdata.hardExpiration;
    if (typeof Prefs.notificationdata.downloadCount === "number")
      downloadable.downloadCount = Prefs.notificationdata.downloadCount;
    yield downloadable;
  },

  _onExpirationChange(downloadable)
  {
    Prefs.notificationdata.lastCheck = downloadable.lastCheck;
    Prefs.notificationdata.softExpiration = downloadable.softExpiration;
    Prefs.notificationdata.hardExpiration = downloadable.hardExpiration;
    saveNotificationData();
  },

  _onDownloadSuccess(downloadable, responseText, errorCallback,
                     redirectCallback)
  {
    try
    {
      let data = JSON.parse(responseText);
      for (let notification of data.notifications)
      {
        if ("severity" in notification)
        {
          if (!("type" in notification))
            notification.type = notification.severity;
          delete notification.severity;
        }
      }
      Prefs.notificationdata.data = data;
    }
    catch (e)
    {
      Cu.reportError(e);
      errorCallback("synchronize_invalid_data");
      return;
    }

    Prefs.notificationdata.lastError = 0;
    Prefs.notificationdata.downloadStatus = "synchronize_ok";
    [
      Prefs.notificationdata.softExpiration,
      Prefs.notificationdata.hardExpiration
    ] = downloader.processExpirationInterval(EXPIRATION_INTERVAL);
    Prefs.notificationdata.downloadCount = downloadable.downloadCount;
    saveNotificationData();

    Notification.showNext();
  },

  _onDownloadError(downloadable, downloadURL, error, channelStatus,
                   responseStatus, redirectCallback)
  {
    Prefs.notificationdata.lastError = Date.now();
    Prefs.notificationdata.downloadStatus = error;
    saveNotificationData();
  },

  /**
   * Adds a listener for notifications to be shown.
   * @param {Function} listener Listener to be invoked when a notification is
   *                   to be shown
   */
  addShowListener(listener)
  {
    if (showListeners.indexOf(listener) == -1)
      showListeners.push(listener);
  },

  /**
   * Removes the supplied listener.
   * @param {Function} listener Listener that was added via addShowListener()
   */
  removeShowListener(listener)
  {
    let index = showListeners.indexOf(listener);
    if (index != -1)
      showListeners.splice(index, 1);
  },

  /**
   * Determines which notification is to be shown next.
   * @param {string} url URL to match notifications to (optional)
   * @return {Object} notification to be shown, or null if there is none
   */
  _getNextToShow(url)
  {
    let remoteData = [];
    if (typeof Prefs.notificationdata.data == "object" &&
        Prefs.notificationdata.data.notifications instanceof Array)
    {
      remoteData = Prefs.notificationdata.data.notifications;
    }

    let notifications = localData.concat(remoteData);
    if (notifications.length === 0)
      return null;

    const {addonName, addonVersion, application,
           applicationVersion, platform, platformVersion} = __webpack_require__(3);

    let targetChecks = {
      extension: v => v == addonName,
      extensionMinVersion:
        v => compareVersion(addonVersion, v) >= 0,
      extensionMaxVersion:
        v => compareVersion(addonVersion, v) <= 0,
      application: v => v == application,
      applicationMinVersion:
        v => compareVersion(applicationVersion, v) >= 0,
      applicationMaxVersion:
        v => compareVersion(applicationVersion, v) <= 0,
      platform: v => v == platform,
      platformMinVersion:
        v => compareVersion(platformVersion, v) >= 0,
      platformMaxVersion:
        v => compareVersion(platformVersion, v) <= 0,
      blockedTotalMin: v => Prefs.show_statsinpopup &&
        Prefs.blocked_total >= v,
      blockedTotalMax: v => Prefs.show_statsinpopup &&
        Prefs.blocked_total <= v,
      locales: v => v.includes(Utils.appLocale)
    };

    let notificationToShow = null;
    for (let notification of notifications)
    {
      if (typeof notification.type === "undefined" ||
          notification.type !== "critical")
      {
        let shown;
        if (typeof Prefs.notificationdata.shown == "object")
          shown = Prefs.notificationdata.shown[notification.id];

        if (typeof shown != "undefined")
        {
          if (typeof notification.interval == "number")
          {
            if (shown + notification.interval > Date.now())
              continue;
          }
          else if (shown)
            continue;
        }

        if (notification.type !== "relentless" &&
            Prefs.notifications_ignoredcategories.indexOf("*") != -1)
        {
          continue;
        }
      }

      if (typeof url === "string" || notification.urlFilters instanceof Array)
      {
        if (Prefs.enabled && typeof url === "string" &&
            notification.urlFilters instanceof Array)
        {
          let host;
          try
          {
            host = new URL(url).hostname;
          }
          catch (e)
          {
            host = "";
          }

          let exception = defaultMatcher.matchesAny(
            url, RegExpFilter.typeMap.DOCUMENT, host, false, null
          );
          if (exception instanceof WhitelistFilter)
            continue;

          let matcher = new Matcher();
          for (let urlFilter of notification.urlFilters)
            matcher.add(Filter.fromText(urlFilter));
          if (!matcher.matchesAny(url, RegExpFilter.typeMap.DOCUMENT, host,
              false, null))
          {
            continue;
          }
        }
        else
          continue;
      }

      if (notification.targets instanceof Array)
      {
        let match = false;

        for (let target of notification.targets)
        {
          if (Object.keys(target).every(key =>
              targetChecks.hasOwnProperty(key) &&
              targetChecks[key](target[key])))
          {
            match = true;
            break;
          }
        }
        if (!match)
        {
          continue;
        }
      }

      if (!notificationToShow ||
          getNumericalSeverity(notification) >
            getNumericalSeverity(notificationToShow))
        notificationToShow = notification;
    }

    return notificationToShow;
  },

  /**
   * Invokes the listeners added via addShowListener() with the next
   * notification to be shown.
   * @param {string} url URL to match notifications to (optional)
   */
  showNext(url)
  {
    let notification = Notification._getNextToShow(url);
    if (notification)
    {
      for (let showListener of showListeners)
        showListener(notification);
    }
  },

  /**
   * Marks a notification as shown.
   * @param {string} id ID of the notification to be marked as shown
   */
  markAsShown(id)
  {
    let now = Date.now();
    let data = Prefs.notificationdata;

    if (data.shown instanceof Array)
    {
      let newShown = {};
      for (let oldId of data.shown)
        newShown[oldId] = now;
      data.shown = newShown;
    }

    if (typeof data.shown != "object")
      data.shown = {};

    data.shown[id] = now;

    saveNotificationData();
  },

  /**
   * Localizes the texts of the supplied notification.
   * @param {Object} notification notification to translate
   * @return {Object} the translated texts
   */
  getLocalizedTexts(notification)
  {
    let textKeys = ["title", "message"];
    let localizedTexts = {};
    for (let key of textKeys)
    {
      if (key in notification)
      {
        if (typeof notification[key] == "string")
          localizedTexts[key] = notification[key];
        else
          localizedTexts[key] = localize(notification[key], Utils.appLocale);
      }
    }
    return localizedTexts;
  },

  /**
   * Adds a local notification.
   * @param {Object} notification notification to add
   */
  addNotification(notification)
  {
    if (localData.indexOf(notification) == -1)
      localData.push(notification);
  },

  /**
   * Removes an existing local notification.
   * @param {Object} notification notification to remove
   */
  removeNotification(notification)
  {
    let index = localData.indexOf(notification);
    if (index > -1)
      localData.splice(index, 1);
  },

  /**
   * A callback function which listens to see if notifications were approved.
   *
   * @callback QuestionListener
   * @param {boolean} approved
   */

  /**
   * Adds a listener for question-type notifications
   * @param {string} id
   * @param {QuestionListener} listener
   */
  addQuestionListener(id, listener)
  {
    if (!(id in questionListeners))
      questionListeners[id] = [];
    if (questionListeners[id].indexOf(listener) === -1)
      questionListeners[id].push(listener);
  },

  /**
   * Removes a listener that was previously added via addQuestionListener
   * @param {string} id
   * @param {QuestionListener} listener
   */
  removeQuestionListener(id, listener)
  {
    if (!(id in questionListeners))
      return;
    let index = questionListeners[id].indexOf(listener);
    if (index > -1)
      questionListeners[id].splice(index, 1);
    if (questionListeners[id].length === 0)
      delete questionListeners[id];
  },

  /**
   * Notifies question listeners about interactions with a notification
   * @param {string} id notification ID
   * @param {boolean} approved indicator whether notification has been approved
   */
  triggerQuestionListeners(id, approved)
  {
    if (!(id in questionListeners))
      return;
    let listeners = questionListeners[id];
    for (let listener of listeners)
      listener(approved);
  },

  /**
   * Toggles whether notifications of a specific category should be ignored
   * @param {string} category notification category identifier
   * @param {boolean} [forceValue] force specified value
   */
  toggleIgnoreCategory(category, forceValue)
  {
    let categories = Prefs.notifications_ignoredcategories;
    let index = categories.indexOf(category);
    if (index == -1 && forceValue !== false)
    {
      categories.push(category);
      Prefs.notifications_showui = true;
    }
    else if (index != -1 && forceValue !== true)
      categories.splice(index, 1);

    // HACK: JSON values aren't saved unless they are assigned a
    // different object.
    Prefs.notifications_ignoredcategories =
      JSON.parse(JSON.stringify(categories));
  }
};
Notification.init();


/***/ }),
/* 17 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";
/*
 * This file is part of Adblock Plus <https://adblockplus.org/>,
 * Copyright (C) 2006-present eyeo GmbH
 *
 * Adblock Plus is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3 as
 * published by the Free Software Foundation.
 *
 * Adblock Plus is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with Adblock Plus.  If not, see <http://www.gnu.org/licenses/>.
 */

/** @module filterValidation */



const {Filter, InvalidFilter, ElemHideBase, ElemHideEmulationFilter,
       ElemHideException} = __webpack_require__(0);

/**
 * An error returned by
 * {@link module:filterValidation.parseFilter parseFilter()} or
 * {@link module:filterValidation.parseFilters parseFilters()}
 * indicating that a given filter cannot be parsed,
 * contains an invalid CSS selector or is a filter list header.
 *
 * @param {string} type See documentation in the constructor below.
 * @param {Object} [details] Contains the "reason" and / or "selector"
 *                           properties.
 * @constructor
 */
function FilterParsingError(type, details)
{
  /**
   * Indicates why the filter is rejected. Possible choices:
   * "invalid-filter", "invalid-css-selector", "unexpected-filter-list-header"
   *
   * @type {string}
   */
  this.type = type;

  if (details)
  {
    if ("reason" in details)
      this.reason = details.reason;
    if ("selector" in details)
      this.selector = details.selector;
  }
}
FilterParsingError.prototype = {
  /**
   * The line number the error occurred on if
   * {@link module:filterValidation.parseFilters parseFilters()}
   * were used. Or null if the error was returned by
   * {@link module:filterValidation.parseFilter parseFilter()}.
   *
   * @type {?number}
   */
  lineno: null,

  /**
   * Returns a detailed translated error message.
   *
   * @return {string}
   */
  toString()
  {
    let message;
    if (this.reason)
      message = browser.i18n.getMessage(this.reason);
    else
    {
      message = browser.i18n.getMessage(
        this.type.replace(/-/g, "_"),
        "selector" in this ? "'" + this.selector + "'" : null
      );
    }

    if (this.lineno)
    {
      message = browser.i18n.getMessage(
        "line", this.lineno.toLocaleString()
      ) + ": " + message;
    }
    return message;
  }
};

function isValidCSSSelector(selector)
{
  let style = document.createElement("style");
  document.documentElement.appendChild(style);
  let {sheet} = style;
  document.documentElement.removeChild(style);

  try
  {
    document.querySelector(selector);
    sheet.insertRule(selector + "{}", 0);
  }
  catch (e)
  {
    return false;
  }
  return true;
}

function isValidFilterSelector(filter)
{
  // Only ElemHideBase has selectors.
  if (!(filter instanceof ElemHideBase))
    return true;

  // We don't check the syntax of ElemHideEmulationFilter yet.
  if (filter instanceof ElemHideEmulationFilter)
    return true;

  // If it is an ElemHideException, and it has an extended CSS
  // selector we don't validate and assume it is valid.
  if (filter instanceof ElemHideException &&
      filter.selector.includes(":-abp-"))
  {
    return true;
  }

  return isValidCSSSelector(filter.selector);
}

/**
 * @typedef ParsedFilter
 * @property {?Filter} [filter]
 *   The parsed filter if it is valid. Or null if the given string is empty.
 * @property {FilterParsingError} [error]
 *   See {@link module:filterValidation~FilterParsingError FilterParsingError}
 */

let parseFilter =
/**
 * Parses and validates a filter given by the user.
 *
 * @param {string}  text
 * @return {ParsedFilter}
 */
exports.parseFilter = text =>
{
  let filter = null;
  text = Filter.normalize(text);

  if (text)
  {
    if (text[0] == "[")
      return {error: new FilterParsingError("unexpected-filter-list-header")};

    filter = Filter.fromText(text);

    if (filter instanceof InvalidFilter)
    {
      return {error: new FilterParsingError("invalid-filter",
                                            {reason: filter.reason})};
    }
    if (!isValidFilterSelector(filter))
    {
      return {error: new FilterParsingError("invalid-css-selector",
                                            {selector: filter.selector})};
    }
  }

  return {filter};
};

/**
 * @typedef ParsedFilters
 * @property {Filter[]} filters
 *   The parsed result without invalid filters.
 * @property {FilterParsingError[]} errors
 *   See {@link module:filterValidation~FilterParsingError FilterParsingError}
 */

/**
 * Parses and validates a newline-separated list of filters given by the user.
 *
 * @param {string}  text
 * @return {ParsedFilters}
 */
exports.parseFilters = text =>
{
  let lines = text.split("\n");
  let filters = [];
  let errors = [];

  for (let i = 0; i < lines.length; i++)
  {
    let {filter, error} = parseFilter(lines[i]);

    if (filter)
      filters.push(filter);

    if (error)
    {
      error.lineno = i + 1;
      errors.push(error);
    }
  }

  return {filters, errors};
};


/***/ }),
/* 18 */
/***/ (function(module, exports) {

let LocalCDN = exports.LocalCDN = (function() {
  "use-strict";

  var urlsMatchPattern = ["http://*/*", "https://*/*"];
  var hostRegex = /ajax\.googleapis\.com|ajax\.aspnetcdn\.com|ajax\.microsoft\.com|cdnjs\.cloudflare\.com|code\.jquery\.com|cdn\.jsdelivr\.net|yastatic\.net|yandex\.st|libs\.baidu\.com|lib\.sinaapp\.com|upcdn\.b0\.upaiyun\.com/;
  var pathRegex = { jquery: /jquery[\/\-](\d*\.\d*\.\d*)/ };
  var libraryPaths = { jquery: { prefix: "jquery-", postfix: ".min.js.local" }};
  var headersToRemove = ["Cookie", "Origin", "Referer"];
  var localFiles = {};
  var libraries = [];
  var versionArray = {};
  var redirectCountKey = "redirectCount";
  var dataCountKey = "redirectDataCount";
  var missedVersionsKey = "missedVersions";

  // Completes necessary set up for the LocalCDN
  // Post:  localFiles, libraries, and versionArray are populated based on
  //        available local files
  var setUp = function() {
    localFiles = getAvailableFiles();
    libraries = Object.getOwnPropertyNames(localFiles);
    versionArray = populateVersionArray();
  };

  // Populates the version array based on the files available locally
  // Pre: localFiles and libraries must be populated first
  var populateVersionArray = function() {
    var libraryVersions = {};
    // go through each libarary
    for (var i = 0; i < libraries.length; i++) {
      // check for path info
      if (libraryPaths[libraries[i]]) {
        // get the filenames
        var filenames = Object.getOwnPropertyNames(localFiles[libraries[i]]);
        libraryVersions[libraries[i]] = [];
        for (var j = 0; j < filenames.length; j++){
          // extract the version from the filesname
          var version = filenames[j].replace(libraryPaths[libraries[i]].prefix, "");
          version = version.replace(libraryPaths[libraries[i]].postfix, "");
          libraryVersions[libraries[i]].push(version);
        }
      }
    }

    return libraryVersions;
  };

  // Handles a webRequest.onBeforeRequest event.
  // Redirects any requests for locally available files from a matching host,
  // if AdBlock is not paused. Otherwise allows request to continue as normal.
  // Records any redirects, bytes of data redirected, and missing versions of
  // supported libararies.
  // Param: details: holds information about the request, including the URL.
  var libRequestHandler = function(details) {
    // respect pause
    if (!adblockIsPaused()) {
      var targetLibrary = null;
      var requestUrl = parseUri(details.url);

      // check if the url contains a library keyword
      for (var i = 0; i < libraries.length; i++) {
        if (requestUrl.pathname.indexOf(libraries[i]) != -1) {
          targetLibrary = libraries[i];
        }
      }

      // check the request host
      if (targetLibrary != null && hostRegex.test(requestUrl.host)) {
        // check the path
        var matches = pathRegex[targetLibrary].exec(requestUrl.pathname);
        if (matches) {
          var version = matches[1];

          // check if we have the version locally
          if (versionArray[targetLibrary].indexOf(version) != -1) {
            var fileName = libraryPaths[targetLibrary].prefix + version + libraryPaths[targetLibrary].postfix;
            var localPath = "localLib/" + targetLibrary + "/" + fileName;
            incrementRedirectCount();
            addToDataCount(targetLibrary, fileName);
            return { redirectUrl: chrome.runtime.getURL(localPath) };
          } else {
            addMissedVersion(targetLibrary, version);
          }
        }
      }
    }

    return { cancel: false };
  };

  // Increments the redirect count by one.
  // The redirect count is loaded from and saved to localStorage.
  var incrementRedirectCount = function() {
    // get stored redirect count
    var storedRedirectCount = getStoredValue(redirectCountKey, 0);

    // increment
    storedRedirectCount++;

    // store updated count
    localStorage.setItem(redirectCountKey, JSON.stringify(storedRedirectCount));
  };

  // Adds the size of the specified file to the data count for that library.
  // The data count is loaded from and saved to localStorage.
  // Param: targetLibrary: the library that the file belongs to
  //        fileName: the file to be added to the data count
  var addToDataCount = function(targetLibrary, fileName) {
    // get stored redirect count
    var storedDataCount = getStoredValue(dataCountKey, 0);

    // add file size to data count
    storedDataCount = storedDataCount + localFiles[targetLibrary][fileName];

    // store updated count
    localStorage.setItem(dataCountKey, JSON.stringify(storedDataCount));
  };

  // Adds the specified version of the specified library to the missed versions
  // object, if it hasn't already been added. Otherwise increments the count for
  // that version.
  // The missed versions object is loaded from and saved to localStorage.
  // Param: targetLibrary: the library that the missing version belongs to
  //        version: the missing version to be added
  var addMissedVersion = function(targetLibrary, version) {
    // get stored missed versions
    var storedMissedVersions = getStoredValue(missedVersionsKey, {});

    // add new missed version
    if (!storedMissedVersions[targetLibrary]) {
      storedMissedVersions[targetLibrary] = {};
    }
    if (storedMissedVersions[targetLibrary][version] > 0) {
      storedMissedVersions[targetLibrary][version] = storedMissedVersions[targetLibrary][version] + 1;
    } else {
      storedMissedVersions[targetLibrary][version] = 1;
    }

    // store updated missed versions
    localStorage.setItem(missedVersionsKey, JSON.stringify(storedMissedVersions));
  };

  // Gets a stored value from localStorage if available, and parses it. Otherwise,
  // if the value isn't currently stored or if the parse fails, returns a default
  // value.
  // Param: keyName: the key under which the value is stored
  //        defaultValue: the value to be returned if the stored value cannot be
  //                      retrieved
  var getStoredValue = function(keyName, defaultValue) {
    var storedValue = localStorage.getItem(keyName);
    try {
      storedValue = JSON.parse(storedValue);
    } catch(err) {
      storedValue = defaultValue;
    } finally {
      if (!storedValue) {
        storedValue = defaultValue;
      }
      return storedValue;
    }
  };

  // Handles a webrequest.onBeforeSendHeaders event.
  // Strips the cookie, origin, and referer headers (if present) from any requests for
  // a supported libarary from a matching host, if AdBlock is not paused. Otherwise
  // allows request to continue as normal.
  // Param: details: holds information about the request, including the URL and request
  //                 headers
  var stripMetadataHandler = function(details) {
    // respect pause
    if (!adblockIsPaused()) {
      var requestUrl = parseUri(details.url);
      var match = false;

      // check if the url contains a library keyword
      for (var k = 0; k < libraries.length; k++) {
        if (requestUrl.pathname.indexOf(libraries[k]) != -1) {
          match = true;
        }
      }

      // check for a matching host
      if (match && hostRegex.test(requestUrl.host)) {
        // strip the headers to remove, if present
        for (var i = 0; i < details.requestHeaders.length; i++) {
          var aHeader = details.requestHeaders[i].name;
          if (aHeader === headersToRemove[0] || aHeader === headersToRemove[1] || aHeader === headersToRemove[2]) {
            details.requestHeaders.splice(i--, 1);
          }
        }
      }
    }

    return {requestHeaders: details.requestHeaders};
  };

  // Sets redirect count, data count, and missed versions back to default
  // (0 for redirect count and data count, and an empty object for missed
  // versions)
  var resetCollectedData = function() {
    localStorage.setItem(redirectCountKey, "0");
    localStorage.setItem(dataCountKey, "0");
    localStorage.setItem(missedVersionsKey, "{}");
  };

  return {
    setUp: setUp,
    // Starts the LocalCDN listeners
    start: function() {
      chrome.webRequest.onBeforeRequest.addListener(libRequestHandler, { urls: urlsMatchPattern }, ["blocking"]);
      chrome.webRequest.onBeforeSendHeaders.addListener(stripMetadataHandler, { urls: urlsMatchPattern }, ["blocking", "requestHeaders"]);
    },
    // Stops the LocalCDN listeners and reset data
    end: function() {
      chrome.webRequest.onBeforeRequest.removeListener(libRequestHandler);
      chrome.webRequest.onBeforeSendHeaders.removeListener(stripMetadataHandler);
      resetCollectedData();
    },
    // Gets the redirect count as a number of redirects
    getRedirectCount: function() {
      return getStoredValue(redirectCountKey, 0);
    },
    // Gets the data count as a number of bytes
    getDataCount: function() {
      return getStoredValue(dataCountKey, 0);
    },
    // Gets the missed versions object, which includes a count of how many
    // times the missed version has been requested
    getMissedVersions: function() {
      return getStoredValue(missedVersionsKey, {});
    }
  };
})();

/***/ }),
/* 19 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";
/*
 * This file is part of Adblock Plus <https://adblockplus.org/>,
 * Copyright (C) 2006-present eyeo GmbH
 *
 * Adblock Plus is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3 as
 * published by the Free Software Foundation.
 *
 * Adblock Plus is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with Adblock Plus.  If not, see <http://www.gnu.org/licenses/>.
 */



function desc(properties)
{
  let descriptor = {};
  let keys = Object.keys(properties);

  for (let key of keys)
    descriptor[key] = Object.getOwnPropertyDescriptor(properties, key);

  return descriptor;
}
exports.desc = desc;

function extend(cls, properties)
{
  return Object.create(cls.prototype, desc(properties));
}
exports.extend = extend;

function findIndex(iterable, callback, thisArg)
{
  let index = 0;
  for (let item of iterable)
  {
    if (callback.call(thisArg, item))
      return index;

    index++;
  }

  return -1;
}
exports.findIndex = findIndex;

function indexOf(iterable, searchElement)
{
  return findIndex(iterable, item => item === searchElement);
}
exports.indexOf = indexOf;


/***/ }),
/* 20 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";
/*
 * This file is part of Adblock Plus <https://adblockplus.org/>,
 * Copyright (C) 2006-present eyeo GmbH
 *
 * Adblock Plus is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3 as
 * published by the Free Software Foundation.
 *
 * Adblock Plus is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with Adblock Plus.  If not, see <http://www.gnu.org/licenses/>.
 */



/**
 * @fileOverview Element hiding emulation implementation.
 */

const {ElemHide} = __webpack_require__(14);
const {Filter} = __webpack_require__(0);

let filters = new Set();

/**
 * Container for element hiding emulation filters
 * @class
 */
let ElemHideEmulation = {
  /**
   * Removes all known filters
   */
  clear()
  {
    filters.clear();
  },

  /**
   * Add a new element hiding emulation filter
   * @param {ElemHideEmulationFilter} filter
   */
  add(filter)
  {
    filters.add(filter.text);
  },

  /**
   * Removes an element hiding emulation filter
   * @param {ElemHideEmulationFilter} filter
   */
  remove(filter)
  {
    filters.delete(filter.text);
  },

  /**
   * Returns a list of all rules active on a particular domain
   * @param {string} domain
   * @return {ElemHideEmulationFilter[]}
   */
  getRulesForDomain(domain)
  {
    let result = [];
    for (let text of filters.values())
    {
      let filter = Filter.fromText(text);
      if (filter.isActiveOnDomain(domain) &&
          !ElemHide.getException(filter, domain))
      {
        result.push(filter);
      }
    }
    return result;
  }
};
exports.ElemHideEmulation = ElemHideEmulation;


/***/ }),
/* 21 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";
/*
 * This file is part of Adblock Plus <https://adblockplus.org/>,
 * Copyright (C) 2006-present eyeo GmbH
 *
 * Adblock Plus is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3 as
 * published by the Free Software Foundation.
 *
 * Adblock Plus is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with Adblock Plus.  If not, see <http://www.gnu.org/licenses/>.
 */

/** @module stats */



const {Prefs} = __webpack_require__(2);
const {BlockingFilter} = __webpack_require__(0);
const {FilterNotifier} = __webpack_require__(1);
const {port} = __webpack_require__(7);

const badgeColor = "#646464";
let blockedPerPage = new ext.PageMap();

let getBlockedPerPage =
/**
 * Gets the number of requests blocked on the given page.
 *
 * @param  {Page} page
 * @return {Number}
 */
exports.getBlockedPerPage = page => blockedPerPage.get(page) || 0;

function updateBadge(page, blockedCount)
{
  if (Prefs.show_statsinicon)
  {
    page.browserAction.setBadge(blockedCount && {
      color: badgeColor,
      number: blockedCount
    });
  }
}

// Once nagivation for the tab has been committed to (e.g. it's no longer
// being prerendered) we clear its badge, or if some requests were already
// blocked beforehand we display those on the badge now.
browser.webNavigation.onCommitted.addListener(details =>
{
  if (details.frameId == 0)
  {
    let page = new ext.Page({id: details.tabId});
    let blocked = blockedPerPage.get(page);

    updateBadge(page, blocked);
  }
});

FilterNotifier.on("filter.hitCount", (filter, newValue, oldValue, tabIds) =>
{
  if (!(filter instanceof BlockingFilter))
    return;

  for (let tabId of tabIds)
  {
    let page = new ext.Page({id: tabId});
    let blocked = blockedPerPage.get(page) || 0;

    blockedPerPage.set(page, ++blocked);
    updateBadge(page, blocked);
  }

  Prefs.blocked_total++;
});

Prefs.on("show_statsinicon", () =>
{
  browser.tabs.query({}, tabs =>
  {
    for (let tab of tabs)
    {
      let page = new ext.Page(tab);

      if (Prefs.show_statsinicon)
        updateBadge(page, blockedPerPage.get(page));
      else
        page.browserAction.setBadge(null);
    }
  });
});

port.on("stats.getBlockedPerPage",
        message => getBlockedPerPage(new ext.Page(message.tab)));


/***/ }),
/* 22 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";
/*
 * This file is part of Adblock Plus <https://adblockplus.org/>,
 * Copyright (C) 2006-present eyeo GmbH
 *
 * Adblock Plus is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3 as
 * published by the Free Software Foundation.
 *
 * Adblock Plus is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with Adblock Plus.  If not, see <http://www.gnu.org/licenses/>.
 */



/**
 * @fileOverview Downloads a set of URLs in regular time intervals.
 */

const {Utils} = __webpack_require__(10);

const MILLIS_IN_SECOND = exports.MILLIS_IN_SECOND = 1000;
const MILLIS_IN_MINUTE = exports.MILLIS_IN_MINUTE = 60 * MILLIS_IN_SECOND;
const MILLIS_IN_HOUR = exports.MILLIS_IN_HOUR = 60 * MILLIS_IN_MINUTE;
const MILLIS_IN_DAY = exports.MILLIS_IN_DAY = 24 * MILLIS_IN_HOUR;

let Downloader =
/**
 * Creates a new downloader instance.
 * @param {Function} dataSource
 *   Function that will yield downloadable objects on each check
 * @param {number} initialDelay
 *   Number of milliseconds to wait before the first check
 * @param {number} checkInterval
 *   Interval between the checks
 * @constructor
 */
exports.Downloader = function(dataSource, initialDelay, checkInterval)
{
  this.dataSource = dataSource;
  this._timer = Cc["@mozilla.org/timer;1"].createInstance(Ci.nsITimer);
  this._timer.initWithCallback(() =>
  {
    this._timer.delay = checkInterval;
    this._doCheck();
  }, initialDelay, Ci.nsITimer.TYPE_REPEATING_SLACK);
  this._downloading = new Set();
};
Downloader.prototype =
{
  /**
   * Timer triggering the downloads.
   * @type {nsITimer}
   */
  _timer: null,

  /**
   * Set containing the URLs of objects currently being downloaded.
   * @type {Set.<string>}
   */
  _downloading: null,

  /**
   * Function that will yield downloadable objects on each check.
   * @type {Function}
   */
  dataSource: null,

  /**
   * Maximal time interval that the checks can be left out until the soft
   * expiration interval increases.
   * @type {number}
   */
  maxAbsenceInterval: 1 * MILLIS_IN_DAY,

  /**
   * Minimal time interval before retrying a download after an error.
   * @type {number}
   */
  minRetryInterval: 1 * MILLIS_IN_DAY,

  /**
   * Maximal allowed expiration interval, larger expiration intervals will be
   * corrected.
   * @type {number}
   */
  maxExpirationInterval: 14 * MILLIS_IN_DAY,

  /**
   * Maximal number of redirects before the download is considered as failed.
   * @type {number}
   */
  maxRedirects: 5,

  /**
   * Called whenever expiration intervals for an object need to be adapted.
   * @type {Function}
   */
  onExpirationChange: null,

  /**
   * Callback to be triggered whenever a download starts.
   * @type {Function}
   */
  onDownloadStarted: null,

  /**
   * Callback to be triggered whenever a download finishes successfully. The
   * callback can return an error code to indicate that the data is wrong.
   * @type {Function}
   */
  onDownloadSuccess: null,

  /**
   * Callback to be triggered whenever a download fails.
   * @type {Function}
   */
  onDownloadError: null,

  /**
   * Checks whether anything needs downloading.
   */
  _doCheck()
  {
    let now = Date.now();
    for (let downloadable of this.dataSource())
    {
      if (downloadable.lastCheck &&
          now - downloadable.lastCheck > this.maxAbsenceInterval)
      {
        // No checks for a long time interval - user must have been offline,
        // e.g.  during a weekend. Increase soft expiration to prevent load
        // peaks on the server.
        downloadable.softExpiration += now - downloadable.lastCheck;
      }
      downloadable.lastCheck = now;

      // Sanity check: do expiration times make sense? Make sure people changing
      // system clock don't get stuck with outdated subscriptions.
      if (downloadable.hardExpiration - now > this.maxExpirationInterval)
        downloadable.hardExpiration = now + this.maxExpirationInterval;
      if (downloadable.softExpiration - now > this.maxExpirationInterval)
        downloadable.softExpiration = now + this.maxExpirationInterval;

      // Notify the caller about changes to expiration parameters
      if (this.onExpirationChange)
        this.onExpirationChange(downloadable);

      // Does that object need downloading?
      if (downloadable.softExpiration > now &&
          downloadable.hardExpiration > now)
      {
        continue;
      }

      // Do not retry downloads too often
      if (downloadable.lastError &&
          now - downloadable.lastError < this.minRetryInterval)
      {
        continue;
      }

      this._download(downloadable, 0);
    }
  },

  /**
   * Stops the periodic checks.
   */
  cancel()
  {
    this._timer.cancel();
  },

  /**
   * Checks whether an address is currently being downloaded.
   * @param {string} url
   * @return {boolean}
   */
  isDownloading(url)
  {
    return this._downloading.has(url);
  },

  /**
   * Starts downloading for an object.
   * @param {Downloadable} downloadable
   */
  download(downloadable)
  {
    // Make sure to detach download from the current execution context
    Utils.runAsync(this._download.bind(this, downloadable, 0));
  },

  /**
   * Generates the real download URL for an object by appending various
   * parameters.
   * @param {Downloadable} downloadable
   * @return {string}
   */
  getDownloadUrl(downloadable)
  {
    const {addonName, addonVersion, application, applicationVersion,
           platform, platformVersion} = __webpack_require__(3);
    let url = downloadable.redirectURL || downloadable.url;
    if (url.indexOf("?") >= 0)
      url += "&";
    else
      url += "?";
    // We limit the download count to 4+ to keep the request anonymized
    let {downloadCount} = downloadable;
    if (downloadCount > 4)
      downloadCount = "4+";
    url += "addonName=" + encodeURIComponent(addonName) +
        "&addonVersion=" + encodeURIComponent(addonVersion) +
        "&application=" + encodeURIComponent(application) +
        "&applicationVersion=" + encodeURIComponent(applicationVersion) +
        "&platform=" + encodeURIComponent(platform) +
        "&platformVersion=" + encodeURIComponent(platformVersion) +
        "&lastVersion=" + encodeURIComponent(downloadable.lastVersion) +
        "&downloadCount=" + encodeURIComponent(downloadCount);
    return url;
  },

  _download(downloadable, redirects)
  {
    if (this.isDownloading(downloadable.url))
      return;

    let downloadUrl = this.getDownloadUrl(downloadable);
    let request = null;

    let errorCallback = function errorCallback(error)
    {
      let channelStatus = -1;
      try
      {
        channelStatus = request.channel.status;
      }
      catch (e) {}

      let responseStatus = request.status;

      Cu.reportError("Adblock Plus: Downloading URL " + downloadable.url +
                     " failed (" + error + ")\n" +
                     "Download address: " + downloadUrl + "\n" +
                     "Channel status: " + channelStatus + "\n" +
                     "Server response: " + responseStatus);

      if (this.onDownloadError)
      {
        // Allow one extra redirect if the error handler gives us a redirect URL
        let redirectCallback = null;
        if (redirects <= this.maxRedirects)
        {
          redirectCallback = url =>
          {
            downloadable.redirectURL = url;
            this._download(downloadable, redirects + 1);
          };
        }

        this.onDownloadError(downloadable, downloadUrl, error, channelStatus,
                             responseStatus, redirectCallback);
      }
    }.bind(this);

    try
    {
      request = new XMLHttpRequest();
      request.mozBackgroundRequest = true;
      request.open("GET", downloadUrl);
    }
    catch (e)
    {
      errorCallback("synchronize_invalid_url");
      return;
    }

    try
    {
      request.overrideMimeType("text/plain");
      request.channel.loadFlags = request.channel.loadFlags |
                                  request.channel.INHIBIT_CACHING |
                                  request.channel.VALIDATE_ALWAYS;

      // Override redirect limit from preferences, user might have set it to 1
      if (request.channel instanceof Ci.nsIHttpChannel)
        request.channel.redirectionLimit = this.maxRedirects;
    }
    catch (e)
    {
      Cu.reportError(e);
    }

    request.addEventListener("error", event =>
    {
      if (onShutdown.done)
        return;

      this._downloading.delete(downloadable.url);
      errorCallback("synchronize_connection_error");
    }, false);

    request.addEventListener("load", event =>
    {
      if (onShutdown.done)
        return;

      this._downloading.delete(downloadable.url);

      // Status will be 0 for non-HTTP requests
      if (request.status && request.status != 200)
      {
        errorCallback("synchronize_connection_error");
        return;
      }

      downloadable.downloadCount++;

      this.onDownloadSuccess(
        downloadable, request.responseText, errorCallback,
        url =>
        {
          if (redirects >= this.maxRedirects)
            errorCallback("synchronize_connection_error");
          else
          {
            downloadable.redirectURL = url;
            this._download(downloadable, redirects + 1);
          }
        }
      );
    });

    request.send(null);

    this._downloading.add(downloadable.url);
    if (this.onDownloadStarted)
      this.onDownloadStarted(downloadable);
  },

  /**
   * Produces a soft and a hard expiration interval for a given supplied
   * expiration interval.
   * @param {number} interval
   * @return {Array} soft and hard expiration interval
   */
  processExpirationInterval(interval)
  {
    interval = Math.min(Math.max(interval, 0), this.maxExpirationInterval);
    let soft = Math.round(interval * (Math.random() * 0.4 + 0.8));
    let hard = interval * 2;
    let now = Date.now();
    return [now + soft, now + hard];
  }
};

/**
 * An object that can be downloaded by the downloadable
 * @param {string} url  URL that has to be requested for the object
 * @constructor
 */
let Downloadable = exports.Downloadable = function Downloadable(url)
{
  this.url = url;
};
Downloadable.prototype =
{
  /**
   * URL that has to be requested for the object.
   * @type {string}
   */
  url: null,

  /**
   * URL that the download was redirected to if any.
   * @type {string}
   */
  redirectURL: null,

  /**
   * Time of last download error or 0 if the last download was successful.
   * @type {number}
   */
  lastError: 0,

  /**
   * Time of last check whether the object needs downloading.
   * @type {number}
   */
  lastCheck: 0,

  /**
   * Object version corresponding to the last successful download.
   * @type {number}
   */
  lastVersion: 0,

  /**
   * Soft expiration interval, will increase if no checks are performed for a
   * while.
   * @type {number}
   */
  softExpiration: 0,

  /**
   * Hard expiration interval, this is fixed.
   * @type {number}
   */
  hardExpiration: 0,

  /**
   * Number indicating how often the object was downloaded.
   * @type {number}
   */
  downloadCount: 0
};


/***/ }),
/* 23 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";
/*
 * This file is part of Adblock Plus <https://adblockplus.org/>,
 * Copyright (C) 2006-present eyeo GmbH
 *
 * Adblock Plus is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3 as
 * published by the Free Software Foundation.
 *
 * Adblock Plus is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with Adblock Plus.  If not, see <http://www.gnu.org/licenses/>.
 */

/** @module requestBlocker */



const {Filter, RegExpFilter, BlockingFilter} =
  __webpack_require__(0);
const {Subscription} = __webpack_require__(5);
const {defaultMatcher} = __webpack_require__(9);
const {FilterNotifier} = __webpack_require__(1);
const {Prefs} = __webpack_require__(2);
const {checkWhitelisted, getKey} = __webpack_require__(8);
const {extractHostFromFrame, isThirdParty} = __webpack_require__(6);
const {port} = __webpack_require__(7);
const {logRequest: hitLoggerLogRequest} = __webpack_require__(11);

const extensionProtocol = new URL(browser.extension.getURL("")).protocol;

// Chrome can't distinguish between OBJECT_SUBREQUEST and OBJECT requests.
if (!browser.webRequest.ResourceType ||
    !("OBJECT_SUBREQUEST" in browser.webRequest.ResourceType))
{
  RegExpFilter.typeMap.OBJECT_SUBREQUEST = RegExpFilter.typeMap.OBJECT;
}

// Map of content types reported by the browser to the respecitve content types
// used by Adblock Plus. Other content types are simply mapped to OTHER.
let resourceTypes = new Map(function*()
{
  for (let type in RegExpFilter.typeMap)
    yield [type.toLowerCase(), type];

  yield ["sub_frame", "SUBDOCUMENT"];

  // Treat navigator.sendBeacon() the same as <a ping>, it's essentially the
  // same concept - merely generalized.
  yield ["beacon", "PING"];

  // Treat <img srcset> and <picture> the same as other images.
  yield ["imageset", "IMAGE"];
}());

exports.filterTypes = new Set(function*()
{
  // Microsoft Edge does not have webRequest.ResourceType or the devtools panel.
  // Since filterTypes is only used by devtools, we can just bail out here.
  if (!(browser.webRequest.ResourceType))
    return;

  for (let type in browser.webRequest.ResourceType)
    yield resourceTypes.get(browser.webRequest.ResourceType[type]) || "OTHER";

  // WEBRTC gets addressed through a workaround, even if the webRequest API is
  // lacking support to block this kind of a request.
  yield "WEBRTC";

  // POPUP, CSP and ELEMHIDE filters aren't mapped to resource types.
  yield "POPUP";
  yield "ELEMHIDE";
  yield "CSP";
}());

function getDocumentInfo(page, frame, originUrl)
{
  return [
    extractHostFromFrame(frame, originUrl),
    getKey(page, frame, originUrl),
    !!checkWhitelisted(page, frame, originUrl,
                       RegExpFilter.typeMap.GENERICBLOCK)
  ];
}

function matchRequest(url, type, docDomain, sitekey, specificOnly)
{
  let thirdParty = isThirdParty(url, docDomain);
  let filter = defaultMatcher.matchesAny(url.href, RegExpFilter.typeMap[type],
                                         docDomain, thirdParty,
                                         sitekey, specificOnly);
  return [filter, thirdParty];
}

function getRelatedTabIds(details)
{
  // This is the common case, the request is associated with a single tab.
  // If tabId is -1, its not (e.g. the request was sent by
  // a Service/Shared Worker) and we have to identify the related tabs.
  if (details.tabId != -1)
    return Promise.resolve([details.tabId]);

  let url;                    // Firefox provides "originUrl" indicating the
  if (details.originUrl)      // URL of the tab that caused this request.
    url = details.originUrl;  // In case of Service/Shared Worker, this is the
                              // URL of the tab that caused the worker to spawn.

  else if (details.initiator && details.initiator != "null")
    url = details.initiator + "/*";  // Chromium >=63 provides "intiator" which
                                     // is equivalent to "originUrl" on Firefox
                                     // except that its not a full URL but just
                                     // an origin (proto + host).
  else
    return Promise.resolve([]);

  return browser.tabs.query({url}).then(tabs => tabs.map(tab => tab.id));
}

function logRequest(tabIds, request, filter)
{
  if (filter)
    FilterNotifier.emit("filter.hitCount", filter, 0, 0, tabIds);

  hitLoggerLogRequest(tabIds, request, filter);
}

browser.webRequest.onBeforeRequest.addListener(details =>
{
  // Never block top-level documents.
  if (details.type == "main_frame")
    return;

  // Filter out requests from non web protocols. Ideally, we'd explicitly
  // specify the protocols we are interested in (i.e. http://, https://,
  // ws:// and wss://) with the url patterns, given below, when adding this
  // listener. But unfortunately, Chrome <=57 doesn't support the WebSocket
  // protocol and is causing an error if it is given.
  let url = new URL(details.url);
  if (url.protocol != "http:" && url.protocol != "https:" &&
      url.protocol != "ws:" && url.protocol != "wss:")
    return;

  // Firefox provides us with the full origin URL, while Chromium (>=63)
  // provides only the protocol + host of the (top-level) document which
  // the request originates from through the "initiator" property.
  let originUrl = null;
  if (details.originUrl)
    originUrl = new URL(details.originUrl);
  else if (details.initiator && details.initiator != "null")
    originUrl = new URL(details.initiator);

  // Ignore requests sent by extensions or by Firefox itself:
  // * Firefox intercepts requests sent by any extensions, indicated with
  //   an "originURL" starting with "moz-extension:".
  // * Chromium intercepts requests sent by this extension only, indicated
  //   on Chromium >=63 with an "initiator" starting with "chrome-extension:".
  // * On Firefox, requests that don't relate to any document or extension are
  //   indicated with an "originUrl" starting with "chrome:".
  if (originUrl && (originUrl.protocol == extensionProtocol ||
                    originUrl.protocol == "chrome:"))
    return;

  let page = new ext.Page({id: details.tabId});
  let frame = ext.getFrame(
    details.tabId,
    // We are looking for the frame that contains the element which
    // has triggered this request. For most requests (e.g. images) we
    // can just use the request's frame ID, but for subdocument requests
    // (e.g. iframes) we must instead use the request's parent frame ID.
    details.type == "sub_frame" ? details.parentFrameId : details.frameId
  );

  // On Chromium >= 63, if both the frame is unknown and we haven't get
  // an "initiator", this implies a request sent by the browser itself
  // (on older versions of Chromium, due to the lack of "initiator",
  // this can also indicate a request sent by a Shared/Service Worker).
  if (!frame && !originUrl)
    return;

  if (checkWhitelisted(page, frame, originUrl))
    return;

  let type = resourceTypes.get(details.type) || "OTHER";
  let [docDomain, sitekey, specificOnly] = getDocumentInfo(page, frame,
                                                           originUrl);
  let [filter, thirdParty] = matchRequest(url, type, docDomain,
                                          sitekey, specificOnly);

  let result;
  let rewrittenUrl;

  if (filter instanceof BlockingFilter)
  {
    if (filter.rewrite)
    {
      rewrittenUrl = filter.rewriteUrl(details.url);
      // If no rewrite happened (error, different origin), we'll
      // return undefined in order to avoid an "infinite" loop.
      if (rewrittenUrl != details.url)
        result = {redirectUrl: rewrittenUrl};
    }
    else
      result = {cancel: true};
  }

  getRelatedTabIds(details).then(tabIds =>
  {
    logRequest(
      tabIds,
      {
        url: details.url, type, docDomain, thirdParty,
        sitekey, specificOnly, rewrittenUrl
      },
      filter
    );
  });

  return result;
}, {urls: ["<all_urls>"]}, ["blocking"]);

port.on("filters.collapse", (message, sender) =>
{
  let {page, frame} = sender;

  if (checkWhitelisted(page, frame))
    return false;

  let blocked = false;
  let [docDomain, sitekey, specificOnly] = getDocumentInfo(page, frame);

  for (let url of message.urls)
  {
    let [filter] = matchRequest(new URL(url, message.baseURL),
                                message.mediatype, docDomain,
                                sitekey, specificOnly);

    if (filter instanceof BlockingFilter)
    {
      if (filter.collapse != null)
        return filter.collapse;
      blocked = true;
    }
  }

  return blocked && Prefs.hidePlaceholders;
});

port.on("request.blockedByRTCWrapper", (msg, sender) =>
{
  let {page, frame} = sender;

  if (checkWhitelisted(page, frame))
    return false;

  let {url} = msg;
  let [docDomain, sitekey, specificOnly] = getDocumentInfo(page, frame);
  let [filter, thirdParty] = matchRequest(new URL(url), "WEBRTC", docDomain,
                                          sitekey, specificOnly);
  logRequest(
    [sender.page.id],
    {url, type: "WEBRTC", docDomain, thirdParty, sitekey, specificOnly},
    filter
  );

  return filter instanceof BlockingFilter;
});

let ignoreFilterNotifications = false;
let handlerBehaviorChangedQuota =
  browser.webRequest.MAX_HANDLER_BEHAVIOR_CHANGED_CALLS_PER_10_MINUTES;

function propagateHandlerBehaviorChange()
{
  // Make sure to not call handlerBehaviorChanged() more often than allowed
  // by browser.webRequest.MAX_HANDLER_BEHAVIOR_CHANGED_CALLS_PER_10_MINUTES.
  // Otherwise Chrome notifies the user that this extension is causing issues.
  if (handlerBehaviorChangedQuota > 0)
  {
    browser.webNavigation.onBeforeNavigate.removeListener(
      propagateHandlerBehaviorChange
    );
    browser.webRequest.handlerBehaviorChanged();
    handlerBehaviorChangedQuota--;
    setTimeout(() => { handlerBehaviorChangedQuota++; }, 600000);
  }
}

function onFilterChange(arg, isDisabledAction)
{
  // Avoid triggering filters.behaviorChanged multiple times
  // when multiple filter hanges happen at the same time.
  if (ignoreFilterNotifications)
    return;

  // Ignore disabled subscriptions and filters, unless they just got
  // disabled, otherwise they have no effect on the handler behavior.
  if (arg && arg.disabled && !isDisabledAction)
    return;

  // Ignore empty subscriptions. This includes subscriptions
  // that have just been added, but not downloaded yet.
  if (arg instanceof Subscription && arg.filters.length == 0)
    return;

  // Ignore all types of filters but request filters,
  // only these have an effect on the handler behavior.
  if (arg instanceof Filter && !(arg instanceof RegExpFilter))
    return;

  ignoreFilterNotifications = true;
  setTimeout(() =>
  {
    // Defer handlerBehaviorChanged() until navigation occurs.
    // There wouldn't be any visible effect when calling it earlier,
    // but it's an expensive operation and that way we avoid to call
    // it multiple times, if multiple filters are added/removed.
    if (!browser.webNavigation.onBeforeNavigate
                              .hasListener(propagateHandlerBehaviorChange))
      browser.webNavigation.onBeforeNavigate
                           .addListener(propagateHandlerBehaviorChange);

    ignoreFilterNotifications = false;
    FilterNotifier.emit("filter.behaviorChanged");
  });
}

FilterNotifier.on("subscription.added", onFilterChange);
FilterNotifier.on("subscription.removed", onFilterChange);
FilterNotifier.on("subscription.updated", onFilterChange);
FilterNotifier.on("subscription.disabled", arg => onFilterChange(arg, true));
FilterNotifier.on("filter.added", onFilterChange);
FilterNotifier.on("filter.removed", onFilterChange);
FilterNotifier.on("filter.disabled", arg => onFilterChange(arg, true));
FilterNotifier.on("load", onFilterChange);


/***/ }),
/* 24 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";
/*
 * This file is part of Adblock Plus <https://adblockplus.org/>,
 * Copyright (C) 2006-present eyeo GmbH
 *
 * Adblock Plus is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3 as
 * published by the Free Software Foundation.
 *
 * Adblock Plus is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with Adblock Plus.  If not, see <http://www.gnu.org/licenses/>.
 */

/** @module notificationHelper */



const {startIconAnimation, stopIconAnimation} = __webpack_require__(42);
const {Utils} = __webpack_require__(10);
const {Notification: NotificationStorage} =
  __webpack_require__(16);
const {initAntiAdblockNotification} =
  __webpack_require__(43);
const {Prefs} = __webpack_require__(2);
const {showOptions} = __webpack_require__(44);

let activeNotification = null;
let activeButtons = null;
let defaultDisplayMethods = ["popup"];
let displayMethods = Object.create(null);
displayMethods.critical = ["icon", "notification", "popup"];
displayMethods.question = ["notification"];
displayMethods.normal = ["notification"];
displayMethods.relentless = ["notification"];
displayMethods.information = ["icon", "popup"];

function prepareNotificationIconAndPopup()
{
  let animateIcon = shouldDisplay("icon", activeNotification.type);
  activeNotification.onClicked = () =>
  {
    if (animateIcon)
      stopIconAnimation();
    notificationClosed();
  };
  if (animateIcon)
    startIconAnimation(activeNotification.type);
}

function getNotificationButtons(notificationType, message)
{
  let buttons = [];
  if (notificationType == "question")
  {
    buttons.push({
      type: "question",
      title: browser.i18n.getMessage("overlay_notification_button_yes")
    });
    buttons.push({
      type: "question",
      title: browser.i18n.getMessage("overlay_notification_button_no")
    });
  }
  else
  {
    let regex = /<a>(.*?)<\/a>/g;
    let match;
    while (match = regex.exec(message))
    {
      buttons.push({
        type: "link",
        title: match[1]
      });
    }

    // Chrome only allows two notification buttons so we need to fall back
    // to a single button to open all links if there are more than two.
    let maxButtons = (notificationType == "critical") ? 2 : 1;
    if (buttons.length > maxButtons)
    {
      buttons = [
        {
          type: "open-all",
          title: browser.i18n.getMessage("notification_open_all")
        }
      ];
    }
    if (!["critical", "relentless"].includes(notificationType))
    {
      buttons.push({
        type: "configure",
        title: browser.i18n.getMessage("notification_configure")
      });
    }
  }

  return buttons;
}

function openNotificationLinks()
{
  if (activeNotification.links)
  {
    for (let link of activeNotification.links)
      browser.tabs.create({url: Utils.getDocLink(link)});
  }
}

function notificationButtonClick(buttonIndex)
{
  if (!(activeButtons && buttonIndex in activeButtons))
    return;

  switch (activeButtons[buttonIndex].type)
  {
    case "link":
      browser.tabs.create({
        url: Utils.getDocLink(activeNotification.links[buttonIndex])
      });
      break;
    case "open-all":
      openNotificationLinks();
      break;
    case "configure":
      Prefs.notifications_showui = true;
      showOptions((page, port) =>
      {
        port.postMessage({
          type: "app.respond",
          action: "focusSection",
          args: ["notifications"]
        });
      });
      break;
    case "question":
      NotificationStorage.triggerQuestionListeners(activeNotification.id,
                                                   buttonIndex == 0);
      NotificationStorage.markAsShown(activeNotification.id);
      activeNotification.onClicked();
      break;
  }
}

function notificationClosed()
{
  activeNotification = null;
}

function initChromeNotifications()
{
  // Chrome hides notifications in notification center when clicked so
  // we need to clear them.
  function clearActiveNotification(notificationId)
  {
    if (activeNotification &&
        activeNotification.type != "question" &&
        !("links" in activeNotification))
      return;

    browser.notifications.clear(notificationId, wasCleared =>
    {
      if (wasCleared)
        notificationClosed();
    });
  }

  browser.notifications.onButtonClicked.addListener(
    (notificationId, buttonIndex) =>
    {
      notificationButtonClick(buttonIndex);
      clearActiveNotification(notificationId);
    }
  );
  browser.notifications.onClicked.addListener(clearActiveNotification);
  browser.notifications.onClosed.addListener(notificationClosed);
}

function showNotification(notification)
{
  if (activeNotification && activeNotification.id == notification.id)
    return;

  activeNotification = notification;
  if (shouldDisplay("notification", activeNotification.type))
  {
    let texts = NotificationStorage.getLocalizedTexts(notification);
    let title = texts.title || "";
    let message = (texts.message || "").replace(/<\/?(a|strong)>/g, "");
    let iconUrl = browser.extension.getURL("icons/detailed/abp-128.png");
    let linkCount = (activeNotification.links || []).length;

    if ("notifications" in browser)
    {
      activeButtons = getNotificationButtons(activeNotification.type,
                                             texts.message);
      let notificationOptions = {
        type: "basic",
        title,
        iconUrl,
        message,
        buttons: activeButtons.map(button => ({title: button.title})),
        // We use the highest priority to prevent the notification
        // from closing automatically.
        priority: 2
      };

      // Firefox and Opera don't support buttons. Firefox throws synchronously,
      // while Opera gives an asynchronous error. Wrapping the promise like
      // this, turns the synchronous error on Firefox into a promise rejection.
      new Promise(resolve =>
      {
        resolve(browser.notifications.create(notificationOptions));
      }).catch(() =>
      {
        // Without buttons, showing notifications of the type "question" is
        // pointless. For other notifications, retry with the buttons removed.
        if (activeNotification.type != "question")
        {
          delete notificationOptions.buttons;
          browser.notifications.create(notificationOptions);
        }
      });
    }
    else if ("Notification" in window && activeNotification.type != "question")
    {
      if (linkCount > 0)
      {
        message += " " + browser.i18n.getMessage(
          "notification_without_buttons"
        );
      }

      let widget = new Notification(
        title,
        {
          lang: Utils.appLocale,
          dir: Utils.readingDirection,
          body: message,
          icon: iconUrl
        }
      );

      widget.addEventListener("click", openNotificationLinks);
      widget.addEventListener("close", notificationClosed);
    }
    else
    {
      message = title + "\n" + message;
      if (linkCount > 0)
      {
        message += "\n\n" + browser.i18n.getMessage(
          "notification_with_buttons"
        );
      }

      let approved = confirm(message);
      if (activeNotification.type == "question")
        notificationButtonClick(approved ? 0 : 1);
      else if (approved)
        openNotificationLinks();
    }
  }
  prepareNotificationIconAndPopup();

  if (notification.type !== "question")
    NotificationStorage.markAsShown(notification.id);
}

/**
 * Initializes the notification system.
 */
exports.initNotifications = () =>
{
  if ("notifications" in browser)
    initChromeNotifications();
  initAntiAdblockNotification();
};

/**
 * Gets the active notification to be shown if any.
 *
 * @return {?object}
 */
exports.getActiveNotification = () => activeNotification;

let shouldDisplay =
/**
 * Determines whether a given display method should be used for a
 * specified notification type.
 *
 * @param {string} method Display method: icon, notification or popup
 * @param {string} notificationType
 * @return {boolean}
 */
exports.shouldDisplay = (method, notificationType) =>
{
  let methods = displayMethods[notificationType] || defaultDisplayMethods;
  return methods.includes(method);
};

/**
 * Tidies up after a notification was clicked.
 */
exports.notificationClicked = () =>
{
  if (activeNotification)
    activeNotification.onClicked();
};

ext.pages.onLoading.addListener(page =>
{
  NotificationStorage.showNext(page.url.href);
});

NotificationStorage.addShowListener(showNotification);


/***/ }),
/* 25 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";
/** @module adblock-betafish/alias/subscriptionInit */



const {Subscription,
       DownloadableSubscription,
       SpecialSubscription} =
  __webpack_require__(5);
const {FilterStorage} = __webpack_require__(4);
const {FilterNotifier} = __webpack_require__(1);
const info = __webpack_require__(3);
const {Prefs} = __webpack_require__(2);
const {Synchronizer} = __webpack_require__(15);
const {Utils} = __webpack_require__(10);
const {initNotifications} = __webpack_require__(24);
const {updatesVersion} = __webpack_require__(46);

let firstRun;
let subscriptionsCallback = null;
let reinitialized = false;
let dataCorrupted = false;

/**
 * If there aren't any filters, the default subscriptions are added.
 * However, if patterns.ini already did exist and/or any preference
 * is set to a non-default value, this indicates that this isn't the
 * first run, but something went wrong.
 *
 * This function detects the first run, and makes sure that the user
 * gets notified (on the first run page) if the data appears incomplete
 * and therefore will be reinitialized.
 */
function detectFirstRun()
{
  firstRun = FilterStorage.subscriptions.length == 0;

  if (firstRun && (!FilterStorage.firstRun || Prefs.currentVersion))
    reinitialized = true;

  Prefs.currentVersion = info.addonVersion;
}

/**
 * Determines whether to add the default ad blocking subscription.
 * Returns true, if there are no filter subscriptions besides those
 * other subscriptions added automatically, and no custom filters.
 *
 * On first run, this logic should always result in true since there
 * is no data and therefore no subscriptions. But it also causes the
 * default ad blocking subscription to be added again after some
 * data corruption or misconfiguration.
 *
 * @return {boolean}
 */
function shouldAddDefaultSubscription()
{
  for (let subscription of FilterStorage.subscriptions)
  {
    if (subscription instanceof DownloadableSubscription &&
        subscription.url != Prefs.subscriptions_exceptionsurl &&
        subscription.url != Prefs.subscriptions_antiadblockurl)
      return false;

    if (subscription instanceof SpecialSubscription &&
        subscription.filters.length > 0)
      return false;
  }

  return true;
}

/**
 * Finds the element for the default ad blocking filter subscription based
 * on the user's locale.
 *
 * @param {HTMLCollection} subscriptions
 * @return {Element}
 */
function chooseFilterSubscription(subscriptions)
{
  let selectedItem = null;
  let selectedPrefix = null;
  let matchCount = 0;
  for (let subscription of subscriptions)
  {
    if (!selectedItem)
      selectedItem = subscription;

    let prefixes = subscription.getAttribute("prefixes");
    let prefix = prefixes && prefixes.split(",").find(
      lang => new RegExp("^" + lang + "\\b").test(Utils.appLocale)
    );

    let subscriptionType = subscription.getAttribute("type");

    if (prefix && subscriptionType == "ads")
    {
      if (!selectedPrefix || selectedPrefix.length < prefix.length)
      {
        selectedItem = subscription;
        selectedPrefix = prefix;
        matchCount = 1;
      }
      else if (selectedPrefix && selectedPrefix.length == prefix.length)
      {
        matchCount++;

        // If multiple items have a matching prefix of the same length:
        // Select one of the items randomly, probability should be the same
        // for all items. So we replace the previous match here with
        // probability 1/N (N being the number of matches).
        if (Math.random() * matchCount < 1)
        {
          selectedItem = subscription;
          selectedPrefix = prefix;
        }
      }
    }
  }
  return selectedItem;
}

function supportsNotificationsWithButtons()
{
  // Microsoft Edge (as of EdgeHTML 16) doesn't have the notifications API.
  // Opera gives an asynchronous error when buttons are provided (we cannot
  // detect that behavior without attempting to show a notification).
  if (!("notifications" in browser) || info.application == "opera")
    return false;

  // Firefox throws synchronously if the "buttons" option is provided.
  // If buttons are supported (i.e. on Chrome), this fails with
  // an asynchronous error due to missing required options.
  // https://bugzilla.mozilla.org/show_bug.cgi?id=1190681
  try
  {
    browser.notifications.create({buttons: []}).catch(() => {});
  }
  catch (e)
  {
    if (e.toString().includes('"buttons" is unsupported'))
      return false;
  }

  return true;
}

/**
 * Gets the filter subscriptions to be added when the extnesion is loaded.
 *
 * @return {Promise|Subscription[]}
 */
function getSubscriptions()
{
  let subscriptions = [];

  // Add pre-configured subscriptions
  for (let url of Prefs.additional_subscriptions)
    subscriptions.push(Subscription.fromURL(url));

  // Add "acceptable ads" and "anti-adblock messages" subscriptions
  if (firstRun)
  {
    let acceptableAdsSubscription = Subscription.fromURL(
      Prefs.subscriptions_exceptionsurl
    );
    acceptableAdsSubscription.title = "Allow non-intrusive advertising";
    subscriptions.push(acceptableAdsSubscription);

    // Only add the anti-adblock messages subscription if
    // the related notification can be shown on this browser.
    if (supportsNotificationsWithButtons())
    {
      let antiAdblockSubscription = Subscription.fromURL(
        Prefs.subscriptions_antiadblockurl
      );
      antiAdblockSubscription.disabled = true;
      subscriptions.push(antiAdblockSubscription);
    }
  }

  // Add default ad blocking subscription (e.g. EasyList)
  if (shouldAddDefaultSubscription())
  {

    return fetch("subscriptions.xml")
      .then(response => response.text())
      .then(text =>
      {
        let doc = new DOMParser().parseFromString(text, "application/xml");
        let nodes = doc.getElementsByTagName("subscription");

        let node = chooseFilterSubscription(nodes);
        if (node)
        {
          let url = node.getAttribute("url");
          if (url)
          {
            let subscription = Subscription.fromURL(url);
            subscription.disabled = false;
            subscription.title = node.getAttribute("title");
            subscription.homepage = node.getAttribute("homepage");
            subscriptions.push(subscription);
          }
        }
        // Add AdBlock specific filter lists
        let adBlockCustomSubscription = Subscription.fromURL("https://cdn.adblockcdn.com/filters/adblock_custom.txt");
        subscriptions.push(adBlockCustomSubscription);
        let nominersSubscription = Subscription.fromURL("https://raw.githubusercontent.com/hoshsadiq/adblock-nocoin-list/master/nocoin.txt");
        subscriptions.push(nominersSubscription);
        return subscriptions;
      });
  }

  return subscriptions;
}

function addSubscriptionsAndNotifyUser(subscriptions)
{
  if (subscriptionsCallback)
    subscriptions = subscriptionsCallback(subscriptions);

  for (let subscription of subscriptions)
  {
    FilterStorage.addSubscription(subscription);
    if (subscription instanceof DownloadableSubscription &&
        !subscription.lastDownload)
      Synchronizer.execute(subscription);
  }

  // Show first run page or the updates page. The latter is only shown
  // on Chromium (since the current updates page announces features that
  // aren't new to Firefox users), and only if this version of the
  // updates page hasn't been shown yet.
  if (firstRun || info.platform == "chromium" &&
                  updatesVersion > Prefs.last_updates_page_displayed)
  {
    return Prefs.set("last_updates_page_displayed", updatesVersion).catch(() =>
    {
      dataCorrupted = true;
    }).then(() =>
    {
      if (!Prefs.suppress_first_run_page)
      {
        // TODO- do we want to do this?
        // Always show the first run page if a data corruption was detected
        // (either through failure of reading from or writing to storage.local).
        // The first run page notifies the user about the data corruption.
        let url;
        if (firstRun || dataCorrupted) {
          STATS.untilLoaded(function(userID)
          {
            browser.tabs.create({url: "https://getadblock.com/installed/?u=" + userID + "&lg=" + chrome.i18n.getUILanguage() });
          });
        }
      }
    });
  }
}

Promise.all([
  FilterNotifier.once("load"),
  Prefs.untilLoaded.catch(() => { dataCorrupted = true; })
]).then(detectFirstRun)
  .then(getSubscriptions)
  .then(addSubscriptionsAndNotifyUser)
  .then(initNotifications);

/**
 * Gets a value indicating whether the default filter subscriptions have been
 * added again because there weren't any subscriptions even though this wasn't
 * the first run.
 *
 * @return {boolean}
 */
exports.isReinitialized = () => reinitialized;

/**
 * Gets a value indicating whether a data corruption was detected.
 *
 * @return {boolean}
 */
exports.isDataCorrupted = () => dataCorrupted;

/**
 * Sets a callback that is called with an array of subscriptions to be added
 * during initialization. The callback must return an array of subscriptions
 * that will effectively be added.
 *
 * @param {function} callback
 */
exports.setSubscriptionsCallback = callback =>
{
  subscriptionsCallback = callback;
};


/***/ }),
/* 26 */
/***/ (function(module, exports, __webpack_require__) {

// if the ping reponse indicates a survey (tab or overlay)
// gracefully processes the request
const {recordGeneralMessage, recordErrorMessage} = __webpack_require__(12).ServerMessages;
let SURVEY = exports.SURVEY = (function() {
  // Only allow one survey per browser startup, to make sure users don't get
  // spammed due to bugs in AdBlock / the ping server / the browser.
  var surveyAllowed = true;
  var lastNotificationID = "";

  // Call |callback(tab)|, where |tab| is the active tab, or undefined if
  // there is no active tab.
  var getActiveTab = function(callback) {
    if (!SAFARI) {
      chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        callback(tabs[0]);
      });
    } else {
      var target = safari || {};
      target = target.application || {};
      target = target.activeBrowserWindow || {};
      callback(target.activeTab);
    }
  };

  // True if we are willing to show an overlay on this tab.
  var validTab = function(tab) {
    if (!SAFARI) {
      if (tab.incognito || tab.status !== "complete") {
        return false;
      }
    }
    return /^http:/.test(tab.url);
  };

  var getBlockCountOnActiveTab = function(callback) {
    chrome.tabs.query(
    {
      active: true,
      lastFocusedWindow: true,
    }, function (pages)
    {
      if (pages.length === 0)
      {
        return;
      }
      page = pages[0];
      var blockedPerPage = __webpack_require__(21).getBlockedPerPage(page);
      callback(blockedPerPage);
    });
  }

  //create a Notification
  var processNotification = function(surveyData) {
    // Check to see if we should show the survey before showing the overlay.
    var showNotificationIfAllowed = function(tab) {
      shouldShowSurvey(surveyData, function(updatedSurveyData) {
        lastNotificationID = (Math.floor(Math.random() * 3000)).toString();
        if (updatedSurveyData) {
          newSurveyData = surveyDataFrom(JSON.stringify(updatedSurveyData));
          if (newSurveyData.survey_id === surveyData.survey_id) {
            surveyData = newSurveyData;
          } else {
            recordGeneralMessage("survey_ids_do_not_match", undefined, {original_sid: surveyData.survey_id, updated_sid: newSurveyData.survey_id });
            return;
          }
        }
        if (!surveyData.notification_options ||
            !surveyData.notification_options.type ||
            !surveyData.notification_options.message ||
            !surveyData.notification_options.icon_url ||
            isNaN(surveyData.notification_options.priority)) {
          recordGeneralMessage("invalid_survey_data", undefined, { sid: surveyData.survey_id });
          return;
        }
        var notificationOptions = {
          title: surveyData.notification_options.title,
          iconUrl: surveyData.notification_options.icon_url,
          type: surveyData.notification_options.type,
          priority: surveyData.notification_options.priority,
          message: surveyData.notification_options.message
        };
        if (surveyData.notification_options.context_message) {
          notificationOptions.contextMessage = surveyData.notification_options.context_message;
        }
        if (surveyData.notification_options.require_interaction) {
          notificationOptions.requireInteraction = surveyData.notification_options.require_interaction;
        }
        if (surveyData.notification_options.is_clickable) {
          notificationOptions.isClickable = surveyData.notification_options.is_clickable;
        }
        // click handler for notification
        var notificationClicked = function(notificationId) {
          chrome.notifications.onClicked.removeListener(notificationClicked);
          chrome.notifications.onButtonClicked.removeListener(buttonNotificationClicked);
          chrome.notifications.onClosed.removeListener(closedClicked);
          if (notificationId === lastNotificationID && surveyData.notification_options.clicked_url) {
            recordGeneralMessage("notification_clicked" , undefined, { sid: surveyData.survey_id });
            openTab("https://getadblock.com/" + surveyData.notification_options.clicked_url);
          } else {
            recordGeneralMessage("notification_clicked_no_URL_to_open", undefined, { sid: surveyData.survey_id });
          }
        };
        var buttonNotificationClicked = function(notificationId, buttonIndex) {
          chrome.notifications.onClicked.removeListener(notificationClicked);
          chrome.notifications.onButtonClicked.removeListener(buttonNotificationClicked);
          chrome.notifications.onClosed.removeListener(closedClicked);
          if (surveyData.notification_options.buttons) {
            if (notificationId === lastNotificationID && buttonIndex === 0) {
                recordGeneralMessage("button_0_clicked", undefined, { sid: surveyData.survey_id });
                openTab("https://getadblock.com/" + surveyData.notification_options.buttons[0].clicked_url);
            }
            if (notificationId === lastNotificationID && buttonIndex === 1) {
                recordGeneralMessage("button_1_clicked", undefined, { sid: surveyData.survey_id });
                openTab("https://getadblock.com/" + surveyData.notification_options.buttons[1].clicked_url);
            }
          }
        };
        var closedClicked = function(notificationId, byUser) {
          chrome.notifications.onButtonClicked.removeListener(buttonNotificationClicked);
          chrome.notifications.onClicked.removeListener(notificationClicked);
          chrome.notifications.onClosed.removeListener(closedClicked);
          recordGeneralMessage("notification_closed", undefined, { sid: surveyData.survey_id , bu: byUser });
        };
        chrome.notifications.onClicked.removeListener(notificationClicked);
        chrome.notifications.onClicked.addListener(notificationClicked);
        if (surveyData.notification_options.buttons) {
          var buttonArray = [];
          if (surveyData.notification_options.buttons[0]) {
            buttonArray.push({title: surveyData.notification_options.buttons[0].title,
                           iconUrl: surveyData.notification_options.buttons[0].icon_url})
          }
          if (surveyData.notification_options.buttons[1]) {
            buttonArray.push({title: surveyData.notification_options.buttons[1].title,
                           iconUrl: surveyData.notification_options.buttons[1].icon_url})
          }
          notificationOptions.buttons = buttonArray;
        }
        chrome.notifications.onButtonClicked.removeListener(buttonNotificationClicked);
        chrome.notifications.onButtonClicked.addListener(buttonNotificationClicked);
        chrome.notifications.onClosed.addListener(closedClicked);
        // show the notification to the user.
        chrome.notifications.create(lastNotificationID, notificationOptions, function(id) {
          if (chrome.runtime.lastError) {
            recordGeneralMessage("error_survey_not_shown", undefined, { sid: surveyData.survey_id });
            chrome.notifications.onButtonClicked.removeListener(buttonNotificationClicked);
            chrome.notifications.onClicked.removeListener(notificationClicked);
            chrome.notifications.onClosed.removeListener(closedClicked);
            return;
          }
          recordGeneralMessage("survey_shown", undefined, { sid: surveyData.survey_id });
        });
      });
    };

    var retryInFiveMinutes = function() {
      var fiveMinutes = 5 * 60 * 1000;
      setTimeout(function() {
        processNotification(surveyData);
      }, fiveMinutes);
    };
    // check (again) if we still have permission to show a notification
    if (chrome &&
        chrome.notifications &&
        chrome.notifications.getPermissionLevel) {
        chrome.notifications.getPermissionLevel(function(permissionLevel){
          if (permissionLevel === "granted") {
            if (isNaN(surveyData.block_count_limit)) {
              log('invalid block_count_limit', surveyData.block_count_limit);
              return;
            }
            surveyData.block_count_limit = Number(surveyData.block_count_limit);
            chrome.idle.queryState(60, function(state) {
              if (state === "active") {
                getBlockCountOnActiveTab(function(blockedPerPage) {
                  if (blockedPerPage >= surveyData.block_count_limit) {
                    getActiveTab(function(tab) {
                      if (tab && validTab(tab)) {
                        showNotificationIfAllowed(tab);
                      } else {
                        // We didn't find an appropriate tab
                        retryInFiveMinutes();
                      }
                    });
                  } else {
                    retryInFiveMinutes();
                  }
                }); // end getBlockCountOnActiveTab
              } else {
                // browser is idle or locked
                retryInFiveMinutes();
              }
            }); // end chrome.idle.queryState
          }
        });
    }
  }; //end of processNotification()

  //open a Tab for a full page survey
  var processTab = function(surveyData) {

    var openTabIfAllowed = function() {
      setTimeout(function () {
        shouldShowSurvey(surveyData, function (responseData) {
          chrome.tabs.create({ url: 'https://getadblock.com/' + responseData.open_this_url });
        });
      }, 10000); // 10 seconds
    };

    var waitForUserAction = function() {
      chrome.tabs.onCreated.removeListener(waitForUserAction);
      openTabIfAllowed();
    };

    chrome.idle.queryState(60, function(state) {
      if (state === "active") {
        openTabIfAllowed();
      } else {
        chrome.tabs.onCreated.removeListener(waitForUserAction);
        chrome.tabs.onCreated.addListener(waitForUserAction);
      }
    });
  }; //end of processTab()

  //Display a notification overlay on the active tab
  // To avoid security issues, the tab that is selected must not be incognito mode (Chrome only),
  // and must not be using SSL / HTTPS
  var processOverlay = function(surveyData) {

    // Check to see if we should show the survey before showing the overlay.
    var showOverlayIfAllowed = function(tab) {
      shouldShowSurvey(surveyData, function() {
        var data = { command: "showoverlay", overlayURL: surveyData.open_this_url, tabURL:tab.url};
        var validateResponseFromTab = function(response) {
          if (chrome.runtime.lastError) {
            if (chrome.runtime.lastError.message) {
              recordErrorMessage('overlay_message_error ', undefined, { errorMessage: chrome.runtime.lastError.message});
            } else {
              recordErrorMessage('overlay_message_error ', undefined, { error: JSON.stringify(chrome.runtime.lastError) });
            }
          } else if (!response || response.ack !== data.command) {
            recordErrorMessage('invalid_response_from_notification_overlay_script', undefined, { response: response });
          }
        };
        if (SAFARI) {
          chrome.extension.sendRequest(data, validateResponseFromTab);
        } else {
          chrome.tabs.sendRequest(tab.id, data, validateResponseFromTab);
        }
      });
    };

    var retryInFiveMinutes = function() {
      var fiveMinutes = 5 * 60 * 1000;
      setTimeout(function() {
        processOverlay(surveyData);
      }, fiveMinutes);
    };

    getActiveTab(function(tab) {
      if (tab && validTab(tab)) {
        showOverlayIfAllowed(tab);
      } else {
        // We didn't find an appropriate tab
        retryInFiveMinutes();
      }
    });
  }; //end of processOverlay()

  //functions below are used by both Tab and Overlay Surveys

  // Double check that the survey should be shown
  // Inputs:
  //   surveyData: JSON survey information from ping server
  //   callback(): called with no arguments if the survey should be shown
  var shouldShowSurvey = function(surveyData, callback) {
    // Check if we should show survey only if it can actually be shown
    // based on surveyAllowed.
    if (surveyAllowed) {
      var data = { cmd: "survey", u: STATS.userId(), sid: surveyData.survey_id };
      if (STATS.flavor === "E" && Prefs.blocked_total) {
        data["b"] = Prefs.blocked_total;
      }
      $.post(STATS.statsUrl, data, function(responseData) {
        try {
          var data = JSON.parse(responseData);
        } catch (e) {
          log('Error parsing JSON: ', responseData, " Error: ", e);
        }
        if (data && data.should_survey === 'true' && surveyAllowed) {
          surveyAllowed = false;
          callback(data);
        }
      });
    } else {
     log('survey not allowed');
    }
  };

  // Check the response from a ping to see if it contains valid survey instructions.
  // If so, return an object containing data about the survey to show.
  // Otherwise, return null.
  // Inputs:
  //   responseData: string response from a ping
  var surveyDataFrom = function(responseData) {
      if (responseData.length === 0 || responseData.trim().length === 0)
        return null;

      try {
        var surveyData = JSON.parse(responseData);
        if (!surveyData)
          return;
      } catch (e) {
        console.log("Something went wrong with parsing survey data.");
        console.log('error', e);
        console.log('response data', responseData);
        return null;
      }
      return surveyData;
  };

  return {
    maybeSurvey: function(responseData) {
      if (getSettings().show_survey === false)
        return;

      var surveyData = surveyDataFrom(responseData);
      if (!surveyData)
        return;

      if (surveyData.type === 'overlay') {
        processOverlay(surveyData);
      } else if (surveyData.type === 'tab') {
        processTab(surveyData);
      } else if (surveyData.type === 'notification') {
        processNotification(surveyData);
      }
    },//end of maybeSurvey
    types: function(callback) {
      // 'O' = Overlay Surveys
      // 'T' = Tab Surveys
      // 'N' = Notifications
      if (chrome &&
          chrome.notifications &&
          chrome.notifications.getPermissionLevel) {
          chrome.notifications.getPermissionLevel(function(permissionLevel){
            if (permissionLevel === "granted") {
              callback("OTN");
            } else {
              callback("OT");
            }
          });
          return;
      }
      callback("OT");
    }
  };
})();


/***/ }),
/* 27 */
/***/ (function(module, exports, __webpack_require__) {

const Prefs = __webpack_require__(2).Prefs;
const FilterStorage = __webpack_require__(4).FilterStorage;
const {LocalCDN} = __webpack_require__(18);
const {SURVEY} = __webpack_require__(26);
const {recordGeneralMessage, recordErrorMessage} = __webpack_require__(12).ServerMessages;
// Allows interaction with the server to track install rate
// and log messages.
let STATS = exports.STATS = (function()
{
  var userIDStorageKey = "userid";
  var totalPingStorageKey = "total_pings";
  var nextPingTimeStorageKey = "next_ping_time";
  var stats_url = "https://ping.getadblock.com/stats/";

  var FiftyFiveMinutes = 3300000;

  var dataCorrupt = false;

  // Get some information about the version, os, and browser
  var version = chrome.runtime.getManifest().version;
  var match = navigator.userAgent.match(/(CrOS\ \w+|Windows\ NT|Mac\ OS\ X|Linux)\ ([\d\._]+)?/);
  var os = (match || [])[1] || "Unknown";
  var osVersion = (match || [])[2] || "Unknown";
  var flavor;
  if (window.opr)
    flavor = "O"; // Opera
  else if (window.safari)
    flavor = "S"; // Safari
  else
    flavor = "E"; // Chrome
  if (flavor === "O")
    match = navigator.userAgent.match(/(?:OPR)\/([\d\.]+)/);
  else
    match = navigator.userAgent.match(/(?:Chrome|Version)\/([\d\.]+)/);
  var browserVersion = (match || [])[1] || "Unknown";

  var firstRun = false;

  var user_ID;

  // Inputs: key:string.
  // Returns value if key exists, else undefined.
  // Note: "_alt" is appended to the key to make it the key different
  // from the previous items stored in localstorage
  var storage_get = function(key) {
    var store = localStorage;
    if (store === undefined) {
        return undefined;
    }
    key = key + "_alt";
    var json = store.getItem(key);
    if (json == null)
      return undefined;
    try {
      return JSON.parse(json);
    } catch (ex) {
      if (ex && ex.message) {
        recordErrorMessage('storage_get_error ', undefined, { errorMessage: ex.message});
      }
      return undefined;
    }
  };

  // Inputs: key:string, value:object.
  // Note: "_alt" is appended to the key to make it the key different
  // from the previous items stored in localstorage
  // If value === undefined, removes key from storage.
  // Returns undefined.
  var storage_set = function(key, value) {
    var store = localStorage;
    key = key + "_alt";
    if (value === undefined) {
      store.removeItem(key);
      return;
    }
    try {
      store.setItem(key, JSON.stringify(value));
    } catch (ex) {
      dataCorrupt = true;
    }
  };

  // Give the user a userid if they don't have one yet.
  function readUserIDPromisified() {
    return new Promise(
      function (resolve, reject) {
        chrome.storage.local.get(STATS.userIDStorageKey,
          (response) => {
            var localuserid = storage_get(STATS.userIDStorageKey);
            if (!response[STATS.userIDStorageKey] && !localuserid)
            {
              STATS.firstRun = true;
              var time_suffix = (Date.now()) % 1e8; // 8 digits from end of
                                                    // timestamp
              var alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789';
              var result = [];
              for (var i = 0; i < 8; i++)
              {
                var choice = Math.floor(Math.random() * alphabet.length);
                result.push(alphabet[choice]);
              }
              user_ID = result.join('') + time_suffix;
              // store in redudant locations
              chromeStorageSetHelper(STATS.userIDStorageKey, user_ID);
              storage_set(STATS.userIDStorageKey, user_ID);
            }
            else
            {
              user_ID = response[STATS.userIDStorageKey] || localuserid;
              if (!response[STATS.userIDStorageKey] && localuserid)
              {
                chromeStorageSetHelper(STATS.userIDStorageKey, user_ID);
              }
              if (response[STATS.userIDStorageKey] && !localuserid)
              {
                storage_set(STATS.userIDStorageKey, user_ID);
              }
            }
            resolve(user_ID);
          });
        });
  }

  chrome.runtime.onMessage.addListener(function(message, sender, sendResponse)
  {
    if (message.command !== "get_adblock_user_id")
    {
      return;
    }
    readUserIDPromisified().then(function(userID)
    {
      sendResponse(userID);
    });
    return true;
  });

  var getPingData = function(callbackFN)
  {
    if (!callbackFN && (typeof callbackFN !== 'function'))
    {
      return;
    }
    chrome.storage.local.get(STATS.totalPingStorageKey, function(response)
    {
      var localTotalPings = storage_get(STATS.totalPingStorageKey);
      var total_pings = response[STATS.totalPingStorageKey] || localTotalPings || 0;
      var data = {
        u : user_ID,
        v : version,
        f : flavor,
        o : os,
        bv : browserVersion,
        ov : osVersion,
        ad: getSettings().show_advanced_options ? '1': '0',
        l : determineUserLanguage(),
        pc : total_pings,
        cb : getSettings().safari_content_blocking ? '1' : '0',
        dcv2 : getSettings().data_collection_v2 ? '1' : '0',
        cdn: getSettings().local_cdn ? '1' : '0',
        cdnr: LocalCDN.getRedirectCount(),
        cdnd: LocalCDN.getDataCount(),
        rc: replacedCounts.getTotalAdsReplaced(),
      };
      // only on Chrome
      if (flavor === "E" && Prefs.blocked_total)
      {
        data["b"] = Prefs.blocked_total;
      }
      if (chrome.runtime.id)
      {
        data["extid"] = chrome.runtime.id;
      }
      var subs = getAllSubscriptionsMinusText();
      if (subs["acceptable_ads"])
      {
        data["aa"] = subs["acceptable_ads"].subscribed ? '1' : '0';
      }
      else
      {
        data["aa"] = 'u';
      }
      data["dc"] = dataCorrupt ? '1' : '0';
      SURVEY.types(function(response)
      {
          data["st"] = response;
          callbackFN(data);
      });
    });
  };
  // Tell the server we exist.
  var pingNow = function()
  {
    getPingData(function(data)
    {
      if (!data.u)
      {
        return;
      }
      // attempt to stop users that are pinging us 'alot'
      // by checking the current ping count,
      // if the ping count is above a theshold,
      // then only ping 'occasionally'
      if (data.pc > 5000)
      {
        if (data.pc > 5000 && data.pc < 100000 && ((data.pc % 5000) !== 0))
        {
          return;
        }
        if (data.pc >= 100000 && ((data.pc % 50000) !== 0))
        {
          return;
        }
      }
      data["cmd"] = 'ping';
      var ajaxOptions = {
        type : 'POST',
        url : stats_url,
        data : data,
        success : handlePingResponse, // TODO: Remove when we no longer do a/b
                                      // tests
        error : function(e)
        {
          console.log("Ping returned error: ", e.status);
        },
      };

      if (chrome.management && chrome.management.getSelf)
      {
        chrome.management.getSelf(function(info)
        {
          data["it"] = info.installType.charAt(0);
          $.ajax(ajaxOptions);
        });
      }
      else
      {
        $.ajax(ajaxOptions);
      }

      // send Local CDN missed versions stats as well
      recordGeneralMessage("cdn_miss_stats", undefined, {"cdnm": LocalCDN.getMissedVersions()});
    });
  };

  var handlePingResponse = function(responseData, textStatus, jqXHR)
  {
    SURVEY.maybeSurvey(responseData);
    License.checkPingResponse(responseData);
  };

  // Called just after we ping the server, to schedule our next ping.
  var scheduleNextPing = function()
  {
    chrome.storage.local.get(STATS.totalPingStorageKey, function(response)
    {
      var localTotalPings = storage_get(totalPingStorageKey);
      localTotalPings = isNaN(localTotalPings) ? 0 : localTotalPings;
      var total_pings = response[STATS.totalPingStorageKey]
      total_pings = isNaN(total_pings) ? 0 : total_pings;
      total_pings = Math.max(localTotalPings, total_pings);
      total_pings += 1;
      // store in redudant locations
      chromeStorageSetHelper(STATS.totalPingStorageKey, total_pings);
      storage_set(STATS.totalPingStorageKey, total_pings);

      var delay_hours;
      if (total_pings == 1) // Ping one hour after install
        delay_hours = 1;
      else if (total_pings < 9) // Then every day for a week
        delay_hours = 24;
      else
        // Then weekly forever
        delay_hours = 24 * 7;

      var millis = 1000 * 60 * 60 * delay_hours;
      var nextPingTime = Date.now() + millis;

      // store in redudant location
      chromeStorageSetHelper(STATS.nextPingTimeStorageKey, nextPingTime, function()
      {
        if (chrome.runtime.lastError)
        {
          dataCorrupt = true;
        }
        else
        {
          dataCorrupt = false;
        }
      });
      storage_set(STATS.nextPingTimeStorageKey, nextPingTime);
    });
  };

  // Return the number of milliseconds until the next scheduled ping.
  var millisTillNextPing = function(callbackFN)
  {
    if (!callbackFN || (typeof callbackFN !== 'function'))
    {
      return;
    }
    // If we've detected data corruption issues,
    // then default to a 55 minute ping interval
    if (dataCorrupt)
    {
      callbackFN(FiftyFiveMinutes);
      return;
    }
    // Wait 10 seconds to allow the previous 'set' to finish
    window.setTimeout(function()
    {
      chrome.storage.local.get(STATS.nextPingTimeStorageKey, function(response)
      {
        var local_next_ping_time = storage_get(STATS.nextPingTimeStorageKey);
        local_next_ping_time = isNaN(local_next_ping_time) ? 0 : local_next_ping_time;
        var next_ping_time = isNaN(response[STATS.nextPingTimeStorageKey]) ? 0 : response[STATS.nextPingTimeStorageKey];
        next_ping_time = Math.max(local_next_ping_time, next_ping_time);
        // if this is the first time we've run (just installed), millisTillNextPing is 0
        if (next_ping_time === 0 && STATS.firstRun)
        {
          callbackFN(0);
          return;
        }
        // if we don't have a 'next ping time', or it's not a valid number,
        // default to 55 minute ping interval
        if (next_ping_time === 0 || isNaN(next_ping_time))
        {
          callbackFN(FiftyFiveMinutes);
          return;
        }
        callbackFN(next_ping_time - Date.now());
      }); // end of get
    }, 10000);
  };

  // Used to rate limit .message()s. Rate limits reset at startup.
  var throttle = {
    // A small initial amount in case the server is bogged down.
    // The server will tell us the correct amount.
    max_events_per_hour : 3, // null if no limit
    // Called when attempting an event. If not rate limited, returns
    // true and records the event.
    attempt : function()
    {
      var now = Date.now(), one_hour = 1000 * 60 * 60;
      var times = this._event_times, mph = this.max_events_per_hour;
      // Discard old or irrelevant events
      while (times[0] && (times[0] + one_hour < now || mph === null))
        times.shift();
      if (mph === null)
        return true; // no limit
      if (times.length >= mph)
        return false; // used our quota this hour
      times.push(now);
      return true;
    },
    _event_times : []
  };

  return {
    userIDStorageKey : userIDStorageKey,
    totalPingStorageKey : totalPingStorageKey,
    nextPingTimeStorageKey : nextPingTimeStorageKey,
    // True if AdBlock was just installed.
    firstRun : firstRun,
    userId : function()
    {
      return user_ID;
    },
    version : version,
    flavor : flavor,
    browser : ({
      O : "Opera",
      S : "Safari",
      E : "Chrome"
    })[flavor],
    browserVersion : browserVersion,
    os : os,
    osVersion : osVersion,
    pingNow : pingNow,
    statsUrl : stats_url,
    untilLoaded : function(callback)
    {
      readUserIDPromisified().then(function(userID) {
        if (typeof callback === 'function')
        {
          callback(userID);
        }
      });
    },
    // Ping the server when necessary.
    startPinging : function()
    {
      function sleepThenPing()
      {
        millisTillNextPing(function(delay)
        {
          window.setTimeout(function()
          {
            pingNow();
            scheduleNextPing();
            sleepThenPing();
          }, delay);
        });
      };

      readUserIDPromisified().then(function(userID)
      {
        // Do 'stuff' when we're first installed...
        // - send a message
        chrome.storage.local.get(STATS.totalPingStorageKey, function(response)
        {
          if (!response[STATS.totalPingStorageKey])
          {
            if (chrome.management && chrome.management.getSelf)
            {
              chrome.management.getSelf(function(info)
              {
                if (info)
                {
                  recordGeneralMessage('new_install_' + info.installType);
                }
                else
                {
                  recordGeneralMessage('new_install');
                }
              });
            }
            else
            {
              recordGeneralMessage('new_install');
            }
          }
        });
      });
      // This will sleep, then ping, then schedule a new ping, then
      // call itself to start the process over again.
      sleepThenPing();
    },

    // Record some data, if we are not rate limited.
    msg : function(message)
    {
      if (!throttle.attempt())
      {
        log("Rate limited:", message);
        return;
      }
      var data = {
        cmd : "msg2",
        m : message,
        u : user_ID,
        v : version,
        fr : firstRun,
        f : flavor,
        bv : browserVersion,
        o : os,
        ov : osVersion
      };
      if (chrome.runtime.id)
      {
        data["extid"] = chrome.runtime.id;
      }
      $.ajax(stats_url, {
        type : "POST",
        data : data,
        complete : function(xhr)
        {
          var mph = parseInt(xhr.getResponseHeader("X-RateLimit-MPH"), 10);
          if (isNaN(mph) || mph < -1) // Server is sick
            mph = 1;
          if (mph === -1)
            mph = null; // no rate limit
          throttle.max_events_per_hour = mph;
        }
      });
    }
  };

})();


/***/ }),
/* 28 */
/***/ (function(module, exports) {

// Used by both channels.js and picreplacement.js
// Since this file is conditional loaded, and not part of the content script web pack,
// 'exports' may not be defined, so we use this hack
if (typeof exports === "undefined") {
  var exports = {};
}

const imageSizesMap =
exports.imageSizesMap = new Map([
  ["NONE", 0],
  ["wide", 1],
  ["tall", 2],
  ["skinnywide", 4],
  ["skinnytall", 8],
  ["big", 16],
  ["small", 32]
]);

const WIDE =
exports.WIDE = imageSizesMap.get("wide");
const TALL =
exports.TALL = imageSizesMap.get("tall");
const SKINNYWIDE =
exports.SKINNYWIDE = imageSizesMap.get("skinnywide");
const SKINNYTALL =
exports.SKINNYTALL = imageSizesMap.get("skinnytall");
const BIG =
exports.BIG = imageSizesMap.get("big");
const SMALL =
exports.SMALL = imageSizesMap.get("small");


/***/ }),
/* 29 */
/***/ (function(module, exports, __webpack_require__) {

__webpack_require__(30);
__webpack_require__(15);
__webpack_require__(33);
__webpack_require__(23);
__webpack_require__(38);
__webpack_require__(21);
__webpack_require__(39);
__webpack_require__(40);
__webpack_require__(41);
__webpack_require__(47);
__webpack_require__(48);
__webpack_require__(26);
__webpack_require__(49);
__webpack_require__(50);
__webpack_require__(51);
__webpack_require__(56);
__webpack_require__(25);
__webpack_require__(57);
__webpack_require__(28);
__webpack_require__(58);
__webpack_require__(59);
__webpack_require__(60);
__webpack_require__(61);
__webpack_require__(62);
module.exports = __webpack_require__(63);


/***/ }),
/* 30 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";
/*
 * This file is part of Adblock Plus <https://adblockplus.org/>,
 * Copyright (C) 2006-present eyeo GmbH
 *
 * Adblock Plus is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3 as
 * published by the Free Software Foundation.
 *
 * Adblock Plus is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with Adblock Plus.  If not, see <http://www.gnu.org/licenses/>.
 */



/**
 * @fileOverview Component synchronizing filter storage with Matcher
 *               instances and ElemHide.
 */

const {Services} = Cu.import("resource://gre/modules/Services.jsm", {});
const {XPCOMUtils} = Cu.import("resource://gre/modules/XPCOMUtils.jsm", {});

const {FilterStorage} = __webpack_require__(4);
const {FilterNotifier} = __webpack_require__(1);
const {ElemHide} = __webpack_require__(14);
const {ElemHideEmulation} = __webpack_require__(20);
const {defaultMatcher} = __webpack_require__(9);
const {ActiveFilter, RegExpFilter,
       ElemHideBase, ElemHideEmulationFilter} = __webpack_require__(0);
const {Prefs} = __webpack_require__(2);

/**
 * Increases on filter changes, filters will be saved if it exceeds 1.
 * @type {number}
 */
let isDirty = 0;

/**
 * This object can be used to change properties of the filter change listeners.
 * @class
 */
let FilterListener = {
  /**
   * Increases "dirty factor" of the filters and calls
   * FilterStorage.saveToDisk() if it becomes 1 or more. Save is
   * executed delayed to prevent multiple subsequent calls. If the
   * parameter is 0 it forces saving filters if any changes were
   * recorded after the previous save.
   * @param {number} factor
   */
  setDirty(factor)
  {
    if (factor == 0 && isDirty > 0)
      isDirty = 1;
    else
      isDirty += factor;
    if (isDirty >= 1)
    {
      isDirty = 0;
      FilterStorage.saveToDisk();
    }
  }
};

/**
 * Observer listening to history purge actions.
 * @class
 */
let HistoryPurgeObserver = {
  observe(subject, topic, data)
  {
    if (topic == "browser:purge-session-history" &&
        Prefs.clearStatsOnHistoryPurge)
    {
      FilterStorage.resetHitCounts();
      FilterListener.setDirty(0); // Force saving to disk

      Prefs.recentReports = [];
    }
  },
  QueryInterface: XPCOMUtils.generateQI(
    [Ci.nsISupportsWeakReference, Ci.nsIObserver]
  )
};

/**
 * Initializes filter listener on startup, registers the necessary hooks.
 */
function init()
{
  FilterNotifier.on("filter.hitCount", onFilterHitCount);
  FilterNotifier.on("filter.lastHit", onFilterLastHit);
  FilterNotifier.on("filter.added", onFilterAdded);
  FilterNotifier.on("filter.removed", onFilterRemoved);
  FilterNotifier.on("filter.disabled", onFilterDisabled);
  FilterNotifier.on("filter.moved", onGenericChange);

  FilterNotifier.on("subscription.added", onSubscriptionAdded);
  FilterNotifier.on("subscription.removed", onSubscriptionRemoved);
  FilterNotifier.on("subscription.disabled", onSubscriptionDisabled);
  FilterNotifier.on("subscription.updated", onSubscriptionUpdated);
  FilterNotifier.on("subscription.moved", onGenericChange);
  FilterNotifier.on("subscription.title", onGenericChange);
  FilterNotifier.on("subscription.fixedTitle", onGenericChange);
  FilterNotifier.on("subscription.homepage", onGenericChange);
  FilterNotifier.on("subscription.downloadStatus", onGenericChange);
  FilterNotifier.on("subscription.lastCheck", onGenericChange);
  FilterNotifier.on("subscription.errors", onGenericChange);

  FilterNotifier.on("load", onLoad);
  FilterNotifier.on("save", onSave);

  FilterStorage.loadFromDisk();

  Services.obs.addObserver(HistoryPurgeObserver,
                           "browser:purge-session-history", true);
  onShutdown.add(() =>
  {
    Services.obs.removeObserver(HistoryPurgeObserver,
                                "browser:purge-session-history");
  });
}
init();

/**
 * Notifies Matcher instances or ElemHide object about a new filter
 * if necessary.
 * @param {Filter} filter filter that has been added
 */
function addFilter(filter)
{
  if (!(filter instanceof ActiveFilter) || filter.disabled)
    return;

  let hasEnabled = false;
  for (let i = 0; i < filter.subscriptions.length; i++)
  {
    if (!filter.subscriptions[i].disabled)
    {
      hasEnabled = true;
      break;
    }
  }
  if (!hasEnabled)
    return;

  if (filter instanceof RegExpFilter)
    defaultMatcher.add(filter);
  else if (filter instanceof ElemHideBase)
  {
    if (filter instanceof ElemHideEmulationFilter)
      ElemHideEmulation.add(filter);
    else
      ElemHide.add(filter);
  }
}

/**
 * Notifies Matcher instances or ElemHide object about removal of a filter
 * if necessary.
 * @param {Filter} filter filter that has been removed
 */
function removeFilter(filter)
{
  if (!(filter instanceof ActiveFilter))
    return;

  if (!filter.disabled)
  {
    let hasEnabled = false;
    for (let i = 0; i < filter.subscriptions.length; i++)
    {
      if (!filter.subscriptions[i].disabled)
      {
        hasEnabled = true;
        break;
      }
    }
    if (hasEnabled)
      return;
  }

  if (filter instanceof RegExpFilter)
    defaultMatcher.remove(filter);
  else if (filter instanceof ElemHideBase)
  {
    if (filter instanceof ElemHideEmulationFilter)
      ElemHideEmulation.remove(filter);
    else
      ElemHide.remove(filter);
  }
}

const primes = [101, 109, 131, 149, 163, 179, 193, 211, 229, 241];

function addFilters(filters)
{
  // We add filters using pseudo-random ordering. Reason is that ElemHide will
  // assign consecutive filter IDs that might be visible to the website. The
  // randomization makes sure that no conclusion can be made about the actual
  // filters applying there. We have ten prime numbers to use as iteration step,
  // any of those can be chosen as long as the array length isn't divisible by
  // it.
  let len = filters.length;
  if (!len)
    return;

  let current = (Math.random() * len) | 0;
  let step;
  do
  {
    step = primes[(Math.random() * primes.length) | 0];
  } while (len % step == 0);

  for (let i = 0; i < len; i++, current = (current + step) % len)
    addFilter(filters[current]);
}

function onSubscriptionAdded(subscription)
{
  FilterListener.setDirty(1);

  if (!subscription.disabled)
    addFilters(subscription.filters);
}

function onSubscriptionRemoved(subscription)
{
  FilterListener.setDirty(1);

  if (!subscription.disabled)
    subscription.filters.forEach(removeFilter);
}

function onSubscriptionDisabled(subscription, newValue)
{
  FilterListener.setDirty(1);

  if (subscription.url in FilterStorage.knownSubscriptions)
  {
    if (newValue == false)
      addFilters(subscription.filters);
    else
      subscription.filters.forEach(removeFilter);
  }
}

function onSubscriptionUpdated(subscription)
{
  FilterListener.setDirty(1);

  if (subscription.url in FilterStorage.knownSubscriptions &&
      !subscription.disabled)
  {
    subscription.oldFilters.forEach(removeFilter);
    addFilters(subscription.filters);
  }
}

function onFilterHitCount(filter, newValue)
{
  if (newValue == 0)
    FilterListener.setDirty(0);
  else
    FilterListener.setDirty(0.002);
}

function onFilterLastHit()
{
  FilterListener.setDirty(0.002);
}

function onFilterAdded(filter)
{
  FilterListener.setDirty(1);

  if (!filter.disabled)
    addFilter(filter);
}

function onFilterRemoved(filter)
{
  FilterListener.setDirty(1);

  if (!filter.disabled)
    removeFilter(filter);
}

function onFilterDisabled(filter, newValue)
{
  FilterListener.setDirty(1);

  if (newValue == false)
    addFilter(filter);
  else
    removeFilter(filter);
}

function onGenericChange()
{
  FilterListener.setDirty(1);
}

function onLoad()
{
  isDirty = 0;

  defaultMatcher.clear();
  ElemHide.clear();
  ElemHideEmulation.clear();
  for (let subscription of FilterStorage.subscriptions)
  {
    if (!subscription.disabled)
      addFilters(subscription.filters);
  }
}

function onSave()
{
  isDirty = 0;
}


/***/ }),
/* 31 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";
/*
 * This file is part of Adblock Plus <https://adblockplus.org/>,
 * Copyright (C) 2006-present eyeo GmbH
 *
 * Adblock Plus is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3 as
 * published by the Free Software Foundation.
 *
 * Adblock Plus is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with Adblock Plus.  If not, see <http://www.gnu.org/licenses/>.
 */



const keyPrefix = "file:";

function fileToKey(fileName)
{
  return keyPrefix + fileName;
}

function loadFile(fileName)
{
  let key = fileToKey(fileName);
  return browser.storage.local.get(key).then(items =>
  {
    let entry = items[key];
    if (entry)
      return entry;
    throw {type: "NoSuchFile"};
  });
}

function saveFile(fileName, data)
{
  return browser.storage.local.set({
    [fileToKey(fileName)]: {
      content: Array.from(data),
      lastModified: Date.now()
    }
  });
}

exports.IO =
{
  /**
   * Reads text lines from a file.
   * @param {string} fileName
   *    Name of the file to be read
   * @param {TextSink} listener
   *    Function that will be called for each line in the file
   * @return {Promise}
   *    Promise to be resolved or rejected once the operation is completed
   */
  readFromFile(fileName, listener)
  {
    return loadFile(fileName).then(entry =>
    {
      for (let line of entry.content)
        listener(line);
    });
  },

  /**
   * Writes text lines to a file.
   * @param {string} fileName
   *    Name of the file to be written
   * @param {Iterable.<string>} data
   *    An array-like or iterable object containing the lines (without line
   *    endings)
   * @return {Promise}
   *    Promise to be resolved or rejected once the operation is completed
   */
  writeToFile(fileName, data)
  {
    return saveFile(fileName, data);
  },

  /**
   * Copies a file.
   * @param {string} fromFile
   *    Name of the file to be copied
   * @param {string} toFile
   *    Name of the file to be written, will be overwritten if exists
   * @return {Promise}
   *    Promise to be resolved or rejected once the operation is completed
   */
  copyFile(fromFile, toFile)
  {
    return loadFile(fromFile).then(entry => saveFile(toFile, entry.content));
  },

  /**
   * Renames a file.
   * @param {string} fromFile
   *    Name of the file to be renamed
   * @param {string} newName
   *    New file name, will be overwritten if exists
   * @return {Promise}
   *    Promise to be resolved or rejected once the operation is completed
   */
  renameFile(fromFile, newName)
  {
    return loadFile(fromFile)
      .then(entry => browser.storage.local.set({[fileToKey(newName)]: entry}))
      .then(() => this.removeFile(fromFile));
  },

  /**
   * Removes a file.
   * @param {string} fileName
   *    Name of the file to be removed
   * @return {Promise}
   *    Promise to be resolved or rejected once the operation is completed
   */
  removeFile(fileName)
  {
    return browser.storage.local.remove(fileToKey(fileName));
  },

  /**
   * Retrieves file metadata.
   * @param {string} fileName
   *    Name of the file to be looked up
   * @return {Promise.<StatData>}
   *    Promise to be resolved with file metadata once the operation is
   *    completed
   */
  statFile(fileName)
  {
    return loadFile(fileName).then(entry =>
    {
      return {
        exists: true,
        lastModified: entry.lastModified
      };
    }).catch(error =>
    {
      if (error.type == "NoSuchFile")
        return {exists: false};
      throw error;
    });
  }
};


/***/ }),
/* 32 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";
/*
 * This file is part of Adblock Plus <https://adblockplus.org/>,
 * Copyright (C) 2006-present eyeo GmbH
 *
 * Adblock Plus is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3 as
 * published by the Free Software Foundation.
 *
 * Adblock Plus is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with Adblock Plus.  If not, see <http://www.gnu.org/licenses/>.
 */



/**
 * Converts raw text into a regular expression string
 * @param {string} text the string to convert
 * @return {string} regular expression representation of the text
 */
function textToRegExp(text)
{
  return text.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&");
}

exports.textToRegExp = textToRegExp;

/**
 * Converts filter text into regular expression string
 * @param {string} text as in Filter()
 * @return {string} regular expression representation of filter text
 */
function filterToRegExp(text)
{
  return text
    // remove multiple wildcards
    .replace(/\*+/g, "*")
    // remove anchors following separator placeholder
    .replace(/\^\|$/, "^")
    // escape special symbols
    .replace(/\W/g, "\\$&")
    // replace wildcards by .*
    .replace(/\\\*/g, ".*")
    // process separator placeholders (all ANSI characters but alphanumeric
    // characters and _%.-)
    .replace(/\\\^/g, "(?:[\\x00-\\x24\\x26-\\x2C\\x2F\\x3A-\\x40\\x5B-\\x5E\\x60\\x7B-\\x7F]|$)")
    // process extended anchor at expression start
    .replace(/^\\\|\\\|/, "^[\\w\\-]+:\\/+(?!\\/)(?:[^\\/]+\\.)?")
    // process anchor at expression start
    .replace(/^\\\|/, "^")
    // process anchor at expression end
    .replace(/\\\|$/, "$")
    // remove leading wildcards
    .replace(/^(\.\*)/, "")
    // remove trailing wildcards
    .replace(/(\.\*)$/, "");
}

exports.filterToRegExp = filterToRegExp;

function splitSelector(selector)
{
  if (selector.indexOf(",") == -1)
    return [selector];

  let selectors = [];
  let start = 0;
  let level = 0;
  let sep = "";

  for (let i = 0; i < selector.length; i++)
  {
    let chr = selector[i];

    if (chr == "\\")        // ignore escaped characters
      i++;
    else if (chr == sep)    // don't split within quoted text
      sep = "";             // e.g. [attr=","]
    else if (sep == "")
    {
      if (chr == '"' || chr == "'")
        sep = chr;
      else if (chr == "(")  // don't split between parentheses
        level++;            // e.g. :matches(div,span)
      else if (chr == ")")
        level = Math.max(0, level - 1);
      else if (chr == "," && level == 0)
      {
        selectors.push(selector.substring(start, i));
        start = i + 1;
      }
    }
  }

  selectors.push(selector.substring(start));
  return selectors;
}

exports.splitSelector = splitSelector;


/***/ }),
/* 33 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";
/*
 * This file is part of Adblock Plus <https://adblockplus.org/>,
 * Copyright (C) 2006-present eyeo GmbH
 *
 * Adblock Plus is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3 as
 * published by the Free Software Foundation.
 *
 * Adblock Plus is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with Adblock Plus.  If not, see <http://www.gnu.org/licenses/>.
 */



const {RegExpFilter,
       WhitelistFilter,
       ElemHideFilter} = __webpack_require__(0);
const {SpecialSubscription} =
  __webpack_require__(5);
const {FilterStorage} = __webpack_require__(4);
const {defaultMatcher} = __webpack_require__(9);
const {FilterNotifier} = __webpack_require__(1);
const {extractHostFromFrame} = __webpack_require__(6);
const {port} = __webpack_require__(7);
const {HitLogger, nonRequestTypes} = __webpack_require__(11);

let panels = new Map();

function isActivePanel(panel)
{
  return panel && !panel.reload && !panel.reloading;
}

function getActivePanel(tabId)
{
  let panel = panels.get(tabId);
  if (isActivePanel(panel))
    return panel;
  return null;
}

function getFilterInfo(filter)
{
  if (!filter)
    return null;

  let userDefined = false;
  let subscriptionTitle = null;

  for (let subscription of filter.subscriptions)
  {
    if (!subscription.disabled)
    {
      if (subscription instanceof SpecialSubscription)
        userDefined = true;
      else
        subscriptionTitle = subscription.title;
    }
  }

  return {
    text: filter.text,
    whitelisted: filter instanceof WhitelistFilter,
    userDefined,
    subscription: subscriptionTitle
  };
}

function hasRecord(panel, request, filter)
{
  return panel.records.some(record =>
    record.request.url == request.url &&
    record.request.docDomain == request.docDomain &&

    // Ignore partial (e.g. ELEMHIDE) whitelisting if there is already
    // a DOCUMENT exception which disables all means of blocking.
    (record.request.type == "DOCUMENT" ?
       nonRequestTypes.includes(request.type) :
       record.request.type == request.type) &&

    // Matched element hiding filters don't relate to a particular request,
    // so we have to compare the selector in order to avoid duplicates.
    (record.filter && record.filter.selector) == (filter && filter.selector)
  );
}

function addRecord(panel, request, filter)
{
  if (!hasRecord(panel, request, filter))
  {
    panel.port.postMessage({
      type: "add-record",
      request,
      filter: getFilterInfo(filter)
    });

    panel.records.push({request, filter});
  }
}

function matchRequest(request)
{
  return defaultMatcher.matchesAny(
    request.url,
    RegExpFilter.typeMap[request.type],
    request.docDomain,
    request.thirdParty,
    request.sitekey,
    request.specificOnly
  );
}

function onBeforeRequest(details)
{
  let panel = panels.get(details.tabId);

  // Clear the devtools panel and reload the inspected tab without caching
  // when a new request is issued. However, make sure that we don't end up
  // in an infinite recursion if we already triggered a reload.
  if (panel.reloading)
  {
    panel.reloading = false;
  }
  else
  {
    panel.records = [];
    panel.port.postMessage({type: "reset"});

    // We can't repeat the request if it isn't a GET request. Chrome would
    // prompt the user to confirm reloading the page, and POST requests are
    // known to cause issues on many websites if repeated.
    if (details.method == "GET")
      panel.reload = true;
  }
}

function onLoading(page)
{
  let tabId = page.id;
  let panel = panels.get(tabId);

  // Reloading the tab is the only way that allows bypassing all caches, in
  // order to see all requests in the devtools panel. Reloading must not be
  // performed before the tab changes to "loading", otherwise it will load the
  // previous URL.
  if (panel && panel.reload)
  {
    browser.tabs.reload(tabId, {bypassCache: true});

    panel.reload = false;
    panel.reloading = true;
  }
}

function updateFilters(filters, added)
{
  for (let panel of panels.values())
  {
    for (let i = 0; i < panel.records.length; i++)
    {
      let record = panel.records[i];

      // If an added filter matches a request shown in the devtools panel,
      // update that record to show the new filter. Ignore filters that aren't
      // associated with any sub-resource request. There is no record for these
      // if they don't already match. In particular, in case of element hiding
      // filters, we also wouldn't know if any new element matches.
      if (added)
      {
        if (nonRequestTypes.includes(record.request.type))
          continue;

        let filter = matchRequest(record.request);
        if (!filters.includes(filter))
          continue;

        record.filter = filter;
      }

      // If a filter shown in the devtools panel got removed, update that
      // record to show the filter that matches now, or none, instead.
      // For filters that aren't associated with any sub-resource request,
      // just remove the record. We wouldn't know whether another filter
      // matches instead until the page is reloaded.
      else
      {
        if (!filters.includes(record.filter))
          continue;

        if (nonRequestTypes.includes(record.request.type))
        {
          panel.port.postMessage({
            type: "remove-record",
            index: i
          });
          panel.records.splice(i--, 1);
          continue;
        }

        record.filter = matchRequest(record.request);
      }

      panel.port.postMessage({
        type: "update-record",
        index: i,
        request: record.request,
        filter: getFilterInfo(record.filter)
      });
    }
  }
}

function onFilterAdded(filter)
{
  updateFilters([filter], true);
}

function onFilterRemoved(filter)
{
  updateFilters([filter], false);
}

function onSubscriptionAdded(subscription)
{
  if (subscription instanceof SpecialSubscription)
    updateFilters(subscription.filters, true);
}

browser.runtime.onConnect.addListener(newPort =>
{
  let match = newPort.name.match(/^devtools-(\d+)$/);
  if (!match)
    return;

  let inspectedTabId = parseInt(match[1], 10);
  let localOnBeforeRequest = onBeforeRequest.bind();
  let panel = {port: newPort, records: []};
  let hitListener = addRecord.bind(null, panel);

  browser.webRequest.onBeforeRequest.addListener(
    localOnBeforeRequest,
    {
      urls: ["http://*/*", "https://*/*"],
      types: ["main_frame"],
      tabId: inspectedTabId
    }
  );

  if (panels.size == 0)
  {
    ext.pages.onLoading.addListener(onLoading);
    FilterNotifier.on("filter.added", onFilterAdded);
    FilterNotifier.on("filter.removed", onFilterRemoved);
    FilterNotifier.on("subscription.added", onSubscriptionAdded);
  }

  newPort.onDisconnect.addListener(() =>
  {
    HitLogger.removeListener(inspectedTabId, hitListener);
    panels.delete(inspectedTabId);
    browser.webRequest.onBeforeRequest.removeListener(localOnBeforeRequest);

    if (panels.size == 0)
    {
      ext.pages.onLoading.removeListener(onLoading);
      FilterNotifier.off("filter.added", onFilterAdded);
      FilterNotifier.off("filter.removed", onFilterRemoved);
      FilterNotifier.off("subscription.added", onSubscriptionAdded);
    }
  });

  HitLogger.addListener(inspectedTabId, hitListener);
  panels.set(inspectedTabId, panel);
});


/***/ }),
/* 34 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";
/*
 * This file is part of Adblock Plus <https://adblockplus.org/>,
 * Copyright (C) 2006-present eyeo GmbH
 *
 * Adblock Plus is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3 as
 * published by the Free Software Foundation.
 *
 * Adblock Plus is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with Adblock Plus.  If not, see <http://www.gnu.org/licenses/>.
 */

/* global publicSuffixes */

/** @module tldjs */



/**
 * Get the base domain for given hostname.
 *
 * @param {string} hostname
 * @return {string}
 */
exports.getDomain = hostname =>
{
  let bits = hostname.split(".");
  let cutoff = bits.length - 2;

  for (let i = 0; i < bits.length; i++)
  {
    let offset = publicSuffixes[bits.slice(i).join(".")];

    if (typeof offset != "undefined")
    {
      cutoff = i - offset;
      break;
    }
  }

  if (cutoff <= 0)
    return hostname;

  return bits.slice(cutoff).join(".");
};


/***/ }),
/* 35 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";
/*
 * This file is part of Adblock Plus <https://adblockplus.org/>,
 * Copyright (C) 2006-present eyeo GmbH
 *
 * Adblock Plus is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3 as
 * published by the Free Software Foundation.
 *
 * Adblock Plus is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with Adblock Plus.  If not, see <http://www.gnu.org/licenses/>.
 */

/* global console */



/**
 * This is a specialized RSA library meant only to verify SHA1-based signatures.
 */

const {BigInteger} = __webpack_require__(36);
const Rusha = __webpack_require__(37);

let rusha = new Rusha();

// Define ASN.1 templates for the data structures used
function seq(...args)
{
  return {type: 0x30, children: args};
}
function obj(id)
{
  return {type: 0x06, content: id};
}
function bitStr(contents)
{
  return {type: 0x03, encapsulates: contents};
}
function intResult(id)
{
  return {type: 0x02, out: id};
}
function octetResult(id)
{
  return {type: 0x04, out: id};
}

// See http://www.cryptopp.com/wiki/Keys_and_Formats#RSA_PublicKey
// 2A 86 48 86 F7 0D 01 01 01 means 1.2.840.113549.1.1.1
let publicKeyTemplate = seq(
  seq(obj("\x2A\x86\x48\x86\xF7\x0D\x01\x01\x01"), {}),
  bitStr(seq(intResult("n"), intResult("e")))
);

// See http://tools.ietf.org/html/rfc3447#section-9.2 step 2
// 2B 0E 03 02 1A means 1.3.14.3.2.26
let signatureTemplate = seq(
  seq(obj("\x2B\x0E\x03\x02\x1A"), {}),
  octetResult("sha1")
);

/**
 * Reads ASN.1 data matching the template passed in. This will throw an
 * exception if the data format doesn't match the template. On success an
 * object containing result properties is returned.
 * @see http://luca.ntop.org/Teaching/Appunti/asn1.html for info on the format.
 * @param {string} data
 * @param {Object} templ
 * @returns {Object}
 */
function readASN1(data, templ)
{
  let pos = 0;
  function next()
  {
    return data.charCodeAt(pos++);
  }

  function readLength()
  {
    let len = next();
    if (len & 0x80)
    {
      let cnt = len & 0x7F;
      if (cnt > 2 || cnt == 0)
        throw "Unsupported length";

      len = 0;
      for (let i = 0; i < cnt; i++)
        len += next() << (cnt - 1 - i) * 8;
      return len;
    }
    return len;
  }

  function readNode(curTempl)
  {
    let type = next();
    let len = readLength();
    if ("type" in curTempl && curTempl.type != type)
      throw "Unexpected type";
    if ("content" in curTempl && curTempl.content != data.substr(pos, len))
      throw "Unexpected content";
    if ("out" in curTempl)
      out[curTempl.out] = new BigInteger(data.substr(pos, len), 256);
    if ("children" in curTempl)
    {
      let i;
      let end;
      for (i = 0, end = pos + len; pos < end; i++)
      {
        if (i >= curTempl.children.length)
          throw "Too many children";
        readNode(curTempl.children[i]);
      }
      if (i < curTempl.children.length)
        throw "Too few children";
      if (pos > end)
        throw "Children too large";
    }
    else if ("encapsulates" in curTempl)
    {
      if (next() != 0)
        throw "Encapsulation expected";
      readNode(curTempl.encapsulates);
    }
    else
      pos += len;
  }

  let out = {};
  readNode(templ);
  if (pos != data.length)
    throw "Too much data";
  return out;
}

/**
 * Reads a BER-encoded RSA public key. On success returns an object with the
 * properties n and e (the components of the key), otherwise null.
 * @param {string} key
 * @return {?Object}
 */
function readPublicKey(key)
{
  try
  {
    return readASN1(atob(key), publicKeyTemplate);
  }
  catch (e)
  {
    console.warn("Invalid RSA public key: " + e);
    return null;
  }
}

/**
 * Checks whether the signature is valid for the given public key and data.
 * @param {string} key
 * @param {string} signature
 * @param {string} data
 * @return {boolean}
 */
function verifySignature(key, signature, data)
{
  let keyData = readPublicKey(key);
  if (!keyData)
    return false;

  // We need the exponent as regular number
  keyData.e = parseInt(keyData.e.toString(16), 16);

  // Decrypt signature data using RSA algorithm
  let sigInt = new BigInteger(atob(signature), 256);
  let digest = sigInt.modPowInt(keyData.e, keyData.n).toString(256);

  try
  {
    let pos = 0;
    let next = () => digest.charCodeAt(pos++);

    // Skip padding, see http://tools.ietf.org/html/rfc3447#section-9.2 step 5
    if (next() != 1)
      throw "Wrong padding in signature digest";
    while (next() == 255) {}
    if (digest.charCodeAt(pos - 1) != 0)
      throw "Wrong padding in signature digest";

    // Rest is an ASN.1 structure, get the SHA1 hash from it and compare to
    // the real one
    let {sha1} = readASN1(digest.substr(pos), signatureTemplate);
    let expected = new BigInteger(rusha.digest(data), 16);
    return (sha1.compareTo(expected) == 0);
  }
  catch (e)
  {
    console.warn("Invalid encrypted signature: " + e);
    return false;
  }
}
exports.verifySignature = verifySignature;


/***/ }),
/* 36 */
/***/ (function(module, exports) {

/*
 * Copyright (c) 2003-2005  Tom Wu
 * All Rights Reserved.
 *
 * Permission is hereby granted, free of charge, to any person obtaining
 * a copy of this software and associated documentation files (the
 * "Software"), to deal in the Software without restriction, including
 * without limitation the rights to use, copy, modify, merge, publish,
 * distribute, sublicense, and/or sell copies of the Software, and to
 * permit persons to whom the Software is furnished to do so, subject to
 * the following conditions:
 *
 * The above copyright notice and this permission notice shall be
 * included in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS-IS" AND WITHOUT WARRANTY OF ANY KIND,
 * EXPRESS, IMPLIED OR OTHERWISE, INCLUDING WITHOUT LIMITATION, ANY
 * WARRANTY OF MERCHANTABILITY OR FITNESS FOR A PARTICULAR PURPOSE.
 *
 * IN NO EVENT SHALL TOM WU BE LIABLE FOR ANY SPECIAL, INCIDENTAL,
 * INDIRECT OR CONSEQUENTIAL DAMAGES OF ANY KIND, OR ANY DAMAGES WHATSOEVER
 * RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER OR NOT ADVISED OF
 * THE POSSIBILITY OF DAMAGE, AND ON ANY THEORY OF LIABILITY, ARISING OUT
 * OF OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
 *
 * In addition, the following condition applies:
 *
 * All redistributions must retain an intact copy of this copyright notice
 * and disclaimer.
 */

// Basic JavaScript BN library - subset useful for RSA encryption.

// Bits per digit
var dbits;

// JavaScript engine analysis
var canary = 0xdeadbeefcafe;
var j_lm = ((canary&0xffffff)==0xefcafe);

// (public) Constructor
function BigInteger(a,b,c) {
  if(a != null)
    if("number" == typeof a) this.fromNumber(a,b,c);
    else if(b == null && "string" != typeof a) this.fromString(a,256);
    else this.fromString(a,b);
}
exports.BigInteger = BigInteger;

// return new, unset BigInteger
function nbi() { return new BigInteger(null); }

// am: Compute w_j += (x*this_i), propagate carries,
// c is initial carry, returns final carry.
// c < 3*dvalue, x < 2*dvalue, this_i < dvalue
// We need to select the fastest one that works in this environment.

// am1: use a single mult and divide to get the high bits,
// max digit bits should be 26 because
// max internal value = 2*dvalue^2-2*dvalue (< 2^53)
function am1(i,x,w,j,c,n) {
  while(--n >= 0) {
    var v = x*this[i++]+w[j]+c;
    c = Math.floor(v/0x4000000);
    w[j++] = v&0x3ffffff;
  }
  return c;
}
// am2 avoids a big mult-and-extract completely.
// Max digit bits should be <= 30 because we do bitwise ops
// on values up to 2*hdvalue^2-hdvalue-1 (< 2^31)
function am2(i,x,w,j,c,n) {
  var xl = x&0x7fff, xh = x>>15;
  while(--n >= 0) {
    var l = this[i]&0x7fff;
    var h = this[i++]>>15;
    var m = xh*l+h*xl;
    l = xl*l+((m&0x7fff)<<15)+w[j]+(c&0x3fffffff);
    c = (l>>>30)+(m>>>15)+xh*h+(c>>>30);
    w[j++] = l&0x3fffffff;
  }
  return c;
}
// Alternately, set max digit bits to 28 since some
// browsers slow down when dealing with 32-bit numbers.
function am3(i,x,w,j,c,n) {
  var xl = x&0x3fff, xh = x>>14;
  while(--n >= 0) {
    var l = this[i]&0x3fff;
    var h = this[i++]>>14;
    var m = xh*l+h*xl;
    l = xl*l+((m&0x3fff)<<14)+w[j]+c;
    c = (l>>28)+(m>>14)+xh*h;
    w[j++] = l&0xfffffff;
  }
  return c;
}
if(j_lm && (navigator.appName == "Microsoft Internet Explorer")) {
  BigInteger.prototype.am = am2;
  dbits = 30;
}
else if(j_lm && (navigator.appName != "Netscape")) {
  BigInteger.prototype.am = am1;
  dbits = 26;
}
else { // Mozilla/Netscape seems to prefer am3
  BigInteger.prototype.am = am3;
  dbits = 28;
}

BigInteger.prototype.DB = dbits;
BigInteger.prototype.DM = ((1<<dbits)-1);
BigInteger.prototype.DV = (1<<dbits);

var BI_FP = 52;
BigInteger.prototype.FV = Math.pow(2,BI_FP);
BigInteger.prototype.F1 = BI_FP-dbits;
BigInteger.prototype.F2 = 2*dbits-BI_FP;

// Digit conversions
var BI_RM = "0123456789abcdefghijklmnopqrstuvwxyz";
var BI_RC = new Array();
var rr,vv;
rr = "0".charCodeAt(0);
for(vv = 0; vv <= 9; ++vv) BI_RC[rr++] = vv;
rr = "a".charCodeAt(0);
for(vv = 10; vv < 36; ++vv) BI_RC[rr++] = vv;
rr = "A".charCodeAt(0);
for(vv = 10; vv < 36; ++vv) BI_RC[rr++] = vv;

function int2char(n) { return BI_RM.charAt(n); }
function intAt(s,i) {
  var c = BI_RC[s.charCodeAt(i)];
  return (c==null)?-1:c;
}

// (protected) copy this to r
function bnpCopyTo(r) {
  for(var i = this.t-1; i >= 0; --i) r[i] = this[i];
  r.t = this.t;
  r.s = this.s;
}

// (protected) set from integer value x, -DV <= x < DV
function bnpFromInt(x) {
  this.t = 1;
  this.s = (x<0)?-1:0;
  if(x > 0) this[0] = x;
  else if(x < -1) this[0] = x+DV;
  else this.t = 0;
}

// return bigint initialized to value
function nbv(i) { var r = nbi(); r.fromInt(i); return r; }

// (protected) set from string and radix
function bnpFromString(s,b) {
  var k;
  if(b == 16) k = 4;
  else if(b == 8) k = 3;
  else if(b == 256) k = 8; // byte array
  else if(b == 2) k = 1;
  else if(b == 32) k = 5;
  else if(b == 4) k = 2;
  else { this.fromRadix(s,b); return; }
  this.t = 0;
  this.s = 0;
  var i = s.length, mi = false, sh = 0;
  while(--i >= 0) {
    var x = (k==8)?s.charCodeAt(i)&0xff:intAt(s,i);   /** MODIFIED **/
    if(x < 0) {
      if(s.charAt(i) == "-") mi = true;
      continue;
    }
    mi = false;
    if(sh == 0)
      this[this.t++] = x;
    else if(sh+k > this.DB) {
      this[this.t-1] |= (x&((1<<(this.DB-sh))-1))<<sh;
      this[this.t++] = (x>>(this.DB-sh));
    }
    else
      this[this.t-1] |= x<<sh;
    sh += k;
    if(sh >= this.DB) sh -= this.DB;
  }
  if(k == 8 && (s[0]&0x80) != 0) {
    this.s = -1;
    if(sh > 0) this[this.t-1] |= ((1<<(this.DB-sh))-1)<<sh;
  }
  this.clamp();
  if(mi) BigInteger.ZERO.subTo(this,this);
}

// (protected) clamp off excess high words
function bnpClamp() {
  var c = this.s&this.DM;
  while(this.t > 0 && this[this.t-1] == c) --this.t;
}

// (public) return string representation in given radix
function bnToString(b) {
  if(this.s < 0) return "-"+this.negate().toString(b);
  var k;
  if(b == 16) k = 4;
  else if(b == 8) k = 3;
  else if(b == 256) k = 8; // byte array      /** MODIFIED **/
  else if(b == 2) k = 1;
  else if(b == 32) k = 5;
  else if(b == 4) k = 2;
  else return this.toRadix(b);
  var km = (1<<k)-1, d, m = false, r = "", i = this.t;
  var p = this.DB-(i*this.DB)%k;
  if(i-- > 0) {
    if(p < this.DB && (d = this[i]>>p) > 0) { m = true; r = (k==8)?String.fromCharCode(d):int2char(d); }   /** MODIFIED **/
    while(i >= 0) {
      if(p < k) {
        d = (this[i]&((1<<p)-1))<<(k-p);
        d |= this[--i]>>(p+=this.DB-k);
      }
      else {
        d = (this[i]>>(p-=k))&km;
        if(p <= 0) { p += this.DB; --i; }
      }
      if(d > 0) m = true;
      if(m) r += (k==8)?String.fromCharCode(d):int2char(d);    /** MODIFIED **/
    }
  }
  return m?r:"0";
}

// (public) -this
function bnNegate() { var r = nbi(); BigInteger.ZERO.subTo(this,r); return r; }

// (public) |this|
function bnAbs() { return (this.s<0)?this.negate():this; }

// (public) return + if this > a, - if this < a, 0 if equal
function bnCompareTo(a) {
  var r = this.s-a.s;
  if(r != 0) return r;
  var i = this.t;
  r = i-a.t;
  if(r != 0) return r;
  while(--i >= 0) if((r=this[i]-a[i]) != 0) return r;
  return 0;
}

// returns bit length of the integer x
function nbits(x) {
  var r = 1, t;
  if((t=x>>>16) != 0) { x = t; r += 16; }
  if((t=x>>8) != 0) { x = t; r += 8; }
  if((t=x>>4) != 0) { x = t; r += 4; }
  if((t=x>>2) != 0) { x = t; r += 2; }
  if((t=x>>1) != 0) { x = t; r += 1; }
  return r;
}

// (public) return the number of bits in "this"
function bnBitLength() {
  if(this.t <= 0) return 0;
  return this.DB*(this.t-1)+nbits(this[this.t-1]^(this.s&this.DM));
}

// (protected) r = this << n*DB
function bnpDLShiftTo(n,r) {
  var i;
  for(i = this.t-1; i >= 0; --i) r[i+n] = this[i];
  for(i = n-1; i >= 0; --i) r[i] = 0;
  r.t = this.t+n;
  r.s = this.s;
}

// (protected) r = this >> n*DB
function bnpDRShiftTo(n,r) {
  for(var i = n; i < this.t; ++i) r[i-n] = this[i];
  r.t = Math.max(this.t-n,0);
  r.s = this.s;
}

// (protected) r = this << n
function bnpLShiftTo(n,r) {
  var bs = n%this.DB;
  var cbs = this.DB-bs;
  var bm = (1<<cbs)-1;
  var ds = Math.floor(n/this.DB), c = (this.s<<bs)&this.DM, i;
  for(i = this.t-1; i >= 0; --i) {
    r[i+ds+1] = (this[i]>>cbs)|c;
    c = (this[i]&bm)<<bs;
  }
  for(i = ds-1; i >= 0; --i) r[i] = 0;
  r[ds] = c;
  r.t = this.t+ds+1;
  r.s = this.s;
  r.clamp();
}

// (protected) r = this >> n
function bnpRShiftTo(n,r) {
  r.s = this.s;
  var ds = Math.floor(n/this.DB);
  if(ds >= this.t) { r.t = 0; return; }
  var bs = n%this.DB;
  var cbs = this.DB-bs;
  var bm = (1<<bs)-1;
  r[0] = this[ds]>>bs;
  for(var i = ds+1; i < this.t; ++i) {
    r[i-ds-1] |= (this[i]&bm)<<cbs;
    r[i-ds] = this[i]>>bs;
  }
  if(bs > 0) r[this.t-ds-1] |= (this.s&bm)<<cbs;
  r.t = this.t-ds;
  r.clamp();
}

// (protected) r = this - a
function bnpSubTo(a,r) {
  var i = 0, c = 0, m = Math.min(a.t,this.t);
  while(i < m) {
    c += this[i]-a[i];
    r[i++] = c&this.DM;
    c >>= this.DB;
  }
  if(a.t < this.t) {
    c -= a.s;
    while(i < this.t) {
      c += this[i];
      r[i++] = c&this.DM;
      c >>= this.DB;
    }
    c += this.s;
  }
  else {
    c += this.s;
    while(i < a.t) {
      c -= a[i];
      r[i++] = c&this.DM;
      c >>= this.DB;
    }
    c -= a.s;
  }
  r.s = (c<0)?-1:0;
  if(c < -1) r[i++] = this.DV+c;
  else if(c > 0) r[i++] = c;
  r.t = i;
  r.clamp();
}

// (protected) r = this * a, r != this,a (HAC 14.12)
// "this" should be the larger one if appropriate.
function bnpMultiplyTo(a,r) {
  var x = this.abs(), y = a.abs();
  var i = x.t;
  r.t = i+y.t;
  while(--i >= 0) r[i] = 0;
  for(i = 0; i < y.t; ++i) r[i+x.t] = x.am(0,y[i],r,i,0,x.t);
  r.s = 0;
  r.clamp();
  if(this.s != a.s) BigInteger.ZERO.subTo(r,r);
}

// (protected) r = this^2, r != this (HAC 14.16)
function bnpSquareTo(r) {
  var x = this.abs();
  var i = r.t = 2*x.t;
  while(--i >= 0) r[i] = 0;
  for(i = 0; i < x.t-1; ++i) {
    var c = x.am(i,x[i],r,2*i,0,1);
    if((r[i+x.t]+=x.am(i+1,2*x[i],r,2*i+1,c,x.t-i-1)) >= x.DV) {
      r[i+x.t] -= x.DV;
      r[i+x.t+1] = 1;
    }
  }
  if(r.t > 0) r[r.t-1] += x.am(i,x[i],r,2*i,0,1);
  r.s = 0;
  r.clamp();
}

// (protected) divide this by m, quotient and remainder to q, r (HAC 14.20)
// r != q, this != m.  q or r may be null.
function bnpDivRemTo(m,q,r) {
  var pm = m.abs();
  if(pm.t <= 0) return;
  var pt = this.abs();
  if(pt.t < pm.t) {
    if(q != null) q.fromInt(0);
    if(r != null) this.copyTo(r);
    return;
  }
  if(r == null) r = nbi();
  var y = nbi(), ts = this.s, ms = m.s;
  var nsh = this.DB-nbits(pm[pm.t-1]);	// normalize modulus
  if(nsh > 0) { pm.lShiftTo(nsh,y); pt.lShiftTo(nsh,r); }
  else { pm.copyTo(y); pt.copyTo(r); }
  var ys = y.t;
  var y0 = y[ys-1];
  if(y0 == 0) return;
  var yt = y0*(1<<this.F1)+((ys>1)?y[ys-2]>>this.F2:0);
  var d1 = this.FV/yt, d2 = (1<<this.F1)/yt, e = 1<<this.F2;
  var i = r.t, j = i-ys, t = (q==null)?nbi():q;
  y.dlShiftTo(j,t);
  if(r.compareTo(t) >= 0) {
    r[r.t++] = 1;
    r.subTo(t,r);
  }
  BigInteger.ONE.dlShiftTo(ys,t);
  t.subTo(y,y);	// "negative" y so we can replace sub with am later
  while(y.t < ys) y[y.t++] = 0;
  while(--j >= 0) {
    // Estimate quotient digit
    var qd = (r[--i]==y0)?this.DM:Math.floor(r[i]*d1+(r[i-1]+e)*d2);
    if((r[i]+=y.am(0,qd,r,j,0,ys)) < qd) {	// Try it out
      y.dlShiftTo(j,t);
      r.subTo(t,r);
      while(r[i] < --qd) r.subTo(t,r);
    }
  }
  if(q != null) {
    r.drShiftTo(ys,q);
    if(ts != ms) BigInteger.ZERO.subTo(q,q);
  }
  r.t = ys;
  r.clamp();
  if(nsh > 0) r.rShiftTo(nsh,r);	// Denormalize remainder
  if(ts < 0) BigInteger.ZERO.subTo(r,r);
}

// (public) this mod a
function bnMod(a) {
  var r = nbi();
  this.abs().divRemTo(a,null,r);
  if(this.s < 0 && r.compareTo(BigInteger.ZERO) > 0) a.subTo(r,r);
  return r;
}

// Modular reduction using "classic" algorithm
function Classic(m) { this.m = m; }
function cConvert(x) {
  if(x.s < 0 || x.compareTo(this.m) >= 0) return x.mod(this.m);
  else return x;
}
function cRevert(x) { return x; }
function cReduce(x) { x.divRemTo(this.m,null,x); }
function cMulTo(x,y,r) { x.multiplyTo(y,r); this.reduce(r); }
function cSqrTo(x,r) { x.squareTo(r); this.reduce(r); }

Classic.prototype.convert = cConvert;
Classic.prototype.revert = cRevert;
Classic.prototype.reduce = cReduce;
Classic.prototype.mulTo = cMulTo;
Classic.prototype.sqrTo = cSqrTo;

// (protected) return "-1/this % 2^DB"; useful for Mont. reduction
// justification:
//         xy == 1 (mod m)
//         xy =  1+km
//   xy(2-xy) = (1+km)(1-km)
// x[y(2-xy)] = 1-k^2m^2
// x[y(2-xy)] == 1 (mod m^2)
// if y is 1/x mod m, then y(2-xy) is 1/x mod m^2
// should reduce x and y(2-xy) by m^2 at each step to keep size bounded.
// JS multiply "overflows" differently from C/C++, so care is needed here.
function bnpInvDigit() {
  if(this.t < 1) return 0;
  var x = this[0];
  if((x&1) == 0) return 0;
  var y = x&3;		// y == 1/x mod 2^2
  y = (y*(2-(x&0xf)*y))&0xf;	// y == 1/x mod 2^4
  y = (y*(2-(x&0xff)*y))&0xff;	// y == 1/x mod 2^8
  y = (y*(2-(((x&0xffff)*y)&0xffff)))&0xffff;	// y == 1/x mod 2^16
  // last step - calculate inverse mod DV directly;
  // assumes 16 < DB <= 32 and assumes ability to handle 48-bit ints
  y = (y*(2-x*y%this.DV))%this.DV;		// y == 1/x mod 2^dbits
  // we really want the negative inverse, and -DV < y < DV
  return (y>0)?this.DV-y:-y;
}

// Montgomery reduction
function Montgomery(m) {
  this.m = m;
  this.mp = m.invDigit();
  this.mpl = this.mp&0x7fff;
  this.mph = this.mp>>15;
  this.um = (1<<(m.DB-15))-1;
  this.mt2 = 2*m.t;
}

// xR mod m
function montConvert(x) {
  var r = nbi();
  x.abs().dlShiftTo(this.m.t,r);
  r.divRemTo(this.m,null,r);
  if(x.s < 0 && r.compareTo(BigInteger.ZERO) > 0) this.m.subTo(r,r);
  return r;
}

// x/R mod m
function montRevert(x) {
  var r = nbi();
  x.copyTo(r);
  this.reduce(r);
  return r;
}

// x = x/R mod m (HAC 14.32)
function montReduce(x) {
  while(x.t <= this.mt2)	// pad x so am has enough room later
    x[x.t++] = 0;
  for(var i = 0; i < this.m.t; ++i) {
    // faster way of calculating u0 = x[i]*mp mod DV
    var j = x[i]&0x7fff;
    var u0 = (j*this.mpl+(((j*this.mph+(x[i]>>15)*this.mpl)&this.um)<<15))&x.DM;
    // use am to combine the multiply-shift-add into one call
    j = i+this.m.t;
    x[j] += this.m.am(0,u0,x,i,0,this.m.t);
    // propagate carry
    while(x[j] >= x.DV) { x[j] -= x.DV; x[++j]++; }
  }
  x.clamp();
  x.drShiftTo(this.m.t,x);
  if(x.compareTo(this.m) >= 0) x.subTo(this.m,x);
}

// r = "x^2/R mod m"; x != r
function montSqrTo(x,r) { x.squareTo(r); this.reduce(r); }

// r = "xy/R mod m"; x,y != r
function montMulTo(x,y,r) { x.multiplyTo(y,r); this.reduce(r); }

Montgomery.prototype.convert = montConvert;
Montgomery.prototype.revert = montRevert;
Montgomery.prototype.reduce = montReduce;
Montgomery.prototype.mulTo = montMulTo;
Montgomery.prototype.sqrTo = montSqrTo;

// (protected) true iff this is even
function bnpIsEven() { return ((this.t>0)?(this[0]&1):this.s) == 0; }

// (protected) this^e, e < 2^32, doing sqr and mul with "r" (HAC 14.79)
function bnpExp(e,z) {
  if(e > 0xffffffff || e < 1) return BigInteger.ONE;
  var r = nbi(), r2 = nbi(), g = z.convert(this), i = nbits(e)-1;
  g.copyTo(r);
  while(--i >= 0) {
    z.sqrTo(r,r2);
    if((e&(1<<i)) > 0) z.mulTo(r2,g,r);
    else { var t = r; r = r2; r2 = t; }
  }
  return z.revert(r);
}

// (public) this^e % m, 0 <= e < 2^32
function bnModPowInt(e,m) {
  var z;
  if(e < 256 || m.isEven()) z = new Classic(m); else z = new Montgomery(m);
  return this.exp(e,z);
}

// protected
BigInteger.prototype.copyTo = bnpCopyTo;
BigInteger.prototype.fromInt = bnpFromInt;
BigInteger.prototype.fromString = bnpFromString;
BigInteger.prototype.clamp = bnpClamp;
BigInteger.prototype.dlShiftTo = bnpDLShiftTo;
BigInteger.prototype.drShiftTo = bnpDRShiftTo;
BigInteger.prototype.lShiftTo = bnpLShiftTo;
BigInteger.prototype.rShiftTo = bnpRShiftTo;
BigInteger.prototype.subTo = bnpSubTo;
BigInteger.prototype.multiplyTo = bnpMultiplyTo;
BigInteger.prototype.squareTo = bnpSquareTo;
BigInteger.prototype.divRemTo = bnpDivRemTo;
BigInteger.prototype.invDigit = bnpInvDigit;
BigInteger.prototype.isEven = bnpIsEven;
BigInteger.prototype.exp = bnpExp;

// public
BigInteger.prototype.toString = bnToString;
BigInteger.prototype.negate = bnNegate;
BigInteger.prototype.abs = bnAbs;
BigInteger.prototype.compareTo = bnCompareTo;
BigInteger.prototype.bitLength = bnBitLength;
BigInteger.prototype.mod = bnMod;
BigInteger.prototype.modPowInt = bnModPowInt;

// "constants"
BigInteger.ZERO = nbv(0);
BigInteger.ONE = nbv(1);


/***/ }),
/* 37 */
/***/ (function(module, exports, __webpack_require__) {

(function () {
    var /*
 * Rusha, a JavaScript implementation of the Secure Hash Algorithm, SHA-1,
 * as defined in FIPS PUB 180-1, tuned for high performance with large inputs.
 * (http://github.com/srijs/rusha)
 *
 * Inspired by Paul Johnstons implementation (http://pajhome.org.uk/crypt/md5).
 *
 * Copyright (c) 2013 Sam Rijs (http://awesam.de).
 * Released under the terms of the MIT license as follows:
 *
 * Permission is hereby granted, free of charge, to any person obtaining a
 * copy of this software and associated documentation files (the "Software"),
 * to deal in the Software without restriction, including without limitation
 * the rights to use, copy, modify, merge, publish, distribute, sublicense,
 * and/or sell copies of the Software, and to permit persons to whom the
 * Software is furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
 * FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS
 * IN THE SOFTWARE.
 */
    util = {
        getDataType: function (data) {
            if (typeof data === 'string') {
                return 'string';
            }
            if (data instanceof Array) {
                return 'array';
            }
            if (typeof global !== 'undefined' && global.Buffer && global.Buffer.isBuffer(data)) {
                return 'buffer';
            }
            if (data instanceof ArrayBuffer) {
                return 'arraybuffer';
            }
            if (data.buffer instanceof ArrayBuffer) {
                return 'view';
            }
            if (data instanceof Blob) {
                return 'blob';
            }
            throw new Error('Unsupported data type.');
        }
    };
    function Rusha(chunkSize) {
        'use strict';
        var // Private object structure.
        self$2 = { fill: 0 };
        var // Calculate the length of buffer that the sha1 routine uses
        // including the padding.
        padlen = function (len) {
            for (len += 9; len % 64 > 0; len += 1);
            return len;
        };
        var padZeroes = function (bin, len) {
            for (var i$2 = len >> 2; i$2 < bin.length; i$2++)
                bin[i$2] = 0;
        };
        var padData = function (bin, chunkLen, msgLen) {
            bin[chunkLen >> 2] |= 128 << 24 - (chunkLen % 4 << 3);
            // To support msgLen >= 2 GiB, use a float division when computing the
            // high 32-bits of the big-endian message length in bits.
            bin[((chunkLen >> 2) + 2 & ~15) + 14] = msgLen / (1 << 29) | 0;
            bin[((chunkLen >> 2) + 2 & ~15) + 15] = msgLen << 3;
        };
        var // Convert a binary string and write it to the heap.
        // A binary string is expected to only contain char codes < 256.
        convStr = function (H8, H32, start, len, off) {
            var str = this, i$2, om = off % 4, lm = len % 4, j = len - lm;
            if (j > 0) {
                switch (om) {
                case 0:
                    H8[off + 3 | 0] = str.charCodeAt(start);
                case 1:
                    H8[off + 2 | 0] = str.charCodeAt(start + 1);
                case 2:
                    H8[off + 1 | 0] = str.charCodeAt(start + 2);
                case 3:
                    H8[off | 0] = str.charCodeAt(start + 3);
                }
            }
            for (i$2 = om; i$2 < j; i$2 = i$2 + 4 | 0) {
                H32[off + i$2 >> 2] = str.charCodeAt(start + i$2) << 24 | str.charCodeAt(start + i$2 + 1) << 16 | str.charCodeAt(start + i$2 + 2) << 8 | str.charCodeAt(start + i$2 + 3);
            }
            switch (lm) {
            case 3:
                H8[off + j + 1 | 0] = str.charCodeAt(start + j + 2);
            case 2:
                H8[off + j + 2 | 0] = str.charCodeAt(start + j + 1);
            case 1:
                H8[off + j + 3 | 0] = str.charCodeAt(start + j);
            }
        };
        var // Convert a buffer or array and write it to the heap.
        // The buffer or array is expected to only contain elements < 256.
        convBuf = function (H8, H32, start, len, off) {
            var buf = this, i$2, om = off % 4, lm = len % 4, j = len - lm;
            if (j > 0) {
                switch (om) {
                case 0:
                    H8[off + 3 | 0] = buf[start];
                case 1:
                    H8[off + 2 | 0] = buf[start + 1];
                case 2:
                    H8[off + 1 | 0] = buf[start + 2];
                case 3:
                    H8[off | 0] = buf[start + 3];
                }
            }
            for (i$2 = 4 - om; i$2 < j; i$2 = i$2 += 4 | 0) {
                H32[off + i$2 >> 2] = buf[start + i$2] << 24 | buf[start + i$2 + 1] << 16 | buf[start + i$2 + 2] << 8 | buf[start + i$2 + 3];
            }
            switch (lm) {
            case 3:
                H8[off + j + 1 | 0] = buf[start + j + 2];
            case 2:
                H8[off + j + 2 | 0] = buf[start + j + 1];
            case 1:
                H8[off + j + 3 | 0] = buf[start + j];
            }
        };
        var convBlob = function (H8, H32, start, len, off) {
            var blob = this, i$2, om = off % 4, lm = len % 4, j = len - lm;
            var buf = new Uint8Array(reader.readAsArrayBuffer(blob.slice(start, start + len)));
            if (j > 0) {
                switch (om) {
                case 0:
                    H8[off + 3 | 0] = buf[0];
                case 1:
                    H8[off + 2 | 0] = buf[1];
                case 2:
                    H8[off + 1 | 0] = buf[2];
                case 3:
                    H8[off | 0] = buf[3];
                }
            }
            for (i$2 = 4 - om; i$2 < j; i$2 = i$2 += 4 | 0) {
                H32[off + i$2 >> 2] = buf[i$2] << 24 | buf[i$2 + 1] << 16 | buf[i$2 + 2] << 8 | buf[i$2 + 3];
            }
            switch (lm) {
            case 3:
                H8[off + j + 1 | 0] = buf[j + 2];
            case 2:
                H8[off + j + 2 | 0] = buf[j + 1];
            case 1:
                H8[off + j + 3 | 0] = buf[j];
            }
        };
        var convFn = function (data) {
            switch (util.getDataType(data)) {
            case 'string':
                return convStr.bind(data);
            case 'array':
                return convBuf.bind(data);
            case 'buffer':
                return convBuf.bind(data);
            case 'arraybuffer':
                return convBuf.bind(new Uint8Array(data));
            case 'view':
                return convBuf.bind(new Uint8Array(data.buffer, data.byteOffset, data.byteLength));
            case 'blob':
                return convBlob.bind(data);
            }
        };
        var slice = function (data, offset) {
            switch (util.getDataType(data)) {
            case 'string':
                return data.slice(offset);
            case 'array':
                return data.slice(offset);
            case 'buffer':
                return data.slice(offset);
            case 'arraybuffer':
                return data.slice(offset);
            case 'view':
                return data.buffer.slice(offset);
            }
        };
        var // Precompute 00 - ff strings
        precomputedHex = new Array(256);
        for (var i = 0; i < 256; i++) {
            precomputedHex[i] = (i < 16 ? '0' : '') + i.toString(16);
        }
        var // Convert an ArrayBuffer into its hexadecimal string representation.
        hex = function (arrayBuffer) {
            var binarray = new Uint8Array(arrayBuffer);
            var res = new Array(arrayBuffer.byteLength);
            for (var i$2 = 0; i$2 < res.length; i$2++) {
                res[i$2] = precomputedHex[binarray[i$2]];
            }
            return res.join('');
        };
        var ceilHeapSize = function (v) {
            // The asm.js spec says:
            // The heap object's byteLength must be either
            // 2^n for n in [12, 24) or 2^24 * n for n ≥ 1.
            // Also, byteLengths smaller than 2^16 are deprecated.
            var p;
            if (// If v is smaller than 2^16, the smallest possible solution
                // is 2^16.
                v <= 65536)
                return 65536;
            if (// If v < 2^24, we round up to 2^n,
                // otherwise we round up to 2^24 * n.
                v < 16777216) {
                for (p = 1; p < v; p = p << 1);
            } else {
                for (p = 16777216; p < v; p += 16777216);
            }
            return p;
        };
        var // Initialize the internal data structures to a new capacity.
        init = function (size) {
            if (size % 64 > 0) {
                throw new Error('Chunk size must be a multiple of 128 bit');
            }
            self$2.maxChunkLen = size;
            self$2.padMaxChunkLen = padlen(size);
            // The size of the heap is the sum of:
            // 1. The padded input message size
            // 2. The extended space the algorithm needs (320 byte)
            // 3. The 160 bit state the algoritm uses
            self$2.heap = new ArrayBuffer(ceilHeapSize(self$2.padMaxChunkLen + 320 + 20));
            self$2.h32 = new Int32Array(self$2.heap);
            self$2.h8 = new Int8Array(self$2.heap);
            self$2.core = new Rusha._core({
                Int32Array: Int32Array,
                DataView: DataView
            }, {}, self$2.heap);
            self$2.buffer = null;
        };
        // Iinitializethe datastructures according
        // to a chunk siyze.
        init(chunkSize || 64 * 1024);
        var initState = function (heap, padMsgLen) {
            var io = new Int32Array(heap, padMsgLen + 320, 5);
            io[0] = 1732584193;
            io[1] = -271733879;
            io[2] = -1732584194;
            io[3] = 271733878;
            io[4] = -1009589776;
        };
        var padChunk = function (chunkLen, msgLen) {
            var padChunkLen = padlen(chunkLen);
            var view = new Int32Array(self$2.heap, 0, padChunkLen >> 2);
            padZeroes(view, chunkLen);
            padData(view, chunkLen, msgLen);
            return padChunkLen;
        };
        var // Write data to the heap.
        write = function (data, chunkOffset, chunkLen) {
            convFn(data)(self$2.h8, self$2.h32, chunkOffset, chunkLen, 0);
        };
        var // Initialize and call the RushaCore,
        // assuming an input buffer of length len * 4.
        coreCall = function (data, chunkOffset, chunkLen, msgLen, finalize) {
            var padChunkLen = chunkLen;
            if (finalize) {
                padChunkLen = padChunk(chunkLen, msgLen);
            }
            write(data, chunkOffset, chunkLen);
            self$2.core.hash(padChunkLen, self$2.padMaxChunkLen);
        };
        var getRawDigest = function (heap, padMaxChunkLen) {
            var io = new Int32Array(heap, padMaxChunkLen + 320, 5);
            var out = new Int32Array(5);
            var arr = new DataView(out.buffer);
            arr.setInt32(0, io[0], false);
            arr.setInt32(4, io[1], false);
            arr.setInt32(8, io[2], false);
            arr.setInt32(12, io[3], false);
            arr.setInt32(16, io[4], false);
            return out;
        };
        var // Calculate the hash digest as an array of 5 32bit integers.
        rawDigest = this.rawDigest = function (str) {
            var msgLen = str.byteLength || str.length || str.size || 0;
            initState(self$2.heap, self$2.padMaxChunkLen);
            var chunkOffset = 0, chunkLen = self$2.maxChunkLen, last;
            for (chunkOffset = 0; msgLen > chunkOffset + chunkLen; chunkOffset += chunkLen) {
                coreCall(str, chunkOffset, chunkLen, msgLen, false);
            }
            coreCall(str, chunkOffset, msgLen - chunkOffset, msgLen, true);
            return getRawDigest(self$2.heap, self$2.padMaxChunkLen);
        };
        // The digest and digestFrom* interface returns the hash digest
        // as a hex string.
        this.digest = this.digestFromString = this.digestFromBuffer = this.digestFromArrayBuffer = function (str) {
            return hex(rawDigest(str).buffer);
        };
    }
    ;
    // The low-level RushCore module provides the heart of Rusha,
    // a high-speed sha1 implementation working on an Int32Array heap.
    // At first glance, the implementation seems complicated, however
    // with the SHA1 spec at hand, it is obvious this almost a textbook
    // implementation that has a few functions hand-inlined and a few loops
    // hand-unrolled.
    Rusha._core = function RushaCore(stdlib, foreign, heap) {
        'use asm';
        var H = new stdlib.Int32Array(heap);
        function hash(k, x) {
            // k in bytes
            k = k | 0;
            x = x | 0;
            var i = 0, j = 0, y0 = 0, z0 = 0, y1 = 0, z1 = 0, y2 = 0, z2 = 0, y3 = 0, z3 = 0, y4 = 0, z4 = 0, t0 = 0, t1 = 0;
            y0 = H[x + 320 >> 2] | 0;
            y1 = H[x + 324 >> 2] | 0;
            y2 = H[x + 328 >> 2] | 0;
            y3 = H[x + 332 >> 2] | 0;
            y4 = H[x + 336 >> 2] | 0;
            for (i = 0; (i | 0) < (k | 0); i = i + 64 | 0) {
                z0 = y0;
                z1 = y1;
                z2 = y2;
                z3 = y3;
                z4 = y4;
                for (j = 0; (j | 0) < 64; j = j + 4 | 0) {
                    t1 = H[i + j >> 2] | 0;
                    t0 = ((y0 << 5 | y0 >>> 27) + (y1 & y2 | ~y1 & y3) | 0) + ((t1 + y4 | 0) + 1518500249 | 0) | 0;
                    y4 = y3;
                    y3 = y2;
                    y2 = y1 << 30 | y1 >>> 2;
                    y1 = y0;
                    y0 = t0;
                    H[k + j >> 2] = t1;
                }
                for (j = k + 64 | 0; (j | 0) < (k + 80 | 0); j = j + 4 | 0) {
                    t1 = (H[j - 12 >> 2] ^ H[j - 32 >> 2] ^ H[j - 56 >> 2] ^ H[j - 64 >> 2]) << 1 | (H[j - 12 >> 2] ^ H[j - 32 >> 2] ^ H[j - 56 >> 2] ^ H[j - 64 >> 2]) >>> 31;
                    t0 = ((y0 << 5 | y0 >>> 27) + (y1 & y2 | ~y1 & y3) | 0) + ((t1 + y4 | 0) + 1518500249 | 0) | 0;
                    y4 = y3;
                    y3 = y2;
                    y2 = y1 << 30 | y1 >>> 2;
                    y1 = y0;
                    y0 = t0;
                    H[j >> 2] = t1;
                }
                for (j = k + 80 | 0; (j | 0) < (k + 160 | 0); j = j + 4 | 0) {
                    t1 = (H[j - 12 >> 2] ^ H[j - 32 >> 2] ^ H[j - 56 >> 2] ^ H[j - 64 >> 2]) << 1 | (H[j - 12 >> 2] ^ H[j - 32 >> 2] ^ H[j - 56 >> 2] ^ H[j - 64 >> 2]) >>> 31;
                    t0 = ((y0 << 5 | y0 >>> 27) + (y1 ^ y2 ^ y3) | 0) + ((t1 + y4 | 0) + 1859775393 | 0) | 0;
                    y4 = y3;
                    y3 = y2;
                    y2 = y1 << 30 | y1 >>> 2;
                    y1 = y0;
                    y0 = t0;
                    H[j >> 2] = t1;
                }
                for (j = k + 160 | 0; (j | 0) < (k + 240 | 0); j = j + 4 | 0) {
                    t1 = (H[j - 12 >> 2] ^ H[j - 32 >> 2] ^ H[j - 56 >> 2] ^ H[j - 64 >> 2]) << 1 | (H[j - 12 >> 2] ^ H[j - 32 >> 2] ^ H[j - 56 >> 2] ^ H[j - 64 >> 2]) >>> 31;
                    t0 = ((y0 << 5 | y0 >>> 27) + (y1 & y2 | y1 & y3 | y2 & y3) | 0) + ((t1 + y4 | 0) - 1894007588 | 0) | 0;
                    y4 = y3;
                    y3 = y2;
                    y2 = y1 << 30 | y1 >>> 2;
                    y1 = y0;
                    y0 = t0;
                    H[j >> 2] = t1;
                }
                for (j = k + 240 | 0; (j | 0) < (k + 320 | 0); j = j + 4 | 0) {
                    t1 = (H[j - 12 >> 2] ^ H[j - 32 >> 2] ^ H[j - 56 >> 2] ^ H[j - 64 >> 2]) << 1 | (H[j - 12 >> 2] ^ H[j - 32 >> 2] ^ H[j - 56 >> 2] ^ H[j - 64 >> 2]) >>> 31;
                    t0 = ((y0 << 5 | y0 >>> 27) + (y1 ^ y2 ^ y3) | 0) + ((t1 + y4 | 0) - 899497514 | 0) | 0;
                    y4 = y3;
                    y3 = y2;
                    y2 = y1 << 30 | y1 >>> 2;
                    y1 = y0;
                    y0 = t0;
                    H[j >> 2] = t1;
                }
                y0 = y0 + z0 | 0;
                y1 = y1 + z1 | 0;
                y2 = y2 + z2 | 0;
                y3 = y3 + z3 | 0;
                y4 = y4 + z4 | 0;
            }
            H[x + 320 >> 2] = y0;
            H[x + 324 >> 2] = y1;
            H[x + 328 >> 2] = y2;
            H[x + 332 >> 2] = y3;
            H[x + 336 >> 2] = y4;
        }
        return { hash: hash };
    };
    exports = Rusha;
    if (// If we'e running in Node.JS, export a module.
        true) {
        module.exports = Rusha;
    } else {// If we're running in Adblock Plus, export a module.
        exports = Rusha;
    }
    if (// If we're running in a webworker, accept
        // messages containing a jobid and a buffer
        // or blob object, and return the hash result.
        typeof FileReaderSync !== 'undefined') {
        var reader = new FileReaderSync(), hasher = new Rusha(4 * 1024 * 1024);
        self.onmessage = function onMessage(event) {
            var hash, data = event.data.data;
            try {
                hash = hasher.digest(data);
                self.postMessage({
                    id: event.data.id,
                    hash: hash
                });
            } catch (e) {
                self.postMessage({
                    id: event.data.id,
                    error: e.name
                });
            }
        };
    }
}());


/***/ }),
/* 38 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";
/*
 * This file is part of Adblock Plus <https://adblockplus.org/>,
 * Copyright (C) 2006-present eyeo GmbH
 *
 * Adblock Plus is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3 as
 * published by the Free Software Foundation.
 *
 * Adblock Plus is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with Adblock Plus.  If not, see <http://www.gnu.org/licenses/>.
 */

/** @module popupBlocker */



const {defaultMatcher} = __webpack_require__(9);
const {BlockingFilter,
       RegExpFilter} = __webpack_require__(0);
const {isThirdParty, extractHostFromFrame} = __webpack_require__(6);
const {checkWhitelisted} = __webpack_require__(8);
const {logRequest} = __webpack_require__(11);

let loadingPopups = new Map();

function forgetPopup(tabId)
{
  loadingPopups.delete(tabId);

  if (loadingPopups.size == 0)
  {
    browser.webRequest.onBeforeRequest.removeListener(onPopupURLChanged);
    browser.webNavigation.onCommitted.removeListener(onPopupURLChanged);
    browser.webNavigation.onCompleted.removeListener(onCompleted);
    browser.tabs.onRemoved.removeListener(forgetPopup);
  }
}

function checkPotentialPopup(tabId, popup)
{
  let url = popup.url || "about:blank";
  let documentHost = extractHostFromFrame(popup.sourceFrame);
  let thirdParty = isThirdParty(new URL(url), documentHost);

  let specificOnly = !!checkWhitelisted(
    popup.sourcePage, popup.sourceFrame, null,
    RegExpFilter.typeMap.GENERICBLOCK
  );

  let filter = defaultMatcher.matchesAny(
    url, RegExpFilter.typeMap.POPUP,
    documentHost, thirdParty, null, specificOnly
  );

  if (filter instanceof BlockingFilter)
    browser.tabs.remove(tabId);

  logRequest(
    [popup.sourcePage.id],
    {url, type: "POPUP", docDomain: documentHost, thirdParty, specificOnly},
    filter
  );
}

function onPopupURLChanged(details)
{
  // Ignore frames inside the popup window.
  if (details.frameId != 0)
    return;

  let popup = loadingPopups.get(details.tabId);
  if (popup)
  {
    popup.url = details.url;
    if (popup.sourceFrame)
      checkPotentialPopup(details.tabId, popup);
  }
}

function onCompleted(details)
{
  if (details.frameId == 0 && details.url != "about:blank")
    forgetPopup(details.tabId);
}

// Versions of Firefox before 54 do not support
// webNavigation.onCreatedNavigationTarget
// https://bugzilla.mozilla.org/show_bug.cgi?id=1190687
if ("onCreatedNavigationTarget" in browser.webNavigation)
{
  browser.webNavigation.onCreatedNavigationTarget.addListener(details =>
  {
    if (loadingPopups.size == 0)
    {
      browser.webRequest.onBeforeRequest.addListener(
        onPopupURLChanged,
        {
          urls: ["http://*/*", "https://*/*"],
          types: ["main_frame"]
        }
      );
      browser.webNavigation.onCommitted.addListener(onPopupURLChanged);
      browser.webNavigation.onCompleted.addListener(onCompleted);
      browser.tabs.onRemoved.addListener(forgetPopup);
    }

    let popup = {
      url: details.url,
      sourcePage: new ext.Page({id: details.sourceTabId}),
      sourceFrame: null
    };

    loadingPopups.set(details.tabId, popup);

    let frame = ext.getFrame(details.sourceTabId, details.sourceFrameId);

    if (checkWhitelisted(popup.sourcePage, frame))
    {
      forgetPopup(details.tabId);
    }
    else
    {
      popup.sourceFrame = frame;
      checkPotentialPopup(details.tabId, popup);
    }
  });
}


/***/ }),
/* 39 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";
/*
 * This file is part of Adblock Plus <https://adblockplus.org/>,
 * Copyright (C) 2006-present eyeo GmbH
 *
 * Adblock Plus is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3 as
 * published by the Free Software Foundation.
 *
 * Adblock Plus is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with Adblock Plus.  If not, see <http://www.gnu.org/licenses/>.
 */



const {defaultMatcher} = __webpack_require__(9);
const {RegExpFilter, WhitelistFilter} =
  __webpack_require__(0);
const {extractHostFromFrame, isThirdParty} = __webpack_require__(6);
const {checkWhitelisted} = __webpack_require__(8);
const {FilterNotifier} = __webpack_require__(1);
const {logRequest} = __webpack_require__(11);

const {typeMap} = RegExpFilter;

browser.webRequest.onHeadersReceived.addListener(details =>
{
  let url = new URL(details.url);
  let parentFrame = ext.getFrame(details.tabId, details.parentFrameId);
  let hostname = extractHostFromFrame(parentFrame) || url.hostname;
  let thirdParty = isThirdParty(url, hostname);

  let cspMatch = defaultMatcher.matchesAny(details.url, typeMap.CSP, hostname,
                                           thirdParty, null, false);
  if (cspMatch)
  {
    let page = new ext.Page({id: details.tabId, url: details.url});
    let frame = ext.getFrame(details.tabId, details.frameId);

    if (checkWhitelisted(page, frame))
      return;

    // To avoid an extra matchesAny for the common case we assumed no
    // $genericblock filters applied when searching for a matching $csp filter.
    // We must now pay the price by first checking for a $genericblock filter
    // and if necessary that our $csp filter is specific.
    let specificOnly = !!checkWhitelisted(page, frame, null,
                                          typeMap.GENERICBLOCK);
    if (specificOnly)
    {
      cspMatch = defaultMatcher.matchesAny(details.url, typeMap.CSP, hostname,
                                           thirdParty, null, specificOnly);
      if (!cspMatch)
        return;
    }

    logRequest([details.tabId], {
      url: details.url, type: "CSP", docDomain: hostname,
      thirdParty, specificOnly
    }, cspMatch);
    FilterNotifier.emit("filter.hitCount", cspMatch, 0, 0, [details.tabId]);

    if (cspMatch instanceof WhitelistFilter)
      return;

    details.responseHeaders.push({
      name: "Content-Security-Policy",
      value: cspMatch.csp
    });

    return {responseHeaders: details.responseHeaders};
  }
}, {
  urls: ["http://*/*", "https://*/*"],
  types: ["main_frame", "sub_frame"]
}, ["blocking", "responseHeaders"]);


/***/ }),
/* 40 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";
/*
 * This file is part of Adblock Plus <https://adblockplus.org/>,
 * Copyright (C) 2006-present eyeo GmbH
 *
 * Adblock Plus is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3 as
 * published by the Free Software Foundation.
 *
 * Adblock Plus is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with Adblock Plus.  If not, see <http://www.gnu.org/licenses/>.
 */

/** @module cssInjection */



const {RegExpFilter} = __webpack_require__(0);
const {ElemHide} = __webpack_require__(14);
const {ElemHideEmulation} = __webpack_require__(20);
const {checkWhitelisted} = __webpack_require__(8);
const {extractHostFromFrame} = __webpack_require__(6);
const {port} = __webpack_require__(7);
const {HitLogger} = __webpack_require__(11);
const info = __webpack_require__(3);

// Chromium's support for tabs.removeCSS is still a work in progress and the
// API is likely to be different from Firefox's; for now we just don't use it
// at all, even if it's available.
// See https://crbug.com/608854
const styleSheetRemovalSupported = info.platform == "gecko";

const selectorGroupSize = 1024;

let userStyleSheetsSupported = true;

function* splitSelectors(selectors)
{
  // Chromium's Blink engine supports only up to 8,192 simple selectors, and
  // even fewer compound selectors, in a rule. The exact number of selectors
  // that would work depends on their sizes (e.g. "#foo .bar" has a size of 2).
  // Since we don't know the sizes of the selectors here, we simply split them
  // into groups of 1,024, based on the reasonable assumption that the average
  // selector won't have a size greater than 8. The alternative would be to
  // calculate the sizes of the selectors and divide them up accordingly, but
  // this approach is more efficient and has worked well in practice. In theory
  // this could still lead to some selectors not working on Chromium, but it is
  // highly unlikely.
  // See issue #6298 and https://crbug.com/804179
  for (let i = 0; i < selectors.length; i += selectorGroupSize)
    yield selectors.slice(i, i + selectorGroupSize);
}

function* createRules(selectors)
{
  for (let selectorGroup of splitSelectors(selectors))
    yield selectorGroup.join(", ") + " {display: none !important;}";
}

function createStyleSheet(selectors)
{
  return Array.from(createRules(selectors)).join("\n");
}

function addStyleSheet(tabId, frameId, styleSheet)
{
  try
  {
    let promise = browser.tabs.insertCSS(tabId, {
      code: styleSheet,
      cssOrigin: "user",
      frameId,
      matchAboutBlank: true,
      runAt: "document_start"
    });

    // See error handling notes in the catch block.
    promise.catch(() => {});
  }
  catch (error)
  {
    // If the error is about the "cssOrigin" option, this is an older version
    // of Chromium (65 and below) or Firefox (52 and below) that does not
    // support user style sheets.
    if (/\bcssOrigin\b/.test(error.message))
      userStyleSheetsSupported = false;

    // For other errors, we simply return false to indicate failure.
    //
    // One common error that occurs frequently is when a frame is not found
    // (e.g. "Error: No frame with id 574 in tab 266"), which can happen when
    // the code in the parent document has removed the frame before the
    // background page has had a chance to respond to the content script's
    // "elemhide.getSelectors" message. We simply ignore such errors, because
    // otherwise they show up in the log too often and make debugging
    // difficult.
    //
    // Also note that the missing frame error is thrown synchronously on
    // Firefox, while on Chromium it is an asychronous promise rejection. In
    // the latter case, we cannot indicate failure to the caller, but we still
    // explicitly ignore the error.
    return false;
  }

  return true;
}

function removeStyleSheet(tabId, frameId, styleSheet)
{
  if (!styleSheetRemovalSupported)
    return;

  browser.tabs.removeCSS(tabId, {
    code: styleSheet,
    cssOrigin: "user",
    frameId,
    matchAboutBlank: true
  });
}

function updateFrameStyles(tabId, frameId, selectors, groupName, appendOnly)
{
  let styleSheet = "";
  if (selectors.length > 0)
    styleSheet = createStyleSheet(selectors);

  let frame = ext.getFrame(tabId, frameId);
  if (!frame)
    return false;

  if (!frame.injectedStyleSheets)
    frame.injectedStyleSheets = new Map();

  let oldStyleSheet = frame.injectedStyleSheets.get(groupName);

  if (appendOnly && oldStyleSheet)
    styleSheet = oldStyleSheet + styleSheet;

  // Ideally we would compare the old and new style sheets and skip this code
  // if they're the same, but the old style sheet can be a leftover from a
  // previous instance of the frame. We must add the new style sheet
  // regardless.

  // Add the new style sheet first to keep previously hidden elements from
  // reappearing momentarily.
  if (styleSheet && !addStyleSheet(tabId, frameId, styleSheet))
    return false;

  // Sometimes the old and new style sheets can be exactly the same. In such a
  // case, do not remove the "old" style sheet, because it is in fact the new
  // style sheet now.
  if (oldStyleSheet && oldStyleSheet != styleSheet)
    removeStyleSheet(tabId, frameId, oldStyleSheet);

  frame.injectedStyleSheets.set(groupName, styleSheet);
  return true;
}

port.on("elemhide.getSelectors", (message, sender) =>
{
  let selectors = [];
  let emulatedPatterns = [];
  let trace = HitLogger.hasListener(sender.page.id);
  let inline = !userStyleSheetsSupported;

  if (!checkWhitelisted(sender.page, sender.frame, null,
                        RegExpFilter.typeMap.DOCUMENT |
                        RegExpFilter.typeMap.ELEMHIDE))
  {
    let hostname = extractHostFromFrame(sender.frame);
    let specificOnly = checkWhitelisted(sender.page, sender.frame, null,
                                        RegExpFilter.typeMap.GENERICHIDE);

    selectors = ElemHide.getSelectorsForDomain(hostname, specificOnly);

    for (let filter of ElemHideEmulation.getRulesForDomain(hostname))
      emulatedPatterns.push({selector: filter.selector, text: filter.text});
  }

  if (!inline && !updateFrameStyles(sender.page.id, sender.frame.id,
                                    selectors, "standard"))
  {
    inline = true;
  }

  let response = {trace, inline, emulatedPatterns};
  if (trace || inline)
    response.selectors = selectors;

  // If we can't remove user style sheets using tabs.removeCSS, we'll only keep
  // adding them, which could cause problems with emulation filters as
  // described in issue #5864. Instead, we can just ask the content script to
  // add styles for emulation filters inline.
  if (!styleSheetRemovalSupported)
    response.inlineEmulated = true;

  return response;
});

port.on("elemhide.injectSelectors", (message, sender) =>
{
  updateFrameStyles(sender.page.id, sender.frame.id, message.selectors,
                    message.groupName, message.appendOnly);
});


/***/ }),
/* 41 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";
/*
 * This file is part of Adblock Plus <https://adblockplus.org/>,
 * Copyright (C) 2006-present eyeo GmbH
 *
 * Adblock Plus is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3 as
 * published by the Free Software Foundation.
 *
 * Adblock Plus is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with Adblock Plus.  If not, see <http://www.gnu.org/licenses/>.
 */

/* globals require */



(function(global)
{
  const {port} = __webpack_require__(7);
  const {Prefs} = __webpack_require__(2);
  const {Utils} = __webpack_require__(10);
  const {FilterStorage} = __webpack_require__(4);
  const {FilterNotifier} = __webpack_require__(1);
  const {defaultMatcher} = __webpack_require__(9);
  const {Notification: NotificationStorage} = __webpack_require__(16);
  const {getActiveNotification, shouldDisplay,
         notificationClicked} = __webpack_require__(24);
  const {HitLogger} = __webpack_require__(11);

  const {
    Filter, ActiveFilter, BlockingFilter, RegExpFilter
  } = __webpack_require__(0);
  const {Synchronizer} = __webpack_require__(15);

  const info = __webpack_require__(3);
  const {
    Subscription,
    DownloadableSubscription,
    SpecialSubscription,
    RegularSubscription
  } = __webpack_require__(5);

  const {showOptions} = __webpack_require__(45);

  port.on("types.get", (message, sender) =>
  {
    const filterTypes = Array.from(__webpack_require__(23).filterTypes);
    filterTypes.push(...filterTypes.splice(filterTypes.indexOf("OTHER"), 1));
    return filterTypes;
  });

  function convertObject(keys, obj)
  {
    const result = {};
    for (const key of keys)
    {
      if (key in obj)
        result[key] = obj[key];
    }
    return result;
  }

  function convertSubscription(subscription)
  {
    const obj = convertObject(["disabled", "downloadStatus", "homepage",
                               "version", "lastDownload", "lastSuccess",
                               "softExpiration", "expires", "title",
                               "url"], subscription);
    if (subscription instanceof SpecialSubscription)
      obj.filters = subscription.filters.map(convertFilter);
    obj.isDownloading = Synchronizer.isExecuting(subscription.url);
    return obj;
  }

  const convertFilter = convertObject.bind(null, ["text"]);

  const uiPorts = new Map();
  const listenedPreferences = Object.create(null);
  const listenedFilterChanges = Object.create(null);
  const messageTypes = new Map([
    ["app", "app.respond"],
    ["filter", "filters.respond"],
    ["pref", "prefs.respond"],
    ["requests", "requests.respond"],
    ["subscription", "subscriptions.respond"]
  ]);

  function sendMessage(type, action, ...args)
  {
    if (uiPorts.size == 0)
      return;

    const convertedArgs = [];
    for (const arg of args)
    {
      if (arg instanceof Subscription)
        convertedArgs.push(convertSubscription(arg));
      else if (arg instanceof Filter)
        convertedArgs.push(convertFilter(arg));
      else
        convertedArgs.push(arg);
    }

    for (const [uiPort, filters] of uiPorts)
    {
      const actions = filters.get(type);
      if (actions && actions.indexOf(action) != -1)
      {
        uiPort.postMessage({
          type: messageTypes.get(type),
          action,
          args: convertedArgs
        });
      }
    }
  }

  function includeActiveRemoteSubscriptions(s)
  {
    if (s.disabled || !(s instanceof RegularSubscription))
      return false;
    if (s instanceof DownloadableSubscription &&
        !/^(http|https|ftp):/i.test(s.url))
      return false;
    return true;
  }

  function addRequestListeners(dataCollectionTabId, issueReporterTabId)
  {
    const logRequest = (request, filter) =>
    {
      let subscriptions = [];
      if (filter)
      {
        subscriptions = filter.subscriptions.
                        filter(includeActiveRemoteSubscriptions).
                        map(s => s.url);
        filter = convertFilter(filter);
      }
      request = convertObject(["url", "type", "docDomain", "thirdParty"],
                              request);
      sendMessage("requests", "hits", request, filter, subscriptions);
    };
    const removeTabListeners = (tabId) =>
    {
      if (tabId == dataCollectionTabId || tabId == issueReporterTabId)
      {
        HitLogger.removeListener(dataCollectionTabId, logRequest);
        browser.tabs.onRemoved.removeListener(removeTabListeners);
      }
    };
    HitLogger.addListener(dataCollectionTabId, logRequest);
    browser.tabs.onRemoved.addListener(removeTabListeners);
  }

  function addFilterListeners(type, actions)
  {
    for (const action of actions)
    {
      let name;
      if (type == "filter" && action == "loaded")
        name = "load";
      else
        name = type + "." + action;

      if (!(name in listenedFilterChanges))
      {
        listenedFilterChanges[name] = null;
        FilterNotifier.on(name, (item) =>
        {
          sendMessage(type, action, item);
        });
      }
    }
  }

  function addSubscription(subscription, properties)
  {
    subscription.disabled = false;
    if ("title" in properties)
      subscription.title = properties.title;
    if ("homepage" in properties)
      subscription.homepage = properties.homepage;

    FilterStorage.addSubscription(subscription);
    if (subscription instanceof DownloadableSubscription &&
        !subscription.lastDownload)
      Synchronizer.execute(subscription);
  }

  port.on("app.get", (message, sender) =>
  {
    if (message.what == "issues")
    {
      const subscriptionInit = __webpack_require__(25);
      return {
        dataCorrupted: subscriptionInit.isDataCorrupted(),
        filterlistsReinitialized: subscriptionInit.isReinitialized()
      };
    }

    if (message.what == "doclink")
    {
      let {application} = info;
      if (info.platform == "chromium" && application != "opera")
        application = "chrome";
      else if (info.platform == "gecko")
        application = "firefox";

      return Utils.getDocLink(message.link.replace("{browser}", application));
    }

    if (message.what == "localeInfo")
    {
      let bidiDir;
      if ("chromeRegistry" in Utils)
      {
        const isRtl = Utils.chromeRegistry.isLocaleRTL("adblockplus");
        bidiDir = isRtl ? "rtl" : "ltr";
      }
      else
        bidiDir = Utils.readingDirection;

      return {locale: Utils.appLocale, bidiDir};
    }

    if (message.what == "features")
    {
      return {
        devToolsPanel: info.platform == "chromium" ||
                       info.application == "firefox" &&
                       parseInt(info.applicationVersion, 10) >= 54
      };
    }

    if (message.what == "senderId")
      return sender.page.id;

    return info[message.what];
  });

  port.on("app.open", (message, sender) =>
  {
    if (message.what == "options")
    {
      showOptions(() =>
      {
        if (!message.action)
          return;

        sendMessage("app", message.action, ...message.args);
      });
    }
  });

  port.on("filters.add", (message, sender) =>
  {
    const result = __webpack_require__(17).parseFilter(message.text);
    const errors = [];
    if (result.error)
      errors.push(result.error.toString());
    else if (result.filter)
      FilterStorage.addFilter(result.filter);

    return errors;
  });

  port.on("filters.blocked", (message, sender) =>
  {
    const filter = defaultMatcher.matchesAny(message.url,
      RegExpFilter.typeMap[message.requestType], message.docDomain,
      message.thirdParty);

    return filter instanceof BlockingFilter;
  });

  port.on("filters.get", (message, sender) =>
  {
    const subscription = Subscription.fromURL(message.subscriptionUrl);
    if (!subscription)
      return [];

    return subscription.filters.map(convertFilter);
  });

  port.on("filters.importRaw", (message, sender) =>
  {
    const result = __webpack_require__(17).parseFilters(message.text);
    const errors = [];
    for (const error of result.errors)
    {
      if (error.type != "unexpected-filter-list-header")
        errors.push(error.toString());
    }

    if (errors.length > 0)
      return errors;

    const seenFilter = Object.create(null);
    for (const filter of result.filters)
    {
      FilterStorage.addFilter(filter);
      seenFilter[filter.text] = null;
    }

    if (!message.removeExisting)
      return errors;

    for (const subscription of FilterStorage.subscriptions)
    {
      if (!(subscription instanceof SpecialSubscription))
        continue;

      for (let j = subscription.filters.length - 1; j >= 0; j--)
      {
        const filter = subscription.filters[j];
        if (/^@@\|\|([^/:]+)\^\$document$/.test(filter.text))
          continue;

        if (!(filter.text in seenFilter))
          FilterStorage.removeFilter(filter);
      }
    }

    return errors;
  });

  port.on("filters.remove", (message, sender) =>
  {
    const filter = Filter.fromText(message.text);
    let subscription = null;
    if (message.subscriptionUrl)
      subscription = Subscription.fromURL(message.subscriptionUrl);

    if (!subscription)
      FilterStorage.removeFilter(filter);
    else
      FilterStorage.removeFilter(filter, subscription, message.index);
  });

  port.on("prefs.get", (message, sender) =>
  {
    return Prefs[message.key];
  });

  port.on("prefs.set", (message, sender) =>
  {
    if (message.key == "notifications_ignoredcategories")
      return NotificationStorage.toggleIgnoreCategory("*", !!message.value);

    return Prefs[message.key] = message.value;
  });

  port.on("prefs.toggle", (message, sender) =>
  {
    if (message.key == "notifications_ignoredcategories")
      return NotificationStorage.toggleIgnoreCategory("*");

    return Prefs[message.key] = !Prefs[message.key];
  });

  port.on("notifications.get", (message, sender) =>
  {
    const notification = getActiveNotification();

    if (!notification ||
        "displayMethod" in message &&
        !shouldDisplay(message.displayMethod, notification.type))
      return;

    const texts = NotificationStorage.getLocalizedTexts(notification,
                                                      message.locale);
    return Object.assign({texts}, notification);
  });

  port.on("notifications.clicked", (message, sender) =>
  {
    notificationClicked();
  });

  port.on("subscriptions.add", (message, sender) =>
  {
    const subscription = Subscription.fromURL(message.url);
    if (message.confirm)
    {
      if ("title" in message)
        subscription.title = message.title;
      if ("homepage" in message)
        subscription.homepage = message.homepage;

      showOptions(() =>
      {
        sendMessage("app", "addSubscription", subscription);
      });
    }
    else
    {
      addSubscription(subscription, message);
    }
  });

  port.on("subscriptions.get", (message, sender) =>
  {
    const subscriptions = FilterStorage.subscriptions.filter((s) =>
    {
      if (message.ignoreDisabled && s.disabled)
        return false;
      if (s instanceof DownloadableSubscription && message.downloadable)
        return true;
      if (s instanceof SpecialSubscription && message.special)
        return true;
      return false;
    });

    return subscriptions.map((s) =>
    {
      const result = convertSubscription(s);
      if (message.disabledFilters)
      {
        result.disabledFilters = s.filters
                      .filter((f) => f instanceof ActiveFilter && f.disabled)
                      .map((f) => f.text);
      }
      return result;
    });
  });

  port.on("subscriptions.remove", (message, sender) =>
  {
    const subscription = Subscription.fromURL(message.url);
    if (subscription.url in FilterStorage.knownSubscriptions)
      FilterStorage.removeSubscription(subscription);
  });

  port.on("subscriptions.toggle", (message, sender) =>
  {
    const subscription = Subscription.fromURL(message.url);
    if (subscription.url in FilterStorage.knownSubscriptions)
    {
      if (subscription.disabled || message.keepInstalled)
        subscription.disabled = !subscription.disabled;
      else
        FilterStorage.removeSubscription(subscription);
    }
    else
    {
      addSubscription(subscription, message);
    }
  });

  port.on("subscriptions.update", (message, sender) =>
  {
    let {subscriptions} = FilterStorage;
    if (message.url)
      subscriptions = [Subscription.fromURL(message.url)];

    for (const subscription of subscriptions)
    {
      if (subscription instanceof DownloadableSubscription)
        Synchronizer.execute(subscription, true);
    }
  });

  function listen(type, filters, newFilter, message, senderTabId)
  {
    switch (type)
    {
      case "app":
        filters.set("app", newFilter);
        break;
      case "filters":
        filters.set("filter", newFilter);
        addFilterListeners("filter", newFilter);
        break;
      case "prefs":
        filters.set("pref", newFilter);
        for (const preference of newFilter)
        {
          if (!(preference in listenedPreferences))
          {
            listenedPreferences[preference] = null;
            Prefs.on(preference, () =>
            {
              sendMessage("pref", preference, Prefs[preference]);
            });
          }
        }
        break;
      case "subscriptions":
        filters.set("subscription", newFilter);
        addFilterListeners("subscription", newFilter);
        break;
      case "requests":
        filters.set("requests", newFilter);
        addRequestListeners(message.tabId, senderTabId);
        break;
    }
  }

  function onConnect(uiPort)
  {
    if (uiPort.name != "ui")
      return;

    const filters = new Map();
    uiPorts.set(uiPort, filters);

    uiPort.onDisconnect.addListener(() =>
    {
      uiPorts.delete(uiPort);
    });

    uiPort.onMessage.addListener((message) =>
    {
      const [type, action] = message.type.split(".", 2);

      // For now we're only using long-lived connections for handling
      // "*.listen" messages to tackle #6440
      if (action == "listen")
      {
        listen(type, filters, message.filter, message, uiPort.sender.tab.id);
      }
    });
  }

  browser.runtime.onConnect.addListener(onConnect);
})(this);


/***/ }),
/* 42 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";
/*
 * This file is part of Adblock Plus <https://adblockplus.org/>,
 * Copyright (C) 2006-present eyeo GmbH
 *
 * Adblock Plus is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3 as
 * published by the Free Software Foundation.
 *
 * Adblock Plus is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with Adblock Plus.  If not, see <http://www.gnu.org/licenses/>.
 */

/** @module icon */



const {FilterNotifier} = __webpack_require__(1);

const frameOpacities = [0.0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9,
                        1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0,
                        0.9, 0.8, 0.7, 0.6, 0.5, 0.4, 0.3, 0.2, 0.1, 0.0];
const numberOfFrames = frameOpacities.length;

let stopRequested = false;
let canUpdateIcon = true;
let notRunning = Promise.resolve();
let whitelistedState = new ext.PageMap();

function loadImage(url)
{
  return new Promise((resolve, reject) =>
  {
    let image = new Image();
    image.src = url;
    image.addEventListener("load", () =>
    {
      resolve(image);
    });
    image.addEventListener("error", () =>
    {
      reject("Failed to load image " + url);
    });
  });
}

function setIcon(page, notificationType, opacity, frames)
{
  opacity = opacity || 0;
  let whitelisted = !!whitelistedState.get(page);

  if (!notificationType || !frames)
  {
    if (opacity > 0.5)
    {
      page.browserAction.setIcon("/icons/abp-$size-notification-" +
                                 notificationType + ".png");
    }
    else
    {
      page.browserAction.setIcon("/icons/abp-$size" +
                                 (whitelisted ? "-whitelisted" : "") + ".png");
    }
  }
  else
  {
    browser.browserAction.setIcon({
      tabId: page.id,
      imageData: frames["" + opacity + whitelisted]
    });
  }
}

FilterNotifier.on("page.WhitelistingStateRevalidate", (page, filter) =>
{
  whitelistedState.set(page, !!filter);
  if (canUpdateIcon)
    setIcon(page);
});

function renderFrames(notificationType)
{
  return Promise.all([
    loadImage("icons/abp-16.png"),
    loadImage("icons/abp-16-whitelisted.png"),
    loadImage("icons/abp-16-notification-" + notificationType + ".png"),
    loadImage("icons/abp-19.png"),
    loadImage("icons/abp-19-whitelisted.png"),
    loadImage("icons/abp-19-notification-" + notificationType + ".png"),
    loadImage("icons/abp-20.png"),
    loadImage("icons/abp-20-whitelisted.png"),
    loadImage("icons/abp-20-notification-" + notificationType + ".png"),
    loadImage("icons/abp-32.png"),
    loadImage("icons/abp-32-whitelisted.png"),
    loadImage("icons/abp-32-notification-" + notificationType + ".png"),
    loadImage("icons/abp-38.png"),
    loadImage("icons/abp-38-whitelisted.png"),
    loadImage("icons/abp-38-notification-" + notificationType + ".png"),
    loadImage("icons/abp-40.png"),
    loadImage("icons/abp-40-whitelisted.png"),
    loadImage("icons/abp-40-notification-" + notificationType + ".png")
  ]).then(images =>
  {
    let imageMap = {
      16: {base: [images[0], images[1]], overlay: images[2]},
      19: {base: [images[3], images[4]], overlay: images[5]},
      20: {base: [images[6], images[7]], overlay: images[8]},
      32: {base: [images[9], images[10]], overlay: images[11]},
      38: {base: [images[12], images[13]], overlay: images[14]},
      40: {base: [images[15], images[16]], overlay: images[17]}
    };

    let frames = {};
    let canvas = document.createElement("canvas");
    let context = canvas.getContext("2d");

    for (let whitelisted of [false, true])
    {
      for (let i = 0, opacity = 0; i <= 10; opacity = ++i / 10)
      {
        let imageData = {};
        let sizes = [16, 19, 20, 32, 38, 40];
        for (let size of sizes)
        {
          canvas.width = size;
          canvas.height = size;
          context.globalAlpha = 1;
          context.drawImage(imageMap[size]["base"][whitelisted | 0], 0, 0);
          context.globalAlpha = opacity;
          context.drawImage(imageMap[size]["overlay"], 0, 0);
          imageData[size] = context.getImageData(0, 0, size, size);
        }
        frames["" + opacity + whitelisted] = imageData;
      }
    }

    return frames;
  });
}

function animateIcon(notificationType, frames)
{
  browser.tabs.query({active: true}, tabs =>
  {
    let pages = tabs.map(tab => new ext.Page(tab));

    let animationStep = 0;
    let opacity = 0;

    let onActivated = page =>
    {
      pages.push(page);
      setIcon(page, notificationType, opacity, frames);
    };
    ext.pages.onActivated.addListener(onActivated);

    canUpdateIcon = false;
    let interval = setInterval(() =>
    {
      let oldOpacity = opacity;
      opacity = frameOpacities[animationStep++];

      if (opacity != oldOpacity)
      {
        for (let page of pages)
        {
          if (whitelistedState.has(page))
            setIcon(page, notificationType, opacity, frames);
        }
      }

      if (animationStep > numberOfFrames)
      {
        clearInterval(interval);
        ext.pages.onActivated.removeListener(onActivated);
        canUpdateIcon = true;
      }
    }, 100);
  });
}

let stopIconAnimation =
/**
 * Stops to animate the browser action icon
 * after the current interval has been finished.
 *
 * @return {Promise} A promise that is fullfilled when
 *                   the icon animation has been stopped.
 */
exports.stopIconAnimation = () =>
{
  stopRequested = true;
  return notRunning.then(() =>
  {
    stopRequested = false;
  });
};

/**
 * Starts to animate the browser action icon to indicate a pending notifcation.
 * If the icon is already animated, it replaces the previous
 * animation as soon as the current interval has been finished.
 *
 * @param {string} type  The notification type (i.e: "information" or
 *                       "critical".)
 */
exports.startIconAnimation = type =>
{
  notRunning = new Promise(resolve =>
  {
    Promise.all([renderFrames(type), stopIconAnimation()]).then(results =>
    {
      if (stopRequested)
      {
        resolve();
        return;
      }

      let frames = results[0];
      animateIcon(type, frames);

      let interval = setInterval(() =>
      {
        if (stopRequested)
        {
          clearInterval(interval);
          resolve();
          return;
        }

        animateIcon(type, frames);
      }, 10000);
    });
  });
};


/***/ }),
/* 43 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";
/*
 * This file is part of Adblock Plus <https://adblockplus.org/>,
 * Copyright (C) 2006-present eyeo GmbH
 *
 * Adblock Plus is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3 as
 * published by the Free Software Foundation.
 *
 * Adblock Plus is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with Adblock Plus.  If not, see <http://www.gnu.org/licenses/>.
 */



const {Prefs} = __webpack_require__(2);
const {ActiveFilter} = __webpack_require__(0);
const {FilterStorage} = __webpack_require__(4);
const {FilterNotifier} = __webpack_require__(1);
const {Subscription} = __webpack_require__(5);
const {Notification} = __webpack_require__(16);

exports.initAntiAdblockNotification = function initAntiAdblockNotification()
{
  const notification = {
    id: "antiadblock",
    type: "question",
    title: browser.i18n.getMessage("notification_antiadblock_title"),
    message: browser.i18n.getMessage("notification_antiadblock_message"),
    urlFilters: []
  };

  function notificationListener(approved)
  {
    const subanti = Prefs.subscriptions_antiadblockurl;
    const subscription = Subscription.fromURL(subanti);
    if (subscription.url in FilterStorage.knownSubscriptions)
      subscription.disabled = !approved;
  }

  function addAntiAdblockNotification(subscription)
  {
    const urlFilters = [];
    for (const filter of subscription.filters)
    {
      if (filter instanceof ActiveFilter && filter.domains)
      {
        for (const [domain, included] of filter.domains)
        {
          const urlFilter = "||" + domain + "^$document";
          if (domain && included && urlFilters.indexOf(urlFilter) == -1)
            urlFilters.push(urlFilter);
        }
      }
    }
    notification.urlFilters = urlFilters;
    Notification.addNotification(notification);
    Notification.addQuestionListener(notification.id, notificationListener);
  }

  function removeAntiAdblockNotification()
  {
    Notification.removeNotification(notification);
    Notification.removeQuestionListener(notification.id, notificationListener);
  }

  const antiAdblockSubscription = Subscription.fromURL(
    Prefs.subscriptions_antiadblockurl
  );
  if (antiAdblockSubscription.lastDownload && antiAdblockSubscription.disabled)
    addAntiAdblockNotification(antiAdblockSubscription);

  function onSubscriptionChange(subscription)
  {
    const url = Prefs.subscriptions_antiadblockurl;
    if (url != subscription.url)
      return;

    if (url in FilterStorage.knownSubscriptions && subscription.disabled)
      addAntiAdblockNotification(subscription);
    else
      removeAntiAdblockNotification();
  }

  FilterNotifier.on("subscription.updated", onSubscriptionChange);
  FilterNotifier.on("subscription.removed", onSubscriptionChange);
  FilterNotifier.on("subscription.disabled", onSubscriptionChange);
};


/***/ }),
/* 44 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";
/*
 * This file is part of Adblock Plus <https://adblockplus.org/>,
 * Copyright (C) 2006-present eyeo GmbH
 *
 * Adblock Plus is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3 as
 * published by the Free Software Foundation.
 *
 * Adblock Plus is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with Adblock Plus.  If not, see <http://www.gnu.org/licenses/>.
 */

/** @module options */



const {checkWhitelisted} = __webpack_require__(8);
const info = __webpack_require__(3);

const manifest = browser.runtime.getManifest();
const optionsUrl = manifest.options_page || manifest.options_ui.page;

function findOptionsTab(callback)
{
  browser.tabs.query({}, tabs =>
  {
    // We find a tab ourselves because Edge has a bug when quering tabs with
    // extension URL protocol:
    // https://developer.microsoft.com/en-us/microsoft-edge/platform/issues/8094141/
    // https://developer.microsoft.com/en-us/microsoft-edge/platform/issues/8604703/
    // Firefox won't let us query for moz-extension:// pages either, though
    // starting with Firefox 56 an extension can query for its own URLs:
    // https://bugzilla.mozilla.org/show_bug.cgi?id=1271354
    let fullOptionsUrl = browser.extension.getURL(optionsUrl);
    let optionsTab = tabs.find(tab => tab.url == fullOptionsUrl);
    if (optionsTab)
    {
      callback(optionsTab);
      return;
    }

    // Newly created tabs might have about:blank as their URL in Firefox rather
    // than the final options page URL, we need to wait for those to finish
    // loading.
    let potentialOptionTabIds = new Set(
      tabs.filter(tab => tab.url == "about:blank" && tab.status == "loading")
          .map(tab => tab.id)
    );
    if (potentialOptionTabIds.size == 0)
    {
      callback();
      return;
    }
    let removeListener;
    let updateListener = (tabId, changeInfo, tab) =>
    {
      if (potentialOptionTabIds.has(tabId) &&
          changeInfo.status == "complete")
      {
        potentialOptionTabIds.delete(tabId);
        let urlMatch = tab.url == fullOptionsUrl;
        if (urlMatch || potentialOptionTabIds.size == 0)
        {
          browser.tabs.onUpdated.removeListener(updateListener);
          browser.tabs.onRemoved.removeListener(removeListener);
          callback(urlMatch ? tab : undefined);
        }
      }
    };
    browser.tabs.onUpdated.addListener(updateListener);
    removeListener = removedTabId =>
    {
      potentialOptionTabIds.delete(removedTabId);
      if (potentialOptionTabIds.size == 0)
      {
        browser.tabs.onUpdated.removeListener(updateListener);
        browser.tabs.onRemoved.removeListener(removeListener);
        callback();
      }
    };
    browser.tabs.onRemoved.addListener(removeListener);
  });
}

function returnShowOptionsCall(optionsTab, callback)
{
  if (!callback)
    return;

  if (optionsTab)
  {
    callback(new ext.Page(optionsTab));
  }
  else
  {
    // If we don't already have an options page, it means we've just opened
    // one, in which case we must find the tab, wait for it to be ready, and
    // then return the call.
    findOptionsTab(tab =>
    {
      if (!tab)
        return;

      function onMessage(message, port)
      {
        if (message.type != "app.listen")
          return;

        port.onMessage.removeListener(onMessage);
        callback(new ext.Page(tab), port);
      }

      function onConnect(port)
      {
        if (port.name != "ui" || port.sender.tab.id != tab.id)
          return;

        browser.runtime.onConnect.removeListener(onConnect);
        port.onMessage.addListener(onMessage);
      }

      browser.runtime.onConnect.addListener(onConnect);
    });
  }
}

let showOptions =
/**
 * Opens the options page.
 *
 * @param {function} callback
 */
exports.showOptions = callback =>
{
  findOptionsTab(optionsTab =>
  {
    // Edge does not yet support runtime.openOptionsPage (tested version 38)
    if ("openOptionsPage" in browser.runtime &&
        // Some versions of Firefox for Android before version 57 do have a
        // runtime.openOptionsPage but it doesn't do anything.
        // https://bugzilla.mozilla.org/show_bug.cgi?id=1364945
        (info.application != "fennec" ||
         parseInt(info.applicationVersion, 10) >= 57))
    {
      browser.runtime.openOptionsPage(() =>
      {
        returnShowOptionsCall(optionsTab, callback);
      });
    }
    else if (optionsTab)
    {
      // Firefox for Android before version 57 does not support
      // runtime.openOptionsPage, nor does it support the windows API.
      // Since there is effectively only one window on the mobile browser,
      // there's no need to bring it into focus.
      if ("windows" in browser)
        browser.windows.update(optionsTab.windowId, {focused: true});

      browser.tabs.update(optionsTab.id, {active: true});

      returnShowOptionsCall(optionsTab, callback);
    }
    else
    {
      // We use a relative URL here because of this Edge issue:
      // https://developer.microsoft.com/en-us/microsoft-edge/platform/issues/10276332
      browser.tabs.create({url: optionsUrl}, () =>
      {
        returnShowOptionsCall(optionsTab, callback);
      });
    }
  });
};

// We need to clear the popup URL on Firefox for Android in order for the
// options page to open instead of the bubble. Unfortunately there's a bug[1]
// which prevents us from doing that, so we must avoid setting the URL on
// Firefox from the manifest at all, instead setting it here only for
// non-mobile.
// [1] - https://bugzilla.mozilla.org/show_bug.cgi?id=1414613
if ("getBrowserInfo" in browser.runtime)
{
  Promise.all([browser.browserAction.getPopup({}),
               browser.runtime.getBrowserInfo()]).then(
    ([popup, browserInfo]) =>
    {
      if (!popup && browserInfo.name != "Fennec")
        browser.browserAction.setPopup({popup: "popup.html"});
    }
  );
}

// On Firefox for Android, open the options page directly when the browser
// action is clicked.
browser.browserAction.onClicked.addListener(() =>
{
  browser.tabs.query({active: true, lastFocusedWindow: true}, ([tab]) =>
  {
    let currentPage = new ext.Page(tab);

    showOptions((optionsPage, port) =>
    {
      if (!/^https?:$/.test(currentPage.url.protocol))
        return;

      port.postMessage({
        type: "app.respond",
        action: "showPageOptions",
        args: [
          {
            host: currentPage.url.hostname.replace(/^www\./, ""),
            whitelisted: !!checkWhitelisted(currentPage)
          }
        ]
      });
    });
  });
});


/***/ }),
/* 45 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";
/** @module adblock-betafish/alias/options */



// the AdBlock build script over writes ABP options page
const optionsUrl = "options.html";

function findOptionsTab(callback)
{
  browser.tabs.query({}, tabs =>
  {
    // We find a tab ourselves because Edge has a bug when quering tabs with
    // extension URL protocol:
    // https://developer.microsoft.com/en-us/microsoft-edge/platform/issues/8094141/
    // https://developer.microsoft.com/en-us/microsoft-edge/platform/issues/8604703/
    // Firefox won't let us query for moz-extension:// pages either, though
    // starting with Firefox 56 an extension can query for its own URLs:
    // https://bugzilla.mozilla.org/show_bug.cgi?id=1271354
    let fullOptionsUrl = browser.extension.getURL(optionsUrl);
    let optionsTab = tabs.find(tab => tab.url == fullOptionsUrl);
    if (optionsTab)
    {
      callback(optionsTab);
      return;
    }

    // Newly created tabs might have about:blank as their URL in Firefox rather
    // than the final options page URL, we need to wait for those to finish
    // loading.
    let potentialOptionTabIds = new Set(
      tabs.filter(tab => tab.url == "about:blank" && tab.status == "loading")
          .map(tab => tab.id)
    );
    if (potentialOptionTabIds.size == 0)
    {
      callback();
      return;
    }
    let removeListener;
    let updateListener = (tabId, changeInfo, tab) =>
    {
      if (potentialOptionTabIds.has(tabId) &&
          changeInfo.status == "complete")
      {
        potentialOptionTabIds.delete(tabId);
        let urlMatch = tab.url == fullOptionsUrl;
        if (urlMatch || potentialOptionTabIds.size == 0)
        {
          browser.tabs.onUpdated.removeListener(updateListener);
          browser.tabs.onRemoved.removeListener(removeListener);
          callback(urlMatch ? tab : undefined);
        }
      }
    };
    browser.tabs.onUpdated.addListener(updateListener);
    removeListener = removedTabId =>
    {
      potentialOptionTabIds.delete(removedTabId);
      if (potentialOptionTabIds.size == 0)
      {
        browser.tabs.onUpdated.removeListener(updateListener);
        browser.tabs.onRemoved.removeListener(removeListener);
        callback();
      }
    };
    browser.tabs.onRemoved.addListener(removeListener);
  });
}

function returnShowOptionsCall(optionsTab, callback)
{
  if (!callback)
    return;

  if (optionsTab)
  {
    callback(new ext.Page(optionsTab));
  }
  else
  {
    // If we don't already have an options page, it means we've just opened
    // one, in which case we must find the tab, wait for it to be ready, and
    // then return the call.
    findOptionsTab(tab =>
    {
      if (!tab)
        return;

      function onMessage(message, port)
      {
        if (message.type != "app.listen")
          return;

        port.onMessage.removeListener(onMessage);
        callback(new ext.Page(tab), port);
      }

      function onConnect(port)
      {
        if (port.name != "ui" || port.sender.tab.id != tab.id)
          return;

        browser.runtime.onConnect.removeListener(onConnect);
        port.onMessage.addListener(onMessage);
      }

      browser.runtime.onConnect.addListener(onConnect);
    });
  }
}

let showOptions =
/**
 * Opens the options page.
 *
 * @param {function} callback
 */
exports.showOptions = callback =>
{
  findOptionsTab(optionsTab =>
  {
    if (optionsTab)
    {
      // Firefox for Android before version 57 does not support
      // runtime.openOptionsPage, nor does it support the windows API.
      // Since there is effectively only one window on the mobile browser,
      // there's no need to bring it into focus.
      if ("windows" in browser)
        browser.windows.update(optionsTab.windowId, {focused: true});

      browser.tabs.update(optionsTab.id, {active: true});

      returnShowOptionsCall(optionsTab, callback);
    }
    else
    {
      // We use a relative URL here because of this Edge issue:
      // https://developer.microsoft.com/en-us/microsoft-edge/platform/issues/10276332
      browser.tabs.create({url: optionsUrl}, () =>
      {
        returnShowOptionsCall(optionsTab, callback);
      });
    }
  });
};

browser.browserAction.setPopup({popup: "adblock-button-popup.html"});


/***/ }),
/* 46 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";
/*
 * This file is part of Adblock Plus <https://adblockplus.org/>,
 * Copyright (C) 2006-present eyeo GmbH
 *
 * Adblock Plus is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3 as
 * published by the Free Software Foundation.
 *
 * Adblock Plus is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with Adblock Plus.  If not, see <http://www.gnu.org/licenses/>.
 */



/**
 * The version of major updates that the user should be aware of. Should be
 * incremented with every new iteration of the updates page.
 * See also Prefs.last_updates_page_displayed
 *
 * @type {number}
 */
exports.updatesVersion = 1;


/***/ }),
/* 47 */
/***/ (function(module, exports) {

﻿// Send the file name and line number of any error message. This will help us
// to trace down any frequent errors we can't confirm ourselves.
window.addEventListener("error", function(e)
{
  if (!e.filename && !e.lineno && !e.colno && !e.error && !e.message) {
    return;
  }
  var str = "Error: " +
           (e.filename||"anywhere").replace(chrome.extension.getURL(""), "") +
           ":" + (e.lineno||"anywhere") +
           ":" + (e.colno||"anycol");
  if (e.message) {
    str += ": " + e.message;
  }
  var src = e.target.src || e.target.href;
  if (src) {
    str += "src: " + src;
  }
  if (e.error)
  {
      var stack = "-" + (e.error.message ||"") +
                  "-" + (e.error.stack ||"");
      stack = stack.replace(/:/gi, ";").replace(/\n/gi, "");
      //only append the stack info if there isn't any URL info in the stack trace
      if (stack.indexOf("http") === -1)
      {
         str += stack;
      }
      //don't send large stack traces
      if (str.length > 1024)
      {
        str = str.substr(0,1023);
      }
  }
  chromeStorageSetHelper("errorkey", "Date added:" + new Date() + " " + str);
  console.log(str);
});

/***/ }),
/* 48 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

// Set to true to get noisier console.log statements
var VERBOSE_DEBUG = false;

// Temporary...
var SAFARI = false;

// Global variable for Opera, so we can make specific things for Opera
var OPERA = navigator.userAgent.indexOf("OPR") > -1;

// Enabled in adblock_start_common.js and background.js if the user wants
var logging = function (enabled) {
  if (enabled) {
    loggingEnable = true;
    window.log = function () {
      if (VERBOSE_DEBUG || arguments[0] != '[DEBUG]') // comment out for verbosity
        console.log.apply(console, arguments);
    };
  } else {
    window.log = function () {
    };

    loggingEnable = false;
  }
};

logging(false); // disabled by default
var loggingEnable = false;

// Behaves very similarly to $.ready() but does not require jQuery.
var onReady = function (callback) {
    if (document.readyState === 'complete')
        window.setTimeout(callback, 0);
    else
        window.addEventListener('load', callback, false);
  };

// Excecute any bandaid for the specific site, if the bandaids.js was loaded.
onReady(function()
{
  if (typeof run_bandaids === "function")
  {
    run_bandaids();
  }
});

var translate = function (messageID, args) {
  if (Array.isArray(args)) {
    for (var i = 0; i < args.length; i++) {
      if (typeof args[i] !== 'string') {
        args[i] = args[i].toString();
      }
    }
  } else if (args && typeof args !== 'string') {
    args = args.toString();
  }

  return chrome.i18n.getMessage(messageID, args);
};

var splitMessageWithReplacementText = function(rawMessageText, messageID) {
    var anchorStartPos = rawMessageText.indexOf('[[');
    var anchorEndPos = rawMessageText.indexOf(']]');

    if (anchorStartPos === -1 || anchorEndPos === -1) {
      log("replacement tag not found", messageID, rawMessageText, anchorStartPos, anchorEndPos);
      return { error: "no brackets found" };
    }
    var returnObj = {};
    returnObj.anchorPrefixText = rawMessageText.substring(0, anchorStartPos);
    returnObj.anchorText = rawMessageText.substring(anchorStartPos + 2, anchorEndPos);
    returnObj.anchorPostfixText = rawMessageText.substring(anchorEndPos + 2);
    return returnObj;
};

var localizePage = function () {

    //translate a page into the users language
    $('[i18n]:not(.i18n-replaced, [i18n_replacement_el])').each(function () {
        $(this).text(translate($(this).attr('i18n')));
    });

    $('[i18n_value]:not(.i18n-replaced)').each(function () {
        $(this).val(translate($(this).attr('i18n_value')));
    });

    $('[i18n_title]:not(.i18n-replaced)').each(function () {
        $(this).attr('title', translate($(this).attr('i18n_title')));
    });

    $('[i18n_placeholder]:not(.i18n-replaced)').each(function () {
        $(this).attr('placeholder', translate($(this).attr('i18n_placeholder')));
    });

  $("[i18n_replacement_el]:not(.i18n-replaced)").each(function() {
    // Replace a dummy <a/> inside of localized text with a real element.
    // Give the real element the same text as the dummy link.
    var messageID = $(this).attr("i18n");
    if (!messageID || typeof messageID !== "string") {
      $(this).addClass("i18n-replaced");
      return;
    }
    if (!$(this).get(0).firstChild) {
       log("returning, no first child found", $(this).attr("i18n"));
       return;
    }
    if (!$(this).get(0).lastChild) {
       log("returning, no last child found", $(this).attr("i18n"));
       return;
    }
    var replaceElId = '#' + $(this).attr("i18n_replacement_el");
    if ($(replaceElId).length === 0) {
      log("returning, no child element found", $(this).attr("i18n"), replaceElId);
      return;
    }
    var rawMessageText = chrome.i18n.getMessage(messageID) || "";
    var messageSplit = splitMessageWithReplacementText(rawMessageText, messageID);
    $(this).get(0).firstChild.nodeValue = messageSplit.anchorPrefixText;
    $(this).get(0).lastChild.nodeValue = messageSplit.anchorPostfixText;
    if ($(replaceElId).get(0).tagName === "INPUT") {
      $('#' + $(this).attr("i18n_replacement_el")).prop('value', messageSplit.anchorText);
    } else {
      $('#' + $(this).attr("i18n_replacement_el")).text(messageSplit.anchorText);
    }

    // If localizePage is run again, don't let the [i18n] code above
    // clobber our work
    $(this).addClass("i18n-replaced");
  });

  // Make a right-to-left translation for Arabic and Hebrew languages
  var language = determineUserLanguage();
  if (language === 'ar' || language === 'he') {
    $('#main_nav').removeClass('right').addClass('left');
    $('.adblock-logo').removeClass('left').addClass('right');
    $('.closelegend').css('float', 'left');
    document.documentElement.dir = 'rtl';
  }

};  // end of localizePage

// Determine what language the user's browser is set to use
var determineUserLanguage = function () {
    if ((typeof navigator.language !== 'undefined') &&
        navigator.language)
        return navigator.language.match(/^[a-z]+/i)[0];
    else
        return null;
  };

// Parse a URL. Based upon http://blog.stevenlevithan.com/archives/parseuri
// parseUri 1.2.2, (c) Steven Levithan <stevenlevithan.com>, MIT License
// Inputs: url: the URL you want to parse
// Outputs: object containing all parts of |url| as attributes
const parseUriRegEx = /^(([^:]+(?::|$))(?:(?:\w+:)?\/\/)?(?:[^:@\/]*(?::[^:@\/]*)?@)?(([^:\/?#]*)(?::(\d*))?))((?:[^?#\/]*\/)*[^?#]*)(\?[^#]*)?(\#.*)?/;
var parseUri = function (url) {
    var matches = parseUriRegEx.exec(url);

    // The key values are identical to the JS location object values for that key
    var keys = ['href', 'origin', 'protocol', 'host', 'hostname', 'port',
        'pathname', 'search', 'hash', ];
    var uri = {};
    for (var i = 0; (matches && i < keys.length); i++)
        uri[keys[i]] = matches[i] || '';
    return uri;
  };

// Parses the search part of a URL into an key: value object.
// e.g., ?hello=world&ext=adblock would become {hello:"world", ext:"adblock"}
// Inputs: search: the search query of a URL. Must have &-separated values.
parseUri.parseSearch = function (search) {

    // Fails if a key exists twice (e.g., ?a=foo&a=bar would return {a:"bar"}
    search = search.substring(search.indexOf('?') + 1).split('&');
    var params = {}, pair;
    for (var i = 0; i < search.length; i++) {
      pair = search[i].split('=');
      if (pair[0] && !pair[1])
          pair[1] = '';
      if (!params[decodeURIComponent(pair[0])] && decodeURIComponent(pair[1]) === 'undefined') {
        continue;
      } else {
        params[decodeURIComponent(pair[0])] = decodeURIComponent(pair[1]);
      }
    }

    return params;
  };

// Strip third+ level domain names from the domain and return the result.
// Inputs: domain: the domain that should be parsed
// keepDot: true if trailing dots should be preserved in the domain
// Returns: the parsed domain
parseUri.secondLevelDomainOnly = function(domain, keepDot)
{
  if (domain)
  {
    var match = domain.match(/([^\.]+\.(?:co\.)?[^\.]+)\.?$/) || [domain, domain];
    return match[keepDot ? 0 : 1].toLowerCase();
  }
  else
  {
    return domain;
  }
};

// Inputs: key:string.
// Returns value if key exists, else undefined.
var sessionstorage_get = function(key)
{
  var json = sessionStorage.getItem(key);
  if (json == null)
    return undefined;
  try
  {
    return JSON.parse(json);
  }
  catch (e)
  {
    log("Couldn't parse json for " + key);
    return undefined;
  }
};

// Inputs: key:string.
// Returns value if key exists, else undefined.
var sessionstorage_set = function(key, value)
{
  if (value === undefined)
  {
    sessionStorage.removeItem(key);
    return;
  }
  try
  {
    sessionStorage.setItem(key, JSON.stringify(value));
  }
  catch (ex)
  {
    if (ex.name == "QUOTA_EXCEEDED_ERR" && !SAFARI)
    {
      alert(translate("storage_quota_exceeded"));
      openTab("options/index.html#ui-tabs-2");
    }
  }
};

// Run a function on the background page.
// Inputs (positional):
// first, a string - the name of the function to call
// then, any arguments to pass to the function (optional)
// then, a callback:function(return_value:any) (optional)
var BGcall = function()
{
  var args = [];
  for (var i = 0; i < arguments.length; i++)
    args.push(arguments[i]);
  var fn = args.shift();
  var has_callback = (typeof args[args.length - 1] == "function");
  var callback = (has_callback ? args.pop() : function()
  {
  });
  chrome.runtime.sendMessage({
    command : "call",
    fn : fn,
    args : args
  }, callback);
};

// Inputs: key:string.
// Returns object from localStorage.
// The following two functions should only be used when
// multiple 'sets' & 'gets' may occur in immediately preceding each other
// chrome.storage.local.get & set instead
var storage_get = function(key) {
  var store = localStorage;
  var json = store.getItem(key);
  if (json == null)
    return undefined;
  try {
    return JSON.parse(json);
  } catch (e) {
    log("Couldn't parse json for " + key, e);
    return undefined;
  }
};

// Inputs: key:string, value:object.
// Returns undefined.
var storage_set = function(key, value) {
  var store = localStorage;
  try {
    store.setItem(key, JSON.stringify(value));
  } catch (ex) {
    console.log(ex)
  }
};

var chromeStorageSetHelper = function(key, value, callback)
{
    let items = {};
    items[key] = value;
    chrome.storage.local.set(items, callback);
};

Object.assign(window, {
  sessionstorage_set,
  sessionstorage_get,
  storage_get,
  storage_set,
  BGcall,
  parseUri,
  determineUserLanguage,
  chromeStorageSetHelper,
  logging,
  translate,
});

/***/ }),
/* 49 */
/***/ (function(module, exports, __webpack_require__) {

function getAvailableFiles() {
return {
jquery: {
"jquery-1.10.2.min.js.local": 93107,
"jquery-1.11.0.min.js.local": 96381,
"jquery-1.11.1.min.js.local": 95786,
"jquery-1.11.2.min.js.local": 95931,
"jquery-1.11.3.min.js.local": 95957,
"jquery-1.12.4.min.js.local": 97163,
"jquery-1.3.2.min.js.local": 57254,
"jquery-1.4.2.min.js.local": 72174,
"jquery-1.7.1.min.js.local": 93868,
"jquery-1.7.2.min.js.local": 94840,
"jquery-1.8.2.min.js.local": 93435,
"jquery-1.8.3.min.js.local": 93636,
"jquery-1.9.1.min.js.local": 92629,
"jquery-2.1.1.min.js.local": 84245,
"jquery-2.1.3.min.js.local": 84320,
"jquery-2.1.4.min.js.local": 84345,
"jquery-2.2.4.min.js.local": 85578,
"jquery-3.1.1.min.js.local": 86709,
"jquery-3.2.1.min.js.local": 86659,
},
};
}
 
// Attach methods to window
Object.assign(window, {
  getAvailableFiles
});
const {LocalCDN} = __webpack_require__(18);
LocalCDN.setUp();
 


/***/ }),
/* 50 */
/***/ (function(module, exports, __webpack_require__) {


const {LocalCDN} = __webpack_require__(18);
// OPTIONAL SETTINGS
function Settings()
{
  this._settingsKey = 'settings';
  this._defaults = {
    debug_logging : false,
    youtube_channel_whitelist : false,
    show_advanced_options : false,
    show_block_counts_help_link : true,
    show_survey : true,
    local_cdn : false,
    picreplacement : false,
  };
  var _this = this;
  this._init = new Promise(function(resolve)
  {
    chrome.storage.local.get(_this._settingsKey, function(response)
    {
      var settings = response.settings || {};
      _this._data = $.extend(_this._defaults, settings);
      if (settings.debug_logging)
      {
        logging(true);
      }
      if (settings.local_cdn)
      {
        LocalCDN.start();
      }

      resolve();
    });
  }).then(function()
  {
    log('\n===SETTINGS FINISHED LOADING===\n\n');
  });
}

Settings.prototype = {
  set : function(name, isEnabled, callback)
  {
    this._data[name] = isEnabled;
    var _this = this;

    // Don't store defaults that the user hasn't modified
    chrome.storage.local.get(this._settingsKey, function(response)
    {
      var storedData = response.settings || {};
      storedData[name] = isEnabled;
      chromeStorageSetHelper(_this._settingsKey, storedData);
      if (callback !== undefined && typeof callback === 'function')
      {
        callback();
      }
    });
  },

  get_all : function()
  {
    return this._data;
  },

  onload : function()
  {
    return this._init;
  },

};

var settings = new Settings();
settings.onload();

var getSettings = function()
{
  return settings.get_all();
};

var setSetting = function(name, isEnabled, callback)
{
  settings.set(name, isEnabled, callback);

  if (name === 'debug_logging')
  {
    logging(isEnabled);
  }
};

var disableSetting = function(name)
{
  settings.set(name, false);
};

// Attach methods to window
Object.assign(window, {
  disableSetting,
  getSettings,
  setSetting,
  settings
});

/***/ }),
/* 51 */
/***/ (function(module, exports, __webpack_require__) {

const getDecodedHostname = __webpack_require__(6).getDecodedHostname;

const Filter = __webpack_require__(0).Filter;
const WhitelistFilter = __webpack_require__(0).WhitelistFilter;

const {checkWhitelisted} = __webpack_require__(8);

const Subscription = __webpack_require__(5).Subscription;
const DownloadableSubscription = __webpack_require__(5).DownloadableSubscription;
const SpecialSubscription = __webpack_require__(5).SpecialSubscription;

const parseFilter = __webpack_require__(17).parseFilter;
const parseFilters = __webpack_require__(17).parseFilters;

const FilterStorage = __webpack_require__(4).FilterStorage;
const FilterNotifier = __webpack_require__(1).FilterNotifier;
const Prefs = __webpack_require__(2).Prefs;
const Synchronizer = __webpack_require__(15).Synchronizer;
const Utils = __webpack_require__(10).Utils;
const NotificationStorage = __webpack_require__(16).Notification;

const {RegExpFilter} = __webpack_require__(0);

const {getBlockedPerPage} = __webpack_require__(21);

const info = __webpack_require__(3);

// Object's used on the option, pop up, etc. pages...
const {STATS} = __webpack_require__(27);
const {DataCollectionV2} = __webpack_require__(52);
const {LocalCDN} = __webpack_require__(18);
const {ServerMessages} = __webpack_require__(12);
const {recordGeneralMessage, recordErrorMessage, recordAdreportMessage} = __webpack_require__(12).ServerMessages;
const {getUrlFromId, unsubscribe, getSubscriptionsMinusText, getAllSubscriptionsMinusText, getIdFromURL} = __webpack_require__(54).SubscriptionAdapter;
const {uninstallInit} = __webpack_require__(55);

Object.assign(window, {
  FilterStorage,
  FilterNotifier,
  Prefs,
  Synchronizer,
  NotificationStorage,
  Subscription,
  SpecialSubscription,
  DownloadableSubscription,
  parseFilter,
  parseFilters,
  Filter,
  WhitelistFilter,
  info,
  getBlockedPerPage,
  Utils,
  STATS,
  DataCollectionV2,
  LocalCDN,
  ServerMessages,
  recordGeneralMessage,
  recordErrorMessage,
  recordAdreportMessage,
  getUrlFromId,
  unsubscribe,
  getSubscriptionsMinusText,
  getAllSubscriptionsMinusText,
  getIdFromURL,
});

// TODO
// Temporary...
var SAFARI = false;

// CUSTOM FILTERS
// Creates a custom filter entry that whitelists a given page
// Inputs: url:string url of the page
// Returns: null if successful, otherwise an exception
var createPageWhitelistFilter = function (url)
{
  var url = url.replace(/#.*$/, ''); // Remove anchors
  var parts = url.match(/^([^\?]+)(\??)/); // Detect querystring
  var hasQuerystring = parts[2];
  var filter = '@@|' + parts[1] + (hasQuerystring ? '?' : '|') + '$document';
  return addCustomFilter(filter);
};

// UNWHITELISTING

// Look for a custom filter that would whitelist the 'url' parameter
// and if any exist, remove the first one.
// Inputs: url:string - a URL that may be whitelisted by a custom filter
// Returns: true if a filter was found and removed; false otherwise.
var tryToUnwhitelist = function (url)
{
  url = url.replace(/#.*$/, ''); // Whitelist ignores anchors
  var customFilters = getUserFilters();
  if (!customFilters || !customFilters.length === 0)
  {
    return false;
  }

  for (var i = 0; i < customFilters.length; i++)
  {
    var text = customFilters[i];
    var whitelist = text.search(/@@\*\$document,domain=\~/);

    // Blacklist site, which is whitelisted by global @@*&document,domain=~
    // filter
    if (whitelist > -1)
    {
      // Remove protocols
      url = url.replace(/((http|https):\/\/)?(www.)?/, '').split(/[/?#]/)[0];
      var oldFilter = Filter.fromText(text);
      FilterStorage.removeFilter(oldFilter);
      var newFilter = Filter.fromText(text + '|~' + url);
      FilterStorage.addFilter(newFilter);
      return true;
    } else
    {
      if (!isWhitelistFilter(text))
      {
        continue;
      }
      try
      {
        var filter = Filter.fromText(text);
      }
      catch (ex)
      {
        continue;
      }

      if (!filter.matches(url, RegExpFilter.typeMap.DOCUMENT, false))
      {
        continue;
      }
      FilterStorage.removeFilter(filter);
      return true;
    }
  }

  return false;
};

// Add a new custom filter entry.
// Inputs: filter:string line of text to add to custom filters.
// Returns: null if succesfull, otherwise an exception
var addCustomFilter = function (filterText)
{
  try
  {
    var filter = Filter.fromText(filterText);
    FilterStorage.addFilter(filter);
    if (isSelectorFilter(filterText))
    {
      countCache.addCustomFilterCount(filterText);
    }

    return null;
  }
  catch (ex)
  {
    // convert to a string so that Safari can pass
    // it back to content scripts
    return ex.toString();
  }
};

// Removes a custom filter entry.
// Inputs: host:domain of the custom filters to be reset.
var removeCustomFilter = function (host)
{
  var customFilters = getUserFilters();
  if (!customFilters || !customFilters.length === 0)
  {
    return false;
  }

  var identifier = host;

  for (var i = 0; i < customFilters.length; i++)
  {
    var entry = customFilters[i];

    // If the identifier is at the start of the entry
    // then delete it.
    if (entry.indexOf(identifier) === 0)
    {
      var filter = Filter.fromText(entry);
      FilterStorage.removeFilter(filter);
    }
  }
};

// custom filter countCache singleton.
var countCache = (function ()
{
  var cache;

  // Update custom filter count stored in localStorage
  var _updateCustomFilterCount = function ()
  {
    chromeStorageSetHelper('custom_filter_count', cache);
  };

  return {
    // Update custom filter count cache and value stored in localStorage.
    // Inputs: new_count_map:count map - count map to replace existing count
    // cache
    updateCustomFilterCountMap: function (newCountMap)
    {
      cache = newCountMap || cache;
      _updateCustomFilterCount();
    },

    // Remove custom filter count for host
    // Inputs: host:string - url of the host
    removeCustomFilterCount: function (host)
    {
      if (host && cache[host])
      {
        delete cache[host];
        _updateCustomFilterCount();
      }
    },

    // Get current custom filter count for a particular domain
    // Inputs: host:string - url of the host
    getCustomFilterCount: function (host)
    {
      return cache[host] || 0;
    },

    // Add 1 to custom filter count for the filters domain.
    // Inputs: filter:string - line of text to be added to custom filters.
    addCustomFilterCount: function (filter)
    {
      var host = filter.split('##')[0];
      cache[host] = this.getCustomFilterCount(host) + 1;
      _updateCustomFilterCount();
    },

    init: function ()
    {
      chrome.storage.local.get('custom_filter_count', function (response)
      {
        cache = response.custom_filter_count || {};
      });
    },
  };
})();

countCache.init();

// Entry point for customize.js, used to update custom filter count cache.
var updateCustomFilterCountMap = function (newCountMap)
{
  countCache.updateCustomFilterCountMap(newCountMap);
};

var removeCustomFilterForHost = function (host)
{
  if (countCache.getCustomFilterCount(host))
  {
    removeCustomFilter(host);
    countCache.removeCustomFilterCount(host);
  }
};

var confirmRemovalOfCustomFiltersOnHost = function (host, activeTab)
{
  var customFilterCount = countCache.getCustomFilterCount(host);
  var confirmationText = translate('confirm_undo_custom_filters', [customFilterCount, host]);
  if (!confirm(confirmationText))
  {
    return;
  }

  removeCustomFilterForHost(host);
  if (!SAFARI)
  {
    chrome.tabs.reload(activeTab.id);
  } else
  {
    activeTab.url = activeTab.url;
  }
};

// Reload already opened tab
// Input:
// tabId: integer - id of the tab which should be reloaded
var reloadTab = function(tabId, callback) {
  var localCallback = callback;
  var listener = function (tabId, changeInfo, tab) {
      if (changeInfo.status === 'complete' &&
          tab.status === 'complete') {
        setTimeout(function () {
            chrome.tabs.sendMessage(tabId, { command: 'reloadcomplete' });
            if (typeof localCallback === "function") {
              localCallback(tab);
            }
            chrome.tabs.onUpdated.removeListener(listener);
          }, 2000);
      }
    };

  if (typeof tabId === 'string') {
    tabId = parseInt(tabId);
  }
  chrome.tabs.onUpdated.addListener(listener);
  chrome.tabs.reload(tabId, { bypassCache: true }, function () {

  });
};

var isSelectorFilter = function (text)
{
  // This returns true for both hiding rules as hiding whitelist rules
  // This means that you'll first have to check if something is an excluded rule
  // before checking this, if the difference matters.
  return /\#\@?\#./.test(text);
};

var isWhitelistFilter = function (text)
{
  return /^\@\@/.test(text);
};

var isSelectorExcludeFilter = function (text)
{
  return /\#\@\#./.test(text);
};

// BGcall DISPATCH
(function ()
{
  chrome.runtime.onMessage.addListener(function (message, sender, sendResponse)
  {
    if (message.command != 'call')
      return; // not for us

    var fn = window[message.fn];
    if (!fn)
    {
      console.log('FN not found, message', message, sender);
    }

    if (message.args && message.args.push)
    {
      message.args.push(sender);
    }

    var result = fn.apply(window, message.args);
    sendResponse(result);
  });
})();

var getAdblockUserId = function ()
{
  return STATS.userId();
};

// passthrough functions
var addGABTabListeners = function (sender)
{
  gabQuestion.addGABTabListeners(sender);
};

var removeGABTabListeners = function (saveState)
{
  gabQuestion.removeGABTabListeners(saveState);
};

// INFO ABOUT CURRENT PAGE

// Get interesting information about the current tab.
// Inputs:
// callback: function(info).
// info object passed to callback: {
// tab: Tab object
// whitelisted: bool - whether the current tab's URL is whitelisted.
// disabled_site: bool - true if the url is e.g. about:blank or the
// Extension Gallery, where extensions don't run.
// total_blocked: int - # of ads blocked since install
// tab_blocked: int - # of ads blocked on this tab
// display_stats: bool - whether block counts are displayed on button
// display_menu_stats: bool - whether block counts are displayed on the popup
// menu
// }
// Returns: null (asynchronous)
var getCurrentTabInfo = function (callback, secondTime)
{
  chrome.tabs.query(
  {
    active: true,
    lastFocusedWindow: true,
  }, tabs =>
  {
    if (tabs.length === 0)
    {
      return; // For example: only the background devtools or a popup are opened
    }
    tab = tabs[0];

    if (tab && !tab.url)
    {
      // Issue 6877: tab URL is not set directly after you opened a window
      // using window.open()
      if (!secondTime)
        window.setTimeout(function ()
        {
          getCurrentTabInfo(callback, true);
        }, 250);

      return;
    }
    const page = new ext.Page(tab);
    var disabledSite = pageIsUnblockable(page.url.href);
    var displayStats = Prefs.show_statsinicon;

    var result =
    {
      page: page,
      tab: tab,
      disabledSite: disabledSite,
      settings: getSettings()
    };

    if (!disabledSite)
    {
      result.whitelisted = checkWhitelisted(page);
    }

    callback(result);
  });
};

// Returns true if the url cannot be blocked
var pageIsUnblockable = function (url)
{
  if (!url)
  { // Safari empty/bookmarks/top sites page
    return true;
  } else
  {
    var scheme = '';
    if (!url.protocol)
    {
      scheme = parseUri(url).protocol;
    } else
    {
      scheme = url.protocol;
    }

    return (scheme !== 'http:' && scheme !== 'https:' && scheme !== 'feed:');
  }
};

// Returns true if the page is whitelisted.
// Called from a content script
var pageIsWhitelisted = function(sender)
{
  return (checkWhitelisted(sender.page) != undefined);
}

// Get or set if AdBlock is paused
// Inputs: newValue (optional boolean): if true, AdBlock will be paused, if
// false, AdBlock will not be paused.
// Returns: undefined if newValue was specified, otherwise it returns true
// if paused, false otherwise.
var pausedKey = 'paused';
var pausedFilterText1 = '@@';  // white-list all blocking requests regardless of frame / document, but still allows element hiding
var pausedFilterText2 = '@@^$document';  // white-list all documents, which prevents element hiding
var adblockIsPaused = function (newValue)
{
  if (newValue === undefined)
  {
    return (sessionstorage_get(pausedKey) === true);
  }

  // Add a filter to white list every page.
  var result1 = parseFilter(pausedFilterText1);
  var result2 = parseFilter(pausedFilterText2);
  if (newValue === true)
  {
    FilterStorage.addFilter(result1.filter);
    FilterStorage.addFilter(result2.filter);
    chromeStorageSetHelper(pausedKey, true);
  } else
  {
    FilterStorage.removeFilter(result1.filter);
    FilterStorage.removeFilter(result2.filter);
    chrome.storage.local.remove(pausedKey);
  }

  sessionstorage_set(pausedKey, newValue);
};

// Get or set if AdBlock is domain paused for the domain of the specified tab
// Inputs:  activeTab (optional object with url and id properties): the paused tab
//          newValue (optional boolean): if true, AdBlock will be domain paused
// on the tab's domain, if false, AdBlock will not be domain paused on that domain.
// Returns: undefined if activeTab and newValue were specified; otherwise if activeTab
// is specified it returns true if domain paused, false otherwise; finally it returns
// the complete storedDomainPauses if activeTab is not specified
var domainPausedKey = 'domainPaused';
var adblockIsDomainPaused = function (activeTab, newValue)
{
  // get stored domain pauses
  var storedDomainPauses = sessionstorage_get(domainPausedKey);

  // return the complete list of stored domain pauses if activeTab is undefined
  if (activeTab === undefined)
  {
    return storedDomainPauses;
  }

  // return a boolean indicating whether the domain is paused if newValue is undefined
  var activeDomain = parseUri(activeTab.url).host;
  if (newValue === undefined)
  {
    if (storedDomainPauses)
    {
      return (storedDomainPauses.hasOwnProperty(activeDomain));
    } else
    {
      return false;
    }
  }

  // create storedDomainPauses object if needed
  if (!storedDomainPauses)
  {
    storedDomainPauses = {};
  }

  // set or delete a domain pause
  var result = parseFilter("@@" + activeDomain + "$document");
  if (newValue === true)
  {
    // add a domain pause
    FilterStorage.addFilter(result.filter);
    storedDomainPauses[activeDomain] = activeTab.id;
    chrome.tabs.onUpdated.addListener(domainPauseNavigationHandler);
    chrome.tabs.onRemoved.addListener(domainPauseClosedTabHandler);
  } else
  {
    // remove the domain pause
    FilterStorage.removeFilter(result.filter);
    delete storedDomainPauses[activeDomain];
  }

  // save the updated list of domain pauses
  saveDomainPauses(storedDomainPauses);
};

// Handle the effects of a tab update event on any existing domain pauses
// Inputs:  tabId (required integer): identifier for the affected tab
//          changeInfo (required object with a url property): contains the
// new url for the tab
//          tab (optional Tab object): the affected tab
// Returns: undefined
var domainPauseNavigationHandler = function(tabId, changeInfo, tab)
{
  if (changeInfo === undefined || changeInfo.url === undefined || tabId === undefined)
  {
    return;
  }

  var newDomain = parseUri(changeInfo.url).host;

  domainPauseChangeHelper(tabId, newDomain);
};

// Handle the effects of a tab remove event on any existing domain pauses
// Inputs:  tabId (required integer): identifier for the affected tab
//          changeInfo (optional object): info about the remove event
// Returns: undefined
var domainPauseClosedTabHandler = function(tabId, removeInfo)
{
  if (tabId === undefined)
  {
    return;
  }

  domainPauseChangeHelper(tabId);
};

// Helper that removes any domain pause filter rules based on tab events
// Inputs:  tabId (required integer): identifier for the affected tab
//          newDomain (optional string): the current domain of the tab
// Returns: undefined
var domainPauseChangeHelper = function(tabId, newDomain)
{
  // get stored domain pauses
  var storedDomainPauses = sessionstorage_get(domainPausedKey);

  // check if any of the stored domain pauses match the affected tab
  for (var aDomain in storedDomainPauses)
  {
    if (storedDomainPauses[aDomain] === tabId && aDomain != newDomain)
    {
      // Remove the filter that white-listed the domain
      var result = parseFilter("@@" + aDomain + "$document");
      FilterStorage.removeFilter(result.filter);
      delete storedDomainPauses[aDomain];

      // save updated domain pauses
      saveDomainPauses(storedDomainPauses);
    }
  }
  updateButtonUIAndContextMenus();
};

// Helper that saves the domain pauses
// Inputs:  domainPauses (required object): domain pauses to save
// Returns: undefined
var saveDomainPauses = function(domainPauses)
{
  chromeStorageSetHelper(domainPausedKey, domainPauses);
  sessionstorage_set(domainPausedKey, domainPauses);
}

// If AdBlock was paused on shutdown (adblock_is_paused is true), then
// unpause / remove the white-list all entry at startup.
chrome.storage.local.get(pausedKey, function (response)
{
  if (response[pausedKey])
  {
    var pauseHandler = function (action)
    {
      if (action == 'load')
      {
        FilterNotifier.removeListener(pauseHandler);
        var result1 = parseFilter(pausedFilterText1);
        var result2 = parseFilter(pausedFilterText2);
        FilterStorage.removeFilter(result1.filter);
        FilterStorage.removeFilter(result2.filter);
        chrome.storage.local.remove(pausedKey);
      }
    };

    FilterNotifier.addListener(pauseHandler);
  }
});

// If AdBlock was domain paused on shutdown, then unpause / remove
// all domain pause white-list entries at startup.
chrome.storage.local.get(domainPausedKey, function (response)
{
  try
  {
    var storedDomainPauses = response[domainPausedKey];
    if (!jQuery.isEmptyObject(storedDomainPauses))
    {
      var domainPauseHandler = function (action)
      {
        if (action == 'load')
        {
          FilterNotifier.removeListener(domainPauseHandler);
          for (var aDomain in storedDomainPauses)
          {
            var result = parseFilter("@@" + aDomain + "$document");
            FilterStorage.removeFilter(result.filter);
          }
          chrome.storage.local.remove(domainPausedKey);
        }
      };

      FilterNotifier.addListener(domainPauseHandler);
    }
  } catch (err)
  {
    // do nothing
  }
});

// Return the contents of a local file.
// Inputs: file:string - the file relative address, eg "js/foo.js".
// Returns: the content of the file.
var readfile = function (file)
{
  // A bug in jquery prevents local files from being read, so use XHR.
  var xhr = new XMLHttpRequest();
  xhr.open('GET', chrome.extension.getURL(file), false);
  xhr.send();
  return xhr.responseText;
};

// BETA CODE
if (!SAFARI && chrome.runtime.id === 'pljaalgmajnlogcgiohkhdmgpomjcihk')
{
  // Display beta page after each update for beta-users only
  chrome.runtime.onInstalled.addListener(function (details)
  {
    if (details.reason === 'update' || details.reason === 'install')
    {
      chrome.tabs.create({ url: 'https://getadblock.com/beta' });
    }
  });
}

var updateStorageKey = 'last_known_version';
chrome.runtime.onInstalled.addListener(function (details)
{
 if (details.reason === 'update' || details.reason === 'install')
 {
   localStorage.setItem(updateStorageKey, chrome.runtime.getManifest().version);
 }
});

var openTab = function (url)
{
  chrome.tabs.create({ url })
};

// Creates a custom filter entry that whitelists a YouTube channel
// Inputs: url:string url of the page
// Returns: null if successful, otherwise an exception
var createWhitelistFilterForYoutubeChannel = function (url)
{
  if (/ab_channel=/.test(url))
  {
    var ytChannel = url.match(/ab_channel=([^]*)/)[1];
  } else
  {
    var ytChannel = url.split('/').pop();
  }

  if (ytChannel)
  {
    var filter = '@@|https://www.youtube.com/*' + ytChannel + '|$document';
    return addCustomFilter(filter);
  }
};

// YouTube Channel Whitelist and AdBlock Bandaids
// Script injection logic for Safari is done in safari_bg.js
if (!SAFARI)
{
  var runChannelWhitelist = function (tabUrl, tabId)
  {
    if (parseUri(tabUrl).hostname === 'www.youtube.com' && getSettings().youtube_channel_whitelist && !parseUri.parseSearch(tabUrl).ab_channel)
    {
      chrome.tabs.executeScript(tabId,
      {
        file: 'adblock-ytchannel.js',
        runAt: 'document_start',
      });
    }
  };

  chrome.tabs.onCreated.addListener(function (tab)
  {
    if (chrome.runtime.lastError)
    {
      return;
    }
    chrome.tabs.get(tab.id, function (tabs)
    {
      if (chrome.runtime.lastError)
      {
        return;
      }
      if (tabs && tabs.url && tabs.id)
      {
        runChannelWhitelist(tabs.url, tabs.id);
      }
    });
  });

  chrome.tabs.onUpdated.addListener(function (tabId, changeInfo, tab)
  {
    if (chrome.runtime.lastError)
    {
      return;
    }
    if (changeInfo.status === 'loading')
    {
      if (chrome.runtime.lastError)
      {
        return;
      }
      chrome.tabs.get(tabId, function (tabs)
      {
        if (tabs && tabs.url && tabs.id)
        {
          runChannelWhitelist(tabs.url, tabs.id);
        }
      });
    }
  });

  // On single page sites, such as YouTube, that update the URL using the History API pushState(),
  // they don't actually load a new page, we need to get notified when this happens
  // and update the URLs in the Page and Frame objects
  var youTubeHistoryStateUpdateHanlder = function(details) {
    if (details &&
        details.hasOwnProperty("frameId") &&
        details.hasOwnProperty("tabId") &&
        details.hasOwnProperty("url") &&
        details.hasOwnProperty("transitionType") &&
        details.transitionType === "link")
    {
      var myURL = new URL(details.url);
      if (myURL.hostname === "www.youtube.com")
      {
        var myFrame = ext.getFrame(details.tabId, details.frameId);
        var myPage = ext.getPage(details.tabId);
        var previousWhitelistState = checkWhitelisted(myPage);
        myPage.url = myURL;
        myPage._url = myURL;
        myFrame.url = myURL;
        myFrame._url = myURL;
        var currentWhitelistState = checkWhitelisted(myPage);
        if (!currentWhitelistState && (currentWhitelistState !== previousWhitelistState)) {
          myPage.sendMessage({type: "reloadStyleSheet"});
        }
      }
    }
  };

  var addYouTubeHistoryStateUpdateHanlder = function() {
    chrome.webNavigation.onHistoryStateUpdated.addListener(youTubeHistoryStateUpdateHanlder);
  };

  var removeYouTubeHistoryStateUpdateHanlder = function() {
    chrome.webNavigation.onHistoryStateUpdated.removeListener(youTubeHistoryStateUpdateHanlder);
  };

  settings.onload().then(function()
  {
    if (getSettings().youtube_channel_whitelist)
    {
      addYouTubeHistoryStateUpdateHanlder();
    }
  });
}

// used by the Options pages, since they don't have access to setContentBlocker
function isSafariContentBlockingAvailable()
{
  return (SAFARI && safari && safari.extension && (typeof safari.extension.setContentBlocker === 'function'));
}

// These functions are usually only called by content scripts.

// DEBUG INFO

// Get debug info as a JSON object for bug reporting and ad reporting
var getDebugInfo = function (callback)
{
  response = {};
  response.other_info = {};

  // Is this installed build of AdBlock the official one?
  if (!SAFARI)
  {
    if (chrome.runtime.id === 'pljaalgmajnlogcgiohkhdmgpomjcihk')
    {
      response.other_info.buildtype = ' Beta';
    } else if (chrome.runtime.id === 'gighmmpiobklfepjocnamgkkbiglidom' || chrome.runtime.id === 'aobdicepooefnbaeokijohmhjlleamfj')
    {
      response.other_info.buildtype = ' Stable';
    } else
    {
      response.other_info.buildtype = ' Unofficial';
    }
  } else
  {
    if (safari.extension.baseURI.indexOf('com.betafish.adblockforsafari-UAMUU4S2D9') > -1)
    {
      response.other_info.buildtype = ' Stable';
    } else
    {
      response.other_info.buildtype = ' Unofficial';
    }
  }

  // Get AdBlock version
  response.other_info.version = chrome.runtime.getManifest().version;

  // Get subscribed filter lists
  var subscriptionInfo = {};
  var subscriptions = getSubscriptionsMinusText();
  for (var id in subscriptions)
  {
    if (subscriptions[id].subscribed)
    {
      subscriptionInfo[id] = {};
      subscriptionInfo[id].lastSuccess = new Date(subscriptions[id].lastSuccess * 1000);
      subscriptionInfo[id].lastDownload = new Date(subscriptions[id].lastDownload * 1000);
      subscriptionInfo[id].downloadCount = subscriptions[id].downloadCount;
      subscriptionInfo[id].downloadStatus = subscriptions[id].downloadStatus;
    }
  }

  response.subscriptions = subscriptionInfo;

  var userFilters = getUserFilters();
  if (userFilters && userFilters.length)
  {
    response.custom_filters = userFilters.join("\n");
  }

  // Get settings
  var adblockSettings = {};
  var settings = getSettings();
  for (setting in settings)
  {
    adblockSettings[setting] = JSON.stringify(settings[setting]);
  }

  response.settings = adblockSettings;
  response.prefs = JSON.stringify(Prefs);
  response.other_info.browser = STATS.browser;
  response.other_info.browserVersion = STATS.browserVersion;
  response.other_info.osVersion = STATS.osVersion;
  response.other_info.os = STATS.os;
  if (window['blockCounts'])
  {
    response.other_info.blockCounts = blockCounts.get();
  }
  if (localStorage &&
      localStorage.length) {
    response.other_info.localStorageInfo = {};
    response.other_info.localStorageInfo['length'] = localStorage.length;
    var inx = 1;
    for (var key in localStorage) {
      response.other_info.localStorageInfo['key'+inx]= key;
      inx++;
    }
  }
  else
  {
    response.other_info.localStorageInfo = "no data";
  }
  response.other_info.is_adblock_paused = adblockIsPaused();
  response.other_info.license_state = License.get().status;
  response.other_info.license_version = License.get().lv;

  // Get total pings
  chrome.storage.local.get('total_pings', function (storageResponse)
  {
    response.other_info.total_pings = storageResponse.total_pings || 0;

    // Now, add exclude filters (if there are any)
    var excludeFiltersKey = 'exclude_filters';
    chrome.storage.local.get(excludeFiltersKey, function (secondResponse)
    {
      if (secondResponse && secondResponse[excludeFiltersKey])
      {
        response.excluded_filters = secondResponse[excludeFiltersKey];
      }
      // Now, add JavaScript exception error (if there is one)
      var errorKey = 'errorkey';
      chrome.storage.local.get(errorKey, function (errorResponse)
      {
        if (errorResponse && errorResponse[errorKey])
        {
          response.other_info[errorKey] = errorResponse[errorKey];
        }
        // Now, add the migration messages (if there are any)
        var migrateLogMessageKey = 'migrateLogMessageKey';
        chrome.storage.local.get(migrateLogMessageKey, function (migrateLogMessageResponse)
        {
          if (migrateLogMessageResponse && migrateLogMessageResponse[migrateLogMessageKey])
          {
            messages = migrateLogMessageResponse[migrateLogMessageKey].split('\n');
            for (var i = 0; i < messages.length; i++)
            {
              var key = 'migration_message_' + i;
              response.other_info[key] = messages[i];
            }
          }
          if (License.isActiveLicense()) {
            chrome.alarms.getAll(function(alarms) {
              if (alarms && alarms.length > 0) {
                response.other_info['Alarm info'] = 'length: ' + alarms.length;
                for (var i = 0; i < alarms.length; i++)
                {
                  var alarm = alarms[i];
                  response.other_info[i + " Alarm Name"] = alarm.name;
                  response.other_info[i + " Alarm Scheduled Time"] = new Date(alarm.scheduledTime);
                }
              } else {
                response.other_info['No alarm info'];
              }
              License.getLicenseInstallationDate(function(installdate) {
                response.other_info["License Installation Date"] = installdate;
                if (typeof callback === 'function') {
                  callback(response);
                }
              });
            });
          } else { // License is not active
            if (typeof callback === 'function') {
              callback(response);
            }
          }
        });
      });
    });
  });
};

// Called when user explicitly requests filter list updates
function updateFilterLists()
{
  for (var i = 0; i < FilterStorage.subscriptions.length; i++)
  {
    var subscription = FilterStorage.subscriptions[i];
    if (subscription instanceof DownloadableSubscription)
    {
      Synchronizer.execute(subscription, true, true);
    }
  }
}

function getUserFilters()
{
  var filters = [];
  var exceptions = [];

  for (var i = 0; i < FilterStorage.subscriptions.length; i++)
  {
    var subscription = FilterStorage.subscriptions[i];
    if (!(subscription instanceof SpecialSubscription))
    {
      continue;
    }

    for (var j = 0; j < subscription.filters.length; j++)
    {
      var filter = subscription.filters[j];
      filters.push(filter.text);
    }
  }

  return filters;
}


STATS.untilLoaded(function(userID)
{
  STATS.startPinging();
  uninstallInit();
});

// Create the "blockage stats" for the uninstall logic ...
chrome.runtime.onInstalled.addListener(function (details)
{
  if (details.reason === 'install')
  {
    chrome.storage.local.get("blockage_stats", function(response) {
      var blockage_stats = response.blockage_stats;
      if (!blockage_stats)
      {
        data = {};
        data.start = Date.now();
        data.version = 1;
        chromeStorageSetHelper("blockage_stats", data);
      }
    });
  }
});


// Attach methods to window
Object.assign(window, {
  adblockIsPaused,
  createPageWhitelistFilter,
  getUserFilters,
  updateFilterLists,
  getDebugInfo,
  isSafariContentBlockingAvailable,
  createWhitelistFilterForYoutubeChannel,
  openTab,
  readfile,
  saveDomainPauses,
  adblockIsDomainPaused,
  pageIsWhitelisted,
  pageIsUnblockable,
  getCurrentTabInfo,
  getAdblockUserId,
  createPageWhitelistFilter,
  SAFARI,
  tryToUnwhitelist,
  addCustomFilter,
  removeCustomFilter,
  countCache,
  updateCustomFilterCountMap,
  removeCustomFilterForHost,
  confirmRemovalOfCustomFiltersOnHost,
  reloadTab,
  isSelectorFilter,
  isWhitelistFilter,
  isSelectorExcludeFilter,
  addYouTubeHistoryStateUpdateHanlder,
  removeYouTubeHistoryStateUpdateHanlder
});

/***/ }),
/* 52 */
/***/ (function(module, exports, __webpack_require__) {

﻿const {postFilterStatsToLogServer} = __webpack_require__(12).ServerMessages;

let DataCollectionV2 = exports.DataCollectionV2 = (function()
{

  "use strict";
  const {extractHostFromFrame} = __webpack_require__(6);
  const {RegExpFilter,
         WhitelistFilter,
         ElemHideFilter} = __webpack_require__(0);
  const {port} = __webpack_require__(7);
  const {idleHandler} = __webpack_require__(53);
  const HOUR_IN_MS = 1000 * 60 * 60;
  const TIME_LAST_PUSH_KEY = "timeLastPush";

  // Setup memory cache
  var dataCollectionCache = {};
  dataCollectionCache.filters = {};
  dataCollectionCache.domains = {};

  var handleTabUpdated = function(tabId, changeInfo, tabInfo)
  {
    if (chrome.runtime.lastError)
    {
      return;
    }
    if (!tabInfo || !tabInfo.url || !tabInfo.url.startsWith("http:"))
    {
      return;
    }
    if (getSettings().data_collection_v2 && !adblockIsPaused() && !adblockIsDomainPaused({"url": tabInfo.url, "id": tabId}) && changeInfo.status === 'complete'  )
    {
      chrome.tabs.executeScript(tabId,
      {
          file: 'adblock-datacollection-contentscript.js',
          allFrames: true,
      }, function()
      {
        if (chrome.runtime.lastError)
        {
          return;
        }
      });
    }
  };

  var addMessageListener = function()
  {
    port.on("datacollection.elementHide", (message, sender) =>
    {
      if (getSettings().data_collection_v2 && !adblockIsPaused() && !adblockIsDomainPaused({"url": sender.page.url, "id": sender.page.id}))
      {
        var selectors = message.selectors;
        var docDomain = extractHostFromFrame(sender.frame);

        for (let subscription of FilterStorage.subscriptions)
        {
          if (subscription.disabled)
            continue;

          for (let filter of subscription.filters)
          {
            // We only know the exact filter in case of element hiding emulation.
            // For regular element hiding filters, the content script only knows
            // the selector, so we have to find a filter that has an identical
            // selector and is active on the domain the match was reported from.
            let isActiveElemHideFilter = filter instanceof ElemHideFilter &&
                                         selectors.includes(filter.selector) &&
                                         filter.isActiveOnDomain(docDomain);

            if (isActiveElemHideFilter)
            {
              addFilterToCache(filter, sender.page);
            }
          }
        }
      }
    });
  };

  var webRequestListener = function(details)
  {
    if (details.url && details.type === "main_frame" && !adblockIsPaused() && !adblockIsDomainPaused({"url": details.url, "id": details.id}))
    {
      var domain = parseUri(details.url).host;
      if (!dataCollectionCache.domains[domain]) {
        dataCollectionCache.domains[domain] = {};
        dataCollectionCache.domains[domain].pages = 0;
      }
      dataCollectionCache.domains[domain].pages++;
    }
  };

  var addFilterToCache = function(filter, page)
  {
      if (filter && filter.text && (typeof filter.text === 'string') && page && page.url && page.url.hostname)
      {
        var domain = page.url.hostname;
        if (!domain)
        {
          return;
        }
        var text = filter.text;

        if (!(text in dataCollectionCache.filters))
        {
          dataCollectionCache.filters[text] = {};
          dataCollectionCache.filters[text].firstParty = {};
          dataCollectionCache.filters[text].thirdParty = {};
          dataCollectionCache.filters[text].subscriptions = [];
        }
        if (filter.thirdParty)
        {
          if (!dataCollectionCache.filters[text].thirdParty[domain])
          {
            dataCollectionCache.filters[text].thirdParty[domain] = {};
            dataCollectionCache.filters[text].thirdParty[domain].hits = 0;
          }
          dataCollectionCache.filters[text].thirdParty[domain].hits++;
        }
        else
        {
          if (!dataCollectionCache.filters[text].firstParty[domain])
          {
            dataCollectionCache.filters[text].firstParty[domain] = {};
            dataCollectionCache.filters[text].firstParty[domain].hits = 0;
          }
          dataCollectionCache.filters[text].firstParty[domain].hits++;
        }
        if (filter.subscriptions && filter.subscriptions.length > 0)
        {
          filter.subscriptions.forEach(function(sub)
          {
            if (sub.url && dataCollectionCache.filters[text].subscriptions.indexOf(sub.url) === -1)
            {
              dataCollectionCache.filters[text].subscriptions.push(sub.url);
            }
          });
        }
      }
  };

  var filterListener = function(item, newValue, oldValue, tabIds)
  {
    if (getSettings().data_collection_v2 && !adblockIsPaused())
    {
      for (let tabId of tabIds)
      {
        let page = new ext.Page({id: tabId});
        if (page && !adblockIsDomainPaused({"url": page.url.href, "id": page.id})) {
          addFilterToCache(item, page);
        }
      }
    }
    else if (!getSettings().data_collection_v2)
    {
      FilterNotifier.removeListener(filterListener);
    }
  };

  // If enabled at startup periodic saving of memory cache &
  // sending of data to the log server
  settings.onload().then(function()
  {
    if (getSettings().data_collection_v2)
    {
      window.setInterval(function()
      {
        idleHandler.scheduleItemOnce(function()
        {
          if (getSettings().data_collection_v2 && Object.keys(dataCollectionCache.filters).length > 0)
          {
            var subscribedSubs = [];
            var subs = getAllSubscriptionsMinusText();
            for (var id in subs) {
              if (subs[id].subscribed) {
                subscribedSubs.push(subs[id].url);
              }
            }
            if (getUserFilters().length) {
              subscribedSubs.push("customlist");
            }
            var data = {
              version:                 "4",
              addonName:               __webpack_require__(3).addonName,
              addonVersion:            __webpack_require__(3).addonVersion,
              application:             __webpack_require__(3).application,
              applicationVersion:      __webpack_require__(3).applicationVersion,
              platform:                __webpack_require__(3).platform,
              platformVersion:         __webpack_require__(3).platformVersion,
              appLocale:               Utils.appLocale,
              filterListSubscriptions: subscribedSubs,
              domains:                 dataCollectionCache.domains,
              filters:                 dataCollectionCache.filters
            };
            chrome.storage.local.get(TIME_LAST_PUSH_KEY, function(response) {
              var timeLastPush = "n/a";
              if (response[TIME_LAST_PUSH_KEY]) {
                var serverTimestamp = new Date(response[TIME_LAST_PUSH_KEY]);
                // Format the timeLastPush
                var yearStr = serverTimestamp.getUTCFullYear() + "";
                var monthStr = (serverTimestamp.getUTCMonth() + 1) + "";
                var dateStr = serverTimestamp.getUTCDate() + "";
                var hourStr = serverTimestamp.getUTCHours() + "";
                // round the minutes up to the nearest 10
                var minStr = (Math.floor(serverTimestamp.getUTCMinutes() / 10) * 10) + "";

                if (monthStr.length === 1) {
                   monthStr = "0" + monthStr;
                }
                if (dateStr.length === 1) {
                   dateStr = "0" + dateStr;
                }
                if (hourStr.length === 1) {
                   hourStr = "0" + hourStr;
                }
                if (minStr.length === 1) {
                   minStr = "0" + minStr;
                }
                if (minStr === "60") {
                   minStr = "00";
                }
                timeLastPush = yearStr + "-" + monthStr + "-" + dateStr + " " + hourStr + ":" + minStr + ":00";
              }
              data.timeOfLastPush = timeLastPush;
              postFilterStatsToLogServer( data, function(text, status, xhr) {
                var nowTimestamp = (new Date()).toGMTString();
                if (xhr && typeof xhr.getResponseHeader === "function") {
                  try {
                    if (xhr.getResponseHeader("Date")) {
                      nowTimestamp = xhr.getResponseHeader("Date");
                    }
                  } catch(e) {
                    nowTimestamp = (new Date()).toGMTString();
                  }
                }
                chromeStorageSetHelper(TIME_LAST_PUSH_KEY, nowTimestamp);
                // Reset memory cache
                dataCollectionCache = {};
                dataCollectionCache.filters = {};
                dataCollectionCache.domains = {};
              });
            });  // end of TIME_LAST_PUSH_KEY
          }
        });
      }, HOUR_IN_MS);
      FilterNotifier.on("filter.hitCount", filterListener);
      chrome.webRequest.onBeforeRequest.addListener(webRequestListener, { urls:  ["http://*/*", "https://*/*"],types: ["main_frame"] });
      chrome.tabs.onUpdated.addListener(handleTabUpdated);
      addMessageListener();
    }
  });// End of then

  var returnObj = {};
  returnObj.start = function()
  {
    dataCollectionCache.filters = {};
    dataCollectionCache.domains = {};
    FilterNotifier.on("filter.hitCount", filterListener);
    chrome.webRequest.onBeforeRequest.addListener(webRequestListener, { urls:  ["http://*/*", "https://*/*"],types: ["main_frame"] });
    chrome.tabs.onUpdated.addListener(handleTabUpdated);
    addMessageListener();
  };
  returnObj.end = function()
  {
    dataCollectionCache = {};
    FilterNotifier.off("filter.hitCount", filterListener);
    chrome.webRequest.onBeforeRequest.removeListener(webRequestListener);
    chrome.storage.local.remove(TIME_LAST_PUSH_KEY);
    chrome.tabs.onUpdated.removeListener(handleTabUpdated);
  };
  returnObj.getCache = function()
  {
    return dataCollectionCache;
  };

  return returnObj;
})();


/***/ }),
/* 53 */
/***/ (function(module, exports) {

// Schedules a function to be executed once when the computer is idle.
// Call idleHandler.scheduleItem to schedule a function for exection upon idle
// inputs: theFunction: function to be executed
//         seconds: maximum time to wait upon idle, in seconds. 600 if omitted.
let idleHandler = exports.idleHandler = {
  scheduleItemOnce : function(callback, seconds)
  {
    // In Safari, execute the function with only the minimum idle delay.
    // It doesn't support idle, but at least we make sure that functions
    // don't execute when we're too busy to handle them.
    if (SAFARI)
    {
      window.setTimeout(callback, 15000);
      return;
    }
    // In Chrome, schedule the item to be executed
    idleHandler._scheduledItems.push({
      callback : callback,
      runAt : new Date(Date.now() + 1000 * (seconds || 600))
    });
    if (!idleHandler._timer)
    {
      idleHandler._timer = window.setInterval(idleHandler._runIfIdle, 5000);
    }
  },
  _timer : null,
  _scheduledItems : [],
  _runIfIdle : function()
  {
    // Checks if the browser is idle. If so, it executes all waiting functions
    // Otherwise, it checks if an item has waited longer than allowed, and
    // executes the ones who should be executed
    chrome.idle.queryState(15, function(state)
    {
      if (state == "idle")
      {
        while (idleHandler._scheduledItems.length)
        {
          idleHandler._scheduledItems.shift().callback();
        }
      }
      else
      {
        var now = Date.now();
        // Inversed loop, to prevent splice() making it skip the item after an
        // executed item.
        for (var i = idleHandler._scheduledItems.length - 1; i >= 0; i--)
        {
          if (idleHandler._scheduledItems[i].runAt <= now)
          {
            idleHandler._scheduledItems.splice(i, 1)[0].callback();
          }
        }
      }
      if (!idleHandler._scheduledItems.length)
      {
        idleHandler._timer = window.clearInterval(idleHandler._timer);
      }
    })
  }
};

/***/ }),
/* 54 */
/***/ (function(module, exports, __webpack_require__) {

﻿const FilterStorage = __webpack_require__(4).FilterStorage;
with (__webpack_require__(5))
{
  this.Subscription = Subscription;
  this.SpecialSubscription = SpecialSubscription;
  this.DownloadableSubscription = DownloadableSubscription;
}
// Adapters & helpers to add the legacy AB 'id' to the ABP subscriptions
// Also adds the 'language' and 'hidden' properties
let SubscriptionAdapter = exports.SubscriptionAdapter = (function()
{
  // Get the URL for the corresponding ID
  var getUrlFromId = function(id)
  {
    var url = '';

    for (var u in abpSubscriptionIdMap)
    {
      if (abpSubscriptionIdMap[u].id === id)
      {
        url = u;
        break;
      }
    }

    if (url === '')
    {
      for (var u in abSubscriptionIdMap)
      {
        if (abSubscriptionIdMap[u].id === id)
        {
          url = u;
          break;
        }
      }
    }

    return url;
  };

  // Unsubcribe the user from the subscription specified in the arguement
  var unsubscribe = function(options)
  {
    var subscriptionUrl = getUrlFromId(options.id);
    if (subscriptionUrl !== '')
    {
      var subscription = Subscription.fromURL(subscriptionUrl);
      if (subscription)
      {
        FilterStorage.removeSubscription(subscription);
      }
    }
  }

  // Get only the user's subscriptions with in the AB format
  // without the filter contents (text)
  var getSubscriptionsMinusText = function()
  {
    var result = {};
    for (var sub in FilterStorage.subscriptions)
    {
      var subscription = FilterStorage.subscriptions[sub];
      if (subscription instanceof DownloadableSubscription)
      {
        var tempSub = {};
        for ( var attr in subscription)
        {
          if ((attr === "text") || (attr === "filters"))
          {
            continue;
          }
          tempSub[attr] = subscription[attr];
          // if the subscription has a 'URL' property, use it to add an 'id'
          // property
          if (attr === "url")
          {
            if (tempSub[attr] in abpSubscriptionIdMap)
            {
              tempSub["id"] = abpSubscriptionIdMap[tempSub[attr]].id;
            }
            else if (tempSub[attr] in abSubscriptionIdMap)
            {
              tempSub["id"] = abSubscriptionIdMap[tempSub[attr]].id;
            }
          }
        }
        // if the subscription doesn't have a 'id' property, use the 'URL' as an
        // 'id' property
        if (!tempSub["id"] || tempSub["id"] === undefined)
        {
          tempSub["id"] = "url:" + subscription.url;
        }
        // Since FilterStorage.subscriptions only contains subscribed FilterLists,
        // add the 'subscribed' property
        tempSub['subscribed'] = true;
        // Add the language and hidden properties
        if (tempSub.url in abpSubscriptionIdMap)
        {
          tempSub.language = abpSubscriptionIdMap[tempSub.url].language;
          tempSub.hidden = abpSubscriptionIdMap[tempSub.url].hidden;
        }
        else if (tempSub.url in abSubscriptionIdMap)
        {
          tempSub.language = abSubscriptionIdMap[tempSub.url].language;
          tempSub.hidden = abSubscriptionIdMap[tempSub.url].hidden;
        }
        result[tempSub["id"]] = tempSub;
      }
    }
    return result;
  }

  // Get all subscriptions in the AB format
  // without the filter contents (text)
  var getAllSubscriptionsMinusText = function()
  {
    var userSubs = getSubscriptionsMinusText();
    for (var url in abSubscriptionIdMap)
    {
      var id = abSubscriptionIdMap[url].id;
      if (!(id in userSubs))
      {
        userSubs[id] = {};
        userSubs[id]['subscribed'] = false;
        userSubs[id]['id'] = id;
        userSubs[id]['url'] = url;
        userSubs[id]['user_submitted'] = false;
        userSubs[id]['language'] = abSubscriptionIdMap[url]['language'];
        userSubs[id]['hidden'] = abSubscriptionIdMap[url]['hidden'];
      }
    }
    for (var url in abpSubscriptionIdMap)
    {
      var id = abpSubscriptionIdMap[url].id;
      if (!(id in userSubs))
      {
        userSubs[id] = {};
        userSubs[id]['subscribed'] = false;
        userSubs[id]['id'] = id;
        userSubs[id]['url'] = url;
        userSubs[id]['user_submitted'] = false;
        userSubs[id]['language'] = abpSubscriptionIdMap[url]['language'];
        userSubs[id]['hidden'] = abpSubscriptionIdMap[url]['hidden'];
      }
    }
    return userSubs;
  };

  var getIdFromURL = function(url)
  {
    if (abpSubscriptionIdMap[url] && abpSubscriptionIdMap[url].id)
    {
      return abpSubscriptionIdMap[url].id;
    }
    else if (abSubscriptionIdMap[url] && abSubscriptionIdMap[url].id)
    {
      return abSubscriptionIdMap[url].id;
    }
    return null;
  };

  // A collection of unique ABP specific FilterList
  // Only includes Filter Lists that are not in the AB collection
  // Properties:  id       -unique identifier for the filter list
  //              language -bool that indicates whether or not the filter list
  //                        is language-specific (and should be included in the
  //                        language drop-down)
  //              hidden   -bool that indicates whether or not the filter list
  //                        should be hidden from the default options on the
  //                        Filter List tab (currently only used to hide language
  //                        filter lists from the language drop-down)
  var abpSubscriptionIdMap =
  {
    "https://easylist-downloads.adblockplus.org/abpindo+easylist.txt" :
    {
      id : "easylist_plus_indonesian", // Additional Indonesian filters
      language : true,
      hidden : false,
    },

    "https://easylist-downloads.adblockplus.org/bulgarian_list+easylist.txt" :
    {
      id : "easylist_plus_bulgarian", // Additional Bulgarian filters
      language : true,
      hidden : false,
    },

    "https://easylist-downloads.adblockplus.org/easylistchina+easylist.txt" :
    {
      id : "chinese", // Additional Chinese filters
      language : true,
      hidden : false,
    },

    "https://easylist-downloads.adblockplus.org/easylistczechslovak+easylist.txt" :
    {
      id : "czech", // Additional Czech and Slovak filters
      language : true,
      hidden : false,
    },

    "https://easylist-downloads.adblockplus.org/easylistdutch+easylist.txt" :
    {
      id : "dutch", // Additional Dutch filters
      language : true,
      hidden : false,
    },

    "https://easylist-downloads.adblockplus.org/easylistgermany+easylist.txt" :
    {
      id : "easylist_plus_german", // Additional German filters
      language : true,
      hidden : false,
    },

    "https://easylist-downloads.adblockplus.org/easylistitaly+easylist.txt" :
    {
      id : "italian", // Italian filters
      language : true,
      hidden : false,
    },

    "https://easylist-downloads.adblockplus.org/easylistlithuania+easylist.txt" :
    {
      id : "easylist_plus_lithuania", // Lithuania filters
      language : true,
      hidden : false,
    },

    "https://easylist-downloads.adblockplus.org/latvianlist+easylist.txt" :
    {
      id : "latvian", // Latvian filters
      language : true,
      hidden : false,
    },

    "https://easylist-downloads.adblockplus.org/liste_ar+liste_fr+easylist.txt" :
    {
      id : "easylist_plus_arabic_plus_french", // Additional Arabic & French
                                                // filters
      language : true,
      hidden : false,
    },

    "https://easylist-downloads.adblockplus.org/liste_fr+easylist.txt" :
    {
      id : "easylist_plus_french", // Additional French filters
      language : true,
      hidden : false,
    },

    "https://easylist-downloads.adblockplus.org/rolist+easylist.txt" :
    {
      id : "easylist_plus_romanian", // Additional Romanian filters
      language : true,
      hidden : false,
    },

    "https://easylist-downloads.adblockplus.org/ruadlist+easylist.txt" :
    {
      id : "russian", // Additional Russian filters
      language : true,
      hidden : false,
    },

    "https://easylist-downloads.adblockplus.org/easyprivacy+easylist.txt" :
    {
      id : "easyprivacy", // EasyPrivacy
      language : false,
      hidden : false,
    },

    "http://adblock.dk/block.csv" :
    {
      id : "danish", // danish
      language : true,
      hidden : false,
    },

    "https://easylist-downloads.adblockplus.org/easylistspanish.txt" :
    {
      id : "easylist_plus_spanish", // Spanish
      language : true,
      hidden : false,
    },

    "https://raw.githubusercontent.com/MajkiIT/polish-ads-filter/master/polish-adblock-filters/adblock.txt" :
    {
      id : "easylist_plus_polish", // Polish
      language : true,
      hidden : false,
    },
  };

  // Properties:  id       -unique identifier for the filter list
  //              language -bool that indicates whether or not the filter list
  //                        is language-specific (and should be included in the
  //                        language drop-down)
  //              hidden   -bool that indicates whether or not the filter list
  //                        should be hidden from the default options on the
  //                        Filter List tab (currently only used to hide
  //                        discontinued language filter lists from the language
  //                        drop-down)
  var abSubscriptionIdMap =
  {
    "https://cdn.adblockcdn.com/filters/adblock_custom.txt" :
    {
      id : "adblock_custom", // AdBlock custom filters
      language : true,
      hidden : false,
    },

    "https://easylist-downloads.adblockplus.org/easylist.txt" :
    {
      id : "easylist", // EasyList
      language : false,
      hidden : false,
    },

    "http://stanev.org/abp/adblock_bg.txt" :
    {
      id : "easylist_plus_bulgarian_old", // Additional Bulgarian filters
      language : true, // discontinued language list
      hidden : true,
    },

    "https://easylist-downloads.adblockplus.org/easylistdutch.txt" :
    {
      id : "dutch_old", // Additional Dutch filters
      language : true, // discontinued language list
      hidden : true,
    },

    "http://adb.juvander.net/Finland_adb.txt" :
    {
      id : "easylist_plus_finnish",
      language : true,
      hidden : false,
    },

    "https://easylist-downloads.adblockplus.org/liste_fr.txt" :
    {
      id : "easylist_plus_french_old", // Additional French filters
      language : true, // discontinued language list
      hidden : true,
    },

    "https://easylist-downloads.adblockplus.org/easylistgermany.txt" :
    {
      id : "easylist_plus_german_old", // Additional German filters
      language : true, // discontinued language list
      hidden : true,
    },

    "https://www.void.gr/kargig/void-gr-filters.txt" :
    {
      id : "easylist_plus_greek", // Additional Greek filters
      language : true,
      hidden : false,
    },

    "https://raw.githubusercontent.com/heradhis/indonesianadblockrules/master/subscriptions/abpindo.txt" :
    {
      id : "easylist_plus_indonesian_old", // Additional Indonesian filters
      language : true, // discontinued language list
      hidden : true,
    },

    "https://www.certyficate.it/adblock/adblock.txt" :
    {
      id : "easylist_plus_polish_old", // Additional Polish filters
      language : true, // discontinued language list
      hidden : true,
    },

    "http://www.zoso.ro/pages/rolist.txt" :
    {
      id : "easylist_plus_romanian_old", // Additional Romanian filters
      language : true, // discontinued language list
      hidden : true,
    },
    "https://easylist-downloads.adblockplus.org/advblock.txt" :
    {
      id : "russian_old", // Additional Russian filters
      language : true, // discontinued language list
      hidden : true,
    },
    "https://easylist-downloads.adblockplus.org/easylistchina.txt" :
    {
      id : "chinese_old", // Additional Chinese filters
      language : true, // discontinued language list
      hidden : true,
    },
    "https://raw.github.com/tomasko126/easylistczechandslovak/master/filters.txt" :
    {
      id : "czech_old", // Additional Czech and Slovak filters
      language : true, // discontinued language list
      hidden : true,
    },
    "http://adblock.schack.dk/block.txt" :
    {
      id : "danish_old", // Danish filters
      language : true, // discontinued language list
      hidden : true,
    },
    "https://raw.githubusercontent.com/szpeter80/hufilter/master/hufilter.txt" :
    {
      id : "hungarian", // Hungarian filters
      language : true,
      hidden : false,
    },
    "https://easylist-downloads.adblockplus.org/israellist+easylist.txt" :
    {
      id : "israeli", // Israeli filters
      language : true,
      hidden : false,
    },
    "https://easylist-downloads.adblockplus.org/easylistitaly.txt" :
    {
      id : "italian_old", // Italian filters
      language : true, // discontinued language list
      hidden : true,
    },
    "https://raw.githubusercontent.com/k2jp/abp-japanese-filters/master/abpjf.txt" :
    {
      id : "japanese", // Japanese filters
      language : true,
      hidden : false,
    },
    "https://secure.fanboy.co.nz/fanboy-korean.txt" :
    {
      id : "easylist_plun_korean", // Korean filters
      language : true,
      hidden : false,
    },
    "https://notabug.org/latvian-list/adblock-latvian/raw/master/lists/latvian-list.txt" :
    {
      id : "latvian_old", // Latvian filters
      language : true, // discontinued language list
      hidden : true,
    },
    "http://fanboy.co.nz/fanboy-swedish.txt" :
    {
      id : "swedish", // Swedish filters
      language : true,
      hidden : false,
    },
    "http://fanboy.co.nz/fanboy-turkish.txt" :
    {
      id : "turkish", // Turkish filters
      language : true,
      hidden : false,
    },
    "https://easylist-downloads.adblockplus.org/easyprivacy.txt" :
    {
      id : "easyprivacy", // EasyPrivacy
      language : false,
      hidden : false,
    },
    "https://easylist-downloads.adblockplus.org/fanboy-social.txt" :
    {
      id : "antisocial", // Antisocial
      language : false,
      hidden : false,
    },
    "https://easylist-downloads.adblockplus.org/fanboy-annoyance.txt" :
    {
      id : "annoyances", // Fanboy's Annoyances
      language : false,
      hidden : false,
    },
    "https://easylist-downloads.adblockplus.org/antiadblockfilters.txt" :
    {
      id : "warning_removal", // AdBlock warning removal
      language : false,
      hidden : false,
    },
    "https://easylist-downloads.adblockplus.org/exceptionrules.txt" :
    {
      id : "acceptable_ads", // Acceptable Ads
      language : false,
      hidden : false,
    },
    "http://gurud.ee/ab.txt" :
    {
      id : "easylist_plus_estonian", // Estonian filters
      language : true,
      hidden : false,
    },
    "http://margevicius.lt/easylistlithuania.txt" :
    {
      id : "easylist_plus_lithuania_old", // Lithuania filters
      language : true, // discontinued language list
      hidden : true,
    },
    "https://easylist-downloads.adblockplus.org/Liste_AR.txt" :
    {
      id : "easylist_plus_arabic", // Arabic filters
      language : true,
      hidden : true,
    },
    "http://adblock.gardar.net/is.abp.txt" :
    {
      id : "icelandic", // Icelandic filters
      language : true,
      hidden : false,
    },
    "https://easylist-downloads.adblockplus.org/malwaredomains_full.txt" :
    {
      id : "malware", // Malware
      language : false,
      hidden : false,
    },
    "https://raw.githubusercontent.com/hoshsadiq/adblock-nocoin-list/master/nocoin.txt" :
    {
      id : "bitcoin_mining_protection", // Cryptocurrency (Bitcoin) Mining Protection
      language : false,
      hidden : false,
    },
  };

  return {
    getUrlFromId,
    unsubscribe,
    abpSubscriptionIdMap,
    getSubscriptionsMinusText,
    getAllSubscriptionsMinusText,
    getIdFromURL,
  };

})();


/***/ }),
/* 55 */
/***/ (function(module, exports, __webpack_require__) {

/** @module adblock-betafish/alias/uninstall */

const FilterStorage = __webpack_require__(4).FilterStorage;
const FilterNotifier = __webpack_require__(1).FilterNotifier;
const {STATS} = __webpack_require__(27);

let uninstallInit = exports.uninstallInit = function()
{
  if (chrome.runtime.setUninstallURL)
  {
    var Prefs = __webpack_require__(2).Prefs;
    STATS.untilLoaded(function(userID)
    {
      var uninstallURL = "https://getadblock.com/uninstall/?u=" + userID;
      // if the start property of blockCount exists (which is the AdBlock
      // installation timestamp)
      // use it to calculate the approximate length of time that user has
      // AdBlock installed
      if (Prefs && Prefs.blocked_total !== undefined)
      {
        var twoMinutes = 2 * 60 * 1000;
        var getABCLastUpdateTime = function()
        {
          for ( var sub in FilterStorage.subscriptions)
          {
            var subscription = FilterStorage.subscriptions[sub];
            if (subscription.url === getUrlFromId("adblock_custom"))
            {
              return subscription._lastDownload;
            }
          }
          return null;
        };
        var updateUninstallURL = function()
        {
          chrome.storage.local.get("blockage_stats", function(data)
          {
            var url = uninstallURL;
            if (data &&
                data.blockage_stats &&
                data.blockage_stats.start)
            {
              var installedDuration = (Date.now() - data.blockage_stats.start);
              url = url + "&t=" + installedDuration;
            }
            var bc = Prefs.blocked_total;
            url = url + "&bc=" + bc;
            var lastUpdateTime = getABCLastUpdateTime();
            if (lastUpdateTime !== null)
            {
              url = url + "&abc-lt=" + lastUpdateTime;
            }
            else
            {
              url = url + "&abc-lt=-1"
            }
            chrome.runtime.setUninstallURL(url);
          });
        };
        // start an interval timer that will update the Uninstall URL every 2
        // minutes
        setInterval(updateUninstallURL, twoMinutes);
        updateUninstallURL();
      }
      else
      {
        chrome.runtime.setUninstallURL(uninstallURL + "&t=-1");
      }
    }); // end of STATS.then
  }
};

/***/ }),
/* 56 */
/***/ (function(module, exports, __webpack_require__) {

const {checkWhitelisted} = __webpack_require__(8);
const FilterNotifier = __webpack_require__(1).FilterNotifier;
const Prefs = __webpack_require__(2).Prefs;

var updateButtonUIAndContextMenus = function ()
{
  chrome.tabs.query({}, tabs =>
  {
    for (let tab of tabs) {
      const page = new ext.Page(tab);
      if (adblockIsPaused() || adblockIsDomainPaused({"url": tab.url.href, "id": tab.id}))
      {
        page.browserAction.setBadge({ number: '' });
      }
      updateContextMenuItems(page);
    }
  });
};

var updateContextMenuItems = function (page)
{
  // Remove the AdBlock context menu
  page.contextMenus.remove(AdBlockContextMenuItemOne);
  page.contextMenus.remove(AdBlockContextMenuItemTwo);

  // Check if the context menu items should be added
  if (Prefs.shouldShowBlockElementMenu &&
      !checkWhitelisted(page))
  {
    page.contextMenus.create(AdBlockContextMenuItemOne);
    page.contextMenus.create(AdBlockContextMenuItemTwo);
  }
};

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) =>
{
  if (changeInfo.status == "loading") {
    updateContextMenuItems(new ext.Page(tab));
  }
});

chrome.runtime.onMessage.addListener(function (msg, sender, sendResponse)
{
  switch (msg.type)
  {
    case 'report-html-page':
      updateContextMenuItems(sender.page);
      break;
  }
});

// Update browser actions and context menus when whitelisting might have
// changed. That is now when initally loading the filters and later when
// importing backups or saving filter changes.
FilterNotifier.addListener(function (action)
{
  if (action == 'load' || action == 'save')
  {
    updateButtonUIAndContextMenus();
  }
});

Prefs.on(Prefs.shouldShowBlockElementMenu, function ()
{
  updateButtonUIAndContextMenus();
});

updateButtonUIAndContextMenus();

var AdBlockContextMenuItemOne = {
    title: chrome.i18n.getMessage('block_this_ad'),
    contexts: ['all'],
    onclick: function (page, clickdata)
    {
      emitPageBroadcast(
        { fn:'top_open_blacklist_ui', options:{ info: clickdata } },
        { tab: page }
      );
    },
  };

var AdBlockContextMenuItemTwo = {
    title: chrome.i18n.getMessage('block_an_ad_on_this_page'),
    contexts: ['all'],
    onclick: function (page, clickdata)
    {
      emitPageBroadcast(
        { fn:'top_open_blacklist_ui', options:{ nothing_clicked: true } },
        { tab: page }
      );
    },
  };

// Bounce messages back to content scripts.
if (!SAFARI)
{
  var emitPageBroadcast = (function ()
  {
    var injectMap =
    {
        top_open_whitelist_ui:
        {
          allFrames: false,
          include: [
            'adblock-jquery.js',
            'adblock-jquery-ui.js',
            'adblock-uiscripts-load_jquery_ui.js',
            'adblock-uiscripts-top_open_whitelist_ui.js',
            ],
        },
        top_open_blacklist_ui:
        {
          allFrames: false,
          include: [
            'adblock-jquery.js',
            'adblock-jquery-ui.js',
            'adblock-uiscripts-load_jquery_ui.js',
            'adblock-uiscripts-blacklisting-overlay.js',
            'adblock-uiscripts-blacklisting-clickwatcher.js',
            'adblock-uiscripts-blacklisting-elementchain.js',
            'adblock-uiscripts-blacklisting-blacklistui.js',
            'adblock-uiscripts-top_open_blacklist_ui.js',
            ],
        },
        send_content_to_back:
        {
          allFrames: true,
          include: ['adblock-uiscripts-send_content_to_back.js'],
        },
      };

    // Inject the required scripts to execute fnName(parameter) in
    // the current tab.
    // Inputs: fnName:string name of function to execute on tab.
    //         fnName must exist in injectMap above.
    //         parameter:object to pass to fnName.  Must be JSON.stringify()able.
    //         injectedSoFar?:int used to recursively inject required scripts.
    var executeOnTab = function (fnName, parameter, injectedSoFar)
    {
      injectedSoFar = injectedSoFar || 0;
      var data = injectMap[fnName];
      var details = { allFrames: data.allFrames };

      // If there's anything to inject, inject the next item and recurse.
      if (data.include.length > injectedSoFar)
      {
        details.file = data.include[injectedSoFar];
        chrome.tabs.executeScript(undefined, details, function ()
          {
          if (chrome.runtime.lastError)
            {
            log(chrome.runtime.lastError);
            return;
          }

          executeOnTab(fnName, parameter, injectedSoFar + 1);
        });
      }

      // Nothing left to inject, so execute the function.
      else
      {
        var param = JSON.stringify(parameter);
        details.code = fnName + '(' + param + ');';
        chrome.tabs.executeScript(undefined, details);
      }
    };

    // The emitPageBroadcast() function
    var theFunction = function (request)
    {
      executeOnTab(request.fn, request.options);
    };

    return theFunction;
  })();
}
Object.assign(window, {
  emitPageBroadcast,
  updateButtonUIAndContextMenus
});

/***/ }),
/* 57 */
/***/ (function(module, exports, __webpack_require__) {

﻿// Module for removing individual filters from filter lists
// An 'advance' feature, used on the Customize tab, titled "disabled filters"
ExcludeFilter = (function ()
{
  var FilterNotifier = __webpack_require__(1).FilterNotifier;
  var ABRemoveFilter = function (filter)
  {
    var subscriptions = filter.subscriptions.slice();
    for (var i = 0; i < subscriptions.length; i++)
    {
      var subscription = subscriptions[i];
      var positions = [];
      var index = -1;
      do
      {
        index = subscription.filters.indexOf(filter, index + 1);
        if (index >= 0)
        {
          positions.push(index);
        }
      }
      while (index >= 0);

      for (var j = positions.length - 1; j >= 0; j--)
      {
        var position = positions[j];
        if (subscription.filters[position] === filter)
        {
          subscription.filters.splice(position, 1);
          if (subscription.filters.indexOf(filter) < 0)
          {
            var index = filter.subscriptions.indexOf(subscription);
            if (index >= 0)
            {
              filter.subscriptions.splice(index, 1);
            }
          }

          FilterNotifier.triggerListeners('filter.removed', filter, subscription, position);
        }
      }
    }
  };

  // Removes the valid filters from any / all filter lists and
  // saves the valid entries
  // Note:  any invalid filters are ignored
  // Inputs: filters:string the new filters.
  var setExcludeFilters = function (excludeFilters) {
    excludeFilters = excludeFilters.trim();
    var excludeFiltersArray = excludeFilters.split('\n');
    var validExcludeFiltersArray = [];
    for (var i = 0; i < excludeFiltersArray.length; i++)
    {
      var filter = excludeFiltersArray[i];
      filter     = filter.trim();
      if (filter.length > 0)
      {
        var result = parseFilter(filter);
        if (result.filter) {
          validExcludeFiltersArray.push(result.filter);
          ABRemoveFilter(result.filter);
        }
      }
    }

    if (validExcludeFiltersArray.length > 0)
    {
      chromeStorageSetHelper('exclude_filters', validExcludeFiltersArray.join('\n'));
    } else
    {
      chrome.storage.local.remove('exclude_filters');
    }
  };

  function excludeFilterChangeListener(action, item, param1, param2)
  {
    if (action !== 'save')
    {
      return;
    }

    var excludeFiltersKey = 'exclude_filters';
    chrome.storage.local.get(excludeFiltersKey, function (response)
    {
      if (response[excludeFiltersKey])
      {
        var excludeFiltersArray = response[excludeFiltersKey].split('\n');
        for (var i = 0; i < excludeFiltersArray.length; i++)
        {
          var filter = excludeFiltersArray[i];
          if (filter.length > 0)
          {
            var result = parseFilter(filter);
            if (result.filter)
            {
              ABRemoveFilter(result.filter);
            }
          }
        }
      } else
      {
        FilterNotifier.removeListener(excludeFilterChangeListener);
      }
    });
  }

  // At startup, add a listener to so that the exclude filters
  // can be removed if the filter lists are updated
  FilterNotifier.addListener(excludeFilterChangeListener);

  return {
    setExcludeFilters: setExcludeFilters,
  };
})();


/***/ }),
/* 58 */
/***/ (function(module, exports, __webpack_require__) {


const Subscription = __webpack_require__(5).Subscription;

const {imageSizesMap, WIDE, TALL, SKINNYWIDE, SKINNYTALL, BIG, SMALL} = __webpack_require__(28);

var subscription1 = Subscription.fromURL(getUrlFromId("antisocial"));
var subscription2 = Subscription.fromURL(getUrlFromId("annoyances"));
// Inputs: width:int, height:int, url:url, title:string, attribution_url:url
function Listing(data) {
  this.width = data.width;
  this.height = data.height;
  this.url = data.url;
  this.title = data.title;
  this.attribution_url = data.attribution_url;
  if (data.name) {
    this.name = data.name;
  }
  if (data.thumbURL) {
    this.thumbURL = data.thumbURL;
  }
  if (data.userLink) {
    this.userLink = data.userLink
  }
  if (data.anySize) {
    this.anySize = data.anySize;
  }
  if (data.type) {
    this.type = data.type;
  }
  if (data.ratio) {
    this.ratio = data.ratio;
  }
};

// Contains and provides access to all the photo channels.
function Channels() {
  var that = this;
  this._channelGuide = undefined; // maps channel ids to channels and metadata
  this._loadFromStorage();
}
Channels.prototype = {
  // Inputs:
  //   name:string - a Channel class name.
  //   param:object - the single ctor parameter to the Channel class.
  //   enabled:bool - true if this channel is to be used for pictures.
  // Returns:
  //   id of newly created channel, or undefined if the channel already existed.
  add: function(data) {
    var klass = window[data.name];
    if (!klass) {
      return;
    }
    var dataParam = JSON.stringify(data.param);
    for (var id in this._channelGuide) {
      var c = this._channelGuide[id];
      if (c.name === data.name && JSON.stringify(c.param) === dataParam)
        return;
    }
    var id = Math.floor(Math.random() * Date.now());
    var channel = new klass(data.param);
    this._channelGuide[id] = {
      name: data.name,
      param: data.param,
      enabled: data.enabled,
      channel: channel
    };
    this._saveToStorage();
    var that = this;
    $(channel).bind("updated", function(event) {
      chrome.extension.sendRequest({command: "channel-updated", id: id});
      if (that._channelGuide[id].enabled)
        that._channelGuide[id].channel.prefetch();
    });
    channel.refresh();
    return id;
  },

  remove: function(channelId) {
    delete this._channelGuide[channelId];
    this._saveToStorage();
  },

  // Return read-only map from each channel ID to
  // { name, param, enabled }.
  getGuide: function() {
    var results = {};
    for (var id in this._channelGuide) {
      var c = this._channelGuide[id];
      results[id] = {
        name: c.name,
        param: c.param,
        enabled: c.enabled,
      };
    }

    return results;
  },

  getListings: function(id) {
    return this._channelGuide[id].channel.getListings();
  },
  setEnabled: function(id, enabled) {
    this._channelGuide[id].enabled = enabled;
    this._saveToStorage();
  },

  refreshAllEnabled: function() {
    for (var id in this._channelGuide) {
      var data = this._channelGuide[id];
      if (data.enabled)
        data.channel.refresh();
    }
  },

  // Returns a random Listing from all enabled channels or from channel
  // |channelId| if specified, trying to match the ratio of |width| and
  // |height| decently.  Returns undefined if there are no enabled channels.
  randomListing: function(opts) {
    if (!getSettings().picreplacement) {
      return undefined;
    }
    // if the element to be replace is 'fixed' in position, it may make for bad pic replacement element.
    if (opts.position === "fixed") {
      for (var inx = 0; inx < FilterStorage.subscriptions.length; inx++) {
        var sub = FilterStorage.subscriptions[inx];
        if (sub.url === subscription1.url || sub.url === subscription2.url) {
          return undefined;
        }
      }
    }

    var heightLowRange = opts.height;
    var widthLowRange = opts.width;
    var heightHighRange = (opts.height * 1.25);
    var widthHighRange = (opts.width * 1.25);
    var targetRatio = Math.max(opts.width, opts.height) / Math.min(opts.width, opts.height);
    var typeMatchListings = [];
    var rangeLimitedListings = [];

    for (var id in this._channelGuide) {
      var data = this._channelGuide[id];
      if (opts.channelId === id || (data.enabled && !opts.channelId)) {
        data.channel.getListings().forEach(function(element) {
            if ((opts.type === WIDE || opts.type === SKINNYWIDE) &&
                 (element.type !== SKINNYTALL) &&
                 (element.width <= widthHighRange) &&
                 (element.height >= heightLowRange) &&
                 (element.height <= heightHighRange)) {
               rangeLimitedListings.push(element);
            } else if ((opts.type === TALL || opts.type === SKINNYTALL) &&
                (element.type !== SKINNYWIDE) &&
                (element.width >= widthLowRange) &&
                (element.width <= widthHighRange) &&
                (element.height <= heightHighRange)) {
               rangeLimitedListings.push(element);
            } else if ((opts.type !== WIDE) &&
                (opts.type !== TALL) &&
                (opts.type !== SKINNYTALL) &&
                (opts.type !== SKINNYWIDE) &&
                (element.width >= widthLowRange) &&
                (element.width <= widthHighRange) &&
                (element.height >= heightLowRange) &&
                (element.height <= heightHighRange)) {
               rangeLimitedListings.push(element);
            }
            if (opts.type === element.type &&
                element.width >= widthLowRange &&
                element.height >= heightLowRange) {
              typeMatchListings.push(element);
            }
        });
      }
    }
    var exactTypeMatchListings = [];
    if (rangeLimitedListings.length > 0) {
      var randomIndex = Math.floor(Math.random() * rangeLimitedListings.length);
      var theListing = Object.assign({}, rangeLimitedListings[randomIndex]);
      theListing.listingHeight = theListing.height;
      theListing.listingWidth = theListing.width;
      if (opts.height !== theListing.height && opts.width !== theListing.width) {
        theListing.height = (theListing.height * opts.width) / theListing.width;
        theListing.width = opts.width;
      }
      return theListing;
    } else {
      var bestMatch = null;
      var bestMatchRatio = 0;
      var targetRatio = Math.max(opts.width, opts.height) / Math.min(opts.width, opts.height);
      typeMatchListings.forEach(function(listing) {
        if (Math.abs(listing.ratio - targetRatio) < Math.abs(bestMatchRatio - targetRatio)) {
          exactTypeMatchListings = []; // remove previous matches
          exactTypeMatchListings.push(listing);
          bestMatch = listing;
          bestMatchRatio = listing.ratio;
        } else if (listing.ratio === bestMatchRatio) {
          exactTypeMatchListings.push(listing);
        }
      });
      if (exactTypeMatchListings.length > 0) {
        var randomIndex = Math.floor(Math.random() * exactTypeMatchListings.length);
        var theListing = Object.assign({}, exactTypeMatchListings[randomIndex]);
        theListing.listingHeight = theListing.height;
        theListing.listingWidth = theListing.width;
        return theListing;
      }
    }
    return undefined;
  },

  _loadFromStorage: function() {
    this._channelGuide = {};

    var entries = storage_get("channels");
    if (!entries || (entries.length > 0 && !entries[0].name)) {
      this.add({name: "DogsChannel", param: undefined,
                enabled: true});
      this.add({name: "CatsChannel", param: undefined,
                enabled: true});
      this.add({name: "LandscapesChannel", param: undefined,
                enabled: true});
    }
    else {
      for (var i=0; i < entries.length; i++) {
        this.add(entries[i]);
      }
    }
  },

  _saveToStorage: function() {
    var toStore = [];
    var guide = this.getGuide();
    for (var id in guide)
      toStore.push(guide[id]);
    storage_set("channels", toStore);
  },

};


// Base class representing a channel of photos.
// Concrete constructors must accept a single argument, because Channels.add()
// relies on that.
function Channel() {
  this.__listings = [];
};
Channel.prototype = {
  getListings: function() {
    return this.__listings.slice(0); // shallow copy
  },

  // Update the channel's listings and trigger an 'updated' event.
  refresh: function() {
    var that = this;
    this._getLatestListings(function(listings) {
      that.__listings = listings;
      $(that).trigger("updated");
    });
  },

  // Load all photos so that they're in the cache.
  prefetch: function() {
    //current - noop, since all of the URLs are hard coded.
  },

  _getLatestListings: function(callback) {
    throw "Implemented by subclass. Call callback with up-to-date listings.";
  },

  _calculateType: function(w, h) {
    if (typeof w === "string") {
      w = parseInt(w, 10);
    }
    if (typeof h === "string") {
      h = parseInt(h, 10);
    }
    var type = "";
    var ratio = Math.max(w,h) / Math.min(w, h);
    if (ratio >= 1.5 && ratio < 7) {
      type = (w > h ? imageSizesMap.get("wide") : imageSizesMap.get("tall"));
    } else if (ratio > 7) {
      type = (w > h ? imageSizesMap.get("skinnywide") : imageSizesMap.get("skinnytall"));
    } else {
      type = ((w > 125 || h > 125)  ? imageSizesMap.get("big") : imageSizesMap.get("small"));
    }
    return type;
  }
};

Object.assign(window, {
  Channel,
  Channels,
  Listing
});

/***/ }),
/* 59 */
/***/ (function(module, exports) {


// Channel containing hard coded cats loaded from disk.
// Subclass of Channel.
function CatsChannel() {
  Channel.call(this);
};
CatsChannel.prototype = {
  __proto__: Channel.prototype,

  _getLatestListings: function(callback) {
    var that = this;
    function L(w, h, u) {
      var type = that._calculateType(w, h);
      if (typeof w === "number") {
        w = "" + w + "";
      }
      if (typeof h === "number") {
        h = "" + h + "";
      }
      return new Listing({
        width: w,
        height: h,
        url: u,
        attribution_url: u,
        type: type,
        ratio: Math.max(w, h) / Math.min(w, h),
        title: "This is a cat!"
      });
    }
    // the listings never change
    callback([
      L(1200,628,"https://cdn.adblockcdn.com/pix/Cats/12--x628/12--x628/cat-7784.jpg"),
      L(1200,628,"https://cdn.adblockcdn.com/pix/Cats/12--x628/12--x628/cat-animal-animal-portrait-pet.jpg"),
      L(1200,628,"https://cdn.adblockcdn.com/pix/Cats/12--x628/12--x628/cat-feline-cute-domestic.jpg"),
      L(1200,628,"https://cdn.adblockcdn.com/pix/Cats/12--x628/12--x628/cat-kitten-rozkosne-little.jpg"),
      L(1200,628,"https://cdn.adblockcdn.com/pix/Cats/12--x628/12--x628/domestic-cat-cat-adidas-relaxed.jpg"),
      L(1200,628,"https://cdn.adblockcdn.com/pix/Cats/12--x628/12--x628/eyes-cats-cat-couch.jpg"),
      L(2400,1256,"https://cdn.adblockcdn.com/pix/Cats/12--x628/24--x1256/cat-7784.jpg"),
      L(2400,1256,"https://cdn.adblockcdn.com/pix/Cats/12--x628/24--x1256/cat-animal-animal-portrait-pet.jpg"),
      L(2400,1256,"https://cdn.adblockcdn.com/pix/Cats/12--x628/24--x1256/cat-feline-cute-domestic.jpg"),
      L(2400,1256,"https://cdn.adblockcdn.com/pix/Cats/12--x628/24--x1256/cat-kitten-rozkosne-little.jpg"),
      L(2400,1256,"https://cdn.adblockcdn.com/pix/Cats/12--x628/24--x1256/domestic-cat-cat-adidas-relaxed.jpg"),
      L(2400,1256,"https://cdn.adblockcdn.com/pix/Cats/12--x628/24--x1256/eyes-cats-cat-couch.jpg"),
      L(300,250,"https://cdn.adblockcdn.com/pix/Cats/3--x25-/3--x25-/cat-7784.jpg"),
      L(300,250,"https://cdn.adblockcdn.com/pix/Cats/3--x25-/3--x25-/cat-82072.jpg"),
      L(300,250,"https://cdn.adblockcdn.com/pix/Cats/3--x25-/3--x25-/cat-animal-animal-portrait-pet.jpg"),
      L(300,250,"https://cdn.adblockcdn.com/pix/Cats/3--x25-/3--x25-/cat-animal-cute-pet-39500.jpg"),
      L(300,250,"https://cdn.adblockcdn.com/pix/Cats/3--x25-/3--x25-/cat-balcony-surprised-look-80363.jpg"),
      L(300,250,"https://cdn.adblockcdn.com/pix/Cats/3--x25-/3--x25-/cat-british-shorthair-mieze-blue-eye-162174.jpg"),
      L(300,250,"https://cdn.adblockcdn.com/pix/Cats/3--x25-/3--x25-/cat-british-shorthair-thoroughbred-adidas-162064.jpg"),
      L(300,250,"https://cdn.adblockcdn.com/pix/Cats/3--x25-/3--x25-/cat-close-animal-cat-face-162309.jpg"),
      L(300,250,"https://cdn.adblockcdn.com/pix/Cats/3--x25-/3--x25-/cat-eyes-view-face-66292.jpg"),
      L(300,250,"https://cdn.adblockcdn.com/pix/Cats/3--x25-/3--x25-/cat-feline-cute-domestic.jpg"),
      L(300,250,"https://cdn.adblockcdn.com/pix/Cats/3--x25-/3--x25-/cat-feline-furry-pet-53446.jpg"),
      L(300,250,"https://cdn.adblockcdn.com/pix/Cats/3--x25-/3--x25-/cat-feline-kitty-kitten-39380.jpg"),
      L(300,250,"https://cdn.adblockcdn.com/pix/Cats/3--x25-/3--x25-/cat-home-animal-cat-s-eyes-46208.jpg"),
      L(300,250,"https://cdn.adblockcdn.com/pix/Cats/3--x25-/3--x25-/cat-kitten-rozkosne-little.jpg"),
      L(300,250,"https://cdn.adblockcdn.com/pix/Cats/3--x25-/3--x25-/cat-pet-eyes-animal-50566.jpg"),
      L(300,250,"https://cdn.adblockcdn.com/pix/Cats/3--x25-/3--x25-/cat-pet-furry-face-162319.jpg"),
      L(300,250,"https://cdn.adblockcdn.com/pix/Cats/3--x25-/3--x25-/cat-portrait-eyes-animal-162216.jpg"),
      L(300,250,"https://cdn.adblockcdn.com/pix/Cats/3--x25-/3--x25-/cat-portrait-kitten-cute-128884.jpg"),
      L(300,250,"https://cdn.adblockcdn.com/pix/Cats/3--x25-/3--x25-/cat-relax-chill-out-camacho-70844.jpg"),
      L(300,250,"https://cdn.adblockcdn.com/pix/Cats/3--x25-/3--x25-/cat-tiger-getiegert-feel-at-home-160722.jpg"),
      L(300,250,"https://cdn.adblockcdn.com/pix/Cats/3--x25-/3--x25-/domestic-cat-cat-adidas-relaxed.jpg"),
      L(300,250,"https://cdn.adblockcdn.com/pix/Cats/3--x25-/3--x25-/eyes-cats-cat-couch.jpg"),
      L(300,250,"https://cdn.adblockcdn.com/pix/Cats/3--x25-/3--x25-/pexels-photo-105587.jpg"),
      L(300,250,"https://cdn.adblockcdn.com/pix/Cats/3--x25-/3--x25-/pexels-photo-106131.jpg"),
      L(300,250,"https://cdn.adblockcdn.com/pix/Cats/3--x25-/3--x25-/pexels-photo-116835.jpg"),
      L(300,250,"https://cdn.adblockcdn.com/pix/Cats/3--x25-/3--x25-/pexels-photo-135859.jpg"),
      L(300,250,"https://cdn.adblockcdn.com/pix/Cats/3--x25-/3--x25-/pexels-photo-142615.jpg"),
      L(300,250,"https://cdn.adblockcdn.com/pix/Cats/3--x25-/3--x25-/pexels-photo-171216.jpg"),
      L(300,250,"https://cdn.adblockcdn.com/pix/Cats/3--x25-/3--x25-/pexels-photo-172420.jpg"),
      L(300,250,"https://cdn.adblockcdn.com/pix/Cats/3--x25-/3--x25-/pexels-photo-173909.jpg"),
      L(300,250,"https://cdn.adblockcdn.com/pix/Cats/3--x25-/3--x25-/pexels-photo-192384.jpg"),
      L(300,250,"https://cdn.adblockcdn.com/pix/Cats/3--x25-/3--x25-/pexels-photo-207166.jpg"),
      L(300,250,"https://cdn.adblockcdn.com/pix/Cats/3--x25-/3--x25-/pexels-photo-208845.jpg"),
      L(300,250,"https://cdn.adblockcdn.com/pix/Cats/3--x25-/3--x25-/pexels-photo-208860.jpg"),
      L(300,250,"https://cdn.adblockcdn.com/pix/Cats/3--x25-/3--x25-/pexels-photo-208878.jpg"),
      L(300,250,"https://cdn.adblockcdn.com/pix/Cats/3--x25-/3--x25-/pexels-photo-208880.jpg"),
      L(300,250,"https://cdn.adblockcdn.com/pix/Cats/3--x25-/3--x25-/pexels-photo-208906.jpg"),
      L(300,250,"https://cdn.adblockcdn.com/pix/Cats/3--x25-/3--x25-/pexels-photo-208907.jpg"),
      L(300,250,"https://cdn.adblockcdn.com/pix/Cats/3--x25-/3--x25-/pexels-photo-208954.jpg"),
      L(300,250,"https://cdn.adblockcdn.com/pix/Cats/3--x25-/3--x25-/pexels-photo-208971.jpg"),
      L(300,250,"https://cdn.adblockcdn.com/pix/Cats/3--x25-/3--x25-/pexels-photo-208998.jpg"),
      L(300,250,"https://cdn.adblockcdn.com/pix/Cats/3--x25-/3--x25-/pexels-photo-209117.jpg"),
      L(300,250,"https://cdn.adblockcdn.com/pix/Cats/3--x25-/3--x25-/pexels-photo-209800.jpg"),
      L(300,250,"https://cdn.adblockcdn.com/pix/Cats/3--x25-/3--x25-/pexels-photo-210081.jpg"),
      L(300,250,"https://cdn.adblockcdn.com/pix/Cats/3--x25-/3--x25-/pexels-photo-214657.jpg"),
      L(300,250,"https://cdn.adblockcdn.com/pix/Cats/3--x25-/3--x25-/pexels-photo-220826.jpg"),
      L(300,250,"https://cdn.adblockcdn.com/pix/Cats/3--x25-/3--x25-/pexels-photo-220876.jpg"),
      L(300,250,"https://cdn.adblockcdn.com/pix/Cats/3--x25-/3--x25-/pexels-photo-220951.jpg"),
      L(300,250,"https://cdn.adblockcdn.com/pix/Cats/3--x25-/3--x25-/pexels-photo-220970.jpg"),
      L(300,250,"https://cdn.adblockcdn.com/pix/Cats/3--x25-/3--x25-/pexels-photo-220983.jpg"),
      L(300,250,"https://cdn.adblockcdn.com/pix/Cats/3--x25-/3--x25-/pexels-photo-236630.jpg"),
      L(300,250,"https://cdn.adblockcdn.com/pix/Cats/3--x25-/3--x25-/pexels-photo-236633.jpg"),
      L(300,250,"https://cdn.adblockcdn.com/pix/Cats/3--x25-/3--x25-/pexels-photo-244848.jpg"),
      L(300,250,"https://cdn.adblockcdn.com/pix/Cats/3--x25-/3--x25-/pexels-photo-247007.jpg"),
      L(300,250,"https://cdn.adblockcdn.com/pix/Cats/3--x25-/3--x25-/pexels-photo-248254.jpg"),
      L(300,250,"https://cdn.adblockcdn.com/pix/Cats/3--x25-/3--x25-/pexels-photo-248289.jpg"),
      L(300,250,"https://cdn.adblockcdn.com/pix/Cats/3--x25-/3--x25-/pexels-photo-248304.jpg"),
      L(300,250,"https://cdn.adblockcdn.com/pix/Cats/3--x25-/3--x25-/pexels-photo-257423.jpg"),
      L(300,250,"https://cdn.adblockcdn.com/pix/Cats/3--x25-/3--x25-/pexels-photo-271889.jpg"),
      L(300,250,"https://cdn.adblockcdn.com/pix/Cats/3--x25-/3--x25-/pexels-photo-272124.jpg"),
      L(300,250,"https://cdn.adblockcdn.com/pix/Cats/3--x25-/3--x25-/pexels-photo-289345.jpg"),
      L(300,250,"https://cdn.adblockcdn.com/pix/Cats/3--x25-/3--x25-/pexels-photo-289381.jpg"),
      L(300,250,"https://cdn.adblockcdn.com/pix/Cats/3--x25-/3--x25-/pexels-photo-290263.jpg"),
      L(300,250,"https://cdn.adblockcdn.com/pix/Cats/3--x25-/3--x25-/pexels-photo-327014.jpg"),
      L(300,250,"https://cdn.adblockcdn.com/pix/Cats/3--x25-/3--x25-/pexels-photo-349388.jpg"),
      L(300,250,"https://cdn.adblockcdn.com/pix/Cats/3--x25-/3--x25-/pexels-photo-372651.jpg"),
      L(300,250,"https://cdn.adblockcdn.com/pix/Cats/3--x25-/3--x25-/pexels-photo-372657.jpg"),
      L(300,250,"https://cdn.adblockcdn.com/pix/Cats/3--x25-/3--x25-/pexels-photo-416088.jpg"),
      L(300,250,"https://cdn.adblockcdn.com/pix/Cats/3--x25-/3--x25-/pexels-photo-416138.jpg"),
      L(300,250,"https://cdn.adblockcdn.com/pix/Cats/3--x25-/3--x25-/pexels-photo-416208.jpg"),
      L(300,250,"https://cdn.adblockcdn.com/pix/Cats/3--x25-/3--x25-/pexels-photo-437886.jpg"),
      L(300,250,"https://cdn.adblockcdn.com/pix/Cats/3--x25-/3--x25-/pexels-photo-461872.jpg"),
      L(300,250,"https://cdn.adblockcdn.com/pix/Cats/3--x25-/3--x25-/pexels-photo-549237.jpg"),
      L(300,250,"https://cdn.adblockcdn.com/pix/Cats/3--x25-/3--x25-/pexels-photo-576802.jpg"),
      L(300,250,"https://cdn.adblockcdn.com/pix/Cats/3--x25-/3--x25-/pexels-photo-583250.jpg"),
      L(300,250,"https://cdn.adblockcdn.com/pix/Cats/3--x25-/3--x25-/pexels-photo-596590.jpg"),
      L(300,250,"https://cdn.adblockcdn.com/pix/Cats/3--x25-/3--x25-/pexels-photo-599492.jpg"),
      L(300,250,"https://cdn.adblockcdn.com/pix/Cats/3--x25-/3--x25-/pexels-photo-605048.jpg"),
      L(300,250,"https://cdn.adblockcdn.com/pix/Cats/3--x25-/3--x25-/pexels-photo-622549.jpg"),
      L(300,250,"https://cdn.adblockcdn.com/pix/Cats/3--x25-/3--x25-/pexels-photo-65536.jpg"),
      L(300,250,"https://cdn.adblockcdn.com/pix/Cats/3--x25-/3--x25-/pexels-photo-674568.jpg"),
      L(300,250,"https://cdn.adblockcdn.com/pix/Cats/3--x25-/3--x25-/pexels-photo-674577 (1).jpg"),
      L(300,250,"https://cdn.adblockcdn.com/pix/Cats/3--x25-/3--x25-/pexels-photo-674577.jpg"),
      L(300,250,"https://cdn.adblockcdn.com/pix/Cats/3--x25-/3--x25-/pexels-photo-679855.jpg"),
      L(300,250,"https://cdn.adblockcdn.com/pix/Cats/3--x25-/3--x25-/pexels-photo-680437.jpg"),
      L(300,250,"https://cdn.adblockcdn.com/pix/Cats/3--x25-/3--x25-/pexels-photo-683205.jpg"),
      L(300,250,"https://cdn.adblockcdn.com/pix/Cats/3--x25-/3--x25-/pexels-photo-689042.jpg"),
      L(300,250,"https://cdn.adblockcdn.com/pix/Cats/3--x25-/3--x25-/pexels-photo-709482.jpg"),
      L(300,250,"https://cdn.adblockcdn.com/pix/Cats/3--x25-/3--x25-/pexels-photo-720684.jpg"),
      L(300,250,"https://cdn.adblockcdn.com/pix/Cats/3--x25-/3--x25-/pexels-photo-731553.jpg"),
      L(300,250,"https://cdn.adblockcdn.com/pix/Cats/3--x25-/3--x25-/pexels-photo-731637.jpg"),
      L(300,250,"https://cdn.adblockcdn.com/pix/Cats/3--x25-/3--x25-/pexels-photo-733105.jpg"),
      L(300,250,"https://cdn.adblockcdn.com/pix/Cats/3--x25-/3--x25-/pexels-photo-736528.jpg"),
      L(300,250,"https://cdn.adblockcdn.com/pix/Cats/3--x25-/3--x25-/pexels-photo-745241.jpg"),
      L(300,250,"https://cdn.adblockcdn.com/pix/Cats/3--x25-/3--x25-/pexels-photo-749212.jpg"),
      L(300,250,"https://cdn.adblockcdn.com/pix/Cats/3--x25-/3--x25-/pexels-photo-751050.jpg"),
      L(300,250,"https://cdn.adblockcdn.com/pix/Cats/3--x25-/3--x25-/pexels-photo-89951.jpg"),
      L(300,250,"https://cdn.adblockcdn.com/pix/Cats/3--x25-/3--x25-/pexels-photo-92174.jpg"),
      L(300,250,"https://cdn.adblockcdn.com/pix/Cats/3--x25-/3--x25-/pexels-photo-94434.jpg"),
      L(300,250,"https://cdn.adblockcdn.com/pix/Cats/3--x25-/3--x25-/pexels-photo-95328.jpg"),
      L(300,250,"https://cdn.adblockcdn.com/pix/Cats/3--x25-/3--x25-/cat-close-animal-cat-face-1623-9.jpg"),
      L(300,250,"https://cdn.adblockcdn.com/pix/Cats/3--x25-/3--x25-/cat-feline-kitty-kitten-3938-.jpg"),
      L(300,250,"https://cdn.adblockcdn.com/pix/Cats/3--x25-/3--x25-/pexels-photo-1-5587.jpg"),
      L(300,250,"https://cdn.adblockcdn.com/pix/Cats/3--x25-/3--x25-/pexels-photo-17242-.jpg"),
      L(300,250,"https://cdn.adblockcdn.com/pix/Cats/3--x25-/3--x25-/pexels-photo-1739-9.jpg"),
      L(300,250,"https://cdn.adblockcdn.com/pix/Cats/3--x25-/3--x25-/pexels-photo-2-886-.jpg"),
      L(300,250,"https://cdn.adblockcdn.com/pix/Cats/3--x25-/3--x25-/pexels-photo-2-8878.jpg"),
      L(300,250,"https://cdn.adblockcdn.com/pix/Cats/3--x25-/3--x25-/pexels-photo-58325-.jpg"),
      L(300,250,"https://cdn.adblockcdn.com/pix/Cats/3--x25-/3--x25-/pexels-photo-6832-5.jpg"),
      L(300,250,"https://cdn.adblockcdn.com/pix/Cats/3--x25-/3--x25-/pexels-photo-7-9482.jpg"),
      L(300,250,"https://cdn.adblockcdn.com/pix/Cats/3--x25-/3--x25-/pexels-photo-751-5-.jpg"),
      L(600,500,"https://cdn.adblockcdn.com/pix/Cats/3--x25-/6--x5--/cat-7784.jpg"),
      L(600,500,"https://cdn.adblockcdn.com/pix/Cats/3--x25-/6--x5--/cat-82072.jpg"),
      L(600,500,"https://cdn.adblockcdn.com/pix/Cats/3--x25-/6--x5--/cat-animal-animal-portrait-pet.jpg"),
      L(600,500,"https://cdn.adblockcdn.com/pix/Cats/3--x25-/6--x5--/cat-animal-cute-pet-39500.jpg"),
      L(600,500,"https://cdn.adblockcdn.com/pix/Cats/3--x25-/6--x5--/cat-balcony-surprised-look-80363.jpg"),
      L(600,500,"https://cdn.adblockcdn.com/pix/Cats/3--x25-/6--x5--/cat-british-shorthair-mieze-blue-eye-162174.jpg"),
      L(600,500,"https://cdn.adblockcdn.com/pix/Cats/3--x25-/6--x5--/cat-british-shorthair-thoroughbred-adidas-162064.jpg"),
      L(600,500,"https://cdn.adblockcdn.com/pix/Cats/3--x25-/6--x5--/cat-close-animal-cat-face-162309.jpg"),
      L(600,500,"https://cdn.adblockcdn.com/pix/Cats/3--x25-/6--x5--/cat-eyes-view-face-66292.jpg"),
      L(600,500,"https://cdn.adblockcdn.com/pix/Cats/3--x25-/6--x5--/cat-feline-cute-domestic.jpg"),
      L(600,500,"https://cdn.adblockcdn.com/pix/Cats/3--x25-/6--x5--/cat-feline-furry-pet-53446.jpg"),
      L(600,500,"https://cdn.adblockcdn.com/pix/Cats/3--x25-/6--x5--/cat-feline-kitty-kitten-39380.jpg"),
      L(600,500,"https://cdn.adblockcdn.com/pix/Cats/3--x25-/6--x5--/cat-home-animal-cat-s-eyes-46208.jpg"),
      L(600,500,"https://cdn.adblockcdn.com/pix/Cats/3--x25-/6--x5--/cat-kitten-rozkosne-little.jpg"),
      L(600,500,"https://cdn.adblockcdn.com/pix/Cats/3--x25-/6--x5--/cat-pet-eyes-animal-50566.jpg"),
      L(600,500,"https://cdn.adblockcdn.com/pix/Cats/3--x25-/6--x5--/cat-pet-furry-face-162319.jpg"),
      L(600,500,"https://cdn.adblockcdn.com/pix/Cats/3--x25-/6--x5--/cat-portrait-eyes-animal-162216.jpg"),
      L(600,500,"https://cdn.adblockcdn.com/pix/Cats/3--x25-/6--x5--/cat-portrait-kitten-cute-128884.jpg"),
      L(600,500,"https://cdn.adblockcdn.com/pix/Cats/3--x25-/6--x5--/cat-relax-chill-out-camacho-70844.jpg"),
      L(600,500,"https://cdn.adblockcdn.com/pix/Cats/3--x25-/6--x5--/cat-tiger-getiegert-feel-at-home-160722.jpg"),
      L(600,500,"https://cdn.adblockcdn.com/pix/Cats/3--x25-/6--x5--/domestic-cat-cat-adidas-relaxed.jpg"),
      L(600,500,"https://cdn.adblockcdn.com/pix/Cats/3--x25-/6--x5--/eyes-cats-cat-couch.jpg"),
      L(600,500,"https://cdn.adblockcdn.com/pix/Cats/3--x25-/6--x5--/pexels-photo-105587.jpg"),
      L(600,500,"https://cdn.adblockcdn.com/pix/Cats/3--x25-/6--x5--/pexels-photo-106131.jpg"),
      L(600,500,"https://cdn.adblockcdn.com/pix/Cats/3--x25-/6--x5--/pexels-photo-116835.jpg"),
      L(600,500,"https://cdn.adblockcdn.com/pix/Cats/3--x25-/6--x5--/pexels-photo-135859.jpg"),
      L(600,500,"https://cdn.adblockcdn.com/pix/Cats/3--x25-/6--x5--/pexels-photo-142615.jpg"),
      L(600,500,"https://cdn.adblockcdn.com/pix/Cats/3--x25-/6--x5--/pexels-photo-171216.jpg"),
      L(600,500,"https://cdn.adblockcdn.com/pix/Cats/3--x25-/6--x5--/pexels-photo-172420.jpg"),
      L(600,500,"https://cdn.adblockcdn.com/pix/Cats/3--x25-/6--x5--/pexels-photo-173909.jpg"),
      L(600,500,"https://cdn.adblockcdn.com/pix/Cats/3--x25-/6--x5--/pexels-photo-192384.jpg"),
      L(600,500,"https://cdn.adblockcdn.com/pix/Cats/3--x25-/6--x5--/pexels-photo-207166.jpg"),
      L(600,500,"https://cdn.adblockcdn.com/pix/Cats/3--x25-/6--x5--/pexels-photo-208845.jpg"),
      L(600,500,"https://cdn.adblockcdn.com/pix/Cats/3--x25-/6--x5--/pexels-photo-208860.jpg"),
      L(600,500,"https://cdn.adblockcdn.com/pix/Cats/3--x25-/6--x5--/pexels-photo-208878.jpg"),
      L(600,500,"https://cdn.adblockcdn.com/pix/Cats/3--x25-/6--x5--/pexels-photo-208880.jpg"),
      L(600,500,"https://cdn.adblockcdn.com/pix/Cats/3--x25-/6--x5--/pexels-photo-208906.jpg"),
      L(600,500,"https://cdn.adblockcdn.com/pix/Cats/3--x25-/6--x5--/pexels-photo-208907.jpg"),
      L(600,500,"https://cdn.adblockcdn.com/pix/Cats/3--x25-/6--x5--/pexels-photo-208954.jpg"),
      L(600,500,"https://cdn.adblockcdn.com/pix/Cats/3--x25-/6--x5--/pexels-photo-208971.jpg"),
      L(600,500,"https://cdn.adblockcdn.com/pix/Cats/3--x25-/6--x5--/pexels-photo-208998.jpg"),
      L(600,500,"https://cdn.adblockcdn.com/pix/Cats/3--x25-/6--x5--/pexels-photo-209117.jpg"),
      L(600,500,"https://cdn.adblockcdn.com/pix/Cats/3--x25-/6--x5--/pexels-photo-209800.jpg"),
      L(600,500,"https://cdn.adblockcdn.com/pix/Cats/3--x25-/6--x5--/pexels-photo-210081.jpg"),
      L(600,500,"https://cdn.adblockcdn.com/pix/Cats/3--x25-/6--x5--/pexels-photo-214657.jpg"),
      L(600,500,"https://cdn.adblockcdn.com/pix/Cats/3--x25-/6--x5--/pexels-photo-220826.jpg"),
      L(600,500,"https://cdn.adblockcdn.com/pix/Cats/3--x25-/6--x5--/pexels-photo-220876.jpg"),
      L(600,500,"https://cdn.adblockcdn.com/pix/Cats/3--x25-/6--x5--/pexels-photo-220951.jpg"),
      L(600,500,"https://cdn.adblockcdn.com/pix/Cats/3--x25-/6--x5--/pexels-photo-220970.jpg"),
      L(600,500,"https://cdn.adblockcdn.com/pix/Cats/3--x25-/6--x5--/pexels-photo-220983.jpg"),
      L(600,500,"https://cdn.adblockcdn.com/pix/Cats/3--x25-/6--x5--/pexels-photo-236630.jpg"),
      L(600,500,"https://cdn.adblockcdn.com/pix/Cats/3--x25-/6--x5--/pexels-photo-236633.jpg"),
      L(600,500,"https://cdn.adblockcdn.com/pix/Cats/3--x25-/6--x5--/pexels-photo-244848.jpg"),
      L(600,500,"https://cdn.adblockcdn.com/pix/Cats/3--x25-/6--x5--/pexels-photo-247007.jpg"),
      L(600,500,"https://cdn.adblockcdn.com/pix/Cats/3--x25-/6--x5--/pexels-photo-248254.jpg"),
      L(600,500,"https://cdn.adblockcdn.com/pix/Cats/3--x25-/6--x5--/pexels-photo-248289.jpg"),
      L(600,500,"https://cdn.adblockcdn.com/pix/Cats/3--x25-/6--x5--/pexels-photo-248304.jpg"),
      L(600,500,"https://cdn.adblockcdn.com/pix/Cats/3--x25-/6--x5--/pexels-photo-257423.jpg"),
      L(600,500,"https://cdn.adblockcdn.com/pix/Cats/3--x25-/6--x5--/pexels-photo-271889.jpg"),
      L(600,500,"https://cdn.adblockcdn.com/pix/Cats/3--x25-/6--x5--/pexels-photo-272124.jpg"),
      L(600,500,"https://cdn.adblockcdn.com/pix/Cats/3--x25-/6--x5--/pexels-photo-289345.jpg"),
      L(600,500,"https://cdn.adblockcdn.com/pix/Cats/3--x25-/6--x5--/pexels-photo-289381.jpg"),
      L(600,500,"https://cdn.adblockcdn.com/pix/Cats/3--x25-/6--x5--/pexels-photo-290263.jpg"),
      L(600,500,"https://cdn.adblockcdn.com/pix/Cats/3--x25-/6--x5--/pexels-photo-327014.jpg"),
      L(600,500,"https://cdn.adblockcdn.com/pix/Cats/3--x25-/6--x5--/pexels-photo-349388.jpg"),
      L(600,500,"https://cdn.adblockcdn.com/pix/Cats/3--x25-/6--x5--/pexels-photo-372651.jpg"),
      L(600,500,"https://cdn.adblockcdn.com/pix/Cats/3--x25-/6--x5--/pexels-photo-372657.jpg"),
      L(600,500,"https://cdn.adblockcdn.com/pix/Cats/3--x25-/6--x5--/pexels-photo-416088.jpg"),
      L(600,500,"https://cdn.adblockcdn.com/pix/Cats/3--x25-/6--x5--/pexels-photo-416138.jpg"),
      L(600,500,"https://cdn.adblockcdn.com/pix/Cats/3--x25-/6--x5--/pexels-photo-416208.jpg"),
      L(600,500,"https://cdn.adblockcdn.com/pix/Cats/3--x25-/6--x5--/pexels-photo-437886.jpg"),
      L(600,500,"https://cdn.adblockcdn.com/pix/Cats/3--x25-/6--x5--/pexels-photo-461872.jpg"),
      L(600,500,"https://cdn.adblockcdn.com/pix/Cats/3--x25-/6--x5--/pexels-photo-549237.jpg"),
      L(600,500,"https://cdn.adblockcdn.com/pix/Cats/3--x25-/6--x5--/pexels-photo-576802.jpg"),
      L(600,500,"https://cdn.adblockcdn.com/pix/Cats/3--x25-/6--x5--/pexels-photo-583250.jpg"),
      L(600,500,"https://cdn.adblockcdn.com/pix/Cats/3--x25-/6--x5--/pexels-photo-596590.jpg"),
      L(600,500,"https://cdn.adblockcdn.com/pix/Cats/3--x25-/6--x5--/pexels-photo-599492.jpg"),
      L(600,500,"https://cdn.adblockcdn.com/pix/Cats/3--x25-/6--x5--/pexels-photo-605048.jpg"),
      L(600,500,"https://cdn.adblockcdn.com/pix/Cats/3--x25-/6--x5--/pexels-photo-622549.jpg"),
      L(600,500,"https://cdn.adblockcdn.com/pix/Cats/3--x25-/6--x5--/pexels-photo-65536.jpg"),
      L(600,500,"https://cdn.adblockcdn.com/pix/Cats/3--x25-/6--x5--/pexels-photo-674568.jpg"),
      L(600,500,"https://cdn.adblockcdn.com/pix/Cats/3--x25-/6--x5--/pexels-photo-674577 (1).jpg"),
      L(600,500,"https://cdn.adblockcdn.com/pix/Cats/3--x25-/6--x5--/pexels-photo-674577.jpg"),
      L(600,500,"https://cdn.adblockcdn.com/pix/Cats/3--x25-/6--x5--/pexels-photo-679855.jpg"),
      L(600,500,"https://cdn.adblockcdn.com/pix/Cats/3--x25-/6--x5--/pexels-photo-680437.jpg"),
      L(600,500,"https://cdn.adblockcdn.com/pix/Cats/3--x25-/6--x5--/pexels-photo-683205.jpg"),
      L(600,500,"https://cdn.adblockcdn.com/pix/Cats/3--x25-/6--x5--/pexels-photo-689042.jpg"),
      L(600,500,"https://cdn.adblockcdn.com/pix/Cats/3--x25-/6--x5--/pexels-photo-709482.jpg"),
      L(600,500,"https://cdn.adblockcdn.com/pix/Cats/3--x25-/6--x5--/pexels-photo-720684.jpg"),
      L(600,500,"https://cdn.adblockcdn.com/pix/Cats/3--x25-/6--x5--/pexels-photo-731553.jpg"),
      L(600,500,"https://cdn.adblockcdn.com/pix/Cats/3--x25-/6--x5--/pexels-photo-731637.jpg"),
      L(600,500,"https://cdn.adblockcdn.com/pix/Cats/3--x25-/6--x5--/pexels-photo-733105.jpg"),
      L(600,500,"https://cdn.adblockcdn.com/pix/Cats/3--x25-/6--x5--/pexels-photo-736528.jpg"),
      L(600,500,"https://cdn.adblockcdn.com/pix/Cats/3--x25-/6--x5--/pexels-photo-745241.jpg"),
      L(600,500,"https://cdn.adblockcdn.com/pix/Cats/3--x25-/6--x5--/pexels-photo-749212.jpg"),
      L(600,500,"https://cdn.adblockcdn.com/pix/Cats/3--x25-/6--x5--/pexels-photo-751050.jpg"),
      L(600,500,"https://cdn.adblockcdn.com/pix/Cats/3--x25-/6--x5--/pexels-photo-89951.jpg"),
      L(600,500,"https://cdn.adblockcdn.com/pix/Cats/3--x25-/6--x5--/pexels-photo-92174.jpg"),
      L(600,500,"https://cdn.adblockcdn.com/pix/Cats/3--x25-/6--x5--/pexels-photo-94434.jpg"),
      L(600,500,"https://cdn.adblockcdn.com/pix/Cats/3--x25-/6--x5--/pexels-photo-95328.jpg"),
      L(600,500,"https://cdn.adblockcdn.com/pix/Cats/3--x25-/6--x5--/pexels-photo-1-6131.jpg"),
      L(600,500,"https://cdn.adblockcdn.com/pix/Cats/3--x25-/6--x5--/pexels-photo-2-89-6.jpg"),
      L(600,500,"https://cdn.adblockcdn.com/pix/Cats/3--x25-/6--x5--/pexels-photo-2-9117.jpg"),
      L(600,500,"https://cdn.adblockcdn.com/pix/Cats/3--x25-/6--x5--/pexels-photo-22-983.jpg"),
      L(600,500,"https://cdn.adblockcdn.com/pix/Cats/3--x25-/6--x5--/pexels-photo-23663-.jpg"),
      L(600,500,"https://cdn.adblockcdn.com/pix/Cats/3--x25-/6--x5--/pexels-photo-4162-8.jpg"),
      L(600,500,"https://cdn.adblockcdn.com/pix/Cats/3--x25-/6--x5--/pexels-photo-5768-2.jpg"),
      L(600,500,"https://cdn.adblockcdn.com/pix/Cats/3--x25-/6--x5--/pexels-photo-68-437.jpg"),
      L(600,500,"https://cdn.adblockcdn.com/pix/Cats/3--x25-/6--x5--/pexels-photo-7331-5.jpg"),
      L(600,500,"https://cdn.adblockcdn.com/pix/Cats/3--x25-/_6--x5--/pexels-photo-116835.jpg"),
      L(600,500,"https://cdn.adblockcdn.com/pix/Cats/3--x25-/_6--x5--/pexels-photo-59659-.jpg"),
      L(600,500,"https://cdn.adblockcdn.com/pix/Cats/3--x25-/_6--x5--/pexels-photo-7331-5.jpg"),
      L(600,500,"https://cdn.adblockcdn.com/pix/Cats/3--x25-/_6--x5--/pexels-photo-94434.jpg"),
      L(300,600,"https://cdn.adblockcdn.com/pix/Cats/3--x6--/3--x6--/cat-7784.jpg"),
      L(300,600,"https://cdn.adblockcdn.com/pix/Cats/3--x6--/3--x6--/cat-animal-animal-portrait-pet.jpg"),
      L(300,600,"https://cdn.adblockcdn.com/pix/Cats/3--x6--/3--x6--/cat-feline-cute-domestic.jpg"),
      L(300,600,"https://cdn.adblockcdn.com/pix/Cats/3--x6--/3--x6--/cat-kitten-rozkosne-little.jpg"),
      L(300,600,"https://cdn.adblockcdn.com/pix/Cats/3--x6--/3--x6--/domestic-cat-cat-adidas-relaxed.jpg"),
      L(300,600,"https://cdn.adblockcdn.com/pix/Cats/3--x6--/3--x6--/eyes-cats-cat-couch.jpg"),
      L(600,1200,"https://cdn.adblockcdn.com/pix/Cats/3--x6--/6--x12--/cat-7784.jpg"),
      L(600,1200,"https://cdn.adblockcdn.com/pix/Cats/3--x6--/6--x12--/cat-animal-animal-portrait-pet.jpg"),
      L(600,1200,"https://cdn.adblockcdn.com/pix/Cats/3--x6--/6--x12--/cat-feline-cute-domestic.jpg"),
      L(600,1200,"https://cdn.adblockcdn.com/pix/Cats/3--x6--/6--x12--/cat-kitten-rozkosne-little.jpg"),
      L(600,1200,"https://cdn.adblockcdn.com/pix/Cats/3--x6--/6--x12--/domestic-cat-cat-adidas-relaxed.jpg"),
      L(600,1200,"https://cdn.adblockcdn.com/pix/Cats/3--x6--/6--x12--/eyes-cats-cat-couch.jpg"),
      L(336,280,"https://cdn.adblockcdn.com/pix/Cats/336x28-/336x28-/cat-7784.jpg"),
      L(336,280,"https://cdn.adblockcdn.com/pix/Cats/336x28-/336x28-/cat-animal-animal-portrait-pet.jpg"),
      L(336,280,"https://cdn.adblockcdn.com/pix/Cats/336x28-/336x28-/cat-feline-cute-domestic.jpg"),
      L(336,280,"https://cdn.adblockcdn.com/pix/Cats/336x28-/336x28-/cat-kitten-rozkosne-little.jpg"),
      L(336,280,"https://cdn.adblockcdn.com/pix/Cats/336x28-/336x28-/domestic-cat-cat-adidas-relaxed.jpg"),
      L(336,280,"https://cdn.adblockcdn.com/pix/Cats/336x28-/336x28-/eyes-cats-cat-couch.jpg"),
      L(672,560,"https://cdn.adblockcdn.com/pix/Cats/336x28-/672x56-/cat-7784.jpg"),
      L(672,560,"https://cdn.adblockcdn.com/pix/Cats/336x28-/672x56-/cat-animal-animal-portrait-pet.jpg"),
      L(672,560,"https://cdn.adblockcdn.com/pix/Cats/336x28-/672x56-/cat-feline-cute-domestic.jpg"),
      L(672,560,"https://cdn.adblockcdn.com/pix/Cats/336x28-/672x56-/cat-kitten-rozkosne-little.jpg"),
      L(672,560,"https://cdn.adblockcdn.com/pix/Cats/336x28-/672x56-/domestic-cat-cat-adidas-relaxed.jpg"),
      L(672,560,"https://cdn.adblockcdn.com/pix/Cats/336x28-/672x56-/eyes-cats-cat-couch.jpg"),
      L(468,60,"https://cdn.adblockcdn.com/pix/Cats/468x6-/468x6-/cat_468x6-_01.jpg"),
      L(468,60,"https://cdn.adblockcdn.com/pix/Cats/468x6-/468x6-/cat_468x6-_02.jpg"),
      L(468,60,"https://cdn.adblockcdn.com/pix/Cats/468x6-/468x6-/cat_468x6-_03.jpg"),
      L(468,60,"https://cdn.adblockcdn.com/pix/Cats/468x6-/468x6-/cat_468x6-_04.jpg"),
      L(468,60,"https://cdn.adblockcdn.com/pix/Cats/468x6-/468x6-/cat_468x6-_05.jpg"),
      L(468,60,"https://cdn.adblockcdn.com/pix/Cats/468x6-/468x6-/-2.jpg"),
      L(468,60,"https://cdn.adblockcdn.com/pix/Cats/468x6-/468x6-/-3.jpg"),
      L(468,60,"https://cdn.adblockcdn.com/pix/Cats/468x6-/468x6-/-4.jpg"),
      L(468,60,"https://cdn.adblockcdn.com/pix/Cats/468x6-/468x6-/-5.jpg"),
      L(468,60,"https://cdn.adblockcdn.com/pix/Cats/468x6-/468x6-/cat_468x6-_-3.jpg"),
      L(936,120,"https://cdn.adblockcdn.com/pix/Cats/468x6-/936x12-/cat_936x120_01.jpg"),
      L(936,120,"https://cdn.adblockcdn.com/pix/Cats/468x6-/936x12-/cat_936x120_02.jpg"),
      L(936,120,"https://cdn.adblockcdn.com/pix/Cats/468x6-/936x12-/cat_936x120_03.jpg"),
      L(936,120,"https://cdn.adblockcdn.com/pix/Cats/468x6-/936x12-/cat_936x120_04.jpg"),
      L(936,120,"https://cdn.adblockcdn.com/pix/Cats/468x6-/936x12-/cat_936x120_05.jpg"),
      L(936,120,"https://cdn.adblockcdn.com/pix/Cats/468x6-/936x12-/cat_936x12-_-1.jpg"),
      L(936,120,"https://cdn.adblockcdn.com/pix/Cats/468x6-/936x12-/-4.jpg"),
      L(1200,50,"https://cdn.adblockcdn.com/pix/Cats/12--x5-/12--x5-/cat_1200x50_01.jpg"),
      L(1200,50,"https://cdn.adblockcdn.com/pix/Cats/12--x5-/12--x5-/cat_1200x50_02.jpg"),
      L(1200,50,"https://cdn.adblockcdn.com/pix/Cats/12--x5-/12--x5-/cat_1200x50_03.jpg"),
      L(1200,50,"https://cdn.adblockcdn.com/pix/Cats/12--x5-/12--x5-/cat_1200x50_04.jpg"),
      L(1200,50,"https://cdn.adblockcdn.com/pix/Cats/12--x5-/12--x5-/cat_1200x50_05.jpg"),
      L(1200,50,"https://cdn.adblockcdn.com/pix/Cats/12--x5-/12--x5-/-1.jpg"),
      L(1200,50,"https://cdn.adblockcdn.com/pix/Cats/12--x5-/12--x5-/-2.jpg"),
      L(1200,50,"https://cdn.adblockcdn.com/pix/Cats/12--x5-/12--x5-/-3.jpg"),
      L(1200,50,"https://cdn.adblockcdn.com/pix/Cats/12--x5-/12--x5-/cat_12--x5-_-3.jpg"),
      L(1200,50,"https://cdn.adblockcdn.com/pix/Cats/12--x5-/12--x5-/cat_12--x5-_-5.jpg"),
      L(2400,100,"https://cdn.adblockcdn.com/pix/Cats/12--x5-/24--x1--/cat_2400x100_01.jpg"),
      L(2400,100,"https://cdn.adblockcdn.com/pix/Cats/12--x5-/24--x1--/cat_2400x100_02.jpg"),
      L(2400,100,"https://cdn.adblockcdn.com/pix/Cats/12--x5-/24--x1--/cat_2400x100_03.jpg"),
      L(2400,100,"https://cdn.adblockcdn.com/pix/Cats/12--x5-/24--x1--/cat_2400x100_04.jpg"),
      L(2400,100,"https://cdn.adblockcdn.com/pix/Cats/12--x5-/24--x1--/cat_2400x100_05.jpg"),
      L(2400,100,"https://cdn.adblockcdn.com/pix/Cats/12--x5-/24--x1--/-1.jpg"),
      L(2400,100,"https://cdn.adblockcdn.com/pix/Cats/12--x5-/24--x1--/-2.jpg"),
      L(2400,100,"https://cdn.adblockcdn.com/pix/Cats/12--x5-/24--x1--/cat_24--x1--_-2.jpg"),
      L(2400,100,"https://cdn.adblockcdn.com/pix/Cats/12--x5-/24--x1--/cat_24--x1--_-4.jpg"),
      L(1090,43,"https://cdn.adblockcdn.com/pix/Cats/1-9-x43/1-9-x43/ad_1090x43_01.jpg"),
      L(1090,43,"https://cdn.adblockcdn.com/pix/Cats/1-9-x43/1-9-x43/ad_1090x43_02.jpg"),
      L(1090,43,"https://cdn.adblockcdn.com/pix/Cats/1-9-x43/1-9-x43/ad_1090x43_03.jpg"),
      L(1090,43,"https://cdn.adblockcdn.com/pix/Cats/1-9-x43/1-9-x43/ad_1090x43_04.jpg"),
      L(1090,43,"https://cdn.adblockcdn.com/pix/Cats/1-9-x43/1-9-x43/ad_1090x43_05.jpg"),
      L(1090,43,"https://cdn.adblockcdn.com/pix/Cats/1-9-x43/1-9-x43/-3.jpg"),
      L(1090,43,"https://cdn.adblockcdn.com/pix/Cats/1-9-x43/1-9-x43/-4.jpg"),
      L(1090,43,"https://cdn.adblockcdn.com/pix/Cats/1-9-x43/1-9-x43/ad_1-9-x43_-5.jpg"),
      L(2180,86,"https://cdn.adblockcdn.com/pix/Cats/1-9-x43/218-x86/cat_2180x86_01.jpg"),
      L(2180,86,"https://cdn.adblockcdn.com/pix/Cats/1-9-x43/218-x86/cat_2180x86_02.jpg"),
      L(2180,86,"https://cdn.adblockcdn.com/pix/Cats/1-9-x43/218-x86/cat_2180x86_03.jpg"),
      L(2180,86,"https://cdn.adblockcdn.com/pix/Cats/1-9-x43/218-x86/cat_2180x86_04.jpg"),
      L(2180,86,"https://cdn.adblockcdn.com/pix/Cats/1-9-x43/218-x86/cat_2180x86_05.jpg"),
      L(2180,86,"https://cdn.adblockcdn.com/pix/Cats/1-9-x43/218-x86/-2.jpg"),
      L(2180,86,"https://cdn.adblockcdn.com/pix/Cats/1-9-x43/218-x86/-3.jpg"),
      L(2180,86,"https://cdn.adblockcdn.com/pix/Cats/1-9-x43/218-x86/-4.jpg"),
      L(2180,86,"https://cdn.adblockcdn.com/pix/Cats/1-9-x43/218-x86/-5.jpg"),
      L(2180,86,"https://cdn.adblockcdn.com/pix/Cats/1-9-x43/218-x86/cat_218-x86_-1.jpg"),
      L(2180,86,"https://cdn.adblockcdn.com/pix/Cats/1-9-x43/218-x86/cat_218-x86_-3.jpg"),
      L(450,62,"https://cdn.adblockcdn.com/pix/Cats/45-x62/45-x62/cat_450x62_01.jpg"),
      L(450,62,"https://cdn.adblockcdn.com/pix/Cats/45-x62/45-x62/cat_450x62_02.jpg"),
      L(450,62,"https://cdn.adblockcdn.com/pix/Cats/45-x62/45-x62/cat_450x62_03.jpg"),
      L(450,62,"https://cdn.adblockcdn.com/pix/Cats/45-x62/45-x62/cat_450x62_04.jpg"),
      L(450,62,"https://cdn.adblockcdn.com/pix/Cats/45-x62/45-x62/cat_450x62_05.jpg"),
      L(450,62,"https://cdn.adblockcdn.com/pix/Cats/45-x62/45-x62/-1.jpg"),
      L(450,62,"https://cdn.adblockcdn.com/pix/Cats/45-x62/45-x62/-2.jpg"),
      L(900,124,"https://cdn.adblockcdn.com/pix/Cats/45-x62/9--x124/cat_900x124_01.jpg"),
      L(900,124,"https://cdn.adblockcdn.com/pix/Cats/45-x62/9--x124/cat_900x124_02.jpg"),
      L(900,124,"https://cdn.adblockcdn.com/pix/Cats/45-x62/9--x124/cat_900x124_03.jpg"),
      L(900,124,"https://cdn.adblockcdn.com/pix/Cats/45-x62/9--x124/cat_900x124_04.jpg"),
      L(900,124,"https://cdn.adblockcdn.com/pix/Cats/45-x62/9--x124/cat_900x124_05.jpg"),
      L(900,124,"https://cdn.adblockcdn.com/pix/Cats/45-x62/9--x124/-1.jpg"),
      L(900,124,"https://cdn.adblockcdn.com/pix/Cats/45-x62/9--x124/-2.jpg"),
      L(900,124,"https://cdn.adblockcdn.com/pix/Cats/45-x62/9--x124/-3.jpg"),
      L(900,124,"https://cdn.adblockcdn.com/pix/Cats/45-x62/9--x124/-4.jpg"),
      L(900,124,"https://cdn.adblockcdn.com/pix/Cats/45-x62/9--x124/-5.jpg"),
      L(900,124,"https://cdn.adblockcdn.com/pix/Cats/45-x62/9--x124/cat_9--x124_-1.jpg"),
      L(900,124,"https://cdn.adblockcdn.com/pix/Cats/45-x62/9--x124/cat_9--x124_-2.jpg"),
      L(900,124,"https://cdn.adblockcdn.com/pix/Cats/45-x62/9--x124/cat_9--x124_-3.jpg"),
      L(900,124,"https://cdn.adblockcdn.com/pix/Cats/45-x62/9--x124/cat_9--x124_-4.jpg"),
      L(900,124,"https://cdn.adblockcdn.com/pix/Cats/45-x62/9--x124/cat_9--x124_-5.jpg"),
      L(1440,90,"https://cdn.adblockcdn.com/pix/Cats/144-x9-/1440x90/cat_1440x90_01.jpg"),
      L(1440,90,"https://cdn.adblockcdn.com/pix/Cats/144-x9-/1440x90/cat_1440x90_02.jpg"),
      L(1440,90,"https://cdn.adblockcdn.com/pix/Cats/144-x9-/1440x90/cat_1440x90_03.jpg"),
      L(1440,90,"https://cdn.adblockcdn.com/pix/Cats/144-x9-/1440x90/cat_1440x90_04.jpg"),
      L(1440,90,"https://cdn.adblockcdn.com/pix/Cats/144-x9-/1440x90/cat_1440x90_05.jpg"),
      L(2880,180,"https://cdn.adblockcdn.com/pix/Cats/144-x9-/2880x180/cat_2880x180_01.jpg"),
      L(2880,180,"https://cdn.adblockcdn.com/pix/Cats/144-x9-/2880x180/cat_2880x180_02.jpg"),
      L(2880,180,"https://cdn.adblockcdn.com/pix/Cats/144-x9-/2880x180/cat_2880x180_03.jpg"),
      L(2880,180,"https://cdn.adblockcdn.com/pix/Cats/144-x9-/2880x180/cat_2880x180_04.jpg"),
      L(2880,180,"https://cdn.adblockcdn.com/pix/Cats/144-x9-/2880x180/cat_2880x180_05.jpg"),
      L(1440,90,"https://cdn.adblockcdn.com/pix/Cats/144-x9-/144-x9-/-1.jpg"),
      L(1440,90,"https://cdn.adblockcdn.com/pix/Cats/144-x9-/144-x9-/-4.jpg"),
      L(1440,90,"https://cdn.adblockcdn.com/pix/Cats/144-x9-/144-x9-/-5.jpg"),
      L(1440,90,"https://cdn.adblockcdn.com/pix/Cats/144-x9-/144-x9-/cat_144-x9-_-1.jpg"),
      L(1440,90,"https://cdn.adblockcdn.com/pix/Cats/144-x9-/144-x9-/cat_144-x9-_-2.jpg"),
      L(1440,90,"https://cdn.adblockcdn.com/pix/Cats/144-x9-/144-x9-/cat_144-x9-_-3.jpg"),
      L(1440,90,"https://cdn.adblockcdn.com/pix/Cats/144-x9-/144-x9-/cat_144-x9-_-4.jpg"),
      L(1440,90,"https://cdn.adblockcdn.com/pix/Cats/144-x9-/144-x9-/cat_144-x9-_-5.jpg"),
      L(2880,180,"https://cdn.adblockcdn.com/pix/Cats/144-x9-/288-x18-/-1.jpg"),
      L(2880,180,"https://cdn.adblockcdn.com/pix/Cats/144-x9-/288-x18-/-2.jpg"),
      L(2880,180,"https://cdn.adblockcdn.com/pix/Cats/144-x9-/288-x18-/-3.jpg"),
      L(2880,180,"https://cdn.adblockcdn.com/pix/Cats/144-x9-/288-x18-/-4.jpg"),
      L(2880,180,"https://cdn.adblockcdn.com/pix/Cats/144-x9-/288-x18-/-5.jpg"),
      L(2880,180,"https://cdn.adblockcdn.com/pix/Cats/144-x9-/288-x18-/cat_288-x18-_-1.jpg"),
      L(2880,180,"https://cdn.adblockcdn.com/pix/Cats/144-x9-/288-x18-/cat_288-x18-_-2.jpg"),
      L(2880,180,"https://cdn.adblockcdn.com/pix/Cats/144-x9-/288-x18-/cat_288-x18-_-3.jpg"),
      L(2880,180,"https://cdn.adblockcdn.com/pix/Cats/144-x9-/288-x18-/cat_288-x18-_-4.jpg"),
      L(2880,180,"https://cdn.adblockcdn.com/pix/Cats/144-x9-/288-x18-/cat_288-x18-_-5.jpg"),
      L(1456,180,"https://cdn.adblockcdn.com/pix/Cats/728x9-/1456x18-/cat_1456x180_01.jpg"),
      L(1456,180,"https://cdn.adblockcdn.com/pix/Cats/728x9-/1456x18-/cat_1456x180_02.jpg"),
      L(1456,180,"https://cdn.adblockcdn.com/pix/Cats/728x9-/1456x18-/cat_1456x180_03.jpg"),
      L(1456,180,"https://cdn.adblockcdn.com/pix/Cats/728x9-/1456x18-/cat_1456x180_04.jpg"),
      L(1456,180,"https://cdn.adblockcdn.com/pix/Cats/728x9-/1456x18-/cat_1456x180_05.jpg"),
      L(1456,180,"https://cdn.adblockcdn.com/pix/Cats/728x9-/1456x18-/cat_1456x18-_01.jpg"),
      L(1456,180,"https://cdn.adblockcdn.com/pix/Cats/728x9-/1456x18-/cat_1456x18-_02.jpg"),
      L(1456,180,"https://cdn.adblockcdn.com/pix/Cats/728x9-/1456x18-/cat_1456x18-_03.jpg"),
      L(1456,180,"https://cdn.adblockcdn.com/pix/Cats/728x9-/1456x18-/cat_1456x18-_04.jpg"),
      L(1456,180,"https://cdn.adblockcdn.com/pix/Cats/728x9-/1456x18-/cat_1456x18-_05.jpg"),
      L(1456,180,"https://cdn.adblockcdn.com/pix/Cats/728x9-/1456x18-/cat_1456x18-_-3.jpg"),
      L(1456,180,"https://cdn.adblockcdn.com/pix/Cats/728x9-/1456x18-/cat_1456x18-_-4.jpg"),
      L(1456,180,"https://cdn.adblockcdn.com/pix/Cats/728x9-/1456x18-/cat_1456x18-_-6.jpg"),
      L(1456,180,"https://cdn.adblockcdn.com/pix/Cats/728x9-/1456x18-/cat_1456x18-_-7.jpg"),
      L(1456,180,"https://cdn.adblockcdn.com/pix/Cats/728x9-/1456x18-/cat_1456x18-_-8.jpg"),
      L(1456,180,"https://cdn.adblockcdn.com/pix/Cats/728x9-/1456x18-/cat_1456x18-_1-.jpg"),
      L(728,90,"https://cdn.adblockcdn.com/pix/Cats/728x9-/728x9-/cat_728x90_01.jpg"),
      L(728,90,"https://cdn.adblockcdn.com/pix/Cats/728x9-/728x9-/cat_728x90_02.jpg"),
      L(728,90,"https://cdn.adblockcdn.com/pix/Cats/728x9-/728x9-/cat_728x90_03.jpg"),
      L(728,90,"https://cdn.adblockcdn.com/pix/Cats/728x9-/728x9-/cat_728x90_04.jpg"),
      L(728,90,"https://cdn.adblockcdn.com/pix/Cats/728x9-/728x9-/cat_728x90_05.jpg"),
      L(728,90,"https://cdn.adblockcdn.com/pix/Cats/728x9-/728x9-/cat_728x9-_01.jpg"),
      L(728,90,"https://cdn.adblockcdn.com/pix/Cats/728x9-/728x9-/cat_728x9-_02.jpg"),
      L(728,90,"https://cdn.adblockcdn.com/pix/Cats/728x9-/728x9-/cat_728x9-_03.jpg"),
      L(728,90,"https://cdn.adblockcdn.com/pix/Cats/728x9-/728x9-/cat_728x9-_04.jpg"),
      L(728,90,"https://cdn.adblockcdn.com/pix/Cats/728x9-/728x9-/cat_728x9-_05.jpg"),
      L(728,90,"https://cdn.adblockcdn.com/pix/Cats/728x9-/728x9-/cat_728x9-_-4.jpg"),
      L(728,90,"https://cdn.adblockcdn.com/pix/Cats/728x9-/728x9-/cat_728x9-_-1.jpg"),
      L(340,90,"https://cdn.adblockcdn.com/pix/Cats/34-x9-/34-x9-/Cats_34-x9-_01.jpg"),
      L(340,90,"https://cdn.adblockcdn.com/pix/Cats/34-x9-/34-x9-/Cats_34-x9-_02.jpg"),
      L(340,90,"https://cdn.adblockcdn.com/pix/Cats/34-x9-/34-x9-/Cats_34-x9-_03.jpg"),
      L(340,90,"https://cdn.adblockcdn.com/pix/Cats/34-x9-/34-x9-/Cats_34-x9-_04.jpg"),
      L(340,90,"https://cdn.adblockcdn.com/pix/Cats/34-x9-/34-x9-/Cats_34-x9-_05.jpg"),
      L(680,180,"https://cdn.adblockcdn.com/pix/Cats/34-x9-/68-x18-/Cats_68-x18-_01.jpg"),
      L(680,180,"https://cdn.adblockcdn.com/pix/Cats/34-x9-/68-x18-/Cats_68-x18-_02.jpg"),
      L(680,180,"https://cdn.adblockcdn.com/pix/Cats/34-x9-/68-x18-/Cats_68-x18-_03.jpg"),
      L(680,180,"https://cdn.adblockcdn.com/pix/Cats/34-x9-/68-x18-/Cats_68-x18-_04.jpg"),
      L(680,180,"https://cdn.adblockcdn.com/pix/Cats/34-x9-/68-x18-/Cats_68-x18-_05.jpg"),
      L(680,180,"https://cdn.adblockcdn.com/pix/Cats/34-x9-/68-x18-/Cats_68-x18-_-1.jpg"),
      L(680,180,"https://cdn.adblockcdn.com/pix/Cats/34-x9-/68-x18-/Cats_68-x18-_-2.jpg"),
      L(680,180,"https://cdn.adblockcdn.com/pix/Cats/34-x9-/68-x18-/Cats_68-x18-_-4.jpg"),
      L(680,180,"https://cdn.adblockcdn.com/pix/Cats/34-x9-/68-x18-/Cats_68-x18-_-5.jpg"),
      L(680,180,"https://cdn.adblockcdn.com/pix/Cats/34-x9-/68-x18-/Cats_68-x18-_-9.jpg"),
      L(680,180,"https://cdn.adblockcdn.com/pix/Cats/34-x9-/68-x18-/Cats_68-x18-_1-.jpg"),
      L(680,180,"https://cdn.adblockcdn.com/pix/Cats/34-x9-/68-x18-/Cats_68-x18-_11.jpg"),
      L(320,1200,"https://cdn.adblockcdn.com/pix/Cats/16-x6--/32-x12--/cat-kitten-rozkosne-little.jpg"),
      L(320,1200,"https://cdn.adblockcdn.com/pix/Cats/16-x6--/32-x12--/cat-7784.jpg"),
      L(1120,1344,"https://cdn.adblockcdn.com/pix/Cats/56-x672/112-x1344/pexels-photo-437886.jpg"),
      L(1120,1344,"https://cdn.adblockcdn.com/pix/Cats/56-x672/112-x1344/pexels-photo-2-8845.jpg"),
      L(1120,1344,"https://cdn.adblockcdn.com/pix/Cats/56-x672/112-x1344/pexels-photo-21--81.jpg"),
      L(1120,1344,"https://cdn.adblockcdn.com/pix/Cats/56-x672/112-x1344/pexels-photo-22-983.jpg"),
      L(560,672,"https://cdn.adblockcdn.com/pix/Cats/56-x672/56-x672/pexels-photo-22-97-.jpg"),
      L(560,672,"https://cdn.adblockcdn.com/pix/Cats/56-x672/56-x672/pexels-photo-416138.jpg"),
      L(560,672,"https://cdn.adblockcdn.com/pix/Cats/56-x672/56-x672/pexels-photo-59659-.jpg"),
      L(560,672,"https://cdn.adblockcdn.com/pix/Cats/56-x672/56-x672/pexels-photo-731553.jpg"),
      L(560,672,"https://cdn.adblockcdn.com/pix/Cats/56-x672/56-x672/pexels-photo-89951.jpg"),
      L(180,680,"https://cdn.adblockcdn.com/pix/Cats/18-x68-/18-x68-/cat-7784.jpg"),
      L(180,680,"https://cdn.adblockcdn.com/pix/Cats/18-x68-/18-x68-/cat-82-72.jpg"),
      L(180,680,"https://cdn.adblockcdn.com/pix/Cats/18-x68-/18-x68-/cat-feline-cute-domestic.jpg"),
      L(180,680,"https://cdn.adblockcdn.com/pix/Cats/18-x68-/18-x68-/domestic-cat-cat-adidas-relaxed.jpg"),
      L(180,680,"https://cdn.adblockcdn.com/pix/Cats/18-x68-/18-x68-/pexels-photo-1-5587.jpg"),
      L(180,680,"https://cdn.adblockcdn.com/pix/Cats/18-x68-/18-x68-/pexels-photo-1-6131.jpg"),
      L(180,680,"https://cdn.adblockcdn.com/pix/Cats/18-x68-/18-x68-/pexels-photo-142615.jpg"),
      L(180,680,"https://cdn.adblockcdn.com/pix/Cats/18-x68-/18-x68-/pexels-photo-17242-.jpg"),
      L(180,680,"https://cdn.adblockcdn.com/pix/Cats/18-x68-/18-x68-/pexels-photo-1739-9.jpg"),
      L(180,680,"https://cdn.adblockcdn.com/pix/Cats/18-x68-/18-x68-/pexels-photo-2-8845.jpg"),
      L(180,680,"https://cdn.adblockcdn.com/pix/Cats/18-x68-/18-x68-/pexels-photo-2-886-.jpg"),
      L(180,680,"https://cdn.adblockcdn.com/pix/Cats/18-x68-/18-x68-/pexels-photo-2-888-.jpg"),
      L(180,680,"https://cdn.adblockcdn.com/pix/Cats/18-x68-/18-x68-/pexels-photo-2-89-6.jpg"),
      L(180,680,"https://cdn.adblockcdn.com/pix/Cats/18-x68-/18-x68-/pexels-photo-2-89-7.jpg"),
      L(180,680,"https://cdn.adblockcdn.com/pix/Cats/18-x68-/18-x68-/pexels-photo-2-9117.jpg"),
      L(180,680,"https://cdn.adblockcdn.com/pix/Cats/18-x68-/18-x68-/pexels-photo-2-98--.jpg"),
      L(180,680,"https://cdn.adblockcdn.com/pix/Cats/18-x68-/18-x68-/pexels-photo-22-826.jpg"),
      L(180,680,"https://cdn.adblockcdn.com/pix/Cats/18-x68-/18-x68-/pexels-photo-22-876.jpg"),
      L(180,680,"https://cdn.adblockcdn.com/pix/Cats/18-x68-/18-x68-/pexels-photo-22-951.jpg"),
      L(180,680,"https://cdn.adblockcdn.com/pix/Cats/18-x68-/18-x68-/pexels-photo-22-983.jpg"),
      L(180,680,"https://cdn.adblockcdn.com/pix/Cats/18-x68-/18-x68-/pexels-photo-244848.jpg"),
      L(180,680,"https://cdn.adblockcdn.com/pix/Cats/18-x68-/18-x68-/pexels-photo-2483-4.jpg"),
      L(180,680,"https://cdn.adblockcdn.com/pix/Cats/18-x68-/18-x68-/pexels-photo-416138.jpg"),
      L(180,680,"https://cdn.adblockcdn.com/pix/Cats/18-x68-/18-x68-/pexels-photo-549237.jpg"),
      L(180,680,"https://cdn.adblockcdn.com/pix/Cats/18-x68-/18-x68-/pexels-photo-59659-.jpg"),
      L(180,680,"https://cdn.adblockcdn.com/pix/Cats/18-x68-/18-x68-/pexels-photo-599492.jpg"),
      L(180,680,"https://cdn.adblockcdn.com/pix/Cats/18-x68-/18-x68-/pexels-photo-6-5-48.jpg"),
      L(180,680,"https://cdn.adblockcdn.com/pix/Cats/18-x68-/18-x68-/pexels-photo-622549.jpg"),
      L(180,680,"https://cdn.adblockcdn.com/pix/Cats/18-x68-/18-x68-/pexels-photo-674568.jpg"),
      L(180,680,"https://cdn.adblockcdn.com/pix/Cats/18-x68-/18-x68-/pexels-photo-674577.jpg"),
      L(180,680,"https://cdn.adblockcdn.com/pix/Cats/18-x68-/18-x68-/pexels-photo-679855.jpg"),
      L(180,680,"https://cdn.adblockcdn.com/pix/Cats/18-x68-/18-x68-/pexels-photo-689-42.jpg"),
      L(180,680,"https://cdn.adblockcdn.com/pix/Cats/18-x68-/18-x68-/pexels-photo-7-9482.jpg"),
      L(180,680,"https://cdn.adblockcdn.com/pix/Cats/18-x68-/18-x68-/pexels-photo-7331-5.jpg"),
      L(180,680,"https://cdn.adblockcdn.com/pix/Cats/18-x68-/18-x68-/pexels-photo-736528.jpg"),
      L(180,680,"https://cdn.adblockcdn.com/pix/Cats/18-x68-/18-x68-/pexels-photo-745241.jpg"),
      L(180,680,"https://cdn.adblockcdn.com/pix/Cats/18-x68-/18-x68-/pexels-photo-749212.jpg"),
      L(360,1360,"https://cdn.adblockcdn.com/pix/Cats/18-x68-/36-x136-/cat-7784.jpg"),
      L(360,1360,"https://cdn.adblockcdn.com/pix/Cats/18-x68-/36-x136-/cat-82-72.jpg"),
      L(360,1360,"https://cdn.adblockcdn.com/pix/Cats/18-x68-/36-x136-/cat-feline-cute-domestic.jpg"),
      L(360,1360,"https://cdn.adblockcdn.com/pix/Cats/18-x68-/36-x136-/domestic-cat-cat-adidas-relaxed.jpg"),
      L(360,1360,"https://cdn.adblockcdn.com/pix/Cats/18-x68-/36-x136-/pexels-photo-1-5587.jpg"),
      L(360,1360,"https://cdn.adblockcdn.com/pix/Cats/18-x68-/36-x136-/pexels-photo-1-6131.jpg"),
      L(360,1360,"https://cdn.adblockcdn.com/pix/Cats/18-x68-/36-x136-/pexels-photo-142615.jpg"),
      L(360,1360,"https://cdn.adblockcdn.com/pix/Cats/18-x68-/36-x136-/pexels-photo-17242-.jpg"),
      L(360,1360,"https://cdn.adblockcdn.com/pix/Cats/18-x68-/36-x136-/pexels-photo-1739-9.jpg"),
      L(360,1360,"https://cdn.adblockcdn.com/pix/Cats/18-x68-/36-x136-/pexels-photo-2-8845.jpg"),
      L(360,1360,"https://cdn.adblockcdn.com/pix/Cats/18-x68-/36-x136-/pexels-photo-2-886-.jpg"),
      L(360,1360,"https://cdn.adblockcdn.com/pix/Cats/18-x68-/36-x136-/pexels-photo-2-888-.jpg"),
      L(360,1360,"https://cdn.adblockcdn.com/pix/Cats/18-x68-/36-x136-/pexels-photo-2-89-6.jpg"),
      L(360,1360,"https://cdn.adblockcdn.com/pix/Cats/18-x68-/36-x136-/pexels-photo-2-89-7.jpg"),
      L(360,1360,"https://cdn.adblockcdn.com/pix/Cats/18-x68-/36-x136-/pexels-photo-2-9117.jpg"),
      L(360,1360,"https://cdn.adblockcdn.com/pix/Cats/18-x68-/36-x136-/pexels-photo-2-98--.jpg"),
      L(360,1360,"https://cdn.adblockcdn.com/pix/Cats/18-x68-/36-x136-/pexels-photo-22-826.jpg"),
      L(360,1360,"https://cdn.adblockcdn.com/pix/Cats/18-x68-/36-x136-/pexels-photo-22-876.jpg"),
      L(360,1360,"https://cdn.adblockcdn.com/pix/Cats/18-x68-/36-x136-/pexels-photo-22-951.jpg"),
      L(360,1360,"https://cdn.adblockcdn.com/pix/Cats/18-x68-/36-x136-/pexels-photo-22-983.jpg"),
      L(360,1360,"https://cdn.adblockcdn.com/pix/Cats/18-x68-/36-x136-/pexels-photo-244848.jpg"),
      L(360,1360,"https://cdn.adblockcdn.com/pix/Cats/18-x68-/36-x136-/pexels-photo-2483-4.jpg"),
      L(360,1360,"https://cdn.adblockcdn.com/pix/Cats/18-x68-/36-x136-/pexels-photo-416138.jpg"),
      L(360,1360,"https://cdn.adblockcdn.com/pix/Cats/18-x68-/36-x136-/pexels-photo-549237.jpg"),
      L(360,1360,"https://cdn.adblockcdn.com/pix/Cats/18-x68-/36-x136-/pexels-photo-59659-.jpg"),
      L(360,1360,"https://cdn.adblockcdn.com/pix/Cats/18-x68-/36-x136-/pexels-photo-599492.jpg"),
      L(360,1360,"https://cdn.adblockcdn.com/pix/Cats/18-x68-/36-x136-/pexels-photo-6-5-48.jpg"),
      L(360,1360,"https://cdn.adblockcdn.com/pix/Cats/18-x68-/36-x136-/pexels-photo-622549.jpg"),
      L(360,1360,"https://cdn.adblockcdn.com/pix/Cats/18-x68-/36-x136-/pexels-photo-674568.jpg"),
      L(360,1360,"https://cdn.adblockcdn.com/pix/Cats/18-x68-/36-x136-/pexels-photo-674577.jpg"),
      L(360,1360,"https://cdn.adblockcdn.com/pix/Cats/18-x68-/36-x136-/pexels-photo-679855.jpg"),
      L(360,1360,"https://cdn.adblockcdn.com/pix/Cats/18-x68-/36-x136-/pexels-photo-689-42.jpg"),
      L(360,1360,"https://cdn.adblockcdn.com/pix/Cats/18-x68-/36-x136-/pexels-photo-7-9482.jpg"),
      L(360,1360,"https://cdn.adblockcdn.com/pix/Cats/18-x68-/36-x136-/pexels-photo-7331-5.jpg"),
      L(360,1360,"https://cdn.adblockcdn.com/pix/Cats/18-x68-/36-x136-/pexels-photo-736528.jpg"),
      L(360,1360,"https://cdn.adblockcdn.com/pix/Cats/18-x68-/36-x136-/pexels-photo-745241.jpg"),
      L(360,1360,"https://cdn.adblockcdn.com/pix/Cats/18-x68-/36-x136-/pexels-photo-749212.jpg"),
    ]);
  }
};

Object.assign(window, {
  CatsChannel
});

/***/ }),
/* 60 */
/***/ (function(module, exports) {

// Channel containing hard coded dogs loaded from CDN
// Subclass of Channel.
function DogsChannel() {
  Channel.call(this);
};
DogsChannel.prototype = {
  __proto__: Channel.prototype,

  _getLatestListings: function(callback) {
    var that = this;
    function L(w, h, u) {
      var type = that._calculateType(w, h);
      if (typeof w === "number") {
        w = "" + w + "";
      }
      if (typeof h === "number") {
        h = "" + h + "";
      }
      return new Listing({
        width: w,
        height: h,
        url: u,
        attribution_url: u,
        type: type,
        ratio: Math.max(w, h) / Math.min(w, h),
        title: "This is a dog!"
      });
    }
    // the listings never change
    callback([
      L(1200,628,"https://cdn.adblockcdn.com/pix/Dogs/12--x628/12--x628/animal-dog-golden-retriever-9716.jpg"),
      L(1200,628,"https://cdn.adblockcdn.com/pix/Dogs/12--x628/12--x628/animal-dog-pet-brown.jpg"),
      L(1200,628,"https://cdn.adblockcdn.com/pix/Dogs/12--x628/12--x628/bordeaux-mastiff-dog-animal.jpg"),
      L(1200,628,"https://cdn.adblockcdn.com/pix/Dogs/12--x628/12--x628/dalmatians-dog-animal-head.jpg"),
      L(1200,628,"https://cdn.adblockcdn.com/pix/Dogs/12--x628/12--x628/dog-brown-snout-fur.jpg"),
      L(1200,628,"https://cdn.adblockcdn.com/pix/Dogs/12--x628/12--x628/dog-cute-pet.jpg"),
      L(1200,628,"https://cdn.adblockcdn.com/pix/Dogs/12--x628/12--x628/dog-young-dog-small-dog-maltese.jpg"),
      L(1200,628,"https://cdn.adblockcdn.com/pix/Dogs/12--x628/12--x628/nature-animal-dog-pet.jpg"),
      L(1200,628,"https://cdn.adblockcdn.com/pix/Dogs/12--x628/12--x628/night-animal-dog-pet.jpg"),
      L(1200,628,"https://cdn.adblockcdn.com/pix/Dogs/12--x628/12--x628/night-garden-yellow-animal.jpg"),
      L(1200,628,"https://cdn.adblockcdn.com/pix/Dogs/12--x628/12--x628/wall-animal-dog-pet.jpg"),
      L(2400,1256,"https://cdn.adblockcdn.com/pix/Dogs/12--x628/24--x1256/animal-dog-golden-retriever-9716.jpg"),
      L(2400,1256,"https://cdn.adblockcdn.com/pix/Dogs/12--x628/24--x1256/animal-dog-pet-brown.jpg"),
      L(2400,1256,"https://cdn.adblockcdn.com/pix/Dogs/12--x628/24--x1256/bordeaux-mastiff-dog-animal.jpg"),
      L(2400,1256,"https://cdn.adblockcdn.com/pix/Dogs/12--x628/24--x1256/dalmatians-dog-animal-head.jpg"),
      L(2400,1256,"https://cdn.adblockcdn.com/pix/Dogs/12--x628/24--x1256/dog-brown-snout-fur.jpg"),
      L(2400,1256,"https://cdn.adblockcdn.com/pix/Dogs/12--x628/24--x1256/dog-cute-pet.jpg"),
      L(2400,1256,"https://cdn.adblockcdn.com/pix/Dogs/12--x628/24--x1256/dog-young-dog-small-dog-maltese.jpg"),
      L(2400,1256,"https://cdn.adblockcdn.com/pix/Dogs/12--x628/24--x1256/nature-animal-dog-pet.jpg"),
      L(2400,1256,"https://cdn.adblockcdn.com/pix/Dogs/12--x628/24--x1256/night-animal-dog-pet.jpg"),
      L(2400,1256,"https://cdn.adblockcdn.com/pix/Dogs/12--x628/24--x1256/night-garden-yellow-animal.jpg"),
      L(2400,1256,"https://cdn.adblockcdn.com/pix/Dogs/12--x628/24--x1256/wall-animal-dog-pet.jpg"),
      L(300,250,"https://cdn.adblockcdn.com/pix/Dogs/3--x25-/3--x25-/animal-dog-golden-retriever-9716.jpg"),
      L(300,250,"https://cdn.adblockcdn.com/pix/Dogs/3--x25-/3--x25-/animal-dog-pet-brown.jpg"),
      L(300,250,"https://cdn.adblockcdn.com/pix/Dogs/3--x25-/3--x25-/bordeaux-mastiff-dog-animal.jpg"),
      L(300,250,"https://cdn.adblockcdn.com/pix/Dogs/3--x25-/3--x25-/dalmatians-dog-animal-head.jpg"),
      L(300,250,"https://cdn.adblockcdn.com/pix/Dogs/3--x25-/3--x25-/dog-brown-snout-fur.jpg"),
      L(300,250,"https://cdn.adblockcdn.com/pix/Dogs/3--x25-/3--x25-/dog-cute-pet.jpg"),
      L(300,250,"https://cdn.adblockcdn.com/pix/Dogs/3--x25-/3--x25-/dog-young-dog-small-dog-maltese.jpg"),
      L(300,250,"https://cdn.adblockcdn.com/pix/Dogs/3--x25-/3--x25-/nature-animal-dog-pet.jpg"),
      L(300,250,"https://cdn.adblockcdn.com/pix/Dogs/3--x25-/3--x25-/night-animal-dog-pet.jpg"),
      L(300,250,"https://cdn.adblockcdn.com/pix/Dogs/3--x25-/3--x25-/night-garden-yellow-animal.jpg"),
      L(300,250,"https://cdn.adblockcdn.com/pix/Dogs/3--x25-/3--x25-/wall-animal-dog-pet.jpg"),
      L(600,500,"https://cdn.adblockcdn.com/pix/Dogs/3--x25-/6--x5--/animal-dog-golden-retriever-9716.jpg"),
      L(600,500,"https://cdn.adblockcdn.com/pix/Dogs/3--x25-/6--x5--/animal-dog-pet-brown.jpg"),
      L(600,500,"https://cdn.adblockcdn.com/pix/Dogs/3--x25-/6--x5--/bordeaux-mastiff-dog-animal.jpg"),
      L(600,500,"https://cdn.adblockcdn.com/pix/Dogs/3--x25-/6--x5--/dalmatians-dog-animal-head.jpg"),
      L(600,500,"https://cdn.adblockcdn.com/pix/Dogs/3--x25-/6--x5--/dog-brown-snout-fur.jpg"),
      L(600,500,"https://cdn.adblockcdn.com/pix/Dogs/3--x25-/6--x5--/dog-cute-pet.jpg"),
      L(600,500,"https://cdn.adblockcdn.com/pix/Dogs/3--x25-/6--x5--/dog-young-dog-small-dog-maltese.jpg"),
      L(600,500,"https://cdn.adblockcdn.com/pix/Dogs/3--x25-/6--x5--/nature-animal-dog-pet.jpg"),
      L(600,500,"https://cdn.adblockcdn.com/pix/Dogs/3--x25-/6--x5--/night-animal-dog-pet.jpg"),
      L(600,500,"https://cdn.adblockcdn.com/pix/Dogs/3--x25-/6--x5--/night-garden-yellow-animal.jpg"),
      L(600,500,"https://cdn.adblockcdn.com/pix/Dogs/3--x25-/6--x5--/wall-animal-dog-pet.jpg"),
      L(300,600,"https://cdn.adblockcdn.com/pix/Dogs/3--x6--/3--x6--/animal-dog-golden-retriever-9716.jpg"),
      L(300,600,"https://cdn.adblockcdn.com/pix/Dogs/3--x6--/3--x6--/animal-dog-pet-brown.jpg"),
      L(300,600,"https://cdn.adblockcdn.com/pix/Dogs/3--x6--/3--x6--/bordeaux-mastiff-dog-animal.jpg"),
      L(300,600,"https://cdn.adblockcdn.com/pix/Dogs/3--x6--/3--x6--/dalmatians-dog-animal-head.jpg"),
      L(300,600,"https://cdn.adblockcdn.com/pix/Dogs/3--x6--/3--x6--/dog-brown-snout-fur.jpg"),
      L(300,600,"https://cdn.adblockcdn.com/pix/Dogs/3--x6--/3--x6--/dog-cute-pet.jpg"),
      L(300,600,"https://cdn.adblockcdn.com/pix/Dogs/3--x6--/3--x6--/dog-young-dog-small-dog-maltese.jpg"),
      L(300,600,"https://cdn.adblockcdn.com/pix/Dogs/3--x6--/3--x6--/nature-animal-dog-pet.jpg"),
      L(300,600,"https://cdn.adblockcdn.com/pix/Dogs/3--x6--/3--x6--/night-animal-dog-pet.jpg"),
      L(300,600,"https://cdn.adblockcdn.com/pix/Dogs/3--x6--/3--x6--/night-garden-yellow-animal.jpg"),
      L(300,600,"https://cdn.adblockcdn.com/pix/Dogs/3--x6--/3--x6--/wall-animal-dog-pet.jpg"),
      L(600,1200,"https://cdn.adblockcdn.com/pix/Dogs/3--x6--/6--x12--/animal-dog-golden-retriever-9716.jpg"),
      L(600,1200,"https://cdn.adblockcdn.com/pix/Dogs/3--x6--/6--x12--/animal-dog-pet-brown.jpg"),
      L(600,1200,"https://cdn.adblockcdn.com/pix/Dogs/3--x6--/6--x12--/bordeaux-mastiff-dog-animal.jpg"),
      L(600,1200,"https://cdn.adblockcdn.com/pix/Dogs/3--x6--/6--x12--/dalmatians-dog-animal-head.jpg"),
      L(600,1200,"https://cdn.adblockcdn.com/pix/Dogs/3--x6--/6--x12--/dog-brown-snout-fur.jpg"),
      L(600,1200,"https://cdn.adblockcdn.com/pix/Dogs/3--x6--/6--x12--/dog-cute-pet.jpg"),
      L(600,1200,"https://cdn.adblockcdn.com/pix/Dogs/3--x6--/6--x12--/dog-young-dog-small-dog-maltese.jpg"),
      L(600,1200,"https://cdn.adblockcdn.com/pix/Dogs/3--x6--/6--x12--/nature-animal-dog-pet.jpg"),
      L(600,1200,"https://cdn.adblockcdn.com/pix/Dogs/3--x6--/6--x12--/night-animal-dog-pet.jpg"),
      L(600,1200,"https://cdn.adblockcdn.com/pix/Dogs/3--x6--/6--x12--/night-garden-yellow-animal.jpg"),
      L(600,1200,"https://cdn.adblockcdn.com/pix/Dogs/3--x6--/6--x12--/wall-animal-dog-pet.jpg"),
      L(336,280,"https://cdn.adblockcdn.com/pix/Dogs/336x28-/336x28-/animal-dog-golden-retriever-9716.jpg"),
      L(336,280,"https://cdn.adblockcdn.com/pix/Dogs/336x28-/336x28-/animal-dog-pet-brown.jpg"),
      L(336,280,"https://cdn.adblockcdn.com/pix/Dogs/336x28-/336x28-/bordeaux-mastiff-dog-animal.jpg"),
      L(336,280,"https://cdn.adblockcdn.com/pix/Dogs/336x28-/336x28-/dalmatians-dog-animal-head.jpg"),
      L(336,280,"https://cdn.adblockcdn.com/pix/Dogs/336x28-/336x28-/dog-brown-snout-fur.jpg"),
      L(336,280,"https://cdn.adblockcdn.com/pix/Dogs/336x28-/336x28-/dog-cute-pet.jpg"),
      L(336,280,"https://cdn.adblockcdn.com/pix/Dogs/336x28-/336x28-/dog-young-dog-small-dog-maltese.jpg"),
      L(336,280,"https://cdn.adblockcdn.com/pix/Dogs/336x28-/336x28-/nature-animal-dog-pet.jpg"),
      L(336,280,"https://cdn.adblockcdn.com/pix/Dogs/336x28-/336x28-/night-animal-dog-pet.jpg"),
      L(336,280,"https://cdn.adblockcdn.com/pix/Dogs/336x28-/336x28-/night-garden-yellow-animal.jpg"),
      L(336,280,"https://cdn.adblockcdn.com/pix/Dogs/336x28-/336x28-/wall-animal-dog-pet.jpg"),
      L(672,560,"https://cdn.adblockcdn.com/pix/Dogs/336x28-/672x56-/animal-dog-golden-retriever-9716.jpg"),
      L(672,560,"https://cdn.adblockcdn.com/pix/Dogs/336x28-/672x56-/animal-dog-pet-brown.jpg"),
      L(672,560,"https://cdn.adblockcdn.com/pix/Dogs/336x28-/672x56-/bordeaux-mastiff-dog-animal.jpg"),
      L(672,560,"https://cdn.adblockcdn.com/pix/Dogs/336x28-/672x56-/dalmatians-dog-animal-head.jpg"),
      L(672,560,"https://cdn.adblockcdn.com/pix/Dogs/336x28-/672x56-/dog-brown-snout-fur.jpg"),
      L(672,560,"https://cdn.adblockcdn.com/pix/Dogs/336x28-/672x56-/dog-cute-pet.jpg"),
      L(672,560,"https://cdn.adblockcdn.com/pix/Dogs/336x28-/672x56-/dog-young-dog-small-dog-maltese.jpg"),
      L(672,560,"https://cdn.adblockcdn.com/pix/Dogs/336x28-/672x56-/nature-animal-dog-pet.jpg"),
      L(672,560,"https://cdn.adblockcdn.com/pix/Dogs/336x28-/672x56-/night-animal-dog-pet.jpg"),
      L(672,560,"https://cdn.adblockcdn.com/pix/Dogs/336x28-/672x56-/night-garden-yellow-animal.jpg"),
      L(672,560,"https://cdn.adblockcdn.com/pix/Dogs/336x28-/672x56-/wall-animal-dog-pet.jpg"),
      L(468,60,"https://cdn.adblockcdn.com/pix/Dogs/468x6-/468x6-/dog_468x6-_01.jpg"),
      L(468,60,"https://cdn.adblockcdn.com/pix/Dogs/468x6-/468x6-/dog_468x6-_02.jpg"),
      L(468,60,"https://cdn.adblockcdn.com/pix/Dogs/468x6-/468x6-/dog_468x6-_03.jpg"),
      L(468,60,"https://cdn.adblockcdn.com/pix/Dogs/468x6-/468x6-/dog_468x6-_04.jpg"),
      L(468,60,"https://cdn.adblockcdn.com/pix/Dogs/468x6-/468x6-/dog_468x6-_05.jpg"),
      L(468,60,"https://cdn.adblockcdn.com/pix/Dogs/468x6-/468x6-/-3.jpg"),
      L(468,60,"https://cdn.adblockcdn.com/pix/Dogs/468x6-/468x6-/-4.jpg"),
      L(468,60,"https://cdn.adblockcdn.com/pix/Dogs/468x6-/468x6-/dog_468x6-_-2.jpg"),
      L(468,60,"https://cdn.adblockcdn.com/pix/Dogs/468x6-/468x6-/dog_468x6-_-4.jpg"),
      L(936,120,"https://cdn.adblockcdn.com/pix/Dogs/468x6-/936x12-/dog_936x120_01.jpg"),
      L(936,120,"https://cdn.adblockcdn.com/pix/Dogs/468x6-/936x12-/dog_936x120_02.jpg"),
      L(936,120,"https://cdn.adblockcdn.com/pix/Dogs/468x6-/936x12-/dog_936x120_03.jpg"),
      L(936,120,"https://cdn.adblockcdn.com/pix/Dogs/468x6-/936x12-/dog_936x120_04.jpg"),
      L(936,120,"https://cdn.adblockcdn.com/pix/Dogs/468x6-/936x12-/dog_936x120_05.jpg"),
      L(936,120,"https://cdn.adblockcdn.com/pix/Dogs/468x6-/936x12-/-1.jpg"),
      L(936,120,"https://cdn.adblockcdn.com/pix/Dogs/468x6-/936x12-/-2.jpg"),
      L(936,120,"https://cdn.adblockcdn.com/pix/Dogs/468x6-/936x12-/-3.jpg"),
      L(936,120,"https://cdn.adblockcdn.com/pix/Dogs/468x6-/936x12-/-4.jpg"),
      L(936,120,"https://cdn.adblockcdn.com/pix/Dogs/468x6-/936x12-/-5.jpg"),
      L(936,120,"https://cdn.adblockcdn.com/pix/Dogs/468x6-/936x12-/dog_936x12-_-1.jpg"),
      L(936,120,"https://cdn.adblockcdn.com/pix/Dogs/468x6-/936x12-/dog_936x12-_-2.jpg"),
      L(936,120,"https://cdn.adblockcdn.com/pix/Dogs/468x6-/936x12-/dog_936x12-_-4.jpg"),
      L(936,120,"https://cdn.adblockcdn.com/pix/Dogs/468x6-/936x12-/dog_936x12-_-5.jpg"),
      L(450,62,"https://cdn.adblockcdn.com/pix/Dogs/45-x62/45-x62/dog_450x62_01.jpg"),
      L(450,62,"https://cdn.adblockcdn.com/pix/Dogs/45-x62/45-x62/dog_450x62_02.jpg"),
      L(450,62,"https://cdn.adblockcdn.com/pix/Dogs/45-x62/45-x62/dog_450x62_03.jpg"),
      L(450,62,"https://cdn.adblockcdn.com/pix/Dogs/45-x62/45-x62/dog_450x62_04.jpg"),
      L(450,62,"https://cdn.adblockcdn.com/pix/Dogs/45-x62/45-x62/dog_450x62_05.jpg"),
      L(450,62,"https://cdn.adblockcdn.com/pix/Dogs/45-x62/45-x62/-4.jpg"),
      L(450,62,"https://cdn.adblockcdn.com/pix/Dogs/45-x62/45-x62/-5.jpg"),
      L(450,62,"https://cdn.adblockcdn.com/pix/Dogs/45-x62/45-x62/dog_45-x62_-1.jpg"),
      L(900,124,"https://cdn.adblockcdn.com/pix/Dogs/45-x62/9--x124/dog_900x124_01.jpg"),
      L(900,124,"https://cdn.adblockcdn.com/pix/Dogs/45-x62/9--x124/dog_900x124_02.jpg"),
      L(900,124,"https://cdn.adblockcdn.com/pix/Dogs/45-x62/9--x124/dog_900x124_03.jpg"),
      L(900,124,"https://cdn.adblockcdn.com/pix/Dogs/45-x62/9--x124/dog_900x124_04.jpg"),
      L(900,124,"https://cdn.adblockcdn.com/pix/Dogs/45-x62/9--x124/dog_900x124_05.jpg"),
      L(900,124,"https://cdn.adblockcdn.com/pix/Dogs/45-x62/9--x124/-1.jpg"),
      L(900,124,"https://cdn.adblockcdn.com/pix/Dogs/45-x62/9--x124/-3.jpg"),
      L(900,124,"https://cdn.adblockcdn.com/pix/Dogs/45-x62/9--x124/-4.jpg"),
      L(900,124,"https://cdn.adblockcdn.com/pix/Dogs/45-x62/9--x124/-5.jpg"),
      L(900,124,"https://cdn.adblockcdn.com/pix/Dogs/45-x62/9--x124/dog_9--x124_-1.jpg"),
      L(900,124,"https://cdn.adblockcdn.com/pix/Dogs/45-x62/9--x124/dog_9--x124_-2.jpg"),
      L(900,124,"https://cdn.adblockcdn.com/pix/Dogs/45-x62/9--x124/dog_9--x124_-3.jpg"),
      L(900,124,"https://cdn.adblockcdn.com/pix/Dogs/45-x62/9--x124/dog_9--x124_-4.jpg"),
      L(900,124,"https://cdn.adblockcdn.com/pix/Dogs/45-x62/9--x124/dog_9--x124_-5.jpg"),
      L(1090,43,"https://cdn.adblockcdn.com/pix/Dogs/1-9-x43/1-9-x43/dog_1090x43_01.jpg"),
      L(1090,43,"https://cdn.adblockcdn.com/pix/Dogs/1-9-x43/1-9-x43/dog_1090x43_02.jpg"),
      L(1090,43,"https://cdn.adblockcdn.com/pix/Dogs/1-9-x43/1-9-x43/dog_1090x43_03.jpg"),
      L(1090,43,"https://cdn.adblockcdn.com/pix/Dogs/1-9-x43/1-9-x43/dog_1090x43_04.jpg"),
      L(1090,43,"https://cdn.adblockcdn.com/pix/Dogs/1-9-x43/1-9-x43/dog_1090x43_05.jpg"),
      L(1090,43,"https://cdn.adblockcdn.com/pix/Dogs/1-9-x43/1-9-x43/-2.jpg"),
      L(1090,43,"https://cdn.adblockcdn.com/pix/Dogs/1-9-x43/1-9-x43/-3.jpg"),
      L(1090,43,"https://cdn.adblockcdn.com/pix/Dogs/1-9-x43/1-9-x43/dog_1-9-x43_-1.jpg"),
      L(1090,43,"https://cdn.adblockcdn.com/pix/Dogs/1-9-x43/1-9-x43/dog_1-9-x43_-2.jpg"),
      L(1090,43,"https://cdn.adblockcdn.com/pix/Dogs/1-9-x43/1-9-x43/dog_1-9-x43_-3.jpg"),
      L(2180,86,"https://cdn.adblockcdn.com/pix/Dogs/1-9-x43/218-x86/dog_2180x86_01.jpg"),
      L(2180,86,"https://cdn.adblockcdn.com/pix/Dogs/1-9-x43/218-x86/dog_2180x86_02.jpg"),
      L(2180,86,"https://cdn.adblockcdn.com/pix/Dogs/1-9-x43/218-x86/dog_2180x86_03.jpg"),
      L(2180,86,"https://cdn.adblockcdn.com/pix/Dogs/1-9-x43/218-x86/dog_2180x86_04.jpg"),
      L(2180,86,"https://cdn.adblockcdn.com/pix/Dogs/1-9-x43/218-x86/dog_2180x86_05.jpg"),
      L(2180,86,"https://cdn.adblockcdn.com/pix/Dogs/1-9-x43/218-x86/-1.jpg"),
      L(2180,86,"https://cdn.adblockcdn.com/pix/Dogs/1-9-x43/218-x86/-2.jpg"),
      L(2180,86,"https://cdn.adblockcdn.com/pix/Dogs/1-9-x43/218-x86/-3.jpg"),
      L(2180,86,"https://cdn.adblockcdn.com/pix/Dogs/1-9-x43/218-x86/-5.jpg"),
      L(2180,86,"https://cdn.adblockcdn.com/pix/Dogs/1-9-x43/218-x86/dog_218-x86_-2.jpg"),
      L(2180,86,"https://cdn.adblockcdn.com/pix/Dogs/1-9-x43/218-x86/dog_218-x86_-3.jpg"),
      L(2180,86,"https://cdn.adblockcdn.com/pix/Dogs/1-9-x43/218-x86/dog_218-x86_-4.jpg"),
      L(1200,50,"https://cdn.adblockcdn.com/pix/Dogs/12--x5-/12--x5-/dog_1200x50_01.jpg"),
      L(1200,50,"https://cdn.adblockcdn.com/pix/Dogs/12--x5-/12--x5-/dog_1200x50_02.jpg"),
      L(1200,50,"https://cdn.adblockcdn.com/pix/Dogs/12--x5-/12--x5-/dog_1200x50_03.jpg"),
      L(1200,50,"https://cdn.adblockcdn.com/pix/Dogs/12--x5-/12--x5-/dog_1200x50_04.jpg"),
      L(1200,50,"https://cdn.adblockcdn.com/pix/Dogs/12--x5-/12--x5-/dog_1200x50_05.jpg"),
      L(1200,50,"https://cdn.adblockcdn.com/pix/Dogs/12--x5-/12--x5-/-2.jpg"),
      L(1200,50,"https://cdn.adblockcdn.com/pix/Dogs/12--x5-/12--x5-/dog_12--x5-_-2.jpg"),
      L(1200,50,"https://cdn.adblockcdn.com/pix/Dogs/12--x5-/12--x5-/dog_12--x5-_-3.jpg"),
      L(2400,100,"https://cdn.adblockcdn.com/pix/Dogs/12--x5-/24--x1--/dog_2400x100_01.jpg"),
      L(2400,100,"https://cdn.adblockcdn.com/pix/Dogs/12--x5-/24--x1--/dog_2400x100_02.jpg"),
      L(2400,100,"https://cdn.adblockcdn.com/pix/Dogs/12--x5-/24--x1--/dog_2400x100_03.jpg"),
      L(2400,100,"https://cdn.adblockcdn.com/pix/Dogs/12--x5-/24--x1--/dog_2400x100_04.jpg"),
      L(2400,100,"https://cdn.adblockcdn.com/pix/Dogs/12--x5-/24--x1--/dog_2400x100_05.jpg"),
      L(2400,100,"https://cdn.adblockcdn.com/pix/Dogs/12--x5-/24--x1--/-3.jpg"),
      L(2400,100,"https://cdn.adblockcdn.com/pix/Dogs/12--x5-/24--x1--/-4.jpg"),
      L(2400,100,"https://cdn.adblockcdn.com/pix/Dogs/12--x5-/24--x1--/dog_24--x1--_-1.jpg"),
      L(2400,100,"https://cdn.adblockcdn.com/pix/Dogs/12--x5-/24--x1--/dog_24--x1--_-4.jpg"),
      L(1440,90,"https://cdn.adblockcdn.com/pix/Dogs/144-x9-/144-x9-/dog_1440x90_01.jpg"),
      L(1440,90,"https://cdn.adblockcdn.com/pix/Dogs/144-x9-/144-x9-/dog_1440x90_02.jpg"),
      L(1440,90,"https://cdn.adblockcdn.com/pix/Dogs/144-x9-/144-x9-/dog_1440x90_03.jpg"),
      L(1440,90,"https://cdn.adblockcdn.com/pix/Dogs/144-x9-/144-x9-/dog_1440x90_04.jpg"),
      L(1440,90,"https://cdn.adblockcdn.com/pix/Dogs/144-x9-/144-x9-/dog_1440x90_05.jpg"),
      L(1440,90,"https://cdn.adblockcdn.com/pix/Dogs/144-x9-/144-x9-/-5.jpg"),
      L(1440,90,"https://cdn.adblockcdn.com/pix/Dogs/144-x9-/144-x9-/dog_144-x9-_-2.jpg"),
      L(2880,180,"https://cdn.adblockcdn.com/pix/Dogs/144-x9-/288-x18-/dog_2880x180_01.jpg"),
      L(2880,180,"https://cdn.adblockcdn.com/pix/Dogs/144-x9-/288-x18-/dog_2880x180_02.jpg"),
      L(2880,180,"https://cdn.adblockcdn.com/pix/Dogs/144-x9-/288-x18-/dog_2880x180_03.jpg"),
      L(2880,180,"https://cdn.adblockcdn.com/pix/Dogs/144-x9-/288-x18-/dog_2880x180_04.jpg"),
      L(2880,180,"https://cdn.adblockcdn.com/pix/Dogs/144-x9-/288-x18-/dog_2880x180_05.jpg"),
      L(2880,180,"https://cdn.adblockcdn.com/pix/Dogs/144-x9-/288-x18-/-2.jpg"),
      L(2880,180,"https://cdn.adblockcdn.com/pix/Dogs/144-x9-/288-x18-/dog_288-x18-_-5.jpg"),
      L(2880,180,"https://cdn.adblockcdn.com/pix/Dogs/144-x9-/288-x18-/-5.jpg"),
      L(1456,180,"https://cdn.adblockcdn.com/pix/Dogs/728x9-/1456x18-/Dog_1456x180_01.jpg"),
      L(1456,180,"https://cdn.adblockcdn.com/pix/Dogs/728x9-/1456x18-/Dog_1456x180_02.jpg"),
      L(1456,180,"https://cdn.adblockcdn.com/pix/Dogs/728x9-/1456x18-/Dog_1456x180_03.jpg"),
      L(1456,180,"https://cdn.adblockcdn.com/pix/Dogs/728x9-/1456x18-/Dog_1456x180_04.jpg"),
      L(1456,180,"https://cdn.adblockcdn.com/pix/Dogs/728x9-/1456x18-/Dog_1456x180_05.jpg"),
      L(1456,180,"https://cdn.adblockcdn.com/pix/Dogs/728x9-/1456x18-/Dog_1456x18-_01.jpg"),
      L(1456,180,"https://cdn.adblockcdn.com/pix/Dogs/728x9-/1456x18-/Dog_1456x18-_02.jpg"),
      L(1456,180,"https://cdn.adblockcdn.com/pix/Dogs/728x9-/1456x18-/Dog_1456x18-_03.jpg"),
      L(1456,180,"https://cdn.adblockcdn.com/pix/Dogs/728x9-/1456x18-/Dog_1456x18-_04.jpg"),
      L(1456,180,"https://cdn.adblockcdn.com/pix/Dogs/728x9-/1456x18-/Dog_1456x18-_05.jpg"),
      L(1456,180,"https://cdn.adblockcdn.com/pix/Dogs/728x9-/1456x18-/Dog_1456x18-_-1.jpg"),
      L(1456,180,"https://cdn.adblockcdn.com/pix/Dogs/728x9-/1456x18-/Dog_1456x18-_-2.jpg"),
      L(1456,180,"https://cdn.adblockcdn.com/pix/Dogs/728x9-/1456x18-/Dog_1456x18-_-3.jpg"),
      L(1456,180,"https://cdn.adblockcdn.com/pix/Dogs/728x9-/1456x18-/Dog_1456x18-_-4.jpg"),
      L(1456,180,"https://cdn.adblockcdn.com/pix/Dogs/728x9-/1456x18-/Dog_1456x18-_-5.jpg"),
      L(1456,180,"https://cdn.adblockcdn.com/pix/Dogs/728x9-/1456x18-/Dog_1456x18-_-6.jpg"),
      L(1456,180,"https://cdn.adblockcdn.com/pix/Dogs/728x9-/1456x18-/Dog_1456x18-_-7.jpg"),
      L(1456,180,"https://cdn.adblockcdn.com/pix/Dogs/728x9-/1456x18-/Dog_1456x18-_-8.jpg"),
      L(1456,180,"https://cdn.adblockcdn.com/pix/Dogs/728x9-/1456x18-/Dog_1456x18-_-9.jpg"),
      L(1456,180,"https://cdn.adblockcdn.com/pix/Dogs/728x9-/1456x18-/Dog_1456x18-_1-.jpg"),
      L(1456,180,"https://cdn.adblockcdn.com/pix/Dogs/728x9-/1456x18-/Dog_1456x18-_11.jpg"),
      L(728,90,"https://cdn.adblockcdn.com/pix/Dogs/728x9-/728x9-/Dog_728x90_01.jpg"),
      L(728,90,"https://cdn.adblockcdn.com/pix/Dogs/728x9-/728x9-/Dog_728x90_02.jpg"),
      L(728,90,"https://cdn.adblockcdn.com/pix/Dogs/728x9-/728x9-/Dog_728x90_03.jpg"),
      L(728,90,"https://cdn.adblockcdn.com/pix/Dogs/728x9-/728x9-/Dog_728x90_04.jpg"),
      L(728,90,"https://cdn.adblockcdn.com/pix/Dogs/728x9-/728x9-/Dog_728x90_05.jpg"),
      L(728,90,"https://cdn.adblockcdn.com/pix/Dogs/728x9-/728x9-/Dog_728x9-_01.jpg"),
      L(728,90,"https://cdn.adblockcdn.com/pix/Dogs/728x9-/728x9-/Dog_728x9-_02.jpg"),
      L(728,90,"https://cdn.adblockcdn.com/pix/Dogs/728x9-/728x9-/Dog_728x9-_03.jpg"),
      L(728,90,"https://cdn.adblockcdn.com/pix/Dogs/728x9-/728x9-/Dog_728x9-_04.jpg"),
      L(728,90,"https://cdn.adblockcdn.com/pix/Dogs/728x9-/728x9-/Dog_728x9-_05.jpg"),
      L(728,90,"https://cdn.adblockcdn.com/pix/Dogs/728x9-/728x9-/Dog_728x9-_-2.jpg"),
      L(728,90,"https://cdn.adblockcdn.com/pix/Dogs/728x9-/728x9-/Dog_728x9-_-4.jpg"),
      L(340,90,"https://cdn.adblockcdn.com/pix/Dogs/34-x9-/34-x9-/Dogs_34-x9-_01.jpg"),
      L(340,90,"https://cdn.adblockcdn.com/pix/Dogs/34-x9-/34-x9-/Dogs_34-x9-_02.jpg"),
      L(340,90,"https://cdn.adblockcdn.com/pix/Dogs/34-x9-/34-x9-/Dogs_34-x9-_03.jpg"),
      L(340,90,"https://cdn.adblockcdn.com/pix/Dogs/34-x9-/34-x9-/Dogs_34-x9-_04.jpg"),
      L(340,90,"https://cdn.adblockcdn.com/pix/Dogs/34-x9-/34-x9-/Dogs_34-x9-_05.jpg"),
      L(340,90,"https://cdn.adblockcdn.com/pix/Dogs/34-x9-/34-x9-/Dogs_34-x9-_-1.jpg"),
      L(340,90,"https://cdn.adblockcdn.com/pix/Dogs/34-x9-/34-x9-/Dogs_34-x9-_-3.jpg"),
      L(340,90,"https://cdn.adblockcdn.com/pix/Dogs/34-x9-/34-x9-/Dogs_34-x9-_-4.jpg"),
      L(340,90,"https://cdn.adblockcdn.com/pix/Dogs/34-x9-/34-x9-/Dogs_34-x9-_-8.jpg"),
      L(340,90,"https://cdn.adblockcdn.com/pix/Dogs/34-x9-/34-x9-/Dogs_34-x9-_-9.jpg"),
      L(340,90,"https://cdn.adblockcdn.com/pix/Dogs/34-x9-/34-x9-/Dogs_34-x9-_1-.jpg"),
      L(680,180,"https://cdn.adblockcdn.com/pix/Dogs/34-x9-/68-x18-/Dogs_68-x18-_01.jpg"),
      L(680,180,"https://cdn.adblockcdn.com/pix/Dogs/34-x9-/68-x18-/Dogs_68-x18-_02.jpg"),
      L(680,180,"https://cdn.adblockcdn.com/pix/Dogs/34-x9-/68-x18-/Dogs_68-x18-_03.jpg"),
      L(680,180,"https://cdn.adblockcdn.com/pix/Dogs/34-x9-/68-x18-/Dogs_68-x18-_04.jpg"),
      L(680,180,"https://cdn.adblockcdn.com/pix/Dogs/34-x9-/68-x18-/Dogs_68-x18-_05.jpg"),
      L(680,180,"https://cdn.adblockcdn.com/pix/Dogs/34-x9-/68-x18-/Dogs_68-x18-_-1.jpg"),
      L(680,180,"https://cdn.adblockcdn.com/pix/Dogs/34-x9-/68-x18-/Dogs_68-x18-_-2.jpg"),
      L(680,180,"https://cdn.adblockcdn.com/pix/Dogs/34-x9-/68-x18-/Dogs_68-x18-_-4.jpg"),
      L(680,180,"https://cdn.adblockcdn.com/pix/Dogs/34-x9-/68-x18-/Dogs_68-x18-_-5.jpg"),
      L(680,180,"https://cdn.adblockcdn.com/pix/Dogs/34-x9-/68-x18-/Dogs_68-x18-_-6.jpg"),
      L(680,180,"https://cdn.adblockcdn.com/pix/Dogs/34-x9-/68-x18-/Dogs_68-x18-_-7.jpg"),
      L(680,180,"https://cdn.adblockcdn.com/pix/Dogs/34-x9-/68-x18-/Dogs_68-x18-_-9.jpg"),
      L(680,180,"https://cdn.adblockcdn.com/pix/Dogs/34-x9-/68-x18-/Dogs_68-x18-_1-.jpg"),
      L(680,180,"https://cdn.adblockcdn.com/pix/Dogs/34-x9-/68-x18-/Dogs_68-x18-_11.jpg"),
      L(160,600,"https://cdn.adblockcdn.com/pix/Dogs/16-x6--/16-x6--/bordeaux-mastiff-dog-animal.jpg"),
      L(160,600,"https://cdn.adblockcdn.com/pix/Dogs/16-x6--/16-x6--/dog-cute-pet.jpg"),
      L(160,600,"https://cdn.adblockcdn.com/pix/Dogs/16-x6--/16-x6--/wall-animal-dog-pet.jpg"),
      L(320,1200,"https://cdn.adblockcdn.com/pix/Dogs/16-x6--/32-x12--/animal-dog-pet-brown.jpg"),
      L(320,1200,"https://cdn.adblockcdn.com/pix/Dogs/16-x6--/32-x12--/bordeaux-mastiff-dog-animal.jpg"),
      L(320,1200,"https://cdn.adblockcdn.com/pix/Dogs/16-x6--/32-x12--/dog-young-dog-small-dog-maltese.jpg"),
      L(320,1200,"https://cdn.adblockcdn.com/pix/Dogs/16-x6--/32-x12--/night-garden-yellow-animal.jpg"),
      L(560,672,"https://cdn.adblockcdn.com/pix/Dogs/56-x672/56-x672/pexels-photo-97863.jpg"),
      L(560,672,"https://cdn.adblockcdn.com/pix/Dogs/56-x672/56-x672/dog-animal-friend-pointer-16226-.jpg"),
      L(560,672,"https://cdn.adblockcdn.com/pix/Dogs/56-x672/56-x672/pexels-photo-594687.jpg"),
      L(1120,1344,"https://cdn.adblockcdn.com/pix/Dogs/56-x672/112-x1344/pexels-photo-113883.jpg"),
      L(1120,1344,"https://cdn.adblockcdn.com/pix/Dogs/56-x672/112-x1344/pexels-photo-434-9-.jpg"),
      L(1120,1344,"https://cdn.adblockcdn.com/pix/Dogs/56-x672/112-x1344/pexels-photo-46-186.jpg"),
      L(1120,1344,"https://cdn.adblockcdn.com/pix/Dogs/56-x672/112-x1344/pexels-photo-58997.jpg"),
      L(1200,628,"https://cdn.adblockcdn.com/pix/Dogs/12--x628/12--x628/pexels-photo-89249.png"),
      L(2400,1256,"https://cdn.adblockcdn.com/pix/Dogs/12--x628/24--x1256/pexels-photo-89249.png"),
      L(300,250,"https://cdn.adblockcdn.com/pix/Dogs/3--x25-/3--x25-/pexels-photo-89249.png"),
      L(600,500,"https://cdn.adblockcdn.com/pix/Dogs/3--x25-/6--x5--/pexels-photo-89249.png"),
      L(300,600,"https://cdn.adblockcdn.com/pix/Dogs/3--x6--/3--x6--/pexels-photo-89249.png"),
      L(600,1200,"https://cdn.adblockcdn.com/pix/Dogs/3--x6--/6--x12--/pexels-photo-89249.png"),
      L(336,280,"https://cdn.adblockcdn.com/pix/Dogs/336x28-/336x28-/pexels-photo-89249.png"),
      L(672,560,"https://cdn.adblockcdn.com/pix/Dogs/336x28-/672x56-/pexels-photo-89249.png"),
      L(160,600,"https://cdn.adblockcdn.com/pix/Dogs/16-x6--/16-x6--/pexels-photo-89249.png"),
      L(180,680,"https://cdn.adblockcdn.com/pix/Dogs/18-x68-/18-x68-/bordeaux-mastiff-dog-animal.jpg"),
      L(180,680,"https://cdn.adblockcdn.com/pix/Dogs/18-x68-/18-x68-/dalmatians-dog-animal-head.jpg"),
      L(180,680,"https://cdn.adblockcdn.com/pix/Dogs/18-x68-/18-x68-/dog-bernese-mountain-dog-berner-senner-dog-577-8.jpg"),
      L(180,680,"https://cdn.adblockcdn.com/pix/Dogs/18-x68-/18-x68-/dog-bulldog-white-tongue-4-986.jpg"),
      L(180,680,"https://cdn.adblockcdn.com/pix/Dogs/18-x68-/18-x68-/dog-cavalier-king-charles-spaniel-funny-pet-162193.jpg"),
      L(180,680,"https://cdn.adblockcdn.com/pix/Dogs/18-x68-/18-x68-/dog-hybrid-animal-lying-162349.jpg"),
      L(180,680,"https://cdn.adblockcdn.com/pix/Dogs/18-x68-/18-x68-/dog-young-dog-puppy-59965.jpg"),
      L(180,680,"https://cdn.adblockcdn.com/pix/Dogs/18-x68-/18-x68-/dog-young-dog-small-dog-maltese.jpg"),
      L(180,680,"https://cdn.adblockcdn.com/pix/Dogs/18-x68-/18-x68-/english-bulldog-bulldog-canine-dog-4-544.jpg"),
      L(180,680,"https://cdn.adblockcdn.com/pix/Dogs/18-x68-/18-x68-/french-bulldog-summer-smile-joy-16-846.jpg"),
      L(180,680,"https://cdn.adblockcdn.com/pix/Dogs/18-x68-/18-x68-/nature-animal-dog-pet.jpg"),
      L(180,680,"https://cdn.adblockcdn.com/pix/Dogs/18-x68-/18-x68-/papillon-dog-animal-59969.jpg"),
      L(180,680,"https://cdn.adblockcdn.com/pix/Dogs/18-x68-/18-x68-/pexels-photo-13-763.jpg"),
      L(180,680,"https://cdn.adblockcdn.com/pix/Dogs/18-x68-/18-x68-/pexels-photo-134392.jpg"),
      L(180,680,"https://cdn.adblockcdn.com/pix/Dogs/18-x68-/18-x68-/pexels-photo-164446.jpg"),
      L(180,680,"https://cdn.adblockcdn.com/pix/Dogs/18-x68-/18-x68-/pexels-photo-169524.jpg"),
      L(180,680,"https://cdn.adblockcdn.com/pix/Dogs/18-x68-/18-x68-/pexels-photo-2358-5.jpg"),
      L(180,680,"https://cdn.adblockcdn.com/pix/Dogs/18-x68-/18-x68-/pexels-photo-247997.jpg"),
      L(180,680,"https://cdn.adblockcdn.com/pix/Dogs/18-x68-/18-x68-/pexels-photo-25757-.jpg"),
      L(180,680,"https://cdn.adblockcdn.com/pix/Dogs/18-x68-/18-x68-/pexels-photo-257577.jpg"),
      L(180,680,"https://cdn.adblockcdn.com/pix/Dogs/18-x68-/18-x68-/pexels-photo-271824.jpg"),
      L(180,680,"https://cdn.adblockcdn.com/pix/Dogs/18-x68-/18-x68-/pexels-photo-356378.jpg"),
      L(180,680,"https://cdn.adblockcdn.com/pix/Dogs/18-x68-/18-x68-/pexels-photo-3749-8.jpg"),
      L(180,680,"https://cdn.adblockcdn.com/pix/Dogs/18-x68-/18-x68-/pexels-photo-412465.jpg"),
      L(180,680,"https://cdn.adblockcdn.com/pix/Dogs/18-x68-/18-x68-/pexels-photo-4162-4.jpg"),
      L(180,680,"https://cdn.adblockcdn.com/pix/Dogs/18-x68-/18-x68-/pexels-photo-452772.jpg"),
      L(180,680,"https://cdn.adblockcdn.com/pix/Dogs/18-x68-/18-x68-/pexels-photo-46-132.jpg"),
      L(180,680,"https://cdn.adblockcdn.com/pix/Dogs/18-x68-/18-x68-/pexels-photo-46-823.jpg"),
      L(180,680,"https://cdn.adblockcdn.com/pix/Dogs/18-x68-/18-x68-/pexels-photo-485294.jpg"),
      L(180,680,"https://cdn.adblockcdn.com/pix/Dogs/18-x68-/18-x68-/pexels-photo-532423.jpg"),
      L(180,680,"https://cdn.adblockcdn.com/pix/Dogs/18-x68-/18-x68-/pexels-photo-58997.jpg"),
      L(180,680,"https://cdn.adblockcdn.com/pix/Dogs/18-x68-/18-x68-/pexels-photo-594687.jpg"),
      L(180,680,"https://cdn.adblockcdn.com/pix/Dogs/18-x68-/18-x68-/pexels-photo-612813.jpg"),
      L(180,680,"https://cdn.adblockcdn.com/pix/Dogs/18-x68-/18-x68-/pexels-photo-61372.jpg"),
      L(180,680,"https://cdn.adblockcdn.com/pix/Dogs/18-x68-/18-x68-/pexels-photo-66687-.jpg"),
      L(180,680,"https://cdn.adblockcdn.com/pix/Dogs/18-x68-/18-x68-/pexels-photo-688694.jpg"),
      L(180,680,"https://cdn.adblockcdn.com/pix/Dogs/18-x68-/18-x68-/pexels-photo-71-927.jpg"),
      L(180,680,"https://cdn.adblockcdn.com/pix/Dogs/18-x68-/18-x68-/pexels-photo-72-678.jpg"),
      L(180,680,"https://cdn.adblockcdn.com/pix/Dogs/18-x68-/18-x68-/pexels-photo-752383.jpg"),
      L(180,680,"https://cdn.adblockcdn.com/pix/Dogs/18-x68-/18-x68-/pexels-photo-8--33-.jpg"),
      L(180,680,"https://cdn.adblockcdn.com/pix/Dogs/18-x68-/18-x68-/pexels-photo-9238-.jpg"),
      L(180,680,"https://cdn.adblockcdn.com/pix/Dogs/18-x68-/18-x68-/tibet-terrier-cute-pet-dog-162276.jpg"),
      L(180,680,"https://cdn.adblockcdn.com/pix/Dogs/18-x68-/18-x68-/wall-animal-dog-pet.jpg"),
      L(180,680,"https://cdn.adblockcdn.com/pix/Dogs/18-x68-/18-x68-/weimaraner-puppy-dog-snout-97-82.jpg"),
      L(180,680,"https://cdn.adblockcdn.com/pix/Dogs/18-x68-/18-x68-/wildlife-photography-pet-photography-dog-animal-159541.jpg"),
      L(180,680,"https://cdn.adblockcdn.com/pix/Dogs/18-x68-/18-x68-/wildlife-photography-pet-photography-dog-dog-runs-159492.jpg"),
      L(360,1360,"https://cdn.adblockcdn.com/pix/Dogs/18-x68-/36-x136-/bordeaux-mastiff-dog-animal.jpg"),
      L(360,1360,"https://cdn.adblockcdn.com/pix/Dogs/18-x68-/36-x136-/dalmatians-dog-animal-head.jpg"),
      L(360,1360,"https://cdn.adblockcdn.com/pix/Dogs/18-x68-/36-x136-/dog-bernese-mountain-dog-berner-senner-dog-577-8.jpg"),
      L(360,1360,"https://cdn.adblockcdn.com/pix/Dogs/18-x68-/36-x136-/dog-bulldog-white-tongue-4-986.jpg"),
      L(360,1360,"https://cdn.adblockcdn.com/pix/Dogs/18-x68-/36-x136-/dog-cavalier-king-charles-spaniel-funny-pet-162193.jpg"),
      L(360,1360,"https://cdn.adblockcdn.com/pix/Dogs/18-x68-/36-x136-/dog-hybrid-animal-lying-162349.jpg"),
      L(360,1360,"https://cdn.adblockcdn.com/pix/Dogs/18-x68-/36-x136-/dog-young-dog-puppy-59965.jpg"),
      L(360,1360,"https://cdn.adblockcdn.com/pix/Dogs/18-x68-/36-x136-/dog-young-dog-small-dog-maltese.jpg"),
      L(360,1360,"https://cdn.adblockcdn.com/pix/Dogs/18-x68-/36-x136-/english-bulldog-bulldog-canine-dog-4-544.jpg"),
      L(360,1360,"https://cdn.adblockcdn.com/pix/Dogs/18-x68-/36-x136-/french-bulldog-summer-smile-joy-16-846.jpg"),
      L(360,1360,"https://cdn.adblockcdn.com/pix/Dogs/18-x68-/36-x136-/nature-animal-dog-pet.jpg"),
      L(360,1360,"https://cdn.adblockcdn.com/pix/Dogs/18-x68-/36-x136-/papillon-dog-animal-59969.jpg"),
      L(360,1360,"https://cdn.adblockcdn.com/pix/Dogs/18-x68-/36-x136-/pexels-photo-13-763.jpg"),
      L(360,1360,"https://cdn.adblockcdn.com/pix/Dogs/18-x68-/36-x136-/pexels-photo-134392.jpg"),
      L(360,1360,"https://cdn.adblockcdn.com/pix/Dogs/18-x68-/36-x136-/pexels-photo-164446.jpg"),
      L(360,1360,"https://cdn.adblockcdn.com/pix/Dogs/18-x68-/36-x136-/pexels-photo-169524.jpg"),
      L(360,1360,"https://cdn.adblockcdn.com/pix/Dogs/18-x68-/36-x136-/pexels-photo-2358-5.jpg"),
      L(360,1360,"https://cdn.adblockcdn.com/pix/Dogs/18-x68-/36-x136-/pexels-photo-247997.jpg"),
      L(360,1360,"https://cdn.adblockcdn.com/pix/Dogs/18-x68-/36-x136-/pexels-photo-25757-.jpg"),
      L(360,1360,"https://cdn.adblockcdn.com/pix/Dogs/18-x68-/36-x136-/pexels-photo-257577.jpg"),
      L(360,1360,"https://cdn.adblockcdn.com/pix/Dogs/18-x68-/36-x136-/pexels-photo-271824.jpg"),
      L(360,1360,"https://cdn.adblockcdn.com/pix/Dogs/18-x68-/36-x136-/pexels-photo-356378.jpg"),
      L(360,1360,"https://cdn.adblockcdn.com/pix/Dogs/18-x68-/36-x136-/pexels-photo-3749-8.jpg"),
      L(360,1360,"https://cdn.adblockcdn.com/pix/Dogs/18-x68-/36-x136-/pexels-photo-412465.jpg"),
      L(360,1360,"https://cdn.adblockcdn.com/pix/Dogs/18-x68-/36-x136-/pexels-photo-4162-4.jpg"),
      L(360,1360,"https://cdn.adblockcdn.com/pix/Dogs/18-x68-/36-x136-/pexels-photo-452772.jpg"),
      L(360,1360,"https://cdn.adblockcdn.com/pix/Dogs/18-x68-/36-x136-/pexels-photo-46-132.jpg"),
      L(360,1360,"https://cdn.adblockcdn.com/pix/Dogs/18-x68-/36-x136-/pexels-photo-46-823.jpg"),
      L(360,1360,"https://cdn.adblockcdn.com/pix/Dogs/18-x68-/36-x136-/pexels-photo-485294.jpg"),
      L(360,1360,"https://cdn.adblockcdn.com/pix/Dogs/18-x68-/36-x136-/pexels-photo-532423.jpg"),
      L(360,1360,"https://cdn.adblockcdn.com/pix/Dogs/18-x68-/36-x136-/pexels-photo-58997.jpg"),
      L(360,1360,"https://cdn.adblockcdn.com/pix/Dogs/18-x68-/36-x136-/pexels-photo-594687.jpg"),
      L(360,1360,"https://cdn.adblockcdn.com/pix/Dogs/18-x68-/36-x136-/pexels-photo-612813.jpg"),
      L(360,1360,"https://cdn.adblockcdn.com/pix/Dogs/18-x68-/36-x136-/pexels-photo-61372.jpg"),
      L(360,1360,"https://cdn.adblockcdn.com/pix/Dogs/18-x68-/36-x136-/pexels-photo-66687-.jpg"),
      L(360,1360,"https://cdn.adblockcdn.com/pix/Dogs/18-x68-/36-x136-/pexels-photo-688694.jpg"),
      L(360,1360,"https://cdn.adblockcdn.com/pix/Dogs/18-x68-/36-x136-/pexels-photo-71-927.jpg"),
      L(360,1360,"https://cdn.adblockcdn.com/pix/Dogs/18-x68-/36-x136-/pexels-photo-72-678.jpg"),
      L(360,1360,"https://cdn.adblockcdn.com/pix/Dogs/18-x68-/36-x136-/pexels-photo-752383.jpg"),
      L(360,1360,"https://cdn.adblockcdn.com/pix/Dogs/18-x68-/36-x136-/pexels-photo-8--33-.jpg"),
      L(360,1360,"https://cdn.adblockcdn.com/pix/Dogs/18-x68-/36-x136-/pexels-photo-9238-.jpg"),
      L(360,1360,"https://cdn.adblockcdn.com/pix/Dogs/18-x68-/36-x136-/tibet-terrier-cute-pet-dog-162276.jpg"),
      L(360,1360,"https://cdn.adblockcdn.com/pix/Dogs/18-x68-/36-x136-/wall-animal-dog-pet.jpg"),
      L(360,1360,"https://cdn.adblockcdn.com/pix/Dogs/18-x68-/36-x136-/weimaraner-puppy-dog-snout-97-82.jpg"),
      L(360,1360,"https://cdn.adblockcdn.com/pix/Dogs/18-x68-/36-x136-/wildlife-photography-pet-photography-dog-animal-159541.jpg"),
      L(360,1360,"https://cdn.adblockcdn.com/pix/Dogs/18-x68-/36-x136-/wildlife-photography-pet-photography-dog-dog-runs-159492.jpg"),
    ]);
  }
};

Object.assign(window, {
  DogsChannel
});

/***/ }),
/* 61 */
/***/ (function(module, exports) {

// Channel containing hard coded Landscapes loaded from CDN.
// Subclass of Channel.
function LandscapesChannel() {
  Channel.call(this);
};
LandscapesChannel.prototype = {
  __proto__: Channel.prototype,

  _getLatestListings: function(callback) {
    var that = this;
    function L(w, h, u) {
      var type = that._calculateType(w, h);
      if (typeof w === "number") {
        w = "" + w + "";
      }
      if (typeof h === "number") {
        h = "" + h + "";
      }
      return new Listing({
        width: w,
        height: h,
        url: u,
        attribution_url: u,
        type: type,
        ratio: Math.max(w, h) / Math.min(w, h),
        title: "This is a landscape!"
      });
    }
    // the listings never change
    callback([
      L(1200,628,"https://cdn.adblockcdn.com/pix/Landscapes/12--x628/12--x628/amazing-animal-beautiful-beautifull.jpg"),
      L(1200,628,"https://cdn.adblockcdn.com/pix/Landscapes/12--x628/12--x628/amazing-beautiful-beauty-blue.jpg"),
      L(1200,628,"https://cdn.adblockcdn.com/pix/Landscapes/12--x628/12--x628/antelope-canyon-lower-canyon-arizona.jpg"),
      L(1200,628,"https://cdn.adblockcdn.com/pix/Landscapes/12--x628/12--x628/delicate-arch-night-stars-landscape.jpg"),
      L(1200,628,"https://cdn.adblockcdn.com/pix/Landscapes/12--x628/12--x628/italian-landscape-mountains-nature.jpg"),
      L(1200,628,"https://cdn.adblockcdn.com/pix/Landscapes/12--x628/12--x628/pexels-photo (1).jpg"),
      L(1200,628,"https://cdn.adblockcdn.com/pix/Landscapes/12--x628/12--x628/pexels-photo (2).jpg"),
      L(1200,628,"https://cdn.adblockcdn.com/pix/Landscapes/12--x628/12--x628/pexels-photo.jpg"),
      L(1200,628,"https://cdn.adblockcdn.com/pix/Landscapes/12--x628/12--x628/road-sun-rays-path.jpg"),
      L(1200,628,"https://cdn.adblockcdn.com/pix/Landscapes/12--x628/12--x628/sunrise-phu-quoc-island-ocean.jpg"),
      L(1200,628,"https://cdn.adblockcdn.com/pix/Landscapes/12--x628/12--x628/sunset-field-poppy-sun-priroda.jpg"),
      L(1200,628,"https://cdn.adblockcdn.com/pix/Landscapes/12--x628/12--x628/switzerland-zermatt-mountains-snow.jpg"),
      L(2400,1256,"https://cdn.adblockcdn.com/pix/Landscapes/12--x628/24--x1256/amazing-animal-beautiful-beautifull.jpg"),
      L(2400,1256,"https://cdn.adblockcdn.com/pix/Landscapes/12--x628/24--x1256/amazing-beautiful-beauty-blue.jpg"),
      L(2400,1256,"https://cdn.adblockcdn.com/pix/Landscapes/12--x628/24--x1256/antelope-canyon-lower-canyon-arizona.jpg"),
      L(2400,1256,"https://cdn.adblockcdn.com/pix/Landscapes/12--x628/24--x1256/delicate-arch-night-stars-landscape.jpg"),
      L(2400,1256,"https://cdn.adblockcdn.com/pix/Landscapes/12--x628/24--x1256/italian-landscape-mountains-nature.jpg"),
      L(2400,1256,"https://cdn.adblockcdn.com/pix/Landscapes/12--x628/24--x1256/pexels-photo (1).jpg"),
      L(2400,1256,"https://cdn.adblockcdn.com/pix/Landscapes/12--x628/24--x1256/pexels-photo (2).jpg"),
      L(2400,1256,"https://cdn.adblockcdn.com/pix/Landscapes/12--x628/24--x1256/pexels-photo.jpg"),
      L(2400,1256,"https://cdn.adblockcdn.com/pix/Landscapes/12--x628/24--x1256/road-sun-rays-path.jpg"),
      L(2400,1256,"https://cdn.adblockcdn.com/pix/Landscapes/12--x628/24--x1256/sunrise-phu-quoc-island-ocean.jpg"),
      L(2400,1256,"https://cdn.adblockcdn.com/pix/Landscapes/12--x628/24--x1256/sunset-field-poppy-sun-priroda.jpg"),
      L(2400,1256,"https://cdn.adblockcdn.com/pix/Landscapes/12--x628/24--x1256/switzerland-zermatt-mountains-snow.jpg"),
      L(300,250,"https://cdn.adblockcdn.com/pix/Landscapes/3--x25-/3--x25-/amazing-animal-beautiful-beautifull.jpg"),
      L(300,250,"https://cdn.adblockcdn.com/pix/Landscapes/3--x25-/3--x25-/amazing-beautiful-beauty-blue.jpg"),
      L(300,250,"https://cdn.adblockcdn.com/pix/Landscapes/3--x25-/3--x25-/antelope-canyon-lower-canyon-arizona.jpg"),
      L(300,250,"https://cdn.adblockcdn.com/pix/Landscapes/3--x25-/3--x25-/delicate-arch-night-stars-landscape.jpg"),
      L(300,250,"https://cdn.adblockcdn.com/pix/Landscapes/3--x25-/3--x25-/italian-landscape-mountains-nature.jpg"),
      L(300,250,"https://cdn.adblockcdn.com/pix/Landscapes/3--x25-/3--x25-/pexels-photo (1).jpg"),
      L(300,250,"https://cdn.adblockcdn.com/pix/Landscapes/3--x25-/3--x25-/pexels-photo (2).jpg"),
      L(300,250,"https://cdn.adblockcdn.com/pix/Landscapes/3--x25-/3--x25-/pexels-photo.jpg"),
      L(300,250,"https://cdn.adblockcdn.com/pix/Landscapes/3--x25-/3--x25-/road-sun-rays-path.jpg"),
      L(300,250,"https://cdn.adblockcdn.com/pix/Landscapes/3--x25-/3--x25-/sunrise-phu-quoc-island-ocean.jpg"),
      L(300,250,"https://cdn.adblockcdn.com/pix/Landscapes/3--x25-/3--x25-/sunset-field-poppy-sun-priroda.jpg"),
      L(300,250,"https://cdn.adblockcdn.com/pix/Landscapes/3--x25-/3--x25-/switzerland-zermatt-mountains-snow.jpg"),
      L(600,500,"https://cdn.adblockcdn.com/pix/Landscapes/3--x25-/6--x5--/amazing-animal-beautiful-beautifull.jpg"),
      L(600,500,"https://cdn.adblockcdn.com/pix/Landscapes/3--x25-/6--x5--/amazing-beautiful-beauty-blue.jpg"),
      L(600,500,"https://cdn.adblockcdn.com/pix/Landscapes/3--x25-/6--x5--/antelope-canyon-lower-canyon-arizona.jpg"),
      L(600,500,"https://cdn.adblockcdn.com/pix/Landscapes/3--x25-/6--x5--/delicate-arch-night-stars-landscape.jpg"),
      L(600,500,"https://cdn.adblockcdn.com/pix/Landscapes/3--x25-/6--x5--/italian-landscape-mountains-nature.jpg"),
      L(600,500,"https://cdn.adblockcdn.com/pix/Landscapes/3--x25-/6--x5--/pexels-photo (1).jpg"),
      L(600,500,"https://cdn.adblockcdn.com/pix/Landscapes/3--x25-/6--x5--/pexels-photo (2).jpg"),
      L(600,500,"https://cdn.adblockcdn.com/pix/Landscapes/3--x25-/6--x5--/pexels-photo.jpg"),
      L(600,500,"https://cdn.adblockcdn.com/pix/Landscapes/3--x25-/6--x5--/road-sun-rays-path.jpg"),
      L(600,500,"https://cdn.adblockcdn.com/pix/Landscapes/3--x25-/6--x5--/sunrise-phu-quoc-island-ocean.jpg"),
      L(600,500,"https://cdn.adblockcdn.com/pix/Landscapes/3--x25-/6--x5--/sunset-field-poppy-sun-priroda.jpg"),
      L(600,500,"https://cdn.adblockcdn.com/pix/Landscapes/3--x25-/6--x5--/switzerland-zermatt-mountains-snow.jpg"),
      L(300,600,"https://cdn.adblockcdn.com/pix/Landscapes/3--x6--/3--x6--/amazing-animal-beautiful-beautifull.jpg"),
      L(300,600,"https://cdn.adblockcdn.com/pix/Landscapes/3--x6--/3--x6--/amazing-beautiful-beauty-blue.jpg"),
      L(300,600,"https://cdn.adblockcdn.com/pix/Landscapes/3--x6--/3--x6--/antelope-canyon-lower-canyon-arizona.jpg"),
      L(300,600,"https://cdn.adblockcdn.com/pix/Landscapes/3--x6--/3--x6--/delicate-arch-night-stars-landscape.jpg"),
      L(300,600,"https://cdn.adblockcdn.com/pix/Landscapes/3--x6--/3--x6--/italian-landscape-mountains-nature.jpg"),
      L(300,600,"https://cdn.adblockcdn.com/pix/Landscapes/3--x6--/3--x6--/pexels-photo (1).jpg"),
      L(300,600,"https://cdn.adblockcdn.com/pix/Landscapes/3--x6--/3--x6--/pexels-photo (2).jpg"),
      L(300,600,"https://cdn.adblockcdn.com/pix/Landscapes/3--x6--/3--x6--/pexels-photo.jpg"),
      L(300,600,"https://cdn.adblockcdn.com/pix/Landscapes/3--x6--/3--x6--/road-sun-rays-path.jpg"),
      L(300,600,"https://cdn.adblockcdn.com/pix/Landscapes/3--x6--/3--x6--/sunrise-phu-quoc-island-ocean.jpg"),
      L(300,600,"https://cdn.adblockcdn.com/pix/Landscapes/3--x6--/3--x6--/sunset-field-poppy-sun-priroda.jpg"),
      L(300,600,"https://cdn.adblockcdn.com/pix/Landscapes/3--x6--/3--x6--/switzerland-zermatt-mountains-snow.jpg"),
      L(600,1200,"https://cdn.adblockcdn.com/pix/Landscapes/3--x6--/6--x12--/amazing-animal-beautiful-beautifull.jpg"),
      L(600,1200,"https://cdn.adblockcdn.com/pix/Landscapes/3--x6--/6--x12--/amazing-beautiful-beauty-blue.jpg"),
      L(600,1200,"https://cdn.adblockcdn.com/pix/Landscapes/3--x6--/6--x12--/antelope-canyon-lower-canyon-arizona.jpg"),
      L(600,1200,"https://cdn.adblockcdn.com/pix/Landscapes/3--x6--/6--x12--/delicate-arch-night-stars-landscape.jpg"),
      L(600,1200,"https://cdn.adblockcdn.com/pix/Landscapes/3--x6--/6--x12--/italian-landscape-mountains-nature.jpg"),
      L(600,1200,"https://cdn.adblockcdn.com/pix/Landscapes/3--x6--/6--x12--/pexels-photo (1).jpg"),
      L(600,1200,"https://cdn.adblockcdn.com/pix/Landscapes/3--x6--/6--x12--/pexels-photo (2).jpg"),
      L(600,1200,"https://cdn.adblockcdn.com/pix/Landscapes/3--x6--/6--x12--/pexels-photo.jpg"),
      L(600,1200,"https://cdn.adblockcdn.com/pix/Landscapes/3--x6--/6--x12--/road-sun-rays-path.jpg"),
      L(600,1200,"https://cdn.adblockcdn.com/pix/Landscapes/3--x6--/6--x12--/sunrise-phu-quoc-island-ocean.jpg"),
      L(600,1200,"https://cdn.adblockcdn.com/pix/Landscapes/3--x6--/6--x12--/sunset-field-poppy-sun-priroda.jpg"),
      L(600,1200,"https://cdn.adblockcdn.com/pix/Landscapes/3--x6--/6--x12--/switzerland-zermatt-mountains-snow.jpg"),
      L(336,280,"https://cdn.adblockcdn.com/pix/Landscapes/336x28-/336x28-/amazing-animal-beautiful-beautifull.jpg"),
      L(336,280,"https://cdn.adblockcdn.com/pix/Landscapes/336x28-/336x28-/amazing-beautiful-beauty-blue.jpg"),
      L(336,280,"https://cdn.adblockcdn.com/pix/Landscapes/336x28-/336x28-/antelope-canyon-lower-canyon-arizona.jpg"),
      L(336,280,"https://cdn.adblockcdn.com/pix/Landscapes/336x28-/336x28-/delicate-arch-night-stars-landscape.jpg"),
      L(336,280,"https://cdn.adblockcdn.com/pix/Landscapes/336x28-/336x28-/italian-landscape-mountains-nature.jpg"),
      L(336,280,"https://cdn.adblockcdn.com/pix/Landscapes/336x28-/336x28-/pexels-photo (1).jpg"),
      L(336,280,"https://cdn.adblockcdn.com/pix/Landscapes/336x28-/336x28-/pexels-photo (2).jpg"),
      L(336,280,"https://cdn.adblockcdn.com/pix/Landscapes/336x28-/336x28-/pexels-photo.jpg"),
      L(336,280,"https://cdn.adblockcdn.com/pix/Landscapes/336x28-/336x28-/road-sun-rays-path.jpg"),
      L(336,280,"https://cdn.adblockcdn.com/pix/Landscapes/336x28-/336x28-/sunrise-phu-quoc-island-ocean.jpg"),
      L(336,280,"https://cdn.adblockcdn.com/pix/Landscapes/336x28-/336x28-/sunset-field-poppy-sun-priroda.jpg"),
      L(336,280,"https://cdn.adblockcdn.com/pix/Landscapes/336x28-/336x28-/switzerland-zermatt-mountains-snow.jpg"),
      L(672,560,"https://cdn.adblockcdn.com/pix/Landscapes/336x28-/672x56-/amazing-animal-beautiful-beautifull.jpg"),
      L(672,560,"https://cdn.adblockcdn.com/pix/Landscapes/336x28-/672x56-/amazing-beautiful-beauty-blue.jpg"),
      L(672,560,"https://cdn.adblockcdn.com/pix/Landscapes/336x28-/672x56-/antelope-canyon-lower-canyon-arizona.jpg"),
      L(672,560,"https://cdn.adblockcdn.com/pix/Landscapes/336x28-/672x56-/delicate-arch-night-stars-landscape.jpg"),
      L(672,560,"https://cdn.adblockcdn.com/pix/Landscapes/336x28-/672x56-/italian-landscape-mountains-nature.jpg"),
      L(672,560,"https://cdn.adblockcdn.com/pix/Landscapes/336x28-/672x56-/pexels-photo (1).jpg"),
      L(672,560,"https://cdn.adblockcdn.com/pix/Landscapes/336x28-/672x56-/pexels-photo (2).jpg"),
      L(672,560,"https://cdn.adblockcdn.com/pix/Landscapes/336x28-/672x56-/pexels-photo.jpg"),
      L(672,560,"https://cdn.adblockcdn.com/pix/Landscapes/336x28-/672x56-/road-sun-rays-path.jpg"),
      L(672,560,"https://cdn.adblockcdn.com/pix/Landscapes/336x28-/672x56-/sunrise-phu-quoc-island-ocean.jpg"),
      L(672,560,"https://cdn.adblockcdn.com/pix/Landscapes/336x28-/672x56-/sunset-field-poppy-sun-priroda.jpg"),
      L(672,560,"https://cdn.adblockcdn.com/pix/Landscapes/336x28-/672x56-/switzerland-zermatt-mountains-snow.jpg"),
      L(1090,43,"https://cdn.adblockcdn.com/pix/Landscapes/1-9-x43/1-9-x43/landscape_1090x43_01.jpg"),
      L(1090,43,"https://cdn.adblockcdn.com/pix/Landscapes/1-9-x43/1-9-x43/landscape_1090x43_02.jpg"),
      L(1090,43,"https://cdn.adblockcdn.com/pix/Landscapes/1-9-x43/1-9-x43/landscape_1090x43_03.jpg"),
      L(1090,43,"https://cdn.adblockcdn.com/pix/Landscapes/1-9-x43/1-9-x43/landscape_1090x43_04.jpg"),
      L(1090,43,"https://cdn.adblockcdn.com/pix/Landscapes/1-9-x43/1-9-x43/landscape_1090x43_05.jpg"),
      L(1090,43,"https://cdn.adblockcdn.com/pix/Landscapes/1-9-x43/1-9-x43/-2.jpg"),
      L(1090,43,"https://cdn.adblockcdn.com/pix/Landscapes/1-9-x43/1-9-x43/landscape_1-9-x43_-2.jpg"),
      L(2180,86,"https://cdn.adblockcdn.com/pix/Landscapes/1-9-x43/218-x86/landscape_2180x86_01.jpg"),
      L(2180,86,"https://cdn.adblockcdn.com/pix/Landscapes/1-9-x43/218-x86/landscape_2180x86_02.jpg"),
      L(2180,86,"https://cdn.adblockcdn.com/pix/Landscapes/1-9-x43/218-x86/landscape_2180x86_03.jpg"),
      L(2180,86,"https://cdn.adblockcdn.com/pix/Landscapes/1-9-x43/218-x86/landscape_2180x86_04.jpg"),
      L(2180,86,"https://cdn.adblockcdn.com/pix/Landscapes/1-9-x43/218-x86/landscape_2180x86_05.jpg"),
      L(2180,86,"https://cdn.adblockcdn.com/pix/Landscapes/1-9-x43/218-x86/landscape_218-x86_-1.jpg"),
      L(2180,86,"https://cdn.adblockcdn.com/pix/Landscapes/1-9-x43/218-x86/landscape_218-x86_-4.jpg"),
      L(450,62,"https://cdn.adblockcdn.com/pix/Landscapes/45-x62/45-x62/landscape_450x62_01.jpg"),
      L(450,62,"https://cdn.adblockcdn.com/pix/Landscapes/45-x62/45-x62/landscape_450x62_02.jpg"),
      L(450,62,"https://cdn.adblockcdn.com/pix/Landscapes/45-x62/45-x62/landscape_450x62_03.jpg"),
      L(450,62,"https://cdn.adblockcdn.com/pix/Landscapes/45-x62/45-x62/landscape_450x62_04.jpg"),
      L(450,62,"https://cdn.adblockcdn.com/pix/Landscapes/45-x62/45-x62/landscape_450x62_05.jpg"),
      L(450,62,"https://cdn.adblockcdn.com/pix/Landscapes/45-x62/45-x62/-3.jpg"),
      L(450,62,"https://cdn.adblockcdn.com/pix/Landscapes/45-x62/45-x62/-4.jpg"),
      L(450,62,"https://cdn.adblockcdn.com/pix/Landscapes/45-x62/45-x62/-5.jpg"),
      L(450,62,"https://cdn.adblockcdn.com/pix/Landscapes/45-x62/45-x62/landscape_45-x62_-5.jpg"),
      L(900,124,"https://cdn.adblockcdn.com/pix/Landscapes/45-x62/9--x124/landscape_900x124_01.jpg"),
      L(900,124,"https://cdn.adblockcdn.com/pix/Landscapes/45-x62/9--x124/landscape_900x124_02.jpg"),
      L(900,124,"https://cdn.adblockcdn.com/pix/Landscapes/45-x62/9--x124/landscape_900x124_03.jpg"),
      L(900,124,"https://cdn.adblockcdn.com/pix/Landscapes/45-x62/9--x124/landscape_900x124_04.jpg"),
      L(900,124,"https://cdn.adblockcdn.com/pix/Landscapes/45-x62/9--x124/landscape_900x124_05.jpg"),
      L(900,124,"https://cdn.adblockcdn.com/pix/Landscapes/45-x62/9--x124/-1.jpg"),
      L(900,124,"https://cdn.adblockcdn.com/pix/Landscapes/45-x62/9--x124/-2.jpg"),
      L(900,124,"https://cdn.adblockcdn.com/pix/Landscapes/45-x62/9--x124/-3.jpg"),
      L(900,124,"https://cdn.adblockcdn.com/pix/Landscapes/45-x62/9--x124/-4.jpg"),
      L(900,124,"https://cdn.adblockcdn.com/pix/Landscapes/45-x62/9--x124/-5.jpg"),
      L(900,124,"https://cdn.adblockcdn.com/pix/Landscapes/45-x62/9--x124/landscape_9--x124_-2.jpg"),
      L(900,124,"https://cdn.adblockcdn.com/pix/Landscapes/45-x62/9--x124/landscape_9--x124_-3.jpg"),
      L(900,124,"https://cdn.adblockcdn.com/pix/Landscapes/45-x62/9--x124/landscape_9--x124_-4.jpg"),
      L(1440,90,"https://cdn.adblockcdn.com/pix/Landscapes/144-x9-/144-x9-/landscape_1440x90_01.jpg"),
      L(1440,90,"https://cdn.adblockcdn.com/pix/Landscapes/144-x9-/144-x9-/landscape_1440x90_02.jpg"),
      L(1440,90,"https://cdn.adblockcdn.com/pix/Landscapes/144-x9-/144-x9-/landscape_1440x90_03.jpg"),
      L(1440,90,"https://cdn.adblockcdn.com/pix/Landscapes/144-x9-/144-x9-/landscape_1440x90_04.jpg"),
      L(1440,90,"https://cdn.adblockcdn.com/pix/Landscapes/144-x9-/144-x9-/landscape_1440x90_05.jpg"),
      L(1440,90,"https://cdn.adblockcdn.com/pix/Landscapes/144-x9-/144-x9-/-1.jpg"),
      L(1440,90,"https://cdn.adblockcdn.com/pix/Landscapes/144-x9-/144-x9-/-2.jpg"),
      L(1440,90,"https://cdn.adblockcdn.com/pix/Landscapes/144-x9-/144-x9-/-3.jpg"),
      L(1440,90,"https://cdn.adblockcdn.com/pix/Landscapes/144-x9-/144-x9-/-5.jpg"),
      L(1440,90,"https://cdn.adblockcdn.com/pix/Landscapes/144-x9-/144-x9-/landscape_144-x9-_-1.jpg"),
      L(1440,90,"https://cdn.adblockcdn.com/pix/Landscapes/144-x9-/144-x9-/landscape_144-x9-_-3.jpg"),
      L(2880,180,"https://cdn.adblockcdn.com/pix/Landscapes/144-x9-/288-x18-/landscape_2880x180_01.jpg"),
      L(2880,180,"https://cdn.adblockcdn.com/pix/Landscapes/144-x9-/288-x18-/landscape_2880x180_02.jpg"),
      L(2880,180,"https://cdn.adblockcdn.com/pix/Landscapes/144-x9-/288-x18-/landscape_2880x180_03.jpg"),
      L(2880,180,"https://cdn.adblockcdn.com/pix/Landscapes/144-x9-/288-x18-/landscape_2880x180_04.jpg"),
      L(2880,180,"https://cdn.adblockcdn.com/pix/Landscapes/144-x9-/288-x18-/landscape_2880x180_05.jpg"),
      L(2880,180,"https://cdn.adblockcdn.com/pix/Landscapes/144-x9-/288-x18-/-3.jpg"),
      L(2880,180,"https://cdn.adblockcdn.com/pix/Landscapes/144-x9-/288-x18-/landscape_288-x18-_-2.jpg"),
      L(2880,180,"https://cdn.adblockcdn.com/pix/Landscapes/144-x9-/288-x18-/landscape_288-x18-_-5.jpg"),
      L(1200,50,"https://cdn.adblockcdn.com/pix/Landscapes/12--x5-/12--x5-/landscape_1200x50_01.jpg"),
      L(1200,50,"https://cdn.adblockcdn.com/pix/Landscapes/12--x5-/12--x5-/landscape_1200x50_02.jpg"),
      L(1200,50,"https://cdn.adblockcdn.com/pix/Landscapes/12--x5-/12--x5-/landscape_1200x50_03.jpg"),
      L(1200,50,"https://cdn.adblockcdn.com/pix/Landscapes/12--x5-/12--x5-/landscape_1200x50_04.jpg"),
      L(1200,50,"https://cdn.adblockcdn.com/pix/Landscapes/12--x5-/12--x5-/landscape_1200x50_05.jpg"),
      L(1200,50,"https://cdn.adblockcdn.com/pix/Landscapes/12--x5-/12--x5-/-1.jpg"),
      L(1200,50,"https://cdn.adblockcdn.com/pix/Landscapes/12--x5-/12--x5-/-2.jpg"),
      L(1200,50,"https://cdn.adblockcdn.com/pix/Landscapes/12--x5-/12--x5-/-3.jpg"),
      L(1200,50,"https://cdn.adblockcdn.com/pix/Landscapes/12--x5-/12--x5-/-4.jpg"),
      L(1200,50,"https://cdn.adblockcdn.com/pix/Landscapes/12--x5-/12--x5-/-5.jpg"),
      L(1200,50,"https://cdn.adblockcdn.com/pix/Landscapes/12--x5-/12--x5-/landscape_12--x5-_-2.jpg"),
      L(1200,50,"https://cdn.adblockcdn.com/pix/Landscapes/12--x5-/12--x5-/landscape_12--x5-_-3.jpg"),
      L(1200,50,"https://cdn.adblockcdn.com/pix/Landscapes/12--x5-/12--x5-/landscape_12--x5-_-4.jpg"),
      L(1200,50,"https://cdn.adblockcdn.com/pix/Landscapes/12--x5-/12--x5-/landscape_12--x5-_-5.jpg"),
      L(1200,50,"https://cdn.adblockcdn.com/pix/Landscapes/12--x5-/12--x5-/landscape_12--x5-_-1.jpg"),
      L(2400,100,"https://cdn.adblockcdn.com/pix/Landscapes/12--x5-/24--x1--/landscape_2400x100_01.jpg"),
      L(2400,100,"https://cdn.adblockcdn.com/pix/Landscapes/12--x5-/24--x1--/landscape_2400x100_02.jpg"),
      L(2400,100,"https://cdn.adblockcdn.com/pix/Landscapes/12--x5-/24--x1--/landscape_2400x100_03.jpg"),
      L(2400,100,"https://cdn.adblockcdn.com/pix/Landscapes/12--x5-/24--x1--/landscape_2400x100_04.jpg"),
      L(2400,100,"https://cdn.adblockcdn.com/pix/Landscapes/12--x5-/24--x1--/landscape_2400x100_05.jpg"),
      L(2400,100,"https://cdn.adblockcdn.com/pix/Landscapes/12--x5-/24--x1--/-1.jpg"),
      L(2400,100,"https://cdn.adblockcdn.com/pix/Landscapes/12--x5-/24--x1--/-2.jpg"),
      L(2400,100,"https://cdn.adblockcdn.com/pix/Landscapes/12--x5-/24--x1--/-3.jpg"),
      L(2400,100,"https://cdn.adblockcdn.com/pix/Landscapes/12--x5-/24--x1--/-4.jpg"),
      L(2400,100,"https://cdn.adblockcdn.com/pix/Landscapes/12--x5-/24--x1--/-5.jpg"),
      L(2400,100,"https://cdn.adblockcdn.com/pix/Landscapes/12--x5-/24--x1--/landscape_24--x1--_-1.jpg"),
      L(2400,100,"https://cdn.adblockcdn.com/pix/Landscapes/12--x5-/24--x1--/landscape_24--x1--_-2.jpg"),
      L(2400,100,"https://cdn.adblockcdn.com/pix/Landscapes/12--x5-/24--x1--/landscape_24--x1--_-3.jpg"),
      L(2400,100,"https://cdn.adblockcdn.com/pix/Landscapes/12--x5-/24--x1--/landscape_24--x1--_-4.jpg"),
      L(2400,100,"https://cdn.adblockcdn.com/pix/Landscapes/12--x5-/24--x1--/landscape_24--x1--_-5.jpg"),
      L(468,60,"https://cdn.adblockcdn.com/pix/Landscapes/468x6-/468x6-/landscape_468x6-_01.jpg"),
      L(468,60,"https://cdn.adblockcdn.com/pix/Landscapes/468x6-/468x6-/landscape_468x6-_02.jpg"),
      L(468,60,"https://cdn.adblockcdn.com/pix/Landscapes/468x6-/468x6-/landscape_468x6-_03.jpg"),
      L(468,60,"https://cdn.adblockcdn.com/pix/Landscapes/468x6-/468x6-/landscape_468x6-_04.jpg"),
      L(468,60,"https://cdn.adblockcdn.com/pix/Landscapes/468x6-/468x6-/landscape_468x6-_05.jpg"),
      L(468,60,"https://cdn.adblockcdn.com/pix/Landscapes/468x6-/468x6-/-4.jpg"),
      L(468,60,"https://cdn.adblockcdn.com/pix/Landscapes/468x6-/468x6-/landscape_468x6-_-4.jpg"),
      L(936,120,"https://cdn.adblockcdn.com/pix/Landscapes/468x6-/936x12-/landscape_936x120_01.jpg"),
      L(936,120,"https://cdn.adblockcdn.com/pix/Landscapes/468x6-/936x12-/landscape_936x120_02.jpg"),
      L(936,120,"https://cdn.adblockcdn.com/pix/Landscapes/468x6-/936x12-/landscape_936x120_03.jpg"),
      L(936,120,"https://cdn.adblockcdn.com/pix/Landscapes/468x6-/936x12-/landscape_936x120_04.jpg"),
      L(936,120,"https://cdn.adblockcdn.com/pix/Landscapes/468x6-/936x12-/landscape_936x120_05.jpg"),
      L(936,120,"https://cdn.adblockcdn.com/pix/Landscapes/468x6-/936x12-/-1.jpg"),
      L(936,120,"https://cdn.adblockcdn.com/pix/Landscapes/468x6-/936x12-/landscape_936x12-_-3.jpg"),
      L(1456,180,"https://cdn.adblockcdn.com/pix/Landscapes/728x9-/1456x18-/Landscape_1456x180_01.jpg"),
      L(1456,180,"https://cdn.adblockcdn.com/pix/Landscapes/728x9-/1456x18-/Landscape_1456x180_02.jpg"),
      L(1456,180,"https://cdn.adblockcdn.com/pix/Landscapes/728x9-/1456x18-/Landscape_1456x180_03.jpg"),
      L(1456,180,"https://cdn.adblockcdn.com/pix/Landscapes/728x9-/1456x18-/Landscape_1456x180_04.jpg"),
      L(1456,180,"https://cdn.adblockcdn.com/pix/Landscapes/728x9-/1456x18-/Landscape_1456x180_05.jpg"),
      L(1456,180,"https://cdn.adblockcdn.com/pix/Landscapes/728x9-/1456x18-/Landscape_1456x18-_01.jpg"),
      L(1456,180,"https://cdn.adblockcdn.com/pix/Landscapes/728x9-/1456x18-/Landscape_1456x18-_02.jpg"),
      L(1456,180,"https://cdn.adblockcdn.com/pix/Landscapes/728x9-/1456x18-/Landscape_1456x18-_03.jpg"),
      L(1456,180,"https://cdn.adblockcdn.com/pix/Landscapes/728x9-/1456x18-/Landscape_1456x18-_04.jpg"),
      L(1456,180,"https://cdn.adblockcdn.com/pix/Landscapes/728x9-/1456x18-/Landscape_1456x18-_05.jpg"),
      L(1456,180,"https://cdn.adblockcdn.com/pix/Landscapes/728x9-/1456x18-/Landscape_1456x18-_-3.jpg"),
      L(1456,180,"https://cdn.adblockcdn.com/pix/Landscapes/728x9-/1456x18-/Landscape_1456x18-_-4.jpg"),
      L(1456,180,"https://cdn.adblockcdn.com/pix/Landscapes/728x9-/1456x18-/Landscape_1456x18-_-7.jpg"),
      L(1456,180,"https://cdn.adblockcdn.com/pix/Landscapes/728x9-/1456x18-/Landscape_1456x18-_1-.jpg"),
      L(1456,180,"https://cdn.adblockcdn.com/pix/Landscapes/728x9-/1456x18-/Landscape_1456x18-_11.jpg"),
      L(1456,180,"https://cdn.adblockcdn.com/pix/Landscapes/728x9-/1456x18-/Landscape_1456x18-_12.jpg"),
      L(1456,180,"https://cdn.adblockcdn.com/pix/Landscapes/728x9-/1456x18-/Landscape_1456x18-_15.jpg"),
      L(1456,180,"https://cdn.adblockcdn.com/pix/Landscapes/728x9-/1456x18-/Landscape_1456x18-_17.jpg"),
      L(1456,180,"https://cdn.adblockcdn.com/pix/Landscapes/728x9-/1456x18-/Landscape_1456x18-_-2.jpg"),
      L(728,90,"https://cdn.adblockcdn.com/pix/Landscapes/728x9-/728x9-/Landscape_728x90_01.jpg"),
      L(728,90,"https://cdn.adblockcdn.com/pix/Landscapes/728x9-/728x9-/Landscape_728x90_02.jpg"),
      L(728,90,"https://cdn.adblockcdn.com/pix/Landscapes/728x9-/728x9-/Landscape_728x90_03.jpg"),
      L(728,90,"https://cdn.adblockcdn.com/pix/Landscapes/728x9-/728x9-/Landscape_728x90_04.jpg"),
      L(728,90,"https://cdn.adblockcdn.com/pix/Landscapes/728x9-/728x9-/Landscape_728x90_05.jpg"),
      L(728,90,"https://cdn.adblockcdn.com/pix/Landscapes/728x9-/728x9-/Landscape_728x9-_01.jpg"),
      L(728,90,"https://cdn.adblockcdn.com/pix/Landscapes/728x9-/728x9-/Landscape_728x9-_02.jpg"),
      L(728,90,"https://cdn.adblockcdn.com/pix/Landscapes/728x9-/728x9-/Landscape_728x9-_03.jpg"),
      L(728,90,"https://cdn.adblockcdn.com/pix/Landscapes/728x9-/728x9-/Landscape_728x9-_04.jpg"),
      L(728,90,"https://cdn.adblockcdn.com/pix/Landscapes/728x9-/728x9-/Landscape_728x9-_05.jpg"),
      L(728,90,"https://cdn.adblockcdn.com/pix/Landscapes/728x9-/728x9-/Landscape_728x9-_-1.jpg"),
      L(728,90,"https://cdn.adblockcdn.com/pix/Landscapes/728x9-/728x9-/Landscape_728x9-_-4.jpg"),
      L(728,90,"https://cdn.adblockcdn.com/pix/Landscapes/728x9-/728x9-/Landscape_728x9-_-5.jpg"),
      L(340,90,"https://cdn.adblockcdn.com/pix/Landscapes/34-x9-/34-x9-/Landscape_34-x9-_01.jpg"),
      L(340,90,"https://cdn.adblockcdn.com/pix/Landscapes/34-x9-/34-x9-/Landscape_34-x9-_02.jpg"),
      L(340,90,"https://cdn.adblockcdn.com/pix/Landscapes/34-x9-/34-x9-/Landscape_34-x9-_03.jpg"),
      L(340,90,"https://cdn.adblockcdn.com/pix/Landscapes/34-x9-/34-x9-/Landscape_34-x9-_04.jpg"),
      L(340,90,"https://cdn.adblockcdn.com/pix/Landscapes/34-x9-/34-x9-/Landscape_34-x9-_05.jpg"),
      L(340,90,"https://cdn.adblockcdn.com/pix/Landscapes/34-x9-/34-x9-/Landscape_34-x9-_-2.jpg"),
      L(340,90,"https://cdn.adblockcdn.com/pix/Landscapes/34-x9-/34-x9-/Landscape_34-x9-_-3.jpg"),
      L(340,90,"https://cdn.adblockcdn.com/pix/Landscapes/34-x9-/34-x9-/Landscape_34-x9-_-4.jpg"),
      L(340,90,"https://cdn.adblockcdn.com/pix/Landscapes/34-x9-/34-x9-/Landscape_34-x9-_1-.jpg"),
      L(340,90,"https://cdn.adblockcdn.com/pix/Landscapes/34-x9-/34-x9-/Landscape_34-x9-_11.jpg"),
      L(680,180,"https://cdn.adblockcdn.com/pix/Landscapes/34-x9-/68-x18-/Landscape_68-x18-_01.jpg"),
      L(680,180,"https://cdn.adblockcdn.com/pix/Landscapes/34-x9-/68-x18-/Landscape_68-x18-_02.jpg"),
      L(680,180,"https://cdn.adblockcdn.com/pix/Landscapes/34-x9-/68-x18-/Landscape_68-x18-_03.jpg"),
      L(680,180,"https://cdn.adblockcdn.com/pix/Landscapes/34-x9-/68-x18-/Landscape_68-x18-_04.jpg"),
      L(680,180,"https://cdn.adblockcdn.com/pix/Landscapes/34-x9-/68-x18-/Landscape_68-x18-_05.jpg"),
      L(680,180,"https://cdn.adblockcdn.com/pix/Landscapes/34-x9-/68-x18-/Landscape_68-x18-_-2.jpg"),
      L(680,180,"https://cdn.adblockcdn.com/pix/Landscapes/34-x9-/68-x18-/Landscape_68-x18-_-3.jpg"),
      L(680,180,"https://cdn.adblockcdn.com/pix/Landscapes/34-x9-/68-x18-/Landscape_68-x18-_-5.jpg"),
      L(680,180,"https://cdn.adblockcdn.com/pix/Landscapes/34-x9-/68-x18-/Landscape_68-x18-_-6.jpg"),
      L(680,180,"https://cdn.adblockcdn.com/pix/Landscapes/34-x9-/68-x18-/Landscape_68-x18-_-8.jpg"),
      L(680,180,"https://cdn.adblockcdn.com/pix/Landscapes/34-x9-/68-x18-/Landscape_68-x18-_1-.jpg"),
      L(680,180,"https://cdn.adblockcdn.com/pix/Landscapes/34-x9-/68-x18-/Landscape_68-x18-_11.jpg"),
      L(680,180,"https://cdn.adblockcdn.com/pix/Landscapes/34-x9-/68-x18-/Landscape_68-x18-_12.jpg"),
      L(680,180,"https://cdn.adblockcdn.com/pix/Landscapes/34-x9-/68-x18-/Landscape_68-x18-_14.jpg"),
      L(680,180,"https://cdn.adblockcdn.com/pix/Landscapes/34-x9-/68-x18-/Landscape_68-x18-_15.jpg"),
      L(680,180,"https://cdn.adblockcdn.com/pix/Landscapes/34-x9-/68-x18-/Landscape_68-x18-_16.jpg"),
      L(680,180,"https://cdn.adblockcdn.com/pix/Landscapes/34-x9-/68-x18-/Landscape_68-x18-_17.jpg"),
      L(160,600,"https://cdn.adblockcdn.com/pix/Landscapes/16-x6--/16-x6--/amazing-animal-beautiful-beautifull.jpg"),
      L(160,600,"https://cdn.adblockcdn.com/pix/Landscapes/16-x6--/16-x6--/amazing-beautiful-beauty-blue.jpg"),
      L(160,600,"https://cdn.adblockcdn.com/pix/Landscapes/16-x6--/16-x6--/antelope-canyon-lower-canyon-arizona.jpg"),
      L(160,600,"https://cdn.adblockcdn.com/pix/Landscapes/16-x6--/16-x6--/delicate-arch-night-stars-landscape.jpg"),
      L(160,600,"https://cdn.adblockcdn.com/pix/Landscapes/16-x6--/16-x6--/italian-landscape-mountains-nature.jpg"),
      L(160,600,"https://cdn.adblockcdn.com/pix/Landscapes/16-x6--/16-x6--/pexels-photo (1).jpg"),
      L(160,600,"https://cdn.adblockcdn.com/pix/Landscapes/16-x6--/16-x6--/pexels-photo (2).jpg"),
      L(160,600,"https://cdn.adblockcdn.com/pix/Landscapes/16-x6--/16-x6--/road-sun-rays-path.jpg"),
      L(160,600,"https://cdn.adblockcdn.com/pix/Landscapes/16-x6--/16-x6--/sunset-field-poppy-sun-priroda.jpg"),
      L(160,600,"https://cdn.adblockcdn.com/pix/Landscapes/16-x6--/16-x6--/switzerland-zermatt-mountains-snow.jpg"),
      L(320,1200,"https://cdn.adblockcdn.com/pix/Landscapes/16-x6--/32-x12--/amazing-beautiful-beauty-blue.jpg"),
      L(320,1200,"https://cdn.adblockcdn.com/pix/Landscapes/16-x6--/32-x12--/antelope-canyon-lower-canyon-arizona.jpg"),
      L(320,1200,"https://cdn.adblockcdn.com/pix/Landscapes/16-x6--/32-x12--/italian-landscape-mountains-nature.jpg"),
      L(320,1200,"https://cdn.adblockcdn.com/pix/Landscapes/16-x6--/32-x12--/pexels-photo (1).jpg"),
      L(320,1200,"https://cdn.adblockcdn.com/pix/Landscapes/16-x6--/32-x12--/pexels-photo (2).jpg"),
      L(320,1200,"https://cdn.adblockcdn.com/pix/Landscapes/16-x6--/32-x12--/road-sun-rays-path.jpg"),
      L(320,1200,"https://cdn.adblockcdn.com/pix/Landscapes/16-x6--/32-x12--/sunrise-phu-quoc-island-ocean.jpg"),
      L(320,1200,"https://cdn.adblockcdn.com/pix/Landscapes/16-x6--/32-x12--/switzerland-zermatt-mountains-snow.jpg"),
      L(180,680,"https://cdn.adblockcdn.com/pix/Landscapes/18-x68-/18-x68-/pexels-photo-414-83.jpg"),
      L(180,680,"https://cdn.adblockcdn.com/pix/Landscapes/18-x68-/18-x68-/pexels-photo-351448.jpg"),
      L(180,680,"https://cdn.adblockcdn.com/pix/Landscapes/18-x68-/36-x136-/amazing-animal-beautiful-beautifull.jpg"),
      L(180,680,"https://cdn.adblockcdn.com/pix/Landscapes/18-x68-/36-x136-/pexels-photo-164196.jpg"),
      L(180,680,"https://cdn.adblockcdn.com/pix/Landscapes/18-x68-/36-x136-/pexels-photo-189848.jpg"),
      L(180,680,"https://cdn.adblockcdn.com/pix/Landscapes/18-x68-/36-x136-/pexels-photo-21-186.jpg"),
      L(180,680,"https://cdn.adblockcdn.com/pix/Landscapes/18-x68-/36-x136-/pexels-photo-221148.jpg"),
      L(180,680,"https://cdn.adblockcdn.com/pix/Landscapes/18-x68-/36-x136-/pexels-photo-388-65.jpg"),
      L(180,680,"https://cdn.adblockcdn.com/pix/Landscapes/18-x68-/36-x136-/pexels-photo-443446.jpg"),
      L(1120,1344,"https://cdn.adblockcdn.com/pix/Landscapes/56-x672/112-x1344/pexels-photo-355241.jpg"),
      L(1120,1344,"https://cdn.adblockcdn.com/pix/Landscapes/56-x672/112-x1344/pexels-photo-552791.jpg"),
      L(1120,1344,"https://cdn.adblockcdn.com/pix/Landscapes/56-x672/112-x1344/switzerland-zermatt-mountains-snow.jpg"),
      L(560,672,"https://cdn.adblockcdn.com/pix/Landscapes/56-x672/56-x672/boat-house-cottage-waters-lake-65225.jpg"),
      L(560,672,"https://cdn.adblockcdn.com/pix/Landscapes/56-x672/56-x672/pexels-photo (1).jpg"),
      L(560,672,"https://cdn.adblockcdn.com/pix/Landscapes/56-x672/56-x672/pexels-photo-117843.jpg"),
      L(560,672,"https://cdn.adblockcdn.com/pix/Landscapes/56-x672/56-x672/pexels-photo-221148.jpg"),
      L(560,672,"https://cdn.adblockcdn.com/pix/Landscapes/56-x672/56-x672/yellowstone-national-park-sunset-twilight-dusk-158489.jpg"),
    ]);
  }
};

Object.assign(window, {
  LandscapesChannel
});

/***/ }),
/* 62 */
/***/ (function(module, exports, __webpack_require__) {

// Yes, you could hack my code to not check the license.  But please don't.
// Paying for this extension supports the work on AdBlock.  Thanks very much.
const {checkWhitelisted} = __webpack_require__(8);
const {recordGeneralMessage} = __webpack_require__(12).ServerMessages;
var License = (function () {
  var licenseStorageKey = 'license';
  var installTimestampStorageKey = 'install_timestamp';
  var licenseAlarmName = 'licenseAlarm';
  var theLicense = undefined;
  var oneDayInMinutes = 1140;
  var fiveMinutes = 300000;
  var initialized = false;
  var ajaxRetryCount = 0;
  var overlayMsgInProgress = false;
  var OneHourInMilliSeconds = 3600000;
  var _readyComplete;
  var _promise = new Promise(function (resolve, reject) {
      _readyComplete = resolve;
  });

  var chrome_storage_set = function (key, value, callback) {
    if (value === undefined) {
      chrome.storage.local.remove(key);
      return;
    }

    var saveData = {};
    saveData[key] = value;
    chrome.storage.local.set(saveData, callback);
  };

  chrome.alarms.onAlarm.addListener(function(alarm) {
    if (alarm && alarm.name === licenseAlarmName) {
      // At this point, no alarms exists, so
      // create an temporary alarm to avoid race condition issues
      chrome.alarms.create(licenseAlarmName, {delayInMinutes: (24 * 60)});
      License.ready().then(function() {
        License.updatePeriodically();
      });
    }
  });

  // Check if the computer was woken up, and if there was a pending alarm
  // that should fired during the sleep, then
  // remove it, and fire the update ourselves.
  // see - https://bugs.chromium.org/p/chromium/issues/detail?id=471524
  chrome.idle.onStateChanged.addListener(function(newState) {
    if (newState === 'active') {
      chrome.alarms.get(licenseAlarmName, function(alarm) {
        if (alarm && Date.now() > alarm.scheduledTime) {
          chrome.alarms.clear(licenseAlarmName, function(wasCleared){
            License.updatePeriodically();
          });
        } else if (alarm) {
          // if the alarm should fire in the future,
          // re-add the license so it fires at the correct time
          var originalTime = alarm.scheduledTime;
          chrome.alarms.clear(licenseAlarmName, function(wasCleared){
            if (wasCleared) {
              chrome.alarms.create(licenseAlarmName, {when: originalTime});
            }
          });
        } else {
          License.updatePeriodically();
        }
      });
    }
  });

  // Load the license from persistent storage
  // Should only be called during startup / initialization
  var loadFromStorage = function(callback) {
    chrome.storage.local.get(licenseStorageKey, function (response) {
      var localLicense = storage_get(licenseStorageKey);
      theLicense = response[licenseStorageKey] || localLicense || {};
      if (typeof callback === "function") {
        callback();
      }
    });
  };

  // Check the response from a ping to see if it contains valid show MyAdBlock enrollment instructions.
  // If so, return an object containing data
  // Otherwise, return null.
  // Inputs:
  //   responseData: string response from a ping
  var myAdBlockDataFrom = function(responseData) {
      if (responseData.length === 0 || responseData.trim().length === 0)
        return null;

      try {
        var pingData = JSON.parse(responseData);
        if (!pingData)
          return;
      } catch (e) {
        console.log("Something went wrong with parsing survey data.");
        console.log('error', e);
        console.log('response data', responseData);
        return null;
      }
      return pingData;
  };


  return {
    licenseStorageKey: licenseStorageKey,
    initialized: initialized,
    licenseAlarmName: licenseAlarmName,
    checkPingResponse: function(pingResponseData) {
      var pingData = myAdBlockDataFrom(pingResponseData);
      if (!pingData){
        return;
      }
      if (pingData.myadblock_enrollment === true) {
        loadFromStorage(function() {
          theLicense.myadblock_enrollment = true;
          License.set(theLicense);
        });
      }
    },
    get: function() {
      return theLicense;
    },
    set: function(newLicense) {
      if (newLicense) {
        theLicense = newLicense;
        // store in redudant locations
        chrome.storage.local.set({ 'license': theLicense });
        storage_set('license', theLicense);
      }
    },
    initialize: function(callback) {
      loadFromStorage(function() {
        if (typeof callback === "function")  {
          callback();
        }
        _readyComplete();
      });
    },
    // Get the latest license data from the server, and talk to the user if needed.
    update: function() {
      STATS.untilLoaded(function(userID)
      {
        var postData = {};
        postData.u = STATS.userId();
        postData.cmd = "license_check";
        var licsenseStatusBefore = License.get().status;
        // license version
        postData.v = "1";
        $.ajax({
            jsonp: false,
            url: "https://myadblock.licensing.getadblock.com/license/",
            type: 'post',
            success: function (text, status, xhr) {
                ajaxRetryCount = 0;
                var updatedLicense = {};
                try {
                  updatedLicense = JSON.parse(text);
                } catch (e) {
                  console.log("Something went wrong with parsing license data.");
                  console.log('error', e);
                  return;
                }
                if (!updatedLicense) {
                  return;
                }
                // merge the updated license
                theLicense = $.extend(theLicense, updatedLicense);
                License.set(theLicense);
                // now check to see if we need to do anything because of a status change
                if (licsenseStatusBefore === "active" && updatedLicense.status && updatedLicense.status === "expired") {
                  License.processExpiredLicense();
                  recordGeneralMessage("trial_license_expired");
                }
            },
            error: function (xhr, textStatus, errorThrown) {
                log("license server error response", xhr, textStatus, errorThrown, ajaxRetryCount);
                ajaxRetryCount++;
                if (ajaxRetryCount > 3) {
                  log("Retry Count exceeded, giving up", ajaxRetryCount);
                  return;
                }
                var oneMinute = 1 * 60 * 1000;
                setTimeout(function() {
                  License.updatePeriodically("error" + ajaxRetryCount);
                }, oneMinute);
            },
            data: postData
        });
      });
    },
    processExpiredLicense() {
      var theLicense = License.get();
      theLicense.myadblock_enrollment = true;
      License.set(theLicense);
      setSetting("picreplacement", false);
      chrome.alarms.clear(licenseAlarmName);
    },
    ready: function () {
      return _promise;
    },
    updatePeriodically: function() {
      if (!License.isActiveLicense()) {
        return;
      }
      License.update();
      chrome.storage.local.get(installTimestampStorageKey, function (response) {
        var localTimestamp = storage_get(installTimestampStorageKey);
        var originalInstallTimestamp = response[installTimestampStorageKey] || localTimestamp || Date.now();
        // If the installation timestamp is missing from both storage locations, save an updated version
        if (!(response[installTimestampStorageKey] || localTimestamp)) {
          var install_timestamp = Date.now();
          storage_set(installTimestampStorageKey, install_timestamp);
          chrome.storage.local.set({ 'install_timestamp': install_timestamp });
        }
        var originalInstallDate = new Date(originalInstallTimestamp);
        var nextLicenseCheck = new Date();
        if (originalInstallDate.getHours() <= nextLicenseCheck.getHours())
        {
          nextLicenseCheck.setDate(nextLicenseCheck.getDate() + 1);
        }
        nextLicenseCheck.setHours(originalInstallDate.getHours());
        nextLicenseCheck.setMinutes(originalInstallDate.getMinutes());
        // we need to add 5 minutes to the 'minutes' to make sure we've allowed enought time for '1' day
        nextLicenseCheck = new Date(nextLicenseCheck.getTime() + fiveMinutes);
        chrome.alarms.create(licenseAlarmName, {when: nextLicenseCheck.getTime()});
      });
    },
    getLicenseInstallationDate: function(callback) {
      if (typeof callback !== "function") {
        return;
      }
      chrome.storage.local.get(installTimestampStorageKey, function (response) {
        var localTimestamp = storage_get(installTimestampStorageKey);
        var originalInstallTimestamp = response[installTimestampStorageKey] || localTimestamp;
        if (originalInstallTimestamp) {
          callback(new Date(originalInstallTimestamp));
        } else {
          callback(undefined);
        }
      });
    },
    isActiveLicense: function() {
      return License && License.get() && License.get().status === "active";
    },
    shouldShowMyAdBlockEnrollment: function() {
      return License && License.get() && License.get().myadblock_enrollment && !License.isActiveLicense();
    }
  };
})();

chrome.runtime.onMessage.addListener(
  function(request, sender, sendResponse) {
    if (request.command === "payment_success" && request.transID && request.selections && request.version === 1) {
        var currentLicense = {};
        currentLicense.status = "active";
        License.set(currentLicense);
        var delay = 30 * 60 * 1000; // 30 minutes
        window.setTimeout(function() {
          License.updatePeriodically();
        }, delay);
        setSetting("picreplacement", true);
        var guide = channels.getGuide();
        for (var id in guide) {
          if (guide[id].name === "CatsChannel") {
            channels.setEnabled(id, request.selections.cat);
          }
          if (guide[id].name === "DogsChannel") {
            channels.setEnabled(id, request.selections.dog);
          }
          if (guide[id].name === "LandscapesChannel") {
            channels.setEnabled(id, request.selections.landscape);
          }
        }
        sendResponse({ ack: true });
    }
});

var channels = {};
License.ready().then(function() {
  chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    if (!(request.message == "load_my_adblock")) {
      return;
    }
    if (sender.url && sender.url.startsWith("http") && getSettings().picreplacement) {
      chrome.tabs.executeScript(sender.tab.id, {file: "adblock-picreplacement-image-sizes-map.js", frameId: sender.frameId, runAt:"document_start"}, function(){
          if (chrome.runtime.lastError) {
              log(chrome.runtime.lastError)
          }
      });
      chrome.tabs.executeScript(sender.tab.id, {file: "adblock-picreplacement.js", frameId: sender.frameId, runAt:"document_start"}, function(){
          if (chrome.runtime.lastError) {
              log(chrome.runtime.lastError)
          }
      });
    }
    sendResponse({});
  });

  channels = new Channels();
  Object.assign(window, {
    channels
  });
  chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    if (request.message !== "get_random_listing") {
      return;
    }

    var myPage = ext.getPage(sender.tab.id);
    if (checkWhitelisted(myPage) || !License.isActiveLicense()) {
      sendResponse({ disabledOnPage: true });
      return;
    }
    var result = channels.randomListing(request.opts);
    if (result) {
      sendResponse(result);
    } else {
      // if not found, and data collection enabled, send message to log server with domain, and request
      sendResponse({ disabledOnPage: true });
    }
  });

  chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    if (request.message === 'recordOneAdReplaced') {
      sendResponse({});
      if (License.isActiveLicense()) {
        replacedCounts.recordOneAdReplaced(sender.tab.id)
      }
    }
  });

  chrome.extension.onRequest.addListener(
    function(request, sender, sendResponse) {
      if (request.command !== "picreplacement_inject_jquery")
        return; // not for us
      if (sender.url && sender.url.startsWith("http")) {
        chrome.tabs.executeScript(undefined,
          {allFrames: request.allFrames, file: "adblock-jquery.js"},
          function() {
            if (chrome.runtime.lastError) {
                log(chrome.runtime.lastError)
            }
            sendResponse({});
          }
        );
      }
    }
  );

});
// Records how many ads have been replaced by AdBlock.  This is used
// by the AdBlock to display statistics to the user.
var replacedCounts = (function() {
  var key = "replaced_stats";
  var data = storage_get(key);
  if (!data)
    data = {};
  if (data.start === undefined)
    data.start = Date.now();
  if (data.total === undefined)
    data.total = 0;
  data.version = 1;
  storage_set(key, data);

  return {
    recordOneAdReplaced: function(tabId) {
      var data = storage_get(key);
      data.total += 1;
      storage_set(key, data);

      var myPage = ext.getPage(tabId);
      let replaced = replacedPerPage.get(myPage) || 0;
      replacedPerPage.set( myPage, ++replaced);
    },
    get: function() {
      return storage_get(key);
    },
    getTotalAdsReplaced: function(tabId){
      if (tabId) {
        return replacedPerPage.get(ext.getPage(tabId));
      }
      return this.get().total;
    }
  };
})();

let replacedPerPage = new ext.PageMap();

getReplacedPerPage = page => replacedPerPage.get(page) || 0;

License.initialize(function() {
  if (!License.initialized) {
      License.initialized = true;
  }
});

Object.assign(window, {
  License,
  replacedCounts
});

/***/ }),
/* 63 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";
/** @module adblock-betafish/getselectors */

/** call by the data collection content script, and if the user has myadblock enabled */



const {ElemHide} = __webpack_require__(14);
const {RegExpFilter} = __webpack_require__(0);
const {ElemHideEmulation} = __webpack_require__(20);
const {checkWhitelisted} = __webpack_require__(8);
const {extractHostFromFrame} = __webpack_require__(6);
const {port} = __webpack_require__(7);

port.on("getSelectors", (message, sender) =>
{
  let selectors = [];
  let emulatedPatterns = [];

  if (!checkWhitelisted(sender.page, sender.frame, null,
                        RegExpFilter.typeMap.DOCUMENT |
                        RegExpFilter.typeMap.ELEMHIDE))
  {
    let hostname = extractHostFromFrame(sender.frame);
    let specificOnly = checkWhitelisted(sender.page, sender.frame, null,
                                        RegExpFilter.typeMap.GENERICHIDE);

    selectors = ElemHide.getSelectorsForDomain(
      hostname,
      specificOnly ? ElemHide.SPECIFIC_ONLY : ElemHide.ALL_MATCHING
    );

    for (let filter of ElemHideEmulation.getRulesForDomain(hostname))
      emulatedPatterns.push({selector: filter.selector, text: filter.text});
  }

  let response = {emulatedPatterns, selectors};

  return response;
});

/***/ })
/******/ ]);
//# sourceMappingURL=adblockplus.js.map