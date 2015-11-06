define( [
	"general.utils/color",
	"./symbols"
],
/** @owner Miralem Drek (mek) */
function(
	Color,
	symbols
){
	
	function processData( layout ) {
		var pages = layout.qHyperCube.qPivotDataPages[0];

		var row = 0;
		
		var dimensions = layout.qHyperCube.qDimensionInfo.map( function( d ) {
			return d.qFallbackTitle;
		});
		var measures = layout.qHyperCube.qMeasureInfo.map( function( d ) {
			return d.qFallbackTitle;
		});
		function nest( n, depth ) {

			var values = pages.qData[row];
			var ret = {
				name: n.qType === 'O' ? layout.qHyperCube.qDimensionInfo[depth].othersLabel : n.qText,
				elemNo: n.qElemNo,
				values: values,
				row: row++,
				type: n.qType,
				col: depth,
				isLocked: layout.qHyperCube.qDimensionInfo[depth].qLocked,
				canExpand: n.qCanExpand && n.qType !== 'A',
				canCollapse: n.qCanCollapse && n.qType !== 'A',
				dimensions: dimensions,
				measures: measures
			};
			if ( n.qSubNodes.length ) {
				ret.children = n.qSubNodes.filter(function( n ) {
					return n.qType !== "T" && n.qType !== 'E';
				} ).map( function( node ) {
					return nest( node, depth + 1);
				} ).filter( function( n ) {
					return n.type !== "A"; 
				} );
					
			}
			return ret;
		}

		var children = pages.qLeft.map( function( node ) {
			return nest( node, 0 );
		} ).filter( function( n ){
			return n.type !== 'A';
		} );

		var data = {
			name: "_root",
			elemNo: -3,
			children: children,
			size: 1
		};

		function mapValuesToProperties( n ) {
			if ( n.values ) {
				// size
				n.size = isNaN( n.values[0].qNum ) ? 1 : n.values[0].qNum;

				//symbol
				if ( n.values[0].qAttrExps && n.values[0].qAttrExps.qValues && n.values[0].qAttrExps.qValues[1] ) {
					var symbol = n.values[0].qAttrExps.qValues[1].qText;
					if ( symbol && symbols[symbol] ) {
						n.symbol = symbols[symbol].url;
					}
					else if( /^\S{1}$/.exec( symbol ) ) { // text
						n.symbol = symbol;
					}
					else if( /^q-[0-9]{2,3}$/.exec( symbol ) ) { // qlik icon
						n.symbol = symbol;
					}
					else if( /^m-[_a-z0-9]+$/.exec( symbol ) ) { // material icon
						n.symbol = symbol;
					}
					else {
						delete n.symbol;
					}
				}
				else {
					delete n.symbol;
				}
				
				//color
				if ( n.values[0].qAttrExps && n.values[0].qAttrExps.qValues && n.values[0].qAttrExps.qValues[0] &&
					( n.values[0].qAttrExps.qValues[0].qNum !== 'NaN' ||  n.values[0].qAttrExps.qValues[0].qText ) ) {
					var colorArg = n.values[0].qAttrExps.qValues[0].qNum !== 'NaN' ? n.values[0].qAttrExps.qValues[0].qNum : n.values[0].qAttrExps.qValues[0].qText;
					var color = new Color( colorArg, 'argb' );
					if ( !color.isInvalid() ) {
						n.color = color.toRGB();
					}
					else {
						delete n.color;
					}
				}
				else if ( n.symbol && symbols[symbol] && symbols[symbol].color ) {
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
				});
			}
		}

		mapValuesToProperties( data );
		generateId( data, '');

		var totalGlyphCount = 0;
		var levels = [];
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
					collect( c.children, i+1 );
				}
			});
		}

		collect( data.name === '_root' ? data.children : [data], 0 );

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

			var max = -Number.MAX_VALUE,
				min = Number.MAX_VALUE;

			if ( node.children ) {
				node.children.forEach( function ( c ) {
					var m = getMinMax( c, prop );
					max = Math.max( max, m.max );
					min = Math.min( min, m.min );
				} );
			}
			if( node.name !== '_root' ) {
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
		
		var minMax = getMinMax( data, 'size' );

		return {
			root: data,
			levels: levels,
			min: minMax.min,
			max: minMax.max,
			glyphCount: totalGlyphCount
		};
	}
	
	return {
		process: processData
	};
} );