var Plist = require( '../plist' )
var { writeBigInt64BE, writeBigUInt64BE } = require( '../buffer' )
var getType = require( '../typeof' )

const SIGNATURE = Buffer.from( 'bplist00', 'ascii' )

const MARKER = {
  NULL: 0b00000000,
  FALSE: 0b00001000,
  TRUE: 0b00001001,
  FILL: 0b00001111,
  INT: 0b00010000,
  REAL: 0b00100000,
  DATE: 0b00110000,
  DATA: 0b01000000,
  ASCII: 0b01010000,
  UNICODE: 0b01100000,
  UID: 0b10000000,
  ARRAY: 0b10100000,
  SET: 0b11000000,
  DICT: 0b11010000,
}

const NULL = Buffer.from([ MARKER.NULL ])
const FALSE = Buffer.from([ MARKER.FALSE ])
const TRUE = Buffer.from([ MARKER.TRUE ])
const FILL = Buffer.from([ MARKER.FILL ])

// function align( value, boundary ) {
//   return value + ( boundary - ( value % boundary ) ) % boundary
// }

// function uintByteLength( value ) {
//   if( value <= 0xFF ) return 1
//   // var bytes = ( ( 32 - Math.clz32( value ) ) || Math.log2( value ) ) / 8
//   var bytes = Math.ceil( Math.log2( Math.abs( value ) ) ) / 8
//   return bytes + ( 2 - ( bytes % 2 )) % 2
// }

function uintByteLength( value ) {
  var abs = Math.abs( value )
  if( abs <= 0x7F ) return 1
  else if( abs <= 0x7FFF ) return 2
  else if( abs <= 0x7FFFFFFF ) return 4
  else return 8
}

function encodeInt( value ) {

  var length = 0
  var abs = Math.abs( value )

  if( abs > Number.MAX_SAFE_INTEGER ) {
    throw new Error( `Numbers larger than Number.MAX_SAFE_INTEGER not supported` )
  }

  if( abs <= 0x7F ) length = 1
  else if( abs <= 0x7FFF ) length = 2
  else if( abs <= 0x7FFFFFFF ) length = 4
  else length = 8

  var buffer = Buffer.allocUnsafe( length + 1 )

  buffer[0] = ( 0b0001 << 4 ) | Math.log2( length )

  length < 8 ?
    buffer.writeIntBE( value, 1, length ) :
    int64.writeIntBE( buffer, value, 1 )

  return buffer

}

function encodeReal( value, buffer, offset ) {

  if( Math.abs( value ) > Number.MAX_SAFE_INTEGER ) {
    throw new Error( `Numbers larger than Number.MAX_SAFE_INTEGER not supported` )
  }

  // Determine whether the value is safely representable as a 32-bit float
  var useFloat = Math.abs( Math.fround( value ) - value ) <= Number.EPSILON
  var length = useFloat ? 4 : 8
  var buffer = buffer || Buffer.allocUnsafe( length + 1 )

  buffer[0] = ( 0b0010 << 4 ) | Math.log2( length )

  useFloat ?
    buffer.writeFloatBE( value, 1 ) :
    buffer.writeDoubleBE( value, 1 )

  return buffer

}

function encodeNumber( value ) {
  return value % 1 === 0 ?
    encodeInt( value ) :
    encodeReal( value )
}

function encodeAscii( context, value ) {
  var length = value.length
}

function encodeUnicode( context, value ) {
  var length = value.length * 2
}

function encodeString( context, value ) {
  return /^[\x00-\xFF]*$/.test( value ) ?
    encodeAscii( context, value ) :
    encodeUnicode( context, value )
}

function encodeBoolean( context, value ) {
  context.buffers.push( value ? TRUE : FALSE )
  context.bytes += 1
}

function encodeData( context, value ) {

}

function encodeArray( context, value ) {

  var length = value.length
  var byteLength = 1 + ( length * context.objectRefSize )

  var intSize = 1
  var buffer = null

  if( length < 0x0F ) {
    buffer = Buffer.allocUnsafe( byteLength )
    buffer.writeUInt8( MARKER.DICT | length, 0 )
  } else {
    intSize = uintByteLength( length )
    buffer = Buffer.allocUnsafe( byteLength += intSize )
    buffer.writeUInt8( MARKER.DICT | 0x0F, 0 )
    // FIXME: Missing marker byte, etc.
    buffer.writeUIntBE( length, 1, intSize )
  }

  for( var i = 0; i < length; i++ ) {
    value[i]
  }

  context.buffers.push( buffer )
  context.bytes += buffer.length

}

function encodeDict( context, value ) {

  var keys = Object.keys( value )
  var length = keys.length
  // Marker + keyRefs + objRefs
  var byteLength = 1 + (( length * 2 ) * context.objectRefSize )

  var intSize = 1
  var buffer = null

  if( length < 0x0F ) {
    buffer = Buffer.allocUnsafe( byteLength )
    buffer.writeUInt8( MARKER.DICT | length, 0 )
  } else {
    intSize = uintByteLength( length )
    buffer = Buffer.allocUnsafe( byteLength += intSize )
    buffer.writeUInt8( MARKER.DICT | 0x0F, 0 )
    // FIXME: Missing marker byte, etc.
    buffer.writeUIntBE( length, 1, intSize )
  }

  for( var i = 0; i < length; i++ ) {
    keys[i]
  }

  for( var i = 0; i < length; i++ ) {
    value[ keys[i] ]
  }

  context.buffers.push( buffer )
  context.bytes += buffer.length

}

function encodeObject( context, value ) {

  if( value == null ) return encodeNull( context, value )

  var type = getType( value )

  switch( type ) {
    case 'object': return encodeDict( context, value )
    case 'string': return encodeString( context, value )
    case 'symbol': return encodeString( context, value.description )
    case 'number': return encodeNumber( context, value )
    case 'bigint': return encodeBigInt( context, value )
    case 'boolean': return encodeBoolean( context )
    case 'buffer': return encodeData( context, value )
    case 'array': return encodeArray( context, value )
    case 'set': return encodeSet( context, value )
    case 'map': return encodeMap( context, value )
    case 'arraybufferview': return encodeData( Buffer.from( value.buffer, value.byteOffset, value.byteLength ), depth )
    case 'arraybuffer': return encodeData( Buffer.from( value ), depth )
    default: throw new Error( `Unknown data type "${type}"` )
  }

}

function addObject( context, obj ) {
  var index = context.objects.indexOf( obj )
  // TODO: Figure out whether it's safe to de-duplicate,
  // since it might not be guaranteed that native implementations
  // copy data out, but use it in place in memory,
  // potentially causing side-effects through mutation of values
  // NOTE: Test this ^ with XCode / plutil and a binary plist with two deduped keys
  if( index === -1 ) {
    index = context.objects.push( obj ) - 1
    context.objectCount++
  }
  return index
}

function flattenObject( context, value ) {
  var keys = Object.keys( value )
  for( var i = 0; i < keys.length; i++ ) {
    addObject( context, keys[i] )
    flatten( context, value[ keys[i] ] )
  }
}

function flattenArray( context, value ) {
  for( var i = 0; i < value.length; i++ ) {
    flatten( context, value[i] )
  }
}

function flattenMap( context, value ) {
  value.forEach(( value, key ) => {
    addObject( context, key )
    flatten( context, value )
  })
}

function flattenSet( context, value ) {
  value.forEach(( value ) => {
    flatten( context, value )
  })
}

function flatten( context, value ) {

  var type = getType( value )

  addObject( context, value )

  switch( type ) {
    case 'object': flattenObject( context, value ); break
    case 'array': flattenArray( context, value ); break
    case 'map': flattenMap( context, value ); break
    case 'set': flattenSet( context, value ); break
  }

}

function encode( data, buffer, offset ) {

  var context = {
    // Internal
    buffers: [],
    objects: [],
    offsets: {},
    bytes: 0,
    // Trailer
    sortVersion: 0,
    offsetIntSize: 1,
    objectRefSize: 1,
    objectCount: 0,
    rootObject: 0,
    offsetTableOffset: 0,
  }

  // Signature + version (ASCII "bplist00")
  context.buffers.push( SIGNATURE )
  context.bytes += SIGNATURE.length

  // Get a flat, de-duplicated representation of all objects to be encoded
  flatten( context, data )

  // Calculate number of bytes needed to encode object references
  context.objectRefSize = uintByteLength( context.objectCount )

  for( var i = 0; i < context.objects.length; i++ ) {
    encodeObject( context, context.objects[i] )
  }

  // console.log( context )

  // Calculate number of bytes needed for offsets
  context.offsetIntSize = uintByteLength( context.offsetTableOffset ) // + context.objectCount * context.offsetIntSize (?)

  // Set up offset table
  var offsetTable = Buffer.alloc( context.objectCount * context.offsetIntSize )

  for( var i = 0; i < context.offsets.length; i++ ) {
    buffer.writeUIntBE( context.offsets[i], context.offsetIntSize )
  }

  context.buffers.push( offsetTable )

  var trailer = Buffer.allocUnsafe( 32 )

  // Write Trailer
  trailer.writeUInt8( context.sortVersion, 5 )
  trailer.writeUInt8( context.offsetIntSize, 6 )
  trailer.writeUInt8( context.objectRefSize, 7 )
  int64.writeUIntBE( context.objectCount, trailer, 8 )
  int64.writeUIntBE( context.rootObject, trailer, 16 )
  int64.writeUIntBE( context.offsetTableOffset, trailer, 24 )

  context.buffers.push( trailer )
  context.bytes += trailer.length

  var buffer = Buffer.concat( context.buffers, context.bytes )

  context.buffers = []
  context = null

  return buffer

}

module.exports = encode
