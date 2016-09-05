/*
define( [
	'jquery',
	'translator',
	'objects.extension/object-conversion',
	'client.property-panel/components/components',
	'objects.backend-api/pivot-api',
	'require',

	'./js/mekaarogram',
	'./js/properties',
	'./js/locales',
	'text!./css/style.css'
],
function(
	$,
	translator,
	objectConversion,
	components,
	PivotApi,
	require,

	Dendrogram,
	properties,
	locales,
	style
) {
*/

import $ from "jquery";
import translator from "translator";
import objectConversion from "object-conversion";
import components from "components";
import PivotApi from "pivot-api";
import require from "require";

import Dendrogram from "./js/mekaarogram";
import properties from "./js/properties";
import locales from "./js/locales";

import style from "./css/style.scss";
//let style = "";

translator.append( locales[translator.language] || locales["en-US"] );

$( "<style>" + style + "</style>" ).appendTo( "head" );

// set custom icon for dendro extension in assets panel
$( "<style>.assets-list li[title='Mekaarogram'] .icon-extension::before { content: '?'; }</style>" ).appendTo( "head" );

// load existing client module
// will throw error outside of client-build since the component is not included in such builds
require( ["extensions.qliktech/pivot-table/properties/pivot-sorting/pivot-sorting"], function( pivotSorting ) {
	if ( !components.hasComponent( "pivot-sorting" ) ) {
		components.addComponent( "pivot-sorting", pivotSorting );
	}
}, function() {} );

export default {
	definition: properties,
	initialProperties: {
		version: 1.0,
		qHyperCubeDef: {
			qMode: "P",
			qIndentMode: true,
			qSuppressMissing: true,
			qShowTotalsAbove: true,
			qDimensions: [],
			qMeasures: [],
			qInitialDataFetch: [{
				qWidth: 1,
				qHeight: 10000
			}]
		}
	},
	snapshot: {
		canTakeSnapshot: true
	},
	data: {
		dimensions: {
			min: 1,
			max: 10
		},
		measures: {
			min: 1,
			max: 1
		}
	},
	View: Dendrogram,
	BackendApi: PivotApi,
	importProperties: function ( exportedFmt, initialProperties, definition ) {
		let propTree = objectConversion.hypercube.importProperties( exportedFmt, initialProperties, definition ),
			props = propTree.qProperty;

		props.qHyperCubeDef.qShowTotalsAbove = true;
		props.qHyperCubeDef.qNoOfLeftDims = -1;
		return propTree;
	}
};
