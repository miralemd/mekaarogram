/*globals define, console*/
define( [
	'jquery',
	'translator',
	'objects.extension/object-conversion',
	'client.property-panel/components/components',
	'extensions.qliktech/pivot-table/properties/pivot-sorting/pivot-sorting',
	'objects.backend-api/pivot-api',
	
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
	pivotSorting,
	PivotApi,
	
	Dendrogram,
	properties,
	locales,
	style
) {

	translator.append( locales[translator.language] || locales["en-US"] );
	
	$( "<style>" + style + "</style>" ).appendTo( "head" );
	
	// set custom icon for dendro extension in assets panel
	$( "<style>.assets-list li[title='Mekaarogram'] .icon-extension::before { content: '?'; }</style>" ).appendTo("head");
	
	if( !components.hasComponent( "pivot-sorting" ) ) {
		components.addComponent( "pivot-sorting", pivotSorting );
	}

	return {
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
					qWidth: 10,
					qHeight: 1000
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
			var propTree = objectConversion.hypercube.importProperties( exportedFmt, initialProperties, definition ),
				props = propTree.qProperty;

			props.qHyperCubeDef.qShowTotalsAbove = true;
			props.qHyperCubeDef.qNoOfLeftDims = -1;
			return propTree;
		}
	};
} );