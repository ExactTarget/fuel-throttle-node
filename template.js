/*
 * grunt-init-exacttarget-hubapp
 * https://gruntjs.com/
 *
 * ORIGINAL AUTHOR
 * Copyright (c) 2012 "Cowboy" Ben Alman, contributors
 * Licensed under the MIT license.
 *
 * EXACTTARGET MODIFIED AUTHOR
 * "creatovisguru" Benjamin Dean, contributors
 */

'use strict';

// Basic template description.
exports.description = 'Create an ExactTarget Node.js-based HubApp, including Nodeunit unit tests.';

// Template-specific notes to be displayed before question prompts.
exports.notes = '_Project name_ shouldn\'t contain "node" or "js" and should ' +
  'be a unique ID not already in use at api.xexacttargetapps.com (Stackato).';

// Template-specific notes to be displayed after question prompts.
exports.after = 'You should now install project dependencies with _npm ' +
  'install_. After that, you may execute project tasks with _grunt_. For ' +
  'more information about installing and configuring Grunt, please see ' +
  'the Getting Started guide:' +
  '\n\n' +
  'https://fueldev.xexacttargetapps.com/hub-apps/getting-started';

// Any existing file or directory matching this wildcard will cause a warning.
exports.warnOn = '*';

// The actual init template.
exports.template = (grunt, init, done) => {

  init.process({type: 'et-hub-app'}, [
    // Prompt for these values.
    init.prompt('name'),
    init.prompt('title', 'Cool App Name'),
    init.prompt('description'),
    init.prompt('version'),
    init.prompt('repository'),
    init.prompt('homepage'),
    init.prompt('bugs'),
    {
        name: 'bug_email',
        message: 'Email address to use for group-wide bug reporting',
        default: 'noreply@exacttarget.com',
        warning: 'If no address is supplied, this will be unavailable in your app'
    },
    init.prompt('licenses'),
    init.prompt('author_name'),
    init.prompt('author_email'),
    init.prompt('author_url'),
    {
        name: 'google_analytic_code',
        message: 'Please enter your Google Analytics account code for this project',
        default: 'UA-XXXXX-Y',
        warning: 'If you enter nothing, the generic code will be used'
    },
    init.prompt('node_version', '>= 0.8.14'), // QA Stackato max as of 2013-04-07
    init.prompt('main', 'app'),
    {
        name: 'node_amd_enabled',
        message: 'Include AMD support for your project?',
        default: true,
        warning: 'Please see the documentation at http://github.et.local/Platform/Fuel-Throttle-Node for more information.'
    },
    {
        name: 'client_id',
        message: 'Please enter your app\'s client id from App Center',
        default: '',
        warning: 'Failure to do so will restrict functionality of this app'
    },
    {
        name: 'client_secret',
        message: 'Please enter your app\'s client secret from App Center',
        default: '',
        warning: 'Failure to do so will restrict functionality of this app'
    },
    {
        name: 'app_signature',
        message: 'Please enter your app\'s signature from App Center',
        default: '',
        warning: 'Failure to do so will restrict functionality of this app'
    },
    {
        name: 'app_id',
        message: 'Please enter your app\'s id from App Center',
        default: '',
        warning: ''
    }
  ], (err, props) => {
    props.keywords = [];
    props.dependencies = {
        "config": "0.4.20",
        "express": "3.0.0rc4",
        "fuel": "~0.2.1",
        "hbs": "~1.0.5",
        "http-proxy": "0.8.7",
        "jwt-simple": "0.1.0",
        "moment": "1.7.2",
        "mongoose": "3.6.4",
        "request": "2.12.0",
        "underscore": "1.4.3"
    };
    props.devDependencies = {
        "grunt": "~0.4.1",
        "grunt-contrib-clean": "~0.4.0",
        "grunt-contrib-concat": "~0.1.3",
        "grunt-contrib-handlebars": "~0.5.8",
        "grunt-contrib-jshint": "~0.3.0",
        "grunt-contrib-nodeunit": "~0.1.2",
        "grunt-contrib-requirejs": "~0.4.0",
        "grunt-contrib-uglify": "~0.2.0",
        "grunt-contrib-qunit": "~0.2.1",
        "grunt-mocha": "~0.3.0",
        "matchdep": "~0.1.1"
    };
    props.volo = {
        "baseDir": "public/vendor",
        "dependencies": {
          "backbone": "github:documentcloud/backbone/1.0.0",
          "fuelux": "github:ExactTarget/fuelux/2.3.0",
          "jquery": "github:jquery/jquery/1.9.1",
          "require": "github:jrburke/requirejs/2.1.5",
          "underscore": "github:documentcloud/underscore/1.4.4"
        }
    };

    console.log( props );
    // Custom property assignments go here
    props.travis_node_version = '0.10';
    // Need to validate these

    // Files to copy (and process). Exclusion logic goes here (based
    // on prompts from user, ie: backbone, etc...)
    var files = init.filesToCopy(props);
    if (!props.travis) { delete files['.travis.yml']; }

    // Add properly-named license files.
    init.addLicenseFiles(files, props.licenses);

    // Actually copy (and process) files.
    init.copyAndProcess(files, props);

    // TODO: Generate stackato.yml file.
    // TODO: Generate the Gruntfile.js
    // TODO: Generate a custom README.md for the project
    // TODO: Make sure all the files are processed

    // Generate package.json file.
    init.writePackageJSON('package.json', props, (pkg, props) => {
        var pkg = pkg || {};
        if( props.volo ) { pkg.volo = props.volo; }
        if( props.css_prefix ) { pkg.css_prefix = props.css_prefix; }
        if( props.app_display_name ) { pkg.app_display_name = props.app_display_name; }
        return pkg;
    });

    // All done!
    done();
  });

};
