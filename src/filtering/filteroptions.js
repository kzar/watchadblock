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
  //BELOW ISN'T SUPPORTED YET
  object_subrequest: 64,
  font: 256,
  dtd: 512,
  other: 1024,
  xbl: 2048,
  ping: 4096,
  xmlhttprequest: 8192,
  'document': 16384,
  elemhide: 32768
  // if you add something here, update .ALL below
}
ElementTypes.ALL = 65535; // all bits turned on

var FilterOptions = {
  NONE: 0,
  THIRDPARTY: 1,
  MATCHCASE: 2,
  FIRSTPARTY: 4
}
