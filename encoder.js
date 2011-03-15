eval(require('./constants'));
var Formats = require('./formats');
var Util = require('util');

module.exports = encode;

function encode(type, args) {
  var typeName = FXP_LOOKUP[type];
  var format = Formats[typeName];
  if (!format) { throw new Error("Unknown format " + typeName); }
  if (args.length !== format.length) { throw new Error(
    "Expected " + format.length + " args for " + typeName + ", but only got " + args.length + " args"
  ); }
  
  // Calculate body length
  var length = 1;
  for (var i = 0, l = format.length; i < l; i++) {
    switch (format[i]) {
      case "uint32":
        length += 4;
        break;
      case "string":
        length += args[i].length + 4;
        break;
      case "ATTRS":
        length += 32;
        break;
      case "PAIRS":
        var keys = Object.keys(args[i]);
        for (var j = 0, ll = keys.length; j < ll; j++) {
          var key = keys[j];
          length += 8 + key.length + value[key].length;
        }
        break;
      default: throw new Error("Unknown type " + Util.inspect(format[i]));
    }
  }
  
  // Init the buffer
  var buffer = new Buffer(length + 4);
  writeInt32(buffer, 0, length);
  buffer[4] = type;
  var offset = 5;
  
  // Fill in the buffer
  for (i = 0; i < l; i++) {
    var value = args[i];
    switch (format[i]) {
      case "uint32":
        offset += writeInt32(buffer, offset, value);
        break;
      case "uint64":
        offset += writeInt64(buffer, offset, value);
        break;
      case "string":
        offset += writeString(buffer, offset, value);
        break;
      case "ATTRS":
        offset += writeAttrs(buffer, offset, value);
        break;
      case "PAIRS":
        offset += writePairs(buffer, offset, value);
        break;
      default: throw new Error("Unknown type " + Util.inspect(format[i]));
    }
  }
  
  return buffer;
}


function writeInt32(buffer, offset, value) {
  buffer[offset] = value >>> 24;
  buffer[offset + 1] = value >>> 16;
  buffer[offset + 2] = value >>> 8;
  buffer[offset + 3] = value;
  return 4;
}
function writeInt64(buffer, offset, value) {
  var high = Math.floor(value / 0x100000000);
  var low = value - high * 0x100000000;
  writeInt32(buffer, offset, high);
  writeInt32(buffer, offset + 4, low);
  return 8;
}
function writeString(buffer, offset, string) {
  var length = string.length;
  writeInt32(buffer, offset, length);
  buffer.write(string, "ascii", offset + 4, string);
  return length + 4;
}
function writeAttrs(buffer, offset, attrs) {
  writeInt32(buffer, offset, 15); // ATTR_SIZE | ATTR_UIDGID | ATTR_PERMISSIONS | ACMODTIME);
  writeInt64(buffer, offset + 4, attrs.size); // present only if flag ATTR_SIZE
  writeInt32(buffer, offset + 12, attrs.uid); // present only if flag ATTR_UIDGID
  writeInt32(buffer, offset + 16, attrs.gid); // present only if flag ATTR_UIDGID
  writeInt32(buffer, offset + 20, attrs.permissions); // present only if flag ATTR_PERMISSIONS
  writeInt32(buffer, offset + 24, attrs.atime); // present only if flag ACMODTIME
  writeInt32(buffer, offset + 28, attrs.mtime); // present only if flag ACMODTIME
  return 32;
}  
function writePairs(buffer, offset, pairs) {
  var keys = Object.keys(pairs);
  var start = offset;
  for (var i = 0, l = keys.length; i < l; i++) {
    var key = keys[i];
    offset += writeString(buffer, offset, key);
    offset += writeString(buffer, offset, pairs[key]);
  }
  return offset - start;
}



