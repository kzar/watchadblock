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
  // if you add something here, update .ALL below
}
ElementTypes.ALL = 63; // all bits turned on

var FilterOptions = {
  NONE: 0,
  THIRDPARTY: 1,
  MATCHCASE: 2, // TODO: doesn't work yet
}
