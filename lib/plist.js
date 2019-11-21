/**
 * @internal JSON Date revival detection pattern
 * @type {RegExp}
 * @constant
 */
const JSON_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z$/

class Plist {

  /**
   * Create a new Plist instance
   * @return {Plist}
   */
  constructor() {

    /** @type {Object} Plist data */
    this.data = {}

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
   * @param {Number} [length=( buffer.length - offset )]
   * @return {Plist}
   */
  parse( buffer, offset, length ) {

    offset = offset || 0
    length = length || buffer.length - offset

    if( buffer.indexOf( Plist.SIGNATURE_BINARY, offset ) === offset ) {
      return this.parseBinary( buffer, offset, length )
    } else if( buffer.indexOf( Plist.SIGNATURE_XML, offset ) === offset ) {
      return this.parseXML( buffer, offset, length )
    } else if( buffer.indexOf( Plist.SIGNATURE_JSON, offset ) === offset ) {
      return this.fromJSON( buffer.slice( offset, offset + length ) )
    }

    throw new Error( `Invalid property list signature at offset 0x${offset.toString( 16 )}` )

    return this

  }

  /**
   * Parse binary encoded property list data
   * @param {String|Buffer} value
   * @param {Number} [offset=0]
   * @param {Number} [length]
   * @returns {Plist}
   */
  parseBinary( buffer, offset, length ) {
    this.data = Plist.binary.parse( buffer, offset, length )
    return this
  }

  /**
   * Parse XML encoded property list data
   * @param {String|Buffer} value
   * @param {Number} [offset=0]
   * @param {Number} [length]
   * @returns {Plist}
   */
  parseXML( buffer, offset, length ) {
    this.data = Plist.xml.parse( buffer, offset, length )
    return this
  }

  /**
   * Set property list data from JSON
   * @param {String|Buffer|Object} value
   * @returns {Plist}
   */
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

  /**
   * Stringify the property list to XML
   * @return {String} xml
   */
  toString() {
    return Plist.xml.write( this.data )
  }

  /**
   * Write the binary plist to a buffer
   * @param {Buffer} buffer
   * @param {Number} [offset=0]
   * @param {String} [encoding='binary']
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

/**
 * Binary format signature
 * @type {String}
 * @constant
 */
Plist.SIGNATURE_BINARY = 'bplist'

/**
 * XML format signature
 * @type {String}
 * @constant
 */
Plist.SIGNATURE_XML = '<?xml '

/**
 * JSON format signature
 * @type {String}
 * @constant
 */
Plist.SIGNATURE_JSON = '{'

/**
 * Propertly list epoch
 * @type {Number}
 * @constant
 */
Plist.EPOCH = 978307200000

/**
 * XML doctype versions
 * @enum {String}
 */
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

/**
 * JSON reviver function; revives Buffers and Dates
 * @param {String} key
 * @param {*} value
 * @returns {*}
 */
Plist.reviver = function( key, value ) {

  var isBuffer = typeof value === 'object' &&
    !Array.isArray( value ) &&
    value.type === 'Buffer' &&
    Array.isArray( value.data )

  if( isBuffer ) {
    return Buffer.from( value.data )
  }

  if( typeof value == 'string' && JSON_DATE_PATTERN.test( value ) ) {
    return new Date( value )
  }

  return value

}

/**
 * Create a Plist instance from JSON data
 * @param {String|Buffer|Object} value
 * @returns {Plist}
 */
Plist.fromJSON = function( value ) {
  return new Plist().fromJSON( value )
}

/**
 * Parse a property list from given input
 * @param {String|Buffer} value
 * @returns {Plist}
 */
Plist.parse = function( buffer, offset ) {
  return new Plist().parse( buffer, offset )
}
