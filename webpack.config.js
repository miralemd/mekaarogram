/*eslint-env node*/
/*eslint-disable*/

var path = require( "path" );
var os = require( "os" );
var cpy = require( "cpy" );
var watch = require( "watch" );
var yargs = require( "yargs" );
var WebPackOnBuild = require( "on-build-webpack" );

var name = "mek-dendogram";
var qname = name;
var qnamejs = qname + ".js";
var srcDir = path.resolve( __dirname, "src" );
var entry = path.resolve( srcDir, qnamejs );
var output = path.resolve( __dirname, "dist" );

var qdirpath = [os.homedir(), "Qlik", "Sense", "Extensions", qname];
if( os.platform() === "win32" ) {
       	qdirpath.splice( 1, 0, "Documents" );
}
var qdir = path.resolve.apply( path, qdirpath );

var isWatching = yargs.argv.watch;

function onBuild() {
 	cpy( [qname + ".qext", "external/*.*", "assets/*.*", "css/*.ttf"], output, {
 		cwd: srcDir,
    parents: true
 	} ).then( function() {
		cpy( ["./**/*.*"], qdir, {
			cwd: output,
			parents: true
		} );
	} );
}

if( false ) {
  console.log( "is watching" );
       	watch.watchTree( "./node_modules/@qlik/picasso/dist/", function( fn ) {
    console.log( "detected" );
       		onBuild();
       	} );
}

var config = {
       	entry: entry,
       	output: {
       		path: output,
       		filename: qnamejs,
       		libraryTarget: "amd"
       	},
       	module: {
       		loaders: [{
       			test: /\.js$/,
       			loader: "babel-loader",
       			query: {
       				presets: ["es2015"]
       			}
       		},
          {
            test: /\.scss$/,
            loader: "css-loader?-url!sass-loader"
          },
          {
            test: /\.html$/,
            loader: "html-loader"
          }]
       	},
       	externals: [
       		{
       			"default-view": "objects.extension/default-view",
            "translator": "translator",
            "object-conversion": "objects.extension/object-conversion",
            "components": "client.property-panel/components/components",
            "pivot-api": "objects.backend-api/pivot-api",
            "require": "require",
            "qvangular": "qvangular",
            "jquery": "jquery",
            "color": "general.utils/color",
            "default-view": "objects.extension/default-view",
            "selection-toolbar": "objects.extension/default-selection-toolbar",
            "event-utils": "objects.utils/event-utils",
            "state": "client.utils/state",
            "tooltip-service": "objects.views/charts/tooltip/chart-tooltip-service",
            "touche": "touche",
            "d3": "./external/d3"
       		}
       	],
       	plugins: [
       		new WebPackOnBuild( onBuild )
       	]
};

module.exports = config;
