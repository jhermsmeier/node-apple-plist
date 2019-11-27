var encode = require( './xml-encode' )

function encodingLength( value ) {
  return Buffer.byteLength( encode( value ) )
}

module.exports = encodingLength
