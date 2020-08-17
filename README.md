# Apple Property List (plist)
[![npm](https://flat.badgen.net/npm/v/apple-plist)](https://npmjs.com/package/apple-plist)
[![npm license](https://flat.badgen.net/npm/license/apple-plist)](https://npmjs.com/package/apple-plist)
[![npm downloads](https://flat.badgen.net/npm/dm/apple-plist)](https://npmjs.com/package/apple-plist)
[![build status](https://flat.badgen.net/travis/balena-io-modules/node-apple-plist/master)](https://travis-ci.org/balena-io-modules/node-apple-plist)

Apple Property List (plist) parsing & serializing of XML / Binary / JSON formats

## Install via [npm](https://npmjs.com)

```sh
$ npm install --save apple-plist
```

## Usage

```js
var Plist = require( 'apple-plist' )
```

```js
var plist = Plist.parse( value )
```

## API

_class_ **Plist**

- **Static Methods:**
    - .parse( **value:** `String` | `Buffer`, **offset:** `Number = 0` ) -> `Plist`
    - .fromJSON( **value:** `String` | `Buffer` | `Object` ) -> `Plist`

- **Instance Properties:**
    - .data -> `Object`

- **Instance Methods:**
    - .parse( **value:** `String` | `Buffer`, **offset:** `Number = 0` ) -> `Plist`
    - .parseXML( **value:** `String` | `Buffer`, **offset:** `Number = 0` ) -> `Plist`
    - .parseBinary( **value:** `Buffer`, **offset:** `Number = 0` ) -> `Plist`
    - .fromJSON( **value:** `String` | `Buffer` | `Object` ) -> `Plist`
    - .write( **buffer:** `Buffer = null`, **offset:** `Number = 0`, **encoding:** `String( 'binary' | 'xml' | 'json' )` ) -> `Buffer`
    - .toString() -> `String`
