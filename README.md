grunt-init-exacttarget-hub-app
==============================

Create an Node.js-based ExactTarget Hub App, configured to run in Stackato

NOTE
==========

Fuel Throttle and this associated scaffolding tool are still in Alpha development. Use at your own risk.

HOW TO USE
==========
- `npm install -g grunt grunt-cli grunt-init`
- `git clone git@github.et.local:Platform/Fuel-Throttle-Grunt-Init.git ~/.grunt-init/et-hub-app`
- Test that the template is available: `grunt-init --help` (look in the templates section)
- `mkdir <path/to/your/apps/><yourNewAppName>`
- `cd <path/to/your/apps/yourNewAppName>`
- `git init` // initialize git in the directory
- `grunt-init et-hub-app`
- Answer questions, and start coding your app! (or follow directions for running your app in: http://github.et.local/Platform/Fuel-Throttle-Node)
<br />
<br />
**Optional Quick Start Instructions**
- `npm install` --> Install all dependencies
- `grunt build` --> Package the code for PaaS deployment (or running locally in optimized mode)
