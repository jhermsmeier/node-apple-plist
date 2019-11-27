var Plist = require( './plist' )
var { readBigInt64BE, readBigUInt64BE } = require( './buffer' )

/*
HEADER
  magic number ("bplist")
  file format version

OBJECT TABLE
  variable-sized objects

  Object Formats (marker byte followed by additional info in some cases)
  null  0000 0000
  bool  0000 1000     // false
  bool  0000 1001     // true
  fill  0000 1111     // fill byte
  int 0001 nnnn ...   // # of bytes is 2^nnnn, big-endian bytes
  real  0010 nnnn ...   // # of bytes is 2^nnnn, big-endian bytes
  date  0011 0011 ...   // 8 byte float follows, big-endian bytes
  data  0100 nnnn [int] ... // nnnn is number of bytes unless 1111 then int count follows, followed by bytes
  string  0101 nnnn [int] ... // ASCII string, nnnn is # of chars, else 1111 then int count, then bytes
  string  0110 nnnn [int] ... // Unicode string, nnnn is # of chars, else 1111 then int count, then big-endian 2-byte uint16_t
    0111 xxxx     // unused
  uid 1000 nnnn ...   // nnnn+1 is # of bytes
    1001 xxxx     // unused
  array 1010 nnnn [int] objref* // nnnn is count, unless '1111', then int count follows
    1011 xxxx     // unused
  set 1100 nnnn [int] objref* // nnnn is count, unless '1111', then int count follows
  dict  1101 nnnn [int] keyref* objref* // nnnn is count, unless '1111', then int count follows
    1110 xxxx     // unused
    1111 xxxx     // unused

OFFSET TABLE
  list of ints, byte size of which is given in trailer
  -- these are the byte offsets into the file
  -- number of these is in the trailer

TRAILER
  byte size of offset ints in offset table
  byte size of object refs in arrays and dicts
  number of offsets in offset table (also is number of objects)
  element # in offset table which is top level object
  offset table offset
*/

function readPrimitive( objInfo ) {
  switch( objInfo ) {
    case 0b0000: return null
    case 0b1000: return false
    case 0b1001: return true
    case 0b1111: return undefined // fill
  }
}

function readInt( context, buffer, offset ) {

  var objInfo = ( buffer[ context.offset + offset ] & 0x0F )
  var length = 1 << objInfo

  switch( length ) {
    case 1: return buffer.readUInt8( context.offset + offset + 1 )
    case 2: return buffer.readUInt16BE( context.offset + offset + 1 )
    case 4: return buffer.readUInt32BE( context.offset + offset + 1 )
    case 8: return Number( readBigInt64BE( buffer, context.offset + offset + 1 ) )
    case 16: return Number(
      ( readBigInt64BE( buffer, context.offset + offset + 1 ) << 64n ) +
      readBigUInt64BE( buffer, context.offset + offset + 1 + 8 )
    )
    default:
      throw new Error( `${length} byte integers not supported` )
  }

}

function readReal( context, buffer, offset ) {

  var objInfo = ( buffer[ context.offset + offset ] & 0x0F )
  var length = 1 << objInfo

  switch( length ) {
    case 4: return buffer.readFloatBE( context.offset + offset + 1 )
    case 8: return buffer.readDoubleBE( context.offset + offset + 1 )
    default:
      throw new Error( `${length} byte reals not supported` )
  }

}

function readDate( context, buffer, offset ) {

  var objInfo = ( buffer[ context.offset + offset ] & 0x0F )

  // Skip marker
  offset += 1

  var seconds = buffer.readDoubleBE( context.offset + offset )

  return new Date( Plist.EPOCH + ( seconds * 1000 ) )

}

function readData( context, buffer, offset ) {

  var objInfo = ( buffer[ context.offset + offset ] & 0x0F )
  var length = objInfo !== 0xF ? objInfo : -1

  // Skip marker
  offset += 1

  if( length === -1 ) {
    length = readInt( context, buffer, offset )
    // Skip length int marker & bytes
    offset += 1 + ( 1 << ( buffer[ context.offset + offset ] & 0x0F ) )
  }

  var data = Buffer.alloc( length )
  var start = context.offset + offset
  var end = start + length

  buffer.copy( data, 0, start, end )

  return data

}

function readAscii( context, buffer, offset ) {

  var objInfo = ( buffer[ context.offset + offset ] & 0x0F )
  var length = objInfo !== 0xF ? objInfo : -1

  // Skip marker
  offset += 1

  if( length === -1 ) {
    length = readInt( context, buffer, offset )
    // Skip length int marker & bytes
    offset += 1 + ( 1 << ( buffer[ context.offset + offset ] & 0x0F ) )
  }

  var start = context.offset + offset
  var end = start + length

  return buffer.toString( 'ascii', start, end )

}

function readUnicode( context, buffer, offset ) {

  var objInfo = ( buffer[ context.offset + offset ] & 0x0F )
  var length = objInfo !== 0xF ? objInfo : -1

  // Skip marker
  offset += 1

  if( length === -1 ) {
    length = readInt( context, buffer, offset )
    // Skip length int marker & bytes
    offset += 1 + ( 1 << ( buffer[ context.offset + offset ] & 0x0F ) )
  }

  var start = context.offset + offset
  var end = start + ( length * 2 )
  var chars = Buffer.alloc( length * 2 )

  buffer.copy( chars, 0, start, end )

  // NOTE: We need to swap the utf16_t chars here,
  // since they're big-endian and Node doesn't
  // have a `utf16be` encoding
  return chars.swap16().toString( 'utf16le' )

}

function readUID( context, buffer, offset ) {

  var objInfo = ( buffer[ context.offset + offset ] & 0x0F )
  var length = objInfo + 1

  // Skip marker
  offset += 1

  var start = context.offset + offset
  var end = start + length

  // TODO: Make this a type in order to be able to re-serialize it
  return buffer.toString( 'hex', start, end )

}

function readArray( context, buffer, offset ) {

  var objInfo = ( buffer[ context.offset + offset ] & 0x0F )
  var length = objInfo !== 0xF ? objInfo : -1

  // Skip marker
  offset += 1

  if( length === -1 ) {
    length = readInt( context, buffer, offset )
    // Skip length int marker & bytes
    offset += 1 + ( 1 << ( buffer[ context.offset + offset ] & 0x0F ) )
  }

  var array = []
  var objRef = null

  for( var i = 0; i < length; i++ ) {
    objRef = buffer.readUIntBE( context.offset + offset + ( i * context.objectRefSize ), context.objectRefSize )
    array.push( readObject( context, buffer, objRef ) )
  }

  return array

}

// TODO: Work out implications of inability to .get()
// values from a set by index (maybe use Array w/ Symbol()?)
function readSet( context, buffer, offset ) {

  var objInfo = ( buffer[ context.offset + offset ] & 0x0F )
  var length = objInfo !== 0xF ? objInfo : -1

  // Skip marker
  offset += 1

  if( length === -1 ) {
    length = readInt( context, buffer, offset )
    // Skip length int marker & bytes
    offset += 1 + ( 1 << ( buffer[ context.offset + offset ] & 0x0F ) )
  }

  var set = new Set()
  var objRef = null

  for( var i = 0; i < length; i++ ) {
    objRef = buffer.readUIntBE( offset + ( i * context.objectRefSize ), context.objectRefSize )
    set.add( readObject( context, buffer, objRef ) )
  }

  return set

}

function readDict( context, buffer, offset ) {

  var objInfo = ( buffer[ context.offset + offset ] & 0x0F )
  var length = objInfo !== 0xF ? objInfo : -1

  // Skip marker
  offset += 1

  if( length === -1 ) {
    length = readInt( context, buffer, offset )
    // Skip length int marker & bytes
    offset += 1 + ( 1 << ( buffer[ context.offset + offset ] & 0x0F ) )
  }

  var dict = {}
  var keys = []
  var objRef = null

  for( var i = 0; i < length; i++ ) {
    objRef = buffer.readUIntBE( context.offset + offset + ( i * context.objectRefSize ), context.objectRefSize )
    keys.push( readObject( context, buffer, objRef ) )
  }

  var values = []

  for( var i = 0; i < length; i++ ) {
    objRef = buffer.readUIntBE( context.offset + offset + (( i + length ) * context.objectRefSize ), context.objectRefSize )
    values.push( readObject( context, buffer, objRef ) )
  }

  for( var i = 0; i < length; i++ ) {
    dict[ keys[i] ] = values[i]
  }

  return dict

}

function readObject( context, buffer, objRef ) {

  var offset = context.offsetTable.readUIntBE( objRef * context.offsetIntSize, context.offsetIntSize )
  var marker = buffer[ context.offset + offset ]
  var objType = ( marker & 0xF0 ) >>> 4
  var objInfo = ( marker & 0x0F )

  switch( objType ) {
    case 0b0000: return readPrimitive( objInfo )
    case 0b0001: return readInt( context, buffer, offset )
    case 0b0010: return readReal( context, buffer, offset )
    case 0b0011: return readDate( context, buffer, offset )
    case 0b0100: return readData( context, buffer, offset )
    case 0b0101: return readAscii( context, buffer, offset )
    case 0b0110: return readUnicode( context, buffer, offset )
    case 0b1000: return readUID( context, buffer, offset )
    case 0b1010: return readArray( context, buffer, offset )
    case 0b1100: return readSet( context, buffer, offset )
    case 0b1101: return readDict( context, buffer, offset )
  }

  throw new Error( `Unknown type marker 0b${marker.toString(2)}` )

}

/**
 * Parse a binary property list
 * @param {Buffer} buffer
 * @param {Number} [offset=0]
 * @param {Number} [length]
 * @return {Object}
 */
function decode( buffer, offset, length ) {

  offset = offset || 0
  length = length || ( buffer.length - offset )

  if( buffer.indexOf( Plist.SIGNATURE_BINARY, offset ) !== offset ) {
    throw new Error( `Invalid property list signature at offset 0x${offset.toString( 16 )}` )
  }

  var trailerOffset = offset + length - 32

  var context = {
    // Internal
    offset: offset,
    length: length,
    trailerOffset: trailerOffset,
    // Trailer
    // unused: buffer.slice( trailerOffset + 0, trailerOffset + 5 ),
    sortVersion: buffer[ trailerOffset + 5 ],
    offsetIntSize: buffer[ trailerOffset + 6 ],
    objectRefSize: buffer[ trailerOffset + 7 ],
    objectCount: Number( readBigUInt64BE( buffer, trailerOffset + 8 ) ),
    rootObject: Number( readBigUInt64BE( buffer, trailerOffset + 16 ) ),
    offsetTableOffset: Number( readBigUInt64BE( buffer, trailerOffset + 24 ) ),
    // Offset Table
    offsetTable: null,
  }

  context.offsetTable = buffer.slice(
    offset + context.offsetTableOffset,
    offset + context.offsetTableOffset + ( context.objectCount * context.offsetIntSize )
  )

  return readObject( context, buffer, context.rootObject )

}

module.exports = decode
