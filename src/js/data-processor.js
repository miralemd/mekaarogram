/*define( [
	"general.utils/color",
	"./symbols"
],
function(
	Color,
	symbols
){
*/
import Color from "color";
import symbols from "./symbols";

function processData( layout ) {
	let pages = layout.qHyperCube.qPivotDataPages[0];

	let hideNullNodes = layout.showNullNodes !== true;

	let row = 0;

	let dimensions = layout.qHyperCube.qDimensionInfo.map( function( d ) {
		return d.qFallbackTitle;
	} );
	let measures = layout.qHyperCube.qMeasureInfo.map( function( d ) {
		return d.qFallbackTitle;
	} );
	function nest( n, depth ) {


		let values = pages.qData[row];
		let ret = {
			name: n.qType === "O" ? layout.qHyperCube.qDimensionInfo[depth].othersLabel : n.qText,
			elemNo: n.qElemNo,
			values: values,
			attrExps: n.qAttrExps,
			row: row++,
			type: n.qType,
			col: depth,
			isLocked: layout.qHyperCube.qDimensionInfo[depth].qLocked,
			canExpand: n.qCanExpand && n.qType !== "A" && n.qType !== "U",
			canCollapse: n.qCanCollapse && n.qType !== "A" && n.qType !== "U",
			dimensions: dimensions,
			measures: measures
		};
		if ( n.qSubNodes.length ) {
			ret.children = n.qSubNodes.filter( function( nn ) {
				return nn.qType !== "T" && nn.qType !== "E";
			} ).map( function( nn ) {
				return nest( nn, depth + 1 );
			} ).filter( function( nn ) {
				if ( nn.type === "U" || nn.type === "A" ) {
					ret.selfNode = nn;
				}
				return hideNullNodes ? ( nn.type !== "A" && nn.type !== "U" ) : true;
			} );
			ret.canCollapse = ret.canCollapse && ret.children.length; // can't collapse if there are no children
		}
		if ( ret.selfNode && !ret.children.length ) {
			delete ret.selfNode;
		}
		return ret;
	}

	let children = pages.qLeft.map( function( node ) {
		return nest( node, 0 );
	} ).filter( function( n ){
		return hideNullNodes ? ( n.type !== "A" && n.type !== "U" ) : true;
	} );

	let data = {
		name: "_root",
		elemNo: -3,
		children: children,
		size: 1
	};

	function hasSymbolExps( d ) {
		return d && d.qValues && d.qValues[1] && typeof d.qValues[1].qText !== "undefined" && d.qValues[1].qText !== "-";
	}

	function hasColorExps( d ) {
		return d && d.qValues && d.qValues[0] && ( d.qValues[0].qNum !== "NaN" || ( d.qValues[0].qText && d.qValues[0].qText !== "-" ) );
	}

	function applyColor( n, d ) {
		let colorArg = d.qValues[0].qNum !== "NaN" ? d.qValues[0].qNum : d.qValues[0].qText;
		let color = new Color( colorArg, "argb" );
		if ( !color.isInvalid() ) {
			n.color = color.toRGB();
		}
		else {
			delete n.color;
		}
	}

	function applySymbol( n, d ) {
		let symbol = d.qValues[1].qText;
		if ( symbol && symbols[symbol] ) {
			n.symbol = symbols[symbol].url;
		}
		else if ( /^\S{1}$/.exec( symbol ) ) { // text
			n.symbol = symbol;
		}
		else if ( /^q-[0-9]{2,4}$/.exec( symbol ) ) { // qlik icon
			n.symbol = symbol;
		}
		else if ( /^m-[_a-z0-9]+$/.exec( symbol ) ) { // material icon
			n.symbol = symbol;
		}
		else {
			delete n.symbol;
		}
		return symbol;
	}

	function mapValuesToProperties( n ) {
		let values = layout.selfNodes && n.selfNode ? n.selfNode.values : n.values,
			symbol;
		if ( values ) {
			// size
			n.size = isNaN( values[0].qNum ) ? 1 : values[0].qNum;

			//symbol
			if ( hasSymbolExps( n.attrExps ) ) {
				symbol = applySymbol( n, n.attrExps );
			} else if ( hasSymbolExps( values[0].qAttrExps ) ) {
				symbol = applySymbol( n, values[0].qAttrExps );
			} else {
				delete n.symbol;
			}

			//color
			if ( hasColorExps( n.attrExps ) ) {
				applyColor( n, n.attrExps );
			} else if ( hasColorExps( values[0].qAttrExps ) ) {
				applyColor( n, values[0].qAttrExps );
			} else if ( n.symbol && symbols[symbol] && symbols[symbol].color ) {
				n.color = new Color( symbols[symbol].color );
			}
			else {
				delete n.color;
			}
		}
		if ( n.children ) {
			n.children.forEach( mapValuesToProperties );
		}
	}

	function generateId( n, s ) {
		n.id = s + ";" + n.name;
		if ( n.children ) {
			n.children.forEach( function( c ) {
				generateId( c, n.id );
			} );
		}
	}

	mapValuesToProperties( data );
	generateId( data, "" );

	let totalGlyphCount = 0;
	let levels = [];
	function collect( arr, i ) {
		if ( !arr ) {
			return;
		}
		if ( !levels[i] ) {
			levels[i] = {
				nodes: [],
				min: Number.MAX_VALUE,
				max: -Number.MAX_VALUE,
				glyphCount: layout.qHyperCube.qDimensionInfo[i].qApprMaxGlyphCount,
				depth: i
			};
			totalGlyphCount += levels[i].glyphCount;
		}
		levels[i].nodes = levels[i].nodes.concat( arr );
		//levels[i] += arr ? arr.length : 0;
		arr.forEach( function( c ) {
			if ( c.children && c.children.length ) {
				collect( c.children, i + 1 );
			}
		} );
	}

	collect( data.name === "_root" ? data.children : [data], 0 );

	//var totalGlyphCount = 0;

	//levels.forEach( function( level ) {
	//	totalGlyphCount += layout.qHyperCube.qDimensionInfo[depth].qApprMaxGlyphCount;
	//	level.numNodes = level.nodes.length;
	//} );

	/*
	levels = levels.map( function( numNodes, depth ) {
		totalGlyphCount += layout.qHyperCube.qDimensionInfo[depth].qApprMaxGlyphCount;
		return {
			numNodes: numNodes,
			depth: depth,
			glyphCount: layout.qHyperCube.qDimensionInfo[depth].qApprMaxGlyphCount,
			min: Number.MAX_VALUE,
			max: -Number.MAX_VALUE
		}
	} );
	*/

	levels.forEach( function( level ) {
		level.glyphCountWeight = level.glyphCount / totalGlyphCount;
	} );

	function getMinMax ( node, prop ) {

		let max = -Number.MAX_VALUE,
			min = Number.MAX_VALUE;

		if ( node.children ) {
			node.children.forEach( function ( c ) {
				let m = getMinMax( c, prop );
				max = Math.max( max, m.max );
				min = Math.min( min, m.min );
			} );
		}
		if ( node.name !== "_root" ) {
			levels[node.col].min = Math.min( node[prop], levels[node.col].min );
			levels[node.col].max = Math.max( node[prop], levels[node.col].max );
		}

		max = Math.max( max, node[prop] );
		min = Math.min( min, node[prop] );

		if ( isNaN( max ) ) {
			max = min = 1;
		}

		return {
			max: max,
			min: min
		};
	}

	let minMax = getMinMax( data, "size" );

	return {
		root: data,
		levels: levels,
		min: minMax.min,
		max: minMax.max,
		glyphCount: totalGlyphCount
	};
}

export default {
	process: processData
};
