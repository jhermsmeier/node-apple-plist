var { context, test } = require( '@jhermsmeier/control' )
var assert = require( 'assert' )
var path = require( 'path' )
var fs = require( 'fs' )
var Plist = require( '..' )
var inspect = require( './inspect' )

context( 'Plist', function() {

  context( '.parse()', function() {

    context( 'XML', function() {

      test( 'com.google.keystone.agent.plist', function() {
        var xml = fs.readFileSync( path.join( __dirname, 'data', 'xml', 'com.google.keystone.agent.plist' ) )
        var json = fs.readFileSync( path.join( __dirname, 'data', 'json', 'com.google.keystone.agent.plist.json' ) )
        var xmlPlist = Plist.parse( xml )
        var expected = Plist.fromJSON( json )
        assert.deepStrictEqual( xmlPlist, expected )
      })

      test( 'test.plist', function() {
        var xml = fs.readFileSync( path.join( __dirname, 'data', 'xml', 'test.plist' ) )
        var json = fs.readFileSync( path.join( __dirname, 'data', 'json', 'test.plist.json' ) )
        var xmlPlist = Plist.parse( xml )
        var expected = Plist.fromJSON( json )
        assert.deepStrictEqual( xmlPlist, expected )
      })

    })

    context( 'Binary', function() {

      test( 'com.google.keystone.agent.plist', function() {
        var xml = fs.readFileSync( path.join( __dirname, 'data', 'binary', 'com.google.keystone.agent.plist' ) )
        var json = fs.readFileSync( path.join( __dirname, 'data', 'json', 'com.google.keystone.agent.plist.json' ) )
        var binaryPlist = Plist.parse( xml )
        var expected = Plist.fromJSON( json )
        assert.deepStrictEqual( binaryPlist, expected )
      })

      test( 'test.plist', function() {
        var xml = fs.readFileSync( path.join( __dirname, 'data', 'binary', 'test.plist' ) )
        var json = fs.readFileSync( path.join( __dirname, 'data', 'json', 'test.plist.json' ) )
        var binaryPlist = Plist.parse( xml )
        var expected = Plist.fromJSON( json )
        assert.deepStrictEqual( binaryPlist, expected )
      })

    })

  })

  context( '.fromJSON()', function() {

    test( 'com.google.keystone.agent.plist.json', function() {
      var json = fs.readFileSync( path.join( __dirname, 'data', 'json', 'com.google.keystone.agent.plist.json' ) )
      var expected = require( './data/json/com.google.keystone.agent.plist' )
      var plist = Plist.fromJSON( json )
      var actual = JSON.parse( JSON.stringify( plist ) )
      assert.deepStrictEqual( actual, expected )
    })

    test( 'test.plist.json', function() {
      var json = fs.readFileSync( path.join( __dirname, 'data', 'json', 'test.plist.json' ) )
      var expected = require( './data/json/test.plist' )
      var plist = Plist.fromJSON( json )
      var actual = JSON.parse( JSON.stringify( plist ) )
      assert.deepStrictEqual( actual, expected )
    })

  })

})

context( 'Format equality', function() {

  context( 'XML <> Binary', function() {

    test( 'com.google.keystone.agent.plist', function() {

      var binary = fs.readFileSync( path.join( __dirname, 'data', 'binary', 'com.google.keystone.agent.plist' ) )
      var xml = fs.readFileSync( path.join( __dirname, 'data', 'xml', 'com.google.keystone.agent.plist' ) )

      var binaryPlist = Plist.parse( binary )
      var xmlPlist = Plist.parse( xml )

      assert.deepStrictEqual( binaryPlist.data, xmlPlist.data )

    })

    test( 'test.plist', function() {

      var binary = fs.readFileSync( path.join( __dirname, 'data', 'binary', 'test.plist' ) )
      var xml = fs.readFileSync( path.join( __dirname, 'data', 'xml', 'test.plist' ) )

      var binaryPlist = Plist.parse( binary )
      var xmlPlist = Plist.parse( xml )

      assert.deepStrictEqual( binaryPlist.data, xmlPlist.data )

    })

  })

})
