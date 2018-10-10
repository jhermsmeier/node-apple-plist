var argv = process.argv.slice( 2 )
var fs = require( 'fs' )
var Plist = require( '..' )

var formats = [ 'xml', 'binary', 'json' ]
var filename = argv.shift()
var format = argv.shift() || formats[0]

function usage() {
  process.stderr.write(`
Usage: node example/convert <filename> [format]
Formats: ${ formats.join( ', ' ) }
`)
}

if( !filename ) {
  usage()
  process.exit(1)
}

if( !formats.includes( format ) ) {
  usage()
  process.exit(1)
}

var plist = /\.json$/i.test( filename ) ?
  JSON.parse( fs.readFileSync( filename ) ) :
  Plist.parse( fs.readFileSync( filename ) )

switch( format ) {
  case 'xml': process.stdout.write( Plist.xml.write( plist.data ) ); break
  case 'binary': process.stdout.write( Plist.binary.write( plist.data ) ); break
  case 'json': process.stdout.write( JSON.stringify( plist, undefined, 2 ) + '\n' ); break
}
