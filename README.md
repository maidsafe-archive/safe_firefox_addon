# safe_firefox_addon
Addon to allow access to the SAFE network from the Firefox browser

## Prerequisites
NodeJs should be installed

##Setting up

 1. JPM sdk is used to build the add on. Follow this [link](https://developer.mozilla.org/en-US/Add-ons/SDK/Tools/jpm#Installation) for installation instructions.

 2. Clone the [safe_ffi](https://github.com/maidsafe/safe_ffi) repository and build *Dynamic library* of the Rust code - `cargo build --release`

 3. Copy the `libc_wrapper.{so, dylib}` from the `target/release` folder to the `data` folder of the `Safe-Addon`

 4. For linux, add the libsodium dependency in the `data` folder. Add `libsodium.so.<version>` instead of `libsodium.so`

## Packaging the API:
  Execute `jpm xpi` to get the @safe_addon.xpi file


## Platforms Supported
    Linux & OSX 

## Installing on firefox
  1. Go to tools > Add-ons. At the top right corner there will ba a settings icon.
     Clicking on the settings icon will show an option `Import Add-on from File`, 
     select the XPI from the local machine

  2. Another means to install (Linux).
         Right click on the `.xpi` file and select `open with`. Choose firefox.

  Permission requisition window will be prompted for installation authorization. Click Install.


## For the Developers

  Relative path for loading the resources is not supported in the current version.
   
  The normal approach to load a style sheet is to use a relative path,
      ```
      <link type="text/css" rel="stylesheet" href="/normalize.css"/>
      ```
  
  But this is not supported by the Add-on at present. 
  
  The workaround is to load the resources by specifying the full path.
  Example,
      ```
      <link type="text/css" rel="stylesheet" href="safe:www.maidsafe/normalize.css"/>
      ```
    
## Known Limitations:
  
  1. Windows not supported
  2. Can serve file up to 1GB only
  3. Browser Crash - Right Clicking on the browser and selecting `View Page Source`
  4. If the public name is not available, then the browser becomes non-responsive. 
     Must force quit the browser and start again.
  5. On OSX, when the browser is closed the browser crashes occasionally
 
## TODO 
 
     1. Improve Error Handling
     2. Relative path support for resource loading from DOM Elements
     3. Try to integrate with Standard firefox debug tools - console, view source tools etc
     4. Exposing API under the MaidSafe name space, So direct APIs can be used by developers if needed
     
