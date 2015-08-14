var gulp = require('gulp');
var eslint = require('gulp-eslint');

var qdir = (process.env.HOME || process.env.USERPROFILE ) + "\\Documents\\Qlik\\Sense\\Extensions\\dendrogram";

gulp.task('default', function() {
	// task
	console.log( qdir );
});

gulp.task('lint', function() {
	return gulp.src(['./src/*.js', '!./src/d3.js'] )
		.pipe(eslint())
		.pipe(eslint.format() )
		.pipe(eslint.failOnError());
});

gulp.task('copy', function() {
	return gulp.src('src/*.*')
		.pipe( gulp.dest(qdir) );
});

gulp.task('watch', function() {
	gulp.watch('src/*.*', ['lint','copy']);
});