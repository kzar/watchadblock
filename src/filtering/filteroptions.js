// The options that can be specified on filters.  The first several options
// specify the type of a URL request.

var ElementTypes = {
  NONE: 0,
  script: 1,
  image: 2,
  background: 4,
  stylesheet: 8,
  'object': 16,
  subdocument: 32,
  object_subrequest: 64,
  media: 128,
  other: 256,
  xmlhttprequest: 512,
  'document': 1024,
  elemhide: 2048,
  popup: 4096,
  // If you add something here, update .ALLRESOURCES below.
};
ElementTypes.ALLRESOURCETYPES = 1023; // all types that apply to resources
// Any unknown options on filters will be converted to $UNSUPPORTED,
// which no resource will match.
// This covers: donottrack font media (and anything unrecognized)
ElementTypes.UNSUPPORTED = 65536;

// Convert a webRequest.onBeforeRequest type to an ElementType.
ElementTypes.fromOnBeforeRequestType = function(type) {
  switch (type) {
    case 'main_frame': return ElementTypes.document;
    case 'sub_frame': return ElementTypes.subdocument;
    // See chromium:93542: object subrequests are called 'object'.
    // See http://src.chromium.org/viewvc/chrome/trunk/src/webkit/glue/resource_type.h?view=markup
    // for what 'other' includes
    case 'other': return ElementTypes.other;
    default: return ElementTypes[type];
  }
}

var FilterOptions = {
  NONE: 0,
  THIRDPARTY: 1,
  MATCHCASE: 2,
  FIRSTPARTY: 4
};
