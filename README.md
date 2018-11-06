# Apple Property List (plist)
[![npm](https://img.shields.io/npm/v/apple-plist.svg?style=flat-square)](https://npmjs.com/package/apple-plist)
[![npm license](https://img.shields.io/npm/l/apple-plist.svg?style=flat-square)](https://npmjs.com/package/apple-plist)
[![npm downloads](https://img.shields.io/npm/dm/apple-plist.svg?style=flat-square)](https://npmjs.com/package/apple-plist)
[![build status](https://img.shields.io/travis//node-apple-plist/master.svg?style=flat-square)](https://travis-ci.org//node-apple-plist)

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

- **Instance Methods:**
    - .parse( **value:** `String` | `Buffer`, **offset:** `Number = 0` ) -> `Plist`
    - .parseXML( **value:** `String` | `Buffer`, **offset:** `Number = 0` ) -> `Plist`
    - .parseBinary( **value:** `Buffer`, **offset:** `Number = 0` ) -> `Plist`
    - .fromJSON( **value:** `String` | `Buffer` | `Object` ) -> `Plist`
    - .write( **buffer:** `Buffer = null`, **offset:** `Number = 0`, **encoding:** `String( 'binary' | 'xml' | 'json' )` ) -> `Buffer`
    - .toString() -> `String`
