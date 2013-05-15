/**
 * Handlebars plugin is modified CoffeeScript plugin
 *
 * @license cs 0.3.1 Copyright (c) 2010-2011, The Dojo Foundation All Rights Reserved.
 * Available via the MIT or new BSD license.
 * see: http://github.com/jrburke/require-cs for details
 */

/* Yes, deliciously evil. */
/*jslint evil: true, strict: false, plusplus: false, regexp: false */
/*global require: false, XMLHttpRequest: false, ActiveXObject: false,
  define: false, process: false, window: false */

define( function( require ) {
	var Handlebars = require( 'handlebars' );

	//>>excludeStart('excludeAfterBuild', pragmas.excludeAfterBuild)
	var fs, getXhr,
		progIds = ['Msxml2.XMLHTTP', 'Microsoft.XMLHTTP', 'Msxml2.XMLHTTP.4.0'],
		fetchText = function (url, callback) {
			throw new Error('Environment unsupported.');
		},
		buildMap = [];

	if (typeof window !== "undefined" && window.navigator && window.document) {
		// Browser action
		getXhr = function () {
			//Would love to dump the ActiveX crap in here. Need IE 6 to die first.
			var xhr, i, progId;
			if (typeof XMLHttpRequest !== "undefined") {
				return new XMLHttpRequest();
			} else {
				for (i = 0; i < 3; i++) {
					progId = progIds[i];
					try {
						xhr = new ActiveXObject(progId);
					} catch (e) {}

					if (xhr) {
						progIds = [progId];  // so faster next time
						break;
					}
				}
			}

			if (!xhr) {
				throw new Error("getXhr(): XMLHttpRequest not available");
			}

			return xhr;
		};

		fetchText = function (url, callback) {
			var xhr = getXhr();
			xhr.open('GET', url, true);
			xhr.onreadystatechange = function (evt) {
				//Do not explicitly handle errors, those should be
				//visible via console output in the browser.
				if (xhr.readyState === 4) {
					callback(xhr.responseText);
				}
			};
			xhr.send(null);
		};

	} else if (typeof process !== "undefined" &&
			   process.versions &&
			   !!process.versions.node) {
		//Using special require.nodeRequire, something added by r.js.
		fs = require.nodeRequire('fs');
		fetchText = function (path, callback) {
			callback(fs.readFileSync(path, 'utf8'));
		};
	} else if (typeof Packages !== 'undefined') {
		//Why Java, why is this so awkward?
		fetchText = function (path, callback) {
			var encoding = "utf-8",
				file = new java.io.File(path),
				lineSeparator = java.lang.System.getProperty("line.separator"),
				input = new java.io.BufferedReader(new java.io.InputStreamReader(new java.io.FileInputStream(file), encoding)),
				stringBuffer, line,
				content = '';
			try {
				stringBuffer = new java.lang.StringBuffer();
				line = input.readLine();

				// Byte Order Mark (BOM) - The Unicode Standard, version 3.0, page 324
				// http://www.unicode.org/faq/utf_bom.html

				// Note that when we use utf-8, the BOM should appear as "EF BB BF", but it doesn't due to this bug in the JDK:
				// http://bugs.sun.com/bugdatabase/view_bug.do?bug_id=4508058
				if (line && line.length() && line.charAt(0) === 0xfeff) {
					// Eat the BOM, since we've already found the encoding on this file,
					// and we plan to concatenating this buffer with others; the BOM should
					// only appear at the top of a file.
					line = line.substring(1);
				}

				stringBuffer.append(line);

				while ((line = input.readLine()) !== null) {
					stringBuffer.append(lineSeparator);
					stringBuffer.append(line);
				}
				//Make sure we return a JavaScript string and not a Java string.
				content = String(stringBuffer.toString()); //String
			} finally {
				input.close();
			}
			callback(content);
		};
	}
	//>>excludeEnd('excludeAfterBuild')

	return {

		//>>excludeStart('excludeAfterBuild', pragmas.excludeAfterBuild)
		write: function (pluginName, name, write) {
			if (name in buildMap) {
				var text = buildMap[name];
				write.asModule(pluginName + "!" + name, text);
			}
		},
		//>>excludeEnd('excludeAfterBuild')

		load: function (name, parentRequire, load, config) {
			//>>excludeStart('excludeAfterBuild', pragmas.excludeAfterBuild)
			var path = parentRequire.toUrl(name);
			fetchText(path, function (text) {
				//Do Handlebars transform.
				text = Handlebars.precompile(text);
				text = "define(['handlebars'], function (Handlebars) { return Handlebars.template(" + text + "); });";

				//Hold on to the transformed text if a build.
				if (config.isBuild) {
					buildMap[name] = text;
				}

                /*@cc_on
                    /*@if (@_jscript)
                        //IE with conditional comments on cannot handle the sourceURL trick, so skip it if enabled.
                    @else @*/
                        if(!config.isBuild){
                            text += "\r\n//@ sourceURL=" + path;
                        }
                    /*@end
                @*/

				load.fromText(name, text);

				//Give result to load. Need to wait until the module
				//is fully parse, which will happen after this
				//execution.
				parentRequire([name], function (value) {
					load(value);
				});
			});
			//>>excludeEnd('excludeAfterBuild')
		}
	};

});
