//    The MIT License (MIT)
//
//    Copyright (c) 2015 Phil Seaton
//
//    Permission is hereby granted, free of charge, to any person obtaining a copy
//    of this software and associated documentation files (the "Software"), to deal
//    in the Software without restriction, including without limitation the rights
//    to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
//    copies of the Software, and to permit persons to whom the Software is
//    furnished to do so, subject to the following conditions:
//
//    The above copyright notice and this permission notice shall be included in all
//    copies or substantial portions of the Software.
//
//    THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
//    IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
//    FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
//    AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
//    LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
//    OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
//    SOFTWARE.

/* global self, XMLHttpRequest */

var Jimp = require("../../index");

// For use in a web browser or web worker
var globals;
if (typeof window === "object") globals = window;
else if (typeof self === "object") globals = self;
else throw Error("Here is not is not a browser! Where am i?");

globals.Jimp = Jimp;
globals.Buffer = require("buffer");

if (!globals.Buffer) throw Error("Node's Buffer() not available");
if (!globals.Jimp) throw Error("Could not find Jimp object");

function fetchImageDataFromUrl (url, cb) {
    // Fetch image data via xhr. Note that this will not work
    // without cross-domain allow-origin headers because of CORS restrictions
    var xhr = new XMLHttpRequest();
    xhr.open("GET", url, true);
    xhr.responseType = "arraybuffer";
    xhr.onload = function () {
        if (xhr.status < 400) cb(this.response, null);
        else cb(null, "HTTP Status " + xhr.status + " for url "+url);
    };
    xhr.onerror = function (e) {
        cb(null, e);
    };

    xhr.send();
}

function bufferFromArrayBuffer (arrayBuffer) {
    // Prepare a Buffer object from the arrayBuffer. Necessary in the browser > node conversion,
    // But this function is not useful when running in node directly
    var buffer = new Buffer(arrayBuffer.byteLength);
    var view = new Uint8Array(arrayBuffer);
    for (var i = 0; i < buffer.length; ++i) {
        buffer[i] = view[i];
    }

    return buffer;
}

function isArrayBuffer (test) {
    return Object.prototype.toString.call(test).toLowerCase().indexOf("arraybuffer") > -1;
}

// delete the write method
delete Jimp.prototype.write;

// Override the nodejs implementation of Jimp.read()
Jimp.__mainRead = Jimp.read;
Jimp.read = function (src, cb) {
    var that = this;
    return new Promise(function (resolve, reject) {
        cb = cb || function (err, image) {
            if (err) reject(err);
            else resolve(image);
        };

        if (typeof src === "string") {
            // Download via xhr
            fetchImageDataFromUrl(src, function (arrayBuffer, error) {
                if (arrayBuffer) {
                    if (isArrayBuffer(arrayBuffer)) {
                        new Jimp(bufferFromArrayBuffer(arrayBuffer), cb);
                    } else {
                        cb(new Error("Unrecognized data received for " + src));
                    }
                } else if (error) {
                    cb(error);
                }
            });
        } else if (isArrayBuffer(src)) {
            // src is an ArrayBuffer already
            new Jimp(bufferFromArrayBuffer(src), cb);
        } else if (typeof src === "object") {
            that.__mainRead(src, cb).then(resolve, reject);
        } else {
            // src is not a string or ArrayBuffer
            cb(new Error("Jimp expects a single ArrayBuffer or image URL"));
        }
    });
};
