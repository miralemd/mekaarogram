/* global d3, Touche */
import $ from "jquery";
//import qvangular from "qvangular";
import Color from "color";
import DefaultView from "default-view";
import DefaultSelectionToolbar from "selection-toolbar";
//import EventUtils from "event-utils";
import State from "state";

import selections from "./selection";
import tooltip from "./tooltip";
import dataProcessor from "./data-processor";

import "d3";

import "tooltip-service"; // registers qvChartTooltipService used in tooltip.js
import "touche"; // ensure Touche is imported and avaliable as global

import defs from "../assets/defs.html";

let duration = 500;
let namespace = ".mekDendrogram";
let PADDING = 4;
let defaultColor = "rgb(100, 150, 150)";
let MAX_NODES_FOR_ENABLED_ANIMATION = 100;

let globals = {
	instances: 0,
	svgDefs: undefined
};

let isIE = ( function() {
	let ua = window.navigator.userAgent;
	return ua.indexOf( "MSIE " ) > -1 || ua.indexOf( "Trident/" ) > -1 || ua.indexOf( "Edge" ) > -1;
} )();


function onNodeMouseOver ( d, el, event, isRadial, showSelf ) {
	tooltip.current.d = d;
	tooltip.current.el = el;
	tooltip.current.isRadial = isRadial;
	tooltip.current.showSelfValue = showSelf;

	tooltip.activate();
}

function onNodeMouseLeave () {
	tooltip.inactivate();
}

let linearDiagonal = d3.svg.diagonal()
	.projection( function ( d ) {
		return [d.y, d.x];
	} );

let radialDiagonal = d3.svg.diagonal.radial()
	.projection( function ( d ) {
		return [d.y, d.x / 180 * Math.PI];
	} );

let radialTransformFn = function ( d ) {
	return "rotate(" + ( d.x - 90 ) + ") translate(" + d.y + ")";
};

let linearTransformFn = function ( d ) {
	return "translate(" + d.y + "," + d.x + ")";
};

let colorFn = function ( d ) {
	return ( d.target ? d.target.color : d.color ) || defaultColor;
};

let strokeColorFn = function ( d ) {
	return d.canCollapse || d.canExpand ? d3.rgb( colorFn( d ) ).darker().toString() : "";
};

function toggle( d ) {

	if ( d.canExpand ) {
		this.backendApi.expandLeft( d.row, d.col, false );
		this._toggledNode = d;
	}
	else if ( d.canCollapse ) {
		this.backendApi.collapseLeft( d.row, d.col, false );
		this._toggledNode = d;
	}
}

function spaceOutLinear( levels, width, labelWeight ) {

	let numLevelsThatNeedSpaceForLabel = 1;
	if ( levels.length > 1 ) {
		numLevelsThatNeedSpaceForLabel = levels.length + 1;
		if ( !levels[0].showLabels ) {
			numLevelsThatNeedSpaceForLabel--;
		}
		if ( levels.length > 1 && !levels[levels.length - 1].showLabels ) {
			numLevelsThatNeedSpaceForLabel--;
		}
	}

	let spacing = width / ( numLevelsThatNeedSpaceForLabel || 1 );
	let remainder = width - 2 * levels.reduce( function( prev, level ){ return prev + level.maxPointSize; }, 0 );
	let distanceBetween = remainder / ( numLevelsThatNeedSpaceForLabel || 1 );
	let offset = 0;



	levels.forEach( function ( level, i ) {
		let lastLevel = levels[Math.max( 0, levels.length - 1 )];
		let distanceToPrevious = spacing - level.maxPointSize - ( i ? levels[i - 1].maxPointSize : 0 );
		let diff = ( 1 - labelWeight ) * distanceBetween + labelWeight * remainder * level.glyphCountWeight - distanceToPrevious;
		let foo = i === 0 && !level.showLabels ? level.maxPointSize : ( spacing + diff );
		let textWidth = foo;
		if ( i >= levels.length - 1 && lastLevel.showLabels ) {
			offset = width - foo + lastLevel.maxPointSize;
			textWidth -= lastLevel.maxPointSize;
		}
		else {
			offset += foo;
		}

		if ( i > 0 && i < levels.length - 1 ) {
			textWidth -= levels[i - 1].maxPointSize;
		}

		level.textWidth = textWidth - level.maxPointSize - PADDING * 2;
		level.offset = offset;
	} );
}

function canLabelFitHorizontally( level ) {
	let glyphCount = level.glyphCount;
	let spaceForLabels = level.textWidth;
	if ( !( spaceForLabels > 18 || spaceForLabels / ( 12 * glyphCount ) > 1 ) ) {
		level.showLabels = false;
	}
}

function expandLabelWidthWherePossible( levels ) {

	levels.forEach( function( level, i ) {
		let glyphCount = level.glyphCount;
		let spaceForLabels = level.textWidth;

		if ( levels.length > 2 && i > 0 && i < levels.length - 1 ) {
			level.nodes.forEach( function( n ) {
				n.textWidth = spaceForLabels;

				let canFit = true;
				levels.slice( 0, i ).reverse().forEach( function( lev ) {
					if ( !canFit ) { // if it couln't fit through a corridor on last level, don't bother trying on next
						return;
					}
					let start = n.x - 6;
					let end = n.x + 6;

					let c, s, e, corr = lev.corridor, len = corr.length;
					let isExtended = false;
					for ( c = 0; c < len; c++ ) {
						s = corr[c].start;
						e = corr[c].end;
						if ( start >= s && end <= e ) {
							isExtended = true;
							n.textWidth += PADDING * 2 + lev.textWidth + 2 * lev.maxPointSize;
							break;
						}
					}

					canFit = isExtended;
				} );
			} );
		}

		if ( !( spaceForLabels > 18 || spaceForLabels / ( 12 * glyphCount ) > 1 ) ) {
			level.showLabels = false;
		}
	} );
}

function canLabelFitVertically( levels, height ) {
	// set label visibility based on vertical spacing between nodes
	levels.forEach( function ( level ) {
		level.showLabels = true;
		level.numVisibleLabels = 0;
		level.minLabelDistance = height;
		let nodes = level.nodes.slice();
		let original = level.nodes;

		nodes.forEach( function( node, i ) {
			node._handledLabel = false;
			node.levelIndex = i;
			node.showLabel = false;
			//node.x += maxPointSize;
		} );
		nodes.sort( function( a, b ) {
			return b.size - a.size;
		} );

		nodes.forEach( function ( n, i, arr ) {

			if ( n._handledLabel ) {
				return;
			}
			//n.y = i * height/arr.length;
			let idx = n.levelIndex;
			let prevX = 0;
			let nextX = 0;

			let space = 8;

			let touchesNeighbour = false;
			if ( idx === 0 ) {
				prevX = 2 * n.x;
			}
			else {
				touchesNeighbour = n.x - n.nodeSize < original[idx - 1].x;// + original[idx-1].nodeSize;
				do {
					prevX = n.x - original[--idx].x;
				} while ( prevX < space && idx > 0 && !original[idx].showLabel );
				if ( idx === 0 && !original[idx].showLabel ) { // add additional space available above the first node
					prevX += 2 * original[idx].x;
				}
			}

			idx = n.levelIndex;
			if ( idx === arr.length - 1 ) {
				nextX = 2 * ( height - n.x );
			}
			else {
				touchesNeighbour = touchesNeighbour || ( n.x + n.nodeSize > original[idx + 1].x );// - original[idx+1].nodeSize);
				do {
					nextX = original[++idx].x - n.x;
				} while ( nextX < space && idx < arr.length - 1 && !original[idx].showLabel );
				if ( idx === arr.length - 1 && !original[idx].showLabel ) { // add additional space available after the last node
					nextX += 2 * ( height - original[idx].x );
				}
			}

			n.showLabel = !touchesNeighbour && prevX >= space && nextX >= space;

			if ( n.showLabel ) {
				level.numVisibleLabels++;
				level.minLabelDistance = Math.min( level.minLabelDistance, prevX, nextX );
			}

			/*
			idx = n.levelIndex;
			nextX = 0;
			while( nextX < 10 && idx < arr.length - 1 ) {
				if ( idx !== n.levelIndex ) {
					original[idx]._handledLabel = true;
					original[idx].showLabel = false;
				}

				nextX = n.x - original[idx++].x;
			}
			*/

			/*
			if ( i < arr.length - 1 ) {
				dx = Math.abs( n.x - arr[i + 1].x );
			}
			else {
				dx = n.x * 2.4;
			}

			if ( i > 0 ) {
				dx = Math.min( dx, Math.abs( n.x - arr[i - 1].x ) );
			}
			else {
				dx = Math.min( dx, (height - n.x) * 2.4 );
			}

			if ( dx < 10 ) {
				n.showLabel = false;
			}
			else if ( n.depth > 0 ) {
				n.showLabel = true;
				levels[n.depth - 1].hasVisibleLabels = true;
			}
			*/
		} );

		if ( !level.numVisibleLabels ) {
			level.showLabels = false;
		}
	} );
}

function calculateLinear( data, layout, width, height ) {
	let levels = data.levels,
		adaptiveStrokeWidth = layout.adaptiveStrokeWidth;

	let maxCircleSize = Math.min( 80, 0.25 * width / ( levels.length || 1 ) );
	levels.forEach( function ( level ) {
		maxCircleSize = Math.min( maxCircleSize, 0.5 * height / ( level.nodes.length || 1 ) );
	} );

	levels.forEach( function ( level ) {
		maxCircleSize = Math.min( maxCircleSize, 0.5 * ( height - maxCircleSize ) / ( level.nodes.length || 1 ) );
	} );

	// point size in radius
	let minPointSize = Math.max( 2, maxCircleSize * ( layout.dataPoint && layout.dataPoint.size ? layout.dataPoint.size[0] : 1 ) );
	let maxPointSize = Math.max( 2, maxCircleSize * ( layout.dataPoint && layout.dataPoint.size ? layout.dataPoint.size[1] : 1 ) );

	let sizing = d3.scale.linear().domain( [data.min, data.max] ).rangeRound( [minPointSize, maxPointSize] ).clamp( true );

	let sizeFn = function ( d ) {
		d.nodeSize = d.target ? adaptiveStrokeWidth ? sizing( d.target.size ) : 1 : // d.target exists for node links
			sizing( d.size );
		return d.nodeSize;
	};

	levels = levels.map( function ( level ) {
		return {
			showLabels: true,
			nodes: level.nodes,
			glyphCount: level.glyphCount,
			glyphCountWeight: level.glyphCountWeight,
			maxPointSize: sizing( level.max ),
			corridor: []
		};
	} );

	let tree = d3.layout.tree().size( [height, width] ).separation( function ( a, b ) {
		return sizing( a.size ) + sizing( b.size );
	} );

	let nodes = tree.nodes( data.root ).reverse();
	nodes.pop();

	nodes.forEach( function( node ) {
		node.nodeSize = sizing( node.size );
	} );

	canLabelFitVertically( levels, height, maxPointSize );

	nodes.forEach( function( node ) {
		levels[node.depth - 1].corridor[Math.round( node.x )] = Math.max( levels[node.depth - 1].corridor[Math.round( node.x )] || 0, Math.max( 2 * node.nodeSize, node.showLabel ? 12 : 0 ) );
	} );

	levels.forEach( function( level ) {
		let corridor = level.corridor.slice();
		let out = [];
		let start = 0;
		let end = 0;
		corridor.forEach( function( c, i ) {
			end = i - corridor[i] / 2;

			if ( end - start > 12 ) {
				out.push( { start: start, end: end } );
			}
			start = i + corridor[i] / 2;
		} );
		end = height;

		if ( end - start > 12 ) {
			out.push( { start: start, end: end } );
		}

		level.corridor = out;
	} );

	let labelWeight = "labelWeight" in layout ? layout.labelWeight : 0.5;

	spaceOutLinear( levels, width, labelWeight );

	if ( levels.length > 1 ) {
		canLabelFitHorizontally( levels[levels.length - 1] );
		canLabelFitHorizontally( levels[0] );

		spaceOutLinear( levels, width, labelWeight );
	}

	if ( levels.length > 2 ) {
		expandLabelWidthWherePossible( levels );
		levels.slice( 1, levels.length ).forEach( canLabelFitHorizontally );
	}

	nodes.forEach( function ( d ) {
		d.y = levels[( d.depth - 1 )].offset;
	} );

	let linearTextTransform = function ( d ) {
		return "translate(" + ( d.depth < levels.length ? -1 : 1 ) * ( PADDING + levels[d.depth - 1].maxPointSize ) + ")";
	};

	let textAlignTransform = function ( d ) {
		return d.depth < levels.length ? "end" : "start";
	};

	return {
		sizing: sizing,
		levels: levels,
		tree: tree,
		nodes: nodes,
		sizeFn: sizeFn,
		nameLabeling: {
			position: linearTextTransform,
			align: textAlignTransform
		}
	};
}
/*
function getMaxCircleSize( levels ) {
	levels.forEach( function ( level, i ) {
		maxCircleSize = Math.min( maxCircleSize, Math.PI * radiusSpacing * (i + 1) / (level.nodes.length || 1) );
	} );
}*/

function spaceOutRadial( levels, radius, labelWeight ) {

	let numLevelsThatNeedSpaceForLabel = levels.length + 1;
	if ( !levels[levels.length - 1].showLabels ) {
		numLevelsThatNeedSpaceForLabel--;
	}

	levels.forEach( function( level ) {
		level.minRadius = level.maxPointSize * level.nodes.length / Math.PI;
	} );

	let spacing = radius / ( numLevelsThatNeedSpaceForLabel || 1 );
	let remainder = radius - 2 * levels.reduce( function( prev, level ){ return prev + level.maxPointSize; }, 0 );
	let distanceBetween = remainder / ( numLevelsThatNeedSpaceForLabel || 1 );

	let offset = 0;

	levels.slice().reverse().forEach( function ( level, i, arr ) {
		let distanceToPrevious = spacing - level.maxPointSize - ( i ? arr[i - 1].maxPointSize : 0 );
		let diff = ( 1 - labelWeight ) * distanceBetween + labelWeight * remainder * level.glyphCountWeight - distanceToPrevious;
		let foo = i === 0 && !level.showLabels ? level.maxPointSize : ( spacing + diff );
		let textWidth = foo;
		offset += foo;
		//var offsetDiff = radius - offset - level.minRadius;
		//if( offsetDiff < 0 ) {
		//	textWidth += offsetDiff;
		//}

		if ( i > 0 ) {
			textWidth -= arr[i - 1].maxPointSize;
		}
		level.textWidth = textWidth - level.maxPointSize - 2 * PADDING;
		level.offset = radius - offset;//Math.max( level.minRadius, radius - offset );
	} );
}

function canLabelFitRadially( levels ) {
	levels.forEach( function( level ) {
		level.showLabels = true;
		level.numVisibleLabels = 0;
		level.minLabelDistance = 180 * Math.PI * level.offset;

		let nodes = level.nodes.slice();
		let original = level.nodes;

		nodes.forEach( function( node, i ) {
			node.levelIndex = i;
			node.showLabel = false;
		} );
		nodes.sort( function( a, b ) {
			return b.size - a.size;
		} );

		nodes.forEach( function( n, i, arr ) {
			if ( arr.length < 2 ) {
				n.showLabel = true;
				level.numVisibleLabels = 1;
				return;
			}

			let idx = n.levelIndex;
			let prevX = 0;
			let nextX = 0;
			let space = 10;
			let looped = false;

			do {
				--idx;
				if ( idx === -1 && !looped ) {
					looped = true;
					idx = arr.length - 1;
				}
				else if ( looped ) {
					break;
				}

				prevX = n.x - original[idx].x;
				if ( prevX < 0 ) {
					prevX = n.x - original[idx].x + 360;
				}
				prevX *= Math.PI * level.offset / 180;

			} while ( prevX < space && !original[idx].showLabel );

			idx = n.levelIndex;
			looped = false;
			do {
				++idx;
				if ( idx >= arr.length && !looped ) {
					looped = true;
					idx = 0;
				}
				else if ( looped ) {
					break;
				}

				nextX = original[idx].x - n.x;
				if ( nextX < 0 ) {
					nextX += 360;
				}
				nextX *= Math.PI * level.offset / 180;
			} while ( nextX < space && !original[idx].showLabel );

			n.showLabel = prevX >= space && nextX >= space;

			if ( n.showLabel ) {
				level.numVisibleLabels++;
				level.minLabelDistance = Math.min( level.minLabelDistance, prevX, nextX );
			}

			//var prev = arr[i ? i-1 : arr.length - 1].x;
			//var next = arr[i < arr.length - 1 ? i+1 : 0].x;
			//var dx = Math.min( Math.abs( arr[i].x - prev ), Math.abs( next - arr[i].x ) );
			//dx *= Math.PI * level.offset / 180;
			//if( arr.length < 2 || dx > 62 ) {
			//	n.showLabel = true;
			//	level.hasVisibleLabels = true;
			//}
		} );

		if ( !level.numVisibleLabels ) {
			level.showLabels = false;
		}
	} );
}

function expandRadialLabels( levels ) {
	levels.forEach( function( level, i ) {
		//var glyphCount = level.glyphCount;
		let spaceForLabels = level.textWidth;

		if ( levels.length > 1 && i < levels.length - 1 ) {
			level.nodes.forEach( function( n ) {
				n.textWidth = spaceForLabels;
				n._extendToEdge = false;

				let canFit = true;
				levels.slice( i + 1 ).forEach( function( lev ) {
					if ( !canFit ) { // if it couln't fit through a corridor on last lev, don't bother trying on next
						return;
					}
					let start = Math.PI * n.x * lev.offset / 180 - 6;
					let end = start + 12;

					let c, s, e, corr = lev.corridor, len = corr.length;
					let isExtended = false;
					for ( c = 0; c < len; c++ ) {
						s = corr[c].start;
						e = corr[c].end;
						if ( start >= s && end <= e ) {
							isExtended = true;
							n.textWidth += PADDING * 2 + lev.textWidth + 2 * lev.maxPointSize;
							break;
						}
					}
					if ( isExtended && lev === levels[levels.length - 1] ) {
						n._extendToEdge = true;
					}
					canFit = isExtended;
				} );
			} );
		}

		//if ( !(spaceForLabels > 18 || spaceForLabels / (12 * glyphCount) > 1 ) ) {
		//	level.showLabels = false;
		//}
	} );
}

function calculateRadial( data, layout, width, height, rotation ) {
	let levels = data.levels,
		arcSize = 360,
		adaptiveStrokeWidth = layout.adaptiveStrokeWidth,
		labelWeight = 0;//'labelWeight' in layout ? layout.labelWeight : 0.5;

	let radius = 0.5 * Math.min( width, height ),
		radiusSpacing = radius / levels.length;

	let maxCircleSize = Math.min( 80, 0.5 * radius / ( levels.length || 1 ) );

	levels.forEach( function ( level, i ) {
		maxCircleSize = Math.min( maxCircleSize, 0.5 * Math.PI * radiusSpacing * ( i + 1 ) / ( level.nodes.length || 1 ) );
	} );

	// point size in radius
	let minPointSize = Math.max( 2, maxCircleSize * ( layout.dataPoint && layout.dataPoint.size ? layout.dataPoint.size[0] : 1 ) );
	let maxPointSize = Math.max( 2, maxCircleSize * ( layout.dataPoint && layout.dataPoint.size ? layout.dataPoint.size[1] : 1 ) );
	let sizing = d3.scale.linear().domain( [data.min, data.max] ).rangeRound( [minPointSize, maxPointSize] ).clamp( true );

	levels = levels.map( function ( level ) {
		return {
			showLabels: true,
			nodes: level.nodes,
			glyphCount: level.glyphCount,
			glyphCountWeight: level.glyphCountWeight,
			maxPointSize: sizing( level.max ),
			corridor: []
		};
	} );

	spaceOutRadial( levels, radius, labelWeight );

	let tree = d3.layout.tree().size( [arcSize, radius] )
		.separation( function ( a, b ) {
			return ( ( a.parent === b.parent ? 1 : 2 ) / ( a.depth || 1 ) );
		} );

	let nodes = tree.nodes( data.root ).reverse();
	nodes.pop();

	canLabelFitRadially( levels, radius, maxPointSize );

	levels.forEach( canLabelFitHorizontally );

	spaceOutRadial( levels, radius, labelWeight );


	let sizeFn = function ( d ) {
		d.nodeSize = d.target ? adaptiveStrokeWidth ? sizing( d.target.size ) : 1 : // d.target exists for node links
			sizing( d.size );
		return d.nodeSize;
	};


	tree = d3.layout.tree().size( [arcSize, radius] )
		.separation( function ( a, b ) {
			return ( ( a.parent === b.parent ? 1 : 2 ) / ( a.depth || 1 ) );
			//return ( sizing( a.size ) + sizing( b.size ) ) * ( (a.parent === b.parent ? 1 : 2) / (a.depth || 1) );
			//return (sizing(a.size) + sizing( b.size )) / a.depth;
		} );


	nodes.forEach( function( node ) {
		delete node.textWidth;
		node.nodeSize = sizing( node.size );
		let l = levels[node.depth - 1];
		let arcPos = Math.round( node.x * Math.PI * l.offset / 180 );
		l.corridor[arcPos] = Math.max( l.corridor[arcPos] || 0, Math.max( 2 * node.nodeSize, node.showLabel ? 12 : 0 ) );
	} );

	levels.forEach( function( level ) {
		let corridor = level.corridor.slice();
		let out = [];
		let start = ( corridor.length - 1 ) - corridor[corridor.length - 1] / 2;
		let end = 0;
		let firstIndex;
		let half = Math.PI * level.offset;
		corridor.forEach( function( c, i ) {
			if ( typeof firstIndex === "undefined" ) {
				firstIndex = i;
			}
			end = i - corridor[i] / 2;

			if ( end - start > 12 ) {
				out.push( { start: start, end: end } );
			}
			else if ( start - end > 12 ) {
				out.push( { start: start, end: end + half * 2 } );
				out.push( { start: start - half * 2, end: end } );
			}
			start = i + corridor[i] / 2;
		} );
		end = firstIndex;

		if ( end - start > 12 ) {
			out.push( { start: start, end: end } );
		}

		level.corridor = out;
	} );

	expandRadialLabels( levels );

	let radialShift = 0;
	if ( levels[0].nodes.length === 1 ) {
		radialShift = -90;
	}

	nodes.forEach( function ( d ) {
		d.x = ( ( ( d.x + radialShift + ( arcSize === 360 ? rotation : 0 ) ) % 360 ) + 360 ) % 360;

		d.y = levels[d.depth - 1].offset;

		if ( d.depth >= levels.length || d._extendToEdge ) {
			let px = 0.5 * width;
			let py = 0.5 * height;
			let vx = Math.cos( ( d.x - 90 ) * Math.PI / 180 );
			let vy = Math.sin( ( d.x - 90 ) * Math.PI / 180 );

			let tl = -px / vx;
			let tr = 0.5 * width / vx;
			let tb = 0.5 * height / vy;
			let tt = -py / vy;

			let t = Math.min.apply( null, [tl, tr, tb, tt].filter( function( v ){return v >= 0;} ) );
			let x = px + t * vx;
			let y = py + t * vy;

			x -= px;
			y -= py;

			let c = Math.sqrt( x * x + y * y );
			d.textWidth = c - levels[d.depth - 1].offset - levels[d.depth - 1].maxPointSize - PADDING;
		}
	} );



	let textTransformFn = function ( d ) {
		return d.x < 180 ? "translate(" + ( PADDING + levels[d.depth - 1].maxPointSize ) + ")" : "rotate(180) translate(-" + ( PADDING + ( levels[d.depth - 1].maxPointSize ) ) + ")";
	};

	let radialTextAnchorFn = function ( d ) {
		return d.x < 180 ? "start" : "end";
	};

	return {
		levels: levels,
		nodes: nodes,
		sizeFn: sizeFn,
		nameLabeling: {
			position: textTransformFn,
			align: radialTextAnchorFn
		},
		tree: tree
	};
}

function _update( source ) {
	clearTimeout( this._rotationTimer );
	let self = this,
		isRadial = this._isRadial;

	let values = isRadial ? calculateRadial( this._data, this._layout, this._w, this._h, this._rotation ) :
		calculateLinear( this._data, this._layout, this._w, this._h );

	let levels = values.levels;
	let nodes = values.nodes;
	let sizeFn = values.sizeFn;
	let labelPosition = values.nameLabeling.position;
	let labelAlignment = values.nameLabeling.align;
	let tree = values.tree;

	let numNodes = Math.max( nodes.length, this._prevNumNodes || 0 );

	this.duration = numNodes > MAX_NODES_FOR_ENABLED_ANIMATION ? 0 : duration; // turn off animation if too many nodes
	this._prevNumNodes = nodes.length;

	let minLabelSpace = Math.min.apply( null, levels.map( function( level ) {
		return level.minLabelDistance;
	} ) );

	this.$element.removeClass( "f-size-m f-size-s f-size-xs" );
	if ( minLabelSpace !== null && !isNaN( minLabelSpace ) && minLabelSpace < 13 ) {
		this.$element.addClass( minLabelSpace < 11 ? "f-size-xs" :
			minLabelSpace < 12 ? "f-size-s" : "f-size-m" );
	}


	let diagonal = isRadial ? radialDiagonal : linearDiagonal;
	let transformFn = isRadial ? radialTransformFn : linearTransformFn;
	//var textAnchorFn = isRadial ? radialTextAnchorFn : linearTextAnchorFn;


	let enteringTransform = isRadial ?
	"rotate(" + ( source._x - 90 ) + ") translate(" + source._y + ")" :
	"translate(" + source._y + "," + source._x + ")";

	let exitingTransform = isRadial ?
	"rotate(" + ( source.x - 90 ) + ") translate(" + source.y + ")" :
	"translate(" + source.y + "," + source.x + ")";

	//nodes.forEach(function( d ) {
	//	d.y = d.depth * 240;
	//});

	// update existing nodes
	let node = self._root.selectAll( "g.node" )
		.data( nodes, function ( d, i ) {
			return d.id || ( d.id = ++i );
		} );

	// attach new nodes to parent's previous position (position to transition from)
	let nodeEnter = node.enter().append( "g" )
		.attr( "class", function ( d ) {
			return "node " + ( ( d.children || d._children ) ? "branch" : "leaf" );
		} )
		.attr( "transform", enteringTransform )
		.on( "mouseenter", function ( d ) {
			onNodeMouseOver( d, this, d3.event, isRadial, self._layout.selfNodes );
		} )
		.on( "mouseleave", function ( d ) {
			onNodeMouseLeave( d, null, d3.event );
		} );

	nodeEnter.append( "circle" )
		.style( "fill", colorFn )
		.style( "stroke", strokeColorFn )
		.attr( "r", 1e-6 );

	//nodeEnter.append( "rect" )
	//	.attr( "y", -5 )
	//	.attr( "height", 10 );

	/*
	nodeEnter.append("use")
		.attr("xlink:href", function( d ) {
			return "#" + d.emoticon;
		})
		.attr("transform", "scale(0.001, 0.001) translate(-370, -540)");
	*/

	//nodeEnter.append("text")
	//	.attr("dy", ".35em")
	//	.text(function( d ) {
	//		return d.name;
	//	})
	//	.each(wrap)
	//.style("fill-opacity", 1e-6);

	let nodeUpdate = node;
	if ( self.duration ) {
		nodeUpdate = nodeUpdate.transition().duration( self.duration );
	}
	nodeUpdate = nodeUpdate.attr( "transform", transformFn );
	//.style( 'stroke-width', function ( d ) {
	//	return Math.sqrt( d.size ) / 150;
	//} );

	nodeUpdate.attr( "class", function ( d ) {
		let classes = ["node"],
			cellId = d.col + ";" + d.row;
		classes.push( ( d.children || d._children ) ? "branch" : "leaf" );
		if ( d.canExpand || d.canCollapse ) {
			classes.push( "node-expandable" );
		}
		if ( !d.isLocked && ( !self.dataSelections.highlight || self.dataSelections.highlight && self.dataSelections.col === d.col ) ) {
			classes.push( "node-selectable" );
		}
		if ( self.dataSelections.highlight ) {
			if ( !self._isPathSelectActive ) {
				if ( d.col in self._selectedElemNo && d.elemNo in self._selectedElemNo[d.col] ) {
					classes.push( "node-selected" );
				}
				else if ( self.dataSelections.col !== d.col ) {
					classes.push( "unselectable" );
				}
			}
			else if ( self._selectedCells && ( cellId in self._selectedCells ) ) {
				classes.push( "node-selected" );
			}
			else if ( self._pathSelected && self._pathSelected[cellId] ) {
				classes.push( "node-semi-selected" );
			}
			else if ( self.dataSelections.col !== d.col ) {
				classes.push( "unselectable" );
			}
		}

		return classes.join( " " );
	} );

	nodeUpdate.select( "circle" )
		.style( "stroke", strokeColorFn )
		.style( "fill", colorFn )
		.style( "stroke-width", function ( d ) {
			return d.canCollapse || d.canExpand ? d.nodeSize / 6 : 0;
		} )
		.attr( "r", function( d ) {
			return d.canCollapse || d.canExpand ? d.nodeSize - d.nodeSize / 12 : d.nodeSize;
		} )
		.attr( "class", function ( d ) {
			return ( d.children || d._children ) ? "branch" : "leaf";
		} );

	/*
	nodeUpdate.select( "rect" )
		.attr( "x", function( d ) {
			var offset = levels[d.depth-1].maxPointSize;
			if ( d.depth < levels.length ) {
				offset = -offset - levels[d.depth-1].textWidth;
			}
			return offset;
		} )
		.attr( "width", function( d ) {
			if ( !d.showLabel ) {
				return 0;
			}
			if ( 'textWidth' in d ) {
				return d.textWidth;
			}
			return Math.max(0, levels[d.depth-1].textWidth );
		} );
*/
	let wrap = function ( d ) {
		let that = d3.select( this ),
			width = "textWidth" in d ? d.textWidth : levels[d.depth - 1].textWidth,
			approxFit,
			textLength,
			text;

		that.text( d.name );
		textLength = that.node().getComputedTextLength();
		text = that.text();
		if ( textLength > width && text.length > 0 ) {
			approxFit = Math.ceil( width / ( textLength / text.length ) );
			text = text.slice( 0, approxFit );
		}
		while ( textLength > width && text.length > 0 ) {
			text = text.slice( 0, -1 );
			that.text( text + "…" );
			textLength = that.node().getComputedTextLength();
		}
	};

	let checkLabelNode = function ( d ) {
		if ( d.showLabel === false || levels[d.depth - 1].showLabels === false ) {
			d3.select( this ).select( ".label" ).remove();
			return;
		}

		let t = this.querySelector( ".label" );
		if ( !t ) { // enter
			t = d3.select( this ).append( "text" )
				.text( d.name )
				.attr( "class", "label" )
				.style( "fill-opacity", 1e-6 );
			if ( isIE ) {
				t.attr( "dy", ".30em" ); // IE does not support css property dominant-baseline which vertically centers the text, so we need to shift it manually
			}
		}

		// update
		d3.select( this ).select( ".label" )
			.text( d.name )
			.each( wrap )
			.attr( "text-anchor", labelAlignment )
			.attr( "transform", labelPosition )
			.style( "fill-opacity", 1.0 );
	};

	let checkSymbolNode = function ( d ) {

		if ( !d.symbol || d.nodeSize < 8 ) {
			d3.select( this ).select( ".symbol" ).remove();
			return;
		}

		let t;
		d._isSvgSymbol = false;

		if ( /^#/.exec( d.symbol ) ) {// svg link
			d3.select( this ).select( ".symbol-text" ).remove(); // remove other types of symbols
			d._isSvgSymbol = true;
			t = this.querySelector( ".symbol-svg" );
			if ( !t ) { // enter
				d3.select( this ).append( "use" )
					.attr( "class", "symbol symbol-svg" )
					.attr( "xlink:href", location.href + d.symbol )
					.attr( "transform", "scale(0.001, 0.001) translate(-370, -540)" );
			}
			else {
				t.setAttribute( "href", location.href + d.symbol );
			}
		}
		else { // text, icon
			d3.select( this ).select( ".symbol-svg" ).remove(); // remove other types of symbols
			t = this.querySelector( ".symbol-text" );
			let symbol = d.symbol;
			let match;
			let classes = "symbol symbol-text";

			if ( ( match = /^q-([0-9]{2,4})$/.exec( symbol ) ) ) { // qlik icon
				symbol = String.fromCharCode( match[1] );
				classes += " symbol-q";
			}
			else if ( ( match = /^m-([_a-z0-9]+)$/.exec( symbol ) ) ) { // material icon
				symbol = match[1];
				classes += " symbol-m";
			}

			if ( !t ) { // enter
				t = d3.select( this ).append( "text" )
					.text( symbol )
					.attr( "class", classes + " entering" );
			}

			// update
			let fontSize = sizeFn( d );
			if ( new Color( d.color ).isDark() ) {
				classes += " symbol-text--light";
			}
			t = d3.select( this ).select( ".symbol-text" )
				.text( symbol )
				.attr( "class", classes )
				.style( "font-size", fontSize * 1.0 + "px" );

			if ( isIE ) {
				t.attr( "dy", /symbol\-m/.exec( classes ) ? ".50em" : "0.30em" ); // IE does not support css property dominant-baseline which vertically centers the text, so we need to shift it manually
			}
		}
	};

	nodeUpdate.each( checkLabelNode );
	nodeUpdate.each( checkSymbolNode );

	nodeUpdate.select( ".symbol" )
		.attr( "transform", function ( d ) {
			let size = d.nodeSize;
			let scale = size / 20;

			return ( d._isSvgSymbol ? "scale(" + scale + "," + scale + ")" : "" ) + ( isRadial ? "rotate(" + ( -d.x + 90 ) + ")" : "" );
		} );

	let nodeExit = node.exit();
	if ( self.duration ) {
		nodeExit = nodeExit.transition()
			.duration( self.duration )
			.attr( "transform", exitingTransform );
	}
	nodeExit = nodeExit.remove();

	nodeExit.select( "circle" )
		.attr( "r", 1e-6 );

	nodeExit.select( ".label" )
		.style( "fill-opacity", 1e-6 );

	let links = tree.links( nodes );

	// Update the links…
	let link = self._root.selectAll( "path.link" )
		.data( links, function ( d ) {
			return d.target.id;
		} );

	// Enter any new links at the parent's previous position.
	let linkEnter = link.enter().insert( "path", "g" )
		.attr( "class", "link" )
		.attr( "d", function () {
			let o = { x: source._x, y: source._y };
			return diagonal( { source: o, target: o } );
		} )
		//.style("stroke", colorFn )
		.style( "stroke-width", 1e-6 );
	if ( self.duration ) {
		linkEnter = linkEnter.transition()
			.duration( self.duration );
	}
	linkEnter.attr( "d", diagonal );

	// Transition links to their new position.
	let linkUpdate = link.style( "stroke-width", sizeFn );
	if ( self.duration ) {
		linkUpdate = linkUpdate.transition()
			.duration( self.duration );
	}
	linkUpdate = linkUpdate.attr( "d", diagonal );

	linkUpdate.attr( "class", function( d ) {
		let s = "link",
			cellId = d.target.col + ";" + d.target.row;
		if ( self._isPathSelectActive && ( cellId in self._selectedCells || self._pathSelected[cellId] ) ) {
			s += " semi-selected";
		}
		return s;
	} );

	// Transition exiting nodes to the parent's new position.
	let linkExit = link.exit();
	if ( self.duration ) {
		linkExit = linkExit.transition()
			.duration( self.duration )
			.attr( "d", function () {
				let o = { x: source.x, y: source.y };
				return diagonal( { source: o, target: o } );
			} );
	}
	linkExit.remove();

	nodes.forEach( function ( n ) {
		n._x = n.x;
		n._y = n.y;
	} );
}

function _updateSize () {
	let w = this.$element.width(),
		h = this.$element.height();

	this._w = w;
	this._h = h;

	this._radius = Math.min( w, h ) / 2;

	this._padding = {
		left: 0,
		right: 0
	};
}

// svg defs contanining url to document defined elements need to have their
// refs updated to point to absolute path of the element due to the change of base href in client.html
function updateRefs( svg ) {
	$( svg ).find( "[fill^='url(']" ).each( function( i, el ) {
		let value = el.getAttribute( "fill" );
		let ref = /#([A-z0-9-]+)\)$/.exec( value );
		if ( ref && ref[1] ) {
			el.setAttribute( "fill", "url(" + location.href + "#" + ref[1] + ")" );
		}
	} );
}

function onLocationChange() {

	if ( globals.svgDefs ) {
		setTimeout( function() {
			if ( globals.svgDefs && globals.svgDefs.parentNode ) {
				updateRefs( globals.svgDefs );
			}
		} );
	}
}

let Dendrogram = DefaultView.extend( "Dendrogram", {
	init: function () {
		this._super.apply( this, arguments );

		globals.instances++;

		this.$element.children().first();
		let el = this.$element.children().length ? this.$element.children()[0] : this.$element[0];

		this.$element.addClass( "mek-dendrogram" );

		if ( !globals.svgDefs ) {
			let doc = new DOMParser().parseFromString( defs, "application/xml" );
			if ( doc.documentElement.querySelectorAll( "parsererror" ).length === 0 ) {
				globals.svgDefs = document.importNode( doc.documentElement, true );
				globals.svgDefs.style.position = "absolute";
				globals.svgDefs.style.opacity = "0";
				globals.svgDefs.style.zIndex = "-1";
			}
		}

		if ( globals.svgDefs && !globals.svgDefs.parentNode ) {
			document.body.appendChild( globals.svgDefs );
			updateRefs( globals.svgDefs );
			State.StateChanged.bind( onLocationChange );
		}

		let svg = d3.select( el ).append( "svg" )
			.attr( {
				xmlns: "http://www.w3.org/2000/svg",
				xlink: "http://www.w3.org/1999/xlink"
			} );

		//svg.append( "style" ).text( embedStyle );

		this._rotation = 0;

		this._svg = svg;
		this._root = svg.append( "g" )
			.attr( "class", "root" );

		this.dataSelections = {
			highlight: false,
			active: false
		};

	},
	resize: function () {
		_updateSize.call( this );

		let w = this._w;
		let h = this._h;

		let svg = this._svg;

		_update.call( this, this._data.root );

		let rootTransform = this._isRadial ? "translate(" + w / 2 + "," + h / 2 + ")" :
		"translate(" + this._padding.left + ", 0)";

		svg.attr( "width", w )
			.attr( "height", h )
			.select( ".root" )
			.transition()
			.duration( this.duration )
			.attr( "transform", rootTransform );
	},
	on: function () {
		this._super();

		this.$element.on( "mousewheel DOMMouseScroll", function ( e ) {
			e = e.originalEvent;
			e.preventDefault();
			let direction = ( e.detail < 0 || e.wheelDelta > 0 ) ? 1 : -1;
			this._rotation += 10 * direction;
			clearTimeout( this._rotationTimer );
			this._rotationTimer = setTimeout( function () {
				_update.call( this, this._data.root );
			}.bind( this ), 30 );

		}.bind( this ) );

		let self = this,
			dataPoint;

		$( document ).on( "keyup" + namespace, function ( e ) {
			if ( !self.backendApi.inSelections() ) {
				return;
			}
			if ( e.which === 27 ) {
				self.$scope.selectionsApi.cancel();
			}
			else if ( e.which === 13 ) {
				self.$scope.selectionsApi.confirm();
			}
		} );


		function onTap( e, d ) {
			if ( !self.dataSelections.highlight && e && e.shiftKey ) {
				toggle.call( self, d );
				return;
			}

			if ( !self.selectionsEnabled ) {
				return;
			}

			selections.select.call( self, d );
			_update.call( self, d );
		}

		Touche( this.$element[0] ).swipe( { // eslint-disable-line new-cap
			id: namespace,
			options: {
				touches: 1,
				threshold: 10
			},
			start: function ( e, data ) {
				if ( self.dataSelections.highlight || self._layout.qHyperCube.qAlwaysFullyExpanded ) {
					return;
				}
				dataPoint = d3.select( data.relatedTarget ).data();
			},
			update: function () {
				Touche.preventGestures( this.gestureHandler );
			},
			end: function ( e, data ) {
				let dir = data.swipe.direction,
					angle,
					d;

				if ( !dataPoint || !dataPoint[0] ) {
					return;
				}
				Touche.preventGestures( this.gestureHandler );
				d = dataPoint[0];

				if ( !self._isRadial ) {
					if ( dir === "left" && d.canExpand || dir === "right" && d.canCollapse ) {
						toggle.call( self, d );
					}
				}
				else {
					angle = Math.abs( data.swipe.angle - ( d.x + 90 ) % 360 );
					if ( d.canExpand && angle < 30 || d.canCollapse && Math.abs( angle - 180 ) < 30 ) {
						toggle.call( self, d );
					}
				}
			}
		} )
			.tap( {
				id: namespace,
				end: function ( e, data ) {
					let s = data.relatedTarget && data.relatedTarget.parentNode ? data.relatedTarget.parentNode.className : "";
					s = s.baseVal || s;
					if ( s.match( /node-selectable/ ) ) {
						onTap( e, d3.select( data.relatedTarget ).data()[0] );
					}
				}
			} );
	},
	off: function () {
		clearTimeout( this._rotationTimer );
		this._super();
		this.$element.off( "mousewheel DOMMouseScroll" );
		$( document ).off( "keyup" + namespace );
		Touche( this.$element[0] ).off( "*", namespace ); // eslint-disable-line new-cap
	},
	paint: function ( $element, layout ) {

		this.dataSelections.highlight = false;
		this.dataSelections.col = -1;

		let data = dataProcessor.process( layout ),
			w, h;

		//this._levels = data.levels;
		//this._maxLevelNodes = Math.max.apply( null, this._levels );
		this._isRadial = layout.radial;//false;//this._maxLevelNodes < 10 ? false : layout.radial;
		//data = data.root;
		this._data = data;
		this._layout = layout;
		this.levels = data.levels;
		//this._minMax = getMinMax( data.root, 'size' );

		_updateSize.call( this );

		w = this._w;
		h = this._h;

		data.root._x = h / 2;
		data.root._y = 0;

		let root = this._root;
		root.attr( "class", "root" );


		_update.call( this, this._toggledNode || this._data.root );
		this._toggledNode = null;

		let rootTransform = this._isRadial ? "translate(" + w / 2 + "," + h / 2 + ")" :
		"translate(" + this._padding.left + ", 0)";

		let svg = this._svg;
		svg.attr( "width", w )
			.attr( "height", h )
			.select( ".root" )
			.transition()
			.duration( this.duration )
			.attr( "transform", rootTransform );
	},
	togglePathSelect: function() {
		this._isPathSelectActive = !this._isPathSelectActive;
		if ( this.dataSelections.highlight ) {
			selections.switchSelectionModel.call( this, this._isPathSelectActive );
			//selections.select.call( this );
		}
		_update.call( this, this._data.root );
	},
	isPathSelectionActive: function() {
		return this._isPathSelectActive;
	},
	isPathSelectionDisabled: function() {
		return this._layout && this._layout.qHyperCube.qDimensionInfo.length < 2;
	},
	getSelectionToolbar: function () {
		let view = this;
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
	},
	selectValues: function ( cells, clearOld ) {
		selections.selectValues( this, cells, clearOld );
	},
	destroy: function() {
		globals.instances--;

		if ( globals.instances <= 0 && globals.svgDefs && globals.svgDefs.parentNode ){
			globals.svgDefs.parentNode.removeChild( globals.svgDefs );
			State.StateChanged.unbind( onLocationChange );
		}
	}
} );


export default Dendrogram;
