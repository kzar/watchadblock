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
  media: 128,
  'document': 16384,
  elemhide: 32768,
  //BELOW ISN'T SUPPORTED YET
  object_subrequest: 64,
  font: 256,
  dtd: 512,
  other: 1024,
  xbl: 2048,
  ping: 4096,
  xmlhttprequest: 8192,
  donottrack: 65536
  // if you add something here, update .ALL below
};
ElementTypes.ALLRESOURCETYPES = 16383; // all types that apply to resources
ElementTypes.ALL = 131071; // all bits turned on

// Return the ElementType element type of the given element.
ElementTypes.forNodeName = function(name) {
  switch (name) {
    case 'INPUT': 
    case 'IMG': return ElementTypes.image;
    case 'SCRIPT': return ElementTypes.script;
    case 'OBJECT': 
    case 'EMBED': return ElementTypes.object;
    case 'VIDEO': 
    case 'AUDIO': 
    case 'SOURCE': return ElementTypes.media;
    case 'FRAME': 
    case 'IFRAME': return ElementTypes.subdocument;
    case 'LINK': return ElementTypes.stylesheet;
    case 'BODY': return ElementTypes.background;
    default: return ElementTypes.NONE;
  }
}
// Return the ElementType element type for the type reported by chrome's
// beforeRequest event handler.
ElementTypes.forChromeRequestType = function(type) {
  switch (type) {
    case 'main_frame': return ElementTypes.document;
    case 'sub_frame': return ElementTypes.subdocument;
    // TODO not sure what to do here since 'object' can mean the initial load or a subrequest
    case 'object': return ElementTypes.object_subrequest;
    // TODO also not sure if this should be 'xmlhttprequest' or what, since 'other' covers several things
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
