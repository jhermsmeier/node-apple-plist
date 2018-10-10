class Plist {

  constructor() {
    this.data = null
  }

  get( keyPath ) {

    var path = keyPath.split( '.' )
    var key = path.pop()
    var objRef = this.data
    var pathComp = null

    while( pathComp = path.shift() ) {
      if( objRef[ pathComp ] == null )
        return undefined
      objRef = objRef[ pathComp ]
    }

    return objRef[ key ]

  }

  set( keyPath, value ) {

    var path = keyPath.split( '.' )
    var key = path.pop()
    var objRef = this.data
    var pathComp = null

    while( pathComp = path.shift() ) {
      if( objRef[ pathComp ] == null )
        return undefined
      objRef = objRef[ pathComp ]
    }

    return objRef[ key ] = value

  }

  replace( keyPath, value ) {

    if( this.get( keyPath ) !== undefined ) {
      this.set( keyPath, value )
      return true
    }

    return false

  }

  delete( keyPath ) {
    this.data[ keyPath ] = undefined
    delete this.data[ keyPath ]
  }

  /**
   * Parse a binary property list
   * @param {Buffer} buffer
   * @param {Number} [offset=0]
   * @return {Plist}
   */
  parse( buffer, offset ) {

    offset = offset || 0

    if( buffer.indexOf( Plist.SIGNATURE_BINARY, offset ) === offset ) {
      return this.parseBinary( buffer, offset )
    } else if( buffer.indexOf( Plist.SIGNATURE_XML, offset ) === offset ) {
      return this.parseXML( buffer, offset )
    }

    throw new Error( `Invalid property list signature at offset 0x${offset.toString( 16 )}` )

    return this

  }

  parseBinary( buffer, offset ) {
    this.data = Plist.binary.parse( buffer, offset )
    return this
  }

  parseXML( buffer, offset ) {
    this.data = Plist.xml.parse( buffer, offset )
    return this
  }

  fromJSON( value ) {

    this.data = null

    if( typeof value === 'string' ) {
      this.data = JSON.parse( value, Plist.reviver )
    } else if( Buffer.isBuffer( value ) ) {
      this.data = JSON.parse( value.toString( 'utf8' ), Plist.reviver )
    } else {
      this.data = JSON.parse( JSON.stringify( value ), Plist.reviver )
    }

    return this

  }

  toJSON() {
    return this.data
  }

  toString() {
    return Plist.xml.write( this.data )
  }

  /**
   * Write the binary plist to a buffer
   * @param {Buffer} buffer
   * @param {Number} [offset=0]
   * @returns {Buffer}
   */
  write( buffer, offset, encoding ) {
    encoding = encoding || 'binary'
    switch( encoding ) {
      case 'binary': return Plist.binary.write( this.data, buffer, offset )
      case 'xml':  return Buffer.from( this.toString() )
      case 'json': return Buffer.from( JSON.stringify( this.data ) )
      default: throw new Error( `Unknown encoding ${encoding}` )
    }
  }

}

module.exports = Plist

Plist.SIGNATURE_BINARY = 'bplist'
Plist.SIGNATURE_XML = '<?xml '
Plist.EPOCH = 978307200000

Plist.DOCTYPE = {
  '1.0': '<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">'
}

Plist.xml = {
  parse: require( './xml-decode' ),
  write: require( './xml-encode' ),
}

Plist.binary = {
  parse: require( './binary-decode' ),
  write: require( './binary-encode' ),
}

Plist.reviver = function( key, value ) {

  var isBuffer = typeof value === 'object' &&
    !Array.isArray( value ) &&
    value.type === 'Buffer' &&
    Array.isArray( value.data )

  return isBuffer ? Buffer.from( value.data ) : value

}

Plist.fromJSON = function( value ) {
  return new Plist().fromJSON( value )
}

Plist.parse = function( buffer, offset ) {
  return new Plist().parse( buffer, offset )
}

// Abstract encoding interface
// See https://github.com/mafintosh/abstract-encoding
var encoding = new Plist()

Plist.encode = function( obj, buffer, offset ) {
  offset = offset || 0
  encoding.data = obj
  var output = encoding.write( buffer, offset )
  encoding.data = null
  Plist.encode.bytes = output.length
  return output
}

Plist.encodingLength = function( obj ) {
  return Plist.encode( obj ).length
}

Plist.decode = function( buffer, start, end ) {
  start = start || 0
  end = end != null ? end : buffer.length - start
  var output = encoding.parse( buffer, start, end - start ).data
  encoding.data = null
  Plist.decode.bytes = end - start
  return output
}
