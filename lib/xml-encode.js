var Plist = require( './plist' )

const INDENT = '  '
const EOL = '\n'
const BASE64_WIDTH = 48 * 2

const PREAMBLE = `<?xml version="1.0" encoding="UTF-8"?>\n` +
  `<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">\n` +
  `<plist version="1.0">\n`

const ENTITY_PATTERN = /<|>|"|'|&/g

const ENTITIES = {
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  '\'': '&apos;',
  '&': '&amp;',
}

function encodeEntities( str ) {
  return str ? str.replace( ENTITY_PATTERN, (char) => ENTITIES[char] ) : ''
}

function getType( value ) {
  if( value === null ) return 'null'
  if( Buffer.isBuffer( value ) ) return 'buffer'
  if( Array.isArray( value ) ) return 'array'
  if( ArrayBuffer.isView( value ) ) return 'arraybufferview'
  if( value instanceof Number ) return 'number'
  if( value instanceof Boolean ) return 'boolean'
  if( value instanceof ArrayBuffer ) return 'arraybuffer'
  if( value instanceof Date ) return 'date'
  if( value instanceof Set ) return 'set'
  if( value instanceof Map ) return 'map'
  return typeof value
}

function encodeData( value, depth ) {
  var indent = INDENT.repeat( depth )
  var block = indent + '<data>' + EOL
  var data = value.toString( 'base64' )
  var offset = 0
  while( offset < data.length ) {
    block += indent + data.slice( offset, offset += BASE64_WIDTH ) + EOL
  }
  return block + indent + '</data>' + EOL
}

function encodeString( value, depth ) {
  return INDENT.repeat( depth ) + `<string>${ encodeEntities( value ) }</string>` + EOL
}

function encodeBoolean( value, depth ) {
  return INDENT.repeat( depth ) + ( value ? `<true/>` : '<false/>' ) + EOL
}

function encodeNumber( value, depth ) {
  return INDENT.repeat( depth ) + (
    Math.round( value ) === value ?
      `<integer>${ encodeEntities( value.toString() ) }</integer>` :
      `<real>${ encodeEntities( value.toString() ) }</real>`
  ) + EOL
}

function encodeDate( value, depth ) {
  return INDENT.repeat( depth ) + `<date>${ value.toJSON() }</date>` + EOL
}

function encodeKey( value, depth ) {
  return INDENT.repeat( depth ) + `<key>${ encodeEntities( value ) }</key>` + EOL
}

function encodeDict( value, depth ) {

  var indent = INDENT.repeat( depth )
  var output = indent + '<dict>' + EOL
  var keys = Object.keys( value )

  for( var i = 0; i < keys.length; i++ ) {
    output += encodeKey( keys[i], depth + 1 )
    output += encodeObject( value[ keys[i] ], depth + 1 )
  }

  return output + indent + '</dict>' + EOL

}

function encodeMap( value, depth ) {

  var indent = INDENT.repeat( depth )
  var output = indent + '<dict>' + EOL

  value.forEach(( value, key ) => {
    output += encodeKey( keys, depth + 1 )
    output += encodeObject( value, depth + 1 )
  })

  return output + indent + '</dict>' + EOL

}

function encodeSet( value, depth ) {

  var indent = INDENT.repeat( depth )
  var output = indent + '<array>' + EOL

  value.forEach(( value ) => {
    output += encodeObject( value, depth + 1 )
  })

  return output + indent + '</array>' + EOL

}

function encodeArray( value, depth ) {

  var indent = INDENT.repeat( depth )
  var output = indent + '<array>' + EOL

  for( var i = 0; i < value.length; i++ ) {
    output += encodeObject( value[i], depth + 1 )
  }

  return output + indent + '</array>' + EOL

}

function encodeObject( value, depth ) {

  var type = getType( value )

  depth = depth || 0

  switch( type ) {
    case 'arraybufferview': return encodeData( Buffer.from( value.buffer, value.byteOffset, value.byteLength ), depth )
    case 'arraybuffer': return encodeData( Buffer.from( value ), depth )
    case 'buffer': return encodeData( value, depth )
    case 'array': return encodeArray( value, depth )
    case 'set': return encodeSet( value, depth )
    case 'object': return encodeDict( value, depth )
    case 'map': return encodeMap( value, depth )
    case 'number': return encodeNumber( value, depth )
    case 'bigint': return encodeNumber( value, depth )
    case 'string': return encodeString( value, depth )
    case 'boolean': return encodeBoolean( value, depth )
    case 'date': return encodeDate( value, depth )
  }

  throw new Error( `Unknown data type "${type}"` )

}

function encode( data, buffer, offset ) {
  return PREAMBLE + encodeObject( data ) + '</plist>' + EOL
}

module.exports = encode
