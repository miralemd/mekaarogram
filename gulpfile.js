var gulp = require( 'gulp' );
var eslint = require( 'gulp-eslint' );
var sass = require( 'gulp-sass' );
var changed = require( 'gulp-changed' );
var uglify = require( 'gulp-uglify' );

var qdir = (process.env[(process.platform == 'win32') ? 'USERPROFILE' : 'HOME'] ) + "\\Documents\\Qlik\\Sense\\Extensions\\dendrogram";

gulp.task( 'default', function () {
	// task
} );

gulp.task( 'lint', function () {
	return gulp.src( ['./src/*.js', './src/js/*.js', '!./src/js/external/*.js'] )
		.pipe( eslint() )
		.pipe( eslint.format() );
	//.pipe( eslint.failOnError() );
} );

gulp.task( 'sass', function () {
	return gulp.src( './src/css/*.scss' )
		.pipe( sass().on( 'error', sass.logError ) )
		.pipe( gulp.dest( "./src/css" ) );
} );

gulp.task( 'copy', function () {
	return gulp.src( ['./src/**/*.*', '!./src/**/*.scss'] )
		.pipe( changed( qdir ) )
		.pipe( gulp.dest( qdir ) );
} );

gulp.task( 'compress', function() {
	return gulp.src( ['./src/**/*.js', '!./src/js/external/*.js'])
		.pipe( uglify() )
		.pipe( gulp.dest( qdir ) );
} );

gulp.task( 'watch', function () {
	gulp.watch( ['./src/**/*.*'], ['lint', 'sass', 'copy'] );
} );

gulp.task( 'build', ['lint', 'sass', 'copy', 'compress'] );