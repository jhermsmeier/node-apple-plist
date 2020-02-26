var Plist = require( './plist' )
var { writeBigInt64BE, writeBigUInt64BE } = require( './buffer' )

// ObjTypes
const PRIMITIVE = 0b0000
const INT       = 0b0001
const REAL      = 0b0010
const DATE      = 0b0011
const DATA      = 0b0100
const ASCII     = 0b0101
const UNICODE   = 0b0110
const UUID      = 0b1000
const ARRAY     = 0b1010
const SET       = 0b1100
const DICT      = 0b1101

/**
 * Determine integer width required to store the value,
 * clamped to the minimum of one byte (8 bits)
 * @param {Number} value
 * @returns {Number} bits
 */
function bits( value, clamp = 0 ) {
  var bits = Math.ceil( Math.log2( Math.abs( value ) + 1 ) )
  return Math.max( clamp, 1 << Math.ceil( Math.log2( bits ) ) )
}

function signedBits( value, clamp = 0 ) {
  var bits = Math.ceil( Math.log2( Math.abs( value ) ) )
  return Math.max( clamp, 1 << Math.ceil( Math.log2( bits ) ) ) * 2
}

function getTypeof( value ) {
  if( value === null ) return 'null'
  if( Buffer.isBuffer( value ) ) return 'buffer'
  if( Array.isArray( value ) ) return 'array'
  if( ArrayBuffer.isView( value )  ) return 'arraybufferview'
  if( value instanceof Number ) return 'number'
  if( value instanceof String ) return 'string'
  if( value instanceof Boolean ) return 'boolean'
  if( value instanceof Map ) return 'map'
  if( value instanceof Set ) return 'set'
  if( value instanceof ArrayBuffer ) return 'arraybuffer'
  return typeof value
}

function isPrimitiveType( type ) {
  return type == 'null' || type == 'undefined' ||
    type == 'boolean' || type == 'number' || type == 'bigint' ||
    type == 'string' || type == 'date'
}

/**
 * Get a Set of all values within `value`.
 * This is used in the construction of the value offset table,
 * in order to only encode values in the data once.
 * @param {*} value
 * @returns {Set} primitiveValues
 */
function getValueSet( value ) {

  var values = new Set()
  var objects = new Set()
  var queue = [ value ]
  // var buffers = []

  while( queue.length ) {

    let value = queue.shift()
    let type = getTypeof( value )

    if( isPrimitiveType( type ) ) {
      values.add( value )
    } else if( type == 'object' ) {
      objects.add( value )
      Object.keys( value ).forEach(( key ) => {
        values.add( key )
        queue.push( value[ key ] )
      })
    } else if( type == 'array' || type == 'arraybufferview' ) {
      objects.add( value )
      value.forEach(( item ) => {
        queue.push( item )
      })
    } else if( type == 'map' ) {
      objects.add( value )
      for( let [ key, item ] of value ) {
        queue.push( key )
        queue.push( item )
      }
    } else if( type == 'set' ) {
      objects.add( value )
      for( let item of value ) {
        queue.push( item )
      }
    } else if( type == 'buffer' || type == 'arraybuffer' ) {
      // // NOTE: The below was getting a bit too smart about this,
      // // as we'd have to do the same comparison again while actually encoding them
      // value = type == 'arraybuffer' ? Buffer.from( value ) : value
      // let index = buffers.findIndex(( buffer ) => {
      //   return value == buffer || Buffer.compare( value, buffer ) == 0
      // })
      // if( index == -1 ) {
      //   buffers.push( value )
      //   values.add( value )
      // }
      values.add( value )
    } else {
      throw new Error( `Unsupported value type "${ type }"` )
    }

  }

  // buffers.length = 0
  // buffers = undefined

  // NOTE: This `.reverse()` is so that our root-node always comes last -
  // this way we don't have to backfill `objRef`s after writing the objects,
  // and it also keeps our trailer's root-node entry at `objectCount - 1`
  return [ ...values ].concat( [ ...objects ].reverse() )

}

function encode( value, buffer, offset ) {

  offset = offset || 0

  // Values to encode
  var values = getValueSet( value )
  // Total number of objects
  var objectCount = values.length
  // Number of bytes needed for `objRef`s
  var refSize = bits( objectCount, 8 ) / 8
  // Offset table Array<objRef,offset>
  var offsets = new Array( objectCount )
  // We need to keep some state to pass around while encoding objects,
  // as we need to have access to the offsets and `refSize` deep down the rabbit hole
  var state = { offsets, objectCount, refSize }

  // Signature ('bplist') + Version ('00')
  offset += buffer.write( 'bplist00', offset, 'bplist00'.length, 'ascii' )

  // Store all values (booleans, strings, numbers, etc.)
  // and objects (dicts, sets, arrays, etc.)
  for( let i = 0; i < objectCount; i++ ) {
    offsets[i] = offset
    offset = encodeValue( values, i, state, buffer, offset )
  }

  // Write offset table
  var tableOffset = offset
  var offsetSize = bits( tableOffset, 8 ) / 8
  var offsetTable = Buffer.alloc( objectCount * offsetSize )

  for( let i = 0; i < objectCount; i++ ) {
    let dataOffset = offsets[i]
    offset = buffer.writeUIntBE( dataOffset, offset, offsetSize )
  }

  // Write trailer (32 bytes)
  // Bytes 0-6; 0-5 = unused, 6 = sort_version (zero)
  offset = buffer.writeUIntBE( 0x000000000000, offset, 6 )
  // Byte size of offset ints in offset table
  offset = buffer.writeUInt8( offsetSize, offset )
  // Byte size of object refs in arrays and dicts
  offset = buffer.writeUInt8( refSize, offset )
  // Number of offsets in offset table (also is number of objects)
  offset = writeBigUInt64BE( buffer, BigInt( objectCount ), offset )
  // Element # in offset table which is top level object (aka root-node)
  offset = writeBigUInt64BE( buffer, BigInt( objectCount - 1 ), offset )
  // Offset-table offset
  offset = writeBigUInt64BE( buffer, BigInt( tableOffset ), offset )

  return offset

}

function encodeArray( values, index, state, buffer, offset ) {

  var list = values[ index ]
  var length = list.length
  var objInfo = length > 14 ? 0x0F : length

  offset = buffer.writeUInt8( ARRAY << 4 | objInfo, offset )
  offset = objInfo == 0x0F ? encodeInt( length, buffer, offset ) : offset

  for( var i = 0; i < list.length; i++ ) {
    let objRef = values.indexOf( list[i] )
    if( objRef == -1 ) throw new Error( `Attempt to encode unknown object` )
    offset = buffer.writeUIntBE( objRef, offset, state.refSize )
  }

  return offset

}

function encodeSet( values, index, state, buffer, offset ) {

  var list = [ ...values[ index ] ]
  var length = list.length
  var objInfo = length > 14 ? 0x0F : length

  offset = buffer.writeUInt8( SET << 4 | objInfo, offset )
  offset = objInfo == 0x0F ? encodeInt( length, buffer, offset ) : offset

  for( var i = 0; i < list.length; i++ ) {
    let objRef = values.indexOf( list[i] )
    if( objRef == -1 ) throw new Error( `Attempt to encode unknown object` )
    offset = buffer.writeUIntBE( objRef, offset, state.refSize )
  }

  return offset

}

function encodeMap( values, index, state, buffer, offset ) {

  var map = values[ index ]
  var length = map.size
  var objInfo = length > 14 ? 0x0F : length

  offset = buffer.writeUInt8( DICT << 4 | objInfo, offset )
  offset = objInfo == 0x0F ? encodeInt( length, buffer, offset ) : offset

  for( let [ key, value ] of map ) {
    let keyRef = values.indexOf( key )
    if( keyRef == -1 ) throw new Error( `Attempt to encode object with unknown key` )
    offset = buffer.writeUIntBE( keyRef, offset, state.refSize )
  }

  for( let [ key, value ] of map ) {
    let objRef = values.indexOf( value )
    if( objRef == -1 ) throw new Error( `Attempt to encode unknown object` )
    offset = buffer.writeUIntBE( objRef, offset, state.refSize )
  }

  return offset

}

function encodeDict( values, index, state, buffer, offset ) {

  var dict = values[ index ]
  var keys = Object.keys( dict )
  var length = keys.length
  var objInfo = length > 14 ? 0x0F : length

  offset = buffer.writeUInt8( DICT << 4 | objInfo, offset )
  offset = objInfo == 0x0F ? encodeInt( length, buffer, offset ) : offset

  for( let i = 0; i < length; i++ ) {
    let keyRef = values.indexOf( keys[i] )
    if( keyRef == -1 ) throw new Error( `Attempt to encode object with unknown key` )
    offset = buffer.writeUIntBE( keyRef, offset, state.refSize )
  }

  for( let i = 0; i < length; i++ ) {
    let objRef = values.indexOf( dict[ keys[i] ] )
    if( objRef == -1 ) throw new Error( `Attempt to encode unknown object` )
    offset = buffer.writeUIntBE( objRef, offset, state.refSize )
  }

  return offset

}

function encodeValue( values, index, state, buffer, offset ) {
  var type = getTypeof( values[ index ] )
  switch( type ) {
    case 'null': case 'undefined': case 'boolean':
      return encodeBoolean( values[ index ], buffer, offset )
    case 'number': case 'bigint':
      return encodeNumber( values[ index ], buffer, offset )
    case 'date':
      return encodeDate( values[ index ], buffer, offset )
    case 'string':
      return encodeString( values[ index ], buffer, offset )
    case 'buffer':
      return encodeBlob( values[ index ], buffer, offset )
    case 'arraybuffer':
      return encodeBlob( Buffer.from( values[ index ] ), buffer, offset )
    case 'array': case 'arraybufferview':
      return encodeArray( values, index, state, buffer, offset )
    case 'set':
      return encodeSet( values, index, state, buffer, offset )
    case 'map':
      return encodeMap( values, index, state, buffer, offset )
    case 'object':
      return encodeDict( values, index, state, buffer, offset )
    default:
      throw new Error( `Invalid value type "${type}"` )
  }
}

function encodeBoolean( value, buffer, offset ) {
  switch( value ) {
    case undefined: case null: return buffer.writeUInt8( PRIMITIVE << 4 | 0b0000, offset )
    case false: return buffer.writeUInt8( PRIMITIVE << 4 | 0b1000, offset )
    case true: return buffer.writeUInt8( PRIMITIVE << 4 | 0b1001, offset )
    // NOTE: fill  0000 1111     // fill byte
    // case undefined: return buffer.writeUInt8( PRIMITIVE << 4 | 0b1111, offset )
    default: throw new Error( `Invalid primitive value "${ value }"` )
  }
}

function encodeNumber( value, buffer, offset ) {

  var shouldFloat = Math.abs( Number( value ) ) > Number.MAX_SAFE_INTEGER ||
    !Number.isFinite( value ) || ( Math.round( value ) != value )

  return shouldFloat ?
    encodeReal( value, buffer, offset ) :
    encodeInt( value, buffer, offset )

}

function encodeInt( value, buffer, offset ) {

  var size = Math.abs( Number( value ) ) <= Number.MAX_SAFE_INTEGER ?
    signedBits( Number( value ), 8 ) : 128

  // Write objType + objInfo
  offset = buffer.writeUInt8( INT << 4 | Math.log2( size / 8 ), offset )

  // Write value
  switch( size ) {
    case 8: offset = buffer.writeInt8( Number( value ), offset ); break
    case 16: offset = buffer.writeInt16BE( Number( value ), offset ); break
    case 32: offset = buffer.writeInt32BE( Number( value ), offset ); break
    case 64: offset = writeBigInt64BE( buffer, BigInt( value ), offset ); break
    case 128:
      offset = writeBigInt64BE( buffer, BigInt( value ) >> 64n, offset )
      offset = writeBigUInt64BE( buffer, BigInt( value ) & 0xFFFFFFFFFFFFFFFFn, offset )
      break
    default:
      throw new Error( `${ size } bit integers not supported` )
  }

  return offset

}

function encodeReal( value, buffer, offset ) {

  var size = Math.abs( Number( value ) ) <= Number.MAX_SAFE_INTEGER ?
    bits( Number( value ), 32 ) : 64

  if( size > 64 ) {
    throw new Error( `${ size } bit reals not supported` )
  }

  // Write objType + objInfo
  offset = buffer.writeUInt8( REAL << 4 | Math.log2( size / 8 ), offset )

  // Write value
  switch( size ) {
    case 32: offset = buffer.writeFloatBE( Number( value ), offset ); break
    case 64: offset = buffer.writeDoubleBE( Number( value ), offset ); break
  }

  return offset

}

function encodeDate( value, buffer, offset ) {

  var time = ( value.getTime() / 1000 ) - Plist.EPOCH
  // Write objType + objInfo
  offset = buffer.writeUInt8( DATE << 4 | DATE, offset )
  // Write value
  offset = buffer.writeDoubleBE( time, offset )

  return offset

}

function encodeString( value, buffer, offset ) {

  var isUUID = /^[A-F0-9]{8}(-[A-F0-9]{4}){3}-[A-F0-9]{12}$/i.test( value )
  if( isUUID ) return encodeUID( value, buffer, offset )

  var length = Buffer.byteLength( value )
  var isUnicode = length != value.length || !/^[\x00-\x7F]+$/.test( value )
  var marker = isUnicode ? UNICODE : ASCII
  var objInfo = length > 14 ? 0x0F : length

  offset = buffer.writeUInt8( marker << 4 | objInfo, offset )
  offset = objInfo == 0x0F ? encodeInt( length, buffer, offset ) : offset
  offset += buffer.write( value, offset, length, isUnicode ? 'utf16le' : 'ascii' )

  return offset

}

function encodeUID( value, buffer, offset ) {

  // Length is always encoded as (n - 1)
  // NOTE: In this particular case we only encode UUIDs we detect,
  // so this is always (16 - 1) = 15 bytes
  var length = 15

  offset = buffer.writeUInt8( UUID << 4 | length, offset )

  // TODO: Some of these should be flipped according to the bin <> hex transform
  // specified for UUIDs if I recall correctly
  offset += buffer.write( value.slice( 0, 8 ), offset, 8, 'hex' )
  offset += buffer.write( value.slice( 9, 13 ), offset, 4, 'hex' )
  offset += buffer.write( value.slice( 14, 18 ), offset, 4, 'hex' )
  offset += buffer.write( value.slice( 19, 23 ), offset, 4, 'hex' )
  offset += buffer.write( value.slice( 24, 36 ), offset, 12, 'hex' )

  return offset

}

function encodeBlob( value, buffer, offset ) {

  var length = value.length || Buffer.byteLength( value )
  var objInfo = length > 14 ? 0x0F : length

  offset = buffer.writeUInt8( DATA << 4 | objInfo, offset )
  offset = objInfo == 0x0F ? encodeInt( length, buffer, offset ) : offset
  offset += value.copy( buffer, offset, 0, length )

  return offset

}

module.exports = encode
