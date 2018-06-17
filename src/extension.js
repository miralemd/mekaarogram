import $ from "jquery";
import translator from "translator";
import DefaultSelectionToolbar from "selection-toolbar";
// import objectConversion from "object-conversion";
// import PivotApi from "pivot-api";

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
	mounted( $element ) {
		this.dendo = new Dendrogram( this.$scope, $element, this.options, this.backendApi, this );
		this.__on = this.on;
		this.__off = this.off;
		this.on = () => {
			this.__on();
			this.dendo.on();
		};

		this.off = () => {
			this.__off();
			this.dendo.off();
		};

		if ( this._on ) {
			this.dendo.on();
		}
	},
	paint( el, layout ) {
		this.dendo.paint( layout );
		return Promise.resolve();
	},
	resize() {
		this.dendo.resize();
		return Promise.resolve();
	},
	updateData() {
		return Promise.resolve();
	},
	selectValues( cells, clearOld ) {
		this.dendo.selectValues( this.dendo, cells, clearOld );
	},
	getSelectionToolbar() {
		let view = this.dendo;
		return new DefaultSelectionToolbar( this.$scope.backendApi, this.$scope.selectionsApi, false, false, [{
			  name: "",
			  isIcon: true,
			  buttonClass: "sel-toolbar-icon-toggle",
			  iconClass: "icon-link",
			  action: function () {
				  view.togglePathSelect();
			  },
			  isActive: function () {
				  let active = view.isPathSelectionActive();
				  this.name = active ? "mek.turnOffPathSelect" : "mek.turnOnPathSelect";
				  return active;
			  },
			  isDisabled: function () {
				  return view.isPathSelectionDisabled();
			  }
		  }], [] );
	}
	// on() {
	// 	console.log('on');
	// },
	// off() {
	// 	console.log('off');
	// }
	// View: Dendrogram,
	// BackendApi: PivotApi,
	// importProperties: function ( exportedFmt, initialProperties, definition ) {
	// 	let propTree = objectConversion.hypercube.importProperties( exportedFmt, initialProperties, definition ),
	// 		props = propTree.qProperty;

	// 	props.qHyperCubeDef.qShowTotalsAbove = true;
	// 	props.qHyperCubeDef.qNoOfLeftDims = -1;
	// 	return propTree;
	// }
};
