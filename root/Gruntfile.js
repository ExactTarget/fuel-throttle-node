'use strict';

var path = require( 'path' );

module.exports = function( grunt ) {
    // load all grunt tasks
    require('matchdep').filterDev('grunt-*').forEach(grunt.loadNpmTasks);

    // Configuration
    var appPathsConfig = {
        src: '',
        dist: 'optimized',
        client: 'public',
        clientConfig: 'public/web-config',
        tests: 'tests'
    };

    grunt.initConfig({
        pkg: grunt.file.readJSON( 'package.json' ),
        pathConfig: appPathsConfig,
        jshint: {
            options: {
                jshintrc: '.jshintrc'
            },
            all_files: [
                'Gruntfile.js',
                '<%= pathConfig.src %>app.js',
                '<%= pathConfig.src %>lib/**/*.js',
                '<%= pathConfig.src %>config/**/*.js',
                '<%= pathConfig.client %>/views/**/*.js',
                '<%= pathConfig.client %>/data/**/*.js'
            ]
        },
        qunit: {
            files: ['tests/**/*.html']
        },
        requirejs: {
            compile: {
                options: {
                    appDir: '<%= pathConfig.client %>/',
                    baseUrl: 'vendor',
                    dir: '<%= pathConfig.dist %>/',
                    optimize: 'uglify2',
                    optimizeCss: 'standard.keepLines',
                    mainConfigFile: '<%= pathConfig.clientConfig %>/main.js',
                    generateSourceMaps: true,
                    preserveLicenseComments: false,
                    paths: {
                        config: 'empty:',
                        router: '../web-config/router'
                    },
                    modules: [
                        { name: '../web-config/main' }
                    ],
                    nodeRequire: require
                }
            }
        },
        recess: {
            compile: {
                src: ['<%= pathConfig.client %>/less/styles.less'],
                dest: '<%= pathConfig.client %>/css/styles.css',
                options: {
                    compile: true
                }
            },
            compress: {
                src: ['<%= pathConfig.client %>/less/styles.less'],
                dest: '<%= pathConfig.dist %>/<%= pkg.version %>/css/styles.css',
                options: {
                    compile: true,
                    compress: true
                }
            }
        },
        nodeunit: {
            tests: ['nodetests/*_test.js']
        },
        clean: {
            dist: ['.tmp', '<%= pathConfig.dist %>/<%= pkg.version %>*'],
            server: '.tmp'
        }
    });

    // Register tasks
    grunt.registerTask( 'default', [
        'jshint',
        'test',
        'build'
    ]);

    grunt.registerTask('build', [
        'test',
        'requirejs'
    ]);


    grunt.registerTask( 'test', [
        'clean',
        'jshint',
        'qunit',
        'nodeunit'
    ]);

    grunt.registerTask( 'package', [
        'build'
    ]);

    grunt.registerTask( 'cleanDist', ['clean:dist'] );

    grunt.registerTask( 'clientSideTests', [
        'clean:server',
        'jshint',
        'qunit'
    ]);

    grunt.registerTask( 'serverSideTests', [
        'jshint',
        'nodeunit'
    ]);

    // Debug task, don't warn about console statements
    grunt.registerTask( 'development', 'Development Task', function() {
        grunt.config( 'jshint.options.devel', true );
        grunt.config( 'requirejs.compile.options.optimize', 'none' );
        grunt.task.run( 'default' );
    });
};
