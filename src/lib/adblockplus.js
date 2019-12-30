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
/******/ 	return __webpack_require__(__webpack_require__.s = 40);
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

const {extend} = __webpack_require__(25);
const {filterToRegExp} = __webpack_require__(26);
const {normalizeHostname, domainSuffixes} = __webpack_require__(10);
const {Cache} = __webpack_require__(18);
const {filterNotifier} = __webpack_require__(1);

const resources = __webpack_require__(44);

/**
 * Map of internal resources for URL rewriting.
 * @type {Map.<string,string>}
 */
let resourceMap = new Map(
  Object.keys(resources).map(key => [key, resources[key]])
);

/**
 * Regular expression used to match the <code>||</code> prefix in an otherwise
 * literal pattern.
 * @type {RegExp}
 */
let doubleAnchorRegExp = new RegExp(filterToRegExp("||") + "$");

/**
 * Regular expression used to match the <code>^</code> suffix in an otherwise
 * literal pattern.
 * @type {RegExp}
 */
// Note: This should match the pattern in lib/common.js
let separatorRegExp = /[\x00-\x24\x26-\x2C\x2F\x3A-\x40\x5B-\x5E\x60\x7B-\x7F]/;

/**
 * Cache of domain maps. The domains part of filter text
 * (e.g. <code>example.com,~mail.example.com</code>) is often repeated across
 * filters. This cache enables deduplication of the <code>Map</code> objects
 * that specify on which domains the filter does and does not apply, which
 * reduces memory usage and improves performance.
 * @type {Map.<string, Map.<string, boolean>>}
 */
let domainsCache = new Cache(1000);

/**
 * Checks whether the given pattern is a string of literal characters with no
 * wildcards or any other special characters. If the pattern is prefixed with a
 * <code>||</code> or suffixed with a <code>^</code> but otherwise contains no
 * special characters, it is still considered to be a literal pattern.
 * @param {string} pattern
 * @returns {boolean}
 */
function isLiteralPattern(pattern)
{
  return !/[*^|]/.test(pattern.replace(/^\|{1,2}/, "").replace(/[|^]$/, ""));
}

/**
 * Parses the domains part of a filter text
 * (e.g. <code>example.com,~mail.example.com</code>) into a <code>Map</code>
 * object.
 *
 * @param {string} source The domains part of a filter text.
 * @param {string} separator The string used to separate two or more domains in
 *   the domains part of a filter text.
 *
 * @returns {?Map.<string, boolean>}
 */
function parseDomains(source, separator)
{
  let domains = null;

  let list = source.split(separator);
  if (list.length == 1 && list[0][0] != "~")
  {
    // Fast track for the common one-domain scenario
    domains = new Map([[list[0], true], ["", false]]);
  }
  else
  {
    let hasIncludes = false;
    for (let i = 0; i < list.length; i++)
    {
      let domain = list[i];
      if (domain == "")
        continue;

      let include;
      if (domain[0] == "~")
      {
        include = false;
        domain = domain.substring(1);
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

  return domains;
}

/**
 * Abstract base class for filters
 *
 * @param {string} text   string representation of the filter
 * @constructor
 */
function Filter(text)
{
  this.text = text;
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
   * Filter type as a string, e.g. "blocking".
   * @type {string}
   */
  get type()
  {
    throw new Error("Please define filter type in the subclass");
  },

  /**
   * Serializes the filter for writing out on disk.
   * @yields {string}
   */
  *serialize()
  {
    let {text} = this;

    yield "[Filter]";
    yield "text=" + text;
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
 * Regular expression that content filters should match
 * @type {RegExp}
 */
Filter.contentRegExp = /^([^/*|@"!]*?)#([@?$])?#(.+)$/;
/**
 * Regular expression that options on a RegExp filter should match
 * @type {RegExp}
 */
Filter.optionsRegExp = /\$(~?[\w-]+(?:=[^,]*)?(?:,~?[\w-]+(?:=[^,]*)?)*)$/;
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

  if (text[0] == "!")
  {
    filter = new CommentFilter(text);
  }
  else
  {
    let match = text.includes("#") ? Filter.contentRegExp.exec(text) : null;
    if (match)
      filter = ContentFilter.fromText(text, match[1], match[2], match[3]);
    else
      filter = RegExpFilter.fromText(text);
  }

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

  // Special treatment for content filters, right side is allowed to contain
  // spaces
  if (Filter.contentRegExp.test(text))
  {
    let [, domains, separator, body] = /^(.*?)(#[@?$]?#?)(.*)$/.exec(text);
    return domains.replace(/ +/g, "") + separator + body.trim();
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
  let optionsText = text.substring(dollarIndex + 1);

  // Then we can normalize spaces in the options part safely
  let options = optionsText.split(",");
  for (let i = 0; i < options.length; i++)
  {
    let option = options[i];
    let cspMatch = /^ *c *s *p *=/i.exec(option);
    if (cspMatch)
    {
      options[i] = cspMatch[0].replace(/ +/g, "") +
                   option.substring(cspMatch[0].length).trim().replace(/ +/g, " ");
    }
    else
      options[i] = option.replace(/ +/g, "");
  }

  return beforeOptions + "$" + options.join();
};

/**
 * Class for invalid filters
 * @param {string} text see {@link Filter Filter()}
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
  *serialize() {}
});

/**
 * Class for comments
 * @param {string} text see {@link Filter Filter()}
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
  *serialize() {}
});

/**
 * Abstract base class for filters that can get hits
 * @param {string} text
 *   see {@link Filter Filter()}
 * @param {string} [domains]
 *   Domains that the filter is restricted to separated by domainSeparator
 *   e.g. "foo.com|bar.com|~baz.com"
 * @constructor
 * @augments Filter
 */
function ActiveFilter(text, domains)
{
  Filter.call(this, text);

  if (domains)
    this.domainSource = domains.toLowerCase();
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
      filterNotifier.emit("filter.disabled", this, value, oldValue);
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
      filterNotifier.emit("filter.hitCount", this, value, oldValue);
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
      filterNotifier.emit("filter.lastHit", this, value, oldValue);
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
   * Map containing domains that this filter should match on/not match
   * on or null if the filter should match on all domains
   * @type {?Map.<string,boolean>}
   */
  get domains()
  {
    let {domainSource} = this;
    if (!domainSource)
      return null;

    let {_domains} = this;
    if (typeof _domains != "undefined")
      return _domains;

    let domains = domainsCache.get(domainSource);

    if (typeof domains == "undefined")
    {
      domains = parseDomains(domainSource, this.domainSeparator);
      domainsCache.set(domainSource, domains);
    }

    this._domains = domains;

    return domains;
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
        (!sitekey || !this.sitekeys.includes(sitekey.toUpperCase())))
    {
      return false;
    }

    let {domains} = this;

    // If no domains are set the rule matches everywhere
    if (!domains)
      return true;

    // If the document has no host name, match only if the filter
    // isn't restricted to specific domains
    if (!docDomain)
      return domains.get("");

    for (docDomain of domainSuffixes(normalizeHostname(docDomain)))
    {
      let isDomainIncluded = domains.get(docDomain);
      if (typeof isDomainIncluded != "undefined")
        return isDomainIncluded;
    }

    return domains.get("");
  },

  /**
   * Checks whether this filter is active only on a domain and its subdomains.
   * @param {string} docDomain
   * @return {boolean}
   */
  isActiveOnlyOnDomain(docDomain)
  {
    let {domains} = this;

    if (!docDomain || !domains || domains.get(""))
      return false;

    docDomain = normalizeHostname(docDomain);

    for (let [domain, isIncluded] of domains)
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
    let {sitekeys, domains} = this;

    return !(sitekeys && sitekeys.length) && (!domains || domains.get(""));
  },

  /**
   * See Filter.serialize()
   * @inheritdoc
   */
  *serialize()
  {
    let {_disabled, _hitCount, _lastHit} = this;

    if (_disabled || _hitCount || _lastHit)
    {
      yield* Filter.prototype.serialize.call(this);
      if (_disabled)
        yield "disabled=true";
      if (_hitCount)
        yield "hitCount=" + _hitCount;
      if (_lastHit)
        yield "lastHit=" + _lastHit;
    }
  },

  /**
   * Number of filters contained, will always be 1 (required to
   * optimize {@link Matcher}).
   * @type {number}
   * @package
   */
  size: 1,

  /**
   * Yields a key-value pair consisting of the filter itself and the value
   * <code>true</code> (required to optimize {@link Matcher}).
   * @yields {Array}
   * @package
   */
  *entries()
  {
    yield [this, true];
  }
});

/**
 * Yields the filter itself (required to optimize {@link Matcher}).
 * @yields {ActiveFilter}
 * @package
 */
ActiveFilter.prototype[Symbol.iterator] = function*()
{
  yield this;
};

/**
 * Abstract base class for RegExp-based filters
 * @param {string} text see {@link Filter Filter()}
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
 * @param {?string} [rewrite]
 *   The name of the internal resource to which to rewrite the
 *   URL. e.g. if the value of the <code>$rewrite</code> option is
 *   <code>abp-resource:blank-html</code>, this should be
 *   <code>blank-html</code>.
 * @constructor
 * @augments ActiveFilter
 */
function RegExpFilter(text, regexpSource, contentType, matchCase, domains,
                      thirdParty, sitekeys, rewrite)
{
  ActiveFilter.call(this, text, domains);

  if (contentType != null)
    this.contentType = contentType;
  if (matchCase)
    this.matchCase = matchCase;
  if (thirdParty != null)
    this.thirdParty = thirdParty;
  if (sitekeys != null)
    this.sitekeySource = sitekeys;
  if (rewrite != null)
    this.rewrite = rewrite;

  if (!this.matchCase)
    regexpSource = regexpSource.toLowerCase();

  if (regexpSource.length >= 2 &&
      regexpSource[0] == "/" &&
      regexpSource[regexpSource.length - 1] == "/")
  {
    // The filter is a regular expression - convert it immediately to
    // catch syntax errors
    let regexp = new RegExp(regexpSource.substring(1, regexpSource.length - 1));
    Object.defineProperty(this, "regexp", {value: regexp});
  }
  else
  {
    // Patterns like /foo/bar/* exist so that they are not treated as regular
    // expressions. We drop any superfluous wildcards here so our optimizations
    // can kick in.
    regexpSource = regexpSource.replace(/^\*+/, "").replace(/\*+$/, "");

    // No need to convert this filter to regular expression yet, do it on demand
    this.pattern = regexpSource;
  }
}
exports.RegExpFilter = RegExpFilter;

RegExpFilter.prototype = extend(ActiveFilter, {
  /**
   * @see ActiveFilter.domainSeparator
   */
  domainSeparator: "|",

  /**
   * Expression from which a regular expression should be generated -
   * for delayed creation of the regexp property
   * @type {?string}
   */
  pattern: null,
  /**
   * Regular expression to be used when testing against this filter
   * @type {RegExp}
   */
  get regexp()
  {
    let value = null;

    let {pattern} = this;
    if (!isLiteralPattern(pattern))
      value = new RegExp(filterToRegExp(pattern));

    Object.defineProperty(this, "regexp", {value});
    return value;
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
   * The name of the internal resource to which to rewrite the
   * URL. e.g. if the value of the <code>$rewrite</code> option is
   * <code>abp-resource:blank-html</code>, this should be
   * <code>blank-html</code>.
   * @type {?string}
   */
  rewrite: null,

  /**
   * Tests whether the URL request matches this filter
   * @param {URLRequest} request URL request to be tested
   * @param {number} typeMask bitmask of content / request types to match
   * @param {string} [sitekey] public key provided by the document
   * @return {boolean} true in case of a match
   */
  matches(request, typeMask, sitekey)
  {
    return (this.contentType & typeMask) != 0 &&
           (this.thirdParty == null || this.thirdParty == request.thirdParty) &&
           (this.regexp ?
              (this.isActiveOnDomain(request.documentHostname, sitekey) &&
               this.matchesLocation(request)) :
              (this.matchesLocation(request) &&
               this.isActiveOnDomain(request.documentHostname, sitekey)));
  },

  /**
   * Checks whether the given URL request matches this filter without checking
   * the filter's domains.
   * @param {URLRequest} request
   * @param {number} typeMask
   * @param {string} [sitekey]
   * @return {boolean}
   * @package
   */
  matchesWithoutDomain(request, typeMask, sitekey)
  {
    return (this.contentType & typeMask) != 0 &&
           (this.thirdParty == null || this.thirdParty == request.thirdParty) &&
           this.matchesLocation(request) &&
           (!this.sitekeys ||
            (sitekey && this.sitekeys.includes(sitekey.toUpperCase())));
  },

  /**
   * Checks whether the given URL request matches this filter's pattern.
   * @param {URLRequest} request The URL request to check.
   * @returns {boolean} <code>true</code> if the URL request matches.
   * @package
   */
  matchesLocation(request)
  {
    let location = this.matchCase ? request.href : request.lowerCaseHref;

    let {regexp} = this;

    if (regexp)
      return regexp.test(location);

    let {pattern} = this;

    let startsWithAnchor = pattern[0] == "|";
    let startsWithDoubleAnchor = startsWithAnchor && pattern[1] == "|";
    let endsWithSeparator = pattern[pattern.length - 1] == "^";
    let endsWithAnchor = !endsWithSeparator &&
                         pattern[pattern.length - 1] == "|";

    if (startsWithDoubleAnchor)
      pattern = pattern.substr(2);
    else if (startsWithAnchor)
      pattern = pattern.substr(1);

    if (endsWithSeparator || endsWithAnchor)
      pattern = pattern.slice(0, -1);

    let index = location.indexOf(pattern);

    // The "||" prefix requires that the text that follows does not start
    // with a forward slash.
    return index != -1 &&
           (startsWithDoubleAnchor ?
              (location[index] != "/" &&
               doubleAnchorRegExp.test(location.substring(0, index))) :
              startsWithAnchor ?
                index == 0 :
                true) &&
           (endsWithSeparator ?
              (!location[index + pattern.length] ||
               separatorRegExp.test(location[index + pattern.length])) :
              endsWithAnchor ?
                index == location.length - pattern.length :
                true);
  },

  /**
   * Checks whether this filter has only a URL pattern and no content type,
   * third-party flag, domains, or sitekeys.
   * @returns {boolean}
   */
  isLocationOnly()
  {
    return this.contentType == RegExpFilter.prototype.contentType &&
           this.thirdParty == null &&
           !this.domainSource && !this.sitekeySource &&
           !this.domains && !this.sitekeys;
  }
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
  if (text[0] == "@" && text[1] == "@")
  {
    blocking = false;
    text = text.substring(2);
  }

  let contentType = null;
  let matchCase = null;
  let domains = null;
  let sitekeys = null;
  let thirdParty = null;
  let csp = null;
  let rewrite = null;
  let options;
  let match = text.includes("$") ? Filter.optionsRegExp.exec(text) : null;
  if (match)
  {
    options = match[1].split(",");
    text = match.input.substring(0, match.index);
    for (let option of options)
    {
      let value = null;
      let separatorIndex = option.indexOf("=");
      if (separatorIndex >= 0)
      {
        value = option.substring(separatorIndex + 1);
        option = option.substring(0, separatorIndex);
      }

      let inverse = option[0] == "~";
      if (inverse)
        option = option.substring(1);

      let type = RegExpFilter.typeMap[option.replace(/-/, "_").toUpperCase()];
      if (type)
      {
        if (inverse)
        {
          if (contentType == null)
            ({contentType} = RegExpFilter.prototype);
          contentType &= ~type;
        }
        else
        {
          contentType |= type;

          if (type == RegExpFilter.typeMap.CSP)
          {
            if (blocking && !value)
              return new InvalidFilter(origText, "filter_invalid_csp");
            csp = value;
          }
        }
      }
      else
      {
        switch (option.toLowerCase())
        {
          case "match-case":
            matchCase = !inverse;
            break;
          case "domain":
            if (!value)
              return new InvalidFilter(origText, "filter_unknown_option");
            domains = value;
            break;
          case "third-party":
            thirdParty = !inverse;
            break;
          case "sitekey":
            if (!value)
              return new InvalidFilter(origText, "filter_unknown_option");
            sitekeys = value.toUpperCase();
            break;
          case "rewrite":
            if (value == null)
              return new InvalidFilter(origText, "filter_unknown_option");
            if (!value.startsWith("abp-resource:"))
              return new InvalidFilter(origText, "filter_invalid_rewrite");
            rewrite = value.substring("abp-resource:".length);
            break;
          default:
            return new InvalidFilter(origText, "filter_unknown_option");
        }
      }
    }
  }

  try
  {
    if (blocking)
    {
      if (csp && Filter.invalidCSPRegExp.test(csp))
        return new InvalidFilter(origText, "filter_invalid_csp");

      if (rewrite)
      {
        if (text[0] == "|" && text[1] == "|")
        {
          if (!domains && thirdParty != false)
            return new InvalidFilter(origText, "filter_invalid_rewrite");
        }
        else if (text[0] == "*")
        {
          if (!domains)
            return new InvalidFilter(origText, "filter_invalid_rewrite");
        }
        else
        {
          return new InvalidFilter(origText, "filter_invalid_rewrite");
        }
      }

      return new BlockingFilter(origText, text, contentType, matchCase, domains,
                                thirdParty, sitekeys, rewrite, csp);
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
 * @param {string} text see {@link Filter Filter()}
 * @param {string} regexpSource see {@link RegExpFilter RegExpFilter()}
 * @param {number} [contentType] see {@link RegExpFilter RegExpFilter()}
 * @param {boolean} [matchCase] see {@link RegExpFilter RegExpFilter()}
 * @param {string} [domains] see {@link RegExpFilter RegExpFilter()}
 * @param {boolean} [thirdParty] see {@link RegExpFilter RegExpFilter()}
 * @param {string} [sitekeys] see {@link RegExpFilter RegExpFilter()}
 * @param {?string} [rewrite]
 *   The name of the internal resource to which to rewrite the
 *   URL. e.g. if the value of the <code>$rewrite</code> option is
 *   <code>abp-resource:blank-html</code>, this should be
 *   <code>blank-html</code>.
 * @param {string} [csp]
 *   Content Security Policy to inject when the filter matches
 * @constructor
 * @augments RegExpFilter
 */
function BlockingFilter(text, regexpSource, contentType, matchCase, domains,
                        thirdParty, sitekeys, rewrite, csp)
{
  RegExpFilter.call(this, text, regexpSource, contentType, matchCase, domains,
                    thirdParty, sitekeys, rewrite);

  if (csp != null)
    this.csp = csp;
}
exports.BlockingFilter = BlockingFilter;

BlockingFilter.prototype = extend(RegExpFilter, {
  type: "blocking",

  /**
   * Content Security Policy to inject for matching requests.
   * @type {?string}
   */
  csp: null,

  /**
   * Rewrites an URL.
   * @param {string} url the URL to rewrite
   * @return {string} the rewritten URL, or the original in case of failure
   */
  rewriteUrl(url)
  {
    return resourceMap.get(this.rewrite) || url;
  }
});

/**
 * Class for whitelist filters
 * @param {string} text see {@link Filter Filter()}
 * @param {string} regexpSource see {@link RegExpFilter RegExpFilter()}
 * @param {number} [contentType] see {@link RegExpFilter RegExpFilter()}
 * @param {boolean} [matchCase] see {@link RegExpFilter RegExpFilter()}
 * @param {string} [domains] see {@link RegExpFilter RegExpFilter()}
 * @param {boolean} [thirdParty] see {@link RegExpFilter RegExpFilter()}
 * @param {string} [sitekeys] see {@link RegExpFilter RegExpFilter()}
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
 * Base class for content filters
 * @param {string} text see {@link Filter Filter()}
 * @param {string} [domains] Host names or domains the filter should be
 *                           restricted to
 * @param {string} body      The body of the filter
 * @constructor
 * @augments ActiveFilter
 */
function ContentFilter(text, domains, body)
{
  ActiveFilter.call(this, text, domains || null);

  this.body = body;
}
exports.ContentFilter = ContentFilter;

ContentFilter.prototype = extend(ActiveFilter, {
  /**
   * @see ActiveFilter.domainSeparator
   */
  domainSeparator: ",",

  /**
   * The body of the filter
   * @type {string}
   */
  body: null
});

/**
 * Creates a content filter from a pre-parsed text representation
 *
 * @param {string} text         same as in Filter()
 * @param {string} [domains]
 *   domains part of the text representation
 * @param {string} [type]
 *   rule type, either:
 *     <li>"" for an element hiding filter</li>
 *     <li>"@" for an element hiding exception filter</li>
 *     <li>"?" for an element hiding emulation filter</li>
 *     <li>"$" for a snippet filter</li>
 * @param {string} body
 *   body part of the text representation, either a CSS selector or a snippet
 *   script
 * @return {ElemHideFilter|ElemHideException|
 *          ElemHideEmulationFilter|SnippetFilter|InvalidFilter}
 */
ContentFilter.fromText = function(text, domains, type, body)
{
  // We don't allow content filters which have any empty domains.
  // Note: The ContentFilter.prototype.domainSeparator is duplicated here, if
  // that changes this must be changed too.
  if (domains && /(^|,)~?(,|$)/.test(domains))
    return new InvalidFilter(text, "filter_invalid_domain");

  if (type == "@")
    return new ElemHideException(text, domains, body);

  if (type == "?" || type == "$")
  {
    // Element hiding emulation and snippet filters are inefficient so we need
    // to make sure that they're only applied if they specify active domains
    if (!(/,[^~][^,.]*\.[^,]/.test("," + domains) ||
          ("," + domains + ",").includes(",localhost,")))
    {
      return new InvalidFilter(text, type == "?" ?
                                       "filter_elemhideemulation_nodomain" :
                                       "filter_snippet_nodomain");
    }

    if (type == "?")
      return new ElemHideEmulationFilter(text, domains, body);

    return new SnippetFilter(text, domains, body);
  }

  return new ElemHideFilter(text, domains, body);
};

/**
 * Base class for element hiding filters
 * @param {string} text see {@link Filter Filter()}
 * @param {string} [domains] see {@link ContentFilter ContentFilter()}
 * @param {string} selector  CSS selector for the HTML elements that should be
 *                           hidden
 * @constructor
 * @augments ContentFilter
 */
function ElemHideBase(text, domains, selector)
{
  ContentFilter.call(this, text, domains, selector);
}
exports.ElemHideBase = ElemHideBase;

ElemHideBase.prototype = extend(ContentFilter, {
  /**
   * CSS selector for the HTML elements that should be hidden
   * @type {string}
   */
  get selector()
  {
    return this.body;
  }
});

/**
 * Class for element hiding filters
 * @param {string} text see {@link Filter Filter()}
 * @param {string} [domains]  see {@link ElemHideBase ElemHideBase()}
 * @param {string} selector see {@link ElemHideBase ElemHideBase()}
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
 * @param {string} text see {@link Filter Filter()}
 * @param {string} [domains]  see {@link ElemHideBase ElemHideBase()}
 * @param {string} selector see {@link ElemHideBase ElemHideBase()}
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
 * @param {string} text           see {@link Filter Filter()}
 * @param {string} domains        see {@link ElemHideBase ElemHideBase()}
 * @param {string} selector       see {@link ElemHideBase ElemHideBase()}
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

/**
 * Class for snippet filters
 * @param {string} text see Filter()
 * @param {string} [domains] see ContentFilter()
 * @param {string} script    Script that should be executed
 * @constructor
 * @augments ContentFilter
 */
function SnippetFilter(text, domains, script)
{
  ContentFilter.call(this, text, domains, script);
}
exports.SnippetFilter = SnippetFilter;

SnippetFilter.prototype = extend(ContentFilter, {
  type: "snippet",

  /**
   * Script that should be executed
   * @type {string}
   */
  get script()
  {
    return this.body;
  }
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
 * @fileOverview This component manages listeners and calls them to distribute
 * messages about filter changes.
 */

const {EventEmitter} = __webpack_require__(6);

/**
 * This object allows registering and triggering listeners for filter events.
 * @type {EventEmitter}
 */
let filterNotifier = new EventEmitter();

exports.filterNotifier = filterNotifier;


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



const info = __webpack_require__(3);
const {EventEmitter} = __webpack_require__(6);

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
defaults.subscriptions_fallbackurl = "https://adblockplus.org/getSubscription?version=%VERSION%&url=%SUBSCRIPTION%&downloadURL=%URL%&error=%ERROR%&responseStatus=%RESPONSESTATUS%";
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
 * Used to ensure the anti-circumvention subscription is opted in by default.
 * @type {boolean}
 */
defaults.subscriptions_addedanticv = false;
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
 * Prevents unsolicited UI elements from showing up after installation. This
 * preference isn't set by the extension but can be pre-configured externally.
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
      let oldValue = overrides[preference];
      delete overrides[preference];

      // Firefox 66 fails to emit storage.local.onChanged events for falsey
      // values. https://bugzilla.mozilla.org/show_bug.cgi?id=1541449
      if (!oldValue &&
          info.platform == "gecko" && parseInt(info.platformVersion, 10) == 66)
      {
        onChanged({[prefToKey(preference)]: {oldValue}}, "local");
      }

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
if (info.platform == "gecko")
{
  // Saving one storage value causes all others to be saved as well for
  // Firefox versions <66. Make sure that updating ad counter doesn't cause
  // the filters data to be saved frequently as a side-effect.
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
            promise = null;
            savePref(pref).then(resolve, reject);
          },
          60 * 1000
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

function onChanged(changes)
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
    browser.storage.onChanged.addListener(onChanged);
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
    application = {OPR: "opera", Edg: "edge"}[app] || app.toLowerCase();
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
exports.addonVersion = "4.3.1";

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
 * @fileOverview Definition of Subscription class and its subclasses.
 */

const {recommendations} = __webpack_require__(45);
const {ActiveFilter, BlockingFilter,
       WhitelistFilter, ElemHideBase} = __webpack_require__(0);
const {filterNotifier} = __webpack_require__(1);
const {extend} = __webpack_require__(25);

/**
 * Subscription types by URL.
 *
 * @type {Map.<string, string>}
 */
let typesByURL = new Map(
  (function*()
  {
    for (let {type, url} of recommendations())
      yield [url, type];
  })()
);

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

  this._filterText = [];
  this._filterTextIndex = new Set();

  if (title)
    this._title = title;

  Subscription.knownSubscriptions.set(url, this);
}
exports.Subscription = Subscription;

Subscription.prototype =
{
  /**
   * Download location of the subscription
   * @type {string}
   */
  url: null,

  _type: null,

  /**
   * Type of the subscription
   * @type {?string}
   */
  get type()
  {
    return this._type;
  },

  /**
   * Filter text contained in the filter subscription.
   * @type {Array.<string>}
   * @private
   */
  _filterText: null,

  /**
   * A searchable index of filter text in the filter subscription.
   * @type {Set.<string>}
   * @private
   */
  _filterTextIndex: null,

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
      filterNotifier.emit("subscription.title", this, value, oldValue);
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
      filterNotifier.emit("subscription.fixedTitle", this, value, oldValue);
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
      filterNotifier.emit("subscription.disabled", this, value, oldValue);
    }
    return this._disabled;
  },

  /**
   * The number of filters in the subscription.
   * @type {number}
   */
  get filterCount()
  {
    return this._filterText.length;
  },

  /**
   * Returns an iterator that yields the text for each filter in the
   * subscription.
   * @returns {Iterator.<string>}
   */
  filterText()
  {
    return this._filterText[Symbol.iterator]();
  },

  /**
   * Checks whether the subscription has the given filter text.
   * @param {string} filterText
   * @returns {boolean}
   * @package
   */
  hasFilterText(filterText)
  {
    return this._filterTextIndex.has(filterText);
  },

  /**
   * Returns the filter text at the given 0-based index.
   * @param {number} index
   * @returns {?Filter}
   */
  filterTextAt(index)
  {
    return this._filterText[index] || null;
  },

  /**
   * Returns the 0-based index of the given filter.
   * @param {Filter} filter
   * @param {number} [fromIndex] The index from which to start the search.
   * @return {number}
   */
  findFilterIndex(filter, fromIndex = 0)
  {
    return this._filterText.indexOf(filter.text, fromIndex);
  },

  /**
   * Removes all filters from the subscription.
   */
  clearFilters()
  {
    this._filterText = [];
    this._filterTextIndex.clear();
  },

  /**
   * Adds a filter to the subscription.
   * @param {Filter} filter
   */
  addFilter(filter)
  {
    this._filterText.push(filter.text);
    this._filterTextIndex.add(filter.text);
  },

  /**
   * Inserts a filter into the subscription.
   * @param {Filter} filter
   * @param {number} index The index at which to insert the filter.
   */
  insertFilterAt(filter, index)
  {
    this._filterText.splice(index, 0, filter.text);
    this._filterTextIndex.add(filter.text);
  },

  /**
   * Deletes a filter from the subscription.
   * @param {number} index The index at which to delete the filter.
   */
  deleteFilterAt(index)
  {
    // Ignore index if out of bounds on the negative side, for consistency.
    if (index < 0)
      return;

    let [filterText] = this._filterText.splice(index, 1);
    if (!this._filterText.includes(filterText))
      this._filterTextIndex.delete(filterText);
  },

  /**
   * Updates the filter text of the subscription.
   * @param {Array.<string>} filterText The new filter text.
   * @returns {{added: Array.<string>, removed: Array.<string>}} An object
   *   containing two lists of the text of added and removed filters
   *   respectively.
   * @package
   */
  updateFilterText(filterText)
  {
    let added = [];
    let removed = [];

    if (this._filterText.length == 0)
    {
      added = [...filterText];
    }
    else if (filterText.length > 0)
    {
      for (let text of filterText)
      {
        if (!this._filterTextIndex.has(text))
          added.push(text);
      }
    }

    this._filterTextIndex = new Set(filterText);

    if (filterText.length == 0)
    {
      removed = [...this._filterText];
    }
    else if (this._filterText.length > 0)
    {
      for (let text of this._filterText)
      {
        if (!this._filterTextIndex.has(text))
          removed.push(text);
      }
    }

    this._filterText = [...filterText];

    return {added, removed};
  },

  /**
   * Serializes the subscription for writing out on disk.
   * @yields {string}
   */
  *serialize()
  {
    let {url, _title, _fixedTitle, _disabled} = this;

    yield "[Subscription]";
    yield "url=" + url;

    if (_title)
      yield "title=" + _title;
    if (_fixedTitle)
      yield "fixedTitle=true";
    if (_disabled)
      yield "disabled=true";
  },

  *serializeFilters()
  {
    let {_filterText} = this;

    yield "[Subscription filters]";

    for (let text of _filterText)
      yield text.replace(/\[/g, "\\[");
  },

  toString()
  {
    return [...this.serialize()].join("\n");
  }
};

/**
 * Cache for known filter subscriptions, maps URL to subscription objects.
 * @type {Map.<string,Subscription>}
 */
Subscription.knownSubscriptions = new Map();

/**
 * Returns a subscription from its URL, creates a new one if necessary.
 * @param {string} url
 *   URL of the subscription
 * @return {Subscription}
 *   subscription or null if the subscription couldn't be created
 */
Subscription.fromURL = function(url)
{
  let subscription = Subscription.knownSubscriptions.get(url);
  if (subscription)
    return subscription;

  if (url[0] != "~")
  {
    subscription = new DownloadableSubscription(url, null);

    let type = typesByURL.get(url);
    if (typeof type != "undefined")
      subscription._type = type;

    return subscription;
  }

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

    let type = typesByURL.get(obj.url);
    if (typeof type != "undefined")
      result._type = type;
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
 * @param {string} url see {@link Subscription Subscription()}
 * @param {string} [title]  see {@link Subscription Subscription()}
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
        if (filter instanceof SpecialSubscription.defaultsMap.get(type))
          return true;
        if (!(filter instanceof ActiveFilter) && type == "blocking")
          return true;
      }
    }

    return false;
  },

  /**
   * See Subscription.serialize()
   * @inheritdoc
   */
  *serialize()
  {
    let {defaults, _lastDownload} = this;

    yield* Subscription.prototype.serialize.call(this);

    if (defaults)
    {
      yield "defaults=" +
            defaults.filter(
              type => SpecialSubscription.defaultsMap.has(type)
            ).join(" ");
    }
    if (_lastDownload)
      yield "lastDownload=" + _lastDownload;
  }
});

SpecialSubscription.defaultsMap = new Map([
  ["whitelist", WhitelistFilter],
  ["blocking", BlockingFilter],
  ["elemhide", ElemHideBase]
]);

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
  } while (Subscription.knownSubscriptions.has(url));
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
  subscription.addFilter(filter);
  for (let [type, class_] of SpecialSubscription.defaultsMap)
  {
    if (filter instanceof class_)
      subscription.defaults = [type];
  }
  if (!subscription.defaults)
    subscription.defaults = ["blocking"];
  return subscription;
};

/**
 * Abstract base class for regular filter subscriptions (both
 * internally and externally updated)
 * @param {string} url    see {@link Subscription Subscription()}
 * @param {string} [title]  see {@link Subscription Subscription()}
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
      filterNotifier.emit("subscription.homepage", this, value, oldValue);
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
      filterNotifier.emit("subscription.lastDownload", this, value, oldValue);
    }
    return this._lastDownload;
  },

  /**
   * See Subscription.serialize()
   * @inheritdoc
   */
  *serialize()
  {
    let {_homepage, _lastDownload} = this;

    yield* Subscription.prototype.serialize.call(this);

    if (_homepage)
      yield "homepage=" + _homepage;
    if (_lastDownload)
      yield "lastDownload=" + _lastDownload;
  }
});

/**
 * Class for filter subscriptions updated externally (by other extension)
 * @param {string} url    see {@link Subscription Subscription()}
 * @param {string} [title]  see {@link Subscription Subscription()}
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
  *serialize() // eslint-disable-line require-yield
  {
    throw new Error(
      "Unexpected call, external subscriptions should not be serialized"
    );
  }
});

/**
 * Class for filter subscriptions updated externally (by other extension)
 * @param {string} url  see {@link Subscription Subscription()}
 * @param {string} [title]  see {@link Subscription Subscription()}
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
    filterNotifier.emit("subscription.downloadStatus", this, value, oldValue);
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
      filterNotifier.emit("subscription.lastCheck", this, value, oldValue);
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
      filterNotifier.emit("subscription.errors", this, value, oldValue);
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
  *serialize()
  {
    let {downloadStatus, lastSuccess, lastCheck, expires,
         softExpiration, errors, version, requiredVersion,
         downloadCount} = this;

    yield* RegularSubscription.prototype.serialize.call(this);

    if (downloadStatus)
      yield "downloadStatus=" + downloadStatus;
    if (lastSuccess)
      yield "lastSuccess=" + lastSuccess;
    if (lastCheck)
      yield "lastCheck=" + lastCheck;
    if (expires)
      yield "expires=" + expires;
    if (softExpiration)
      yield "softExpiration=" + softExpiration;
    if (errors)
      yield "errors=" + errors;
    if (version)
      yield "version=" + version;
    if (requiredVersion)
      yield "requiredVersion=" + requiredVersion;
    if (downloadCount)
      yield "downloadCount=" + downloadCount;
  }
});


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
 * @fileOverview <code>filterStorage</code> object responsible for managing the
 * user's subscriptions and filters.
 */

const {IO} = __webpack_require__(42);
const {Prefs} = __webpack_require__(2);
const {Utils} = __webpack_require__(12);
const {Filter, ActiveFilter} = __webpack_require__(0);
const {Subscription, SpecialSubscription,
       ExternalSubscription} = __webpack_require__(4);
const {filterNotifier} = __webpack_require__(1);
const {INIParser} = __webpack_require__(47);

/**
 * Version number of the filter storage file format.
 * @type {number}
 */
const FORMAT_VERSION = 5;

/**
 * {@link filterStorage} implementation.
 */
class FilterStorage
{
  /**
   * @hideconstructor
   */
  constructor()
  {
    /**
     * Will be set to true after the initial {@link FilterStorage#loadFromDisk}
     * call completes.
     * @type {boolean}
     */
    this.initialized = false;

    /**
     * Will be set to <code>true</code> if no <code>patterns.ini</code> file
     * exists.
     * @type {boolean}
     */
    this.firstRun = false;

    /**
     * Map of properties listed in the filter storage file before the sections
     * start. Right now this should be only the format version.
     * @type {object}
     */
    this.fileProperties = Object.create(null);

    /**
     * Map of subscriptions already on the list, by their URL/identifier.
     * @type {Map.<string,Subscription>}
     */
    this.knownSubscriptions = new Map();

    /**
     * Will be set to true if {@link FilterStorage#saveToDisk} is running
     * (reentrance protection).
     * @type {boolean}
     * @private
     */
    this._saving = false;

    /**
     * Will be set to true if a {@link FilterStorage#saveToDisk} call arrives
     * while {@link FilterStorage#saveToDisk} is already running (delayed
     * execution).
     * @type {boolean}
     * @private
     */
    this._needsSave = false;
  }

  /**
   * The version number of the <code>patterns.ini</code> format used.
   * @type {number}
   */
  get formatVersion()
  {
    return FORMAT_VERSION;
  }

  /**
   * The file containing the subscriptions.
   * @type {string}
   */
  get sourceFile()
  {
    return "patterns.ini";
  }

  /**
   * Yields subscriptions in the storage.
   * @param {?string} [filterText] The filter text for which to look. If
   *   specified, the function yields only those subscriptions that contain the
   *   given filter text. By default the function yields all subscriptions.
   * @yields {Subscription}
   */
  *subscriptions(filterText = null)
  {
    if (filterText == null)
    {
      yield* this.knownSubscriptions.values();
    }
    else
    {
      for (let subscription of this.knownSubscriptions.values())
      {
        if (subscription.hasFilterText(filterText))
          yield subscription;
      }
    }
  }

  /**
   * Returns the number of subscriptions in the storage.
   * @param {?string} [filterText] The filter text for which to look. If
   *   specified, the function counts only those subscriptions that contain the
   *   given filter text. By default the function counts all subscriptions.
   * @returns {number}
   */
  getSubscriptionCount(filterText = null)
  {
    if (filterText == null)
      return this.knownSubscriptions.size;

    let count = 0;
    for (let subscription of this.knownSubscriptions.values())
    {
      if (subscription.hasFilterText(filterText))
        count++;
    }
    return count;
  }

  /**
   * Finds the filter group that a filter should be added to by default. Will
   * return <code>null</code> if this group doesn't exist yet.
   * @param {Filter} filter
   * @returns {?SpecialSubscription}
   */
  getGroupForFilter(filter)
  {
    let generalSubscription = null;
    for (let subscription of this.knownSubscriptions.values())
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
  }

  /**
   * Adds a subscription to the storage.
   * @param {Subscription} subscription The subscription to be added.
   */
  addSubscription(subscription)
  {
    if (this.knownSubscriptions.has(subscription.url))
      return;

    this.knownSubscriptions.set(subscription.url, subscription);

    filterNotifier.emit("subscription.added", subscription);
  }

  /**
   * Removes a subscription from the storage.
   * @param {Subscription} subscription The subscription to be removed.
   */
  removeSubscription(subscription)
  {
    if (!this.knownSubscriptions.has(subscription.url))
      return;

    this.knownSubscriptions.delete(subscription.url);

    // This should be the last remaining reference to the Subscription
    // object.
    Subscription.knownSubscriptions.delete(subscription.url);

    filterNotifier.emit("subscription.removed", subscription);
  }

  /**
   * Replaces the list of filters in a subscription with a new list.
   * @param {Subscription} subscription The subscription to be updated.
   * @param {Array.<string>} filterText The new filter text.
   */
  updateSubscriptionFilters(subscription, filterText)
  {
    filterNotifier.emit("subscription.updated", subscription,
                        subscription.updateFilterText(filterText));
  }

  /**
   * Adds a user-defined filter to the storage.
   * @param {Filter} filter
   * @param {?SpecialSubscription} [subscription] The subscription that the
   *   filter should be added to.
   * @param {number} [position] The position within the subscription at which
   *   the filter should be added. If not specified, the filter is added at the
   *   end of the subscription.
   */
  addFilter(filter, subscription, position)
  {
    if (!subscription)
    {
      for (let currentSubscription of this.subscriptions(filter.text))
      {
        if (currentSubscription instanceof SpecialSubscription &&
            !currentSubscription.disabled)
        {
          return;   // No need to add
        }
      }
      subscription = this.getGroupForFilter(filter);
    }
    if (!subscription)
    {
      // No group for this filter exists, create one
      subscription = SpecialSubscription.createForFilter(filter);
      this.addSubscription(subscription);
      return;
    }

    if (typeof position == "undefined")
      position = subscription.filterCount;

    subscription.insertFilterAt(filter, position);
    filterNotifier.emit("filter.added", filter, subscription, position);
  }

  /**
   * Removes a user-defined filter from the storage.
   * @param {Filter} filter
   * @param {?SpecialSubscription} [subscription] The subscription that the
   *   filter should be removed from. If not specified, the filter will be
   *   removed from all subscriptions.
   * @param {number} [position] The position within the subscription at which
   *   the filter should be removed. If not specified, all instances of the
   *   filter will be removed.
   */
  removeFilter(filter, subscription, position)
  {
    let subscriptions = (
      subscription ? [subscription] : this.subscriptions(filter.text)
    );
    for (let currentSubscription of subscriptions)
    {
      if (currentSubscription instanceof SpecialSubscription)
      {
        let positions = [];
        if (typeof position == "undefined")
        {
          let index = -1;
          do
          {
            index = currentSubscription.findFilterIndex(filter, index + 1);
            if (index >= 0)
              positions.push(index);
          } while (index >= 0);
        }
        else
          positions.push(position);

        for (let j = positions.length - 1; j >= 0; j--)
        {
          let currentPosition = positions[j];
          let currentFilterText =
            currentSubscription.filterTextAt(currentPosition);
          if (currentFilterText && currentFilterText == filter.text)
          {
            currentSubscription.deleteFilterAt(currentPosition);
            filterNotifier.emit("filter.removed", filter, currentSubscription,
                                currentPosition);
          }
        }
      }
    }
  }

  /**
   * Moves a user-defined filter to a new position.
   * @param {Filter} filter
   * @param {SpecialSubscription} subscription The subscription where the
   *   filter is located.
   * @param {number} oldPosition The current position of the filter.
   * @param {number} newPosition The new position of the filter.
   */
  moveFilter(filter, subscription, oldPosition, newPosition)
  {
    if (!(subscription instanceof SpecialSubscription))
      return;

    let currentFilterText = subscription.filterTextAt(oldPosition);
    if (!currentFilterText || currentFilterText != filter.text)
      return;

    newPosition = Math.min(Math.max(newPosition, 0),
                           subscription.filterCount - 1);
    if (oldPosition == newPosition)
      return;

    subscription.deleteFilterAt(oldPosition);
    subscription.insertFilterAt(filter, newPosition);
    filterNotifier.emit("filter.moved", filter, subscription, oldPosition,
                        newPosition);
  }

  /**
   * Increases the hit count for a filter by one.
   * @param {Filter} filter
   */
  increaseHitCount(filter)
  {
    if (!Prefs.savestats || !(filter instanceof ActiveFilter))
      return;

    filter.hitCount++;
    filter.lastHit = Date.now();
  }

  /**
   * Resets hit count for some filters.
   * @param {?Array.<Filter>} [filters] The filters to be reset. If not
   *   specified, all filters will be reset.
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
  }

  /**
   * @callback TextSink
   * @param {string?} line
   */

  /**
   * Allows importing previously serialized filter data.
   * @param {boolean} silent If <code>true</code>, no "load" notification will
   *   be sent out.
   * @returns {TextSink} The function to be called for each line of data.
   *   Calling it with <code>null</code> as the argument finalizes the import
   *   and replaces existing data. No changes will be applied before
   *   finalization, so import can be "aborted" by forgetting this callback.
   */
  importData(silent)
  {
    let parser = new INIParser();
    return line =>
    {
      parser.process(line);
      if (line === null)
      {
        let knownSubscriptions = new Map();
        for (let subscription of parser.subscriptions)
          knownSubscriptions.set(subscription.url, subscription);

        this.fileProperties = parser.fileProperties;
        this.knownSubscriptions = knownSubscriptions;
        Filter.knownFilters = parser.knownFilters;
        Subscription.knownSubscriptions = parser.knownSubscriptions;

        if (!silent)
          filterNotifier.emit("load");
      }
    };
  }

  /**
   * Loads all subscriptions from disk.
   * @returns {Promise} A promise resolved or rejected when loading is complete.
   */
  loadFromDisk()
  {
    let tryBackup = backupIndex =>
    {
      return this.restoreBackup(backupIndex, true).then(() =>
      {
        if (this.knownSubscriptions.size == 0)
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
        if (this.knownSubscriptions.size == 0)
        {
          // No filter subscriptions in the file, this isn't right.
          throw new Error("No data in the file");
        }
      });
    }).catch(error =>
    {
      Utils.logError(error);
      return tryBackup(1);
    }).then(() =>
    {
      this.initialized = true;
      filterNotifier.emit("load");
    });
  }

  /**
   * Constructs the file name for a <code>patterns.ini</code> backup.
   * @param {number} backupIndex Number of the backup file (1 being the most
   *   recent).
   * @returns {string} Backup file name.
   */
  getBackupName(backupIndex)
  {
    let [name, extension] = this.sourceFile.split(".", 2);
    return (name + "-backup" + backupIndex + "." + extension);
  }

  /**
   * Restores an automatically created backup.
   * @param {number} backupIndex Number of the backup to restore (1 being the
   *   most recent).
   * @param {boolean} silent If <code>true</code>, no "load" notification will
   *   be sent out.
   * @returns {Promise} A promise resolved or rejected when restoration is
   *   complete.
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
  }

  /**
   * Generator serializing filter data and yielding it line by line.
   * @yields {string}
   */
  *exportData()
  {
    // Do not persist external subscriptions
    let subscriptions = [];
    for (let subscription of this.subscriptions())
    {
      if (!(subscription instanceof ExternalSubscription) &&
          !(subscription instanceof SpecialSubscription &&
            subscription.filterCount == 0))
      {
        subscriptions.push(subscription);
      }
    }

    yield "# Adblock Plus preferences";
    yield "version=" + this.formatVersion;

    let saved = new Set();

    // Save subscriptions
    for (let subscription of subscriptions)
    {
      yield* subscription.serialize();
      yield* subscription.serializeFilters();
    }

    // Save filter data
    for (let subscription of subscriptions)
    {
      for (let text of subscription.filterText())
      {
        if (!saved.has(text))
        {
          yield* Filter.fromText(text).serialize();
          saved.add(text);
        }
      }
    }
  }

  /**
   * Saves all subscriptions back to disk.
   * @returns {Promise} A promise resolved or rejected when saving is complete.
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
      Utils.logError(error);
    }).then(() =>
    {
      return IO.writeToFile(this.sourceFile, this.exportData());
    }).then(() =>
    {
      filterNotifier.emit("save");
    }).catch(error =>
    {
      // If saving failed, report error but continue - we still have to process
      // flags.
      Utils.logError(error);
    }).then(() =>
    {
      this._saving = false;
      if (this._needsSave)
      {
        this._needsSave = false;
        this.saveToDisk();
      }
    });
  }

  /**
   * @typedef FileInfo
   * @type {object}
   * @property {number} index
   * @property {number} lastModified
   */

  /**
   * Returns a promise resolving in a list of existing backup files.
   * @returns {Promise.<Array.<FileInfo>>}
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
        Utils.logError(error);
        return backups;
      });
    };

    return checkBackupFile(1);
  }
}

/**
 * Reads the user's filters from disk, manages them in memory, and writes them
 * back to disk.
 */
let filterStorage = new FilterStorage();

exports.filterStorage = filterStorage;


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



/**
 * Registers and emits named events.
 */
class EventEmitter
{
  constructor()
  {
    this._listeners = new Map();
  }

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
  }

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
      if (listeners.length > 1)
      {
        let idx = listeners.indexOf(listener);
        if (idx != -1)
          listeners.splice(idx, 1);
      }
      else if (listeners[0] === listener)
      {
        // We must use strict equality above for compatibility with
        // Array.prototype.indexOf
        this._listeners.delete(name);
      }
    }
  }

  /**
   * Adds a one time listener and returns a promise that
   * is resolved the next time the specified event is emitted.
   *
   * @param {string} name
   * @returns {Promise}
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
  }

  /**
   * Returns a copy of the array of listeners for the specified event.
   *
   * @param {string} name
   * @returns {Array.<function>}
   */
  listeners(name)
  {
    let listeners = this._listeners.size > 0 ? this._listeners.get(name) : null;
    return listeners ? listeners.slice() : [];
  }

  /**
   * Checks whether there are any listeners for the specified event.
   *
   * @param {string} [name] The name of the event. If omitted, checks whether
   *   there are any listeners for any event.
   * @returns {boolean}
   */
  hasListeners(name)
  {
    return this._listeners.size > 0 &&
           (typeof name == "undefined" || this._listeners.has(name));
  }

  /**
   * Calls all previously added listeners for the given event name.
   *
   * @param {string} name
   * @param {...*}   [args]
   */
  emit(name, ...args)
  {
    let listeners = this._listeners.size > 0 ? this._listeners.get(name) : null;
    if (listeners)
    {
      for (let listener of listeners.slice())
        listener(...args);
    }
  }
}

exports.EventEmitter = EventEmitter;


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



const {EventEmitter} = __webpack_require__(6);

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
      else
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

/** @module url */



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
    let {hostname} = frame.url;
    if (hostname)
      return hostname;
  }

  return originUrl ? originUrl.hostname : "";
};


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

/** @module whitelisting */



const {defaultMatcher} = __webpack_require__(11);
const {Filter, RegExpFilter} = __webpack_require__(0);
const {filterNotifier} = __webpack_require__(1);
const {filterStorage} = __webpack_require__(5);
const {extractHostFromFrame} = __webpack_require__(8);
const {port} = __webpack_require__(7);
const {logWhitelistedDocument} = __webpack_require__(13);
const {verifySignature} = __webpack_require__(49);

let sitekeys = new ext.PageMap();

function match(page, url, typeMask, docDomain, sitekey)
{
  if (!docDomain)
    docDomain = url.hostname;

  let filter = defaultMatcher.matchesAny(url, typeMask, docDomain, sitekey);

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
  if (filterStorage.getSubscriptionCount(filter.text) && filter.disabled)
  {
    filter.disabled = false;
  }
  else
  {
    filter.disabled = false;
    filterStorage.addFilter(filter);
  }
});

port.on("filters.unwhitelist", message =>
{
  let page = new ext.Page(message.tab);
  // Remove any exception rules applying to this URL
  let filter = checkWhitelisted(page);
  while (filter)
  {
    filterStorage.removeFilter(filter);
    if (filterStorage.getSubscriptionCount(filter.text))
      filter.disabled = true;
    filter = checkWhitelisted(page);
  }
});

function revalidateWhitelistingState(page)
{
  filterNotifier.emit(
    "page.WhitelistingStateRevalidate",
    page, checkWhitelisted(page)
  );
}

filterNotifier.on("filter.behaviorChanged", () =>
{
  browser.tabs.query({}).then(tabs =>
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
             self.navigator.userAgent;
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



const publicSuffixes = __webpack_require__(43);

/**
 * Map of public suffixes to their offsets.
 * @type {Map.<string,number>}
 */
let publicSuffixMap = buildPublicSuffixMap();

/**
 * Builds a map of public suffixes to their offsets.
 * @returns {Map.<string,number>}
 */
function buildPublicSuffixMap()
{
  let map = new Map();

  for (let key in publicSuffixes)
    map.set(key, publicSuffixes[key]);

  return map;
}

/**
 * A <code>URLInfo</code> object represents information about a URL. It is
 * returned by <code>{@link parseURL}</code>.
 */
class URLInfo
{
  /**
   * Creates a <code>URLInfo</code> object.
   *
   * @param {string} href The entire URL.
   * @param {string} protocol The protocol scheme of the URL, including the
   *   final <code>:</code>.
   * @param {string} [hostname] The hostname of the URL.
   *
   * @private
   */
  constructor(href, protocol, hostname = "")
  {
    this._href = href;
    this._protocol = protocol;
    this._hostname = hostname;
  }

  /**
   * The entire URL.
   * @type {string}
   */
  get href()
  {
    return this._href;
  }

  /**
   * The protocol scheme of the URL, including the final <code>:</code>.
   * @type {string}
   */
  get protocol()
  {
    return this._protocol;
  }

  /**
   * The hostname of the URL.
   * @type {string}
   */
  get hostname()
  {
    return this._hostname;
  }

  /**
   * Returns the entire URL.
   * @returns {string} The entire URL.
   */
  toString()
  {
    return this._href;
  }
}

/**
 * Parses a URL to extract the protocol and the hostname. This is a lightweight
 * alternative to the native <code>URL</code> object. Unlike the
 * <code>URL</code> object, this function is not robust and will give incorrect
 * results for invalid URLs. <em>Use this function with valid, normalized,
 * properly encoded (IDNA and percent-encoding) URLs only.</em>
 *
 * @param {string} url The URL to parse.
 * @returns {URLInfo} Information about the URL.
 */
function parseURL(url)
{
  let match = /^([^:]+:)(?:\/\/(?:[^/]*@)?(\[[^\]]*\]|[^:/]+))?/.exec(url);
  return new URLInfo(url, match[1], match[2]);
}

exports.parseURL = parseURL;

/**
 * Normalizes a hostname.
 * @param {string} hostname
 * @returns {string}
 */
function normalizeHostname(hostname)
{
  return hostname[hostname.length - 1] == "." ?
           hostname.replace(/\.+$/, "") : hostname;
}

exports.normalizeHostname = normalizeHostname;

/**
 * Yields all suffixes for a domain. For example, given the domain
 * <code>www.example.com</code>, this function yields
 * <code>www.example.com</code>, <code>example.com</code>, and
 * <code>com</code>, in that order.
 *
 * @param {string} domain The domain.
 * @param {boolean} [includeBlank] Whether to include the blank suffix at the
 *   end.
 *
 * @yields {string} The next suffix for the domain.
 */
function* domainSuffixes(domain, includeBlank = false)
{
  while (domain != "")
  {
    yield domain;

    let dotIndex = domain.indexOf(".");
    domain = dotIndex == -1 ? "" : domain.substr(dotIndex + 1);
  }

  if (includeBlank)
    yield "";
}

exports.domainSuffixes = domainSuffixes;

/**
 * Checks whether the given hostname is an IP address.
 *
 * @param {string} hostname
 * @returns {boolean}
 */
function isIPAddress(hostname)
{
  return (hostname[0] == "[" && hostname[hostname.length - 1] == "]") ||
         /^\d+(\.\d+){3}$/.test(hostname);
}

/**
 * Gets the base domain for the given hostname.
 *
 * @param {string} hostname
 * @returns {string}
 */
function getBaseDomain(hostname)
{
  let slices = [];
  let cutoff = NaN;

  for (let suffix of domainSuffixes(hostname))
  {
    slices.push(suffix);

    let offset = publicSuffixMap.get(suffix);

    if (typeof offset != "undefined")
    {
      cutoff = slices.length - 1 - offset;
      break;
    }
  }

  if (isNaN(cutoff))
    return slices.length > 2 ? slices[slices.length - 2] : hostname;

  if (cutoff <= 0)
    return hostname;

  return slices[cutoff];
}

exports.getBaseDomain = getBaseDomain;

/**
 * Checks whether a request's origin is different from its document's origin.
 *
 * @param {string} requestHostname The IDNA-encoded hostname of the request.
 * @param {string} documentHostname The IDNA-encoded hostname of the document.
 *
 * @returns {boolean}
 */
function isThirdParty(requestHostname, documentHostname)
{
  if (requestHostname[requestHostname.length - 1] == ".")
    requestHostname = requestHostname.replace(/\.+$/, "");

  if (documentHostname[documentHostname.length - 1] == ".")
    documentHostname = documentHostname.replace(/\.+$/, "");

  if (requestHostname == documentHostname)
    return false;

  if (!requestHostname || !documentHostname)
    return true;

  if (isIPAddress(requestHostname) || isIPAddress(documentHostname))
    return true;

  return getBaseDomain(requestHostname) != getBaseDomain(documentHostname);
}

exports.isThirdParty = isThirdParty;

/**
 * The <code>URLRequest</code> class represents a URL request.
 * @package
 */
class URLRequest
{
  /**
   * @private
   */
  URLRequest() {}

  /**
   * The URL of the request.
   * @type {string}
   */
  get href()
  {
    return this._href;
  }

  /**
   * Information about the URL of the request.
   * @type {URLInfo}
   */
  get urlInfo()
  {
    if (!this._urlInfo)
      this._urlInfo = parseURL(this._href);

    return this._urlInfo;
  }

  /**
   * The hostname of the document making the request.
   * @type {?string}
   */
  get documentHostname()
  {
    return this._documentHostname == null ? null : this._documentHostname;
  }

  /**
   * Whether this is a third-party request.
   * @type {boolean}
   */
  get thirdParty()
  {
    if (typeof this._thirdParty == "undefined")
    {
      this._thirdParty = this._documentHostname == null ? false :
                           isThirdParty(this.urlInfo.hostname,
                                        this._documentHostname);
    }

    return this._thirdParty;
  }

  /**
   * Returns the URL of the request.
   * @returns {string}
   */
  toString()
  {
    return this._href;
  }

  /**
   * The lower-case version of the URL of the request.
   * @type {string}
   * @package
   */
  get lowerCaseHref()
  {
    if (this._lowerCaseHref == null)
      this._lowerCaseHref = this._href.toLowerCase();

    return this._lowerCaseHref;
  }
}

/**
 * Returns a <code>{@link URLRequest}</code> object for the given URL.
 *
 * @param {string|URLInfo|URL} url The URL. If this is a <code>string</code>,
 *   it must be a canonicalized URL (see {@link parseURL}).
 * @param {?string} [documentHostname] The IDNA-encoded hostname of the
 *   document making the request.
 *
 * @returns {URLRequest}
 */
URLRequest.from = function(url, documentHostname = null)
{
  let request = new URLRequest();

  if (typeof url == "string")
  {
    request._href = url;
  }
  else
  {
    request._urlInfo = url instanceof URLInfo ? url :
                         new URLInfo(url.href, url.protocol, url.hostname);
    request._href = url.href;
  }

  if (documentHostname != null)
    request._documentHostname = documentHostname;

  return request;
};

exports.URLRequest = URLRequest;


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



/**
 * @fileOverview Matcher class implementing matching addresses against
 *               a list of filters.
 */

const {RegExpFilter, WhitelistFilter} = __webpack_require__(0);
const {filterToRegExp} = __webpack_require__(26);
const {normalizeHostname, URLRequest} = __webpack_require__(10);
const {FiltersByDomain, FilterMap} = __webpack_require__(27);
const {Cache} = __webpack_require__(18);

/**
 * Regular expression for matching a keyword in a filter.
 * @type {RegExp}
 */
const keywordRegExp = /[^a-z0-9%*][a-z0-9%]{2,}(?=[^a-z0-9%*])/;

/**
 * Regular expression for matching all keywords in a filter.
 * @type {RegExp}
 */
const allKeywordsRegExp = new RegExp(keywordRegExp, "g");

/**
 * Bitmask for content types that are implied by default in a filter, like
 * <code>$script</code>, <code>$image</code>, <code>$stylesheet</code>, and so
 * on.
 * @type {number}
 */
const DEFAULT_TYPES = RegExpFilter.prototype.contentType;

/**
 * Bitmask for "types" that must always be specified in a filter explicitly,
 * like <code>$csp</code>, <code>$popup</code>, <code>$elemhide</code>, and so
 * on.
 * @type {number}
 */
const NON_DEFAULT_TYPES = ~DEFAULT_TYPES;

/**
 * Bitmask for "types" that are for exception rules only, like
 * <code>$document</code>, <code>$elemhide</code>, and so on.
 * @type {number}
 */
const WHITELIST_ONLY_TYPES = RegExpFilter.typeMap.DOCUMENT |
                             RegExpFilter.typeMap.ELEMHIDE |
                             RegExpFilter.typeMap.GENERICHIDE |
                             RegExpFilter.typeMap.GENERICBLOCK;

/**
 * The maximum number of patterns that <code>{@link compilePatterns}</code>
 * will compile into regular expressions.
 * @type {number}
 */
const COMPILE_PATTERNS_MAX = 100;

/**
 * Checks if the keyword is bad for use.
 * @param {string} keyword
 * @returns {boolean}
 */
function isBadKeyword(keyword)
{
  return keyword == "https" || keyword == "http" || keyword == "com" ||
         keyword == "js";
}

/**
 * Yields individual non-default types from a filter's type mask.
 * @param {number} contentType A filter's type mask.
 * @yields {number}
 */
function* nonDefaultTypes(contentType)
{
  for (let mask = contentType & NON_DEFAULT_TYPES, bitIndex = 0;
       mask != 0; mask >>>= 1, bitIndex++)
  {
    if ((mask & 1) != 0)
    {
      // Note: The zero-fill right shift by zero is necessary for dropping the
      // sign.
      yield 1 << bitIndex >>> 0;
    }
  }
}

/**
 * A <code>CompiledPatterns</code> object represents the compiled version of
 * multiple URL request patterns. It is returned by
 * <code>{@link compilePatterns}</code>.
 */
class CompiledPatterns
{
  /**
   * Creates an object with the given regular expressions for case-sensitive
   * and case-insensitive matching respectively.
   * @param {?RegExp} [caseSensitive]
   * @param {?RegExp} [caseInsensitive]
   * @private
   */
  constructor(caseSensitive, caseInsensitive)
  {
    this._caseSensitive = caseSensitive;
    this._caseInsensitive = caseInsensitive;
  }

  /**
   * Tests whether the given URL request matches the patterns used to create
   * this object.
   * @param {URLRequest} request
   * @returns {boolean}
   */
  test(request)
  {
    return ((this._caseSensitive &&
             this._caseSensitive.test(request.href)) ||
            (this._caseInsensitive &&
             this._caseInsensitive.test(request.lowerCaseHref)));
  }
}

/**
 * Compiles patterns from the given filters into a single
 * <code>{@link CompiledPatterns}</code> object.
 *
 * @param {RegExpFilter|Set.<RegExpFilter>} filters The filters. If the number
 *   of filters exceeds <code>{@link COMPILE_PATTERNS_MAX}</code>, the function
 *   returns <code>null</code>.
 *
 * @returns {?CompiledPatterns}
 */
function compilePatterns(filters)
{
  // If the number of filters is too large, it may choke especially on low-end
  // platforms. As a precaution, we refuse to compile. Ideally we would check
  // the length of the regular expression source rather than the number of
  // filters, but this is far more straightforward and practical.
  if (filters.size > COMPILE_PATTERNS_MAX)
    return null;

  let caseSensitive = "";
  let caseInsensitive = "";

  for (let filter of filters)
  {
    let source = filter.pattern != null ? filterToRegExp(filter.pattern) :
                   filter.regexp.source;

    if (filter.matchCase)
      caseSensitive += source + "|";
    else
      caseInsensitive += source + "|";
  }

  let caseSensitiveRegExp = null;
  let caseInsensitiveRegExp = null;

  try
  {
    if (caseSensitive)
      caseSensitiveRegExp = new RegExp(caseSensitive.slice(0, -1));

    if (caseInsensitive)
      caseInsensitiveRegExp = new RegExp(caseInsensitive.slice(0, -1));
  }
  catch (error)
  {
    // It is possible in theory for the regular expression to be too large
    // despite COMPILE_PATTERNS_MAX
    return null;
  }

  return new CompiledPatterns(caseSensitiveRegExp, caseInsensitiveRegExp);
}

/**
 * Adds a filter by a given keyword to a map.
 * @param {RegExpFilter} filter
 * @param {string} keyword
 * @param {Map.<string,(RegExpFilter|Set.<RegExpFilter>)>} map
 */
function addFilterByKeyword(filter, keyword, map)
{
  let set = map.get(keyword);
  if (typeof set == "undefined")
  {
    map.set(keyword, filter);
  }
  else if (set.size == 1)
  {
    if (filter != set)
      map.set(keyword, new Set([set, filter]));
  }
  else
  {
    set.add(filter);
  }
}

/**
 * Removes a filter by a given keyword from a map.
 * @param {RegExpFilter} filter
 * @param {string} keyword
 * @param {Map.<string,(RegExpFilter|Set.<RegExpFilter>)>} map
 */
function removeFilterByKeyword(filter, keyword, map)
{
  let set = map.get(keyword);
  if (typeof set == "undefined")
    return;

  if (set.size == 1)
  {
    if (filter == set)
      map.delete(keyword);
  }
  else
  {
    set.delete(filter);

    if (set.size == 1)
      map.set(keyword, [...set][0]);
  }
}

/**
 * Checks whether a filter matches a given URL request without checking the
 * filter's domains.
 *
 * @param {RegExpFilter} filter The filter.
 * @param {URLRequest} request The URL request.
 * @param {number} typeMask A mask specifying the content type of the URL
 *   request.
 * @param {?string} [sitekey] An optional public key associated with the
 *   URL request.
 * @param {?Array} [collection] An optional list to which to append the filter
 *   if it matches. If omitted, the function directly returns the filter if it
 *   matches.
 *
 * @returns {?RegExpFilter} The filter if it matches and
 *   <code>collection</code> is omitted; otherwise <code>null</code>.
 */
function matchFilterWithoutDomain(filter, request, typeMask, sitekey,
                                  collection)
{
  if (filter.matchesWithoutDomain(request, typeMask, sitekey))
  {
    if (!collection)
      return filter;

    collection.push(filter);
  }

  return null;
}

/**
 * Checks whether a particular filter is slow.
 * @param {RegExpFilter} filter
 * @returns {boolean}
 */
function isSlowFilter(filter)
{
  return !filter.pattern || !keywordRegExp.test(filter.pattern);
}

exports.isSlowFilter = isSlowFilter;

/**
 * Blacklist/whitelist filter matching
 */
class Matcher
{
  constructor()
  {
    /**
     * Lookup table for keywords by their associated filter
     * @type {Map.<RegExpFilter,string>}
     * @private
     */
    this._keywordByFilter = new Map();

    /**
     * Lookup table for simple filters by their associated keyword
     * @type {Map.<string,(RegExpFilter|Set.<RegExpFilter>)>}
     * @private
     */
    this._simpleFiltersByKeyword = new Map();

    /**
     * Lookup table for complex filters by their associated keyword
     * @type {Map.<string,(RegExpFilter|Set.<RegExpFilter>)>}
     * @private
     */
    this._complexFiltersByKeyword = new Map();

    /**
     * Lookup table of compiled patterns for simple filters by their associated
     * keyword
     * @type {Map.<string,?CompiledPatterns>}
     * @private
     */
    this._compiledPatternsByKeyword = new Map();

    /**
     * Compiled patterns for generic complex filters with no associated
     * keyword.
     * @type {?CompiledPatterns|boolean}
     * @private
     */
    this._keywordlessCompiledPatterns = false;

    /**
     * Lookup table of domain maps for complex filters by their associated
     * keyword
     * @type {Map.<string,Map.<string,(RegExpFilter|
     *                                 Map.<RegExpFilter,boolean>)>>}
     * @private
     */
    this._filterDomainMapsByKeyword = new Map();

    /**
     * Lookup table of type-specific lookup tables for complex filters by their
     * associated keyword
     * @type {Map.<string,Map.<string,(RegExpFilter|Set.<RegExpFilter>)>>}
     * @private
     */
    this._filterMapsByType = new Map();
  }

  /**
   * Removes all known filters
   */
  clear()
  {
    this._keywordByFilter.clear();
    this._simpleFiltersByKeyword.clear();
    this._complexFiltersByKeyword.clear();
    this._compiledPatternsByKeyword.clear();
    this._keywordlessCompiledPatterns = false;
    this._filterDomainMapsByKeyword.clear();
    this._filterMapsByType.clear();
  }

  /**
   * Adds a filter to the matcher
   * @param {RegExpFilter} filter
   */
  add(filter)
  {
    if (this._keywordByFilter.has(filter))
      return;

    // Look for a suitable keyword
    let keyword = this.findKeyword(filter);
    let locationOnly = filter.isLocationOnly();

    addFilterByKeyword(filter, keyword,
                       locationOnly ? this._simpleFiltersByKeyword :
                         this._complexFiltersByKeyword);

    this._keywordByFilter.set(filter, keyword);

    if (locationOnly)
    {
      if (this._compiledPatternsByKeyword.size > 0)
        this._compiledPatternsByKeyword.delete(keyword);

      return;
    }

    if (keyword == "")
      this._keywordlessCompiledPatterns = false;

    for (let type of nonDefaultTypes(filter.contentType))
    {
      let map = this._filterMapsByType.get(type);
      if (!map)
        this._filterMapsByType.set(type, map = new Map());

      addFilterByKeyword(filter, keyword, map);
    }

    let {domains} = filter;

    let filtersByDomain = this._filterDomainMapsByKeyword.get(keyword);
    if (!filtersByDomain)
    {
      // In most cases, there is only one pure generic filter to a keyword.
      // Instead of Map { "foo" => Map { "" => Map { filter => true } } }, we
      // can just reduce it to Map { "foo" => filter } and save a lot of
      // memory.
      if (!domains)
      {
        this._filterDomainMapsByKeyword.set(keyword, filter);
        return;
      }

      filtersByDomain = new FiltersByDomain();
      this._filterDomainMapsByKeyword.set(keyword, filtersByDomain);
    }
    else if (!(filtersByDomain instanceof FiltersByDomain))
    {
      filtersByDomain = new FiltersByDomain([["", filtersByDomain]]);
      this._filterDomainMapsByKeyword.set(keyword, filtersByDomain);
    }

    filtersByDomain.add(filter, domains);
  }

  /**
   * Removes a filter from the matcher
   * @param {RegExpFilter} filter
   */
  remove(filter)
  {
    let keyword = this._keywordByFilter.get(filter);
    if (typeof keyword == "undefined")
      return;

    let locationOnly = filter.isLocationOnly();

    removeFilterByKeyword(filter, keyword,
                          locationOnly ? this._simpleFiltersByKeyword :
                            this._complexFiltersByKeyword);

    this._keywordByFilter.delete(filter);

    if (locationOnly)
    {
      if (this._compiledPatternsByKeyword.size > 0)
        this._compiledPatternsByKeyword.delete(keyword);

      return;
    }

    if (keyword == "")
      this._keywordlessCompiledPatterns = false;

    for (let type of nonDefaultTypes(filter.contentType))
    {
      let map = this._filterMapsByType.get(type);
      if (map)
        removeFilterByKeyword(filter, keyword, map);
    }

    let filtersByDomain = this._filterDomainMapsByKeyword.get(keyword);
    if (filtersByDomain)
    {
      // Because of the memory optimization in the add function, most of the
      // time this will be a filter rather than a map.
      if (!(filtersByDomain instanceof FiltersByDomain))
      {
        this._filterDomainMapsByKeyword.delete(keyword);
        return;
      }

      filtersByDomain.remove(filter);

      if (filtersByDomain.size == 0)
      {
        this._filterDomainMapsByKeyword.delete(keyword);
      }
      else if (filtersByDomain.size == 1)
      {
        for (let [lastDomain, map] of filtersByDomain.entries())
        {
          // Reduce Map { "foo" => Map { "" => filter } } to
          // Map { "foo" => filter }
          if (lastDomain == "" && !(map instanceof FilterMap))
            this._filterDomainMapsByKeyword.set(keyword, map);

          break;
        }
      }
    }
  }

  /**
   * Chooses a keyword to be associated with the filter
   * @param {Filter} filter
   * @returns {string} keyword or an empty string if no keyword could be found
   * @protected
   */
  findKeyword(filter)
  {
    let result = "";

    let {pattern} = filter;
    if (pattern == null)
      return result;

    let candidates = pattern.toLowerCase().match(allKeywordsRegExp);
    if (!candidates)
      return result;

    let resultCount = 0xFFFFFF;
    let resultLength = 0;

    for (let i = 0, l = candidates.length; i < l; i++)
    {
      let candidate = candidates[i].substring(1);

      if (isBadKeyword(candidate))
        continue;

      let simpleFilters = this._simpleFiltersByKeyword.get(candidate);
      let complexFilters = this._complexFiltersByKeyword.get(candidate);

      let count = (typeof simpleFilters != "undefined" ?
                     simpleFilters.size : 0) +
                  (typeof complexFilters != "undefined" ?
                     complexFilters.size : 0);

      if (count < resultCount ||
          (count == resultCount && candidate.length > resultLength))
      {
        result = candidate;
        resultCount = count;
        resultLength = candidate.length;
      }
    }

    return result;
  }

  _matchFiltersByDomain(filtersByDomain, request, typeMask, sitekey,
                        specificOnly, collection)
  {
    let excluded = null;

    let domain = request.documentHostname ?
                   normalizeHostname(request.documentHostname) :
                   "";
    let suffix = null;

    do
    {
      if (suffix == null)
      {
        suffix = domain;
      }
      else
      {
        let dotIndex = suffix.indexOf(".");
        suffix = dotIndex == -1 ? "" : suffix.substr(dotIndex + 1);
      }

      if (suffix == "" && specificOnly)
        break;

      let map = filtersByDomain.get(suffix);
      if (map)
      {
        if (map instanceof FilterMap)
        {
          for (let [filter, include] of map.entries())
          {
            if (!include)
            {
              if (excluded)
                excluded.add(filter);
              else
                excluded = new Set([filter]);
            }
            else if ((!excluded || !excluded.has(filter)) &&
                     matchFilterWithoutDomain(filter, request, typeMask,
                                              sitekey, collection))
            {
              return filter;
            }
          }
        }
        else if ((!excluded || !excluded.has(map)) &&
                 matchFilterWithoutDomain(map, request, typeMask,
                                          sitekey, collection))
        {
          return map;
        }
      }
    }
    while (suffix != "");

    return null;
  }

  _checkEntryMatchSimpleQuickCheck(keyword, request, filters)
  {
    let compiled = this._compiledPatternsByKeyword.get(keyword);
    if (typeof compiled == "undefined")
    {
      compiled = compilePatterns(filters);
      this._compiledPatternsByKeyword.set(keyword, compiled);
    }

    // If compilation failed (e.g. too many filters), return true because this
    // is only a pre-check.
    return !compiled || compiled.test(request);
  }

  _checkEntryMatchSimple(keyword, request, collection)
  {
    let filters = this._simpleFiltersByKeyword.get(keyword);

    // For simple filters where there's more than one filter to the keyword, we
    // do a quick check using a single compiled pattern that combines all the
    // patterns. This is a lot faster for requests that are not going to be
    // blocked (i.e. most requests).
    if (filters && (filters.size == 1 ||
                    this._checkEntryMatchSimpleQuickCheck(keyword, request,
                                                          filters)))
    {
      for (let filter of filters)
      {
        if (filter.matchesLocation(request))
        {
          if (!collection)
            return filter;

          collection.push(filter);
        }
      }
    }

    return null;
  }

  _checkEntryMatchForType(keyword, request, typeMask, sitekey, specificOnly,
                          collection)
  {
    let filtersForType = this._filterMapsByType.get(typeMask);
    if (filtersForType)
    {
      let filters = filtersForType.get(keyword);
      if (filters)
      {
        for (let filter of filters)
        {
          if (specificOnly && filter.isGeneric())
            continue;

          if (filter.matches(request, typeMask, sitekey))
          {
            if (!collection)
              return filter;

            collection.push(filter);
          }
        }
      }
    }

    return null;
  }

  _checkEntryMatchByDomain(keyword, request, typeMask, sitekey, specificOnly,
                           collection)
  {
    let filtersByDomain = this._filterDomainMapsByKeyword.get(keyword);
    if (filtersByDomain)
    {
      if (filtersByDomain instanceof FiltersByDomain)
      {
        if (keyword == "" && !specificOnly)
        {
          let compiled = this._keywordlessCompiledPatterns;

          // If the value is false, it indicates that we need to initialize it
          // to either a CompiledPatterns object or null.
          if (compiled == false)
          {
            // Compile all the patterns from the generic filters into a single
            // object. It is worth doing this for the keywordless generic
            // complex filters because they must be checked against every
            // single URL request that has not already been blocked by one of
            // the simple filters (i.e. most URL requests).
            let map = filtersByDomain.get("");
            if (map instanceof FilterMap)
              compiled = compilePatterns(new Set(map.keys()));

            this._keywordlessCompiledPatterns = compiled || null;
          }

          // We can skip the generic filters if none of them pass the test.
          if (compiled && !compiled.test(request))
            specificOnly = true;
        }

        return this._matchFiltersByDomain(filtersByDomain, request, typeMask,
                                          sitekey, specificOnly, collection);
      }

      // Because of the memory optimization in the add function, most of the
      // time this will be a filter rather than a map.

      // Also see #7312: If it's a single filter, it's always the equivalent of
      // Map { "" => Map { filter => true } } (i.e. applies to any domain). If
      // the specific-only flag is set, we skip it.
      if (!specificOnly)
      {
        return matchFilterWithoutDomain(filtersByDomain, request, typeMask,
                                        sitekey, collection);
      }
    }

    return null;
  }

  /**
   * Checks whether the entries for a particular keyword match a URL
   * @param {string} keyword
   * @param {URLRequest} request
   * @param {number} typeMask
   * @param {?string} [sitekey]
   * @param {boolean} [specificOnly]
   * @param {?Array.<Filter>} [collection] An optional list of filters to which
   *   to append any results. If specified, the function adds <em>all</em>
   *   matching filters to the list; if omitted, the function directly returns
   *   the first matching filter.
   * @returns {?Filter}
   * @protected
   */
  checkEntryMatch(keyword, request, typeMask, sitekey, specificOnly,
                  collection)
  {
    // We need to skip the simple (location-only) filters if the type mask does
    // not contain any default content types.
    if (!specificOnly && (typeMask & DEFAULT_TYPES) != 0)
    {
      let filter = this._checkEntryMatchSimple(keyword, request, collection);
      if (filter)
        return filter;
    }

    // If the type mask contains a non-default type (first condition) and it is
    // the only type in the mask (second condition), we can use the
    // type-specific map, which typically contains a lot fewer filters. This
    // enables faster lookups for whitelisting types like $document, $elemhide,
    // and so on, as well as other special types like $csp.
    if ((typeMask & NON_DEFAULT_TYPES) != 0 && (typeMask & typeMask - 1) == 0)
    {
      return this._checkEntryMatchForType(keyword, request, typeMask,
                                          sitekey, specificOnly, collection);
    }

    return this._checkEntryMatchByDomain(keyword, request, typeMask,
                                         sitekey, specificOnly, collection);
  }

  /**
   * Tests whether the URL matches any of the known filters
   * @param {URL|URLInfo} url
   *   URL to be tested
   * @param {number} typeMask
   *   bitmask of content / request types to match
   * @param {?string} [docDomain]
   *   domain name of the document that loads the URL
   * @param {?string} [sitekey]
   *   public key provided by the document
   * @param {boolean} [specificOnly]
   *   should be <code>true</code> if generic matches should be ignored
   * @returns {?RegExpFilter}
   *   matching filter or <code>null</code>
   */
  matchesAny(url, typeMask, docDomain, sitekey, specificOnly)
  {
    let request = URLRequest.from(url, docDomain);
    let candidates = request.lowerCaseHref.match(/[a-z0-9%]{2,}|$/g);

    for (let i = 0, l = candidates.length; i < l; i++)
    {
      if (isBadKeyword(candidates[i]))
        continue;

      let result = this.checkEntryMatch(candidates[i], request, typeMask,
                                        sitekey, specificOnly);
      if (result)
        return result;
    }

    return null;
  }
}

exports.Matcher = Matcher;

/**
 * Combines a matcher for blocking and exception rules, automatically sorts
 * rules into two {@link Matcher} instances.
 */
class CombinedMatcher
{
  constructor()
  {
    /**
     * Matcher for blocking rules.
     * @type {Matcher}
     * @private
     */
    this._blacklist = new Matcher();

    /**
     * Matcher for exception rules.
     * @type {Matcher}
     * @private
     */
    this._whitelist = new Matcher();

    /**
     * Lookup table of previous match results
     * @type {Cache.<string, ?(RegExpFilter|MatcherSearchResults)>}
     * @private
     */
    this._resultCache = new Cache(10000);
  }

  /**
   * @see Matcher#clear
   */
  clear()
  {
    this._blacklist.clear();
    this._whitelist.clear();
    this._resultCache.clear();
  }

  /**
   * @see Matcher#add
   * @param {Filter} filter
   */
  add(filter)
  {
    if (filter instanceof WhitelistFilter)
      this._whitelist.add(filter);
    else
      this._blacklist.add(filter);

    this._resultCache.clear();
  }

  /**
   * @see Matcher#remove
   * @param {Filter} filter
   */
  remove(filter)
  {
    if (filter instanceof WhitelistFilter)
      this._whitelist.remove(filter);
    else
      this._blacklist.remove(filter);

    this._resultCache.clear();
  }

  /**
   * @see Matcher#findKeyword
   * @param {Filter} filter
   * @returns {string} keyword
   * @protected
   */
  findKeyword(filter)
  {
    if (filter instanceof WhitelistFilter)
      return this._whitelist.findKeyword(filter);
    return this._blacklist.findKeyword(filter);
  }

  _matchesAnyInternal(url, typeMask, docDomain, sitekey, specificOnly)
  {
    let request = URLRequest.from(url, docDomain);
    let candidates = request.lowerCaseHref.match(/[a-z0-9%]{2,}|$/g);

    let whitelistHit = null;
    let blacklistHit = null;

    // If the type mask includes no types other than whitelist-only types, we
    // can skip the blacklist.
    if ((typeMask & ~WHITELIST_ONLY_TYPES) != 0)
    {
      for (let i = 0, l = candidates.length; !blacklistHit && i < l; i++)
      {
        if (isBadKeyword(candidates[i]))
          continue;

        blacklistHit = this._blacklist.checkEntryMatch(candidates[i], request,
                                                       typeMask, sitekey,
                                                       specificOnly);
      }
    }

    // If the type mask includes any whitelist-only types, we need to check the
    // whitelist.
    if (blacklistHit || (typeMask & WHITELIST_ONLY_TYPES) != 0)
    {
      for (let i = 0, l = candidates.length; !whitelistHit && i < l; i++)
      {
        if (isBadKeyword(candidates[i]))
          continue;

        whitelistHit = this._whitelist.checkEntryMatch(candidates[i], request,
                                                       typeMask, sitekey);
      }
    }

    return whitelistHit || blacklistHit;
  }

  _searchInternal(url, typeMask, docDomain, sitekey, specificOnly, filterType)
  {
    let hits = {};

    let searchBlocking = filterType == "blocking" || filterType == "all";
    let searchWhitelist = filterType == "whitelist" || filterType == "all";

    if (searchBlocking)
      hits.blocking = [];

    if (searchWhitelist)
      hits.whitelist = [];

    // If the type mask includes no types other than whitelist-only types, we
    // can skip the blacklist.
    if ((typeMask & ~WHITELIST_ONLY_TYPES) == 0)
      searchBlocking = false;

    let request = URLRequest.from(url, docDomain);
    let candidates = request.lowerCaseHref.match(/[a-z0-9%]{2,}|$/g);

    for (let i = 0, l = candidates.length; i < l; i++)
    {
      if (isBadKeyword(candidates[i]))
        continue;

      if (searchBlocking)
      {
        this._blacklist.checkEntryMatch(candidates[i], request, typeMask,
                                        sitekey, specificOnly, hits.blocking);
      }

      if (searchWhitelist)
      {
        this._whitelist.checkEntryMatch(candidates[i], request, typeMask,
                                        sitekey, false, hits.whitelist);
      }
    }

    return hits;
  }

  /**
   * @see Matcher#matchesAny
   * @inheritdoc
   */
  matchesAny(url, typeMask, docDomain, sitekey, specificOnly)
  {
    let key = url.href + " " + typeMask + " " + docDomain + " " + sitekey +
              " " + specificOnly;

    let result = this._resultCache.get(key);
    if (typeof result != "undefined")
      return result;

    result = this._matchesAnyInternal(url, typeMask, docDomain, sitekey,
                                      specificOnly);

    this._resultCache.set(key, result);

    return result;
  }

  /**
   * @typedef {object} MatcherSearchResults
   * @property {Array.<BlockingFilter>} [blocking] List of blocking filters
   *   found.
   * @property {Array.<WhitelistFilter>} [whitelist] List of whitelist filters
   *   found.
   */

  /**
   * Searches all blocking and whitelist filters and returns results matching
   * the given parameters.
   *
   * @param {URL|URLInfo} url
   * @param {number} typeMask
   * @param {?string} [docDomain]
   * @param {?string} [sitekey]
   * @param {boolean} [specificOnly]
   * @param {string} [filterType] The types of filters to look for. This can be
   *   <code>"blocking"</code>, <code>"whitelist"</code>, or
   *   <code>"all"</code> (default).
   *
   * @returns {MatcherSearchResults}
   */
  search(url, typeMask, docDomain, sitekey, specificOnly, filterType = "all")
  {
    let key = "* " + url.href + " " + typeMask + " " + docDomain + " " +
              sitekey + " " + specificOnly + " " + filterType;

    let result = this._resultCache.get(key);
    if (typeof result != "undefined")
      return result;

    result = this._searchInternal(url, typeMask, docDomain, sitekey,
                                  specificOnly, filterType);

    this._resultCache.set(key, result);

    return result;
  }

  /**
   * Tests whether the URL is whitelisted
   * @see Matcher#matchesAny
   * @inheritdoc
   * @returns {boolean}
   */
  isWhitelisted(url, typeMask, docDomain, sitekey)
  {
    return !!this._whitelist.matchesAny(url, typeMask, docDomain, sitekey);
  }
}

exports.CombinedMatcher = CombinedMatcher;

/**
 * Shared {@link CombinedMatcher} instance that should usually be used.
 * @type {CombinedMatcher}
 */
let defaultMatcher = new CombinedMatcher();

exports.defaultMatcher = defaultMatcher;


/***/ }),
/* 12 */
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
  get appLocale()
  {
    let locale = browser.i18n.getUILanguage();

    // Firefox <56 separates the locale parts with an underscore instead of
    // hyphen. https://bugzilla.mozilla.org/show_bug.cgi?id=1374552
    locale = locale.replace("_", "-");

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

  getDocLink(linkID)
  {
    let docLink = __webpack_require__(2).Prefs.documentation_link;
    return docLink.replace(/%LINK%/g, linkID)
                  .replace(/%LANG%/g, Utils.appLocale);
  },

  yield()
  {
  },

  logError(e)
  {
    console.error(e);
    console.trace();
  }
};


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

/** @module hitLogger */



const {extractHostFromFrame} = __webpack_require__(8);
const {EventEmitter} = __webpack_require__(6);
const {filterStorage} = __webpack_require__(5);
const {port} = __webpack_require__(7);
const {Filter, RegExpFilter,
       ElemHideFilter} = __webpack_require__(0);

const nonRequestTypes = exports.nonRequestTypes = [
  "DOCUMENT", "ELEMHIDE", "SNIPPET", "GENERICBLOCK", "GENERICHIDE", "CSP"
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
  hasListener: eventEmitter.hasListeners.bind(eventEmitter)
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
    for (let subscription of filterStorage.subscriptions())
    {
      if (subscription.disabled)
        continue;

      for (let text of subscription.filterText())
      {
        let filter = Filter.fromText(text);

        // We only know the exact filter in case of element hiding emulation.
        // For regular element hiding filters, the content script only knows
        // the selector, so we have to find a filter that has an identical
        // selector and is active on the domain the match was reported from.
        let isActiveElemHideFilter = filter instanceof ElemHideFilter &&
                                     selectors.includes(filter.selector) &&
                                     filter.isActiveOnDomain(docDomain);

        if (isActiveElemHideFilter || filters.includes(text))
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
/* 14 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


/* For ESLint: List any global identifiers used in this file below */
/* global chrome, exports, STATS, log, logging, determineUserLanguage */

// Log an 'error' message on GAB log server.
const ServerMessages = (function serverMessages() {
  const postFilterStatsToLogServer = function (data, callback) {
    if (!data) {
      return;
    }
    const payload = { event: 'filter_stats', payload: data };
    $.ajax({
      jsonp: false,
      type: 'POST',
      url: 'https://log.getadblock.com/v2/record_log.php',
      data: JSON.stringify(payload),
      success(text, status, xhr) {
        if (typeof callback === 'function') {
          callback(text, status, xhr);
        }
      },
      error(xhr, textStatus, errorThrown) {
        log('message server returned error: ', textStatus, errorThrown);
        if (callback) {
          callback(errorThrown, textStatus, xhr);
        }
      },
    });
  };

  // Log a message on GAB log server. The user's userid will be prepended to the
  // message.
  // If callback() is specified, call callback() after logging has completed
  const sendMessageToLogServer = function (payload, callback) {
    $.ajax({
      jsonp: false,
      type: 'POST',
      url: 'https://log.getadblock.com/v2/record_log.php',
      data: JSON.stringify(payload),
      success() {
        if (typeof callback === 'function') {
          callback();
        }
      },

      error(e) {
        log('message server returned error: ', e.status);
        // Remove following if statement when Edge migration is no longer needed
        if (payload.event === 'cm_migration_finished' && typeof callback === 'function') {
          callback();
        }
      },
    });
  };

  // Log a message on GAB log server. The user's userid will be prepended to the
  // message.
  // If callback() is specified, call callback() after logging has completed
  const recordMessageWithUserID = function (msg, queryType, callback, additionalParams) {
    if (!msg || !queryType) {
      return;
    }
    const payload = {
      u: STATS.userId(),
      f: STATS.flavor,
      o: STATS.os,
      l: determineUserLanguage(),
      t: queryType,
      v: chrome.runtime.getManifest().version,
    };
    if (typeof additionalParams === 'object') {
      for (const prop in additionalParams) {
        payload[prop] = additionalParams[prop];
      }
    }
    const eventWithPayload = { event: msg, payload };
    sendMessageToLogServer(eventWithPayload, callback);
  };

  // Log a message on GAB log server.
  // If callback() is specified, call callback() after logging has completed
  const recordAnonymousMessage = function (msg, queryType, callback, additionalParams) {
    if (!msg || !queryType) {
      return;
    }

    const payload = {
      f: STATS.flavor,
      o: STATS.os,
      l: determineUserLanguage(),
      t: queryType,
    };
    if (typeof additionalParams === 'object') {
      for (const prop in additionalParams) {
        payload[prop] = additionalParams[prop];
      }
    }
    const eventWithPayload = { event: msg, payload };
    sendMessageToLogServer(eventWithPayload, callback);
  };

  const recordErrorMessage = function (msg, callback, additionalParams) {
    recordMessageWithUserID(msg, 'error', callback, additionalParams);
  };

  // Log an 'status' related message on GAB log server.
  const recordStatusMessage = function (msg, callback, additionalParams) {
    recordMessageWithUserID(msg, 'stats', callback, additionalParams);
  };

  // Log a 'general' message on GAB log server.
  const recordGeneralMessage = function (msg, callback, additionalParams) {
    recordMessageWithUserID(msg, 'general', callback, additionalParams);
  };

  // Log a 'adreport' message on GAB log server.
  const recordAdreportMessage = function (msg, callback, additionalParams) {
    recordMessageWithUserID(msg, 'adreport', callback, additionalParams);
  };

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.command !== 'recordGeneralMessage' || !message.msg) {
      return;
    }
    recordGeneralMessage(message.msg, undefined, message.additionalParams);
    sendResponse({});
  });

  return {
    recordErrorMessage,
    recordAnonymousMessage,
    postFilterStatsToLogServer,
    recordStatusMessage,
    recordGeneralMessage,
    recordAdreportMessage,
  };
}());

exports.ServerMessages = ServerMessages;


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
 * @fileOverview Handles notifications.
 */

const {Prefs} = __webpack_require__(2);
const {Downloader, Downloadable,
       MILLIS_IN_MINUTE, MILLIS_IN_HOUR,
       MILLIS_IN_DAY} = __webpack_require__(29);
const {Utils} = __webpack_require__(12);
const {Matcher, defaultMatcher} = __webpack_require__(11);
const {Filter, RegExpFilter, WhitelistFilter} = __webpack_require__(0);
const {compareVersions} = __webpack_require__(56);

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

/**
 * Converts a version string into a <code>Date</code> object with minute-level
 * precision.
 *
 * @param {string} version The version string in <code>YYYYMMDD[HH[MM]]</code>
 *   format or just the value <code>"0"</code>.
 *
 * @returns {Date} A <code>Date</code> object. If the value of
 *   <code>version</code> is <code>"0"</code>, the returned value represents
 *   the Unix epoch.
 */
function versionToDate(version)
{
  if (version == "0")
    return new Date(0);

  let year = version.substring(0, 4);
  let month = version.substring(4, 6);
  let date = version.substring(6, 8);

  let hours = version.substring(8, 10) || "00";
  let minutes = version.substring(10, 12) || "00";

  return new Date(`${year}-${month}-${date}T${hours}:${minutes}Z`);
}

/**
 * Strips the value of the <code>firstVersion</code> parameter down to either
 * <code>YYYYMMDD</code>, <code>YYYYMM</code>, or <code>YYYY</code> depending
 * on its distance from the value of the <code>currentVersion</code> parameter.
 *
 * @param {string} firstVersion A version string in
 *   <code>YYYYMMDD[HH[MM]]</code> format with an optional <code>"-E"</code>
 *   suffix or just <code>"0"</code> or <code>"0-E"</code>.
 * @param {string} [currentVersion] A version string in
 *   <code>YYYYMMDD[HH[MM]]</code> format or just <code>"0"</code>.
 *
 * @returns {?string}
 */
function stripFirstVersion(firstVersion, currentVersion = "0")
{
  let eFlag = firstVersion.endsWith("-E");
  if (eFlag)
    firstVersion = firstVersion.slice(0, -2);

  try
  {
    let firstDate = versionToDate(firstVersion);
    let currentDate = versionToDate(currentVersion);

    if (currentDate - firstDate > 365 * MILLIS_IN_DAY)
      firstVersion = firstVersion.substring(0, 4);
    else if (currentDate - firstDate > 30 * MILLIS_IN_DAY)
      firstVersion = firstVersion.substring(0, 6);
    else
      firstVersion = firstVersion.substring(0, 8);
  }
  catch (error)
  {
    return null;
  }

  if (eFlag)
    firstVersion += "-E";

  return firstVersion;
}

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

    Prefs.on("blocked_total", this._onBlockedTotal.bind(this));
  },

  /**
   * Yields a Downloadable instances for the notifications download.
   */
  *_getDownloadables()
  {
    let url = Prefs.notificationurl;

    let {firstVersion} = Prefs.notificationdata;
    if (typeof firstVersion == "string")
    {
      firstVersion =
        stripFirstVersion(firstVersion,
                          (Prefs.notificationdata.data || {}).version);
      if (firstVersion)
      {
        if (firstVersion == "0" && "data" in Prefs.notificationdata)
          firstVersion = "0-E";

        url += (url.includes("?") ? "&" : "?") + "firstVersion=" +
               encodeURIComponent(firstVersion);
      }
    }

    let downloadable = new Downloadable(url);
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

      if (typeof data.version == "string" &&
          Prefs.notificationdata.firstVersion == "0")
      {
        let {version} = data;

        // If this is not a new installation, set the -E flag.
        if ("data" in Prefs.notificationdata)
          version += "-E";

        Prefs.notificationdata.firstVersion = version;
      }

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
      Utils.logError(e);
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

  _onDownloadError(downloadable, downloadURL, error, responseStatus,
                   redirectCallback)
  {
    Prefs.notificationdata.lastError = Date.now();
    Prefs.notificationdata.downloadStatus = error;
    saveNotificationData();
  },

  _onBlockedTotal()
  {
    Notification.showNext();
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
   * @param {?(URL|URLInfo)} [url] URL to match notifications to (optional)
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
        v => compareVersions(addonVersion, v) >= 0,
      extensionMaxVersion:
        v => compareVersions(addonVersion, v) <= 0,
      application: v => v == application,
      applicationMinVersion:
        v => compareVersions(applicationVersion, v) >= 0,
      applicationMaxVersion:
        v => compareVersions(applicationVersion, v) <= 0,
      platform: v => v == platform,
      platformMinVersion:
        v => compareVersions(platformVersion, v) >= 0,
      platformMaxVersion:
        v => compareVersions(platformVersion, v) <= 0,
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

      if (url || notification.urlFilters instanceof Array)
      {
        if (Prefs.enabled && url && notification.urlFilters instanceof Array)
        {
          let exception = defaultMatcher.matchesAny(
            url, RegExpFilter.typeMap.DOCUMENT, url.hostname, null
          );
          if (exception instanceof WhitelistFilter)
            continue;

          let matcher = new Matcher();
          for (let urlFilter of notification.urlFilters)
            matcher.add(Filter.fromText(urlFilter));
          if (!matcher.matchesAny(url, RegExpFilter.typeMap.DOCUMENT,
                                  url.hostname, null))
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
   * @param {?(URL|URLInfo)} [url] URL to match notifications to (optional)
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
      categories.push(category);
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
 * @fileOverview Manages synchronization of filter subscriptions.
 */

const {Downloader, Downloadable,
       MILLIS_IN_SECOND, MILLIS_IN_MINUTE,
       MILLIS_IN_HOUR, MILLIS_IN_DAY} = __webpack_require__(29);
const {Filter} = __webpack_require__(0);
const {filterStorage} = __webpack_require__(5);
const {filterNotifier} = __webpack_require__(1);
const {Prefs} = __webpack_require__(2);
const {Subscription,
       DownloadableSubscription} = __webpack_require__(4);

const INITIAL_DELAY = 1 * MILLIS_IN_MINUTE;
const CHECK_INTERVAL = 1 * MILLIS_IN_HOUR;
const DEFAULT_EXPIRATION_INTERVAL = 5 * MILLIS_IN_DAY;

/**
 * Downloads filter subscriptions whenever necessary.
 */
class Synchronizer
{
  /**
   * @hideconstructor
   */
  constructor()
  {
    /**
     * The object providing actual downloading functionality.
     * @type {Downloader}
     */
    this._downloader = new Downloader(this._getDownloadables.bind(this),
                                      INITIAL_DELAY, CHECK_INTERVAL);
    this._downloader.onExpirationChange = this._onExpirationChange.bind(this);
    this._downloader.onDownloadStarted = this._onDownloadStarted.bind(this);
    this._downloader.onDownloadSuccess = this._onDownloadSuccess.bind(this);
    this._downloader.onDownloadError = this._onDownloadError.bind(this);
  }

  /**
   * Checks whether a subscription is currently being downloaded.
   * @param {string} url  URL of the subscription
   * @returns {boolean}
   */
  isExecuting(url)
  {
    return this._downloader.isDownloading(url);
  }

  /**
   * Starts the download of a subscription.
   * @param {DownloadableSubscription} subscription
   *   Subscription to be downloaded
   * @param {boolean} manual
   *   <code>true</code> for a manually started download (should not trigger
   *   fallback requests)
   */
  execute(subscription, manual)
  {
    this._downloader.download(this._getDownloadable(subscription, manual));
  }

  /**
   * Yields {@link Downloadable} instances for all subscriptions that can be
   * downloaded.
   * @yields {Downloadable}
   */
  *_getDownloadables()
  {
    if (!Prefs.subscriptions_autoupdate)
      return;

    for (let subscription of filterStorage.subscriptions())
    {
      if (subscription instanceof DownloadableSubscription)
        yield this._getDownloadable(subscription, false);
    }
  }

  /**
   * Creates a {@link Downloadable} instance for a subscription.
   * @param {Subscription} subscription
   * @param {boolean} manual
   * @returns {Downloadable}
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
  }

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
  }

  _onDownloadStarted(downloadable)
  {
    let subscription = Subscription.fromURL(downloadable.url);
    filterNotifier.emit("subscription.downloading", subscription);
  }

  _onDownloadSuccess(downloadable, responseText, errorCallback,
                     redirectCallback)
  {
    let lines = responseText.split(/[\r\n]+/);
    let headerMatch = /\[Adblock(?:\s*Plus\s*([\d.]+)?)?\]/i.exec(lines[0]);
    if (!headerMatch)
      return errorCallback("synchronize_invalid_data");
    let minVersion = headerMatch[1];

    let params = {
      redirect: null,
      homepage: null,
      title: null,
      version: null,
      expires: null
    };
    for (let i = 1; i < lines.length; i++)
    {
      let match = /^\s*!\s*(.*?)\s*:\s*(.*)/.exec(lines[i]);
      if (!match)
        break;

      let keyword = match[1].toLowerCase();
      if (params.hasOwnProperty(keyword))
      {
        params[keyword] = match[2];
        lines.splice(i--, 1);
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

      let listed = filterStorage.knownSubscriptions.has(oldSubscription.url);
      if (listed)
        filterStorage.removeSubscription(oldSubscription);

      Subscription.knownSubscriptions.delete(oldSubscription.url);

      if (listed)
        filterStorage.addSubscription(subscription);
    }

    // The download actually succeeded
    subscription.lastSuccess = subscription.lastDownload = Math.round(
      Date.now() / MILLIS_IN_SECOND
    );
    subscription.downloadStatus = "synchronize_ok";
    subscription.downloadCount = downloadable.downloadCount;
    subscription.errors = 0;

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
    ] = this._downloader.processExpirationInterval(expirationInterval);
    subscription.softExpiration = Math.round(softExpiration / MILLIS_IN_SECOND);
    subscription.expires = Math.round(hardExpiration / MILLIS_IN_SECOND);

    if (minVersion)
      subscription.requiredVersion = minVersion;
    else
      delete subscription.requiredVersion;

    // Process filters
    lines.shift();
    let filterText = [];
    for (let line of lines)
    {
      line = Filter.normalize(line);
      if (line)
        filterText.push(line);
    }

    filterStorage.updateSubscriptionFilters(subscription, filterText);
  }

  _onDownloadError(downloadable, downloadURL, error, responseStatus,
                   redirectCallback)
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
        fallbackURL = fallbackURL.replace(/%RESPONSESTATUS%/g,
                                          encodeURIComponent(responseStatus));

        let initObj = {
          cache: "no-store",
          credentials: "omit",
          referrer: "no-referrer"
        };

        fetch(fallbackURL, initObj).then(response => response.text())
        .then(responseText =>
        {
          if (!filterStorage.knownSubscriptions.has(subscription.url))
            return;

          let match = /^(\d+)(?:\s+(\S+))?$/.exec(responseText);
          if (match && match[1] == "301" &&    // Moved permanently
              match[2] && /^https?:\/\//i.test(match[2]))
          {
            redirectCallback(match[2]);
          }
          else if (match && match[1] == "410") // Gone
          {
            let data = "[Adblock]\n" +
              [...subscription.filterText()].join("\n");
            redirectCallback("data:text/plain," + encodeURIComponent(data));
          }
        });
      }
    }
  }
}

/**
 * This object is responsible for downloading filter subscriptions whenever
 * necessary.
 * @type {Synchronizer}
 */
let synchronizer = new Synchronizer();

exports.synchronizer = synchronizer;


/***/ }),
/* 17 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


/* For ESLint: List any global identifiers used in this file below */
/* global chrome, parseUri, exports, getAvailableFiles, adblockIsPaused */

const LocalCDN = (function getLocalCDN() {
  const urlsMatchPattern = ['http://*/*', 'https://*/*'];
  const hostRegex = /ajax\.googleapis\.com|ajax\.aspnetcdn\.com|ajax\.microsoft\.com|cdnjs\.cloudflare\.com|code\.jquery\.com|cdn\.jsdelivr\.net|yastatic\.net|yandex\.st|libs\.baidu\.com|lib\.sinaapp\.com|upcdn\.b0\.upaiyun\.com/;
  const pathRegex = { jquery: /jquery[/-](\d*\.\d*\.\d*)/ };
  const libraryPaths = { jquery: { prefix: 'jquery-', postfix: '.min.js.local' } };
  const headersToRemove = ['Cookie', 'Origin', 'Referer'];
  const redirectCountKey = 'redirectCount';
  const dataCountKey = 'redirectDataCount';
  const missedVersionsKey = 'missedVersions';
  let localFiles = {};
  let libraries = [];
  let versionArray = {};

  // Gets a stored value from localStorage if available, and parses it. Otherwise,
  // if the value isn't currently stored or if the parse fails, returns a default
  // value.
  // Param: keyName: the key under which the value is stored
  //        defaultValue: the value to be returned if the stored value cannot be
  //                      retrieved
  const getStoredValue = function (keyName, defaultValue) {
    let storedValue = localStorage.getItem(keyName);
    try {
      storedValue = JSON.parse(storedValue);
    } catch (err) {
      storedValue = defaultValue;
    } finally {
      if (!storedValue) {
        storedValue = defaultValue;
      }
    }
    return storedValue;
  };

  // Populates the version array based on the files available locally
  // Pre: localFiles and libraries must be populated first
  const populateVersionArray = function () {
    const libraryVersions = {};
    // go through each libarary
    for (let i = 0; i < libraries.length; i++) {
      // check for path info
      if (libraryPaths[libraries[i]]) {
        // get the filenames
        const filenames = Object.getOwnPropertyNames(localFiles[libraries[i]]);
        libraryVersions[libraries[i]] = [];
        for (let j = 0; j < filenames.length; j++) {
          // extract the version from the filesname
          let version = filenames[j].replace(libraryPaths[libraries[i]].prefix, '');
          version = version.replace(libraryPaths[libraries[i]].postfix, '');
          libraryVersions[libraries[i]].push(version);
        }
      }
    }

    return libraryVersions;
  };

  // Completes necessary set up for the LocalCDN
  // Post:  localFiles, libraries, and versionArray are populated based on
  //        available local files
  const setUp = function () {
    localFiles = getAvailableFiles();
    libraries = Object.getOwnPropertyNames(localFiles);
    versionArray = populateVersionArray();
  };

  // Increments the redirect count by one.
  // The redirect count is loaded from and saved to localStorage.
  const incrementRedirectCount = function () {
    // get stored redirect count
    let storedRedirectCount = getStoredValue(redirectCountKey, 0);

    // increment
    storedRedirectCount += 1;

    // store updated count
    localStorage.setItem(redirectCountKey, JSON.stringify(storedRedirectCount));
  };

  // Adds the size of the specified file to the data count for that library.
  // The data count is loaded from and saved to localStorage.
  // Param: targetLibrary: the library that the file belongs to
  //        fileName: the file to be added to the data count
  const addToDataCount = function (targetLibrary, fileName) {
    // get stored redirect count
    let storedDataCount = getStoredValue(dataCountKey, 0);

    // add file size to data count
    storedDataCount += localFiles[targetLibrary][fileName];

    // store updated count
    localStorage.setItem(dataCountKey, JSON.stringify(storedDataCount));
  };

  // Adds the specified version of the specified library to the missed versions
  // object, if it hasn't already been added. Otherwise increments the count for
  // that version.
  // The missed versions object is loaded from and saved to localStorage.
  // Param: targetLibrary: the library that the missing version belongs to
  //        version: the missing version to be added
  const addMissedVersion = function (targetLibrary, version) {
    // get stored missed versions
    const storedMissedVersions = getStoredValue(missedVersionsKey, {});
    const storedMissedVersion = storedMissedVersions[targetLibrary][version];

    // add new missed version
    if (!storedMissedVersions[targetLibrary]) {
      storedMissedVersions[targetLibrary] = {};
    }
    if (storedMissedVersions[targetLibrary][version] > 0) {
      storedMissedVersions[targetLibrary][version] = storedMissedVersion + 1;
    } else {
      storedMissedVersions[targetLibrary][version] = 1;
    }

    // store updated missed versions
    localStorage.setItem(missedVersionsKey, JSON.stringify(storedMissedVersions));
  };

  // Handles a webRequest.onBeforeRequest event.
  // Redirects any requests for locally available files from a matching host,
  // if AdBlock is not paused. Otherwise allows request to continue as normal.
  // Records any redirects, bytes of data redirected, and missing versions of
  // supported libararies.
  // Param: details: holds information about the request, including the URL.
  const libRequestHandler = function (details) {
    // respect pause
    if (!adblockIsPaused()) {
      let targetLibrary = null;
      const requestUrl = parseUri(details.url);

      // check if the url contains a library keyword
      for (let i = 0; i < libraries.length; i++) {
        if (requestUrl.pathname.indexOf(libraries[i]) !== -1) {
          targetLibrary = libraries[i];
        }
      }

      // check the request host
      if (targetLibrary !== null && hostRegex.test(requestUrl.host)) {
        // check the path
        const matches = pathRegex[targetLibrary].exec(requestUrl.pathname);
        if (matches) {
          const version = matches[1];

          // check if we have the version locally
          if (versionArray[targetLibrary].indexOf(version) !== -1) {
            const libraryPrefix = libraryPaths[targetLibrary].prefix;
            const libraryPostfix = libraryPaths[targetLibrary].postfix;
            const fileName = libraryPrefix + version + libraryPostfix;
            const localPath = `localLib/${targetLibrary}/${fileName}`;
            incrementRedirectCount();
            addToDataCount(targetLibrary, fileName);
            return { redirectUrl: chrome.runtime.getURL(localPath) };
          }
          addMissedVersion(targetLibrary, version);
        }
      }
    }

    return { cancel: false };
  };

  // Handles a webrequest.onBeforeSendHeaders event.
  // Strips the cookie, origin, and referer headers (if present) from any requests for
  // a supported libarary from a matching host, if AdBlock is not paused. Otherwise
  // allows request to continue as normal.
  // Param: details: holds information about the request, including the URL and request
  //                 headers
  const stripMetadataHandler = function (details) {
    // respect pause
    if (!adblockIsPaused()) {
      const requestUrl = parseUri(details.url);
      let match = false;

      // check if the url contains a library keyword
      for (let k = 0; k < libraries.length; k++) {
        if (requestUrl.pathname.indexOf(libraries[k]) !== -1) {
          match = true;
        }
      }

      // check for a matching host
      if (match && hostRegex.test(requestUrl.host)) {
        // strip the headers to remove, if present
        for (let i = 0; i < details.requestHeaders.length; i++) {
          const aHeader = details.requestHeaders[i].name;
          if (headersToRemove.includes(aHeader)) {
            details.requestHeaders.splice(i -= 1, 1);
          }
        }
      }
    }

    return { requestHeaders: details.requestHeaders };
  };

  // Sets redirect count, data count, and missed versions back to default
  // (0 for redirect count and data count, and an empty object for missed
  // versions)
  const resetCollectedData = function () {
    localStorage.setItem(redirectCountKey, '0');
    localStorage.setItem(dataCountKey, '0');
    localStorage.setItem(missedVersionsKey, '{}');
  };

  return {
    setUp,
    // Starts the LocalCDN listeners
    start() {
      chrome.webRequest.onBeforeRequest.addListener(libRequestHandler, { urls: urlsMatchPattern }, ['blocking']);
      chrome.webRequest.onBeforeSendHeaders.addListener(stripMetadataHandler, { urls: urlsMatchPattern }, ['blocking', 'requestHeaders']);
    },
    // Stops the LocalCDN listeners and reset data
    end() {
      chrome.webRequest.onBeforeRequest.removeListener(libRequestHandler);
      chrome.webRequest.onBeforeSendHeaders.removeListener(stripMetadataHandler);
      resetCollectedData();
    },
    // Gets the redirect count as a number of redirects
    getRedirectCount() {
      return getStoredValue(redirectCountKey, 0);
    },
    // Gets the data count as a number of bytes
    getDataCount() {
      return getStoredValue(dataCountKey, 0);
    },
    // Gets the missed versions object, which includes a count of how many
    // times the missed version has been requested
    getMissedVersions() {
      return getStoredValue(missedVersionsKey, undefined);
    },
  };
}());

exports.LocalCDN = LocalCDN;


/***/ }),
/* 18 */
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
 * A <code>Cache</code> object represents a cache of arbitrary data.
 */
class Cache
{
  /**
   * Creates a cache.
   * @param {number} capacity The maximum number of entries that can exist in
   *   the cache.
   */
  constructor(capacity)
  {
    // Note: This check works for non-number values.
    if (!(capacity >= 1))
      throw new Error("capacity must be a positive number.");

    this._capacity = capacity;
    this._storage = new Map();
  }

  /**
   * Reads an entry from the cache.
   * @param {?*} key The key for the entry.
   * @returns {?*} The value of the entry, or <code>undefined</code> if the
   *   entry doesn't exist in the cache.
   */
  get(key)
  {
    return this._storage.get(key);
  }

  /**
   * Writes an entry to the cache. If the cache has reached the specified
   * maximum number of entries, all the old entries are cleared first.
   * @param {?*} key The key for the entry.
   * @param {?*} value The value of the entry.
   */
  set(key, value)
  {
    // To prevent logical errors, neither key nor value is allowed to be
    // undefined.
    if (typeof key == "undefined")
      throw new Error("key must not be undefined.");

    if (typeof value == "undefined")
      throw new Error("value must not be undefined.");

    if (this._storage.size == this._capacity && !this._storage.has(key))
      this._storage.clear();

    this._storage.set(key, value);
  }

  /**
   * Clears the cache.
   */
  clear()
  {
    this._storage.clear();
  }
}

exports.Cache = Cache;


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



/**
 * @fileOverview Element hiding implementation.
 */

const {elemHideExceptions} = __webpack_require__(20);
const {filterNotifier} = __webpack_require__(1);
const {normalizeHostname, domainSuffixes} = __webpack_require__(10);
const {FiltersByDomain} = __webpack_require__(27);
const {Cache} = __webpack_require__(18);

/**
 * The maximum number of selectors in a CSS rule. This is used by
 * <code>{@link createStyleSheet}</code> to split up a long list of selectors
 * into multiple rules.
 * @const {number}
 * @default
 */
const SELECTOR_GROUP_SIZE = 1024;

/**
 * {@link elemHide} implementation.
 */
class ElemHide
{
  /**
   * @hideconstructor
   */
  constructor()
  {
    /**
     * Lookup table, active flag, by filter by domain.
     * (Only contains filters that aren't unconditionally matched for all
     * domains.)
     * @type {FiltersByDomain}
     * @private
     */
    this._filtersByDomain = new FiltersByDomain();

    /**
     * Lookup table, filter by selector. (Only used for selectors that are
     * unconditionally matched for all domains.)
     * @type {Map.<string, Filter>}
     * @private
     */
    this._filterBySelector = new Map();

    /**
     * This array caches the keys of {@link ElemHide#_filterBySelector}
     * (selectors which unconditionally apply on all domains). It will be
     * <code>null</code> if the cache needs to be rebuilt.
     * @type {?Array.<string>}
     * @private
     */
    this._unconditionalSelectors = null;

    /**
     * The default style sheet that applies on all domains. This is based on the
     * value of <code>{@link ElemHide#_unconditionalSelectors}</code>.
     * @type {?string}
     * @private
     */
    this._defaultStyleSheet = null;

    /**
     * The common style sheet that applies on all unknown domains. This is a
     * concatenation of the default style sheet and an additional style sheet
     * based on selectors from all generic filters that are not in the
     * <code>{@link ElemHide#_unconditionalSelectors}</code> list.
     * @type {?string}
     * @private
     */
    this._commonStyleSheet = null;

    /**
     * Cache of generated domain-specific style sheets. This contains entries
     * for only known domains. If a domain is unknown, it gets
     * <code>{@link ElemHide#_commonStyleSheet}</code>.
     * @type {Cache.<string, string>}
     * @private
     */
    this._styleSheetCache = new Cache(100);

    /**
     * Set containing known element hiding filters
     * @type {Set.<ElemHideFilter>}
     * @private
     */
    this._filters = new Set();

    /**
     * All domains known to occur in exceptions
     * @type {Set.<string>}
     * @private
     */
    this._exceptionDomains = new Set();

    elemHideExceptions.on("added", this._onExceptionAdded.bind(this));
  }

  /**
   * Removes all known element hiding filters.
   */
  clear()
  {
    this._commonStyleSheet = null;

    for (let collection of [this._styleSheetCache, this._filtersByDomain,
                            this._filterBySelector, this._filters,
                            this._exceptionDomains])
    {
      collection.clear();
    }

    this._unconditionalSelectors = null;
    this._defaultStyleSheet = null;

    filterNotifier.emit("elemhideupdate");
  }

  /**
   * Add a new element hiding filter.
   * @param {ElemHideFilter} filter
   */
  add(filter)
  {
    if (this._filters.has(filter))
      return;

    this._styleSheetCache.clear();
    this._commonStyleSheet = null;

    let {domains, selector} = filter;

    if (!(domains || elemHideExceptions.hasExceptions(selector)))
    {
      // The new filter's selector is unconditionally applied to all domains
      this._filterBySelector.set(selector, filter);
      this._unconditionalSelectors = null;
      this._defaultStyleSheet = null;
    }
    else
    {
      // The new filter's selector only applies to some domains
      this._filtersByDomain.add(filter, domains);
    }

    this._filters.add(filter);
    filterNotifier.emit("elemhideupdate");
  }

  /**
   * Removes an existing element hiding filter.
   * @param {ElemHideFilter} filter
   */
  remove(filter)
  {
    if (!this._filters.has(filter))
      return;

    this._styleSheetCache.clear();
    this._commonStyleSheet = null;

    let {selector} = filter;

    // Unconditially applied element hiding filters
    if (this._filterBySelector.get(selector) == filter)
    {
      this._filterBySelector.delete(selector);
      this._unconditionalSelectors = null;
      this._defaultStyleSheet = null;
    }
    // Conditionally applied element hiding filters
    else
    {
      this._filtersByDomain.remove(filter);
    }

    this._filters.delete(filter);
    filterNotifier.emit("elemhideupdate");
  }

  /**
   * @typedef {object} ElemHideStyleSheet
   * @property {string} code CSS code.
   * @property {Array.<string>} selectors List of selectors.
   */

  /**
   * Generates a style sheet for a given domain based on the current set of
   * filters.
   *
   * @param {string} domain The domain.
   * @param {boolean} [specificOnly=false] Whether selectors from generic
   *   filters should be included.
   * @param {boolean} [includeSelectors=false] Whether the return value should
   *   include a separate list of selectors.
   * @param {boolean} [includeExceptions=false] Whether the return value should
   *   include a separate list of exceptions.
   *
   * @returns {ElemHideStyleSheet} An object containing the CSS code and the
   *   list of selectors.
   */
  generateStyleSheetForDomain(domain, specificOnly = false,
                              includeSelectors = false,
                              includeExceptions = false)
  {
    let code = null;
    let selectors = null;
    let exceptions = null;

    domain = normalizeHostname(domain);

    if (specificOnly)
    {
      if (includeExceptions)
      {
        let selectorsAndExceptions =
          this._getConditionalSelectorsWithExceptions(domain, true);

        selectors = selectorsAndExceptions.selectors;
        exceptions = selectorsAndExceptions.exceptions;
      }
      else
      {
        selectors = this._getConditionalSelectors(domain, true);
      }

      code = createStyleSheet(selectors);
    }
    else
    {
      let knownSuffix = this._getKnownSuffix(domain);

      if (includeSelectors || includeExceptions)
      {
        let selectorsAndExceptions =
          this._getConditionalSelectorsWithExceptions(knownSuffix, false);

        selectors = selectorsAndExceptions.selectors;
        exceptions = selectorsAndExceptions.exceptions;
        code = knownSuffix == "" ? this._getCommonStyleSheet() :
                 (this._getDefaultStyleSheet() + createStyleSheet(selectors));

        selectors = this._getUnconditionalSelectors().concat(selectors);
      }
      else
      {
        code = knownSuffix == "" ? this._getCommonStyleSheet() :
                 (this._getDefaultStyleSheet() +
                  this._getDomainSpecificStyleSheet(knownSuffix));
      }
    }

    return {
      code,
      selectors: includeSelectors ? selectors : null,
      exceptions: includeExceptions ? exceptions : null
    };
  }

  /**
   * Returns the suffix of the given domain that is known. If no suffix is
   * known, an empty string is returned.
   * @param {?string} domain
   * @returns {string}
   * @private
   */
  _getKnownSuffix(domain)
  {
    while (domain && !this._filtersByDomain.has(domain) &&
           !this._exceptionDomains.has(domain))
    {
      let index = domain.indexOf(".");
      domain = index == -1 ? "" : domain.substring(index + 1);
    }

    return domain;
  }

  /**
   * Returns a list of selectors that apply on each website unconditionally.
   * @returns {string[]}
   * @private
   */
  _getUnconditionalSelectors()
  {
    if (!this._unconditionalSelectors)
      this._unconditionalSelectors = [...this._filterBySelector.keys()];

    return this._unconditionalSelectors;
  }

  /**
   * Returns the list of selectors that apply on a given domain from the subset
   * of filters that do not apply unconditionally on all domains.
   *
   * @param {string} domain The domain.
   * @param {boolean} specificOnly Whether selectors from generic filters should
   *   be included.
   *
   * @returns {Array.<string>} The list of selectors.
   * @private
   */
  _getConditionalSelectors(domain, specificOnly)
  {
    let selectors = [];

    let excluded = new Set();

    for (let currentDomain of domainSuffixes(domain, !specificOnly))
    {
      let map = this._filtersByDomain.get(currentDomain);
      if (map)
      {
        for (let [filter, include] of map.entries())
        {
          if (!include)
          {
            excluded.add(filter);
          }
          else
          {
            let {selector} = filter;
            if ((excluded.size == 0 || !excluded.has(filter)) &&
                !elemHideExceptions.getException(selector, domain))
            {
              selectors.push(selector);
            }
          }
        }
      }
    }

    return selectors;
  }

  /**
   * Returns the list of selectors and the list of exceptions that apply on a
   * given domain from the subset of filters that do not apply unconditionally
   * on all domains.
   *
   * @param {string} domain The domain.
   * @param {boolean} specificOnly Whether selectors from generic filters should
   *   be included.
   *
   * @returns {{selectors: Array.<string>,
   *            exceptions: Array.<ElemHideException>}}
   *   An object containing the lists of selectors and exceptions.
   * @private
   */
  _getConditionalSelectorsWithExceptions(domain, specificOnly)
  {
    let selectors = [];
    let exceptions = [];

    let excluded = new Set();

    for (let currentDomain of domainSuffixes(domain, !specificOnly))
    {
      let map = this._filtersByDomain.get(currentDomain);
      if (map)
      {
        for (let [filter, include] of map.entries())
        {
          if (!include)
          {
            excluded.add(filter);
          }
          else if (excluded.size == 0 || !excluded.has(filter))
          {
            let {selector} = filter;
            let exception = elemHideExceptions.getException(selector, domain);

            if (exception)
              exceptions.push(exception);
            else
              selectors.push(selector);
          }
        }
      }
    }

    return {selectors, exceptions};
  }

  /**
   * Returns the default style sheet that applies on all domains.
   * @returns {string}
   * @private
   */
  _getDefaultStyleSheet()
  {
    if (!this._defaultStyleSheet)
    {
      this._defaultStyleSheet =
        createStyleSheet(this._getUnconditionalSelectors());
    }

    return this._defaultStyleSheet;
  }

  /**
   * Returns the common style sheet that applies on all unknown domains.
   * @returns {string}
   * @private
   */
  _getCommonStyleSheet()
  {
    if (!this._commonStyleSheet)
    {
      this._commonStyleSheet =
        this._getDefaultStyleSheet() +
        createStyleSheet(this._getConditionalSelectors("", false));
    }

    return this._commonStyleSheet;
  }

  /**
   * Returns the domain-specific style sheet that applies on a given domain.
   * @param {string} domain
   * @returns {string}
   * @private
   */
  _getDomainSpecificStyleSheet(domain)
  {
    let styleSheet = this._styleSheetCache.get(domain);

    if (typeof styleSheet == "undefined")
    {
      styleSheet =
        createStyleSheet(this._getConditionalSelectors(domain, false));
      this._styleSheetCache.set(domain, styleSheet);
    }

    return styleSheet;
  }

  _onExceptionAdded(exception)
  {
    let {domains, selector} = exception;

    this._styleSheetCache.clear();
    this._commonStyleSheet = null;

    if (domains)
    {
      for (let domain of domains.keys())
      {
        // Note: Once an exception domain is known it never becomes unknown,
        // even when all the exceptions containing that domain are removed.
        // This is a best-case optimization.
        if (domain != "")
          this._exceptionDomains.add(domain);
      }
    }

    // If this is the first exception for a previously unconditionally applied
    // element hiding selector we need to take care to update the lookups.
    let unconditionalFilterForSelector = this._filterBySelector.get(selector);
    if (unconditionalFilterForSelector)
    {
      this._filtersByDomain.add(unconditionalFilterForSelector);
      this._filterBySelector.delete(selector);
      this._unconditionalSelectors = null;
      this._defaultStyleSheet = null;
    }
  }
}

/**
 * Container for element hiding filters.
 * @type {ElemHide}
 */
let elemHide = new ElemHide();

exports.elemHide = elemHide;

/**
 * Yields rules from a style sheet returned by
 * <code>{@link createStyleSheet}</code>.
 *
 * @param {string} styleSheet A style sheet returned by
 *   <code>{@link createStyleSheet}</code>. If the given style sheet is
 *   <em>not</em> a value previously returned by a call to
 *   <code>{@link createStyleSheet}</code>, the behavior is undefined.
 * @yields {string} A rule from the given style sheet.
 */
function* rulesFromStyleSheet(styleSheet)
{
  let startIndex = 0;
  while (startIndex < styleSheet.length)
  {
    let ruleTerminatorIndex = styleSheet.indexOf("\n", startIndex);
    yield styleSheet.substring(startIndex, ruleTerminatorIndex);
    startIndex = ruleTerminatorIndex + 1;
  }
}

exports.rulesFromStyleSheet = rulesFromStyleSheet;

/**
 * Splits a list of selectors into groups determined by the value of
 * <code>{@link SELECTOR_GROUP_SIZE}</code>.
 *
 * @param {Array.<string>} selectors
 * @yields {Array.<string>}
 */
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
  for (let i = 0; i < selectors.length; i += SELECTOR_GROUP_SIZE)
    yield selectors.slice(i, i + SELECTOR_GROUP_SIZE);
}

/**
 * Escapes curly braces to prevent CSS rule injection.
 *
 * @param {string} selector
 * @returns {string}
 */
function escapeSelector(selector)
{
  return selector.replace("{", "\\7B ").replace("}", "\\7D ");
}

/**
 * Creates an element hiding CSS rule for a given list of selectors.
 *
 * @param {Array.<string>} selectors
 * @returns {string}
 */
function createRule(selectors)
{
  let rule = "";

  for (let i = 0; i < selectors.length - 1; i++)
    rule += escapeSelector(selectors[i]) + ", ";

  rule += escapeSelector(selectors[selectors.length - 1]) +
          " {display: none !important;}\n";

  return rule;
}

/**
 * Creates an element hiding CSS style sheet from a given list of selectors.
 * @param {Array.<string>} selectors
 * @returns {string}
 */
function createStyleSheet(selectors)
{
  let styleSheet = "";

  for (let selectorGroup of splitSelectors(selectors))
    styleSheet += createRule(selectorGroup);

  return styleSheet;
}

exports.createStyleSheet = createStyleSheet;


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
 * @fileOverview Element hiding exceptions implementation.
 */

const {EventEmitter} = __webpack_require__(6);
const {filterNotifier} = __webpack_require__(1);

/**
 * {@link elemHideExceptions} implementation.
 */
class ElemHideExceptions extends EventEmitter
{
  /**
   * @hideconstructor
   */
  constructor()
  {
    super();

    /**
     * Lookup table, lists of element hiding exceptions by selector
     * @type {Map.<string, Array.<ElemHideException>>}
     * @private
     */
    this._exceptionsBySelector = new Map();

    /**
     * Set containing known element hiding exceptions
     * @type {Set.<ElemHideException>}
     * @private
     */
    this._exceptions = new Set();
  }

  /**
   * Removes all known element hiding exceptions.
   */
  clear()
  {
    this._exceptionsBySelector.clear();
    this._exceptions.clear();

    filterNotifier.emit("elemhideupdate");
  }

  /**
   * Adds a new element hiding exception.
   * @param {ElemHideException} exception
   */
  add(exception)
  {
    if (this._exceptions.has(exception))
      return;

    let {selector} = exception;
    let list = this._exceptionsBySelector.get(selector);
    if (list)
      list.push(exception);
    else
      this._exceptionsBySelector.set(selector, [exception]);

    this._exceptions.add(exception);

    this.emit("added", exception);

    filterNotifier.emit("elemhideupdate");
  }

  /**
   * Removes an existing element hiding exception.
   * @param {ElemHideException} exception
   */
  remove(exception)
  {
    if (!this._exceptions.has(exception))
      return;

    let list = this._exceptionsBySelector.get(exception.selector);
    let index = list.indexOf(exception);
    if (index >= 0)
      list.splice(index, 1);

    this._exceptions.delete(exception);

    this.emit("removed", exception);

    filterNotifier.emit("elemhideupdate");
  }

  /**
   * Checks whether any exception rules are registered for a selector.
   * @param {string} selector
   * @returns {boolean}
   */
  hasExceptions(selector)
  {
    return this._exceptionsBySelector.has(selector);
  }

  /**
   * Checks whether an exception rule is registered for a selector on a
   * particular domain.
   * @param {string} selector
   * @param {?string} [domain]
   * @returns {?ElemHideException}
   */
  getException(selector, domain)
  {
    let exceptions = this._exceptionsBySelector.get(selector);
    if (exceptions)
    {
      for (let exception of exceptions)
      {
        if (exception.isActiveOnDomain(domain))
          return exception;
      }
    }

    return null;
  }
}

/**
 * Container for element hiding exceptions.
 * @type {ElemHideExceptions}
 */
let elemHideExceptions = new ElemHideExceptions();

exports.elemHideExceptions = elemHideExceptions;


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



/**
 * @fileOverview Element hiding emulation implementation.
 */

const {elemHideExceptions} = __webpack_require__(20);

/**
 * {@link elemHideEmulation} implementation.
 */
class ElemHideEmulation
{
  /**
   * @hideconstructor
   */
  constructor()
  {
    /**
     * All known element hiding emulation filters.
     * @type {Set.<ElemHideEmulationFilter>}
     * @private
     */
    this._filters = new Set();
  }

  /**
   * Removes all known element hiding emulation filters.
   */
  clear()
  {
    this._filters.clear();
  }

  /**
   * Adds a new element hiding emulation filter.
   * @param {ElemHideEmulationFilter} filter
   */
  add(filter)
  {
    this._filters.add(filter);
  }

  /**
   * Removes an existing element hiding emulation filter.
   * @param {ElemHideEmulationFilter} filter
   */
  remove(filter)
  {
    this._filters.delete(filter);
  }

  /**
   * Returns a list of all element hiding emulation rules active on the given
   * domain.
   * @param {string} domain
   * @returns {Array.<ElemHideEmulationFilter>}
   */
  getRulesForDomain(domain)
  {
    let result = [];

    for (let filter of this._filters)
    {
      if (filter.isActiveOnDomain(domain) &&
          !elemHideExceptions.getException(filter.selector, domain))
      {
        result.push(filter);
      }
    }

    return result;
  }
}

/**
 * Container for element hiding emulation filters.
 * @type {ElemHideEmulation}
 */
let elemHideEmulation = new ElemHideEmulation();

exports.elemHideEmulation = elemHideEmulation;


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

/** @module stats */



const {Prefs} = __webpack_require__(2);
const {BlockingFilter} = __webpack_require__(0);
const {filterNotifier} = __webpack_require__(1);
const {port} = __webpack_require__(7);

const badgeColor = "#646464";
const badgeRefreshRate = 4;

let blockedPerPage = new ext.PageMap();

let getBlockedPerPage =
/**
 * Gets the number of requests blocked on the given page.
 *
 * @param  {Page} page
 * @return {Number}
 */
exports.getBlockedPerPage = page => blockedPerPage.get(page) || 0;

let activeTabIds = new Set();
let activeTabIdByWindowId = new Map();

let badgeUpdateScheduled = false;

function updateBadge(tabId)
{
  if (!Prefs.show_statsinicon)
    return;

  for (let id of (typeof tabId == "undefined" ? activeTabIds : [tabId]))
  {
    let page = new ext.Page({id});
    let blockedCount = blockedPerPage.get(page);

    page.browserAction.setBadge(blockedCount && {
      color: badgeColor,
      number: blockedCount
    });
  }
}

function scheduleBadgeUpdate(tabId)
{
  if (!badgeUpdateScheduled && Prefs.show_statsinicon &&
      (typeof tabId == "undefined" || activeTabIds.has(tabId)))
  {
    setTimeout(() => { badgeUpdateScheduled = false; updateBadge(); },
               1000 / badgeRefreshRate);
    badgeUpdateScheduled = true;
  }
}

// Once nagivation for the tab has been committed to (e.g. it's no longer
// being prerendered) we clear its badge, or if some requests were already
// blocked beforehand we display those on the badge now.
browser.webNavigation.onCommitted.addListener(details =>
{
  if (details.frameId == 0)
    updateBadge(details.tabId);
});

filterNotifier.on("filter.hitCount", (filter, newValue, oldValue, tabIds) =>
{
  if (!(filter instanceof BlockingFilter))
    return;

  for (let tabId of tabIds)
  {
    let page = new ext.Page({id: tabId});
    let blocked = blockedPerPage.get(page) || 0;

    blockedPerPage.set(page, ++blocked);
    scheduleBadgeUpdate(tabId);
  }

  Prefs.blocked_total++;
});

Prefs.on("show_statsinicon", () =>
{
  browser.tabs.query({}).then(tabs =>
  {
    for (let tab of tabs)
    {
      let page = new ext.Page(tab);

      if (Prefs.show_statsinicon)
        updateBadge(tab.id);
      else
        page.browserAction.setBadge(null);
    }
  });
});

port.on("stats.getBlockedPerPage",
        message => getBlockedPerPage(new ext.Page(message.tab)));

browser.tabs.query({active: true}).then(tabs =>
{
  for (let tab of tabs)
  {
    activeTabIds.add(tab.id);
    activeTabIdByWindowId.set(tab.windowId, tab.id);
  }

  scheduleBadgeUpdate();
});

browser.tabs.onActivated.addListener(tab =>
{
  let lastActiveTabId = activeTabIdByWindowId.get(tab.windowId);
  if (typeof lastActiveTabId != "undefined")
    activeTabIds.delete(lastActiveTabId);

  activeTabIds.add(tab.tabId);
  activeTabIdByWindowId.set(tab.windowId, tab.tabId);

  scheduleBadgeUpdate();
});

if ("windows" in browser)
{
  browser.windows.onRemoved.addListener(windowId =>
  {
    activeTabIds.delete(activeTabIdByWindowId.get(windowId));
    activeTabIdByWindowId.delete(windowId);
  });
}


/***/ }),
/* 23 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";
/** @module adblock-betafish/alias/recommendations */

/*
 * Same as the original source adblockpluschrome\adblockpluscore\lib
 * except:
 * - added AdBlock specific filter lists
 * - added language, id & hidden attribute
 */


/**
 * A <code>Recommendation</code> object represents a recommended filter
 * subscription.
 */
class Recommendation
{
  /**
   * Creates a <code>Recommendation</code> object from the given source object.
   * @param {object} source The source object.
   * @private
   */
  constructor(source)
  {
    this._source = source;
  }

  /**
   * The type of the recommended filter subscription.
   * @type {string}
   */
  get type()
  {
    return this._source.type;
  }

  /**
   * The languages of the recommended filter subscription.
   * @type {Array.<string>}
   */
  get languages()
  {
    return this._source.languages ? [...this._source.languages] : [];
  }

  /**
   * The language indicator of the recommended filter subscription.
   * @type {boolean}
   */
  get language()
  {
    return this._source.language || (this._source.languages && this._source.languages.length > 0) || false;
  }

  /**
   * The title of the recommended filter subscription.
   * @type {string}
   */
  get title()
  {
    return this._source.title;
  }

  /**
   * The URL of the recommended filter subscription.
   * @type {string}
   */
  get url()
  {
    return this._source.url;
  }

  /**
   * The home page of the recommended filter subscription.
   * @type {string}
   */
  get homepage()
  {
    return this._source.homepage;
  }

  /**
   * The id of the recommended filter subscription.
   * @type {string}
   */
  get id()
  {
    return this._source.id;
  }

  /**
   * The hidden indicator of the recommended filter subscription.
   * @type {boolean}
   */
  get hidden()
  {
    return this._source.hidden || false;
  }
}

/**
 * Yields <code>{@link Recommendation}</code> objects representing recommended
 * filter subscriptions.
 *
 * @yields {Recommendation} An object representing a recommended filter
 *   subscription.
 */
function* recommendations()
{
  for (let source of __webpack_require__(60))
    yield new Recommendation(source);
}

exports.recommendations = recommendations;


/***/ }),
/* 24 */
/***/ (function(module, exports, __webpack_require__) {

var __WEBPACK_AMD_DEFINE_ARRAY__, __WEBPACK_AMD_DEFINE_RESULT__;/*! jQuery v2.1.1 | (c) 2005, 2014 jQuery Foundation, Inc. | jquery.org/license */
!function(a,b){"object"==typeof module&&"object"==typeof module.exports?module.exports=a.document?b(a,!0):function(a){if(!a.document)throw new Error("jQuery requires a window with a document");return b(a)}:b(a)}("undefined"!=typeof window?window:this,function(a,b){var c=[],d=c.slice,e=c.concat,f=c.push,g=c.indexOf,h={},i=h.toString,j=h.hasOwnProperty,k={},l=a.document,m="2.1.1",n=function(a,b){return new n.fn.init(a,b)},o=/^[\s\uFEFF\xA0]+|[\s\uFEFF\xA0]+$/g,p=/^-ms-/,q=/-([\da-z])/gi,r=function(a,b){return b.toUpperCase()};n.fn=n.prototype={jquery:m,constructor:n,selector:"",length:0,toArray:function(){return d.call(this)},get:function(a){return null!=a?0>a?this[a+this.length]:this[a]:d.call(this)},pushStack:function(a){var b=n.merge(this.constructor(),a);return b.prevObject=this,b.context=this.context,b},each:function(a,b){return n.each(this,a,b)},map:function(a){return this.pushStack(n.map(this,function(b,c){return a.call(b,c,b)}))},slice:function(){return this.pushStack(d.apply(this,arguments))},first:function(){return this.eq(0)},last:function(){return this.eq(-1)},eq:function(a){var b=this.length,c=+a+(0>a?b:0);return this.pushStack(c>=0&&b>c?[this[c]]:[])},end:function(){return this.prevObject||this.constructor(null)},push:f,sort:c.sort,splice:c.splice},n.extend=n.fn.extend=function(){var a,b,c,d,e,f,g=arguments[0]||{},h=1,i=arguments.length,j=!1;for("boolean"==typeof g&&(j=g,g=arguments[h]||{},h++),"object"==typeof g||n.isFunction(g)||(g={}),h===i&&(g=this,h--);i>h;h++)if(null!=(a=arguments[h]))for(b in a)c=g[b],d=a[b],g!==d&&(j&&d&&(n.isPlainObject(d)||(e=n.isArray(d)))?(e?(e=!1,f=c&&n.isArray(c)?c:[]):f=c&&n.isPlainObject(c)?c:{},g[b]=n.extend(j,f,d)):void 0!==d&&(g[b]=d));return g},n.extend({expando:"jQuery"+(m+Math.random()).replace(/\D/g,""),isReady:!0,error:function(a){throw new Error(a)},noop:function(){},isFunction:function(a){return"function"===n.type(a)},isArray:Array.isArray,isWindow:function(a){return null!=a&&a===a.window},isNumeric:function(a){return!n.isArray(a)&&a-parseFloat(a)>=0},isPlainObject:function(a){return"object"!==n.type(a)||a.nodeType||n.isWindow(a)?!1:a.constructor&&!j.call(a.constructor.prototype,"isPrototypeOf")?!1:!0},isEmptyObject:function(a){var b;for(b in a)return!1;return!0},type:function(a){return null==a?a+"":"object"==typeof a||"function"==typeof a?h[i.call(a)]||"object":typeof a},globalEval:function(a){var b,c=eval;a=n.trim(a),a&&(1===a.indexOf("use strict")?(b=l.createElement("script"),b.text=a,l.head.appendChild(b).parentNode.removeChild(b)):c(a))},camelCase:function(a){return a.replace(p,"ms-").replace(q,r)},nodeName:function(a,b){return a.nodeName&&a.nodeName.toLowerCase()===b.toLowerCase()},each:function(a,b,c){var d,e=0,f=a.length,g=s(a);if(c){if(g){for(;f>e;e++)if(d=b.apply(a[e],c),d===!1)break}else for(e in a)if(d=b.apply(a[e],c),d===!1)break}else if(g){for(;f>e;e++)if(d=b.call(a[e],e,a[e]),d===!1)break}else for(e in a)if(d=b.call(a[e],e,a[e]),d===!1)break;return a},trim:function(a){return null==a?"":(a+"").replace(o,"")},makeArray:function(a,b){var c=b||[];return null!=a&&(s(Object(a))?n.merge(c,"string"==typeof a?[a]:a):f.call(c,a)),c},inArray:function(a,b,c){return null==b?-1:g.call(b,a,c)},merge:function(a,b){for(var c=+b.length,d=0,e=a.length;c>d;d++)a[e++]=b[d];return a.length=e,a},grep:function(a,b,c){for(var d,e=[],f=0,g=a.length,h=!c;g>f;f++)d=!b(a[f],f),d!==h&&e.push(a[f]);return e},map:function(a,b,c){var d,f=0,g=a.length,h=s(a),i=[];if(h)for(;g>f;f++)d=b(a[f],f,c),null!=d&&i.push(d);else for(f in a)d=b(a[f],f,c),null!=d&&i.push(d);return e.apply([],i)},guid:1,proxy:function(a,b){var c,e,f;return"string"==typeof b&&(c=a[b],b=a,a=c),n.isFunction(a)?(e=d.call(arguments,2),f=function(){return a.apply(b||this,e.concat(d.call(arguments)))},f.guid=a.guid=a.guid||n.guid++,f):void 0},now:Date.now,support:k}),n.each("Boolean Number String Function Array Date RegExp Object Error".split(" "),function(a,b){h["[object "+b+"]"]=b.toLowerCase()});function s(a){var b=a.length,c=n.type(a);return"function"===c||n.isWindow(a)?!1:1===a.nodeType&&b?!0:"array"===c||0===b||"number"==typeof b&&b>0&&b-1 in a}var t=function(a){var b,c,d,e,f,g,h,i,j,k,l,m,n,o,p,q,r,s,t,u="sizzle"+-new Date,v=a.document,w=0,x=0,y=gb(),z=gb(),A=gb(),B=function(a,b){return a===b&&(l=!0),0},C="undefined",D=1<<31,E={}.hasOwnProperty,F=[],G=F.pop,H=F.push,I=F.push,J=F.slice,K=F.indexOf||function(a){for(var b=0,c=this.length;c>b;b++)if(this[b]===a)return b;return-1},L="checked|selected|async|autofocus|autoplay|controls|defer|disabled|hidden|ismap|loop|multiple|open|readonly|required|scoped",M="[\\x20\\t\\r\\n\\f]",N="(?:\\\\.|[\\w-]|[^\\x00-\\xa0])+",O=N.replace("w","w#"),P="\\["+M+"*("+N+")(?:"+M+"*([*^$|!~]?=)"+M+"*(?:'((?:\\\\.|[^\\\\'])*)'|\"((?:\\\\.|[^\\\\\"])*)\"|("+O+"))|)"+M+"*\\]",Q=":("+N+")(?:\\((('((?:\\\\.|[^\\\\'])*)'|\"((?:\\\\.|[^\\\\\"])*)\")|((?:\\\\.|[^\\\\()[\\]]|"+P+")*)|.*)\\)|)",R=new RegExp("^"+M+"+|((?:^|[^\\\\])(?:\\\\.)*)"+M+"+$","g"),S=new RegExp("^"+M+"*,"+M+"*"),T=new RegExp("^"+M+"*([>+~]|"+M+")"+M+"*"),U=new RegExp("="+M+"*([^\\]'\"]*?)"+M+"*\\]","g"),V=new RegExp(Q),W=new RegExp("^"+O+"$"),X={ID:new RegExp("^#("+N+")"),CLASS:new RegExp("^\\.("+N+")"),TAG:new RegExp("^("+N.replace("w","w*")+")"),ATTR:new RegExp("^"+P),PSEUDO:new RegExp("^"+Q),CHILD:new RegExp("^:(only|first|last|nth|nth-last)-(child|of-type)(?:\\("+M+"*(even|odd|(([+-]|)(\\d*)n|)"+M+"*(?:([+-]|)"+M+"*(\\d+)|))"+M+"*\\)|)","i"),bool:new RegExp("^(?:"+L+")$","i"),needsContext:new RegExp("^"+M+"*[>+~]|:(even|odd|eq|gt|lt|nth|first|last)(?:\\("+M+"*((?:-\\d)?\\d*)"+M+"*\\)|)(?=[^-]|$)","i")},Y=/^(?:input|select|textarea|button)$/i,Z=/^h\d$/i,$=/^[^{]+\{\s*\[native \w/,_=/^(?:#([\w-]+)|(\w+)|\.([\w-]+))$/,ab=/[+~]/,bb=/'|\\/g,cb=new RegExp("\\\\([\\da-f]{1,6}"+M+"?|("+M+")|.)","ig"),db=function(a,b,c){var d="0x"+b-65536;return d!==d||c?b:0>d?String.fromCharCode(d+65536):String.fromCharCode(d>>10|55296,1023&d|56320)};try{I.apply(F=J.call(v.childNodes),v.childNodes),F[v.childNodes.length].nodeType}catch(eb){I={apply:F.length?function(a,b){H.apply(a,J.call(b))}:function(a,b){var c=a.length,d=0;while(a[c++]=b[d++]);a.length=c-1}}}function fb(a,b,d,e){var f,h,j,k,l,o,r,s,w,x;if((b?b.ownerDocument||b:v)!==n&&m(b),b=b||n,d=d||[],!a||"string"!=typeof a)return d;if(1!==(k=b.nodeType)&&9!==k)return[];if(p&&!e){if(f=_.exec(a))if(j=f[1]){if(9===k){if(h=b.getElementById(j),!h||!h.parentNode)return d;if(h.id===j)return d.push(h),d}else if(b.ownerDocument&&(h=b.ownerDocument.getElementById(j))&&t(b,h)&&h.id===j)return d.push(h),d}else{if(f[2])return I.apply(d,b.getElementsByTagName(a)),d;if((j=f[3])&&c.getElementsByClassName&&b.getElementsByClassName)return I.apply(d,b.getElementsByClassName(j)),d}if(c.qsa&&(!q||!q.test(a))){if(s=r=u,w=b,x=9===k&&a,1===k&&"object"!==b.nodeName.toLowerCase()){o=g(a),(r=b.getAttribute("id"))?s=r.replace(bb,"\\$&"):b.setAttribute("id",s),s="[id='"+s+"'] ",l=o.length;while(l--)o[l]=s+qb(o[l]);w=ab.test(a)&&ob(b.parentNode)||b,x=o.join(",")}if(x)try{return I.apply(d,w.querySelectorAll(x)),d}catch(y){}finally{r||b.removeAttribute("id")}}}return i(a.replace(R,"$1"),b,d,e)}function gb(){var a=[];function b(c,e){return a.push(c+" ")>d.cacheLength&&delete b[a.shift()],b[c+" "]=e}return b}function hb(a){return a[u]=!0,a}function ib(a){var b=n.createElement("div");try{return!!a(b)}catch(c){return!1}finally{b.parentNode&&b.parentNode.removeChild(b),b=null}}function jb(a,b){var c=a.split("|"),e=a.length;while(e--)d.attrHandle[c[e]]=b}function kb(a,b){var c=b&&a,d=c&&1===a.nodeType&&1===b.nodeType&&(~b.sourceIndex||D)-(~a.sourceIndex||D);if(d)return d;if(c)while(c=c.nextSibling)if(c===b)return-1;return a?1:-1}function lb(a){return function(b){var c=b.nodeName.toLowerCase();return"input"===c&&b.type===a}}function mb(a){return function(b){var c=b.nodeName.toLowerCase();return("input"===c||"button"===c)&&b.type===a}}function nb(a){return hb(function(b){return b=+b,hb(function(c,d){var e,f=a([],c.length,b),g=f.length;while(g--)c[e=f[g]]&&(c[e]=!(d[e]=c[e]))})})}function ob(a){return a&&typeof a.getElementsByTagName!==C&&a}c=fb.support={},f=fb.isXML=function(a){var b=a&&(a.ownerDocument||a).documentElement;return b?"HTML"!==b.nodeName:!1},m=fb.setDocument=function(a){var b,e=a?a.ownerDocument||a:v,g=e.defaultView;return e!==n&&9===e.nodeType&&e.documentElement?(n=e,o=e.documentElement,p=!f(e),g&&g!==g.top&&(g.addEventListener?g.addEventListener("unload",function(){m()},!1):g.attachEvent&&g.attachEvent("onunload",function(){m()})),c.attributes=ib(function(a){return a.className="i",!a.getAttribute("className")}),c.getElementsByTagName=ib(function(a){return a.appendChild(e.createComment("")),!a.getElementsByTagName("*").length}),c.getElementsByClassName=$.test(e.getElementsByClassName)&&ib(function(a){return a.innerHTML="<div class='a'></div><div class='a i'></div>",a.firstChild.className="i",2===a.getElementsByClassName("i").length}),c.getById=ib(function(a){return o.appendChild(a).id=u,!e.getElementsByName||!e.getElementsByName(u).length}),c.getById?(d.find.ID=function(a,b){if(typeof b.getElementById!==C&&p){var c=b.getElementById(a);return c&&c.parentNode?[c]:[]}},d.filter.ID=function(a){var b=a.replace(cb,db);return function(a){return a.getAttribute("id")===b}}):(delete d.find.ID,d.filter.ID=function(a){var b=a.replace(cb,db);return function(a){var c=typeof a.getAttributeNode!==C&&a.getAttributeNode("id");return c&&c.value===b}}),d.find.TAG=c.getElementsByTagName?function(a,b){return typeof b.getElementsByTagName!==C?b.getElementsByTagName(a):void 0}:function(a,b){var c,d=[],e=0,f=b.getElementsByTagName(a);if("*"===a){while(c=f[e++])1===c.nodeType&&d.push(c);return d}return f},d.find.CLASS=c.getElementsByClassName&&function(a,b){return typeof b.getElementsByClassName!==C&&p?b.getElementsByClassName(a):void 0},r=[],q=[],(c.qsa=$.test(e.querySelectorAll))&&(ib(function(a){a.innerHTML="<select msallowclip=''><option selected=''></option></select>",a.querySelectorAll("[msallowclip^='']").length&&q.push("[*^$]="+M+"*(?:''|\"\")"),a.querySelectorAll("[selected]").length||q.push("\\["+M+"*(?:value|"+L+")"),a.querySelectorAll(":checked").length||q.push(":checked")}),ib(function(a){var b=e.createElement("input");b.setAttribute("type","hidden"),a.appendChild(b).setAttribute("name","D"),a.querySelectorAll("[name=d]").length&&q.push("name"+M+"*[*^$|!~]?="),a.querySelectorAll(":enabled").length||q.push(":enabled",":disabled"),a.querySelectorAll("*,:x"),q.push(",.*:")})),(c.matchesSelector=$.test(s=o.matches||o.webkitMatchesSelector||o.mozMatchesSelector||o.oMatchesSelector||o.msMatchesSelector))&&ib(function(a){c.disconnectedMatch=s.call(a,"div"),s.call(a,"[s!='']:x"),r.push("!=",Q)}),q=q.length&&new RegExp(q.join("|")),r=r.length&&new RegExp(r.join("|")),b=$.test(o.compareDocumentPosition),t=b||$.test(o.contains)?function(a,b){var c=9===a.nodeType?a.documentElement:a,d=b&&b.parentNode;return a===d||!(!d||1!==d.nodeType||!(c.contains?c.contains(d):a.compareDocumentPosition&&16&a.compareDocumentPosition(d)))}:function(a,b){if(b)while(b=b.parentNode)if(b===a)return!0;return!1},B=b?function(a,b){if(a===b)return l=!0,0;var d=!a.compareDocumentPosition-!b.compareDocumentPosition;return d?d:(d=(a.ownerDocument||a)===(b.ownerDocument||b)?a.compareDocumentPosition(b):1,1&d||!c.sortDetached&&b.compareDocumentPosition(a)===d?a===e||a.ownerDocument===v&&t(v,a)?-1:b===e||b.ownerDocument===v&&t(v,b)?1:k?K.call(k,a)-K.call(k,b):0:4&d?-1:1)}:function(a,b){if(a===b)return l=!0,0;var c,d=0,f=a.parentNode,g=b.parentNode,h=[a],i=[b];if(!f||!g)return a===e?-1:b===e?1:f?-1:g?1:k?K.call(k,a)-K.call(k,b):0;if(f===g)return kb(a,b);c=a;while(c=c.parentNode)h.unshift(c);c=b;while(c=c.parentNode)i.unshift(c);while(h[d]===i[d])d++;return d?kb(h[d],i[d]):h[d]===v?-1:i[d]===v?1:0},e):n},fb.matches=function(a,b){return fb(a,null,null,b)},fb.matchesSelector=function(a,b){if((a.ownerDocument||a)!==n&&m(a),b=b.replace(U,"='$1']"),!(!c.matchesSelector||!p||r&&r.test(b)||q&&q.test(b)))try{var d=s.call(a,b);if(d||c.disconnectedMatch||a.document&&11!==a.document.nodeType)return d}catch(e){}return fb(b,n,null,[a]).length>0},fb.contains=function(a,b){return(a.ownerDocument||a)!==n&&m(a),t(a,b)},fb.attr=function(a,b){(a.ownerDocument||a)!==n&&m(a);var e=d.attrHandle[b.toLowerCase()],f=e&&E.call(d.attrHandle,b.toLowerCase())?e(a,b,!p):void 0;return void 0!==f?f:c.attributes||!p?a.getAttribute(b):(f=a.getAttributeNode(b))&&f.specified?f.value:null},fb.error=function(a){throw new Error("Syntax error, unrecognized expression: "+a)},fb.uniqueSort=function(a){var b,d=[],e=0,f=0;if(l=!c.detectDuplicates,k=!c.sortStable&&a.slice(0),a.sort(B),l){while(b=a[f++])b===a[f]&&(e=d.push(f));while(e--)a.splice(d[e],1)}return k=null,a},e=fb.getText=function(a){var b,c="",d=0,f=a.nodeType;if(f){if(1===f||9===f||11===f){if("string"==typeof a.textContent)return a.textContent;for(a=a.firstChild;a;a=a.nextSibling)c+=e(a)}else if(3===f||4===f)return a.nodeValue}else while(b=a[d++])c+=e(b);return c},d=fb.selectors={cacheLength:50,createPseudo:hb,match:X,attrHandle:{},find:{},relative:{">":{dir:"parentNode",first:!0}," ":{dir:"parentNode"},"+":{dir:"previousSibling",first:!0},"~":{dir:"previousSibling"}},preFilter:{ATTR:function(a){return a[1]=a[1].replace(cb,db),a[3]=(a[3]||a[4]||a[5]||"").replace(cb,db),"~="===a[2]&&(a[3]=" "+a[3]+" "),a.slice(0,4)},CHILD:function(a){return a[1]=a[1].toLowerCase(),"nth"===a[1].slice(0,3)?(a[3]||fb.error(a[0]),a[4]=+(a[4]?a[5]+(a[6]||1):2*("even"===a[3]||"odd"===a[3])),a[5]=+(a[7]+a[8]||"odd"===a[3])):a[3]&&fb.error(a[0]),a},PSEUDO:function(a){var b,c=!a[6]&&a[2];return X.CHILD.test(a[0])?null:(a[3]?a[2]=a[4]||a[5]||"":c&&V.test(c)&&(b=g(c,!0))&&(b=c.indexOf(")",c.length-b)-c.length)&&(a[0]=a[0].slice(0,b),a[2]=c.slice(0,b)),a.slice(0,3))}},filter:{TAG:function(a){var b=a.replace(cb,db).toLowerCase();return"*"===a?function(){return!0}:function(a){return a.nodeName&&a.nodeName.toLowerCase()===b}},CLASS:function(a){var b=y[a+" "];return b||(b=new RegExp("(^|"+M+")"+a+"("+M+"|$)"))&&y(a,function(a){return b.test("string"==typeof a.className&&a.className||typeof a.getAttribute!==C&&a.getAttribute("class")||"")})},ATTR:function(a,b,c){return function(d){var e=fb.attr(d,a);return null==e?"!="===b:b?(e+="","="===b?e===c:"!="===b?e!==c:"^="===b?c&&0===e.indexOf(c):"*="===b?c&&e.indexOf(c)>-1:"$="===b?c&&e.slice(-c.length)===c:"~="===b?(" "+e+" ").indexOf(c)>-1:"|="===b?e===c||e.slice(0,c.length+1)===c+"-":!1):!0}},CHILD:function(a,b,c,d,e){var f="nth"!==a.slice(0,3),g="last"!==a.slice(-4),h="of-type"===b;return 1===d&&0===e?function(a){return!!a.parentNode}:function(b,c,i){var j,k,l,m,n,o,p=f!==g?"nextSibling":"previousSibling",q=b.parentNode,r=h&&b.nodeName.toLowerCase(),s=!i&&!h;if(q){if(f){while(p){l=b;while(l=l[p])if(h?l.nodeName.toLowerCase()===r:1===l.nodeType)return!1;o=p="only"===a&&!o&&"nextSibling"}return!0}if(o=[g?q.firstChild:q.lastChild],g&&s){k=q[u]||(q[u]={}),j=k[a]||[],n=j[0]===w&&j[1],m=j[0]===w&&j[2],l=n&&q.childNodes[n];while(l=++n&&l&&l[p]||(m=n=0)||o.pop())if(1===l.nodeType&&++m&&l===b){k[a]=[w,n,m];break}}else if(s&&(j=(b[u]||(b[u]={}))[a])&&j[0]===w)m=j[1];else while(l=++n&&l&&l[p]||(m=n=0)||o.pop())if((h?l.nodeName.toLowerCase()===r:1===l.nodeType)&&++m&&(s&&((l[u]||(l[u]={}))[a]=[w,m]),l===b))break;return m-=e,m===d||m%d===0&&m/d>=0}}},PSEUDO:function(a,b){var c,e=d.pseudos[a]||d.setFilters[a.toLowerCase()]||fb.error("unsupported pseudo: "+a);return e[u]?e(b):e.length>1?(c=[a,a,"",b],d.setFilters.hasOwnProperty(a.toLowerCase())?hb(function(a,c){var d,f=e(a,b),g=f.length;while(g--)d=K.call(a,f[g]),a[d]=!(c[d]=f[g])}):function(a){return e(a,0,c)}):e}},pseudos:{not:hb(function(a){var b=[],c=[],d=h(a.replace(R,"$1"));return d[u]?hb(function(a,b,c,e){var f,g=d(a,null,e,[]),h=a.length;while(h--)(f=g[h])&&(a[h]=!(b[h]=f))}):function(a,e,f){return b[0]=a,d(b,null,f,c),!c.pop()}}),has:hb(function(a){return function(b){return fb(a,b).length>0}}),contains:hb(function(a){return function(b){return(b.textContent||b.innerText||e(b)).indexOf(a)>-1}}),lang:hb(function(a){return W.test(a||"")||fb.error("unsupported lang: "+a),a=a.replace(cb,db).toLowerCase(),function(b){var c;do if(c=p?b.lang:b.getAttribute("xml:lang")||b.getAttribute("lang"))return c=c.toLowerCase(),c===a||0===c.indexOf(a+"-");while((b=b.parentNode)&&1===b.nodeType);return!1}}),target:function(b){var c=a.location&&a.location.hash;return c&&c.slice(1)===b.id},root:function(a){return a===o},focus:function(a){return a===n.activeElement&&(!n.hasFocus||n.hasFocus())&&!!(a.type||a.href||~a.tabIndex)},enabled:function(a){return a.disabled===!1},disabled:function(a){return a.disabled===!0},checked:function(a){var b=a.nodeName.toLowerCase();return"input"===b&&!!a.checked||"option"===b&&!!a.selected},selected:function(a){return a.parentNode&&a.parentNode.selectedIndex,a.selected===!0},empty:function(a){for(a=a.firstChild;a;a=a.nextSibling)if(a.nodeType<6)return!1;return!0},parent:function(a){return!d.pseudos.empty(a)},header:function(a){return Z.test(a.nodeName)},input:function(a){return Y.test(a.nodeName)},button:function(a){var b=a.nodeName.toLowerCase();return"input"===b&&"button"===a.type||"button"===b},text:function(a){var b;return"input"===a.nodeName.toLowerCase()&&"text"===a.type&&(null==(b=a.getAttribute("type"))||"text"===b.toLowerCase())},first:nb(function(){return[0]}),last:nb(function(a,b){return[b-1]}),eq:nb(function(a,b,c){return[0>c?c+b:c]}),even:nb(function(a,b){for(var c=0;b>c;c+=2)a.push(c);return a}),odd:nb(function(a,b){for(var c=1;b>c;c+=2)a.push(c);return a}),lt:nb(function(a,b,c){for(var d=0>c?c+b:c;--d>=0;)a.push(d);return a}),gt:nb(function(a,b,c){for(var d=0>c?c+b:c;++d<b;)a.push(d);return a})}},d.pseudos.nth=d.pseudos.eq;for(b in{radio:!0,checkbox:!0,file:!0,password:!0,image:!0})d.pseudos[b]=lb(b);for(b in{submit:!0,reset:!0})d.pseudos[b]=mb(b);function pb(){}pb.prototype=d.filters=d.pseudos,d.setFilters=new pb,g=fb.tokenize=function(a,b){var c,e,f,g,h,i,j,k=z[a+" "];if(k)return b?0:k.slice(0);h=a,i=[],j=d.preFilter;while(h){(!c||(e=S.exec(h)))&&(e&&(h=h.slice(e[0].length)||h),i.push(f=[])),c=!1,(e=T.exec(h))&&(c=e.shift(),f.push({value:c,type:e[0].replace(R," ")}),h=h.slice(c.length));for(g in d.filter)!(e=X[g].exec(h))||j[g]&&!(e=j[g](e))||(c=e.shift(),f.push({value:c,type:g,matches:e}),h=h.slice(c.length));if(!c)break}return b?h.length:h?fb.error(a):z(a,i).slice(0)};function qb(a){for(var b=0,c=a.length,d="";c>b;b++)d+=a[b].value;return d}function rb(a,b,c){var d=b.dir,e=c&&"parentNode"===d,f=x++;return b.first?function(b,c,f){while(b=b[d])if(1===b.nodeType||e)return a(b,c,f)}:function(b,c,g){var h,i,j=[w,f];if(g){while(b=b[d])if((1===b.nodeType||e)&&a(b,c,g))return!0}else while(b=b[d])if(1===b.nodeType||e){if(i=b[u]||(b[u]={}),(h=i[d])&&h[0]===w&&h[1]===f)return j[2]=h[2];if(i[d]=j,j[2]=a(b,c,g))return!0}}}function sb(a){return a.length>1?function(b,c,d){var e=a.length;while(e--)if(!a[e](b,c,d))return!1;return!0}:a[0]}function tb(a,b,c){for(var d=0,e=b.length;e>d;d++)fb(a,b[d],c);return c}function ub(a,b,c,d,e){for(var f,g=[],h=0,i=a.length,j=null!=b;i>h;h++)(f=a[h])&&(!c||c(f,d,e))&&(g.push(f),j&&b.push(h));return g}function vb(a,b,c,d,e,f){return d&&!d[u]&&(d=vb(d)),e&&!e[u]&&(e=vb(e,f)),hb(function(f,g,h,i){var j,k,l,m=[],n=[],o=g.length,p=f||tb(b||"*",h.nodeType?[h]:h,[]),q=!a||!f&&b?p:ub(p,m,a,h,i),r=c?e||(f?a:o||d)?[]:g:q;if(c&&c(q,r,h,i),d){j=ub(r,n),d(j,[],h,i),k=j.length;while(k--)(l=j[k])&&(r[n[k]]=!(q[n[k]]=l))}if(f){if(e||a){if(e){j=[],k=r.length;while(k--)(l=r[k])&&j.push(q[k]=l);e(null,r=[],j,i)}k=r.length;while(k--)(l=r[k])&&(j=e?K.call(f,l):m[k])>-1&&(f[j]=!(g[j]=l))}}else r=ub(r===g?r.splice(o,r.length):r),e?e(null,g,r,i):I.apply(g,r)})}function wb(a){for(var b,c,e,f=a.length,g=d.relative[a[0].type],h=g||d.relative[" "],i=g?1:0,k=rb(function(a){return a===b},h,!0),l=rb(function(a){return K.call(b,a)>-1},h,!0),m=[function(a,c,d){return!g&&(d||c!==j)||((b=c).nodeType?k(a,c,d):l(a,c,d))}];f>i;i++)if(c=d.relative[a[i].type])m=[rb(sb(m),c)];else{if(c=d.filter[a[i].type].apply(null,a[i].matches),c[u]){for(e=++i;f>e;e++)if(d.relative[a[e].type])break;return vb(i>1&&sb(m),i>1&&qb(a.slice(0,i-1).concat({value:" "===a[i-2].type?"*":""})).replace(R,"$1"),c,e>i&&wb(a.slice(i,e)),f>e&&wb(a=a.slice(e)),f>e&&qb(a))}m.push(c)}return sb(m)}function xb(a,b){var c=b.length>0,e=a.length>0,f=function(f,g,h,i,k){var l,m,o,p=0,q="0",r=f&&[],s=[],t=j,u=f||e&&d.find.TAG("*",k),v=w+=null==t?1:Math.random()||.1,x=u.length;for(k&&(j=g!==n&&g);q!==x&&null!=(l=u[q]);q++){if(e&&l){m=0;while(o=a[m++])if(o(l,g,h)){i.push(l);break}k&&(w=v)}c&&((l=!o&&l)&&p--,f&&r.push(l))}if(p+=q,c&&q!==p){m=0;while(o=b[m++])o(r,s,g,h);if(f){if(p>0)while(q--)r[q]||s[q]||(s[q]=G.call(i));s=ub(s)}I.apply(i,s),k&&!f&&s.length>0&&p+b.length>1&&fb.uniqueSort(i)}return k&&(w=v,j=t),r};return c?hb(f):f}return h=fb.compile=function(a,b){var c,d=[],e=[],f=A[a+" "];if(!f){b||(b=g(a)),c=b.length;while(c--)f=wb(b[c]),f[u]?d.push(f):e.push(f);f=A(a,xb(e,d)),f.selector=a}return f},i=fb.select=function(a,b,e,f){var i,j,k,l,m,n="function"==typeof a&&a,o=!f&&g(a=n.selector||a);if(e=e||[],1===o.length){if(j=o[0]=o[0].slice(0),j.length>2&&"ID"===(k=j[0]).type&&c.getById&&9===b.nodeType&&p&&d.relative[j[1].type]){if(b=(d.find.ID(k.matches[0].replace(cb,db),b)||[])[0],!b)return e;n&&(b=b.parentNode),a=a.slice(j.shift().value.length)}i=X.needsContext.test(a)?0:j.length;while(i--){if(k=j[i],d.relative[l=k.type])break;if((m=d.find[l])&&(f=m(k.matches[0].replace(cb,db),ab.test(j[0].type)&&ob(b.parentNode)||b))){if(j.splice(i,1),a=f.length&&qb(j),!a)return I.apply(e,f),e;break}}}return(n||h(a,o))(f,b,!p,e,ab.test(a)&&ob(b.parentNode)||b),e},c.sortStable=u.split("").sort(B).join("")===u,c.detectDuplicates=!!l,m(),c.sortDetached=ib(function(a){return 1&a.compareDocumentPosition(n.createElement("div"))}),ib(function(a){return a.innerHTML="<a href='#'></a>","#"===a.firstChild.getAttribute("href")})||jb("type|href|height|width",function(a,b,c){return c?void 0:a.getAttribute(b,"type"===b.toLowerCase()?1:2)}),c.attributes&&ib(function(a){return a.innerHTML="<input/>",a.firstChild.setAttribute("value",""),""===a.firstChild.getAttribute("value")})||jb("value",function(a,b,c){return c||"input"!==a.nodeName.toLowerCase()?void 0:a.defaultValue}),ib(function(a){return null==a.getAttribute("disabled")})||jb(L,function(a,b,c){var d;return c?void 0:a[b]===!0?b.toLowerCase():(d=a.getAttributeNode(b))&&d.specified?d.value:null}),fb}(a);n.find=t,n.expr=t.selectors,n.expr[":"]=n.expr.pseudos,n.unique=t.uniqueSort,n.text=t.getText,n.isXMLDoc=t.isXML,n.contains=t.contains;var u=n.expr.match.needsContext,v=/^<(\w+)\s*\/?>(?:<\/\1>|)$/,w=/^.[^:#\[\.,]*$/;function x(a,b,c){if(n.isFunction(b))return n.grep(a,function(a,d){return!!b.call(a,d,a)!==c});if(b.nodeType)return n.grep(a,function(a){return a===b!==c});if("string"==typeof b){if(w.test(b))return n.filter(b,a,c);b=n.filter(b,a)}return n.grep(a,function(a){return g.call(b,a)>=0!==c})}n.filter=function(a,b,c){var d=b[0];return c&&(a=":not("+a+")"),1===b.length&&1===d.nodeType?n.find.matchesSelector(d,a)?[d]:[]:n.find.matches(a,n.grep(b,function(a){return 1===a.nodeType}))},n.fn.extend({find:function(a){var b,c=this.length,d=[],e=this;if("string"!=typeof a)return this.pushStack(n(a).filter(function(){for(b=0;c>b;b++)if(n.contains(e[b],this))return!0}));for(b=0;c>b;b++)n.find(a,e[b],d);return d=this.pushStack(c>1?n.unique(d):d),d.selector=this.selector?this.selector+" "+a:a,d},filter:function(a){return this.pushStack(x(this,a||[],!1))},not:function(a){return this.pushStack(x(this,a||[],!0))},is:function(a){return!!x(this,"string"==typeof a&&u.test(a)?n(a):a||[],!1).length}});var y,z=/^(?:\s*(<[\w\W]+>)[^>]*|#([\w-]*))$/,A=n.fn.init=function(a,b){var c,d;if(!a)return this;if("string"==typeof a){if(c="<"===a[0]&&">"===a[a.length-1]&&a.length>=3?[null,a,null]:z.exec(a),!c||!c[1]&&b)return!b||b.jquery?(b||y).find(a):this.constructor(b).find(a);if(c[1]){if(b=b instanceof n?b[0]:b,n.merge(this,n.parseHTML(c[1],b&&b.nodeType?b.ownerDocument||b:l,!0)),v.test(c[1])&&n.isPlainObject(b))for(c in b)n.isFunction(this[c])?this[c](b[c]):this.attr(c,b[c]);return this}return d=l.getElementById(c[2]),d&&d.parentNode&&(this.length=1,this[0]=d),this.context=l,this.selector=a,this}return a.nodeType?(this.context=this[0]=a,this.length=1,this):n.isFunction(a)?"undefined"!=typeof y.ready?y.ready(a):a(n):(void 0!==a.selector&&(this.selector=a.selector,this.context=a.context),n.makeArray(a,this))};A.prototype=n.fn,y=n(l);var B=/^(?:parents|prev(?:Until|All))/,C={children:!0,contents:!0,next:!0,prev:!0};n.extend({dir:function(a,b,c){var d=[],e=void 0!==c;while((a=a[b])&&9!==a.nodeType)if(1===a.nodeType){if(e&&n(a).is(c))break;d.push(a)}return d},sibling:function(a,b){for(var c=[];a;a=a.nextSibling)1===a.nodeType&&a!==b&&c.push(a);return c}}),n.fn.extend({has:function(a){var b=n(a,this),c=b.length;return this.filter(function(){for(var a=0;c>a;a++)if(n.contains(this,b[a]))return!0})},closest:function(a,b){for(var c,d=0,e=this.length,f=[],g=u.test(a)||"string"!=typeof a?n(a,b||this.context):0;e>d;d++)for(c=this[d];c&&c!==b;c=c.parentNode)if(c.nodeType<11&&(g?g.index(c)>-1:1===c.nodeType&&n.find.matchesSelector(c,a))){f.push(c);break}return this.pushStack(f.length>1?n.unique(f):f)},index:function(a){return a?"string"==typeof a?g.call(n(a),this[0]):g.call(this,a.jquery?a[0]:a):this[0]&&this[0].parentNode?this.first().prevAll().length:-1},add:function(a,b){return this.pushStack(n.unique(n.merge(this.get(),n(a,b))))},addBack:function(a){return this.add(null==a?this.prevObject:this.prevObject.filter(a))}});function D(a,b){while((a=a[b])&&1!==a.nodeType);return a}n.each({parent:function(a){var b=a.parentNode;return b&&11!==b.nodeType?b:null},parents:function(a){return n.dir(a,"parentNode")},parentsUntil:function(a,b,c){return n.dir(a,"parentNode",c)},next:function(a){return D(a,"nextSibling")},prev:function(a){return D(a,"previousSibling")},nextAll:function(a){return n.dir(a,"nextSibling")},prevAll:function(a){return n.dir(a,"previousSibling")},nextUntil:function(a,b,c){return n.dir(a,"nextSibling",c)},prevUntil:function(a,b,c){return n.dir(a,"previousSibling",c)},siblings:function(a){return n.sibling((a.parentNode||{}).firstChild,a)},children:function(a){return n.sibling(a.firstChild)},contents:function(a){return a.contentDocument||n.merge([],a.childNodes)}},function(a,b){n.fn[a]=function(c,d){var e=n.map(this,b,c);return"Until"!==a.slice(-5)&&(d=c),d&&"string"==typeof d&&(e=n.filter(d,e)),this.length>1&&(C[a]||n.unique(e),B.test(a)&&e.reverse()),this.pushStack(e)}});var E=/\S+/g,F={};function G(a){var b=F[a]={};return n.each(a.match(E)||[],function(a,c){b[c]=!0}),b}n.Callbacks=function(a){a="string"==typeof a?F[a]||G(a):n.extend({},a);var b,c,d,e,f,g,h=[],i=!a.once&&[],j=function(l){for(b=a.memory&&l,c=!0,g=e||0,e=0,f=h.length,d=!0;h&&f>g;g++)if(h[g].apply(l[0],l[1])===!1&&a.stopOnFalse){b=!1;break}d=!1,h&&(i?i.length&&j(i.shift()):b?h=[]:k.disable())},k={add:function(){if(h){var c=h.length;!function g(b){n.each(b,function(b,c){var d=n.type(c);"function"===d?a.unique&&k.has(c)||h.push(c):c&&c.length&&"string"!==d&&g(c)})}(arguments),d?f=h.length:b&&(e=c,j(b))}return this},remove:function(){return h&&n.each(arguments,function(a,b){var c;while((c=n.inArray(b,h,c))>-1)h.splice(c,1),d&&(f>=c&&f--,g>=c&&g--)}),this},has:function(a){return a?n.inArray(a,h)>-1:!(!h||!h.length)},empty:function(){return h=[],f=0,this},disable:function(){return h=i=b=void 0,this},disabled:function(){return!h},lock:function(){return i=void 0,b||k.disable(),this},locked:function(){return!i},fireWith:function(a,b){return!h||c&&!i||(b=b||[],b=[a,b.slice?b.slice():b],d?i.push(b):j(b)),this},fire:function(){return k.fireWith(this,arguments),this},fired:function(){return!!c}};return k},n.extend({Deferred:function(a){var b=[["resolve","done",n.Callbacks("once memory"),"resolved"],["reject","fail",n.Callbacks("once memory"),"rejected"],["notify","progress",n.Callbacks("memory")]],c="pending",d={state:function(){return c},always:function(){return e.done(arguments).fail(arguments),this},then:function(){var a=arguments;return n.Deferred(function(c){n.each(b,function(b,f){var g=n.isFunction(a[b])&&a[b];e[f[1]](function(){var a=g&&g.apply(this,arguments);a&&n.isFunction(a.promise)?a.promise().done(c.resolve).fail(c.reject).progress(c.notify):c[f[0]+"With"](this===d?c.promise():this,g?[a]:arguments)})}),a=null}).promise()},promise:function(a){return null!=a?n.extend(a,d):d}},e={};return d.pipe=d.then,n.each(b,function(a,f){var g=f[2],h=f[3];d[f[1]]=g.add,h&&g.add(function(){c=h},b[1^a][2].disable,b[2][2].lock),e[f[0]]=function(){return e[f[0]+"With"](this===e?d:this,arguments),this},e[f[0]+"With"]=g.fireWith}),d.promise(e),a&&a.call(e,e),e},when:function(a){var b=0,c=d.call(arguments),e=c.length,f=1!==e||a&&n.isFunction(a.promise)?e:0,g=1===f?a:n.Deferred(),h=function(a,b,c){return function(e){b[a]=this,c[a]=arguments.length>1?d.call(arguments):e,c===i?g.notifyWith(b,c):--f||g.resolveWith(b,c)}},i,j,k;if(e>1)for(i=new Array(e),j=new Array(e),k=new Array(e);e>b;b++)c[b]&&n.isFunction(c[b].promise)?c[b].promise().done(h(b,k,c)).fail(g.reject).progress(h(b,j,i)):--f;return f||g.resolveWith(k,c),g.promise()}});var H;n.fn.ready=function(a){return n.ready.promise().done(a),this},n.extend({isReady:!1,readyWait:1,holdReady:function(a){a?n.readyWait++:n.ready(!0)},ready:function(a){(a===!0?--n.readyWait:n.isReady)||(n.isReady=!0,a!==!0&&--n.readyWait>0||(H.resolveWith(l,[n]),n.fn.triggerHandler&&(n(l).triggerHandler("ready"),n(l).off("ready"))))}});function I(){l.removeEventListener("DOMContentLoaded",I,!1),a.removeEventListener("load",I,!1),n.ready()}n.ready.promise=function(b){return H||(H=n.Deferred(),"complete"===l.readyState?setTimeout(n.ready):(l.addEventListener("DOMContentLoaded",I,!1),a.addEventListener("load",I,!1))),H.promise(b)},n.ready.promise();var J=n.access=function(a,b,c,d,e,f,g){var h=0,i=a.length,j=null==c;if("object"===n.type(c)){e=!0;for(h in c)n.access(a,b,h,c[h],!0,f,g)}else if(void 0!==d&&(e=!0,n.isFunction(d)||(g=!0),j&&(g?(b.call(a,d),b=null):(j=b,b=function(a,b,c){return j.call(n(a),c)})),b))for(;i>h;h++)b(a[h],c,g?d:d.call(a[h],h,b(a[h],c)));return e?a:j?b.call(a):i?b(a[0],c):f};n.acceptData=function(a){return 1===a.nodeType||9===a.nodeType||!+a.nodeType};function K(){Object.defineProperty(this.cache={},0,{get:function(){return{}}}),this.expando=n.expando+Math.random()}K.uid=1,K.accepts=n.acceptData,K.prototype={key:function(a){if(!K.accepts(a))return 0;var b={},c=a[this.expando];if(!c){c=K.uid++;try{b[this.expando]={value:c},Object.defineProperties(a,b)}catch(d){b[this.expando]=c,n.extend(a,b)}}return this.cache[c]||(this.cache[c]={}),c},set:function(a,b,c){var d,e=this.key(a),f=this.cache[e];if("string"==typeof b)f[b]=c;else if(n.isEmptyObject(f))n.extend(this.cache[e],b);else for(d in b)f[d]=b[d];return f},get:function(a,b){var c=this.cache[this.key(a)];return void 0===b?c:c[b]},access:function(a,b,c){var d;return void 0===b||b&&"string"==typeof b&&void 0===c?(d=this.get(a,b),void 0!==d?d:this.get(a,n.camelCase(b))):(this.set(a,b,c),void 0!==c?c:b)},remove:function(a,b){var c,d,e,f=this.key(a),g=this.cache[f];if(void 0===b)this.cache[f]={};else{n.isArray(b)?d=b.concat(b.map(n.camelCase)):(e=n.camelCase(b),b in g?d=[b,e]:(d=e,d=d in g?[d]:d.match(E)||[])),c=d.length;while(c--)delete g[d[c]]}},hasData:function(a){return!n.isEmptyObject(this.cache[a[this.expando]]||{})},discard:function(a){a[this.expando]&&delete this.cache[a[this.expando]]}};var L=new K,M=new K,N=/^(?:\{[\w\W]*\}|\[[\w\W]*\])$/,O=/([A-Z])/g;function P(a,b,c){var d;if(void 0===c&&1===a.nodeType)if(d="data-"+b.replace(O,"-$1").toLowerCase(),c=a.getAttribute(d),"string"==typeof c){try{c="true"===c?!0:"false"===c?!1:"null"===c?null:+c+""===c?+c:N.test(c)?n.parseJSON(c):c}catch(e){}M.set(a,b,c)}else c=void 0;return c}n.extend({hasData:function(a){return M.hasData(a)||L.hasData(a)},data:function(a,b,c){return M.access(a,b,c)},removeData:function(a,b){M.remove(a,b)
},_data:function(a,b,c){return L.access(a,b,c)},_removeData:function(a,b){L.remove(a,b)}}),n.fn.extend({data:function(a,b){var c,d,e,f=this[0],g=f&&f.attributes;if(void 0===a){if(this.length&&(e=M.get(f),1===f.nodeType&&!L.get(f,"hasDataAttrs"))){c=g.length;while(c--)g[c]&&(d=g[c].name,0===d.indexOf("data-")&&(d=n.camelCase(d.slice(5)),P(f,d,e[d])));L.set(f,"hasDataAttrs",!0)}return e}return"object"==typeof a?this.each(function(){M.set(this,a)}):J(this,function(b){var c,d=n.camelCase(a);if(f&&void 0===b){if(c=M.get(f,a),void 0!==c)return c;if(c=M.get(f,d),void 0!==c)return c;if(c=P(f,d,void 0),void 0!==c)return c}else this.each(function(){var c=M.get(this,d);M.set(this,d,b),-1!==a.indexOf("-")&&void 0!==c&&M.set(this,a,b)})},null,b,arguments.length>1,null,!0)},removeData:function(a){return this.each(function(){M.remove(this,a)})}}),n.extend({queue:function(a,b,c){var d;return a?(b=(b||"fx")+"queue",d=L.get(a,b),c&&(!d||n.isArray(c)?d=L.access(a,b,n.makeArray(c)):d.push(c)),d||[]):void 0},dequeue:function(a,b){b=b||"fx";var c=n.queue(a,b),d=c.length,e=c.shift(),f=n._queueHooks(a,b),g=function(){n.dequeue(a,b)};"inprogress"===e&&(e=c.shift(),d--),e&&("fx"===b&&c.unshift("inprogress"),delete f.stop,e.call(a,g,f)),!d&&f&&f.empty.fire()},_queueHooks:function(a,b){var c=b+"queueHooks";return L.get(a,c)||L.access(a,c,{empty:n.Callbacks("once memory").add(function(){L.remove(a,[b+"queue",c])})})}}),n.fn.extend({queue:function(a,b){var c=2;return"string"!=typeof a&&(b=a,a="fx",c--),arguments.length<c?n.queue(this[0],a):void 0===b?this:this.each(function(){var c=n.queue(this,a,b);n._queueHooks(this,a),"fx"===a&&"inprogress"!==c[0]&&n.dequeue(this,a)})},dequeue:function(a){return this.each(function(){n.dequeue(this,a)})},clearQueue:function(a){return this.queue(a||"fx",[])},promise:function(a,b){var c,d=1,e=n.Deferred(),f=this,g=this.length,h=function(){--d||e.resolveWith(f,[f])};"string"!=typeof a&&(b=a,a=void 0),a=a||"fx";while(g--)c=L.get(f[g],a+"queueHooks"),c&&c.empty&&(d++,c.empty.add(h));return h(),e.promise(b)}});var Q=/[+-]?(?:\d*\.|)\d+(?:[eE][+-]?\d+|)/.source,R=["Top","Right","Bottom","Left"],S=function(a,b){return a=b||a,"none"===n.css(a,"display")||!n.contains(a.ownerDocument,a)},T=/^(?:checkbox|radio)$/i;!function(){var a=l.createDocumentFragment(),b=a.appendChild(l.createElement("div")),c=l.createElement("input");c.setAttribute("type","radio"),c.setAttribute("checked","checked"),c.setAttribute("name","t"),b.appendChild(c),k.checkClone=b.cloneNode(!0).cloneNode(!0).lastChild.checked,b.innerHTML="<textarea>x</textarea>",k.noCloneChecked=!!b.cloneNode(!0).lastChild.defaultValue}();var U="undefined";k.focusinBubbles="onfocusin"in a;var V=/^key/,W=/^(?:mouse|pointer|contextmenu)|click/,X=/^(?:focusinfocus|focusoutblur)$/,Y=/^([^.]*)(?:\.(.+)|)$/;function Z(){return!0}function $(){return!1}function _(){try{return l.activeElement}catch(a){}}n.event={global:{},add:function(a,b,c,d,e){var f,g,h,i,j,k,l,m,o,p,q,r=L.get(a);if(r){c.handler&&(f=c,c=f.handler,e=f.selector),c.guid||(c.guid=n.guid++),(i=r.events)||(i=r.events={}),(g=r.handle)||(g=r.handle=function(b){return typeof n!==U&&n.event.triggered!==b.type?n.event.dispatch.apply(a,arguments):void 0}),b=(b||"").match(E)||[""],j=b.length;while(j--)h=Y.exec(b[j])||[],o=q=h[1],p=(h[2]||"").split(".").sort(),o&&(l=n.event.special[o]||{},o=(e?l.delegateType:l.bindType)||o,l=n.event.special[o]||{},k=n.extend({type:o,origType:q,data:d,handler:c,guid:c.guid,selector:e,needsContext:e&&n.expr.match.needsContext.test(e),namespace:p.join(".")},f),(m=i[o])||(m=i[o]=[],m.delegateCount=0,l.setup&&l.setup.call(a,d,p,g)!==!1||a.addEventListener&&a.addEventListener(o,g,!1)),l.add&&(l.add.call(a,k),k.handler.guid||(k.handler.guid=c.guid)),e?m.splice(m.delegateCount++,0,k):m.push(k),n.event.global[o]=!0)}},remove:function(a,b,c,d,e){var f,g,h,i,j,k,l,m,o,p,q,r=L.hasData(a)&&L.get(a);if(r&&(i=r.events)){b=(b||"").match(E)||[""],j=b.length;while(j--)if(h=Y.exec(b[j])||[],o=q=h[1],p=(h[2]||"").split(".").sort(),o){l=n.event.special[o]||{},o=(d?l.delegateType:l.bindType)||o,m=i[o]||[],h=h[2]&&new RegExp("(^|\\.)"+p.join("\\.(?:.*\\.|)")+"(\\.|$)"),g=f=m.length;while(f--)k=m[f],!e&&q!==k.origType||c&&c.guid!==k.guid||h&&!h.test(k.namespace)||d&&d!==k.selector&&("**"!==d||!k.selector)||(m.splice(f,1),k.selector&&m.delegateCount--,l.remove&&l.remove.call(a,k));g&&!m.length&&(l.teardown&&l.teardown.call(a,p,r.handle)!==!1||n.removeEvent(a,o,r.handle),delete i[o])}else for(o in i)n.event.remove(a,o+b[j],c,d,!0);n.isEmptyObject(i)&&(delete r.handle,L.remove(a,"events"))}},trigger:function(b,c,d,e){var f,g,h,i,k,m,o,p=[d||l],q=j.call(b,"type")?b.type:b,r=j.call(b,"namespace")?b.namespace.split("."):[];if(g=h=d=d||l,3!==d.nodeType&&8!==d.nodeType&&!X.test(q+n.event.triggered)&&(q.indexOf(".")>=0&&(r=q.split("."),q=r.shift(),r.sort()),k=q.indexOf(":")<0&&"on"+q,b=b[n.expando]?b:new n.Event(q,"object"==typeof b&&b),b.isTrigger=e?2:3,b.namespace=r.join("."),b.namespace_re=b.namespace?new RegExp("(^|\\.)"+r.join("\\.(?:.*\\.|)")+"(\\.|$)"):null,b.result=void 0,b.target||(b.target=d),c=null==c?[b]:n.makeArray(c,[b]),o=n.event.special[q]||{},e||!o.trigger||o.trigger.apply(d,c)!==!1)){if(!e&&!o.noBubble&&!n.isWindow(d)){for(i=o.delegateType||q,X.test(i+q)||(g=g.parentNode);g;g=g.parentNode)p.push(g),h=g;h===(d.ownerDocument||l)&&p.push(h.defaultView||h.parentWindow||a)}f=0;while((g=p[f++])&&!b.isPropagationStopped())b.type=f>1?i:o.bindType||q,m=(L.get(g,"events")||{})[b.type]&&L.get(g,"handle"),m&&m.apply(g,c),m=k&&g[k],m&&m.apply&&n.acceptData(g)&&(b.result=m.apply(g,c),b.result===!1&&b.preventDefault());return b.type=q,e||b.isDefaultPrevented()||o._default&&o._default.apply(p.pop(),c)!==!1||!n.acceptData(d)||k&&n.isFunction(d[q])&&!n.isWindow(d)&&(h=d[k],h&&(d[k]=null),n.event.triggered=q,d[q](),n.event.triggered=void 0,h&&(d[k]=h)),b.result}},dispatch:function(a){a=n.event.fix(a);var b,c,e,f,g,h=[],i=d.call(arguments),j=(L.get(this,"events")||{})[a.type]||[],k=n.event.special[a.type]||{};if(i[0]=a,a.delegateTarget=this,!k.preDispatch||k.preDispatch.call(this,a)!==!1){h=n.event.handlers.call(this,a,j),b=0;while((f=h[b++])&&!a.isPropagationStopped()){a.currentTarget=f.elem,c=0;while((g=f.handlers[c++])&&!a.isImmediatePropagationStopped())(!a.namespace_re||a.namespace_re.test(g.namespace))&&(a.handleObj=g,a.data=g.data,e=((n.event.special[g.origType]||{}).handle||g.handler).apply(f.elem,i),void 0!==e&&(a.result=e)===!1&&(a.preventDefault(),a.stopPropagation()))}return k.postDispatch&&k.postDispatch.call(this,a),a.result}},handlers:function(a,b){var c,d,e,f,g=[],h=b.delegateCount,i=a.target;if(h&&i.nodeType&&(!a.button||"click"!==a.type))for(;i!==this;i=i.parentNode||this)if(i.disabled!==!0||"click"!==a.type){for(d=[],c=0;h>c;c++)f=b[c],e=f.selector+" ",void 0===d[e]&&(d[e]=f.needsContext?n(e,this).index(i)>=0:n.find(e,this,null,[i]).length),d[e]&&d.push(f);d.length&&g.push({elem:i,handlers:d})}return h<b.length&&g.push({elem:this,handlers:b.slice(h)}),g},props:"altKey bubbles cancelable ctrlKey currentTarget eventPhase metaKey relatedTarget shiftKey target timeStamp view which".split(" "),fixHooks:{},keyHooks:{props:"char charCode key keyCode".split(" "),filter:function(a,b){return null==a.which&&(a.which=null!=b.charCode?b.charCode:b.keyCode),a}},mouseHooks:{props:"button buttons clientX clientY offsetX offsetY pageX pageY screenX screenY toElement".split(" "),filter:function(a,b){var c,d,e,f=b.button;return null==a.pageX&&null!=b.clientX&&(c=a.target.ownerDocument||l,d=c.documentElement,e=c.body,a.pageX=b.clientX+(d&&d.scrollLeft||e&&e.scrollLeft||0)-(d&&d.clientLeft||e&&e.clientLeft||0),a.pageY=b.clientY+(d&&d.scrollTop||e&&e.scrollTop||0)-(d&&d.clientTop||e&&e.clientTop||0)),a.which||void 0===f||(a.which=1&f?1:2&f?3:4&f?2:0),a}},fix:function(a){if(a[n.expando])return a;var b,c,d,e=a.type,f=a,g=this.fixHooks[e];g||(this.fixHooks[e]=g=W.test(e)?this.mouseHooks:V.test(e)?this.keyHooks:{}),d=g.props?this.props.concat(g.props):this.props,a=new n.Event(f),b=d.length;while(b--)c=d[b],a[c]=f[c];return a.target||(a.target=l),3===a.target.nodeType&&(a.target=a.target.parentNode),g.filter?g.filter(a,f):a},special:{load:{noBubble:!0},focus:{trigger:function(){return this!==_()&&this.focus?(this.focus(),!1):void 0},delegateType:"focusin"},blur:{trigger:function(){return this===_()&&this.blur?(this.blur(),!1):void 0},delegateType:"focusout"},click:{trigger:function(){return"checkbox"===this.type&&this.click&&n.nodeName(this,"input")?(this.click(),!1):void 0},_default:function(a){return n.nodeName(a.target,"a")}},beforeunload:{postDispatch:function(a){void 0!==a.result&&a.originalEvent&&(a.originalEvent.returnValue=a.result)}}},simulate:function(a,b,c,d){var e=n.extend(new n.Event,c,{type:a,isSimulated:!0,originalEvent:{}});d?n.event.trigger(e,null,b):n.event.dispatch.call(b,e),e.isDefaultPrevented()&&c.preventDefault()}},n.removeEvent=function(a,b,c){a.removeEventListener&&a.removeEventListener(b,c,!1)},n.Event=function(a,b){return this instanceof n.Event?(a&&a.type?(this.originalEvent=a,this.type=a.type,this.isDefaultPrevented=a.defaultPrevented||void 0===a.defaultPrevented&&a.returnValue===!1?Z:$):this.type=a,b&&n.extend(this,b),this.timeStamp=a&&a.timeStamp||n.now(),void(this[n.expando]=!0)):new n.Event(a,b)},n.Event.prototype={isDefaultPrevented:$,isPropagationStopped:$,isImmediatePropagationStopped:$,preventDefault:function(){var a=this.originalEvent;this.isDefaultPrevented=Z,a&&a.preventDefault&&a.preventDefault()},stopPropagation:function(){var a=this.originalEvent;this.isPropagationStopped=Z,a&&a.stopPropagation&&a.stopPropagation()},stopImmediatePropagation:function(){var a=this.originalEvent;this.isImmediatePropagationStopped=Z,a&&a.stopImmediatePropagation&&a.stopImmediatePropagation(),this.stopPropagation()}},n.each({mouseenter:"mouseover",mouseleave:"mouseout",pointerenter:"pointerover",pointerleave:"pointerout"},function(a,b){n.event.special[a]={delegateType:b,bindType:b,handle:function(a){var c,d=this,e=a.relatedTarget,f=a.handleObj;return(!e||e!==d&&!n.contains(d,e))&&(a.type=f.origType,c=f.handler.apply(this,arguments),a.type=b),c}}}),k.focusinBubbles||n.each({focus:"focusin",blur:"focusout"},function(a,b){var c=function(a){n.event.simulate(b,a.target,n.event.fix(a),!0)};n.event.special[b]={setup:function(){var d=this.ownerDocument||this,e=L.access(d,b);e||d.addEventListener(a,c,!0),L.access(d,b,(e||0)+1)},teardown:function(){var d=this.ownerDocument||this,e=L.access(d,b)-1;e?L.access(d,b,e):(d.removeEventListener(a,c,!0),L.remove(d,b))}}}),n.fn.extend({on:function(a,b,c,d,e){var f,g;if("object"==typeof a){"string"!=typeof b&&(c=c||b,b=void 0);for(g in a)this.on(g,b,c,a[g],e);return this}if(null==c&&null==d?(d=b,c=b=void 0):null==d&&("string"==typeof b?(d=c,c=void 0):(d=c,c=b,b=void 0)),d===!1)d=$;else if(!d)return this;return 1===e&&(f=d,d=function(a){return n().off(a),f.apply(this,arguments)},d.guid=f.guid||(f.guid=n.guid++)),this.each(function(){n.event.add(this,a,d,c,b)})},one:function(a,b,c,d){return this.on(a,b,c,d,1)},off:function(a,b,c){var d,e;if(a&&a.preventDefault&&a.handleObj)return d=a.handleObj,n(a.delegateTarget).off(d.namespace?d.origType+"."+d.namespace:d.origType,d.selector,d.handler),this;if("object"==typeof a){for(e in a)this.off(e,b,a[e]);return this}return(b===!1||"function"==typeof b)&&(c=b,b=void 0),c===!1&&(c=$),this.each(function(){n.event.remove(this,a,c,b)})},trigger:function(a,b){return this.each(function(){n.event.trigger(a,b,this)})},triggerHandler:function(a,b){var c=this[0];return c?n.event.trigger(a,b,c,!0):void 0}});var ab=/<(?!area|br|col|embed|hr|img|input|link|meta|param)(([\w:]+)[^>]*)\/>/gi,bb=/<([\w:]+)/,cb=/<|&#?\w+;/,db=/<(?:script|style|link)/i,eb=/checked\s*(?:[^=]|=\s*.checked.)/i,fb=/^$|\/(?:java|ecma)script/i,gb=/^true\/(.*)/,hb=/^\s*<!(?:\[CDATA\[|--)|(?:\]\]|--)>\s*$/g,ib={option:[1,"<select multiple='multiple'>","</select>"],thead:[1,"<table>","</table>"],col:[2,"<table><colgroup>","</colgroup></table>"],tr:[2,"<table><tbody>","</tbody></table>"],td:[3,"<table><tbody><tr>","</tr></tbody></table>"],_default:[0,"",""]};ib.optgroup=ib.option,ib.tbody=ib.tfoot=ib.colgroup=ib.caption=ib.thead,ib.th=ib.td;function jb(a,b){return n.nodeName(a,"table")&&n.nodeName(11!==b.nodeType?b:b.firstChild,"tr")?a.getElementsByTagName("tbody")[0]||a.appendChild(a.ownerDocument.createElement("tbody")):a}function kb(a){return a.type=(null!==a.getAttribute("type"))+"/"+a.type,a}function lb(a){var b=gb.exec(a.type);return b?a.type=b[1]:a.removeAttribute("type"),a}function mb(a,b){for(var c=0,d=a.length;d>c;c++)L.set(a[c],"globalEval",!b||L.get(b[c],"globalEval"))}function nb(a,b){var c,d,e,f,g,h,i,j;if(1===b.nodeType){if(L.hasData(a)&&(f=L.access(a),g=L.set(b,f),j=f.events)){delete g.handle,g.events={};for(e in j)for(c=0,d=j[e].length;d>c;c++)n.event.add(b,e,j[e][c])}M.hasData(a)&&(h=M.access(a),i=n.extend({},h),M.set(b,i))}}function ob(a,b){var c=a.getElementsByTagName?a.getElementsByTagName(b||"*"):a.querySelectorAll?a.querySelectorAll(b||"*"):[];return void 0===b||b&&n.nodeName(a,b)?n.merge([a],c):c}function pb(a,b){var c=b.nodeName.toLowerCase();"input"===c&&T.test(a.type)?b.checked=a.checked:("input"===c||"textarea"===c)&&(b.defaultValue=a.defaultValue)}n.extend({clone:function(a,b,c){var d,e,f,g,h=a.cloneNode(!0),i=n.contains(a.ownerDocument,a);if(!(k.noCloneChecked||1!==a.nodeType&&11!==a.nodeType||n.isXMLDoc(a)))for(g=ob(h),f=ob(a),d=0,e=f.length;e>d;d++)pb(f[d],g[d]);if(b)if(c)for(f=f||ob(a),g=g||ob(h),d=0,e=f.length;e>d;d++)nb(f[d],g[d]);else nb(a,h);return g=ob(h,"script"),g.length>0&&mb(g,!i&&ob(a,"script")),h},buildFragment:function(a,b,c,d){for(var e,f,g,h,i,j,k=b.createDocumentFragment(),l=[],m=0,o=a.length;o>m;m++)if(e=a[m],e||0===e)if("object"===n.type(e))n.merge(l,e.nodeType?[e]:e);else if(cb.test(e)){f=f||k.appendChild(b.createElement("div")),g=(bb.exec(e)||["",""])[1].toLowerCase(),h=ib[g]||ib._default,f.innerHTML=h[1]+e.replace(ab,"<$1></$2>")+h[2],j=h[0];while(j--)f=f.lastChild;n.merge(l,f.childNodes),f=k.firstChild,f.textContent=""}else l.push(b.createTextNode(e));k.textContent="",m=0;while(e=l[m++])if((!d||-1===n.inArray(e,d))&&(i=n.contains(e.ownerDocument,e),f=ob(k.appendChild(e),"script"),i&&mb(f),c)){j=0;while(e=f[j++])fb.test(e.type||"")&&c.push(e)}return k},cleanData:function(a){for(var b,c,d,e,f=n.event.special,g=0;void 0!==(c=a[g]);g++){if(n.acceptData(c)&&(e=c[L.expando],e&&(b=L.cache[e]))){if(b.events)for(d in b.events)f[d]?n.event.remove(c,d):n.removeEvent(c,d,b.handle);L.cache[e]&&delete L.cache[e]}delete M.cache[c[M.expando]]}}}),n.fn.extend({text:function(a){return J(this,function(a){return void 0===a?n.text(this):this.empty().each(function(){(1===this.nodeType||11===this.nodeType||9===this.nodeType)&&(this.textContent=a)})},null,a,arguments.length)},append:function(){return this.domManip(arguments,function(a){if(1===this.nodeType||11===this.nodeType||9===this.nodeType){var b=jb(this,a);b.appendChild(a)}})},prepend:function(){return this.domManip(arguments,function(a){if(1===this.nodeType||11===this.nodeType||9===this.nodeType){var b=jb(this,a);b.insertBefore(a,b.firstChild)}})},before:function(){return this.domManip(arguments,function(a){this.parentNode&&this.parentNode.insertBefore(a,this)})},after:function(){return this.domManip(arguments,function(a){this.parentNode&&this.parentNode.insertBefore(a,this.nextSibling)})},remove:function(a,b){for(var c,d=a?n.filter(a,this):this,e=0;null!=(c=d[e]);e++)b||1!==c.nodeType||n.cleanData(ob(c)),c.parentNode&&(b&&n.contains(c.ownerDocument,c)&&mb(ob(c,"script")),c.parentNode.removeChild(c));return this},empty:function(){for(var a,b=0;null!=(a=this[b]);b++)1===a.nodeType&&(n.cleanData(ob(a,!1)),a.textContent="");return this},clone:function(a,b){return a=null==a?!1:a,b=null==b?a:b,this.map(function(){return n.clone(this,a,b)})},html:function(a){return J(this,function(a){var b=this[0]||{},c=0,d=this.length;if(void 0===a&&1===b.nodeType)return b.innerHTML;if("string"==typeof a&&!db.test(a)&&!ib[(bb.exec(a)||["",""])[1].toLowerCase()]){a=a.replace(ab,"<$1></$2>");try{for(;d>c;c++)b=this[c]||{},1===b.nodeType&&(n.cleanData(ob(b,!1)),b.innerHTML=a);b=0}catch(e){}}b&&this.empty().append(a)},null,a,arguments.length)},replaceWith:function(){var a=arguments[0];return this.domManip(arguments,function(b){a=this.parentNode,n.cleanData(ob(this)),a&&a.replaceChild(b,this)}),a&&(a.length||a.nodeType)?this:this.remove()},detach:function(a){return this.remove(a,!0)},domManip:function(a,b){a=e.apply([],a);var c,d,f,g,h,i,j=0,l=this.length,m=this,o=l-1,p=a[0],q=n.isFunction(p);if(q||l>1&&"string"==typeof p&&!k.checkClone&&eb.test(p))return this.each(function(c){var d=m.eq(c);q&&(a[0]=p.call(this,c,d.html())),d.domManip(a,b)});if(l&&(c=n.buildFragment(a,this[0].ownerDocument,!1,this),d=c.firstChild,1===c.childNodes.length&&(c=d),d)){for(f=n.map(ob(c,"script"),kb),g=f.length;l>j;j++)h=c,j!==o&&(h=n.clone(h,!0,!0),g&&n.merge(f,ob(h,"script"))),b.call(this[j],h,j);if(g)for(i=f[f.length-1].ownerDocument,n.map(f,lb),j=0;g>j;j++)h=f[j],fb.test(h.type||"")&&!L.access(h,"globalEval")&&n.contains(i,h)&&(h.src?n._evalUrl&&n._evalUrl(h.src):n.globalEval(h.textContent.replace(hb,"")))}return this}}),n.each({appendTo:"append",prependTo:"prepend",insertBefore:"before",insertAfter:"after",replaceAll:"replaceWith"},function(a,b){n.fn[a]=function(a){for(var c,d=[],e=n(a),g=e.length-1,h=0;g>=h;h++)c=h===g?this:this.clone(!0),n(e[h])[b](c),f.apply(d,c.get());return this.pushStack(d)}});var qb,rb={};function sb(b,c){var d,e=n(c.createElement(b)).appendTo(c.body),f=a.getDefaultComputedStyle&&(d=a.getDefaultComputedStyle(e[0]))?d.display:n.css(e[0],"display");return e.detach(),f}function tb(a){var b=l,c=rb[a];return c||(c=sb(a,b),"none"!==c&&c||(qb=(qb||n("<iframe frameborder='0' width='0' height='0'/>")).appendTo(b.documentElement),b=qb[0].contentDocument,b.write(),b.close(),c=sb(a,b),qb.detach()),rb[a]=c),c}var ub=/^margin/,vb=new RegExp("^("+Q+")(?!px)[a-z%]+$","i"),wb=function(a){return a.ownerDocument.defaultView.getComputedStyle(a,null)};function xb(a,b,c){var d,e,f,g,h=a.style;return c=c||wb(a),c&&(g=c.getPropertyValue(b)||c[b]),c&&(""!==g||n.contains(a.ownerDocument,a)||(g=n.style(a,b)),vb.test(g)&&ub.test(b)&&(d=h.width,e=h.minWidth,f=h.maxWidth,h.minWidth=h.maxWidth=h.width=g,g=c.width,h.width=d,h.minWidth=e,h.maxWidth=f)),void 0!==g?g+"":g}function yb(a,b){return{get:function(){return a()?void delete this.get:(this.get=b).apply(this,arguments)}}}!function(){var b,c,d=l.documentElement,e=l.createElement("div"),f=l.createElement("div");if(f.style){f.style.backgroundClip="content-box",f.cloneNode(!0).style.backgroundClip="",k.clearCloneStyle="content-box"===f.style.backgroundClip,e.style.cssText="border:0;width:0;height:0;top:0;left:-9999px;margin-top:1px;position:absolute",e.appendChild(f);function g(){f.style.cssText="-webkit-box-sizing:border-box;-moz-box-sizing:border-box;box-sizing:border-box;display:block;margin-top:1%;top:1%;border:1px;padding:1px;width:4px;position:absolute",f.innerHTML="",d.appendChild(e);var g=a.getComputedStyle(f,null);b="1%"!==g.top,c="4px"===g.width,d.removeChild(e)}a.getComputedStyle&&n.extend(k,{pixelPosition:function(){return g(),b},boxSizingReliable:function(){return null==c&&g(),c},reliableMarginRight:function(){var b,c=f.appendChild(l.createElement("div"));return c.style.cssText=f.style.cssText="-webkit-box-sizing:content-box;-moz-box-sizing:content-box;box-sizing:content-box;display:block;margin:0;border:0;padding:0",c.style.marginRight=c.style.width="0",f.style.width="1px",d.appendChild(e),b=!parseFloat(a.getComputedStyle(c,null).marginRight),d.removeChild(e),b}})}}(),n.swap=function(a,b,c,d){var e,f,g={};for(f in b)g[f]=a.style[f],a.style[f]=b[f];e=c.apply(a,d||[]);for(f in b)a.style[f]=g[f];return e};var zb=/^(none|table(?!-c[ea]).+)/,Ab=new RegExp("^("+Q+")(.*)$","i"),Bb=new RegExp("^([+-])=("+Q+")","i"),Cb={position:"absolute",visibility:"hidden",display:"block"},Db={letterSpacing:"0",fontWeight:"400"},Eb=["Webkit","O","Moz","ms"];function Fb(a,b){if(b in a)return b;var c=b[0].toUpperCase()+b.slice(1),d=b,e=Eb.length;while(e--)if(b=Eb[e]+c,b in a)return b;return d}function Gb(a,b,c){var d=Ab.exec(b);return d?Math.max(0,d[1]-(c||0))+(d[2]||"px"):b}function Hb(a,b,c,d,e){for(var f=c===(d?"border":"content")?4:"width"===b?1:0,g=0;4>f;f+=2)"margin"===c&&(g+=n.css(a,c+R[f],!0,e)),d?("content"===c&&(g-=n.css(a,"padding"+R[f],!0,e)),"margin"!==c&&(g-=n.css(a,"border"+R[f]+"Width",!0,e))):(g+=n.css(a,"padding"+R[f],!0,e),"padding"!==c&&(g+=n.css(a,"border"+R[f]+"Width",!0,e)));return g}function Ib(a,b,c){var d=!0,e="width"===b?a.offsetWidth:a.offsetHeight,f=wb(a),g="border-box"===n.css(a,"boxSizing",!1,f);if(0>=e||null==e){if(e=xb(a,b,f),(0>e||null==e)&&(e=a.style[b]),vb.test(e))return e;d=g&&(k.boxSizingReliable()||e===a.style[b]),e=parseFloat(e)||0}return e+Hb(a,b,c||(g?"border":"content"),d,f)+"px"}function Jb(a,b){for(var c,d,e,f=[],g=0,h=a.length;h>g;g++)d=a[g],d.style&&(f[g]=L.get(d,"olddisplay"),c=d.style.display,b?(f[g]||"none"!==c||(d.style.display=""),""===d.style.display&&S(d)&&(f[g]=L.access(d,"olddisplay",tb(d.nodeName)))):(e=S(d),"none"===c&&e||L.set(d,"olddisplay",e?c:n.css(d,"display"))));for(g=0;h>g;g++)d=a[g],d.style&&(b&&"none"!==d.style.display&&""!==d.style.display||(d.style.display=b?f[g]||"":"none"));return a}n.extend({cssHooks:{opacity:{get:function(a,b){if(b){var c=xb(a,"opacity");return""===c?"1":c}}}},cssNumber:{columnCount:!0,fillOpacity:!0,flexGrow:!0,flexShrink:!0,fontWeight:!0,lineHeight:!0,opacity:!0,order:!0,orphans:!0,widows:!0,zIndex:!0,zoom:!0},cssProps:{"float":"cssFloat"},style:function(a,b,c,d){if(a&&3!==a.nodeType&&8!==a.nodeType&&a.style){var e,f,g,h=n.camelCase(b),i=a.style;return b=n.cssProps[h]||(n.cssProps[h]=Fb(i,h)),g=n.cssHooks[b]||n.cssHooks[h],void 0===c?g&&"get"in g&&void 0!==(e=g.get(a,!1,d))?e:i[b]:(f=typeof c,"string"===f&&(e=Bb.exec(c))&&(c=(e[1]+1)*e[2]+parseFloat(n.css(a,b)),f="number"),null!=c&&c===c&&("number"!==f||n.cssNumber[h]||(c+="px"),k.clearCloneStyle||""!==c||0!==b.indexOf("background")||(i[b]="inherit"),g&&"set"in g&&void 0===(c=g.set(a,c,d))||(i[b]=c)),void 0)}},css:function(a,b,c,d){var e,f,g,h=n.camelCase(b);return b=n.cssProps[h]||(n.cssProps[h]=Fb(a.style,h)),g=n.cssHooks[b]||n.cssHooks[h],g&&"get"in g&&(e=g.get(a,!0,c)),void 0===e&&(e=xb(a,b,d)),"normal"===e&&b in Db&&(e=Db[b]),""===c||c?(f=parseFloat(e),c===!0||n.isNumeric(f)?f||0:e):e}}),n.each(["height","width"],function(a,b){n.cssHooks[b]={get:function(a,c,d){return c?zb.test(n.css(a,"display"))&&0===a.offsetWidth?n.swap(a,Cb,function(){return Ib(a,b,d)}):Ib(a,b,d):void 0},set:function(a,c,d){var e=d&&wb(a);return Gb(a,c,d?Hb(a,b,d,"border-box"===n.css(a,"boxSizing",!1,e),e):0)}}}),n.cssHooks.marginRight=yb(k.reliableMarginRight,function(a,b){return b?n.swap(a,{display:"inline-block"},xb,[a,"marginRight"]):void 0}),n.each({margin:"",padding:"",border:"Width"},function(a,b){n.cssHooks[a+b]={expand:function(c){for(var d=0,e={},f="string"==typeof c?c.split(" "):[c];4>d;d++)e[a+R[d]+b]=f[d]||f[d-2]||f[0];return e}},ub.test(a)||(n.cssHooks[a+b].set=Gb)}),n.fn.extend({css:function(a,b){return J(this,function(a,b,c){var d,e,f={},g=0;if(n.isArray(b)){for(d=wb(a),e=b.length;e>g;g++)f[b[g]]=n.css(a,b[g],!1,d);return f}return void 0!==c?n.style(a,b,c):n.css(a,b)},a,b,arguments.length>1)},show:function(){return Jb(this,!0)},hide:function(){return Jb(this)},toggle:function(a){return"boolean"==typeof a?a?this.show():this.hide():this.each(function(){S(this)?n(this).show():n(this).hide()})}});function Kb(a,b,c,d,e){return new Kb.prototype.init(a,b,c,d,e)}n.Tween=Kb,Kb.prototype={constructor:Kb,init:function(a,b,c,d,e,f){this.elem=a,this.prop=c,this.easing=e||"swing",this.options=b,this.start=this.now=this.cur(),this.end=d,this.unit=f||(n.cssNumber[c]?"":"px")},cur:function(){var a=Kb.propHooks[this.prop];return a&&a.get?a.get(this):Kb.propHooks._default.get(this)},run:function(a){var b,c=Kb.propHooks[this.prop];return this.pos=b=this.options.duration?n.easing[this.easing](a,this.options.duration*a,0,1,this.options.duration):a,this.now=(this.end-this.start)*b+this.start,this.options.step&&this.options.step.call(this.elem,this.now,this),c&&c.set?c.set(this):Kb.propHooks._default.set(this),this}},Kb.prototype.init.prototype=Kb.prototype,Kb.propHooks={_default:{get:function(a){var b;return null==a.elem[a.prop]||a.elem.style&&null!=a.elem.style[a.prop]?(b=n.css(a.elem,a.prop,""),b&&"auto"!==b?b:0):a.elem[a.prop]},set:function(a){n.fx.step[a.prop]?n.fx.step[a.prop](a):a.elem.style&&(null!=a.elem.style[n.cssProps[a.prop]]||n.cssHooks[a.prop])?n.style(a.elem,a.prop,a.now+a.unit):a.elem[a.prop]=a.now}}},Kb.propHooks.scrollTop=Kb.propHooks.scrollLeft={set:function(a){a.elem.nodeType&&a.elem.parentNode&&(a.elem[a.prop]=a.now)}},n.easing={linear:function(a){return a},swing:function(a){return.5-Math.cos(a*Math.PI)/2}},n.fx=Kb.prototype.init,n.fx.step={};var Lb,Mb,Nb=/^(?:toggle|show|hide)$/,Ob=new RegExp("^(?:([+-])=|)("+Q+")([a-z%]*)$","i"),Pb=/queueHooks$/,Qb=[Vb],Rb={"*":[function(a,b){var c=this.createTween(a,b),d=c.cur(),e=Ob.exec(b),f=e&&e[3]||(n.cssNumber[a]?"":"px"),g=(n.cssNumber[a]||"px"!==f&&+d)&&Ob.exec(n.css(c.elem,a)),h=1,i=20;if(g&&g[3]!==f){f=f||g[3],e=e||[],g=+d||1;do h=h||".5",g/=h,n.style(c.elem,a,g+f);while(h!==(h=c.cur()/d)&&1!==h&&--i)}return e&&(g=c.start=+g||+d||0,c.unit=f,c.end=e[1]?g+(e[1]+1)*e[2]:+e[2]),c}]};function Sb(){return setTimeout(function(){Lb=void 0}),Lb=n.now()}function Tb(a,b){var c,d=0,e={height:a};for(b=b?1:0;4>d;d+=2-b)c=R[d],e["margin"+c]=e["padding"+c]=a;return b&&(e.opacity=e.width=a),e}function Ub(a,b,c){for(var d,e=(Rb[b]||[]).concat(Rb["*"]),f=0,g=e.length;g>f;f++)if(d=e[f].call(c,b,a))return d}function Vb(a,b,c){var d,e,f,g,h,i,j,k,l=this,m={},o=a.style,p=a.nodeType&&S(a),q=L.get(a,"fxshow");c.queue||(h=n._queueHooks(a,"fx"),null==h.unqueued&&(h.unqueued=0,i=h.empty.fire,h.empty.fire=function(){h.unqueued||i()}),h.unqueued++,l.always(function(){l.always(function(){h.unqueued--,n.queue(a,"fx").length||h.empty.fire()})})),1===a.nodeType&&("height"in b||"width"in b)&&(c.overflow=[o.overflow,o.overflowX,o.overflowY],j=n.css(a,"display"),k="none"===j?L.get(a,"olddisplay")||tb(a.nodeName):j,"inline"===k&&"none"===n.css(a,"float")&&(o.display="inline-block")),c.overflow&&(o.overflow="hidden",l.always(function(){o.overflow=c.overflow[0],o.overflowX=c.overflow[1],o.overflowY=c.overflow[2]}));for(d in b)if(e=b[d],Nb.exec(e)){if(delete b[d],f=f||"toggle"===e,e===(p?"hide":"show")){if("show"!==e||!q||void 0===q[d])continue;p=!0}m[d]=q&&q[d]||n.style(a,d)}else j=void 0;if(n.isEmptyObject(m))"inline"===("none"===j?tb(a.nodeName):j)&&(o.display=j);else{q?"hidden"in q&&(p=q.hidden):q=L.access(a,"fxshow",{}),f&&(q.hidden=!p),p?n(a).show():l.done(function(){n(a).hide()}),l.done(function(){var b;L.remove(a,"fxshow");for(b in m)n.style(a,b,m[b])});for(d in m)g=Ub(p?q[d]:0,d,l),d in q||(q[d]=g.start,p&&(g.end=g.start,g.start="width"===d||"height"===d?1:0))}}function Wb(a,b){var c,d,e,f,g;for(c in a)if(d=n.camelCase(c),e=b[d],f=a[c],n.isArray(f)&&(e=f[1],f=a[c]=f[0]),c!==d&&(a[d]=f,delete a[c]),g=n.cssHooks[d],g&&"expand"in g){f=g.expand(f),delete a[d];for(c in f)c in a||(a[c]=f[c],b[c]=e)}else b[d]=e}function Xb(a,b,c){var d,e,f=0,g=Qb.length,h=n.Deferred().always(function(){delete i.elem}),i=function(){if(e)return!1;for(var b=Lb||Sb(),c=Math.max(0,j.startTime+j.duration-b),d=c/j.duration||0,f=1-d,g=0,i=j.tweens.length;i>g;g++)j.tweens[g].run(f);return h.notifyWith(a,[j,f,c]),1>f&&i?c:(h.resolveWith(a,[j]),!1)},j=h.promise({elem:a,props:n.extend({},b),opts:n.extend(!0,{specialEasing:{}},c),originalProperties:b,originalOptions:c,startTime:Lb||Sb(),duration:c.duration,tweens:[],createTween:function(b,c){var d=n.Tween(a,j.opts,b,c,j.opts.specialEasing[b]||j.opts.easing);return j.tweens.push(d),d},stop:function(b){var c=0,d=b?j.tweens.length:0;if(e)return this;for(e=!0;d>c;c++)j.tweens[c].run(1);return b?h.resolveWith(a,[j,b]):h.rejectWith(a,[j,b]),this}}),k=j.props;for(Wb(k,j.opts.specialEasing);g>f;f++)if(d=Qb[f].call(j,a,k,j.opts))return d;return n.map(k,Ub,j),n.isFunction(j.opts.start)&&j.opts.start.call(a,j),n.fx.timer(n.extend(i,{elem:a,anim:j,queue:j.opts.queue})),j.progress(j.opts.progress).done(j.opts.done,j.opts.complete).fail(j.opts.fail).always(j.opts.always)}n.Animation=n.extend(Xb,{tweener:function(a,b){n.isFunction(a)?(b=a,a=["*"]):a=a.split(" ");for(var c,d=0,e=a.length;e>d;d++)c=a[d],Rb[c]=Rb[c]||[],Rb[c].unshift(b)},prefilter:function(a,b){b?Qb.unshift(a):Qb.push(a)}}),n.speed=function(a,b,c){var d=a&&"object"==typeof a?n.extend({},a):{complete:c||!c&&b||n.isFunction(a)&&a,duration:a,easing:c&&b||b&&!n.isFunction(b)&&b};return d.duration=n.fx.off?0:"number"==typeof d.duration?d.duration:d.duration in n.fx.speeds?n.fx.speeds[d.duration]:n.fx.speeds._default,(null==d.queue||d.queue===!0)&&(d.queue="fx"),d.old=d.complete,d.complete=function(){n.isFunction(d.old)&&d.old.call(this),d.queue&&n.dequeue(this,d.queue)},d},n.fn.extend({fadeTo:function(a,b,c,d){return this.filter(S).css("opacity",0).show().end().animate({opacity:b},a,c,d)},animate:function(a,b,c,d){var e=n.isEmptyObject(a),f=n.speed(b,c,d),g=function(){var b=Xb(this,n.extend({},a),f);(e||L.get(this,"finish"))&&b.stop(!0)};return g.finish=g,e||f.queue===!1?this.each(g):this.queue(f.queue,g)},stop:function(a,b,c){var d=function(a){var b=a.stop;delete a.stop,b(c)};return"string"!=typeof a&&(c=b,b=a,a=void 0),b&&a!==!1&&this.queue(a||"fx",[]),this.each(function(){var b=!0,e=null!=a&&a+"queueHooks",f=n.timers,g=L.get(this);if(e)g[e]&&g[e].stop&&d(g[e]);else for(e in g)g[e]&&g[e].stop&&Pb.test(e)&&d(g[e]);for(e=f.length;e--;)f[e].elem!==this||null!=a&&f[e].queue!==a||(f[e].anim.stop(c),b=!1,f.splice(e,1));(b||!c)&&n.dequeue(this,a)})},finish:function(a){return a!==!1&&(a=a||"fx"),this.each(function(){var b,c=L.get(this),d=c[a+"queue"],e=c[a+"queueHooks"],f=n.timers,g=d?d.length:0;for(c.finish=!0,n.queue(this,a,[]),e&&e.stop&&e.stop.call(this,!0),b=f.length;b--;)f[b].elem===this&&f[b].queue===a&&(f[b].anim.stop(!0),f.splice(b,1));for(b=0;g>b;b++)d[b]&&d[b].finish&&d[b].finish.call(this);delete c.finish})}}),n.each(["toggle","show","hide"],function(a,b){var c=n.fn[b];n.fn[b]=function(a,d,e){return null==a||"boolean"==typeof a?c.apply(this,arguments):this.animate(Tb(b,!0),a,d,e)}}),n.each({slideDown:Tb("show"),slideUp:Tb("hide"),slideToggle:Tb("toggle"),fadeIn:{opacity:"show"},fadeOut:{opacity:"hide"},fadeToggle:{opacity:"toggle"}},function(a,b){n.fn[a]=function(a,c,d){return this.animate(b,a,c,d)}}),n.timers=[],n.fx.tick=function(){var a,b=0,c=n.timers;for(Lb=n.now();b<c.length;b++)a=c[b],a()||c[b]!==a||c.splice(b--,1);c.length||n.fx.stop(),Lb=void 0},n.fx.timer=function(a){n.timers.push(a),a()?n.fx.start():n.timers.pop()},n.fx.interval=13,n.fx.start=function(){Mb||(Mb=setInterval(n.fx.tick,n.fx.interval))},n.fx.stop=function(){clearInterval(Mb),Mb=null},n.fx.speeds={slow:600,fast:200,_default:400},n.fn.delay=function(a,b){return a=n.fx?n.fx.speeds[a]||a:a,b=b||"fx",this.queue(b,function(b,c){var d=setTimeout(b,a);c.stop=function(){clearTimeout(d)}})},function(){var a=l.createElement("input"),b=l.createElement("select"),c=b.appendChild(l.createElement("option"));a.type="checkbox",k.checkOn=""!==a.value,k.optSelected=c.selected,b.disabled=!0,k.optDisabled=!c.disabled,a=l.createElement("input"),a.value="t",a.type="radio",k.radioValue="t"===a.value}();var Yb,Zb,$b=n.expr.attrHandle;n.fn.extend({attr:function(a,b){return J(this,n.attr,a,b,arguments.length>1)},removeAttr:function(a){return this.each(function(){n.removeAttr(this,a)})}}),n.extend({attr:function(a,b,c){var d,e,f=a.nodeType;if(a&&3!==f&&8!==f&&2!==f)return typeof a.getAttribute===U?n.prop(a,b,c):(1===f&&n.isXMLDoc(a)||(b=b.toLowerCase(),d=n.attrHooks[b]||(n.expr.match.bool.test(b)?Zb:Yb)),void 0===c?d&&"get"in d&&null!==(e=d.get(a,b))?e:(e=n.find.attr(a,b),null==e?void 0:e):null!==c?d&&"set"in d&&void 0!==(e=d.set(a,c,b))?e:(a.setAttribute(b,c+""),c):void n.removeAttr(a,b))
},removeAttr:function(a,b){var c,d,e=0,f=b&&b.match(E);if(f&&1===a.nodeType)while(c=f[e++])d=n.propFix[c]||c,n.expr.match.bool.test(c)&&(a[d]=!1),a.removeAttribute(c)},attrHooks:{type:{set:function(a,b){if(!k.radioValue&&"radio"===b&&n.nodeName(a,"input")){var c=a.value;return a.setAttribute("type",b),c&&(a.value=c),b}}}}}),Zb={set:function(a,b,c){return b===!1?n.removeAttr(a,c):a.setAttribute(c,c),c}},n.each(n.expr.match.bool.source.match(/\w+/g),function(a,b){var c=$b[b]||n.find.attr;$b[b]=function(a,b,d){var e,f;return d||(f=$b[b],$b[b]=e,e=null!=c(a,b,d)?b.toLowerCase():null,$b[b]=f),e}});var _b=/^(?:input|select|textarea|button)$/i;n.fn.extend({prop:function(a,b){return J(this,n.prop,a,b,arguments.length>1)},removeProp:function(a){return this.each(function(){delete this[n.propFix[a]||a]})}}),n.extend({propFix:{"for":"htmlFor","class":"className"},prop:function(a,b,c){var d,e,f,g=a.nodeType;if(a&&3!==g&&8!==g&&2!==g)return f=1!==g||!n.isXMLDoc(a),f&&(b=n.propFix[b]||b,e=n.propHooks[b]),void 0!==c?e&&"set"in e&&void 0!==(d=e.set(a,c,b))?d:a[b]=c:e&&"get"in e&&null!==(d=e.get(a,b))?d:a[b]},propHooks:{tabIndex:{get:function(a){return a.hasAttribute("tabindex")||_b.test(a.nodeName)||a.href?a.tabIndex:-1}}}}),k.optSelected||(n.propHooks.selected={get:function(a){var b=a.parentNode;return b&&b.parentNode&&b.parentNode.selectedIndex,null}}),n.each(["tabIndex","readOnly","maxLength","cellSpacing","cellPadding","rowSpan","colSpan","useMap","frameBorder","contentEditable"],function(){n.propFix[this.toLowerCase()]=this});var ac=/[\t\r\n\f]/g;n.fn.extend({addClass:function(a){var b,c,d,e,f,g,h="string"==typeof a&&a,i=0,j=this.length;if(n.isFunction(a))return this.each(function(b){n(this).addClass(a.call(this,b,this.className))});if(h)for(b=(a||"").match(E)||[];j>i;i++)if(c=this[i],d=1===c.nodeType&&(c.className?(" "+c.className+" ").replace(ac," "):" ")){f=0;while(e=b[f++])d.indexOf(" "+e+" ")<0&&(d+=e+" ");g=n.trim(d),c.className!==g&&(c.className=g)}return this},removeClass:function(a){var b,c,d,e,f,g,h=0===arguments.length||"string"==typeof a&&a,i=0,j=this.length;if(n.isFunction(a))return this.each(function(b){n(this).removeClass(a.call(this,b,this.className))});if(h)for(b=(a||"").match(E)||[];j>i;i++)if(c=this[i],d=1===c.nodeType&&(c.className?(" "+c.className+" ").replace(ac," "):"")){f=0;while(e=b[f++])while(d.indexOf(" "+e+" ")>=0)d=d.replace(" "+e+" "," ");g=a?n.trim(d):"",c.className!==g&&(c.className=g)}return this},toggleClass:function(a,b){var c=typeof a;return"boolean"==typeof b&&"string"===c?b?this.addClass(a):this.removeClass(a):this.each(n.isFunction(a)?function(c){n(this).toggleClass(a.call(this,c,this.className,b),b)}:function(){if("string"===c){var b,d=0,e=n(this),f=a.match(E)||[];while(b=f[d++])e.hasClass(b)?e.removeClass(b):e.addClass(b)}else(c===U||"boolean"===c)&&(this.className&&L.set(this,"__className__",this.className),this.className=this.className||a===!1?"":L.get(this,"__className__")||"")})},hasClass:function(a){for(var b=" "+a+" ",c=0,d=this.length;d>c;c++)if(1===this[c].nodeType&&(" "+this[c].className+" ").replace(ac," ").indexOf(b)>=0)return!0;return!1}});var bc=/\r/g;n.fn.extend({val:function(a){var b,c,d,e=this[0];{if(arguments.length)return d=n.isFunction(a),this.each(function(c){var e;1===this.nodeType&&(e=d?a.call(this,c,n(this).val()):a,null==e?e="":"number"==typeof e?e+="":n.isArray(e)&&(e=n.map(e,function(a){return null==a?"":a+""})),b=n.valHooks[this.type]||n.valHooks[this.nodeName.toLowerCase()],b&&"set"in b&&void 0!==b.set(this,e,"value")||(this.value=e))});if(e)return b=n.valHooks[e.type]||n.valHooks[e.nodeName.toLowerCase()],b&&"get"in b&&void 0!==(c=b.get(e,"value"))?c:(c=e.value,"string"==typeof c?c.replace(bc,""):null==c?"":c)}}}),n.extend({valHooks:{option:{get:function(a){var b=n.find.attr(a,"value");return null!=b?b:n.trim(n.text(a))}},select:{get:function(a){for(var b,c,d=a.options,e=a.selectedIndex,f="select-one"===a.type||0>e,g=f?null:[],h=f?e+1:d.length,i=0>e?h:f?e:0;h>i;i++)if(c=d[i],!(!c.selected&&i!==e||(k.optDisabled?c.disabled:null!==c.getAttribute("disabled"))||c.parentNode.disabled&&n.nodeName(c.parentNode,"optgroup"))){if(b=n(c).val(),f)return b;g.push(b)}return g},set:function(a,b){var c,d,e=a.options,f=n.makeArray(b),g=e.length;while(g--)d=e[g],(d.selected=n.inArray(d.value,f)>=0)&&(c=!0);return c||(a.selectedIndex=-1),f}}}}),n.each(["radio","checkbox"],function(){n.valHooks[this]={set:function(a,b){return n.isArray(b)?a.checked=n.inArray(n(a).val(),b)>=0:void 0}},k.checkOn||(n.valHooks[this].get=function(a){return null===a.getAttribute("value")?"on":a.value})}),n.each("blur focus focusin focusout load resize scroll unload click dblclick mousedown mouseup mousemove mouseover mouseout mouseenter mouseleave change select submit keydown keypress keyup error contextmenu".split(" "),function(a,b){n.fn[b]=function(a,c){return arguments.length>0?this.on(b,null,a,c):this.trigger(b)}}),n.fn.extend({hover:function(a,b){return this.mouseenter(a).mouseleave(b||a)},bind:function(a,b,c){return this.on(a,null,b,c)},unbind:function(a,b){return this.off(a,null,b)},delegate:function(a,b,c,d){return this.on(b,a,c,d)},undelegate:function(a,b,c){return 1===arguments.length?this.off(a,"**"):this.off(b,a||"**",c)}});var cc=n.now(),dc=/\?/;n.parseJSON=function(a){return JSON.parse(a+"")},n.parseXML=function(a){var b,c;if(!a||"string"!=typeof a)return null;try{c=new DOMParser,b=c.parseFromString(a,"text/xml")}catch(d){b=void 0}return(!b||b.getElementsByTagName("parsererror").length)&&n.error("Invalid XML: "+a),b};var ec,fc,gc=/#.*$/,hc=/([?&])_=[^&]*/,ic=/^(.*?):[ \t]*([^\r\n]*)$/gm,jc=/^(?:about|app|app-storage|.+-extension|file|res|widget):$/,kc=/^(?:GET|HEAD)$/,lc=/^\/\//,mc=/^([\w.+-]+:)(?:\/\/(?:[^\/?#]*@|)([^\/?#:]*)(?::(\d+)|)|)/,nc={},oc={},pc="*/".concat("*");try{fc=location.href}catch(qc){fc=l.createElement("a"),fc.href="",fc=fc.href}ec=mc.exec(fc.toLowerCase())||[];function rc(a){return function(b,c){"string"!=typeof b&&(c=b,b="*");var d,e=0,f=b.toLowerCase().match(E)||[];if(n.isFunction(c))while(d=f[e++])"+"===d[0]?(d=d.slice(1)||"*",(a[d]=a[d]||[]).unshift(c)):(a[d]=a[d]||[]).push(c)}}function sc(a,b,c,d){var e={},f=a===oc;function g(h){var i;return e[h]=!0,n.each(a[h]||[],function(a,h){var j=h(b,c,d);return"string"!=typeof j||f||e[j]?f?!(i=j):void 0:(b.dataTypes.unshift(j),g(j),!1)}),i}return g(b.dataTypes[0])||!e["*"]&&g("*")}function tc(a,b){var c,d,e=n.ajaxSettings.flatOptions||{};for(c in b)void 0!==b[c]&&((e[c]?a:d||(d={}))[c]=b[c]);return d&&n.extend(!0,a,d),a}function uc(a,b,c){var d,e,f,g,h=a.contents,i=a.dataTypes;while("*"===i[0])i.shift(),void 0===d&&(d=a.mimeType||b.getResponseHeader("Content-Type"));if(d)for(e in h)if(h[e]&&h[e].test(d)){i.unshift(e);break}if(i[0]in c)f=i[0];else{for(e in c){if(!i[0]||a.converters[e+" "+i[0]]){f=e;break}g||(g=e)}f=f||g}return f?(f!==i[0]&&i.unshift(f),c[f]):void 0}function vc(a,b,c,d){var e,f,g,h,i,j={},k=a.dataTypes.slice();if(k[1])for(g in a.converters)j[g.toLowerCase()]=a.converters[g];f=k.shift();while(f)if(a.responseFields[f]&&(c[a.responseFields[f]]=b),!i&&d&&a.dataFilter&&(b=a.dataFilter(b,a.dataType)),i=f,f=k.shift())if("*"===f)f=i;else if("*"!==i&&i!==f){if(g=j[i+" "+f]||j["* "+f],!g)for(e in j)if(h=e.split(" "),h[1]===f&&(g=j[i+" "+h[0]]||j["* "+h[0]])){g===!0?g=j[e]:j[e]!==!0&&(f=h[0],k.unshift(h[1]));break}if(g!==!0)if(g&&a["throws"])b=g(b);else try{b=g(b)}catch(l){return{state:"parsererror",error:g?l:"No conversion from "+i+" to "+f}}}return{state:"success",data:b}}n.extend({active:0,lastModified:{},etag:{},ajaxSettings:{url:fc,type:"GET",isLocal:jc.test(ec[1]),global:!0,processData:!0,async:!0,contentType:"application/x-www-form-urlencoded; charset=UTF-8",accepts:{"*":pc,text:"text/plain",html:"text/html",xml:"application/xml, text/xml",json:"application/json, text/javascript"},contents:{xml:/xml/,html:/html/,json:/json/},responseFields:{xml:"responseXML",text:"responseText",json:"responseJSON"},converters:{"* text":String,"text html":!0,"text json":n.parseJSON,"text xml":n.parseXML},flatOptions:{url:!0,context:!0}},ajaxSetup:function(a,b){return b?tc(tc(a,n.ajaxSettings),b):tc(n.ajaxSettings,a)},ajaxPrefilter:rc(nc),ajaxTransport:rc(oc),ajax:function(a,b){"object"==typeof a&&(b=a,a=void 0),b=b||{};var c,d,e,f,g,h,i,j,k=n.ajaxSetup({},b),l=k.context||k,m=k.context&&(l.nodeType||l.jquery)?n(l):n.event,o=n.Deferred(),p=n.Callbacks("once memory"),q=k.statusCode||{},r={},s={},t=0,u="canceled",v={readyState:0,getResponseHeader:function(a){var b;if(2===t){if(!f){f={};while(b=ic.exec(e))f[b[1].toLowerCase()]=b[2]}b=f[a.toLowerCase()]}return null==b?null:b},getAllResponseHeaders:function(){return 2===t?e:null},setRequestHeader:function(a,b){var c=a.toLowerCase();return t||(a=s[c]=s[c]||a,r[a]=b),this},overrideMimeType:function(a){return t||(k.mimeType=a),this},statusCode:function(a){var b;if(a)if(2>t)for(b in a)q[b]=[q[b],a[b]];else v.always(a[v.status]);return this},abort:function(a){var b=a||u;return c&&c.abort(b),x(0,b),this}};if(o.promise(v).complete=p.add,v.success=v.done,v.error=v.fail,k.url=((a||k.url||fc)+"").replace(gc,"").replace(lc,ec[1]+"//"),k.type=b.method||b.type||k.method||k.type,k.dataTypes=n.trim(k.dataType||"*").toLowerCase().match(E)||[""],null==k.crossDomain&&(h=mc.exec(k.url.toLowerCase()),k.crossDomain=!(!h||h[1]===ec[1]&&h[2]===ec[2]&&(h[3]||("http:"===h[1]?"80":"443"))===(ec[3]||("http:"===ec[1]?"80":"443")))),k.data&&k.processData&&"string"!=typeof k.data&&(k.data=n.param(k.data,k.traditional)),sc(nc,k,b,v),2===t)return v;i=k.global,i&&0===n.active++&&n.event.trigger("ajaxStart"),k.type=k.type.toUpperCase(),k.hasContent=!kc.test(k.type),d=k.url,k.hasContent||(k.data&&(d=k.url+=(dc.test(d)?"&":"?")+k.data,delete k.data),k.cache===!1&&(k.url=hc.test(d)?d.replace(hc,"$1_="+cc++):d+(dc.test(d)?"&":"?")+"_="+cc++)),k.ifModified&&(n.lastModified[d]&&v.setRequestHeader("If-Modified-Since",n.lastModified[d]),n.etag[d]&&v.setRequestHeader("If-None-Match",n.etag[d])),(k.data&&k.hasContent&&k.contentType!==!1||b.contentType)&&v.setRequestHeader("Content-Type",k.contentType),v.setRequestHeader("Accept",k.dataTypes[0]&&k.accepts[k.dataTypes[0]]?k.accepts[k.dataTypes[0]]+("*"!==k.dataTypes[0]?", "+pc+"; q=0.01":""):k.accepts["*"]);for(j in k.headers)v.setRequestHeader(j,k.headers[j]);if(k.beforeSend&&(k.beforeSend.call(l,v,k)===!1||2===t))return v.abort();u="abort";for(j in{success:1,error:1,complete:1})v[j](k[j]);if(c=sc(oc,k,b,v)){v.readyState=1,i&&m.trigger("ajaxSend",[v,k]),k.async&&k.timeout>0&&(g=setTimeout(function(){v.abort("timeout")},k.timeout));try{t=1,c.send(r,x)}catch(w){if(!(2>t))throw w;x(-1,w)}}else x(-1,"No Transport");function x(a,b,f,h){var j,r,s,u,w,x=b;2!==t&&(t=2,g&&clearTimeout(g),c=void 0,e=h||"",v.readyState=a>0?4:0,j=a>=200&&300>a||304===a,f&&(u=uc(k,v,f)),u=vc(k,u,v,j),j?(k.ifModified&&(w=v.getResponseHeader("Last-Modified"),w&&(n.lastModified[d]=w),w=v.getResponseHeader("etag"),w&&(n.etag[d]=w)),204===a||"HEAD"===k.type?x="nocontent":304===a?x="notmodified":(x=u.state,r=u.data,s=u.error,j=!s)):(s=x,(a||!x)&&(x="error",0>a&&(a=0))),v.status=a,v.statusText=(b||x)+"",j?o.resolveWith(l,[r,x,v]):o.rejectWith(l,[v,x,s]),v.statusCode(q),q=void 0,i&&m.trigger(j?"ajaxSuccess":"ajaxError",[v,k,j?r:s]),p.fireWith(l,[v,x]),i&&(m.trigger("ajaxComplete",[v,k]),--n.active||n.event.trigger("ajaxStop")))}return v},getJSON:function(a,b,c){return n.get(a,b,c,"json")},getScript:function(a,b){return n.get(a,void 0,b,"script")}}),n.each(["get","post"],function(a,b){n[b]=function(a,c,d,e){return n.isFunction(c)&&(e=e||d,d=c,c=void 0),n.ajax({url:a,type:b,dataType:e,data:c,success:d})}}),n.each(["ajaxStart","ajaxStop","ajaxComplete","ajaxError","ajaxSuccess","ajaxSend"],function(a,b){n.fn[b]=function(a){return this.on(b,a)}}),n._evalUrl=function(a){return n.ajax({url:a,type:"GET",dataType:"script",async:!1,global:!1,"throws":!0})},n.fn.extend({wrapAll:function(a){var b;return n.isFunction(a)?this.each(function(b){n(this).wrapAll(a.call(this,b))}):(this[0]&&(b=n(a,this[0].ownerDocument).eq(0).clone(!0),this[0].parentNode&&b.insertBefore(this[0]),b.map(function(){var a=this;while(a.firstElementChild)a=a.firstElementChild;return a}).append(this)),this)},wrapInner:function(a){return this.each(n.isFunction(a)?function(b){n(this).wrapInner(a.call(this,b))}:function(){var b=n(this),c=b.contents();c.length?c.wrapAll(a):b.append(a)})},wrap:function(a){var b=n.isFunction(a);return this.each(function(c){n(this).wrapAll(b?a.call(this,c):a)})},unwrap:function(){return this.parent().each(function(){n.nodeName(this,"body")||n(this).replaceWith(this.childNodes)}).end()}}),n.expr.filters.hidden=function(a){return a.offsetWidth<=0&&a.offsetHeight<=0},n.expr.filters.visible=function(a){return!n.expr.filters.hidden(a)};var wc=/%20/g,xc=/\[\]$/,yc=/\r?\n/g,zc=/^(?:submit|button|image|reset|file)$/i,Ac=/^(?:input|select|textarea|keygen)/i;function Bc(a,b,c,d){var e;if(n.isArray(b))n.each(b,function(b,e){c||xc.test(a)?d(a,e):Bc(a+"["+("object"==typeof e?b:"")+"]",e,c,d)});else if(c||"object"!==n.type(b))d(a,b);else for(e in b)Bc(a+"["+e+"]",b[e],c,d)}n.param=function(a,b){var c,d=[],e=function(a,b){b=n.isFunction(b)?b():null==b?"":b,d[d.length]=encodeURIComponent(a)+"="+encodeURIComponent(b)};if(void 0===b&&(b=n.ajaxSettings&&n.ajaxSettings.traditional),n.isArray(a)||a.jquery&&!n.isPlainObject(a))n.each(a,function(){e(this.name,this.value)});else for(c in a)Bc(c,a[c],b,e);return d.join("&").replace(wc,"+")},n.fn.extend({serialize:function(){return n.param(this.serializeArray())},serializeArray:function(){return this.map(function(){var a=n.prop(this,"elements");return a?n.makeArray(a):this}).filter(function(){var a=this.type;return this.name&&!n(this).is(":disabled")&&Ac.test(this.nodeName)&&!zc.test(a)&&(this.checked||!T.test(a))}).map(function(a,b){var c=n(this).val();return null==c?null:n.isArray(c)?n.map(c,function(a){return{name:b.name,value:a.replace(yc,"\r\n")}}):{name:b.name,value:c.replace(yc,"\r\n")}}).get()}}),n.ajaxSettings.xhr=function(){try{return new XMLHttpRequest}catch(a){}};var Cc=0,Dc={},Ec={0:200,1223:204},Fc=n.ajaxSettings.xhr();a.ActiveXObject&&n(a).on("unload",function(){for(var a in Dc)Dc[a]()}),k.cors=!!Fc&&"withCredentials"in Fc,k.ajax=Fc=!!Fc,n.ajaxTransport(function(a){var b;return k.cors||Fc&&!a.crossDomain?{send:function(c,d){var e,f=a.xhr(),g=++Cc;if(f.open(a.type,a.url,a.async,a.username,a.password),a.xhrFields)for(e in a.xhrFields)f[e]=a.xhrFields[e];a.mimeType&&f.overrideMimeType&&f.overrideMimeType(a.mimeType),a.crossDomain||c["X-Requested-With"]||(c["X-Requested-With"]="XMLHttpRequest");for(e in c)f.setRequestHeader(e,c[e]);b=function(a){return function(){b&&(delete Dc[g],b=f.onload=f.onerror=null,"abort"===a?f.abort():"error"===a?d(f.status,f.statusText):d(Ec[f.status]||f.status,f.statusText,"string"==typeof f.responseText?{text:f.responseText}:void 0,f.getAllResponseHeaders()))}},f.onload=b(),f.onerror=b("error"),b=Dc[g]=b("abort");try{f.send(a.hasContent&&a.data||null)}catch(h){if(b)throw h}},abort:function(){b&&b()}}:void 0}),n.ajaxSetup({accepts:{script:"text/javascript, application/javascript, application/ecmascript, application/x-ecmascript"},contents:{script:/(?:java|ecma)script/},converters:{"text script":function(a){return n.globalEval(a),a}}}),n.ajaxPrefilter("script",function(a){void 0===a.cache&&(a.cache=!1),a.crossDomain&&(a.type="GET")}),n.ajaxTransport("script",function(a){if(a.crossDomain){var b,c;return{send:function(d,e){b=n("<script>").prop({async:!0,charset:a.scriptCharset,src:a.url}).on("load error",c=function(a){b.remove(),c=null,a&&e("error"===a.type?404:200,a.type)}),l.head.appendChild(b[0])},abort:function(){c&&c()}}}});var Gc=[],Hc=/(=)\?(?=&|$)|\?\?/;n.ajaxSetup({jsonp:"callback",jsonpCallback:function(){var a=Gc.pop()||n.expando+"_"+cc++;return this[a]=!0,a}}),n.ajaxPrefilter("json jsonp",function(b,c,d){var e,f,g,h=b.jsonp!==!1&&(Hc.test(b.url)?"url":"string"==typeof b.data&&!(b.contentType||"").indexOf("application/x-www-form-urlencoded")&&Hc.test(b.data)&&"data");return h||"jsonp"===b.dataTypes[0]?(e=b.jsonpCallback=n.isFunction(b.jsonpCallback)?b.jsonpCallback():b.jsonpCallback,h?b[h]=b[h].replace(Hc,"$1"+e):b.jsonp!==!1&&(b.url+=(dc.test(b.url)?"&":"?")+b.jsonp+"="+e),b.converters["script json"]=function(){return g||n.error(e+" was not called"),g[0]},b.dataTypes[0]="json",f=a[e],a[e]=function(){g=arguments},d.always(function(){a[e]=f,b[e]&&(b.jsonpCallback=c.jsonpCallback,Gc.push(e)),g&&n.isFunction(f)&&f(g[0]),g=f=void 0}),"script"):void 0}),n.parseHTML=function(a,b,c){if(!a||"string"!=typeof a)return null;"boolean"==typeof b&&(c=b,b=!1),b=b||l;var d=v.exec(a),e=!c&&[];return d?[b.createElement(d[1])]:(d=n.buildFragment([a],b,e),e&&e.length&&n(e).remove(),n.merge([],d.childNodes))};var Ic=n.fn.load;n.fn.load=function(a,b,c){if("string"!=typeof a&&Ic)return Ic.apply(this,arguments);var d,e,f,g=this,h=a.indexOf(" ");return h>=0&&(d=n.trim(a.slice(h)),a=a.slice(0,h)),n.isFunction(b)?(c=b,b=void 0):b&&"object"==typeof b&&(e="POST"),g.length>0&&n.ajax({url:a,type:e,dataType:"html",data:b}).done(function(a){f=arguments,g.html(d?n("<div>").append(n.parseHTML(a)).find(d):a)}).complete(c&&function(a,b){g.each(c,f||[a.responseText,b,a])}),this},n.expr.filters.animated=function(a){return n.grep(n.timers,function(b){return a===b.elem}).length};var Jc=a.document.documentElement;function Kc(a){return n.isWindow(a)?a:9===a.nodeType&&a.defaultView}n.offset={setOffset:function(a,b,c){var d,e,f,g,h,i,j,k=n.css(a,"position"),l=n(a),m={};"static"===k&&(a.style.position="relative"),h=l.offset(),f=n.css(a,"top"),i=n.css(a,"left"),j=("absolute"===k||"fixed"===k)&&(f+i).indexOf("auto")>-1,j?(d=l.position(),g=d.top,e=d.left):(g=parseFloat(f)||0,e=parseFloat(i)||0),n.isFunction(b)&&(b=b.call(a,c,h)),null!=b.top&&(m.top=b.top-h.top+g),null!=b.left&&(m.left=b.left-h.left+e),"using"in b?b.using.call(a,m):l.css(m)}},n.fn.extend({offset:function(a){if(arguments.length)return void 0===a?this:this.each(function(b){n.offset.setOffset(this,a,b)});var b,c,d=this[0],e={top:0,left:0},f=d&&d.ownerDocument;if(f)return b=f.documentElement,n.contains(b,d)?(typeof d.getBoundingClientRect!==U&&(e=d.getBoundingClientRect()),c=Kc(f),{top:e.top+c.pageYOffset-b.clientTop,left:e.left+c.pageXOffset-b.clientLeft}):e},position:function(){if(this[0]){var a,b,c=this[0],d={top:0,left:0};return"fixed"===n.css(c,"position")?b=c.getBoundingClientRect():(a=this.offsetParent(),b=this.offset(),n.nodeName(a[0],"html")||(d=a.offset()),d.top+=n.css(a[0],"borderTopWidth",!0),d.left+=n.css(a[0],"borderLeftWidth",!0)),{top:b.top-d.top-n.css(c,"marginTop",!0),left:b.left-d.left-n.css(c,"marginLeft",!0)}}},offsetParent:function(){return this.map(function(){var a=this.offsetParent||Jc;while(a&&!n.nodeName(a,"html")&&"static"===n.css(a,"position"))a=a.offsetParent;return a||Jc})}}),n.each({scrollLeft:"pageXOffset",scrollTop:"pageYOffset"},function(b,c){var d="pageYOffset"===c;n.fn[b]=function(e){return J(this,function(b,e,f){var g=Kc(b);return void 0===f?g?g[c]:b[e]:void(g?g.scrollTo(d?a.pageXOffset:f,d?f:a.pageYOffset):b[e]=f)},b,e,arguments.length,null)}}),n.each(["top","left"],function(a,b){n.cssHooks[b]=yb(k.pixelPosition,function(a,c){return c?(c=xb(a,b),vb.test(c)?n(a).position()[b]+"px":c):void 0})}),n.each({Height:"height",Width:"width"},function(a,b){n.each({padding:"inner"+a,content:b,"":"outer"+a},function(c,d){n.fn[d]=function(d,e){var f=arguments.length&&(c||"boolean"!=typeof d),g=c||(d===!0||e===!0?"margin":"border");return J(this,function(b,c,d){var e;return n.isWindow(b)?b.document.documentElement["client"+a]:9===b.nodeType?(e=b.documentElement,Math.max(b.body["scroll"+a],e["scroll"+a],b.body["offset"+a],e["offset"+a],e["client"+a])):void 0===d?n.css(b,c,g):n.style(b,c,d,g)},b,f?d:void 0,f,null)}})}),n.fn.size=function(){return this.length},n.fn.andSelf=n.fn.addBack,"function"=="function"&&__webpack_require__(62)&&!(__WEBPACK_AMD_DEFINE_ARRAY__ = [], __WEBPACK_AMD_DEFINE_RESULT__ = function(){return n}.apply(exports, __WEBPACK_AMD_DEFINE_ARRAY__),
				__WEBPACK_AMD_DEFINE_RESULT__ !== undefined && (module.exports = __WEBPACK_AMD_DEFINE_RESULT__));var Lc=a.jQuery,Mc=a.$;return n.noConflict=function(b){return a.$===n&&(a.$=Mc),b&&a.jQuery===n&&(a.jQuery=Lc),n},typeof b===U&&(a.jQuery=a.$=n),n});


/***/ }),
/* 25 */
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


/***/ }),
/* 26 */
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
 * @param {boolean} [captureAll=false] whether to enable the capturing of
 *   leading and trailing wildcards in the filter text; by default, leading and
 *   trailing wildcards are stripped out
 * @return {string} regular expression representation of filter text
 */
function filterToRegExp(text, captureAll = false)
{
  // remove multiple wildcards
  text = text.replace(/\*+/g, "*");

  if (!captureAll)
  {
    // remove leading wildcard
    if (text[0] == "*")
      text = text.substring(1);

    // remove trailing wildcard
    if (text[text.length - 1] == "*")
      text = text.substring(0, text.length - 1);
  }

  return text
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
    .replace(/\\\|$/, "$");
}

exports.filterToRegExp = filterToRegExp;

function splitSelector(selector)
{
  if (!selector.includes(","))
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

function findTargetSelectorIndex(selector)
{
  let index = 0;
  let whitespace = 0;
  let scope = [];

  // Start from the end of the string and go character by character, where each
  // character is a Unicode code point.
  for (let character of [...selector].reverse())
  {
    let currentScope = scope[scope.length - 1];

    if (character == "'" || character == "\"")
    {
      // If we're already within the same type of quote, close the scope;
      // otherwise open a new scope.
      if (currentScope == character)
        scope.pop();
      else
        scope.push(character);
    }
    else if (character == "]" || character == ")")
    {
      // For closing brackets and parentheses, open a new scope only if we're
      // not within a quote. Within quotes these characters should have no
      // meaning.
      if (currentScope != "'" && currentScope != "\"")
        scope.push(character);
    }
    else if (character == "[")
    {
      // If we're already within a bracket, close the scope.
      if (currentScope == "]")
        scope.pop();
    }
    else if (character == "(")
    {
      // If we're already within a parenthesis, close the scope.
      if (currentScope == ")")
        scope.pop();
    }
    else if (!currentScope)
    {
      // At the top level (not within any scope), count the whitespace if we've
      // encountered it. Otherwise if we've hit one of the combinators,
      // terminate here; otherwise if we've hit a non-colon character,
      // terminate here.
      if (/\s/.test(character))
      {
        whitespace++;
      }
      else if ((character == ">" || character == "+" || character == "~") ||
               (whitespace > 0 && character != ":"))
      {
        break;
      }
    }

    // Zero out the whitespace count if we've entered a scope.
    if (scope.length > 0)
      whitespace = 0;

    // Increment the index by the size of the character. Note that for Unicode
    // composite characters (like emoji) this will be more than one.
    index += character.length;
  }

  return selector.length - index + whitespace;
}

/**
 * Qualifies a CSS selector with a qualifier, which may be another CSS selector
 * or an empty string. For example, given the selector "div.bar" and the
 * qualifier "#foo", this function returns "div#foo.bar".
 * @param {string} selector The selector to qualify.
 * @param {string} qualifier The qualifier with which to qualify the selector.
 * @returns {string} The qualified selector.
 */
function qualifySelector(selector, qualifier)
{
  let qualifiedSelector = "";

  let qualifierTargetSelectorIndex = findTargetSelectorIndex(qualifier);
  let [, qualifierType = ""] =
    /^([a-z][a-z-]*)?/i.exec(qualifier.substring(qualifierTargetSelectorIndex));

  for (let sub of splitSelector(selector))
  {
    sub = sub.trim();

    qualifiedSelector += ", ";

    let index = findTargetSelectorIndex(sub);

    // Note that the first group in the regular expression is optional. If it
    // doesn't match (e.g. "#foo::nth-child(1)"), type will be an empty string.
    let [, type = "", rest] =
      /^([a-z][a-z-]*)?\*?(.*)/i.exec(sub.substring(index));

    if (type == qualifierType)
      type = "";

    // If the qualifier ends in a combinator (e.g. "body #foo>"), we put the
    // type and the rest of the selector after the qualifier
    // (e.g. "body #foo>div.bar"); otherwise (e.g. "body #foo") we merge the
    // type into the qualifier (e.g. "body div#foo.bar").
    if (/[\s>+~]$/.test(qualifier))
      qualifiedSelector += sub.substring(0, index) + qualifier + type + rest;
    else
      qualifiedSelector += sub.substring(0, index) + type + qualifier + rest;
  }

  // Remove the initial comma and space.
  return qualifiedSelector.substring(2);
}

exports.qualifySelector = qualifySelector;


/***/ }),
/* 27 */
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
 * Map to be used instead when a filter has a blank <code>domains</code>
 * property.
 * @type {Map.<string, boolean>}
 */
let defaultDomains = new Map([["", true]]);

/**
 * A <code>FilterMap</code> object contains a set of filters, each mapped to a
 * boolean value indicating whether the filter should be applied. It is used
 * by <code>{@link FiltersByDomain}</code>.
 *
 * @package
 */
class FilterMap
{
  /**
   * Creates a <code>FilterMap</code> object.
   * @param {?Array.<Array>} [entries] The initial entries in the object.
   * @see #entries
   * @private
   */
  constructor(entries)
  {
    this._map = new Map(entries);
  }

  /**
   * Returns the number of filters in the object.
   * @returns {number}
   */
  get size()
  {
    return this._map.size;
  }

  /**
   * Yields all the filters in the object along with a boolean value for each
   * filter indicating whether the filter should be applied.
   *
   * @returns {object} An iterator that yields a two-tuple containing an
   *   <code>{@link ActiveFilter}</code> object and a <code>boolean</code>
   *   value.
   */
  entries()
  {
    return this._map.entries();
  }

  /**
   * Yields all the filters in the object.
   *
   * @returns {object} An iterator that yields an
   *   <code>{@link ActiveFilter}</code> object.
   */
  keys()
  {
    return this._map.keys();
  }

  /**
   * Returns a boolean value indicating whether the filter referenced by the
   * given key should be applied.
   *
   * @param {ActiveFilter} key The filter.
   *
   * @returns {boolean|undefined} Whether the filter should be applied. If the
   *   object does not contain the filter referenced by <code>key</code>,
   *   returns <code>undefined</code>.
   */
  get(key)
  {
    return this._map.get(key);
  }

  /**
   * Sets the boolean value for the filter referenced by the given key
   * indicating whether the filter should be applied.
   *
   * @param {ActiveFilter} key The filter.
   * @param {boolean} value The boolean value.
   */
  set(key, value)
  {
    this._map.set(key, value);
  }

  /**
   * Removes the filter referenced by the given key.
   *
   * @param {ActiveFilter} key The filter.
   */
  delete(key)
  {
    this._map.delete(key);
  }
}

exports.FilterMap = FilterMap;

/**
 * A <code>FiltersByDomain</code> object contains a set of domains, each mapped
 * to a set of filters along with a boolean value for each filter indicating
 * whether the filter should be applied to the domain.
 *
 * @package
 */
class FiltersByDomain
{
  /**
   * Creates a <code>FiltersByDomain</code> object.
   * @param {?Array.<Array>} [entries] The initial entries in the object.
   * @see #entries
   */
  constructor(entries)
  {
    this._map = new Map(entries);
  }

  /**
   * Returns the number of domains in the object.
   * @returns {number}
   */
  get size()
  {
    return this._map.size;
  }

  /**
   * Yields all the domains in the object along with a set of filters for each
   * domain, each filter in turn mapped to a boolean value indicating whether
   * the filter should be applied to the domain.
   *
   * @returns {object} An iterator that yields a two-tuple containing a
   *   <code>string</code> and either a <code>{@link FilterMap}</code> object
   *   or a single <code>{@link ActiveFilter}</code> object. In the latter
   *   case, it directly indicates that the filter should be applied.
   */
  entries()
  {
    return this._map.entries();
  }

  /**
   * Returns a boolean value asserting whether the object contains the domain
   * referenced by the given key.
   *
   * @param {string} key The domain.
   *
   * @returns {boolean} Whether the object contains the domain referenced by
   *   <code>key</code>.
   */
  has(key)
  {
    return this._map.has(key);
  }

  /**
   * Returns a set of filters for the domain referenced by the given key, along
   * with a boolean value for each filter indicating whether the filter should
   * be applied to the domain.
   *
   * @param {string} key The domain.
   *
   * @returns {FilterMap|ActiveFilter|undefined} Either a
   *   <code>{@link FilterMap}</code> object or a single
   *   <code>{@link ActiveFilter}</code> object. In the latter case, it
   *   directly indicates that the filter should be applied. If this
   *   <code>FiltersByDomain</code> object does not contain the domain
   *   referenced by <code>key</code>, the return value is
   *   <code>undefined</code>.
   */
  get(key)
  {
    return this._map.get(key);
  }

  /**
   * Removes all the domains in the object.
   */
  clear()
  {
    this._map.clear();
  }

  /**
   * Adds a filter and all of its domains to the object.
   *
   * @param {ActiveFilter} filter The filter.
   * @param {Map.<string, boolean>} [domains] The filter's domains. If not
   *   given, the <code>{@link domains}</code> property of <code>filter</code>
   *   is used.
   */
  add(filter, domains = filter.domains)
  {
    for (let [domain, include] of domains || defaultDomains)
    {
      if (!include && domain == "")
        continue;

      let map = this._map.get(domain);
      if (!map)
      {
        this._map.set(domain, include ? filter :
                                new FilterMap([[filter, false]]));
      }
      else if (map.size == 1 && !(map instanceof FilterMap))
      {
        if (filter != map)
        {
          this._map.set(domain, new FilterMap([[map, true],
                                               [filter, include]]));
        }
      }
      else
      {
        map.set(filter, include);
      }
    }
  }

  /**
   * Removes a filter and all of its domains from the object.
   *
   * @param {ActiveFilter} filter The filter.
   * @param {Map.<string, boolean>} [domains] The filter's domains. If not
   *   given, the <code>{@link domains}</code> property of <code>filter</code>
   *   is used.
   */
  remove(filter, domains = filter.domains)
  {
    for (let domain of (domains || defaultDomains).keys())
    {
      let map = this._map.get(domain);
      if (map)
      {
        if (map.size > 1 || map instanceof FilterMap)
        {
          map.delete(filter);

          if (map.size == 0)
          {
            this._map.delete(domain);
          }
          else if (map.size == 1)
          {
            for (let [lastFilter, include] of map.entries())
            {
              // Reduce Map { "example.com" => Map { filter => true } } to
              // Map { "example.com" => filter }
              if (include)
                this._map.set(domain, lastFilter);

              break;
            }
          }
        }
        else if (filter == map)
        {
          this._map.delete(domain);
        }
      }
    }
  }
}

exports.FiltersByDomain = FiltersByDomain;


/***/ }),
/* 28 */
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
 * @fileOverview Snippets implementation.
 */

const {EventEmitter} = __webpack_require__(6);

const singleCharacterEscapes = new Map([
  ["n", "\n"], ["r", "\r"], ["t", "\t"]
]);

/**
 * {@link snippets} implementation.
 */
class Snippets extends EventEmitter
{
  /**
   * @hideconstructor
   */
  constructor()
  {
    super();

    /**
     * All known snippet filters.
     * @type {Set.<SnippetFilter>}
     * @private
     */
    this._filters = new Set();
  }

  /**
   * Removes all known snippet filters.
   */
  clear()
  {
    let {_filters} = this;

    if (_filters.size == 0)
      return;

    _filters.clear();

    this.emit("snippets.filtersCleared");
  }

  /**
   * Adds a new snippet filter.
   * @param {SnippetFilter} filter
   */
  add(filter)
  {
    let {_filters} = this;
    let {size} = _filters;

    _filters.add(filter);

    if (size != _filters.size)
      this.emit("snippets.filterAdded", filter);
  }

  /**
   * Removes an existing snippet filter.
   * @param {SnippetFilter} filter
   */
  remove(filter)
  {
    let {_filters} = this;
    let {size} = _filters;

    _filters.delete(filter);

    if (size != _filters.size)
      this.emit("snippets.filterRemoved", filter);
  }

  /**
   * Returns a list of all snippet filters active on the given domain.
   * @param {string} domain
   * @returns {Array.<SnippetFilter>}
   */
  getFiltersForDomain(domain)
  {
    let result = [];

    for (let filter of this._filters)
    {
      if (filter.isActiveOnDomain(domain))
        result.push(filter);
    }

    return result;
  }
}

/**
 * Container for snippet filters.
 * @type {Snippets}
 */
let snippets = new Snippets();

exports.snippets = snippets;

/**
 * Parses a script and returns a list of all its commands and their arguments.
 * @param {string} script
 * @returns {Array.<string[]>}
 */
function parseScript(script)
{
  let tree = [];

  let escape = false;
  let withinQuotes = false;

  let unicodeEscape = null;

  let quotesClosed = false;

  let call = [];
  let argument = "";

  for (let character of script.trim() + ";")
  {
    let afterQuotesClosed = quotesClosed;
    quotesClosed = false;

    if (unicodeEscape != null)
    {
      unicodeEscape += character;

      if (unicodeEscape.length == 4)
      {
        let codePoint = parseInt(unicodeEscape, 16);
        if (!isNaN(codePoint))
          argument += String.fromCodePoint(codePoint);

        unicodeEscape = null;
      }
    }
    else if (escape)
    {
      escape = false;

      if (character == "u")
        unicodeEscape = "";
      else
        argument += singleCharacterEscapes.get(character) || character;
    }
    else if (character == "\\")
    {
      escape = true;
    }
    else if (character == "'")
    {
      withinQuotes = !withinQuotes;

      if (!withinQuotes)
        quotesClosed = true;
    }
    else if (withinQuotes || character != ";" && !/\s/.test(character))
    {
      argument += character;
    }
    else
    {
      if (argument || afterQuotesClosed)
      {
        call.push(argument);
        argument = "";
      }

      if (character == ";" && call.length > 0)
      {
        tree.push(call);
        call = [];
      }
    }
  }

  return tree;
}

exports.parseScript = parseScript;

/**
 * Compiles a script against a given list of libraries into executable code.
 * @param {string} script
 * @param {Array.<string>} libraries
 * @returns {string}
 */
function compileScript(script, libraries)
{
  return `
    "use strict";
    {
      const libraries = ${JSON.stringify(libraries)};

      const script = ${JSON.stringify(parseScript(script))};

      let imports = Object.create(null);
      for (let library of libraries)
        new Function("exports", library)(imports);

      for (let [name, ...args] of script)
      {
        if (Object.prototype.hasOwnProperty.call(imports, name))
        {
          let value = imports[name];
          if (typeof value == "function")
            value(...args);
        }
      }
    }
  `;
}

exports.compileScript = compileScript;


/***/ }),
/* 29 */
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

const {Utils} = __webpack_require__(12);

const MILLIS_IN_SECOND = exports.MILLIS_IN_SECOND = 1000;
const MILLIS_IN_MINUTE = exports.MILLIS_IN_MINUTE = 60 * MILLIS_IN_SECOND;
const MILLIS_IN_HOUR = exports.MILLIS_IN_HOUR = 60 * MILLIS_IN_MINUTE;
const MILLIS_IN_DAY = exports.MILLIS_IN_DAY = 24 * MILLIS_IN_HOUR;

class Downloader
{
  /**
   * Creates a new downloader instance.
   * @param {function} dataSource
   *   Function that will yield downloadable objects on each check
   * @param {number} initialDelay
   *   Number of milliseconds to wait before the first check
   * @param {number} checkInterval
   *   Interval between the checks
   */
  constructor(dataSource, initialDelay, checkInterval)
  {
    /**
     * Maximal time interval that the checks can be left out until the soft
     * expiration interval increases.
     * @type {number}
     */
    this.maxAbsenceInterval = 1 * MILLIS_IN_DAY;

    /**
     * Minimal time interval before retrying a download after an error.
     * @type {number}
     */
    this.minRetryInterval = 1 * MILLIS_IN_DAY;

    /**
     * Maximal allowed expiration interval; larger expiration intervals will be
     * corrected.
     * @type {number}
     */
    this.maxExpirationInterval = 14 * MILLIS_IN_DAY;

    /**
     * Maximal number of redirects before the download is considered as failed.
     * @type {number}
     */
    this.maxRedirects = 5;

    /**
     * Called whenever expiration intervals for an object need to be adapted.
     * @type {function?}
     */
    this.onExpirationChange = null;

    /**
     * Callback to be triggered whenever a download starts.
     * @type {function?}
     */
    this.onDownloadStarted = null;

    /**
     * Callback to be triggered whenever a download finishes successfully. The
     * callback can return an error code to indicate that the data is wrong.
     * @type {function?}
     */
    this.onDownloadSuccess = null;

    /**
     * Callback to be triggered whenever a download fails.
     * @type {function?}
     */
    this.onDownloadError = null;

    /**
     * Function that will yield downloadable objects on each check.
     * @type {function}
     */
    this.dataSource = dataSource;

    /**
     * Set containing the URLs of objects currently being downloaded.
     * @type {Set.<string>}
     */
    this._downloading = new Set();

    let check = () =>
    {
      try
      {
        this._doCheck();
      }
      finally
      {
        // Schedule the next check only after the callback has finished with
        // the current check.
        setTimeout(check, checkInterval); // eslint-disable-line no-undef
      }
    };

    // Note: test/_common.js overrides setTimeout() for the tests; if this
    // global function is used anywhere else, it may give incorrect results.
    // This is why we disable ESLint's no-undef rule locally.
    // https://gitlab.com/eyeo/adblockplus/adblockpluscore/issues/43
    setTimeout(check, initialDelay); // eslint-disable-line no-undef
  }

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
  }

  /**
   * Checks whether an address is currently being downloaded.
   * @param {string} url
   * @returns {boolean}
   */
  isDownloading(url)
  {
    return this._downloading.has(url);
  }

  /**
   * Starts downloading for an object.
   * @param {Downloadable} downloadable
   */
  download(downloadable)
  {
    // Make sure to detach download from the current execution context
    Promise.resolve().then(this._download.bind(this, downloadable, 0));
  }

  /**
   * Generates the real download URL for an object by appending various
   * parameters.
   * @param {Downloadable} downloadable
   * @returns {string}
   */
  getDownloadUrl(downloadable)
  {
    const {addonName, addonVersion, application, applicationVersion,
           platform, platformVersion} = __webpack_require__(3);
    let url = downloadable.redirectURL || downloadable.url;
    if (url.includes("?"))
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
  }

  _download(downloadable, redirects)
  {
    if (this.isDownloading(downloadable.url))
      return;

    let downloadUrl = this.getDownloadUrl(downloadable);
    let responseStatus = 0;

    let errorCallback = error =>
    {
      Utils.logError("Adblock Plus: Downloading URL " + downloadable.url +
                     " failed (" + error + ")\n" +
                     "Download address: " + downloadUrl + "\n" +
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

        this.onDownloadError(downloadable, downloadUrl, error, responseStatus,
                             redirectCallback);
      }
    };

    let requestURL = null;

    try
    {
      requestURL = new URL(downloadUrl);
    }
    catch (error)
    {
      errorCallback("synchronize_invalid_url");
      return;
    }

    if (!["https:", "data:"].includes(requestURL.protocol) &&
        !["127.0.0.1", "[::1]", "localhost"].includes(requestURL.hostname))
    {
      errorCallback("synchronize_invalid_url");
      return;
    }

    let initObj = {
      cache: "no-store",
      credentials: "omit",
      referrer: "no-referrer"
    };

    let handleError = () =>
    {
      this._downloading.delete(downloadable.url);
      errorCallback("synchronize_connection_error");
    };

    let handleResponse = response =>
    {
      this._downloading.delete(downloadable.url);

      // If the Response.url property is available [1], disallow redirection
      // from HTTPS to any other protocol.
      // [1]: https://developer.mozilla.org/en-US/docs/Web/API/Response/url#Browser_compatibility
      if (typeof response.url == "string" && requestURL.protocol == "https:" &&
          new URL(response.url).protocol != requestURL.protocol)
      {
        errorCallback("synchronize_connection_error");
        return;
      }

      responseStatus = response.status;

      if (responseStatus != 200)
      {
        errorCallback("synchronize_connection_error");
        return;
      }

      downloadable.downloadCount++;

      response.text().then(responseText =>
      {
        this.onDownloadSuccess(downloadable, responseText, errorCallback, url =>
        {
          if (redirects >= this.maxRedirects)
          {
            errorCallback("synchronize_connection_error");
            return;
          }

          downloadable.redirectURL = url;
          this._download(downloadable, redirects + 1);
        });
      },
      () =>
      {
        errorCallback("synchronize_connection_error");
      });
    };

    fetch(requestURL.href, initObj).then(handleResponse, handleError);

    this._downloading.add(downloadable.url);

    if (this.onDownloadStarted)
      this.onDownloadStarted(downloadable);
  }

  /**
   * Produces a soft and a hard expiration interval for a given supplied
   * expiration interval.
   * @param {number} interval
   * @returns {Array.<number>} soft and hard expiration interval
   */
  processExpirationInterval(interval)
  {
    interval = Math.min(Math.max(interval, 0), this.maxExpirationInterval);
    let soft = Math.round(interval * (Math.random() * 0.4 + 0.8));
    let hard = interval * 2;
    let now = Date.now();
    return [now + soft, now + hard];
  }
}

exports.Downloader = Downloader;

class Downloadable
{
  /**
   * Creates an object that can be downloaded by the downloader.
   * @param {string} url  URL that has to be requested for the object
   */
  constructor(url)
  {
    /**
     * URL that the download was redirected to if any.
     * @type {string?}
     */
    this.redirectURL = null;

    /**
     * Time of last download error or 0 if the last download was successful.
     * @type {number}
     */
    this.lastError = 0;

    /**
     * Time of last check whether the object needs downloading.
     * @type {number}
     */
    this.lastCheck = 0;

    /**
     * Object version corresponding to the last successful download.
     * @type {number}
     */
    this.lastVersion = 0;

    /**
     * Soft expiration interval; will increase if no checks are performed for a
     * while.
     * @type {number}
     */
    this.softExpiration = 0;

    /**
     * Hard expiration interval; this is fixed.
     * @type {number}
     */
    this.hardExpiration = 0;

    /**
     * Number indicating how often the object was downloaded.
     * @type {number}
     */
    this.downloadCount = 0;

    /**
     * URL that has to be requested for the object.
     * @type {string}
     */
    this.url = url;
  }
}

exports.Downloadable = Downloadable;


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

/** @module requestBlocker */



const {Filter, RegExpFilter, BlockingFilter} =
  __webpack_require__(0);
const {Subscription} = __webpack_require__(4);
const {defaultMatcher} = __webpack_require__(11);
const {filterNotifier} = __webpack_require__(1);
const {parseURL} = __webpack_require__(10);
const {Prefs} = __webpack_require__(2);
const {checkWhitelisted, getKey} = __webpack_require__(9);
const {extractHostFromFrame} = __webpack_require__(8);
const {port} = __webpack_require__(7);
const {logRequest: hitLoggerLogRequest} = __webpack_require__(13);

const extensionProtocol = new URL(browser.extension.getURL("")).protocol;

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

  // Treat requests sent by plugins the same as <object> or <embed>.
  yield ["object_subrequest", "OBJECT"];
}());

exports.filterTypes = new Set(function*()
{
  for (let type in browser.webRequest.ResourceType)
    yield resourceTypes.get(browser.webRequest.ResourceType[type]) || "OTHER";

  // WEBRTC gets addressed through a workaround, even if the webRequest API is
  // lacking support to block this kind of a request.
  yield "WEBRTC";

  // POPUP, CSP and ELEMHIDE filters aren't mapped to resource types.
  yield "POPUP";
  yield "ELEMHIDE";
  yield "SNIPPET";
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
    filterNotifier.emit("filter.hitCount", filter, 0, 0, tabIds);

  hitLoggerLogRequest(tabIds, request, filter);
}

browser.webRequest.onBeforeRequest.addListener(details =>
{
  // Filter out requests from non web protocols. Ideally, we'd explicitly
  // specify the protocols we are interested in (i.e. http://, https://,
  // ws:// and wss://) with the url patterns, given below, when adding this
  // listener. But unfortunately, Chrome <=57 doesn't support the WebSocket
  // protocol and is causing an error if it is given.
  let url = parseURL(details.url);
  if (url.protocol != "http:" && url.protocol != "https:" &&
      url.protocol != "ws:" && url.protocol != "wss:")
    return;

  // Firefox provides us with the full origin URL, while Chromium (>=63)
  // provides only the protocol + host of the (top-level) document which
  // the request originates from through the "initiator" property.
  let originUrl = null;
  if (details.originUrl)
    originUrl = parseURL(details.originUrl);
  else if (details.initiator && details.initiator != "null")
    originUrl = parseURL(details.initiator);

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
  let filter = defaultMatcher.matchesAny(url, RegExpFilter.typeMap[type],
                                         docDomain, sitekey, specificOnly);

  let result;
  let rewrittenUrl;

  if (filter instanceof BlockingFilter)
  {
    if (typeof filter.rewrite == "string")
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
        url: details.url, type, docDomain,
        sitekey, specificOnly, rewrittenUrl
      },
      filter
    );
  });

  return result;
}, {
  types: Object.values(browser.webRequest.ResourceType)
               .filter(type => type != "main_frame"),
  urls: ["<all_urls>"]
}, ["blocking"]);

port.on("filters.collapse", (message, sender) =>
{
  let {page, frame} = sender;

  if (checkWhitelisted(page, frame))
    return false;

  let [docDomain, sitekey, specificOnly] = getDocumentInfo(page, frame);

  for (let url of message.urls)
  {
    let filter = defaultMatcher.matchesAny(
      new URL(url, message.baseURL),
      RegExpFilter.typeMap[message.mediatype],
      docDomain, sitekey, specificOnly
    );

    if (filter instanceof BlockingFilter)
      return true;
  }

  return false;
});

port.on("request.blockedByRTCWrapper", (msg, sender) =>
{
  let {page, frame} = sender;

  if (checkWhitelisted(page, frame))
    return false;

  let {url} = msg;
  let [docDomain, sitekey, specificOnly] = getDocumentInfo(page, frame);
  let filter = defaultMatcher.matchesAny(new URL(url),
                                         RegExpFilter.typeMap.WEBRTC,
                                         docDomain, sitekey, specificOnly);
  logRequest(
    [sender.page.id],
    {url, type: "WEBRTC", docDomain, sitekey, specificOnly},
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
  if (arg instanceof Subscription && arg.filterCount == 0)
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
    filterNotifier.emit("filter.behaviorChanged");
  });
}

filterNotifier.on("subscription.added", onFilterChange);
filterNotifier.on("subscription.removed", arg => onFilterChange(arg, false));
filterNotifier.on("subscription.updated", arg => onFilterChange(arg, false));
filterNotifier.on("subscription.disabled", arg => onFilterChange(arg, true));
filterNotifier.on("filter.added", onFilterChange);
filterNotifier.on("filter.removed", onFilterChange);
filterNotifier.on("filter.disabled", arg => onFilterChange(arg, true));
filterNotifier.on("ready", onFilterChange);


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

/** @module notificationHelper */



const {startIconAnimation, stopIconAnimation} = __webpack_require__(57);
const info = __webpack_require__(3);
const {Utils} = __webpack_require__(12);
const {port} = __webpack_require__(7);
const {Prefs} = __webpack_require__(2);
const {Notification: NotificationStorage} =
  __webpack_require__(15);
const {initAntiAdblockNotification} =
  __webpack_require__(58);
const {initDay1Notification} = __webpack_require__(59);
const {showOptions} = __webpack_require__(32);

const displayMethods = new Map([
  ["critical", ["icon", "notification", "popup"]],
  ["question", ["notification"]],
  ["normal", ["notification"]],
  ["relentless", ["notification"]],
  ["information", ["icon", "popup"]]
]);
const defaultDisplayMethods = ["popup"];

// We must hard code any "abp:" prefixed notification links here, otherwise
// notifications linking to them will not be displayed at all.
const localNotificationPages = new Map([
  ["abp:day1", "/day1.html"]
]);

// The active notification is (if any) the most recent currently displayed
// notification. Once a notification is clicked or is superceeded by another
// notification we no longer consider it active.
let activeNotification = null;

// We animate the ABP icon while some kinds of notifications are active, to help
// catch the user's attention.
let notificationIconAnimationPlaying = false;

// When a notification button is clicked we need to look up what should happen.
// This can be both for the active notification, and also for notifications
// stashed in the notification center.
let buttonsByNotificationId = new Map();

// Newer versions of Microsoft Edge (EdgeHTML 17) have the notifications
// API, but the entire browser crashes when it is used!
// https://developer.microsoft.com/en-us/microsoft-edge/platform/issues/20146233/
const browserNotificationsSupported = __webpack_require__(3).platform != "edgehtml";

// Opera < 57 and Firefox (tested up to 68.0.1) do not support notifications
// being created with buttons. Opera added button support with >= 57, however
// the button click handlers have broken with >= 60 (tested up to 62). Until
// Opera fixes that bug (reference DNAWIZ-70332) we unfortunately can't use
// feature detection when deciding if notification buttons should be displayed.
const browserNotificationButtonsSupported = browserNotificationsSupported &&
                                            info.platform == "chromium" &&
                                            info.application != "opera";

// As of August 2019, only Chrome supports this flag and, since Firefox
// throws on unsupported options (tested with version 69), we need to
// explicitly set it only for supported browsers.
const browserNotificationRequireInteractionSupported = (
  info.platform == "chromium" && parseInt(info.platformVersion, 10) >= 50
);

function playNotificationIconAnimation(notification)
{
  let animateIcon = !(notification.urlFilters instanceof Array) &&
      shouldDisplay("icon", notification.type);
  if (animateIcon)
  {
    startIconAnimation(notification.type);
    notificationIconAnimationPlaying = true;
  }
}

function getNotificationButtons({type: notificationType, links}, message)
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
    let linkCount = 0;
    let regex = /<a>(.*?)<\/a>/g;
    let match;
    while (match = regex.exec(message))
    {
      buttons.push({
        type: "link",
        title: match[1],
        link: links[linkCount++]
      });
    }

    // We allow the user to disable non-essential notifications, and we add a
    // button to those notifications to make that easier to do.
    let addConfigureButton = isOptional(notificationType);

    // Chrome only allows two notification buttons so we need to fall back
    // to a single button to open all links if there are more than two.
    let maxButtons = addConfigureButton ? 1 : 2;
    if (buttons.length > maxButtons)
    {
      buttons = [
        {
          type: "open-all",
          title: browser.i18n.getMessage("notification_open_all"),
          links
        }
      ];
    }
    if (addConfigureButton)
    {
      buttons.push({
        type: "configure",
        title: browser.i18n.getMessage("notification_configure")
      });
    }
  }

  return buttons;
}

function openNotificationLink(link)
{
  let url;

  if (link.startsWith("abp:"))
    url = localNotificationPages.get(link);
  else
    url = Utils.getDocLink(link);

  browser.tabs.create({url});
}

function getButtonLinks(buttons)
{
  let links = [];

  for (let button of buttons)
  {
    if (button.type == "link" && button.link)
      links.push(button.link);
    else if (button.type == "open-all" && button.links)
      links = links.concat(button.links);
  }
  return links;
}

function openNotificationLinks(notificationId)
{
  let buttons = buttonsByNotificationId.get(notificationId) || [];
  for (let link of getButtonLinks(buttons))
    openNotificationLink(link);
}

function notificationButtonClick(notificationId, buttonIndex)
{
  let buttons = buttonsByNotificationId.get(notificationId);

  if (!(buttons && buttonIndex in buttons))
    return;

  let button = buttons[buttonIndex];

  switch (button.type)
  {
    case "link":
      openNotificationLink(button.link);
      break;
    case "open-all":
      openNotificationLinks(notificationId);
      break;
    case "configure":
      showOptions().then(([tab, optionsPort]) =>
      {
        optionsPort.postMessage({
          type: "app.respond",
          action: "focusSection",
          args: ["notifications"]
        });
      });
      break;
    case "question":
      NotificationStorage.triggerQuestionListeners(notificationId,
                                                   buttonIndex == 0);
      NotificationStorage.markAsShown(notificationId);
      break;
  }
}

/**
 * Tidy up after a notification has been dismissed.
 *
 * @param {string} notificationId
 * @param {bool} stashedInNotificationCenter
 *   If the given notification is (or might be) stashed in the notification
 *   center, we must take care to remember what its buttons do. Leave as true
 *   unless you're sure!
 */
function notificationDismissed(notificationId, stashedInNotificationCenter)
{
  if (activeNotification && activeNotification.id == notificationId)
  {
    activeNotification = null;

    if (notificationIconAnimationPlaying)
    {
      stopIconAnimation();
      notificationIconAnimationPlaying = false;
    }
  }

  if (!stashedInNotificationCenter)
    buttonsByNotificationId.delete(notificationId);
}

function showNotification(notification)
{
  if (activeNotification && activeNotification.id == notification.id)
    return;

  // Without buttons, showing notifications of the type "question" is pointless.
  if (notification.type == "question" && !browserNotificationButtonsSupported)
    return;

  let texts = NotificationStorage.getLocalizedTexts(notification);
  let buttons = getNotificationButtons(notification, texts.message);

  // Don't display notifications at all if they contain a link to a local
  // notification page which we don't have.
  for (let link of getButtonLinks(buttons))
  {
    if (link.startsWith("abp:") && !localNotificationPages.has(link))
      return;
  }

  // We take a note of the notification's buttons even if notification buttons
  // are not supported by this browser. That way, if the user clicks the
  // (buttonless) notification we can still open all the links.
  buttonsByNotificationId.set(notification.id, buttons);

  activeNotification = notification;
  if (shouldDisplay("notification", notification.type))
  {
    let notificationTitle = texts.title || "";
    let message = (texts.message || "").replace(/<\/?(a|strong)>/g, "");
    let iconUrl = browser.extension.getURL("icons/detailed/abp-128.png");

    if (browserNotificationsSupported)
    {
      let notificationOptions = {
        type: "basic",
        title: notificationTitle,
        iconUrl,
        message,
        // We use the highest priority to prevent the notification
        // from closing automatically, for browsers that don't support the
        // requireInteraction flag.
        priority: 2
      };

      if (browserNotificationButtonsSupported)
        notificationOptions.buttons = buttons.map(({title}) => ({title}));

      if (browserNotificationRequireInteractionSupported)
        notificationOptions.requireInteraction = true;

      browser.notifications.create(notification.id, notificationOptions);
    }
    else
    {
      let linkCount = (notification.links || []).length;

      if (linkCount > 0)
      {
        message += " " + browser.i18n.getMessage(
          "notification_without_buttons"
        );
      }

      let basicNotification = new Notification(
        notificationTitle,
        {
          lang: Utils.appLocale,
          dir: Utils.readingDirection,
          body: message,
          icon: iconUrl
        }
      );

      basicNotification.addEventListener("click", () =>
      {
        openNotificationLinks(notification.id);
        notificationDismissed(notification.id, false);
      });
      basicNotification.addEventListener("close", () =>
      {
        // We'll have to assume the notification was dismissed by the user since
        // this event doesn't tell us!
        notificationDismissed(notification.id, true);
      });
    }
  }

  playNotificationIconAnimation(notification);

  if (notification.type != "question")
    NotificationStorage.markAsShown(notification.id);
}

/**
 * Initializes the notification system.
 *
 * @param {bool} firstRun
 */
exports.initNotifications = firstRun =>
{
  if (typeof Prefs.notificationdata.firstVersion == "undefined")
    Prefs.notificationdata.firstVersion = "0";

  if (browserNotificationsSupported)
  {
    let onClick = (notificationId, buttonIndex) =>
    {
      if (typeof buttonIndex == "number")
        notificationButtonClick(notificationId, buttonIndex);
      else if (!browserNotificationButtonsSupported)
        openNotificationLinks(notificationId);

      // Chrome hides notifications in the notification center when clicked,
      // so we need to clear them.
      browser.notifications.clear(notificationId);

      // But onClosed isn't triggered when we clear the notification, so we need
      // to take care to clear our record of it here too.
      notificationDismissed(notificationId, false);
    };
    browser.notifications.onButtonClicked.addListener(onClick);
    browser.notifications.onClicked.addListener(onClick);

    let onClosed = (notificationId, byUser) =>
    {
      // Despite using the highest priority for our notifications, Windows 10
      // will still hide them after a few seconds and stash them in the
      // notification center. We still consider the notification active when
      // this happens, in order to continue animating the ABP icon and/or
      // displaying the notification details in our popup window.
      // Note: Even if the notification was closed by the user, it still might
      //       be stashed in the notification center.
      if (byUser)
        notificationDismissed(notificationId, true);
    };
    browser.notifications.onClosed.addListener(onClosed);
  }

  initAntiAdblockNotification();

  if (firstRun)
    initDay1Notification();
};

/**
 * Returns the currently active notification (if any).
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
  let methods = displayMethods.get(notificationType) || defaultDisplayMethods;
  return methods.includes(method);
};

let isOptional =
/**
 * If the given notification type is of vital importance return false,
 * true otherwise.
 *
 * @param {string} notificationType
 * @return {boolean}
 */
exports.isOptional = notificationType =>
{
  return !["critical", "relentless"].includes(notificationType);
};

port.on("notifications.clicked", (message, sender) =>
{
  if (message.link)
  {
    openNotificationLink(message.link);
  }
  // While clicking on a desktop notification's button dismisses the
  // notification, clicking on a popup window notification's link does not.
  else
  {
    if (browserNotificationsSupported)
      browser.notifications.clear(message.id);

    notificationDismissed(message.id, true);
  }
});

ext.pages.onLoading.addListener(page =>
{
  NotificationStorage.showNext(page.url.href);
});

Prefs.on("blocked_total", () =>
{
  NotificationStorage.showNext();
});

NotificationStorage.addShowListener(showNotification);


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

/** @module options */



const {checkWhitelisted} = __webpack_require__(9);
const info = __webpack_require__(3);

const manifest = browser.runtime.getManifest();
const optionsUrl = manifest.options_page || manifest.options_ui.page;

const openOptionsPageAPISupported = (
  // Older versions of Edge do not support runtime.openOptionsPage
  // (tested version 38).
  "openOptionsPage" in browser.runtime &&
  // Newer versions of Edge (tested version 44) do support the API,
  // but it does not function correctly. The options page can be opened
  // repeatedly.
  info.platform != "edgehtml" &&
  // Some versions of Firefox for Android before version 57 do have a
  // runtime.openOptionsPage but it doesn't do anything.
  // https://bugzilla.mozilla.org/show_bug.cgi?id=1364945
  (info.application != "fennec" ||
   parseInt(info.applicationVersion, 10) >= 57)
);

function findOptionsPage()
{
  return browser.tabs.query({}).then(tabs =>
  {
    return new Promise((resolve, reject) =>
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
        resolve(optionsTab);
        return;
      }

      // Newly created tabs might have about:blank as their URL in Firefox
      // or undefined in Microsoft Edge rather than the final options page URL,
      // we need to wait for those to finish loading.
      let potentialOptionTabIds = new Set(
        tabs.filter(tab =>
              (tab.url == "about:blank" || !tab.url) && tab.status == "loading")
            .map(tab => tab.id)
      );
      if (potentialOptionTabIds.size == 0)
      {
        resolve();
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
            resolve(urlMatch ? tab : undefined);
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
        }
      };
      browser.tabs.onRemoved.addListener(removeListener);
    });
  });
}

function openOptionsPage()
{
  if (openOptionsPageAPISupported)
    return browser.runtime.openOptionsPage();

  // We use a relative URL here because of this Edge issue:
  // https://developer.microsoft.com/en-us/microsoft-edge/platform/issues/10276332
  return browser.tabs.create({url: optionsUrl});
}

function waitForOptionsPage(tab)
{
  return new Promise(resolve =>
  {
    function onMessage(message, port)
    {
      if (message.type != "app.listen")
        return;

      port.onMessage.removeListener(onMessage);
      resolve([tab, port]);
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

function focusOptionsPage(tab)
{
  if (openOptionsPageAPISupported)
    return browser.runtime.openOptionsPage();

  let focusTab = () => browser.tabs.update(tab.id, {active: true});

  if ("windows" in browser)
  {
    return browser.windows.update(tab.windowId, {focused: true})
                          .then(focusTab)
    // Edge 44 seems to throw an exception when browser.windows.update is
    // called, despite it working correctly.
                          .catch(focusTab);
  }

  // Firefox for Android before version 57 does not support
  // runtime.openOptionsPage, nor does it support the windows API.
  // Since there is effectively only one window on the mobile browser,
  // we can just bring the tab to focus instead.
  return focusTab();
}

let showOptions =
/**
 * Opens the options page, or switches to its existing tab.
 * @returns {Promise.<Array>}
 *   Promise resolving to an Array containg the tab Object of the options page
 *   and sometimes (when the page was just opened) a messaging port.
 */
exports.showOptions = () =>
{
  return findOptionsPage().then(existingTab =>
  {
    if (existingTab)
      return focusOptionsPage(existingTab).then(() => existingTab);

    return openOptionsPage().then(findOptionsPage).then(waitForOptionsPage);
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
  browser.tabs.query({active: true, lastFocusedWindow: true}).then(
    ([tab]) =>
    {
      let currentPage = new ext.Page(tab);

      showOptions().then(([optionsTab, port]) =>
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
    }
  );
});


/***/ }),
/* 33 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";
/** @module adblock-betafish/alias/subscriptionInit */



const {Subscription,
       DownloadableSubscription,
       SpecialSubscription} =
  __webpack_require__(4);
const {filterStorage} = __webpack_require__(5);
const {filterNotifier} = __webpack_require__(1);
const {recommendations} = __webpack_require__(23);
const info = __webpack_require__(3);
const {Prefs} = __webpack_require__(2);
const {synchronizer} = __webpack_require__(16);
const {Utils} = __webpack_require__(12);
const {initNotifications} = __webpack_require__(31);
const {updatesVersion} = __webpack_require__(61);

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
  return new Promise((resolve) => {
    firstRun = filterStorage.getSubscriptionCount() == 0;

    if (firstRun && (!filterStorage.firstRun || Prefs.currentVersion)) {
      reinitialized = true;
    }
    Prefs.currentVersion = info.addonVersion;

    chrome.storage.local.get(null).then((currentData) => {
      const edgeMigrationNeeded = currentData.filter_lists;
      if (edgeMigrationNeeded && firstRun) {
        firstRun = false;
      }
      resolve();
    });
  });
}

/**
 * Determines whether to add the default ad blocking subscriptions.
 * Returns true, if there are no filter subscriptions besides those
 * other subscriptions added automatically, and no custom filters.
 *
 * On first run, this logic should always result in true since there
 * is no data and therefore no subscriptions. But it also causes the
 * default ad blocking subscriptions to be added again after some
 * data corruption or misconfiguration.
 *
 * @return {boolean}
 */
function shouldAddDefaultSubscriptions()
{
  for (let subscription of filterStorage.subscriptions())
  {
    if (subscription instanceof DownloadableSubscription &&
        subscription.url != Prefs.subscriptions_exceptionsurl &&
        subscription.url != Prefs.subscriptions_antiadblockurl &&
        subscription.type != "circumvention")
      return false;

    if (subscription instanceof SpecialSubscription &&
        subscription.filterCount > 0)
      return false;
  }

  return true;
}

/**
 * Finds the elements for the default ad blocking filter subscriptions based
 * on the user's locale.
 *
 * @param {Array.<object>} subscriptions
 * @return {Map.<string, object>}
 */
function chooseFilterSubscriptions(subscriptions)
{
  let chosenSubscriptions = new Map();

  let selectedLanguage = null;
  let matchCount = 0;

  for (let subscription of subscriptions)
  {
    let {languages, type} = subscription;
    let language = languages && languages.find(
      lang => new RegExp("^" + lang + "\\b").test(Utils.appLocale)
    );

    if ((type == "ads" || type == "circumvention") &&
        !chosenSubscriptions.has(type))
    {
      chosenSubscriptions.set(type, subscription);
    }

    if (language)
    {
      // The "ads" subscription is the one driving the selection.
      if (type == "ads")
      {
        if (!selectedLanguage || selectedLanguage.length < language.length)
        {
          chosenSubscriptions.set(type, subscription);
          selectedLanguage = language;
          matchCount = 1;
        }
        else if (selectedLanguage && selectedLanguage.length == language.length)
        {
          matchCount++;

          // If multiple items have a matching language of the same length:
          // Select one of the items randomly, probability should be the same
          // for all items. So we replace the previous match here with
          // probability 1/N (N being the number of matches).
          if (Math.random() * matchCount < 1)
          {
            chosenSubscriptions.set(type, subscription);
            selectedLanguage = language;
          }
        }
      }
      else if (type == "circumvention")
      {
        chosenSubscriptions.set(type, subscription);
      }
    }
  }

  return chosenSubscriptions;
}

function supportsNotificationsWithButtons()
{
  // Older versions of Microsoft Edge (EdgeHTML 16) don't have the
  // notifications API. Newever versions (EdgeHTML 17) seem to crash
  // when it is used.
  // https://developer.microsoft.com/en-us/microsoft-edge/platform/issues/20146233/
  if (info.platform == "edgehtml")
    return false;

  // Opera gives an asynchronous error when buttons are provided (we cannot
  // detect that behavior without attempting to show a notification).
  if (info.application == "opera")
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

  // Add "acceptable ads", "anti-adblock messages", "AdBlock Custom", and "BitCoing Mining Protection List" subscriptions
  if (firstRun)
  {
    let acceptableAdsSubscription = Subscription.fromURL(
      Prefs.subscriptions_exceptionsurl
    );
    acceptableAdsSubscription.title = "Allow non-intrusive advertising";
    subscriptions.push(acceptableAdsSubscription);

    let abcSubscription = Subscription.fromURL('https://cdn.adblockcdn.com/filters/adblock_custom.txt');
    abcSubscription.title = "AdBlock custom filters";
    subscriptions.push(abcSubscription);

    let cplSubscription = Subscription.fromURL('https://raw.githubusercontent.com/hoshsadiq/adblock-nocoin-list/master/nocoin.txt');
    cplSubscription.title = "Cryptocurrency (Bitcoin) Mining Protection List";
    subscriptions.push(cplSubscription);

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

  // Add default ad blocking subscriptions (e.g. EasyList, Anti-Circumvention)
  let addDefaultSubscription = shouldAddDefaultSubscriptions();
  if (addDefaultSubscription || !Prefs.subscriptions_addedanticv)
  {
    for (let [, value] of chooseFilterSubscriptions(recommendations()))
    {
      let {url, type, title, homepage} = value;

      // Make sure that we don't add Easylist again if we want
      // to just add the Anti-Circumvention subscription.
      if (!addDefaultSubscription && type != "circumvention")
        continue;

      let subscription = Subscription.fromURL(url);
      subscription.disabled = false;
      subscription.title = title;
      subscription.homepage = homepage;
      subscriptions.push(subscription);

      if (subscription.type == "circumvention")
        Prefs.subscriptions_addedanticv = true;
    }

    return subscriptions;
  }

  return subscriptions;
}

function addSubscriptionsAndNotifyUser(subscriptions)
{
  if (subscriptionsCallback)
    subscriptions = subscriptionsCallback(subscriptions);

  for (let subscription of subscriptions)
  {
    filterStorage.addSubscription(subscription);
    if (subscription instanceof DownloadableSubscription &&
        !subscription.lastDownload)
      synchronizer.execute(subscription);
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
        // Always show the first run page if a data corruption was detected
        // (either through failure of reading from or writing to storage.local).
        // The first run page notifies the user about the data corruption.
        let url;
        if (firstRun || dataCorrupted) {
          STATS.untilLoaded(function(userID)
          {
            browser.tabs.create({url: "https://getadblock.com/installed/?u=" + userID + "&lg=" + chrome.i18n.getUILanguage() + "&dc=" + dataCorrupted });
          });
        }
      }
    });
  }
}

Promise.all([
  filterNotifier.once("ready"),
  Prefs.untilLoaded.catch(() => { dataCorrupted = true; })
]).then(detectFirstRun)
  .then(getSubscriptions)
  .then(addSubscriptionsAndNotifyUser)
  // We have to require the "uninstall" module on demand,
  // as the "uninstall" module in turn requires this module.
  .then(() => { __webpack_require__(34).setUninstallURL(); })
  .then(() => initNotifications(firstRun));

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

// Exports for tests only
exports.chooseFilterSubscriptions = chooseFilterSubscriptions;


/***/ }),
/* 34 */
/***/ (function(module, exports, __webpack_require__) {

/** @module adblock-betafish/alias/uninstall */

const {filterStorage} = __webpack_require__(5);
const {STATS} = __webpack_require__(35);

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
          for (let subscription of filterStorage.subscriptions())
          {
            if (subscription.url === getUrlFromId("adblock_custom"))
            {
              return subscription._lastDownload;
            }
          }
          return null;
        };
        var updateUninstallURL = function()
        {
          chrome.storage.local.get("blockage_stats").then((data) =>
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
exports.setUninstallURL = uninstallInit;

/***/ }),
/* 35 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";
// Allows interaction with the server to track install rate
// and log messages.



/* For ESLint: List any global identifiers used in this file below */
/* global chrome, exports, require, log, getSettings, determineUserLanguage,
   replacedCounts, chromeStorageSetHelper, getAllSubscriptionsMinusText,
   checkPingResponseForProtect, License, channels */

const { Prefs } = __webpack_require__(2);
const { LocalCDN } = __webpack_require__(17);
const { SURVEY } = __webpack_require__(36);
const { recordGeneralMessage, recordErrorMessage } = __webpack_require__(14).ServerMessages;

const STATS = (function exportStats() {
  const userIDStorageKey = 'userid';
  const totalPingStorageKey = 'total_pings';
  const nextPingTimeStorageKey = 'next_ping_time';
  const statsUrl = 'https://ping.getadblock.com/stats/';
  const FiftyFiveMinutes = 3300000;
  let dataCorrupt = false;

  // Get some information about the version, os, and browser
  const { version } = chrome.runtime.getManifest();
  let match = navigator.userAgent.match(/(CrOS \w+|Windows NT|Mac OS X|Linux) ([\d._]+)?/);
  const os = (match || [])[1] || 'Unknown';
  const osVersion = (match || [])[2] || 'Unknown';
  let flavor = 'E'; // Chrome
  match = navigator.userAgent.match(/(?:Chrome|Version)\/([\d.]+)/);
  const edgeMatch = navigator.userAgent.match(/(?:Edg|Version)\/([\d.]+)/);
  if (edgeMatch) { // null in Chrome browsers
    flavor = 'CM'; // MS - Chromium Edge
    match = edgeMatch;
  }
  const browserVersion = (match || [])[1] || 'Unknown';

  const firstRun = false;

  let userID;

  // Inputs: key:string.
  // Returns value if key exists, else undefined.
  // Note: "_alt" is appended to the key to make it the key different
  // from the previous items stored in localstorage
  const storageGet = function (key) {
    const storageKey = `${key}_alt`;
    const store = localStorage;
    if (store === undefined) {
      return undefined;
    }
    const json = store.getItem(storageKey);
    if (json == null) {
      return undefined;
    }
    try {
      return JSON.parse(json);
    } catch (ex) {
      if (ex && ex.message) {
        recordErrorMessage('storage_get_error ', undefined, { errorMessage: ex.message });
      }
      return undefined;
    }
  };

  // Inputs: key:string, value:object.
  // Note: "_alt" is appended to the key to make it the key different
  // from the previous items stored in localstorage
  // If value === undefined, removes key from storage.
  // Returns undefined.
  const storageSet = function (key, value) {
    const storageKey = `${key}_alt`;
    const store = localStorage;

    if (value === undefined) {
      store.removeItem(storageKey);
      return;
    }
    try {
      store.setItem(storageKey, JSON.stringify(value));
    } catch (ex) {
      dataCorrupt = true;
    }
  };

  // Give the user a userid if they don't have one yet.
  function readUserIDPromisified() {
    return new Promise(
      ((resolve) => {
        chrome.storage.local.get(STATS.userIDStorageKey).then((response) => {
          const localuserid = storageGet(STATS.userIDStorageKey);
          if (!response[STATS.userIDStorageKey] && !localuserid) {
            STATS.firstRun = true;
            const timeSuffix = (Date.now()) % 1e8; // 8 digits from end of
            // timestamp
            const alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789';
            const result = [];
            for (let i = 0; i < 8; i++) {
              const choice = Math.floor(Math.random() * alphabet.length);
              result.push(alphabet[choice]);
            }
            userID = result.join('') + timeSuffix;
            // store in redundant locations
            chromeStorageSetHelper(STATS.userIDStorageKey, userID);
            storageSet(STATS.userIDStorageKey, userID);
          } else {
            userID = response[STATS.userIDStorageKey] || localuserid;
            if (!response[STATS.userIDStorageKey] && localuserid) {
              chromeStorageSetHelper(STATS.userIDStorageKey, userID);
            }
            if (response[STATS.userIDStorageKey] && !localuserid) {
              storageSet(STATS.userIDStorageKey, userID);
            }
          }
          resolve(userID);
        });
      }),
    );
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.command !== 'get_adblock_user_id') {
      return undefined;
    }
    readUserIDPromisified().then((resolvedUserID) => {
      sendResponse(resolvedUserID);
    });
    return true;
  });

  const getPingData = function (callbackFN) {
    if (!callbackFN && (typeof callbackFN !== 'function')) {
      return;
    }
    chrome.storage.local.get(STATS.totalPingStorageKey).then((response) => {
      const settingsObj = getSettings();
      const localTotalPings = storageGet(STATS.totalPingStorageKey);
      const totalPings = response[STATS.totalPingStorageKey] || localTotalPings || 0;
      const themeOptionsPage = settingsObj.color_themes.options_page.replace('_theme', '');
      const themePopupMenu = settingsObj.color_themes.popup_menu.replace('_theme', '');
      const data = {
        u: userID,
        v: version,
        f: flavor,
        o: os,
        bv: browserVersion,
        ov: osVersion,
        ad: settingsObj.show_advanced_options ? '1' : '0',
        yt: settingsObj.youtube_channel_whitelist ? '1' : '0',
        l: determineUserLanguage(),
        pc: totalPings,
        dcv2: settingsObj.data_collection_v2 ? '1' : '0',
        cdn: settingsObj.local_cdn ? '1' : '0',
        cdnr: LocalCDN.getRedirectCount(),
        cdnd: LocalCDN.getDataCount(),
        rc: replacedCounts.getTotalAdsReplaced(),
        to: themeOptionsPage,
        tm: themePopupMenu,
        sy: settingsObj.sync_settings ? '1' : '0',
        ir: channels.isAnyEnabled() ? '1' : '0',
        twh: settingsObj.twitch_hiding ? '1' : '0',
      };

      // only on Chrome or Edge
      if ((flavor === 'E' || flavor === 'CM') && Prefs.blocked_total) {
        data.b = Prefs.blocked_total;
      }
      if (chrome.runtime.id) {
        data.extid = chrome.runtime.id;
      }
      const subs = getAllSubscriptionsMinusText();
      if (subs) {
        const aa = subs.acceptable_ads;
        const aaPrivacy = subs.acceptable_ads_privacy;

        if (!aa && !aaPrivacy) {
          data.aa = 'u'; // Both filter lists unavailable
        } else if (aa.subscribed) {
          data.aa = '1';
        } else if (aaPrivacy.subscribed) {
          data.aa = '2';
        } else if (!aa.subscribed && !aaPrivacy.subscribed) {
          data.aa = '0'; // Both filter lists unsubscribed
        }
      }

      data.dc = dataCorrupt ? '1' : '0';
      SURVEY.types((res) => {
        data.st = res;
        callbackFN(data);
      });
    });
  };
  // Tell the server we exist.
  const pingNow = function () {
    const handlePingResponse = function (responseData) {
      SURVEY.maybeSurvey(responseData);
      checkPingResponseForProtect(responseData);
    };

    getPingData((data) => {
      const pingData = data;

      if (!pingData.u) {
        return;
      }
      // attempt to stop users that are pinging us 'alot'
      // by checking the current ping count,
      // if the ping count is above a theshold,
      // then only ping 'occasionally'
      if (pingData.pc > 5000) {
        if (pingData.pc > 5000 && pingData.pc < 100000 && ((pingData.pc % 5000) !== 0)) {
          return;
        }
        if (pingData.pc >= 100000 && ((pingData.pc % 50000) !== 0)) {
          return;
        }
      }
      pingData.cmd = 'ping';
      const ajaxOptions = {
        type: 'POST',
        url: statsUrl,
        data: pingData,
        success: handlePingResponse, // TODO: Remove when we no longer do a/b
        // tests
        error(e) {
          // eslint-disable-next-line no-console
          console.log('Ping returned error: ', e.status);
        },
      };

      if (chrome.management && chrome.management.getSelf) {
        chrome.management.getSelf((info) => {
          pingData.it = info.installType.charAt(0);
          $.ajax(ajaxOptions);
        });
      } else {
        $.ajax(ajaxOptions);
      }

      const missedVersions = LocalCDN.getMissedVersions();
      if (missedVersions) {
        recordGeneralMessage('cdn_miss_stats', undefined, { cdnm: missedVersions });
      }
    });
  };

  // Called just after we ping the server, to schedule our next ping.
  const scheduleNextPing = function () {
    chrome.storage.local.get(STATS.totalPingStorageKey).then((response) => {
      let localTotalPings = storageGet(totalPingStorageKey);
      if (typeof localTotalPings !== 'number' || Number.isNaN(localTotalPings)) {
        localTotalPings = 0;
      }
      let totalPings = response[STATS.totalPingStorageKey];
      if (typeof totalPings !== 'number' || Number.isNaN(totalPings)) {
        totalPings = 0;
      }
      totalPings = Math.max(localTotalPings, totalPings);
      totalPings += 1;
      // store in redundant locations
      chromeStorageSetHelper(STATS.totalPingStorageKey, totalPings);
      storageSet(STATS.totalPingStorageKey, totalPings);

      let delayHours;
      if (totalPings === 1) { // Ping one hour after install
        delayHours = 1;
      } else if (totalPings < 9) { // Then every day for a week
        delayHours = 24;
      } else { // Then weekly forever
        delayHours = 24 * 7;
      }

      const millis = 1000 * 60 * 60 * delayHours;
      const nextPingTime = Date.now() + millis;

      // store in redundant location
      chromeStorageSetHelper(STATS.nextPingTimeStorageKey, nextPingTime, (error) => {
        if (error) {
          dataCorrupt = true;
        } else {
          dataCorrupt = false;
        }
      });
      storageSet(STATS.nextPingTimeStorageKey, nextPingTime);
    });
  };

  // Return the number of milliseconds until the next scheduled ping.
  const millisTillNextPing = function (callbackFN) {
    if (!callbackFN || (typeof callbackFN !== 'function')) {
      return;
    }
    // If we've detected data corruption issues,
    // then default to a 55 minute ping interval
    if (dataCorrupt) {
      callbackFN(FiftyFiveMinutes);
      return;
    }
    // Wait 10 seconds to allow the previous 'set' to finish
    window.setTimeout(() => {
      chrome.storage.local.get(STATS.nextPingTimeStorageKey).then((response) => {
        let localNextPingTime = storageGet(STATS.nextPingTimeStorageKey);
        if (typeof localNextPingTime !== 'number' || Number.isNaN(localNextPingTime)) {
          localNextPingTime = 0;
        }
        let nextPingTimeStored = response[STATS.nextPingTimeStorageKey];
        if (typeof nextPingTimeStored !== 'number' || Number.isNaN(nextPingTimeStored)) {
          nextPingTimeStored = 0;
        }
        const nextPingTime = Math.max(localNextPingTime, nextPingTimeStored);
        // if this is the first time we've run (just installed), millisTillNextPing is 0
        if (nextPingTime === 0 && STATS.firstRun) {
          callbackFN(0);
          return;
        }
        // if we don't have a 'next ping time', or it's not a valid number,
        // default to 55 minute ping interval
        if (
          typeof nextPingTime !== 'number'
          || nextPingTime === 0
          || Number.isNaN(nextPingTime)
        ) {
          callbackFN(FiftyFiveMinutes);
          return;
        }
        callbackFN(nextPingTime - Date.now());
      }); // end of get
    }, 10000);
  };

  // Used to rate limit .message()s. Rate limits reset at startup.
  const throttle = {
    // A small initial amount in case the server is bogged down.
    // The server will tell us the correct amount.
    maxEventsPerHour: 3, // null if no limit
    // Called when attempting an event. If not rate limited, returns
    // true and records the event.
    attempt() {
      const now = Date.now();
      const oneHour = 1000 * 60 * 60;
      const times = this.eventTimes;
      const mph = this.maxEventsPerHour;
      // Discard old or irrelevant events
      while (times[0] && (times[0] + oneHour < now || mph === null)) {
        times.shift();
      }
      if (mph === null) {
        return true;
      } // no limit
      if (times.length >= mph) {
        return false;
      } // used our quota this hour
      times.push(now);
      return true;
    },
    eventTimes: [],
  };

  return {
    userIDStorageKey,
    totalPingStorageKey,
    nextPingTimeStorageKey,
    firstRun, // True if AdBlock was just installed.
    userId() {
      return userID;
    },
    version,
    flavor,
    browser: ({
      E: 'Chrome',
      CM: 'Edge',
    })[flavor],
    browserVersion,
    os,
    osVersion,
    pingNow,
    statsUrl,
    untilLoaded(callback) {
      readUserIDPromisified().then((resUserId) => {
        if (typeof callback === 'function') {
          callback(resUserId);
        }
      });
    },
    // Ping the server when necessary.
    startPinging() {
      function sleepThenPing() {
        millisTillNextPing((delay) => {
          window.setTimeout(() => {
            pingNow();
            scheduleNextPing();
            sleepThenPing();
          }, delay);
        });
      }

      readUserIDPromisified().then(() => {
        // Do 'stuff' when we're first installed...
        // - send a message
        chrome.storage.local.get(STATS.totalPingStorageKey).then((response) => {
          if (!response[STATS.totalPingStorageKey]) {
            if (chrome.management && chrome.management.getSelf) {
              chrome.management.getSelf((info) => {
                if (info) {
                  recordGeneralMessage(`new_install_${info.installType}`);
                } else {
                  recordGeneralMessage('new_install');
                }
              });
            } else {
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
    msg(message) {
      if (!throttle.attempt()) {
        log('Rate limited:', message);
        return;
      }
      const data = {
        cmd: 'msg2',
        m: message,
        u: userID,
        v: version,
        fr: firstRun,
        f: flavor,
        bv: browserVersion,
        o: os,
        ov: osVersion,
      };
      if (chrome.runtime.id) {
        data.extid = chrome.runtime.id;
      }
      $.ajax(statsUrl, {
        type: 'POST',
        data,
        complete(xhr) {
          let mph = parseInt(xhr.getResponseHeader('X-RateLimit-MPH'), 10);
          if (typeof mph !== 'number' || Number.isNaN(mph) || mph < -1) { // Server is sick
            mph = 1;
          }
          if (mph === -1) {
            mph = null;
          } // no rate limit
          throttle.maxEventsPerHour = mph;
        },
      });
    },
  };
}());

exports.STATS = STATS;


/***/ }),
/* 36 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


/* For ESLint: List any global identifiers used in this file below */
/* global chrome, require, exports, STATS, log, getSettings, Prefs, openTab, License */

// if the ping response indicates a survey (tab or overlay)
// gracefully processes the request
const stats = __webpack_require__(22);
const { recordGeneralMessage, recordErrorMessage } = __webpack_require__(14).ServerMessages;

const SURVEY = (function getSurvey() {
  // Only allow one survey per browser startup, to make sure users don't get
  // spammed due to bugs in AdBlock / the ping server / the browser.
  let surveyAllowed = true;
  let lastNotificationID = '';

  // Call |callback(tab)|, where |tab| is the active tab, or undefined if
  // there is no active tab.
  const getActiveTab = function (callback) {
    chrome.tabs.query({ active: true, currentWindow: true }).then((tabs) => {
      callback(tabs[0]);
    });
  };

  // True if we are willing to show an overlay on this tab.
  const validTab = function (tab) {
    if (tab.incognito || tab.status !== 'complete') {
      return false;
    }
    return /^http:/.test(tab.url);
  };

  const getBlockCountOnActiveTab = function (callback) {
    chrome.tabs.query(
      {
        active: true,
        lastFocusedWindow: true,
      },
    ).then((tabs) => {
      if (tabs.length === 0) {
        return;
      }
      const blockedPerPage = stats.getBlockedPerPage(tabs[0]);
      callback(blockedPerPage);
    });
  };

  // functions below are used by both Tab and Overlay Surveys

  // Double check that the survey should be shown
  // Inputs:
  //   surveyData: JSON survey information from ping server
  //   callback(): called with no arguments if the survey should be shown
  const shouldShowSurvey = function (surveyData, callback) {
    // Check if we should show survey only if it can actually be shown
    // based on surveyAllowed.
    if (surveyAllowed) {
      let data = { cmd: 'survey', u: STATS.userId(), sid: surveyData.survey_id };
      if (STATS.flavor === 'E' && Prefs.blocked_total) {
        data.b = Prefs.blocked_total;
      }
      $.post(STATS.statsUrl, data, (responseData) => {
        try {
          data = JSON.parse(responseData);
        } catch (e) {
          log('Error parsing JSON: ', responseData, ' Error: ', e);
        }
        if (data && data.should_survey === 'true' && surveyAllowed) {
          surveyAllowed = false;
          License.checkPingResponse(responseData);
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
  const surveyDataFrom = function (responseData) {
    let surveyData;

    if (responseData.length === 0 || responseData.trim().length === 0) {
      return null;
    }
    try {
      surveyData = JSON.parse(responseData);
      if (!surveyData) {
        return null;
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.log('Something went wrong with parsing survey data.');
      // eslint-disable-next-line no-console
      console.log('error', e);
      // eslint-disable-next-line no-console
      console.log('response data', responseData);
      return null;
    }
    return surveyData;
  };

  // create a Notification
  const processNotification = function (surveyDataParam) {
    let surveyData = surveyDataParam;

    // Check to see if we should show the survey before showing the overlay.
    const showNotificationIfAllowed = function () {
      shouldShowSurvey(surveyData, (updatedSurveyData) => {
        lastNotificationID = (Math.floor(Math.random() * 3000)).toString();
        if (updatedSurveyData) {
          const newSurveyData = surveyDataFrom(JSON.stringify(updatedSurveyData));
          if (newSurveyData.survey_id === surveyData.survey_id) {
            surveyData = newSurveyData;
          } else {
            recordGeneralMessage('survey_ids_do_not_match', undefined, {
              original_sid: surveyData.survey_id,
              updated_sid: newSurveyData.survey_id,
            });
            return;
          }
        }
        if (
          !surveyData.notification_options
          || !surveyData.notification_options.type
          || !surveyData.notification_options.message
          || !surveyData.notification_options.icon_url
          || typeof surveyData.notification_options.priority !== 'number'
          || Number.isNaN(surveyData.notification_options.priority)
        ) {
          recordGeneralMessage('invalid_survey_data', undefined, { sid: surveyData.survey_id });
          return;
        }
        const notificationOptions = {
          title: surveyData.notification_options.title,
          iconUrl: surveyData.notification_options.icon_url,
          type: surveyData.notification_options.type,
          priority: surveyData.notification_options.priority,
          message: surveyData.notification_options.message,
        };
        if (surveyData.notification_options.context_message) {
          const contextMessage = surveyData.notification_options.context_message;
          notificationOptions.contextMessage = contextMessage;
        }
        if (surveyData.notification_options.require_interaction) {
          const requireInteraction = surveyData.notification_options.require_interaction;
          notificationOptions.requireInteraction = requireInteraction;
        }
        if (surveyData.notification_options.is_clickable) {
          const isClickable = surveyData.notification_options.is_clickable;
          notificationOptions.isClickable = isClickable;
        }
        // click handler for notification
        const notificationClicked = function (notificationId) {
          chrome.notifications.onClicked.removeListener(notificationClicked);
          // Exceptions required since the errors cannot be resolved by changing
          // the order of function definitions. TODO: refactor to remove exceptions
          // eslint-disable-next-line no-use-before-define
          chrome.notifications.onButtonClicked.removeListener(buttonNotificationClicked);
          // eslint-disable-next-line no-use-before-define
          chrome.notifications.onClosed.removeListener(closedClicked);

          const clickedUrl = surveyData.notification_options.clicked_url;
          if (notificationId === lastNotificationID && clickedUrl) {
            recordGeneralMessage('notification_clicked', undefined, { sid: surveyData.survey_id });
            openTab(`https://getadblock.com/${surveyData.notification_options.clicked_url}`);
          } else {
            recordGeneralMessage('notification_clicked_no_URL_to_open', undefined, { sid: surveyData.survey_id });
          }
        };
        const buttonNotificationClicked = function (notificationId, buttonIndex) {
          chrome.notifications.onClicked.removeListener(notificationClicked);
          chrome.notifications.onButtonClicked.removeListener(buttonNotificationClicked);
          // Exception required since the error cannot be resolved by changing
          // the order of function definitions. TODO: refactor to remove exception
          // eslint-disable-next-line no-use-before-define
          chrome.notifications.onClosed.removeListener(closedClicked);
          if (surveyData.notification_options.buttons) {
            if (notificationId === lastNotificationID && buttonIndex === 0) {
              recordGeneralMessage('button_0_clicked', undefined, { sid: surveyData.survey_id });
              openTab(`https://getadblock.com/${surveyData.notification_options.buttons[0].clicked_url}`);
            }
            if (notificationId === lastNotificationID && buttonIndex === 1) {
              recordGeneralMessage('button_1_clicked', undefined, { sid: surveyData.survey_id });
              openTab(`https://getadblock.com/${surveyData.notification_options.buttons[1].clicked_url}`);
            }
          }
        };
        const closedClicked = function (notificationId, byUser) {
          chrome.notifications.onButtonClicked.removeListener(buttonNotificationClicked);
          chrome.notifications.onClicked.removeListener(notificationClicked);
          chrome.notifications.onClosed.removeListener(closedClicked);
          recordGeneralMessage('notification_closed', undefined, { sid: surveyData.survey_id, bu: byUser });
        };
        chrome.notifications.onClicked.removeListener(notificationClicked);
        chrome.notifications.onClicked.addListener(notificationClicked);
        if (surveyData.notification_options.buttons) {
          const buttonArray = [];
          if (surveyData.notification_options.buttons[0]) {
            buttonArray.push({
              title: surveyData.notification_options.buttons[0].title,
              iconUrl: surveyData.notification_options.buttons[0].icon_url,
            });
          }
          if (surveyData.notification_options.buttons[1]) {
            buttonArray.push({
              title: surveyData.notification_options.buttons[1].title,
              iconUrl: surveyData.notification_options.buttons[1].icon_url,
            });
          }
          notificationOptions.buttons = buttonArray;
        }
        chrome.notifications.onButtonClicked.removeListener(buttonNotificationClicked);
        chrome.notifications.onButtonClicked.addListener(buttonNotificationClicked);
        chrome.notifications.onClosed.addListener(closedClicked);
        // show the notification to the user.
        chrome.notifications.create(lastNotificationID, notificationOptions).then(() => {
          recordGeneralMessage('survey_shown', undefined, { sid: surveyData.survey_id });
        }).catch(() => {
          recordGeneralMessage('error_survey_not_shown', undefined, { sid: surveyData.survey_id });
          chrome.notifications.onButtonClicked.removeListener(buttonNotificationClicked);
          chrome.notifications.onClicked.removeListener(notificationClicked);
          chrome.notifications.onClosed.removeListener(closedClicked);
        });
      });
    };

    const retryInFiveMinutes = function () {
      const fiveMinutes = 5 * 60 * 1000;
      setTimeout(() => {
        processNotification(surveyData);
      }, fiveMinutes);
    };
    // check (again) if we still have permission to show a notification
    if (chrome && chrome.notifications && chrome.notifications.getPermissionLevel) {
      chrome.notifications.getPermissionLevel((permissionLevel) => {
        if (permissionLevel === 'granted') {
          if (typeof surveyData.block_count_limit !== 'number' || Number.isNaN(surveyData.block_count_limit)) {
            log('invalid block_count_limit', surveyData.block_count_limit);
            return;
          }
          surveyData.block_count_limit = Number(surveyData.block_count_limit);
          chrome.idle.queryState(60, (state) => {
            if (state === 'active') {
              getBlockCountOnActiveTab((blockedPerPage) => {
                if (blockedPerPage >= surveyData.block_count_limit) {
                  getActiveTab((tab) => {
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
  }; // end of processNotification()

  // open a Tab for a full page survey
  const processTab = function (surveyData) {
    const openTabIfAllowed = function () {
      setTimeout(() => {
        shouldShowSurvey(surveyData, (responseData) => {
          chrome.tabs.create({ url: `https://getadblock.com/${responseData.open_this_url}` });
        });
      }, 10000); // 10 seconds
    };

    const waitForUserAction = function () {
      chrome.tabs.onCreated.removeListener(waitForUserAction);
      openTabIfAllowed();
    };

    chrome.idle.queryState(60, (state) => {
      if (state === 'active') {
        openTabIfAllowed();
      } else {
        chrome.tabs.onCreated.removeListener(waitForUserAction);
        chrome.tabs.onCreated.addListener(waitForUserAction);
      }
    });
  }; // end of processTab()

  // Display a notification overlay on the active tab
  // To avoid security issues, the tab that is selected must not be incognito mode (Chrome only),
  // and must not be using SSL / HTTPS
  const processOverlay = function (surveyData) {
    // Check to see if we should show the survey before showing the overlay.
    const showOverlayIfAllowed = function (tab) {
      shouldShowSurvey(surveyData, () => {
        const data = { command: 'showoverlay', overlayURL: surveyData.open_this_url, tabURL: tab.url };
        const validateResponseFromTab = function (response) {
          if (!response || response.ack !== data.command) {
            recordErrorMessage('invalid_response_from_notification_overlay_script', undefined, { errorMessage: response });
          }
        };
        chrome.tabs.sendMessage(tab.id, data).then(validateResponseFromTab).catch((error) => {
          recordErrorMessage('overlay_message_error', undefined, { errorMessage: JSON.stringify(error) });
        });
      });
    };

    const retryInFiveMinutes = function () {
      const fiveMinutes = 5 * 60 * 1000;
      setTimeout(() => {
        processOverlay(surveyData);
      }, fiveMinutes);
    };

    getActiveTab((tab) => {
      if (tab && validTab(tab)) {
        showOverlayIfAllowed(tab);
      } else {
        // We didn't find an appropriate tab
        retryInFiveMinutes();
      }
    });
  }; // end of processOverlay()

  return {
    maybeSurvey(responseData) {
      if (getSettings().show_survey === false) {
        return;
      }

      const surveyData = surveyDataFrom(responseData);
      if (!surveyData) {
        return;
      }

      if (surveyData.type === 'overlay') {
        processOverlay(surveyData);
      } else if (surveyData.type === 'tab') {
        processTab(surveyData);
      } else if (surveyData.type === 'notification') {
        processNotification(surveyData);
      }
    }, // end of maybeSurvey
    types(callback) {
      // 'O' = Overlay Surveys
      // 'T' = Tab Surveys
      // 'N' = Notifications
      if (chrome
          && chrome.notifications
          && chrome.notifications.getPermissionLevel) {
        chrome.notifications.getPermissionLevel((permissionLevel) => {
          if (permissionLevel === 'granted') {
            callback('OTN');
          } else {
            callback('OT');
          }
        });
        return;
      }
      callback('OT');
    },
  };
}());

exports.SURVEY = SURVEY;


/***/ }),
/* 37 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


/* For ESLint: List any global identifiers used in this file below */
/* global chrome, require, exports, settings, getSettings, setSetting, License, STATS, channels,
   getSubscriptionsMinusText, chromeStorageSetHelper, getUserFilters, Prefs, abpPrefPropertyNames,
   Subscription, adblockIsDomainPaused, PubNub, adblockIsPaused, filterStorage, parseFilter,
   synchronizer, pausedFilterText1, pausedFilterText2, getUrlFromId, channelsNotifier,
   settingsNotifier, filterNotifier, isWhitelistFilter, */

const { EventEmitter } = __webpack_require__(6);

const SyncService = (function getSyncService() {
  let storedSyncDomainPauses = [];
  let syncCommitVersion = 0;
  let currentExtensionName = '';
  let pubnub;
  const syncSchemaVersion = 1;
  const syncCommitVersionKey = 'SyncCommitKey';
  const syncLogMessageKey = 'SyncLogMessageKey';
  const syncPreviousDataKey = 'SyncPreviousDataKey';
  const syncExtensionNameKey = 'SyncExtensionNameKey';
  const syncPendingPostDataKey = 'syncPendingPostDataKey';
  const syncNotifier = new EventEmitter();
  let lastPostStatusCode = 200;
  let pendingPostData = false;
  let lastGetStatusCode = 200;
  let lastGetErrorResponse = {};
  const debounceWaitTime = 3000; // time in ms before posting data

  function setCommitVersion(newVersionNum) {
    syncCommitVersion = newVersionNum;
  }

  function getLastPostStatusCode() {
    return lastPostStatusCode;
  }

  function resetLastPostStatusCode() {
    lastPostStatusCode = 200;
  }

  function setLastPostStatusCode(newCode) {
    lastPostStatusCode = newCode;
  }

  function getLastGetStatusCode() {
    return lastGetStatusCode;
  }

  function resetLastGetStatusCode() {
    lastGetStatusCode = 200;
  }

  function setLastGetStatusCode(newCode) {
    lastGetStatusCode = newCode;
  }

  function getLastGetErrorResponse() {
    return lastGetErrorResponse;
  }

  function resetLastGetErrorResponse() {
    lastGetErrorResponse = {};
  }

  function setLastGetErrorResponse(newObject) {
    lastGetErrorResponse = newObject;
  }

  const getCurrentExtensionName = function () {
    return currentExtensionName;
  };

  const getSyncLog = function () {
    const storedLog = JSON.parse(localStorage.getItem(syncLogMessageKey) || '[]');
    const theReturnObj = {};
    Object.assign(theReturnObj, storedLog);
    return theReturnObj;
  };

  // TODO - when should we delete the log file???
  const deleteSyncLog = function () {
    localStorage.removeItem(syncLogMessageKey);
  };

  function debounced(delay, fn) {
    let timerId;
    return function debouncedAgain(...args) {
      if (timerId) {
        clearTimeout(timerId);
      }
      timerId = setTimeout(() => {
        fn(...args);
        timerId = null;
      }, delay);
    };
  }

  // return meta data about the extension installation
  const getExtensionInfo = function () {
    return {
      flavor: STATS.flavor,
      browserVersion: STATS.browserVersion,
      os: STATS.os,
      osVersion: STATS.osVersion,
      extVersion: STATS.version,
      syncSchemaVersion,
    };
  };

  /*
  ** @param a, b        - values (Object, Date, etc.)
  ** @returns {boolean} - true if a and b are the same object or
  **                      same primitive value or
  **                      have the same properties with the same values
  **                      otherwise false
  */
  function objectComparison(a, b) {
    // Helper to return a value's internal object [[Class]]
    // That this returns [object Type] even for primitives
    function getClass(obj) {
      return Object.prototype.toString.call(obj);
    }

    // If a and b reference the same value, return true
    if (a === b) {
      return true;
    }

    // If a and b aren't the same type, return false
    if (typeof a !== typeof b) {
      return false;
    }

    // Already know types are the same, so if type is number
    // and both NaN, return true
    if (typeof a === 'number' && Number.isNaN(a) && Number.isNaN(b)) {
      return true;
    }

    // Get internal [[Class]]
    const aClass = getClass(a);
    const bClass = getClass(b);

    // Return false if not same class
    if (aClass !== bClass) {
      return false;
    }

    // If they're Boolean, String or Number objects, check values
    if (
      aClass === '[object Boolean]'
      || aClass === '[object String]'
      || aClass === '[object Number]'
    ) {
      if (a.valueOf() !== b.valueOf()) {
        return false;
      }
    }

    // If they're RegExps, Dates or Error objects, check stringified values
    if (aClass === '[object RegExp]' || aClass === '[object Date]' || aClass === '[object Error]') {
      if (a.toString() !== b.toString()) {
        return false;
      }
    }

    // For functions, check stringigied values are the same
    // Almost impossible to be equal if a and b aren't trivial
    // and are different functions
    if (aClass === '[object Function]' && a.toString() !== b.toString()) {
      return false;
    }

    // For all objects, (including Objects, Functions, Arrays and host objects),
    // check the properties
    const aKeys = Object.keys(a);
    const bKeys = Object.keys(b);

    // If they don't have the same number of keys, return false
    if (aKeys.length !== bKeys.length) {
      return false;
    }

    // Check they have the same keys
    if (!aKeys.every(key => Object.prototype.hasOwnProperty.call(b, key))) {
      return false;
    }

    // Check key values - uses ES5 Object.keys
    return aKeys.every(key => objectComparison(a[key], b[key]));
  }

  const isDomainPauseFilter = function (filterText) {
    if (isWhitelistFilter(filterText)) {
      const domains = adblockIsDomainPaused();
      for (const domain in domains) {
        if (`@@${domain}$document` === filterText) {
          return true;
        }
      }
    }
    return false;
  };

  const isPauseFilter = function (filterText) {
    return (
      isWhitelistFilter(filterText) && ((pausedFilterText1 === filterText)
      || (pausedFilterText2 === filterText))
    );
  };

  function getCommitVersion() {
    return syncCommitVersion;
  }

  // Sync log message processing

  const addSyncLogText = function (msg) {
    const storedLog = JSON.parse(localStorage.getItem(syncLogMessageKey) || '[]');
    storedLog.push(`${new Date().toUTCString()} , ${msg}`);
    while (storedLog.length > 500) { // only keep the last 500 log entries
      storedLog.shift();
    }
    localStorage.setItem(syncLogMessageKey, JSON.stringify(storedLog));
  };

  const onExtensionNamesDownloadingAddLogEntry = function () {
    addSyncLogText('extension.names.downloading');
  };

  const onExtensionNamesDownloadedAddLogEntry = function () {
    addSyncLogText('extension.names.downloaded');
  };

  const onExtensionNamesDownloadingErrorAddLogEntry = function (errorCode) {
    addSyncLogText(`extension.names.downloading.error: ${errorCode}`);
  };

  const onExtensionNameUpdatingAddLogEntry = function () {
    addSyncLogText('extension.name.updating');
  };

  const onExtensionNameUpdatedAddLogEntry = function () {
    addSyncLogText('extension.name.updated');
  };

  const onExtensionNameUpdatedErrorAddLogEntry = function (errorCode) {
    addSyncLogText(`extension.names.updated.error: ${errorCode}`);
  };

  const onExtensionNameRemoveAddLogEntry = function () {
    addSyncLogText('extension.name.remove');
  };

  const onExtensionNameRemovedAddLogEntry = function () {
    addSyncLogText('extension.name.removed');
  };

  const onExtensionNamesRemoveErrorAddLogEntry = function (errorCode) {
    addSyncLogText(`extension.name.remove.error: ${errorCode}`);
  };

  const onPostDataSendingAddLogEntry = function () {
    addSyncLogText('post.data.sending');
  };

  const onPostDataSentAddLogEntry = function () {
    addSyncLogText(`post.data.sent, commit version: ${getCommitVersion()}`);
  };

  const onPostDataSentErrorAddLogEntry = function (errorCode) {
    addSyncLogText(`post.data.sent.error: ${errorCode}`);
  };

  const onSyncDataGettingAddLogEntry = function () {
    addSyncLogText('sync.data.getting');
  };

  const onSyncDataReceievedAddLogEntry = function () {
    addSyncLogText(`sync.data.receieved, commit version: ${getCommitVersion()}`);
  };

  const onSyncDataGettingErrorAddLogEntry = function (errorCode) {
    addSyncLogText(`sync.data.getting.error: ${errorCode}`);
  };

  const onSyncDataGettingErrorInitialFailAddLogEntry = function (errorCode) {
    addSyncLogText(`sync.data.getting.error.initial.fail: ${errorCode}`);
  };

  function cleanCustomFilter(filters) {
    // Remove the global pause white-list item if adblock is paused
    if (adblockIsPaused()) {
      let index = filters.indexOf(pausedFilterText1);
      if (index >= 0) {
        filters.splice(index, 1);
      }
      index = filters.indexOf(pausedFilterText2);
      if (index >= 0) {
        filters.splice(index, 1);
      }
    }

    // Remove the domain pause white-list items
    const domainPauses = adblockIsDomainPaused();
    for (const aDomain in domainPauses) {
      const index = filters.indexOf(`@@${aDomain}$document`);
      if (index >= 0) {
        filters.splice(index, 1);
      }
    }
    return filters;
  }

  const processSyncUpdate = function (payload) {
    // do we need a check or comparison of payload.version vs. syncSchemaVersion ?
    if (payload.settings) {
      const keywords = Object.keys(payload.settings);
      // Use a Promise to wait until the previous 'set' is complete because
      // calling 'setSetting' several times in a row in a loop prevents some
      // settings from being saved to storage
      for (let inx = 0, p = Promise.resolve(); inx < keywords.length; inx++) {
        const id = keywords[inx];
        p = p.then(() => new Promise((resolve) => {
          setSetting(id, payload.settings[id], () => {
            resolve();
          });
        }));
      }
    }
    if (payload.subscriptions) {
      const currentSubs = getSubscriptionsMinusText();
      for (const id in currentSubs) {
        if (!payload.subscriptions[id] && currentSubs[id].subscribed) {
          const subscription = Subscription.fromURL(currentSubs[id].url);
          setTimeout(() => {
            filterStorage.removeSubscription(subscription);
          }, 1);
        }
      }
      for (const id in payload.subscriptions) {
        if (!currentSubs[id] || !currentSubs[id].subscribed) {
          let url = getUrlFromId(id);
          let subscription = Subscription.fromURL(url);
          if (!url && id.startsWith('url:')) {
            url = id.slice(4);
            subscription = Subscription.fromURL(url);
          }
          filterStorage.addSubscription(subscription);
          synchronizer.execute(subscription);
        }
      }
    }

    if (payload.customFilterRules) {
      // capture, then remove all current custom filters, account for pause filters in
      // current processing
      let currentUserFilters = getUserFilters();
      for (const inx in payload.customFilterRules) {
        const result = parseFilter(payload.customFilterRules[inx]);
        if (result.filter) {
          filterStorage.addFilter(result.filter);
        }
      }
      if (currentUserFilters && currentUserFilters.length) {
        currentUserFilters = cleanCustomFilter(currentUserFilters);
        // Delete / remove filters the user removed...
        if (currentUserFilters) {
          for (let i = 0; (i < currentUserFilters.length); i++) {
            let filter = currentUserFilters[i];
            if (payload.customFilterRules.indexOf(filter) === -1) {
              filter = filter.trim();
              if (filter.length > 0) {
                const result = parseFilter(filter);
                if (result.filter) {
                  filterStorage.removeFilter(result.filter);
                }
              }
            }
          }
        }
      }
    }
    if (payload.prefs) {
      for (const key in payload.prefs) {
        Prefs[key] = payload.prefs[key];
        // add any new Prefs to the array of Preferences we're tracking for sync
        if (abpPrefPropertyNames.indexOf(key) < 0) {
          abpPrefPropertyNames.push(key);
        }
      }
    }
    if (payload.channels) {
      for (const name in payload.channels) {
        const channelId = channels.getIdByName(name);
        if (channelId) {
          channels.setEnabled(channelId, payload.channels[name]);
        } else {
          // create a new channel to save the channel name and the enabled indicator
          channels.add({ name, param: undefined, enabled: payload.channels[name] });
        }
      }
    }
  };

  // Retreive or 'get' the sync data from the sync server
  // Input: initialGet:boolean - if true, and the server returns a 404 error code,
  //                             then a 'post' is invoked
  //        disableEmitMsg:boolean - if true, then no sync notifier message will be emitted
  //                                 (usually used for post error processing)
  //        callback:function - function that will be called when success or failure occurs
  //        shouldForce:boolean - optional, force a response from the server (even if the commit
  //                              versions match), defaults to false
  const getSyncData = function (initialGet, disableEmitMsg, callback, shouldForce) {
    const getSuccess = function (text, statusCode) {
      let responseObj = {};
      if (text && typeof text === 'object') {
        responseObj = text;
      } else if (text && typeof text === 'string') {
        try {
          responseObj = JSON.parse(text);
        } catch (e) {
          // eslint-disable-next-line no-console
          console.log('Something went wrong with parsing license data.');
          // eslint-disable-next-line no-console
          console.log('error', e);
          // eslint-disable-next-line no-console
          console.log(text);
          return;
        }
      }
      if (responseObj && ((responseObj.commitVersion > syncCommitVersion) || shouldForce)) {
        if (responseObj.data) {
          try {
            processSyncUpdate(JSON.parse(responseObj.data));
          } catch (e) {
            // eslint-disable-next-line no-console
            console.log('failed to parse response data from server', responseObj.data);
            // eslint-disable-next-line no-console
            console.log(e);
          }
        }
        syncCommitVersion = responseObj.commitVersion;
        chromeStorageSetHelper(syncCommitVersionKey, responseObj.commitVersion);
        chromeStorageSetHelper(syncPreviousDataKey, responseObj.data);
        pendingPostData = false; // reset in case an update is received from another extension
        chromeStorageSetHelper(syncPendingPostDataKey, pendingPostData);
      }
      if (!disableEmitMsg) {
        syncNotifier.emit('sync.data.receieved');
      }
      if (typeof callback === 'function') {
        callback(statusCode);
      }
    };

    const getFailure = function (statusCode, textStatus, errorThrown, responseJSON) {
      lastGetStatusCode = statusCode;
      lastGetErrorResponse = responseJSON;
      if (initialGet && statusCode === 404) {
        // eslint-disable-next-line no-use-before-define
        postDataSync(callback, initialGet);
        // now that the initial post is complete, enable Sync (add listeners, etc.)
        // with 'initialGet' now set to false
        // eslint-disable-next-line no-use-before-define
        enableSync();
        return;
      }
      if (initialGet && !disableEmitMsg) {
        syncNotifier.emit('sync.data.getting.error.initial.fail', statusCode);
      } else if (!disableEmitMsg) {
        syncNotifier.emit('sync.data.getting.error', statusCode, responseJSON);
      }
      if (typeof callback === 'function') {
        callback(statusCode);
      }
    };

    if (!disableEmitMsg) {
      syncNotifier.emit('sync.data.getting');
    }
    lastGetStatusCode = 200;
    lastGetErrorResponse = {};
    // eslint-disable-next-line no-use-before-define
    requestSyncData(getSuccess, getFailure, undefined, shouldForce);
  };

  const getAllExtensionNames = function (callback) {
    syncNotifier.emit('extension.names.downloading');
    $.ajax({
      jsonp: false,
      cache: false,
      headers: {
        'X-GABSYNC-PARAMS': JSON.stringify({
          extensionGUID: STATS.userId(),
          licenseId: License.get().licenseId,
          extInfo: getExtensionInfo(),
        }),
      },
      url: `${License.MAB_CONFIG.syncURL}/devices/list`,
      type: 'GET',
      success(text) {
        let responseObj = {};
        if (typeof text === 'object') {
          responseObj = text;
        } else if (typeof text === 'string') {
          try {
            responseObj = JSON.parse(text);
          } catch (e) {
            // eslint-disable-next-line no-console
            console.log('Something went wrong with parsing license data.');
            // eslint-disable-next-line no-console
            console.log('error', e);
            // eslint-disable-next-line no-console
            console.log(text);
            return;
          }
        }
        syncNotifier.emit('extension.names.downloaded', responseObj);
        if (typeof callback === 'function') {
          callback(responseObj);
        }
      },
      error(xhr) {
        if (xhr.status === 404 && typeof callback === 'function' && xhr.responseText) {
          callback(xhr.responseText);
        }
        syncNotifier.emit('extension.names.downloading.error', xhr.status);
      },
    });
  };

  const setCurrentExtensionName = function (newName) {
    if (newName && newName.trim().length >= 1 && newName.trim().length <= 50) {
      currentExtensionName = newName.trim();
      chromeStorageSetHelper(syncExtensionNameKey, currentExtensionName);
      const thedata = {
        deviceName: currentExtensionName,
        extensionGUID: STATS.userId(),
        licenseId: License.get().licenseId,
        extInfo: getExtensionInfo(),
      };
      syncNotifier.emit('extension.name.updating');
      $.ajax({
        jsonp: false,
        url: `${License.MAB_CONFIG.syncURL}/devices/add`,
        type: 'post',
        success() {
          syncNotifier.emit('extension.name.updated');
        },
        error(xhr) {
          syncNotifier.emit('extension.name.updated.error', xhr.status);
        },
        data: thedata,
      });
    }
  };

  const removeCurrentExtensionName = function () {
    const thedata = {
      deviceName: currentExtensionName,
      extensionGUID: STATS.userId(),
      licenseId: License.get().licenseId,
      extInfo: getExtensionInfo(),
    };
    syncNotifier.emit('extension.name.remove');
    $.ajax({
      jsonp: false,
      url: `${License.MAB_CONFIG.syncURL}/devices/remove`,
      type: 'post',
      success() {
        currentExtensionName = '';
        chromeStorageSetHelper(syncExtensionNameKey, currentExtensionName);
        syncNotifier.emit('extension.name.removed');
      },
      error(xhr) {
        syncNotifier.emit('extension.name.remove.error', xhr.status);
      },
      data: thedata,
    });
  };

  // return all of the current user configurable extension options (settings, Prefs, filter list
  // sub, custom rules, themes, etc. Since a comparison will be done in this, and other sync'd
  // extensions, the payload should only contain settings, Prefs, etc and not data that can change
  // from browser to brower, version to version, etc.
  const getSyncInformation = function () {
    const payload = {};
    payload.settings = getSettings();
    payload.subscriptions = {};
    const subscriptions = getSubscriptionsMinusText();

    for (const id in subscriptions) {
      if (subscriptions[id].subscribed && subscriptions[id].url) {
        payload.subscriptions[id] = subscriptions[id].url;
      }
    }
    payload.customFilterRules = cleanCustomFilter(getUserFilters());
    payload.prefs = {};
    for (const inx in abpPrefPropertyNames) {
      const name = abpPrefPropertyNames[inx];
      payload.prefs[name] = Prefs[name];
    }
    payload.channels = {};
    const guide = channels.getGuide();
    for (const id in guide) {
      payload.channels[guide[id].name] = guide[id].enabled;
    }
    return payload;
  };

  const postDataSync = function (callback, initialGet) {
    if (!getSettings().sync_settings) {
      return;
    }
    const payload = getSyncInformation();
    const thedata = {
      data: JSON.stringify(payload),
      commitVersion: syncCommitVersion,
      extensionGUID: STATS.userId(),
      licenseId: License.get().licenseId,
      extInfo: getExtensionInfo(),
    };

    chrome.storage.local.get(syncPreviousDataKey).then((response) => {
      const previousData = response[syncPreviousDataKey] || '{}';
      if (objectComparison(payload, JSON.parse(previousData))) {
        return;
      }
      syncNotifier.emit('post.data.sending');
      lastPostStatusCode = 200;
      pendingPostData = false;
      chromeStorageSetHelper(syncPendingPostDataKey, pendingPostData);
      $.ajax({
        jsonp: false,
        url: License.MAB_CONFIG.syncURL,
        type: 'post',
        success(text, status, xhr) {
          lastPostStatusCode = xhr.status;
          let responseObj = {};
          if (typeof text === 'object') {
            responseObj = text;
          } else if (typeof text === 'string') {
            try {
              responseObj = JSON.parse(text);
            } catch (e) {
              // eslint-disable-next-line no-console
              console.log('Something went wrong with parsing license data.');
              // eslint-disable-next-line no-console
              console.log('error', e);
              // eslint-disable-next-line no-console
              console.log(text);
              return;
            }
          }
          if (responseObj && responseObj.commitVersion > syncCommitVersion) {
            syncCommitVersion = text.commitVersion;
            chromeStorageSetHelper(syncCommitVersionKey, responseObj.commitVersion);
          }
          chromeStorageSetHelper(syncPreviousDataKey, thedata.data);
          if (typeof callback === 'function') {
            callback();
          }
          syncNotifier.emit('post.data.sent');
        },
        error(xhr) {
          syncNotifier.emit('post.data.sent.error', xhr.status, initialGet);
          lastPostStatusCode = xhr.status;
          if (xhr.status === 409) {
            // this extension probably had an version of the sync data
            // aka - the sync commit version was behind the sync server
            // so, undo / revert all of the user changes that were just posted
            // by doing a 'GET'
            // because we want the above error to be persisted, will set the
            // 'disableEmitMsg' to true
            getSyncData(false, true);
            return;
          }
          // all other currently known errors (0, 401, 404, 500).
          pendingPostData = true;
          chromeStorageSetHelper(syncPendingPostDataKey, pendingPostData);
        },
        data: thedata,
      });
    });
  };

  const processUserSyncRequest = function () {
    if (pendingPostData) {
      postDataSync();
    } else {
      getSyncData(false, false, undefined, true);
    }
  };

  const processEventChangeRequest = function () {
    if (pendingPostData) {
      postDataSync();
    } else {
      getSyncData();
    }
  };

  const postDataSyncHandler = debounced(debounceWaitTime, postDataSync);

  // Sync Listeners
  function onFilterAdded(filter, subscription, position, calledPreviously) {
    // a delay is added to allow the domain pause filters time to be saved to storage
    // otherwise the domain pause filter check below would always fail
    if (calledPreviously === undefined) {
      setTimeout(() => {
        onFilterAdded(filter, subscription, position, true);
      }, 500);
      return;
    }
    if (isPauseFilter(filter.text)) {
      return;
    }
    if (isDomainPauseFilter(filter.text)) {
      storedSyncDomainPauses.push(filter.text);
      return;
    }
    postDataSyncHandler();
  }

  function onFilterRemoved(filter) {
    if (isPauseFilter(filter.text)) {
      return;
    }
    if (isDomainPauseFilter(filter.text)) {
      const filterTextIndex = storedSyncDomainPauses.indexOf(filter.text);
      storedSyncDomainPauses = storedSyncDomainPauses.slice(filterTextIndex);
      return;
    }
    postDataSyncHandler();
  }

  // a delay is added to allow the domain pause filters time to be saved to storage
  // otherwise the domain pause filter check below would always fail
  const onFilterListsSubAdded = function (sub, calledPreviously) {
    if (calledPreviously === undefined) {
      setTimeout(() => {
        onFilterListsSubAdded(sub, true);
      }, 500);
      return;
    }
    let containsPauseFilter = false;
    if (sub.url && sub.url.startsWith('~user~') && sub._filterText.length) {
      const arrayLength = sub._filterText.length;
      for (let i = 0; i < arrayLength; i++) {
        const filter = sub._filterText[i];
        containsPauseFilter = isPauseFilter(filter);
        if (!containsPauseFilter && isDomainPauseFilter(filter)) {
          containsPauseFilter = true;
          storedSyncDomainPauses.push(filter.text);
        }
      }
    }
    if (containsPauseFilter) {
      return;
    }
    postDataSyncHandler();
  };

  const onFilterListsSubRemoved = function (sub) {
    let containsPauseFilter = false;
    if (sub.url && sub.url.startsWith('~user~') && sub._filterText.length) {
      const arrayLength = sub._filterText.length;
      for (let i = 0; i < arrayLength; i++) {
        const filter = sub._filterText[i];
        containsPauseFilter = isPauseFilter(filter);
        if (!containsPauseFilter && isDomainPauseFilter(filter.text)) {
          containsPauseFilter = true;
          const filterTextIndex = storedSyncDomainPauses.indexOf(filter.text);
          storedSyncDomainPauses = storedSyncDomainPauses.slice(filterTextIndex);
          return;
        }
      }
    }
    if (containsPauseFilter) {
      return;
    }
    postDataSyncHandler();
  };

  const onSettingsChanged = function (name) {
    if (name === 'sync_settings') {
      return; // don't process any sync setting changes
    }
    postDataSyncHandler();
  };

  const updateNetworkStatus = function () {
    if (navigator.onLine) {
      processEventChangeRequest();
    }
  };

  function processFetchRequest(commitVersion) {
    let fetchCommitVersion = commitVersion;
    if (!fetchCommitVersion) {
      return;
    }
    if (typeof fetchCommitVersion === 'string') {
      fetchCommitVersion = Number.parseInt(fetchCommitVersion, 10);
    }
    if (fetchCommitVersion === syncCommitVersion) {
      return;
    }
    getSyncData();
  }

  function enablePubNub() {
    pubnub = new PubNub({
      subscribeKey: License.MAB_CONFIG.subscribeKey,
      authKey: `${License.get().licenseId}_${STATS.userId()}`,
      ssl: true,
    });

    pubnub.addListener({
      message(response) {
        if (response.message && response.message && response.message.commitVersion) {
          processFetchRequest(response.message.commitVersion);
        }
      },
      status(msg) {
        if (msg.category === 'PNNetworkUpCategory') {
          pubnub.subscribe({
            channels: [License.get().licenseId],
          });
        }
      },
    });

    pubnub.subscribe({
      channels: [License.get().licenseId],
    });
  }

  const enableSync = function (initialGet) {
    setSetting('sync_settings', true);
    const addListeners = function () {
      syncNotifier.on('sync.data.getting.error', onSyncDataGettingErrorAddLogEntry);
      syncNotifier.on('sync.data.getting.error.initial.fail', onSyncDataGettingErrorInitialFailAddLogEntry);
      syncNotifier.on('extension.names.downloading', onExtensionNamesDownloadingAddLogEntry);
      syncNotifier.on('sync.data.receieved', onSyncDataReceievedAddLogEntry);
      syncNotifier.on('sync.data.getting', onSyncDataGettingAddLogEntry);
      syncNotifier.on('post.data.sent.error', onPostDataSentErrorAddLogEntry);
      syncNotifier.on('post.data.sending', onPostDataSendingAddLogEntry);
      syncNotifier.on('post.data.sent', onPostDataSentAddLogEntry);
      syncNotifier.on('extension.name.remove.error', onExtensionNamesRemoveErrorAddLogEntry);
      syncNotifier.on('extension.name.removed', onExtensionNameRemovedAddLogEntry);
      syncNotifier.on('extension.name.remove', onExtensionNameRemoveAddLogEntry);
      syncNotifier.on('extension.name.updated.error', onExtensionNameUpdatedErrorAddLogEntry);
      syncNotifier.on('extension.name.updated', onExtensionNameUpdatedAddLogEntry);
      syncNotifier.on('extension.name.updating', onExtensionNameUpdatingAddLogEntry);
      syncNotifier.on('extension.names.downloaded', onExtensionNamesDownloadedAddLogEntry);
      syncNotifier.on('extension.names.downloading.error', onExtensionNamesDownloadingErrorAddLogEntry);

      filterNotifier.on('subscription.removed', onFilterListsSubRemoved);
      filterNotifier.on('subscription.added', onFilterListsSubAdded);

      filterNotifier.on('filter.added', onFilterAdded);
      filterNotifier.on('filter.removed', onFilterRemoved);

      settingsNotifier.on('settings.changed', onSettingsChanged);
      channelsNotifier.on('channels.changed', postDataSyncHandler);

      for (const inx in abpPrefPropertyNames) {
        const name = abpPrefPropertyNames[inx];
        Prefs.on(name, postDataSyncHandler);
      }
      // wait a moment at start to allow all of the backgound scripts to load
      setTimeout(() => {
        enablePubNub();
      }, 1000);

      window.addEventListener('online', updateNetworkStatus);
      window.addEventListener('offline', updateNetworkStatus);
    };

    if (initialGet) {
      SyncService.getSyncData(initialGet, false, (response) => {
        if (response === 200 || response === 304) {
          addListeners();
        }
      });
      return;
    }

    addListeners();
  };

  function disablePubNub() {
    if (!pubnub) {
      return;
    }

    pubnub.removeAllListeners();
    pubnub.unsubscribeAll();
    pubnub = undefined;
  }

  const disableSync = function () {
    setSetting('sync_settings', false);
    syncCommitVersion = 0;
    disablePubNub();

    filterNotifier.off('subscription.added', onFilterListsSubAdded);
    filterNotifier.off('subscription.removed', onFilterListsSubRemoved);

    filterNotifier.off('filter.added', onFilterAdded);
    filterNotifier.off('filter.removed', onFilterRemoved);

    settingsNotifier.off('settings.changed', onSettingsChanged);
    channelsNotifier.off('channels.changed', postDataSyncHandler);

    for (const inx in abpPrefPropertyNames) {
      const name = abpPrefPropertyNames[inx];
      Prefs.off(name, postDataSyncHandler);
    }

    storedSyncDomainPauses = [];
    removeCurrentExtensionName();

    currentExtensionName = '';
    chromeStorageSetHelper(syncExtensionNameKey, currentExtensionName);

    syncNotifier.off('sync.data.getting.error', onSyncDataGettingErrorAddLogEntry);
    syncNotifier.off('sync.data.getting.error.initial.fail', onSyncDataGettingErrorInitialFailAddLogEntry);
    syncNotifier.off('extension.names.downloading', onExtensionNamesDownloadingAddLogEntry);
    syncNotifier.off('sync.data.receieved', onSyncDataReceievedAddLogEntry);
    syncNotifier.off('sync.data.getting', onSyncDataGettingAddLogEntry);
    syncNotifier.off('post.data.sent.error', onPostDataSentErrorAddLogEntry);
    syncNotifier.off('post.data.sending', onPostDataSendingAddLogEntry);
    syncNotifier.off('post.data.sent', onPostDataSentAddLogEntry);
    syncNotifier.off('extension.name.remove.error', onExtensionNamesRemoveErrorAddLogEntry);
    syncNotifier.off('extension.name.removed', onExtensionNameRemovedAddLogEntry);
    syncNotifier.off('extension.name.remove', onExtensionNameRemoveAddLogEntry);
    syncNotifier.off('extension.name.updated.error', onExtensionNameUpdatedErrorAddLogEntry);
    syncNotifier.off('extension.name.updated', onExtensionNameUpdatedAddLogEntry);
    syncNotifier.off('extension.name.updating', onExtensionNameUpdatingAddLogEntry);
    syncNotifier.off('extension.names.downloaded', onExtensionNamesDownloadedAddLogEntry);
    syncNotifier.off('extension.names.downloading.error', onExtensionNamesDownloadingErrorAddLogEntry);

    window.removeEventListener('online', updateNetworkStatus);
    window.removeEventListener('offline', updateNetworkStatus);
  };

  // Retreive the sync data from the sync server
  // Input: successCallback:function - function that will be called when success occurs, the
  //                                   callback will be provided the response data
  //        errorCallback:function - function that will be called when  failure occurs, the
  //                                 callback will be provided the error code
  //        totalAttempts:integer - the number of 'get' attempts made (only used internally by
  //                               the retry logic)
  //        shouldForce:boolean - optional, force a response from the server (even if the commit
  //                              versions match), defaults to false
  const requestSyncData = function (successCallback, errorCallback, totalAttempts, shouldForce) {
    let attemptCount = totalAttempts;
    if (!attemptCount) {
      attemptCount = 1;
    } else {
      attemptCount += 1;
    }
    const forceParam = shouldForce || false;

    $.ajax({
      jsonp: false,
      cache: false,
      headers: {
        'X-GABSYNC-PARAMS': JSON.stringify({
          extensionGUID: STATS.userId(),
          licenseId: License.get().licenseId,
          commitVersion: syncCommitVersion,
          force: forceParam,
          extInfo: getExtensionInfo(),
        }),
      },
      url: License.MAB_CONFIG.syncURL,
      type: 'GET',
      success(text, textStatus, xhr) {
        if (typeof successCallback === 'function') {
          successCallback(text, xhr.status);
        }
      },
      error(xhr, textStatus, errorThrown) {
        if (xhr.status !== 404 && attemptCount < 3) {
          setTimeout(() => {
            requestSyncData(successCallback, errorCallback, attemptCount, shouldForce);
          }, 1000); // wait 1 second for retry
          return;
        }
        if (typeof errorCallback === 'function') {
          errorCallback(xhr.status, textStatus, errorThrown, xhr.responseJSON);
        }
      },
    });
  };

  settings.onload().then(() => {
    if (getSettings().sync_settings) {
      License.ready().then(() => {
        chrome.storage.local.get(syncCommitVersionKey).then((response) => {
          syncCommitVersion = response[syncCommitVersionKey] || 0;
          chrome.storage.local.get(syncPendingPostDataKey).then((postDataResponse) => {
            pendingPostData = postDataResponse[syncPendingPostDataKey] || false;
            processEventChangeRequest();
            enableSync();
          });
        });
      });
    }
    License.ready().then(() => {
      chrome.storage.local.get(syncExtensionNameKey).then((response) => {
        currentExtensionName = response[syncExtensionNameKey] || '';
      });
    });
  });

  return {
    enableSync,
    disableSync,
    getSyncData,
    processFetchRequest,
    getCurrentExtensionName,
    getAllExtensionNames,
    setCurrentExtensionName,
    removeCurrentExtensionName,
    syncNotifier,
    getCommitVersion,
    setCommitVersion,
    getLastPostStatusCode,
    resetLastPostStatusCode,
    setLastPostStatusCode,
    getLastGetStatusCode,
    resetLastGetStatusCode,
    setLastGetStatusCode,
    getLastGetErrorResponse,
    resetLastGetErrorResponse,
    setLastGetErrorResponse,
    getSyncLog,
    deleteSyncLog,
    processUserSyncRequest,
    processEventChangeRequest,
  };
}());

exports.SyncService = SyncService;


/***/ }),
/* 38 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


/* For ESLint: List any global identifiers used in this file below */
/* global chrome, require, exports, parseFilter, chromeStorageSetHelper */

// Module for removing individual filters from filter lists
// An 'advance' feature, used on the Customize tab, titled "disabled filters"

const { filterNotifier } = __webpack_require__(1);
const { filterStorage } = __webpack_require__(5);

const ExcludeFilter = (function excludeFilter() {
  const ABRemoveFilter = function (filter) {
    for (const currentSubscription of filterStorage.subscriptions()) {
      const positions = [];
      let index = -1;
      do {
        index = currentSubscription.findFilterIndex(filter, index + 1);
        if (index >= 0) {
          positions.push(index);
        }
      } while (index >= 0);

      for (let j = positions.length - 1; j >= 0; j--) {
        const currentPosition = positions[j];
        const currentFilter = currentSubscription.filterTextAt(currentPosition);
        if (currentFilter === filter.text) {
          currentSubscription.deleteFilterAt(currentPosition);
          filterNotifier.emit('filter.removed', filter, currentSubscription,
            currentPosition);
        }
      }
    }


    for (const subscription of filterStorage.subscriptions()) {
      const positions = [];
      let index = -1;
      do {
        index = subscription._filterText.indexOf(filter, index + 1);
        if (index >= 0) {
          positions.push(index);
        }
      }
      while (index >= 0);

      for (let j = positions.length - 1; j >= 0; j--) {
        const position = positions[j];
        if (subscription._filterText[position] === filter) {
          subscription._filterText.splice(position, 1);
          if (subscription._filterText.indexOf(filter) < 0) {
            index = filter._subscriptions.indexOf(subscription);
            if (index >= 0) {
              filter._subscriptions.splice(index, 1);
            }
          }
          filterNotifier.emit('filter.removed', filter, subscription, position);
        }
      }
    }
  };

  // Removes the valid filters from any / all filter lists and
  // saves the valid entries
  // Note:  any invalid filters are ignored
  // Inputs: filters:string the new filters.
  const setExcludeFilters = function (filtersToExclude) {
    const excludeFilters = filtersToExclude.trim();
    const excludeFiltersArray = excludeFilters.split('\n');
    const validExcludeFiltersArray = [];
    for (let i = 0; i < excludeFiltersArray.length; i++) {
      let filter = excludeFiltersArray[i];
      filter = filter.trim();
      if (filter.length > 0) {
        const result = parseFilter(filter);
        if (result.filter) {
          validExcludeFiltersArray.push(result.filter);
          ABRemoveFilter(result.filter);
        }
      }
    }

    if (validExcludeFiltersArray.length > 0) {
      chromeStorageSetHelper('exclude_filters', validExcludeFiltersArray.join('\n'));
    } else {
      chrome.storage.local.remove('exclude_filters');
    }
  };

  function excludeFilterChangeListener() {
    const excludeFiltersKey = 'exclude_filters';
    chrome.storage.local.get(excludeFiltersKey).then((response) => {
      if (response[excludeFiltersKey]) {
        const excludeFiltersArray = response[excludeFiltersKey].split('\n');
        for (let i = 0; i < excludeFiltersArray.length; i++) {
          const filter = excludeFiltersArray[i];
          if (filter.length > 0) {
            const result = parseFilter(filter);
            if (result.filter) {
              ABRemoveFilter(result.filter);
            }
          }
        }
      } else {
        filterNotifier.off('save', excludeFilterChangeListener);
      }
    });
  }

  // At startup, add a listener to so that the exclude filters
  // can be removed if the filter lists are updated
  filterNotifier.on('save', excludeFilterChangeListener);

  return {
    setExcludeFilters,
  };
}());

exports.ExcludeFilter = ExcludeFilter;


/***/ }),
/* 39 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


/* For ESLint: List any global identifiers used in this file below */
/* global exports:true */

// Used by both channels.js and picreplacement.js
// Since this file is conditional loaded, and not part of the content script web pack,
// 'exports' may not be defined, so we use this hack
if (false) {
  const overrideExports = {};
  window.exports = overrideExports;
}

const imageSizesMap = new Map([
  ['NONE', 0],
  ['wide', 1],
  ['tall', 2],
  ['skinnywide', 4],
  ['skinnytall', 8],
  ['big', 16],
  ['small', 32],
]);

exports.imageSizesMap = imageSizesMap;
exports.WIDE = imageSizesMap.get('wide');
exports.TALL = imageSizesMap.get('tall');
exports.BIG = imageSizesMap.get('big');
exports.SMALL = imageSizesMap.get('small');
exports.SKINNYWIDE = imageSizesMap.get('skinnywide');
exports.SKINNYTALL = imageSizesMap.get('skinnytall');


/***/ }),
/* 40 */
/***/ (function(module, exports, __webpack_require__) {

__webpack_require__(41);
__webpack_require__(16);
__webpack_require__(48);
__webpack_require__(30);
__webpack_require__(52);
__webpack_require__(22);
__webpack_require__(53);
__webpack_require__(54);
__webpack_require__(55);
__webpack_require__(24);
__webpack_require__(63);
__webpack_require__(64);
__webpack_require__(36);
__webpack_require__(65);
__webpack_require__(66);
__webpack_require__(67);
__webpack_require__(71);
__webpack_require__(33);
__webpack_require__(38);
__webpack_require__(39);
__webpack_require__(72);
__webpack_require__(73);
__webpack_require__(74);
__webpack_require__(75);
__webpack_require__(76);
__webpack_require__(77);
__webpack_require__(37);
__webpack_require__(78);
module.exports = __webpack_require__(79);


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



/**
 * @fileOverview Synchronization between filter storage and filter containers.
 */

const {filterStorage} = __webpack_require__(5);
const {filterNotifier} = __webpack_require__(1);
const {elemHide} = __webpack_require__(19);
const {elemHideEmulation} = __webpack_require__(21);
const {elemHideExceptions} = __webpack_require__(20);
const {snippets} = __webpack_require__(28);
const {defaultMatcher} = __webpack_require__(11);
const {Filter, ActiveFilter, RegExpFilter,
       ElemHideBase, ElemHideFilter, ElemHideEmulationFilter,
       SnippetFilter} = __webpack_require__(0);
const {SpecialSubscription} = __webpack_require__(4);

/**
 * Notifies Matcher instances or elemHide object about a new filter
 * if necessary.
 * @param {Filter} filter filter that has been added
 * @param {?Array.<Subscription>} [subscriptions] subscriptions to which the
 *   filter belongs
 */
function addFilter(filter, subscriptions = null)
{
  if (!(filter instanceof ActiveFilter) || filter.disabled)
    return;

  let hasEnabled = false;
  let allowSnippets = false;
  for (let subscription of subscriptions ||
                           filterStorage.subscriptions(filter.text))
  {
    if (!subscription.disabled)
    {
      hasEnabled = true;

      // Allow snippets to be executed only by the circumvention lists or the
      // user's own filters.
      if (subscription.type == "circumvention" ||
          subscription instanceof SpecialSubscription)
      {
        allowSnippets = true;
        break;
      }
    }
  }
  if (!hasEnabled)
    return;

  if (filter instanceof RegExpFilter)
    defaultMatcher.add(filter);
  else if (filter instanceof ElemHideBase)
  {
    if (filter instanceof ElemHideFilter)
      elemHide.add(filter);
    else if (filter instanceof ElemHideEmulationFilter)
      elemHideEmulation.add(filter);
    else
      elemHideExceptions.add(filter);
  }
  else if (allowSnippets && filter instanceof SnippetFilter)
    snippets.add(filter);
}

/**
 * Notifies Matcher instances or elemHide object about removal of a filter
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
    for (let subscription of filterStorage.subscriptions(filter.text))
    {
      if (!subscription.disabled)
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
    if (filter instanceof ElemHideFilter)
      elemHide.remove(filter);
    else if (filter instanceof ElemHideEmulationFilter)
      elemHideEmulation.remove(filter);
    else
      elemHideExceptions.remove(filter);
  }
  else if (filter instanceof SnippetFilter)
    snippets.remove(filter);
}

/**
 * {@link filterListener} implementation.
 */
class FilterListener
{
  /**
   * Initializes filter listener on startup, registers the necessary hooks.
   * Initialization is asynchronous; once complete, {@link filterNotifier}
   * emits the <code>ready</code> event.
   * @hideconstructor
   */
  constructor()
  {
    /**
     * Increases on filter changes, filters will be saved if it exceeds 1.
     * @type {number}
     * @private
     */
    this._isDirty = 0;

    filterStorage.loadFromDisk().then(() =>
    {
      let promise = Promise.resolve();

      // Initialize filters from each subscription asynchronously on startup by
      // setting up a chain of promises.
      for (let subscription of filterStorage.subscriptions())
      {
        if (!subscription.disabled)
        {
          promise = promise.then(() =>
          {
            for (let text of subscription.filterText())
              addFilter(Filter.fromText(text), [subscription]);
          });
        }
      }

      return promise;
    })
    .then(() =>
    {
      filterNotifier.on("filter.hitCount", this._onFilterHitCount.bind(this));
      filterNotifier.on("filter.lastHit", this._onFilterLastHit.bind(this));
      filterNotifier.on("filter.added", this._onFilterAdded.bind(this));
      filterNotifier.on("filter.removed", this._onFilterRemoved.bind(this));
      filterNotifier.on("filter.disabled", this._onFilterDisabled.bind(this));
      filterNotifier.on("filter.moved", this._onGenericChange.bind(this));

      filterNotifier.on("subscription.added",
                        this._onSubscriptionAdded.bind(this));
      filterNotifier.on("subscription.removed",
                        this._onSubscriptionRemoved.bind(this));
      filterNotifier.on("subscription.disabled",
                        this._onSubscriptionDisabled.bind(this));
      filterNotifier.on("subscription.updated",
                        this._onSubscriptionUpdated.bind(this));
      filterNotifier.on("subscription.title", this._onGenericChange.bind(this));
      filterNotifier.on("subscription.fixedTitle",
                        this._onGenericChange.bind(this));
      filterNotifier.on("subscription.homepage",
                        this._onGenericChange.bind(this));
      filterNotifier.on("subscription.downloadStatus",
                        this._onGenericChange.bind(this));
      filterNotifier.on("subscription.lastCheck",
                        this._onGenericChange.bind(this));
      filterNotifier.on("subscription.errors",
                        this._onGenericChange.bind(this));

      filterNotifier.on("load", this._onLoad.bind(this));
      filterNotifier.on("save", this._onSave.bind(this));

      // Indicate that all filters are ready for use.
      filterNotifier.emit("ready");
    });
  }

  /**
   * Increases "dirty factor" of the filters and calls
   * filterStorage.saveToDisk() if it becomes 1 or more. Save is
   * executed delayed to prevent multiple subsequent calls. If the
   * parameter is 0 it forces saving filters if any changes were
   * recorded after the previous save.
   * @param {number} factor
   * @private
   */
  _setDirty(factor)
  {
    if (factor == 0 && this._isDirty > 0)
      this._isDirty = 1;
    else
      this._isDirty += factor;
    if (this._isDirty >= 1)
    {
      this._isDirty = 0;
      filterStorage.saveToDisk();
    }
  }

  _onSubscriptionAdded(subscription)
  {
    this._setDirty(1);

    if (!subscription.disabled)
    {
      for (let text of subscription.filterText())
        addFilter(Filter.fromText(text), [subscription]);
    }
  }

  _onSubscriptionRemoved(subscription)
  {
    this._setDirty(1);

    if (!subscription.disabled)
    {
      for (let text of subscription.filterText())
        removeFilter(Filter.fromText(text));
    }
  }

  _onSubscriptionDisabled(subscription, newValue)
  {
    this._setDirty(1);

    if (filterStorage.knownSubscriptions.has(subscription.url))
    {
      if (newValue == false)
      {
        for (let text of subscription.filterText())
          addFilter(Filter.fromText(text), [subscription]);
      }
      else
      {
        for (let text of subscription.filterText())
          removeFilter(Filter.fromText(text));
      }
    }
  }

  _onSubscriptionUpdated(subscription, textDelta)
  {
    this._setDirty(1);

    if (!subscription.disabled &&
        filterStorage.knownSubscriptions.has(subscription.url))
    {
      for (let text of textDelta.removed)
        removeFilter(Filter.fromText(text));

      for (let text of textDelta.added)
        addFilter(Filter.fromText(text), [subscription]);
    }
  }

  _onFilterHitCount(filter, newValue)
  {
    if (newValue == 0)
      this._setDirty(0);
    else
      this._setDirty(0.002);
  }

  _onFilterLastHit()
  {
    this._setDirty(0.002);
  }

  _onFilterAdded(filter)
  {
    this._setDirty(1);

    if (!filter.disabled)
      addFilter(filter);
  }

  _onFilterRemoved(filter)
  {
    this._setDirty(1);

    if (!filter.disabled)
      removeFilter(filter);
  }

  _onFilterDisabled(filter, newValue)
  {
    this._setDirty(1);

    if (newValue == false)
      addFilter(filter);
    else
      removeFilter(filter);
  }

  _onGenericChange()
  {
    this._setDirty(1);
  }

  _onLoad()
  {
    this._isDirty = 0;

    defaultMatcher.clear();
    elemHide.clear();
    elemHideEmulation.clear();
    elemHideExceptions.clear();
    snippets.clear();

    for (let subscription of filterStorage.subscriptions())
    {
      if (!subscription.disabled)
      {
        for (let text of subscription.filterText())
          addFilter(Filter.fromText(text), [subscription]);
      }
    }
  }

  _onSave()
  {
    this._isDirty = 0;
  }
}

/**
 * Component synchronizing filter storage with filter containers.
 * @type {FilterListener}
 */
let filterListener = new FilterListener();

exports.filterListener = filterListener;


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
      .then(() => browser.storage.local.remove(fileToKey(fromFile)));
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
/* 43 */
/***/ (function(module, exports) {

module.exports = {"0.bg":1,"001www.com":1,"0emm.com":2,"1.bg":1,"12hp.at":1,"12hp.ch":1,"12hp.de":1,"1337.pictures":1,"16-b.it":1,"1kapp.com":1,"2.bg":1,"2000.hu":1,"2038.io":1,"2ix.at":1,"2ix.ch":1,"2ix.de":1,"3.bg":1,"32-b.it":1,"3utilities.com":1,"4.bg":1,"4lima.at":1,"4lima.ch":1,"4lima.de":1,"4u.com":1,"5.bg":1,"6.bg":1,"64-b.it":1,"7.bg":1,"8.bg":1,"9.bg":1,"9guacu.br":1,"a.bg":1,"a.prod.fastly.net":1,"a.run.app":1,"a.se":1,"a.ssl.fastly.net":1,"aa.no":1,"aaa.pro":1,"aarborte.no":1,"ab.ca":1,"abashiri.hokkaido.jp":1,"abc.br":1,"abeno.osaka.jp":1,"abiko.chiba.jp":1,"abira.hokkaido.jp":1,"abkhazia.su":1,"abo.pa":1,"abr.it":1,"abruzzo.it":1,"abu.yamaguchi.jp":1,"ac.ae":1,"ac.at":1,"ac.be":1,"ac.ci":1,"ac.cn":1,"ac.cr":1,"ac.cy":1,"ac.gn":1,"ac.gov.br":1,"ac.id":1,"ac.il":1,"ac.im":1,"ac.in":1,"ac.ir":1,"ac.jp":1,"ac.ke":1,"ac.kr":1,"ac.leg.br":1,"ac.lk":1,"ac.ls":1,"ac.ma":1,"ac.me":1,"ac.mu":1,"ac.mw":1,"ac.mz":1,"ac.ni":1,"ac.nz":1,"ac.pa":1,"ac.pr":1,"ac.rs":1,"ac.ru":1,"ac.rw":1,"ac.se":1,"ac.sz":1,"ac.th":1,"ac.tj":1,"ac.tz":1,"ac.ug":1,"ac.uk":1,"ac.vn":1,"ac.za":1,"ac.zm":1,"ac.zw":1,"aca.pro":1,"academia.bo":1,"academy.museum":1,"accesscam.org":1,"accident-investigation.aero":1,"accident-prevention.aero":1,"acct.pro":1,"achi.nagano.jp":1,"act.au":1,"act.edu.au":1,"ad.jp":1,"adachi.tokyo.jp":1,"adm.br":1,"adult.ht":1,"adv.br":1,"adv.mz":1,"advisor.ws":2,"adygeya.ru":1,"adygeya.su":1,"ae.org":1,"aejrie.no":1,"aero.mv":1,"aero.tt":1,"aerobatic.aero":1,"aeroclub.aero":1,"aerodrome.aero":1,"aeroport.fr":1,"afjord.no":1,"africa.com":1,"ag.it":1,"aga.niigata.jp":1,"agano.niigata.jp":1,"agdenes.no":1,"agematsu.nagano.jp":1,"agents.aero":1,"agr.br":1,"agrar.hu":1,"agric.za":1,"agriculture.museum":1,"agrigento.it":1,"agrinet.tn":1,"agro.bo":1,"agro.pl":1,"aguni.okinawa.jp":1,"ah.cn":1,"ah.no":1,"aibetsu.hokkaido.jp":1,"aichi.jp":1,"aid.pl":1,"aikawa.kanagawa.jp":1,"ainan.ehime.jp":1,"aioi.hyogo.jp":1,"aip.ee":1,"air-surveillance.aero":1,"air-traffic-control.aero":1,"air.museum":1,"aircraft.aero":1,"airguard.museum":1,"airline.aero":1,"airport.aero":1,"airtraffic.aero":1,"aisai.aichi.jp":1,"aisho.shiga.jp":1,"aizubange.fukushima.jp":1,"aizumi.tokushima.jp":1,"aizumisato.fukushima.jp":1,"aizuwakamatsu.fukushima.jp":1,"aju.br":1,"ak.us":1,"akabira.hokkaido.jp":1,"akagi.shimane.jp":1,"akaiwa.okayama.jp":1,"akashi.hyogo.jp":1,"aki.kochi.jp":1,"akiruno.tokyo.jp":1,"akishima.tokyo.jp":1,"akita.akita.jp":1,"akita.jp":1,"akkeshi.hokkaido.jp":1,"aknoluokta.no":1,"ako.hyogo.jp":1,"akrehamn.no":1,"aktyubinsk.su":1,"akune.kagoshima.jp":1,"al.eu.org":1,"al.gov.br":1,"al.it":1,"al.leg.br":1,"al.no":1,"al.us":1,"alabama.museum":1,"alaheadju.no":1,"aland.fi":1,"alaska.museum":1,"alces.network":2,"alessandria.it":1,"alesund.no":1,"algard.no":1,"alpha-myqnapcloud.com":1,"alpha.bounty-full.com":1,"alstahaug.no":1,"alt.za":1,"alta.no":1,"alto-adige.it":1,"altoadige.it":1,"alvdal.no":1,"alwaysdata.net":1,"am.br":1,"am.gov.br":1,"am.leg.br":1,"ama.aichi.jp":1,"ama.shimane.jp":1,"amagasaki.hyogo.jp":1,"amakusa.kumamoto.jp":1,"amami.kagoshima.jp":1,"amber.museum":1,"ambulance.aero":1,"ambulance.museum":1,"american.museum":1,"americana.museum":1,"americanantiques.museum":1,"americanart.museum":1,"ami.ibaraki.jp":1,"amli.no":1,"amot.no":1,"amsterdam.museum":1,"amusement.aero":1,"an.it":1,"anamizu.ishikawa.jp":1,"anan.nagano.jp":1,"anan.tokushima.jp":1,"anani.br":1,"ancona.it":1,"and.mom":1,"and.museum":1,"andasuolo.no":1,"andebu.no":1,"ando.nara.jp":1,"andoy.no":1,"andria-barletta-trani.it":1,"andria-trani-barletta.it":1,"andriabarlettatrani.it":1,"andriatranibarletta.it":1,"anjo.aichi.jp":1,"ann-arbor.mi.us":1,"annaka.gunma.jp":1,"annefrank.museum":1,"anpachi.gifu.jp":1,"anthro.museum":1,"anthropology.museum":1,"antiques.museum":1,"ao.it":1,"aogaki.hyogo.jp":1,"aogashima.tokyo.jp":1,"aoki.nagano.jp":1,"aomori.aomori.jp":1,"aomori.jp":1,"aosta-valley.it":1,"aosta.it":1,"aostavalley.it":1,"aoste.it":1,"ap-northeast-1.elasticbeanstalk.com":1,"ap-northeast-2.elasticbeanstalk.com":1,"ap-northeast-3.elasticbeanstalk.com":1,"ap-south-1.elasticbeanstalk.com":1,"ap-southeast-1.elasticbeanstalk.com":1,"ap-southeast-2.elasticbeanstalk.com":1,"ap.gov.br":1,"ap.gov.pl":1,"ap.it":1,"ap.leg.br":1,"aparecida.br":1,"api.stdlib.com":1,"apigee.io":1,"app.banzaicloud.io":1,"app.lmpm.com":1,"app.os.fedoraproject.org":1,"app.os.stg.fedoraproject.org":1,"app.render.com":1,"appchizi.com":1,"applicationcloud.io":1,"applinzi.com":1,"apps.fbsbx.com":1,"apps.lair.io":1,"appspot.com":1,"aq.it":1,"aquarium.museum":1,"aquila.it":1,"ar.com":1,"ar.it":1,"ar.us":1,"arai.shizuoka.jp":1,"arakawa.saitama.jp":1,"arakawa.tokyo.jp":1,"arao.kumamoto.jp":1,"arboretum.museum":1,"archaeological.museum":1,"archaeology.museum":1,"architecture.museum":1,"ardal.no":1,"aremark.no":1,"arendal.no":1,"arezzo.it":1,"ariake.saga.jp":1,"arida.wakayama.jp":1,"aridagawa.wakayama.jp":1,"arita.saga.jp":1,"arkhangelsk.su":1,"armenia.su":1,"arna.no":1,"arq.br":1,"art.br":1,"art.do":1,"art.dz":1,"art.ht":1,"art.museum":1,"art.pl":1,"art.sn":1,"artanddesign.museum":1,"artcenter.museum":1,"artdeco.museum":1,"arte.bo":1,"arteducation.museum":1,"artgallery.museum":1,"arts.co":1,"arts.museum":1,"arts.nf":1,"arts.ro":1,"arts.ve":1,"artsandcrafts.museum":1,"arvo.network":1,"as.us":1,"asago.hyogo.jp":1,"asahi.chiba.jp":1,"asahi.ibaraki.jp":1,"asahi.mie.jp":1,"asahi.nagano.jp":1,"asahi.toyama.jp":1,"asahi.yamagata.jp":1,"asahikawa.hokkaido.jp":1,"asaka.saitama.jp":1,"asakawa.fukushima.jp":1,"asakuchi.okayama.jp":1,"asaminami.hiroshima.jp":1,"ascoli-piceno.it":1,"ascolipiceno.it":1,"aseral.no":1,"ashgabad.su":1,"ashibetsu.hokkaido.jp":1,"ashikaga.tochigi.jp":1,"ashiya.fukuoka.jp":1,"ashiya.hyogo.jp":1,"ashoro.hokkaido.jp":1,"asker.no":1,"askim.no":1,"askoy.no":1,"askvoll.no":1,"asmatart.museum":1,"asn.au":1,"asn.lv":1,"asnes.no":1,"aso.kumamoto.jp":1,"ass.km":1,"assabu.hokkaido.jp":1,"assassination.museum":1,"assisi.museum":1,"assn.lk":1,"asso.bj":1,"asso.ci":1,"asso.dz":1,"asso.eu.org":1,"asso.fr":1,"asso.gp":1,"asso.ht":1,"asso.km":1,"asso.mc":1,"asso.nc":1,"asso.re":1,"association.aero":1,"association.museum":1,"asti.it":1,"astronomy.museum":1,"asuke.aichi.jp":1,"at-band-camp.net":1,"at.eu.org":1,"at.it":1,"atami.shizuoka.jp":1,"ath.cx":1,"atlanta.museum":1,"atm.pl":1,"ato.br":1,"atsugi.kanagawa.jp":1,"atsuma.hokkaido.jp":1,"au.eu.org":1,"audnedaln.no":1,"augustow.pl":1,"aukra.no":1,"aure.no":1,"aurland.no":1,"aurskog-holand.no":1,"austevoll.no":1,"austin.museum":1,"australia.museum":1,"austrheim.no":1,"author.aero":1,"auto.pl":1,"automotive.museum":1,"av.it":1,"av.tr":1,"avellino.it":1,"averoy.no":1,"aviation.museum":1,"avocat.fr":1,"avocat.pro":1,"avoues.fr":1,"awaji.hyogo.jp":1,"awdev.ca":2,"axis.museum":1,"aya.miyazaki.jp":1,"ayabe.kyoto.jp":1,"ayagawa.kagawa.jp":1,"ayase.kanagawa.jp":1,"az.us":1,"azerbaijan.su":1,"azimuth.network":1,"azumino.nagano.jp":1,"azure-mobile.net":1,"azurecontainer.io":1,"azurewebsites.net":1,"b-data.io":1,"b.bg":1,"b.br":1,"b.se":1,"b.ssl.fastly.net":1,"ba.gov.br":1,"ba.it":1,"ba.leg.br":1,"babia-gora.pl":1,"backplaneapp.io":1,"badaddja.no":1,"badajoz.museum":1,"baghdad.museum":1,"bahcavuotna.no":1,"bahccavuotna.no":1,"bahn.museum":1,"baidar.no":1,"bajddar.no":1,"balashov.su":1,"balat.no":1,"bale.museum":1,"balena-devices.com":1,"balestrand.no":1,"ballangen.no":1,"ballooning.aero":1,"balsan-sudtirol.it":1,"balsan-suedtirol.it":1,"balsan.it":1,"balsfjord.no":1,"baltimore.museum":1,"bamble.no":1,"bandai.fukushima.jp":1,"bando.ibaraki.jp":1,"bar.pro":1,"barcelona.museum":1,"bardu.no":1,"bari.it":1,"barletta-trani-andria.it":1,"barlettatraniandria.it":1,"barreau.bj":1,"barrel-of-knowledge.info":1,"barrell-of-knowledge.info":1,"barsy.bg":1,"barsy.ca":1,"barsy.club":1,"barsy.co.uk":1,"barsy.de":1,"barsy.eu":1,"barsy.in":1,"barsy.info":1,"barsy.io":1,"barsy.me":1,"barsy.menu":1,"barsy.mobi":1,"barsy.net":1,"barsy.online":1,"barsy.org":1,"barsy.pro":1,"barsy.pub":1,"barsy.shop":1,"barsy.site":1,"barsy.support":1,"barsy.uk":1,"barsycenter.com":1,"barsyonline.co.uk":1,"barsyonline.com":1,"barueri.br":1,"barum.no":1,"bas.it":1,"baseball.museum":1,"basel.museum":1,"bashkiria.ru":1,"bashkiria.su":1,"basicserver.io":1,"basilicata.it":1,"baths.museum":1,"bato.tochigi.jp":1,"batsfjord.no":1,"bauern.museum":1,"bbs.tr":1,"bc.ca":1,"bci.dnstrace.pro":1,"bd":2,"bd.se":1,"be.eu.org":1,"bearalvahki.no":1,"beardu.no":1,"beauxarts.museum":1,"bedzin.pl":1,"beeldengeluid.museum":1,"beep.pl":1,"beiarn.no":1,"bel.tr":1,"belau.pw":1,"belem.br":1,"bellevue.museum":1,"belluno.it":1,"benevento.it":1,"beppu.oita.jp":1,"berg.no":1,"bergamo.it":1,"bergbau.museum":1,"bergen.no":1,"berkeley.museum":1,"berlevag.no":1,"berlin.museum":1,"bern.museum":1,"beskidy.pl":1,"beta.bounty-full.com":1,"betainabox.com":1,"better-than.tv":1,"bg.eu.org":1,"bg.it":1,"bhz.br":1,"bi.it":1,"bialowieza.pl":1,"bialystok.pl":1,"bibai.hokkaido.jp":1,"bible.museum":1,"biei.hokkaido.jp":1,"bielawa.pl":1,"biella.it":1,"bieszczady.pl":1,"bievat.no":1,"bifuka.hokkaido.jp":1,"bihoro.hokkaido.jp":1,"bilbao.museum":1,"bill.museum":1,"bindal.no":1,"bio.br":1,"bir.ru":1,"biratori.hokkaido.jp":1,"birdart.museum":1,"birkenes.no":1,"birthplace.museum":1,"bitballoon.com":1,"biz.at":1,"biz.az":1,"biz.bb":1,"biz.cy":1,"biz.dk":1,"biz.et":1,"biz.gl":1,"biz.id":1,"biz.ki":1,"biz.ls":1,"biz.mv":1,"biz.mw":1,"biz.ni":1,"biz.nr":1,"biz.pk":1,"biz.pl":1,"biz.pr":1,"biz.tj":1,"biz.tr":1,"biz.tt":1,"biz.ua":1,"biz.vn":1,"biz.zm":1,"bizen.okayama.jp":1,"bj.cn":1,"bjarkoy.no":1,"bjerkreim.no":1,"bjugn.no":1,"bl.it":1,"blackbaudcdn.net":1,"blog.bo":1,"blog.br":1,"blogdns.com":1,"blogdns.net":1,"blogdns.org":1,"blogsite.org":1,"blogsite.xyz":1,"blogspot.ae":1,"blogspot.al":1,"blogspot.am":1,"blogspot.ba":1,"blogspot.be":1,"blogspot.bg":1,"blogspot.bj":1,"blogspot.ca":1,"blogspot.cf":1,"blogspot.ch":1,"blogspot.cl":1,"blogspot.co.at":1,"blogspot.co.id":1,"blogspot.co.il":1,"blogspot.co.ke":1,"blogspot.co.nz":1,"blogspot.co.uk":1,"blogspot.co.za":1,"blogspot.com":1,"blogspot.com.ar":1,"blogspot.com.au":1,"blogspot.com.br":1,"blogspot.com.by":1,"blogspot.com.co":1,"blogspot.com.cy":1,"blogspot.com.ee":1,"blogspot.com.eg":1,"blogspot.com.es":1,"blogspot.com.mt":1,"blogspot.com.ng":1,"blogspot.com.tr":1,"blogspot.com.uy":1,"blogspot.cv":1,"blogspot.cz":1,"blogspot.de":1,"blogspot.dk":1,"blogspot.fi":1,"blogspot.fr":1,"blogspot.gr":1,"blogspot.hk":1,"blogspot.hr":1,"blogspot.hu":1,"blogspot.ie":1,"blogspot.in":1,"blogspot.is":1,"blogspot.it":1,"blogspot.jp":1,"blogspot.kr":1,"blogspot.li":1,"blogspot.lt":1,"blogspot.lu":1,"blogspot.md":1,"blogspot.mk":1,"blogspot.mr":1,"blogspot.mx":1,"blogspot.my":1,"blogspot.nl":1,"blogspot.no":1,"blogspot.pe":1,"blogspot.pt":1,"blogspot.qa":1,"blogspot.re":1,"blogspot.ro":1,"blogspot.rs":1,"blogspot.ru":1,"blogspot.se":1,"blogspot.sg":1,"blogspot.si":1,"blogspot.sk":1,"blogspot.sn":1,"blogspot.td":1,"blogspot.tw":1,"blogspot.ug":1,"blogspot.vn":1,"blogsyte.com":1,"bloxcms.com":1,"bmd.br":1,"bmoattachments.org":1,"bn.it":1,"bnr.la":1,"bo.it":1,"bo.nordland.no":1,"bo.telemark.no":1,"boavista.br":1,"bodo.no":1,"bokn.no":1,"boldlygoingnowhere.org":1,"boleslawiec.pl":1,"bolivia.bo":1,"bologna.it":1,"bolt.hu":1,"bolzano-altoadige.it":1,"bolzano.it":1,"bomlo.no":1,"bonn.museum":1,"boomla.net":1,"boston.museum":1,"botanical.museum":1,"botanicalgarden.museum":1,"botanicgarden.museum":1,"botany.museum":1,"bounceme.net":1,"bounty-full.com":1,"boxfuse.io":1,"bozen-sudtirol.it":1,"bozen-suedtirol.it":1,"bozen.it":1,"bpl.biz":1,"bplaced.com":1,"bplaced.de":1,"bplaced.net":1,"br.com":1,"br.it":1,"brand.se":1,"brandywinevalley.museum":1,"brasil.museum":1,"brasilia.me":1,"bremanger.no":1,"brescia.it":1,"brindisi.it":1,"bristol.museum":1,"british.museum":1,"britishcolumbia.museum":1,"broadcast.museum":1,"broke-it.net":1,"broker.aero":1,"bronnoy.no":1,"bronnoysund.no":1,"browsersafetymark.io":1,"brumunddal.no":1,"brunel.museum":1,"brussel.museum":1,"brussels.museum":1,"bruxelles.museum":1,"bryansk.su":1,"bryne.no":1,"bs.it":1,"bsb.br":1,"bss.design":1,"bt.it":1,"bu.no":1,"budejju.no":1,"building.museum":1,"bukhara.su":1,"bulsan-sudtirol.it":1,"bulsan-suedtirol.it":1,"bulsan.it":1,"bungoono.oita.jp":1,"bungotakada.oita.jp":1,"bunkyo.tokyo.jp":1,"burghof.museum":1,"bus.museum":1,"busan.kr":1,"bushey.museum":1,"buyshouses.net":1,"buzen.fukuoka.jp":1,"bydgoszcz.pl":1,"byen.site":1,"bygland.no":1,"bykle.no":1,"bytom.pl":1,"bz.it":1,"bzz.dapps.earth":2,"c.bg":1,"c.cdn77.org":1,"c.la":1,"c.se":1,"c66.me":1,"ca-central-1.elasticbeanstalk.com":1,"ca.eu.org":1,"ca.it":1,"ca.na":1,"ca.us":1,"caa.aero":1,"caa.li":1,"cable-modem.org":1,"cadaques.museum":1,"cagliari.it":1,"cahcesuolo.no":1,"cal.it":1,"calabria.it":1,"california.museum":1,"caltanissetta.it":1,"cam.it":1,"cambridge.museum":1,"camdvr.org":1,"campania.it":1,"campidano-medio.it":1,"campidanomedio.it":1,"campinagrande.br":1,"campinas.br":1,"campobasso.it":1,"can.museum":1,"canada.museum":1,"capebreton.museum":1,"carbonia-iglesias.it":1,"carboniaiglesias.it":1,"cargo.aero":1,"carrara-massa.it":1,"carraramassa.it":1,"carrd.co":1,"carrier.museum":1,"cartoonart.museum":1,"casacam.net":1,"casadelamoneda.museum":1,"caserta.it":1,"casino.hu":1,"castle.museum":1,"castres.museum":1,"catania.it":1,"catanzaro.it":1,"catering.aero":1,"catholic.edu.au":1,"caxias.br":1,"cb.it":1,"cbg.ru":1,"cc.ak.us":1,"cc.al.us":1,"cc.ar.us":1,"cc.as.us":1,"cc.az.us":1,"cc.ca.us":1,"cc.co.us":1,"cc.ct.us":1,"cc.dc.us":1,"cc.de.us":1,"cc.fl.us":1,"cc.ga.us":1,"cc.gu.us":1,"cc.hi.us":1,"cc.ia.us":1,"cc.id.us":1,"cc.il.us":1,"cc.in.us":1,"cc.ks.us":1,"cc.ky.us":1,"cc.la.us":1,"cc.ma.us":1,"cc.md.us":1,"cc.me.us":1,"cc.mi.us":1,"cc.mn.us":1,"cc.mo.us":1,"cc.ms.us":1,"cc.mt.us":1,"cc.na":1,"cc.nc.us":1,"cc.nd.us":1,"cc.ne.us":1,"cc.nh.us":1,"cc.nj.us":1,"cc.nm.us":1,"cc.nv.us":1,"cc.ny.us":1,"cc.oh.us":1,"cc.ok.us":1,"cc.or.us":1,"cc.pa.us":1,"cc.pr.us":1,"cc.ri.us":1,"cc.sc.us":1,"cc.sd.us":1,"cc.tn.us":1,"cc.tx.us":1,"cc.ua":1,"cc.ut.us":1,"cc.va.us":1,"cc.vi.us":1,"cc.vt.us":1,"cc.wa.us":1,"cc.wi.us":1,"cc.wv.us":1,"cc.wy.us":1,"cci.fr":1,"cd.eu.org":1,"cdn77-ssl.net":1,"ce.gov.br":1,"ce.it":1,"ce.leg.br":1,"cechire.com":1,"celtic.museum":1,"center.museum":1,"certification.aero":1,"certmgr.org":1,"cesena-forli.it":1,"cesenaforli.it":1,"ch.eu.org":1,"ch.it":1,"chambagri.fr":1,"championship.aero":1,"channelsdvr.net":1,"charter.aero":1,"chattanooga.museum":1,"cheltenham.museum":1,"cherkassy.ua":1,"cherkasy.ua":1,"chernigov.ua":1,"chernihiv.ua":1,"chernivtsi.ua":1,"chernovtsy.ua":1,"chesapeakebay.museum":1,"chiba.jp":1,"chicago.museum":1,"chichibu.saitama.jp":1,"chieti.it":1,"chigasaki.kanagawa.jp":1,"chihayaakasaka.osaka.jp":1,"chijiwa.nagasaki.jp":1,"chikugo.fukuoka.jp":1,"chikuho.fukuoka.jp":1,"chikuhoku.nagano.jp":1,"chikujo.fukuoka.jp":1,"chikuma.nagano.jp":1,"chikusei.ibaraki.jp":1,"chikushino.fukuoka.jp":1,"chikuzen.fukuoka.jp":1,"children.museum":1,"childrens.museum":1,"childrensgarden.museum":1,"chimkent.su":1,"chino.nagano.jp":1,"chippubetsu.hokkaido.jp":1,"chiropractic.museum":1,"chirurgiens-dentistes-en-france.fr":1,"chirurgiens-dentistes.fr":1,"chiryu.aichi.jp":1,"chita.aichi.jp":1,"chitose.hokkaido.jp":1,"chiyoda.gunma.jp":1,"chiyoda.tokyo.jp":1,"chizu.tottori.jp":1,"chocolate.museum":1,"chofu.tokyo.jp":1,"chonan.chiba.jp":1,"chosei.chiba.jp":1,"choshi.chiba.jp":1,"choyo.kumamoto.jp":1,"christiansburg.museum":1,"chtr.k12.ma.us":1,"chungbuk.kr":1,"chungnam.kr":1,"chuo.chiba.jp":1,"chuo.fukuoka.jp":1,"chuo.osaka.jp":1,"chuo.tokyo.jp":1,"chuo.yamanashi.jp":1,"ci.it":1,"ciencia.bo":1,"cieszyn.pl":1,"cim.br":1,"cincinnati.museum":1,"cinema.museum":1,"circus.museum":1,"ciscofreak.com":1,"cistron.nl":1,"city.hu":1,"city.kawasaki.jp":0,"city.kitakyushu.jp":0,"city.kobe.jp":0,"city.nagoya.jp":0,"city.sapporo.jp":0,"city.sendai.jp":0,"city.yokohama.jp":0,"civilaviation.aero":1,"civilisation.museum":1,"civilization.museum":1,"civilwar.museum":1,"ck":2,"ck.ua":1,"cl.it":1,"clan.rip":1,"cleverapps.io":1,"clinton.museum":1,"clock.museum":1,"cloud.fedoraproject.org":1,"cloud.goog":1,"cloud.metacentrum.cz":1,"cloud66.ws":1,"cloud66.zone":1,"cloudaccess.host":1,"cloudaccess.net":1,"cloudapp.net":1,"cloudapps.digital":1,"cloudcontrolapp.com":1,"cloudcontrolled.com":1,"cloudeity.net":1,"cloudera.site":1,"cloudfront.net":1,"cloudfunctions.net":1,"cloudns.asia":1,"cloudns.biz":1,"cloudns.cc":1,"cloudns.club":1,"cloudns.eu":1,"cloudns.in":1,"cloudns.info":1,"cloudns.org":1,"cloudns.pro":1,"cloudns.pw":1,"cloudns.us":1,"cloudycluster.net":1,"club.aero":1,"club.tw":1,"cn-north-1.eb.amazonaws.com.cn":1,"cn-northwest-1.eb.amazonaws.com.cn":1,"cn.com":1,"cn.eu.org":1,"cn.it":1,"cn.ua":1,"cng.br":1,"cnpy.gdn":1,"cns.joyent.com":2,"cnt.br":1,"co.ae":1,"co.ag":1,"co.am":1,"co.ao":1,"co.at":1,"co.bb":1,"co.bi":1,"co.bn":1,"co.business":1,"co.bw":1,"co.ca":1,"co.ci":1,"co.cl":1,"co.cm":1,"co.com":1,"co.cr":1,"co.cz":1,"co.dk":1,"co.education":1,"co.events":1,"co.financial":1,"co.gg":1,"co.gl":1,"co.gy":1,"co.hu":1,"co.id":1,"co.il":1,"co.im":1,"co.in":1,"co.ir":1,"co.it":1,"co.je":1,"co.jp":1,"co.ke":1,"co.kr":1,"co.krd":1,"co.lc":1,"co.ls":1,"co.ma":1,"co.me":1,"co.mg":1,"co.mu":1,"co.mw":1,"co.mz":1,"co.na":1,"co.network":1,"co.ni":1,"co.nl":1,"co.no":1,"co.nz":1,"co.om":1,"co.pl":1,"co.place":1,"co.pn":1,"co.pw":1,"co.rs":1,"co.rw":1,"co.st":1,"co.sz":1,"co.technology":1,"co.th":1,"co.tj":1,"co.tm":1,"co.tt":1,"co.tz":1,"co.ua":1,"co.ug":1,"co.uk":1,"co.us":1,"co.uz":1,"co.ve":1,"co.vi":1,"co.za":1,"co.zm":1,"co.zw":1,"coal.museum":1,"coastaldefence.museum":1,"codespot.com":1,"cody.museum":1,"cog.mi.us":1,"col.ng":1,"coldwar.museum":1,"collection.museum":1,"collegefan.org":1,"colonialwilliamsburg.museum":1,"coloradoplateau.museum":1,"columbia.museum":1,"columbus.museum":1,"com.ac":1,"com.af":1,"com.ag":1,"com.ai":1,"com.al":1,"com.am":1,"com.ar":1,"com.au":1,"com.aw":1,"com.az":1,"com.ba":1,"com.bb":1,"com.bh":1,"com.bi":1,"com.bm":1,"com.bn":1,"com.bo":1,"com.br":1,"com.bs":1,"com.bt":1,"com.by":1,"com.bz":1,"com.ci":1,"com.cm":1,"com.cn":1,"com.co":1,"com.cu":1,"com.cw":1,"com.cy":1,"com.de":1,"com.dm":1,"com.do":1,"com.dz":1,"com.ec":1,"com.ee":1,"com.eg":1,"com.es":1,"com.et":1,"com.fr":1,"com.ge":1,"com.gh":1,"com.gi":1,"com.gl":1,"com.gn":1,"com.gp":1,"com.gr":1,"com.gt":1,"com.gu":1,"com.gy":1,"com.hk":1,"com.hn":1,"com.hr":1,"com.ht":1,"com.im":1,"com.io":1,"com.iq":1,"com.is":1,"com.jo":1,"com.kg":1,"com.ki":1,"com.km":1,"com.kp":1,"com.kw":1,"com.ky":1,"com.kz":1,"com.la":1,"com.lb":1,"com.lc":1,"com.lk":1,"com.lr":1,"com.lv":1,"com.ly":1,"com.mg":1,"com.mk":1,"com.ml":1,"com.mo":1,"com.ms":1,"com.mt":1,"com.mu":1,"com.mv":1,"com.mw":1,"com.mx":1,"com.my":1,"com.na":1,"com.nf":1,"com.ng":1,"com.ni":1,"com.nr":1,"com.om":1,"com.pa":1,"com.pe":1,"com.pf":1,"com.ph":1,"com.pk":1,"com.pl":1,"com.pr":1,"com.ps":1,"com.pt":1,"com.py":1,"com.qa":1,"com.re":1,"com.ro":1,"com.ru":1,"com.sa":1,"com.sb":1,"com.sc":1,"com.sd":1,"com.se":1,"com.sg":1,"com.sh":1,"com.sl":1,"com.sn":1,"com.so":1,"com.st":1,"com.sv":1,"com.sy":1,"com.tj":1,"com.tm":1,"com.tn":1,"com.to":1,"com.tr":1,"com.tt":1,"com.tw":1,"com.ua":1,"com.ug":1,"com.uy":1,"com.uz":1,"com.vc":1,"com.ve":1,"com.vi":1,"com.vn":1,"com.vu":1,"com.ws":1,"com.zm":1,"commune.am":1,"communication.museum":1,"communications.museum":1,"community.museum":1,"como.it":1,"compute-1.amazonaws.com":2,"compute.amazonaws.com":2,"compute.amazonaws.com.cn":2,"compute.estate":2,"computer.museum":1,"computerhistory.museum":1,"conf.au":1,"conf.lv":1,"conf.se":1,"conference.aero":1,"consulado.st":1,"consultant.aero":1,"consulting.aero":1,"contagem.br":1,"contemporary.museum":1,"contemporaryart.museum":1,"control.aero":1,"convent.museum":1,"coop.br":1,"coop.ht":1,"coop.km":1,"coop.mv":1,"coop.mw":1,"coop.py":1,"coop.rw":1,"coop.tt":1,"cooperativa.bo":1,"copenhagen.museum":1,"corporation.museum":1,"corvette.museum":1,"cosenza.it":1,"costume.museum":1,"couchpotatofries.org":1,"council.aero":1,"countryestate.museum":1,"county.museum":1,"cpa.pro":1,"cq.cn":1,"cr.it":1,"cr.ua":1,"crafting.xyz":1,"crafts.museum":1,"cranbrook.museum":1,"crd.co":1,"creation.museum":1,"cremona.it":1,"crew.aero":1,"cri.br":1,"cri.nz":1,"crimea.ua":1,"crotone.it":1,"cryptonomic.net":2,"cs.it":1,"ct.it":1,"ct.us":1,"cuiaba.br":1,"cultural.museum":1,"culturalcenter.museum":1,"culture.museum":1,"cuneo.it":1,"cupcake.is":1,"curitiba.br":1,"cust.dev.thingdust.io":1,"cust.disrec.thingdust.io":1,"cust.prod.thingdust.io":1,"cust.testing.thingdust.io":1,"custom.metacentrum.cz":1,"customer.enonic.io":1,"customer.speedpartner.de":1,"cv.ua":1,"cy.eu.org":1,"cya.gg":1,"cyber.museum":1,"cymru.museum":1,"cyon.link":1,"cyon.site":1,"cz.eu.org":1,"cz.it":1,"czeladz.pl":1,"czest.pl":1,"d.bg":1,"d.gv.vc":1,"d.se":1,"daegu.kr":1,"daejeon.kr":1,"dagestan.ru":1,"dagestan.su":1,"daigo.ibaraki.jp":1,"daisen.akita.jp":1,"daito.osaka.jp":1,"daiwa.hiroshima.jp":1,"dali.museum":1,"dallas.museum":1,"damnserver.com":1,"daplie.me":1,"dapps.earth":2,"database.museum":1,"date.fukushima.jp":1,"date.hokkaido.jp":1,"dattolocal.com":1,"dattolocal.net":1,"dattorelay.com":1,"dattoweb.com":1,"davvenjarga.no":1,"davvesiida.no":1,"dazaifu.fukuoka.jp":1,"dc.us":1,"dd-dns.de":1,"ddns.me":1,"ddns.net":1,"ddnsfree.com":1,"ddnsgeek.com":1,"ddnsking.com":1,"ddnslive.com":1,"ddnss.de":1,"ddnss.org":1,"ddr.museum":1,"de.com":1,"de.cool":1,"de.eu.org":1,"de.us":1,"deatnu.no":1,"debian.net":1,"decorativearts.museum":1,"dedyn.io":1,"def.br":1,"defense.tn":1,"definima.io":1,"definima.net":1,"delaware.museum":1,"dell-ogliastra.it":1,"dellogliastra.it":1,"delmenhorst.museum":1,"democracia.bo":1,"demon.nl":1,"denmark.museum":1,"dep.no":1,"deporte.bo":1,"depot.museum":1,"desa.id":1,"design.aero":1,"design.museum":1,"detroit.museum":1,"dev-myqnapcloud.com":1,"dev.static.land":1,"development.run":1,"devices.resinstaging.io":1,"df.gov.br":1,"df.leg.br":1,"dgca.aero":1,"dh.bytemark.co.uk":1,"dielddanuorri.no":1,"dinosaur.museum":1,"discourse.group":1,"discovery.museum":1,"diskstation.eu":1,"diskstation.me":1,"diskstation.org":1,"ditchyourip.com":1,"divtasvuodna.no":1,"divttasvuotna.no":1,"dk.eu.org":1,"dlugoleka.pl":1,"dn.ua":1,"dnepropetrovsk.ua":1,"dni.us":1,"dnipropetrovsk.ua":1,"dnsalias.com":1,"dnsalias.net":1,"dnsalias.org":1,"dnsdojo.com":1,"dnsdojo.net":1,"dnsdojo.org":1,"dnsfor.me":1,"dnshome.de":1,"dnsiskinky.com":1,"dnsking.ch":1,"dnsup.net":1,"dnsupdater.de":1,"does-it.net":1,"doesntexist.com":1,"doesntexist.org":1,"dolls.museum":1,"dominic.ua":1,"donetsk.ua":1,"donna.no":1,"donostia.museum":1,"dontexist.com":1,"dontexist.net":1,"dontexist.org":1,"doomdns.com":1,"doomdns.org":1,"doshi.yamanashi.jp":1,"dovre.no":1,"dp.ua":1,"dr.na":1,"dr.tr":1,"drammen.no":1,"drangedal.no":1,"dray-dns.de":1,"drayddns.com":1,"draydns.de":1,"dreamhosters.com":1,"drobak.no":1,"drud.io":1,"drud.us":1,"dscloud.biz":1,"dscloud.me":1,"dscloud.mobi":1,"dsmynas.com":1,"dsmynas.net":1,"dsmynas.org":1,"dst.mi.us":1,"duckdns.org":1,"durham.museum":1,"dvrcam.info":1,"dvrdns.org":1,"dweb.link":2,"dy.fi":1,"dyn-berlin.de":1,"dyn-ip24.de":1,"dyn-o-saur.com":1,"dyn-vpn.de":1,"dyn.cosidns.de":1,"dyn.ddnss.de":1,"dyn.home-webserver.de":1,"dyn53.io":1,"dynalias.com":1,"dynalias.net":1,"dynalias.org":1,"dynamic-dns.info":1,"dynamisches-dns.de":1,"dynathome.net":1,"dyndns-at-home.com":1,"dyndns-at-work.com":1,"dyndns-blog.com":1,"dyndns-free.com":1,"dyndns-home.com":1,"dyndns-ip.com":1,"dyndns-mail.com":1,"dyndns-office.com":1,"dyndns-pics.com":1,"dyndns-remote.com":1,"dyndns-server.com":1,"dyndns-web.com":1,"dyndns-wiki.com":1,"dyndns-work.com":1,"dyndns.biz":1,"dyndns.ddnss.de":1,"dyndns.info":1,"dyndns.org":1,"dyndns.tv":1,"dyndns.ws":1,"dyndns1.de":1,"dynns.com":1,"dynserv.org":1,"dynu.net":1,"dynv6.net":1,"dynvpn.de":1,"dyroy.no":1,"e.bg":1,"e.se":1,"e12.ve":1,"e164.arpa":1,"e4.cz":1,"east-kazakhstan.su":1,"eastafrica.museum":1,"eastcoast.museum":1,"eating-organic.net":1,"eaton.mi.us":1,"ebetsu.hokkaido.jp":1,"ebina.kanagawa.jp":1,"ebino.miyazaki.jp":1,"ebiz.tw":1,"echizen.fukui.jp":1,"ecn.br":1,"eco.br":1,"ecologia.bo":1,"economia.bo":1,"ed.ao":1,"ed.ci":1,"ed.cr":1,"ed.jp":1,"ed.pw":1,"edogawa.tokyo.jp":1,"edu.ac":1,"edu.af":1,"edu.al":1,"edu.ar":1,"edu.au":1,"edu.az":1,"edu.ba":1,"edu.bb":1,"edu.bh":1,"edu.bi":1,"edu.bm":1,"edu.bn":1,"edu.bo":1,"edu.br":1,"edu.bs":1,"edu.bt":1,"edu.bz":1,"edu.ci":1,"edu.cn":1,"edu.co":1,"edu.cu":1,"edu.cw":1,"edu.dm":1,"edu.do":1,"edu.dz":1,"edu.ec":1,"edu.ee":1,"edu.eg":1,"edu.es":1,"edu.et":1,"edu.eu.org":1,"edu.ge":1,"edu.gh":1,"edu.gi":1,"edu.gl":1,"edu.gn":1,"edu.gp":1,"edu.gr":1,"edu.gt":1,"edu.gu":1,"edu.gy":1,"edu.hk":1,"edu.hn":1,"edu.ht":1,"edu.in":1,"edu.iq":1,"edu.is":1,"edu.it":1,"edu.jo":1,"edu.kg":1,"edu.ki":1,"edu.km":1,"edu.kn":1,"edu.kp":1,"edu.krd":1,"edu.kw":1,"edu.ky":1,"edu.kz":1,"edu.la":1,"edu.lb":1,"edu.lc":1,"edu.lk":1,"edu.lr":1,"edu.ls":1,"edu.lv":1,"edu.ly":1,"edu.me":1,"edu.mg":1,"edu.mk":1,"edu.ml":1,"edu.mn":1,"edu.mo":1,"edu.ms":1,"edu.mt":1,"edu.mv":1,"edu.mw":1,"edu.mx":1,"edu.my":1,"edu.mz":1,"edu.ng":1,"edu.ni":1,"edu.nr":1,"edu.om":1,"edu.pa":1,"edu.pe":1,"edu.pf":1,"edu.ph":1,"edu.pk":1,"edu.pl":1,"edu.pn":1,"edu.pr":1,"edu.ps":1,"edu.pt":1,"edu.py":1,"edu.qa":1,"edu.rs":1,"edu.ru":1,"edu.sa":1,"edu.sb":1,"edu.sc":1,"edu.sd":1,"edu.sg":1,"edu.sl":1,"edu.sn":1,"edu.st":1,"edu.sv":1,"edu.sy":1,"edu.tj":1,"edu.tm":1,"edu.to":1,"edu.tr":1,"edu.tt":1,"edu.tw":1,"edu.ua":1,"edu.uy":1,"edu.vc":1,"edu.ve":1,"edu.vn":1,"edu.vu":1,"edu.ws":1,"edu.za":1,"edu.zm":1,"education.museum":1,"education.tas.edu.au":1,"educational.museum":1,"educator.aero":1,"edugit.org":1,"edunet.tn":1,"ee.eu.org":1,"egersund.no":1,"egyptian.museum":1,"ehime.jp":1,"eid.no":1,"eidfjord.no":1,"eidsberg.no":1,"eidskog.no":1,"eidsvoll.no":1,"eigersund.no":1,"eiheiji.fukui.jp":1,"eisenbahn.museum":1,"ekloges.cy":1,"elasticbeanstalk.com":1,"elb.amazonaws.com":2,"elb.amazonaws.com.cn":2,"elblag.pl":1,"elburg.museum":1,"elk.pl":1,"elvendrell.museum":1,"elverum.no":1,"emb.kw":1,"embaixada.st":1,"embetsu.hokkaido.jp":1,"embroidery.museum":1,"emergency.aero":1,"emilia-romagna.it":1,"emiliaromagna.it":1,"emp.br":1,"empresa.bo":1,"emr.it":1,"en.it":1,"ena.gifu.jp":1,"encyclopedic.museum":1,"endofinternet.net":1,"endofinternet.org":1,"endoftheinternet.org":1,"enebakk.no":1,"eng.br":1,"eng.pro":1,"engerdal.no":1,"engine.aero":1,"engineer.aero":1,"england.museum":1,"eniwa.hokkaido.jp":1,"enna.it":1,"enonic.io":1,"ens.tn":1,"enterprisecloud.nu":1,"entertainment.aero":1,"entomology.museum":1,"environment.museum":1,"environmentalconservation.museum":1,"epilepsy.museum":1,"eq.edu.au":1,"equipment.aero":1,"er":2,"erimo.hokkaido.jp":1,"erotica.hu":1,"erotika.hu":1,"es.eu.org":1,"es.gov.br":1,"es.kr":1,"es.leg.br":1,"esan.hokkaido.jp":1,"esashi.hokkaido.jp":1,"esp.br":1,"essex.museum":1,"est-a-la-maison.com":1,"est-a-la-masion.com":1,"est-le-patron.com":1,"est-mon-blogueur.com":1,"est.pr":1,"estate.museum":1,"etajima.hiroshima.jp":1,"etc.br":1,"ethnology.museum":1,"eti.br":1,"etne.no":1,"etnedal.no":1,"eu-1.evennode.com":1,"eu-2.evennode.com":1,"eu-3.evennode.com":1,"eu-4.evennode.com":1,"eu-central-1.elasticbeanstalk.com":1,"eu-west-1.elasticbeanstalk.com":1,"eu-west-2.elasticbeanstalk.com":1,"eu-west-3.elasticbeanstalk.com":1,"eu.com":1,"eu.int":1,"eu.meteorapp.com":1,"eu.org":1,"eun.eg":1,"evenassi.no":1,"evenes.no":1,"evje-og-hornnes.no":1,"ex.futurecms.at":2,"ex.ortsinfo.at":2,"exchange.aero":1,"exeter.museum":1,"exhibition.museum":1,"exnet.su":1,"experts-comptables.fr":1,"express.aero":1,"f.bg":1,"f.se":1,"fam.pk":1,"family.museum":1,"familyds.com":1,"familyds.net":1,"familyds.org":1,"fantasyleague.cc":1,"far.br":1,"farm.museum":1,"farmequipment.museum":1,"farmers.museum":1,"farmstead.museum":1,"farsund.no":1,"fastly-terrarium.com":1,"fastlylb.net":1,"fastpanel.direct":1,"fastvps-server.com":1,"fauske.no":1,"fbx-os.fr":1,"fbxos.fr":1,"fc.it":1,"fe.it":1,"fed.us":1,"federation.aero":1,"fedje.no":1,"fedorainfracloud.org":1,"fedorapeople.org":1,"feira.br":1,"fermo.it":1,"ferrara.it":1,"feste-ip.net":1,"fet.no":1,"fetsund.no":1,"fg.it":1,"fh.se":1,"fhapp.xyz":1,"fhs.no":1,"fhsk.se":1,"fhv.se":1,"fi.cr":1,"fi.eu.org":1,"fi.it":1,"fie.ee":1,"field.museum":1,"figueres.museum":1,"filatelia.museum":1,"filegear-au.me":1,"filegear-de.me":1,"filegear-gb.me":1,"filegear-ie.me":1,"filegear-jp.me":1,"filegear-sg.me":1,"filegear.me":1,"film.hu":1,"film.museum":1,"fin.ci":1,"fin.ec":1,"fin.tn":1,"fineart.museum":1,"finearts.museum":1,"finland.museum":1,"finnoy.no":1,"firebaseapp.com":1,"firenze.it":1,"firewall-gateway.com":1,"firewall-gateway.de":1,"firewall-gateway.net":1,"firm.co":1,"firm.dk":1,"firm.ht":1,"firm.in":1,"firm.nf":1,"firm.ng":1,"firm.ro":1,"firm.ve":1,"fitjar.no":1,"fj":2,"fj.cn":1,"fjaler.no":1,"fjell.no":1,"fk":2,"fl.us":1,"fla.no":1,"flakstad.no":1,"flanders.museum":1,"flatanger.no":1,"flekkefjord.no":1,"flesberg.no":1,"flight.aero":1,"flog.br":1,"flora.no":1,"florence.it":1,"florida.museum":1,"floripa.br":1,"floro.no":1,"flt.cloud.muni.cz":1,"flynnhosting.net":1,"flynnhub.com":1,"fm.br":1,"fm.it":1,"fm.no":1,"fnd.br":1,"foggia.it":1,"folkebibl.no":1,"folldal.no":1,"for-better.biz":1,"for-more.biz":1,"for-our.info":1,"for-some.biz":1,"for-the.biz":1,"for.men":1,"for.mom":1,"for.one":1,"for.sale":1,"force.museum":1,"forde.no":1,"forgot.her.name":1,"forgot.his.name":1,"forli-cesena.it":1,"forlicesena.it":1,"forsand.no":1,"fortal.br":1,"fortmissoula.museum":1,"fortworth.museum":1,"forum.hu":1,"forumz.info":1,"fosnes.no":1,"fot.br":1,"foundation.museum":1,"foz.br":1,"fr.eu.org":1,"fr.it":1,"frana.no":1,"francaise.museum":1,"frankfurt.museum":1,"franziskaner.museum":1,"fredrikstad.no":1,"free.hr":1,"freebox-os.com":1,"freebox-os.fr":1,"freeboxos.com":1,"freeboxos.fr":1,"freeddns.org":1,"freeddns.us":1,"freedesktop.org":1,"freemasonry.museum":1,"freesite.host":1,"freetls.fastly.net":1,"frei.no":1,"freiburg.museum":1,"freight.aero":1,"fribourg.museum":1,"friuli-v-giulia.it":1,"friuli-ve-giulia.it":1,"friuli-vegiulia.it":1,"friuli-venezia-giulia.it":1,"friuli-veneziagiulia.it":1,"friuli-vgiulia.it":1,"friuliv-giulia.it":1,"friulive-giulia.it":1,"friulivegiulia.it":1,"friulivenezia-giulia.it":1,"friuliveneziagiulia.it":1,"friulivgiulia.it":1,"frog.museum":1,"frogn.no":1,"froland.no":1,"from-ak.com":1,"from-al.com":1,"from-ar.com":1,"from-az.net":1,"from-ca.com":1,"from-co.net":1,"from-ct.com":1,"from-dc.com":1,"from-de.com":1,"from-fl.com":1,"from-ga.com":1,"from-hi.com":1,"from-ia.com":1,"from-id.com":1,"from-il.com":1,"from-in.com":1,"from-ks.com":1,"from-ky.com":1,"from-la.net":1,"from-ma.com":1,"from-md.com":1,"from-me.org":1,"from-mi.com":1,"from-mn.com":1,"from-mo.com":1,"from-ms.com":1,"from-mt.com":1,"from-nc.com":1,"from-nd.com":1,"from-ne.com":1,"from-nh.com":1,"from-nj.com":1,"from-nm.com":1,"from-nv.com":1,"from-ny.net":1,"from-oh.com":1,"from-ok.com":1,"from-or.com":1,"from-pa.com":1,"from-pr.com":1,"from-ri.com":1,"from-sc.com":1,"from-sd.com":1,"from-tn.com":1,"from-tx.com":1,"from-ut.com":1,"from-va.com":1,"from-vt.com":1,"from-wa.com":1,"from-wi.com":1,"from-wv.com":1,"from-wy.com":1,"from.hr":1,"frosinone.it":1,"frosta.no":1,"froya.no":1,"fst.br":1,"ftpaccess.cc":1,"fuchu.hiroshima.jp":1,"fuchu.tokyo.jp":1,"fuchu.toyama.jp":1,"fudai.iwate.jp":1,"fuefuki.yamanashi.jp":1,"fuel.aero":1,"fuettertdasnetz.de":1,"fuji.shizuoka.jp":1,"fujieda.shizuoka.jp":1,"fujiidera.osaka.jp":1,"fujikawa.shizuoka.jp":1,"fujikawa.yamanashi.jp":1,"fujikawaguchiko.yamanashi.jp":1,"fujimi.nagano.jp":1,"fujimi.saitama.jp":1,"fujimino.saitama.jp":1,"fujinomiya.shizuoka.jp":1,"fujioka.gunma.jp":1,"fujisato.akita.jp":1,"fujisawa.iwate.jp":1,"fujisawa.kanagawa.jp":1,"fujishiro.ibaraki.jp":1,"fujiyoshida.yamanashi.jp":1,"fukagawa.hokkaido.jp":1,"fukaya.saitama.jp":1,"fukuchi.fukuoka.jp":1,"fukuchiyama.kyoto.jp":1,"fukudomi.saga.jp":1,"fukui.fukui.jp":1,"fukui.jp":1,"fukumitsu.toyama.jp":1,"fukuoka.jp":1,"fukuroi.shizuoka.jp":1,"fukusaki.hyogo.jp":1,"fukushima.fukushima.jp":1,"fukushima.hokkaido.jp":1,"fukushima.jp":1,"fukuyama.hiroshima.jp":1,"funabashi.chiba.jp":1,"funagata.yamagata.jp":1,"funahashi.toyama.jp":1,"fundacio.museum":1,"fuoisku.no":1,"fuossko.no":1,"furano.hokkaido.jp":1,"furniture.museum":1,"furubira.hokkaido.jp":1,"furudono.fukushima.jp":1,"furukawa.miyagi.jp":1,"fusa.no":1,"fuso.aichi.jp":1,"fussa.tokyo.jp":1,"futaba.fukushima.jp":1,"futsu.nagasaki.jp":1,"futtsu.chiba.jp":1,"futurecms.at":2,"futurehosting.at":1,"futuremailing.at":1,"fvg.it":1,"fylkesbibl.no":1,"fyresdal.no":1,"g.bg":1,"g.se":1,"g12.br":1,"ga.us":1,"gaivuotna.no":1,"gallery.museum":1,"galsa.no":1,"gamagori.aichi.jp":1,"game-host.org":1,"game-server.cc":1,"game.tw":1,"games.hu":1,"gamo.shiga.jp":1,"gamvik.no":1,"gangaviika.no":1,"gangwon.kr":1,"garden.museum":1,"gateway.museum":1,"gaular.no":1,"gausdal.no":1,"gb.com":1,"gb.net":1,"gc.ca":1,"gd.cn":1,"gda.pl":1,"gdansk.pl":1,"gdynia.pl":1,"ge.it":1,"geek.nz":1,"geekgalaxy.com":1,"geelvinck.museum":1,"gehirn.ne.jp":1,"geisei.kochi.jp":1,"gemological.museum":1,"gen.in":1,"gen.mi.us":1,"gen.ng":1,"gen.nz":1,"gen.tr":1,"genkai.saga.jp":1,"genoa.it":1,"genova.it":1,"geology.museum":1,"geometre-expert.fr":1,"georgia.museum":1,"georgia.su":1,"getmyip.com":1,"gets-it.net":1,"ggf.br":1,"giehtavuoatna.no":1,"giessen.museum":1,"gifu.gifu.jp":1,"gifu.jp":1,"giize.com":1,"gildeskal.no":1,"ginan.gifu.jp":1,"ginowan.okinawa.jp":1,"ginoza.okinawa.jp":1,"giske.no":1,"git-pages.rit.edu":1,"git-repos.de":1,"github.io":1,"githubusercontent.com":1,"gitlab.io":1,"gjemnes.no":1,"gjerdrum.no":1,"gjerstad.no":1,"gjesdal.no":1,"gjovik.no":1,"glas.museum":1,"glass.museum":1,"gleeze.com":1,"gliding.aero":1,"glitch.me":1,"gliwice.pl":1,"global.prod.fastly.net":1,"global.ssl.fastly.net":1,"glogow.pl":1,"gloppen.no":1,"glug.org.uk":1,"gmina.pl":1,"gniezno.pl":1,"go-vip.co":1,"go-vip.net":1,"go.ci":1,"go.cr":1,"go.dyndns.org":1,"go.gov.br":1,"go.id":1,"go.it":1,"go.jp":1,"go.ke":1,"go.kr":1,"go.leg.br":1,"go.pw":1,"go.th":1,"go.tj":1,"go.tz":1,"go.ug":1,"gob.ar":1,"gob.bo":1,"gob.cl":1,"gob.do":1,"gob.ec":1,"gob.es":1,"gob.gt":1,"gob.hn":1,"gob.mx":1,"gob.ni":1,"gob.pa":1,"gob.pe":1,"gob.pk":1,"gob.sv":1,"gob.ve":1,"gobo.wakayama.jp":1,"godo.gifu.jp":1,"goiania.br":1,"goip.de":1,"gojome.akita.jp":1,"gok.pk":1,"gokase.miyazaki.jp":1,"gol.no":1,"golffan.us":1,"gon.pk":1,"gonohe.aomori.jp":1,"googleapis.com":1,"googlecode.com":1,"gop.pk":1,"gorge.museum":1,"gorizia.it":1,"gorlice.pl":1,"gos.pk":1,"gose.nara.jp":1,"gosen.niigata.jp":1,"goshiki.hyogo.jp":1,"gotdns.ch":1,"gotdns.com":1,"gotdns.org":1,"gotemba.shizuoka.jp":1,"goto.nagasaki.jp":1,"gotpantheon.com":1,"gotsu.shimane.jp":1,"gouv.bj":1,"gouv.ci":1,"gouv.fr":1,"gouv.ht":1,"gouv.km":1,"gouv.ml":1,"gouv.sn":1,"gov.ac":1,"gov.ae":1,"gov.af":1,"gov.al":1,"gov.ar":1,"gov.as":1,"gov.au":1,"gov.az":1,"gov.ba":1,"gov.bb":1,"gov.bf":1,"gov.bh":1,"gov.bm":1,"gov.bn":1,"gov.br":1,"gov.bs":1,"gov.bt":1,"gov.by":1,"gov.bz":1,"gov.cd":1,"gov.cl":1,"gov.cm":1,"gov.cn":1,"gov.co":1,"gov.cu":1,"gov.cx":1,"gov.cy":1,"gov.dm":1,"gov.do":1,"gov.dz":1,"gov.ec":1,"gov.ee":1,"gov.eg":1,"gov.et":1,"gov.ge":1,"gov.gh":1,"gov.gi":1,"gov.gn":1,"gov.gr":1,"gov.gu":1,"gov.gy":1,"gov.hk":1,"gov.ie":1,"gov.il":1,"gov.in":1,"gov.iq":1,"gov.ir":1,"gov.is":1,"gov.it":1,"gov.jo":1,"gov.kg":1,"gov.ki":1,"gov.km":1,"gov.kn":1,"gov.kp":1,"gov.kw":1,"gov.ky":1,"gov.kz":1,"gov.la":1,"gov.lb":1,"gov.lc":1,"gov.lk":1,"gov.lr":1,"gov.ls":1,"gov.lt":1,"gov.lv":1,"gov.ly":1,"gov.ma":1,"gov.me":1,"gov.mg":1,"gov.mk":1,"gov.ml":1,"gov.mn":1,"gov.mo":1,"gov.mr":1,"gov.ms":1,"gov.mu":1,"gov.mv":1,"gov.mw":1,"gov.my":1,"gov.mz":1,"gov.nc.tr":1,"gov.ng":1,"gov.nr":1,"gov.om":1,"gov.ph":1,"gov.pk":1,"gov.pl":1,"gov.pn":1,"gov.pr":1,"gov.ps":1,"gov.pt":1,"gov.py":1,"gov.qa":1,"gov.rs":1,"gov.ru":1,"gov.rw":1,"gov.sa":1,"gov.sb":1,"gov.sc":1,"gov.sd":1,"gov.sg":1,"gov.sh":1,"gov.sl":1,"gov.st":1,"gov.sx":1,"gov.sy":1,"gov.tj":1,"gov.tl":1,"gov.tm":1,"gov.tn":1,"gov.to":1,"gov.tr":1,"gov.tt":1,"gov.tw":1,"gov.ua":1,"gov.uk":1,"gov.vc":1,"gov.ve":1,"gov.vn":1,"gov.ws":1,"gov.za":1,"gov.zm":1,"gov.zw":1,"government.aero":1,"govt.nz":1,"gr.com":1,"gr.eu.org":1,"gr.it":1,"gr.jp":1,"grajewo.pl":1,"gran.no":1,"grandrapids.museum":1,"grane.no":1,"granvin.no":1,"gratangen.no":1,"graz.museum":1,"greta.fr":1,"grimstad.no":1,"griw.gov.pl":1,"groks-the.info":1,"groks-this.info":1,"grondar.za":1,"grong.no":1,"grosseto.it":1,"groundhandling.aero":1,"group.aero":1,"grozny.ru":1,"grozny.su":1,"grp.lk":1,"gru.br":1,"grue.no":1,"gs.aa.no":1,"gs.ah.no":1,"gs.bu.no":1,"gs.cn":1,"gs.fm.no":1,"gs.hl.no":1,"gs.hm.no":1,"gs.jan-mayen.no":1,"gs.mr.no":1,"gs.nl.no":1,"gs.nt.no":1,"gs.of.no":1,"gs.ol.no":1,"gs.oslo.no":1,"gs.rl.no":1,"gs.sf.no":1,"gs.st.no":1,"gs.svalbard.no":1,"gs.tm.no":1,"gs.tr.no":1,"gs.va.no":1,"gs.vf.no":1,"gsm.pl":1,"gu.us":1,"guam.gu":1,"gub.uy":1,"guernsey.museum":1,"gujo.gifu.jp":1,"gulen.no":1,"gunma.jp":1,"guovdageaidnu.no":1,"gushikami.okinawa.jp":1,"gv.ao":1,"gv.at":1,"gv.vc":1,"gwangju.kr":1,"gwiddle.co.uk":1,"gx.cn":1,"gyeongbuk.kr":1,"gyeonggi.kr":1,"gyeongnam.kr":1,"gyokuto.kumamoto.jp":1,"gz.cn":1,"h.bg":1,"h.se":1,"ha.cn":1,"ha.no":1,"habikino.osaka.jp":1,"habmer.no":1,"haboro.hokkaido.jp":1,"hachijo.tokyo.jp":1,"hachinohe.aomori.jp":1,"hachioji.tokyo.jp":1,"hachirogata.akita.jp":1,"hadano.kanagawa.jp":1,"hadsel.no":1,"haebaru.okinawa.jp":1,"haga.tochigi.jp":1,"hagebostad.no":1,"hagi.yamaguchi.jp":1,"haibara.shizuoka.jp":1,"hakata.fukuoka.jp":1,"hakodate.hokkaido.jp":1,"hakone.kanagawa.jp":1,"hakuba.nagano.jp":1,"hakui.ishikawa.jp":1,"hakusan.ishikawa.jp":1,"halden.no":1,"half.host":1,"halloffame.museum":1,"halsa.no":1,"ham-radio-op.net":1,"hamada.shimane.jp":1,"hamamatsu.shizuoka.jp":1,"hamar.no":1,"hamaroy.no":1,"hamatama.saga.jp":1,"hamatonbetsu.hokkaido.jp":1,"hamburg.museum":1,"hammarfeasta.no":1,"hammerfest.no":1,"hamura.tokyo.jp":1,"hanamaki.iwate.jp":1,"hanamigawa.chiba.jp":1,"hanawa.fukushima.jp":1,"handa.aichi.jp":1,"handson.museum":1,"hanggliding.aero":1,"hannan.osaka.jp":1,"hanno.saitama.jp":1,"hanyu.saitama.jp":1,"hapmir.no":1,"happou.akita.jp":1,"hara.nagano.jp":1,"haram.no":1,"hareid.no":1,"harima.hyogo.jp":1,"harstad.no":1,"harvestcelebration.museum":1,"hasama.oita.jp":1,"hasami.nagasaki.jp":1,"hashbang.sh":1,"hashikami.aomori.jp":1,"hashima.gifu.jp":1,"hashimoto.wakayama.jp":1,"hasuda.saitama.jp":1,"hasura-app.io":1,"hasura.app":1,"hasvik.no":1,"hatogaya.saitama.jp":1,"hatoyama.saitama.jp":1,"hatsukaichi.hiroshima.jp":1,"hattfjelldal.no":1,"haugesund.no":1,"hawaii.museum":1,"hayakawa.yamanashi.jp":1,"hayashima.okayama.jp":1,"hazu.aichi.jp":1,"hb.cldmail.ru":1,"hb.cn":1,"he.cn":1,"health-carereform.com":1,"health.museum":1,"health.nz":1,"health.vn":1,"heguri.nara.jp":1,"heimatunduhren.museum":1,"hekinan.aichi.jp":1,"hellas.museum":1,"helsinki.museum":1,"hembygdsforbund.museum":1,"hemne.no":1,"hemnes.no":1,"hemsedal.no":1,"hepforge.org":1,"herad.no":1,"here-for-more.info":1,"heritage.museum":1,"herokuapp.com":1,"herokussl.com":1,"heroy.more-og-romsdal.no":1,"heroy.nordland.no":1,"hi.cn":1,"hi.us":1,"hicam.net":1,"hichiso.gifu.jp":1,"hida.gifu.jp":1,"hidaka.hokkaido.jp":1,"hidaka.kochi.jp":1,"hidaka.saitama.jp":1,"hidaka.wakayama.jp":1,"higashi.fukuoka.jp":1,"higashi.fukushima.jp":1,"higashi.okinawa.jp":1,"higashiagatsuma.gunma.jp":1,"higashichichibu.saitama.jp":1,"higashihiroshima.hiroshima.jp":1,"higashiizu.shizuoka.jp":1,"higashiizumo.shimane.jp":1,"higashikagawa.kagawa.jp":1,"higashikagura.hokkaido.jp":1,"higashikawa.hokkaido.jp":1,"higashikurume.tokyo.jp":1,"higashimatsushima.miyagi.jp":1,"higashimatsuyama.saitama.jp":1,"higashimurayama.tokyo.jp":1,"higashinaruse.akita.jp":1,"higashine.yamagata.jp":1,"higashiomi.shiga.jp":1,"higashiosaka.osaka.jp":1,"higashishirakawa.gifu.jp":1,"higashisumiyoshi.osaka.jp":1,"higashitsuno.kochi.jp":1,"higashiura.aichi.jp":1,"higashiyama.kyoto.jp":1,"higashiyamato.tokyo.jp":1,"higashiyodogawa.osaka.jp":1,"higashiyoshino.nara.jp":1,"hiji.oita.jp":1,"hikari.yamaguchi.jp":1,"hikawa.shimane.jp":1,"hikimi.shimane.jp":1,"hikone.shiga.jp":1,"himeji.hyogo.jp":1,"himeshima.oita.jp":1,"himi.toyama.jp":1,"hino.tokyo.jp":1,"hino.tottori.jp":1,"hinode.tokyo.jp":1,"hinohara.tokyo.jp":1,"hioki.kagoshima.jp":1,"hirado.nagasaki.jp":1,"hiraizumi.iwate.jp":1,"hirakata.osaka.jp":1,"hiranai.aomori.jp":1,"hirara.okinawa.jp":1,"hirata.fukushima.jp":1,"hiratsuka.kanagawa.jp":1,"hiraya.nagano.jp":1,"hirogawa.wakayama.jp":1,"hirokawa.fukuoka.jp":1,"hirono.fukushima.jp":1,"hirono.iwate.jp":1,"hiroo.hokkaido.jp":1,"hirosaki.aomori.jp":1,"hiroshima.jp":1,"hisayama.fukuoka.jp":1,"histoire.museum":1,"historical.museum":1,"historicalsociety.museum":1,"historichouses.museum":1,"historisch.museum":1,"historisches.museum":1,"history.museum":1,"historyofscience.museum":1,"hita.oita.jp":1,"hitachi.ibaraki.jp":1,"hitachinaka.ibaraki.jp":1,"hitachiomiya.ibaraki.jp":1,"hitachiota.ibaraki.jp":1,"hitra.no":1,"hizen.saga.jp":1,"hjartdal.no":1,"hjelmeland.no":1,"hk.cn":1,"hk.com":1,"hk.org":1,"hl.cn":1,"hl.no":1,"hm.no":1,"hn.cn":1,"hobby-site.com":1,"hobby-site.org":1,"hobol.no":1,"hof.no":1,"hofu.yamaguchi.jp":1,"hokkaido.jp":1,"hokksund.no":1,"hokuryu.hokkaido.jp":1,"hokuto.hokkaido.jp":1,"hokuto.yamanashi.jp":1,"hol.no":1,"hole.no":1,"holmestrand.no":1,"holtalen.no":1,"home-webserver.de":1,"home.dyndns.org":1,"homebuilt.aero":1,"homedns.org":1,"homeftp.net":1,"homeftp.org":1,"homeip.net":1,"homelink.one":1,"homelinux.com":1,"homelinux.net":1,"homelinux.org":1,"homeoffice.gov.uk":1,"homesecuritymac.com":1,"homesecuritypc.com":1,"homeunix.com":1,"homeunix.net":1,"homeunix.org":1,"honai.ehime.jp":1,"honbetsu.hokkaido.jp":1,"honefoss.no":1,"hongo.hiroshima.jp":1,"honjo.akita.jp":1,"honjo.saitama.jp":1,"honjyo.akita.jp":1,"hopto.me":1,"hopto.org":1,"hornindal.no":1,"horokanai.hokkaido.jp":1,"horology.museum":1,"horonobe.hokkaido.jp":1,"horten.no":1,"hosting-cluster.nl":1,"hosting.myjino.ru":2,"hotel.hu":1,"hotel.lk":1,"hotel.tz":1,"house.museum":1,"hoyanger.no":1,"hoylandet.no":1,"hr.eu.org":1,"hs.kr":1,"hs.run":1,"hs.zone":1,"hu.com":1,"hu.eu.org":1,"hu.net":1,"huissier-justice.fr":1,"humanities.museum":1,"hurdal.no":1,"hurum.no":1,"hvaler.no":1,"hyllestad.no":1,"hyogo.jp":1,"hyuga.miyazaki.jp":1,"hzc.io":1,"i.bg":1,"i.ng":1,"i.ph":1,"i.se":1,"i234.me":1,"ia.us":1,"iamallama.com":1,"ibara.okayama.jp":1,"ibaraki.ibaraki.jp":1,"ibaraki.jp":1,"ibaraki.osaka.jp":1,"ibestad.no":1,"ibigawa.gifu.jp":1,"ic.gov.pl":1,"ichiba.tokushima.jp":1,"ichihara.chiba.jp":1,"ichikai.tochigi.jp":1,"ichikawa.chiba.jp":1,"ichikawa.hyogo.jp":1,"ichikawamisato.yamanashi.jp":1,"ichinohe.iwate.jp":1,"ichinomiya.aichi.jp":1,"ichinomiya.chiba.jp":1,"ichinoseki.iwate.jp":1,"id.au":1,"id.ir":1,"id.lv":1,"id.ly":1,"id.us":1,"ide.kyoto.jp":1,"idf.il":1,"idrett.no":1,"idv.hk":1,"idv.tw":1,"ie.eu.org":1,"if.ua":1,"iglesias-carbonia.it":1,"iglesiascarbonia.it":1,"iheya.okinawa.jp":1,"iida.nagano.jp":1,"iide.yamagata.jp":1,"iijima.nagano.jp":1,"iitate.fukushima.jp":1,"iiyama.nagano.jp":1,"iizuka.fukuoka.jp":1,"iizuna.nagano.jp":1,"ikaruga.nara.jp":1,"ikata.ehime.jp":1,"ikawa.akita.jp":1,"ikeda.fukui.jp":1,"ikeda.gifu.jp":1,"ikeda.hokkaido.jp":1,"ikeda.nagano.jp":1,"ikeda.osaka.jp":1,"iki.fi":1,"iki.nagasaki.jp":1,"ikoma.nara.jp":1,"ikusaka.nagano.jp":1,"il.eu.org":1,"il.us":1,"ilawa.pl":1,"illustration.museum":1,"ilovecollege.info":1,"im.it":1,"imabari.ehime.jp":1,"imageandsound.museum":1,"imakane.hokkaido.jp":1,"imari.saga.jp":1,"imb.br":1,"imizu.toyama.jp":1,"imperia.it":1,"in-addr.arpa":1,"in-berlin.de":1,"in-brb.de":1,"in-butter.de":1,"in-dsl.de":1,"in-dsl.net":1,"in-dsl.org":1,"in-the-band.net":1,"in-vpn.de":1,"in-vpn.net":1,"in-vpn.org":1,"in.eu.org":1,"in.futurecms.at":2,"in.london":1,"in.na":1,"in.net":1,"in.ni":1,"in.rs":1,"in.th":1,"in.ua":1,"in.us":1,"ina.ibaraki.jp":1,"ina.nagano.jp":1,"ina.saitama.jp":1,"inabe.mie.jp":1,"inagawa.hyogo.jp":1,"inagi.tokyo.jp":1,"inami.toyama.jp":1,"inami.wakayama.jp":1,"inashiki.ibaraki.jp":1,"inatsuki.fukuoka.jp":1,"inawashiro.fukushima.jp":1,"inazawa.aichi.jp":1,"inc.hk":1,"incheon.kr":1,"ind.br":1,"ind.gt":1,"ind.in":1,"ind.kw":1,"ind.tn":1,"inderoy.no":1,"indian.museum":1,"indiana.museum":1,"indianapolis.museum":1,"indianmarket.museum":1,"indigena.bo":1,"industria.bo":1,"ine.kyoto.jp":1,"inf.br":1,"inf.cu":1,"inf.mk":1,"inf.ua":1,"info.at":1,"info.au":1,"info.az":1,"info.bb":1,"info.bo":1,"info.co":1,"info.cx":1,"info.ec":1,"info.et":1,"info.gu":1,"info.ht":1,"info.hu":1,"info.ke":1,"info.ki":1,"info.la":1,"info.ls":1,"info.mv":1,"info.na":1,"info.nf":1,"info.ni":1,"info.nr":1,"info.pk":1,"info.pl":1,"info.pr":1,"info.ro":1,"info.sd":1,"info.tn":1,"info.tr":1,"info.tt":1,"info.tz":1,"info.ve":1,"info.vn":1,"info.zm":1,"ing.pa":1,"ingatlan.hu":1,"ino.kochi.jp":1,"instantcloud.cn":1,"insurance.aero":1,"int.ar":1,"int.az":1,"int.bo":1,"int.ci":1,"int.co":1,"int.eu.org":1,"int.is":1,"int.la":1,"int.lk":1,"int.mv":1,"int.mw":1,"int.ni":1,"int.pt":1,"int.ru":1,"int.tj":1,"int.tt":1,"int.ve":1,"int.vn":1,"intelligence.museum":1,"interactive.museum":1,"internet-dns.de":1,"intl.tn":1,"inuyama.aichi.jp":1,"inzai.chiba.jp":1,"iobb.net":1,"ip6.arpa":1,"ipifony.net":1,"iraq.museum":1,"iris.arpa":1,"iron.museum":1,"iruma.saitama.jp":1,"is-a-anarchist.com":1,"is-a-blogger.com":1,"is-a-bookkeeper.com":1,"is-a-bruinsfan.org":1,"is-a-bulls-fan.com":1,"is-a-candidate.org":1,"is-a-caterer.com":1,"is-a-celticsfan.org":1,"is-a-chef.com":1,"is-a-chef.net":1,"is-a-chef.org":1,"is-a-conservative.com":1,"is-a-cpa.com":1,"is-a-cubicle-slave.com":1,"is-a-democrat.com":1,"is-a-designer.com":1,"is-a-doctor.com":1,"is-a-financialadvisor.com":1,"is-a-geek.com":1,"is-a-geek.net":1,"is-a-geek.org":1,"is-a-green.com":1,"is-a-guru.com":1,"is-a-hard-worker.com":1,"is-a-hunter.com":1,"is-a-knight.org":1,"is-a-landscaper.com":1,"is-a-lawyer.com":1,"is-a-liberal.com":1,"is-a-libertarian.com":1,"is-a-linux-user.org":1,"is-a-llama.com":1,"is-a-musician.com":1,"is-a-nascarfan.com":1,"is-a-nurse.com":1,"is-a-painter.com":1,"is-a-patsfan.org":1,"is-a-personaltrainer.com":1,"is-a-photographer.com":1,"is-a-player.com":1,"is-a-republican.com":1,"is-a-rockstar.com":1,"is-a-socialist.com":1,"is-a-soxfan.org":1,"is-a-student.com":1,"is-a-teacher.com":1,"is-a-techie.com":1,"is-a-therapist.com":1,"is-an-accountant.com":1,"is-an-actor.com":1,"is-an-actress.com":1,"is-an-anarchist.com":1,"is-an-artist.com":1,"is-an-engineer.com":1,"is-an-entertainer.com":1,"is-by.us":1,"is-certified.com":1,"is-found.org":1,"is-gone.com":1,"is-into-anime.com":1,"is-into-cars.com":1,"is-into-cartoons.com":1,"is-into-games.com":1,"is-leet.com":1,"is-lost.org":1,"is-not-certified.com":1,"is-saved.org":1,"is-slick.com":1,"is-uberleet.com":1,"is-very-bad.org":1,"is-very-evil.org":1,"is-very-good.org":1,"is-very-nice.org":1,"is-very-sweet.org":1,"is-with-theband.com":1,"is.eu.org":1,"is.gov.pl":1,"is.it":1,"isa-geek.com":1,"isa-geek.net":1,"isa-geek.org":1,"isa-hockeynut.com":1,"isa.kagoshima.jp":1,"isa.us":1,"isahaya.nagasaki.jp":1,"ise.mie.jp":1,"isehara.kanagawa.jp":1,"isen.kagoshima.jp":1,"isernia.it":1,"iserv.dev":1,"isesaki.gunma.jp":1,"ishigaki.okinawa.jp":1,"ishikari.hokkaido.jp":1,"ishikawa.fukushima.jp":1,"ishikawa.jp":1,"ishikawa.okinawa.jp":1,"ishinomaki.miyagi.jp":1,"isla.pr":1,"isleofman.museum":1,"isshiki.aichi.jp":1,"issmarterthanyou.com":1,"isteingeek.de":1,"istmein.de":1,"isumi.chiba.jp":1,"it.ao":1,"it.eu.org":1,"itabashi.tokyo.jp":1,"itako.ibaraki.jp":1,"itakura.gunma.jp":1,"itami.hyogo.jp":1,"itano.tokushima.jp":1,"itayanagi.aomori.jp":1,"ito.shizuoka.jp":1,"itoigawa.niigata.jp":1,"itoman.okinawa.jp":1,"its.me":1,"ivano-frankivsk.ua":1,"ivanovo.su":1,"iveland.no":1,"ivgu.no":1,"iwade.wakayama.jp":1,"iwafune.tochigi.jp":1,"iwaizumi.iwate.jp":1,"iwaki.fukushima.jp":1,"iwakuni.yamaguchi.jp":1,"iwakura.aichi.jp":1,"iwama.ibaraki.jp":1,"iwamizawa.hokkaido.jp":1,"iwanai.hokkaido.jp":1,"iwanuma.miyagi.jp":1,"iwata.shizuoka.jp":1,"iwate.iwate.jp":1,"iwate.jp":1,"iwatsuki.saitama.jp":1,"iwi.nz":1,"iyo.ehime.jp":1,"iz.hr":1,"izena.okinawa.jp":1,"izu.shizuoka.jp":1,"izumi.kagoshima.jp":1,"izumi.osaka.jp":1,"izumiotsu.osaka.jp":1,"izumisano.osaka.jp":1,"izumizaki.fukushima.jp":1,"izumo.shimane.jp":1,"izumozaki.niigata.jp":1,"izunokuni.shizuoka.jp":1,"j.bg":1,"jab.br":1,"jambyl.su":1,"jamison.museum":1,"jampa.br":1,"jan-mayen.no":1,"jaworzno.pl":1,"jdevcloud.com":1,"jdf.br":1,"jefferson.museum":1,"jeju.kr":1,"jelenia-gora.pl":1,"jeonbuk.kr":1,"jeonnam.kr":1,"jerusalem.museum":1,"jessheim.no":1,"jevnaker.no":1,"jewelry.museum":1,"jewish.museum":1,"jewishart.museum":1,"jfk.museum":1,"jgora.pl":1,"jinsekikogen.hiroshima.jp":1,"jl.cn":1,"jm":2,"joboji.iwate.jp":1,"jobs.tt":1,"joetsu.niigata.jp":1,"jogasz.hu":1,"johana.toyama.jp":1,"joinville.br":1,"jolster.no":1,"jondal.no":1,"jor.br":1,"jorpeland.no":1,"joso.ibaraki.jp":1,"journal.aero":1,"journalism.museum":1,"journalist.aero":1,"joyo.kyoto.jp":1,"jp.eu.org":1,"jp.net":1,"jpn.com":1,"js.cn":1,"js.org":1,"judaica.museum":1,"judygarland.museum":1,"juedisches.museum":1,"juif.museum":1,"jur.pro":1,"jus.br":1,"jx.cn":1,"k.bg":1,"k.se":1,"k12.ak.us":1,"k12.al.us":1,"k12.ar.us":1,"k12.as.us":1,"k12.az.us":1,"k12.ca.us":1,"k12.co.us":1,"k12.ct.us":1,"k12.dc.us":1,"k12.de.us":1,"k12.ec":1,"k12.fl.us":1,"k12.ga.us":1,"k12.gu.us":1,"k12.ia.us":1,"k12.id.us":1,"k12.il":1,"k12.il.us":1,"k12.in.us":1,"k12.ks.us":1,"k12.ky.us":1,"k12.la.us":1,"k12.ma.us":1,"k12.md.us":1,"k12.me.us":1,"k12.mi.us":1,"k12.mn.us":1,"k12.mo.us":1,"k12.ms.us":1,"k12.mt.us":1,"k12.nc.us":1,"k12.ne.us":1,"k12.nh.us":1,"k12.nj.us":1,"k12.nm.us":1,"k12.nv.us":1,"k12.ny.us":1,"k12.oh.us":1,"k12.ok.us":1,"k12.or.us":1,"k12.pa.us":1,"k12.pr.us":1,"k12.ri.us":1,"k12.sc.us":1,"k12.tn.us":1,"k12.tr":1,"k12.tx.us":1,"k12.ut.us":1,"k12.va.us":1,"k12.vi":1,"k12.vi.us":1,"k12.vt.us":1,"k12.wa.us":1,"k12.wi.us":1,"k12.wy.us":1,"kaas.gg":1,"kadena.okinawa.jp":1,"kadogawa.miyazaki.jp":1,"kadoma.osaka.jp":1,"kafjord.no":1,"kaga.ishikawa.jp":1,"kagami.kochi.jp":1,"kagamiishi.fukushima.jp":1,"kagamino.okayama.jp":1,"kagawa.jp":1,"kagoshima.jp":1,"kagoshima.kagoshima.jp":1,"kaho.fukuoka.jp":1,"kahoku.ishikawa.jp":1,"kahoku.yamagata.jp":1,"kai.yamanashi.jp":1,"kainan.tokushima.jp":1,"kainan.wakayama.jp":1,"kaisei.kanagawa.jp":1,"kaita.hiroshima.jp":1,"kaizuka.osaka.jp":1,"kakamigahara.gifu.jp":1,"kakegawa.shizuoka.jp":1,"kakinoki.shimane.jp":1,"kakogawa.hyogo.jp":1,"kakuda.miyagi.jp":1,"kalisz.pl":1,"kalmykia.ru":1,"kalmykia.su":1,"kaluga.su":1,"kamagaya.chiba.jp":1,"kamaishi.iwate.jp":1,"kamakura.kanagawa.jp":1,"kameoka.kyoto.jp":1,"kameyama.mie.jp":1,"kami.kochi.jp":1,"kami.miyagi.jp":1,"kamiamakusa.kumamoto.jp":1,"kamifurano.hokkaido.jp":1,"kamigori.hyogo.jp":1,"kamiichi.toyama.jp":1,"kamiizumi.saitama.jp":1,"kamijima.ehime.jp":1,"kamikawa.hokkaido.jp":1,"kamikawa.hyogo.jp":1,"kamikawa.saitama.jp":1,"kamikitayama.nara.jp":1,"kamikoani.akita.jp":1,"kamimine.saga.jp":1,"kaminokawa.tochigi.jp":1,"kaminoyama.yamagata.jp":1,"kamioka.akita.jp":1,"kamisato.saitama.jp":1,"kamishihoro.hokkaido.jp":1,"kamisu.ibaraki.jp":1,"kamisunagawa.hokkaido.jp":1,"kamitonda.wakayama.jp":1,"kamitsue.oita.jp":1,"kamo.kyoto.jp":1,"kamo.niigata.jp":1,"kamoenai.hokkaido.jp":1,"kamogawa.chiba.jp":1,"kanagawa.jp":1,"kanan.osaka.jp":1,"kanazawa.ishikawa.jp":1,"kanegasaki.iwate.jp":1,"kaneyama.fukushima.jp":1,"kaneyama.yamagata.jp":1,"kani.gifu.jp":1,"kanie.aichi.jp":1,"kanmaki.nara.jp":1,"kanna.gunma.jp":1,"kannami.shizuoka.jp":1,"kanonji.kagawa.jp":1,"kanoya.kagoshima.jp":1,"kanra.gunma.jp":1,"kanuma.tochigi.jp":1,"kanzaki.saga.jp":1,"karacol.su":1,"karaganda.su":1,"karasjohka.no":1,"karasjok.no":1,"karasuyama.tochigi.jp":1,"karate.museum":1,"karatsu.saga.jp":1,"karelia.su":1,"karikatur.museum":1,"kariwa.niigata.jp":1,"kariya.aichi.jp":1,"karlsoy.no":1,"karmoy.no":1,"karpacz.pl":1,"kartuzy.pl":1,"karuizawa.nagano.jp":1,"karumai.iwate.jp":1,"kasahara.gifu.jp":1,"kasai.hyogo.jp":1,"kasama.ibaraki.jp":1,"kasamatsu.gifu.jp":1,"kasaoka.okayama.jp":1,"kashiba.nara.jp":1,"kashihara.nara.jp":1,"kashima.ibaraki.jp":1,"kashima.saga.jp":1,"kashiwa.chiba.jp":1,"kashiwara.osaka.jp":1,"kashiwazaki.niigata.jp":1,"kasuga.fukuoka.jp":1,"kasuga.hyogo.jp":1,"kasugai.aichi.jp":1,"kasukabe.saitama.jp":1,"kasumigaura.ibaraki.jp":1,"kasuya.fukuoka.jp":1,"kaszuby.pl":1,"katagami.akita.jp":1,"katano.osaka.jp":1,"katashina.gunma.jp":1,"katori.chiba.jp":1,"katowice.pl":1,"katsuragi.nara.jp":1,"katsuragi.wakayama.jp":1,"katsushika.tokyo.jp":1,"katsuura.chiba.jp":1,"katsuyama.fukui.jp":1,"kautokeino.no":1,"kawaba.gunma.jp":1,"kawachinagano.osaka.jp":1,"kawagoe.mie.jp":1,"kawagoe.saitama.jp":1,"kawaguchi.saitama.jp":1,"kawahara.tottori.jp":1,"kawai.iwate.jp":1,"kawai.nara.jp":1,"kawajima.saitama.jp":1,"kawakami.nagano.jp":1,"kawakami.nara.jp":1,"kawakita.ishikawa.jp":1,"kawamata.fukushima.jp":1,"kawaminami.miyazaki.jp":1,"kawanabe.kagoshima.jp":1,"kawanehon.shizuoka.jp":1,"kawanishi.hyogo.jp":1,"kawanishi.nara.jp":1,"kawanishi.yamagata.jp":1,"kawara.fukuoka.jp":1,"kawasaki.jp":2,"kawasaki.miyagi.jp":1,"kawatana.nagasaki.jp":1,"kawaue.gifu.jp":1,"kawazu.shizuoka.jp":1,"kayabe.hokkaido.jp":1,"kazimierz-dolny.pl":1,"kazo.saitama.jp":1,"kazuno.akita.jp":1,"keisen.fukuoka.jp":1,"kembuchi.hokkaido.jp":1,"kep.tr":1,"kepno.pl":1,"ketrzyn.pl":1,"keymachine.de":1,"kg.kr":1,"kh":2,"kh.ua":1,"khakassia.su":1,"kharkiv.ua":1,"kharkov.ua":1,"kherson.ua":1,"khmelnitskiy.ua":1,"khmelnytskyi.ua":1,"khplay.nl":1,"kibichuo.okayama.jp":1,"kicks-ass.net":1,"kicks-ass.org":1,"kids.museum":1,"kids.us":1,"kiev.ua":1,"kiho.mie.jp":1,"kihoku.ehime.jp":1,"kijo.miyazaki.jp":1,"kikonai.hokkaido.jp":1,"kikuchi.kumamoto.jp":1,"kikugawa.shizuoka.jp":1,"kimino.wakayama.jp":1,"kimitsu.chiba.jp":1,"kimobetsu.hokkaido.jp":1,"kin.okinawa.jp":1,"kinghost.net":1,"kinko.kagoshima.jp":1,"kinokawa.wakayama.jp":1,"kira.aichi.jp":1,"kirkenes.no":1,"kirovograd.ua":1,"kiryu.gunma.jp":1,"kisarazu.chiba.jp":1,"kishiwada.osaka.jp":1,"kiso.nagano.jp":1,"kisofukushima.nagano.jp":1,"kisosaki.mie.jp":1,"kita.kyoto.jp":1,"kita.osaka.jp":1,"kita.tokyo.jp":1,"kitaaiki.nagano.jp":1,"kitaakita.akita.jp":1,"kitadaito.okinawa.jp":1,"kitagata.gifu.jp":1,"kitagata.saga.jp":1,"kitagawa.kochi.jp":1,"kitagawa.miyazaki.jp":1,"kitahata.saga.jp":1,"kitahiroshima.hokkaido.jp":1,"kitakami.iwate.jp":1,"kitakata.fukushima.jp":1,"kitakata.miyazaki.jp":1,"kitakyushu.jp":2,"kitami.hokkaido.jp":1,"kitamoto.saitama.jp":1,"kitanakagusuku.okinawa.jp":1,"kitashiobara.fukushima.jp":1,"kitaura.miyazaki.jp":1,"kitayama.wakayama.jp":1,"kiwa.mie.jp":1,"kiwi.nz":1,"kiyama.saga.jp":1,"kiyokawa.kanagawa.jp":1,"kiyosato.hokkaido.jp":1,"kiyose.tokyo.jp":1,"kiyosu.aichi.jp":1,"kizu.kyoto.jp":1,"klabu.no":1,"klepp.no":1,"klodzko.pl":1,"km.ua":1,"kmpsp.gov.pl":1,"knightpoint.systems":1,"knowsitall.info":1,"knx-server.net":1,"kobayashi.miyazaki.jp":1,"kobe.jp":2,"kobierzyce.pl":1,"kochi.jp":1,"kochi.kochi.jp":1,"kodaira.tokyo.jp":1,"koebenhavn.museum":1,"koeln.museum":1,"kofu.yamanashi.jp":1,"koga.fukuoka.jp":1,"koga.ibaraki.jp":1,"koganei.tokyo.jp":1,"koge.tottori.jp":1,"koka.shiga.jp":1,"kokonoe.oita.jp":1,"kokubunji.tokyo.jp":1,"kolobrzeg.pl":1,"komae.tokyo.jp":1,"komagane.nagano.jp":1,"komaki.aichi.jp":1,"komatsu.ishikawa.jp":1,"komatsushima.tokushima.jp":1,"komforb.se":1,"kommunalforbund.se":1,"kommune.no":1,"komono.mie.jp":1,"komoro.nagano.jp":1,"komvux.se":1,"konan.aichi.jp":1,"konan.shiga.jp":1,"kongsberg.no":1,"kongsvinger.no":1,"konin.pl":1,"konskowola.pl":1,"konsulat.gov.pl":1,"konyvelo.hu":1,"koori.fukushima.jp":1,"kopervik.no":1,"koriyama.fukushima.jp":1,"koryo.nara.jp":1,"kosai.shizuoka.jp":1,"kosaka.akita.jp":1,"kosei.shiga.jp":1,"koshigaya.saitama.jp":1,"koshimizu.hokkaido.jp":1,"koshu.yamanashi.jp":1,"kosuge.yamanashi.jp":1,"kota.aichi.jp":1,"koto.shiga.jp":1,"koto.tokyo.jp":1,"kotohira.kagawa.jp":1,"kotoura.tottori.jp":1,"kouhoku.saga.jp":1,"kounosu.saitama.jp":1,"kouyama.kagoshima.jp":1,"kouzushima.tokyo.jp":1,"koya.wakayama.jp":1,"koza.wakayama.jp":1,"kozagawa.wakayama.jp":1,"kozaki.chiba.jp":1,"kozow.com":1,"kppsp.gov.pl":1,"kr.com":1,"kr.eu.org":1,"kr.it":1,"kr.ua":1,"kraanghke.no":1,"kragero.no":1,"krakow.pl":1,"krasnik.pl":1,"krasnodar.su":1,"kristiansand.no":1,"kristiansund.no":1,"krodsherad.no":1,"krokstadelva.no":1,"krym.ua":1,"ks.ua":1,"ks.us":1,"kuchinotsu.nagasaki.jp":1,"kudamatsu.yamaguchi.jp":1,"kudoyama.wakayama.jp":1,"kui.hiroshima.jp":1,"kuji.iwate.jp":1,"kuju.oita.jp":1,"kujukuri.chiba.jp":1,"kuki.saitama.jp":1,"kumagaya.saitama.jp":1,"kumakogen.ehime.jp":1,"kumamoto.jp":1,"kumamoto.kumamoto.jp":1,"kumano.hiroshima.jp":1,"kumano.mie.jp":1,"kumatori.osaka.jp":1,"kumejima.okinawa.jp":1,"kumenan.okayama.jp":1,"kumiyama.kyoto.jp":1,"kunden.ortsinfo.at":2,"kunigami.okinawa.jp":1,"kunimi.fukushima.jp":1,"kunisaki.oita.jp":1,"kunitachi.tokyo.jp":1,"kunitomi.miyazaki.jp":1,"kunneppu.hokkaido.jp":1,"kunohe.iwate.jp":1,"kunst.museum":1,"kunstsammlung.museum":1,"kunstunddesign.museum":1,"kurashiki.okayama.jp":1,"kurate.fukuoka.jp":1,"kure.hiroshima.jp":1,"kurgan.su":1,"kuriyama.hokkaido.jp":1,"kurobe.toyama.jp":1,"kurogi.fukuoka.jp":1,"kuroishi.aomori.jp":1,"kuroiso.tochigi.jp":1,"kuromatsunai.hokkaido.jp":1,"kurotaki.nara.jp":1,"kurume.fukuoka.jp":1,"kusatsu.gunma.jp":1,"kusatsu.shiga.jp":1,"kushima.miyazaki.jp":1,"kushimoto.wakayama.jp":1,"kushiro.hokkaido.jp":1,"kustanai.ru":1,"kustanai.su":1,"kusu.oita.jp":1,"kutchan.hokkaido.jp":1,"kutno.pl":1,"kuwana.mie.jp":1,"kuzumaki.iwate.jp":1,"kv.ua":1,"kvafjord.no":1,"kvalsund.no":1,"kvam.no":1,"kvanangen.no":1,"kvinesdal.no":1,"kvinnherad.no":1,"kviteseid.no":1,"kvitsoy.no":1,"kwp.gov.pl":1,"kwpsp.gov.pl":1,"ky.us":1,"kyiv.ua":1,"kyonan.chiba.jp":1,"kyotamba.kyoto.jp":1,"kyotanabe.kyoto.jp":1,"kyotango.kyoto.jp":1,"kyoto.jp":1,"kyowa.akita.jp":1,"kyowa.hokkaido.jp":1,"kyuragi.saga.jp":1,"l-o-g-i-n.de":1,"l.bg":1,"l.se":1,"la-spezia.it":1,"la.us":1,"laakesvuemie.no":1,"lab.ms":1,"labor.museum":1,"labour.museum":1,"lahppi.no":1,"lajolla.museum":1,"lakas.hu":1,"lanbib.se":1,"lancashire.museum":1,"land-4-sale.us":1,"landes.museum":1,"landing.myjino.ru":2,"langevag.no":1,"lans.museum":1,"lapy.pl":1,"laquila.it":1,"lardal.no":1,"larsson.museum":1,"larvik.no":1,"laspezia.it":1,"latina.it":1,"lavagis.no":1,"lavangen.no":1,"law.pro":1,"law.za":1,"laz.it":1,"lazio.it":1,"lc.it":1,"lcl.dev":2,"lcube-server.de":1,"le.it":1,"leadpages.co":1,"leangaviika.no":1,"leasing.aero":1,"lebesby.no":1,"lebork.pl":1,"lebtimnetz.de":1,"lecce.it":1,"lecco.it":1,"leczna.pl":1,"leg.br":1,"legnica.pl":1,"leikanger.no":1,"leirfjord.no":1,"leirvik.no":1,"leitungsen.de":1,"leka.no":1,"leksvik.no":1,"lel.br":1,"lelux.site":1,"lenug.su":1,"lenvik.no":1,"lerdal.no":1,"lesja.no":1,"levanger.no":1,"lewismiller.museum":1,"lezajsk.pl":1,"lg.jp":1,"lg.ua":1,"li.it":1,"lib.ak.us":1,"lib.al.us":1,"lib.ar.us":1,"lib.as.us":1,"lib.az.us":1,"lib.ca.us":1,"lib.co.us":1,"lib.ct.us":1,"lib.dc.us":1,"lib.de.us":1,"lib.ee":1,"lib.fl.us":1,"lib.ga.us":1,"lib.gu.us":1,"lib.hi.us":1,"lib.ia.us":1,"lib.id.us":1,"lib.il.us":1,"lib.in.us":1,"lib.ks.us":1,"lib.ky.us":1,"lib.la.us":1,"lib.ma.us":1,"lib.md.us":1,"lib.me.us":1,"lib.mi.us":1,"lib.mn.us":1,"lib.mo.us":1,"lib.ms.us":1,"lib.mt.us":1,"lib.nc.us":1,"lib.nd.us":1,"lib.ne.us":1,"lib.nh.us":1,"lib.nj.us":1,"lib.nm.us":1,"lib.nv.us":1,"lib.ny.us":1,"lib.oh.us":1,"lib.ok.us":1,"lib.or.us":1,"lib.pa.us":1,"lib.pr.us":1,"lib.ri.us":1,"lib.sc.us":1,"lib.sd.us":1,"lib.tn.us":1,"lib.tx.us":1,"lib.ut.us":1,"lib.va.us":1,"lib.vi.us":1,"lib.vt.us":1,"lib.wa.us":1,"lib.wi.us":1,"lib.wy.us":1,"lier.no":1,"lierne.no":1,"lig.it":1,"liguria.it":1,"likes-pie.com":1,"likescandy.com":1,"lillehammer.no":1,"lillesand.no":1,"lima-city.at":1,"lima-city.ch":1,"lima-city.de":1,"lima-city.rocks":1,"lima.zone":1,"limanowa.pl":1,"lincoln.museum":1,"lindas.no":1,"lindesnes.no":1,"linkitools.space":1,"linkyard-cloud.ch":1,"linkyard.cloud":1,"linz.museum":1,"living.museum":1,"livinghistory.museum":1,"livorno.it":1,"ln.cn":1,"lo.it":1,"loabat.no":1,"localhistory.museum":1,"localhost.daplie.me":1,"lodi.it":1,"lodingen.no":1,"loginline.app":1,"loginline.dev":1,"loginline.io":1,"loginline.services":1,"loginline.site":1,"loginto.me":1,"logistics.aero":1,"logoip.com":1,"logoip.de":1,"lom.it":1,"lom.no":1,"lombardia.it":1,"lombardy.it":1,"lomza.pl":1,"london.cloudapps.digital":1,"london.museum":1,"londrina.br":1,"loppa.no":1,"lorenskog.no":1,"losangeles.museum":1,"loseyourip.com":1,"loten.no":1,"louvre.museum":1,"lowicz.pl":1,"loyalist.museum":1,"lpages.co":1,"lpusercontent.com":1,"lt.eu.org":1,"lt.it":1,"lt.ua":1,"ltd.co.im":1,"ltd.cy":1,"ltd.gi":1,"ltd.hk":1,"ltd.lk":1,"ltd.ng":1,"ltd.ua":1,"ltd.uk":1,"lu.eu.org":1,"lu.it":1,"lubartow.pl":1,"lubin.pl":1,"lublin.pl":1,"lucania.it":1,"lucca.it":1,"lucerne.museum":1,"lug.org.uk":1,"lugansk.ua":1,"lugs.org.uk":1,"lukow.pl":1,"lund.no":1,"lunner.no":1,"luroy.no":1,"luster.no":1,"lutsk.ua":1,"luxembourg.museum":1,"luzern.museum":1,"lv.eu.org":1,"lv.ua":1,"lviv.ua":1,"lyngdal.no":1,"lyngen.no":1,"m.bg":1,"m.se":1,"ma.gov.br":1,"ma.leg.br":1,"ma.us":1,"macapa.br":1,"maceio.br":1,"macerata.it":1,"machida.tokyo.jp":1,"mad.museum":1,"madrid.museum":1,"maebashi.gunma.jp":1,"magazine.aero":1,"magentosite.cloud":2,"maibara.shiga.jp":1,"mail.pl":1,"maintenance.aero":1,"maizuru.kyoto.jp":1,"makinohara.shizuoka.jp":1,"makurazaki.kagoshima.jp":1,"malatvuopmi.no":1,"malbork.pl":1,"mallorca.museum":1,"malopolska.pl":1,"malselv.no":1,"malvik.no":1,"mamurogawa.yamagata.jp":1,"manaus.br":1,"manchester.museum":1,"mandal.no":1,"mangyshlak.su":1,"maniwa.okayama.jp":1,"manno.kagawa.jp":1,"mansion.museum":1,"mansions.museum":1,"mantova.it":1,"manx.museum":1,"maori.nz":1,"map.fastly.net":1,"map.fastlylb.net":1,"mar.it":1,"marburg.museum":1,"marche.it":1,"marine.ru":1,"maringa.br":1,"maritime.museum":1,"maritimo.museum":1,"marker.no":1,"marnardal.no":1,"marugame.kagawa.jp":1,"marumori.miyagi.jp":1,"maryland.museum":1,"marylhurst.museum":1,"masaki.ehime.jp":1,"masfjorden.no":1,"mashike.hokkaido.jp":1,"mashiki.kumamoto.jp":1,"mashiko.tochigi.jp":1,"masoy.no":1,"massa-carrara.it":1,"massacarrara.it":1,"masuda.shimane.jp":1,"mat.br":1,"matera.it":1,"matsubara.osaka.jp":1,"matsubushi.saitama.jp":1,"matsuda.kanagawa.jp":1,"matsudo.chiba.jp":1,"matsue.shimane.jp":1,"matsukawa.nagano.jp":1,"matsumae.hokkaido.jp":1,"matsumoto.kagoshima.jp":1,"matsumoto.nagano.jp":1,"matsuno.ehime.jp":1,"matsusaka.mie.jp":1,"matsushige.tokushima.jp":1,"matsushima.miyagi.jp":1,"matsuura.nagasaki.jp":1,"matsuyama.ehime.jp":1,"matsuzaki.shizuoka.jp":1,"matta-varjjat.no":1,"mayfirst.info":1,"mayfirst.org":1,"mazowsze.pl":1,"mazury.pl":1,"mb.ca":1,"mb.it":1,"mc.eu.org":1,"mc.it":1,"md.ci":1,"md.us":1,"me.eu.org":1,"me.it":1,"me.ke":1,"me.tz":1,"me.uk":1,"me.us":1,"med.br":1,"med.ec":1,"med.ee":1,"med.ht":1,"med.ly":1,"med.om":1,"med.pa":1,"med.pl":1,"med.pro":1,"med.sa":1,"med.sd":1,"medecin.fr":1,"medecin.km":1,"media.aero":1,"media.hu":1,"media.museum":1,"media.pl":1,"medical.museum":1,"medicina.bo":1,"medio-campidano.it":1,"mediocampidano.it":1,"medizinhistorisches.museum":1,"meeres.museum":1,"meguro.tokyo.jp":1,"mein-iserv.de":1,"mein-vigor.de":1,"meiwa.gunma.jp":1,"meiwa.mie.jp":1,"meland.no":1,"meldal.no":1,"melhus.no":1,"meloy.no":1,"members.linode.com":1,"memorial.museum":1,"memset.net":1,"meraker.no":1,"merseine.nu":1,"mesaverde.museum":1,"messina.it":1,"meteorapp.com":1,"mex.com":1,"mg.gov.br":1,"mg.leg.br":1,"mi.it":1,"mi.th":1,"mi.us":1,"miasa.nagano.jp":1,"miasta.pl":1,"mibu.tochigi.jp":1,"michigan.museum":1,"microlight.aero":1,"midatlantic.museum":1,"midori.chiba.jp":1,"midori.gunma.jp":1,"midsund.no":1,"midtre-gauldal.no":1,"mie.jp":1,"mielec.pl":1,"mielno.pl":1,"mifune.kumamoto.jp":1,"mihama.aichi.jp":1,"mihama.chiba.jp":1,"mihama.fukui.jp":1,"mihama.mie.jp":1,"mihama.wakayama.jp":1,"mihara.hiroshima.jp":1,"mihara.kochi.jp":1,"miharu.fukushima.jp":1,"miho.ibaraki.jp":1,"mikasa.hokkaido.jp":1,"mikawa.yamagata.jp":1,"miki.hyogo.jp":1,"mil.ac":1,"mil.ae":1,"mil.al":1,"mil.ar":1,"mil.az":1,"mil.ba":1,"mil.bo":1,"mil.br":1,"mil.by":1,"mil.cl":1,"mil.cn":1,"mil.co":1,"mil.do":1,"mil.ec":1,"mil.eg":1,"mil.ge":1,"mil.gh":1,"mil.gt":1,"mil.hn":1,"mil.id":1,"mil.in":1,"mil.iq":1,"mil.jo":1,"mil.kg":1,"mil.km":1,"mil.kr":1,"mil.kz":1,"mil.lv":1,"mil.mg":1,"mil.mv":1,"mil.my":1,"mil.mz":1,"mil.ng":1,"mil.ni":1,"mil.no":1,"mil.nz":1,"mil.pe":1,"mil.ph":1,"mil.pl":1,"mil.py":1,"mil.qa":1,"mil.ru":1,"mil.rw":1,"mil.sh":1,"mil.st":1,"mil.sy":1,"mil.tj":1,"mil.tm":1,"mil.to":1,"mil.tr":1,"mil.tw":1,"mil.tz":1,"mil.uy":1,"mil.vc":1,"mil.ve":1,"mil.za":1,"mil.zm":1,"mil.zw":1,"milan.it":1,"milano.it":1,"military.museum":1,"mill.museum":1,"mima.tokushima.jp":1,"mimata.miyazaki.jp":1,"minakami.gunma.jp":1,"minamata.kumamoto.jp":1,"minami-alps.yamanashi.jp":1,"minami.fukuoka.jp":1,"minami.kyoto.jp":1,"minami.tokushima.jp":1,"minamiaiki.nagano.jp":1,"minamiashigara.kanagawa.jp":1,"minamiawaji.hyogo.jp":1,"minamiboso.chiba.jp":1,"minamidaito.okinawa.jp":1,"minamiechizen.fukui.jp":1,"minamifurano.hokkaido.jp":1,"minamiise.mie.jp":1,"minamiizu.shizuoka.jp":1,"minamimaki.nagano.jp":1,"minamiminowa.nagano.jp":1,"minamioguni.kumamoto.jp":1,"minamisanriku.miyagi.jp":1,"minamitane.kagoshima.jp":1,"minamiuonuma.niigata.jp":1,"minamiyamashiro.kyoto.jp":1,"minano.saitama.jp":1,"minato.osaka.jp":1,"minato.tokyo.jp":1,"mincom.tn":1,"mine.nu":1,"miners.museum":1,"mining.museum":1,"miniserver.com":1,"minnesota.museum":1,"mino.gifu.jp":1,"minobu.yamanashi.jp":1,"minoh.osaka.jp":1,"minokamo.gifu.jp":1,"minowa.nagano.jp":1,"misaki.okayama.jp":1,"misaki.osaka.jp":1,"misasa.tottori.jp":1,"misato.akita.jp":1,"misato.miyagi.jp":1,"misato.saitama.jp":1,"misato.shimane.jp":1,"misato.wakayama.jp":1,"misawa.aomori.jp":1,"misconfused.org":1,"mishima.fukushima.jp":1,"mishima.shizuoka.jp":1,"missile.museum":1,"missoula.museum":1,"misugi.mie.jp":1,"mitaka.tokyo.jp":1,"mitake.gifu.jp":1,"mitane.akita.jp":1,"mito.ibaraki.jp":1,"mitou.yamaguchi.jp":1,"mitoyo.kagawa.jp":1,"mitsue.nara.jp":1,"mitsuke.niigata.jp":1,"miura.kanagawa.jp":1,"miyada.nagano.jp":1,"miyagi.jp":1,"miyake.nara.jp":1,"miyako.fukuoka.jp":1,"miyako.iwate.jp":1,"miyakonojo.miyazaki.jp":1,"miyama.fukuoka.jp":1,"miyama.mie.jp":1,"miyashiro.saitama.jp":1,"miyawaka.fukuoka.jp":1,"miyazaki.jp":1,"miyazaki.miyazaki.jp":1,"miyazu.kyoto.jp":1,"miyoshi.aichi.jp":1,"miyoshi.hiroshima.jp":1,"miyoshi.saitama.jp":1,"miyoshi.tokushima.jp":1,"miyota.nagano.jp":1,"mizuho.tokyo.jp":1,"mizumaki.fukuoka.jp":1,"mizunami.gifu.jp":1,"mizusawa.iwate.jp":1,"mjondalen.no":1,"mk.eu.org":1,"mk.ua":1,"mlbfan.org":1,"mm":2,"mmafan.biz":1,"mn.it":1,"mn.us":1,"mo-i-rana.no":1,"mo-siemens.io":1,"mo.cn":1,"mo.it":1,"mo.us":1,"moareke.no":1,"mobara.chiba.jp":1,"mobi.gp":1,"mobi.ke":1,"mobi.na":1,"mobi.ng":1,"mobi.tt":1,"mobi.tz":1,"mochizuki.nagano.jp":1,"mod.gi":1,"modalen.no":1,"modelling.aero":1,"modena.it":1,"modern.museum":1,"modum.no":1,"moka.tochigi.jp":1,"mol.it":1,"molde.no":1,"molise.it":1,"moma.museum":1,"mombetsu.hokkaido.jp":1,"money.museum":1,"monmouth.museum":1,"monticello.museum":1,"montreal.museum":1,"monza-brianza.it":1,"monza-e-della-brianza.it":1,"monza.it":1,"monzabrianza.it":1,"monzaebrianza.it":1,"monzaedellabrianza.it":1,"moonscale.io":2,"moonscale.net":1,"mordovia.ru":1,"mordovia.su":1,"morena.br":1,"moriguchi.osaka.jp":1,"morimachi.shizuoka.jp":1,"morioka.iwate.jp":1,"moriya.ibaraki.jp":1,"moriyama.shiga.jp":1,"moriyoshi.akita.jp":1,"morotsuka.miyazaki.jp":1,"moroyama.saitama.jp":1,"moscow.museum":1,"moseushi.hokkaido.jp":1,"mosjoen.no":1,"moskenes.no":1,"moss.no":1,"mosvik.no":1,"motegi.tochigi.jp":1,"motobu.okinawa.jp":1,"motorcycle.museum":1,"motosu.gifu.jp":1,"motoyama.kochi.jp":1,"movimiento.bo":1,"mozilla-iot.org":1,"mp.br":1,"mr.no":1,"mragowo.pl":1,"ms.gov.br":1,"ms.it":1,"ms.kr":1,"ms.leg.br":1,"ms.us":1,"msk.ru":1,"msk.su":1,"mt.eu.org":1,"mt.gov.br":1,"mt.it":1,"mt.leg.br":1,"mt.us":1,"muenchen.museum":1,"muenster.museum":1,"mugi.tokushima.jp":1,"muika.niigata.jp":1,"mukawa.hokkaido.jp":1,"muko.kyoto.jp":1,"mulhouse.museum":1,"munakata.fukuoka.jp":1,"muncie.museum":1,"muni.il":1,"muosat.no":1,"mup.gov.pl":1,"murakami.niigata.jp":1,"murata.miyagi.jp":1,"murayama.yamagata.jp":1,"murmansk.su":1,"muroran.hokkaido.jp":1,"muroto.kochi.jp":1,"mus.br":1,"mus.mi.us":1,"musashimurayama.tokyo.jp":1,"musashino.tokyo.jp":1,"museet.museum":1,"museum.mv":1,"museum.mw":1,"museum.no":1,"museum.om":1,"museum.tt":1,"museumcenter.museum":1,"museumvereniging.museum":1,"music.museum":1,"musica.ar":1,"musica.bo":1,"mutsu.aomori.jp":1,"mutsuzawa.chiba.jp":1,"mw.gov.pl":1,"mx.na":1,"my-firewall.org":1,"my-gateway.de":1,"my-router.de":1,"my-vigor.de":1,"my-wan.de":1,"my.eu.org":1,"my.id":1,"myactivedirectory.com":1,"myasustor.com":1,"mycd.eu":1,"mydatto.com":1,"mydatto.net":1,"myddns.rocks":1,"mydissent.net":1,"mydobiss.com":1,"mydrobo.com":1,"myds.me":1,"myeffect.net":1,"myfirewall.org":1,"myfritz.net":1,"myftp.biz":1,"myftp.org":1,"myhome-server.de":1,"myiphost.com":1,"myjino.ru":1,"mykolaiv.ua":1,"mymailer.com.tw":1,"mymediapc.net":1,"myoko.niigata.jp":1,"mypep.link":1,"mypets.ws":1,"myphotos.cc":1,"mypi.co":1,"mypsx.net":1,"myqnapcloud.com":1,"myravendb.com":1,"mysecuritycamera.com":1,"mysecuritycamera.net":1,"mysecuritycamera.org":1,"myshopblocks.com":1,"mytis.ru":1,"mytuleap.com":1,"myvnc.com":1,"mywire.org":1,"n.bg":1,"n.se":1,"n4t.co":1,"na.it":1,"naamesjevuemie.no":1,"nabari.mie.jp":1,"nachikatsuura.wakayama.jp":1,"nagahama.shiga.jp":1,"nagai.yamagata.jp":1,"nagano.jp":1,"nagano.nagano.jp":1,"naganohara.gunma.jp":1,"nagaoka.niigata.jp":1,"nagaokakyo.kyoto.jp":1,"nagara.chiba.jp":1,"nagareyama.chiba.jp":1,"nagasaki.jp":1,"nagasaki.nagasaki.jp":1,"nagasu.kumamoto.jp":1,"nagato.yamaguchi.jp":1,"nagatoro.saitama.jp":1,"nagawa.nagano.jp":1,"nagi.okayama.jp":1,"nagiso.nagano.jp":1,"nago.okinawa.jp":1,"nagoya.jp":2,"naha.okinawa.jp":1,"nahari.kochi.jp":1,"naie.hokkaido.jp":1,"naka.hiroshima.jp":1,"naka.ibaraki.jp":1,"nakadomari.aomori.jp":1,"nakagawa.fukuoka.jp":1,"nakagawa.hokkaido.jp":1,"nakagawa.nagano.jp":1,"nakagawa.tokushima.jp":1,"nakagusuku.okinawa.jp":1,"nakagyo.kyoto.jp":1,"nakai.kanagawa.jp":1,"nakama.fukuoka.jp":1,"nakamichi.yamanashi.jp":1,"nakamura.kochi.jp":1,"nakaniikawa.toyama.jp":1,"nakano.nagano.jp":1,"nakano.tokyo.jp":1,"nakanojo.gunma.jp":1,"nakanoto.ishikawa.jp":1,"nakasatsunai.hokkaido.jp":1,"nakatane.kagoshima.jp":1,"nakatombetsu.hokkaido.jp":1,"nakatsugawa.gifu.jp":1,"nakayama.yamagata.jp":1,"nakijin.okinawa.jp":1,"naklo.pl":1,"nalchik.ru":1,"nalchik.su":1,"namdalseid.no":1,"name.az":1,"name.cy":1,"name.eg":1,"name.et":1,"name.hr":1,"name.jo":1,"name.mk":1,"name.mv":1,"name.my":1,"name.na":1,"name.ng":1,"name.pr":1,"name.qa":1,"name.tj":1,"name.tr":1,"name.tt":1,"name.vn":1,"namegata.ibaraki.jp":1,"namegawa.saitama.jp":1,"namerikawa.toyama.jp":1,"namie.fukushima.jp":1,"namikata.ehime.jp":1,"namsos.no":1,"namsskogan.no":1,"nanae.hokkaido.jp":1,"nanao.ishikawa.jp":1,"nanbu.tottori.jp":1,"nanbu.yamanashi.jp":1,"nango.fukushima.jp":1,"nanjo.okinawa.jp":1,"nankoku.kochi.jp":1,"nanmoku.gunma.jp":1,"nannestad.no":1,"nanporo.hokkaido.jp":1,"nantan.kyoto.jp":1,"nanto.toyama.jp":1,"nanyo.yamagata.jp":1,"naoshima.kagawa.jp":1,"naples.it":1,"napoli.it":1,"nara.jp":1,"nara.nara.jp":1,"narashino.chiba.jp":1,"narita.chiba.jp":1,"naroy.no":1,"narusawa.yamanashi.jp":1,"naruto.tokushima.jp":1,"narviika.no":1,"narvik.no":1,"nasu.tochigi.jp":1,"nasushiobara.tochigi.jp":1,"nat.tn":1,"natal.br":1,"national.museum":1,"nationalfirearms.museum":1,"nationalheritage.museum":1,"nativeamerican.museum":1,"natori.miyagi.jp":1,"natural.bo":1,"naturalhistory.museum":1,"naturalhistorymuseum.museum":1,"naturalsciences.museum":1,"naturbruksgymn.se":1,"nature.museum":1,"naturhistorisches.museum":1,"natuurwetenschappen.museum":1,"naumburg.museum":1,"naustdal.no":1,"naval.museum":1,"navigation.aero":1,"navoi.su":1,"navuotna.no":1,"nayoro.hokkaido.jp":1,"nb.ca":1,"nc.tr":1,"nc.us":1,"nctu.me":1,"nd.us":1,"ne.jp":1,"ne.ke":1,"ne.kr":1,"ne.pw":1,"ne.tz":1,"ne.ug":1,"ne.us":1,"neat-url.com":1,"nebraska.museum":1,"nedre-eiker.no":1,"nemuro.hokkaido.jp":1,"nerdpol.ovh":1,"nerima.tokyo.jp":1,"nes.akershus.no":1,"nes.buskerud.no":1,"nesna.no":1,"nesodden.no":1,"nesoddtangen.no":1,"nesseby.no":1,"nesset.no":1,"net-freaks.com":1,"net.ac":1,"net.ae":1,"net.af":1,"net.ag":1,"net.ai":1,"net.al":1,"net.am":1,"net.ar":1,"net.au":1,"net.az":1,"net.ba":1,"net.bb":1,"net.bh":1,"net.bm":1,"net.bn":1,"net.bo":1,"net.br":1,"net.bs":1,"net.bt":1,"net.bz":1,"net.ci":1,"net.cm":1,"net.cn":1,"net.co":1,"net.cu":1,"net.cw":1,"net.cy":1,"net.dm":1,"net.do":1,"net.dz":1,"net.ec":1,"net.eg":1,"net.et":1,"net.eu.org":1,"net.ge":1,"net.gg":1,"net.gl":1,"net.gn":1,"net.gp":1,"net.gr":1,"net.gt":1,"net.gu":1,"net.gy":1,"net.hk":1,"net.hn":1,"net.ht":1,"net.id":1,"net.il":1,"net.im":1,"net.in":1,"net.iq":1,"net.ir":1,"net.is":1,"net.je":1,"net.jo":1,"net.kg":1,"net.ki":1,"net.kn":1,"net.kw":1,"net.ky":1,"net.kz":1,"net.la":1,"net.lb":1,"net.lc":1,"net.lk":1,"net.lr":1,"net.ls":1,"net.lv":1,"net.ly":1,"net.ma":1,"net.me":1,"net.mk":1,"net.ml":1,"net.mo":1,"net.ms":1,"net.mt":1,"net.mu":1,"net.mv":1,"net.mw":1,"net.mx":1,"net.my":1,"net.mz":1,"net.nf":1,"net.ng":1,"net.ni":1,"net.nr":1,"net.nz":1,"net.om":1,"net.pa":1,"net.pe":1,"net.ph":1,"net.pk":1,"net.pl":1,"net.pn":1,"net.pr":1,"net.ps":1,"net.pt":1,"net.py":1,"net.qa":1,"net.ru":1,"net.rw":1,"net.sa":1,"net.sb":1,"net.sc":1,"net.sd":1,"net.sg":1,"net.sh":1,"net.sl":1,"net.so":1,"net.st":1,"net.sy":1,"net.th":1,"net.tj":1,"net.tm":1,"net.tn":1,"net.to":1,"net.tr":1,"net.tt":1,"net.tw":1,"net.ua":1,"net.uk":1,"net.uy":1,"net.uz":1,"net.vc":1,"net.ve":1,"net.vi":1,"net.vn":1,"net.vu":1,"net.ws":1,"net.za":1,"net.zm":1,"netlify.com":1,"neues.museum":1,"newhampshire.museum":1,"newjersey.museum":1,"newmexico.museum":1,"newport.museum":1,"news.hu":1,"newspaper.museum":1,"newyork.museum":1,"neyagawa.osaka.jp":1,"nf.ca":1,"nflfan.org":1,"nfshost.com":1,"ng.city":1,"ng.eu.org":1,"ng.ink":1,"ng.school":1,"ngo.lk":1,"ngo.ph":1,"ngo.za":1,"ngrok.io":1,"nh-serv.co.uk":1,"nh.us":1,"nhlfan.net":1,"nhs.uk":1,"nic.in":1,"nic.tj":1,"nic.za":1,"nichinan.miyazaki.jp":1,"nichinan.tottori.jp":1,"nid.io":1,"niepce.museum":1,"nieruchomosci.pl":1,"niigata.jp":1,"niigata.niigata.jp":1,"niihama.ehime.jp":1,"niikappu.hokkaido.jp":1,"niimi.okayama.jp":1,"niiza.saitama.jp":1,"nikaho.akita.jp":1,"niki.hokkaido.jp":1,"nikko.tochigi.jp":1,"nikolaev.ua":1,"ninohe.iwate.jp":1,"ninomiya.kanagawa.jp":1,"nirasaki.yamanashi.jp":1,"nis.za":1,"nishi.fukuoka.jp":1,"nishi.osaka.jp":1,"nishiaizu.fukushima.jp":1,"nishiarita.saga.jp":1,"nishiawakura.okayama.jp":1,"nishiazai.shiga.jp":1,"nishigo.fukushima.jp":1,"nishihara.kumamoto.jp":1,"nishihara.okinawa.jp":1,"nishiizu.shizuoka.jp":1,"nishikata.tochigi.jp":1,"nishikatsura.yamanashi.jp":1,"nishikawa.yamagata.jp":1,"nishimera.miyazaki.jp":1,"nishinomiya.hyogo.jp":1,"nishinoomote.kagoshima.jp":1,"nishinoshima.shimane.jp":1,"nishio.aichi.jp":1,"nishiokoppe.hokkaido.jp":1,"nishitosa.kochi.jp":1,"nishiwaki.hyogo.jp":1,"nissedal.no":1,"nisshin.aichi.jp":1,"niteroi.br":1,"nittedal.no":1,"niyodogawa.kochi.jp":1,"nj.us":1,"nl.ca":1,"nl.eu.org":1,"nl.no":1,"nm.cn":1,"nm.us":1,"no-ip.biz":1,"no-ip.ca":1,"no-ip.co.uk":1,"no-ip.info":1,"no-ip.net":1,"no-ip.org":1,"no.com":1,"no.eu.org":1,"no.it":1,"nobeoka.miyazaki.jp":1,"noboribetsu.hokkaido.jp":1,"noda.chiba.jp":1,"noda.iwate.jp":1,"nodebalancer.linode.com":1,"nodum.co":1,"nodum.io":1,"nogata.fukuoka.jp":1,"nogi.tochigi.jp":1,"noheji.aomori.jp":1,"noho.st":1,"nohost.me":1,"noip.me":1,"noip.us":1,"nom.ad":1,"nom.ae":1,"nom.af":1,"nom.ag":1,"nom.ai":1,"nom.al":1,"nom.br":2,"nom.cl":1,"nom.co":1,"nom.es":1,"nom.fr":1,"nom.gd":1,"nom.ge":1,"nom.gl":1,"nom.gt":1,"nom.hn":1,"nom.im":1,"nom.ke":1,"nom.km":1,"nom.li":1,"nom.mg":1,"nom.mk":1,"nom.nc":1,"nom.ni":1,"nom.nu":1,"nom.pa":1,"nom.pe":1,"nom.pl":1,"nom.pw":1,"nom.qa":1,"nom.re":1,"nom.ro":1,"nom.rs":1,"nom.si":1,"nom.st":1,"nom.tj":1,"nom.tm":1,"nom.ug":1,"nom.uy":1,"nom.vc":1,"nom.vg":1,"nom.za":1,"nombre.bo":1,"nome.pt":1,"nomi.ishikawa.jp":1,"nonoichi.ishikawa.jp":1,"nord-aurdal.no":1,"nord-fron.no":1,"nord-odal.no":1,"norddal.no":1,"nordkapp.no":1,"nordre-land.no":1,"nordreisa.no":1,"nore-og-uvdal.no":1,"norfolk.museum":1,"north-kazakhstan.su":1,"north.museum":1,"nose.osaka.jp":1,"nosegawa.nara.jp":1,"noshiro.akita.jp":1,"not.br":1,"notaires.fr":1,"notaires.km":1,"noticias.bo":1,"noto.ishikawa.jp":1,"notodden.no":1,"notogawa.shiga.jp":1,"notteroy.no":1,"nov.ru":1,"nov.su":1,"novara.it":1,"now-dns.net":1,"now-dns.org":1,"now-dns.top":1,"now.sh":1,"nowaruda.pl":1,"nozawaonsen.nagano.jp":1,"np":2,"nrw.museum":1,"ns.ca":1,"nsn.us":1,"nsupdate.info":1,"nsw.au":1,"nsw.edu.au":1,"nt.au":1,"nt.ca":1,"nt.edu.au":1,"nt.no":1,"nt.ro":1,"ntdll.top":1,"ntr.br":1,"nu.ca":1,"nu.it":1,"numata.gunma.jp":1,"numata.hokkaido.jp":1,"numazu.shizuoka.jp":1,"nuoro.it":1,"nv.us":1,"nx.cn":1,"ny.us":1,"nyc.mn":1,"nyc.museum":1,"nym.by":1,"nym.bz":1,"nym.ec":1,"nym.gr":1,"nym.gy":1,"nym.hk":1,"nym.ie":1,"nym.kz":1,"nym.la":1,"nym.lc":1,"nym.li":1,"nym.lt":1,"nym.lu":1,"nym.me":1,"nym.mn":1,"nym.mx":1,"nym.nz":1,"nym.pe":1,"nym.pt":1,"nym.ro":1,"nym.sk":1,"nym.su":1,"nym.sx":1,"nym.tw":1,"nyny.museum":1,"nysa.pl":1,"nyuzen.toyama.jp":1,"nz.eu.org":1,"o.bg":1,"o.se":1,"oamishirasato.chiba.jp":1,"oarai.ibaraki.jp":1,"obama.fukui.jp":1,"obama.nagasaki.jp":1,"obanazawa.yamagata.jp":1,"obihiro.hokkaido.jp":1,"obira.hokkaido.jp":1,"obninsk.su":1,"obu.aichi.jp":1,"obuse.nagano.jp":1,"oceanographic.museum":1,"oceanographique.museum":1,"ochi.kochi.jp":1,"od.ua":1,"odate.akita.jp":1,"odawara.kanagawa.jp":1,"odda.no":1,"odesa.ua":1,"odessa.ua":1,"odo.br":1,"oe.yamagata.jp":1,"of.by":1,"of.fashion":1,"of.football":1,"of.london":1,"of.no":1,"of.work":1,"off.ai":1,"office-on-the.net":1,"official.academy":1,"ofunato.iwate.jp":1,"og.ao":1,"og.it":1,"oga.akita.jp":1,"ogaki.gifu.jp":1,"ogano.saitama.jp":1,"ogasawara.tokyo.jp":1,"ogata.akita.jp":1,"ogawa.ibaraki.jp":1,"ogawa.nagano.jp":1,"ogawa.saitama.jp":1,"ogawara.miyagi.jp":1,"ogi.saga.jp":1,"ogimi.okinawa.jp":1,"ogliastra.it":1,"ogori.fukuoka.jp":1,"ogose.saitama.jp":1,"oguchi.aichi.jp":1,"oguni.kumamoto.jp":1,"oguni.yamagata.jp":1,"oh.us":1,"oharu.aichi.jp":1,"ohda.shimane.jp":1,"ohi.fukui.jp":1,"ohira.miyagi.jp":1,"ohira.tochigi.jp":1,"ohkura.yamagata.jp":1,"ohtawara.tochigi.jp":1,"oi.kanagawa.jp":1,"oirase.aomori.jp":1,"oirm.gov.pl":1,"oishida.yamagata.jp":1,"oiso.kanagawa.jp":1,"oita.jp":1,"oita.oita.jp":1,"oizumi.gunma.jp":1,"oji.nara.jp":1,"ojiya.niigata.jp":1,"ok.us":1,"okagaki.fukuoka.jp":1,"okawa.fukuoka.jp":1,"okawa.kochi.jp":1,"okaya.nagano.jp":1,"okayama.jp":1,"okayama.okayama.jp":1,"okazaki.aichi.jp":1,"okegawa.saitama.jp":1,"oketo.hokkaido.jp":1,"oki.fukuoka.jp":1,"okinawa.jp":1,"okinawa.okinawa.jp":1,"okinoshima.shimane.jp":1,"okoppe.hokkaido.jp":1,"oksnes.no":1,"okuizumo.shimane.jp":1,"okuma.fukushima.jp":1,"okutama.tokyo.jp":1,"ol.no":1,"olawa.pl":1,"olbia-tempio.it":1,"olbiatempio.it":1,"olecko.pl":1,"olkusz.pl":1,"olsztyn.pl":1,"omachi.nagano.jp":1,"omachi.saga.jp":1,"omaezaki.shizuoka.jp":1,"omaha.museum":1,"omasvuotna.no":1,"ome.tokyo.jp":1,"omi.nagano.jp":1,"omi.niigata.jp":1,"omigawa.chiba.jp":1,"omihachiman.shiga.jp":1,"omitama.ibaraki.jp":1,"omiya.saitama.jp":1,"omotego.fukushima.jp":1,"omura.nagasaki.jp":1,"omuta.fukuoka.jp":1,"on-aptible.com":1,"on-rancher.cloud":2,"on-rio.io":2,"on-the-web.tv":1,"on-web.fr":1,"on.ca":1,"on.fashion":1,"onagawa.miyagi.jp":1,"ong.br":1,"onga.fukuoka.jp":1,"onjuku.chiba.jp":1,"online.museum":1,"online.th":1,"onna.okinawa.jp":1,"ono.fukui.jp":1,"ono.fukushima.jp":1,"ono.hyogo.jp":1,"onojo.fukuoka.jp":1,"onomichi.hiroshima.jp":1,"onred.one":1,"onrender.com":1,"ontario.museum":1,"onthewifi.com":1,"ooguy.com":1,"ookuwa.nagano.jp":1,"ooshika.nagano.jp":1,"openair.museum":1,"opencraft.hosting":1,"operaunite.com":1,"opoczno.pl":1,"opole.pl":1,"oppdal.no":1,"oppegard.no":1,"or.at":1,"or.bi":1,"or.ci":1,"or.cr":1,"or.id":1,"or.it":1,"or.jp":1,"or.ke":1,"or.kr":1,"or.mu":1,"or.na":1,"or.pw":1,"or.th":1,"or.tz":1,"or.ug":1,"or.us":1,"ora.gunma.jp":1,"oregon.museum":1,"oregontrail.museum":1,"org.ac":1,"org.ae":1,"org.af":1,"org.ag":1,"org.ai":1,"org.al":1,"org.am":1,"org.ar":1,"org.au":1,"org.az":1,"org.ba":1,"org.bb":1,"org.bh":1,"org.bi":1,"org.bm":1,"org.bn":1,"org.bo":1,"org.br":1,"org.bs":1,"org.bt":1,"org.bw":1,"org.bz":1,"org.ci":1,"org.cn":1,"org.co":1,"org.cu":1,"org.cw":1,"org.cy":1,"org.dm":1,"org.do":1,"org.dz":1,"org.ec":1,"org.ee":1,"org.eg":1,"org.es":1,"org.et":1,"org.ge":1,"org.gg":1,"org.gh":1,"org.gi":1,"org.gl":1,"org.gn":1,"org.gp":1,"org.gr":1,"org.gt":1,"org.gu":1,"org.gy":1,"org.hk":1,"org.hn":1,"org.ht":1,"org.hu":1,"org.il":1,"org.im":1,"org.in":1,"org.iq":1,"org.ir":1,"org.is":1,"org.je":1,"org.jo":1,"org.kg":1,"org.ki":1,"org.km":1,"org.kn":1,"org.kp":1,"org.kw":1,"org.ky":1,"org.kz":1,"org.la":1,"org.lb":1,"org.lc":1,"org.lk":1,"org.lr":1,"org.ls":1,"org.lv":1,"org.ly":1,"org.ma":1,"org.me":1,"org.mg":1,"org.mk":1,"org.ml":1,"org.mn":1,"org.mo":1,"org.ms":1,"org.mt":1,"org.mu":1,"org.mv":1,"org.mw":1,"org.mx":1,"org.my":1,"org.mz":1,"org.na":1,"org.ng":1,"org.ni":1,"org.nr":1,"org.nz":1,"org.om":1,"org.pa":1,"org.pe":1,"org.pf":1,"org.ph":1,"org.pk":1,"org.pl":1,"org.pn":1,"org.pr":1,"org.ps":1,"org.pt":1,"org.py":1,"org.qa":1,"org.ro":1,"org.rs":1,"org.ru":1,"org.rw":1,"org.sa":1,"org.sb":1,"org.sc":1,"org.sd":1,"org.se":1,"org.sg":1,"org.sh":1,"org.sl":1,"org.sn":1,"org.so":1,"org.st":1,"org.sv":1,"org.sy":1,"org.sz":1,"org.tj":1,"org.tm":1,"org.tn":1,"org.to":1,"org.tr":1,"org.tt":1,"org.tw":1,"org.ua":1,"org.ug":1,"org.uk":1,"org.uy":1,"org.uz":1,"org.vc":1,"org.ve":1,"org.vi":1,"org.vn":1,"org.vu":1,"org.ws":1,"org.za":1,"org.zm":1,"org.zw":1,"oristano.it":1,"orkanger.no":1,"orkdal.no":1,"orland.no":1,"orskog.no":1,"orsta.no":1,"orx.biz":1,"os.hedmark.no":1,"os.hordaland.no":1,"osaka.jp":1,"osakasayama.osaka.jp":1,"osaki.miyagi.jp":1,"osakikamijima.hiroshima.jp":1,"osasco.br":1,"osen.no":1,"oseto.nagasaki.jp":1,"oshima.tokyo.jp":1,"oshima.yamaguchi.jp":1,"oshino.yamanashi.jp":1,"oshu.iwate.jp":1,"oslo.no":1,"osoyro.no":1,"osteroy.no":1,"ostre-toten.no":1,"ostroda.pl":1,"ostroleka.pl":1,"ostrowiec.pl":1,"ostrowwlkp.pl":1,"ot.it":1,"ota.gunma.jp":1,"ota.tokyo.jp":1,"otago.museum":1,"otake.hiroshima.jp":1,"otaki.chiba.jp":1,"otaki.nagano.jp":1,"otaki.saitama.jp":1,"otama.fukushima.jp":1,"otap.co":2,"otari.nagano.jp":1,"otaru.hokkaido.jp":1,"other.nf":1,"oto.fukuoka.jp":1,"otobe.hokkaido.jp":1,"otofuke.hokkaido.jp":1,"otoineppu.hokkaido.jp":1,"otoyo.kochi.jp":1,"otsu.shiga.jp":1,"otsuchi.iwate.jp":1,"otsuki.kochi.jp":1,"otsuki.yamanashi.jp":1,"ouchi.saga.jp":1,"ouda.nara.jp":1,"oum.gov.pl":1,"oumu.hokkaido.jp":1,"outsystemscloud.com":1,"overhalla.no":1,"ovre-eiker.no":1,"owani.aomori.jp":1,"owariasahi.aichi.jp":1,"own.pm":1,"ownip.net":1,"ownprovider.com":1,"ox.rs":1,"oxford.museum":1,"oy.lc":1,"oyabe.toyama.jp":1,"oyama.tochigi.jp":1,"oyamazaki.kyoto.jp":1,"oyer.no":1,"oygarden.no":1,"oyodo.nara.jp":1,"oystre-slidre.no":1,"oz.au":1,"ozora.hokkaido.jp":1,"ozu.ehime.jp":1,"ozu.kumamoto.jp":1,"p.bg":1,"p.se":1,"pa.gov.br":1,"pa.gov.pl":1,"pa.it":1,"pa.leg.br":1,"pa.us":1,"pacific.museum":1,"paderborn.museum":1,"padova.it":1,"padua.it":1,"pagefrontapp.com":1,"pagespeedmobilizer.com":1,"palace.museum":1,"paleo.museum":1,"palermo.it":1,"palmas.br":1,"palmsprings.museum":1,"panama.museum":1,"pantheonsite.io":1,"parachuting.aero":1,"paragliding.aero":1,"paris.eu.org":1,"paris.museum":1,"parliament.cy":1,"parliament.nz":1,"parma.it":1,"paroch.k12.ma.us":1,"parti.se":1,"pasadena.museum":1,"passenger-association.aero":1,"patria.bo":1,"pavia.it":1,"pb.ao":1,"pb.gov.br":1,"pb.leg.br":1,"pc.it":1,"pc.pl":1,"pcloud.host":1,"pd.it":1,"pe.ca":1,"pe.gov.br":1,"pe.it":1,"pe.kr":1,"pe.leg.br":1,"penza.su":1,"per.la":1,"per.nf":1,"per.sg":1,"perso.ht":1,"perso.sn":1,"perso.tn":1,"perugia.it":1,"pesaro-urbino.it":1,"pesarourbino.it":1,"pescara.it":1,"pg":2,"pg.it":1,"pgafan.net":1,"pgfog.com":1,"pharmacien.fr":1,"pharmaciens.km":1,"pharmacy.museum":1,"philadelphia.museum":1,"philadelphiaarea.museum":1,"philately.museum":1,"phoenix.museum":1,"photography.museum":1,"pi.gov.br":1,"pi.it":1,"pi.leg.br":1,"piacenza.it":1,"piedmont.it":1,"piemonte.it":1,"pila.pl":1,"pilot.aero":1,"pilots.museum":1,"pimienta.org":1,"pinb.gov.pl":1,"pippu.hokkaido.jp":1,"pisa.it":1,"pistoia.it":1,"pisz.pl":1,"pittsburgh.museum":1,"piw.gov.pl":1,"pixolino.com":1,"pl.eu.org":1,"pl.ua":1,"planetarium.museum":1,"plantation.museum":1,"plants.museum":1,"platform.sh":2,"platformsh.site":2,"plaza.museum":1,"plc.co.im":1,"plc.ly":1,"plc.uk":1,"plo.ps":1,"plurinacional.bo":1,"pmn.it":1,"pn.it":1,"po.gov.pl":1,"po.it":1,"poa.br":1,"podhale.pl":1,"podlasie.pl":1,"podzone.net":1,"podzone.org":1,"point2this.com":1,"pointto.us":1,"poivron.org":1,"pokrovsk.su":1,"pol.dz":1,"pol.ht":1,"pol.tr":1,"police.uk":1,"politica.bo":1,"polkowice.pl":1,"poltava.ua":1,"pomorskie.pl":1,"pomorze.pl":1,"poniatowa.pl":1,"ponpes.id":1,"pony.club":1,"pordenone.it":1,"porsanger.no":1,"porsangu.no":1,"porsgrunn.no":1,"port.fr":1,"portal.museum":1,"portland.museum":1,"portlligat.museum":1,"posts-and-telecommunications.museum":1,"potager.org":1,"potenza.it":1,"powiat.pl":1,"poznan.pl":1,"pp.az":1,"pp.ru":1,"pp.se":1,"pp.ua":1,"ppg.br":1,"pr.gov.br":1,"pr.it":1,"pr.leg.br":1,"pr.us":1,"prato.it":1,"prd.fr":1,"prd.km":1,"prd.mg":1,"preservation.museum":1,"presidio.museum":1,"press.aero":1,"press.cy":1,"press.ma":1,"press.museum":1,"press.se":1,"presse.ci":1,"presse.km":1,"presse.ml":1,"pri.ee":1,"principe.st":1,"priv.at":1,"priv.hu":1,"priv.me":1,"priv.no":1,"priv.pl":1,"privatizehealthinsurance.net":1,"pro.az":1,"pro.br":1,"pro.cy":1,"pro.ec":1,"pro.ht":1,"pro.mv":1,"pro.na":1,"pro.om":1,"pro.pr":1,"pro.tt":1,"pro.vn":1,"prochowice.pl":1,"production.aero":1,"prof.pr":1,"profesional.bo":1,"project.museum":1,"protonet.io":1,"pruszkow.pl":1,"prvcy.page":1,"przeworsk.pl":1,"psc.br":1,"psi.br":1,"psp.gov.pl":1,"psse.gov.pl":1,"pt.eu.org":1,"pt.it":1,"ptplus.fit":1,"pu.it":1,"pub.sa":1,"publ.pt":1,"public.museum":1,"publishproxy.com":1,"pubol.museum":1,"pubtls.org":1,"pueblo.bo":1,"pug.it":1,"puglia.it":1,"pulawy.pl":1,"pup.gov.pl":1,"pv.it":1,"pvh.br":1,"pvt.ge":1,"pvt.k12.ma.us":1,"pyatigorsk.ru":1,"pz.it":1,"q-a.eu.org":1,"q.bg":1,"qa2.com":1,"qc.ca":1,"qc.com":1,"qh.cn":1,"qld.au":1,"qld.edu.au":1,"qld.gov.au":1,"qsl.br":1,"qualifioapp.com":1,"quebec.museum":1,"quicksytes.com":1,"quipelements.com":2,"r.bg":1,"r.cdn77.net":1,"r.se":1,"ra.it":1,"rackmaze.com":1,"rackmaze.net":1,"rade.no":1,"radio.br":1,"radom.pl":1,"radoy.no":1,"ragusa.it":1,"rahkkeravju.no":1,"raholt.no":1,"railroad.museum":1,"railway.museum":1,"raisa.no":1,"rakkestad.no":1,"ralingen.no":1,"rana.no":1,"randaberg.no":1,"rankoshi.hokkaido.jp":1,"ranzan.saitama.jp":1,"ras.ru":1,"rauma.no":1,"ravendb.community":1,"ravendb.me":1,"ravendb.run":1,"ravenna.it":1,"rawa-maz.pl":1,"rc.it":1,"re.it":1,"re.kr":1,"read-books.org":1,"readmyblog.org":1,"readthedocs.io":1,"realestate.pl":1,"realm.cz":1,"rebun.hokkaido.jp":1,"rec.br":1,"rec.co":1,"rec.nf":1,"rec.ro":1,"rec.ve":1,"recht.pro":1,"recife.br":1,"recreation.aero":1,"red.sv":1,"redirectme.net":1,"reg.dk":1,"reggio-calabria.it":1,"reggio-emilia.it":1,"reggiocalabria.it":1,"reggioemilia.it":1,"reklam.hu":1,"rel.ht":1,"rel.pl":1,"remotewd.com":1,"rendalen.no":1,"rennebu.no":1,"rennesoy.no":1,"rep.kp":1,"repbody.aero":1,"repl.co":1,"repl.run":1,"res.aero":1,"res.in":1,"research.aero":1,"research.museum":1,"resindevice.io":1,"resistance.museum":1,"revista.bo":1,"rg.it":1,"rhcloud.com":1,"ri.it":1,"ri.us":1,"ribeirao.br":1,"rieti.it":1,"rifu.miyagi.jp":1,"riik.ee":1,"rikubetsu.hokkaido.jp":1,"rikuzentakata.iwate.jp":1,"rimini.it":1,"rindal.no":1,"ringebu.no":1,"ringerike.no":1,"ringsaker.no":1,"rio.br":1,"riobranco.br":1,"riodejaneiro.museum":1,"riopreto.br":1,"rishiri.hokkaido.jp":1,"rishirifuji.hokkaido.jp":1,"risor.no":1,"rissa.no":1,"ritto.shiga.jp":1,"rivne.ua":1,"rj.gov.br":1,"rj.leg.br":1,"rl.no":1,"rm.it":1,"rn.gov.br":1,"rn.it":1,"rn.leg.br":1,"rnrt.tn":1,"rns.tn":1,"rnu.tn":1,"ro.eu.org":1,"ro.gov.br":1,"ro.im":1,"ro.it":1,"ro.leg.br":1,"roan.no":1,"rochester.museum":1,"rockart.museum":1,"rodoy.no":1,"rokunohe.aomori.jp":1,"rollag.no":1,"roma.it":1,"roma.museum":1,"rome.it":1,"romsa.no":1,"romskog.no":1,"roros.no":1,"rost.no":1,"rotorcraft.aero":1,"router.management":1,"rovigo.it":1,"rovno.ua":1,"royken.no":1,"royrvik.no":1,"rr.gov.br":1,"rr.leg.br":1,"rs.gov.br":1,"rs.leg.br":1,"rsc.cdn77.org":1,"ru.com":1,"ru.eu.org":1,"ru.net":1,"run.app":1,"ruovat.no":1,"russia.museum":1,"rv.ua":1,"rybnik.pl":1,"rygge.no":1,"ryokami.saitama.jp":1,"ryugasaki.ibaraki.jp":1,"ryuoh.shiga.jp":1,"rzeszow.pl":1,"rzgw.gov.pl":1,"s.bg":1,"s.se":1,"s3-ap-northeast-1.amazonaws.com":1,"s3-ap-northeast-2.amazonaws.com":1,"s3-ap-south-1.amazonaws.com":1,"s3-ap-southeast-1.amazonaws.com":1,"s3-ap-southeast-2.amazonaws.com":1,"s3-ca-central-1.amazonaws.com":1,"s3-eu-central-1.amazonaws.com":1,"s3-eu-west-1.amazonaws.com":1,"s3-eu-west-2.amazonaws.com":1,"s3-eu-west-3.amazonaws.com":1,"s3-external-1.amazonaws.com":1,"s3-fips-us-gov-west-1.amazonaws.com":1,"s3-sa-east-1.amazonaws.com":1,"s3-us-east-2.amazonaws.com":1,"s3-us-gov-west-1.amazonaws.com":1,"s3-us-west-1.amazonaws.com":1,"s3-us-west-2.amazonaws.com":1,"s3-website-ap-northeast-1.amazonaws.com":1,"s3-website-ap-southeast-1.amazonaws.com":1,"s3-website-ap-southeast-2.amazonaws.com":1,"s3-website-eu-west-1.amazonaws.com":1,"s3-website-sa-east-1.amazonaws.com":1,"s3-website-us-east-1.amazonaws.com":1,"s3-website-us-west-1.amazonaws.com":1,"s3-website-us-west-2.amazonaws.com":1,"s3-website.ap-northeast-2.amazonaws.com":1,"s3-website.ap-south-1.amazonaws.com":1,"s3-website.ca-central-1.amazonaws.com":1,"s3-website.eu-central-1.amazonaws.com":1,"s3-website.eu-west-2.amazonaws.com":1,"s3-website.eu-west-3.amazonaws.com":1,"s3-website.us-east-2.amazonaws.com":1,"s3.amazonaws.com":1,"s3.ap-northeast-2.amazonaws.com":1,"s3.ap-south-1.amazonaws.com":1,"s3.ca-central-1.amazonaws.com":1,"s3.cn-north-1.amazonaws.com.cn":1,"s3.dualstack.ap-northeast-1.amazonaws.com":1,"s3.dualstack.ap-northeast-2.amazonaws.com":1,"s3.dualstack.ap-south-1.amazonaws.com":1,"s3.dualstack.ap-southeast-1.amazonaws.com":1,"s3.dualstack.ap-southeast-2.amazonaws.com":1,"s3.dualstack.ca-central-1.amazonaws.com":1,"s3.dualstack.eu-central-1.amazonaws.com":1,"s3.dualstack.eu-west-1.amazonaws.com":1,"s3.dualstack.eu-west-2.amazonaws.com":1,"s3.dualstack.eu-west-3.amazonaws.com":1,"s3.dualstack.sa-east-1.amazonaws.com":1,"s3.dualstack.us-east-1.amazonaws.com":1,"s3.dualstack.us-east-2.amazonaws.com":1,"s3.eu-central-1.amazonaws.com":1,"s3.eu-west-2.amazonaws.com":1,"s3.eu-west-3.amazonaws.com":1,"s3.us-east-2.amazonaws.com":1,"s5y.io":2,"sa-east-1.elasticbeanstalk.com":1,"sa.au":1,"sa.com":1,"sa.cr":1,"sa.edu.au":1,"sa.gov.au":1,"sa.gov.pl":1,"sa.it":1,"sabae.fukui.jp":1,"sado.niigata.jp":1,"safety.aero":1,"saga.jp":1,"saga.saga.jp":1,"sagae.yamagata.jp":1,"sagamihara.kanagawa.jp":1,"saigawa.fukuoka.jp":1,"saijo.ehime.jp":1,"saikai.nagasaki.jp":1,"saiki.oita.jp":1,"saintlouis.museum":1,"saitama.jp":1,"saitama.saitama.jp":1,"saito.miyazaki.jp":1,"saka.hiroshima.jp":1,"sakado.saitama.jp":1,"sakae.chiba.jp":1,"sakae.nagano.jp":1,"sakahogi.gifu.jp":1,"sakai.fukui.jp":1,"sakai.ibaraki.jp":1,"sakai.osaka.jp":1,"sakaiminato.tottori.jp":1,"sakaki.nagano.jp":1,"sakata.yamagata.jp":1,"sakawa.kochi.jp":1,"sakegawa.yamagata.jp":1,"saku.nagano.jp":1,"sakuho.nagano.jp":1,"sakura.chiba.jp":1,"sakura.tochigi.jp":1,"sakuragawa.ibaraki.jp":1,"sakurai.nara.jp":1,"sakyo.kyoto.jp":1,"salangen.no":1,"salat.no":1,"salem.museum":1,"salerno.it":1,"saltdal.no":1,"salud.bo":1,"salvador.br":1,"salvadordali.museum":1,"salzburg.museum":1,"samegawa.fukushima.jp":1,"samnanger.no":1,"sampa.br":1,"samukawa.kanagawa.jp":1,"sanagochi.tokushima.jp":1,"sanda.hyogo.jp":1,"sandcats.io":1,"sande.more-og-romsdal.no":1,"sande.vestfold.no":1,"sande.xn--mre-og-romsdal-qqb.no":1,"sandefjord.no":1,"sandiego.museum":1,"sandnes.no":1,"sandnessjoen.no":1,"sandoy.no":1,"sanfrancisco.museum":1,"sango.nara.jp":1,"sanjo.niigata.jp":1,"sannan.hyogo.jp":1,"sannohe.aomori.jp":1,"sano.tochigi.jp":1,"sanok.pl":1,"santabarbara.museum":1,"santacruz.museum":1,"santafe.museum":1,"santamaria.br":1,"santoandre.br":1,"sanuki.kagawa.jp":1,"saobernardo.br":1,"saogonca.br":1,"saotome.st":1,"sapporo.jp":2,"sar.it":1,"sardegna.it":1,"sardinia.it":1,"saroma.hokkaido.jp":1,"sarpsborg.no":1,"sarufutsu.hokkaido.jp":1,"sasaguri.fukuoka.jp":1,"sasayama.hyogo.jp":1,"sasebo.nagasaki.jp":1,"saskatchewan.museum":1,"sassari.it":1,"satosho.okayama.jp":1,"satsumasendai.kagoshima.jp":1,"satte.saitama.jp":1,"satx.museum":1,"sauda.no":1,"sauherad.no":1,"savannahga.museum":1,"saves-the-whales.com":1,"savona.it":1,"sayama.osaka.jp":1,"sayama.saitama.jp":1,"sayo.hyogo.jp":1,"sb.ua":1,"sc.cn":1,"sc.gov.br":1,"sc.ke":1,"sc.kr":1,"sc.leg.br":1,"sc.ls":1,"sc.tz":1,"sc.ug":1,"sc.us":1,"scapp.io":1,"sch.ae":1,"sch.id":1,"sch.ir":1,"sch.jo":1,"sch.lk":1,"sch.ly":1,"sch.ng":1,"sch.qa":1,"sch.sa":1,"sch.so":1,"sch.uk":2,"sch.zm":1,"schlesisches.museum":1,"schoenbrunn.museum":1,"schokokeks.net":1,"schokoladen.museum":1,"school.museum":1,"school.na":1,"school.nz":1,"school.za":1,"schools.nsw.edu.au":1,"schweiz.museum":1,"sci.eg":1,"science-fiction.museum":1,"science.museum":1,"scienceandhistory.museum":1,"scienceandindustry.museum":1,"sciencecenter.museum":1,"sciencecenters.museum":1,"sciencehistory.museum":1,"sciences.museum":1,"sciencesnaturelles.museum":1,"scientist.aero":1,"scotland.museum":1,"scrapper-site.net":1,"scrapping.cc":1,"scrysec.com":1,"sd.cn":1,"sd.us":1,"sdn.gov.pl":1,"se.eu.org":1,"se.gov.br":1,"se.leg.br":1,"se.net":1,"seaport.museum":1,"sebastopol.ua":1,"sec.ps":1,"securitytactics.com":1,"seihi.nagasaki.jp":1,"seika.kyoto.jp":1,"seiro.niigata.jp":1,"seirou.niigata.jp":1,"seiyo.ehime.jp":1,"sejny.pl":1,"seki.gifu.jp":1,"sekigahara.gifu.jp":1,"sekikawa.niigata.jp":1,"sel.no":1,"selbu.no":1,"selfip.biz":1,"selfip.com":1,"selfip.info":1,"selfip.net":1,"selfip.org":1,"selje.no":1,"seljord.no":1,"sells-for-less.com":1,"sells-for-u.com":1,"sells-it.net":1,"sellsyourhome.org":1,"semboku.akita.jp":1,"semine.miyagi.jp":1,"sendai.jp":2,"sennan.osaka.jp":1,"sensiosite.cloud":2,"seoul.kr":1,"sera.hiroshima.jp":1,"seranishi.hiroshima.jp":1,"servebbs.com":1,"servebbs.net":1,"servebbs.org":1,"servebeer.com":1,"serveblog.net":1,"servecounterstrike.com":1,"serveexchange.com":1,"serveftp.com":1,"serveftp.net":1,"serveftp.org":1,"servegame.com":1,"servegame.org":1,"servehalflife.com":1,"servehttp.com":1,"servehumour.com":1,"serveirc.com":1,"serveminecraft.net":1,"servemp3.com":1,"servep2p.com":1,"servepics.com":1,"servequake.com":1,"servesarcasm.com":1,"service.gov.uk":1,"services.aero":1,"setagaya.tokyo.jp":1,"seto.aichi.jp":1,"setouchi.okayama.jp":1,"settlement.museum":1,"settlers.museum":1,"settsu.osaka.jp":1,"sevastopol.ua":1,"sex.hu":1,"sex.pl":1,"sf.no":1,"sh.cn":1,"shacknet.nu":1,"shakotan.hokkaido.jp":1,"shari.hokkaido.jp":1,"shell.museum":1,"sherbrooke.museum":1,"shibata.miyagi.jp":1,"shibata.niigata.jp":1,"shibecha.hokkaido.jp":1,"shibetsu.hokkaido.jp":1,"shibukawa.gunma.jp":1,"shibuya.tokyo.jp":1,"shichikashuku.miyagi.jp":1,"shichinohe.aomori.jp":1,"shiftedit.io":1,"shiga.jp":1,"shiiba.miyazaki.jp":1,"shijonawate.osaka.jp":1,"shika.ishikawa.jp":1,"shikabe.hokkaido.jp":1,"shikama.miyagi.jp":1,"shikaoi.hokkaido.jp":1,"shikatsu.aichi.jp":1,"shiki.saitama.jp":1,"shikokuchuo.ehime.jp":1,"shima.mie.jp":1,"shimabara.nagasaki.jp":1,"shimada.shizuoka.jp":1,"shimamaki.hokkaido.jp":1,"shimamoto.osaka.jp":1,"shimane.jp":1,"shimane.shimane.jp":1,"shimizu.hokkaido.jp":1,"shimizu.shizuoka.jp":1,"shimoda.shizuoka.jp":1,"shimodate.ibaraki.jp":1,"shimofusa.chiba.jp":1,"shimogo.fukushima.jp":1,"shimoichi.nara.jp":1,"shimoji.okinawa.jp":1,"shimokawa.hokkaido.jp":1,"shimokitayama.nara.jp":1,"shimonita.gunma.jp":1,"shimonoseki.yamaguchi.jp":1,"shimosuwa.nagano.jp":1,"shimotsuke.tochigi.jp":1,"shimotsuma.ibaraki.jp":1,"shinagawa.tokyo.jp":1,"shinanomachi.nagano.jp":1,"shingo.aomori.jp":1,"shingu.fukuoka.jp":1,"shingu.hyogo.jp":1,"shingu.wakayama.jp":1,"shinichi.hiroshima.jp":1,"shinjo.nara.jp":1,"shinjo.okayama.jp":1,"shinjo.yamagata.jp":1,"shinjuku.tokyo.jp":1,"shinkamigoto.nagasaki.jp":1,"shinonsen.hyogo.jp":1,"shinshinotsu.hokkaido.jp":1,"shinshiro.aichi.jp":1,"shinto.gunma.jp":1,"shintoku.hokkaido.jp":1,"shintomi.miyazaki.jp":1,"shinyoshitomi.fukuoka.jp":1,"shiogama.miyagi.jp":1,"shiojiri.nagano.jp":1,"shioya.tochigi.jp":1,"shirahama.wakayama.jp":1,"shirakawa.fukushima.jp":1,"shirakawa.gifu.jp":1,"shirako.chiba.jp":1,"shiranuka.hokkaido.jp":1,"shiraoi.hokkaido.jp":1,"shiraoka.saitama.jp":1,"shirataka.yamagata.jp":1,"shiriuchi.hokkaido.jp":1,"shiroi.chiba.jp":1,"shiroishi.miyagi.jp":1,"shiroishi.saga.jp":1,"shirosato.ibaraki.jp":1,"shishikui.tokushima.jp":1,"shiso.hyogo.jp":1,"shisui.chiba.jp":1,"shitara.aichi.jp":1,"shiwa.iwate.jp":1,"shizukuishi.iwate.jp":1,"shizuoka.jp":1,"shizuoka.shizuoka.jp":1,"shobara.hiroshima.jp":1,"shonai.fukuoka.jp":1,"shonai.yamagata.jp":1,"shoo.okayama.jp":1,"shop.ht":1,"shop.hu":1,"shop.pl":1,"shop.ro":1,"shop.th":1,"shopitsite.com":1,"show.aero":1,"showa.fukushima.jp":1,"showa.gunma.jp":1,"showa.yamanashi.jp":1,"shunan.yamaguchi.jp":1,"si.eu.org":1,"si.it":1,"sibenik.museum":1,"sic.it":1,"sicilia.it":1,"sicily.it":1,"siellak.no":1,"siena.it":1,"sigdal.no":1,"siljan.no":1,"silk.museum":1,"simple-url.com":1,"sinaapp.com":1,"siracusa.it":1,"sirdal.no":1,"site.builder.nu":1,"siteleaf.net":1,"sites.static.land":1,"sjc.br":1,"sk.ca":1,"sk.eu.org":1,"skanit.no":1,"skanland.no":1,"skaun.no":1,"skedsmo.no":1,"skedsmokorset.no":1,"ski.museum":1,"ski.no":1,"skien.no":1,"skierva.no":1,"skiptvet.no":1,"skjak.no":1,"skjervoy.no":1,"sklep.pl":1,"sko.gov.pl":1,"skoczow.pl":1,"skodje.no":1,"skole.museum":1,"skydiving.aero":1,"slask.pl":1,"slattum.no":1,"sld.do":1,"sld.pa":1,"slg.br":1,"slupsk.pl":1,"slz.br":1,"sm.ua":1,"smola.no":1,"sn.cn":1,"snaase.no":1,"snasa.no":1,"snillfjord.no":1,"snoasa.no":1,"so.gov.pl":1,"so.it":1,"sobetsu.hokkaido.jp":1,"soc.lk":1,"soc.srcf.net":1,"sochi.su":1,"society.museum":1,"sodegaura.chiba.jp":1,"soeda.fukuoka.jp":1,"software.aero":1,"sogndal.no":1,"sogne.no":1,"soja.okayama.jp":1,"soka.saitama.jp":1,"sokndal.no":1,"sola.no":1,"sologne.museum":1,"solund.no":1,"soma.fukushima.jp":1,"somna.no":1,"sondre-land.no":1,"sondrio.it":1,"songdalen.no":1,"soni.nara.jp":1,"soo.kagoshima.jp":1,"sopot.pl":1,"sor-aurdal.no":1,"sor-fron.no":1,"sor-odal.no":1,"sor-varanger.no":1,"sorfold.no":1,"sorocaba.br":1,"sorreisa.no":1,"sortland.no":1,"sorum.no":1,"sos.pl":1,"sosa.chiba.jp":1,"sosnowiec.pl":1,"soundandvision.museum":1,"soundcast.me":1,"southcarolina.museum":1,"southwest.museum":1,"sowa.ibaraki.jp":1,"sp.gov.br":1,"sp.it":1,"sp.leg.br":1,"space-to-rent.com":1,"space.museum":1,"spacekit.io":1,"spb.ru":1,"spb.su":1,"spdns.de":1,"spdns.eu":1,"spdns.org":1,"spectrum.myjino.ru":2,"spjelkavik.no":1,"sport.hu":1,"spy.museum":1,"spydeberg.no":1,"square.museum":1,"square7.ch":1,"square7.de":1,"square7.net":1,"sr.gov.pl":1,"sr.it":1,"srv.br":1,"ss.it":1,"ssl.origin.cdn77-secure.org":1,"st.no":1,"stackhero-network.com":1,"stadt.museum":1,"stage.nodeart.io":1,"staging.onred.one":1,"stalbans.museum":1,"stalowa-wola.pl":1,"stange.no":1,"starachowice.pl":1,"stargard.pl":1,"starnberg.museum":1,"starostwo.gov.pl":1,"stat.no":1,"state.museum":1,"stateofdelaware.museum":1,"stathelle.no":1,"static-access.net":1,"static.land":1,"statics.cloud":2,"station.museum":1,"stavanger.no":1,"stavern.no":1,"steam.museum":1,"steiermark.museum":1,"steigen.no":1,"steinkjer.no":1,"stg.dev":2,"stjohn.museum":1,"stjordal.no":1,"stjordalshalsen.no":1,"stockholm.museum":1,"stokke.no":1,"stolos.io":2,"stor-elvdal.no":1,"storage.yandexcloud.net":1,"stord.no":1,"stordal.no":1,"store.bb":1,"store.dk":1,"store.nf":1,"store.ro":1,"store.st":1,"store.ve":1,"storfjord.no":1,"storj.farm":1,"stpetersburg.museum":1,"strand.no":1,"stranda.no":1,"stryn.no":1,"student.aero":1,"stuff-4-sale.org":1,"stuff-4-sale.us":1,"stufftoread.com":1,"stuttgart.museum":1,"sue.fukuoka.jp":1,"suedtirol.it":1,"suginami.tokyo.jp":1,"sugito.saitama.jp":1,"suifu.ibaraki.jp":1,"suisse.museum":1,"suita.osaka.jp":1,"sukagawa.fukushima.jp":1,"sukumo.kochi.jp":1,"sula.no":1,"suldal.no":1,"suli.hu":1,"sumida.tokyo.jp":1,"sumita.iwate.jp":1,"sumoto.hyogo.jp":1,"sumoto.kumamoto.jp":1,"sumy.ua":1,"sunagawa.hokkaido.jp":1,"sund.no":1,"sunndal.no":1,"surgeonshall.museum":1,"surnadal.no":1,"surrey.museum":1,"susaki.kochi.jp":1,"susono.shizuoka.jp":1,"suwa.nagano.jp":1,"suwalki.pl":1,"suzaka.nagano.jp":1,"suzu.ishikawa.jp":1,"suzuka.mie.jp":1,"sv.it":1,"svalbard.no":1,"sveio.no":1,"svelvik.no":1,"svizzera.museum":1,"svn-repos.de":1,"sweden.museum":1,"sweetpepper.org":1,"swidnica.pl":1,"swidnik.pl":1,"swiebodzin.pl":1,"swinoujscie.pl":1,"sx.cn":1,"sydney.museum":1,"sykkylven.no":1,"syncloud.it":1,"syno-ds.de":1,"synology-diskstation.de":1,"synology-ds.de":1,"synology.me":1,"sytes.net":1,"szczecin.pl":1,"szczytno.pl":1,"szex.hu":1,"szkola.pl":1,"t.bg":1,"t.se":1,"t3l3p0rt.net":1,"ta.it":1,"taa.it":1,"tabayama.yamanashi.jp":1,"tabuse.yamaguchi.jp":1,"tachiarai.fukuoka.jp":1,"tachikawa.tokyo.jp":1,"tadaoka.osaka.jp":1,"tado.mie.jp":1,"tadotsu.kagawa.jp":1,"tagajo.miyagi.jp":1,"tagami.niigata.jp":1,"tagawa.fukuoka.jp":1,"tahara.aichi.jp":1,"taifun-dns.de":1,"taiji.wakayama.jp":1,"taiki.hokkaido.jp":1,"taiki.mie.jp":1,"tainai.niigata.jp":1,"taira.toyama.jp":1,"taishi.hyogo.jp":1,"taishi.osaka.jp":1,"taishin.fukushima.jp":1,"taito.tokyo.jp":1,"taiwa.miyagi.jp":1,"tajimi.gifu.jp":1,"tajiri.osaka.jp":1,"taka.hyogo.jp":1,"takagi.nagano.jp":1,"takahagi.ibaraki.jp":1,"takahama.aichi.jp":1,"takahama.fukui.jp":1,"takaharu.miyazaki.jp":1,"takahashi.okayama.jp":1,"takahata.yamagata.jp":1,"takaishi.osaka.jp":1,"takamatsu.kagawa.jp":1,"takamori.kumamoto.jp":1,"takamori.nagano.jp":1,"takanabe.miyazaki.jp":1,"takanezawa.tochigi.jp":1,"takaoka.toyama.jp":1,"takarazuka.hyogo.jp":1,"takasago.hyogo.jp":1,"takasaki.gunma.jp":1,"takashima.shiga.jp":1,"takasu.hokkaido.jp":1,"takata.fukuoka.jp":1,"takatori.nara.jp":1,"takatsuki.osaka.jp":1,"takatsuki.shiga.jp":1,"takayama.gifu.jp":1,"takayama.gunma.jp":1,"takayama.nagano.jp":1,"takazaki.miyazaki.jp":1,"takehara.hiroshima.jp":1,"taketa.oita.jp":1,"taketomi.okinawa.jp":1,"taki.mie.jp":1,"takikawa.hokkaido.jp":1,"takino.hyogo.jp":1,"takinoue.hokkaido.jp":1,"takko.aomori.jp":1,"tako.chiba.jp":1,"taku.saga.jp":1,"tama.tokyo.jp":1,"tamakawa.fukushima.jp":1,"tamaki.mie.jp":1,"tamamura.gunma.jp":1,"tamano.okayama.jp":1,"tamatsukuri.ibaraki.jp":1,"tamayu.shimane.jp":1,"tamba.hyogo.jp":1,"tana.no":1,"tanabe.kyoto.jp":1,"tanabe.wakayama.jp":1,"tanagura.fukushima.jp":1,"tananger.no":1,"tank.museum":1,"tanohata.iwate.jp":1,"tara.saga.jp":1,"tarama.okinawa.jp":1,"taranto.it":1,"targi.pl":1,"tarnobrzeg.pl":1,"tarui.gifu.jp":1,"tarumizu.kagoshima.jp":1,"tas.au":1,"tas.edu.au":1,"tas.gov.au":1,"tashkent.su":1,"tatebayashi.gunma.jp":1,"tateshina.nagano.jp":1,"tateyama.chiba.jp":1,"tateyama.toyama.jp":1,"tatsuno.hyogo.jp":1,"tatsuno.nagano.jp":1,"tawaramoto.nara.jp":1,"taxi.br":1,"tc.br":1,"tcm.museum":1,"tcp4.me":1,"te.it":1,"te.ua":1,"teaches-yoga.com":1,"tec.mi.us":1,"tec.ve":1,"technology.museum":1,"tecnologia.bo":1,"tel.tr":1,"tele.amune.org":1,"telebit.app":1,"telebit.io":1,"telebit.xyz":2,"telekommunikation.museum":1,"television.museum":1,"temp-dns.com":1,"tempio-olbia.it":1,"tempioolbia.it":1,"tendo.yamagata.jp":1,"tenei.fukushima.jp":1,"tenkawa.nara.jp":1,"tenri.nara.jp":1,"teo.br":1,"teramo.it":1,"termez.su":1,"terni.it":1,"ternopil.ua":1,"teshikaga.hokkaido.jp":1,"test-iserv.de":1,"test.ru":1,"test.tj":1,"texas.museum":1,"textile.museum":1,"tgory.pl":1,"the.br":1,"theater.museum":1,"theworkpc.com":1,"thingdustdata.com":1,"thruhere.net":1,"time.museum":1,"time.no":1,"timekeeping.museum":1,"tingvoll.no":1,"tinn.no":1,"tj.cn":1,"tjeldsund.no":1,"tjome.no":1,"tksat.bo":1,"tm.cy":1,"tm.fr":1,"tm.hu":1,"tm.km":1,"tm.mc":1,"tm.mg":1,"tm.no":1,"tm.pl":1,"tm.ro":1,"tm.se":1,"tm.za":1,"tmp.br":1,"tn.it":1,"tn.us":1,"to.gov.br":1,"to.it":1,"to.leg.br":1,"to.work":1,"toba.mie.jp":1,"tobe.ehime.jp":1,"tobetsu.hokkaido.jp":1,"tobishima.aichi.jp":1,"tochigi.jp":1,"tochigi.tochigi.jp":1,"tochio.niigata.jp":1,"toda.saitama.jp":1,"toei.aichi.jp":1,"toga.toyama.jp":1,"togakushi.nagano.jp":1,"togane.chiba.jp":1,"togitsu.nagasaki.jp":1,"togliatti.su":1,"togo.aichi.jp":1,"togura.nagano.jp":1,"tohma.hokkaido.jp":1,"tohnosho.chiba.jp":1,"toho.fukuoka.jp":1,"tokai.aichi.jp":1,"tokai.ibaraki.jp":1,"tokamachi.niigata.jp":1,"tokashiki.okinawa.jp":1,"toki.gifu.jp":1,"tokigawa.saitama.jp":1,"tokke.no":1,"tokoname.aichi.jp":1,"tokorozawa.saitama.jp":1,"tokushima.jp":1,"tokushima.tokushima.jp":1,"tokuyama.yamaguchi.jp":1,"tokyo.jp":1,"tolga.no":1,"tomakomai.hokkaido.jp":1,"tomari.hokkaido.jp":1,"tome.miyagi.jp":1,"tomi.nagano.jp":1,"tomigusuku.okinawa.jp":1,"tomika.gifu.jp":1,"tomioka.gunma.jp":1,"tomisato.chiba.jp":1,"tomiya.miyagi.jp":1,"tomobe.ibaraki.jp":1,"tonaki.okinawa.jp":1,"tonami.toyama.jp":1,"tondabayashi.osaka.jp":1,"tone.ibaraki.jp":1,"tono.iwate.jp":1,"tonosho.kagawa.jp":1,"tonsberg.no":1,"toon.ehime.jp":1,"topology.museum":1,"torahime.shiga.jp":1,"toride.ibaraki.jp":1,"torino.it":1,"torino.museum":1,"torsken.no":1,"tos.it":1,"tosa.kochi.jp":1,"tosashimizu.kochi.jp":1,"toscana.it":1,"toshima.tokyo.jp":1,"tosu.saga.jp":1,"tottori.jp":1,"tottori.tottori.jp":1,"touch.museum":1,"tourism.pl":1,"tourism.tn":1,"towada.aomori.jp":1,"town.museum":1,"townnews-staging.com":1,"toya.hokkaido.jp":1,"toyako.hokkaido.jp":1,"toyama.jp":1,"toyama.toyama.jp":1,"toyo.kochi.jp":1,"toyoake.aichi.jp":1,"toyohashi.aichi.jp":1,"toyokawa.aichi.jp":1,"toyonaka.osaka.jp":1,"toyone.aichi.jp":1,"toyono.osaka.jp":1,"toyooka.hyogo.jp":1,"toyosato.shiga.jp":1,"toyota.aichi.jp":1,"toyota.yamaguchi.jp":1,"toyotomi.hokkaido.jp":1,"toyotsu.fukuoka.jp":1,"toyoura.hokkaido.jp":1,"tozawa.yamagata.jp":1,"tozsde.hu":1,"tp.it":1,"tr.eu.org":1,"tr.it":1,"tr.no":1,"tra.kp":1,"trader.aero":1,"trading.aero":1,"traeumtgerade.de":1,"trafficplex.cloud":1,"trainer.aero":1,"trana.no":1,"tranby.no":1,"trani-andria-barletta.it":1,"trani-barletta-andria.it":1,"traniandriabarletta.it":1,"tranibarlettaandria.it":1,"tranoy.no":1,"transport.museum":1,"transporte.bo":1,"transurl.be":2,"transurl.eu":2,"transurl.nl":2,"trapani.it":1,"travel.pl":1,"travel.tt":1,"trd.br":1,"tree.museum":1,"trentin-sud-tirol.it":1,"trentin-sudtirol.it":1,"trentin-sued-tirol.it":1,"trentin-suedtirol.it":1,"trentino-a-adige.it":1,"trentino-aadige.it":1,"trentino-alto-adige.it":1,"trentino-altoadige.it":1,"trentino-s-tirol.it":1,"trentino-stirol.it":1,"trentino-sud-tirol.it":1,"trentino-sudtirol.it":1,"trentino-sued-tirol.it":1,"trentino-suedtirol.it":1,"trentino.it":1,"trentinoa-adige.it":1,"trentinoaadige.it":1,"trentinoalto-adige.it":1,"trentinoaltoadige.it":1,"trentinos-tirol.it":1,"trentinostirol.it":1,"trentinosud-tirol.it":1,"trentinosudtirol.it":1,"trentinosued-tirol.it":1,"trentinosuedtirol.it":1,"trentinsud-tirol.it":1,"trentinsudtirol.it":1,"trentinsued-tirol.it":1,"trentinsuedtirol.it":1,"trento.it":1,"treviso.it":1,"trieste.it":1,"triton.zone":2,"troandin.no":1,"trogstad.no":1,"troitsk.su":1,"trolley.museum":1,"tromsa.no":1,"tromso.no":1,"trondheim.no":1,"trust.museum":1,"trustee.museum":1,"trycloudflare.com":1,"trysil.no":1,"ts.it":1,"tselinograd.su":1,"tsk.tr":1,"tsu.mie.jp":1,"tsubame.niigata.jp":1,"tsubata.ishikawa.jp":1,"tsubetsu.hokkaido.jp":1,"tsuchiura.ibaraki.jp":1,"tsuga.tochigi.jp":1,"tsugaru.aomori.jp":1,"tsuiki.fukuoka.jp":1,"tsukigata.hokkaido.jp":1,"tsukiyono.gunma.jp":1,"tsukuba.ibaraki.jp":1,"tsukui.kanagawa.jp":1,"tsukumi.oita.jp":1,"tsumagoi.gunma.jp":1,"tsunan.niigata.jp":1,"tsuno.kochi.jp":1,"tsuno.miyazaki.jp":1,"tsuru.yamanashi.jp":1,"tsuruga.fukui.jp":1,"tsurugashima.saitama.jp":1,"tsurugi.ishikawa.jp":1,"tsuruoka.yamagata.jp":1,"tsuruta.aomori.jp":1,"tsushima.aichi.jp":1,"tsushima.nagasaki.jp":1,"tsuwano.shimane.jp":1,"tsuyama.okayama.jp":1,"tt.im":1,"tula.su":1,"tunk.org":1,"tur.ar":1,"tur.br":1,"turek.pl":1,"turen.tn":1,"turin.it":1,"turystyka.pl":1,"tuscany.it":1,"tuva.su":1,"tuxfamily.org":1,"tv.bb":1,"tv.bo":1,"tv.br":1,"tv.im":1,"tv.it":1,"tv.na":1,"tv.sd":1,"tv.tr":1,"tv.tz":1,"tvedestrand.no":1,"tw.cn":1,"twmail.cc":1,"twmail.net":1,"twmail.org":1,"tx.us":1,"tychy.pl":1,"tydal.no":1,"tynset.no":1,"tysfjord.no":1,"tysnes.no":1,"tysvar.no":1,"u.bg":1,"u.se":1,"u2-local.xnbay.com":1,"u2.xnbay.com":1,"ua.rs":1,"ube.yamaguchi.jp":1,"uber.space":1,"uberspace.de":2,"uchihara.ibaraki.jp":1,"uchiko.ehime.jp":1,"uchinada.ishikawa.jp":1,"uchinomi.kagawa.jp":1,"ud.it":1,"uda.nara.jp":1,"udi.br":1,"udine.it":1,"udono.mie.jp":1,"ueda.nagano.jp":1,"ueno.gunma.jp":1,"uenohara.yamanashi.jp":1,"ufcfan.org":1,"ug.gov.pl":1,"ugim.gov.pl":1,"uhren.museum":1,"ui.nabu.casa":1,"uji.kyoto.jp":1,"ujiie.tochigi.jp":1,"ujitawara.kyoto.jp":1,"uk.com":1,"uk.eu.org":1,"uk.net":1,"uk0.bigv.io":1,"uki.kumamoto.jp":1,"ukiha.fukuoka.jp":1,"uklugs.org":1,"ullensaker.no":1,"ullensvang.no":1,"ulm.museum":1,"ulsan.kr":1,"ulvik.no":1,"um.gov.pl":1,"umaji.kochi.jp":1,"umb.it":1,"umbria.it":1,"umi.fukuoka.jp":1,"umig.gov.pl":1,"unazuki.toyama.jp":1,"undersea.museum":1,"uni5.net":1,"union.aero":1,"univ.sn":1,"university.museum":1,"unjarga.no":1,"unnan.shimane.jp":1,"unusualperson.com":1,"unzen.nagasaki.jp":1,"uonuma.niigata.jp":1,"uozu.toyama.jp":1,"upow.gov.pl":1,"uppo.gov.pl":1,"urakawa.hokkaido.jp":1,"urasoe.okinawa.jp":1,"urausu.hokkaido.jp":1,"urawa.saitama.jp":1,"urayasu.chiba.jp":1,"urbino-pesaro.it":1,"urbinopesaro.it":1,"ureshino.mie.jp":1,"uri.arpa":1,"url.tw":1,"urn.arpa":1,"uruma.okinawa.jp":1,"uryu.hokkaido.jp":1,"us-1.evennode.com":1,"us-2.evennode.com":1,"us-3.evennode.com":1,"us-4.evennode.com":1,"us-east-1.amazonaws.com":1,"us-east-1.elasticbeanstalk.com":1,"us-east-2.elasticbeanstalk.com":1,"us-gov-west-1.elasticbeanstalk.com":1,"us-west-1.elasticbeanstalk.com":1,"us-west-2.elasticbeanstalk.com":1,"us.com":1,"us.eu.org":1,"us.gov.pl":1,"us.na":1,"us.org":1,"usa.museum":1,"usa.oita.jp":1,"usantiques.museum":1,"usarts.museum":1,"uscountryestate.museum":1,"usculture.museum":1,"usdecorativearts.museum":1,"user.aseinet.ne.jp":1,"user.party.eus":1,"user.srcf.net":1,"usercontent.jp":1,"usgarden.museum":1,"ushiku.ibaraki.jp":1,"ushistory.museum":1,"ushuaia.museum":1,"uslivinghistory.museum":1,"usr.cloud.muni.cz":1,"ustka.pl":1,"usui.fukuoka.jp":1,"usuki.oita.jp":1,"ut.us":1,"utah.museum":1,"utashinai.hokkaido.jp":1,"utazas.hu":1,"utazu.kagawa.jp":1,"uto.kumamoto.jp":1,"utsira.no":1,"utsunomiya.tochigi.jp":1,"utwente.io":1,"uvic.museum":1,"uw.gov.pl":1,"uwajima.ehime.jp":1,"uwu.ai":1,"uy.com":1,"uz.ua":1,"uzhgorod.ua":1,"uzs.gov.pl":1,"v-info.info":1,"v.bg":1,"va.it":1,"va.no":1,"va.us":1,"vaapste.no":1,"vadso.no":1,"vaga.no":1,"vagan.no":1,"vagsoy.no":1,"vaksdal.no":1,"val-d-aosta.it":1,"val-daosta.it":1,"vald-aosta.it":1,"valdaosta.it":1,"valer.hedmark.no":1,"valer.ostfold.no":1,"valle-aosta.it":1,"valle-d-aosta.it":1,"valle-daosta.it":1,"valle.no":1,"valleaosta.it":1,"valled-aosta.it":1,"valledaosta.it":1,"vallee-aoste.it":1,"vallee-d-aoste.it":1,"valleeaoste.it":1,"valleedaoste.it":1,"valley.museum":1,"vang.no":1,"vantaa.museum":1,"vanylven.no":1,"vao.it":1,"vapor.cloud":1,"vaporcloud.io":1,"vardo.no":1,"varese.it":1,"varggat.no":1,"varoy.no":1,"vb.it":1,"vc.it":1,"vda.it":1,"ve.it":1,"vefsn.no":1,"vega.no":1,"vegarshei.no":1,"ven.it":1,"veneto.it":1,"venezia.it":1,"venice.it":1,"vennesla.no":1,"verbania.it":1,"vercelli.it":1,"verdal.no":1,"verona.it":1,"verran.no":1,"versailles.museum":1,"vestby.no":1,"vestnes.no":1,"vestre-slidre.no":1,"vestre-toten.no":1,"vestvagoy.no":1,"vet.br":1,"veterinaire.fr":1,"veterinaire.km":1,"vevelstad.no":1,"vf.no":1,"vgs.no":1,"vi.it":1,"vi.us":1,"vibo-valentia.it":1,"vibovalentia.it":1,"vic.au":1,"vic.edu.au":1,"vic.gov.au":1,"vicenza.it":1,"video.hu":1,"vik.no":1,"viking.museum":1,"vikna.no":1,"village.museum":1,"vindafjord.no":1,"vinnica.ua":1,"vinnytsia.ua":1,"vipsinaapp.com":1,"virginia.museum":1,"virtual-user.de":1,"virtual.museum":1,"virtualserver.io":1,"virtualuser.de":1,"virtueeldomein.nl":1,"virtuel.museum":1,"viterbo.it":1,"vix.br":1,"vlaanderen.museum":1,"vladikavkaz.ru":1,"vladikavkaz.su":1,"vladimir.ru":1,"vladimir.su":1,"vlog.br":1,"vm.bytemark.co.uk":1,"vn.ua":1,"voagat.no":1,"volda.no":1,"volkenkunde.museum":1,"vologda.su":1,"volyn.ua":1,"voorloper.cloud":1,"voss.no":1,"vossevangen.no":1,"vpndns.net":1,"vpnplus.to":1,"vps.myjino.ru":2,"vr.it":1,"vs.it":1,"vt.it":1,"vt.us":1,"vv.it":1,"w.bg":1,"w.se":1,"wa.au":1,"wa.edu.au":1,"wa.gov.au":1,"wa.us":1,"wada.nagano.jp":1,"wafflecell.com":1,"wajiki.tokushima.jp":1,"wajima.ishikawa.jp":1,"wakasa.fukui.jp":1,"wakasa.tottori.jp":1,"wakayama.jp":1,"wakayama.wakayama.jp":1,"wake.okayama.jp":1,"wakkanai.hokkaido.jp":1,"wakuya.miyagi.jp":1,"walbrzych.pl":1,"wales.museum":1,"wallonie.museum":1,"wanouchi.gifu.jp":1,"war.museum":1,"warabi.saitama.jp":1,"warmia.pl":1,"warszawa.pl":1,"washingtondc.museum":1,"washtenaw.mi.us":1,"wassamu.hokkaido.jp":1,"watarai.mie.jp":1,"watari.miyagi.jp":1,"watch-and-clock.museum":1,"watchandclock.museum":1,"waw.pl":1,"wazuka.kyoto.jp":1,"we.bs":1,"web.app":1,"web.bo":1,"web.co":1,"web.do":1,"web.gu":1,"web.id":1,"web.lk":1,"web.nf":1,"web.ni":1,"web.pk":1,"web.tj":1,"web.tr":1,"web.ve":1,"web.za":1,"webhare.dev":2,"webhop.biz":1,"webhop.info":1,"webhop.me":1,"webhop.net":1,"webhop.org":1,"webhosting.be":1,"webredirect.org":1,"website.yandexcloud.net":1,"webspace.rocks":1,"wedeploy.io":1,"wedeploy.me":1,"wedeploy.sh":1,"wegrow.pl":1,"wellbeingzone.co.uk":1,"wellbeingzone.eu":1,"western.museum":1,"westfalen.museum":1,"whaling.museum":1,"wi.us":1,"wielun.pl":1,"wif.gov.pl":1,"wiih.gov.pl":1,"wiki.bo":1,"wiki.br":1,"wildlife.museum":1,"williamsburg.museum":1,"winb.gov.pl":1,"windmill.museum":1,"wios.gov.pl":1,"witd.gov.pl":1,"withgoogle.com":1,"withyoutube.com":1,"wiw.gov.pl":1,"wlocl.pl":1,"wloclawek.pl":1,"wmflabs.org":1,"wnext.app":1,"wodzislaw.pl":1,"wolomin.pl":1,"workers.dev":1,"workinggroup.aero":1,"workisboring.com":1,"works.aero":1,"workshop.museum":1,"worse-than.tv":1,"wpcomstaging.com":1,"wpdevcloud.com":1,"writesthisblog.com":1,"wroc.pl":1,"wroclaw.pl":1,"ws.na":1,"wsa.gov.pl":1,"wskr.gov.pl":1,"wuoz.gov.pl":1,"wv.us":1,"www.ck":0,"www.ro":1,"wy.us":1,"wzmiuw.gov.pl":1,"x.bg":1,"x.se":1,"x443.pw":1,"xen.prgmr.com":1,"xenapponazure.com":1,"xj.cn":1,"xn--0trq7p7nn.jp":1,"xn--12c1fe0br.xn--o3cw4h":1,"xn--12cfi8ixb8l.xn--o3cw4h":1,"xn--12co0c3b4eva.xn--o3cw4h":1,"xn--1ctwo.jp":1,"xn--1lqs03n.jp":1,"xn--1lqs71d.jp":1,"xn--2m4a15e.jp":1,"xn--32vp30h.jp":1,"xn--4it168d.jp":1,"xn--4it797k.jp":1,"xn--4pvxs.jp":1,"xn--55qx5d.cn":1,"xn--55qx5d.hk":1,"xn--55qx5d.xn--j6w193g":1,"xn--5js045d.jp":1,"xn--5rtp49c.jp":1,"xn--5rtq34k.jp":1,"xn--6btw5a.jp":1,"xn--6orx2r.jp":1,"xn--7t0a264c.jp":1,"xn--80au.xn--90a3ac":1,"xn--8ltr62k.jp":1,"xn--8pvr4u.jp":1,"xn--90azh.xn--90a3ac":1,"xn--9dbhblg6di.museum":1,"xn--andy-ira.no":1,"xn--aroport-bya.ci":1,"xn--asky-ira.no":1,"xn--aurskog-hland-jnb.no":1,"xn--avery-yua.no":1,"xn--b-5ga.nordland.no":1,"xn--b-5ga.telemark.no":1,"xn--balsan-sdtirol-nsb.it":1,"xn--bdddj-mrabd.no":1,"xn--bearalvhki-y4a.no":1,"xn--berlevg-jxa.no":1,"xn--bhcavuotna-s4a.no":1,"xn--bhccavuotna-k7a.no":1,"xn--bidr-5nac.no":1,"xn--bievt-0qa.no":1,"xn--bjarky-fya.no":1,"xn--bjddar-pta.no":1,"xn--blt-elab.no":1,"xn--bmlo-gra.no":1,"xn--bod-2na.no":1,"xn--bozen-sdtirol-2ob.it":1,"xn--brnny-wuac.no":1,"xn--brnnysund-m8ac.no":1,"xn--brum-voa.no":1,"xn--btsfjord-9za.no":1,"xn--bulsan-sdtirol-nsb.it":1,"xn--c1avg.xn--90a3ac":1,"xn--c3s14m.jp":1,"xn--cesena-forl-mcb.it":1,"xn--cesenaforl-i8a.it":1,"xn--ciqpn.hk":1,"xn--comunicaes-v6a2o.museum":1,"xn--correios-e-telecomunicaes-ghc29a.museum":1,"xn--czrw28b.tw":1,"xn--d1at.xn--90a3ac":1,"xn--d5qv7z876c.jp":1,"xn--davvenjrga-y4a.no":1,"xn--djrs72d6uy.jp":1,"xn--djty4k.jp":1,"xn--dnna-gra.no":1,"xn--drbak-wua.no":1,"xn--dyry-ira.no":1,"xn--efvn9s.jp":1,"xn--ehqz56n.jp":1,"xn--elqq16h.jp":1,"xn--eveni-0qa01ga.no":1,"xn--f6qx53a.jp":1,"xn--finny-yua.no":1,"xn--fjord-lra.no":1,"xn--fl-zia.no":1,"xn--flor-jra.no":1,"xn--forl-cesena-fcb.it":1,"xn--forlcesena-c8a.it":1,"xn--frde-gra.no":1,"xn--frna-woa.no":1,"xn--frya-hra.no":1,"xn--ggaviika-8ya47h.no":1,"xn--gildeskl-g0a.no":1,"xn--givuotna-8ya.no":1,"xn--gjvik-wua.no":1,"xn--gls-elac.no":1,"xn--gmq050i.hk":1,"xn--gmqw5a.hk":1,"xn--gmqw5a.xn--j6w193g":1,"xn--h-2fa.no":1,"xn--h1aegh.museum":1,"xn--h3cuzk1di.xn--o3cw4h":1,"xn--hbmer-xqa.no":1,"xn--hcesuolo-7ya35b.no":1,"xn--hery-ira.nordland.no":1,"xn--hery-ira.xn--mre-og-romsdal-qqb.no":1,"xn--hgebostad-g3a.no":1,"xn--hkkinen-5wa.fi":1,"xn--hmmrfeasta-s4ac.no":1,"xn--hnefoss-q1a.no":1,"xn--hobl-ira.no":1,"xn--holtlen-hxa.no":1,"xn--hpmir-xqa.no":1,"xn--hyanger-q1a.no":1,"xn--hylandet-54a.no":1,"xn--indery-fya.no":1,"xn--io0a7i.cn":1,"xn--io0a7i.hk":1,"xn--jlster-bya.no":1,"xn--jrpeland-54a.no":1,"xn--k7yn95e.jp":1,"xn--karmy-yua.no":1,"xn--kbrq7o.jp":1,"xn--kfjord-iua.no":1,"xn--klbu-woa.no":1,"xn--klt787d.jp":1,"xn--kltp7d.jp":1,"xn--kltx9a.jp":1,"xn--klty5x.jp":1,"xn--koluokta-7ya57h.no":1,"xn--krager-gya.no":1,"xn--kranghke-b0a.no":1,"xn--krdsherad-m8a.no":1,"xn--krehamn-dxa.no":1,"xn--krjohka-hwab49j.no":1,"xn--ksnes-uua.no":1,"xn--kvfjord-nxa.no":1,"xn--kvitsy-fya.no":1,"xn--kvnangen-k0a.no":1,"xn--l-1fa.no":1,"xn--laheadju-7ya.no":1,"xn--langevg-jxa.no":1,"xn--lcvr32d.hk":1,"xn--ldingen-q1a.no":1,"xn--leagaviika-52b.no":1,"xn--lesund-hua.no":1,"xn--lgrd-poac.no":1,"xn--lhppi-xqa.no":1,"xn--linds-pra.no":1,"xn--lns-qla.museum":1,"xn--loabt-0qa.no":1,"xn--lrdal-sra.no":1,"xn--lrenskog-54a.no":1,"xn--lt-liac.no":1,"xn--lten-gra.no":1,"xn--lury-ira.no":1,"xn--m3ch0j3a.xn--o3cw4h":1,"xn--mely-ira.no":1,"xn--merker-kua.no":1,"xn--mgba3a4f16a.ir":1,"xn--mgba3a4fra.ir":1,"xn--mjndalen-64a.no":1,"xn--mk0axi.hk":1,"xn--mkru45i.jp":1,"xn--mlatvuopmi-s4a.no":1,"xn--mli-tla.no":1,"xn--mlselv-iua.no":1,"xn--moreke-jua.no":1,"xn--mori-qsa.nz":1,"xn--mosjen-eya.no":1,"xn--mot-tla.no":1,"xn--msy-ula0h.no":1,"xn--mtta-vrjjat-k7af.no":1,"xn--muost-0qa.no":1,"xn--mxtq1m.hk":1,"xn--mxtq1m.xn--j6w193g":1,"xn--nit225k.jp":1,"xn--nmesjevuemie-tcba.no":1,"xn--nry-yla5g.no":1,"xn--ntso0iqx3a.jp":1,"xn--ntsq17g.jp":1,"xn--nttery-byae.no":1,"xn--nvuotna-hwa.no":1,"xn--o1ac.xn--90a3ac":1,"xn--o1ach.xn--90a3ac":1,"xn--o3cyx2a.xn--o3cw4h":1,"xn--od0alg.cn":1,"xn--od0alg.hk":1,"xn--od0alg.xn--j6w193g":1,"xn--od0aq3b.hk":1,"xn--oppegrd-ixa.no":1,"xn--ostery-fya.no":1,"xn--osyro-wua.no":1,"xn--porsgu-sta26f.no":1,"xn--pssu33l.jp":1,"xn--qqqt11m.jp":1,"xn--rady-ira.no":1,"xn--rdal-poa.no":1,"xn--rde-ula.no":1,"xn--rdy-0nab.no":1,"xn--rennesy-v1a.no":1,"xn--rhkkervju-01af.no":1,"xn--rholt-mra.no":1,"xn--rht27z.jp":1,"xn--rht3d.jp":1,"xn--rht61e.jp":1,"xn--risa-5na.no":1,"xn--risr-ira.no":1,"xn--rland-uua.no":1,"xn--rlingen-mxa.no":1,"xn--rmskog-bya.no":1,"xn--rny31h.jp":1,"xn--rros-gra.no":1,"xn--rskog-uua.no":1,"xn--rst-0na.no":1,"xn--rsta-fra.no":1,"xn--ryken-vua.no":1,"xn--ryrvik-bya.no":1,"xn--s-1fa.no":1,"xn--sandnessjen-ogb.no":1,"xn--sandy-yua.no":1,"xn--sdtirol-n2a.it":1,"xn--seral-lra.no":1,"xn--sgne-gra.no":1,"xn--skierv-uta.no":1,"xn--skjervy-v1a.no":1,"xn--skjk-soa.no":1,"xn--sknit-yqa.no":1,"xn--sknland-fxa.no":1,"xn--slat-5na.no":1,"xn--slt-elab.no":1,"xn--smla-hra.no":1,"xn--smna-gra.no":1,"xn--snase-nra.no":1,"xn--sndre-land-0cb.no":1,"xn--snes-poa.no":1,"xn--snsa-roa.no":1,"xn--sr-aurdal-l8a.no":1,"xn--sr-fron-q1a.no":1,"xn--sr-odal-q1a.no":1,"xn--sr-varanger-ggb.no":1,"xn--srfold-bya.no":1,"xn--srreisa-q1a.no":1,"xn--srum-gra.no":1,"xn--stjrdal-s1a.no":1,"xn--stjrdalshalsen-sqb.no":1,"xn--stre-toten-zcb.no":1,"xn--tjme-hra.no":1,"xn--tn0ag.hk":1,"xn--tnsberg-q1a.no":1,"xn--tor131o.jp":1,"xn--trany-yua.no":1,"xn--trentin-sd-tirol-rzb.it":1,"xn--trentin-sdtirol-7vb.it":1,"xn--trentino-sd-tirol-c3b.it":1,"xn--trentino-sdtirol-szb.it":1,"xn--trentinosd-tirol-rzb.it":1,"xn--trentinosdtirol-7vb.it":1,"xn--trentinsd-tirol-6vb.it":1,"xn--trentinsdtirol-nsb.it":1,"xn--trgstad-r1a.no":1,"xn--trna-woa.no":1,"xn--troms-zua.no":1,"xn--tysvr-vra.no":1,"xn--uc0atv.hk":1,"xn--uc0atv.tw":1,"xn--uc0atv.xn--j6w193g":1,"xn--uc0ay4a.hk":1,"xn--uist22h.jp":1,"xn--uisz3g.jp":1,"xn--unjrga-rta.no":1,"xn--uuwu58a.jp":1,"xn--vads-jra.no":1,"xn--valle-aoste-ebb.it":1,"xn--valle-d-aoste-ehb.it":1,"xn--valleaoste-e7a.it":1,"xn--valledaoste-ebb.it":1,"xn--vard-jra.no":1,"xn--vegrshei-c0a.no":1,"xn--vestvgy-ixa6o.no":1,"xn--vg-yiab.no":1,"xn--vgan-qoa.no":1,"xn--vgsy-qoa0j.no":1,"xn--vgu402c.jp":1,"xn--vler-qoa.hedmark.no":1,"xn--vler-qoa.xn--stfold-9xa.no":1,"xn--vre-eiker-k8a.no":1,"xn--vrggt-xqad.no":1,"xn--vry-yla5g.no":1,"xn--wcvs22d.hk":1,"xn--wcvs22d.xn--j6w193g":1,"xn--yer-zna.no":1,"xn--ygarden-p1a.no":1,"xn--ystre-slidre-ujb.no":1,"xn--zbx025d.jp":1,"xn--zf0ao64a.tw":1,"xn--zf0avx.hk":1,"xnbay.com":1,"xs4all.space":1,"xz.cn":1,"y.bg":1,"y.se":1,"yabu.hyogo.jp":1,"yabuki.fukushima.jp":1,"yachimata.chiba.jp":1,"yachiyo.chiba.jp":1,"yachiyo.ibaraki.jp":1,"yaese.okinawa.jp":1,"yahaba.iwate.jp":1,"yahiko.niigata.jp":1,"yaita.tochigi.jp":1,"yaizu.shizuoka.jp":1,"yakage.okayama.jp":1,"yakumo.hokkaido.jp":1,"yakumo.shimane.jp":1,"yalta.ua":1,"yamada.fukuoka.jp":1,"yamada.iwate.jp":1,"yamada.toyama.jp":1,"yamaga.kumamoto.jp":1,"yamagata.gifu.jp":1,"yamagata.ibaraki.jp":1,"yamagata.jp":1,"yamagata.nagano.jp":1,"yamagata.yamagata.jp":1,"yamaguchi.jp":1,"yamakita.kanagawa.jp":1,"yamamoto.miyagi.jp":1,"yamanakako.yamanashi.jp":1,"yamanashi.jp":1,"yamanashi.yamanashi.jp":1,"yamanobe.yamagata.jp":1,"yamanouchi.nagano.jp":1,"yamashina.kyoto.jp":1,"yamato.fukushima.jp":1,"yamato.kanagawa.jp":1,"yamato.kumamoto.jp":1,"yamatokoriyama.nara.jp":1,"yamatotakada.nara.jp":1,"yamatsuri.fukushima.jp":1,"yamazoe.nara.jp":1,"yame.fukuoka.jp":1,"yanagawa.fukuoka.jp":1,"yanaizu.fukushima.jp":1,"yandexcloud.net":1,"yao.osaka.jp":1,"yaotsu.gifu.jp":1,"yasaka.nagano.jp":1,"yashio.saitama.jp":1,"yashiro.hyogo.jp":1,"yasu.shiga.jp":1,"yasuda.kochi.jp":1,"yasugi.shimane.jp":1,"yasuoka.nagano.jp":1,"yatomi.aichi.jp":1,"yatsuka.shimane.jp":1,"yatsushiro.kumamoto.jp":1,"yawara.ibaraki.jp":1,"yawata.kyoto.jp":1,"yawatahama.ehime.jp":1,"yazu.tottori.jp":1,"ybo.faith":1,"ybo.party":1,"ybo.review":1,"ybo.science":1,"ybo.trade":1,"ye":2,"yk.ca":1,"yn.cn":1,"yoichi.hokkaido.jp":1,"yoita.niigata.jp":1,"yoka.hyogo.jp":1,"yokaichiba.chiba.jp":1,"yokawa.hyogo.jp":1,"yokkaichi.mie.jp":1,"yokohama.jp":2,"yokoshibahikari.chiba.jp":1,"yokosuka.kanagawa.jp":1,"yokote.akita.jp":1,"yokoze.saitama.jp":1,"yolasite.com":1,"yombo.me":1,"yomitan.okinawa.jp":1,"yonabaru.okinawa.jp":1,"yonago.tottori.jp":1,"yonaguni.okinawa.jp":1,"yonezawa.yamagata.jp":1,"yono.saitama.jp":1,"yorii.saitama.jp":1,"york.museum":1,"yorkshire.museum":1,"yoro.gifu.jp":1,"yosemite.museum":1,"yoshida.saitama.jp":1,"yoshida.shizuoka.jp":1,"yoshikawa.saitama.jp":1,"yoshimi.saitama.jp":1,"yoshino.nara.jp":1,"yoshinogari.saga.jp":1,"yoshioka.gunma.jp":1,"yotsukaido.chiba.jp":1,"youth.museum":1,"yuasa.wakayama.jp":1,"yufu.oita.jp":1,"yugawa.fukushima.jp":1,"yugawara.kanagawa.jp":1,"yuki.ibaraki.jp":1,"yukuhashi.fukuoka.jp":1,"yura.wakayama.jp":1,"yurihonjo.akita.jp":1,"yusuhara.kochi.jp":1,"yusui.kagoshima.jp":1,"yuu.yamaguchi.jp":1,"yuza.yamagata.jp":1,"yuzawa.niigata.jp":1,"z.bg":1,"z.se":1,"za.bz":1,"za.com":1,"za.net":1,"za.org":1,"zachpomor.pl":1,"zagan.pl":1,"zakopane.pl":1,"zama.kanagawa.jp":1,"zamami.okinawa.jp":1,"zao.miyagi.jp":1,"zaporizhzhe.ua":1,"zaporizhzhia.ua":1,"zapto.org":1,"zapto.xyz":1,"zarow.pl":1,"zentsuji.kagawa.jp":1,"zgora.pl":1,"zgorzelec.pl":1,"zhitomir.ua":1,"zhytomyr.ua":1,"zj.cn":1,"zlg.br":1,"zone.id":1,"zoological.museum":1,"zoology.museum":1,"zp.gov.pl":1,"zp.ua":1,"zt.ua":1,"zushi.kanagawa.jp":1}

/***/ }),
/* 44 */
/***/ (function(module, exports) {

module.exports = {"blank-text":"data:text/plain,","blank-css":"data:text/css,","blank-js":"data:application/javascript,","blank-html":"data:text/html,<!DOCTYPE html><html><head></head><body></body></html>","blank-mp3":"data:audio/mpeg;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4LjIwLjEwMAAAAAAAAAAAAAAA//tUAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAASW5mbwAAAA8AAAAGAAADAABgYGBgYGBgYGBgYGBgYGBggICAgICAgICAgICAgICAgICgoKCgoKCgoKCgoKCgoKCgwMDAwMDAwMDAwMDAwMDAwMDg4ODg4ODg4ODg4ODg4ODg4P////////////////////8AAAAATGF2YzU4LjM1AAAAAAAAAAAAAAAAJAYAAAAAAAAAAwDVxttG//sUZAAP8AAAaQAAAAgAAA0gAAABAAABpAAAACAAADSAAAAETEFNRTMuMTAwVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV//sUZB4P8AAAaQAAAAgAAA0gAAABAAABpAAAACAAADSAAAAEVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV//sUZDwP8AAAaQAAAAgAAA0gAAABAAABpAAAACAAADSAAAAEVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV//sUZFoP8AAAaQAAAAgAAA0gAAABAAABpAAAACAAADSAAAAEVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV//sUZHgP8AAAaQAAAAgAAA0gAAABAAABpAAAACAAADSAAAAEVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV//sUZJYP8AAAaQAAAAgAAA0gAAABAAABpAAAACAAADSAAAAEVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV","blank-mp4":"data:video/mp4;base64,AAAAIGZ0eXBpc29tAAACAGlzb21pc28yYXZjMW1wNDEAAAAIZnJlZQAAAAhtZGF0AAAA1m1vb3YAAABsbXZoZAAAAAAAAAAAAAAAAAAAA+gAAAAAAAEAAAEAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAIAAABidWR0YQAAAFptZXRhAAAAAAAAACFoZGxyAAAAAAAAAABtZGlyYXBwbAAAAAAAAAAAAAAAAC1pbHN0AAAAJal0b28AAAAdZGF0YQAAAAEAAAAATGF2ZjU3LjQxLjEwMA==","1x1-transparent-gif":"data:image/gif;base64,R0lGODlhAQABAIABAAAAAP///yH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==","2x2-transparent-png":"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAC0lEQVQI12NgQAcAABIAAe+JVKQAAAAASUVORK5CYII=","3x2-transparent-png":"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAMAAAACCAYAAACddGYaAAAAC0lEQVQI12NgwAUAABoAASRETuUAAAAASUVORK5CYII=","32x32-transparent-png":"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAAGklEQVRYw+3BAQEAAACCIP+vbkhAAQAAAO8GECAAAZf3V9cAAAAASUVORK5CYII="}

/***/ }),
/* 45 */
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
 * A <code>Recommendation</code> object represents a recommended filter
 * subscription.
 */
class Recommendation
{
  /**
   * Creates a <code>Recommendation</code> object from the given source object.
   * @param {object} source The source object.
   * @private
   */
  constructor(source)
  {
    this._source = source;
  }

  /**
   * The type of the recommended filter subscription.
   * @type {string}
   */
  get type()
  {
    return this._source.type;
  }

  /**
   * The languages of the recommended filter subscription.
   * @type {Array.<string>}
   */
  get languages()
  {
    return this._source.languages ? [...this._source.languages] : [];
  }

  /**
   * The title of the recommended filter subscription.
   * @type {string}
   */
  get title()
  {
    return this._source.title;
  }

  /**
   * The URL of the recommended filter subscription.
   * @type {string}
   */
  get url()
  {
    return this._source.url;
  }

  /**
   * The home page of the recommended filter subscription.
   * @type {string}
   */
  get homepage()
  {
    return this._source.homepage;
  }
}

/**
 * Yields <code>{@link Recommendation}</code> objects representing recommended
 * filter subscriptions.
 *
 * @yields {Recommendation} An object representing a recommended filter
 *   subscription.
 */
function* recommendations()
{
  for (let source of __webpack_require__(46))
    yield new Recommendation(source);
}

exports.recommendations = recommendations;


/***/ }),
/* 46 */
/***/ (function(module, exports) {

module.exports = [{"type":"ads","languages":["id","ms"],"title":"ABPindo+EasyList","url":"https://easylist-downloads.adblockplus.org/abpindo+easylist.txt","homepage":"http://abpindo.blogspot.com/"},{"type":"ads","languages":["vi"],"title":"ABPVN List+EasyList","url":"https://easylist-downloads.adblockplus.org/abpvn+easylist.txt","homepage":"http://abpvn.com/"},{"type":"ads","languages":["bg"],"title":"Bulgarian list+EasyList","url":"https://easylist-downloads.adblockplus.org/bulgarian_list+easylist.txt","homepage":"http://stanev.org/abp/"},{"type":"ads","languages":["en"],"title":"EasyList","url":"https://easylist-downloads.adblockplus.org/easylist.txt","homepage":"https://easylist.to/"},{"type":"ads","languages":["zh"],"title":"EasyList China+EasyList","url":"https://easylist-downloads.adblockplus.org/easylistchina+easylist.txt","homepage":"http://abpchina.org/forum/"},{"type":"ads","languages":["cs","sk"],"title":"EasyList Czech and Slovak+EasyList","url":"https://easylist-downloads.adblockplus.org/easylistczechslovak+easylist.txt","homepage":"https://adblock.sk/"},{"type":"ads","languages":["nl"],"title":"EasyList Dutch+EasyList","url":"https://easylist-downloads.adblockplus.org/easylistdutch+easylist.txt","homepage":"https://easylist.to/"},{"type":"ads","languages":["de"],"title":"EasyList Germany+EasyList","url":"https://easylist-downloads.adblockplus.org/easylistgermany+easylist.txt","homepage":"https://easylist.to/"},{"type":"ads","languages":["he"],"title":"EasyList Hebrew+EasyList","url":"https://easylist-downloads.adblockplus.org/israellist+easylist.txt","homepage":"https://github.com/easylist/EasyListHebrew"},{"type":"ads","languages":["it"],"title":"EasyList Italy+EasyList","url":"https://easylist-downloads.adblockplus.org/easylistitaly+easylist.txt","homepage":"https://easylist.to/"},{"type":"ads","languages":["lt"],"title":"EasyList Lithuania+EasyList","url":"https://easylist-downloads.adblockplus.org/easylistlithuania+easylist.txt","homepage":"http://margevicius.lt/"},{"type":"ads","languages":["pl"],"title":"EasyList Polish+EasyList","url":"https://easylist-downloads.adblockplus.org/easylistpolish+easylist.txt","homepage":"https://easylist.to/"},{"type":"ads","languages":["pt"],"title":"EasyList Portuguese+EasyList","url":"https://easylist-downloads.adblockplus.org/easylistportuguese+easylist.txt","homepage":"https://easylist.to/"},{"type":"ads","languages":["es"],"title":"EasyList Spanish+EasyList","url":"https://easylist-downloads.adblockplus.org/easylistspanish+easylist.txt","homepage":"https://easylist.to/"},{"type":"ads","languages":["bn","gu","hi","pa"],"title":"IndianList+EasyList","url":"https://easylist-downloads.adblockplus.org/indianlist+easylist.txt","homepage":"https://easylist.to/"},{"type":"ads","languages":["ko"],"title":"KoreanList+EasyList","url":"https://easylist-downloads.adblockplus.org/koreanlist+easylist.txt","homepage":"https://easylist.to/"},{"type":"ads","languages":["lv"],"title":"Latvian List+EasyList","url":"https://easylist-downloads.adblockplus.org/latvianlist+easylist.txt","homepage":"https://notabug.org/latvian-list/adblock-latvian"},{"type":"ads","languages":["ar"],"title":"Liste AR+Liste FR+EasyList","url":"https://easylist-downloads.adblockplus.org/liste_ar+liste_fr+easylist.txt","homepage":"https://code.google.com/p/liste-ar-adblock/"},{"type":"ads","languages":["fr"],"title":"Liste FR+EasyList","url":"https://easylist-downloads.adblockplus.org/liste_fr+easylist.txt","homepage":"https://forums.lanik.us/viewforum.php?f"},{"type":"ads","languages":["ro"],"title":"ROList+EasyList","url":"https://easylist-downloads.adblockplus.org/rolist+easylist.txt","homepage":"http://www.zoso.ro/rolist"},{"type":"ads","languages":["ru","uk"],"title":"RuAdList+EasyList","url":"https://easylist-downloads.adblockplus.org/ruadlist+easylist.txt","homepage":"https://forums.lanik.us/viewforum.php?f"},{"type":"circumvention","title":"ABP filters","url":"https://easylist-downloads.adblockplus.org/abp-filters-anti-cv.txt","homepage":"https://github.com/abp-filters/abp-filters-anti-cv"},{"type":"privacy","title":"EasyPrivacy","url":"https://easylist-downloads.adblockplus.org/easyprivacy.txt","homepage":"https://easylist.to/"},{"type":"social","title":"Fanboy's Social Blocking List","url":"https://easylist-downloads.adblockplus.org/fanboy-social.txt","homepage":"https://easylist.to/"}]

/***/ }),
/* 47 */
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
 * @fileOverview INI parsing.
 */

const {Filter} = __webpack_require__(0);
const {Subscription} = __webpack_require__(4);

/**
 * Parses filter data.
 */
class INIParser
{
  constructor()
  {
    /**
     * Properties of the filter data.
     * @type {object}
     */
    this.fileProperties = {};

    /**
     * The list of subscriptions in the filter data.
     * @type {Array.<Subscription>}
     */
    this.subscriptions = [];

    /**
     * Known filter texts mapped to their corresponding {@link Filter} objects.
     * @type {Map.<string, Filter>}
     */
    this.knownFilters = new Map();

    /**
     * Known subscription URLs mapped to their corresponding
     * {@link Subscription} objects.
     * @type {Map.<string, Subscription>}
     */
    this.knownSubscriptions = new Map();

    this._wantObj = true;
    this._curObj = this.fileProperties;
    this._curSection = null;
  }

  /**
   * Processes a line of filter data.
   *
   * @param {string?} line The line of filter data to process. This may be
   *   <code>null</code>, which indicates the end of the filter data.
   */
  process(line)
  {
    let origKnownFilters = Filter.knownFilters;
    Filter.knownFilters = this.knownFilters;

    let origKnownSubscriptions = Subscription.knownSubscriptions;
    Subscription.knownSubscriptions = this.knownSubscriptions;

    try
    {
      let match;
      if (this._wantObj === true && (match = /^(\w+)=(.*)$/.exec(line)))
      {
        this._curObj[match[1]] = match[2];
      }
      else if (line === null || (match = /^\s*\[(.+)\]\s*$/.exec(line)))
      {
        if (this._curObj)
        {
          // Process current object before going to next section
          switch (this._curSection)
          {
            case "filter":
              if ("text" in this._curObj)
                Filter.fromObject(this._curObj);
              break;

            case "subscription":
              let subscription = Subscription.fromObject(this._curObj);
              if (subscription)
                this.subscriptions.push(subscription);
              break;

            case "subscription filters":
              if (this.subscriptions.length)
              {
                let currentSubscription = this.subscriptions[
                  this.subscriptions.length - 1
                ];
                currentSubscription.updateFilterText(this._curObj);
              }
              break;
          }
        }

        if (line === null)
          return;

        this._curSection = match[1].toLowerCase();
        switch (this._curSection)
        {
          case "filter":
          case "subscription":
            this._wantObj = true;
            this._curObj = {};
            break;
          case "subscription filters":
            this._wantObj = false;
            this._curObj = [];
            break;
          default:
            this._wantObj = null;
            this._curObj = null;
        }
      }
      else if (this._wantObj === false && line)
      {
        this._curObj.push(line.replace(/\\\[/g, "["));
      }
    }
    finally
    {
      Filter.knownFilters = origKnownFilters;
      Subscription.knownSubscriptions = origKnownSubscriptions;
    }
  }
}

exports.INIParser = INIParser;


/***/ }),
/* 48 */
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
       ElemHideFilter,
       ElemHideException} = __webpack_require__(0);
const {SpecialSubscription} =
  __webpack_require__(4);
const {parseURL} = __webpack_require__(10);
const {filterStorage} = __webpack_require__(5);
const {defaultMatcher} = __webpack_require__(11);
const {filterNotifier} = __webpack_require__(1);
const {extractHostFromFrame} = __webpack_require__(8);
const {port} = __webpack_require__(7);
const {HitLogger, nonRequestTypes} = __webpack_require__(13);

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

  for (let subscription of filterStorage.subscriptions(filter.text))
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
    whitelisted: filter instanceof WhitelistFilter ||
                 filter instanceof ElemHideException,
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
    (record.filter && record.filter.selector) == (filter && filter.selector) &&

    // We apply multiple CSP filters to a document, but we must still remove
    // any duplicates. Two CSP filters are duplicates if both have identical
    // text.
    (record.filter && record.filter.csp && record.filter.text) ==
    (filter && filter.csp && filter.text)
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
    parseURL(request.url),
    RegExpFilter.typeMap[request.type],
    request.docDomain,
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

function updateFilters(subscription, filters, added)
{
  let includes = subscription ?
    filter => filter && subscription.findFilterIndex(filter) != -1 :
    filters.includes.bind(filters);

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

        if (!includes(filter))
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
        if (!includes(record.filter))
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
  updateFilters(null, [filter], true);
}

function onFilterRemoved(filter)
{
  updateFilters(null, [filter], false);
}

function onSubscriptionAdded(subscription)
{
  if (subscription instanceof SpecialSubscription)
    updateFilters(subscription, null, true);
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
    filterNotifier.on("filter.added", onFilterAdded);
    filterNotifier.on("filter.removed", onFilterRemoved);
    filterNotifier.on("subscription.added", onSubscriptionAdded);
  }

  newPort.onDisconnect.addListener(() =>
  {
    HitLogger.removeListener(inspectedTabId, hitListener);
    panels.delete(inspectedTabId);
    browser.webRequest.onBeforeRequest.removeListener(localOnBeforeRequest);

    if (panels.size == 0)
    {
      ext.pages.onLoading.removeListener(onLoading);
      filterNotifier.off("filter.added", onFilterAdded);
      filterNotifier.off("filter.removed", onFilterRemoved);
      filterNotifier.off("subscription.added", onSubscriptionAdded);
    }
  });

  HitLogger.addListener(inspectedTabId, hitListener);
  panels.set(inspectedTabId, panel);
});


/***/ }),
/* 49 */
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

const {BigInteger} = __webpack_require__(50);
const Rusha = __webpack_require__(51);

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
    if ("content" in curTempl &&
        curTempl.content != data.substring(pos, pos + len))
    {
      throw "Unexpected content";
    }
    if ("out" in curTempl)
      out[curTempl.out] = new BigInteger(data.substring(pos, pos + len), 256);
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
    let {sha1} = readASN1(digest.substring(pos), signatureTemplate);
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
/* 50 */
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
/* 51 */
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
/* 52 */
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



const {defaultMatcher} = __webpack_require__(11);
const {BlockingFilter,
       RegExpFilter} = __webpack_require__(0);
const {parseURL} = __webpack_require__(10);
const {extractHostFromFrame} = __webpack_require__(8);
const {checkWhitelisted} = __webpack_require__(9);
const {logRequest} = __webpack_require__(13);

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

  let specificOnly = !!checkWhitelisted(
    popup.sourcePage, popup.sourceFrame, null,
    RegExpFilter.typeMap.GENERICBLOCK
  );

  let filter = defaultMatcher.matchesAny(
    parseURL(url), RegExpFilter.typeMap.POPUP,
    documentHost, null, specificOnly
  );

  if (filter instanceof BlockingFilter)
    browser.tabs.remove(tabId);

  logRequest(
    [popup.sourcePage.id],
    {url, type: "POPUP", docDomain: documentHost, specificOnly},
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
/* 53 */
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



const {defaultMatcher} = __webpack_require__(11);
const {RegExpFilter, WhitelistFilter} =
  __webpack_require__(0);
const {parseURL} = __webpack_require__(10);
const {extractHostFromFrame} = __webpack_require__(8);
const {checkWhitelisted} = __webpack_require__(9);
const {filterNotifier} = __webpack_require__(1);
const {logRequest} = __webpack_require__(13);

const {typeMap} = RegExpFilter;

browser.webRequest.onHeadersReceived.addListener(details =>
{
  let url = parseURL(details.url);
  let parentFrame = ext.getFrame(details.tabId, details.parentFrameId);
  let hostname = extractHostFromFrame(parentFrame) || url.hostname;

  let cspMatch = defaultMatcher.matchesAny(url, typeMap.CSP, hostname, null,
                                           false);
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
    if (specificOnly && !(cspMatch instanceof WhitelistFilter))
    {
      cspMatch = defaultMatcher.matchesAny(url, typeMap.CSP, hostname, null,
                                           specificOnly);
      if (!cspMatch)
        return;
    }

    if (cspMatch instanceof WhitelistFilter)
    {
      logRequest([details.tabId], {
        url: details.url, type: "CSP", docDomain: hostname,
        specificOnly
      }, cspMatch);
      filterNotifier.emit("filter.hitCount", cspMatch, 0, 0, [details.tabId]);
      return;
    }

    let {blocking} = defaultMatcher.search(url, typeMap.CSP, hostname, null,
                                           specificOnly, "blocking");
    for (cspMatch of blocking)
    {
      logRequest([details.tabId], {
        url: details.url, type: "CSP", docDomain: hostname,
        specificOnly
      }, cspMatch);
      filterNotifier.emit("filter.hitCount", cspMatch, 0, 0, [details.tabId]);

      details.responseHeaders.push({
        name: "Content-Security-Policy",
        value: cspMatch.csp
      });
    }

    return {responseHeaders: details.responseHeaders};
  }
}, {
  urls: ["http://*/*", "https://*/*"],
  types: ["main_frame", "sub_frame"]
}, ["blocking", "responseHeaders"]);


/***/ }),
/* 54 */
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

/** @module contentFiltering */



const {RegExpFilter} = __webpack_require__(0);
const {elemHide, createStyleSheet,
       rulesFromStyleSheet} = __webpack_require__(19);
const {elemHideEmulation} = __webpack_require__(21);
const {filterNotifier} = __webpack_require__(1);
const {snippets, compileScript} = __webpack_require__(28);
const {checkWhitelisted} = __webpack_require__(9);
const {extractHostFromFrame} = __webpack_require__(8);
const {port} = __webpack_require__(7);
const {HitLogger, logRequest} = __webpack_require__(13);
const info = __webpack_require__(3);

// Chromium's support for tabs.removeCSS is still a work in progress and the
// API is likely to be different from Firefox's; for now we just don't use it
// at all, even if it's available.
// See https://crbug.com/608854
const styleSheetRemovalSupported = info.platform == "gecko";

let userStyleSheetsSupported = true;

let snippetsLibrarySource = "";
let executableCode = new Map();

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
    // "content.applyFilters" message. We simply ignore such errors, because
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

function updateFrameStyles(tabId, frameId, styleSheet, groupName = "standard",
                           appendOnly = false)
{
  let frame = ext.getFrame(tabId, frameId);
  if (!frame)
    return false;

  if (!frame.state.injectedStyleSheets)
    frame.state.injectedStyleSheets = new Map();

  let oldStyleSheet = frame.state.injectedStyleSheets.get(groupName);

  if (appendOnly && oldStyleSheet)
    styleSheet = oldStyleSheet + styleSheet;

  // Ideally we would compare the old and new style sheets and skip this code
  // if they're the same. But first we need to ensure that there are no edge
  // cases that would cause the old style sheet to be a leftover from a
  // previous instance of the frame (see issue #7180). For now, we add the new
  // style sheet regardless.

  // Add the new style sheet first to keep previously hidden elements from
  // reappearing momentarily.
  if (styleSheet && !addStyleSheet(tabId, frameId, styleSheet))
    return false;

  // Sometimes the old and new style sheets can be exactly the same. In such a
  // case, do not remove the "old" style sheet, because it is in fact the new
  // style sheet now.
  if (oldStyleSheet && oldStyleSheet != styleSheet)
    removeStyleSheet(tabId, frameId, oldStyleSheet);

  // The standard style sheet is ~660 KB per frame (as of Adblock Plus 3.3.2).
  // Keeping it in memory would only really be useful on Firefox, which allows
  // us to remove it via the tabs.removeCSS API. By choosing not to hold on to
  // it, we save potentially several megabytes per tab (#6967).
  if (groupName != "standard")
    frame.state.injectedStyleSheets.set(groupName, styleSheet);
  return true;
}

function getExecutableCode(script)
{
  let code = executableCode.get(script);
  if (code)
    return code;

  code = compileScript(script, [snippetsLibrarySource]);

  executableCode.set(script, code);
  return code;
}

function executeScript(script, tabId, frameId)
{
  try
  {
    let details = {
      code: getExecutableCode(script),
      matchAboutBlank: true,
      runAt: "document_start"
    };

    // Microsoft Edge throws when passing frameId to tabs.executeScript
    // and always executes code in the context of the top-level frame,
    // so for sub-frames we let it fail.
    if (frameId != 0)
      details.frameId = frameId;

    return browser.tabs.executeScript(tabId, details).catch(error =>
    {
      // Sometimes a frame is added and removed very quickly, in such cases we
      // simply ignore the error.
      if (error.message == "The frame was removed.")
        return;

      // Sometimes the frame in question is just not found. We don't know why
      // this is exactly, but we simply ignore the error.
      if (/^No frame with id \d+ in tab \d+\.$/.test(error.message))
        return;

      throw error;
    });
  }
  catch (error)
  {
    // See the comment in the catch block associated with the call to
    // tabs.insertCSS for why we catch any error here and simply
    // return a rejected promise.
    return Promise.reject(error);
  }
}

port.on("content.applyFilters", (message, sender) =>
{
  let styleSheet = {code: "", selectors: []};
  let emulatedPatterns = [];
  let trace = HitLogger.hasListener(sender.page.id);
  let inline = !userStyleSheetsSupported;

  let filterTypes = message.filterTypes || {elemhide: true, snippets: true};

  if (!checkWhitelisted(sender.page, sender.frame, null,
                        RegExpFilter.typeMap.DOCUMENT))
  {
    let docDomain = extractHostFromFrame(sender.frame);

    if (filterTypes.snippets)
    {
      for (let filter of snippets.getFiltersForDomain(docDomain))
      {
        executeScript(filter.script, sender.page.id, sender.frame.id).then(() =>
        {
          let tabIds = [sender.page.id];
          if (filter)
            filterNotifier.emit("filter.hitCount", filter, 0, 0, tabIds);

          logRequest(tabIds, {
            url: sender.frame.url.href,
            type: "SNIPPET",
            docDomain
          }, filter);
        });
      }
    }

    if (filterTypes.elemhide &&
        !checkWhitelisted(sender.page, sender.frame, null,
                          RegExpFilter.typeMap.ELEMHIDE))
    {
      let specificOnly = checkWhitelisted(sender.page, sender.frame, null,
                                          RegExpFilter.typeMap.GENERICHIDE);
      styleSheet = elemHide.generateStyleSheetForDomain(docDomain, specificOnly,
                                                        trace, trace);

      for (let filter of elemHideEmulation.getRulesForDomain(docDomain))
        emulatedPatterns.push({selector: filter.selector, text: filter.text});
    }
  }

  if (!inline && !updateFrameStyles(sender.page.id, sender.frame.id,
                                    styleSheet.code))
  {
    inline = true;
  }

  let response = {trace, inline, emulatedPatterns};

  if (inline)
    response.rules = [...rulesFromStyleSheet(styleSheet.code)];

  if (trace)
  {
    response.selectors = styleSheet.selectors;
    response.exceptions = styleSheet.exceptions.map(({text, selector}) =>
                                                    ({text, selector}));
  }

  return response;
});

port.on("content.injectSelectors", (message, sender) =>
{
  let styleSheet = createStyleSheet(message.selectors);
  if (!userStyleSheetsSupported ||
      !updateFrameStyles(sender.page.id, sender.frame.id, styleSheet,
                         message.groupName, message.appendOnly))
  {
    return [...rulesFromStyleSheet(styleSheet)];
  }
});

fetch(browser.extension.getURL("/snippets.js"), {cache: "no-cache"})
.then(response => response.ok ? response.text() : "")
.then(text =>
{
  snippetsLibrarySource = text;
});


/***/ }),
/* 55 */
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



const {port} = __webpack_require__(7);
const {Prefs} = __webpack_require__(2);
const {Utils} = __webpack_require__(12);
const {filterStorage} = __webpack_require__(5);
const {filterNotifier} = __webpack_require__(1);
const {isSlowFilter, Matcher} = __webpack_require__(11);
const {Notification: NotificationStorage} = __webpack_require__(15);
const {getActiveNotification, shouldDisplay} = __webpack_require__(31);
const {HitLogger} = __webpack_require__(13);
const {
  Filter, ActiveFilter, InvalidFilter, RegExpFilter
} = __webpack_require__(0);
const {synchronizer} = __webpack_require__(16);
const info = __webpack_require__(3);
const {
  Subscription,
  DownloadableSubscription,
  SpecialSubscription,
  RegularSubscription
} = __webpack_require__(4);
const {showOptions} = __webpack_require__(32);
const {recommendations} = __webpack_require__(23);

port.on("types.get", (message, sender) =>
{
  const filterTypes = Array.from(__webpack_require__(30).filterTypes);
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

const convertRecommendation = convertObject.bind(null, [
  "languages", "title", "type", "url"
]);

function convertSubscriptionFilters(subscription)
{
  const filters = Array.from(subscription.filterText(), Filter.fromText);
  return filters.map(convertFilter);
}

function convertSubscription(subscription)
{
  const obj = convertObject(["disabled", "downloadStatus", "homepage",
                             "version", "lastDownload", "lastSuccess",
                             "softExpiration", "expires", "title",
                             "url"], subscription);
  if (subscription instanceof SpecialSubscription)
    obj.filters = convertSubscriptionFilters(subscription);

  obj.downloading = synchronizer.isExecuting(subscription.url);
  return obj;
}

// pollute a converted filter object with `slow` detail
// there are 3 kind of slow filters
//  1. filter instanceof RegExpFilter && isSlowFilter(filter)
//  2. filter instanceof ElemHideEmulationFilter
//  3. filter instanceof SnippetFilter
// for the time being, we want to simply expose the first kind
// since there's nothing users can do to avoid others being slow
function convertFilter(filter)
{
  const obj = convertObject(["disabled", "text"], filter);
  obj.slow = filter instanceof RegExpFilter && isSlowFilter(filter);
  return obj;
}

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
      subscriptions = filterStorage.subscriptions(filter.text);
      subscriptions = Array.from(subscriptions)
        .filter(includeActiveRemoteSubscriptions)
        .map(s => s.url);
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
      name = "ready";
    else
      name = type + "." + action;

    if (!(name in listenedFilterChanges))
    {
      listenedFilterChanges[name] = null;
      filterNotifier.on(name, (item) =>
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

  filterStorage.addSubscription(subscription);
  if (subscription instanceof DownloadableSubscription &&
      !subscription.lastDownload)
    synchronizer.execute(subscription);
}

port.on("app.get", (message, sender) =>
{
  if (message.what == "issues")
  {
    const subscriptionInit = __webpack_require__(33);
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

    const link = Utils.getDocLink(
      message.link.replace("{browser}", application)
    );

    // Edge 42 does not always return the link as given by Utils.getDocLink,
    // for some reason .toString() is enough to get it working. This seems
    // to have been fixed in Edge 44. (See issue 7222.)
    if (info.platform == "edgehtml")
      return link.toString();

    return link;
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

  if (message.what == "recommendations")
    return Array.from(recommendations(), convertRecommendation);

  if (message.what == "senderId")
    return sender.page.id;

  return info[message.what];
});

port.on("app.open", (message, sender) =>
{
  if (message.what == "options")
  {
    showOptions().then(() =>
    {
      if (!message.action)
        return;

      sendMessage("app", message.action, ...message.args);
    });
  }
});

class FilterError
{
  constructor(type, reason = null)
  {
    this.lineno = null;
    this.reason = reason;
    this.selector = null;
    this.type = type;
  }

  toJSON()
  {
    return {
      lineno: this.lineno,
      reason: this.reason,
      selector: this.selector,
      type: this.type
    };
  }
}

function parseFilter(text)
{
  let filter = null;
  let error = null;

  text = Filter.normalize(text);
  if (text)
  {
    if (text[0] == "[")
    {
      error = new FilterError("unexpected_filter_list_header");
    }
    else
    {
      filter = Filter.fromText(text);
      if (filter instanceof InvalidFilter)
        error = new FilterError("invalid_filter", filter.reason);
    }
  }

  return [filter, error];
}

port.on("filters.add", (message) => filtersAdd(message.text));

port.on("filters.get", (message, sender) =>
{
  const subscription = Subscription.fromURL(message.subscriptionUrl);
  if (!subscription)
    return [];

  return convertSubscriptionFilters(subscription);
});

port.on("filters.importRaw", (message, sender) =>
{
  const [filters, errors] = filtersValidate(message.text);

  if (errors.length > 0)
    return errors;

  const addedFilters = new Set();
  for (const filter of filters)
  {
    if (filter instanceof ActiveFilter)
    {
      filter.disabled = false;
    }
    filterStorage.addFilter(filter);
    addedFilters.add(filter.text);
  }

  if (!message.removeExisting)
    return errors;

  for (const subscription of filterStorage.subscriptions())
  {
    if (!(subscription instanceof SpecialSubscription))
      continue;

    // We have to iterate backwards for now due to
    // https://issues.adblockplus.org/ticket/7152
    for (let i = subscription.filterCount; i--;)
    {
      const text = subscription.filterTextAt(i);
      if (!/^@@\|\|([^/:]+)\^\$document$/.test(text) &&
          !addedFilters.has(text))
      {
        filterStorage.removeFilter(Filter.fromText(text));
      }
    }
  }

  return errors;
});

port.on("filters.remove", (message) => filtersRemove(message));

port.on("filters.replace", (message, sender) =>
{
  const errors = filtersAdd(message.new);
  if (errors.length)
    return errors;
  filtersRemove({text: message.old});
  return [];
});

port.on("filters.toggle", (message, sender) =>
{
  const filter = Filter.fromText(message.text);
  filter.disabled = message.disabled;
});

port.on("filters.validate", (message, sender) =>
{
  const [, errors] = filtersValidate(message.text);
  return errors;
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

  // Determine whether to return a notification that's targeting certain sites
  // See also https://hg.adblockplus.org/adblockpluscore/file/56c681657836/lib/notification.js#l301
  if (notification.urlFilters instanceof Array)
  {
    let {url} = message;
    if (!url)
      return;

    try
    {
      url = new URL(url);
    }
    catch (e)
    {
      return;
    }

    const matcher = new Matcher();
    for (const urlFilter of notification.urlFilters)
    {
      matcher.add(Filter.fromText(urlFilter));
    }

    const {DOCUMENT} = RegExpFilter.typeMap;
    if (!matcher.matchesAny(url, DOCUMENT, url.hostname))
      return;
  }

  const texts = NotificationStorage.getLocalizedTexts(notification,
                                                    message.locale);
  return Object.assign({texts}, notification);
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

    showOptions().then(() =>
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
  const subscriptions = [];
  for (const s of filterStorage.subscriptions())
  {
    if (message.ignoreDisabled && s.disabled)
      continue;

    if (message.downloadable && !(s instanceof DownloadableSubscription))
      continue;

    if (message.special && !(s instanceof SpecialSubscription))
      continue;

    const subscription = convertSubscription(s);
    if (message.disabledFilters)
    {
      subscription.disabledFilters =
        Array.from(s.filterText(), Filter.fromText)
        .filter((f) => f instanceof ActiveFilter && f.disabled)
        .map((f) => f.text);
    }
    subscriptions.push(subscription);
  }
  return subscriptions;
});

port.on("subscriptions.remove", (message, sender) =>
{
  const subscription = Subscription.fromURL(message.url);
  if (filterStorage.knownSubscriptions.has(subscription.url))
    filterStorage.removeSubscription(subscription);
});

port.on("subscriptions.toggle", (message, sender) =>
{
  const subscription = Subscription.fromURL(message.url);
  if (filterStorage.knownSubscriptions.has(subscription.url))
  {
    if (subscription.disabled || message.keepInstalled)
      subscription.disabled = !subscription.disabled;
    else
      filterStorage.removeSubscription(subscription);
  }
  else
  {
    addSubscription(subscription, message);
  }
});

port.on("subscriptions.update", (message, sender) =>
{
  let subscriptions;
  if (message.url)
  {
    subscriptions = [Subscription.fromURL(message.url)];
  }
  else
  {
    subscriptions = filterStorage.subscriptions();
  }

  for (const subscription of subscriptions)
  {
    if (subscription instanceof DownloadableSubscription)
      synchronizer.execute(subscription, true);
  }
});

function filtersAdd(text)
{
  const [filter, error] = parseFilter(text);

  if (error)
    return [error];

  if (filter)
  {
    if (filter instanceof ActiveFilter)
    {
      filter.disabled = false;
    }
    filterStorage.addFilter(filter);
  }

  return [];
}

function filtersValidate(text)
{
  const filters = [];
  const errors = [];

  const lines = text.split("\n");
  for (let i = 0; i < lines.length; i++)
  {
    const [filter, error] = parseFilter(lines[i]);

    if (error)
    {
      // We don't treat filter headers like invalid filters,
      // instead we simply ignore them and don't show any errors
      // in order to allow pasting complete filter lists.
      // If there are no filters, we do treat it as an invalid filter
      // to inform users about it and to give them a chance to edit it.
      if (error.type === "unexpected_filter_list_header" &&
          lines.length > 1)
        continue;

      if (lines.length > 1)
      {
        error.lineno = i + 1;
      }
      errors.push(error);
    }
    else if (filter)
    {
      filters.push(filter);
    }
  }

  return [filters, errors];
}

function filtersRemove(message)
{
  const filter = Filter.fromText(message.text);
  let subscription = null;
  if (message.subscriptionUrl)
    subscription = Subscription.fromURL(message.subscriptionUrl);

  if (!subscription)
    filterStorage.removeFilter(filter);
  else
    filterStorage.removeFilter(filter, subscription, message.index);
  // in order to behave, from consumer perspective, like any other
  // method that could produce errors, return an Array, even if empty
  return [];
}

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


/***/ }),
/* 56 */
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



function parseVersionComponent(comp)
{
  if (comp == "*")
    return Infinity;
  return parseInt(comp, 10) || 0;
}

/**
 * Compares two versions.
 *
 * @param {string} v1 The first version.
 * @param {string} v2 The second version.
 *
 * @returns {number} <code>-1</code> if <code>v1</code> is older than
 *   <code>v2</code>; <code>1</code> if <code>v1</code> is newer than
 *   <code>v2</code>; otherwise <code>0</code>.
 *
 * @package
 */
function compareVersions(v1, v2)
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

    if (result < 0)
      return -1;
    else if (result > 0)
      return 1;
  }

  // Compare version suffix (e.g. 0.1alpha < 0.1b1 < 01.b2 < 0.1).
  // However, note that this is a simple string comparision, meaning: b10 < b2
  if (tail1 == tail2)
    return 0;
  if (!tail1 || tail2 && tail1 > tail2)
    return 1;
  return -1;
}

exports.compareVersions = compareVersions;


/***/ }),
/* 57 */
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



const {filterNotifier} = __webpack_require__(1);
const info = __webpack_require__(3);

const frameOpacities = [0.0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9,
                        1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0,
                        0.9, 0.8, 0.7, 0.6, 0.5, 0.4, 0.3, 0.2, 0.1, 0.0];
const numberOfFrames = frameOpacities.length;

let stopRequested = false;
let canUpdateIcon = true;
let notRunning = Promise.resolve();
let whitelistedState = new ext.PageMap();

let icons = [null, null];

function loadImage(url)
{
  return fetch(url).then(response => response.blob())
                   .then(blob => createImageBitmap(blob));
}

function renderIcons()
{
  let paths = [
    "icons/abp-16.png", "icons/abp-16-whitelisted.png",
    "icons/abp-32.png", "icons/abp-32-whitelisted.png"
  ];

  for (let path of paths)
  {
    loadImage(path).then(image =>
    {
      let [, size, whitelisted] = /\/abp-(16|32)(-whitelisted)?\./.exec(path);

      let canvas = new OffscreenCanvas(size, size);
      let context = canvas.getContext("2d");
      let imageData = icons[!!whitelisted | 0] || {};

      context.globalAlpha = 1;
      context.drawImage(image, 0, 0);
      imageData[size] = context.getImageData(0, 0, size, size);

      icons[!!whitelisted | 0] = imageData;
    });
  }
}

function setIcon(page, notificationType, opacity, frames)
{
  opacity = opacity || 0;
  let whitelisted = !!whitelistedState.get(page);

  if (!notificationType || !frames)
  {
    if (opacity > 0.5)
    {
      page.browserAction.setIconPath(
        "/icons/abp-$size-notification-" + notificationType + ".png"
      );
    }
    else if (icons[whitelisted | 0])
    {
      page.browserAction.setIconImageData(icons[whitelisted | 0]);
    }
    else
    {
      page.browserAction.setIconPath(
        "/icons/abp-$size" + (whitelisted ? "-whitelisted" : "") + ".png"
      );
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

filterNotifier.on("page.WhitelistingStateRevalidate", (page, filter) =>
{
  whitelistedState.set(page, !!filter);
  if (canUpdateIcon)
    setIcon(page);
});

function renderFrames(notificationType)
{
  // Miscosoft Edge 44.17763.1.0 doesn't support passing imageData and
  // requires the path argument so, instead of animating the icon,
  // we just toggle it.
  if (info.platform == "edgehtml")
    return Promise.resolve();

  return Promise.all([
    loadImage("icons/abp-16.png"),
    loadImage("icons/abp-16-whitelisted.png"),
    loadImage("icons/abp-16-notification-" + notificationType + ".png"),
    loadImage("icons/abp-20.png"),
    loadImage("icons/abp-20-whitelisted.png"),
    loadImage("icons/abp-20-notification-" + notificationType + ".png"),
    loadImage("icons/abp-32.png"),
    loadImage("icons/abp-32-whitelisted.png"),
    loadImage("icons/abp-32-notification-" + notificationType + ".png"),
    loadImage("icons/abp-40.png"),
    loadImage("icons/abp-40-whitelisted.png"),
    loadImage("icons/abp-40-notification-" + notificationType + ".png")
  ]).then(images =>
  {
    let imageMap = {
      16: {base: [images[0], images[1]], overlay: images[2]},
      20: {base: [images[3], images[4]], overlay: images[5]},
      32: {base: [images[6], images[7]], overlay: images[8]},
      40: {base: [images[9], images[10]], overlay: images[11]}
    };

    let frames = {};
    let canvas = new OffscreenCanvas(0, 0);
    let context = canvas.getContext("2d");

    for (let whitelisted of [false, true])
    {
      for (let i = 0, opacity = 0; i <= 10; opacity = ++i / 10)
      {
        let imageData = {};
        let sizes = [16, 20, 32, 40];
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
  browser.tabs.query({active: true}).then(tabs =>
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

// Pre-render icons on Chromium (#7253).
if (info.platform == "chromium")
  renderIcons();


/***/ }),
/* 58 */
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
const {Filter, ActiveFilter} = __webpack_require__(0);
const {filterStorage} = __webpack_require__(5);
const {filterNotifier} = __webpack_require__(1);
const {Subscription} = __webpack_require__(4);
const {Notification} = __webpack_require__(15);

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
    if (filterStorage.knownSubscriptions.has(subscription.url))
      subscription.disabled = !approved;
  }

  function addAntiAdblockNotification(subscription)
  {
    const urlFilters = [];
    for (const text of subscription.filterText())
    {
      const filter = Filter.fromText(text);
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

    if (filterStorage.knownSubscriptions.has(url) && subscription.disabled)
      addAntiAdblockNotification(subscription);
    else
      removeAntiAdblockNotification();
  }

  filterNotifier.on("subscription.updated", onSubscriptionChange);
  filterNotifier.on("subscription.removed", onSubscriptionChange);
  filterNotifier.on("subscription.disabled", onSubscriptionChange);
};


/***/ }),
/* 59 */
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



const {application} = __webpack_require__(3);
const {Notification} = __webpack_require__(15);
const {Prefs} = __webpack_require__(2);

const DELAY_IN_MS = 30 * 60 * 1000;
const MIN_BLOCKED = 55;

exports.initDay1Notification = function initDay1Notification()
{
  if (application == "fennec" || Prefs.suppress_first_run_page)
    return;

  setTimeout(() =>
  {
    // We don't know what exactly the blocked count will be when
    // the notification will be shown but we expect it to be shown
    // immediately after it surpasses the threshold
    let blockedCount = Prefs.blocked_total;
    if (blockedCount < MIN_BLOCKED)
    {
      blockedCount = MIN_BLOCKED;
    }

    const notification = {
      id: "day1",
      type: "normal",
      title: browser.i18n.getMessage("notification_day1_title", [blockedCount]),
      message: browser.i18n.getMessage("notification_day1_message"),
      links: ["abp:day1"],
      targets: [
        {blockedTotalMin: MIN_BLOCKED}
      ]
    };

    Notification.addNotification(notification);
    Notification.showNext();
  }, DELAY_IN_MS);
};


/***/ }),
/* 60 */
/***/ (function(module, exports) {

module.exports = [{"url":"https://easylist-downloads.adblockplus.org/exceptionrules.txt","id":"acceptable_ads","homepage":"","languages":[],"type":"","title":"Acceptable Ads"},{"url":"https://easylist-downloads.adblockplus.org/exceptionrules-privacy-friendly.txt","id":"acceptable_ads_privacy","homepage":"","languages":[],"type":"","title":"Acceptable Ads Privacy"},{"url":"https://cdn.adblockcdn.com/filters/adblock_custom.txt","id":"adblock_custom","homepage":"https://getadblock.com/help","languages":[],"type":"ads","title":"AdBlock Custom"},{"url":"https://raw.githubusercontent.com/hoshsadiq/adblock-nocoin-list/master/nocoin.txt","id":"bitcoin_mining_protection","homepage":"","languages":[],"type":"","title":"Acceptable Ads"},{"url":"https://easylist-downloads.adblockplus.org/antiadblockfilters.txt","id":"warning_removal","homepage":"","languages":[],"type":"","title":"Warning Removal"},{"url":"https://www.void.gr/kargig/void-gr-filters.txt","id":"easylist_plus_greek","homepage":"mailto:kargig at void.gr","languages":["el"],"type":"ads","title":"EasyList Greek+EasyList"},{"url":"https://raw.githubusercontent.com/szpeter80/hufilter/master/hufilter.txt","id":"hungarian","homepage":"mailto:pete at teamlupus.hu","languages":["hu"],"type":"ads","title":"EasyList Hungarian+EasyList"},{"url":"https://raw.githubusercontent.com/k2jp/abp-japanese-filters/master/abpjf.txt","id":"japanese","homepage":"https://github.com/k2jp/abp-japanese-filters/","languages":["ja"],"type":"ads","title":"Japanese"},{"url":"https://adblock.gardar.net/is.abp.txt","id":"icelandic","homepage":"mailto:adblock at gardar.net","languages":["is"],"type":"ads","title":"Icelandic"},{"url":"https://easylist-downloads.adblockplus.org/malwaredomains_full.txt","id":"malware","homepage":"http://malwaredomains.com/?page_id=2","languages":[],"type":"ads","title":"Malware"},{"url":"https://easylist-downloads.adblockplus.org/abpindo+easylist.txt","id":"easylist_plus_indonesian","homepage":"http://abpindo.blogspot.com/","languages":["id","ms"],"type":"ads","title":"ABPindo+EasyList"},{"url":"https://easylist-downloads.adblockplus.org/abpvn+easylist.txt","id":"easylist_plus_vietnamese","homepage":"http://abpvn.com/","languages":["vi"],"type":"ads","title":"ABPVN List+EasyList"},{"url":"https://easylist-downloads.adblockplus.org/bulgarian_list+easylist.txt","id":"easylist_plus_bulgarian","homepage":"http://stanev.org/abp/","languages":["bg"],"type":"ads","title":"Bulgarian list+EasyList"},{"url":"https://easylist-downloads.adblockplus.org/easylist.txt","id":"easylist","homepage":"https://easylist.to/","languages":["en"],"type":"ads","title":"EasyList"},{"url":"https://easylist-downloads.adblockplus.org/easylistchina+easylist.txt","id":"chinese","homepage":"http://abpchina.org/forum/","languages":["zh"],"type":"ads","title":"EasyList China+EasyList"},{"url":"https://easylist-downloads.adblockplus.org/easylistczechslovak+easylist.txt","id":"czech","homepage":"https://adblock.sk/","languages":["cs","sk"],"type":"ads","title":"EasyList Czech and Slovak+EasyList"},{"url":"https://easylist-downloads.adblockplus.org/easylistdutch+easylist.txt","id":"dutch","homepage":"https://easylist.to/","languages":["nl"],"type":"ads","title":"EasyList Dutch+EasyList"},{"url":"https://easylist-downloads.adblockplus.org/easylistgermany+easylist.txt","id":"easylist_plus_german","homepage":"https://easylist.to/","languages":["de"],"type":"ads","title":"EasyList Germany+EasyList"},{"url":"https://easylist-downloads.adblockplus.org/israellist+easylist.txt","id":"israeli","homepage":"https://github.com/easylist/EasyListHebrew","languages":["he"],"type":"ads","title":"EasyList Hebrew+EasyList"},{"url":"https://easylist-downloads.adblockplus.org/easylistitaly+easylist.txt","id":"italian","homepage":"https://easylist.to/","languages":["it"],"type":"ads","title":"EasyList Italy+EasyList"},{"url":"https://easylist-downloads.adblockplus.org/easylistlithuania+easylist.txt","id":"easylist_plus_lithuania","homepage":"http://margevicius.lt/","languages":["lt"],"type":"ads","title":"EasyList Lithuania+EasyList"},{"url":"https://easylist-downloads.adblockplus.org/easylistpolish+easylist.txt","id":"easylist_plus_polish","homepage":"https://easylist.to/","languages":["pl"],"type":"ads","title":"EasyList Polish+EasyList"},{"url":"https://easylist-downloads.adblockplus.org/easylistportuguese+easylist.txt","id":"easylist_plus_portuguese","homepage":"https://easylist.to/","languages":["pt"],"type":"ads","title":"EasyList Portuguese+EasyList"},{"url":"https://easylist-downloads.adblockplus.org/easylistspanish+easylist.txt","id":"easylist_plus_spanish","homepage":"https://easylist.to/","languages":["es"],"type":"ads","title":"EasyList Spanish+EasyList"},{"url":"https://easylist-downloads.adblockplus.org/indianlist+easylist.txt","id":"easylist_plus_indian","homepage":"https://easylist.to/","languages":["bn","gu","hi","pa"],"type":"ads","title":"IndianList+EasyList"},{"url":"https://easylist-downloads.adblockplus.org/koreanlist+easylist.txt","id":"easylist_plun_korean","homepage":"https://easylist.to/","languages":["ko"],"type":"ads","title":"KoreanList+EasyList"},{"url":"https://easylist-downloads.adblockplus.org/latvianlist+easylist.txt","id":"latvian","homepage":"https://notabug.org/latvian-list/adblock-latvian","languages":["lv"],"type":"ads","title":"Latvian List+EasyList"},{"url":"https://easylist-downloads.adblockplus.org/liste_ar+liste_fr+easylist.txt","id":"easylist_plus_arabic_plus_french","homepage":"https://code.google.com/p/liste-ar-adblock/","languages":["ar"],"type":"ads","title":"Liste AR+Liste FR+EasyList"},{"url":"https://easylist-downloads.adblockplus.org/liste_fr+easylist.txt","id":"easylist_plus_french","homepage":"https://forums.lanik.us/viewforum.php?f","languages":["fr"],"type":"ads","title":"Liste FR+EasyList"},{"url":"https://easylist-downloads.adblockplus.org/rolist+easylist.txt","id":"easylist_plus_romanian","homepage":"http://www.zoso.ro/rolist","languages":["ro"],"type":"ads","title":"ROList+EasyList"},{"url":"https://easylist-downloads.adblockplus.org/ruadlist+easylist.txt","id":"russian","homepage":"https://forums.lanik.us/viewforum.php?f","languages":["ru","uk"],"type":"ads","title":"RuAdList+EasyList"},{"url":"https://easylist-downloads.adblockplus.org/abp-filters-anti-cv.txt","id":"anticircumvent","homepage":"https://github.com/abp-filters/abp-filters-anti-cv","languages":[],"type":"circumvention","title":"ABP filters"},{"url":"https://easylist-downloads.adblockplus.org/easyprivacy.txt","id":"easyprivacy","homepage":"https://easylist.to/","languages":[],"type":"privacy","title":"EasyPrivacy"},{"url":"https://easylist-downloads.adblockplus.org/fanboy-social.txt","id":"antisocial","homepage":"https://easylist.to/","languages":[],"type":"social","title":"Fanboy's Social Blocking List"},{"url":"https://easylist-downloads.adblockplus.org/fanboy-annoyance.txt","id":"annoyances","homepage":"https://easylist.to/","languages":[],"type":"social","title":"Fanboy's Annoyances"},{"url":"https://fanboy.co.nz/fanboy-turkish.txt","id":"turkish","language":true,"hidden":false},{"url":"https://easylist-downloads.adblockplus.org/Liste_AR.txt","id":"easylist_plus_arabic","language":true,"hidden":true},{"url":"https://margevicius.lt/easylistlithuania.txt","id":"easylist_plus_lithuania_old","language":true,"hidden":true},{"url":"https://notabug.org/latvian-list/adblock-latvian/raw/master/lists/latvian-list.txt","id":"latvian_old","language":true,"hidden":true},{"url":"https://easylist-downloads.adblockplus.org/easylistitaly.txt","id":"italian_old","language":true,"hidden":true},{"url":"https://stanev.org/abp/adblock_bg.txt","id":"easylist_plus_bulgarian_old","language":true,"hidden":true},{"url":"https://easylist-downloads.adblockplus.org/easylistdutch.txt","id":"dutch_old","language":true,"hidden":true},{"url":"https://easylist-downloads.adblockplus.org/liste_fr.txt","id":"easylist_plus_french_old","language":true,"hidden":true},{"url":"https://easylist-downloads.adblockplus.org/easylistgermany.txt","id":"easylist_plus_german_old","language":true,"hidden":true},{"url":"https://raw.githubusercontent.com/heradhis/indonesianadblockrules/master/subscriptions/abpindo.txt","id":"easylist_plus_indonesian_old","language":true,"hidden":true},{"url":"https://www.certyficate.it/adblock/adblock.txt","id":"easylist_plus_polish_old","language":true,"hidden":true},{"url":"https://www.zoso.ro/pages/rolist.txt","id":"easylist_plus_romanian_old","language":true,"hidden":true},{"url":"https://easylist-downloads.adblockplus.org/advblock.txt","id":"russian_old","language":true,"hidden":true},{"url":"https://easylist-downloads.adblockplus.org/easylistchina.txt","id":"chinese_old","language":true,"hidden":true},{"url":"https://raw.github.com/tomasko126/easylistczechandslovak/master/filters.txt","id":"czech_old","language":true,"hidden":true},{"url":"https://raw.githubusercontent.com/DandelionSprout/adfilt/master/NorwegianExperimentalList%20alternate%20versions/NordicFiltersABP.txt","id":"norwegian","language":true,"hidden":false,"languages":["no"]}]

/***/ }),
/* 61 */
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
/* 62 */
/***/ (function(module, exports) {

/* WEBPACK VAR INJECTION */(function(__webpack_amd_options__) {/* globals __webpack_amd_options__ */
module.exports = __webpack_amd_options__;

/* WEBPACK VAR INJECTION */}.call(exports, {}))

/***/ }),
/* 63 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


/* For ESLint: List any global identifiers used in this file below */
/* global chrome, chromeStorageSetHelper */

// Send the file name and line number of any error message. This will help us
// to trace down any frequent errors we can't confirm ourselves.
window.addEventListener('error', (e) => {
  if (!e.filename && !e.lineno && !e.colno && !e.error && !e.message) {
    return;
  }
  let str = `Error: ${
    (e.filename || 'anywhere').replace(chrome.runtime.getURL(''), '')
  }:${e.lineno || 'anywhere'
  }:${e.colno || 'anycol'}`;
  if (e.message) {
    str += `: ${e.message}`;
  }
  const src = e.target.src || e.target.href;
  if (src) {
    str += `src: ${src}`;
  }
  if (e.error) {
    let stack = `-${e.error.message || ''
    }-${e.error.stack || ''}`;
    stack = stack.replace(/:/gi, ';').replace(/\n/gi, '');
    // only append the stack info if there isn't any URL info in the stack trace
    if (stack.indexOf('http') === -1) {
      str += stack;
    }
    // don't send large stack traces
    if (str.length > 1024) {
      str = str.substr(0, 1023);
    }
  }
  chromeStorageSetHelper('errorkey', `Date added:${new Date()} ${str}`);
  // eslint-disable-next-line no-console
  console.log(str);
});


/***/ }),
/* 64 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


/* For ESLint: List any global identifiers used in this file below */
/* global chrome, log, License, runBandaids, openTab */

// Set to true to get noisier console.log statements
const VERBOSE_DEBUG = false;
let loggingEnable = false;

// Enabled in adblock_start_common.js and background.js if the user wants
const logging = function (enabled) {
  if (enabled) {
    loggingEnable = true;
    window.log = function log(...args) {
      if (VERBOSE_DEBUG || args[0] !== '[DEBUG]') { // comment out for verbosity
        // eslint-disable-next-line no-console
        console.log(...args);
      }
    };
  } else {
    window.log = function log() {
    };

    loggingEnable = false;
  }
};

logging(false); // disabled by default

// Behaves very similarly to $.ready() but does not require jQuery.
const onReady = function (callback) {
  if (document.readyState === 'complete') {
    window.setTimeout(callback, 0);
  } else {
    window.addEventListener('load', callback, false);
  }
};

// Excecute any bandaid for the specific site, if the bandaids.js was loaded.
onReady(() => {
  if (typeof runBandaids === 'function') {
    runBandaids();
  }
});

// Inputs:
//   - messageName : Str
//   - substitutions : Array of Str or a String
const translate = function (messageName, substitutions) {
  if (!messageName || typeof messageName !== 'string') {
    // eslint-disable-next-line no-console
    console.trace('missing messageName');
    return '';
  }

  let parts = substitutions;
  if (Array.isArray(parts)) {
    for (let i = 0; i < parts.length; i++) {
      if (typeof parts[i] !== 'string') {
        parts[i] = parts[i].toString();
      }
    }
  } else if (parts && typeof parts !== 'string') {
    parts = parts.toString();
  }

  // if VERBOSE_DEBUG is set to true, duplicate (double the length) of the translated strings
  // used for testing purposes only
  if (VERBOSE_DEBUG) {
    return `${chrome.i18n.getMessage(messageName, parts)}
            ${chrome.i18n.getMessage(messageName, parts)}`;
  }
  return chrome.i18n.getMessage(messageName, parts);
};

const splitMessageWithReplacementText = function (rawMessageText, messageID) {
  const anchorStartPos = rawMessageText.indexOf('[[');
  const anchorEndPos = rawMessageText.indexOf(']]');

  if (anchorStartPos === -1 || anchorEndPos === -1) {
    log('replacement tag not found', messageID, rawMessageText, anchorStartPos, anchorEndPos);
    return { error: 'no brackets found' };
  }
  const returnObj = {};
  returnObj.anchorPrefixText = rawMessageText.substring(0, anchorStartPos);
  returnObj.anchorText = rawMessageText.substring(anchorStartPos + 2, anchorEndPos);
  returnObj.anchorPostfixText = rawMessageText.substring(anchorEndPos + 2);
  return returnObj;
};

const processReplacementChildren = function ($el, replacementText, messageId) {
  // Replace a dummy <a/> inside of localized text with a real element.
  // Give the real element the same text as the dummy link.
  const $element = $el;
  const messageID = $element.attr('i18n') || messageId;
  if (!messageID || typeof messageID !== 'string') {
    $(this).addClass('i18n-replaced');
    return;
  }
  if (!$element.get(0).firstChild) {
    log('returning, no first child found', $element.attr('i18n'));
    return;
  }
  if (!$element.get(0).lastChild) {
    log('returning, no last child found', $element.attr('i18n'));
    return;
  }
  const replaceElId = `#${$element.attr('i18n_replacement_el')}`;
  if ($(replaceElId).length === 0) {
    log('returning, no child element found', $element.attr('i18n'), replaceElId);
    return;
  }
  const rawMessageText = chrome.i18n.getMessage(messageID) || '';
  const messageSplit = splitMessageWithReplacementText(rawMessageText, messageID);
  $element.get(0).firstChild.nodeValue = messageSplit.anchorPrefixText;
  $element.get(0).lastChild.nodeValue = messageSplit.anchorPostfixText;
  if ($(replaceElId).get(0).tagName === 'INPUT') {
    $(`#${$element.attr('i18n_replacement_el')}`).prop('value', replacementText || messageSplit.anchorText);
  } else {
    $(`#${$element.attr('i18n_replacement_el')}`).text(replacementText || messageSplit.anchorText);
  }

  // If localizePage is run again, don't let the [i18n] code above
  // clobber our work
  $element.addClass('i18n-replaced');
};

// Processes any replacement children in the passed-in element. Unlike the
// above processReplacementChildren, this function expects the text to already
// be inside the element (as textContent).
const processReplacementChildrenInContent = function ($el) {
  // Replace a dummy <a/> inside of localized text with a real element.
  // Give the real element the same text as the dummy link.
  const $element = $el;
  const message = $element.get(0).textContent;
  if (!message || typeof message !== 'string' || !$element.get(0).firstChild || !$element.get(0).lastChild) {
    return;
  }
  const replaceElId = `#${$element.attr('i18n_replacement_el')}`;
  const replaceEl = $element.find(replaceElId);
  if (replaceEl.length === 0) {
    log('returning, no child element found', replaceElId);
    return;
  }
  const messageSplit = splitMessageWithReplacementText(message);
  $element.get(0).firstChild.nodeValue = messageSplit.anchorPrefixText;
  $element.get(0).lastChild.nodeValue = messageSplit.anchorPostfixText;
  if (replaceEl.get(0).tagName === 'INPUT') {
    replaceEl.prop('value', messageSplit.anchorText);
  } else {
    replaceEl.text(messageSplit.anchorText);
  }
};

// Determine what language the user's browser is set to use
const determineUserLanguage = function () {
  if (typeof navigator.language !== 'undefined' && navigator.language) {
    return navigator.language.match(/^[a-z]+/i)[0];
  }
  return null;
};

const getUILanguage = function () {
  return chrome.i18n.getUILanguage();
};

// Set dir and lang attributes to the given el or to document.documentElement by default
const setLangAndDirAttributes = function (el) {
  const element = el instanceof HTMLElement ? el : document.documentElement;
  chrome.runtime.sendMessage({
    type: 'app.get',
    what: 'localeInfo',
  }).then((localeInfo) => {
    element.lang = localeInfo.locale;
    element.dir = localeInfo.bidiDir;
  });
};

const localizePage = function () {
  setLangAndDirAttributes();

  // translate a page into the users language
  $('[i18n]:not(.i18n-replaced, [i18n_replacement_el])').each(function i18n() {
    $(this).text(translate($(this).attr('i18n')));
  });

  $('[i18n_value]:not(.i18n-replaced)').each(function i18nValue() {
    $(this).val(translate($(this).attr('i18n_value')));
  });

  $('[i18n_title]:not(.i18n-replaced)').each(function i18nTitle() {
    $(this).attr('title', translate($(this).attr('i18n_title')));
  });

  $('[i18n_placeholder]:not(.i18n-replaced)').each(function i18nPlaceholder() {
    $(this).attr('placeholder', translate($(this).attr('i18n_placeholder')));
  });

  $('[i18n_replacement_el]:not(.i18n-replaced)').each(function i18nReplacementEl() {
    processReplacementChildren($(this));
  });

  $('[i18n-alt]').each(function i18nImgAlt() {
    $(this).attr('alt', translate($(this).attr('i18n-alt')));
  });

  $('[i18n-aria-label]').each(function i18nAriaLabel() {
    $(this).attr('aria-label', translate($(this).attr('i18n-aria-label')));
  });

  // Make a right-to-left translation for Arabic and Hebrew languages
  const language = determineUserLanguage();
  if (language === 'ar' || language === 'he') {
    $('#main_nav').removeClass('right').addClass('left');
    $('.adblock-logo').removeClass('left').addClass('right');
    $('.closelegend').css('float', 'left');
    document.documentElement.dir = 'rtl';
  }
}; // end of localizePage

// Parse a URL. Based upon http://blog.stevenlevithan.com/archives/parseuri
// parseUri 1.2.2, (c) Steven Levithan <stevenlevithan.com>, MIT License
// Inputs: url: the URL you want to parse
// Outputs: object containing all parts of |url| as attributes
const parseUriRegEx = /^(([^:]+(?::|$))(?:(?:\w+:)?\/\/)?(?:[^:@/]*(?::[^:@/]*)?@)?(([^:/?#]*)(?::(\d*))?))((?:[^?#/]*\/)*[^?#]*)(\?[^#]*)?(#.*)?/;
const parseUri = function (url) {
  const matches = parseUriRegEx.exec(url);

  // The key values are identical to the JS location object values for that key
  const keys = ['href', 'origin', 'protocol', 'host', 'hostname', 'port',
    'pathname', 'search', 'hash'];
  const uri = {};
  for (let i = 0; (matches && i < keys.length); i++) {
    uri[keys[i]] = matches[i] || '';
  }
  return uri;
};

// Parses the search part of a URL into a key: value object.
// e.g., ?hello=world&ext=adblock would become {hello:"world", ext:"adblock"}
// Inputs: search: the search query of a URL. Must have &-separated values.
parseUri.parseSearch = function parseSearch(searchQuery) {
  const params = {};
  let search = searchQuery;
  let pair;

  // Fails if a key exists twice (e.g., ?a=foo&a=bar would return {a:"bar"}
  search = search.substring(search.indexOf('?') + 1).split('&');

  for (let i = 0; i < search.length; i++) {
    pair = search[i].split('=');
    if (pair[0] && !pair[1]) {
      pair[1] = '';
    }
    const pairKey = decodeURIComponent(pair[0]);
    const pairValue = decodeURIComponent(pair[1]);
    if (pairKey && pairValue !== 'undefined') {
      params[pairKey] = pairValue;
    }
  }
  return params;
};

// Strip third+ level domain names from the domain and return the result.
// Inputs: domain: the domain that should be parsed
// keepDot: true if trailing dots should be preserved in the domain
// Returns: the parsed domain
parseUri.secondLevelDomainOnly = function stripThirdPlusLevelDomain(domain, keepDot) {
  if (domain) {
    const match = domain.match(/([^.]+\.(?:co\.)?[^.]+)\.?$/) || [domain, domain];
    return match[keepDot ? 0 : 1].toLowerCase();
  }

  return domain;
};

// Inputs: key:string.
// Returns value if key exists, else undefined.
const sessionStorageGet = function (key) {
  const json = sessionStorage.getItem(key);
  if (json == null) {
    return undefined;
  }
  try {
    return JSON.parse(json);
  } catch (e) {
    log(`Couldn't parse json for ${key}`);
    return undefined;
  }
};

// Inputs: key:string.
// Returns value if key exists, else undefined.
const sessionStorageSet = function (key, value) {
  if (value === undefined) {
    sessionStorage.removeItem(key);
    return;
  }
  try {
    sessionStorage.setItem(key, JSON.stringify(value));
  } catch (ex) {
    if (ex.name === 'QUOTA_EXCEEDED_ERR') {
      // eslint-disable-next-line no-alert
      alert(translate('storage_quota_exceeded'));
      openTab('options/index.html#ui-tabs-2');
    }
  }
};

// Inputs: key:string.
// Returns object from localStorage.
// The following two functions should only be used when
// multiple 'sets' & 'gets' may occur in immediately preceding each other
// chrome.storage.local.get & set instead
const storageGet = function (key) {
  const store = localStorage;
  const json = store.getItem(key);
  if (json == null) {
    return undefined;
  }
  try {
    return JSON.parse(json);
  } catch (e) {
    log(`Couldn't parse json for ${key}`, e);
    return undefined;
  }
};

// Inputs: key:string, value:object.
// Returns undefined.
const storageSet = function (key, value) {
  const store = localStorage;
  try {
    store.setItem(key, JSON.stringify(value));
  } catch (ex) {
    // eslint-disable-next-line no-console
    console.log(ex);
  }
};

const chromeStorageSetHelper = function (key, value, callback) {
  const items = {};
  items[key] = value;
  chrome.storage.local.set(items).then(() => {
    if (typeof callback === 'function') {
      callback();
    }
  }).catch((error) => {
    if (typeof callback === 'function') {
      callback(error);
    }
  });
};

const chromeStorageGetHelper = function (storageKey) {
  return new Promise(((resolve, reject) => {
    chrome.storage.local.get(storageKey).then((items) => {
      resolve(items[storageKey]);
    }).catch((error) => {
      // eslint-disable-next-line no-console
      console.error(error);
      reject(error);
    });
  }));
};

const chromeLocalStorageOnChangedHelper = function (storageKey, callback) {
  chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace !== 'local') {
      return;
    }
    for (const key in changes) {
      if (key !== storageKey) {
        return;
      }
      callback();
    }
  });
};

const reloadOptionsPageTabs = function () {
  const optionTabQuery = {
    url: `chrome-extension://${chrome.runtime.id}/options.html*`,
  };
  chrome.tabs.query(optionTabQuery).then((tabs) => {
    for (const i in tabs) {
      chrome.tabs.reload(tabs[i].id);
    }
  });
};

const reloadAllOpenedTabs = function () {
  const optionTabQuery = {
    url: `chrome-extension://${chrome.runtime.id}/*`,
  };
  chrome.tabs.query(optionTabQuery).then((tabs) => {
    for (const i in tabs) {
      chrome.tabs.reload(tabs[i].id);
    }
  });
};

// selected attaches a click and keydown event handler to the matching selector and calls
// the handler if a click or keydown event occurs (with a CR or space is pressed). We support
// both mouse and keyboard events to increase accessibility of the popup menu.
// Returns a reference to the keydown handler for future removal.
const selected = function (selector, handler) {
  const $matched = $(selector);
  $matched.click(handler);
  function keydownHandler(event) {
    if (event.which === 13 || event.which === 32) {
      handler(event);
    }
  }
  $matched.keydown(keydownHandler);
  return keydownHandler;
};

// selectedOff removes a click and keydown event handler from the matching selector.
const selectedOff = function (selector, clickHandler, keydownHandler) {
  const $matched = $(selector);
  $matched.off('click', clickHandler);
  $matched.off('keydown', keydownHandler);
};

// selectedOnce adds event listeners to the given element for mouse click or keydown CR or space
// events which runs the handler and immediately removes the event handlers so it cannot fire again.
const selectedOnce = function (element, handler) {
  if (!element) {
    return;
  }
  const clickHandler = function () {
    element.removeEventListener('click', clickHandler);
    handler();
  };
  element.addEventListener('click', clickHandler);

  const keydownHandler = function (event) {
    if (event.keyCode === 13 || event.keyCode === 32) {
      element.removeEventListener('keydown', keydownHandler);
      handler();
    }
  };
  element.addEventListener('keydown', keydownHandler);
};

// Join 2 or more sentences once translated.
// Inputs: arg:str -- Each arg is the string of a full sentence in message.json
const i18nJoin = function (...args) {
  let joined = '';
  for (let i = 0; i < args.length; i++) {
    const isLastSentence = i + 1 === args.length;
    if (!isLastSentence) {
      joined += `${translate(args[i])} `;
    } else {
      joined += `${translate(args[i])}`;
    }
  }
  return joined;
};

const isEmptyObject = obj => !!(Object.keys(obj).length === 0 && obj.constructor === Object);

Object.assign(window, {
  sessionStorageSet,
  sessionStorageGet,
  storageGet,
  storageSet,
  parseUri,
  determineUserLanguage,
  getUILanguage,
  chromeStorageSetHelper,
  logging,
  translate,
  chromeStorageGetHelper,
  reloadOptionsPageTabs,
  reloadAllOpenedTabs,
  chromeLocalStorageOnChangedHelper,
  selected,
  selectedOnce,
  i18nJoin,
  isEmptyObject,
});


/***/ }),
/* 65 */
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
const {LocalCDN} = __webpack_require__(17);
LocalCDN.setUp();
 


/***/ }),
/* 66 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


/* For ESLint: List any global identifiers used in this file below */
/* global chrome, require, log, chromeStorageSetHelper, logging */

const { EventEmitter } = __webpack_require__(6);
const { LocalCDN } = __webpack_require__(17);
const minjQuery = __webpack_require__(24);

const settingsNotifier = new EventEmitter();
const abpPrefPropertyNames = ['show_statsinicon', 'shouldShowBlockElementMenu', 'show_statsinpopup', 'show_devtools_panel'];
const validThemes = ['default_theme', 'dark_theme', 'watermelon_theme', 'solarized_theme', 'solarized_light_theme', 'rebecca_purple_theme', 'ocean_theme', 'sunshine_theme'];

window.jQuery = minjQuery;
window.$ = minjQuery;

// OPTIONAL SETTINGS
function Settings() {
  this.settingsKey = 'settings';
  this.defaults = {
    debug_logging: false,
    youtube_channel_whitelist: false,
    show_advanced_options: false,
    show_block_counts_help_link: true,
    show_survey: true,
    local_cdn: false,
    picreplacement: false,
    twitch_hiding: false,
    color_themes: {
      popup_menu: 'default_theme',
      options_page: 'default_theme',
    },
  };
  const that = this;
  this.init = new Promise(((resolve) => {
    chrome.storage.local.get(that.settingsKey).then((response) => {
      const settings = response.settings || {};
      that.data = $.extend(that.defaults, settings);
      if (settings.debug_logging) {
        logging(true);
      }
      if (settings.local_cdn) {
        LocalCDN.start();
      }

      resolve();
    });
  })).then(() => {
    log('\n===SETTINGS FINISHED LOADING===\n\n');
  });
}

Settings.prototype = {
  set(name, isEnabled, callback) {
    const originalValue = this.data[name];
    this.data[name] = isEnabled;
    const that = this;

    // Don't store defaults that the user hasn't modified
    chrome.storage.local.get(this.settingsKey).then((response) => {
      const storedData = response.settings || {};

      storedData[name] = isEnabled;
      chromeStorageSetHelper(that.settingsKey, storedData);
      if (originalValue !== isEnabled) {
        settingsNotifier.emit('settings.changed', name, isEnabled, originalValue);
      }
      if (callback !== undefined && typeof callback === 'function') {
        callback();
      }
    });
  },

  getAll() {
    return this.data;
  },

  onload() {
    return this.init;
  },

};

const settings = new Settings();
settings.onload();

const getSettings = function () {
  return settings.getAll();
};

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.command !== 'getSettings') {
    return;
  } // not for us
  sendResponse(getSettings());
});

const setSetting = function (name, isEnabled, callback) {
  settings.set(name, isEnabled, callback);

  if (name === 'debug_logging') {
    logging(isEnabled);
  }
};

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.command !== 'setSetting' || !message.name || (typeof message.isEnabled === 'undefined')) {
    return;
  }
  setSetting(message.name, message.isEnabled);
  sendResponse({});
});

const disableSetting = function (name) {
  settings.set(name, false);
};

const isValidTheme = themeName => validThemes.includes(themeName);

// Attach methods to window
Object.assign(window, {
  disableSetting,
  getSettings,
  setSetting,
  settings,
  settingsNotifier,
  isValidTheme,
  abpPrefPropertyNames,
});


/***/ }),
/* 67 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


/* For ESLint: List any global identifiers used in this file below */
/* global chrome, require, chromeStorageSetHelper, log, License, translate,
   gabQuestion, ext, getSettings, parseUri, sessionStorageGet, setSetting,
  blockCounts, sessionStorageSet, updateButtonUIAndContextMenus, settings, storageGet */

const { Filter } = __webpack_require__(0);
const { WhitelistFilter } = __webpack_require__(0);
const { checkWhitelisted } = __webpack_require__(9);
const { Subscription } = __webpack_require__(4);
const { DownloadableSubscription } = __webpack_require__(4);
const { SpecialSubscription } = __webpack_require__(4);
const { filterStorage } = __webpack_require__(5);
const { filterNotifier } = __webpack_require__(1);
const { Prefs } = __webpack_require__(2);
const { synchronizer } = __webpack_require__(16);
const { Utils } = __webpack_require__(12);
const { getBlockedPerPage } = __webpack_require__(22);
const NotificationStorage = __webpack_require__(15).Notification;
const { RegExpFilter, InvalidFilter } = __webpack_require__(0);
const { URLRequest } = __webpack_require__(10);
const info = __webpack_require__(3);

// Object's used on the option, pop up, etc. pages...
const { STATS } = __webpack_require__(35);
const { SyncService } = __webpack_require__(37);
const { DataCollectionV2 } = __webpack_require__(68);
const { LocalCDN } = __webpack_require__(17);
const { ServerMessages } = __webpack_require__(14);
const { recommendations } = __webpack_require__(23);
const { uninstallInit } = __webpack_require__(34);
const { ExcludeFilter } = __webpack_require__(38);
const {
  recordGeneralMessage,
  recordErrorMessage,
  recordAdreportMessage,
  recordAnonymousMessage,
} = __webpack_require__(14).ServerMessages;
const {
  getUrlFromId,
  unsubscribe,
  getSubscriptionsMinusText,
  getAllSubscriptionsMinusText,
  getIdFromURL,
  getSubscriptionInfoFromURL,
  isLanguageSpecific,
} = __webpack_require__(70).SubscriptionAdapter;

Object.assign(window, {
  filterStorage,
  filterNotifier,
  Prefs,
  synchronizer,
  NotificationStorage,
  Subscription,
  SpecialSubscription,
  DownloadableSubscription,
  Filter,
  WhitelistFilter,
  checkWhitelisted,
  info,
  getBlockedPerPage,
  Utils,
  STATS,
  SyncService,
  DataCollectionV2,
  LocalCDN,
  ServerMessages,
  recordGeneralMessage,
  recordErrorMessage,
  recordAdreportMessage,
  recordAnonymousMessage,
  getUrlFromId,
  unsubscribe,
  recommendations,
  getSubscriptionsMinusText,
  getAllSubscriptionsMinusText,
  getIdFromURL,
  getSubscriptionInfoFromURL,
  ExcludeFilter,
});

// CUSTOM FILTERS

const isSelectorFilter = function (text) {
  // This returns true for both hiding rules as hiding whitelist rules
  // This means that you'll first have to check if something is an excluded rule
  // before checking this, if the difference matters.
  return /#@?#./.test(text);
};

// custom filter countCache singleton.
const countCache = (function countCache() {
  let cache;

  // Update custom filter count stored in localStorage
  const updateCustomFilterCount = function () {
    chromeStorageSetHelper('custom_filter_count', cache);
  };

  return {
    // Update custom filter count cache and value stored in localStorage.
    // Inputs: new_count_map:count map - count map to replace existing count
    // cache
    updateCustomFilterCountMap(newCountMap) {
      cache = newCountMap || cache;
      updateCustomFilterCount();
    },

    // Remove custom filter count for host
    // Inputs: host:string - url of the host
    removeCustomFilterCount(host) {
      if (host && cache[host]) {
        delete cache[host];
        updateCustomFilterCount();
      }
    },

    // Get current custom filter count for a particular domain
    // Inputs: host:string - url of the host
    getCustomFilterCount(host) {
      return cache[host] || 0;
    },

    // Add 1 to custom filter count for the filters domain.
    // Inputs: filter:string - line of text to be added to custom filters.
    addCustomFilterCount(filter) {
      const host = filter.split('##')[0];
      cache[host] = this.getCustomFilterCount(host) + 1;
      updateCustomFilterCount();
    },

    init() {
      chrome.storage.local.get('custom_filter_count').then((response) => {
        cache = response.custom_filter_count || {};
      });
    },
  };
}());

countCache.init();

// Add a new custom filter entry.
// Inputs: filter:string line of text to add to custom filters.
// Returns: null if succesfull, otherwise an exception
const addCustomFilter = function (filterText) {
  try {
    const filter = Filter.fromText(filterText);
    if (filter instanceof InvalidFilter) {
      return { error: filter.reason };
    }
    filterStorage.addFilter(filter);
    if (isSelectorFilter(filterText)) {
      countCache.addCustomFilterCount(filterText);
    }

    return null;
  } catch (ex) {
    // convert to a string so that Safari can pass
    // it back to content scripts
    return ex.toString();
  }
};
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.command !== 'addCustomFilter' || !message.filterTextToAdd) {
    return;
  }
  sendResponse({ response: addCustomFilter(message.filterTextToAdd) });
});

// Creates a custom filter entry that whitelists a given page
// Inputs: pageUrl:string url of the page
// Returns: null if successful, otherwise an exception
const createPageWhitelistFilter = function (pageUrl) {
  const url = pageUrl.replace(/#.*$/, ''); // Remove anchors
  const parts = url.match(/^([^?]+)(\??)/); // Detect querystring
  const hasQuerystring = parts[2];
  const filter = `@@|${parts[1]}${hasQuerystring ? '?' : '|'}$document`;
  return addCustomFilter(filter);
};

// UNWHITELISTING

function getUserFilters() {
  const filters = [];

  for (const subscription of filterStorage.subscriptions()) {
    if ((subscription instanceof SpecialSubscription)) {
      for (let j = 0; j < subscription._filterText.length; j++) {
        const filter = subscription._filterText[j];
        filters.push(filter);
      }
    }
  }
  return filters;
}


const isWhitelistFilter = function (text) {
  return /^@@/.test(text);
};

// Look for a custom filter that would whitelist the 'url' parameter
// and if any exist, remove the first one.
// Inputs: url:string - a URL that may be whitelisted by a custom filter
// Returns: true if a filter was found and removed; false otherwise.
const tryToUnwhitelist = function (pageUrl) {
  const url = pageUrl.replace(/#.*$/, ''); // Whitelist ignores anchors
  const customFilters = getUserFilters();
  if (!customFilters || !customFilters.length === 0) {
    return false;
  }

  for (let i = 0; i < customFilters.length; i++) {
    const text = customFilters[i];
    const whitelist = text.search(/@@\*\$document,domain=~/);

    // Blacklist site, which is whitelisted by global @@*&document,domain=~
    // filter
    if (whitelist > -1) {
      // Remove protocols
      const [finalUrl] = url.replace(/((http|https):\/\/)?(www.)?/, '').split(/[/?#]/);
      const oldFilter = Filter.fromText(text);
      filterStorage.removeFilter(oldFilter);
      const newFilter = Filter.fromText(`${text}|~${finalUrl}`);
      filterStorage.addFilter(newFilter);
      return true;
    }

    if (isWhitelistFilter(text)) {
      try {
        const filter = Filter.fromText(text);
        if (filter.matches(URLRequest.from(url), RegExpFilter.typeMap.DOCUMENT, false)) {
          filterStorage.removeFilter(filter);
          return true;
        }
      } catch (ex) {
        // do nothing;
      }
    }
  }
  return false;
};

// Removes a custom filter entry.
// Inputs: host:domain of the custom filters to be reset.
const removeCustomFilter = function (host) {
  const customFilters = getUserFilters();
  if (!customFilters || !customFilters.length === 0) {
    return;
  }

  const identifier = host;

  for (let i = 0; i < customFilters.length; i++) {
    const entry = customFilters[i];

    // If the identifier is at the start of the entry
    // then delete it.
    if (entry.indexOf(identifier) === 0) {
      const filter = Filter.fromText(entry);
      filterStorage.removeFilter(filter);
    }
  }
};

// Entry point for customize.js, used to update custom filter count cache.
const updateCustomFilterCountMap = function (newCountMap) {
  countCache.updateCustomFilterCountMap(newCountMap);
};

const removeCustomFilterForHost = function (host) {
  if (countCache.getCustomFilterCount(host)) {
    removeCustomFilter(host);
    countCache.removeCustomFilterCount(host);
  }
};

const confirmRemovalOfCustomFiltersOnHost = function (host, activeTab) {
  const customFilterCount = countCache.getCustomFilterCount(host);
  const confirmationText = translate('confirm_undo_custom_filters', [customFilterCount, host]);
  // eslint-disable-next-line no-alert
  if (!window.confirm(confirmationText)) {
    return;
  }

  removeCustomFilterForHost(host);
  chrome.tabs.reload(activeTab.id);
};

// Reload already opened tab
// Input:
// id: integer - id of the tab which should be reloaded
const reloadTab = function (id, callback) {
  let tabId = id;
  const localCallback = callback;
  const listener = function (updatedTabId, changeInfo, tab) {
    if (changeInfo.status === 'complete' && tab.status === 'complete') {
      setTimeout(() => {
        chrome.tabs.sendMessage(updatedTabId, { command: 'reloadcomplete' });
        if (typeof localCallback === 'function') {
          localCallback(tab);
        }
        chrome.tabs.onUpdated.removeListener(listener);
      }, 2000);
    }
  };

  if (typeof tabId === 'string') {
    tabId = parseInt(tabId, 10);
  }
  chrome.tabs.onUpdated.addListener(listener);
  chrome.tabs.reload(tabId, { bypassCache: true });
};

const isSelectorExcludeFilter = function (text) {
  return /#@#./.test(text);
};

const getAdblockUserId = function () {
  return STATS.userId();
};

// passthrough functions
const addGABTabListeners = function (sender) {
  gabQuestion.addGABTabListeners(sender);
};
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.command !== 'addGABTabListeners') {
    return;
  }
  addGABTabListeners();
  sendResponse({});
});

const removeGABTabListeners = function (saveState) {
  gabQuestion.removeGABTabListeners(saveState);
};
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.command !== 'removeGABTabListeners' || !message.saveState) {
    return;
  }
  gabQuestion.removeGABTabListeners(message.saveState);
  sendResponse({});
});

// INFO ABOUT CURRENT PAGE

const ytChannelNamePages = new Map();

// Returns true if the url cannot be blocked
const pageIsUnblockable = function (url) {
  if (!url) { // Protect against empty URLs - e.g. Safari empty/bookmarks/top sites page
    return true;
  }
  let scheme = '';
  if (!url.protocol) {
    scheme = parseUri(url).protocol;
  } else {
    scheme = url.protocol;
  }

  return (scheme !== 'http:' && scheme !== 'https:' && scheme !== 'feed:');
};

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
const getCurrentTabInfo = function (callback, secondTime) {
  try {
    chrome.tabs.query({
      active: true,
      lastFocusedWindow: true,
    }).then((tabs) => {
      try {
        if (tabs.length === 0) {
          return; // For example: only the background devtools or a popup are opened
        }
        const tab = tabs[0];

        if (tab && !tab.url) {
          // Issue 6877: tab URL is not set directly after you opened a window
          // using window.open()
          if (!secondTime) {
            window.setTimeout(() => {
              getCurrentTabInfo(callback, true);
            }, 250);
          }

          return;
        }
        try {
          const page = new ext.Page(tab);
          const disabledSite = pageIsUnblockable(page.url.href);

          const result = {
            page,
            tab,
            disabledSite,
            settings: getSettings(),
          };

          if (!disabledSite) {
            result.whitelisted = checkWhitelisted(page);
          }
          if (
            getSettings().youtube_channel_whitelist
            && parseUri(tab.url).hostname === 'www.youtube.com'
          ) {
            result.youTubeChannelName = ytChannelNamePages.get(page.id);
            // handle the odd occurence of when the  YT Channel Name
            // isn't available in the ytChannelNamePages map
            // obtain the channel name from the URL
            // for instance, when the forward / back button is clicked
            if (!result.youTubeChannelName && /ab_channel/.test(tab.url)) {
              result.youTubeChannelName = parseUri.parseSearch(tab.url).ab_channel;
            }
          }
          callback(result);
        } catch (err) {
          callback({ errorStr: err.toString(), stack: err.stack, message: err.message });
        }
      } catch (err) {
        callback({ errorStr: err.toString(), stack: err.stack, message: err.message });
      }
    });
  } catch (err) {
    callback({ errorStr: err.toString(), stack: err.stack, message: err.message });
  }
};

// Returns true if the page is whitelisted.
// Called from a content script
const pageIsWhitelisted = function (sender) {
  const whitelisted = checkWhitelisted(sender.page);
  return (whitelisted !== undefined && whitelisted !== null);
};
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.command !== 'pageIsWhitelisted') {
    return;
  }
  sendResponse({ response: pageIsWhitelisted(sender) });
});

const parseFilter = function (filterText) {
  let filter = null;
  let error = null;
  const text = Filter.normalize(filterText);
  if (text) {
    if (text[0] === '[') {
      error = 'unexpected_filter_list_header';
    } else {
      filter = Filter.fromText(text);
      if (filter instanceof InvalidFilter) {
        error = filter.reason;
      }
    }
  }
  return { filter, error };
};
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.command !== 'parseFilter' || !message.filterTextToParse) {
    return;
  }
  sendResponse(parseFilter(message.filterTextToParse));
});

const pausedKey = 'paused';
// white-list all blocking requests regardless of frame / document, but still allows element hiding
const pausedFilterText1 = '@@';
// white-list all documents, which prevents element hiding
const pausedFilterText2 = '@@*$document';

// Get or set if AdBlock is paused
// Inputs: newValue (optional boolean): if true, AdBlock will be paused, if
// false, AdBlock will not be paused.
// Returns: undefined if newValue was specified, otherwise it returns true
// if paused, false otherwise.
const adblockIsPaused = function (newValue) {
  if (newValue === undefined) {
    return (sessionStorageGet(pausedKey) === true);
  }

  // Add a filter to white list every page.
  const result1 = parseFilter(pausedFilterText1);
  const result2 = parseFilter(pausedFilterText2);
  if (newValue === true) {
    filterStorage.addFilter(result1.filter);
    filterStorage.addFilter(result2.filter);
    chromeStorageSetHelper(pausedKey, true);
  } else {
    filterStorage.removeFilter(result1.filter);
    filterStorage.removeFilter(result2.filter);
    chrome.storage.local.remove(pausedKey);
  }
  sessionStorageSet(pausedKey, newValue);
  return undefined;
};

const domainPausedKey = 'domainPaused';

// Helper that saves the domain pauses
// Inputs:  domainPauses (required object): domain pauses to save
// Returns: undefined
const saveDomainPauses = function (domainPauses) {
  chromeStorageSetHelper(domainPausedKey, domainPauses);
  sessionStorageSet(domainPausedKey, domainPauses);
};

// Helper that removes any domain pause filter rules based on tab events
// Inputs:  tabId (required integer): identifier for the affected tab
//          newDomain (optional string): the current domain of the tab
// Returns: undefined
const domainPauseChangeHelper = function (tabId, newDomain) {
  // get stored domain pauses
  const storedDomainPauses = sessionStorageGet(domainPausedKey);

  // check if any of the stored domain pauses match the affected tab
  for (const aDomain in storedDomainPauses) {
    if (storedDomainPauses[aDomain] === tabId && aDomain !== newDomain) {
      // Remove the filter that white-listed the domain
      const result = parseFilter(`@@${aDomain}$document`);
      filterStorage.removeFilter(result.filter);
      delete storedDomainPauses[aDomain];

      // save updated domain pauses
      saveDomainPauses(storedDomainPauses);
    }
  }
  updateButtonUIAndContextMenus();
};

// Handle the effects of a tab update event on any existing domain pauses
// Inputs:  tabId (required integer): identifier for the affected tab
//          changeInfo (required object with a url property): contains the
// new url for the tab
//          tab (optional Tab object): the affected tab
// Returns: undefined
const domainPauseNavigationHandler = function (tabId, changeInfo) {
  if (changeInfo === undefined || changeInfo.url === undefined || tabId === undefined) {
    return;
  }

  const newDomain = parseUri(changeInfo.url).host;

  domainPauseChangeHelper(tabId, newDomain);
};

// Handle the effects of a tab remove event on any existing domain pauses
// Inputs:  tabId (required integer): identifier for the affected tab
//          changeInfo (optional object): info about the remove event
// Returns: undefined
const domainPauseClosedTabHandler = function (tabId) {
  if (tabId === undefined) {
    return;
  }

  domainPauseChangeHelper(tabId);
};

// Get or set if AdBlock is domain paused for the domain of the specified tab
// Inputs:  activeTab (optional object with url and id properties): the paused tab
//          newValue (optional boolean): if true, AdBlock will be domain paused
// on the tab's domain, if false, AdBlock will not be domain paused on that domain.
// Returns: undefined if activeTab and newValue were specified; otherwise if activeTab
// is specified it returns true if domain paused, false otherwise; finally it returns
// the complete storedDomainPauses if activeTab is not specified

const adblockIsDomainPaused = function (activeTab, newValue) {
  // get stored domain pauses
  let storedDomainPauses = sessionStorageGet(domainPausedKey);

  // return the complete list of stored domain pauses if activeTab is undefined
  if (activeTab === undefined) {
    return storedDomainPauses;
  }

  // return a boolean indicating whether the domain is paused if newValue is undefined
  const activeDomain = parseUri(activeTab.url).host;
  if (newValue === undefined) {
    if (storedDomainPauses) {
      return Object.prototype.hasOwnProperty.call(storedDomainPauses, activeDomain);
    }
    return false;
  }

  // create storedDomainPauses object if needed
  if (!storedDomainPauses) {
    storedDomainPauses = {};
  }

  // set or delete a domain pause
  const result = parseFilter(`@@${activeDomain}$document`);
  if (newValue === true) {
    // add a domain pause
    filterStorage.addFilter(result.filter);
    storedDomainPauses[activeDomain] = activeTab.id;
    chrome.tabs.onUpdated.removeListener(domainPauseNavigationHandler);
    chrome.tabs.onRemoved.removeListener(domainPauseClosedTabHandler);
    chrome.tabs.onUpdated.addListener(domainPauseNavigationHandler);
    chrome.tabs.onRemoved.addListener(domainPauseClosedTabHandler);
  } else {
    // remove the domain pause
    filterStorage.removeFilter(result.filter);
    delete storedDomainPauses[activeDomain];
  }

  // save the updated list of domain pauses
  saveDomainPauses(storedDomainPauses);
  return undefined;
};

// If AdBlock was paused on shutdown (adblock_is_paused is true), then
// unpause / remove the white-list all entry at startup.
chrome.storage.local.get(pausedKey).then((response) => {
  if (response[pausedKey]) {
    const pauseHandler = function () {
      filterNotifier.off('load', pauseHandler);
      const result1 = parseFilter(pausedFilterText1);
      const result2 = parseFilter(pausedFilterText2);
      filterStorage.removeFilter(result1.filter);
      filterStorage.removeFilter(result2.filter);
      chrome.storage.local.remove(pausedKey);
    };

    filterNotifier.on('load', pauseHandler);
  }
});

// If AdBlock was domain paused on shutdown, then unpause / remove
// all domain pause white-list entries at startup.
chrome.storage.local.get(domainPausedKey).then((response) => {
  try {
    const storedDomainPauses = response[domainPausedKey];
    if (!jQuery.isEmptyObject(storedDomainPauses)) {
      const domainPauseHandler = function () {
        filterNotifier.off('load', domainPauseHandler);
        for (const aDomain in storedDomainPauses) {
          const result = parseFilter(`@@${aDomain}$document`);
          filterStorage.removeFilter(result.filter);
        }
        chrome.storage.local.remove(domainPausedKey);
      };
      filterNotifier.on('load', domainPauseHandler);
    }
  } catch (err) {
    // do nothing
  }
});

chrome.commands.onCommand.addListener((command) => {
  if (command === 'toggle_pause') {
    adblockIsPaused(!adblockIsPaused());
    recordGeneralMessage('pause_shortcut_used');
  }
});

// Return the contents of a local file.
// Inputs: file:string - the file relative address, eg "js/foo.js".
// Returns: the content of the file.
const readfile = function (file) {
  // A bug in jquery prevents local files from being read, so use XHR.
  const xhr = new XMLHttpRequest();
  xhr.open('GET', chrome.runtime.getURL(file), false);
  xhr.send();
  return xhr.responseText;
};

// BETA CODE
if (chrome.runtime.id === 'pljaalgmajnlogcgiohkhdmgpomjcihk') {
  // Display beta page after each update for beta-users only
  chrome.runtime.onInstalled.addListener((details) => {
    if (details.reason === 'update' || details.reason === 'install') {
      chrome.tabs.create({ url: 'https://getadblock.com/beta' });
    }
  });
}

const updateStorageKey = 'last_known_version';
// Commented out only during /update releases
// chrome.runtime.onInstalled.addListener((details) => {
//   if (details.reason === 'update' || details.reason === 'install') {
//     localStorage.setItem(updateStorageKey, chrome.runtime.getManifest().version);
//   }
// });

const openTab = function (url) {
  chrome.tabs.create({ url });
};

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.command !== 'openTab' || !message.urlToOpen) {
    return;
  }
  openTab(message.urlToOpen);
  sendResponse({});
});

if (chrome.runtime.id) {
  let updateTabRetryCount = 0;
  const getUpdatedURL = function () {
    const encodedVersion = encodeURIComponent('3.60.0');
    let updatedURL = `https://getadblock.com/update/${encodedVersion}/?u=${STATS.userId()}`;
    updatedURL = `${updatedURL}&bc=${Prefs.blocked_total}`;
    updatedURL = `${updatedURL}&rt=${updateTabRetryCount}`;
    return updatedURL;
  };
  const waitForUserAction = function () {
    chrome.tabs.onCreated.removeListener(waitForUserAction);
    setTimeout(() => {
      updateTabRetryCount += 1;
      // eslint-disable-next-line no-use-before-define
      openUpdatedPage();
    }, 10000); // 10 seconds
  };
  const openUpdatedPage = function () {
    const updatedURL = getUpdatedURL();
    chrome.tabs.create({ url: updatedURL }).then((tab) => {
      // if we couldn't open a tab to '/updated_tab', send a message
      if (!tab) {
        recordErrorMessage('updated_tab_failed_to_open');
        chrome.tabs.onCreated.removeListener(waitForUserAction);
        chrome.tabs.onCreated.addListener(waitForUserAction);
        return;
      }
      if (updateTabRetryCount > 0) {
        recordGeneralMessage(`updated_tab_retry_success_count_${updateTabRetryCount}`);
      }
    }).catch(() => {
      // if we couldn't open a tab to '/updated_tab', send a message
      recordErrorMessage('updated_tab_failed_to_open');
      chrome.tabs.onCreated.removeListener(waitForUserAction);
      chrome.tabs.onCreated.addListener(waitForUserAction);
    });
  };
  const shouldShowUpdate = function () {
    const checkQueryState = function () {
      chrome.idle.queryState(60, (state) => {
        if (state === 'active') {
          openUpdatedPage();
        } else {
          chrome.tabs.onCreated.removeListener(waitForUserAction);
          chrome.tabs.onCreated.addListener(waitForUserAction);
        }
      });
    };
    if (chrome.management && chrome.management.getSelf) {
      chrome.management.getSelf((extensionInfo) => {
        if (extensionInfo && extensionInfo.installType !== 'admin') {
          checkQueryState();
        } else if (extensionInfo && extensionInfo.installType === 'admin') {
          recordGeneralMessage('update_tab_not_shown_admin_user');
        }
      });
    } else {
      checkQueryState();
    }
  };
  const slashUpdateReleases = ['3.60.0', '3.61.0', '3.61.1', '3.62.0', '4.0.0', '4.0.1', '4.0.2', '4.1.0', '4.2.0'];

  // Display updated page after each updat
  chrome.runtime.onInstalled.addListener((details) => {
    const lastKnownVersion = localStorage.getItem(updateStorageKey);
    const currentVersion = chrome.runtime.getManifest().version;
    if (
      details.reason === 'update'
      && slashUpdateReleases.includes(currentVersion)
      && !slashUpdateReleases.includes(lastKnownVersion)
      && chrome.runtime.id !== 'pljaalgmajnlogcgiohkhdmgpomjcihk'
    ) {
      STATS.untilLoaded(() => {
        Prefs.untilLoaded.then(shouldShowUpdate);
      });
    }
    if (details.reason === 'update') {
      STATS.untilLoaded(() => {
        recordGeneralMessage('extension_updated');
      });
    }
    localStorage.setItem(updateStorageKey, currentVersion);
  });
}

// Creates a custom filter entry that whitelists a YouTube channel
// Inputs: url:string url of the page
// Returns: null if successful, otherwise an exception
const createWhitelistFilterForYoutubeChannel = function (url) {
  let ytChannel;
  if (/ab_channel=/.test(url)) {
    [, ytChannel] = url.match(/ab_channel=([^]*)/);
  } else {
    ytChannel = url.split('/').pop();
  }
  if (ytChannel) {
    const filter = `@@|https://www.youtube.com/*${ytChannel}|$document`;
    return addCustomFilter(filter);
  }
  return undefined;
};

// YouTube Channel Whitelist
const runChannelWhitelist = function (tabUrl, tabId) {
  if (
    getSettings().youtube_channel_whitelist
    && parseUri(tabUrl).hostname === 'www.youtube.com'
    && !parseUri.parseSearch(tabUrl).ab_channel
  ) {
    // if a channel name isn't stored for that tab id,
    // then we probably haven't inject the content script, so we shall
    chrome.tabs.sendMessage(tabId, { message: 'ping_yt_content_script' }).then((response) => {
      const resp = response || {};
      if (resp.status !== 'yes') {
        chrome.tabs.executeScript(tabId, {
          file: 'adblock-ytchannel.js',
          runAt: 'document_start',
        });
      }
    }).catch(() => {
      chrome.tabs.executeScript(tabId, {
        file: 'adblock-ytchannel.js',
        runAt: 'document_start',
      });
    });
  }
};

const ytChannelOnCreatedListener = function (tab) {
  if (chrome.runtime.lastError) {
    return;
  }
  chrome.tabs.get(tab.id).then((tabs) => {
    if (chrome.runtime.lastError) {
      return;
    }
    if (tabs && tabs.url && tabs.id) {
      runChannelWhitelist(tabs.url, tabs.id);
    }
  });
};

const ytChannelOnUpdatedListener = function (tabId, changeInfo, tab) {
  if (chrome.runtime.lastError) {
    return;
  }
  if (!getSettings().youtube_channel_whitelist) {
    return;
  }
  if (changeInfo.status === 'loading' && changeInfo.url) {
    if (chrome.runtime.lastError) {
      return;
    }
    chrome.tabs.get(tabId).then((tabs) => {
      if (tabs && tabs.url && tabs.id) {
        runChannelWhitelist(tabs.url, tabs.id);
      }
    });
  }
  if (ytChannelNamePages.get(tabId) && parseUri(tab.url).hostname !== 'www.youtube.com') {
    ytChannelNamePages.delete(tabId);
  }
};

const ytChannelOnRemovedListener = function (tabId) {
  if (!getSettings().youtube_channel_whitelist) {
    return;
  }
  ytChannelNamePages.delete(tabId);
};

// On single page sites, such as YouTube, that update the URL using the History API pushState(),
// they don't actually load a new page, we need to get notified when this happens
// and update the URLs in the Page and Frame objects
const youTubeHistoryStateUpdateHandler = function (details) {
  if (details
      && Object.prototype.hasOwnProperty.call(details, 'frameId')
      && Object.prototype.hasOwnProperty.call(details, 'tabId')
      && Object.prototype.hasOwnProperty.call(details, 'url')
      && details.transitionType === 'link') {
    const myURL = new URL(details.url);
    if (myURL.hostname === 'www.youtube.com') {
      const myFrame = ext.getFrame(details.tabId, details.frameId);
      const myPage = ext.getPage(details.tabId);
      myPage._url = myURL;
      myFrame.url = myURL;
      myFrame._url = myURL;
      if (!/ab_channel/.test(details.url) && myURL.pathname === '/watch') {
        chrome.tabs.sendMessage(details.tabId, { command: 'updateURLWithYouTubeChannelName' });
      } else if (/ab_channel/.test(details.url) && myURL.pathname !== '/watch') {
        chrome.tabs.sendMessage(details.tabId, { command: 'removeYouTubeChannelName' });
      }
    }
  }
};

const addYTChannelListeners = function () {
  chrome.tabs.onCreated.addListener(ytChannelOnCreatedListener);
  chrome.tabs.onUpdated.addListener(ytChannelOnUpdatedListener);
  chrome.tabs.onRemoved.addListener(ytChannelOnRemovedListener);
  chrome.webNavigation.onHistoryStateUpdated.addListener(youTubeHistoryStateUpdateHandler);
};

const removeYTChannelListeners = function () {
  chrome.tabs.onCreated.removeListener(ytChannelOnCreatedListener);
  chrome.tabs.onUpdated.removeListener(ytChannelOnUpdatedListener);
  chrome.tabs.onRemoved.removeListener(ytChannelOnRemovedListener);
  chrome.webNavigation.onHistoryStateUpdated.removeListener(youTubeHistoryStateUpdateHandler);
};

settings.onload().then(() => {
  if (getSettings().youtube_channel_whitelist) {
    addYTChannelListeners();
  }
});

let previousYTchannelId = '';
const previousYTvideoId = '';
let previousYTuserId = '';

// Listen for the message from the ytchannel.js content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.command === 'updateYouTubeChannelName' && message.channelName) {
    ytChannelNamePages.set(sender.tab.id, message.channelName);
    sendResponse({});
    return;
  }
  if (message.command === 'get_channel_name_by_channel_id' && message.channelId) {
    if (previousYTchannelId !== message.channelId) {
      previousYTchannelId = message.channelId;
      const xhr = new XMLHttpRequest();
      const { channelId } = message;
      const key = atob('QUl6YVN5QzJKMG5lbkhJZ083amZaUUYwaVdaN3BKd3dsMFczdUlz');
      const url = 'https://www.googleapis.com/youtube/v3/channels';
      xhr.open('GET', `${url}?part=snippet&id=${channelId}&key=${key}`);
      xhr.onload = function xhrOnload() {
        if (xhr.readyState === 4 && xhr.status === 200) {
          const json = JSON.parse(xhr.response);
          // Got name of the channel
          if (json && json.items && json.items[0]) {
            const channelName = json.items[0].snippet.title;
            ytChannelNamePages.set(sender.tab.id, channelName);
            chrome.tabs.sendMessage(sender.tab.id, {
              command: 'updateURLWithYouTubeChannelName',
              channelName,
            });
          }
        }
      };
      xhr.send();
      sendResponse({});
      return;
    }
    chrome.tabs.sendMessage(sender.tab.id, {
      command: 'updateURLWithYouTubeChannelName',
      channelName: ytChannelNamePages.get(sender.tab.id),
    });
    sendResponse({});
    return;
  }
  if (message.command === 'get_channel_name_by_user_id' && message.userId) {
    if (previousYTuserId !== message.userId) {
      previousYTuserId = message.userId;
      const xhr = new XMLHttpRequest();
      const { userId } = message;
      const key = atob('QUl6YVN5QzJKMG5lbkhJZ083amZaUUYwaVdaN3BKd3dsMFczdUlz');
      const url = 'https://www.googleapis.com/youtube/v3/channels';
      xhr.open('GET', `${url}?part=snippet&forUsername=${userId}&key=${key}`);
      xhr.onload = function xhrOnload() {
        if (xhr.readyState === 4 && xhr.status === 200) {
          const json = JSON.parse(xhr.response);
          // Got name of the channel
          if (json && json.items && json.items[0]) {
            const channelName = json.items[0].snippet.title;
            ytChannelNamePages.set(sender.tab.id, channelName);
            chrome.tabs.sendMessage(sender.tab.id, {
              command: 'updateURLWithYouTubeChannelName',
              channelName,
            });
          }
        }
      };
      xhr.send();
      sendResponse({});
    } else {
      chrome.tabs.sendMessage(sender.tab.id, {
        command: 'updateURLWithYouTubeChannelName',
        channelName: ytChannelNamePages.get(sender.tab.id),
      });
      sendResponse({});
    }
  }
});


// These functions are usually only called by content scripts.

// DEBUG INFO

// Get debug info as a JSON object for bug reporting and ad reporting
const getDebugInfo = function (callback) {
  const response = {};
  response.otherInfo = {};

  // Is this installed build of AdBlock the official one?
  if (chrome.runtime.id === 'pljaalgmajnlogcgiohkhdmgpomjcihk') {
    response.otherInfo.buildtype = ' Beta';
  } else if (chrome.runtime.id === 'gighmmpiobklfepjocnamgkkbiglidom'
            || chrome.runtime.id === 'aobdicepooefnbaeokijohmhjlleamfj') {
    response.otherInfo.buildtype = ' Stable';
  } else {
    response.otherInfo.buildtype = ' Unofficial';
  }

  // Get AdBlock version
  response.otherInfo.version = chrome.runtime.getManifest().version;

  // Get subscribed filter lists
  const subscriptionInfo = {};
  const subscriptions = getSubscriptionsMinusText();
  for (const id in subscriptions) {
    if (subscriptions[id].subscribed) {
      subscriptionInfo[id] = {};
      subscriptionInfo[id].lastSuccess = new Date(subscriptions[id].lastSuccess * 1000);
      subscriptionInfo[id].lastDownload = new Date(subscriptions[id].lastDownload * 1000);
      subscriptionInfo[id].downloadCount = subscriptions[id].downloadCount;
      subscriptionInfo[id].downloadStatus = subscriptions[id].downloadStatus;
    }
  }

  response.subscriptions = subscriptionInfo;

  const userFilters = getUserFilters();
  if (userFilters && userFilters.length) {
    response.customFilters = userFilters.join('\n');
  }

  // Get settings
  const adblockSettings = {};
  const settings = getSettings();
  for (const setting in settings) {
    adblockSettings[setting] = JSON.stringify(settings[setting]);
  }

  response.settings = adblockSettings;
  response.prefs = JSON.stringify(Prefs);
  response.otherInfo.browser = STATS.browser;
  response.otherInfo.browserVersion = STATS.browserVersion;
  response.otherInfo.osVersion = STATS.osVersion;
  response.otherInfo.os = STATS.os;
  if (window.blockCounts) {
    response.otherInfo.blockCounts = blockCounts.get();
  }
  if (localStorage && localStorage.length) {
    response.otherInfo.localStorageInfo = {};
    response.otherInfo.localStorageInfo.length = localStorage.length;
    let inx = 1;
    for (const key in localStorage) {
      response.otherInfo.localStorageInfo[`key${inx}`] = key;
      inx += 1;
    }
    // Temporarly add Edge migration logs to debug data
    const edgeMigrationLogs = storageGet('migrateLogMessageKey') || [];
    if (edgeMigrationLogs || edgeMigrationLogs.length) {
      response.otherInfo.edgeMigrationLogs = Object.assign({}, edgeMigrationLogs);
    }
  } else {
    response.otherInfo.localStorageInfo = 'no data';
  }
  response.otherInfo.isAdblockPaused = adblockIsPaused();
  response.otherInfo.licenseState = License.get().status;
  response.otherInfo.licenseVersion = License.get().lv;

  // Get total pings
  chrome.storage.local.get('total_pings').then((storageResponse) => {
    response.otherInfo.totalPings = storageResponse.totalPings || 0;

    // Now, add exclude filters (if there are any)
    const excludeFiltersKey = 'exclude_filters';
    chrome.storage.local.get(excludeFiltersKey).then((secondResponse) => {
      if (secondResponse && secondResponse[excludeFiltersKey]) {
        response.excludedFilters = secondResponse[excludeFiltersKey];
      }
      // Now, add JavaScript exception error (if there is one)
      const errorKey = 'errorkey';
      chrome.storage.local.get(errorKey).then((errorResponse) => {
        if (errorResponse && errorResponse[errorKey]) {
          response.otherInfo[errorKey] = errorResponse[errorKey];
        }
        // Now, add the migration messages (if there are any)
        const migrateLogMessageKey = 'migrateLogMessageKey';
        chrome.storage.local.get(migrateLogMessageKey).then((migrateLogMessageResponse) => {
          if (migrateLogMessageResponse && migrateLogMessageResponse[migrateLogMessageKey]) {
            const messages = migrateLogMessageResponse[migrateLogMessageKey].split('\n');
            for (let i = 0; i < messages.length; i++) {
              const key = `migration_message_${i}`;
              response.otherInfo[key] = messages[i];
            }
          }
          if (License.isActiveLicense()) {
            response.otherInfo.licenseInfo = {};
            response.otherInfo.licenseInfo.extensionGUID = STATS.userId();
            response.otherInfo.licenseInfo.licenseId = License.get().licenseId;
            if (getSettings().sync_settings) {
              response.otherInfo.syncInfo = {};
              response.otherInfo.syncInfo.SyncCommitVersion = SyncService.getCommitVersion();
              response.otherInfo.syncInfo.SyncCommitName = SyncService.getCurrentExtensionName();
              response.otherInfo.syncInfo.SyncCommitLog = SyncService.getSyncLog();
            }
            chrome.alarms.getAll((alarms) => {
              if (alarms && alarms.length > 0) {
                response.otherInfo['Alarm info'] = `length: ${alarms.length}`;
                for (let i = 0; i < alarms.length; i++) {
                  const alarm = alarms[i];
                  response.otherInfo[`${i} Alarm Name`] = alarm.name;
                  response.otherInfo[`${i} Alarm Scheduled Time`] = new Date(alarm.scheduledTime);
                }
              } else {
                response.otherInfo['No alarm info'] = 'No alarm info';
              }
              License.getLicenseInstallationDate((installdate) => {
                response.otherInfo['License Installation Date'] = installdate;
                if (typeof callback === 'function') {
                  callback(response);
                }
              });
            });
          } else if (typeof callback === 'function') { // License is not active
            callback(response);
          }
        });
      });
    });
  });
};

// Called when user explicitly requests filter list updates
function updateFilterLists() {
  for (const subscription of filterStorage.subscriptions()) {
    if (subscription instanceof DownloadableSubscription) {
      synchronizer.execute(subscription, true, true);
    }
  }
}

// Checks if the filter lists are currently in the process of
// updating and if there were errors the last time they were
// updated
function checkUpdateProgress() {
  let inProgress = false;
  let filterError = false;
  for (const subscription of filterStorage.subscriptions()) {
    if (synchronizer.isExecuting(subscription.url)) {
      inProgress = true;
    } else if (subscription.downloadStatus && subscription.downloadStatus !== 'synchronize_ok') {
      filterError = true;
    }
  }
  return { inProgress, filterError };
}

STATS.untilLoaded(() => {
  STATS.startPinging();
  uninstallInit();
});

// Create the "blockage stats" for the uninstall logic ...
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    chrome.storage.local.get('blockage_stats').then((response) => {
      const { blockage_stats } = response;
      if (!blockage_stats) {
        const data = {};
        data.start = Date.now();
        data.version = 1;
        chromeStorageSetHelper('blockage_stats', data);
      }
    });
  }
});

// AdBlock Protect integration
//
// Check the response from a ping to see if it contains valid show AdBlock Protect
// enrollment instructions. If so, set the "show_protect_enrollment" setting
// if an empty / zero length string is returned, and a user was previously enrolled then
// set "show_protect_enrollment" to false
// Inputs:
//   responseData: string response from a ping
function checkPingResponseForProtect(responseData) {
  let pingData;

  if (responseData.length === 0 || responseData.trim().length === 0) {
    if (getSettings().show_protect_enrollment) {
      setSetting('show_protect_enrollment', false);
    }
    return;
  }
  // if the user has clicked the Protect CTA, which sets the |show_protect_enrollment| to false
  // then don't re-enroll them, even if the ping server has a show_protect_enrollment = true.
  if (getSettings().show_protect_enrollment === false) {
    return;
  }
  try {
    pingData = JSON.parse(responseData);
  } catch (e) {
    // eslint-disable-next-line no-console
    console.log('Something went wrong with parsing survey data.');
    // eslint-disable-next-line no-console
    console.log('error', e);
    // eslint-disable-next-line no-console
    console.log('response data', responseData);
    return;
  }
  if (!pingData) {
    return;
  }
  if (typeof pingData.protect_enrollment === 'boolean') {
    setSetting('show_protect_enrollment', pingData.protect_enrollment);
  }
}

function isAcceptableAds(filterList) {
  if (!filterList) {
    return undefined;
  }
  return filterList.id === 'acceptable_ads';
}

function isAcceptableAdsPrivacy(filterList) {
  if (!filterList) {
    return undefined;
  }
  return filterList.id === 'acceptable_ads_privacy';
}

// Attach methods to window
Object.assign(window, {
  adblockIsPaused,
  createPageWhitelistFilter,
  getUserFilters,
  updateFilterLists,
  checkUpdateProgress,
  getDebugInfo,
  createWhitelistFilterForYoutubeChannel,
  openTab,
  readfile,
  saveDomainPauses,
  adblockIsDomainPaused,
  pageIsWhitelisted,
  pageIsUnblockable,
  getCurrentTabInfo,
  getAdblockUserId,
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
  addYTChannelListeners,
  removeYTChannelListeners,
  ytChannelNamePages,
  checkPingResponseForProtect,
  pausedFilterText1,
  pausedFilterText2,
  isLanguageSpecific,
  isAcceptableAds,
  isAcceptableAdsPrivacy,
  parseFilter,
});


/***/ }),
/* 68 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


/* For ESLint: List any global identifiers used in this file below */
/* global chrome, require, ext, exports, chromeStorageSetHelper, getSettings, adblockIsPaused,
   adblockIsDomainPaused, filterStorage, Filter, parseUri, settings, getAllSubscriptionsMinusText,
   getUserFilters, Utils */

const { extractHostFromFrame } = __webpack_require__(8);
const { ElemHideFilter } = __webpack_require__(0);
const { filterNotifier } = __webpack_require__(1);
const { port } = __webpack_require__(7);
const { postFilterStatsToLogServer } = __webpack_require__(14).ServerMessages;
const info = __webpack_require__(3);
const { idleHandler } = __webpack_require__(69);

const DataCollectionV2 = (function getDataCollectionV2() {
  const HOUR_IN_MS = 1000 * 60 * 60;
  const TIME_LAST_PUSH_KEY = 'timeLastPush';

  // Setup memory cache
  let dataCollectionCache = {};
  dataCollectionCache.filters = {};
  dataCollectionCache.domains = {};

  const handleTabUpdated = function (tabId, changeInfo, tabInfo) {
    if (chrome.runtime.lastError) {
      return;
    }
    if (!tabInfo || !tabInfo.url || !tabInfo.url.startsWith('http')) {
      return;
    }
    if (
      getSettings().data_collection_v2
      && !adblockIsPaused()
      && !adblockIsDomainPaused({ url: tabInfo.url, id: tabId })
      && changeInfo.status === 'complete'
    ) {
      chrome.tabs.executeScript(tabId,
        {
          file: 'adblock-datacollection-contentscript.js',
          allFrames: true,
        });
    }
  };

  const addFilterToCache = function (filter, page) {
    const validFilterText = filter && filter.text && (typeof filter.text === 'string');
    if (validFilterText && page && page.url && page.url.hostname) {
      const domain = page.url.hostname;
      if (!domain) {
        return;
      }
      const { text } = filter;

      if (!(text in dataCollectionCache.filters)) {
        dataCollectionCache.filters[text] = {};
        dataCollectionCache.filters[text].firstParty = {};
        dataCollectionCache.filters[text].thirdParty = {};
        dataCollectionCache.filters[text].subscriptions = [];
      }
      if (filter.thirdParty) {
        if (!dataCollectionCache.filters[text].thirdParty[domain]) {
          dataCollectionCache.filters[text].thirdParty[domain] = {};
          dataCollectionCache.filters[text].thirdParty[domain].hits = 0;
        }
        dataCollectionCache.filters[text].thirdParty[domain].hits += 1;
      } else {
        if (!dataCollectionCache.filters[text].firstParty[domain]) {
          dataCollectionCache.filters[text].firstParty[domain] = {};
          dataCollectionCache.filters[text].firstParty[domain].hits = 0;
        }
        dataCollectionCache.filters[text].firstParty[domain].hits += 1;
      }
      for (const sub of filterStorage.subscriptions(text)) {
        const dataCollectionSubscriptions = dataCollectionCache.filters[text].subscriptions;
        if (!sub.disabled && sub.url && dataCollectionSubscriptions.indexOf(sub.url) === -1) {
          dataCollectionCache.filters[text].subscriptions.push(sub.url);
        }
      }
    }
  };

  const addMessageListener = function () {
    port.on('datacollection.elementHide', (message, sender) => {
      const dataCollectionEnabled = getSettings().data_collection_v2;
      const domainInfo = { url: sender.page.url, id: sender.page.id };
      if (dataCollectionEnabled && !adblockIsPaused() && !adblockIsDomainPaused(domainInfo)) {
        const { selectors } = message;
        const docDomain = extractHostFromFrame(sender.frame);
        for (const subscription of filterStorage.subscriptions()) {
          if (!subscription.disabled) {
            for (const text of subscription.filterText()) {
              const filter = Filter.fromText(text);
              // We only know the exact filter in case of element hiding emulation.
              // For regular element hiding filters, the content script only knows
              // the selector, so we have to find a filter that has an identical
              // selector and is active on the domain the match was reported from.
              const isActiveElemHideFilter = filter instanceof ElemHideFilter
                                           && selectors.includes(filter.selector)
                                           && filter.isActiveOnDomain(docDomain);
              if (isActiveElemHideFilter) {
                addFilterToCache(filter, sender.page);
              }
            }
          }
        }
      }
    });
    port.on('datacollection.exceptionElementHide', (message, sender) => {
      const domainInfo = { url: sender.page.url, id: sender.page.id };
      if (
        getSettings().data_collection_v2
          && !adblockIsPaused()
          && !adblockIsDomainPaused(domainInfo)) {
        const selectors = message.exceptions;
        for (const text of selectors) {
          const filter = Filter.fromText(text);
          addFilterToCache(filter, sender.page);
        }
      }
    });
  };

  const webRequestListener = function (details) {
    if (details.url && details.type === 'main_frame' && !adblockIsPaused() && !adblockIsDomainPaused({ url: details.url, id: details.id })) {
      const domain = parseUri(details.url).host;
      if (!dataCollectionCache.domains[domain]) {
        dataCollectionCache.domains[domain] = {};
        dataCollectionCache.domains[domain].pages = 0;
      }
      dataCollectionCache.domains[domain].pages += 1;
    }
  };

  const filterListener = function (item, newValue, oldValue, tabIds) {
    if (getSettings().data_collection_v2 && !adblockIsPaused()) {
      for (const tabId of tabIds) {
        const page = new ext.Page({ id: tabId });
        if (page && !adblockIsDomainPaused({ url: page.url.href, id: page.id })) {
          addFilterToCache(item, page);
        }
      }
    } else if (!getSettings().data_collection_v2) {
      filterNotifier.off('filter.hitCount', filterListener);
    }
  };

  // If enabled at startup periodic saving of memory cache &
  // sending of data to the log server
  settings.onload().then(() => {
    const dataCollectionEnabled = getSettings().data_collection_v2;
    if (dataCollectionEnabled) {
      window.setInterval(() => {
        idleHandler.scheduleItemOnce(() => {
          if (dataCollectionEnabled && Object.keys(dataCollectionCache.filters).length > 0) {
            const subscribedSubs = [];
            const subs = getAllSubscriptionsMinusText();
            for (const id in subs) {
              if (subs[id].subscribed) {
                subscribedSubs.push(subs[id].url);
              }
            }
            if (getUserFilters().length) {
              subscribedSubs.push('customlist');
            }
            const data = {
              version: '5',
              addonName: info.addonName,
              addonVersion: info.addonVersion,
              application: info.application,
              applicationVersion: info.applicationVersion,
              platform: info.platform,
              platformVersion: info.platformVersion,
              appLocale: Utils.appLocale,
              filterListSubscriptions: subscribedSubs,
              domains: dataCollectionCache.domains,
              filters: dataCollectionCache.filters,
            };
            chrome.storage.local.get(TIME_LAST_PUSH_KEY).then((response) => {
              let timeLastPush = 'n/a';
              if (response[TIME_LAST_PUSH_KEY]) {
                const serverTimestamp = new Date(response[TIME_LAST_PUSH_KEY]);
                // Format the timeLastPush
                const yearStr = `${serverTimestamp.getUTCFullYear()}`;
                let monthStr = `${serverTimestamp.getUTCMonth() + 1}`;
                let dateStr = `${serverTimestamp.getUTCDate()}`;
                let hourStr = `${serverTimestamp.getUTCHours()}`;
                // round the minutes up to the nearest 10
                let minStr = `${Math.floor(serverTimestamp.getUTCMinutes() / 10) * 10}`;

                if (monthStr.length === 1) {
                  monthStr = `0${monthStr}`;
                }
                if (dateStr.length === 1) {
                  dateStr = `0${dateStr}`;
                }
                if (hourStr.length === 1) {
                  hourStr = `0${hourStr}`;
                }
                if (minStr.length === 1) {
                  minStr = `0${minStr}`;
                }
                if (minStr === '60') {
                  minStr = '00';
                }
                timeLastPush = `${yearStr}-${monthStr}-${dateStr} ${hourStr}:${minStr}:00`;
              }
              data.timeOfLastPush = timeLastPush;
              postFilterStatsToLogServer(data, (text, status, xhr) => {
                let nowTimestamp = (new Date()).toGMTString();
                if (xhr && typeof xhr.getResponseHeader === 'function') {
                  try {
                    if (xhr.getResponseHeader('Date')) {
                      nowTimestamp = xhr.getResponseHeader('Date');
                    }
                  } catch (e) {
                    nowTimestamp = (new Date()).toGMTString();
                  }
                }
                chromeStorageSetHelper(TIME_LAST_PUSH_KEY, nowTimestamp);
                // Reset memory cache
                dataCollectionCache = {};
                dataCollectionCache.filters = {};
                dataCollectionCache.domains = {};
              });
            }); // end of TIME_LAST_PUSH_KEY
          }
        });
      }, HOUR_IN_MS);
      filterNotifier.on('filter.hitCount', filterListener);
      chrome.webRequest.onBeforeRequest.addListener(webRequestListener, {
        urls: ['http://*/*', 'https://*/*'],
        types: ['main_frame'],
      });
      chrome.tabs.onUpdated.addListener(handleTabUpdated);
      addMessageListener();
    }
  });// End of then

  const returnObj = {};
  returnObj.start = function returnObjStart() {
    dataCollectionCache.filters = {};
    dataCollectionCache.domains = {};
    filterNotifier.on('filter.hitCount', filterListener);
    chrome.webRequest.onBeforeRequest.addListener(webRequestListener, {
      urls: ['http://*/*', 'https://*/*'],
      types: ['main_frame'],
    });
    chrome.tabs.onUpdated.addListener(handleTabUpdated);
    addMessageListener();
  };
  returnObj.end = function returnObjEnd() {
    dataCollectionCache = {};
    filterNotifier.off('filter.hitCount', filterListener);
    chrome.webRequest.onBeforeRequest.removeListener(webRequestListener);
    chrome.storage.local.remove(TIME_LAST_PUSH_KEY);
    chrome.tabs.onUpdated.removeListener(handleTabUpdated);
  };
  returnObj.getCache = function returnObjGetCache() {
    return dataCollectionCache;
  };

  return returnObj;
}());

exports.DataCollectionV2 = DataCollectionV2;


/***/ }),
/* 69 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


/* For ESLint: List any global identifiers used in this file below */
/* global chrome, exports, log */

// Schedules a function to be executed once when the computer is idle.
// Call idleHandler.scheduleItem to schedule a function for exection upon idle
// inputs: theFunction: function to be executed
//         seconds: maximum time to wait upon idle, in seconds. 600 if omitted.
const idleHandler = {
  scheduleItemOnce(callback, seconds) {
    // Schedule the item to be executed
    idleHandler.scheduledItems.push({
      callback,
      runAt: new Date(Date.now() + 1000 * (seconds || 600)),
    });
    if (!idleHandler.timer) {
      idleHandler.timer = window.setInterval(idleHandler.runIfIdle, 5000);
    }
  },
  timer: null,
  scheduledItems: [],
  runIfIdle() {
    // Checks if the browser is idle. If so, it executes all waiting functions
    // Otherwise, it checks if an item has waited longer than allowed, and
    // executes the ones who should be executed
    chrome.idle.queryState(15, (state) => {
      if (state === 'idle') {
        while (idleHandler.scheduledItems.length) {
          idleHandler.scheduledItems.shift().callback();
        }
      } else {
        const now = Date.now();
        // Inversed loop, to prevent splice() making it skip the item after an
        // executed item.
        for (let i = idleHandler.scheduledItems.length - 1; i >= 0; i--) {
          if (idleHandler.scheduledItems[i].runAt <= now) {
            idleHandler.scheduledItems.splice(i, 1)[0].callback();
          }
        }
      }
      if (!idleHandler.scheduledItems.length) {
        idleHandler.timer = window.clearInterval(idleHandler.timer);
      }
    });
  },
};

exports.idleHandler = idleHandler;


/***/ }),
/* 70 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


/* For ESLint: List any global identifiers used in this file below */
/* global require, exports, recommendations, Subscription
   DownloadableSubscription, chrome */

const { filterStorage } = __webpack_require__(5);
const subClasses = __webpack_require__(4);

if (subClasses) {
  this.Subscription = subClasses.Subscription;
  this.SpecialSubscription = subClasses.SpecialSubscription;
  this.DownloadableSubscription = subClasses.DownloadableSubscription;
}

// Adapters & helpers to add the legacy AB 'id' to the ABP subscriptions
// Also adds the 'language' and 'hidden' properties
const SubscriptionAdapter = (function getSubscriptionAdapter() {
  // Get the URL for the corresponding ID
  const getUrlFromId = function (searchID) {
    for (const subscription of recommendations()) {
      const { url, id } = subscription;
      if (searchID === id) {
        return url;
      }
    }
    return '';
  };

  // Get the ID for the corresponding URL
  const getIdFromURL = function (searchURL) {
    for (const subscription of recommendations()) {
      const { url, id } = subscription;
      if (searchURL === url) {
        return id;
      }
    }
    return null;
  };

  // determine if the specified filter list is language specific
  // returns the boolean language attribue (if found)
  //         false otherwise
  const isLanguageSpecific = function (searchID) {
    // check for EasyList, as it is a language-specific list (en), but
    // shouldn't be treated as such by the AdBlock code
    if (searchID === 'easylist') {
      return false;
    }

    for (const subscription of recommendations()) {
      const { id } = subscription;
      if (id === searchID) {
        return subscription.language;
      }
    }
    return false;
  };

  // Get the ID for the corresponding URL
  const getSubscriptionInfoFromURL = function (searchURL) {
    for (const subscription of recommendations()) {
      const { url } = subscription;
      if (searchURL === url) {
        return subscription;
      }
    }
    return null;
  };

  // Unsubcribe the user from the subscription specified in the arguement
  const unsubscribe = function (options) {
    const subscriptionUrl = getUrlFromId(options.id);
    if (subscriptionUrl !== '') {
      const subscription = Subscription.fromURL(subscriptionUrl);
      if (subscription) {
        filterStorage.removeSubscription(subscription);
      }
    }
  };

  // Get only the user's subscriptions with in the AB format
  // without the filter contents (text)
  const getSubscriptionsMinusText = function () {
    const result = {};
    for (const subscription of filterStorage.subscriptions()) {
      if (subscription instanceof DownloadableSubscription) {
        const tempSub = {};
        for (const attr in subscription) {
          // if the subscription has a 'URL' property use it to
          // add the other attributes (id, language, hidden)
          if (attr === 'url') {
            const subscriptionInfo = getSubscriptionInfoFromURL(subscription[attr]);
            if (subscriptionInfo && subscriptionInfo.url) {
              tempSub.id = subscriptionInfo.id;
              tempSub.languages = subscriptionInfo.languages;
              tempSub.language = subscriptionInfo.language;
              tempSub.type = subscriptionInfo.type;
              tempSub.homepage = subscriptionInfo.homepage;
              tempSub.title = subscriptionInfo.title;
              tempSub.hidden = subscriptionInfo.hidden;
            }
          }
          if (attr !== '_filterText') {
            tempSub[attr] = subscription[attr];
          }
        }
        // if the subscription doesn't have a 'id' property, use the 'URL' as an
        // 'id' property
        if (!tempSub.id || tempSub.id === undefined) {
          tempSub.id = `url:${subscription.url}`;
        }
        // Since FilterStorage.subscriptions only contains subscribed FilterLists,
        // add the 'subscribed' property
        tempSub.subscribed = true;
        result[tempSub.id] = tempSub;
      }
    }
    return result;
  };

  // Get all subscriptions in the AB format
  // without the filter contents (text)
  const getAllSubscriptionsMinusText = function () {
    const userSubs = getSubscriptionsMinusText();
    for (const subscription of recommendations()) {
      const {
        url, id, languages, language, type, title, homepage, hidden,
      } = subscription;
      if (!(id in userSubs)) {
        userSubs[id] = {};
        userSubs[id].subscribed = false;
        userSubs[id].id = id;
        userSubs[id].url = url;
        userSubs[id].userSubmitted = false;
        userSubs[id].language = language;
        userSubs[id].languages = languages;
        userSubs[id].hidden = hidden;
        userSubs[id].type = type;
        userSubs[id].title = title;
        userSubs[id].homepage = homepage;
      }
    }
    return userSubs;
  };
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.command !== 'unsubscribe' || !message.id) {
      return;
    }
    unsubscribe({ id: message.id });
    sendResponse({});
  });

  return {
    getSubscriptionInfoFromURL,
    getUrlFromId,
    unsubscribe,
    getSubscriptionsMinusText,
    getAllSubscriptionsMinusText,
    getIdFromURL,
    isLanguageSpecific,
  };
}());

exports.SubscriptionAdapter = SubscriptionAdapter;


/***/ }),
/* 71 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


/* For ESLint: List any global identifiers used in this file below */
/* global chrome, require, ext, adblockIsPaused, adblockIsDomainPaused
   recordGeneralMessage, log, License, reloadTab */

const { checkWhitelisted } = __webpack_require__(9);
const { filterNotifier } = __webpack_require__(1);
const { Prefs } = __webpack_require__(2);

const updateButtonUIAndContextMenus = function () {
  chrome.tabs.query({}).then((tabs) => {
    for (const tab of tabs) {
      const page = new ext.Page(tab);
      if (adblockIsPaused() || adblockIsDomainPaused({ url: tab.url.href, id: tab.id })) {
        page.browserAction.setBadge({ number: '' });
      }
      // eslint-disable-next-line no-use-before-define
      updateContextMenuItems(page);
    }
  });
};

// Bounce messages back to content scripts.
const emitPageBroadcast = (function emitBroadcast() {
  const injectMap = {
    topOpenWhitelistUI:
      {
        allFrames: false,
        include: [
          'adblock-jquery.js',
          'adblock-uiscripts-load_wizard_resources.js',
          'adblock-uiscripts-top_open_whitelist_ui.js',
        ],
      },
    topOpenWhitelistCompletionUI:
      {
        allFrames: false,
        include: [
          'adblock-jquery.js',
          'adblock-uiscripts-load_wizard_resources.js',
          'adblock-uiscripts-top_open_whitelist_completion_ui.js',
        ],
      },
    topOpenBlacklistUI:
      {
        allFrames: false,
        include: [
          'adblock-jquery.js',
          'adblock-uiscripts-load_wizard_resources.js',
          'adblock-uiscripts-blacklisting-overlay.js',
          'adblock-uiscripts-blacklisting-clickwatcher.js',
          'adblock-uiscripts-blacklisting-elementchain.js',
          'adblock-uiscripts-blacklisting-blacklistui.js',
          'adblock-uiscripts-top_open_blacklist_ui.js',
        ],
      },
    sendContentToBack:
      {
        allFrames: true,
        include: ['adblock-uiscripts-send_content_to_back.js'],
      },
  };

  // Inject the required scripts to execute fnName(parameter) in
  // the given tab.
  // Inputs: fnName:string name of function to execute on tab.
  //         fnName must exist in injectMap above.
  //         parameter:object to pass to fnName.  Must be JSON.stringify()able.
  //         alreadyInjected?:int used to recursively inject required scripts.
  //         tabID:int representing the ID of the tab to execute in.
  //         tabID defaults to the active tab
  const executeOnTab = function (fnName, parameter, alreadyInjected, tabID) {
    const injectedSoFar = alreadyInjected || 0;
    const data = injectMap[fnName];
    const details = { allFrames: data.allFrames };

    // If there's anything to inject, inject the next item and recurse.
    if (data.include.length > injectedSoFar) {
      details.file = data.include[injectedSoFar];
      chrome.tabs.executeScript(tabID, details).then(() => {
        executeOnTab(fnName, parameter, injectedSoFar + 1, tabID);
      }).catch((error) => {
        log(error);
      });
    } else {
      // Nothing left to inject, so execute the function.
      const param = JSON.stringify(parameter);
      details.code = `${fnName}(${param});`;
      chrome.tabs.executeScript(tabID, details);
    }
  };

  // The emitPageBroadcast() function
  const theFunction = function (request) {
    executeOnTab(request.fn, request.options, 0, request.tabID);
  };

  return theFunction;
}());

const contextMenuItem = (() => ({
  pauseAll:
    {
      title: chrome.i18n.getMessage('pause_adblock_everywhere'),
      contexts: ['all'],
      onclick: () => {
        recordGeneralMessage('cm_pause_clicked');
        adblockIsPaused(true);
        updateButtonUIAndContextMenus();
      },
    },
  unpauseAll:
    {
      title: chrome.i18n.getMessage('resume_blocking_ads'),
      contexts: ['all'],
      onclick: () => {
        recordGeneralMessage('cm_unpause_clicked');
        adblockIsPaused(false);
        updateButtonUIAndContextMenus();
      },
    },
  pauseDomain:
    {
      title: chrome.i18n.getMessage('domain_pause_adblock'),
      contexts: ['all'],
      onclick: (info, tab) => {
        recordGeneralMessage('cm_domain_pause_clicked');
        adblockIsDomainPaused({ url: tab.url, id: tab.id }, true);
        updateButtonUIAndContextMenus();
      },
    },
  unpauseDomain:
    {
      title: chrome.i18n.getMessage('resume_blocking_ads'),
      contexts: ['all'],
      onclick: (info, tab) => {
        recordGeneralMessage('cm_domain_unpause_clicked');
        adblockIsDomainPaused({ url: tab.url, id: tab.id }, false);
        updateButtonUIAndContextMenus();
      },
    },
  blockThisAd:
    {
      title: chrome.i18n.getMessage('block_this_ad'),
      contexts: ['all'],
      onclick(info, tab) {
        emitPageBroadcast({
          fn: 'topOpenBlacklistUI',
          options: {
            info,
            isActiveLicense: License.isActiveLicense(),
            showBlacklistCTA: License.shouldShowBlacklistCTA(),
          },
        }, {
          tab,
        });
      },
    },
  blockAnAd:
    {
      title: chrome.i18n.getMessage('block_an_ad_on_this_page'),
      contexts: ['all'],
      onclick(info, tab) {
        emitPageBroadcast({
          fn: 'topOpenBlacklistUI',
          options: {
            nothingClicked: true,
            isActiveLicense: License.isActiveLicense(),
            showBlacklistCTA: License.shouldShowBlacklistCTA(),
          },
        }, {
          tab,
        });
      },
    },
}))();

const updateContextMenuItems = function (page) {
  // Remove the AdBlock context menu items
  chrome.contextMenus.removeAll();

  // Check if the context menu items should be added
  if (!Prefs.shouldShowBlockElementMenu) {
    return;
  }

  const adblockIsPaused = window.adblockIsPaused();
  const domainIsPaused = window.adblockIsDomainPaused({ url: page.url.href, id: page.id });
  if (adblockIsPaused) {
    chrome.contextMenus.create(contextMenuItem.unpauseAll);
  } else if (domainIsPaused) {
    chrome.contextMenus.create(contextMenuItem.unpauseDomain);
  } else if (checkWhitelisted(page)) {
    chrome.contextMenus.create(contextMenuItem.pauseAll);
  } else {
    chrome.contextMenus.create(contextMenuItem.blockThisAd);
    chrome.contextMenus.create(contextMenuItem.blockAnAd);
    chrome.contextMenus.create(contextMenuItem.pauseDomain);
    chrome.contextMenus.create(contextMenuItem.pauseAll);
  }
};

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status) {
    updateContextMenuItems(new ext.Page(tab));
  }
});

chrome.runtime.onMessage.addListener((msg, sender) => {
  if (msg.type === 'report-html-page') {
    updateContextMenuItems(sender.page);
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.command !== 'sendContentToBack') {
    return;
  } // not for us
  emitPageBroadcast({ fn: 'sendContentToBack', options: {} });
  sendResponse({});
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.command === 'reloadTabForWhitelist') {
    reloadTab(sender.tab.id, () => {
      emitPageBroadcast({
        fn: 'topOpenWhitelistCompletionUI',
        options: {
          rule: request.rule,
          isActiveLicense: License.isActiveLicense(),
          showWhitelistCTA: License.shouldShowWhitelistCTA(),
        },
        tabID: sender.tab.id,
      });
    });
    sendResponse({});
  }
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.command === 'showWhitelistCompletion') {
    emitPageBroadcast({
      fn: 'topOpenWhitelistCompletionUI',
      options: {
        rule: request.rule,
        isActiveLicense: License.isActiveLicense(),
        showWhitelistCTA: License.shouldShowWhitelistCTA(),
      },
      tabID: sender.tab.id,
    });
    sendResponse({});
  }
});

// Update browser actions and context menus when whitelisting might have
// changed. That is now when initally loading the filters and later when
// importing backups or saving filter changes.
filterNotifier.on('load', updateButtonUIAndContextMenus);
filterNotifier.on('save', updateButtonUIAndContextMenus);

Prefs.on(Prefs.shouldShowBlockElementMenu, () => {
  updateButtonUIAndContextMenus();
});

updateButtonUIAndContextMenus();

Object.assign(window, {
  emitPageBroadcast,
  updateButtonUIAndContextMenus,
});


/***/ }),
/* 72 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


/* For ESLint: List any global identifiers used in this file below */
/* global chrome, require, getUrlFromId, getSettings, storageGet, storageSet */

const { Subscription } = __webpack_require__(4);
const { filterStorage } = __webpack_require__(5);
const { EventEmitter } = __webpack_require__(6);
const {
  imageSizesMap, WIDE, TALL, SKINNYWIDE, SKINNYTALL,
} = __webpack_require__(39);

const minjQuery = __webpack_require__(24);

const channelsNotifier = new EventEmitter();

const subscription1 = Subscription.fromURL(getUrlFromId('antisocial'));
const subscription2 = Subscription.fromURL(getUrlFromId('annoyances'));

// Inputs: width:int, height:int, url:url, title:string, attributionUrl:url
function Listing(data) {
  this.width = data.width;
  this.height = data.height;
  this.url = data.url;
  this.title = data.title;
  this.attributionUrl = data.attributionUrl;
  this.channelName = data.channelName;
  if (data.name) {
    this.name = data.name;
  }
  if (data.thumbURL) {
    this.thumbURL = data.thumbURL;
  }
  if (data.userLink) {
    this.userLink = data.userLink;
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
}

// Contains and provides access to all the photo channels.
function Channels() {
  this.channelGuide = undefined; // maps channel ids to channels and metadata
  this.loadFromStorage();
}
Channels.prototype = {
  // Inputs:
  //   name:string - a Channel class name.
  //   param:object - the single ctor parameter to the Channel class.
  //   enabled:bool - true if this channel is to be used for pictures.
  // Returns:
  //   id of newly created channel, or undefined if the channel already existed.
  add(data) {
    let Klass = window[data.name];
    if (!Klass) {
      Klass = window.UnknownChannel;
    }
    const dataParam = JSON.stringify(data.param);
    for (const id in this.channelGuide) {
      const c = this.channelGuide[id];
      if (c.name === data.name && JSON.stringify(c.param) === dataParam) {
        return undefined;
      }
    }
    const id = Math.floor(Math.random() * Date.now());
    const channel = new Klass(data.param);
    this.channelGuide[id] = {
      name: data.name,
      param: data.param,
      enabled: data.enabled,
      channel,
    };
    this.saveToStorage();
    const that = this;
    minjQuery(channel).bind('updated', () => {
      if (that.channelGuide[id].enabled) {
        that.channelGuide[id].channel.prefetch();
      }
    });
    channel.refresh();
    return id;
  },

  remove(channelId) {
    delete this.channelGuide[channelId];
    this.saveToStorage();
  },

  // Return read-only map from each channel ID to
  // { name, param, enabled }.
  getGuide() {
    const results = {};
    for (const id in this.channelGuide) {
      const c = this.channelGuide[id];
      results[id] = {
        name: c.name,
        param: c.param,
        enabled: c.enabled,
      };
    }

    return results;
  },

  // Return id for channel name
  getIdByName(name) {
    for (const id in this.channelGuide) {
      if (this.channelGuide[id].name === name) {
        return id;
      }
    }
    return undefined;
  },

  getListings(id) {
    return this.channelGuide[id].channel.getListings();
  },
  setEnabled(id, enabled) {
    const originalValue = this.channelGuide[id].enabled;
    this.channelGuide[id].enabled = enabled;
    this.saveToStorage();
    if (originalValue !== enabled) {
      channelsNotifier.emit('channels.changed', id, enabled, originalValue);
    }
  },

  refreshAllEnabled() {
    for (const id in this.channelGuide) {
      const data = this.channelGuide[id];
      if (data.enabled) {
        data.channel.refresh();
      }
    }
  },

  isAnyEnabled() {
    for (const id in this.channelGuide) {
      const channel = this.channelGuide[id];
      if (channel.enabled) {
        return true;
      }
    }
    return false;
  },

  disableAllChannels() {
    for (const id in this.channelGuide) {
      if (this.channelGuide[id].enabled) {
        this.channelGuide[id].enabled = false;
        channelsNotifier.emit('channels.changed', id, false, true);
      }
    }
  },

  // Returns a random Listing from all enabled channels or from channel
  // |channelId| if specified, trying to match the ratio of |width| and
  // |height| decently.  Returns undefined if there are no enabled channels.
  randomListing(opts) {
    if (!getSettings().picreplacement) {
      return undefined;
    }
    // if the element to be replace is 'fixed' in position, it may make for bad pic
    // replacement element.
    if (opts.position === 'fixed') {
      for (const sub of filterStorage.subscriptions()) {
        if (sub.url === subscription1.url || sub.url === subscription2.url) {
          return undefined;
        }
      }
    }

    const heightLowRange = opts.height;
    const widthLowRange = opts.width;
    const heightHighRange = (opts.height * 1.25);
    const widthHighRange = (opts.width * 1.25);
    const typeMatchListings = [];
    const rangeLimitedListings = [];
    let targetRatio = Math.max(opts.width, opts.height) / Math.min(opts.width, opts.height);

    for (const id in this.channelGuide) {
      const data = this.channelGuide[id];
      if (opts.channelId === id || (data.enabled && !opts.channelId)) {
        data.channel.getListings().forEach((element) => {
          if (
            (opts.type === WIDE || opts.type === SKINNYWIDE)
            && (element.type !== SKINNYTALL)
            && (element.width <= widthHighRange)
            && (element.height >= heightLowRange)
            && (element.height <= heightHighRange)
          ) {
            rangeLimitedListings.push(element);
          } else if (
            (opts.type === TALL || opts.type === SKINNYTALL)
            && (element.type !== SKINNYWIDE)
            && (element.width >= widthLowRange)
            && (element.width <= widthHighRange)
            && (element.height <= heightHighRange)
          ) {
            rangeLimitedListings.push(element);
          } else if (
            (opts.type !== WIDE)
            && (opts.type !== TALL)
            && (opts.type !== SKINNYTALL)
            && (opts.type !== SKINNYWIDE)
            && (element.width >= widthLowRange)
            && (element.width <= widthHighRange)
            && (element.height >= heightLowRange)
            && (element.height <= heightHighRange)
          ) {
            rangeLimitedListings.push(element);
          }
          if (
            opts.type === element.type
            && element.width >= widthLowRange
            && element.height >= heightLowRange
          ) {
            typeMatchListings.push(element);
          }
        });
      }
    }
    let exactTypeMatchListings = [];
    if (rangeLimitedListings.length > 0) {
      const randomIndex = Math.floor(Math.random() * rangeLimitedListings.length);
      const theListing = Object.assign({}, rangeLimitedListings[randomIndex]);
      theListing.listingHeight = theListing.height;
      theListing.listingWidth = theListing.width;
      if (opts.height !== theListing.height && opts.width !== theListing.width) {
        theListing.height = (theListing.height * opts.width) / theListing.width;
        theListing.width = opts.width;
      }
      return theListing;
    }
    let bestMatchRatio = 0;
    targetRatio = Math.max(opts.width, opts.height) / Math.min(opts.width, opts.height);
    typeMatchListings.forEach((listing) => {
      if (Math.abs(listing.ratio - targetRatio) < Math.abs(bestMatchRatio - targetRatio)) {
        exactTypeMatchListings = []; // remove previous matches
        exactTypeMatchListings.push(listing);
        bestMatchRatio = listing.ratio;
      } else if (listing.ratio === bestMatchRatio) {
        exactTypeMatchListings.push(listing);
      }
    });
    if (exactTypeMatchListings.length > 0) {
      const randomIndex = Math.floor(Math.random() * exactTypeMatchListings.length);
      const theListing = Object.assign({}, exactTypeMatchListings[randomIndex]);
      theListing.listingHeight = theListing.height;
      theListing.listingWidth = theListing.width;
      return theListing;
    }

    return undefined;
  },

  loadFromStorage() {
    this.channelGuide = {};

    const entries = storageGet('channels');
    if (!entries || (entries.length > 0 && !entries[0].name)) {
      this.add({
        name: 'DogsChannel',
        param: undefined,
        enabled: false,
      });
      this.add({
        name: 'CatsChannel',
        param: undefined,
        enabled: false,
      });
      this.add({
        name: 'LandscapesChannel',
        param: undefined,
        enabled: false,
      });
    } else {
      for (let i = 0; i < entries.length; i++) {
        this.add(entries[i]);
      }
    }
  },

  saveToStorage() {
    const toStore = [];
    const guide = this.getGuide();
    for (const id in guide) {
      toStore.push(guide[id]);
    }
    storageSet('channels', toStore);
  },
};


// Base class representing a channel of photos.
// Concrete constructors must accept a single argument, because Channels.add()
// relies on that.
function Channel() {
  this.listings = [];
}
Channel.prototype = {
  getListings() {
    return this.listings.slice(0); // shallow copy
  },

  // Update the channel's listings and trigger an 'updated' event.
  refresh() {
    const that = this;
    this.getLatestListings((listings) => {
      that.listings = listings;
      minjQuery(that).trigger('updated');
    });
  },

  // Load all photos so that they're in the cache.
  prefetch() {
    // current - noop, since all of the URLs are hard coded.
  },

  getLatestListings() {
    throw new Error('Implemented by subclass. Call callback with up-to-date listings.');
  },

  calculateType(w, h) {
    let width = w;
    let height = h;

    if (typeof width === 'string') {
      width = parseInt(width, 10);
    }
    if (typeof height === 'string') {
      height = parseInt(height, 10);
    }
    let type = '';
    const ratio = Math.max(width, height) / Math.min(width, height);
    if (ratio >= 1.5 && ratio < 7) {
      type = (width > height ? imageSizesMap.get('wide') : imageSizesMap.get('tall'));
    } else if (ratio > 7) {
      type = (width > height ? imageSizesMap.get('skinnywide') : imageSizesMap.get('skinnytall'));
    } else {
      type = ((width > 125 || height > 125) ? imageSizesMap.get('big') : imageSizesMap.get('small'));
    }
    return type;
  },
};

Object.assign(window, {
  Channel,
  Channels,
  Listing,
  channelsNotifier,
});


/***/ }),
/* 73 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


/* For ESLint: List any global identifiers used in this file below */
/* global Channel, Listing */


// Channel containing hard coded cats loaded from disk.
// Subclass of Channel.
function CatsChannel() {
  Channel.call(this);
}

CatsChannel.prototype = {
  __proto__: Channel.prototype,

  getLatestListings(callback) {
    const that = this;
    function L(w, h, u) {
      let width = w;
      let height = h;
      const url = u;
      const type = that.calculateType(width, height);

      if (typeof width === 'number') {
        width = `${width}`;
      }
      if (typeof height === 'number') {
        height = `${height}`;
      }
      return new Listing({
        width,
        height,
        url,
        attributionUrl: url,
        type,
        ratio: Math.max(width, height) / Math.min(width, height),
        title: 'This is a cat!',
        channelName: 'catchannelswitchlabel', // message.json key for channel name
      });
    }
    // the listings never change
    callback([
      L(1200, 628, 'https://cdn.adblockcdn.com/pix/Cats/12--x628/12--x628/cat-7784.jpg'),
      L(1200, 628, 'https://cdn.adblockcdn.com/pix/Cats/12--x628/12--x628/cat-animal-animal-portrait-pet.jpg'),
      L(1200, 628, 'https://cdn.adblockcdn.com/pix/Cats/12--x628/12--x628/cat-feline-cute-domestic.jpg'),
      L(1200, 628, 'https://cdn.adblockcdn.com/pix/Cats/12--x628/12--x628/cat-kitten-rozkosne-little.jpg'),
      L(1200, 628, 'https://cdn.adblockcdn.com/pix/Cats/12--x628/12--x628/domestic-cat-cat-adidas-relaxed.jpg'),
      L(1200, 628, 'https://cdn.adblockcdn.com/pix/Cats/12--x628/12--x628/eyes-cats-cat-couch.jpg'),
      L(2400, 1256, 'https://cdn.adblockcdn.com/pix/Cats/12--x628/24--x1256/cat-7784.jpg'),
      L(2400, 1256, 'https://cdn.adblockcdn.com/pix/Cats/12--x628/24--x1256/cat-animal-animal-portrait-pet.jpg'),
      L(2400, 1256, 'https://cdn.adblockcdn.com/pix/Cats/12--x628/24--x1256/cat-feline-cute-domestic.jpg'),
      L(2400, 1256, 'https://cdn.adblockcdn.com/pix/Cats/12--x628/24--x1256/cat-kitten-rozkosne-little.jpg'),
      L(2400, 1256, 'https://cdn.adblockcdn.com/pix/Cats/12--x628/24--x1256/domestic-cat-cat-adidas-relaxed.jpg'),
      L(2400, 1256, 'https://cdn.adblockcdn.com/pix/Cats/12--x628/24--x1256/eyes-cats-cat-couch.jpg'),
      L(300, 250, 'https://cdn.adblockcdn.com/pix/Cats/3--x25-/3--x25-/cat-7784.jpg'),
      L(300, 250, 'https://cdn.adblockcdn.com/pix/Cats/3--x25-/3--x25-/cat-82072.jpg'),
      L(300, 250, 'https://cdn.adblockcdn.com/pix/Cats/3--x25-/3--x25-/cat-animal-animal-portrait-pet.jpg'),
      L(300, 250, 'https://cdn.adblockcdn.com/pix/Cats/3--x25-/3--x25-/cat-animal-cute-pet-39500.jpg'),
      L(300, 250, 'https://cdn.adblockcdn.com/pix/Cats/3--x25-/3--x25-/cat-balcony-surprised-look-80363.jpg'),
      L(300, 250, 'https://cdn.adblockcdn.com/pix/Cats/3--x25-/3--x25-/cat-british-shorthair-mieze-blue-eye-162174.jpg'),
      L(300, 250, 'https://cdn.adblockcdn.com/pix/Cats/3--x25-/3--x25-/cat-british-shorthair-thoroughbred-adidas-162064.jpg'),
      L(300, 250, 'https://cdn.adblockcdn.com/pix/Cats/3--x25-/3--x25-/cat-close-animal-cat-face-162309.jpg'),
      L(300, 250, 'https://cdn.adblockcdn.com/pix/Cats/3--x25-/3--x25-/cat-eyes-view-face-66292.jpg'),
      L(300, 250, 'https://cdn.adblockcdn.com/pix/Cats/3--x25-/3--x25-/cat-feline-cute-domestic.jpg'),
      L(300, 250, 'https://cdn.adblockcdn.com/pix/Cats/3--x25-/3--x25-/cat-feline-furry-pet-53446.jpg'),
      L(300, 250, 'https://cdn.adblockcdn.com/pix/Cats/3--x25-/3--x25-/cat-feline-kitty-kitten-39380.jpg'),
      L(300, 250, 'https://cdn.adblockcdn.com/pix/Cats/3--x25-/3--x25-/cat-home-animal-cat-s-eyes-46208.jpg'),
      L(300, 250, 'https://cdn.adblockcdn.com/pix/Cats/3--x25-/3--x25-/cat-kitten-rozkosne-little.jpg'),
      L(300, 250, 'https://cdn.adblockcdn.com/pix/Cats/3--x25-/3--x25-/cat-pet-eyes-animal-50566.jpg'),
      L(300, 250, 'https://cdn.adblockcdn.com/pix/Cats/3--x25-/3--x25-/cat-pet-furry-face-162319.jpg'),
      L(300, 250, 'https://cdn.adblockcdn.com/pix/Cats/3--x25-/3--x25-/cat-portrait-eyes-animal-162216.jpg'),
      L(300, 250, 'https://cdn.adblockcdn.com/pix/Cats/3--x25-/3--x25-/cat-portrait-kitten-cute-128884.jpg'),
      L(300, 250, 'https://cdn.adblockcdn.com/pix/Cats/3--x25-/3--x25-/cat-relax-chill-out-camacho-70844.jpg'),
      L(300, 250, 'https://cdn.adblockcdn.com/pix/Cats/3--x25-/3--x25-/cat-tiger-getiegert-feel-at-home-160722.jpg'),
      L(300, 250, 'https://cdn.adblockcdn.com/pix/Cats/3--x25-/3--x25-/domestic-cat-cat-adidas-relaxed.jpg'),
      L(300, 250, 'https://cdn.adblockcdn.com/pix/Cats/3--x25-/3--x25-/eyes-cats-cat-couch.jpg'),
      L(300, 250, 'https://cdn.adblockcdn.com/pix/Cats/3--x25-/3--x25-/pexels-photo-105587.jpg'),
      L(300, 250, 'https://cdn.adblockcdn.com/pix/Cats/3--x25-/3--x25-/pexels-photo-106131.jpg'),
      L(300, 250, 'https://cdn.adblockcdn.com/pix/Cats/3--x25-/3--x25-/pexels-photo-116835.jpg'),
      L(300, 250, 'https://cdn.adblockcdn.com/pix/Cats/3--x25-/3--x25-/pexels-photo-135859.jpg'),
      L(300, 250, 'https://cdn.adblockcdn.com/pix/Cats/3--x25-/3--x25-/pexels-photo-142615.jpg'),
      L(300, 250, 'https://cdn.adblockcdn.com/pix/Cats/3--x25-/3--x25-/pexels-photo-171216.jpg'),
      L(300, 250, 'https://cdn.adblockcdn.com/pix/Cats/3--x25-/3--x25-/pexels-photo-172420.jpg'),
      L(300, 250, 'https://cdn.adblockcdn.com/pix/Cats/3--x25-/3--x25-/pexels-photo-173909.jpg'),
      L(300, 250, 'https://cdn.adblockcdn.com/pix/Cats/3--x25-/3--x25-/pexels-photo-192384.jpg'),
      L(300, 250, 'https://cdn.adblockcdn.com/pix/Cats/3--x25-/3--x25-/pexels-photo-207166.jpg'),
      L(300, 250, 'https://cdn.adblockcdn.com/pix/Cats/3--x25-/3--x25-/pexels-photo-208845.jpg'),
      L(300, 250, 'https://cdn.adblockcdn.com/pix/Cats/3--x25-/3--x25-/pexels-photo-208860.jpg'),
      L(300, 250, 'https://cdn.adblockcdn.com/pix/Cats/3--x25-/3--x25-/pexels-photo-208878.jpg'),
      L(300, 250, 'https://cdn.adblockcdn.com/pix/Cats/3--x25-/3--x25-/pexels-photo-208880.jpg'),
      L(300, 250, 'https://cdn.adblockcdn.com/pix/Cats/3--x25-/3--x25-/pexels-photo-208906.jpg'),
      L(300, 250, 'https://cdn.adblockcdn.com/pix/Cats/3--x25-/3--x25-/pexels-photo-208907.jpg'),
      L(300, 250, 'https://cdn.adblockcdn.com/pix/Cats/3--x25-/3--x25-/pexels-photo-208954.jpg'),
      L(300, 250, 'https://cdn.adblockcdn.com/pix/Cats/3--x25-/3--x25-/pexels-photo-208971.jpg'),
      L(300, 250, 'https://cdn.adblockcdn.com/pix/Cats/3--x25-/3--x25-/pexels-photo-208998.jpg'),
      L(300, 250, 'https://cdn.adblockcdn.com/pix/Cats/3--x25-/3--x25-/pexels-photo-209117.jpg'),
      L(300, 250, 'https://cdn.adblockcdn.com/pix/Cats/3--x25-/3--x25-/pexels-photo-209800.jpg'),
      L(300, 250, 'https://cdn.adblockcdn.com/pix/Cats/3--x25-/3--x25-/pexels-photo-210081.jpg'),
      L(300, 250, 'https://cdn.adblockcdn.com/pix/Cats/3--x25-/3--x25-/pexels-photo-214657.jpg'),
      L(300, 250, 'https://cdn.adblockcdn.com/pix/Cats/3--x25-/3--x25-/pexels-photo-220826.jpg'),
      L(300, 250, 'https://cdn.adblockcdn.com/pix/Cats/3--x25-/3--x25-/pexels-photo-220876.jpg'),
      L(300, 250, 'https://cdn.adblockcdn.com/pix/Cats/3--x25-/3--x25-/pexels-photo-220951.jpg'),
      L(300, 250, 'https://cdn.adblockcdn.com/pix/Cats/3--x25-/3--x25-/pexels-photo-220970.jpg'),
      L(300, 250, 'https://cdn.adblockcdn.com/pix/Cats/3--x25-/3--x25-/pexels-photo-220983.jpg'),
      L(300, 250, 'https://cdn.adblockcdn.com/pix/Cats/3--x25-/3--x25-/pexels-photo-236630.jpg'),
      L(300, 250, 'https://cdn.adblockcdn.com/pix/Cats/3--x25-/3--x25-/pexels-photo-236633.jpg'),
      L(300, 250, 'https://cdn.adblockcdn.com/pix/Cats/3--x25-/3--x25-/pexels-photo-244848.jpg'),
      L(300, 250, 'https://cdn.adblockcdn.com/pix/Cats/3--x25-/3--x25-/pexels-photo-247007.jpg'),
      L(300, 250, 'https://cdn.adblockcdn.com/pix/Cats/3--x25-/3--x25-/pexels-photo-248254.jpg'),
      L(300, 250, 'https://cdn.adblockcdn.com/pix/Cats/3--x25-/3--x25-/pexels-photo-248289.jpg'),
      L(300, 250, 'https://cdn.adblockcdn.com/pix/Cats/3--x25-/3--x25-/pexels-photo-248304.jpg'),
      L(300, 250, 'https://cdn.adblockcdn.com/pix/Cats/3--x25-/3--x25-/pexels-photo-257423.jpg'),
      L(300, 250, 'https://cdn.adblockcdn.com/pix/Cats/3--x25-/3--x25-/pexels-photo-271889.jpg'),
      L(300, 250, 'https://cdn.adblockcdn.com/pix/Cats/3--x25-/3--x25-/pexels-photo-272124.jpg'),
      L(300, 250, 'https://cdn.adblockcdn.com/pix/Cats/3--x25-/3--x25-/pexels-photo-289345.jpg'),
      L(300, 250, 'https://cdn.adblockcdn.com/pix/Cats/3--x25-/3--x25-/pexels-photo-289381.jpg'),
      L(300, 250, 'https://cdn.adblockcdn.com/pix/Cats/3--x25-/3--x25-/pexels-photo-290263.jpg'),
      L(300, 250, 'https://cdn.adblockcdn.com/pix/Cats/3--x25-/3--x25-/pexels-photo-327014.jpg'),
      L(300, 250, 'https://cdn.adblockcdn.com/pix/Cats/3--x25-/3--x25-/pexels-photo-349388.jpg'),
      L(300, 250, 'https://cdn.adblockcdn.com/pix/Cats/3--x25-/3--x25-/pexels-photo-372651.jpg'),
      L(300, 250, 'https://cdn.adblockcdn.com/pix/Cats/3--x25-/3--x25-/pexels-photo-372657.jpg'),
      L(300, 250, 'https://cdn.adblockcdn.com/pix/Cats/3--x25-/3--x25-/pexels-photo-416088.jpg'),
      L(300, 250, 'https://cdn.adblockcdn.com/pix/Cats/3--x25-/3--x25-/pexels-photo-416138.jpg'),
      L(300, 250, 'https://cdn.adblockcdn.com/pix/Cats/3--x25-/3--x25-/pexels-photo-416208.jpg'),
      L(300, 250, 'https://cdn.adblockcdn.com/pix/Cats/3--x25-/3--x25-/pexels-photo-437886.jpg'),
      L(300, 250, 'https://cdn.adblockcdn.com/pix/Cats/3--x25-/3--x25-/pexels-photo-461872.jpg'),
      L(300, 250, 'https://cdn.adblockcdn.com/pix/Cats/3--x25-/3--x25-/pexels-photo-549237.jpg'),
      L(300, 250, 'https://cdn.adblockcdn.com/pix/Cats/3--x25-/3--x25-/pexels-photo-576802.jpg'),
      L(300, 250, 'https://cdn.adblockcdn.com/pix/Cats/3--x25-/3--x25-/pexels-photo-583250.jpg'),
      L(300, 250, 'https://cdn.adblockcdn.com/pix/Cats/3--x25-/3--x25-/pexels-photo-596590.jpg'),
      L(300, 250, 'https://cdn.adblockcdn.com/pix/Cats/3--x25-/3--x25-/pexels-photo-599492.jpg'),
      L(300, 250, 'https://cdn.adblockcdn.com/pix/Cats/3--x25-/3--x25-/pexels-photo-605048.jpg'),
      L(300, 250, 'https://cdn.adblockcdn.com/pix/Cats/3--x25-/3--x25-/pexels-photo-622549.jpg'),
      L(300, 250, 'https://cdn.adblockcdn.com/pix/Cats/3--x25-/3--x25-/pexels-photo-65536.jpg'),
      L(300, 250, 'https://cdn.adblockcdn.com/pix/Cats/3--x25-/3--x25-/pexels-photo-674568.jpg'),
      L(300, 250, 'https://cdn.adblockcdn.com/pix/Cats/3--x25-/3--x25-/pexels-photo-674577 (1).jpg'),
      L(300, 250, 'https://cdn.adblockcdn.com/pix/Cats/3--x25-/3--x25-/pexels-photo-674577.jpg'),
      L(300, 250, 'https://cdn.adblockcdn.com/pix/Cats/3--x25-/3--x25-/pexels-photo-679855.jpg'),
      L(300, 250, 'https://cdn.adblockcdn.com/pix/Cats/3--x25-/3--x25-/pexels-photo-680437.jpg'),
      L(300, 250, 'https://cdn.adblockcdn.com/pix/Cats/3--x25-/3--x25-/pexels-photo-683205.jpg'),
      L(300, 250, 'https://cdn.adblockcdn.com/pix/Cats/3--x25-/3--x25-/pexels-photo-689042.jpg'),
      L(300, 250, 'https://cdn.adblockcdn.com/pix/Cats/3--x25-/3--x25-/pexels-photo-709482.jpg'),
      L(300, 250, 'https://cdn.adblockcdn.com/pix/Cats/3--x25-/3--x25-/pexels-photo-720684.jpg'),
      L(300, 250, 'https://cdn.adblockcdn.com/pix/Cats/3--x25-/3--x25-/pexels-photo-731553.jpg'),
      L(300, 250, 'https://cdn.adblockcdn.com/pix/Cats/3--x25-/3--x25-/pexels-photo-731637.jpg'),
      L(300, 250, 'https://cdn.adblockcdn.com/pix/Cats/3--x25-/3--x25-/pexels-photo-733105.jpg'),
      L(300, 250, 'https://cdn.adblockcdn.com/pix/Cats/3--x25-/3--x25-/pexels-photo-736528.jpg'),
      L(300, 250, 'https://cdn.adblockcdn.com/pix/Cats/3--x25-/3--x25-/pexels-photo-745241.jpg'),
      L(300, 250, 'https://cdn.adblockcdn.com/pix/Cats/3--x25-/3--x25-/pexels-photo-749212.jpg'),
      L(300, 250, 'https://cdn.adblockcdn.com/pix/Cats/3--x25-/3--x25-/pexels-photo-751050.jpg'),
      L(300, 250, 'https://cdn.adblockcdn.com/pix/Cats/3--x25-/3--x25-/pexels-photo-89951.jpg'),
      L(300, 250, 'https://cdn.adblockcdn.com/pix/Cats/3--x25-/3--x25-/pexels-photo-92174.jpg'),
      L(300, 250, 'https://cdn.adblockcdn.com/pix/Cats/3--x25-/3--x25-/pexels-photo-94434.jpg'),
      L(300, 250, 'https://cdn.adblockcdn.com/pix/Cats/3--x25-/3--x25-/pexels-photo-95328.jpg'),
      L(300, 250, 'https://cdn.adblockcdn.com/pix/Cats/3--x25-/3--x25-/cat-close-animal-cat-face-1623-9.jpg'),
      L(300, 250, 'https://cdn.adblockcdn.com/pix/Cats/3--x25-/3--x25-/cat-feline-kitty-kitten-3938-.jpg'),
      L(300, 250, 'https://cdn.adblockcdn.com/pix/Cats/3--x25-/3--x25-/pexels-photo-1-5587.jpg'),
      L(300, 250, 'https://cdn.adblockcdn.com/pix/Cats/3--x25-/3--x25-/pexels-photo-17242-.jpg'),
      L(300, 250, 'https://cdn.adblockcdn.com/pix/Cats/3--x25-/3--x25-/pexels-photo-1739-9.jpg'),
      L(300, 250, 'https://cdn.adblockcdn.com/pix/Cats/3--x25-/3--x25-/pexels-photo-2-886-.jpg'),
      L(300, 250, 'https://cdn.adblockcdn.com/pix/Cats/3--x25-/3--x25-/pexels-photo-2-8878.jpg'),
      L(300, 250, 'https://cdn.adblockcdn.com/pix/Cats/3--x25-/3--x25-/pexels-photo-58325-.jpg'),
      L(300, 250, 'https://cdn.adblockcdn.com/pix/Cats/3--x25-/3--x25-/pexels-photo-6832-5.jpg'),
      L(300, 250, 'https://cdn.adblockcdn.com/pix/Cats/3--x25-/3--x25-/pexels-photo-7-9482.jpg'),
      L(300, 250, 'https://cdn.adblockcdn.com/pix/Cats/3--x25-/3--x25-/pexels-photo-751-5-.jpg'),
      L(600, 500, 'https://cdn.adblockcdn.com/pix/Cats/3--x25-/6--x5--/cat-7784.jpg'),
      L(600, 500, 'https://cdn.adblockcdn.com/pix/Cats/3--x25-/6--x5--/cat-82072.jpg'),
      L(600, 500, 'https://cdn.adblockcdn.com/pix/Cats/3--x25-/6--x5--/cat-animal-animal-portrait-pet.jpg'),
      L(600, 500, 'https://cdn.adblockcdn.com/pix/Cats/3--x25-/6--x5--/cat-animal-cute-pet-39500.jpg'),
      L(600, 500, 'https://cdn.adblockcdn.com/pix/Cats/3--x25-/6--x5--/cat-balcony-surprised-look-80363.jpg'),
      L(600, 500, 'https://cdn.adblockcdn.com/pix/Cats/3--x25-/6--x5--/cat-british-shorthair-mieze-blue-eye-162174.jpg'),
      L(600, 500, 'https://cdn.adblockcdn.com/pix/Cats/3--x25-/6--x5--/cat-british-shorthair-thoroughbred-adidas-162064.jpg'),
      L(600, 500, 'https://cdn.adblockcdn.com/pix/Cats/3--x25-/6--x5--/cat-close-animal-cat-face-162309.jpg'),
      L(600, 500, 'https://cdn.adblockcdn.com/pix/Cats/3--x25-/6--x5--/cat-eyes-view-face-66292.jpg'),
      L(600, 500, 'https://cdn.adblockcdn.com/pix/Cats/3--x25-/6--x5--/cat-feline-cute-domestic.jpg'),
      L(600, 500, 'https://cdn.adblockcdn.com/pix/Cats/3--x25-/6--x5--/cat-feline-furry-pet-53446.jpg'),
      L(600, 500, 'https://cdn.adblockcdn.com/pix/Cats/3--x25-/6--x5--/cat-feline-kitty-kitten-39380.jpg'),
      L(600, 500, 'https://cdn.adblockcdn.com/pix/Cats/3--x25-/6--x5--/cat-home-animal-cat-s-eyes-46208.jpg'),
      L(600, 500, 'https://cdn.adblockcdn.com/pix/Cats/3--x25-/6--x5--/cat-kitten-rozkosne-little.jpg'),
      L(600, 500, 'https://cdn.adblockcdn.com/pix/Cats/3--x25-/6--x5--/cat-pet-eyes-animal-50566.jpg'),
      L(600, 500, 'https://cdn.adblockcdn.com/pix/Cats/3--x25-/6--x5--/cat-pet-furry-face-162319.jpg'),
      L(600, 500, 'https://cdn.adblockcdn.com/pix/Cats/3--x25-/6--x5--/cat-portrait-eyes-animal-162216.jpg'),
      L(600, 500, 'https://cdn.adblockcdn.com/pix/Cats/3--x25-/6--x5--/cat-portrait-kitten-cute-128884.jpg'),
      L(600, 500, 'https://cdn.adblockcdn.com/pix/Cats/3--x25-/6--x5--/cat-relax-chill-out-camacho-70844.jpg'),
      L(600, 500, 'https://cdn.adblockcdn.com/pix/Cats/3--x25-/6--x5--/cat-tiger-getiegert-feel-at-home-160722.jpg'),
      L(600, 500, 'https://cdn.adblockcdn.com/pix/Cats/3--x25-/6--x5--/domestic-cat-cat-adidas-relaxed.jpg'),
      L(600, 500, 'https://cdn.adblockcdn.com/pix/Cats/3--x25-/6--x5--/eyes-cats-cat-couch.jpg'),
      L(600, 500, 'https://cdn.adblockcdn.com/pix/Cats/3--x25-/6--x5--/pexels-photo-105587.jpg'),
      L(600, 500, 'https://cdn.adblockcdn.com/pix/Cats/3--x25-/6--x5--/pexels-photo-106131.jpg'),
      L(600, 500, 'https://cdn.adblockcdn.com/pix/Cats/3--x25-/6--x5--/pexels-photo-116835.jpg'),
      L(600, 500, 'https://cdn.adblockcdn.com/pix/Cats/3--x25-/6--x5--/pexels-photo-135859.jpg'),
      L(600, 500, 'https://cdn.adblockcdn.com/pix/Cats/3--x25-/6--x5--/pexels-photo-142615.jpg'),
      L(600, 500, 'https://cdn.adblockcdn.com/pix/Cats/3--x25-/6--x5--/pexels-photo-171216.jpg'),
      L(600, 500, 'https://cdn.adblockcdn.com/pix/Cats/3--x25-/6--x5--/pexels-photo-172420.jpg'),
      L(600, 500, 'https://cdn.adblockcdn.com/pix/Cats/3--x25-/6--x5--/pexels-photo-173909.jpg'),
      L(600, 500, 'https://cdn.adblockcdn.com/pix/Cats/3--x25-/6--x5--/pexels-photo-192384.jpg'),
      L(600, 500, 'https://cdn.adblockcdn.com/pix/Cats/3--x25-/6--x5--/pexels-photo-207166.jpg'),
      L(600, 500, 'https://cdn.adblockcdn.com/pix/Cats/3--x25-/6--x5--/pexels-photo-208845.jpg'),
      L(600, 500, 'https://cdn.adblockcdn.com/pix/Cats/3--x25-/6--x5--/pexels-photo-208860.jpg'),
      L(600, 500, 'https://cdn.adblockcdn.com/pix/Cats/3--x25-/6--x5--/pexels-photo-208878.jpg'),
      L(600, 500, 'https://cdn.adblockcdn.com/pix/Cats/3--x25-/6--x5--/pexels-photo-208880.jpg'),
      L(600, 500, 'https://cdn.adblockcdn.com/pix/Cats/3--x25-/6--x5--/pexels-photo-208906.jpg'),
      L(600, 500, 'https://cdn.adblockcdn.com/pix/Cats/3--x25-/6--x5--/pexels-photo-208907.jpg'),
      L(600, 500, 'https://cdn.adblockcdn.com/pix/Cats/3--x25-/6--x5--/pexels-photo-208954.jpg'),
      L(600, 500, 'https://cdn.adblockcdn.com/pix/Cats/3--x25-/6--x5--/pexels-photo-208971.jpg'),
      L(600, 500, 'https://cdn.adblockcdn.com/pix/Cats/3--x25-/6--x5--/pexels-photo-208998.jpg'),
      L(600, 500, 'https://cdn.adblockcdn.com/pix/Cats/3--x25-/6--x5--/pexels-photo-209117.jpg'),
      L(600, 500, 'https://cdn.adblockcdn.com/pix/Cats/3--x25-/6--x5--/pexels-photo-209800.jpg'),
      L(600, 500, 'https://cdn.adblockcdn.com/pix/Cats/3--x25-/6--x5--/pexels-photo-210081.jpg'),
      L(600, 500, 'https://cdn.adblockcdn.com/pix/Cats/3--x25-/6--x5--/pexels-photo-214657.jpg'),
      L(600, 500, 'https://cdn.adblockcdn.com/pix/Cats/3--x25-/6--x5--/pexels-photo-220826.jpg'),
      L(600, 500, 'https://cdn.adblockcdn.com/pix/Cats/3--x25-/6--x5--/pexels-photo-220876.jpg'),
      L(600, 500, 'https://cdn.adblockcdn.com/pix/Cats/3--x25-/6--x5--/pexels-photo-220951.jpg'),
      L(600, 500, 'https://cdn.adblockcdn.com/pix/Cats/3--x25-/6--x5--/pexels-photo-220970.jpg'),
      L(600, 500, 'https://cdn.adblockcdn.com/pix/Cats/3--x25-/6--x5--/pexels-photo-220983.jpg'),
      L(600, 500, 'https://cdn.adblockcdn.com/pix/Cats/3--x25-/6--x5--/pexels-photo-236630.jpg'),
      L(600, 500, 'https://cdn.adblockcdn.com/pix/Cats/3--x25-/6--x5--/pexels-photo-236633.jpg'),
      L(600, 500, 'https://cdn.adblockcdn.com/pix/Cats/3--x25-/6--x5--/pexels-photo-244848.jpg'),
      L(600, 500, 'https://cdn.adblockcdn.com/pix/Cats/3--x25-/6--x5--/pexels-photo-247007.jpg'),
      L(600, 500, 'https://cdn.adblockcdn.com/pix/Cats/3--x25-/6--x5--/pexels-photo-248254.jpg'),
      L(600, 500, 'https://cdn.adblockcdn.com/pix/Cats/3--x25-/6--x5--/pexels-photo-248289.jpg'),
      L(600, 500, 'https://cdn.adblockcdn.com/pix/Cats/3--x25-/6--x5--/pexels-photo-248304.jpg'),
      L(600, 500, 'https://cdn.adblockcdn.com/pix/Cats/3--x25-/6--x5--/pexels-photo-257423.jpg'),
      L(600, 500, 'https://cdn.adblockcdn.com/pix/Cats/3--x25-/6--x5--/pexels-photo-271889.jpg'),
      L(600, 500, 'https://cdn.adblockcdn.com/pix/Cats/3--x25-/6--x5--/pexels-photo-272124.jpg'),
      L(600, 500, 'https://cdn.adblockcdn.com/pix/Cats/3--x25-/6--x5--/pexels-photo-289345.jpg'),
      L(600, 500, 'https://cdn.adblockcdn.com/pix/Cats/3--x25-/6--x5--/pexels-photo-289381.jpg'),
      L(600, 500, 'https://cdn.adblockcdn.com/pix/Cats/3--x25-/6--x5--/pexels-photo-290263.jpg'),
      L(600, 500, 'https://cdn.adblockcdn.com/pix/Cats/3--x25-/6--x5--/pexels-photo-327014.jpg'),
      L(600, 500, 'https://cdn.adblockcdn.com/pix/Cats/3--x25-/6--x5--/pexels-photo-349388.jpg'),
      L(600, 500, 'https://cdn.adblockcdn.com/pix/Cats/3--x25-/6--x5--/pexels-photo-372651.jpg'),
      L(600, 500, 'https://cdn.adblockcdn.com/pix/Cats/3--x25-/6--x5--/pexels-photo-372657.jpg'),
      L(600, 500, 'https://cdn.adblockcdn.com/pix/Cats/3--x25-/6--x5--/pexels-photo-416088.jpg'),
      L(600, 500, 'https://cdn.adblockcdn.com/pix/Cats/3--x25-/6--x5--/pexels-photo-416138.jpg'),
      L(600, 500, 'https://cdn.adblockcdn.com/pix/Cats/3--x25-/6--x5--/pexels-photo-416208.jpg'),
      L(600, 500, 'https://cdn.adblockcdn.com/pix/Cats/3--x25-/6--x5--/pexels-photo-437886.jpg'),
      L(600, 500, 'https://cdn.adblockcdn.com/pix/Cats/3--x25-/6--x5--/pexels-photo-461872.jpg'),
      L(600, 500, 'https://cdn.adblockcdn.com/pix/Cats/3--x25-/6--x5--/pexels-photo-549237.jpg'),
      L(600, 500, 'https://cdn.adblockcdn.com/pix/Cats/3--x25-/6--x5--/pexels-photo-576802.jpg'),
      L(600, 500, 'https://cdn.adblockcdn.com/pix/Cats/3--x25-/6--x5--/pexels-photo-583250.jpg'),
      L(600, 500, 'https://cdn.adblockcdn.com/pix/Cats/3--x25-/6--x5--/pexels-photo-596590.jpg'),
      L(600, 500, 'https://cdn.adblockcdn.com/pix/Cats/3--x25-/6--x5--/pexels-photo-599492.jpg'),
      L(600, 500, 'https://cdn.adblockcdn.com/pix/Cats/3--x25-/6--x5--/pexels-photo-605048.jpg'),
      L(600, 500, 'https://cdn.adblockcdn.com/pix/Cats/3--x25-/6--x5--/pexels-photo-622549.jpg'),
      L(600, 500, 'https://cdn.adblockcdn.com/pix/Cats/3--x25-/6--x5--/pexels-photo-65536.jpg'),
      L(600, 500, 'https://cdn.adblockcdn.com/pix/Cats/3--x25-/6--x5--/pexels-photo-674568.jpg'),
      L(600, 500, 'https://cdn.adblockcdn.com/pix/Cats/3--x25-/6--x5--/pexels-photo-674577 (1).jpg'),
      L(600, 500, 'https://cdn.adblockcdn.com/pix/Cats/3--x25-/6--x5--/pexels-photo-674577.jpg'),
      L(600, 500, 'https://cdn.adblockcdn.com/pix/Cats/3--x25-/6--x5--/pexels-photo-679855.jpg'),
      L(600, 500, 'https://cdn.adblockcdn.com/pix/Cats/3--x25-/6--x5--/pexels-photo-680437.jpg'),
      L(600, 500, 'https://cdn.adblockcdn.com/pix/Cats/3--x25-/6--x5--/pexels-photo-683205.jpg'),
      L(600, 500, 'https://cdn.adblockcdn.com/pix/Cats/3--x25-/6--x5--/pexels-photo-689042.jpg'),
      L(600, 500, 'https://cdn.adblockcdn.com/pix/Cats/3--x25-/6--x5--/pexels-photo-709482.jpg'),
      L(600, 500, 'https://cdn.adblockcdn.com/pix/Cats/3--x25-/6--x5--/pexels-photo-720684.jpg'),
      L(600, 500, 'https://cdn.adblockcdn.com/pix/Cats/3--x25-/6--x5--/pexels-photo-731553.jpg'),
      L(600, 500, 'https://cdn.adblockcdn.com/pix/Cats/3--x25-/6--x5--/pexels-photo-731637.jpg'),
      L(600, 500, 'https://cdn.adblockcdn.com/pix/Cats/3--x25-/6--x5--/pexels-photo-733105.jpg'),
      L(600, 500, 'https://cdn.adblockcdn.com/pix/Cats/3--x25-/6--x5--/pexels-photo-736528.jpg'),
      L(600, 500, 'https://cdn.adblockcdn.com/pix/Cats/3--x25-/6--x5--/pexels-photo-745241.jpg'),
      L(600, 500, 'https://cdn.adblockcdn.com/pix/Cats/3--x25-/6--x5--/pexels-photo-749212.jpg'),
      L(600, 500, 'https://cdn.adblockcdn.com/pix/Cats/3--x25-/6--x5--/pexels-photo-751050.jpg'),
      L(600, 500, 'https://cdn.adblockcdn.com/pix/Cats/3--x25-/6--x5--/pexels-photo-89951.jpg'),
      L(600, 500, 'https://cdn.adblockcdn.com/pix/Cats/3--x25-/6--x5--/pexels-photo-92174.jpg'),
      L(600, 500, 'https://cdn.adblockcdn.com/pix/Cats/3--x25-/6--x5--/pexels-photo-94434.jpg'),
      L(600, 500, 'https://cdn.adblockcdn.com/pix/Cats/3--x25-/6--x5--/pexels-photo-95328.jpg'),
      L(600, 500, 'https://cdn.adblockcdn.com/pix/Cats/3--x25-/6--x5--/pexels-photo-1-6131.jpg'),
      L(600, 500, 'https://cdn.adblockcdn.com/pix/Cats/3--x25-/6--x5--/pexels-photo-2-89-6.jpg'),
      L(600, 500, 'https://cdn.adblockcdn.com/pix/Cats/3--x25-/6--x5--/pexels-photo-2-9117.jpg'),
      L(600, 500, 'https://cdn.adblockcdn.com/pix/Cats/3--x25-/6--x5--/pexels-photo-22-983.jpg'),
      L(600, 500, 'https://cdn.adblockcdn.com/pix/Cats/3--x25-/6--x5--/pexels-photo-23663-.jpg'),
      L(600, 500, 'https://cdn.adblockcdn.com/pix/Cats/3--x25-/6--x5--/pexels-photo-4162-8.jpg'),
      L(600, 500, 'https://cdn.adblockcdn.com/pix/Cats/3--x25-/6--x5--/pexels-photo-5768-2.jpg'),
      L(600, 500, 'https://cdn.adblockcdn.com/pix/Cats/3--x25-/6--x5--/pexels-photo-68-437.jpg'),
      L(600, 500, 'https://cdn.adblockcdn.com/pix/Cats/3--x25-/6--x5--/pexels-photo-7331-5.jpg'),
      L(600, 500, 'https://cdn.adblockcdn.com/pix/Cats/3--x25-/_6--x5--/pexels-photo-116835.jpg'),
      L(600, 500, 'https://cdn.adblockcdn.com/pix/Cats/3--x25-/_6--x5--/pexels-photo-59659-.jpg'),
      L(600, 500, 'https://cdn.adblockcdn.com/pix/Cats/3--x25-/_6--x5--/pexels-photo-7331-5.jpg'),
      L(600, 500, 'https://cdn.adblockcdn.com/pix/Cats/3--x25-/_6--x5--/pexels-photo-94434.jpg'),
      L(300, 600, 'https://cdn.adblockcdn.com/pix/Cats/3--x6--/3--x6--/cat-7784.jpg'),
      L(300, 600, 'https://cdn.adblockcdn.com/pix/Cats/3--x6--/3--x6--/cat-animal-animal-portrait-pet.jpg'),
      L(300, 600, 'https://cdn.adblockcdn.com/pix/Cats/3--x6--/3--x6--/cat-feline-cute-domestic.jpg'),
      L(300, 600, 'https://cdn.adblockcdn.com/pix/Cats/3--x6--/3--x6--/cat-kitten-rozkosne-little.jpg'),
      L(300, 600, 'https://cdn.adblockcdn.com/pix/Cats/3--x6--/3--x6--/domestic-cat-cat-adidas-relaxed.jpg'),
      L(300, 600, 'https://cdn.adblockcdn.com/pix/Cats/3--x6--/3--x6--/eyes-cats-cat-couch.jpg'),
      L(600, 1200, 'https://cdn.adblockcdn.com/pix/Cats/3--x6--/6--x12--/cat-7784.jpg'),
      L(600, 1200, 'https://cdn.adblockcdn.com/pix/Cats/3--x6--/6--x12--/cat-animal-animal-portrait-pet.jpg'),
      L(600, 1200, 'https://cdn.adblockcdn.com/pix/Cats/3--x6--/6--x12--/cat-feline-cute-domestic.jpg'),
      L(600, 1200, 'https://cdn.adblockcdn.com/pix/Cats/3--x6--/6--x12--/cat-kitten-rozkosne-little.jpg'),
      L(600, 1200, 'https://cdn.adblockcdn.com/pix/Cats/3--x6--/6--x12--/domestic-cat-cat-adidas-relaxed.jpg'),
      L(600, 1200, 'https://cdn.adblockcdn.com/pix/Cats/3--x6--/6--x12--/eyes-cats-cat-couch.jpg'),
      L(336, 280, 'https://cdn.adblockcdn.com/pix/Cats/336x28-/336x28-/cat-7784.jpg'),
      L(336, 280, 'https://cdn.adblockcdn.com/pix/Cats/336x28-/336x28-/cat-animal-animal-portrait-pet.jpg'),
      L(336, 280, 'https://cdn.adblockcdn.com/pix/Cats/336x28-/336x28-/cat-feline-cute-domestic.jpg'),
      L(336, 280, 'https://cdn.adblockcdn.com/pix/Cats/336x28-/336x28-/cat-kitten-rozkosne-little.jpg'),
      L(336, 280, 'https://cdn.adblockcdn.com/pix/Cats/336x28-/336x28-/domestic-cat-cat-adidas-relaxed.jpg'),
      L(336, 280, 'https://cdn.adblockcdn.com/pix/Cats/336x28-/336x28-/eyes-cats-cat-couch.jpg'),
      L(672, 560, 'https://cdn.adblockcdn.com/pix/Cats/336x28-/672x56-/cat-7784.jpg'),
      L(672, 560, 'https://cdn.adblockcdn.com/pix/Cats/336x28-/672x56-/cat-animal-animal-portrait-pet.jpg'),
      L(672, 560, 'https://cdn.adblockcdn.com/pix/Cats/336x28-/672x56-/cat-feline-cute-domestic.jpg'),
      L(672, 560, 'https://cdn.adblockcdn.com/pix/Cats/336x28-/672x56-/cat-kitten-rozkosne-little.jpg'),
      L(672, 560, 'https://cdn.adblockcdn.com/pix/Cats/336x28-/672x56-/domestic-cat-cat-adidas-relaxed.jpg'),
      L(672, 560, 'https://cdn.adblockcdn.com/pix/Cats/336x28-/672x56-/eyes-cats-cat-couch.jpg'),
      L(468, 60, 'https://cdn.adblockcdn.com/pix/Cats/468x6-/468x6-/cat_468x6-_01.jpg'),
      L(468, 60, 'https://cdn.adblockcdn.com/pix/Cats/468x6-/468x6-/cat_468x6-_02.jpg'),
      L(468, 60, 'https://cdn.adblockcdn.com/pix/Cats/468x6-/468x6-/cat_468x6-_03.jpg'),
      L(468, 60, 'https://cdn.adblockcdn.com/pix/Cats/468x6-/468x6-/cat_468x6-_04.jpg'),
      L(468, 60, 'https://cdn.adblockcdn.com/pix/Cats/468x6-/468x6-/cat_468x6-_05.jpg'),
      L(468, 60, 'https://cdn.adblockcdn.com/pix/Cats/468x6-/468x6-/-2.jpg'),
      L(468, 60, 'https://cdn.adblockcdn.com/pix/Cats/468x6-/468x6-/-3.jpg'),
      L(468, 60, 'https://cdn.adblockcdn.com/pix/Cats/468x6-/468x6-/-4.jpg'),
      L(468, 60, 'https://cdn.adblockcdn.com/pix/Cats/468x6-/468x6-/-5.jpg'),
      L(468, 60, 'https://cdn.adblockcdn.com/pix/Cats/468x6-/468x6-/cat_468x6-_-3.jpg'),
      L(936, 120, 'https://cdn.adblockcdn.com/pix/Cats/468x6-/936x12-/cat_936x120_01.jpg'),
      L(936, 120, 'https://cdn.adblockcdn.com/pix/Cats/468x6-/936x12-/cat_936x120_02.jpg'),
      L(936, 120, 'https://cdn.adblockcdn.com/pix/Cats/468x6-/936x12-/cat_936x120_03.jpg'),
      L(936, 120, 'https://cdn.adblockcdn.com/pix/Cats/468x6-/936x12-/cat_936x120_04.jpg'),
      L(936, 120, 'https://cdn.adblockcdn.com/pix/Cats/468x6-/936x12-/cat_936x120_05.jpg'),
      L(936, 120, 'https://cdn.adblockcdn.com/pix/Cats/468x6-/936x12-/cat_936x12-_-1.jpg'),
      L(936, 120, 'https://cdn.adblockcdn.com/pix/Cats/468x6-/936x12-/-4.jpg'),
      L(1200, 50, 'https://cdn.adblockcdn.com/pix/Cats/12--x5-/12--x5-/cat_1200x50_01.jpg'),
      L(1200, 50, 'https://cdn.adblockcdn.com/pix/Cats/12--x5-/12--x5-/cat_1200x50_02.jpg'),
      L(1200, 50, 'https://cdn.adblockcdn.com/pix/Cats/12--x5-/12--x5-/cat_1200x50_03.jpg'),
      L(1200, 50, 'https://cdn.adblockcdn.com/pix/Cats/12--x5-/12--x5-/cat_1200x50_04.jpg'),
      L(1200, 50, 'https://cdn.adblockcdn.com/pix/Cats/12--x5-/12--x5-/cat_1200x50_05.jpg'),
      L(1200, 50, 'https://cdn.adblockcdn.com/pix/Cats/12--x5-/12--x5-/-1.jpg'),
      L(1200, 50, 'https://cdn.adblockcdn.com/pix/Cats/12--x5-/12--x5-/-2.jpg'),
      L(1200, 50, 'https://cdn.adblockcdn.com/pix/Cats/12--x5-/12--x5-/-3.jpg'),
      L(1200, 50, 'https://cdn.adblockcdn.com/pix/Cats/12--x5-/12--x5-/cat_12--x5-_-3.jpg'),
      L(1200, 50, 'https://cdn.adblockcdn.com/pix/Cats/12--x5-/12--x5-/cat_12--x5-_-5.jpg'),
      L(2400, 100, 'https://cdn.adblockcdn.com/pix/Cats/12--x5-/24--x1--/cat_2400x100_01.jpg'),
      L(2400, 100, 'https://cdn.adblockcdn.com/pix/Cats/12--x5-/24--x1--/cat_2400x100_02.jpg'),
      L(2400, 100, 'https://cdn.adblockcdn.com/pix/Cats/12--x5-/24--x1--/cat_2400x100_03.jpg'),
      L(2400, 100, 'https://cdn.adblockcdn.com/pix/Cats/12--x5-/24--x1--/cat_2400x100_04.jpg'),
      L(2400, 100, 'https://cdn.adblockcdn.com/pix/Cats/12--x5-/24--x1--/cat_2400x100_05.jpg'),
      L(2400, 100, 'https://cdn.adblockcdn.com/pix/Cats/12--x5-/24--x1--/-1.jpg'),
      L(2400, 100, 'https://cdn.adblockcdn.com/pix/Cats/12--x5-/24--x1--/-2.jpg'),
      L(2400, 100, 'https://cdn.adblockcdn.com/pix/Cats/12--x5-/24--x1--/cat_24--x1--_-2.jpg'),
      L(2400, 100, 'https://cdn.adblockcdn.com/pix/Cats/12--x5-/24--x1--/cat_24--x1--_-4.jpg'),
      L(1090, 43, 'https://cdn.adblockcdn.com/pix/Cats/1-9-x43/1-9-x43/ad_1090x43_01.jpg'),
      L(1090, 43, 'https://cdn.adblockcdn.com/pix/Cats/1-9-x43/1-9-x43/ad_1090x43_02.jpg'),
      L(1090, 43, 'https://cdn.adblockcdn.com/pix/Cats/1-9-x43/1-9-x43/ad_1090x43_03.jpg'),
      L(1090, 43, 'https://cdn.adblockcdn.com/pix/Cats/1-9-x43/1-9-x43/ad_1090x43_04.jpg'),
      L(1090, 43, 'https://cdn.adblockcdn.com/pix/Cats/1-9-x43/1-9-x43/ad_1090x43_05.jpg'),
      L(1090, 43, 'https://cdn.adblockcdn.com/pix/Cats/1-9-x43/1-9-x43/-3.jpg'),
      L(1090, 43, 'https://cdn.adblockcdn.com/pix/Cats/1-9-x43/1-9-x43/-4.jpg'),
      L(1090, 43, 'https://cdn.adblockcdn.com/pix/Cats/1-9-x43/1-9-x43/ad_1-9-x43_-5.jpg'),
      L(2180, 86, 'https://cdn.adblockcdn.com/pix/Cats/1-9-x43/218-x86/cat_2180x86_01.jpg'),
      L(2180, 86, 'https://cdn.adblockcdn.com/pix/Cats/1-9-x43/218-x86/cat_2180x86_02.jpg'),
      L(2180, 86, 'https://cdn.adblockcdn.com/pix/Cats/1-9-x43/218-x86/cat_2180x86_03.jpg'),
      L(2180, 86, 'https://cdn.adblockcdn.com/pix/Cats/1-9-x43/218-x86/cat_2180x86_04.jpg'),
      L(2180, 86, 'https://cdn.adblockcdn.com/pix/Cats/1-9-x43/218-x86/cat_2180x86_05.jpg'),
      L(2180, 86, 'https://cdn.adblockcdn.com/pix/Cats/1-9-x43/218-x86/-2.jpg'),
      L(2180, 86, 'https://cdn.adblockcdn.com/pix/Cats/1-9-x43/218-x86/-3.jpg'),
      L(2180, 86, 'https://cdn.adblockcdn.com/pix/Cats/1-9-x43/218-x86/-4.jpg'),
      L(2180, 86, 'https://cdn.adblockcdn.com/pix/Cats/1-9-x43/218-x86/-5.jpg'),
      L(2180, 86, 'https://cdn.adblockcdn.com/pix/Cats/1-9-x43/218-x86/cat_218-x86_-1.jpg'),
      L(2180, 86, 'https://cdn.adblockcdn.com/pix/Cats/1-9-x43/218-x86/cat_218-x86_-3.jpg'),
      L(450, 62, 'https://cdn.adblockcdn.com/pix/Cats/45-x62/45-x62/cat_450x62_01.jpg'),
      L(450, 62, 'https://cdn.adblockcdn.com/pix/Cats/45-x62/45-x62/cat_450x62_02.jpg'),
      L(450, 62, 'https://cdn.adblockcdn.com/pix/Cats/45-x62/45-x62/cat_450x62_03.jpg'),
      L(450, 62, 'https://cdn.adblockcdn.com/pix/Cats/45-x62/45-x62/cat_450x62_04.jpg'),
      L(450, 62, 'https://cdn.adblockcdn.com/pix/Cats/45-x62/45-x62/cat_450x62_05.jpg'),
      L(450, 62, 'https://cdn.adblockcdn.com/pix/Cats/45-x62/45-x62/-1.jpg'),
      L(450, 62, 'https://cdn.adblockcdn.com/pix/Cats/45-x62/45-x62/-2.jpg'),
      L(900, 124, 'https://cdn.adblockcdn.com/pix/Cats/45-x62/9--x124/cat_900x124_01.jpg'),
      L(900, 124, 'https://cdn.adblockcdn.com/pix/Cats/45-x62/9--x124/cat_900x124_02.jpg'),
      L(900, 124, 'https://cdn.adblockcdn.com/pix/Cats/45-x62/9--x124/cat_900x124_03.jpg'),
      L(900, 124, 'https://cdn.adblockcdn.com/pix/Cats/45-x62/9--x124/cat_900x124_04.jpg'),
      L(900, 124, 'https://cdn.adblockcdn.com/pix/Cats/45-x62/9--x124/cat_900x124_05.jpg'),
      L(900, 124, 'https://cdn.adblockcdn.com/pix/Cats/45-x62/9--x124/-1.jpg'),
      L(900, 124, 'https://cdn.adblockcdn.com/pix/Cats/45-x62/9--x124/-2.jpg'),
      L(900, 124, 'https://cdn.adblockcdn.com/pix/Cats/45-x62/9--x124/-3.jpg'),
      L(900, 124, 'https://cdn.adblockcdn.com/pix/Cats/45-x62/9--x124/-4.jpg'),
      L(900, 124, 'https://cdn.adblockcdn.com/pix/Cats/45-x62/9--x124/-5.jpg'),
      L(900, 124, 'https://cdn.adblockcdn.com/pix/Cats/45-x62/9--x124/cat_9--x124_-1.jpg'),
      L(900, 124, 'https://cdn.adblockcdn.com/pix/Cats/45-x62/9--x124/cat_9--x124_-2.jpg'),
      L(900, 124, 'https://cdn.adblockcdn.com/pix/Cats/45-x62/9--x124/cat_9--x124_-3.jpg'),
      L(900, 124, 'https://cdn.adblockcdn.com/pix/Cats/45-x62/9--x124/cat_9--x124_-4.jpg'),
      L(900, 124, 'https://cdn.adblockcdn.com/pix/Cats/45-x62/9--x124/cat_9--x124_-5.jpg'),
      L(1440, 90, 'https://cdn.adblockcdn.com/pix/Cats/144-x9-/1440x90/cat_1440x90_01.jpg'),
      L(1440, 90, 'https://cdn.adblockcdn.com/pix/Cats/144-x9-/1440x90/cat_1440x90_02.jpg'),
      L(1440, 90, 'https://cdn.adblockcdn.com/pix/Cats/144-x9-/1440x90/cat_1440x90_03.jpg'),
      L(1440, 90, 'https://cdn.adblockcdn.com/pix/Cats/144-x9-/1440x90/cat_1440x90_04.jpg'),
      L(1440, 90, 'https://cdn.adblockcdn.com/pix/Cats/144-x9-/1440x90/cat_1440x90_05.jpg'),
      L(2880, 180, 'https://cdn.adblockcdn.com/pix/Cats/144-x9-/2880x180/cat_2880x180_01.jpg'),
      L(2880, 180, 'https://cdn.adblockcdn.com/pix/Cats/144-x9-/2880x180/cat_2880x180_02.jpg'),
      L(2880, 180, 'https://cdn.adblockcdn.com/pix/Cats/144-x9-/2880x180/cat_2880x180_03.jpg'),
      L(2880, 180, 'https://cdn.adblockcdn.com/pix/Cats/144-x9-/2880x180/cat_2880x180_04.jpg'),
      L(2880, 180, 'https://cdn.adblockcdn.com/pix/Cats/144-x9-/2880x180/cat_2880x180_05.jpg'),
      L(1440, 90, 'https://cdn.adblockcdn.com/pix/Cats/144-x9-/144-x9-/-1.jpg'),
      L(1440, 90, 'https://cdn.adblockcdn.com/pix/Cats/144-x9-/144-x9-/-4.jpg'),
      L(1440, 90, 'https://cdn.adblockcdn.com/pix/Cats/144-x9-/144-x9-/-5.jpg'),
      L(1440, 90, 'https://cdn.adblockcdn.com/pix/Cats/144-x9-/144-x9-/cat_144-x9-_-1.jpg'),
      L(1440, 90, 'https://cdn.adblockcdn.com/pix/Cats/144-x9-/144-x9-/cat_144-x9-_-2.jpg'),
      L(1440, 90, 'https://cdn.adblockcdn.com/pix/Cats/144-x9-/144-x9-/cat_144-x9-_-3.jpg'),
      L(1440, 90, 'https://cdn.adblockcdn.com/pix/Cats/144-x9-/144-x9-/cat_144-x9-_-4.jpg'),
      L(1440, 90, 'https://cdn.adblockcdn.com/pix/Cats/144-x9-/144-x9-/cat_144-x9-_-5.jpg'),
      L(2880, 180, 'https://cdn.adblockcdn.com/pix/Cats/144-x9-/288-x18-/-1.jpg'),
      L(2880, 180, 'https://cdn.adblockcdn.com/pix/Cats/144-x9-/288-x18-/-2.jpg'),
      L(2880, 180, 'https://cdn.adblockcdn.com/pix/Cats/144-x9-/288-x18-/-3.jpg'),
      L(2880, 180, 'https://cdn.adblockcdn.com/pix/Cats/144-x9-/288-x18-/-4.jpg'),
      L(2880, 180, 'https://cdn.adblockcdn.com/pix/Cats/144-x9-/288-x18-/-5.jpg'),
      L(2880, 180, 'https://cdn.adblockcdn.com/pix/Cats/144-x9-/288-x18-/cat_288-x18-_-1.jpg'),
      L(2880, 180, 'https://cdn.adblockcdn.com/pix/Cats/144-x9-/288-x18-/cat_288-x18-_-2.jpg'),
      L(2880, 180, 'https://cdn.adblockcdn.com/pix/Cats/144-x9-/288-x18-/cat_288-x18-_-3.jpg'),
      L(2880, 180, 'https://cdn.adblockcdn.com/pix/Cats/144-x9-/288-x18-/cat_288-x18-_-4.jpg'),
      L(2880, 180, 'https://cdn.adblockcdn.com/pix/Cats/144-x9-/288-x18-/cat_288-x18-_-5.jpg'),
      L(1456, 180, 'https://cdn.adblockcdn.com/pix/Cats/728x9-/1456x18-/cat_1456x180_01.jpg'),
      L(1456, 180, 'https://cdn.adblockcdn.com/pix/Cats/728x9-/1456x18-/cat_1456x180_02.jpg'),
      L(1456, 180, 'https://cdn.adblockcdn.com/pix/Cats/728x9-/1456x18-/cat_1456x180_03.jpg'),
      L(1456, 180, 'https://cdn.adblockcdn.com/pix/Cats/728x9-/1456x18-/cat_1456x180_04.jpg'),
      L(1456, 180, 'https://cdn.adblockcdn.com/pix/Cats/728x9-/1456x18-/cat_1456x180_05.jpg'),
      L(1456, 180, 'https://cdn.adblockcdn.com/pix/Cats/728x9-/1456x18-/cat_1456x18-_01.jpg'),
      L(1456, 180, 'https://cdn.adblockcdn.com/pix/Cats/728x9-/1456x18-/cat_1456x18-_02.jpg'),
      L(1456, 180, 'https://cdn.adblockcdn.com/pix/Cats/728x9-/1456x18-/cat_1456x18-_03.jpg'),
      L(1456, 180, 'https://cdn.adblockcdn.com/pix/Cats/728x9-/1456x18-/cat_1456x18-_04.jpg'),
      L(1456, 180, 'https://cdn.adblockcdn.com/pix/Cats/728x9-/1456x18-/cat_1456x18-_05.jpg'),
      L(1456, 180, 'https://cdn.adblockcdn.com/pix/Cats/728x9-/1456x18-/cat_1456x18-_-3.jpg'),
      L(1456, 180, 'https://cdn.adblockcdn.com/pix/Cats/728x9-/1456x18-/cat_1456x18-_-4.jpg'),
      L(1456, 180, 'https://cdn.adblockcdn.com/pix/Cats/728x9-/1456x18-/cat_1456x18-_-6.jpg'),
      L(1456, 180, 'https://cdn.adblockcdn.com/pix/Cats/728x9-/1456x18-/cat_1456x18-_-7.jpg'),
      L(1456, 180, 'https://cdn.adblockcdn.com/pix/Cats/728x9-/1456x18-/cat_1456x18-_-8.jpg'),
      L(1456, 180, 'https://cdn.adblockcdn.com/pix/Cats/728x9-/1456x18-/cat_1456x18-_1-.jpg'),
      L(728, 90, 'https://cdn.adblockcdn.com/pix/Cats/728x9-/728x9-/cat_728x90_01.jpg'),
      L(728, 90, 'https://cdn.adblockcdn.com/pix/Cats/728x9-/728x9-/cat_728x90_02.jpg'),
      L(728, 90, 'https://cdn.adblockcdn.com/pix/Cats/728x9-/728x9-/cat_728x90_03.jpg'),
      L(728, 90, 'https://cdn.adblockcdn.com/pix/Cats/728x9-/728x9-/cat_728x90_04.jpg'),
      L(728, 90, 'https://cdn.adblockcdn.com/pix/Cats/728x9-/728x9-/cat_728x90_05.jpg'),
      L(728, 90, 'https://cdn.adblockcdn.com/pix/Cats/728x9-/728x9-/cat_728x9-_01.jpg'),
      L(728, 90, 'https://cdn.adblockcdn.com/pix/Cats/728x9-/728x9-/cat_728x9-_02.jpg'),
      L(728, 90, 'https://cdn.adblockcdn.com/pix/Cats/728x9-/728x9-/cat_728x9-_03.jpg'),
      L(728, 90, 'https://cdn.adblockcdn.com/pix/Cats/728x9-/728x9-/cat_728x9-_04.jpg'),
      L(728, 90, 'https://cdn.adblockcdn.com/pix/Cats/728x9-/728x9-/cat_728x9-_05.jpg'),
      L(728, 90, 'https://cdn.adblockcdn.com/pix/Cats/728x9-/728x9-/cat_728x9-_-4.jpg'),
      L(728, 90, 'https://cdn.adblockcdn.com/pix/Cats/728x9-/728x9-/cat_728x9-_-1.jpg'),
      L(340, 90, 'https://cdn.adblockcdn.com/pix/Cats/34-x9-/34-x9-/Cats_34-x9-_01.jpg'),
      L(340, 90, 'https://cdn.adblockcdn.com/pix/Cats/34-x9-/34-x9-/Cats_34-x9-_02.jpg'),
      L(340, 90, 'https://cdn.adblockcdn.com/pix/Cats/34-x9-/34-x9-/Cats_34-x9-_03.jpg'),
      L(340, 90, 'https://cdn.adblockcdn.com/pix/Cats/34-x9-/34-x9-/Cats_34-x9-_04.jpg'),
      L(340, 90, 'https://cdn.adblockcdn.com/pix/Cats/34-x9-/34-x9-/Cats_34-x9-_05.jpg'),
      L(680, 180, 'https://cdn.adblockcdn.com/pix/Cats/34-x9-/68-x18-/Cats_68-x18-_01.jpg'),
      L(680, 180, 'https://cdn.adblockcdn.com/pix/Cats/34-x9-/68-x18-/Cats_68-x18-_02.jpg'),
      L(680, 180, 'https://cdn.adblockcdn.com/pix/Cats/34-x9-/68-x18-/Cats_68-x18-_03.jpg'),
      L(680, 180, 'https://cdn.adblockcdn.com/pix/Cats/34-x9-/68-x18-/Cats_68-x18-_04.jpg'),
      L(680, 180, 'https://cdn.adblockcdn.com/pix/Cats/34-x9-/68-x18-/Cats_68-x18-_05.jpg'),
      L(680, 180, 'https://cdn.adblockcdn.com/pix/Cats/34-x9-/68-x18-/Cats_68-x18-_-1.jpg'),
      L(680, 180, 'https://cdn.adblockcdn.com/pix/Cats/34-x9-/68-x18-/Cats_68-x18-_-2.jpg'),
      L(680, 180, 'https://cdn.adblockcdn.com/pix/Cats/34-x9-/68-x18-/Cats_68-x18-_-4.jpg'),
      L(680, 180, 'https://cdn.adblockcdn.com/pix/Cats/34-x9-/68-x18-/Cats_68-x18-_-5.jpg'),
      L(680, 180, 'https://cdn.adblockcdn.com/pix/Cats/34-x9-/68-x18-/Cats_68-x18-_-9.jpg'),
      L(680, 180, 'https://cdn.adblockcdn.com/pix/Cats/34-x9-/68-x18-/Cats_68-x18-_1-.jpg'),
      L(680, 180, 'https://cdn.adblockcdn.com/pix/Cats/34-x9-/68-x18-/Cats_68-x18-_11.jpg'),
      L(320, 1200, 'https://cdn.adblockcdn.com/pix/Cats/16-x6--/32-x12--/cat-kitten-rozkosne-little.jpg'),
      L(320, 1200, 'https://cdn.adblockcdn.com/pix/Cats/16-x6--/32-x12--/cat-7784.jpg'),
      L(1120, 1344, 'https://cdn.adblockcdn.com/pix/Cats/56-x672/112-x1344/pexels-photo-437886.jpg'),
      L(1120, 1344, 'https://cdn.adblockcdn.com/pix/Cats/56-x672/112-x1344/pexels-photo-2-8845.jpg'),
      L(1120, 1344, 'https://cdn.adblockcdn.com/pix/Cats/56-x672/112-x1344/pexels-photo-21--81.jpg'),
      L(1120, 1344, 'https://cdn.adblockcdn.com/pix/Cats/56-x672/112-x1344/pexels-photo-22-983.jpg'),
      L(560, 672, 'https://cdn.adblockcdn.com/pix/Cats/56-x672/56-x672/pexels-photo-22-97-.jpg'),
      L(560, 672, 'https://cdn.adblockcdn.com/pix/Cats/56-x672/56-x672/pexels-photo-416138.jpg'),
      L(560, 672, 'https://cdn.adblockcdn.com/pix/Cats/56-x672/56-x672/pexels-photo-59659-.jpg'),
      L(560, 672, 'https://cdn.adblockcdn.com/pix/Cats/56-x672/56-x672/pexels-photo-731553.jpg'),
      L(560, 672, 'https://cdn.adblockcdn.com/pix/Cats/56-x672/56-x672/pexels-photo-89951.jpg'),
      L(180, 680, 'https://cdn.adblockcdn.com/pix/Cats/18-x68-/18-x68-/cat-7784.jpg'),
      L(180, 680, 'https://cdn.adblockcdn.com/pix/Cats/18-x68-/18-x68-/cat-82-72.jpg'),
      L(180, 680, 'https://cdn.adblockcdn.com/pix/Cats/18-x68-/18-x68-/cat-feline-cute-domestic.jpg'),
      L(180, 680, 'https://cdn.adblockcdn.com/pix/Cats/18-x68-/18-x68-/domestic-cat-cat-adidas-relaxed.jpg'),
      L(180, 680, 'https://cdn.adblockcdn.com/pix/Cats/18-x68-/18-x68-/pexels-photo-1-5587.jpg'),
      L(180, 680, 'https://cdn.adblockcdn.com/pix/Cats/18-x68-/18-x68-/pexels-photo-1-6131.jpg'),
      L(180, 680, 'https://cdn.adblockcdn.com/pix/Cats/18-x68-/18-x68-/pexels-photo-142615.jpg'),
      L(180, 680, 'https://cdn.adblockcdn.com/pix/Cats/18-x68-/18-x68-/pexels-photo-17242-.jpg'),
      L(180, 680, 'https://cdn.adblockcdn.com/pix/Cats/18-x68-/18-x68-/pexels-photo-1739-9.jpg'),
      L(180, 680, 'https://cdn.adblockcdn.com/pix/Cats/18-x68-/18-x68-/pexels-photo-2-8845.jpg'),
      L(180, 680, 'https://cdn.adblockcdn.com/pix/Cats/18-x68-/18-x68-/pexels-photo-2-886-.jpg'),
      L(180, 680, 'https://cdn.adblockcdn.com/pix/Cats/18-x68-/18-x68-/pexels-photo-2-888-.jpg'),
      L(180, 680, 'https://cdn.adblockcdn.com/pix/Cats/18-x68-/18-x68-/pexels-photo-2-89-6.jpg'),
      L(180, 680, 'https://cdn.adblockcdn.com/pix/Cats/18-x68-/18-x68-/pexels-photo-2-89-7.jpg'),
      L(180, 680, 'https://cdn.adblockcdn.com/pix/Cats/18-x68-/18-x68-/pexels-photo-2-9117.jpg'),
      L(180, 680, 'https://cdn.adblockcdn.com/pix/Cats/18-x68-/18-x68-/pexels-photo-2-98--.jpg'),
      L(180, 680, 'https://cdn.adblockcdn.com/pix/Cats/18-x68-/18-x68-/pexels-photo-22-826.jpg'),
      L(180, 680, 'https://cdn.adblockcdn.com/pix/Cats/18-x68-/18-x68-/pexels-photo-22-876.jpg'),
      L(180, 680, 'https://cdn.adblockcdn.com/pix/Cats/18-x68-/18-x68-/pexels-photo-22-951.jpg'),
      L(180, 680, 'https://cdn.adblockcdn.com/pix/Cats/18-x68-/18-x68-/pexels-photo-22-983.jpg'),
      L(180, 680, 'https://cdn.adblockcdn.com/pix/Cats/18-x68-/18-x68-/pexels-photo-244848.jpg'),
      L(180, 680, 'https://cdn.adblockcdn.com/pix/Cats/18-x68-/18-x68-/pexels-photo-2483-4.jpg'),
      L(180, 680, 'https://cdn.adblockcdn.com/pix/Cats/18-x68-/18-x68-/pexels-photo-416138.jpg'),
      L(180, 680, 'https://cdn.adblockcdn.com/pix/Cats/18-x68-/18-x68-/pexels-photo-549237.jpg'),
      L(180, 680, 'https://cdn.adblockcdn.com/pix/Cats/18-x68-/18-x68-/pexels-photo-59659-.jpg'),
      L(180, 680, 'https://cdn.adblockcdn.com/pix/Cats/18-x68-/18-x68-/pexels-photo-599492.jpg'),
      L(180, 680, 'https://cdn.adblockcdn.com/pix/Cats/18-x68-/18-x68-/pexels-photo-6-5-48.jpg'),
      L(180, 680, 'https://cdn.adblockcdn.com/pix/Cats/18-x68-/18-x68-/pexels-photo-622549.jpg'),
      L(180, 680, 'https://cdn.adblockcdn.com/pix/Cats/18-x68-/18-x68-/pexels-photo-674568.jpg'),
      L(180, 680, 'https://cdn.adblockcdn.com/pix/Cats/18-x68-/18-x68-/pexels-photo-674577.jpg'),
      L(180, 680, 'https://cdn.adblockcdn.com/pix/Cats/18-x68-/18-x68-/pexels-photo-679855.jpg'),
      L(180, 680, 'https://cdn.adblockcdn.com/pix/Cats/18-x68-/18-x68-/pexels-photo-689-42.jpg'),
      L(180, 680, 'https://cdn.adblockcdn.com/pix/Cats/18-x68-/18-x68-/pexels-photo-7-9482.jpg'),
      L(180, 680, 'https://cdn.adblockcdn.com/pix/Cats/18-x68-/18-x68-/pexels-photo-7331-5.jpg'),
      L(180, 680, 'https://cdn.adblockcdn.com/pix/Cats/18-x68-/18-x68-/pexels-photo-736528.jpg'),
      L(180, 680, 'https://cdn.adblockcdn.com/pix/Cats/18-x68-/18-x68-/pexels-photo-745241.jpg'),
      L(180, 680, 'https://cdn.adblockcdn.com/pix/Cats/18-x68-/18-x68-/pexels-photo-749212.jpg'),
      L(360, 1360, 'https://cdn.adblockcdn.com/pix/Cats/18-x68-/36-x136-/cat-7784.jpg'),
      L(360, 1360, 'https://cdn.adblockcdn.com/pix/Cats/18-x68-/36-x136-/cat-82-72.jpg'),
      L(360, 1360, 'https://cdn.adblockcdn.com/pix/Cats/18-x68-/36-x136-/cat-feline-cute-domestic.jpg'),
      L(360, 1360, 'https://cdn.adblockcdn.com/pix/Cats/18-x68-/36-x136-/domestic-cat-cat-adidas-relaxed.jpg'),
      L(360, 1360, 'https://cdn.adblockcdn.com/pix/Cats/18-x68-/36-x136-/pexels-photo-1-5587.jpg'),
      L(360, 1360, 'https://cdn.adblockcdn.com/pix/Cats/18-x68-/36-x136-/pexels-photo-1-6131.jpg'),
      L(360, 1360, 'https://cdn.adblockcdn.com/pix/Cats/18-x68-/36-x136-/pexels-photo-142615.jpg'),
      L(360, 1360, 'https://cdn.adblockcdn.com/pix/Cats/18-x68-/36-x136-/pexels-photo-17242-.jpg'),
      L(360, 1360, 'https://cdn.adblockcdn.com/pix/Cats/18-x68-/36-x136-/pexels-photo-1739-9.jpg'),
      L(360, 1360, 'https://cdn.adblockcdn.com/pix/Cats/18-x68-/36-x136-/pexels-photo-2-8845.jpg'),
      L(360, 1360, 'https://cdn.adblockcdn.com/pix/Cats/18-x68-/36-x136-/pexels-photo-2-886-.jpg'),
      L(360, 1360, 'https://cdn.adblockcdn.com/pix/Cats/18-x68-/36-x136-/pexels-photo-2-888-.jpg'),
      L(360, 1360, 'https://cdn.adblockcdn.com/pix/Cats/18-x68-/36-x136-/pexels-photo-2-89-6.jpg'),
      L(360, 1360, 'https://cdn.adblockcdn.com/pix/Cats/18-x68-/36-x136-/pexels-photo-2-89-7.jpg'),
      L(360, 1360, 'https://cdn.adblockcdn.com/pix/Cats/18-x68-/36-x136-/pexels-photo-2-9117.jpg'),
      L(360, 1360, 'https://cdn.adblockcdn.com/pix/Cats/18-x68-/36-x136-/pexels-photo-2-98--.jpg'),
      L(360, 1360, 'https://cdn.adblockcdn.com/pix/Cats/18-x68-/36-x136-/pexels-photo-22-826.jpg'),
      L(360, 1360, 'https://cdn.adblockcdn.com/pix/Cats/18-x68-/36-x136-/pexels-photo-22-876.jpg'),
      L(360, 1360, 'https://cdn.adblockcdn.com/pix/Cats/18-x68-/36-x136-/pexels-photo-22-951.jpg'),
      L(360, 1360, 'https://cdn.adblockcdn.com/pix/Cats/18-x68-/36-x136-/pexels-photo-22-983.jpg'),
      L(360, 1360, 'https://cdn.adblockcdn.com/pix/Cats/18-x68-/36-x136-/pexels-photo-244848.jpg'),
      L(360, 1360, 'https://cdn.adblockcdn.com/pix/Cats/18-x68-/36-x136-/pexels-photo-2483-4.jpg'),
      L(360, 1360, 'https://cdn.adblockcdn.com/pix/Cats/18-x68-/36-x136-/pexels-photo-416138.jpg'),
      L(360, 1360, 'https://cdn.adblockcdn.com/pix/Cats/18-x68-/36-x136-/pexels-photo-549237.jpg'),
      L(360, 1360, 'https://cdn.adblockcdn.com/pix/Cats/18-x68-/36-x136-/pexels-photo-59659-.jpg'),
      L(360, 1360, 'https://cdn.adblockcdn.com/pix/Cats/18-x68-/36-x136-/pexels-photo-599492.jpg'),
      L(360, 1360, 'https://cdn.adblockcdn.com/pix/Cats/18-x68-/36-x136-/pexels-photo-6-5-48.jpg'),
      L(360, 1360, 'https://cdn.adblockcdn.com/pix/Cats/18-x68-/36-x136-/pexels-photo-622549.jpg'),
      L(360, 1360, 'https://cdn.adblockcdn.com/pix/Cats/18-x68-/36-x136-/pexels-photo-674568.jpg'),
      L(360, 1360, 'https://cdn.adblockcdn.com/pix/Cats/18-x68-/36-x136-/pexels-photo-674577.jpg'),
      L(360, 1360, 'https://cdn.adblockcdn.com/pix/Cats/18-x68-/36-x136-/pexels-photo-679855.jpg'),
      L(360, 1360, 'https://cdn.adblockcdn.com/pix/Cats/18-x68-/36-x136-/pexels-photo-689-42.jpg'),
      L(360, 1360, 'https://cdn.adblockcdn.com/pix/Cats/18-x68-/36-x136-/pexels-photo-7-9482.jpg'),
      L(360, 1360, 'https://cdn.adblockcdn.com/pix/Cats/18-x68-/36-x136-/pexels-photo-7331-5.jpg'),
      L(360, 1360, 'https://cdn.adblockcdn.com/pix/Cats/18-x68-/36-x136-/pexels-photo-736528.jpg'),
      L(360, 1360, 'https://cdn.adblockcdn.com/pix/Cats/18-x68-/36-x136-/pexels-photo-745241.jpg'),
      L(360, 1360, 'https://cdn.adblockcdn.com/pix/Cats/18-x68-/36-x136-/pexels-photo-749212.jpg'),
    ]);
  },
};

Object.assign(window, {
  CatsChannel,
});


/***/ }),
/* 74 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


/* For ESLint: List any global identifiers used in this file below */
/* global Channel, Listing */


// Channel containing hard coded dogs loaded from CDN
// Subclass of Channel.
function DogsChannel() {
  Channel.call(this);
}
DogsChannel.prototype = {
  __proto__: Channel.prototype,

  getLatestListings(callback) {
    const that = this;
    function L(w, h, u) {
      let width = w;
      let height = h;
      const url = u;
      const type = that.calculateType(width, height);

      if (typeof width === 'number') {
        width = `${width}`;
      }
      if (typeof height === 'number') {
        height = `${height}`;
      }
      return new Listing({
        width,
        height,
        url,
        attributionUrl: url,
        type,
        ratio: Math.max(width, height) / Math.min(width, height),
        title: 'This is a dog!',
        channelName: 'dogchannelswitchlabel', // message.json key for channel name
      });
    }
    // the listings never change
    callback([
      L(1200, 628, 'https://cdn.adblockcdn.com/pix/Dogs/12--x628/12--x628/animal-dog-golden-retriever-9716.jpg'),
      L(1200, 628, 'https://cdn.adblockcdn.com/pix/Dogs/12--x628/12--x628/animal-dog-pet-brown.jpg'),
      L(1200, 628, 'https://cdn.adblockcdn.com/pix/Dogs/12--x628/12--x628/bordeaux-mastiff-dog-animal.jpg'),
      L(1200, 628, 'https://cdn.adblockcdn.com/pix/Dogs/12--x628/12--x628/dalmatians-dog-animal-head.jpg'),
      L(1200, 628, 'https://cdn.adblockcdn.com/pix/Dogs/12--x628/12--x628/dog-brown-snout-fur.jpg'),
      L(1200, 628, 'https://cdn.adblockcdn.com/pix/Dogs/12--x628/12--x628/dog-cute-pet.jpg'),
      L(1200, 628, 'https://cdn.adblockcdn.com/pix/Dogs/12--x628/12--x628/dog-young-dog-small-dog-maltese.jpg'),
      L(1200, 628, 'https://cdn.adblockcdn.com/pix/Dogs/12--x628/12--x628/nature-animal-dog-pet.jpg'),
      L(1200, 628, 'https://cdn.adblockcdn.com/pix/Dogs/12--x628/12--x628/night-animal-dog-pet.jpg'),
      L(1200, 628, 'https://cdn.adblockcdn.com/pix/Dogs/12--x628/12--x628/night-garden-yellow-animal.jpg'),
      L(1200, 628, 'https://cdn.adblockcdn.com/pix/Dogs/12--x628/12--x628/wall-animal-dog-pet.jpg'),
      L(2400, 1256, 'https://cdn.adblockcdn.com/pix/Dogs/12--x628/24--x1256/animal-dog-golden-retriever-9716.jpg'),
      L(2400, 1256, 'https://cdn.adblockcdn.com/pix/Dogs/12--x628/24--x1256/animal-dog-pet-brown.jpg'),
      L(2400, 1256, 'https://cdn.adblockcdn.com/pix/Dogs/12--x628/24--x1256/bordeaux-mastiff-dog-animal.jpg'),
      L(2400, 1256, 'https://cdn.adblockcdn.com/pix/Dogs/12--x628/24--x1256/dalmatians-dog-animal-head.jpg'),
      L(2400, 1256, 'https://cdn.adblockcdn.com/pix/Dogs/12--x628/24--x1256/dog-brown-snout-fur.jpg'),
      L(2400, 1256, 'https://cdn.adblockcdn.com/pix/Dogs/12--x628/24--x1256/dog-cute-pet.jpg'),
      L(2400, 1256, 'https://cdn.adblockcdn.com/pix/Dogs/12--x628/24--x1256/dog-young-dog-small-dog-maltese.jpg'),
      L(2400, 1256, 'https://cdn.adblockcdn.com/pix/Dogs/12--x628/24--x1256/nature-animal-dog-pet.jpg'),
      L(2400, 1256, 'https://cdn.adblockcdn.com/pix/Dogs/12--x628/24--x1256/night-animal-dog-pet.jpg'),
      L(2400, 1256, 'https://cdn.adblockcdn.com/pix/Dogs/12--x628/24--x1256/night-garden-yellow-animal.jpg'),
      L(2400, 1256, 'https://cdn.adblockcdn.com/pix/Dogs/12--x628/24--x1256/wall-animal-dog-pet.jpg'),
      L(300, 250, 'https://cdn.adblockcdn.com/pix/Dogs/3--x25-/3--x25-/animal-dog-golden-retriever-9716.jpg'),
      L(300, 250, 'https://cdn.adblockcdn.com/pix/Dogs/3--x25-/3--x25-/animal-dog-pet-brown.jpg'),
      L(300, 250, 'https://cdn.adblockcdn.com/pix/Dogs/3--x25-/3--x25-/bordeaux-mastiff-dog-animal.jpg'),
      L(300, 250, 'https://cdn.adblockcdn.com/pix/Dogs/3--x25-/3--x25-/dalmatians-dog-animal-head.jpg'),
      L(300, 250, 'https://cdn.adblockcdn.com/pix/Dogs/3--x25-/3--x25-/dog-brown-snout-fur.jpg'),
      L(300, 250, 'https://cdn.adblockcdn.com/pix/Dogs/3--x25-/3--x25-/dog-cute-pet.jpg'),
      L(300, 250, 'https://cdn.adblockcdn.com/pix/Dogs/3--x25-/3--x25-/dog-young-dog-small-dog-maltese.jpg'),
      L(300, 250, 'https://cdn.adblockcdn.com/pix/Dogs/3--x25-/3--x25-/nature-animal-dog-pet.jpg'),
      L(300, 250, 'https://cdn.adblockcdn.com/pix/Dogs/3--x25-/3--x25-/night-animal-dog-pet.jpg'),
      L(300, 250, 'https://cdn.adblockcdn.com/pix/Dogs/3--x25-/3--x25-/night-garden-yellow-animal.jpg'),
      L(300, 250, 'https://cdn.adblockcdn.com/pix/Dogs/3--x25-/3--x25-/wall-animal-dog-pet.jpg'),
      L(600, 500, 'https://cdn.adblockcdn.com/pix/Dogs/3--x25-/6--x5--/animal-dog-golden-retriever-9716.jpg'),
      L(600, 500, 'https://cdn.adblockcdn.com/pix/Dogs/3--x25-/6--x5--/animal-dog-pet-brown.jpg'),
      L(600, 500, 'https://cdn.adblockcdn.com/pix/Dogs/3--x25-/6--x5--/bordeaux-mastiff-dog-animal.jpg'),
      L(600, 500, 'https://cdn.adblockcdn.com/pix/Dogs/3--x25-/6--x5--/dalmatians-dog-animal-head.jpg'),
      L(600, 500, 'https://cdn.adblockcdn.com/pix/Dogs/3--x25-/6--x5--/dog-brown-snout-fur.jpg'),
      L(600, 500, 'https://cdn.adblockcdn.com/pix/Dogs/3--x25-/6--x5--/dog-cute-pet.jpg'),
      L(600, 500, 'https://cdn.adblockcdn.com/pix/Dogs/3--x25-/6--x5--/dog-young-dog-small-dog-maltese.jpg'),
      L(600, 500, 'https://cdn.adblockcdn.com/pix/Dogs/3--x25-/6--x5--/nature-animal-dog-pet.jpg'),
      L(600, 500, 'https://cdn.adblockcdn.com/pix/Dogs/3--x25-/6--x5--/night-animal-dog-pet.jpg'),
      L(600, 500, 'https://cdn.adblockcdn.com/pix/Dogs/3--x25-/6--x5--/night-garden-yellow-animal.jpg'),
      L(600, 500, 'https://cdn.adblockcdn.com/pix/Dogs/3--x25-/6--x5--/wall-animal-dog-pet.jpg'),
      L(300, 600, 'https://cdn.adblockcdn.com/pix/Dogs/3--x6--/3--x6--/animal-dog-golden-retriever-9716.jpg'),
      L(300, 600, 'https://cdn.adblockcdn.com/pix/Dogs/3--x6--/3--x6--/animal-dog-pet-brown.jpg'),
      L(300, 600, 'https://cdn.adblockcdn.com/pix/Dogs/3--x6--/3--x6--/bordeaux-mastiff-dog-animal.jpg'),
      L(300, 600, 'https://cdn.adblockcdn.com/pix/Dogs/3--x6--/3--x6--/dalmatians-dog-animal-head.jpg'),
      L(300, 600, 'https://cdn.adblockcdn.com/pix/Dogs/3--x6--/3--x6--/dog-brown-snout-fur.jpg'),
      L(300, 600, 'https://cdn.adblockcdn.com/pix/Dogs/3--x6--/3--x6--/dog-cute-pet.jpg'),
      L(300, 600, 'https://cdn.adblockcdn.com/pix/Dogs/3--x6--/3--x6--/dog-young-dog-small-dog-maltese.jpg'),
      L(300, 600, 'https://cdn.adblockcdn.com/pix/Dogs/3--x6--/3--x6--/nature-animal-dog-pet.jpg'),
      L(300, 600, 'https://cdn.adblockcdn.com/pix/Dogs/3--x6--/3--x6--/night-animal-dog-pet.jpg'),
      L(300, 600, 'https://cdn.adblockcdn.com/pix/Dogs/3--x6--/3--x6--/night-garden-yellow-animal.jpg'),
      L(300, 600, 'https://cdn.adblockcdn.com/pix/Dogs/3--x6--/3--x6--/wall-animal-dog-pet.jpg'),
      L(600, 1200, 'https://cdn.adblockcdn.com/pix/Dogs/3--x6--/6--x12--/animal-dog-golden-retriever-9716.jpg'),
      L(600, 1200, 'https://cdn.adblockcdn.com/pix/Dogs/3--x6--/6--x12--/animal-dog-pet-brown.jpg'),
      L(600, 1200, 'https://cdn.adblockcdn.com/pix/Dogs/3--x6--/6--x12--/bordeaux-mastiff-dog-animal.jpg'),
      L(600, 1200, 'https://cdn.adblockcdn.com/pix/Dogs/3--x6--/6--x12--/dalmatians-dog-animal-head.jpg'),
      L(600, 1200, 'https://cdn.adblockcdn.com/pix/Dogs/3--x6--/6--x12--/dog-brown-snout-fur.jpg'),
      L(600, 1200, 'https://cdn.adblockcdn.com/pix/Dogs/3--x6--/6--x12--/dog-cute-pet.jpg'),
      L(600, 1200, 'https://cdn.adblockcdn.com/pix/Dogs/3--x6--/6--x12--/dog-young-dog-small-dog-maltese.jpg'),
      L(600, 1200, 'https://cdn.adblockcdn.com/pix/Dogs/3--x6--/6--x12--/nature-animal-dog-pet.jpg'),
      L(600, 1200, 'https://cdn.adblockcdn.com/pix/Dogs/3--x6--/6--x12--/night-animal-dog-pet.jpg'),
      L(600, 1200, 'https://cdn.adblockcdn.com/pix/Dogs/3--x6--/6--x12--/night-garden-yellow-animal.jpg'),
      L(600, 1200, 'https://cdn.adblockcdn.com/pix/Dogs/3--x6--/6--x12--/wall-animal-dog-pet.jpg'),
      L(336, 280, 'https://cdn.adblockcdn.com/pix/Dogs/336x28-/336x28-/animal-dog-golden-retriever-9716.jpg'),
      L(336, 280, 'https://cdn.adblockcdn.com/pix/Dogs/336x28-/336x28-/animal-dog-pet-brown.jpg'),
      L(336, 280, 'https://cdn.adblockcdn.com/pix/Dogs/336x28-/336x28-/bordeaux-mastiff-dog-animal.jpg'),
      L(336, 280, 'https://cdn.adblockcdn.com/pix/Dogs/336x28-/336x28-/dalmatians-dog-animal-head.jpg'),
      L(336, 280, 'https://cdn.adblockcdn.com/pix/Dogs/336x28-/336x28-/dog-brown-snout-fur.jpg'),
      L(336, 280, 'https://cdn.adblockcdn.com/pix/Dogs/336x28-/336x28-/dog-cute-pet.jpg'),
      L(336, 280, 'https://cdn.adblockcdn.com/pix/Dogs/336x28-/336x28-/dog-young-dog-small-dog-maltese.jpg'),
      L(336, 280, 'https://cdn.adblockcdn.com/pix/Dogs/336x28-/336x28-/nature-animal-dog-pet.jpg'),
      L(336, 280, 'https://cdn.adblockcdn.com/pix/Dogs/336x28-/336x28-/night-animal-dog-pet.jpg'),
      L(336, 280, 'https://cdn.adblockcdn.com/pix/Dogs/336x28-/336x28-/night-garden-yellow-animal.jpg'),
      L(336, 280, 'https://cdn.adblockcdn.com/pix/Dogs/336x28-/336x28-/wall-animal-dog-pet.jpg'),
      L(672, 560, 'https://cdn.adblockcdn.com/pix/Dogs/336x28-/672x56-/animal-dog-golden-retriever-9716.jpg'),
      L(672, 560, 'https://cdn.adblockcdn.com/pix/Dogs/336x28-/672x56-/animal-dog-pet-brown.jpg'),
      L(672, 560, 'https://cdn.adblockcdn.com/pix/Dogs/336x28-/672x56-/bordeaux-mastiff-dog-animal.jpg'),
      L(672, 560, 'https://cdn.adblockcdn.com/pix/Dogs/336x28-/672x56-/dalmatians-dog-animal-head.jpg'),
      L(672, 560, 'https://cdn.adblockcdn.com/pix/Dogs/336x28-/672x56-/dog-brown-snout-fur.jpg'),
      L(672, 560, 'https://cdn.adblockcdn.com/pix/Dogs/336x28-/672x56-/dog-cute-pet.jpg'),
      L(672, 560, 'https://cdn.adblockcdn.com/pix/Dogs/336x28-/672x56-/dog-young-dog-small-dog-maltese.jpg'),
      L(672, 560, 'https://cdn.adblockcdn.com/pix/Dogs/336x28-/672x56-/nature-animal-dog-pet.jpg'),
      L(672, 560, 'https://cdn.adblockcdn.com/pix/Dogs/336x28-/672x56-/night-animal-dog-pet.jpg'),
      L(672, 560, 'https://cdn.adblockcdn.com/pix/Dogs/336x28-/672x56-/night-garden-yellow-animal.jpg'),
      L(672, 560, 'https://cdn.adblockcdn.com/pix/Dogs/336x28-/672x56-/wall-animal-dog-pet.jpg'),
      L(468, 60, 'https://cdn.adblockcdn.com/pix/Dogs/468x6-/468x6-/dog_468x6-_01.jpg'),
      L(468, 60, 'https://cdn.adblockcdn.com/pix/Dogs/468x6-/468x6-/dog_468x6-_02.jpg'),
      L(468, 60, 'https://cdn.adblockcdn.com/pix/Dogs/468x6-/468x6-/dog_468x6-_03.jpg'),
      L(468, 60, 'https://cdn.adblockcdn.com/pix/Dogs/468x6-/468x6-/dog_468x6-_04.jpg'),
      L(468, 60, 'https://cdn.adblockcdn.com/pix/Dogs/468x6-/468x6-/dog_468x6-_05.jpg'),
      L(468, 60, 'https://cdn.adblockcdn.com/pix/Dogs/468x6-/468x6-/-3.jpg'),
      L(468, 60, 'https://cdn.adblockcdn.com/pix/Dogs/468x6-/468x6-/-4.jpg'),
      L(468, 60, 'https://cdn.adblockcdn.com/pix/Dogs/468x6-/468x6-/dog_468x6-_-2.jpg'),
      L(468, 60, 'https://cdn.adblockcdn.com/pix/Dogs/468x6-/468x6-/dog_468x6-_-4.jpg'),
      L(936, 120, 'https://cdn.adblockcdn.com/pix/Dogs/468x6-/936x12-/dog_936x120_01.jpg'),
      L(936, 120, 'https://cdn.adblockcdn.com/pix/Dogs/468x6-/936x12-/dog_936x120_02.jpg'),
      L(936, 120, 'https://cdn.adblockcdn.com/pix/Dogs/468x6-/936x12-/dog_936x120_03.jpg'),
      L(936, 120, 'https://cdn.adblockcdn.com/pix/Dogs/468x6-/936x12-/dog_936x120_04.jpg'),
      L(936, 120, 'https://cdn.adblockcdn.com/pix/Dogs/468x6-/936x12-/dog_936x120_05.jpg'),
      L(936, 120, 'https://cdn.adblockcdn.com/pix/Dogs/468x6-/936x12-/-1.jpg'),
      L(936, 120, 'https://cdn.adblockcdn.com/pix/Dogs/468x6-/936x12-/-2.jpg'),
      L(936, 120, 'https://cdn.adblockcdn.com/pix/Dogs/468x6-/936x12-/-3.jpg'),
      L(936, 120, 'https://cdn.adblockcdn.com/pix/Dogs/468x6-/936x12-/-4.jpg'),
      L(936, 120, 'https://cdn.adblockcdn.com/pix/Dogs/468x6-/936x12-/-5.jpg'),
      L(936, 120, 'https://cdn.adblockcdn.com/pix/Dogs/468x6-/936x12-/dog_936x12-_-1.jpg'),
      L(936, 120, 'https://cdn.adblockcdn.com/pix/Dogs/468x6-/936x12-/dog_936x12-_-2.jpg'),
      L(936, 120, 'https://cdn.adblockcdn.com/pix/Dogs/468x6-/936x12-/dog_936x12-_-4.jpg'),
      L(936, 120, 'https://cdn.adblockcdn.com/pix/Dogs/468x6-/936x12-/dog_936x12-_-5.jpg'),
      L(450, 62, 'https://cdn.adblockcdn.com/pix/Dogs/45-x62/45-x62/dog_450x62_01.jpg'),
      L(450, 62, 'https://cdn.adblockcdn.com/pix/Dogs/45-x62/45-x62/dog_450x62_02.jpg'),
      L(450, 62, 'https://cdn.adblockcdn.com/pix/Dogs/45-x62/45-x62/dog_450x62_03.jpg'),
      L(450, 62, 'https://cdn.adblockcdn.com/pix/Dogs/45-x62/45-x62/dog_450x62_04.jpg'),
      L(450, 62, 'https://cdn.adblockcdn.com/pix/Dogs/45-x62/45-x62/dog_450x62_05.jpg'),
      L(450, 62, 'https://cdn.adblockcdn.com/pix/Dogs/45-x62/45-x62/-4.jpg'),
      L(450, 62, 'https://cdn.adblockcdn.com/pix/Dogs/45-x62/45-x62/-5.jpg'),
      L(450, 62, 'https://cdn.adblockcdn.com/pix/Dogs/45-x62/45-x62/dog_45-x62_-1.jpg'),
      L(900, 124, 'https://cdn.adblockcdn.com/pix/Dogs/45-x62/9--x124/dog_900x124_01.jpg'),
      L(900, 124, 'https://cdn.adblockcdn.com/pix/Dogs/45-x62/9--x124/dog_900x124_02.jpg'),
      L(900, 124, 'https://cdn.adblockcdn.com/pix/Dogs/45-x62/9--x124/dog_900x124_03.jpg'),
      L(900, 124, 'https://cdn.adblockcdn.com/pix/Dogs/45-x62/9--x124/dog_900x124_04.jpg'),
      L(900, 124, 'https://cdn.adblockcdn.com/pix/Dogs/45-x62/9--x124/dog_900x124_05.jpg'),
      L(900, 124, 'https://cdn.adblockcdn.com/pix/Dogs/45-x62/9--x124/-1.jpg'),
      L(900, 124, 'https://cdn.adblockcdn.com/pix/Dogs/45-x62/9--x124/-3.jpg'),
      L(900, 124, 'https://cdn.adblockcdn.com/pix/Dogs/45-x62/9--x124/-4.jpg'),
      L(900, 124, 'https://cdn.adblockcdn.com/pix/Dogs/45-x62/9--x124/-5.jpg'),
      L(900, 124, 'https://cdn.adblockcdn.com/pix/Dogs/45-x62/9--x124/dog_9--x124_-1.jpg'),
      L(900, 124, 'https://cdn.adblockcdn.com/pix/Dogs/45-x62/9--x124/dog_9--x124_-2.jpg'),
      L(900, 124, 'https://cdn.adblockcdn.com/pix/Dogs/45-x62/9--x124/dog_9--x124_-3.jpg'),
      L(900, 124, 'https://cdn.adblockcdn.com/pix/Dogs/45-x62/9--x124/dog_9--x124_-4.jpg'),
      L(900, 124, 'https://cdn.adblockcdn.com/pix/Dogs/45-x62/9--x124/dog_9--x124_-5.jpg'),
      L(1090, 43, 'https://cdn.adblockcdn.com/pix/Dogs/1-9-x43/1-9-x43/dog_1090x43_01.jpg'),
      L(1090, 43, 'https://cdn.adblockcdn.com/pix/Dogs/1-9-x43/1-9-x43/dog_1090x43_02.jpg'),
      L(1090, 43, 'https://cdn.adblockcdn.com/pix/Dogs/1-9-x43/1-9-x43/dog_1090x43_03.jpg'),
      L(1090, 43, 'https://cdn.adblockcdn.com/pix/Dogs/1-9-x43/1-9-x43/dog_1090x43_04.jpg'),
      L(1090, 43, 'https://cdn.adblockcdn.com/pix/Dogs/1-9-x43/1-9-x43/dog_1090x43_05.jpg'),
      L(1090, 43, 'https://cdn.adblockcdn.com/pix/Dogs/1-9-x43/1-9-x43/-2.jpg'),
      L(1090, 43, 'https://cdn.adblockcdn.com/pix/Dogs/1-9-x43/1-9-x43/-3.jpg'),
      L(1090, 43, 'https://cdn.adblockcdn.com/pix/Dogs/1-9-x43/1-9-x43/dog_1-9-x43_-1.jpg'),
      L(1090, 43, 'https://cdn.adblockcdn.com/pix/Dogs/1-9-x43/1-9-x43/dog_1-9-x43_-2.jpg'),
      L(1090, 43, 'https://cdn.adblockcdn.com/pix/Dogs/1-9-x43/1-9-x43/dog_1-9-x43_-3.jpg'),
      L(2180, 86, 'https://cdn.adblockcdn.com/pix/Dogs/1-9-x43/218-x86/dog_2180x86_01.jpg'),
      L(2180, 86, 'https://cdn.adblockcdn.com/pix/Dogs/1-9-x43/218-x86/dog_2180x86_02.jpg'),
      L(2180, 86, 'https://cdn.adblockcdn.com/pix/Dogs/1-9-x43/218-x86/dog_2180x86_03.jpg'),
      L(2180, 86, 'https://cdn.adblockcdn.com/pix/Dogs/1-9-x43/218-x86/dog_2180x86_04.jpg'),
      L(2180, 86, 'https://cdn.adblockcdn.com/pix/Dogs/1-9-x43/218-x86/dog_2180x86_05.jpg'),
      L(2180, 86, 'https://cdn.adblockcdn.com/pix/Dogs/1-9-x43/218-x86/-1.jpg'),
      L(2180, 86, 'https://cdn.adblockcdn.com/pix/Dogs/1-9-x43/218-x86/-2.jpg'),
      L(2180, 86, 'https://cdn.adblockcdn.com/pix/Dogs/1-9-x43/218-x86/-3.jpg'),
      L(2180, 86, 'https://cdn.adblockcdn.com/pix/Dogs/1-9-x43/218-x86/-5.jpg'),
      L(2180, 86, 'https://cdn.adblockcdn.com/pix/Dogs/1-9-x43/218-x86/dog_218-x86_-2.jpg'),
      L(2180, 86, 'https://cdn.adblockcdn.com/pix/Dogs/1-9-x43/218-x86/dog_218-x86_-3.jpg'),
      L(2180, 86, 'https://cdn.adblockcdn.com/pix/Dogs/1-9-x43/218-x86/dog_218-x86_-4.jpg'),
      L(1200, 50, 'https://cdn.adblockcdn.com/pix/Dogs/12--x5-/12--x5-/dog_1200x50_01.jpg'),
      L(1200, 50, 'https://cdn.adblockcdn.com/pix/Dogs/12--x5-/12--x5-/dog_1200x50_02.jpg'),
      L(1200, 50, 'https://cdn.adblockcdn.com/pix/Dogs/12--x5-/12--x5-/dog_1200x50_03.jpg'),
      L(1200, 50, 'https://cdn.adblockcdn.com/pix/Dogs/12--x5-/12--x5-/dog_1200x50_04.jpg'),
      L(1200, 50, 'https://cdn.adblockcdn.com/pix/Dogs/12--x5-/12--x5-/dog_1200x50_05.jpg'),
      L(1200, 50, 'https://cdn.adblockcdn.com/pix/Dogs/12--x5-/12--x5-/-2.jpg'),
      L(1200, 50, 'https://cdn.adblockcdn.com/pix/Dogs/12--x5-/12--x5-/dog_12--x5-_-2.jpg'),
      L(1200, 50, 'https://cdn.adblockcdn.com/pix/Dogs/12--x5-/12--x5-/dog_12--x5-_-3.jpg'),
      L(2400, 100, 'https://cdn.adblockcdn.com/pix/Dogs/12--x5-/24--x1--/dog_2400x100_01.jpg'),
      L(2400, 100, 'https://cdn.adblockcdn.com/pix/Dogs/12--x5-/24--x1--/dog_2400x100_02.jpg'),
      L(2400, 100, 'https://cdn.adblockcdn.com/pix/Dogs/12--x5-/24--x1--/dog_2400x100_03.jpg'),
      L(2400, 100, 'https://cdn.adblockcdn.com/pix/Dogs/12--x5-/24--x1--/dog_2400x100_04.jpg'),
      L(2400, 100, 'https://cdn.adblockcdn.com/pix/Dogs/12--x5-/24--x1--/dog_2400x100_05.jpg'),
      L(2400, 100, 'https://cdn.adblockcdn.com/pix/Dogs/12--x5-/24--x1--/-3.jpg'),
      L(2400, 100, 'https://cdn.adblockcdn.com/pix/Dogs/12--x5-/24--x1--/-4.jpg'),
      L(2400, 100, 'https://cdn.adblockcdn.com/pix/Dogs/12--x5-/24--x1--/dog_24--x1--_-1.jpg'),
      L(2400, 100, 'https://cdn.adblockcdn.com/pix/Dogs/12--x5-/24--x1--/dog_24--x1--_-4.jpg'),
      L(1440, 90, 'https://cdn.adblockcdn.com/pix/Dogs/144-x9-/144-x9-/dog_1440x90_01.jpg'),
      L(1440, 90, 'https://cdn.adblockcdn.com/pix/Dogs/144-x9-/144-x9-/dog_1440x90_02.jpg'),
      L(1440, 90, 'https://cdn.adblockcdn.com/pix/Dogs/144-x9-/144-x9-/dog_1440x90_03.jpg'),
      L(1440, 90, 'https://cdn.adblockcdn.com/pix/Dogs/144-x9-/144-x9-/dog_1440x90_04.jpg'),
      L(1440, 90, 'https://cdn.adblockcdn.com/pix/Dogs/144-x9-/144-x9-/dog_1440x90_05.jpg'),
      L(1440, 90, 'https://cdn.adblockcdn.com/pix/Dogs/144-x9-/144-x9-/-5.jpg'),
      L(1440, 90, 'https://cdn.adblockcdn.com/pix/Dogs/144-x9-/144-x9-/dog_144-x9-_-2.jpg'),
      L(2880, 180, 'https://cdn.adblockcdn.com/pix/Dogs/144-x9-/288-x18-/dog_2880x180_01.jpg'),
      L(2880, 180, 'https://cdn.adblockcdn.com/pix/Dogs/144-x9-/288-x18-/dog_2880x180_02.jpg'),
      L(2880, 180, 'https://cdn.adblockcdn.com/pix/Dogs/144-x9-/288-x18-/dog_2880x180_03.jpg'),
      L(2880, 180, 'https://cdn.adblockcdn.com/pix/Dogs/144-x9-/288-x18-/dog_2880x180_04.jpg'),
      L(2880, 180, 'https://cdn.adblockcdn.com/pix/Dogs/144-x9-/288-x18-/dog_2880x180_05.jpg'),
      L(2880, 180, 'https://cdn.adblockcdn.com/pix/Dogs/144-x9-/288-x18-/-2.jpg'),
      L(2880, 180, 'https://cdn.adblockcdn.com/pix/Dogs/144-x9-/288-x18-/dog_288-x18-_-5.jpg'),
      L(2880, 180, 'https://cdn.adblockcdn.com/pix/Dogs/144-x9-/288-x18-/-5.jpg'),
      L(1456, 180, 'https://cdn.adblockcdn.com/pix/Dogs/728x9-/1456x18-/Dog_1456x180_01.jpg'),
      L(1456, 180, 'https://cdn.adblockcdn.com/pix/Dogs/728x9-/1456x18-/Dog_1456x180_02.jpg'),
      L(1456, 180, 'https://cdn.adblockcdn.com/pix/Dogs/728x9-/1456x18-/Dog_1456x180_03.jpg'),
      L(1456, 180, 'https://cdn.adblockcdn.com/pix/Dogs/728x9-/1456x18-/Dog_1456x180_04.jpg'),
      L(1456, 180, 'https://cdn.adblockcdn.com/pix/Dogs/728x9-/1456x18-/Dog_1456x180_05.jpg'),
      L(1456, 180, 'https://cdn.adblockcdn.com/pix/Dogs/728x9-/1456x18-/Dog_1456x18-_01.jpg'),
      L(1456, 180, 'https://cdn.adblockcdn.com/pix/Dogs/728x9-/1456x18-/Dog_1456x18-_02.jpg'),
      L(1456, 180, 'https://cdn.adblockcdn.com/pix/Dogs/728x9-/1456x18-/Dog_1456x18-_03.jpg'),
      L(1456, 180, 'https://cdn.adblockcdn.com/pix/Dogs/728x9-/1456x18-/Dog_1456x18-_04.jpg'),
      L(1456, 180, 'https://cdn.adblockcdn.com/pix/Dogs/728x9-/1456x18-/Dog_1456x18-_05.jpg'),
      L(1456, 180, 'https://cdn.adblockcdn.com/pix/Dogs/728x9-/1456x18-/Dog_1456x18-_-1.jpg'),
      L(1456, 180, 'https://cdn.adblockcdn.com/pix/Dogs/728x9-/1456x18-/Dog_1456x18-_-2.jpg'),
      L(1456, 180, 'https://cdn.adblockcdn.com/pix/Dogs/728x9-/1456x18-/Dog_1456x18-_-3.jpg'),
      L(1456, 180, 'https://cdn.adblockcdn.com/pix/Dogs/728x9-/1456x18-/Dog_1456x18-_-4.jpg'),
      L(1456, 180, 'https://cdn.adblockcdn.com/pix/Dogs/728x9-/1456x18-/Dog_1456x18-_-5.jpg'),
      L(1456, 180, 'https://cdn.adblockcdn.com/pix/Dogs/728x9-/1456x18-/Dog_1456x18-_-6.jpg'),
      L(1456, 180, 'https://cdn.adblockcdn.com/pix/Dogs/728x9-/1456x18-/Dog_1456x18-_-7.jpg'),
      L(1456, 180, 'https://cdn.adblockcdn.com/pix/Dogs/728x9-/1456x18-/Dog_1456x18-_-8.jpg'),
      L(1456, 180, 'https://cdn.adblockcdn.com/pix/Dogs/728x9-/1456x18-/Dog_1456x18-_-9.jpg'),
      L(1456, 180, 'https://cdn.adblockcdn.com/pix/Dogs/728x9-/1456x18-/Dog_1456x18-_1-.jpg'),
      L(1456, 180, 'https://cdn.adblockcdn.com/pix/Dogs/728x9-/1456x18-/Dog_1456x18-_11.jpg'),
      L(728, 90, 'https://cdn.adblockcdn.com/pix/Dogs/728x9-/728x9-/Dog_728x90_01.jpg'),
      L(728, 90, 'https://cdn.adblockcdn.com/pix/Dogs/728x9-/728x9-/Dog_728x90_02.jpg'),
      L(728, 90, 'https://cdn.adblockcdn.com/pix/Dogs/728x9-/728x9-/Dog_728x90_03.jpg'),
      L(728, 90, 'https://cdn.adblockcdn.com/pix/Dogs/728x9-/728x9-/Dog_728x90_04.jpg'),
      L(728, 90, 'https://cdn.adblockcdn.com/pix/Dogs/728x9-/728x9-/Dog_728x90_05.jpg'),
      L(728, 90, 'https://cdn.adblockcdn.com/pix/Dogs/728x9-/728x9-/Dog_728x9-_01.jpg'),
      L(728, 90, 'https://cdn.adblockcdn.com/pix/Dogs/728x9-/728x9-/Dog_728x9-_02.jpg'),
      L(728, 90, 'https://cdn.adblockcdn.com/pix/Dogs/728x9-/728x9-/Dog_728x9-_03.jpg'),
      L(728, 90, 'https://cdn.adblockcdn.com/pix/Dogs/728x9-/728x9-/Dog_728x9-_04.jpg'),
      L(728, 90, 'https://cdn.adblockcdn.com/pix/Dogs/728x9-/728x9-/Dog_728x9-_05.jpg'),
      L(728, 90, 'https://cdn.adblockcdn.com/pix/Dogs/728x9-/728x9-/Dog_728x9-_-2.jpg'),
      L(728, 90, 'https://cdn.adblockcdn.com/pix/Dogs/728x9-/728x9-/Dog_728x9-_-4.jpg'),
      L(340, 90, 'https://cdn.adblockcdn.com/pix/Dogs/34-x9-/34-x9-/Dogs_34-x9-_01.jpg'),
      L(340, 90, 'https://cdn.adblockcdn.com/pix/Dogs/34-x9-/34-x9-/Dogs_34-x9-_02.jpg'),
      L(340, 90, 'https://cdn.adblockcdn.com/pix/Dogs/34-x9-/34-x9-/Dogs_34-x9-_03.jpg'),
      L(340, 90, 'https://cdn.adblockcdn.com/pix/Dogs/34-x9-/34-x9-/Dogs_34-x9-_04.jpg'),
      L(340, 90, 'https://cdn.adblockcdn.com/pix/Dogs/34-x9-/34-x9-/Dogs_34-x9-_05.jpg'),
      L(340, 90, 'https://cdn.adblockcdn.com/pix/Dogs/34-x9-/34-x9-/Dogs_34-x9-_-1.jpg'),
      L(340, 90, 'https://cdn.adblockcdn.com/pix/Dogs/34-x9-/34-x9-/Dogs_34-x9-_-3.jpg'),
      L(340, 90, 'https://cdn.adblockcdn.com/pix/Dogs/34-x9-/34-x9-/Dogs_34-x9-_-4.jpg'),
      L(340, 90, 'https://cdn.adblockcdn.com/pix/Dogs/34-x9-/34-x9-/Dogs_34-x9-_-8.jpg'),
      L(340, 90, 'https://cdn.adblockcdn.com/pix/Dogs/34-x9-/34-x9-/Dogs_34-x9-_-9.jpg'),
      L(340, 90, 'https://cdn.adblockcdn.com/pix/Dogs/34-x9-/34-x9-/Dogs_34-x9-_1-.jpg'),
      L(680, 180, 'https://cdn.adblockcdn.com/pix/Dogs/34-x9-/68-x18-/Dogs_68-x18-_01.jpg'),
      L(680, 180, 'https://cdn.adblockcdn.com/pix/Dogs/34-x9-/68-x18-/Dogs_68-x18-_02.jpg'),
      L(680, 180, 'https://cdn.adblockcdn.com/pix/Dogs/34-x9-/68-x18-/Dogs_68-x18-_03.jpg'),
      L(680, 180, 'https://cdn.adblockcdn.com/pix/Dogs/34-x9-/68-x18-/Dogs_68-x18-_04.jpg'),
      L(680, 180, 'https://cdn.adblockcdn.com/pix/Dogs/34-x9-/68-x18-/Dogs_68-x18-_05.jpg'),
      L(680, 180, 'https://cdn.adblockcdn.com/pix/Dogs/34-x9-/68-x18-/Dogs_68-x18-_-1.jpg'),
      L(680, 180, 'https://cdn.adblockcdn.com/pix/Dogs/34-x9-/68-x18-/Dogs_68-x18-_-2.jpg'),
      L(680, 180, 'https://cdn.adblockcdn.com/pix/Dogs/34-x9-/68-x18-/Dogs_68-x18-_-4.jpg'),
      L(680, 180, 'https://cdn.adblockcdn.com/pix/Dogs/34-x9-/68-x18-/Dogs_68-x18-_-5.jpg'),
      L(680, 180, 'https://cdn.adblockcdn.com/pix/Dogs/34-x9-/68-x18-/Dogs_68-x18-_-6.jpg'),
      L(680, 180, 'https://cdn.adblockcdn.com/pix/Dogs/34-x9-/68-x18-/Dogs_68-x18-_-7.jpg'),
      L(680, 180, 'https://cdn.adblockcdn.com/pix/Dogs/34-x9-/68-x18-/Dogs_68-x18-_-9.jpg'),
      L(680, 180, 'https://cdn.adblockcdn.com/pix/Dogs/34-x9-/68-x18-/Dogs_68-x18-_1-.jpg'),
      L(680, 180, 'https://cdn.adblockcdn.com/pix/Dogs/34-x9-/68-x18-/Dogs_68-x18-_11.jpg'),
      L(160, 600, 'https://cdn.adblockcdn.com/pix/Dogs/16-x6--/16-x6--/bordeaux-mastiff-dog-animal.jpg'),
      L(160, 600, 'https://cdn.adblockcdn.com/pix/Dogs/16-x6--/16-x6--/dog-cute-pet.jpg'),
      L(160, 600, 'https://cdn.adblockcdn.com/pix/Dogs/16-x6--/16-x6--/wall-animal-dog-pet.jpg'),
      L(320, 1200, 'https://cdn.adblockcdn.com/pix/Dogs/16-x6--/32-x12--/animal-dog-pet-brown.jpg'),
      L(320, 1200, 'https://cdn.adblockcdn.com/pix/Dogs/16-x6--/32-x12--/bordeaux-mastiff-dog-animal.jpg'),
      L(320, 1200, 'https://cdn.adblockcdn.com/pix/Dogs/16-x6--/32-x12--/dog-young-dog-small-dog-maltese.jpg'),
      L(320, 1200, 'https://cdn.adblockcdn.com/pix/Dogs/16-x6--/32-x12--/night-garden-yellow-animal.jpg'),
      L(560, 672, 'https://cdn.adblockcdn.com/pix/Dogs/56-x672/56-x672/pexels-photo-97863.jpg'),
      L(560, 672, 'https://cdn.adblockcdn.com/pix/Dogs/56-x672/56-x672/dog-animal-friend-pointer-16226-.jpg'),
      L(560, 672, 'https://cdn.adblockcdn.com/pix/Dogs/56-x672/56-x672/pexels-photo-594687.jpg'),
      L(1120, 1344, 'https://cdn.adblockcdn.com/pix/Dogs/56-x672/112-x1344/pexels-photo-113883.jpg'),
      L(1120, 1344, 'https://cdn.adblockcdn.com/pix/Dogs/56-x672/112-x1344/pexels-photo-434-9-.jpg'),
      L(1120, 1344, 'https://cdn.adblockcdn.com/pix/Dogs/56-x672/112-x1344/pexels-photo-46-186.jpg'),
      L(1120, 1344, 'https://cdn.adblockcdn.com/pix/Dogs/56-x672/112-x1344/pexels-photo-58997.jpg'),
      L(1200, 628, 'https://cdn.adblockcdn.com/pix/Dogs/12--x628/12--x628/pexels-photo-89249.png'),
      L(2400, 1256, 'https://cdn.adblockcdn.com/pix/Dogs/12--x628/24--x1256/pexels-photo-89249.png'),
      L(300, 250, 'https://cdn.adblockcdn.com/pix/Dogs/3--x25-/3--x25-/pexels-photo-89249.png'),
      L(600, 500, 'https://cdn.adblockcdn.com/pix/Dogs/3--x25-/6--x5--/pexels-photo-89249.png'),
      L(300, 600, 'https://cdn.adblockcdn.com/pix/Dogs/3--x6--/3--x6--/pexels-photo-89249.png'),
      L(600, 1200, 'https://cdn.adblockcdn.com/pix/Dogs/3--x6--/6--x12--/pexels-photo-89249.png'),
      L(336, 280, 'https://cdn.adblockcdn.com/pix/Dogs/336x28-/336x28-/pexels-photo-89249.png'),
      L(672, 560, 'https://cdn.adblockcdn.com/pix/Dogs/336x28-/672x56-/pexels-photo-89249.png'),
      L(160, 600, 'https://cdn.adblockcdn.com/pix/Dogs/16-x6--/16-x6--/pexels-photo-89249.png'),
      L(180, 680, 'https://cdn.adblockcdn.com/pix/Dogs/18-x68-/18-x68-/bordeaux-mastiff-dog-animal.jpg'),
      L(180, 680, 'https://cdn.adblockcdn.com/pix/Dogs/18-x68-/18-x68-/dalmatians-dog-animal-head.jpg'),
      L(180, 680, 'https://cdn.adblockcdn.com/pix/Dogs/18-x68-/18-x68-/dog-bernese-mountain-dog-berner-senner-dog-577-8.jpg'),
      L(180, 680, 'https://cdn.adblockcdn.com/pix/Dogs/18-x68-/18-x68-/dog-bulldog-white-tongue-4-986.jpg'),
      L(180, 680, 'https://cdn.adblockcdn.com/pix/Dogs/18-x68-/18-x68-/dog-cavalier-king-charles-spaniel-funny-pet-162193.jpg'),
      L(180, 680, 'https://cdn.adblockcdn.com/pix/Dogs/18-x68-/18-x68-/dog-hybrid-animal-lying-162349.jpg'),
      L(180, 680, 'https://cdn.adblockcdn.com/pix/Dogs/18-x68-/18-x68-/dog-young-dog-puppy-59965.jpg'),
      L(180, 680, 'https://cdn.adblockcdn.com/pix/Dogs/18-x68-/18-x68-/dog-young-dog-small-dog-maltese.jpg'),
      L(180, 680, 'https://cdn.adblockcdn.com/pix/Dogs/18-x68-/18-x68-/english-bulldog-bulldog-canine-dog-4-544.jpg'),
      L(180, 680, 'https://cdn.adblockcdn.com/pix/Dogs/18-x68-/18-x68-/french-bulldog-summer-smile-joy-16-846.jpg'),
      L(180, 680, 'https://cdn.adblockcdn.com/pix/Dogs/18-x68-/18-x68-/nature-animal-dog-pet.jpg'),
      L(180, 680, 'https://cdn.adblockcdn.com/pix/Dogs/18-x68-/18-x68-/papillon-dog-animal-59969.jpg'),
      L(180, 680, 'https://cdn.adblockcdn.com/pix/Dogs/18-x68-/18-x68-/pexels-photo-13-763.jpg'),
      L(180, 680, 'https://cdn.adblockcdn.com/pix/Dogs/18-x68-/18-x68-/pexels-photo-134392.jpg'),
      L(180, 680, 'https://cdn.adblockcdn.com/pix/Dogs/18-x68-/18-x68-/pexels-photo-164446.jpg'),
      L(180, 680, 'https://cdn.adblockcdn.com/pix/Dogs/18-x68-/18-x68-/pexels-photo-169524.jpg'),
      L(180, 680, 'https://cdn.adblockcdn.com/pix/Dogs/18-x68-/18-x68-/pexels-photo-2358-5.jpg'),
      L(180, 680, 'https://cdn.adblockcdn.com/pix/Dogs/18-x68-/18-x68-/pexels-photo-247997.jpg'),
      L(180, 680, 'https://cdn.adblockcdn.com/pix/Dogs/18-x68-/18-x68-/pexels-photo-25757-.jpg'),
      L(180, 680, 'https://cdn.adblockcdn.com/pix/Dogs/18-x68-/18-x68-/pexels-photo-257577.jpg'),
      L(180, 680, 'https://cdn.adblockcdn.com/pix/Dogs/18-x68-/18-x68-/pexels-photo-271824.jpg'),
      L(180, 680, 'https://cdn.adblockcdn.com/pix/Dogs/18-x68-/18-x68-/pexels-photo-356378.jpg'),
      L(180, 680, 'https://cdn.adblockcdn.com/pix/Dogs/18-x68-/18-x68-/pexels-photo-3749-8.jpg'),
      L(180, 680, 'https://cdn.adblockcdn.com/pix/Dogs/18-x68-/18-x68-/pexels-photo-412465.jpg'),
      L(180, 680, 'https://cdn.adblockcdn.com/pix/Dogs/18-x68-/18-x68-/pexels-photo-4162-4.jpg'),
      L(180, 680, 'https://cdn.adblockcdn.com/pix/Dogs/18-x68-/18-x68-/pexels-photo-452772.jpg'),
      L(180, 680, 'https://cdn.adblockcdn.com/pix/Dogs/18-x68-/18-x68-/pexels-photo-46-132.jpg'),
      L(180, 680, 'https://cdn.adblockcdn.com/pix/Dogs/18-x68-/18-x68-/pexels-photo-46-823.jpg'),
      L(180, 680, 'https://cdn.adblockcdn.com/pix/Dogs/18-x68-/18-x68-/pexels-photo-485294.jpg'),
      L(180, 680, 'https://cdn.adblockcdn.com/pix/Dogs/18-x68-/18-x68-/pexels-photo-532423.jpg'),
      L(180, 680, 'https://cdn.adblockcdn.com/pix/Dogs/18-x68-/18-x68-/pexels-photo-58997.jpg'),
      L(180, 680, 'https://cdn.adblockcdn.com/pix/Dogs/18-x68-/18-x68-/pexels-photo-594687.jpg'),
      L(180, 680, 'https://cdn.adblockcdn.com/pix/Dogs/18-x68-/18-x68-/pexels-photo-612813.jpg'),
      L(180, 680, 'https://cdn.adblockcdn.com/pix/Dogs/18-x68-/18-x68-/pexels-photo-61372.jpg'),
      L(180, 680, 'https://cdn.adblockcdn.com/pix/Dogs/18-x68-/18-x68-/pexels-photo-66687-.jpg'),
      L(180, 680, 'https://cdn.adblockcdn.com/pix/Dogs/18-x68-/18-x68-/pexels-photo-688694.jpg'),
      L(180, 680, 'https://cdn.adblockcdn.com/pix/Dogs/18-x68-/18-x68-/pexels-photo-71-927.jpg'),
      L(180, 680, 'https://cdn.adblockcdn.com/pix/Dogs/18-x68-/18-x68-/pexels-photo-72-678.jpg'),
      L(180, 680, 'https://cdn.adblockcdn.com/pix/Dogs/18-x68-/18-x68-/pexels-photo-752383.jpg'),
      L(180, 680, 'https://cdn.adblockcdn.com/pix/Dogs/18-x68-/18-x68-/pexels-photo-8--33-.jpg'),
      L(180, 680, 'https://cdn.adblockcdn.com/pix/Dogs/18-x68-/18-x68-/pexels-photo-9238-.jpg'),
      L(180, 680, 'https://cdn.adblockcdn.com/pix/Dogs/18-x68-/18-x68-/tibet-terrier-cute-pet-dog-162276.jpg'),
      L(180, 680, 'https://cdn.adblockcdn.com/pix/Dogs/18-x68-/18-x68-/wall-animal-dog-pet.jpg'),
      L(180, 680, 'https://cdn.adblockcdn.com/pix/Dogs/18-x68-/18-x68-/weimaraner-puppy-dog-snout-97-82.jpg'),
      L(180, 680, 'https://cdn.adblockcdn.com/pix/Dogs/18-x68-/18-x68-/wildlife-photography-pet-photography-dog-animal-159541.jpg'),
      L(180, 680, 'https://cdn.adblockcdn.com/pix/Dogs/18-x68-/18-x68-/wildlife-photography-pet-photography-dog-dog-runs-159492.jpg'),
      L(360, 1360, 'https://cdn.adblockcdn.com/pix/Dogs/18-x68-/36-x136-/bordeaux-mastiff-dog-animal.jpg'),
      L(360, 1360, 'https://cdn.adblockcdn.com/pix/Dogs/18-x68-/36-x136-/dalmatians-dog-animal-head.jpg'),
      L(360, 1360, 'https://cdn.adblockcdn.com/pix/Dogs/18-x68-/36-x136-/dog-bernese-mountain-dog-berner-senner-dog-577-8.jpg'),
      L(360, 1360, 'https://cdn.adblockcdn.com/pix/Dogs/18-x68-/36-x136-/dog-bulldog-white-tongue-4-986.jpg'),
      L(360, 1360, 'https://cdn.adblockcdn.com/pix/Dogs/18-x68-/36-x136-/dog-cavalier-king-charles-spaniel-funny-pet-162193.jpg'),
      L(360, 1360, 'https://cdn.adblockcdn.com/pix/Dogs/18-x68-/36-x136-/dog-hybrid-animal-lying-162349.jpg'),
      L(360, 1360, 'https://cdn.adblockcdn.com/pix/Dogs/18-x68-/36-x136-/dog-young-dog-puppy-59965.jpg'),
      L(360, 1360, 'https://cdn.adblockcdn.com/pix/Dogs/18-x68-/36-x136-/dog-young-dog-small-dog-maltese.jpg'),
      L(360, 1360, 'https://cdn.adblockcdn.com/pix/Dogs/18-x68-/36-x136-/english-bulldog-bulldog-canine-dog-4-544.jpg'),
      L(360, 1360, 'https://cdn.adblockcdn.com/pix/Dogs/18-x68-/36-x136-/french-bulldog-summer-smile-joy-16-846.jpg'),
      L(360, 1360, 'https://cdn.adblockcdn.com/pix/Dogs/18-x68-/36-x136-/nature-animal-dog-pet.jpg'),
      L(360, 1360, 'https://cdn.adblockcdn.com/pix/Dogs/18-x68-/36-x136-/papillon-dog-animal-59969.jpg'),
      L(360, 1360, 'https://cdn.adblockcdn.com/pix/Dogs/18-x68-/36-x136-/pexels-photo-13-763.jpg'),
      L(360, 1360, 'https://cdn.adblockcdn.com/pix/Dogs/18-x68-/36-x136-/pexels-photo-134392.jpg'),
      L(360, 1360, 'https://cdn.adblockcdn.com/pix/Dogs/18-x68-/36-x136-/pexels-photo-164446.jpg'),
      L(360, 1360, 'https://cdn.adblockcdn.com/pix/Dogs/18-x68-/36-x136-/pexels-photo-169524.jpg'),
      L(360, 1360, 'https://cdn.adblockcdn.com/pix/Dogs/18-x68-/36-x136-/pexels-photo-2358-5.jpg'),
      L(360, 1360, 'https://cdn.adblockcdn.com/pix/Dogs/18-x68-/36-x136-/pexels-photo-247997.jpg'),
      L(360, 1360, 'https://cdn.adblockcdn.com/pix/Dogs/18-x68-/36-x136-/pexels-photo-25757-.jpg'),
      L(360, 1360, 'https://cdn.adblockcdn.com/pix/Dogs/18-x68-/36-x136-/pexels-photo-257577.jpg'),
      L(360, 1360, 'https://cdn.adblockcdn.com/pix/Dogs/18-x68-/36-x136-/pexels-photo-271824.jpg'),
      L(360, 1360, 'https://cdn.adblockcdn.com/pix/Dogs/18-x68-/36-x136-/pexels-photo-356378.jpg'),
      L(360, 1360, 'https://cdn.adblockcdn.com/pix/Dogs/18-x68-/36-x136-/pexels-photo-3749-8.jpg'),
      L(360, 1360, 'https://cdn.adblockcdn.com/pix/Dogs/18-x68-/36-x136-/pexels-photo-412465.jpg'),
      L(360, 1360, 'https://cdn.adblockcdn.com/pix/Dogs/18-x68-/36-x136-/pexels-photo-4162-4.jpg'),
      L(360, 1360, 'https://cdn.adblockcdn.com/pix/Dogs/18-x68-/36-x136-/pexels-photo-452772.jpg'),
      L(360, 1360, 'https://cdn.adblockcdn.com/pix/Dogs/18-x68-/36-x136-/pexels-photo-46-132.jpg'),
      L(360, 1360, 'https://cdn.adblockcdn.com/pix/Dogs/18-x68-/36-x136-/pexels-photo-46-823.jpg'),
      L(360, 1360, 'https://cdn.adblockcdn.com/pix/Dogs/18-x68-/36-x136-/pexels-photo-485294.jpg'),
      L(360, 1360, 'https://cdn.adblockcdn.com/pix/Dogs/18-x68-/36-x136-/pexels-photo-532423.jpg'),
      L(360, 1360, 'https://cdn.adblockcdn.com/pix/Dogs/18-x68-/36-x136-/pexels-photo-58997.jpg'),
      L(360, 1360, 'https://cdn.adblockcdn.com/pix/Dogs/18-x68-/36-x136-/pexels-photo-594687.jpg'),
      L(360, 1360, 'https://cdn.adblockcdn.com/pix/Dogs/18-x68-/36-x136-/pexels-photo-612813.jpg'),
      L(360, 1360, 'https://cdn.adblockcdn.com/pix/Dogs/18-x68-/36-x136-/pexels-photo-61372.jpg'),
      L(360, 1360, 'https://cdn.adblockcdn.com/pix/Dogs/18-x68-/36-x136-/pexels-photo-66687-.jpg'),
      L(360, 1360, 'https://cdn.adblockcdn.com/pix/Dogs/18-x68-/36-x136-/pexels-photo-688694.jpg'),
      L(360, 1360, 'https://cdn.adblockcdn.com/pix/Dogs/18-x68-/36-x136-/pexels-photo-71-927.jpg'),
      L(360, 1360, 'https://cdn.adblockcdn.com/pix/Dogs/18-x68-/36-x136-/pexels-photo-72-678.jpg'),
      L(360, 1360, 'https://cdn.adblockcdn.com/pix/Dogs/18-x68-/36-x136-/pexels-photo-752383.jpg'),
      L(360, 1360, 'https://cdn.adblockcdn.com/pix/Dogs/18-x68-/36-x136-/pexels-photo-8--33-.jpg'),
      L(360, 1360, 'https://cdn.adblockcdn.com/pix/Dogs/18-x68-/36-x136-/pexels-photo-9238-.jpg'),
      L(360, 1360, 'https://cdn.adblockcdn.com/pix/Dogs/18-x68-/36-x136-/tibet-terrier-cute-pet-dog-162276.jpg'),
      L(360, 1360, 'https://cdn.adblockcdn.com/pix/Dogs/18-x68-/36-x136-/wall-animal-dog-pet.jpg'),
      L(360, 1360, 'https://cdn.adblockcdn.com/pix/Dogs/18-x68-/36-x136-/weimaraner-puppy-dog-snout-97-82.jpg'),
      L(360, 1360, 'https://cdn.adblockcdn.com/pix/Dogs/18-x68-/36-x136-/wildlife-photography-pet-photography-dog-animal-159541.jpg'),
      L(360, 1360, 'https://cdn.adblockcdn.com/pix/Dogs/18-x68-/36-x136-/wildlife-photography-pet-photography-dog-dog-runs-159492.jpg'),
    ]);
  },
};

Object.assign(window, {
  DogsChannel,
});


/***/ }),
/* 75 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


/* For ESLint: List any global identifiers used in this file below */
/* global Channel, Listing */


// Channel containing hard coded Landscapes loaded from CDN.
// Subclass of Channel.
function LandscapesChannel() {
  Channel.call(this);
}
LandscapesChannel.prototype = {
  __proto__: Channel.prototype,

  getLatestListings(callback) {
    const that = this;
    function L(w, h, u) {
      let width = w;
      let height = h;
      const url = u;
      const type = that.calculateType(width, height);

      if (typeof width === 'number') {
        width = `${width}`;
      }
      if (typeof height === 'number') {
        height = `${height}`;
      }
      return new Listing({
        width,
        height,
        url,
        attributionUrl: url,
        type,
        ratio: Math.max(width, height) / Math.min(width, height),
        title: 'This is a landscape!',
        channelName: 'landscapechannelswitchlabel', // message.json key for channel name
      });
    }
    // the listings never change
    callback([
      L(1200, 628, 'https://cdn.adblockcdn.com/pix/Landscapes/12--x628/12--x628/amazing-animal-beautiful-beautifull.jpg'),
      L(1200, 628, 'https://cdn.adblockcdn.com/pix/Landscapes/12--x628/12--x628/amazing-beautiful-beauty-blue.jpg'),
      L(1200, 628, 'https://cdn.adblockcdn.com/pix/Landscapes/12--x628/12--x628/antelope-canyon-lower-canyon-arizona.jpg'),
      L(1200, 628, 'https://cdn.adblockcdn.com/pix/Landscapes/12--x628/12--x628/delicate-arch-night-stars-landscape.jpg'),
      L(1200, 628, 'https://cdn.adblockcdn.com/pix/Landscapes/12--x628/12--x628/italian-landscape-mountains-nature.jpg'),
      L(1200, 628, 'https://cdn.adblockcdn.com/pix/Landscapes/12--x628/12--x628/pexels-photo (1).jpg'),
      L(1200, 628, 'https://cdn.adblockcdn.com/pix/Landscapes/12--x628/12--x628/pexels-photo (2).jpg'),
      L(1200, 628, 'https://cdn.adblockcdn.com/pix/Landscapes/12--x628/12--x628/pexels-photo.jpg'),
      L(1200, 628, 'https://cdn.adblockcdn.com/pix/Landscapes/12--x628/12--x628/road-sun-rays-path.jpg'),
      L(1200, 628, 'https://cdn.adblockcdn.com/pix/Landscapes/12--x628/12--x628/sunrise-phu-quoc-island-ocean.jpg'),
      L(1200, 628, 'https://cdn.adblockcdn.com/pix/Landscapes/12--x628/12--x628/sunset-field-poppy-sun-priroda.jpg'),
      L(1200, 628, 'https://cdn.adblockcdn.com/pix/Landscapes/12--x628/12--x628/switzerland-zermatt-mountains-snow.jpg'),
      L(2400, 1256, 'https://cdn.adblockcdn.com/pix/Landscapes/12--x628/24--x1256/amazing-animal-beautiful-beautifull.jpg'),
      L(2400, 1256, 'https://cdn.adblockcdn.com/pix/Landscapes/12--x628/24--x1256/amazing-beautiful-beauty-blue.jpg'),
      L(2400, 1256, 'https://cdn.adblockcdn.com/pix/Landscapes/12--x628/24--x1256/antelope-canyon-lower-canyon-arizona.jpg'),
      L(2400, 1256, 'https://cdn.adblockcdn.com/pix/Landscapes/12--x628/24--x1256/delicate-arch-night-stars-landscape.jpg'),
      L(2400, 1256, 'https://cdn.adblockcdn.com/pix/Landscapes/12--x628/24--x1256/italian-landscape-mountains-nature.jpg'),
      L(2400, 1256, 'https://cdn.adblockcdn.com/pix/Landscapes/12--x628/24--x1256/pexels-photo (1).jpg'),
      L(2400, 1256, 'https://cdn.adblockcdn.com/pix/Landscapes/12--x628/24--x1256/pexels-photo (2).jpg'),
      L(2400, 1256, 'https://cdn.adblockcdn.com/pix/Landscapes/12--x628/24--x1256/pexels-photo.jpg'),
      L(2400, 1256, 'https://cdn.adblockcdn.com/pix/Landscapes/12--x628/24--x1256/road-sun-rays-path.jpg'),
      L(2400, 1256, 'https://cdn.adblockcdn.com/pix/Landscapes/12--x628/24--x1256/sunrise-phu-quoc-island-ocean.jpg'),
      L(2400, 1256, 'https://cdn.adblockcdn.com/pix/Landscapes/12--x628/24--x1256/sunset-field-poppy-sun-priroda.jpg'),
      L(2400, 1256, 'https://cdn.adblockcdn.com/pix/Landscapes/12--x628/24--x1256/switzerland-zermatt-mountains-snow.jpg'),
      L(300, 250, 'https://cdn.adblockcdn.com/pix/Landscapes/3--x25-/3--x25-/amazing-animal-beautiful-beautifull.jpg'),
      L(300, 250, 'https://cdn.adblockcdn.com/pix/Landscapes/3--x25-/3--x25-/amazing-beautiful-beauty-blue.jpg'),
      L(300, 250, 'https://cdn.adblockcdn.com/pix/Landscapes/3--x25-/3--x25-/antelope-canyon-lower-canyon-arizona.jpg'),
      L(300, 250, 'https://cdn.adblockcdn.com/pix/Landscapes/3--x25-/3--x25-/delicate-arch-night-stars-landscape.jpg'),
      L(300, 250, 'https://cdn.adblockcdn.com/pix/Landscapes/3--x25-/3--x25-/italian-landscape-mountains-nature.jpg'),
      L(300, 250, 'https://cdn.adblockcdn.com/pix/Landscapes/3--x25-/3--x25-/pexels-photo (1).jpg'),
      L(300, 250, 'https://cdn.adblockcdn.com/pix/Landscapes/3--x25-/3--x25-/pexels-photo (2).jpg'),
      L(300, 250, 'https://cdn.adblockcdn.com/pix/Landscapes/3--x25-/3--x25-/pexels-photo.jpg'),
      L(300, 250, 'https://cdn.adblockcdn.com/pix/Landscapes/3--x25-/3--x25-/road-sun-rays-path.jpg'),
      L(300, 250, 'https://cdn.adblockcdn.com/pix/Landscapes/3--x25-/3--x25-/sunrise-phu-quoc-island-ocean.jpg'),
      L(300, 250, 'https://cdn.adblockcdn.com/pix/Landscapes/3--x25-/3--x25-/sunset-field-poppy-sun-priroda.jpg'),
      L(300, 250, 'https://cdn.adblockcdn.com/pix/Landscapes/3--x25-/3--x25-/switzerland-zermatt-mountains-snow.jpg'),
      L(600, 500, 'https://cdn.adblockcdn.com/pix/Landscapes/3--x25-/6--x5--/amazing-animal-beautiful-beautifull.jpg'),
      L(600, 500, 'https://cdn.adblockcdn.com/pix/Landscapes/3--x25-/6--x5--/amazing-beautiful-beauty-blue.jpg'),
      L(600, 500, 'https://cdn.adblockcdn.com/pix/Landscapes/3--x25-/6--x5--/antelope-canyon-lower-canyon-arizona.jpg'),
      L(600, 500, 'https://cdn.adblockcdn.com/pix/Landscapes/3--x25-/6--x5--/delicate-arch-night-stars-landscape.jpg'),
      L(600, 500, 'https://cdn.adblockcdn.com/pix/Landscapes/3--x25-/6--x5--/italian-landscape-mountains-nature.jpg'),
      L(600, 500, 'https://cdn.adblockcdn.com/pix/Landscapes/3--x25-/6--x5--/pexels-photo (1).jpg'),
      L(600, 500, 'https://cdn.adblockcdn.com/pix/Landscapes/3--x25-/6--x5--/pexels-photo (2).jpg'),
      L(600, 500, 'https://cdn.adblockcdn.com/pix/Landscapes/3--x25-/6--x5--/pexels-photo.jpg'),
      L(600, 500, 'https://cdn.adblockcdn.com/pix/Landscapes/3--x25-/6--x5--/road-sun-rays-path.jpg'),
      L(600, 500, 'https://cdn.adblockcdn.com/pix/Landscapes/3--x25-/6--x5--/sunrise-phu-quoc-island-ocean.jpg'),
      L(600, 500, 'https://cdn.adblockcdn.com/pix/Landscapes/3--x25-/6--x5--/sunset-field-poppy-sun-priroda.jpg'),
      L(600, 500, 'https://cdn.adblockcdn.com/pix/Landscapes/3--x25-/6--x5--/switzerland-zermatt-mountains-snow.jpg'),
      L(300, 600, 'https://cdn.adblockcdn.com/pix/Landscapes/3--x6--/3--x6--/amazing-animal-beautiful-beautifull.jpg'),
      L(300, 600, 'https://cdn.adblockcdn.com/pix/Landscapes/3--x6--/3--x6--/amazing-beautiful-beauty-blue.jpg'),
      L(300, 600, 'https://cdn.adblockcdn.com/pix/Landscapes/3--x6--/3--x6--/antelope-canyon-lower-canyon-arizona.jpg'),
      L(300, 600, 'https://cdn.adblockcdn.com/pix/Landscapes/3--x6--/3--x6--/delicate-arch-night-stars-landscape.jpg'),
      L(300, 600, 'https://cdn.adblockcdn.com/pix/Landscapes/3--x6--/3--x6--/italian-landscape-mountains-nature.jpg'),
      L(300, 600, 'https://cdn.adblockcdn.com/pix/Landscapes/3--x6--/3--x6--/pexels-photo (1).jpg'),
      L(300, 600, 'https://cdn.adblockcdn.com/pix/Landscapes/3--x6--/3--x6--/pexels-photo (2).jpg'),
      L(300, 600, 'https://cdn.adblockcdn.com/pix/Landscapes/3--x6--/3--x6--/pexels-photo.jpg'),
      L(300, 600, 'https://cdn.adblockcdn.com/pix/Landscapes/3--x6--/3--x6--/road-sun-rays-path.jpg'),
      L(300, 600, 'https://cdn.adblockcdn.com/pix/Landscapes/3--x6--/3--x6--/sunrise-phu-quoc-island-ocean.jpg'),
      L(300, 600, 'https://cdn.adblockcdn.com/pix/Landscapes/3--x6--/3--x6--/sunset-field-poppy-sun-priroda.jpg'),
      L(300, 600, 'https://cdn.adblockcdn.com/pix/Landscapes/3--x6--/3--x6--/switzerland-zermatt-mountains-snow.jpg'),
      L(600, 1200, 'https://cdn.adblockcdn.com/pix/Landscapes/3--x6--/6--x12--/amazing-animal-beautiful-beautifull.jpg'),
      L(600, 1200, 'https://cdn.adblockcdn.com/pix/Landscapes/3--x6--/6--x12--/amazing-beautiful-beauty-blue.jpg'),
      L(600, 1200, 'https://cdn.adblockcdn.com/pix/Landscapes/3--x6--/6--x12--/antelope-canyon-lower-canyon-arizona.jpg'),
      L(600, 1200, 'https://cdn.adblockcdn.com/pix/Landscapes/3--x6--/6--x12--/delicate-arch-night-stars-landscape.jpg'),
      L(600, 1200, 'https://cdn.adblockcdn.com/pix/Landscapes/3--x6--/6--x12--/italian-landscape-mountains-nature.jpg'),
      L(600, 1200, 'https://cdn.adblockcdn.com/pix/Landscapes/3--x6--/6--x12--/pexels-photo (1).jpg'),
      L(600, 1200, 'https://cdn.adblockcdn.com/pix/Landscapes/3--x6--/6--x12--/pexels-photo (2).jpg'),
      L(600, 1200, 'https://cdn.adblockcdn.com/pix/Landscapes/3--x6--/6--x12--/pexels-photo.jpg'),
      L(600, 1200, 'https://cdn.adblockcdn.com/pix/Landscapes/3--x6--/6--x12--/road-sun-rays-path.jpg'),
      L(600, 1200, 'https://cdn.adblockcdn.com/pix/Landscapes/3--x6--/6--x12--/sunrise-phu-quoc-island-ocean.jpg'),
      L(600, 1200, 'https://cdn.adblockcdn.com/pix/Landscapes/3--x6--/6--x12--/sunset-field-poppy-sun-priroda.jpg'),
      L(600, 1200, 'https://cdn.adblockcdn.com/pix/Landscapes/3--x6--/6--x12--/switzerland-zermatt-mountains-snow.jpg'),
      L(336, 280, 'https://cdn.adblockcdn.com/pix/Landscapes/336x28-/336x28-/amazing-animal-beautiful-beautifull.jpg'),
      L(336, 280, 'https://cdn.adblockcdn.com/pix/Landscapes/336x28-/336x28-/amazing-beautiful-beauty-blue.jpg'),
      L(336, 280, 'https://cdn.adblockcdn.com/pix/Landscapes/336x28-/336x28-/antelope-canyon-lower-canyon-arizona.jpg'),
      L(336, 280, 'https://cdn.adblockcdn.com/pix/Landscapes/336x28-/336x28-/delicate-arch-night-stars-landscape.jpg'),
      L(336, 280, 'https://cdn.adblockcdn.com/pix/Landscapes/336x28-/336x28-/italian-landscape-mountains-nature.jpg'),
      L(336, 280, 'https://cdn.adblockcdn.com/pix/Landscapes/336x28-/336x28-/pexels-photo (1).jpg'),
      L(336, 280, 'https://cdn.adblockcdn.com/pix/Landscapes/336x28-/336x28-/pexels-photo (2).jpg'),
      L(336, 280, 'https://cdn.adblockcdn.com/pix/Landscapes/336x28-/336x28-/pexels-photo.jpg'),
      L(336, 280, 'https://cdn.adblockcdn.com/pix/Landscapes/336x28-/336x28-/road-sun-rays-path.jpg'),
      L(336, 280, 'https://cdn.adblockcdn.com/pix/Landscapes/336x28-/336x28-/sunrise-phu-quoc-island-ocean.jpg'),
      L(336, 280, 'https://cdn.adblockcdn.com/pix/Landscapes/336x28-/336x28-/sunset-field-poppy-sun-priroda.jpg'),
      L(336, 280, 'https://cdn.adblockcdn.com/pix/Landscapes/336x28-/336x28-/switzerland-zermatt-mountains-snow.jpg'),
      L(672, 560, 'https://cdn.adblockcdn.com/pix/Landscapes/336x28-/672x56-/amazing-animal-beautiful-beautifull.jpg'),
      L(672, 560, 'https://cdn.adblockcdn.com/pix/Landscapes/336x28-/672x56-/amazing-beautiful-beauty-blue.jpg'),
      L(672, 560, 'https://cdn.adblockcdn.com/pix/Landscapes/336x28-/672x56-/antelope-canyon-lower-canyon-arizona.jpg'),
      L(672, 560, 'https://cdn.adblockcdn.com/pix/Landscapes/336x28-/672x56-/delicate-arch-night-stars-landscape.jpg'),
      L(672, 560, 'https://cdn.adblockcdn.com/pix/Landscapes/336x28-/672x56-/italian-landscape-mountains-nature.jpg'),
      L(672, 560, 'https://cdn.adblockcdn.com/pix/Landscapes/336x28-/672x56-/pexels-photo (1).jpg'),
      L(672, 560, 'https://cdn.adblockcdn.com/pix/Landscapes/336x28-/672x56-/pexels-photo (2).jpg'),
      L(672, 560, 'https://cdn.adblockcdn.com/pix/Landscapes/336x28-/672x56-/pexels-photo.jpg'),
      L(672, 560, 'https://cdn.adblockcdn.com/pix/Landscapes/336x28-/672x56-/road-sun-rays-path.jpg'),
      L(672, 560, 'https://cdn.adblockcdn.com/pix/Landscapes/336x28-/672x56-/sunrise-phu-quoc-island-ocean.jpg'),
      L(672, 560, 'https://cdn.adblockcdn.com/pix/Landscapes/336x28-/672x56-/sunset-field-poppy-sun-priroda.jpg'),
      L(672, 560, 'https://cdn.adblockcdn.com/pix/Landscapes/336x28-/672x56-/switzerland-zermatt-mountains-snow.jpg'),
      L(1090, 43, 'https://cdn.adblockcdn.com/pix/Landscapes/1-9-x43/1-9-x43/landscape_1090x43_01.jpg'),
      L(1090, 43, 'https://cdn.adblockcdn.com/pix/Landscapes/1-9-x43/1-9-x43/landscape_1090x43_02.jpg'),
      L(1090, 43, 'https://cdn.adblockcdn.com/pix/Landscapes/1-9-x43/1-9-x43/landscape_1090x43_03.jpg'),
      L(1090, 43, 'https://cdn.adblockcdn.com/pix/Landscapes/1-9-x43/1-9-x43/landscape_1090x43_04.jpg'),
      L(1090, 43, 'https://cdn.adblockcdn.com/pix/Landscapes/1-9-x43/1-9-x43/landscape_1090x43_05.jpg'),
      L(1090, 43, 'https://cdn.adblockcdn.com/pix/Landscapes/1-9-x43/1-9-x43/-2.jpg'),
      L(1090, 43, 'https://cdn.adblockcdn.com/pix/Landscapes/1-9-x43/1-9-x43/landscape_1-9-x43_-2.jpg'),
      L(2180, 86, 'https://cdn.adblockcdn.com/pix/Landscapes/1-9-x43/218-x86/landscape_2180x86_01.jpg'),
      L(2180, 86, 'https://cdn.adblockcdn.com/pix/Landscapes/1-9-x43/218-x86/landscape_2180x86_02.jpg'),
      L(2180, 86, 'https://cdn.adblockcdn.com/pix/Landscapes/1-9-x43/218-x86/landscape_2180x86_03.jpg'),
      L(2180, 86, 'https://cdn.adblockcdn.com/pix/Landscapes/1-9-x43/218-x86/landscape_2180x86_04.jpg'),
      L(2180, 86, 'https://cdn.adblockcdn.com/pix/Landscapes/1-9-x43/218-x86/landscape_2180x86_05.jpg'),
      L(2180, 86, 'https://cdn.adblockcdn.com/pix/Landscapes/1-9-x43/218-x86/landscape_218-x86_-1.jpg'),
      L(2180, 86, 'https://cdn.adblockcdn.com/pix/Landscapes/1-9-x43/218-x86/landscape_218-x86_-4.jpg'),
      L(450, 62, 'https://cdn.adblockcdn.com/pix/Landscapes/45-x62/45-x62/landscape_450x62_01.jpg'),
      L(450, 62, 'https://cdn.adblockcdn.com/pix/Landscapes/45-x62/45-x62/landscape_450x62_02.jpg'),
      L(450, 62, 'https://cdn.adblockcdn.com/pix/Landscapes/45-x62/45-x62/landscape_450x62_03.jpg'),
      L(450, 62, 'https://cdn.adblockcdn.com/pix/Landscapes/45-x62/45-x62/landscape_450x62_04.jpg'),
      L(450, 62, 'https://cdn.adblockcdn.com/pix/Landscapes/45-x62/45-x62/landscape_450x62_05.jpg'),
      L(450, 62, 'https://cdn.adblockcdn.com/pix/Landscapes/45-x62/45-x62/-3.jpg'),
      L(450, 62, 'https://cdn.adblockcdn.com/pix/Landscapes/45-x62/45-x62/-4.jpg'),
      L(450, 62, 'https://cdn.adblockcdn.com/pix/Landscapes/45-x62/45-x62/-5.jpg'),
      L(450, 62, 'https://cdn.adblockcdn.com/pix/Landscapes/45-x62/45-x62/landscape_45-x62_-5.jpg'),
      L(900, 124, 'https://cdn.adblockcdn.com/pix/Landscapes/45-x62/9--x124/landscape_900x124_01.jpg'),
      L(900, 124, 'https://cdn.adblockcdn.com/pix/Landscapes/45-x62/9--x124/landscape_900x124_02.jpg'),
      L(900, 124, 'https://cdn.adblockcdn.com/pix/Landscapes/45-x62/9--x124/landscape_900x124_03.jpg'),
      L(900, 124, 'https://cdn.adblockcdn.com/pix/Landscapes/45-x62/9--x124/landscape_900x124_04.jpg'),
      L(900, 124, 'https://cdn.adblockcdn.com/pix/Landscapes/45-x62/9--x124/landscape_900x124_05.jpg'),
      L(900, 124, 'https://cdn.adblockcdn.com/pix/Landscapes/45-x62/9--x124/-1.jpg'),
      L(900, 124, 'https://cdn.adblockcdn.com/pix/Landscapes/45-x62/9--x124/-2.jpg'),
      L(900, 124, 'https://cdn.adblockcdn.com/pix/Landscapes/45-x62/9--x124/-3.jpg'),
      L(900, 124, 'https://cdn.adblockcdn.com/pix/Landscapes/45-x62/9--x124/-4.jpg'),
      L(900, 124, 'https://cdn.adblockcdn.com/pix/Landscapes/45-x62/9--x124/-5.jpg'),
      L(900, 124, 'https://cdn.adblockcdn.com/pix/Landscapes/45-x62/9--x124/landscape_9--x124_-2.jpg'),
      L(900, 124, 'https://cdn.adblockcdn.com/pix/Landscapes/45-x62/9--x124/landscape_9--x124_-3.jpg'),
      L(900, 124, 'https://cdn.adblockcdn.com/pix/Landscapes/45-x62/9--x124/landscape_9--x124_-4.jpg'),
      L(1440, 90, 'https://cdn.adblockcdn.com/pix/Landscapes/144-x9-/144-x9-/landscape_1440x90_01.jpg'),
      L(1440, 90, 'https://cdn.adblockcdn.com/pix/Landscapes/144-x9-/144-x9-/landscape_1440x90_02.jpg'),
      L(1440, 90, 'https://cdn.adblockcdn.com/pix/Landscapes/144-x9-/144-x9-/landscape_1440x90_03.jpg'),
      L(1440, 90, 'https://cdn.adblockcdn.com/pix/Landscapes/144-x9-/144-x9-/landscape_1440x90_04.jpg'),
      L(1440, 90, 'https://cdn.adblockcdn.com/pix/Landscapes/144-x9-/144-x9-/landscape_1440x90_05.jpg'),
      L(1440, 90, 'https://cdn.adblockcdn.com/pix/Landscapes/144-x9-/144-x9-/-1.jpg'),
      L(1440, 90, 'https://cdn.adblockcdn.com/pix/Landscapes/144-x9-/144-x9-/-2.jpg'),
      L(1440, 90, 'https://cdn.adblockcdn.com/pix/Landscapes/144-x9-/144-x9-/-3.jpg'),
      L(1440, 90, 'https://cdn.adblockcdn.com/pix/Landscapes/144-x9-/144-x9-/-5.jpg'),
      L(1440, 90, 'https://cdn.adblockcdn.com/pix/Landscapes/144-x9-/144-x9-/landscape_144-x9-_-1.jpg'),
      L(1440, 90, 'https://cdn.adblockcdn.com/pix/Landscapes/144-x9-/144-x9-/landscape_144-x9-_-3.jpg'),
      L(2880, 180, 'https://cdn.adblockcdn.com/pix/Landscapes/144-x9-/288-x18-/landscape_2880x180_01.jpg'),
      L(2880, 180, 'https://cdn.adblockcdn.com/pix/Landscapes/144-x9-/288-x18-/landscape_2880x180_02.jpg'),
      L(2880, 180, 'https://cdn.adblockcdn.com/pix/Landscapes/144-x9-/288-x18-/landscape_2880x180_03.jpg'),
      L(2880, 180, 'https://cdn.adblockcdn.com/pix/Landscapes/144-x9-/288-x18-/landscape_2880x180_04.jpg'),
      L(2880, 180, 'https://cdn.adblockcdn.com/pix/Landscapes/144-x9-/288-x18-/landscape_2880x180_05.jpg'),
      L(2880, 180, 'https://cdn.adblockcdn.com/pix/Landscapes/144-x9-/288-x18-/-3.jpg'),
      L(2880, 180, 'https://cdn.adblockcdn.com/pix/Landscapes/144-x9-/288-x18-/landscape_288-x18-_-2.jpg'),
      L(2880, 180, 'https://cdn.adblockcdn.com/pix/Landscapes/144-x9-/288-x18-/landscape_288-x18-_-5.jpg'),
      L(1200, 50, 'https://cdn.adblockcdn.com/pix/Landscapes/12--x5-/12--x5-/landscape_1200x50_01.jpg'),
      L(1200, 50, 'https://cdn.adblockcdn.com/pix/Landscapes/12--x5-/12--x5-/landscape_1200x50_02.jpg'),
      L(1200, 50, 'https://cdn.adblockcdn.com/pix/Landscapes/12--x5-/12--x5-/landscape_1200x50_03.jpg'),
      L(1200, 50, 'https://cdn.adblockcdn.com/pix/Landscapes/12--x5-/12--x5-/landscape_1200x50_04.jpg'),
      L(1200, 50, 'https://cdn.adblockcdn.com/pix/Landscapes/12--x5-/12--x5-/landscape_1200x50_05.jpg'),
      L(1200, 50, 'https://cdn.adblockcdn.com/pix/Landscapes/12--x5-/12--x5-/-1.jpg'),
      L(1200, 50, 'https://cdn.adblockcdn.com/pix/Landscapes/12--x5-/12--x5-/-2.jpg'),
      L(1200, 50, 'https://cdn.adblockcdn.com/pix/Landscapes/12--x5-/12--x5-/-3.jpg'),
      L(1200, 50, 'https://cdn.adblockcdn.com/pix/Landscapes/12--x5-/12--x5-/-4.jpg'),
      L(1200, 50, 'https://cdn.adblockcdn.com/pix/Landscapes/12--x5-/12--x5-/-5.jpg'),
      L(1200, 50, 'https://cdn.adblockcdn.com/pix/Landscapes/12--x5-/12--x5-/landscape_12--x5-_-2.jpg'),
      L(1200, 50, 'https://cdn.adblockcdn.com/pix/Landscapes/12--x5-/12--x5-/landscape_12--x5-_-3.jpg'),
      L(1200, 50, 'https://cdn.adblockcdn.com/pix/Landscapes/12--x5-/12--x5-/landscape_12--x5-_-4.jpg'),
      L(1200, 50, 'https://cdn.adblockcdn.com/pix/Landscapes/12--x5-/12--x5-/landscape_12--x5-_-5.jpg'),
      L(1200, 50, 'https://cdn.adblockcdn.com/pix/Landscapes/12--x5-/12--x5-/landscape_12--x5-_-1.jpg'),
      L(2400, 100, 'https://cdn.adblockcdn.com/pix/Landscapes/12--x5-/24--x1--/landscape_2400x100_01.jpg'),
      L(2400, 100, 'https://cdn.adblockcdn.com/pix/Landscapes/12--x5-/24--x1--/landscape_2400x100_02.jpg'),
      L(2400, 100, 'https://cdn.adblockcdn.com/pix/Landscapes/12--x5-/24--x1--/landscape_2400x100_03.jpg'),
      L(2400, 100, 'https://cdn.adblockcdn.com/pix/Landscapes/12--x5-/24--x1--/landscape_2400x100_04.jpg'),
      L(2400, 100, 'https://cdn.adblockcdn.com/pix/Landscapes/12--x5-/24--x1--/landscape_2400x100_05.jpg'),
      L(2400, 100, 'https://cdn.adblockcdn.com/pix/Landscapes/12--x5-/24--x1--/-1.jpg'),
      L(2400, 100, 'https://cdn.adblockcdn.com/pix/Landscapes/12--x5-/24--x1--/-2.jpg'),
      L(2400, 100, 'https://cdn.adblockcdn.com/pix/Landscapes/12--x5-/24--x1--/-3.jpg'),
      L(2400, 100, 'https://cdn.adblockcdn.com/pix/Landscapes/12--x5-/24--x1--/-4.jpg'),
      L(2400, 100, 'https://cdn.adblockcdn.com/pix/Landscapes/12--x5-/24--x1--/-5.jpg'),
      L(2400, 100, 'https://cdn.adblockcdn.com/pix/Landscapes/12--x5-/24--x1--/landscape_24--x1--_-1.jpg'),
      L(2400, 100, 'https://cdn.adblockcdn.com/pix/Landscapes/12--x5-/24--x1--/landscape_24--x1--_-2.jpg'),
      L(2400, 100, 'https://cdn.adblockcdn.com/pix/Landscapes/12--x5-/24--x1--/landscape_24--x1--_-3.jpg'),
      L(2400, 100, 'https://cdn.adblockcdn.com/pix/Landscapes/12--x5-/24--x1--/landscape_24--x1--_-4.jpg'),
      L(2400, 100, 'https://cdn.adblockcdn.com/pix/Landscapes/12--x5-/24--x1--/landscape_24--x1--_-5.jpg'),
      L(468, 60, 'https://cdn.adblockcdn.com/pix/Landscapes/468x6-/468x6-/landscape_468x6-_01.jpg'),
      L(468, 60, 'https://cdn.adblockcdn.com/pix/Landscapes/468x6-/468x6-/landscape_468x6-_02.jpg'),
      L(468, 60, 'https://cdn.adblockcdn.com/pix/Landscapes/468x6-/468x6-/landscape_468x6-_03.jpg'),
      L(468, 60, 'https://cdn.adblockcdn.com/pix/Landscapes/468x6-/468x6-/landscape_468x6-_04.jpg'),
      L(468, 60, 'https://cdn.adblockcdn.com/pix/Landscapes/468x6-/468x6-/landscape_468x6-_05.jpg'),
      L(468, 60, 'https://cdn.adblockcdn.com/pix/Landscapes/468x6-/468x6-/-4.jpg'),
      L(468, 60, 'https://cdn.adblockcdn.com/pix/Landscapes/468x6-/468x6-/landscape_468x6-_-4.jpg'),
      L(936, 120, 'https://cdn.adblockcdn.com/pix/Landscapes/468x6-/936x12-/landscape_936x120_01.jpg'),
      L(936, 120, 'https://cdn.adblockcdn.com/pix/Landscapes/468x6-/936x12-/landscape_936x120_02.jpg'),
      L(936, 120, 'https://cdn.adblockcdn.com/pix/Landscapes/468x6-/936x12-/landscape_936x120_03.jpg'),
      L(936, 120, 'https://cdn.adblockcdn.com/pix/Landscapes/468x6-/936x12-/landscape_936x120_04.jpg'),
      L(936, 120, 'https://cdn.adblockcdn.com/pix/Landscapes/468x6-/936x12-/landscape_936x120_05.jpg'),
      L(936, 120, 'https://cdn.adblockcdn.com/pix/Landscapes/468x6-/936x12-/-1.jpg'),
      L(936, 120, 'https://cdn.adblockcdn.com/pix/Landscapes/468x6-/936x12-/landscape_936x12-_-3.jpg'),
      L(1456, 180, 'https://cdn.adblockcdn.com/pix/Landscapes/728x9-/1456x18-/Landscape_1456x180_01.jpg'),
      L(1456, 180, 'https://cdn.adblockcdn.com/pix/Landscapes/728x9-/1456x18-/Landscape_1456x180_02.jpg'),
      L(1456, 180, 'https://cdn.adblockcdn.com/pix/Landscapes/728x9-/1456x18-/Landscape_1456x180_03.jpg'),
      L(1456, 180, 'https://cdn.adblockcdn.com/pix/Landscapes/728x9-/1456x18-/Landscape_1456x180_04.jpg'),
      L(1456, 180, 'https://cdn.adblockcdn.com/pix/Landscapes/728x9-/1456x18-/Landscape_1456x180_05.jpg'),
      L(1456, 180, 'https://cdn.adblockcdn.com/pix/Landscapes/728x9-/1456x18-/Landscape_1456x18-_01.jpg'),
      L(1456, 180, 'https://cdn.adblockcdn.com/pix/Landscapes/728x9-/1456x18-/Landscape_1456x18-_02.jpg'),
      L(1456, 180, 'https://cdn.adblockcdn.com/pix/Landscapes/728x9-/1456x18-/Landscape_1456x18-_03.jpg'),
      L(1456, 180, 'https://cdn.adblockcdn.com/pix/Landscapes/728x9-/1456x18-/Landscape_1456x18-_04.jpg'),
      L(1456, 180, 'https://cdn.adblockcdn.com/pix/Landscapes/728x9-/1456x18-/Landscape_1456x18-_05.jpg'),
      L(1456, 180, 'https://cdn.adblockcdn.com/pix/Landscapes/728x9-/1456x18-/Landscape_1456x18-_-3.jpg'),
      L(1456, 180, 'https://cdn.adblockcdn.com/pix/Landscapes/728x9-/1456x18-/Landscape_1456x18-_-4.jpg'),
      L(1456, 180, 'https://cdn.adblockcdn.com/pix/Landscapes/728x9-/1456x18-/Landscape_1456x18-_-7.jpg'),
      L(1456, 180, 'https://cdn.adblockcdn.com/pix/Landscapes/728x9-/1456x18-/Landscape_1456x18-_1-.jpg'),
      L(1456, 180, 'https://cdn.adblockcdn.com/pix/Landscapes/728x9-/1456x18-/Landscape_1456x18-_11.jpg'),
      L(1456, 180, 'https://cdn.adblockcdn.com/pix/Landscapes/728x9-/1456x18-/Landscape_1456x18-_12.jpg'),
      L(1456, 180, 'https://cdn.adblockcdn.com/pix/Landscapes/728x9-/1456x18-/Landscape_1456x18-_15.jpg'),
      L(1456, 180, 'https://cdn.adblockcdn.com/pix/Landscapes/728x9-/1456x18-/Landscape_1456x18-_17.jpg'),
      L(1456, 180, 'https://cdn.adblockcdn.com/pix/Landscapes/728x9-/1456x18-/Landscape_1456x18-_-2.jpg'),
      L(728, 90, 'https://cdn.adblockcdn.com/pix/Landscapes/728x9-/728x9-/Landscape_728x90_01.jpg'),
      L(728, 90, 'https://cdn.adblockcdn.com/pix/Landscapes/728x9-/728x9-/Landscape_728x90_02.jpg'),
      L(728, 90, 'https://cdn.adblockcdn.com/pix/Landscapes/728x9-/728x9-/Landscape_728x90_03.jpg'),
      L(728, 90, 'https://cdn.adblockcdn.com/pix/Landscapes/728x9-/728x9-/Landscape_728x90_04.jpg'),
      L(728, 90, 'https://cdn.adblockcdn.com/pix/Landscapes/728x9-/728x9-/Landscape_728x90_05.jpg'),
      L(728, 90, 'https://cdn.adblockcdn.com/pix/Landscapes/728x9-/728x9-/Landscape_728x9-_01.jpg'),
      L(728, 90, 'https://cdn.adblockcdn.com/pix/Landscapes/728x9-/728x9-/Landscape_728x9-_02.jpg'),
      L(728, 90, 'https://cdn.adblockcdn.com/pix/Landscapes/728x9-/728x9-/Landscape_728x9-_03.jpg'),
      L(728, 90, 'https://cdn.adblockcdn.com/pix/Landscapes/728x9-/728x9-/Landscape_728x9-_04.jpg'),
      L(728, 90, 'https://cdn.adblockcdn.com/pix/Landscapes/728x9-/728x9-/Landscape_728x9-_05.jpg'),
      L(728, 90, 'https://cdn.adblockcdn.com/pix/Landscapes/728x9-/728x9-/Landscape_728x9-_-1.jpg'),
      L(728, 90, 'https://cdn.adblockcdn.com/pix/Landscapes/728x9-/728x9-/Landscape_728x9-_-4.jpg'),
      L(728, 90, 'https://cdn.adblockcdn.com/pix/Landscapes/728x9-/728x9-/Landscape_728x9-_-5.jpg'),
      L(340, 90, 'https://cdn.adblockcdn.com/pix/Landscapes/34-x9-/34-x9-/Landscape_34-x9-_01.jpg'),
      L(340, 90, 'https://cdn.adblockcdn.com/pix/Landscapes/34-x9-/34-x9-/Landscape_34-x9-_02.jpg'),
      L(340, 90, 'https://cdn.adblockcdn.com/pix/Landscapes/34-x9-/34-x9-/Landscape_34-x9-_03.jpg'),
      L(340, 90, 'https://cdn.adblockcdn.com/pix/Landscapes/34-x9-/34-x9-/Landscape_34-x9-_04.jpg'),
      L(340, 90, 'https://cdn.adblockcdn.com/pix/Landscapes/34-x9-/34-x9-/Landscape_34-x9-_05.jpg'),
      L(340, 90, 'https://cdn.adblockcdn.com/pix/Landscapes/34-x9-/34-x9-/Landscape_34-x9-_-2.jpg'),
      L(340, 90, 'https://cdn.adblockcdn.com/pix/Landscapes/34-x9-/34-x9-/Landscape_34-x9-_-3.jpg'),
      L(340, 90, 'https://cdn.adblockcdn.com/pix/Landscapes/34-x9-/34-x9-/Landscape_34-x9-_-4.jpg'),
      L(340, 90, 'https://cdn.adblockcdn.com/pix/Landscapes/34-x9-/34-x9-/Landscape_34-x9-_1-.jpg'),
      L(340, 90, 'https://cdn.adblockcdn.com/pix/Landscapes/34-x9-/34-x9-/Landscape_34-x9-_11.jpg'),
      L(680, 180, 'https://cdn.adblockcdn.com/pix/Landscapes/34-x9-/68-x18-/Landscape_68-x18-_01.jpg'),
      L(680, 180, 'https://cdn.adblockcdn.com/pix/Landscapes/34-x9-/68-x18-/Landscape_68-x18-_02.jpg'),
      L(680, 180, 'https://cdn.adblockcdn.com/pix/Landscapes/34-x9-/68-x18-/Landscape_68-x18-_03.jpg'),
      L(680, 180, 'https://cdn.adblockcdn.com/pix/Landscapes/34-x9-/68-x18-/Landscape_68-x18-_04.jpg'),
      L(680, 180, 'https://cdn.adblockcdn.com/pix/Landscapes/34-x9-/68-x18-/Landscape_68-x18-_05.jpg'),
      L(680, 180, 'https://cdn.adblockcdn.com/pix/Landscapes/34-x9-/68-x18-/Landscape_68-x18-_-2.jpg'),
      L(680, 180, 'https://cdn.adblockcdn.com/pix/Landscapes/34-x9-/68-x18-/Landscape_68-x18-_-3.jpg'),
      L(680, 180, 'https://cdn.adblockcdn.com/pix/Landscapes/34-x9-/68-x18-/Landscape_68-x18-_-5.jpg'),
      L(680, 180, 'https://cdn.adblockcdn.com/pix/Landscapes/34-x9-/68-x18-/Landscape_68-x18-_-6.jpg'),
      L(680, 180, 'https://cdn.adblockcdn.com/pix/Landscapes/34-x9-/68-x18-/Landscape_68-x18-_-8.jpg'),
      L(680, 180, 'https://cdn.adblockcdn.com/pix/Landscapes/34-x9-/68-x18-/Landscape_68-x18-_1-.jpg'),
      L(680, 180, 'https://cdn.adblockcdn.com/pix/Landscapes/34-x9-/68-x18-/Landscape_68-x18-_11.jpg'),
      L(680, 180, 'https://cdn.adblockcdn.com/pix/Landscapes/34-x9-/68-x18-/Landscape_68-x18-_12.jpg'),
      L(680, 180, 'https://cdn.adblockcdn.com/pix/Landscapes/34-x9-/68-x18-/Landscape_68-x18-_14.jpg'),
      L(680, 180, 'https://cdn.adblockcdn.com/pix/Landscapes/34-x9-/68-x18-/Landscape_68-x18-_15.jpg'),
      L(680, 180, 'https://cdn.adblockcdn.com/pix/Landscapes/34-x9-/68-x18-/Landscape_68-x18-_16.jpg'),
      L(680, 180, 'https://cdn.adblockcdn.com/pix/Landscapes/34-x9-/68-x18-/Landscape_68-x18-_17.jpg'),
      L(160, 600, 'https://cdn.adblockcdn.com/pix/Landscapes/16-x6--/16-x6--/amazing-animal-beautiful-beautifull.jpg'),
      L(160, 600, 'https://cdn.adblockcdn.com/pix/Landscapes/16-x6--/16-x6--/amazing-beautiful-beauty-blue.jpg'),
      L(160, 600, 'https://cdn.adblockcdn.com/pix/Landscapes/16-x6--/16-x6--/antelope-canyon-lower-canyon-arizona.jpg'),
      L(160, 600, 'https://cdn.adblockcdn.com/pix/Landscapes/16-x6--/16-x6--/delicate-arch-night-stars-landscape.jpg'),
      L(160, 600, 'https://cdn.adblockcdn.com/pix/Landscapes/16-x6--/16-x6--/italian-landscape-mountains-nature.jpg'),
      L(160, 600, 'https://cdn.adblockcdn.com/pix/Landscapes/16-x6--/16-x6--/pexels-photo (1).jpg'),
      L(160, 600, 'https://cdn.adblockcdn.com/pix/Landscapes/16-x6--/16-x6--/pexels-photo (2).jpg'),
      L(160, 600, 'https://cdn.adblockcdn.com/pix/Landscapes/16-x6--/16-x6--/road-sun-rays-path.jpg'),
      L(160, 600, 'https://cdn.adblockcdn.com/pix/Landscapes/16-x6--/16-x6--/sunset-field-poppy-sun-priroda.jpg'),
      L(160, 600, 'https://cdn.adblockcdn.com/pix/Landscapes/16-x6--/16-x6--/switzerland-zermatt-mountains-snow.jpg'),
      L(320, 1200, 'https://cdn.adblockcdn.com/pix/Landscapes/16-x6--/32-x12--/amazing-beautiful-beauty-blue.jpg'),
      L(320, 1200, 'https://cdn.adblockcdn.com/pix/Landscapes/16-x6--/32-x12--/antelope-canyon-lower-canyon-arizona.jpg'),
      L(320, 1200, 'https://cdn.adblockcdn.com/pix/Landscapes/16-x6--/32-x12--/italian-landscape-mountains-nature.jpg'),
      L(320, 1200, 'https://cdn.adblockcdn.com/pix/Landscapes/16-x6--/32-x12--/pexels-photo (1).jpg'),
      L(320, 1200, 'https://cdn.adblockcdn.com/pix/Landscapes/16-x6--/32-x12--/pexels-photo (2).jpg'),
      L(320, 1200, 'https://cdn.adblockcdn.com/pix/Landscapes/16-x6--/32-x12--/road-sun-rays-path.jpg'),
      L(320, 1200, 'https://cdn.adblockcdn.com/pix/Landscapes/16-x6--/32-x12--/sunrise-phu-quoc-island-ocean.jpg'),
      L(320, 1200, 'https://cdn.adblockcdn.com/pix/Landscapes/16-x6--/32-x12--/switzerland-zermatt-mountains-snow.jpg'),
      L(180, 680, 'https://cdn.adblockcdn.com/pix/Landscapes/18-x68-/18-x68-/pexels-photo-414-83.jpg'),
      L(180, 680, 'https://cdn.adblockcdn.com/pix/Landscapes/18-x68-/18-x68-/pexels-photo-351448.jpg'),
      L(180, 680, 'https://cdn.adblockcdn.com/pix/Landscapes/18-x68-/36-x136-/amazing-animal-beautiful-beautifull.jpg'),
      L(180, 680, 'https://cdn.adblockcdn.com/pix/Landscapes/18-x68-/36-x136-/pexels-photo-164196.jpg'),
      L(180, 680, 'https://cdn.adblockcdn.com/pix/Landscapes/18-x68-/36-x136-/pexels-photo-189848.jpg'),
      L(180, 680, 'https://cdn.adblockcdn.com/pix/Landscapes/18-x68-/36-x136-/pexels-photo-21-186.jpg'),
      L(180, 680, 'https://cdn.adblockcdn.com/pix/Landscapes/18-x68-/36-x136-/pexels-photo-221148.jpg'),
      L(180, 680, 'https://cdn.adblockcdn.com/pix/Landscapes/18-x68-/36-x136-/pexels-photo-388-65.jpg'),
      L(180, 680, 'https://cdn.adblockcdn.com/pix/Landscapes/18-x68-/36-x136-/pexels-photo-443446.jpg'),
      L(1120, 1344, 'https://cdn.adblockcdn.com/pix/Landscapes/56-x672/112-x1344/pexels-photo-355241.jpg'),
      L(1120, 1344, 'https://cdn.adblockcdn.com/pix/Landscapes/56-x672/112-x1344/pexels-photo-552791.jpg'),
      L(1120, 1344, 'https://cdn.adblockcdn.com/pix/Landscapes/56-x672/112-x1344/switzerland-zermatt-mountains-snow.jpg'),
      L(560, 672, 'https://cdn.adblockcdn.com/pix/Landscapes/56-x672/56-x672/boat-house-cottage-waters-lake-65225.jpg'),
      L(560, 672, 'https://cdn.adblockcdn.com/pix/Landscapes/56-x672/56-x672/pexels-photo (1).jpg'),
      L(560, 672, 'https://cdn.adblockcdn.com/pix/Landscapes/56-x672/56-x672/pexels-photo-117843.jpg'),
      L(560, 672, 'https://cdn.adblockcdn.com/pix/Landscapes/56-x672/56-x672/pexels-photo-221148.jpg'),
      L(560, 672, 'https://cdn.adblockcdn.com/pix/Landscapes/56-x672/56-x672/yellowstone-national-park-sunset-twilight-dusk-158489.jpg'),
    ]);
  },
};

Object.assign(window, {
  LandscapesChannel,
});


/***/ }),
/* 76 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


/* For ESLint: List any global identifiers used in this file below */
/* global Channel */

// Empty Channel
// Subclass of Channel.
//
// Allows the Sync process to create an new named Channel
// when the sync process recieves a request with a unknown channel name
function UnknownChannel() {
  Channel.call(this);
}

UnknownChannel.prototype = {
  __proto__: Channel.prototype,

  getLatestListings(callback) {
    callback([]);
  },
};

Object.assign(window, {
  UnknownChannel,
});


/***/ }),
/* 77 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


/* For ESLint: List any global identifiers used in this file below */
/* global ext, chrome, require, storageGet, storageSet, log, STATS, Channels, Prefs,
   getSettings, setSetting, translate, reloadOptionsPageTabs, filterNotifier, openTab,
   emitPageBroadcast */

// Yes, you could hack my code to not check the license.  But please don't.
// Paying for this extension supports the work on AdBlock.  Thanks very much.
const { checkWhitelisted } = __webpack_require__(9);
const { EventEmitter } = __webpack_require__(6);
const { recordGeneralMessage } = __webpack_require__(14).ServerMessages;

const licenseNotifier = new EventEmitter();

const License = (function getLicense() {
  const isProd = true;
  const licenseStorageKey = 'license';
  const installTimestampStorageKey = 'install_timestamp';
  const statsInIconKey = 'current_show_statsinicon';
  const userClosedSyncCTAKey = 'user_closed_sync_cta';
  const userSawSyncCTAKey = 'user_saw_sync_cta';
  const pageReloadedOnSettingChangeKey = 'page_reloaded_on_user_settings_change';
  const popupMenuCtaClosedKey = 'popup_menu_cta_closed';
  const showPopupMenuThemesCtaKey = 'popup_menu_themes_cta';
  const licenseAlarmName = 'licenseAlarm';
  let theLicense;
  const fiveMinutes = 300000;
  const initialized = false;
  let ajaxRetryCount = 0;
  let readyComplete;
  const licensePromise = new Promise(((resolve) => {
    readyComplete = resolve;
  }));
  const themesForCTA = [
    'solarized_theme', 'solarized_light_theme', 'watermelon_theme', 'sunshine_theme', 'ocean_theme',
  ];
  let currentThemeIndex = 0;
  const mabConfig = {
    prod: {
      licenseURL: 'https://myadblock-licensing.firebaseapp.com/license/',
      syncURL: 'https://myadblock.sync.getadblock.com/v1/sync',
      subscribeKey: 'sub-c-9eccffb2-8c6a-11e9-97ab-aa54ad4b08ec',
      payURL: 'https://getadblock.com/premium/enrollment/',
      subscriptionURL: 'https://getadblock.com/premium/manage-subscription/',
    },
    dev: {
      licenseURL: 'https://dev.myadblock.licensing.getadblock.com/license/',
      syncURL: 'https://dev.myadblock.sync.getadblock.com/v1/sync',
      subscribeKey: 'sub-c-9e0a7270-83e7-11e9-99de-d6d3b84c4a25',
      payURL: 'https://getadblock.com/premium/enrollment/?testmode=true',
      subscriptionURL: 'https://dev.getadblock.com/premium/manage-subscription/',
    },
  };
  STATS.untilLoaded((userID) => {
    mabConfig.prod.payURL = `${mabConfig.prod.payURL}?u=${userID}`;
    mabConfig.dev.payURL = `${mabConfig.dev.payURL}&u=${userID}`;
  });
  const MAB_CONFIG = isProd ? mabConfig.prod : mabConfig.dev;

  chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm && alarm.name === licenseAlarmName) {
      // At this point, no alarms exists, so
      // create an temporary alarm to avoid race condition issues
      chrome.alarms.create(licenseAlarmName, { delayInMinutes: (24 * 60) });
      License.ready().then(() => {
        License.updatePeriodically();
      });
    }
  });

  // Check if the computer was woken up, and if there was a pending alarm
  // that should fired during the sleep, then
  // remove it, and fire the update ourselves.
  // see - https://bugs.chromium.org/p/chromium/issues/detail?id=471524
  chrome.idle.onStateChanged.addListener((newState) => {
    if (newState === 'active') {
      chrome.alarms.get(licenseAlarmName, (alarm) => {
        if (alarm && Date.now() > alarm.scheduledTime) {
          chrome.alarms.clear(licenseAlarmName, () => {
            License.updatePeriodically();
          });
        } else if (alarm) {
          // if the alarm should fire in the future,
          // re-add the license so it fires at the correct time
          const originalTime = alarm.scheduledTime;
          chrome.alarms.clear(licenseAlarmName, (wasCleared) => {
            if (wasCleared) {
              chrome.alarms.create(licenseAlarmName, { when: originalTime });
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
  const loadFromStorage = function (callback) {
    chrome.storage.local.get(licenseStorageKey).then((response) => {
      const localLicense = storageGet(licenseStorageKey);
      theLicense = response[licenseStorageKey] || localLicense || {};
      if (typeof callback === 'function') {
        callback();
      }
    });
  };

  return {
    licenseStorageKey,
    popupMenuCtaClosedKey,
    userClosedSyncCTAKey,
    userSawSyncCTAKey,
    showPopupMenuThemesCtaKey,
    themesForCTA,
    pageReloadedOnSettingChangeKey,
    initialized,
    licenseAlarmName,
    licenseTimer: undefined, // the license update timer token
    licenseNotifier,
    MAB_CONFIG,
    isProd,
    enrollUser(enrollReason) {
      loadFromStorage(() => {
        // only enroll users if they were not previously enrolled
        if (typeof theLicense.myadblock_enrollment === 'undefined') {
          theLicense.myadblock_enrollment = true;
          License.set(theLicense);
          // only process updates for now
          if (enrollReason === 'update') {
            License.showIconBadgeCTA(true);
          }
        }
      });
    },
    get() {
      return theLicense;
    },
    set(newLicense) {
      if (newLicense) {
        theLicense = newLicense;
        // store in redudant locations
        chrome.storage.local.set({ license: theLicense });
        storageSet('license', theLicense);
      }
    },
    initialize(callback) {
      loadFromStorage(() => {
        if (typeof callback === 'function') {
          callback();
        }
        readyComplete();
      });
    },
    getCurrentPopupMenuThemeCTA() {
      const theme = License.themesForCTA[currentThemeIndex];
      const lastThemeIndex = License.themesForCTA.length - 1;
      currentThemeIndex = lastThemeIndex === currentThemeIndex ? 0 : currentThemeIndex += 1;
      return theme || '';
    },
    // Get the latest license data from the server, and talk to the user if needed.
    update() {
      STATS.untilLoaded((userID) => {
        licenseNotifier.emit('license.updating');
        const postData = {};
        postData.u = userID;
        postData.cmd = 'license_check';
        const licsenseStatusBefore = License.get().status;
        // license version
        postData.v = '1';
        $.ajax({
          jsonp: false,
          url: License.MAB_CONFIG.licenseURL,
          type: 'post',
          success(text) {
            ajaxRetryCount = 0;
            let updatedLicense = {};
            if (typeof text === 'object') {
              updatedLicense = text;
            } else if (typeof text === 'string') {
              try {
                updatedLicense = JSON.parse(text);
              } catch (e) {
                // eslint-disable-next-line no-console
                console.log('Something went wrong with parsing license data.');
                // eslint-disable-next-line no-console
                console.log('error', e);
                // eslint-disable-next-line no-console
                console.log(text);
                return;
              }
            }
            licenseNotifier.emit('license.updated', updatedLicense);
            if (!updatedLicense) {
              return;
            }
            // merge the updated license
            theLicense = $.extend(theLicense, updatedLicense);
            theLicense.licenseId = theLicense.code;
            License.set(theLicense);
            // now check to see if we need to do anything because of a status change
            if (
              licsenseStatusBefore === 'active'
              && updatedLicense.status
              && updatedLicense.status === 'expired'
            ) {
              License.processExpiredLicense();
              recordGeneralMessage('trial_license_expired');
            }
          },
          error(xhr, textStatus, errorThrown) {
            log('license server error response', xhr, textStatus, errorThrown, ajaxRetryCount);
            licenseNotifier.emit('license.updated.error', ajaxRetryCount);
            ajaxRetryCount += 1;
            if (ajaxRetryCount > 3) {
              log('Retry Count exceeded, giving up', ajaxRetryCount);
              return;
            }
            const oneMinute = 1 * 60 * 1000;
            setTimeout(() => {
              License.updatePeriodically(`error${ajaxRetryCount}`);
            }, oneMinute);
          },
          data: postData,
        });
      });
    },
    processExpiredLicense() {
      theLicense = License.get();
      theLicense.myadblock_enrollment = true;
      License.set(theLicense);
      setSetting('picreplacement', false);
      setSetting('sync_settings', false);
      setSetting('color_themes', { popup_menu: 'default_theme', options_page: 'default_theme' });
      chrome.alarms.clear(licenseAlarmName);
    },
    ready() {
      return licensePromise;
    },
    updatePeriodically() {
      if (!License.isActiveLicense()) {
        return;
      }
      License.update();
      chrome.storage.local.get(installTimestampStorageKey).then((response) => {
        let installTimestamp = response[installTimestampStorageKey];
        const localTimestamp = storageGet(installTimestampStorageKey);
        const originalInstallTimestamp = installTimestamp || localTimestamp || Date.now();
        // If the installation timestamp is missing from both storage locations,
        // save an updated version
        if (!(response[installTimestampStorageKey] || localTimestamp)) {
          installTimestamp = Date.now();
          storageSet(installTimestampStorageKey, installTimestamp);
          chrome.storage.local.set({ install_timestamp: installTimestamp });
        }
        const originalInstallDate = new Date(originalInstallTimestamp);
        let nextLicenseCheck = new Date();
        if (originalInstallDate.getHours() <= nextLicenseCheck.getHours()) {
          nextLicenseCheck.setDate(nextLicenseCheck.getDate() + 1);
        }
        nextLicenseCheck.setHours(originalInstallDate.getHours());
        nextLicenseCheck.setMinutes(originalInstallDate.getMinutes());
        // Add 5 minutes to the 'minutes' to make sure we've allowed enought time for '1' day
        nextLicenseCheck = new Date(nextLicenseCheck.getTime() + fiveMinutes);
        chrome.alarms.create(licenseAlarmName, { when: nextLicenseCheck.getTime() });
      });
    },
    getLicenseInstallationDate(callback) {
      if (typeof callback !== 'function') {
        return;
      }
      chrome.storage.local.get(installTimestampStorageKey).then((response) => {
        const localTimestamp = storageGet(installTimestampStorageKey);
        const originalInstallTimestamp = response[installTimestampStorageKey] || localTimestamp;
        if (originalInstallTimestamp) {
          callback(new Date(originalInstallTimestamp));
        } else {
          callback(undefined);
        }
      });
    },
    // activate the current license and configure the extension in licensed mode.
    // Call with an optional delay parameter (in milliseconds) if the first license
    // update should be delayed by a custom delay (default is 0 minutes).
    activate(delayMs) {
      let delay = delayMs;
      const currentLicense = License.get() || {};
      currentLicense.status = 'active';
      License.set(currentLicense);
      reloadOptionsPageTabs();
      if (typeof delay !== 'number') {
        delay = 0; // 0 minutes
      }
      if (!this.licenseTimer) {
        this.licenseTimer = window.setTimeout(() => {
          License.updatePeriodically();
        }, delay);
      }
      setSetting('picreplacement', false);
    },
    isActiveLicense() {
      return License && License.get() && License.get().status === 'active';
    },
    isLicenseCodeValid() {
      return License && License.get().code && typeof License.get().code === 'string';
    },
    isMyAdBlockEnrolled() {
      return License && License.get() && License.get().myadblock_enrollment === true;
    },
    shouldShowMyAdBlockEnrollment() {
      return License.isMyAdBlockEnrolled() && !License.isActiveLicense();
    },
    shouldShowBlacklistCTA(newValue) {
      const currentLicense = License.get() || {};
      if (typeof newValue === 'boolean') {
        currentLicense.showBlacklistCTA = newValue;
        License.set(currentLicense);
        return null;
      }

      if (typeof currentLicense.showBlacklistCTA === 'undefined') {
        currentLicense.showBlacklistCTA = true;
        License.set(currentLicense);
      }
      return License && License.get() && License.get().showBlacklistCTA === true;
    },
    shouldShowWhitelistCTA(newValue) {
      const currentLicense = License.get() || {};
      if (typeof newValue === 'boolean') {
        currentLicense.showWhitelistCTA = newValue;
        License.set(currentLicense);
        return null;
      }

      if (typeof currentLicense.showWhitelistCTA === 'undefined') {
        currentLicense.showWhitelistCTA = true;
        License.set(currentLicense);
      }
      return License && License.get() && License.get().showWhitelistCTA === true;
    },
    displayPopupMenuNewCTA() {
      const isNotActive = !License.isActiveLicense();
      const variant = License.get() ? License.get().var : undefined;
      return License && isNotActive && [3, 4].includes(variant);
    },
    /**
     * Handles the display of the New badge on the toolbar icon.
     * @param {Boolean} [showBadge] true shows the badge, false removes the badge
     */
    showIconBadgeCTA(showBadge) {
      if (showBadge) {
        let newBadgeText = translate('new_badge');
        // 'New' Badge Text that exceeds 4 characters is truncated on the toolbar badge,
        // so we default to English
        if (!newBadgeText || newBadgeText.length >= 5) {
          newBadgeText = 'New';
        }
        storageSet(statsInIconKey, Prefs.show_statsinicon);
        Prefs.show_statsinicon = false;
        // wait 10 seconds to allow any other ABP setup tasks to finish
        setTimeout(() => {
          // process currrently opened tabs
          chrome.tabs.query({}).then((tabs) => {
            for (const tab of tabs) {
              const page = new ext.Page(tab);
              page.browserAction.setBadge({
                color: '#03bcfc',
                number: newBadgeText,
              });
            }
            // set for new tabs
            chrome.browserAction.setBadgeBackgroundColor({ color: '#03bcfc' });
            chrome.browserAction.setBadgeText({ text: newBadgeText });
          });
        }, 10000); // 10 seconds
      } else {
        // Restore show_statsinicon if we previously stored its value
        const storedValue = storageGet(statsInIconKey);
        if (typeof storedValue === 'boolean') {
          Prefs.show_statsinicon = storedValue;
        }
        chrome.browserAction.setBadgeText({ text: '' });
      }
    },
    // fetchLicenseAPI automates the common steps required to call the /license/api endpoint.
    // POST bodies will always automatically contain the command, license and userid so only
    // provide the missing fields in the body parameter. The ok callback handler receives the
    // data returned by the API and the fail handler receives any error information available.
    fetchLicenseAPI(command, requestBody, ok, requestFail) {
      const licenseCode = License.get().code;
      const userID = STATS.userId();
      const body = requestBody;
      let fail = requestFail;
      body.cmd = command;
      body.userid = userID;
      if (licenseCode) {
        body.license = licenseCode;
      }
      const request = new Request('https://myadblock.licensing.getadblock.com/license/api/', {
        method: 'POST',
        body: JSON.stringify(body),
      });
      fetch(request)
        .then((response) => {
          if (response.ok) {
            return response.json();
          }
          fail(response.status);
          fail = null;
          return Promise.resolve({});
        })
        .then((data) => {
          ok(data);
        })
        .catch((err) => {
          fail(err);
        });
    },
  };
}());

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.command === 'payment_success' && request.version === 1) {
    License.activate();
    sendResponse({ ack: true });
  }
});

const replacedPerPage = new ext.PageMap();

// Records how many ads have been replaced by AdBlock.  This is used
// by the AdBlock to display statistics to the user.
const replacedCounts = (function getReplacedCount() {
  const key = 'replaced_stats';
  let data = storageGet(key);
  if (!data) {
    data = {};
  }
  if (data.start === undefined) {
    data.start = Date.now();
  }
  if (data.total === undefined) {
    data.total = 0;
  }
  data.version = 1;
  storageSet(key, data);

  return {
    recordOneAdReplaced(tabId) {
      data = storageGet(key);
      data.total += 1;
      storageSet(key, data);

      const myPage = ext.getPage(tabId);
      let replaced = replacedPerPage.get(myPage) || 0;
      replacedPerPage.set(myPage, replaced += 1);
    },
    get() {
      return storageGet(key);
    },
    getTotalAdsReplaced(tabId) {
      if (tabId) {
        return replacedPerPage.get(ext.getPage(tabId));
      }
      return this.get().total;
    },
  };
}());

// for use in the premium enrollment process
// de-coupled from the `License.ready().then` code below because the delay
// prevents the addListener from being fired in a timely fashion.
const onInstalledPromise = new Promise(((resolve) => {
  chrome.runtime.onInstalled.addListener((details) => {
    resolve(details);
  });
}));
const onBehaviorPromise = new Promise(((resolve) => {
  filterNotifier.on('filter.behaviorChanged', () => {
    resolve();
  });
}));
// the order of Promises below dictacts the order of the data in the detailsArray
Promise.all([onInstalledPromise, License.ready(), onBehaviorPromise]).then((detailsArray) => {
  // Enroll existing users in Premium
  if (detailsArray.length > 0 && detailsArray[0].reason) {
    License.enrollUser(detailsArray[0].reason);
  }
});

let channels = {};
License.ready().then(() => {
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (!(request.message === 'load_my_adblock')) {
      return;
    }
    if (sender.url && sender.url.startsWith('http') && getSettings().picreplacement) {
      const logError = function (e) {
        // eslint-disable-next-line no-console
        console.error(e);
      };
      chrome.tabs.executeScript(sender.tab.id, { file: 'adblock-picreplacement-image-sizes-map.js', frameId: sender.frameId, runAt: 'document_start' }).catch(logError);
      chrome.tabs.executeScript(sender.tab.id, { file: 'adblock-picreplacement.js', frameId: sender.frameId, runAt: 'document_start' }).catch(logError);
    }
    sendResponse({});
  });

  channels = new Channels();
  Object.assign(window, {
    channels,
  });
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.message !== 'get_random_listing') {
      return;
    }

    const myPage = ext.getPage(sender.tab.id);
    if (checkWhitelisted(myPage) || !License.isActiveLicense()) {
      sendResponse({ disabledOnPage: true });
      return;
    }
    const result = channels.randomListing(request.opts);
    if (result) {
      sendResponse(result);
    } else {
      // if not found, and data collection enabled, send message to log server with domain,
      // and request
      sendResponse({ disabledOnPage: true });
    }
  });

  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.message === 'recordOneAdReplaced') {
      sendResponse({});
      if (License.isActiveLicense()) {
        replacedCounts.recordOneAdReplaced(sender.tab.id);
      }
    }
  });

  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.command === 'setBlacklistCTAStatus') {
      if (typeof request.isEnabled === 'boolean') {
        License.shouldShowBlacklistCTA(request.isEnabled);
      }
      sendResponse({});
    }
  });

  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.command === 'setWhitelistCTAStatus') {
      if (typeof request.isEnabled === 'boolean') {
        License.shouldShowWhitelistCTA(request.isEnabled);
      }
      sendResponse({});
    }
  });

  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.command === 'openPremiumPayURL') {
      openTab(License.MAB_CONFIG.payURL);
      sendResponse({});
    }
  });
});

License.initialize(() => {
  if (!License.initialized) {
    License.initialized = true;
  }
});

Object.assign(window, {
  License,
  replacedCounts,
});


/***/ }),
/* 78 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";
/** @module adblock-betafish/getselectors */

/** call by the data collection content script, and if the user has myadblock enabled */



/* For ESLint: List any global identifiers used in this file below */
/* global require, */

const { ElemHide } = __webpack_require__(19);
const { RegExpFilter } = __webpack_require__(0);
const { ElemHideEmulation } = __webpack_require__(21);
const { checkWhitelisted } = __webpack_require__(9);
const { extractHostFromFrame } = __webpack_require__(8);
const { port } = __webpack_require__(7);

port.on('getSelectors', (_message, sender) => {
  let selectors = [];
  let exceptions = [];
  const emulatedPatterns = [];

  if (!checkWhitelisted(sender.page, sender.frame, null,
    RegExpFilter.typeMap.DOCUMENT || RegExpFilter.typeMap.ELEMHIDE)) {
    const hostname = extractHostFromFrame(sender.frame);
    const specificOnly = checkWhitelisted(sender.page, sender.frame, null,
      RegExpFilter.typeMap.GENERICHIDE);

    ({ selectors, exceptions } = ElemHide.generateStyleSheetForDomain(
      hostname,
      specificOnly ? ElemHide.SPECIFIC_ONLY : ElemHide.ALL_MATCHING,
      true, true,
    ));

    for (const filter of ElemHideEmulation.getRulesForDomain(hostname)) {
      emulatedPatterns.push({ selector: filter.selector, text: filter.text });
    }
  }

  const response = { emulatedPatterns, selectors, exceptions };

  return response;
});


/***/ }),
/* 79 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";
/* eslint-disable no-console */
/* eslint-disable camelcase */



/* For ESLint: List any global identifiers used in this file below */
/* global chrome, require, isEmptyObject, storageSet, getSubscriptionsMinusText, Subscription,
   filterStorage, getUrlFromId, synchronizer, DownloadableSubscription, Prefs, parseFilter,
   recordAnonymousMessage */

(() => {
  const migrateLogMessageKey = 'migrateLogMessageKey';
  const storeMigrationLogs = (...args) => {
    console.log(...args);
    const timedLogMessage = `${new Date().toUTCString()}, ${args.join(' ')}`;
    const storedLog = JSON.parse(localStorage.getItem(migrateLogMessageKey) || '[]');
    while (storedLog.length > 500) { // only keep the last 500 log entries
      storedLog.shift();
    }
    storedLog.push(timedLogMessage);
    storageSet(migrateLogMessageKey, storedLog);
  };
  const reloadExtension = () => {
    chrome.runtime.reload();
  };

  // Works for all |input| that are not 'stringified' or stringified' once or twice
  const parse = (input) => {
    try {
      // |input| is double 'stringified'
      return JSON.parse(JSON.parse(input));
    } catch (e) {
      // |input| is not double 'stringified'
      try {
        // |input| is 'stringified' once
        return JSON.parse(input);
      } catch (err) {
        // |input| is not 'stringified' so return it unparsed
        return input;
      }
    }
  };

  const migrateLegacyFilterLists = (edgeFilterLists) => {
    const myEdgeSubsParsed = parse(edgeFilterLists);
    // If we got an Array of Edge filter lists IDs
    if (myEdgeSubsParsed && myEdgeSubsParsed.constructor === Array) {
      const currentSubs = getSubscriptionsMinusText();
      // Unsubscribe default subscriptions if not in the Edge filter lists Array
      for (const id in currentSubs) {
        if (!myEdgeSubsParsed.includes(id)) {
          const currentSub = Subscription.fromURL(currentSubs[id].url);
          filterStorage.removeSubscription(currentSub);
        }
      }
      // Subscribe each Edge filter lists in Chrome if not alreayd subscribed
      for (const id of myEdgeSubsParsed) {
        const changeEdgeIDs = {
          swedish: 'norwegian',
          easylist_lite: 'easylist',
          easylist_plus_estonian: 'url:https://gurud.ee/ab.txt',
        };
        if ((!currentSubs[id] || !currentSubs[id].subscribed)) {
          const filterListId = changeEdgeIDs[id] ? changeEdgeIDs[id] : id;
          let url = getUrlFromId(filterListId);
          let subscription = Subscription.fromURL(url);
          if (!url && filterListId.startsWith('url:')) {
            url = filterListId.slice(4);
            subscription = Subscription.fromURL(url);
          }
          filterStorage.addSubscription(subscription);
          if (subscription instanceof DownloadableSubscription && !subscription.lastDownload) {
            synchronizer.execute(subscription);
          }
        }
      }
    }
  };

  const migrateLegacyCustomFilters = (edgeCustomFilters) => {
    const customFiltersParsed = parse(edgeCustomFilters);
    if (customFiltersParsed && typeof customFiltersParsed === 'string') {
      const customFiltersArray = customFiltersParsed.trim().split('\n');
      for (const customFilter of customFiltersArray) {
        if (customFilter.length > 0) {
          const result = parseFilter(customFilter);
          if (result.filter) {
            filterStorage.addFilter(result.filter);
          }
        }
      }
    }
  };

  const migrateLegacyCustomFilterCount = (edgeCustomFilterCount) => {
    const customFilterCountParsed = parse(edgeCustomFilterCount);
    if (
      customFilterCountParsed
      && customFilterCountParsed.constructor === Object
      && customFilterCountParsed !== edgeCustomFilterCount
    ) {
      return customFilterCountParsed;
    }
    return {};
  };

  const migrateLegacyExcludeFilters = (edgeExcludeFilters) => {
    const parsedExcludeFitlers = parse(edgeExcludeFilters);
    if (parsedExcludeFitlers !== edgeExcludeFilters && typeof parsedExcludeFitlers === 'string') {
      return parsedExcludeFitlers;
    }
    return '';
  };

  const migrateLegacyBlockageStats = (edgeBlockageStats) => {
    let blockStats = parse(edgeBlockageStats);
    // Preventive approach in case at this point is not an object
    if (blockStats.constructor !== Object) {
      blockStats = {};
    }
    // If invalid start value set it to now
    if (typeof blockStats.start !== 'number') {
      blockStats.start = Date.now();
    }
    // If invalid version value set it to 1
    if (typeof blockStats.version !== 'number') {
      blockStats.version = 1;
    }
    // Copy Edge total blocked count before deleting only if valid type
    if (typeof blockStats.total === 'number') {
      Prefs.blocked_total = blockStats.total;
    }
    delete blockStats.total; // Moved and no longer needed
    delete blockStats.malware_total; // Obsolete
    return blockStats;
  };

  // settings are stored only in chrome.storage.local in both Edge and Chrome
  // No localStorage logic necessary here
  const migrateLegacySettings = (edgeSettings) => {
    // Parse data to cover all basis from Chromium odd migration of data formatting
    const settings = parse(edgeSettings);

    if (settings && !isEmptyObject(settings)) {
      const keysToRemove = ['whitelist_hulu_ads', 'show_language_selector'];
      const keysToRename = { data_collection: 'data_collection_v2' };
      const keysToPrefs = {
        display_stats: 'show_statsinicon',
        display_menu_stats: 'show_statsinpopup',
        show_context_menu_items: 'shouldShowBlockElementMenu',
      };

      for (const key in settings) {
        if (typeof settings[key] !== 'boolean') {
          // If invalid value remove the entry to use Chrome default values
          delete settings[key];
        } else if (keysToRemove.includes(key)) {
          // Remove if value explicitly doesn't exist in Chrome
          delete settings[key];
        } else if (Object.keys(keysToRename).includes(key)) {
          // Rename if key changed in Chrome
          settings[keysToRename[key]] = settings[key];
          delete settings[key];
        } else if (Object.keys(keysToPrefs).includes(key)) {
          // Move value from settings to Prefs
          Prefs[keysToPrefs[key]] = settings[key];
          delete settings[key];
        }
      }
      return settings;
    }
    return {};
  };

  // userid, total_pings, next_ping_time
  const migrateLegacyStats = (key, value) => {
    const suffix = '_alt';
    if (key === 'userid') {
      const parsedUserId = parse(value);
      if (typeof parsedUserId === 'string') {
        storageSet(`${key}${suffix}`, parsedUserId);
        return parsedUserId;
      }
    } else {
      const parsedValue = parse(value);
      if (typeof parsedValue === 'number') {
        storageSet(`${key}${suffix}`, parsedValue);
        return parsedValue;
      }
    }
    return key === 'userid' ? '' : 0; // Default values if value type is invalid
  };

  const migrateLastKnownVersion = (key, originalLastKnownVersion) => {
    const versionParsed = parse(originalLastKnownVersion);
    if (versionParsed && typeof versionParsed === 'string') {
      storageSet(key, versionParsed);
    }
  };

  const initMigration = (currentData) => {
    const migratedData = {};

    // Modify or remove data for keys that are in Edge or in both Edge and Chrome
    for (const key in currentData) {
      switch (key) {
        case 'custom_filter_count':
          migratedData[key] = migrateLegacyCustomFilterCount(currentData[key]);
          storeMigrationLogs(`Migration for '${key}' done.`);
          break;
        case 'exclude_filters':
          migratedData[key] = migrateLegacyExcludeFilters(currentData[key]);
          storeMigrationLogs(`Migration for '${key}' done.`);
          break;
        case 'blockage_stats':
          migratedData[key] = migrateLegacyBlockageStats(currentData[key]);
          storeMigrationLogs(`Migration for '${key}' done.`);
          break;
        case 'settings':
          migratedData[key] = migrateLegacySettings(currentData[key]);
          storeMigrationLogs(`Migration for '${key}' done.`);
          break;
        case 'userid':
          migratedData[key] = migrateLegacyStats(key, currentData[key]);
          storeMigrationLogs(`Migration for '${key}' done.`);
          break;
        case 'total_pings':
          migratedData[key] = migrateLegacyStats(key, currentData[key]);
          storeMigrationLogs(`Migration for '${key}' done.`);
          break;
        case 'next_ping_time':
          migratedData[key] = migrateLegacyStats(key, currentData[key]);
          storeMigrationLogs(`Migration for '${key}' done.`);
          break;
        case 'custom_filters':
          migrateLegacyCustomFilters(currentData[key]);
          storeMigrationLogs(`Migration for '${key}' done.`);
          break;
        case 'subscribed_filter_lists':
          migrateLegacyFilterLists(currentData[key]);
          storeMigrationLogs(`Migration for '${key}' done.`);
          break;
        case 'last_known_version':
          migrateLastKnownVersion(key, currentData[key]);
          storeMigrationLogs(`Migration for '${key}' done.`);
          break;
        default:
          // Do nothing since all other keys don't need to be migrated because they
          // are either only in Chrome or they are useless and should be removed
      }
    }

    // Edge specific keys deemed useless at this point
    const removeAfterMigration = [
      'filter_lists',
      'custom_filters',
      'last_known_version',
      'subscribed_filter_lists',
      'last_subscriptions_check',
      'malware-notification',
    ];

    chrome.storage.local.set(migratedData).then(() => {
      chrome.storage.local.remove(removeAfterMigration).then(() => {
        storeMigrationLogs('migration finished.');
        recordAnonymousMessage('cm_migration_finished', 'general', reloadExtension);
      });
    });
  };

  chrome.storage.local.get(null).then((currentData) => {
    const edgeMigrationNeeded = currentData.filter_lists;
    if (edgeMigrationNeeded) {
      try {
        storeMigrationLogs('Migration started.');
        Prefs.untilLoaded.then(() => {
          Prefs.suppress_first_run_page = true;
          initMigration(currentData);
        });
      } catch (error) {
        storeMigrationLogs(`Migration logic error: ${error}`);
      }
    }
  });
})();


/***/ })
/******/ ]);
//# sourceMappingURL=adblockplus.js.map