var gulp = require( 'gulp' );
var eslint = require( 'gulp-eslint' );
var changed = require( 'gulp-changed' );

var qdir = (process.env[(process.platform == 'win32') ? 'USERPROFILE' : 'HOME'] ) + "\\Documents\\Qlik\\Sense\\Extensions\\dendrogram";

gulp.task( 'default', function () {
	// task
} );

gulp.task( 'lint', function () {
	return gulp.src( ['./src/*.js', '!./src/d3.js'] )
		.pipe( eslint() )
		.pipe( eslint.format() )
		.pipe( eslint.failOnError() );
} );

gulp.task( 'copy', function () {
	return gulp.src( 'src/*.*' )
		.pipe( changed( qdir ) )
		.pipe( gulp.dest( qdir ) );
} );

gulp.task( 'watch', function () {
	gulp.watch( 'src/*.*', ['lint', 'copy'] );
} );