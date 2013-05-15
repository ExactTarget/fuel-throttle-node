Fuel Throttle
==============================
**Note:** Fuel Throttle is in Beta development. Use at your own risk.

Fuel Throttle is an acceleration project focused on helping developers do what they do best...WRITE APP CODE!

The primary use case for Fuel Throttle (Node) is centered around the following tech:

  - ExactTarget's HubApps (IMH, Interactive Marketing Hub)
  - Using the Stackato (Fuel Platform's PaaS) infrastructure
  - Node.js (Server-side JavaScript Event-driven engine)
  - Require.js (Well performing dependency management and code optimization tool)
  - Backbone.js (JavaScript library which loosly defines client-side MVC)

This tool will reduce your need to write boilerplate code.

> The overriding design goal for Fuel Throttle
> is to reduce the development cycles required to 
> get application code into the Fuel Platform ecosystem.

> The secondary goal of Fuel Throttle is to reduce the
> cost of admission for development of apps by resolving
> common issues.

Version
-

0.1.0

Technological Dependencies
-----------

Fuel Throttle (Node) integrates the following technologies for you:

* [Code@] - ExactTarget's Developer Community
* [Fuel API Family] - ExactTarget's RESTful based API ecosystem
* [App Center] - ExactTarget's Application Management Interface
* [Fuel UX] - The Fuel Platform control library built on Twitter's Bootstrap
* [Stackato] - ActiveState's PaaS implemented at ExactTarget
* [Twitter Bootstrap] - great UI boilerplate for modern web apps
* [node.js] - evented I/O for the backend
* [Express] - fast node.js network app framework [@tjholowaychuk]
* [Backbone.js] - Loosly defined client-side MVC structuring library
* [jQuery] - duh
* [Require.js] - JavaScript file/module loader and optimization tool
* [Grunt.js] - JavaScript task runner

System Requirements
--------------

Fuel Throttle has the following dependencies on your local system in order to operate properly:

 * (recommended) Git: [http://git-scm.com/downloads] [git]
 * Install node.js: [http://nodejs.org/download/] [Node.js download]
 * (recommended) Node Version Manager: [https://github.com/creationix/nvm] [nvm]
 * Install grunt: [http://gruntjs.com/] [Grunt.js]
 * [optional]Install grunt-init: [http://gruntjs.com/project-scaffolding] [grunt-init]
 * [Volo] (latest)
 * MongoDB: [http://docs.mongodb.org/manual/installation/] [MongoDB]
 * PhantomJS: [https://github.com/ExactTarget/fuelux/wiki/Installing-grunt-and-PhantomJS] [InstallGruntPhantom]
 * (recommended) Stackato Micro Cloud: [http://www.activestate.com/stackato/download_vm] [StackatoMC]
 * Install Stackato Client: [http://www.activestate.com/stackato/download_client] [StackatoClient]
* System Accounts:
 * QA Stackato account, please email [stackato@exacttarget.com] [stackatoAlias]
 * (recommended) New Relic account [http://newrelic.com/] for application monitoring [NewRelic]
 * (recommended if public repo on Github.com) Travis CI account [https://travis-ci.org/] [TravisCI]

HOW TO USE
==========
- `npm install -g grunt grunt-cli grunt-init`
- `mkdir ~/.grunt-init`
- `git clone git@github.com:ExactTarget/fuel-throttle-grunt-init.git ~/.grunt-init/et-hub-app`
- Test that the template is available: `grunt-init --help` (look in the templates section you should see et-hub-app)
- `mkdir <path/to/your/apps/><yourNewAppName>` (directory name will be the name of the new app by default, but can be changed)
- `cd <path/to/your/apps/yourNewAppName>`
- `git init` // initialize git in the directory
- `grunt-init et-hub-app`
- Answer questions, and start coding your app! (or follow directions for running your app in: http://github.et.local/Platform/Fuel-Throttle-Node)
<br />
<br />
**Optional Quick Start Instructions**
- `npm install` --> Install all dependencies
- `grunt build` --> Package the code for PaaS deployment (or running locally in optimized mode)
- `node <server/app.js>` -- Start your app


## Running Locally
* Run the app in non-optimized (non-minified/uglified) mode

    $ node app
* To run the app locally in optimized mode, use an editor and open: /config/default.js file

    change "endpoints.uiBaseDir" value to "optimized"<br />
    write, close /config.default.js<br />
    $ node app

##Running on Stackato Micro Cloud
* Make sure you've installed the Stackato Micro Cloud and the Stackato client
* Start the Stackato Micro Cloud VM
* Make sure you're targeting the correct Stackato environment (our Micro Cloud URL)
*   stackato login
*   stackato push (from within the app's directory)
*   Answer prompts from Stackato where applicable
*   Visit your app's new URL in a browser

##Testing
Tests are ran automatically when using grunt-build, grunt-package commands. To test ONLY, use grunt test at the prompt.
> While grunt can run the included unit tests via PhantomJS, this isn't a substitute for the real thing. Please be sure to test the tests/*.html unit test file(s) in real browsers as well.<br />
> [More about Installing grunt and PhantomJS] [installGruntPhantom]

Project Roadmap
--------------
Fuel Throttle goals will be outlined in the project's [milestones] on Github.

Known Issues
--------------
There are several known issues as this is an organic project, please check the [issue list] for a complete current state of the project.

Contributing to Fuel Throttle
--------------
Contributions are welcomed, to contribute to Fuel Throttle:

1. Before writing code, we suggest you [search for issues](https://github.com/creatovisguru/NodeShellApp/issues?state=open) or [create a new one](https://github.com/creatovisguru/NodeShellApp/issues/new) to confirm where your contribution fits into our roadmap. 
1. Fork the Fuel Throttle repo [GitHub help](https://help.github.com/articles/fork-a-repo)
1. Make your changes, being sure to add unit tests for new or changed functionality
1. Run `grunt package` to lint, test, and package up the library
1. Update your fork with the latest code from Fuel Throttle, merging as necessary
1. Commit your changes (using `git commit --amend` to the original as you progress)
1. Push to your GitHub repo, using --force if you have rebased
1. Submit a pull request [GitHub help](https://help.github.com/articles/using-pull-requests)


License
-

MIT

*Free Software, Currently only recommended for internal ExactTarget usage!*

  [@adamalex]: http://twitter.com/adamalex
  [@creatovisguru]: http://twitter.com/bdeanindy
  [@jschmidtatet]: http://twitter.com/zannalov
  [node.js]: http://nodejs.org
  [Node.js]: http://nodejs.org
  [Node.js download]: http://nodejs.org/download/
  [nvm]: https://github.com/creationix/nvm
  [Twitter Bootstrap]: http://twitter.github.com/bootstrap/
  [keymaster.js]: https://github.com/madrobby/keymaster
  [jQuery]: http://jquery.com  
  [@tjholowaychuk]: http://twitter.com/tjholowaychuk
  [express]: http://expressjs.com
  [App Center]: https://code.exacttarget.com/appcenter
  [Fuel UX]: https://code.exacttarget.com/devcenter/fuel-ux
  [Stackato]: http://www.activestate.com/stackato
  [Fuel API Family]: https://code.exacttarget.com/devcenter/fuel-api-family
  [Code@]: https://code.exacttarget.com/
  [Backbone.js]: http://backbonejs.org/
  [Require.js]: http://requirejs.org/
  [git]: http://git-scm.com/downloads
  [Grunt.js]: http://gruntjs.com/
  [Grunt-init]: http://gruntjs.com/project-scaffolding
  [Github]: http://github.com
  [Volo]: https://github.com/volojs/volo
  [issue list]: https://github.com/creatovisguru/NodeShellApp/issues
  [milestones]: https://github.com/creatovisguru/NodeShellApp/issues/milestones
  [MongoDB]: http://docs.mongodb.org/manual/installation/
  [NewRelic]: http://newrelic.com/
  [InstallGruntPhantom]: https://github.com/ExactTarget/fuelux/wiki/Installing-grunt-and-PhantomJS
  [StackatoMC]: http://www.activestate.com/stackato/download_vm
  [StackatoClient]: http://www.activestate.com/stackato/download_client
  [stackatoAlias]: mailto:stackato@exacttarget.com
  [TravisCI]: https://travis-ci.org/
