/*define( [
	"qvangular",
	"translator"
],
function(
	qvangular,
	translator
){
	*/
import qvangular from "qvangular";
import translator from "translator";

let tooltip = {
	openTimer: null,
	closeTimer: null,
	inactivateTimer: null,
	current: {},
	active: false
};

function showTooltip( d, el ) {
	let isRadial = tooltip.current.isRadial,
		showSelf = tooltip.current.showSelfValue;
	if ( !d ) {
		d = tooltip.current.d;
		el = tooltip.current.el;
	}

	if ( el.querySelector ) {
		el = el.querySelector( "circle" );
	}

	let rect = el.getBoundingClientRect(),
		rows = [{ label: d.measures[0], value: d.values[0].qText }],
		directions = isRadial && ( d.x < 90 || d.x > 270 ) ? ["bottom", "top", "left", "right"] : ["top", "bottom", "left", "right"],
		positions = directions.map( function( dir ){
			switch ( dir ) {
				case "top":
					return { x: rect.left + rect.width / 2, y: rect.top };
				case "bottom":
					return { x: rect.left + rect.width / 2, y: rect.bottom };
				case "left":
					return { x: rect.left, y: rect.top + rect.height / 2 };
				case "right":
					return { x: rect.right, y: rect.top + rect.height / 2 };
				default:
					return "top";
			}
		} );

	if ( showSelf && d.selfNode ) {
		rows.push( { label: d.measures[0] + " " + translator.get( "mek.includingDescendants" ), value: d.values[0].qText } );
		rows[0].value = d.selfNode.values[0].qText;
	}

	qvangular.getService( "qvChartTooltipService" ).open( {
		content: [{
					  header: d.name,
					  rows: rows
				  }],
		position: positions,
		direction: directions
	} );
}

function activateTooltip() {

	qvangular.getService( "$timeout" ).cancel( tooltip.inactivateTimer );

	if ( !tooltip.active && !tooltip.openTimer ) {
		tooltip.openTimer = qvangular.getService( "$timeout" )( function() {
			tooltip.active = true;
			tooltip.openTimer = null;
			showTooltip();
		}, 1000 );
	}
	else if ( tooltip.active ) {
		qvangular.getService( "$timeout" )( function() {
			showTooltip();
		} );
	}
}

function inactivateTooltip() {

	qvangular.getService( "$timeout" ).cancel( tooltip.openTimer );
	tooltip.openTimer = null;

	qvangular.getService( "$timeout" )( function() {
		qvangular.getService( "qvChartTooltipService" ).close();

		tooltip.inactivateTimer = qvangular.getService( "$timeout" )( function() {
			tooltip.active = false;
		}, 2000 );
	}, 0 );
}

export default {
	current: tooltip.current,
	activate: activateTooltip,
	inactivate: inactivateTooltip
};
