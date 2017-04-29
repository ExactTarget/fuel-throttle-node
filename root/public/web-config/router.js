define( require => {
    var Backbone = require( 'backbone' );
    var DashboardView = require( 'views/dashboard' );

    return Backbone.Router.extend({
        // Define some basic routes
        routes: {
            '': 'renderDashboard'
        },

        // Initialize the router
        initialize() {
            _.bindAll( this );
            
            // Assumes Google Analytics trackPageView will be called
            return this;
        },

        renderDashboard() {
            var dashboardView = new DashboardView();
        },

        // Google Analytics handler
        _trackPageview() {
            var url;
            url = Backbone.history.getFragment();
            return _gaq.push(['_trackPageview', "/" + url]);
        }
    });
});
