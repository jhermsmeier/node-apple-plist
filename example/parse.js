var argv = process.argv.slice( 2 )
var fs = require( 'fs' )
var Plist = require( '..' )
var inspect = require( '../test/inspect' )

var filename = argv.shift()

function usage() {
  process.stderr.write(`
Usage: node example/parse <filename>
`)
}

if( !filename ) {
  usage()
  process.exit(1)
}

var buffer = fs.readFileSync( filename )
var plist = Plist.parse( buffer )

inspect.log( plist.data )
