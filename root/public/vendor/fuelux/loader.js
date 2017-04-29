(function () {
    /**
     * almond 0.1.4 Copyright (c) 2011, The Dojo Foundation All Rights Reserved.
     * Available via the MIT or new BSD license.
     * see: http://github.com/jrburke/almond for details
     */
    //Going sloppy to avoid 'use strict' string cost, but strict practices should
    //be followed.
    /*jslint sloppy: true */
    /*global setTimeout: false */

    var requirejs;

    var require;
    var define;
    ((undef => {
        var main;
        var req;
        var defined = {};
        var waiting = {};
        var config = {};
        var defining = {};
        var aps = [].slice;

        /**
         * Given a relative module name, like ./something, normalize it to
         * a real name that can be mapped to a path.
         * @param {String} name the relative name
         * @param {String} baseName a real name that the name arg is relative
         * to.
         * @returns {String} normalized name
         */
        function normalize(name, baseName) {
            var nameParts;
            var nameSegment;
            var mapValue;
            var foundMap;
            var foundI;
            var foundStarMap;
            var starI;
            var i;
            var j;
            var part;
            var baseParts = baseName && baseName.split("/");
            var map = config.map;
            var starMap = (map && map['*']) || {};

            //Adjust any relative paths.
            if (name && name.charAt(0) === ".") {
                //If have a base name, try to normalize against it,
                //otherwise, assume it is a top-level require that will
                //be relative to baseUrl in the end.
                if (baseName) {
                    //Convert baseName to array, and lop off the last part,
                    //so that . matches that "directory" and not name of the baseName's
                    //module. For instance, baseName of "one/two/three", maps to
                    //"one/two/three.js", but we want the directory, "one/two" for
                    //this normalization.
                    baseParts = baseParts.slice(0, baseParts.length - 1);

                    name = baseParts.concat(name.split("/"));

                    //start trimDots
                    for (i = 0; i < name.length; i += 1) {
                        part = name[i];
                        if (part === ".") {
                            name.splice(i, 1);
                            i -= 1;
                        } else if (part === "..") {
                            if (i === 1 && (name[2] === '..' || name[0] === '..')) {
                                //End of the line. Keep at least one non-dot
                                //path segment at the front so it can be mapped
                                //correctly to disk. Otherwise, there is likely
                                //no path mapping for a path starting with '..'.
                                //This can still fail, but catches the most reasonable
                                //uses of ..
                                break;
                            } else if (i > 0) {
                                name.splice(i - 1, 2);
                                i -= 2;
                            }
                        }
                    }
                    //end trimDots

                    name = name.join("/");
                }
            }

            //Apply map config if available.
            if ((baseParts || starMap) && map) {
                nameParts = name.split('/');

                for (i = nameParts.length; i > 0; i -= 1) {
                    nameSegment = nameParts.slice(0, i).join("/");

                    if (baseParts) {
                        //Find the longest baseName segment match in the config.
                        //So, do joins on the biggest to smallest lengths of baseParts.
                        for (j = baseParts.length; j > 0; j -= 1) {
                            mapValue = map[baseParts.slice(0, j).join('/')];

                            //baseName segment has  config, find if it has one for
                            //this name.
                            if (mapValue) {
                                mapValue = mapValue[nameSegment];
                                if (mapValue) {
                                    //Match, update name to the new value.
                                    foundMap = mapValue;
                                    foundI = i;
                                    break;
                                }
                            }
                        }
                    }

                    if (foundMap) {
                        break;
                    }

                    //Check for a star map match, but just hold on to it,
                    //if there is a shorter segment match later in a matching
                    //config, then favor over this star map.
                    if (!foundStarMap && starMap && starMap[nameSegment]) {
                        foundStarMap = starMap[nameSegment];
                        starI = i;
                    }
                }

                if (!foundMap && foundStarMap) {
                    foundMap = foundStarMap;
                    foundI = starI;
                }

                if (foundMap) {
                    nameParts.splice(0, foundI, foundMap);
                    name = nameParts.join('/');
                }
            }

            return name;
        }

        function makeRequire(relName, forceSync) {
            return function(...args) {
                //A version of a require function that passes a moduleName
                //value for items that may need to
                //look up paths relative to the moduleName
                return req.apply(undef, aps.call(args, 0).concat([relName, forceSync]));
            };
        }

        function makeNormalize(relName) {
            return name => normalize(name, relName);
        }

        function makeLoad(depName) {
            return value => {
                defined[depName] = value;
            };
        }

        function callDep(name) {
            if (waiting.hasOwnProperty(name)) {
                var args = waiting[name];
                delete waiting[name];
                defining[name] = true;
                main.apply(undef, args);
            }

            if (!defined.hasOwnProperty(name)) {
                throw new Error('No ' + name);
            }
            return defined[name];
        }

        /**
         * Makes a name map, normalizing the name, and using a plugin
         * for normalization if necessary. Grabs a ref to plugin
         * too, as an optimization.
         */
        function makeMap(name, relName) {
            var prefix;
            var plugin;
            var index = name.indexOf('!');

            if (index !== -1) {
                prefix = normalize(name.slice(0, index), relName);
                name = name.slice(index + 1);
                plugin = callDep(prefix);

                //Normalize according
                if (plugin && plugin.normalize) {
                    name = plugin.normalize(name, makeNormalize(relName));
                } else {
                    name = normalize(name, relName);
                }
            } else {
                name = normalize(name, relName);
            }

            //Using ridiculous property names for space reasons
            return {
                f: prefix ? prefix + '!' + name : name, //fullName
                n: name,
                p: plugin
            };
        }

        function makeConfig(name) {
            return () => (config && config.config && config.config[name]) || {};
        }

        main = (name, deps, callback, relName) => {
            var cjsModule;
            var depName;
            var ret;
            var map;
            var i;
            var args = [];
            var usingExports;

            //Use name if no relName
            relName = relName || name;

            //Call the callback to define the module, if necessary.
            if (typeof callback === 'function') {

                //Pull out the defined dependencies and pass the ordered
                //values to the callback.
                //Default to [require, exports, module] if no deps
                deps = !deps.length && callback.length ? ['require', 'exports', 'module'] : deps;
                for (i = 0; i < deps.length; i += 1) {
                    map = makeMap(deps[i], relName);
                    depName = map.f;

                    //Fast path CommonJS standard dependencies.
                    if (depName === "require") {
                        args[i] = makeRequire(name);
                    } else if (depName === "exports") {
                        //CommonJS module spec 1.1
                        args[i] = defined[name] = {};
                        usingExports = true;
                    } else if (depName === "module") {
                        //CommonJS module spec 1.1
                        cjsModule = args[i] = {
                            id: name,
                            uri: '',
                            exports: defined[name],
                            config: makeConfig(name)
                        };
                    } else if (defined.hasOwnProperty(depName) || waiting.hasOwnProperty(depName)) {
                        args[i] = callDep(depName);
                    } else if (map.p) {
                        map.p.load(map.n, makeRequire(relName, true), makeLoad(depName), {});
                        args[i] = defined[depName];
                    } else if (!defining[depName]) {
                        throw new Error(name + ' missing ' + depName);
                    }
                }

                ret = callback.apply(defined[name], args);

                if (name) {
                    //If setting exports via "module" is in play,
                    //favor that over return value and exports. After that,
                    //favor a non-undefined return value over exports use.
                    if (cjsModule && cjsModule.exports !== undef &&
                            cjsModule.exports !== defined[name]) {
                        defined[name] = cjsModule.exports;
                    } else if (ret !== undef || !usingExports) {
                        //Use the return value from the function.
                        defined[name] = ret;
                    }
                }
            } else if (name) {
                //May just be an object definition for the module. Only
                //worry about defining if have a module name.
                defined[name] = callback;
            }
        };

        requirejs = require = req = (deps, callback, relName, forceSync, alt) => {
            if (typeof deps === "string") {
                //Just return the module wanted. In this scenario, the
                //deps arg is the module name, and second arg (if passed)
                //is just the relName.
                //Normalize module name, if it contains . or ..
                return callDep(makeMap(deps, callback).f);
            } else if (!deps.splice) {
                //deps is a config object, not an array.
                config = deps;
                if (callback.splice) {
                    //callback is an array, which means it is a dependency list.
                    //Adjust args if there are dependencies
                    deps = callback;
                    callback = relName;
                    relName = null;
                } else {
                    deps = undef;
                }
            }

            //Support require(['a'])
            callback = callback || (() => {});

            //If relName is a function, it is an errback handler,
            //so remove it.
            if (typeof relName === 'function') {
                relName = forceSync;
                forceSync = alt;
            }

            //Simulate async callback;
            if (forceSync) {
                main(undef, deps, callback, relName);
            } else {
                setTimeout(() => {
                    main(undef, deps, callback, relName);
                }, 15);
            }

            return req;
        };

        /**
         * Just drops the config on the floor, but returns req in case
         * the config return value is used.
         */
        req.config = cfg => {
            config = cfg;
            return req;
        };

        define = (name, deps, callback) => {

            //This module may not have dependencies
            if (!deps.splice) {
                //deps is not an array, so probably means
                //an object literal or factory function for
                //the value. Adjust args.
                callback = deps;
                deps = [];
            }

            waiting[name] = [name, deps, callback];
        };

        define.amd = {
            jQuery: true
        };
    })());

    define("almond", () => {});

    //Wrapped in an outer function to preserve global this
    ((root => { var amdExports; define('bootstrap/bootstrap-transition',['jquery'], () => { ((() => {

    /* ===================================================
     * bootstrap-transition.js v2.3.0
     * http://twitter.github.com/bootstrap/javascript.html#transitions
     * ===================================================
     * Copyright 2012 Twitter, Inc.
     *
     * Licensed under the Apache License, Version 2.0 (the "License");
     * you may not use this file except in compliance with the License.
     * You may obtain a copy of the License at
     *
     * http://www.apache.org/licenses/LICENSE-2.0
     *
     * Unless required by applicable law or agreed to in writing, software
     * distributed under the License is distributed on an "AS IS" BASIS,
     * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
     * See the License for the specific language governing permissions and
     * limitations under the License.
     * ========================================================== */


    !($ => {

       // jshint ;_;


      /* CSS TRANSITION SUPPORT (http://www.modernizr.com/)
       * ======================================================= */

      $(() => {

        $.support.transition = ((() => {

          var transitionEnd = ((() => {
              var el = document.createElement('bootstrap');

              var transEndEventNames = {
                     'WebkitTransition' : 'webkitTransitionEnd'
                  ,  'MozTransition'    : 'transitionend'
                  ,  'OTransition'      : 'oTransitionEnd otransitionend'
                  ,  'transition'       : 'transitionend'
                  };

              var name;

              for (name in transEndEventNames){
                if (el.style[name] !== undefined) {
                  return transEndEventNames[name]
                }
              }
          })())

          return transitionEnd && {
            end: transitionEnd
          }

        }))()

      })

    })(window.jQuery);


    }).call(root));
        return amdExports;
    }); })(this));

    //Wrapped in an outer function to preserve global this
    ((root => { var amdExports; define('bootstrap/bootstrap-affix',['bootstrap/bootstrap-transition'], () => { ((() => {

    /* ==========================================================
     * bootstrap-affix.js v2.3.0
     * http://twitter.github.com/bootstrap/javascript.html#affix
     * ==========================================================
     * Copyright 2012 Twitter, Inc.
     *
     * Licensed under the Apache License, Version 2.0 (the "License");
     * you may not use this file except in compliance with the License.
     * You may obtain a copy of the License at
     *
     * http://www.apache.org/licenses/LICENSE-2.0
     *
     * Unless required by applicable law or agreed to in writing, software
     * distributed under the License is distributed on an "AS IS" BASIS,
     * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
     * See the License for the specific language governing permissions and
     * limitations under the License.
     * ========================================================== */


    !($ => {

       // jshint ;_;


     /* AFFIX CLASS DEFINITION
      * ====================== */

      var Affix = function (element, options) {
        this.options = $.extend({}, $.fn.affix.defaults, options)
        this.$window = $(window)
          .on('scroll.affix.data-api', $.proxy(this.checkPosition, this))
          .on('click.affix.data-api',  $.proxy(function () { setTimeout($.proxy(this.checkPosition, this), 1) }, this))
        this.$element = $(element)
        this.checkPosition()
      }

      Affix.prototype.checkPosition = function () {
          if (!this.$element.is(':visible')) return

          var scrollHeight = $(document).height();
          var scrollTop = this.$window.scrollTop();
          var position = this.$element.offset();
          var offset = this.options.offset;
          var offsetBottom = offset.bottom;
          var offsetTop = offset.top;
          var reset = 'affix affix-top affix-bottom';
          var affix;

          if (typeof offset != 'object') offsetBottom = offsetTop = offset
          if (typeof offsetTop == 'function') offsetTop = offset.top()
          if (typeof offsetBottom == 'function') offsetBottom = offset.bottom()

          affix = this.unpin != null && (scrollTop + this.unpin <= position.top) ?
            false    : offsetBottom != null && (position.top + this.$element.height() >= scrollHeight - offsetBottom) ?
            'bottom' : offsetTop != null && scrollTop <= offsetTop ?
            'top'    : false

          if (this.affixed === affix) return

          this.affixed = affix
          this.unpin = affix == 'bottom' ? position.top - scrollTop : null

          this.$element.removeClass(reset).addClass('affix' + (affix ? '-' + affix : ''))
      }


     /* AFFIX PLUGIN DEFINITION
      * ======================= */

      var old = $.fn.affix

      $.fn.affix = function (option) {
        return this.each(function () {
            var $this = $(this);
            var data = $this.data('affix');
            var options = typeof option == 'object' && option;
            if (!data) $this.data('affix', (data = new Affix(this, options)))
            if (typeof option == 'string') data[option]()
        });
      }

      $.fn.affix.Constructor = Affix

      $.fn.affix.defaults = {
        offset: 0
      }


     /* AFFIX NO CONFLICT
      * ================= */

      $.fn.affix.noConflict = function () {
        $.fn.affix = old
        return this
      }


     /* AFFIX DATA-API
      * ============== */

      $(window).on('load', () => {
        $('[data-spy="affix"]').each(function () {
            var $spy = $(this);
            var data = $spy.data();

            data.offset = data.offset || {}

            data.offsetBottom && (data.offset.bottom = data.offsetBottom)
            data.offsetTop && (data.offset.top = data.offsetTop)

            $spy.affix(data)
        })
      })


    })(window.jQuery);


    }).call(root));
        return amdExports;
    }); })(this));

    //Wrapped in an outer function to preserve global this
    ((root => { var amdExports; define('bootstrap/bootstrap-alert',['bootstrap/bootstrap-transition'], () => { ((() => {

    /* ==========================================================
     * bootstrap-alert.js v2.3.0
     * http://twitter.github.com/bootstrap/javascript.html#alerts
     * ==========================================================
     * Copyright 2012 Twitter, Inc.
     *
     * Licensed under the Apache License, Version 2.0 (the "License");
     * you may not use this file except in compliance with the License.
     * You may obtain a copy of the License at
     *
     * http://www.apache.org/licenses/LICENSE-2.0
     *
     * Unless required by applicable law or agreed to in writing, software
     * distributed under the License is distributed on an "AS IS" BASIS,
     * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
     * See the License for the specific language governing permissions and
     * limitations under the License.
     * ========================================================== */


    !($ => {
        // jshint ;_;


        /* ALERT CLASS DEFINITION
         * ====================== */

        var dismiss = '[data-dismiss="alert"]';

        var Alert = function (el) {
              $(el).on('click', dismiss, this.close)
            };

        Alert.prototype.close = function (e) {
            var $this = $(this);
            var selector = $this.attr('data-target');
            var $parent;

            if (!selector) {
              selector = $this.attr('href')
              selector = selector && selector.replace(/.*(?=#[^\s]*$)/, '') //strip for ie7
            }

            $parent = $(selector)

            e && e.preventDefault()

            $parent.length || ($parent = $this.hasClass('alert') ? $this : $this.parent())

            $parent.trigger(e = $.Event('close'))

            if (e.isDefaultPrevented()) return

            $parent.removeClass('in')

            function removeElement() {
              $parent
                .trigger('closed')
                .remove()
            }

            $.support.transition && $parent.hasClass('fade') ?
              $parent.on($.support.transition.end, removeElement) :
              removeElement()
        }


        /* ALERT PLUGIN DEFINITION
         * ======================= */

        var old = $.fn.alert

        $.fn.alert = function (option) {
          return this.each(function () {
              var $this = $(this);
              var data = $this.data('alert');
              if (!data) $this.data('alert', (data = new Alert(this)))
              if (typeof option == 'string') data[option].call($this)
          });
        }

        $.fn.alert.Constructor = Alert


        /* ALERT NO CONFLICT
         * ================= */

        $.fn.alert.noConflict = function () {
          $.fn.alert = old
          return this
        }


        /* ALERT DATA-API
         * ============== */

        $(document).on('click.alert.data-api', dismiss, Alert.prototype.close)
    })(window.jQuery);


    }).call(root));
        return amdExports;
    }); })(this));

    //Wrapped in an outer function to preserve global this
    ((root => { var amdExports; define('bootstrap/bootstrap-button',['bootstrap/bootstrap-transition'], () => { ((() => {

    /* ============================================================
     * bootstrap-button.js v2.3.0
     * http://twitter.github.com/bootstrap/javascript.html#buttons
     * ============================================================
     * Copyright 2012 Twitter, Inc.
     *
     * Licensed under the Apache License, Version 2.0 (the "License");
     * you may not use this file except in compliance with the License.
     * You may obtain a copy of the License at
     *
     * http://www.apache.org/licenses/LICENSE-2.0
     *
     * Unless required by applicable law or agreed to in writing, software
     * distributed under the License is distributed on an "AS IS" BASIS,
     * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
     * See the License for the specific language governing permissions and
     * limitations under the License.
     * ============================================================ */


    !($ => {

       // jshint ;_;


     /* BUTTON PUBLIC CLASS DEFINITION
      * ============================== */

      var Button = function (element, options) {
        this.$element = $(element)
        this.options = $.extend({}, $.fn.button.defaults, options)
      }

      Button.prototype.setState = function (state) {
          var d = 'disabled';
          var $el = this.$element;
          var data = $el.data();
          var val = $el.is('input') ? 'val' : 'html';

          state = state + 'Text'
          data.resetText || $el.data('resetText', $el[val]())

          $el[val](data[state] || this.options[state])

          // push to event loop to allow forms to submit
          setTimeout(() => {
            state == 'loadingText' ?
              $el.addClass(d).attr(d, d) :
              $el.removeClass(d).removeAttr(d)
          }, 0)
      }

      Button.prototype.toggle = function () {
        var $parent = this.$element.closest('[data-toggle="buttons-radio"]')

        $parent && $parent
          .find('.active')
          .removeClass('active')

        this.$element.toggleClass('active')
      }


     /* BUTTON PLUGIN DEFINITION
      * ======================== */

      var old = $.fn.button

      $.fn.button = function (option) {
        return this.each(function () {
            var $this = $(this);
            var data = $this.data('button');
            var options = typeof option == 'object' && option;
            if (!data) $this.data('button', (data = new Button(this, options)))
            if (option == 'toggle') data.toggle()
            else if (option) data.setState(option)
        });
      }

      $.fn.button.defaults = {
        loadingText: 'loading...'
      }

      $.fn.button.Constructor = Button


     /* BUTTON NO CONFLICT
      * ================== */

      $.fn.button.noConflict = function () {
        $.fn.button = old
        return this
      }


     /* BUTTON DATA-API
      * =============== */

      $(document).on('click.button.data-api', '[data-toggle^=button]', e => {
        var $btn = $(e.target)
        if (!$btn.hasClass('btn')) $btn = $btn.closest('.btn')
        $btn.button('toggle')
      })

    })(window.jQuery);


    }).call(root));
        return amdExports;
    }); })(this));

    //Wrapped in an outer function to preserve global this
    ((root => { var amdExports; define('bootstrap/bootstrap-carousel',['bootstrap/bootstrap-transition'], () => { ((() => {

    /* ==========================================================
     * bootstrap-carousel.js v2.3.0
     * http://twitter.github.com/bootstrap/javascript.html#carousel
     * ==========================================================
     * Copyright 2012 Twitter, Inc.
     *
     * Licensed under the Apache License, Version 2.0 (the "License");
     * you may not use this file except in compliance with the License.
     * You may obtain a copy of the License at
     *
     * http://www.apache.org/licenses/LICENSE-2.0
     *
     * Unless required by applicable law or agreed to in writing, software
     * distributed under the License is distributed on an "AS IS" BASIS,
     * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
     * See the License for the specific language governing permissions and
     * limitations under the License.
     * ========================================================== */


    !($ => {

       // jshint ;_;


     /* CAROUSEL CLASS DEFINITION
      * ========================= */

      var Carousel = function (element, options) {
        this.$element = $(element)
        this.$indicators = this.$element.find('.carousel-indicators')
        this.options = options
        this.options.pause == 'hover' && this.$element
          .on('mouseenter', $.proxy(this.pause, this))
          .on('mouseleave', $.proxy(this.cycle, this))
      }

      Carousel.prototype = {

        cycle(e) {
          if (!e) this.paused = false
          if (this.interval) clearInterval(this.interval);
          this.options.interval
            && !this.paused
            && (this.interval = setInterval($.proxy(this.next, this), this.options.interval))
          return this
        }

      , getActiveIndex() {
          this.$active = this.$element.find('.item.active')
          this.$items = this.$active.parent().children()
          return this.$items.index(this.$active)
        }

      , to(pos) {
          var activeIndex = this.getActiveIndex();
          var that = this;

          if (pos > (this.$items.length - 1) || pos < 0) return

          if (this.sliding) {
            return this.$element.one('slid', () => {
              that.to(pos)
            });
          }

          if (activeIndex == pos) {
            return this.pause().cycle()
          }

          return this.slide(pos > activeIndex ? 'next' : 'prev', $(this.$items[pos]))
      }

      , pause(e) {
          if (!e) this.paused = true
          if (this.$element.find('.next, .prev').length && $.support.transition.end) {
            this.$element.trigger($.support.transition.end)
            this.cycle()
          }
          clearInterval(this.interval)
          this.interval = null
          return this
        }

      , next() {
          if (this.sliding) return
          return this.slide('next')
        }

      , prev() {
          if (this.sliding) return
          return this.slide('prev')
        }

      , slide(type, next) {
          var $active = this.$element.find('.item.active');
          var $next = next || $active[type]();
          var isCycling = this.interval;
          var direction = type == 'next' ? 'left' : 'right';
          var fallback  = type == 'next' ? 'first' : 'last';
          var that = this;
          var e;

          this.sliding = true

          isCycling && this.pause()

          $next = $next.length ? $next : this.$element.find('.item')[fallback]()

          e = $.Event('slide', {
            relatedTarget: $next[0]
          , direction
          })

          if ($next.hasClass('active')) return

          if (this.$indicators.length) {
            this.$indicators.find('.active').removeClass('active')
            this.$element.one('slid', () => {
              var $nextIndicator = $(that.$indicators.children()[that.getActiveIndex()])
              $nextIndicator && $nextIndicator.addClass('active')
            })
          }

          if ($.support.transition && this.$element.hasClass('slide')) {
            this.$element.trigger(e)
            if (e.isDefaultPrevented()) return
            $next.addClass(type)
            $next[0].offsetWidth // force reflow
            $active.addClass(direction)
            $next.addClass(direction)
            this.$element.one($.support.transition.end, () => {
              $next.removeClass([type, direction].join(' ')).addClass('active')
              $active.removeClass(['active', direction].join(' '))
              that.sliding = false
              setTimeout(() => { that.$element.trigger('slid') }, 0)
            })
          } else {
            this.$element.trigger(e)
            if (e.isDefaultPrevented()) return
            $active.removeClass('active')
            $next.addClass('active')
            this.sliding = false
            this.$element.trigger('slid')
          }

          isCycling && this.cycle()

          return this
      }

      }


     /* CAROUSEL PLUGIN DEFINITION
      * ========================== */

      var old = $.fn.carousel

      $.fn.carousel = function (option) {
        return this.each(function () {
            var $this = $(this);
            var data = $this.data('carousel');
            var options = $.extend({}, $.fn.carousel.defaults, typeof option == 'object' && option);
            var action = typeof option == 'string' ? option : options.slide;
            if (!data) $this.data('carousel', (data = new Carousel(this, options)))
            if (typeof option == 'number') data.to(option)
            else if (action) data[action]()
            else if (options.interval) data.pause().cycle()
        });
      }

      $.fn.carousel.defaults = {
        interval: 5000
      , pause: 'hover'
      }

      $.fn.carousel.Constructor = Carousel


     /* CAROUSEL NO CONFLICT
      * ==================== */

      $.fn.carousel.noConflict = function () {
        $.fn.carousel = old
        return this
      }

     /* CAROUSEL DATA-API
      * ================= */

      $(document).on('click.carousel.data-api', '[data-slide], [data-slide-to]', function (e) {
          var $this = $(this);
          var href;

          var //strip for ie7
          $target = $($this.attr('data-target') || (href = $this.attr('href')) && href.replace(/.*(?=#[^\s]+$)/, ''));

          var options = $.extend({}, $target.data(), $this.data());
          var slideIndex;

          $target.carousel(options)

          if (slideIndex = $this.attr('data-slide-to')) {
            $target.data('carousel').pause().to(slideIndex).cycle()
          }

          e.preventDefault()
      })

    })(window.jQuery);


    }).call(root));
        return amdExports;
    }); })(this));

    //Wrapped in an outer function to preserve global this
    ((root => { var amdExports; define('bootstrap/bootstrap-collapse',['bootstrap/bootstrap-transition'], () => { ((() => {

    /* =============================================================
     * bootstrap-collapse.js v2.3.0
     * http://twitter.github.com/bootstrap/javascript.html#collapse
     * =============================================================
     * Copyright 2012 Twitter, Inc.
     *
     * Licensed under the Apache License, Version 2.0 (the "License");
     * you may not use this file except in compliance with the License.
     * You may obtain a copy of the License at
     *
     * http://www.apache.org/licenses/LICENSE-2.0
     *
     * Unless required by applicable law or agreed to in writing, software
     * distributed under the License is distributed on an "AS IS" BASIS,
     * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
     * See the License for the specific language governing permissions and
     * limitations under the License.
     * ============================================================ */


    !($ => {

       // jshint ;_;


     /* COLLAPSE PUBLIC CLASS DEFINITION
      * ================================ */

      var Collapse = function (element, options) {
        this.$element = $(element)
        this.options = $.extend({}, $.fn.collapse.defaults, options)

        if (this.options.parent) {
          this.$parent = $(this.options.parent)
        }

        this.options.toggle && this.toggle()
      }

      Collapse.prototype = {

        constructor: Collapse

      , dimension() {
          var hasWidth = this.$element.hasClass('width')
          return hasWidth ? 'width' : 'height'
        }

      , show() {
          var dimension;
          var scroll;
          var actives;
          var hasData;

          if (this.transitioning || this.$element.hasClass('in')) return

          dimension = this.dimension()
          scroll = $.camelCase(['scroll', dimension].join('-'))
          actives = this.$parent && this.$parent.find('> .accordion-group > .in')

          if (actives && actives.length) {
            hasData = actives.data('collapse')
            if (hasData && hasData.transitioning) return
            actives.collapse('hide')
            hasData || actives.data('collapse', null)
          }

          this.$element[dimension](0)
          this.transition('addClass', $.Event('show'), 'shown')
          $.support.transition && this.$element[dimension](this.$element[0][scroll])
      }

      , hide() {
          var dimension
          if (this.transitioning || !this.$element.hasClass('in')) return
          dimension = this.dimension()
          this.reset(this.$element[dimension]())
          this.transition('removeClass', $.Event('hide'), 'hidden')
          this.$element[dimension](0)
        }

      , reset(size) {
          var dimension = this.dimension()

          this.$element
            .removeClass('collapse')
            [dimension](size || 'auto')
            [0].offsetWidth

          this.$element[size !== null ? 'addClass' : 'removeClass']('collapse')

          return this
        }

      , transition(method, startEvent, completeEvent) {
          var that = this;

          var complete = () => {
                if (startEvent.type == 'show') that.reset()
                that.transitioning = 0
                that.$element.trigger(completeEvent)
              };

          this.$element.trigger(startEvent)

          if (startEvent.isDefaultPrevented()) return

          this.transitioning = 1

          this.$element[method]('in')

          $.support.transition && this.$element.hasClass('collapse') ?
            this.$element.one($.support.transition.end, complete) :
            complete()
      }

      , toggle() {
          this[this.$element.hasClass('in') ? 'hide' : 'show']()
        }

      }


     /* COLLAPSE PLUGIN DEFINITION
      * ========================== */

      var old = $.fn.collapse

      $.fn.collapse = function (option) {
        return this.each(function () {
            var $this = $(this);
            var data = $this.data('collapse');
            var options = $.extend({}, $.fn.collapse.defaults, $this.data(), typeof option == 'object' && option);
            if (!data) $this.data('collapse', (data = new Collapse(this, options)))
            if (typeof option == 'string') data[option]()
        });
      }

      $.fn.collapse.defaults = {
        toggle: true
      }

      $.fn.collapse.Constructor = Collapse


     /* COLLAPSE NO CONFLICT
      * ==================== */

      $.fn.collapse.noConflict = function () {
        $.fn.collapse = old
        return this
      }


     /* COLLAPSE DATA-API
      * ================= */

      $(document).on('click.collapse.data-api', '[data-toggle=collapse]', function (e) {
          var $this = $(this);
          var href;

          var //strip for ie7
          target = $this.attr('data-target')
              || e.preventDefault()
              || (href = $this.attr('href')) && href.replace(/.*(?=#[^\s]+$)/, '');

          var option = $(target).data('collapse') ? 'toggle' : $this.data();
          $this[$(target).hasClass('in') ? 'addClass' : 'removeClass']('collapsed')
          $(target).collapse(option)
      })

    })(window.jQuery);


    }).call(root));
        return amdExports;
    }); })(this));

    //Wrapped in an outer function to preserve global this
    ((root => { var amdExports; define('bootstrap/bootstrap-dropdown',['bootstrap/bootstrap-transition'], () => { ((() => {

    /* ============================================================
     * bootstrap-dropdown.js v2.3.0
     * http://twitter.github.com/bootstrap/javascript.html#dropdowns
     * ============================================================
     * Copyright 2012 Twitter, Inc.
     *
     * Licensed under the Apache License, Version 2.0 (the "License");
     * you may not use this file except in compliance with the License.
     * You may obtain a copy of the License at
     *
     * http://www.apache.org/licenses/LICENSE-2.0
     *
     * Unless required by applicable law or agreed to in writing, software
     * distributed under the License is distributed on an "AS IS" BASIS,
     * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
     * See the License for the specific language governing permissions and
     * limitations under the License.
     * ============================================================ */


    !($ => {
        // jshint ;_;


        /* DROPDOWN CLASS DEFINITION
         * ========================= */

        var toggle = '[data-toggle=dropdown]';

        var Dropdown = function (element) {
              var $el = $(element).on('click.dropdown.data-api', this.toggle)
              $('html').on('click.dropdown.data-api', () => {
                $el.parent().removeClass('open')
              })
            };

        Dropdown.prototype = {

          constructor: Dropdown

        , toggle(e) {
            var $this = $(this);
            var $parent;
            var isActive;

            if ($this.is('.disabled, :disabled')) return

            $parent = getParent($this)

            isActive = $parent.hasClass('open')

            clearMenus()

            if (!isActive) {
              $parent.toggleClass('open')
            }

            $this.focus()

            return false
        }

        , keydown(e) {
            var $this;
            var $items;
            var $active;
            var $parent;
            var isActive;
            var index;

            if (!/(38|40|27)/.test(e.keyCode)) return

            $this = $(this)

            e.preventDefault()
            e.stopPropagation()

            if ($this.is('.disabled, :disabled')) return

            $parent = getParent($this)

            isActive = $parent.hasClass('open')

            if (!isActive || (isActive && e.keyCode == 27)) {
              if (e.which == 27) $parent.find(toggle).focus()
              return $this.click()
            }

            $items = $('[role=menu] li:not(.divider):visible a', $parent)

            if (!$items.length) return

            index = $items.index($items.filter(':focus'))

            if (e.keyCode == 38 && index > 0) index--                                        // up
            if (e.keyCode == 40 && index < $items.length - 1) index++                        // down
            if (!~index) index = 0

            $items
              .eq(index)
              .focus()
        }

        }

        function clearMenus() {
          $(toggle).each(function () {
            getParent($(this)).removeClass('open')
          })
        }

        function getParent($this) {
            var selector = $this.attr('data-target');
            var $parent;

            if (!selector) {
              selector = $this.attr('href')
              selector = selector && /#/.test(selector) && selector.replace(/.*(?=#[^\s]*$)/, '') //strip for ie7
            }

            $parent = selector && $(selector)

            if (!$parent || !$parent.length) $parent = $this.parent()

            return $parent
        }


        /* DROPDOWN PLUGIN DEFINITION
         * ========================== */

        var old = $.fn.dropdown

        $.fn.dropdown = function (option) {
          return this.each(function () {
              var $this = $(this);
              var data = $this.data('dropdown');
              if (!data) $this.data('dropdown', (data = new Dropdown(this)))
              if (typeof option == 'string') data[option].call($this)
          });
        }

        $.fn.dropdown.Constructor = Dropdown


        /* DROPDOWN NO CONFLICT
         * ==================== */

        $.fn.dropdown.noConflict = function () {
          $.fn.dropdown = old
          return this
        }


        /* APPLY TO STANDARD DROPDOWN ELEMENTS
         * =================================== */

        $(document)
          .on('click.dropdown.data-api', clearMenus)
          .on('click.dropdown.data-api', '.dropdown form', e => { e.stopPropagation() })
          .on('.dropdown-menu', e => { e.stopPropagation() })
          .on('click.dropdown.data-api'  , toggle, Dropdown.prototype.toggle)
          .on('keydown.dropdown.data-api', toggle + ', [role=menu]' , Dropdown.prototype.keydown)
    })(window.jQuery);



    }).call(root));
        return amdExports;
    }); })(this));

    //Wrapped in an outer function to preserve global this
    ((root => { var amdExports; define('bootstrap/bootstrap-modal',['bootstrap/bootstrap-transition'], () => { ((() => {

    /* =========================================================
     * bootstrap-modal.js v2.3.0
     * http://twitter.github.com/bootstrap/javascript.html#modals
     * =========================================================
     * Copyright 2012 Twitter, Inc.
     *
     * Licensed under the Apache License, Version 2.0 (the "License");
     * you may not use this file except in compliance with the License.
     * You may obtain a copy of the License at
     *
     * http://www.apache.org/licenses/LICENSE-2.0
     *
     * Unless required by applicable law or agreed to in writing, software
     * distributed under the License is distributed on an "AS IS" BASIS,
     * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
     * See the License for the specific language governing permissions and
     * limitations under the License.
     * ========================================================= */


    !($ => {

       // jshint ;_;


     /* MODAL CLASS DEFINITION
      * ====================== */

      var Modal = function (element, options) {
        this.options = options
        this.$element = $(element)
          .delegate('[data-dismiss="modal"]', 'click.dismiss.modal', $.proxy(this.hide, this))
        this.options.remote && this.$element.find('.modal-body').load(this.options.remote)
      }

      Modal.prototype = {

          constructor: Modal

        , toggle() {
            return this[!this.isShown ? 'show' : 'hide']()
          }

        , show() {
          var that = this;
          var e = $.Event('show');

          this.$element.trigger(e)

          if (this.isShown || e.isDefaultPrevented()) return

          this.isShown = true

          this.escape()

          this.backdrop(() => {
            var transition = $.support.transition && that.$element.hasClass('fade')

            if (!that.$element.parent().length) {
              that.$element.appendTo(document.body) //don't move modals dom position
            }

            that.$element.show()

            if (transition) {
              that.$element[0].offsetWidth // force reflow
            }

            that.$element
              .addClass('in')
              .attr('aria-hidden', false)

            that.enforceFocus()

            transition ?
              that.$element.one($.support.transition.end, () => { that.$element.focus().trigger('shown') }) :
              that.$element.focus().trigger('shown')

          })
      }

        , hide(e) {
            e && e.preventDefault()

            var that = this

            e = $.Event('hide')

            this.$element.trigger(e)

            if (!this.isShown || e.isDefaultPrevented()) return

            this.isShown = false

            this.escape()

            $(document).off('focusin.modal')

            this.$element
              .removeClass('in')
              .attr('aria-hidden', true)

            $.support.transition && this.$element.hasClass('fade') ?
              this.hideWithTransition() :
              this.hideModal()
          }

        , enforceFocus() {
            var that = this
            $(document).on('focusin.modal', e => {
              if (that.$element[0] !== e.target && !that.$element.has(e.target).length) {
                that.$element.focus()
              }
            })
          }

        , escape() {
            var that = this
            if (this.isShown && this.options.keyboard) {
              this.$element.on('keyup.dismiss.modal', e => {
                e.which == 27 && that.hide()
              })
            } else if (!this.isShown) {
              this.$element.off('keyup.dismiss.modal')
            }
          }

        , hideWithTransition() {
          var that = this;

          var timeout = setTimeout(() => {
                that.$element.off($.support.transition.end)
                that.hideModal()
              }, 500);

          this.$element.one($.support.transition.end, () => {
            clearTimeout(timeout)
            that.hideModal()
          })
      }

        , hideModal() {
            var that = this
            this.$element.hide()
            this.backdrop(() => {
              that.removeBackdrop()
              that.$element.trigger('hidden')
            })
          }

        , removeBackdrop() {
            this.$backdrop.remove()
            this.$backdrop = null
          }

        , backdrop(callback) {
          var that = this;
          var animate = this.$element.hasClass('fade') ? 'fade' : '';

          if (this.isShown && this.options.backdrop) {
            var doAnimate = $.support.transition && animate

            this.$backdrop = $('<div class="modal-backdrop ' + animate + '" />')
              .appendTo(document.body)

            this.$backdrop.click(
              this.options.backdrop == 'static' ?
                $.proxy(this.$element[0].focus, this.$element[0])
              : $.proxy(this.hide, this)
            )

            if (doAnimate) this.$backdrop[0].offsetWidth // force reflow

            this.$backdrop.addClass('in')

            if (!callback) return

            doAnimate ?
              this.$backdrop.one($.support.transition.end, callback) :
              callback()

          } else if (!this.isShown && this.$backdrop) {
            this.$backdrop.removeClass('in')

            $.support.transition && this.$element.hasClass('fade')?
              this.$backdrop.one($.support.transition.end, callback) :
              callback()

          } else if (callback) {
            callback()
          }
      }
      }


     /* MODAL PLUGIN DEFINITION
      * ======================= */

      var old = $.fn.modal

      $.fn.modal = function (option) {
        return this.each(function () {
            var $this = $(this);
            var data = $this.data('modal');
            var options = $.extend({}, $.fn.modal.defaults, $this.data(), typeof option == 'object' && option);
            if (!data) $this.data('modal', (data = new Modal(this, options)))
            if (typeof option == 'string') data[option]()
            else if (options.show) data.show()
        });
      }

      $.fn.modal.defaults = {
          backdrop: true
        , keyboard: true
        , show: true
      }

      $.fn.modal.Constructor = Modal


     /* MODAL NO CONFLICT
      * ================= */

      $.fn.modal.noConflict = function () {
        $.fn.modal = old
        return this
      }


     /* MODAL DATA-API
      * ============== */

      $(document).on('click.modal.data-api', '[data-toggle="modal"]', function (e) {
          var $this = $(this);
          var href = $this.attr('href');

          var //strip for ie7
          $target = $($this.attr('data-target') || (href && href.replace(/.*(?=#[^\s]+$)/, '')));

          var option = $target.data('modal') ? 'toggle' : $.extend({ remote:!/#/.test(href) && href }, $target.data(), $this.data());

          e.preventDefault()

          $target
            .modal(option)
            .one('hide', () => {
              $this.focus()
            })
      })

    })(window.jQuery);



    }).call(root));
        return amdExports;
    }); })(this));

    //Wrapped in an outer function to preserve global this
    ((root => { var amdExports; define('bootstrap/bootstrap-tooltip',['bootstrap/bootstrap-transition'], () => { ((() => {

    /* ===========================================================
     * bootstrap-tooltip.js v2.3.0
     * http://twitter.github.com/bootstrap/javascript.html#tooltips
     * Inspired by the original jQuery.tipsy by Jason Frame
     * ===========================================================
     * Copyright 2012 Twitter, Inc.
     *
     * Licensed under the Apache License, Version 2.0 (the "License");
     * you may not use this file except in compliance with the License.
     * You may obtain a copy of the License at
     *
     * http://www.apache.org/licenses/LICENSE-2.0
     *
     * Unless required by applicable law or agreed to in writing, software
     * distributed under the License is distributed on an "AS IS" BASIS,
     * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
     * See the License for the specific language governing permissions and
     * limitations under the License.
     * ========================================================== */


    !($ => {

       // jshint ;_;


     /* TOOLTIP PUBLIC CLASS DEFINITION
      * =============================== */

      var Tooltip = function (element, options) {
        this.init('tooltip', element, options)
      }

      Tooltip.prototype = {

        constructor: Tooltip

      , init(type, element, options) {
          var eventIn;
          var eventOut;
          var triggers;
          var trigger;
          var i;

          this.type = type
          this.$element = $(element)
          this.options = this.getOptions(options)
          this.enabled = true

          triggers = this.options.trigger.split(' ')

          for (i = triggers.length; i--;) {
            trigger = triggers[i]
            if (trigger == 'click') {
              this.$element.on('click.' + this.type, this.options.selector, $.proxy(this.toggle, this))
            } else if (trigger != 'manual') {
              eventIn = trigger == 'hover' ? 'mouseenter' : 'focus'
              eventOut = trigger == 'hover' ? 'mouseleave' : 'blur'
              this.$element.on(eventIn + '.' + this.type, this.options.selector, $.proxy(this.enter, this))
              this.$element.on(eventOut + '.' + this.type, this.options.selector, $.proxy(this.leave, this))
            }
          }

          this.options.selector ?
            (this._options = $.extend({}, this.options, { trigger: 'manual', selector: '' })) :
            this.fixTitle()
      }

      , getOptions(options) {
          options = $.extend({}, $.fn[this.type].defaults, this.$element.data(), options)

          if (options.delay && typeof options.delay == 'number') {
            options.delay = {
              show: options.delay
            , hide: options.delay
            }
          }

          return options
        }

      , enter(e) {
          var self = $(e.currentTarget)[this.type](this._options).data(this.type)

          if (!self.options.delay || !self.options.delay.show) return self.show()

          clearTimeout(this.timeout)
          self.hoverState = 'in'
          this.timeout = setTimeout(() => {
            if (self.hoverState == 'in') self.show()
          }, self.options.delay.show)
        }

      , leave(e) {
          var self = $(e.currentTarget)[this.type](this._options).data(this.type)

          if (this.timeout) clearTimeout(this.timeout)
          if (!self.options.delay || !self.options.delay.hide) return self.hide()

          self.hoverState = 'out'
          this.timeout = setTimeout(() => {
            if (self.hoverState == 'out') self.hide()
          }, self.options.delay.hide)
        }

      , show() {
          var $tip;
          var pos;
          var actualWidth;
          var actualHeight;
          var placement;
          var tp;
          var e = $.Event('show');

          if (this.hasContent() && this.enabled) {
            this.$element.trigger(e)
            if (e.isDefaultPrevented()) return
            $tip = this.tip()
            this.setContent()

            if (this.options.animation) {
              $tip.addClass('fade')
            }

            placement = typeof this.options.placement == 'function' ?
              this.options.placement.call(this, $tip[0], this.$element[0]) :
              this.options.placement

            $tip
              .detach()
              .css({ top: 0, left: 0, display: 'block' })

            this.options.container ? $tip.appendTo(this.options.container) : $tip.insertAfter(this.$element)

            pos = this.getPosition()

            actualWidth = $tip[0].offsetWidth
            actualHeight = $tip[0].offsetHeight

            switch (placement) {
              case 'bottom':
                tp = {top: pos.top + pos.height, left: pos.left + pos.width / 2 - actualWidth / 2}
                break
              case 'top':
                tp = {top: pos.top - actualHeight, left: pos.left + pos.width / 2 - actualWidth / 2}
                break
              case 'left':
                tp = {top: pos.top + pos.height / 2 - actualHeight / 2, left: pos.left - actualWidth}
                break
              case 'right':
                tp = {top: pos.top + pos.height / 2 - actualHeight / 2, left: pos.left + pos.width}
                break
            }

            this.applyPlacement(tp, placement)
            this.$element.trigger('shown')
          }
      }

      , applyPlacement(offset, placement) {
          var $tip = this.tip();
          var width = $tip[0].offsetWidth;
          var height = $tip[0].offsetHeight;
          var actualWidth;
          var actualHeight;
          var delta;
          var replace;

          $tip
            .offset(offset)
            .addClass(placement)
            .addClass('in')

          actualWidth = $tip[0].offsetWidth
          actualHeight = $tip[0].offsetHeight

          if (placement == 'top' && actualHeight != height) {
            offset.top = offset.top + height - actualHeight
            replace = true
          }

          if (placement == 'bottom' || placement == 'top') {
            delta = 0

            if (offset.left < 0){
              delta = offset.left * -2
              offset.left = 0
              $tip.offset(offset)
              actualWidth = $tip[0].offsetWidth
              actualHeight = $tip[0].offsetHeight
            }

            this.replaceArrow(delta - width + actualWidth, actualWidth, 'left')
          } else {
            this.replaceArrow(actualHeight - height, actualHeight, 'top')
          }

          if (replace) $tip.offset(offset)
      }

      , replaceArrow(delta, dimension, position) {
          this
            .arrow()
            .css(position, delta ? (50 * (1 - delta / dimension) + "%") : '')
        }

      , setContent() {
          var $tip = this.tip();
          var title = this.getTitle();

          $tip.find('.tooltip-inner')[this.options.html ? 'html' : 'text'](title)
          $tip.removeClass('fade in top bottom left right')
      }

      , hide() {
          var that = this;
          var $tip = this.tip();
          var e = $.Event('hide');

          this.$element.trigger(e)
          if (e.isDefaultPrevented()) return

          $tip.removeClass('in')

          function removeWithAnimation() {
            var timeout = setTimeout(() => {
              $tip.off($.support.transition.end).detach()
            }, 500)

            $tip.one($.support.transition.end, () => {
              clearTimeout(timeout)
              $tip.detach()
            })
          }

          $.support.transition && this.$tip.hasClass('fade') ?
            removeWithAnimation() :
            $tip.detach()

          this.$element.trigger('hidden')

          return this
      }

      , fixTitle() {
          var $e = this.$element
          if ($e.attr('title') || typeof($e.attr('data-original-title')) != 'string') {
            $e.attr('data-original-title', $e.attr('title') || '').attr('title', '')
          }
        }

      , hasContent() {
          return this.getTitle()
        }

      , getPosition() {
          var el = this.$element[0]
          return $.extend({}, (typeof el.getBoundingClientRect == 'function') ? el.getBoundingClientRect() : {
            width: el.offsetWidth
          , height: el.offsetHeight
          }, this.$element.offset())
        }

      , getTitle() {
          var title;
          var $e = this.$element;
          var o = this.options;

          title = $e.attr('data-original-title')
            || (typeof o.title == 'function' ? o.title.call($e[0]) :  o.title)

          return title
      }

      , tip() {
          return this.$tip = this.$tip || $(this.options.template)
        }

      , arrow() {
          return this.$arrow = this.$arrow || this.tip().find(".tooltip-arrow")
        }

      , validate() {
          if (!this.$element[0].parentNode) {
            this.hide()
            this.$element = null
            this.options = null
          }
        }

      , enable() {
          this.enabled = true
        }

      , disable() {
          this.enabled = false
        }

      , toggleEnabled() {
          this.enabled = !this.enabled
        }

      , toggle(e) {
          var self = e ? $(e.currentTarget)[this.type](this._options).data(this.type) : this
          self.tip().hasClass('in') ? self.hide() : self.show()
        }

      , destroy() {
          this.hide().$element.off('.' + this.type).removeData(this.type)
        }

      }


     /* TOOLTIP PLUGIN DEFINITION
      * ========================= */

      var old = $.fn.tooltip

      $.fn.tooltip = function ( option ) {
        return this.each(function () {
            var $this = $(this);
            var data = $this.data('tooltip');
            var options = typeof option == 'object' && option;
            if (!data) $this.data('tooltip', (data = new Tooltip(this, options)))
            if (typeof option == 'string') data[option]()
        });
      }

      $.fn.tooltip.Constructor = Tooltip

      $.fn.tooltip.defaults = {
        animation: true
      , placement: 'top'
      , selector: false
      , template: '<div class="tooltip"><div class="tooltip-arrow"></div><div class="tooltip-inner"></div></div>'
      , trigger: 'hover focus'
      , title: ''
      , delay: 0
      , html: false
      , container: false
      }


     /* TOOLTIP NO CONFLICT
      * =================== */

      $.fn.tooltip.noConflict = function () {
        $.fn.tooltip = old
        return this
      }

    })(window.jQuery);



    }).call(root));
        return amdExports;
    }); })(this));

    //Wrapped in an outer function to preserve global this
    ((root => { var amdExports; define('bootstrap/bootstrap-popover',['bootstrap/bootstrap-transition','bootstrap/bootstrap-tooltip'], () => { ((() => {

    /* ===========================================================
     * bootstrap-popover.js v2.3.0
     * http://twitter.github.com/bootstrap/javascript.html#popovers
     * ===========================================================
     * Copyright 2012 Twitter, Inc.
     *
     * Licensed under the Apache License, Version 2.0 (the "License");
     * you may not use this file except in compliance with the License.
     * You may obtain a copy of the License at
     *
     * http://www.apache.org/licenses/LICENSE-2.0
     *
     * Unless required by applicable law or agreed to in writing, software
     * distributed under the License is distributed on an "AS IS" BASIS,
     * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
     * See the License for the specific language governing permissions and
     * limitations under the License.
     * =========================================================== */


    !($ => {

       // jshint ;_;


     /* POPOVER PUBLIC CLASS DEFINITION
      * =============================== */

      var Popover = function (element, options) {
        this.init('popover', element, options)
      }


      /* NOTE: POPOVER EXTENDS BOOTSTRAP-TOOLTIP.js
         ========================================== */

      Popover.prototype = $.extend({}, $.fn.tooltip.Constructor.prototype, {

        constructor: Popover

      , setContent() {
          var $tip = this.tip();
          var title = this.getTitle();
          var content = this.getContent();

          $tip.find('.popover-title')[this.options.html ? 'html' : 'text'](title)
          $tip.find('.popover-content')[this.options.html ? 'html' : 'text'](content)

          $tip.removeClass('fade top bottom left right in')
      }

      , hasContent() {
          return this.getTitle() || this.getContent()
        }

      , getContent() {
          var content;
          var $e = this.$element;
          var o = this.options;

          content = (typeof o.content == 'function' ? o.content.call($e[0]) :  o.content)
            || $e.attr('data-content')

          return content
      }

      , tip() {
          if (!this.$tip) {
            this.$tip = $(this.options.template)
          }
          return this.$tip
        }

      , destroy() {
          this.hide().$element.off('.' + this.type).removeData(this.type)
        }

      })


     /* POPOVER PLUGIN DEFINITION
      * ======================= */

      var old = $.fn.popover

      $.fn.popover = function (option) {
        return this.each(function () {
            var $this = $(this);
            var data = $this.data('popover');
            var options = typeof option == 'object' && option;
            if (!data) $this.data('popover', (data = new Popover(this, options)))
            if (typeof option == 'string') data[option]()
        });
      }

      $.fn.popover.Constructor = Popover

      $.fn.popover.defaults = $.extend({} , $.fn.tooltip.defaults, {
        placement: 'right'
      , trigger: 'click'
      , content: ''
      , template: '<div class="popover"><div class="arrow"></div><h3 class="popover-title"></h3><div class="popover-content"></div></div>'
      })


     /* POPOVER NO CONFLICT
      * =================== */

      $.fn.popover.noConflict = function () {
        $.fn.popover = old
        return this
      }

    })(window.jQuery);



    }).call(root));
        return amdExports;
    }); })(this));

    //Wrapped in an outer function to preserve global this
    ((root => { var amdExports; define('bootstrap/bootstrap-scrollspy',['bootstrap/bootstrap-transition'], () => { ((() => {

    /* =============================================================
     * bootstrap-scrollspy.js v2.3.0
     * http://twitter.github.com/bootstrap/javascript.html#scrollspy
     * =============================================================
     * Copyright 2012 Twitter, Inc.
     *
     * Licensed under the Apache License, Version 2.0 (the "License");
     * you may not use this file except in compliance with the License.
     * You may obtain a copy of the License at
     *
     * http://www.apache.org/licenses/LICENSE-2.0
     *
     * Unless required by applicable law or agreed to in writing, software
     * distributed under the License is distributed on an "AS IS" BASIS,
     * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
     * See the License for the specific language governing permissions and
     * limitations under the License.
     * ============================================================== */


    !($ => {

       // jshint ;_;


     /* SCROLLSPY CLASS DEFINITION
      * ========================== */

      function ScrollSpy(element, options) {
          var process = $.proxy(this.process, this);
          var $element = $(element).is('body') ? $(window) : $(element);
          var href;
          this.options = $.extend({}, $.fn.scrollspy.defaults, options)
          this.$scrollElement = $element.on('scroll.scroll-spy.data-api', process)
          this.selector = (this.options.target
            || ((href = $(element).attr('href')) && href.replace(/.*(?=#[^\s]+$)/, '')) //strip for ie7
            || '') + ' .nav li > a'
          this.$body = $('body')
          this.refresh()
          this.process()
      }

      ScrollSpy.prototype = {

          constructor: ScrollSpy

        , refresh() {
          var self = this;
          var $targets;

          this.offsets = $([])
          this.targets = $([])

          $targets = this.$body
            .find(this.selector)
            .map(function () {
              var $el = $(this);
              var href = $el.data('target') || $el.attr('href');
              var $href = /^#\w/.test(href) && $(href);
              return ( $href
                && $href.length
                && [[ $href.position().top + (!$.isWindow(self.$scrollElement.get(0)) && self.$scrollElement.scrollTop()), href ]] ) || null
          })
            .sort((a, b) => a[0] - b[0])
            .each(function () {
              self.offsets.push(this[0])
              self.targets.push(this[1])
            })
      }

        , process() {
          var scrollTop = this.$scrollElement.scrollTop() + this.options.offset;
          var scrollHeight = this.$scrollElement[0].scrollHeight || this.$body[0].scrollHeight;
          var maxScroll = scrollHeight - this.$scrollElement.height();
          var offsets = this.offsets;
          var targets = this.targets;
          var activeTarget = this.activeTarget;
          var i;

          if (scrollTop >= maxScroll) {
            return activeTarget != (i = targets.last()[0])
              && this.activate ( i )
          }

          for (i = offsets.length; i--;) {
            activeTarget != targets[i]
              && scrollTop >= offsets[i]
              && (!offsets[i + 1] || scrollTop <= offsets[i + 1])
              && this.activate( targets[i] )
          }
      }

        , activate(target) {
          var active;
          var selector;

          this.activeTarget = target

          $(this.selector)
            .parent('.active')
            .removeClass('active')

          selector = this.selector
            + '[data-target="' + target + '"],'
            + this.selector + '[href="' + target + '"]'

          active = $(selector)
            .parent('li')
            .addClass('active')

          if (active.parent('.dropdown-menu').length)  {
            active = active.closest('li.dropdown').addClass('active')
          }

          active.trigger('activate')
      }

      }


     /* SCROLLSPY PLUGIN DEFINITION
      * =========================== */

      var old = $.fn.scrollspy

      $.fn.scrollspy = function (option) {
        return this.each(function () {
            var $this = $(this);
            var data = $this.data('scrollspy');
            var options = typeof option == 'object' && option;
            if (!data) $this.data('scrollspy', (data = new ScrollSpy(this, options)))
            if (typeof option == 'string') data[option]()
        });
      }

      $.fn.scrollspy.Constructor = ScrollSpy

      $.fn.scrollspy.defaults = {
        offset: 10
      }


     /* SCROLLSPY NO CONFLICT
      * ===================== */

      $.fn.scrollspy.noConflict = function () {
        $.fn.scrollspy = old
        return this
      }


     /* SCROLLSPY DATA-API
      * ================== */

      $(window).on('load', () => {
        $('[data-spy="scroll"]').each(function () {
          var $spy = $(this)
          $spy.scrollspy($spy.data())
        })
      })

    })(window.jQuery);


    }).call(root));
        return amdExports;
    }); })(this));

    //Wrapped in an outer function to preserve global this
    ((root => { var amdExports; define('bootstrap/bootstrap-tab',['bootstrap/bootstrap-transition'], () => { ((() => {

    /* ========================================================
     * bootstrap-tab.js v2.3.0
     * http://twitter.github.com/bootstrap/javascript.html#tabs
     * ========================================================
     * Copyright 2012 Twitter, Inc.
     *
     * Licensed under the Apache License, Version 2.0 (the "License");
     * you may not use this file except in compliance with the License.
     * You may obtain a copy of the License at
     *
     * http://www.apache.org/licenses/LICENSE-2.0
     *
     * Unless required by applicable law or agreed to in writing, software
     * distributed under the License is distributed on an "AS IS" BASIS,
     * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
     * See the License for the specific language governing permissions and
     * limitations under the License.
     * ======================================================== */


    !($ => {

       // jshint ;_;


     /* TAB CLASS DEFINITION
      * ==================== */

      var Tab = function (element) {
        this.element = $(element)
      }

      Tab.prototype = {

        constructor: Tab

      , show() {
          var $this = this.element;
          var $ul = $this.closest('ul:not(.dropdown-menu)');
          var selector = $this.attr('data-target');
          var previous;
          var $target;
          var e;

          if (!selector) {
            selector = $this.attr('href')
            selector = selector && selector.replace(/.*(?=#[^\s]*$)/, '') //strip for ie7
          }

          if ( $this.parent('li').hasClass('active') ) return

          previous = $ul.find('.active:last a')[0]

          e = $.Event('show', {
            relatedTarget: previous
          })

          $this.trigger(e)

          if (e.isDefaultPrevented()) return

          $target = $(selector)

          this.activate($this.parent('li'), $ul)
          this.activate($target, $target.parent(), () => {
            $this.trigger({
              type: 'shown'
            , relatedTarget: previous
            })
          })
      }

      , activate(element, container, callback) {
          var $active = container.find('> .active');

          var transition = callback
                && $.support.transition
                && $active.hasClass('fade');

          function next() {
            $active
              .removeClass('active')
              .find('> .dropdown-menu > .active')
              .removeClass('active')

            element.addClass('active')

            if (transition) {
              element[0].offsetWidth // reflow for transition
              element.addClass('in')
            } else {
              element.removeClass('fade')
            }

            if ( element.parent('.dropdown-menu') ) {
              element.closest('li.dropdown').addClass('active')
            }

            callback && callback()
          }

          transition ?
            $active.one($.support.transition.end, next) :
            next()

          $active.removeClass('in')
      }
      }


     /* TAB PLUGIN DEFINITION
      * ===================== */

      var old = $.fn.tab

      $.fn.tab = function ( option ) {
        return this.each(function () {
            var $this = $(this);
            var data = $this.data('tab');
            if (!data) $this.data('tab', (data = new Tab(this)))
            if (typeof option == 'string') data[option]()
        });
      }

      $.fn.tab.Constructor = Tab


     /* TAB NO CONFLICT
      * =============== */

      $.fn.tab.noConflict = function () {
        $.fn.tab = old
        return this
      }


     /* TAB DATA-API
      * ============ */

      $(document).on('click.tab.data-api', '[data-toggle="tab"], [data-toggle="pill"]', function (e) {
        e.preventDefault()
        $(this).tab('show')
      })

    })(window.jQuery);


    }).call(root));
        return amdExports;
    }); })(this));

    //Wrapped in an outer function to preserve global this
    ((root => { var amdExports; define('bootstrap/bootstrap-typeahead',['bootstrap/bootstrap-transition'], () => { ((() => {

    /* =============================================================
     * bootstrap-typeahead.js v2.3.0
     * http://twitter.github.com/bootstrap/javascript.html#typeahead
     * =============================================================
     * Copyright 2012 Twitter, Inc.
     *
     * Licensed under the Apache License, Version 2.0 (the "License");
     * you may not use this file except in compliance with the License.
     * You may obtain a copy of the License at
     *
     * http://www.apache.org/licenses/LICENSE-2.0
     *
     * Unless required by applicable law or agreed to in writing, software
     * distributed under the License is distributed on an "AS IS" BASIS,
     * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
     * See the License for the specific language governing permissions and
     * limitations under the License.
     * ============================================================ */


    !($ => {

       // jshint ;_;


     /* TYPEAHEAD PUBLIC CLASS DEFINITION
      * ================================= */

      var Typeahead = function (element, options) {
        this.$element = $(element)
        this.options = $.extend({}, $.fn.typeahead.defaults, options)
        this.matcher = this.options.matcher || this.matcher
        this.sorter = this.options.sorter || this.sorter
        this.highlighter = this.options.highlighter || this.highlighter
        this.updater = this.options.updater || this.updater
        this.source = this.options.source
        this.$menu = $(this.options.menu)
        this.shown = false
        this.listen()
      }

      Typeahead.prototype = {

        constructor: Typeahead

      , select() {
          var val = this.$menu.find('.active').attr('data-value')
          this.$element
            .val(this.updater(val))
            .change()
          return this.hide()
        }

      , updater(item) {
          return item
        }

      , show() {
          var pos = $.extend({}, this.$element.position(), {
            height: this.$element[0].offsetHeight
          })

          this.$menu
            .insertAfter(this.$element)
            .css({
              top: pos.top + pos.height
            , left: pos.left
            })
            .show()

          this.shown = true
          return this
        }

      , hide() {
          this.$menu.hide()
          this.shown = false
          return this
        }

      , lookup(event) {
          var items

          this.query = this.$element.val()

          if (!this.query || this.query.length < this.options.minLength) {
            return this.shown ? this.hide() : this
          }

          items = $.isFunction(this.source) ? this.source(this.query, $.proxy(this.process, this)) : this.source

          return items ? this.process(items) : this
        }

      , process(items) {
          var that = this

          items = $.grep(items, item => that.matcher(item))

          items = this.sorter(items)

          if (!items.length) {
            return this.shown ? this.hide() : this
          }

          return this.render(items.slice(0, this.options.items)).show()
        }

      , matcher(item) {
          return ~item.toLowerCase().indexOf(this.query.toLowerCase())
        }

      , sorter(items) {
          var beginswith = [];
          var caseSensitive = [];
          var caseInsensitive = [];
          var item;

          while (item = items.shift()) {
            if (!item.toLowerCase().indexOf(this.query.toLowerCase())) beginswith.push(item)
            else if (~item.indexOf(this.query)) caseSensitive.push(item)
            else caseInsensitive.push(item)
          }

          return beginswith.concat(caseSensitive, caseInsensitive)
      }

      , highlighter(item) {
          var query = this.query.replace(/[\-\[\]{}()*+?.,\\\^$|#\s]/g, '\\$&')
          return item.replace(new RegExp('(' + query + ')', 'ig'), ($1, match) => '<strong>' + match + '</strong>');
        }

      , render(items) {
          var that = this

          items = $(items).map((i, item) => {
            i = $(that.options.item).attr('data-value', item)
            i.find('a').html(that.highlighter(item))
            return i[0]
          })

          items.first().addClass('active')
          this.$menu.html(items)
          return this
        }

      , next(event) {
          var active = this.$menu.find('.active').removeClass('active');
          var next = active.next();

          if (!next.length) {
            next = $(this.$menu.find('li')[0])
          }

          next.addClass('active')
      }

      , prev(event) {
          var active = this.$menu.find('.active').removeClass('active');
          var prev = active.prev();

          if (!prev.length) {
            prev = this.$menu.find('li').last()
          }

          prev.addClass('active')
      }

      , listen() {
          this.$element
            .on('focus',    $.proxy(this.focus, this))
            .on('blur',     $.proxy(this.blur, this))
            .on('keypress', $.proxy(this.keypress, this))
            .on('keyup',    $.proxy(this.keyup, this))

          if (this.eventSupported('keydown')) {
            this.$element.on('keydown', $.proxy(this.keydown, this))
          }

          this.$menu
            .on('click', $.proxy(this.click, this))
            .on('mouseenter', 'li', $.proxy(this.mouseenter, this))
            .on('mouseleave', 'li', $.proxy(this.mouseleave, this))
        }

      , eventSupported(eventName) {
          var isSupported = eventName in this.$element
          if (!isSupported) {
            this.$element.setAttribute(eventName, 'return;')
            isSupported = typeof this.$element[eventName] === 'function'
          }
          return isSupported
        }

      , move(e) {
          if (!this.shown) return

          switch(e.keyCode) {
            case 9: // tab
            case 13: // enter
            case 27: // escape
              e.preventDefault()
              break

            case 38: // up arrow
              e.preventDefault()
              this.prev()
              break

            case 40: // down arrow
              e.preventDefault()
              this.next()
              break
          }

          e.stopPropagation()
        }

      , keydown(e) {
          this.suppressKeyPressRepeat = ~$.inArray(e.keyCode, [40,38,9,13,27])
          this.move(e)
        }

      , keypress(e) {
          if (this.suppressKeyPressRepeat) return
          this.move(e)
        }

      , keyup(e) {
          switch(e.keyCode) {
            case 40: // down arrow
            case 38: // up arrow
            case 16: // shift
            case 17: // ctrl
            case 18: // alt
              break

            case 9: // tab
            case 13: // enter
              if (!this.shown) return
              this.select()
              break

            case 27: // escape
              if (!this.shown) return
              this.hide()
              break

            default:
              this.lookup()
          }

          e.stopPropagation()
          e.preventDefault()
      }

      , focus(e) {
          this.focused = true
        }

      , blur(e) {
          this.focused = false
          if (!this.mousedover && this.shown) this.hide()
        }

      , click(e) {
          e.stopPropagation()
          e.preventDefault()
          this.select()
          this.$element.focus()
        }

      , mouseenter(e) {
          this.mousedover = true
          this.$menu.find('.active').removeClass('active')
          $(e.currentTarget).addClass('active')
        }

      , mouseleave(e) {
          this.mousedover = false
          if (!this.focused && this.shown) this.hide()
        }

      }


      /* TYPEAHEAD PLUGIN DEFINITION
       * =========================== */

      var old = $.fn.typeahead

      $.fn.typeahead = function (option) {
        return this.each(function () {
            var $this = $(this);
            var data = $this.data('typeahead');
            var options = typeof option == 'object' && option;
            if (!data) $this.data('typeahead', (data = new Typeahead(this, options)))
            if (typeof option == 'string') data[option]()
        });
      }

      $.fn.typeahead.defaults = {
        source: []
      , items: 8
      , menu: '<ul class="typeahead dropdown-menu"></ul>'
      , item: '<li><a href="#"></a></li>'
      , minLength: 1
      }

      $.fn.typeahead.Constructor = Typeahead


     /* TYPEAHEAD NO CONFLICT
      * =================== */

      $.fn.typeahead.noConflict = function () {
        $.fn.typeahead = old
        return this
      }


     /* TYPEAHEAD DATA-API
      * ================== */

      $(document).on('focus.typeahead.data-api', '[data-provide="typeahead"]', function (e) {
        var $this = $(this)
        if ($this.data('typeahead')) return
        $this.typeahead($this.data())
      })

    })(window.jQuery);



    }).call(root));
        return amdExports;
    }); })(this));

    /*
     * Fuel UX Checkbox
     * https://github.com/ExactTarget/fuelux
     *
     * Copyright (c) 2012 ExactTarget
     * Licensed under the MIT license.
     */

    define('fuelux/checkbox',['require','jquery'],require => {

        var $ = require('jquery');


        // CHECKBOX CONSTRUCTOR AND PROTOTYPE

        var Checkbox = function (element, options) {

            this.$element = $(element);
            this.options = $.extend({}, $.fn.checkbox.defaults, options);

            // cache elements
            this.$label = this.$element.parent();
            this.$icon = this.$label.find('i');
            this.$chk = this.$label.find('input[type=checkbox]');

            // set default state
            this.setState(this.$chk);

            // handle events
            this.$chk.on('change', $.proxy(this.itemchecked, this));
        };

        Checkbox.prototype = {

            constructor: Checkbox,

            setState($chk) {
                var checked = $chk.is(':checked');
                var disabled = $chk.is(':disabled');

                // reset classes
                this.$icon.removeClass('checked').removeClass('disabled');

                // set state of checkbox
                if (checked === true) {
                    this.$icon.addClass('checked');
                }
                if (disabled === true) {
                    this.$icon.addClass('disabled');
                }
            },

            enable() {
                this.$chk.attr('disabled', false);
                this.$icon.removeClass('disabled');
            },

            disable() {
                this.$chk.attr('disabled', true);
                this.$icon.addClass('disabled');
            },

            toggle() {
                this.$chk.click();
            },

            itemchecked(e) {
                var chk = $(e.target);
                this.setState(chk);
            }
        };


        // CHECKBOX PLUGIN DEFINITION

        $.fn.checkbox = function (option, value) {
            var methodReturn;

            var $set = this.each(function () {
                var $this = $(this);
                var data = $this.data('checkbox');
                var options = typeof option === 'object' && option;

                if (!data) $this.data('checkbox', (data = new Checkbox(this, options)));
                if (typeof option === 'string') methodReturn = data[option](value);
            });

            return (methodReturn === undefined) ? $set : methodReturn;
        };

        $.fn.checkbox.defaults = {};

        $.fn.checkbox.Constructor = Checkbox;


        // CHECKBOX DATA-API

        $(() => {
            $(window).on('load', () => {
                //$('i.checkbox').each(function () {
                $('.checkbox-custom > input[type=checkbox]').each(function () {
                    var $this = $(this);
                    if ($this.data('checkbox')) return;
                    $this.checkbox($this.data());
                });
            });
        });

    });

    /*
     * Fuel UX Utilities
     * https://github.com/ExactTarget/fuelux
     *
     * Copyright (c) 2012 ExactTarget
     * Licensed under the MIT license.
     */

    define('fuelux/util',['require','jquery'],require => {

        var $ = require('jquery');

        // custom case-insensitive match expression
        function fuelTextExactCI(elem, text) {
            return (elem.textContent || elem.innerText || $(elem).text() || '').toLowerCase() === (text || '').toLowerCase();
        }

        $.expr[':'].fuelTextExactCI = $.expr.createPseudo ?
            $.expr.createPseudo(text => elem => fuelTextExactCI(elem, text)) :
            (elem, i, match) => fuelTextExactCI(elem, match[3]);

    });
    /*
     * Fuel UX Combobox
     * https://github.com/ExactTarget/fuelux
     *
     * Copyright (c) 2012 ExactTarget
     * Licensed under the MIT license.
     */

    define('fuelux/combobox',['require','jquery','./util'],require => {

        var $ = require('jquery');
        require('./util');

        // COMBOBOX CONSTRUCTOR AND PROTOTYPE

        var Combobox = function (element, options) {
            this.$element = $(element);
            this.options = $.extend({}, $.fn.combobox.defaults, options);
            this.$element.on('click', 'a', $.proxy(this.itemclicked, this));
            this.$element.on('change', 'input', $.proxy(this.inputchanged, this));
            this.$input = this.$element.find('input');
            this.$button = this.$element.find('.btn');

            // set default selection
            this.setDefaultSelection();
        };

        Combobox.prototype = {

            constructor: Combobox,

            selectedItem() {
                var item = this.$selectedItem;
                var data = {};

                if (item) {
                    var txt = this.$selectedItem.text();
                    data = $.extend({ text: txt }, this.$selectedItem.data());
                }
                else {
                    data = { text: this.$input.val()};
                }

                return data;
            },

            selectByText(text) {
                var selector = 'li:fuelTextExactCI(' + text + ')';
                this.selectBySelector(selector);
            },

            selectByValue(value) {
                var selector = 'li[data-value=' + value + ']';
                this.selectBySelector(selector);
            },

            selectByIndex(index) {
                // zero-based index
                var selector = 'li:eq(' + index + ')';
                this.selectBySelector(selector);
            },

            selectBySelector(selector) {
                var $item = this.$element.find(selector);

                if (typeof $item[0] !== 'undefined') {
                    this.$selectedItem = $item;
                    this.$input.val(this.$selectedItem.text());
                }
                else {
                    this.$selectedItem = null;
                }
            },

            setDefaultSelection() {
                var selector = 'li[data-selected=true]:first';
                var item = this.$element.find(selector);

                if (item.length > 0) {
                    // select by data-attribute
                    this.selectBySelector(selector);
                    item.removeData('selected');
                    item.removeAttr('data-selected');
                }
            },

            enable() {
                this.$input.removeAttr('disabled');
                this.$button.removeClass('disabled');
            },

            disable() {
                this.$input.attr('disabled', true);
                this.$button.addClass('disabled');
            },

            itemclicked(e) {
                this.$selectedItem = $(e.target).parent();

                // set input text and trigger input change event marked as synthetic
                this.$input.val(this.$selectedItem.text()).trigger('change', { synthetic: true });

                // pass object including text and any data-attributes
                // to onchange event
                var data = this.selectedItem();

                // trigger changed event
                this.$element.trigger('changed', data);

                e.preventDefault();
            },

            inputchanged(e, extra) {

                // skip processing for internally-generated synthetic event
                // to avoid double processing
                if (extra && extra.synthetic) return;

                var val = $(e.target).val();
                this.selectByText(val);

                // find match based on input
                // if no match, pass the input value
                var data = this.selectedItem();
                if (data.text.length === 0) {
                    data = { text: val };
                }

                // trigger changed event
                this.$element.trigger('changed', data);

            }

        };


        // COMBOBOX PLUGIN DEFINITION

        $.fn.combobox = function (option, value) {
            var methodReturn;

            var $set = this.each(function () {
                var $this = $(this);
                var data = $this.data('combobox');
                var options = typeof option === 'object' && option;

                if (!data) $this.data('combobox', (data = new Combobox(this, options)));
                if (typeof option === 'string') methodReturn = data[option](value);
            });

            return (methodReturn === undefined) ? $set : methodReturn;
        };

        $.fn.combobox.defaults = {};

        $.fn.combobox.Constructor = Combobox;


        // COMBOBOX DATA-API

        $(() => {

            $(window).on('load', () => {
                $('.combobox').each(function () {
                    var $this = $(this);
                    if ($this.data('combobox')) return;
                    $this.combobox($this.data());
                });
            });

            $('body').on('mousedown.combobox.data-api', '.combobox', function (e) {
                var $this = $(this);
                if ($this.data('combobox')) return;
                $this.combobox($this.data());
            });
        });

    });

    /*
     * Fuel UX Datagrid
     * https://github.com/ExactTarget/fuelux
     *
     * Copyright (c) 2012 ExactTarget
     * Licensed under the MIT license.
     */

    define('fuelux/datagrid',['require','jquery'],require => {

        var $ = require('jquery');


        // DATAGRID CONSTRUCTOR AND PROTOTYPE

        var Datagrid = function (element, options) {
            this.$element = $(element);
            this.$thead = this.$element.find('thead');
            this.$tfoot = this.$element.find('tfoot');
            this.$footer = this.$element.find('tfoot th');
            this.$footerchildren = this.$footer.children().show().css('visibility', 'hidden');
            this.$topheader = this.$element.find('thead th');
            this.$searchcontrol = this.$element.find('.search');
            this.$filtercontrol = this.$element.find('.filter');
            this.$pagesize = this.$element.find('.grid-pagesize');
            this.$pageinput = this.$element.find('.grid-pager input');
            this.$pagedropdown = this.$element.find('.grid-pager .dropdown-menu');
            this.$prevpagebtn = this.$element.find('.grid-prevpage');
            this.$nextpagebtn = this.$element.find('.grid-nextpage');
            this.$pageslabel = this.$element.find('.grid-pages');
            this.$countlabel = this.$element.find('.grid-count');
            this.$startlabel = this.$element.find('.grid-start');
            this.$endlabel = this.$element.find('.grid-end');

            this.$tbody = $('<tbody>').insertAfter(this.$thead);
            this.$colheader = $('<tr>').appendTo(this.$thead);

            this.options = $.extend(true, {}, $.fn.datagrid.defaults, options);

            if(this.$pagesize.hasClass('select')) {
                this.options.dataOptions.pageSize = parseInt(this.$pagesize.select('selectedItem').value, 10);
            } else {
                this.options.dataOptions.pageSize = parseInt(this.$pagesize.val(), 10);
            }

            this.columns = this.options.dataSource.columns();

            this.$nextpagebtn.on('click', $.proxy(this.next, this));
            this.$prevpagebtn.on('click', $.proxy(this.previous, this));
            this.$searchcontrol.on('searched cleared', $.proxy(this.searchChanged, this));
            this.$filtercontrol.on('changed', $.proxy(this.filterChanged, this));
            this.$colheader.on('click', 'th', $.proxy(this.headerClicked, this));

            if(this.$pagesize.hasClass('select')) {
                this.$pagesize.on('changed', $.proxy(this.pagesizeChanged, this));
            } else {
                this.$pagesize.on('change', $.proxy(this.pagesizeChanged, this));
            }

            this.$pageinput.on('change', $.proxy(this.pageChanged, this));

            this.renderColumns();

            if (this.options.stretchHeight) this.initStretchHeight();

            this.renderData();
        };

        Datagrid.prototype = {

            constructor: Datagrid,

            renderColumns() {
                var self = this;

                this.$footer.attr('colspan', this.columns.length);
                this.$topheader.attr('colspan', this.columns.length);

                var colHTML = '';

                $.each(this.columns, (index, column) => {
                    colHTML += '<th data-property="' + column.property + '"';
                    if (column.sortable) colHTML += ' class="sortable"';
                    colHTML += '>' + column.label + '</th>';
                });

                self.$colheader.append(colHTML);
            },

            updateColumns($target, direction) {
                var className = (direction === 'asc') ? 'icon-chevron-up' : 'icon-chevron-down';
                this.$colheader.find('i').remove();
                this.$colheader.find('th').removeClass('sorted');
                $('<i>').addClass(className).appendTo($target);
                $target.addClass('sorted');
            },

            updatePageDropdown(data) {
                var pageHTML = '';

                for (var i = 1; i <= data.pages; i++) {
                    pageHTML += '<li><a>' + i + '</a></li>';
                }

                this.$pagedropdown.html(pageHTML);
            },

            updatePageButtons(data) {
                if (data.page === 1) {
                    this.$prevpagebtn.attr('disabled', 'disabled');
                } else {
                    this.$prevpagebtn.removeAttr('disabled');
                }

                if (data.page === data.pages) {
                    this.$nextpagebtn.attr('disabled', 'disabled');
                } else {
                    this.$nextpagebtn.removeAttr('disabled');
                }
            },

            renderData() {
                var self = this;

                this.$tbody.html(this.placeholderRowHTML(this.options.loadingHTML));

                this.options.dataSource.data(this.options.dataOptions, data => {
                    var itemdesc = (data.count === 1) ? self.options.itemText : self.options.itemsText;
                    var rowHTML = '';

                    self.$footerchildren.css('visibility', () => (data.count > 0) ? 'visible' : 'hidden');

                    self.$pageinput.val(data.page);
                    self.$pageslabel.text(data.pages);
                    self.$countlabel.text(data.count + ' ' + itemdesc);
                    self.$startlabel.text(data.start);
                    self.$endlabel.text(data.end);

                    self.updatePageDropdown(data);
                    self.updatePageButtons(data);

                    $.each(data.data, (index, row) => {
                        rowHTML += '<tr>';
                        $.each(self.columns, (index, column) => {
                            rowHTML += '<td>' + row[column.property] + '</td>';
                        });
                        rowHTML += '</tr>';
                    });

                    if (!rowHTML) rowHTML = self.placeholderRowHTML('0 ' + self.options.itemsText);

                    self.$tbody.html(rowHTML);
                    self.stretchHeight();

                    self.$element.trigger('loaded');
                });

            },

            placeholderRowHTML(content) {
                return '<tr><td style="text-align:center;padding:20px;border-bottom:none;" colspan="' +
                    this.columns.length + '">' + content + '</td></tr>';
            },

            headerClicked(e) {
                var $target = $(e.target);
                if (!$target.hasClass('sortable')) return;

                var direction = this.options.dataOptions.sortDirection;
                var sort = this.options.dataOptions.sortProperty;
                var property = $target.data('property');

                if (sort === property) {
                    this.options.dataOptions.sortDirection = (direction === 'asc') ? 'desc' : 'asc';
                } else {
                    this.options.dataOptions.sortDirection = 'asc';
                    this.options.dataOptions.sortProperty = property;
                }

                this.options.dataOptions.pageIndex = 0;
                this.updateColumns($target, this.options.dataOptions.sortDirection);
                this.renderData();
            },

            pagesizeChanged(e, pageSize) {
                if(pageSize) {
                    this.options.dataOptions.pageSize = parseInt(pageSize.value, 10);
                } else {
                    this.options.dataOptions.pageSize = parseInt($(e.target).val(), 10);
                }

                this.options.dataOptions.pageIndex = 0;
                this.renderData();
            },

            pageChanged(e) {
                this.options.dataOptions.pageIndex = parseInt($(e.target).val(), 10) - 1;
                this.renderData();
            },

            searchChanged(e, search) {
                this.options.dataOptions.search = search;
                this.options.dataOptions.pageIndex = 0;
                this.renderData();
            },

            filterChanged(e, filter) {
                this.options.dataOptions.filter = filter;
                this.renderData();
            },

            previous() {
                this.options.dataOptions.pageIndex--;
                this.renderData();
            },

            next() {
                this.options.dataOptions.pageIndex++;
                this.renderData();
            },

            reload() {
                this.options.dataOptions.pageIndex = 0;
                this.renderData();
            },

            initStretchHeight() {
                this.$gridContainer = this.$element.parent();

                this.$element.wrap('<div class="datagrid-stretch-wrapper">');
                this.$stretchWrapper = this.$element.parent();

                this.$headerTable = $('<table>').attr('class', this.$element.attr('class'));
                this.$footerTable = this.$headerTable.clone();

                this.$headerTable.prependTo(this.$gridContainer).addClass('datagrid-stretch-header');
                this.$thead.detach().appendTo(this.$headerTable);

                this.$sizingHeader = this.$thead.clone();
                this.$sizingHeader.find('tr:first').remove();

                this.$footerTable.appendTo(this.$gridContainer).addClass('datagrid-stretch-footer');
                this.$tfoot.detach().appendTo(this.$footerTable);
            },

            stretchHeight() {
                if (!this.$gridContainer) return;

                this.setColumnWidths();

                var targetHeight = this.$gridContainer.height();
                var headerHeight = this.$headerTable.outerHeight();
                var footerHeight = this.$footerTable.outerHeight();
                var overhead = headerHeight + footerHeight;

                this.$stretchWrapper.height(targetHeight - overhead);
            },

            setColumnWidths() {
                if (!this.$sizingHeader) return;

                this.$element.prepend(this.$sizingHeader);

                var $sizingCells = this.$sizingHeader.find('th');
                var columnCount = $sizingCells.length;

                function matchSizingCellWidth(i, el) {
                    if (i === columnCount - 1) return;
                    $(el).width($sizingCells.eq(i).width());
                }

                this.$colheader.find('th').each(matchSizingCellWidth);
                this.$tbody.find('tr:first > td').each(matchSizingCellWidth);

                this.$sizingHeader.detach();
            }
        };


        // DATAGRID PLUGIN DEFINITION

        $.fn.datagrid = function (option) {
            return this.each(function () {
                var $this = $(this);
                var data = $this.data('datagrid');
                var options = typeof option === 'object' && option;

                if (!data) $this.data('datagrid', (data = new Datagrid(this, options)));
                if (typeof option === 'string') data[option]();
            });
        };

        $.fn.datagrid.defaults = {
            dataOptions: { pageIndex: 0, pageSize: 10 },
            loadingHTML: '<div class="progress progress-striped active" style="width:50%;margin:auto;"><div class="bar" style="width:100%;"></div></div>',
            itemsText: 'items',
            itemText: 'item'
        };

        $.fn.datagrid.Constructor = Datagrid;

    });

    /*
     * Fuel UX Pillbox
     * https://github.com/ExactTarget/fuelux
     *
     * Copyright (c) 2012 ExactTarget
     * Licensed under the MIT license.
     */

    define('fuelux/pillbox',['require','jquery'],require => {
        
        var $ = require('jquery');


        // PILLBOX CONSTRUCTOR AND PROTOTYPE

        var Pillbox = function (element, options) {
            this.$element = $(element);
            this.options = $.extend({}, $.fn.pillbox.defaults, options);
            this.$element.on('click', 'li', $.proxy(this.itemclicked, this));
        };

        Pillbox.prototype = {
            constructor: Pillbox,

            items() {
                return this.$element.find('li').map(function() {
                    var $this = $(this);
                    return $.extend({ text: $this.text() }, $this.data());
                }).get();
            },

            itemclicked(e) {
                $(e.currentTarget).remove();
                e.preventDefault();
            }
        };


        // PILLBOX PLUGIN DEFINITION

        $.fn.pillbox = function (option) {
            var methodReturn;

            var $set = this.each(function () {
                var $this = $(this);
                var data = $this.data('pillbox');
                var options = typeof option === 'object' && option;

                if (!data) $this.data('pillbox', (data = new Pillbox(this, options)));
                if (typeof option === 'string') methodReturn = data[option]();
            });

            return (methodReturn === undefined) ? $set : methodReturn;
        };

        $.fn.pillbox.defaults = {};

        $.fn.pillbox.Constructor = Pillbox;


        // PILLBOX DATA-API

        $(() => {
            $('body').on('mousedown.pillbox.data-api', '.pillbox', function (e) {
                var $this = $(this);
                if ($this.data('pillbox')) return;
                $this.pillbox($this.data());
            });
        });
        
    });


    /*
     * Fuel UX Radio
     * https://github.com/ExactTarget/fuelux
     *
     * Copyright (c) 2012 ExactTarget
     * Licensed under the MIT license.
     */

    define('fuelux/radio',['require','jquery'],require => {

        var $ = require('jquery');


        // RADIO CONSTRUCTOR AND PROTOTYPE

        var Radio = function (element, options) {
            this.$element = $(element);
            this.options = $.extend({}, $.fn.radio.defaults, options);

            // cache elements
            this.$label = this.$element.parent();
            this.$icon = this.$label.find('i');
            this.$radio = this.$label.find('input[type=radio]');
            this.groupName = this.$radio.attr('name');

            // set default state
            this.setState(this.$radio);

            // handle events
            this.$radio.on('change', $.proxy(this.itemchecked, this));
        };

        Radio.prototype = {

            constructor: Radio,

            setState($radio, resetGroupState) {
                var checked = $radio.is(':checked');
                var disabled = $radio.is(':disabled');

                // set state of radio
                if (checked === true) {
                    this.$icon.addClass('checked');
                }
                if (disabled === true) {
                    this.$icon.addClass('disabled');
                }
            },

            resetGroup() {
                // reset all radio buttons in group
                $('input[name=' + this.groupName + ']').next().removeClass('checked');
            },

            enable() {
                this.$radio.attr('disabled', false);
                this.$icon.removeClass('disabled');
            },

            disable() {
                this.$radio.attr('disabled', true);
                this.$icon.addClass('disabled');
            },

            itemchecked(e) {
                var radio = $(e.target);

                this.resetGroup();
                this.setState(radio);
            }
        };


        // RADIO PLUGIN DEFINITION

        $.fn.radio = function (option, value) {
            var methodReturn;

            var $set = this.each(function () {
                var $this = $(this);
                var data = $this.data('radio');
                var options = typeof option === 'object' && option;

                if (!data) $this.data('radio', (data = new Radio(this, options)));
                if (typeof option === 'string') methodReturn = data[option](value);
            });

            return (methodReturn === undefined) ? $set : methodReturn;
        };

        $.fn.radio.defaults = {};

        $.fn.radio.Constructor = Radio;


        // RADIO DATA-API

        $(() => {
            $(window).on('load', () => {
                //$('i.radio').each(function () {
                $('.radio-custom > input[type=radio]').each(function () {
                    var $this = $(this);
                    if ($this.data('radio')) return;
                    $this.radio($this.data());
                });
            });
        });

    });

    /*
     * Fuel UX Search
     * https://github.com/ExactTarget/fuelux
     *
     * Copyright (c) 2012 ExactTarget
     * Licensed under the MIT license.
     */

    define('fuelux/search',['require','jquery'],require => {

        var $ = require('jquery');


        // SEARCH CONSTRUCTOR AND PROTOTYPE

        var Search = function (element, options) {
            this.$element = $(element);
            this.options = $.extend({}, $.fn.search.defaults, options);

            this.$button = this.$element.find('button')
                .on('click', $.proxy(this.buttonclicked, this));

            this.$input = this.$element.find('input')
                .on('keydown', $.proxy(this.keypress, this))
                .on('keyup', $.proxy(this.keypressed, this));

            this.$icon = this.$element.find('i');
            this.activeSearch = '';
        };

        Search.prototype = {

            constructor: Search,

            search(searchText) {
                this.$icon.attr('class', 'icon-remove');
                this.activeSearch = searchText;
                this.$element.trigger('searched', searchText);
            },

            clear() {
                this.$icon.attr('class', 'icon-search');
                this.activeSearch = '';
                this.$input.val('');
                this.$element.trigger('cleared');
            },

            action() {
                var val = this.$input.val();
                var inputEmptyOrUnchanged = val === '' || val === this.activeSearch;

                if (this.activeSearch && inputEmptyOrUnchanged) {
                    this.clear();
                } else if (val) {
                    this.search(val);
                }
            },

            buttonclicked(e) {
                e.preventDefault();
                if ($(e.currentTarget).is('.disabled, :disabled')) return;
                this.action();
            },

            keypress(e) {
                if (e.which === 13) {
                    e.preventDefault();
                }
            },

            keypressed(e) {
                var val;
                var inputPresentAndUnchanged;

                if (e.which === 13) {
                    e.preventDefault();
                    this.action();
                } else {
                    val = this.$input.val();
                    inputPresentAndUnchanged = val && (val === this.activeSearch);
                    this.$icon.attr('class', inputPresentAndUnchanged ? 'icon-remove' : 'icon-search');
                }
            },

            disable() {
                this.$input.attr('disabled', 'disabled');
                this.$button.addClass('disabled');
            },

            enable() {
                this.$input.removeAttr('disabled');
                this.$button.removeClass('disabled');
            }

        };


        // SEARCH PLUGIN DEFINITION

        $.fn.search = function (option) {
            return this.each(function () {
                var $this = $(this);
                var data = $this.data('search');
                var options = typeof option === 'object' && option;

                if (!data) $this.data('search', (data = new Search(this, options)));
                if (typeof option === 'string') data[option]();
            });
        };

        $.fn.search.defaults = {};

        $.fn.search.Constructor = Search;


        // SEARCH DATA-API

        $(() => {
            $('body').on('mousedown.search.data-api', '.search', function () {
                var $this = $(this);
                if ($this.data('search')) return;
                $this.search($this.data());
            });
        });

    });

    /*
     * Fuel UX Spinner
     * https://github.com/ExactTarget/fuelux
     *
     * Copyright (c) 2012 ExactTarget
     * Licensed under the MIT license.
     */

    define('fuelux/spinner',['require','jquery'],require => {

        var $ = require('jquery');


        // SPINNER CONSTRUCTOR AND PROTOTYPE

        var Spinner = function (element, options) {
            this.$element = $(element);
            this.options = $.extend({}, $.fn.spinner.defaults, options);
            this.$input = this.$element.find('.spinner-input');
            this.$element.on('keyup', this.$input, $.proxy(this.change, this));

            if (this.options.hold) {
                this.$element.on('mousedown', '.spinner-up', $.proxy(function() { this.startSpin(true); } , this));
                this.$element.on('mouseup', '.spinner-up, .spinner-down', $.proxy(this.stopSpin, this));
                this.$element.on('mouseout', '.spinner-up, .spinner-down', $.proxy(this.stopSpin, this));
                this.$element.on('mousedown', '.spinner-down', $.proxy(function() {this.startSpin(false);} , this));
            } else {
                this.$element.on('click', '.spinner-up', $.proxy(function() { this.step(true); } , this));
                this.$element.on('click', '.spinner-down', $.proxy(function() { this.step(false); }, this));
            }

            this.switches = {
                count: 1,
                enabled: true
            };

            if (this.options.speed === 'medium') {
                this.switches.speed = 300;
            } else if (this.options.speed === 'fast') {
                this.switches.speed = 100;
            } else {
                this.switches.speed = 500;
            }

            this.lastValue = null;

            this.render();

            if (this.options.disabled) {
                this.disable();
            }
        };

        Spinner.prototype = {
            constructor: Spinner,

            render() {
                this.$input.val(this.options.value);
                this.$input.attr('maxlength',(this.options.max + '').split('').length);
            },

            change() {
                var newVal = this.$input.val();

                if(newVal/1){
                    this.options.value = newVal/1;
                }else{
                    newVal = newVal.replace(/[^0-9]/g,'');
                    this.$input.val(newVal);
                    this.options.value = newVal/1;
                }

                this.triggerChangedEvent();
            },

            stopSpin() {
                clearTimeout(this.switches.timeout);
                this.switches.count = 1;
                this.triggerChangedEvent();
            },

            triggerChangedEvent() {
                var currentValue = this.value();
                if (currentValue === this.lastValue) return;

                this.lastValue = currentValue;

                // Primary changed event
                this.$element.trigger('changed', currentValue);

                // Undocumented, kept for backward compatibility
                this.$element.trigger('change');
            },

            startSpin(type) {

                if (!this.options.disabled) {
                    var divisor = this.switches.count;

                    if (divisor === 1) {
                        this.step(type);
                        divisor = 1;
                    } else if (divisor < 3){
                        divisor = 1.5;
                    } else if (divisor < 8){
                        divisor = 2.5;
                    } else {
                        divisor = 4;
                    }

                    this.switches.timeout = setTimeout($.proxy(function() {this.iterator(type);} ,this),this.switches.speed/divisor);
                    this.switches.count++;
                }
            },

            iterator(type) {
                this.step(type);
                this.startSpin(type);
            },

            step(dir) {
                var curValue = this.options.value;
                var limValue = dir ? this.options.max : this.options.min;

                if ((dir ? curValue < limValue : curValue > limValue)) {
                    var newVal = curValue + (dir ? 1 : -1) * this.options.step;

                    if (dir ? newVal > limValue : newVal < limValue) {
                        this.value(limValue);
                    } else {
                        this.value(newVal);
                    }
                }
            },

            value(value) {
                if (typeof value !== 'undefined') {
                    this.options.value = value;
                    this.$input.val(value);
                    return this;
                } else {
                    return this.options.value;
                }
            },

            disable() {
                this.options.disabled = true;
                this.$input.attr('disabled','');
                this.$element.find('button').addClass('disabled');
            },

            enable() {
                this.options.disabled = false;
                this.$input.removeAttr("disabled");
                this.$element.find('button').removeClass('disabled');
            }
        };


        // SPINNER PLUGIN DEFINITION

        $.fn.spinner = function (option,value) {
            var methodReturn;

            var $set = this.each(function () {
                var $this = $(this);
                var data = $this.data('spinner');
                var options = typeof option === 'object' && option;

                if (!data) $this.data('spinner', (data = new Spinner(this, options)));
                if (typeof option === 'string') methodReturn = data[option](value);
            });

            return (methodReturn === undefined) ? $set : methodReturn;
        };

        $.fn.spinner.defaults = {
            value: 1,
            min: 1,
            max: 999,
            step: 1,
            hold: true,
            speed: 'medium',
            disabled: false
        };

        $.fn.spinner.Constructor = Spinner;


        // SPINNER DATA-API

        $(() => {
            $('body').on('mousedown.spinner.data-api', '.spinner', function (e) {
                var $this = $(this);
                if ($this.data('spinner')) return;
                $this.spinner($this.data());
            });
        });

    });
    /*
     * Fuel UX Select
     * https://github.com/ExactTarget/fuelux
     *
     * Copyright (c) 2012 ExactTarget
     * Licensed under the MIT license.
     */

    define('fuelux/select',['require','jquery','./util'],require => {

        var $ = require('jquery');
        require('./util');

        // SELECT CONSTRUCTOR AND PROTOTYPE

        var Select = function (element, options) {
            this.$element = $(element);
            this.options = $.extend({}, $.fn.select.defaults, options);
            this.$element.on('click', 'a', $.proxy(this.itemclicked, this));
            this.$button = this.$element.find('.btn');
            this.$label = this.$element.find('.dropdown-label');
            this.setDefaultSelection();

            if (options.resize === 'auto') {
                this.resize();
            }
        };

        Select.prototype = {

            constructor: Select,

            itemclicked(e) {
                this.$selectedItem = $(e.target).parent();
                this.$label.text(this.$selectedItem.text());

                // pass object including text and any data-attributes
                // to onchange event
                var data = this.selectedItem();

                // trigger changed event
                this.$element.trigger('changed', data);

                e.preventDefault();
            },

            resize() {
                var el = $('#selectTextSize')[0];

                // create element if it doesn't exist
                // used to calculate the length of the longest string
                if(!el) {
                    $('<div/>').attr({id:'selectTextSize'}).appendTo('body');
                }

                var width = 0;
                var newWidth = 0;

                // iterate through each item to find longest string
                this.$element.find('a').each(function () {
                    var $this = $(this);
                    var txt = $this.text();
                    var $txtSize = $('#selectTextSize');
                    $txtSize.text(txt);
                    newWidth = $txtSize.outerWidth();
                    if(newWidth > width) {
                        width = newWidth;
                    }
                });

                this.$label.width(width);
            },

            selectedItem() {
                var txt = this.$selectedItem.text();
                return $.extend({ text: txt }, this.$selectedItem.data());
            },

            selectByText(text) {
                var selector = 'li a:fuelTextExactCI(' + text + ')';
                this.selectBySelector(selector);
            },

            selectByValue(value) {
                var selector = 'li[data-value=' + value + ']';
                this.selectBySelector(selector);
            },

            selectByIndex(index) {
                // zero-based index
                var selector = 'li:eq(' + index + ')';
                this.selectBySelector(selector);
            },

            selectBySelector(selector) {
                var item = this.$element.find(selector);

                this.$selectedItem = item;
                this.$label.text(this.$selectedItem.text());
            },

            setDefaultSelection() {
                var selector = 'li[data-selected=true]:first';
                var item = this.$element.find(selector);
                if(item.length === 0) {
                    // select first item
                    this.selectByIndex(0);
                }
                else {
                    // select by data-attribute
                    this.selectBySelector(selector);
                    item.removeData('selected');
                    item.removeAttr('data-selected');
                }
            },

            enable() {
                this.$button.removeClass('disabled');
            },

            disable() {
                this.$button.addClass('disabled');
            }

        };


        // SELECT PLUGIN DEFINITION

        $.fn.select = function (option,value) {
            var methodReturn;

            var $set = this.each(function () {
                var $this = $(this);
                var data = $this.data('select');
                var options = typeof option === 'object' && option;

                if (!data) $this.data('select', (data = new Select(this, options)));
                if (typeof option === 'string') methodReturn = data[option](value);
            });

            return (methodReturn === undefined) ? $set : methodReturn;
        };

        $.fn.select.defaults = {};

        $.fn.select.Constructor = Select;


        // SELECT DATA-API

        $(() => {

            $(window).on('load', () => {
                $('.select').each(function () {
                    var $this = $(this);
                    if ($this.data('select')) return;
                    $this.select($this.data());
                });
            });

            $('body').on('mousedown.select.data-api', '.select', function (e) {
                var $this = $(this);
                if ($this.data('select')) return;
                $this.select($this.data());
            });
        });

    });

    /*
     * Fuel UX Tree
     * https://github.com/ExactTarget/fuelux
     *
     * Copyright (c) 2012 ExactTarget
     * Licensed under the MIT license.
     */

    define('fuelux/tree',['require','jquery'],require => {

        var $ = require('jquery');


        // TREE CONSTRUCTOR AND PROTOTYPE

        var Tree = function (element, options) {
            this.$element = $(element);
            this.options = $.extend({}, $.fn.tree.defaults, options);

            this.$element.on('click', '.tree-item', $.proxy( function(ev) { this.selectItem(ev.currentTarget); } ,this));
            this.$element.on('click', '.tree-folder-header', $.proxy( function(ev) { this.selectFolder(ev.currentTarget); }, this));

            this.render();
        };

        Tree.prototype = {
            constructor: Tree,

            render() {
                this.populate(this.$element);
            },

            populate($el) {
                var self = this;
                var loader = $el.parent().find('.tree-loader:eq(0)');

                loader.show();
                this.options.dataSource.data($el.data(), items => {
                    loader.hide();

                    $.each( items.data, (index, value) => {
                        var $entity;

                        if(value.type === "folder") {
                            $entity = self.$element.find('.tree-folder:eq(0)').clone().show();
                            $entity.find('.tree-folder-name').html(value.name);
                            $entity.find('.tree-loader').html(self.options.loadingHTML);
                            $entity.find('.tree-folder-header').data(value);
                        } else if (value.type === "item") {
                            $entity = self.$element.find('.tree-item:eq(0)').clone().show();
                            $entity.find('.tree-item-name').html(value.name);
                            $entity.data(value);
                        }

                        if($el.hasClass('tree-folder-header')) {
                            $el.parent().find('.tree-folder-content:eq(0)').append($entity);
                        } else {
                            $el.append($entity);
                        }
                    });

                    self.$element.trigger('loaded');
                });
            },

            selectItem(el) {
                var $el = $(el);
                var $all = this.$element.find('.tree-selected');
                var data = [];

                if (this.options.multiSelect) {
                    $.each($all, (index, value) => {
                        var $val = $(value);
                        if($val[0] !== $el[0]) {
                            data.push( $(value).data() );
                        }
                    });
                } else if ($all[0] !== $el[0]) {
                    $all.removeClass('tree-selected')
                        .find('i').removeClass('icon-ok').addClass('tree-dot');
                    data.push($el.data());
                }

                if($el.hasClass('tree-selected')) {
                    $el.removeClass('tree-selected');
                    $el.find('i').removeClass('icon-ok').addClass('tree-dot');
                } else {
                    $el.addClass ('tree-selected');
                    $el.find('i').removeClass('tree-dot').addClass('icon-ok');
                    if (this.options.multiSelect) {
                        data.push( $el.data() );
                    }
                }

                if(data.length) {
                    this.$element.trigger('selected', {info: data});
                }

            },

            selectFolder(el) {
                var $el = $(el);
                var $par = $el.parent();

                if($el.find('.icon-folder-close').length) {
                    if ($par.find('.tree-folder-content').children().length) {
                        $par.find('.tree-folder-content:eq(0)').show();
                    } else {
                        this.populate( $el );
                    }

                    $par.find('.icon-folder-close:eq(0)')
                        .removeClass('icon-folder-close')
                        .addClass('icon-folder-open');

                    this.$element.trigger('opened', $el.data());
                } else {
                    if(this.options.cacheItems) {
                        $par.find('.tree-folder-content:eq(0)').hide();
                    } else {
                        $par.find('.tree-folder-content:eq(0)').empty();
                    }

                    $par.find('.icon-folder-open:eq(0)')
                        .removeClass('icon-folder-open')
                        .addClass('icon-folder-close');

                    this.$element.trigger('closed', $el.data());
                }
            },

            selectedItems() {
                var $sel = this.$element.find('.tree-selected');
                var data = [];

                $.each($sel, (index, value) => {
                    data.push($(value).data());
                });
                return data;
            }
        };


        // TREE PLUGIN DEFINITION

        $.fn.tree = function (option, value) {
            var methodReturn;

            var $set = this.each(function () {
                var $this = $(this);
                var data = $this.data('tree');
                var options = typeof option === 'object' && option;

                if (!data) $this.data('tree', (data = new Tree(this, options)));
                if (typeof option === 'string') methodReturn = data[option](value);
            });

            return (methodReturn === undefined) ? $set : methodReturn;
        };

        $.fn.tree.defaults = {
            multiSelect: false,
            loadingHTML: '<div>Loading...</div>',
            cacheItems: true
        };

        $.fn.tree.Constructor = Tree;

    });

    /*
     * Fuel UX Wizard
     * https://github.com/ExactTarget/fuelux
     *
     * Copyright (c) 2012 ExactTarget
     * Licensed under the MIT license.
     */

    define('fuelux/wizard',['require','jquery'],require => {

        var $ = require('jquery');


        // WIZARD CONSTRUCTOR AND PROTOTYPE

        var Wizard = function (element, options) {
            var kids;

            this.$element = $(element);
            this.options = $.extend({}, $.fn.wizard.defaults, options);
            this.currentStep = 1;
            this.numSteps = this.$element.find('li').length;
            this.$prevBtn = this.$element.find('button.btn-prev');
            this.$nextBtn = this.$element.find('button.btn-next');

            kids = this.$nextBtn.children().detach();
            this.nextText = $.trim(this.$nextBtn.text());
            this.$nextBtn.append(kids);

            // handle events
            this.$prevBtn.on('click', $.proxy(this.previous, this));
            this.$nextBtn.on('click', $.proxy(this.next, this));
            this.$element.on('click', 'li.complete', $.proxy(this.stepclicked, this));
        };

        Wizard.prototype = {

            constructor: Wizard,

            setState() {
                var canMovePrev = (this.currentStep > 1);
                var firstStep = (this.currentStep === 1);
                var lastStep = (this.currentStep === this.numSteps);

                // disable buttons based on current step
                this.$prevBtn.attr('disabled', (firstStep === true || canMovePrev === false));

                // change button text of last step, if specified
                var data = this.$nextBtn.data();
                if (data && data.last) {
                    this.lastText = data.last;
                    if (typeof this.lastText !== 'undefined') {
                        // replace text
                        var text = (lastStep !== true) ? this.nextText : this.lastText;
                        var kids = this.$nextBtn.children().detach();
                        this.$nextBtn.text(text).append(kids);
                    }
                }

                // reset classes for all steps
                var $steps = this.$element.find('li');
                $steps.removeClass('active').removeClass('complete');
                $steps.find('span.badge').removeClass('badge-info').removeClass('badge-success');

                // set class for all previous steps
                var prevSelector = 'li:lt(' + (this.currentStep - 1) + ')';
                var $prevSteps = this.$element.find(prevSelector);
                $prevSteps.addClass('complete');
                $prevSteps.find('span.badge').addClass('badge-success');

                // set class for current step
                var currentSelector = 'li:eq(' + (this.currentStep - 1) + ')';
                var $currentStep = this.$element.find(currentSelector);
                $currentStep.addClass('active');
                $currentStep.find('span.badge').addClass('badge-info');

                // set display of target element
                var target = $currentStep.data().target;
                $('.step-pane').removeClass('active');
                $(target).addClass('active');

                this.$element.trigger('changed');
            },

            stepclicked(e) {
                var li = $(e.currentTarget);

                var index = $('.steps li').index(li);

                var evt = $.Event('stepclick');
                this.$element.trigger(evt, {step: index + 1});
                if (evt.isDefaultPrevented()) return;

                this.currentStep = (index + 1);
                this.setState();
            },

            previous() {
                var canMovePrev = (this.currentStep > 1);
                if (canMovePrev) {
                    var e = $.Event('change');
                    this.$element.trigger(e, {step: this.currentStep, direction: 'previous'});
                    if (e.isDefaultPrevented()) return;

                    this.currentStep -= 1;
                    this.setState();
                }
            },

            next() {
                var canMoveNext = (this.currentStep + 1 <= this.numSteps);
                var lastStep = (this.currentStep === this.numSteps);

                if (canMoveNext) {
                    var e = $.Event('change');
                    this.$element.trigger(e, {step: this.currentStep, direction: 'next'});

                    if (e.isDefaultPrevented()) return;

                    this.currentStep += 1;
                    this.setState();
                }
                else if (lastStep) {
                    this.$element.trigger('finished');
                }
            },

            selectedItem(val) {
                return {
                    step: this.currentStep
                };
            }
        };


        // WIZARD PLUGIN DEFINITION

        $.fn.wizard = function (option, value) {
            var methodReturn;

            var $set = this.each(function () {
                var $this = $(this);
                var data = $this.data('wizard');
                var options = typeof option === 'object' && option;

                if (!data) $this.data('wizard', (data = new Wizard(this, options)));
                if (typeof option === 'string') methodReturn = data[option](value);
            });

            return (methodReturn === undefined) ? $set : methodReturn;
        };

        $.fn.wizard.defaults = {};

        $.fn.wizard.Constructor = Wizard;


        // WIZARD DATA-API

        $(() => {
            $('body').on('mousedown.wizard.data-api', '.wizard', function () {
                var $this = $(this);
                if ($this.data('wizard')) return;
                $this.wizard($this.data());
            });
        });

    });

    /*
     * Fuel UX
     * https://github.com/ExactTarget/fuelux
     *
     * Copyright (c) 2012 ExactTarget
     * Licensed under the MIT license.
     */

    define('fuelux/all',['require','jquery','bootstrap/bootstrap-affix','bootstrap/bootstrap-alert','bootstrap/bootstrap-button','bootstrap/bootstrap-carousel','bootstrap/bootstrap-collapse','bootstrap/bootstrap-dropdown','bootstrap/bootstrap-modal','bootstrap/bootstrap-popover','bootstrap/bootstrap-scrollspy','bootstrap/bootstrap-tab','bootstrap/bootstrap-tooltip','bootstrap/bootstrap-transition','bootstrap/bootstrap-typeahead','fuelux/checkbox','fuelux/combobox','fuelux/datagrid','fuelux/pillbox','fuelux/radio','fuelux/search','fuelux/spinner','fuelux/select','fuelux/tree','fuelux/wizard'],require => {
        require('jquery');
        require('bootstrap/bootstrap-affix');
        require('bootstrap/bootstrap-alert');
        require('bootstrap/bootstrap-button');
        require('bootstrap/bootstrap-carousel');
        require('bootstrap/bootstrap-collapse');
        require('bootstrap/bootstrap-dropdown');
        require('bootstrap/bootstrap-modal');
        require('bootstrap/bootstrap-popover');
        require('bootstrap/bootstrap-scrollspy');
        require('bootstrap/bootstrap-tab');
        require('bootstrap/bootstrap-tooltip');
        require('bootstrap/bootstrap-transition');
        require('bootstrap/bootstrap-typeahead');
        require('fuelux/checkbox');
        require('fuelux/combobox');
        require('fuelux/datagrid');
        require('fuelux/pillbox');
        require('fuelux/radio');
        require('fuelux/search');
        require('fuelux/spinner');
        require('fuelux/select');
        require('fuelux/tree');
        require('fuelux/wizard');
    });

    /*
     * Fuel UX
     * https://github.com/ExactTarget/fuelux
     *
     * Copyright (c) 2012 ExactTarget
     * Licensed under the MIT license.
     */

    define('jquery', [], () => jQuery);

    define('fuelux/loader', ['fuelux/all'], () => {});

    require('fuelux/loader');
}());