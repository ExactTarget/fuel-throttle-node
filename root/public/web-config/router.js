define( function( require ) {
    var Backbone = require( 'backbone' );
    var DashboardView = require( 'views/dashboard' );

    return Backbone.Router.extend({
        // Define some basic routes
        routes: {
            '': 'renderDashboard'
        },

        // Initialize the router
        initialize: function() {
            _.bindAll( this );
            
            // Assumes Google Analytics trackPageView will be called
            return this;
        },

        renderDashboard: function(){
            var dashboardView = new DashboardView();
        },

        // Google Analytics handler
        _trackPageview: function() {
            var url;
            url = Backbone.history.getFragment();
            return _gaq.push(['_trackPageview', "/" + url]);
        }
    });
});
