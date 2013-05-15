requirejs.config({
    baseUrl: 'vendor',
    paths: {
        appConfig:  '../web-config',
        data:       '../data',
        fuelux:     './fuelux',
        templates:  '../templates',
        tmpl:       './tmpl',
        views:      '../views',
        router:     '../web-config/router'
    },
    deps: ['router', 'fuelux/all'],
    shim: {
        'backbone': {
            deps: ['jquery', 'underscore'],
            exports: 'Backbone'
        },
        'jquery': {
            exports: '$'
        },
        'moment': {
            deps: ['jquery']
        },
        'underscore': {
            exports: '_'
        }
    }
});

require(['jquery', 'underscore', 'backbone', 'router'], function( $, _, Backbone, Router ) {
    var router = new Router();
    Backbone.history.start();
});
