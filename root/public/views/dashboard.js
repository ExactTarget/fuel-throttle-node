define( require => {
    var Backbone = require( 'backbone' );
    var Config = require( 'config' );
    var dashboardTemplate = require( 'tmpl!templates/dashboard.html' );

    return Backbone.View.extend({
        initialize() {
            _.bindAll( this );

            // TODO: Example bind loading of collection fetch success to this view's render
            this.el = $('#{%=name%}-DashboardMain');
            this.render();
        },

        clean() {
        },

        render() {
            $('#{%=name%}-Loading').remove();

            var templateObj = {
                appDisplayName: '{%=title%}',
                mainMarketingMessage: 'Super Cool Marketing Message!'
            };

            $(this.el).html( dashboardTemplate( templateObj ) );
        }
    });
});
