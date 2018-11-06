var Plist = require( '..' )
var bench = require( 'nanobench' )
var fs = require( 'fs' )
var path = require( 'path' )

const ITERATIONS = 1000

bench( `plist.parseBinary() ⨉ ${ITERATIONS}`, function( run ) {

  var plist = new Plist()
  var buffer = fs.readFileSync( path.join( __dirname, '..', 'test', 'data', 'binary', 'defaults.plist' ) )

  run.start()

  for( var i = 0; i < ITERATIONS; i++ ) {
    plist.parseBinary( buffer )
  }

  run.end()

})

bench( `plist.parseXML() ⨉ ${ITERATIONS}`, function( run ) {

  var plist = new Plist()
  var buffer = fs.readFileSync( path.join( __dirname, '..', 'test', 'data', 'xml', 'defaults.plist' ), 'utf8' )

  run.start()

  for( var i = 0; i < ITERATIONS; i++ ) {
    plist.parseXML( buffer )
  }

  run.end()

})

bench( `plist.write( xml ) ⨉ ${ITERATIONS}`, function( run ) {

  var buffer = fs.readFileSync( path.join( __dirname, '..', 'test', 'data', 'binary', 'defaults.plist' ) )
  var plist = Plist.parse( buffer )
  var output = null

  run.start()

  for( var i = 0; i < ITERATIONS; i++ ) {
    output = plist.write( null, 0, 'xml' )
  }

  run.end()

})

bench.skip( `plist.write( binary ) ⨉ ${ITERATIONS}`, function( run ) {

  var buffer = fs.readFileSync( path.join( __dirname, '..', 'test', 'data', 'binary', 'defaults.plist' ) )
  var plist = Plist.parse( buffer )
  var output = null

  run.start()

  for( var i = 0; i < ITERATIONS; i++ ) {
    output = plist.write( null, 0, 'binary' )
  }

  run.end()

})

bench( `plist.write( json ) ⨉ ${ITERATIONS}`, function( run ) {

  var buffer = fs.readFileSync( path.join( __dirname, '..', 'test', 'data', 'binary', 'defaults.plist' ) )
  var plist = Plist.parse( buffer )
  var output = null

  run.start()

  for( var i = 0; i < ITERATIONS; i++ ) {
    output = plist.write( null, 0, 'json' )
  }

  run.end()

})
