module.exports = function getTypeOf( value ) {

  if( value === null ) return 'null'

  var type = typeof value
  var isPrimitive = type == 'undefined' ||
    type == 'number' ||
    type == 'bigint' ||
    type == 'string' ||
    type == 'boolean' ||
    type == 'symbol'

  if( isPrimitive ) return type

  if( Buffer.isBuffer( value ) ) return 'buffer'
  if( Array.isArray( value ) ) return 'array'
  if( ArrayBuffer.isView( value ) ) return 'arraybufferview'
  if( value instanceof Number ) return 'number'
  if( value instanceof Boolean ) return 'boolean'
  if( value instanceof ArrayBuffer ) return 'arraybuffer'
  if( value instanceof Date ) return 'date'
  if( value instanceof Set ) return 'set'
  if( value instanceof Map ) return 'map'

  return type

}
