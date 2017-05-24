import $ from "jquery";
import translator from "translator";
import objectConversion from "object-conversion";
import PivotApi from "pivot-api";

import Dendrogram from "./js/mekaarogram";
import properties from "./js/properties";
import locales from "./js/locales";

import style from "./css/style.scss";

translator.append( locales[translator.language] || locales["en-US"] );

$( "<style>" + style + "</style>" ).appendTo( "head" );

// set custom icon for dendro extension in assets panel
$( "<style>.assets-list li[title='Mekaarogram'] .icon-extension::before { content: '?'; }</style>" ).appendTo( "head" );

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
