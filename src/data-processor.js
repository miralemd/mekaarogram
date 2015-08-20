define( [
	'general.utils/color'
],
/** @owner Miralem Drek (mek) */
function(
	Color
){

	var emoticons = {
		':)': 'smile',
		':(': 'sad',
		':|': 'meh'
		},
		emoticonColors = {
			':)': '#8BC34A',
			':|': '#FFEB3B',
			':(': '#F44336'
		};
	
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

				//emoticon
				if ( n.values[0].qAttrExps && n.values[0].qAttrExps.qValues && n.values[0].qAttrExps.qValues[1] ) {
					var emoticon = n.values[0].qAttrExps.qValues[1].qText;
					if ( emoticon && emoticons[emoticon]) {
						n.emoticon = emoticons[emoticon];
					}
					else {
						delete n.emoticon;
					}
				}
				else {
					delete n.emoticon;
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
				else if ( emoticon && emoticonColors[emoticon] ) {
					n.color = new Color( emoticonColors[emoticon] );
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

		var levels = [];
		function collect( arr, i ) {
			if ( !arr ) {
				return;
			}
			if ( !levels[i] ) {
				levels[i] = 0;
			}
			levels[i] += arr ? arr.length : 0;
			arr.forEach( function( c ) {
				if ( c.children && c.children.length ) {
					collect( c.children, i+1 );
				}
			});
		}

		collect( data.name === '_root' ? data.children : [data], 0 );

		return {
			data: data,
			levels: levels
		};
	}
	
	return {
		process: processData
	};
} );