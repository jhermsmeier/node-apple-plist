var Plist = require( './plist' )
var html = require( 'htmlparser2' )

const htmlParserOptions = {
  xmlMode: true,
  decodeEntities: true,
  lowerCaseTags: false,
  lowerCaseAttributeNames: false,
  recognizeCDATA: true,
  recognizeSelfClosing: true,
}

var depth = 0
var state = []
var values = []
var keys = []
var textContent = ''

function isStruct( name ) {
  return name === 'dict' || name === 'array' || name === 'set'
}

function isValue( name ) {
  return name === 'string' || name === 'integer' || name === 'real' ||
    name === 'true' || name === 'false' || name === 'null' ||
    name === 'data' || name === 'date'
}

function reset() {
  depth = 0
  state = []
  values = []
  key = ''
  textContent = ''
}

function pushValue() {
  switch( state[0] ) {
    case 'true': values.unshift( true ); break
    case 'false': values.unshift( false ); break
    case 'null': values.unshift( null ); break
    case 'string': values.unshift( textContent.trim() ); break
    case 'integer': values.unshift( +textContent.trim() ); break
    case 'real': values.unshift( +textContent.trim() ); break
    case 'data': values.unshift( Buffer.from( textContent.trim(), 'base64' ) ); break
    case 'date': values.unshift( new Date( textContent.trim() ) ); break
  }
}

function popValue() {
  switch( state[0] ) {
    case 'dict': values[1][ keys.shift() ] = values.shift(); break
    case 'array': values[1].push( values.shift() ); break
    case 'set': values[1].add( values.shift() ); break
  }
}

var parser = new html.Parser({
  onopentag( name, attributes ) {
    if( name === 'plist' ) {
      if( attributes.version !== '1.0' ) {
        reset()
        parser.reset()
        throw new Error( `Unsupported version "${attributes.version}"` )
      }
      return
    }
    state.unshift( name )
    if( name === 'dict' || name === 'array' || name === 'set' ) {
      depth++
      switch( name ) {
        case 'dict': values.unshift( {} ); break
        case 'array': values.unshift( [] ); break
        case 'set': values.unshift( new Set() ); break
      }
    }
  },
  ontext( text ) {
    if( state[0] === 'key' || isValue( state[0] ) )
      textContent += text
  },
  onclosetag( name ) {

    if( name === 'plist' ) return

    if( state[0] === 'key' ) {
      keys.unshift( textContent.trim() )
      textContent = ''
      state.shift()
      return
    }

    // console.log( 'closetag', name )
    // console.log( 'state', state.slice( 0, 3 ) )
    // console.log( 'keys', keys.slice( 0, 3 ) )
    // console.log( 'values', values.slice( 0, 3 ) )
    // console.log( '' )

    if( isValue( name ) ) {

      pushValue()
      textContent = ''
      state.shift()

      // If the value is at depth, add it to the parent value
      if( isStruct( state[0] ) ) {
        popValue()
      }

    // If we're closing an array / dict / set
    } else if( isStruct( name ) ) {

      state.shift()
      depth--

      // If it has a parent, add to it
      if( isStruct( state[0] ) ) {
        popValue()
      }

    } else {
      throw new Error( `Unexpected closing state for "${name}"` )
    }

  },
  onend() {
    if( depth ) {
      var msg = `Unbalanced structure, remaining depth of ${depth}`
      reset()
      parser.reset()
      throw new Error( msg )
    }
  }
}, htmlParserOptions )

/**
 * Parse an XML property list
 * @param {Buffer|String}
 * @param {Number}
 * @return {Object}
 */
function parse( buffer, offset ) {

  offset = offset || 0

  if( buffer.indexOf( Plist.SIGNATURE_XML, offset ) !== offset ) {
    throw new Error( `Invalid property list signature at offset 0x${offset.toString( 16 )}` )
  }

  var xml = Buffer.isBuffer( buffer ) ?
    buffer.toString( 'utf8', offset ) :
    ( offset === 0 ? buffer : buffer.slice( offset ) )

  parser.write( xml )
  parser.parseComplete()

  var data = values[0]

  reset()

  return data

}

module.exports = parse
