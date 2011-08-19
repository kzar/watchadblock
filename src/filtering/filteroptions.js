// The options that can be specified on filters.  The first several options
// specify the type of a URL request.

var ElementTypes = {
  NONE: 0,
  script: 1,
  image: 2,
  background: 4,
  stylesheet: 8,
  'object': 16,
  // See chromium:93542: 'object' can mean an object or an object
  // subrequest.  So we apply filters of either type to 'object'
  // requests, by pretending object_subrequest is a synonym for
  // object.
  object_subrequest: 16,
  subdocument: 32,
  media: 128,
  other: 1024,
  xmlhttprequest: 8192,
  'document': 16384,
  elemhide: 32768,
  //BELOW ISN'T SUPPORTED YET
  font: 256,
  dtd: 512,
  xbl: 2048,
  ping: 4096,
  donottrack: 65536
  // if you add something here, update .ALL below
};
ElementTypes.ALLRESOURCETYPES = 16383; // all types that apply to resources
ElementTypes.ALL = 131071; // all bits turned on

// Convert a webRequest.onBeforeRequest type to an ElementType.
ElementTypes.fromOnBeforeRequestType = function(type) {
  switch (type) {
    case 'main_frame': return ElementTypes.document;
    case 'sub_frame': return ElementTypes.subdocument;
    // See chromium:93542: object subrequests are called 'object'.
    // TODO what does 'other' cover exactly?
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
