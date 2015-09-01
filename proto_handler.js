const { CC, Cc, Ci, Cu, Cr, components } = require('chrome');
Cu.import("resource://gre/modules/ctypes.jsm");
Cu.import("resource://gre/modules/Services.jsm");
Cu.import("resource://gre/modules/XPCOMUtils.jsm");
const ResProtocolHandler = Services.io.getProtocolHandler("resource").
    QueryInterface(Ci.nsIResProtocolHandler);
const ChromeRegistry = Cc["@mozilla.org/chrome/chrome-registry;1"].
    getService(Ci.nsIChromeRegistry);
const {data} = require('sdk/self');
const SCHEME = "safe";
const SEGMENT_SIZE = 1024;
const MAX_SEGMENT_COUNT = 1024;


var onException = function(channel, outputStream, errorMessage) {
  channel.contentType = 'text/html';
  var bout = Cc["@mozilla.org/binaryoutputstream;1"].getService(Ci.nsIBinaryOutputStream);
  bout.setOutputStream(outputStream);
  bout.writeUtf8Z('Error :: ' + errorMessage);
  bout.close();
};

/**
 * Returns FileURI.
 * @param uri - URI for a file
 * @returns FileURI
 */
function resolveToFile(uri) {
  switch (uri.scheme) {
    case "chrome":
      return resolveToFile(ChromeRegistry.convertChromeURL(uri));
    case "resource":
      return resolveToFile(Services.io.newURI(ResProtocolHandler.resolveURI(uri), null, null));
    case "file":
      return uri.QueryInterface(Ci.nsIFileURL).file;
    default:
      throw new Error("Cannot resolve");
  }
}

function getLibraryFileName() {
  var system = require('sdk/system');
  // OS_TARGET (https://developer.mozilla.org/en-US/docs/OS_TARGET)
  var EXTENSION = {
    'winnt': 'dll',
    'linux': 'so',
    'darwin': 'dylib'
  }[system.platform.toLowerCase()];
  return 'libsafe_ffi.' + EXTENSION;
}

// Opens the Library file. Entry point for jsCtypes
var libURI = resolveToFile(Services.io.newURI(data.url(getLibraryFileName()), null, null));
var lib = ctypes.open(libURI.path);
// Declaring the functions in jsCtypes convention
var getFileSize = lib.declare('get_file_size_from_service_home_dir',
    ctypes.default_abi,
    ctypes.int32_t,
    ctypes.char.ptr,
    ctypes.char.ptr,
    ctypes.char.ptr,
    ctypes.bool,
    ctypes.size_t.ptr);

var getFileContent = lib.declare('get_file_content_from_service_home_dir',
    ctypes.default_abi,
    ctypes.int32_t,
    ctypes.char.ptr,
    ctypes.char.ptr,
    ctypes.char.ptr,
    ctypes.bool,
    ctypes.uint8_t.ptr);

function SafeProtocolHandler() {

}
SafeProtocolHandler.prototype = Object.freeze({
  classDescription: "Safe Protocol Handler",
  contractID: "@mozilla.org/network/protocol;1?name=" + SCHEME,
  classID: components.ID('{7c3311a6-3a2d-4090-9c26-e83c32e7870c}'),
  QueryInterface: XPCOMUtils.generateQI([Ci.nsIProtocolHandler]),
  scheme: SCHEME,
  defaultPort: -1,
  allowPort: function(port, scheme) {
    // This protocol handler does not support ports.
    return false;
  },
  protocolFlags: Ci.nsIProtocolHandler.URI_NOAUTH | Ci.nsIProtocolHandler.URI_LOADABLE_BY_ANYONE,
  newURI: function(aSpec, aOriginCharset, aBaseURI) {
    var uri = Cc["@mozilla.org/network/simple-uri;1"].createInstance(Ci.nsIURI);
    uri.spec = aSpec;
    return uri;
  },
  newChannel: function(aURI) {
    return new PipeChannel(aURI).QueryInterface(Ci.nsIChannel);
  }
});

var PipeChannel = function(URI) {
  this.pipe = Cc["@mozilla.org/pipe;1"].createInstance(Ci.nsIPipe);
  this.pipe.init(true, true, SEGMENT_SIZE, MAX_SEGMENT_COUNT, null); // Files upto 1 GB can be supported
  this.inputStreamChannel = Cc["@mozilla.org/network/input-stream-channel;1"].createInstance(Ci.nsIInputStreamChannel);
  this.inputStreamChannel.setURI(URI);
  this.inputStreamChannel.contentStream = this.pipe.inputStream;
  this.request = this.inputStreamChannel.QueryInterface(Ci.nsIRequest);
  this.channel = this.inputStreamChannel.QueryInterface(Ci.nsIChannel);
};

PipeChannel.prototype = {
  QueryInterface: function(iid) {
    if (iid.equals(Ci.nsIChannel) || iid.equals(Ci.nsIRequest) || iid.equals(Ci.nsISupports))
      return this;
    throw Cr.NS_NOINTERFACE;
  },

  asyncOpen: function(listener, context) {
    try {
      var parsedURI = require('./parser').parse(this.channel.URI.path);
      // Set the mime type of the content being served
      var mimeService = Cc["@mozilla.org/mime;1"].getService(Ci.nsIMIMEService);
      var temp = parsedURI.filePath.split('.');
      this.channel.contentType = mimeService.getTypeFromExtension(temp[temp.length - 1]);
      // Prepare channel
      this.channel.asyncOpen(listener, context);
      // Get requested file size through the Safe API
      var fileSizeCtypes = ctypes.size_t(0);
      var errorCode = getFileSize(parsedURI.publicName, parsedURI.service, parsedURI.filePath, false, fileSizeCtypes.address());
      if (errorCode !== 0) {
        throw new Error("File Not found");
      }
      // Get the file content
      var Uint8Array_t = ctypes.ArrayType(ctypes.uint8_t, fileSizeCtypes.value);
      var fileContent = Uint8Array_t();
      errorCode = getFileContent(parsedURI.publicName, parsedURI.service, parsedURI.filePath, false, fileContent.addressOfElement(0));
      if (errorCode !== 0) {
        throw new Error("Failed to get content");
      }
      // Prepare the stream by setting the content length to be sent
      this.channel.contentLength = fileContent.length;
      // Create BinaryOutputStream instance for writing the data to the outputStream of the pipe
      var bout = Cc["@mozilla.org/binaryoutputstream;1"].getService(Ci.nsIBinaryOutputStream);
      bout.setOutputStream(this.pipe.outputStream);
      var fileBuffer = [];
      // Read the data and collect it in fileBuffer and write to the channel in Specified Segment sizes
      for (var i = 0; i < fileContent.length; ++i) {
        fileBuffer.push(fileContent.addressOfElement(i).contents);
        if (fileBuffer.length === SEGMENT_SIZE) {
          bout.writeByteArray(fileBuffer, fileBuffer.length);
          fileBuffer = [];
        }
      }
      // Write the last Segment of data
      if (fileBuffer.length > 0) {
        bout.writeByteArray(fileBuffer, fileBuffer.length);
      }
      bout.close();
    } catch (err) {
      onException(this.channel, this.pipe.outputStream, err.message);
    }
  },

  open: function() {
    return this.channel.open();
  },

  close: function() {
    this.pipe.outputStream.close();
  }
};

exports.SafeProtocolHandler = SafeProtocolHandler;