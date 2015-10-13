/*globals define, console*/
define( [
	'jquery',
	'qvangular',
	'translator',
	"general.utils/color",
	'./properties',
	'./locales',
	'objects.extension/controller',
	'objects.extension/default-view',
	'objects.extension/object-conversion',
	'objects.extension/default-selection-toolbar',
	'objects.backend-api/pivot-api',
	'objects.utils/event-utils',
	'./selection',
	'extensions.qliktech/pivot-table/properties/pivot-sorting/pivot-sorting',
	'client.property-panel/components/components',
	'./tooltip',
	'./data-processor',
	'text!./defs.html',
	'text!./style.css',

	'./d3',
	'objects.views/charts/tooltip/chart-tooltip-service'
],
function(
	$,
	qvangular,
	translator,
	Color,
	properties,
	locales,
	Controller,
	DefaultView,
	objectConversion,
	DefaultSelectionToolbar,
	PivotApi,
	EventUtils,
	selections,
	pivotSorting,
	components,
	tooltip,
	dataProcessor,
	defs,
	style
) {

	var duration = 500;
	var namespace = ".mekDendrogram";
	var PADDING = 4;
	var defaultColor = 'rgb(100, 150, 150)';
	
	translator.append( locales[translator.language] || locales["en-US"] );
	
	$( "<style>" + style + "</style>" ).appendTo( "head" );

	function onNodeMouseOver ( d, el, event, isRadial ) {
		tooltip.current.d = d;
		tooltip.current.el = el;
		tooltip.current.isRadial = isRadial;

		tooltip.activate();
	}

	function onNodeMouseLeave () {
		tooltip.inactivate();
	}

	var linearDiagonal = d3.svg.diagonal()
		.projection( function ( d ) {
			return [d.y, d.x];
		} );

	var radialDiagonal = d3.svg.diagonal.radial()
		.projection( function ( d ) {
			return [d.y, d.x / 180 * Math.PI]
		} );

	var radialTransformFn = function ( d ) {
		return "rotate(" + (d.x - 90) + ") translate(" + d.y + ")";
	};

	var linearTransformFn = function ( d ) {
		return "translate(" + d.y + "," + d.x + ")";
	};

	var radialTextAnchorFn = function ( d ) {
		return d.x < 180 ? "start" : "end";
	};

	var linearTextAnchorFn = function ( d ) {
		return d.canCollapse || d.canExpand || d.children ? "end" : "start";
	};

	var colorFn = function ( d ) {
		return ( d.target ? d.target.color : d.color ) || defaultColor;
	};

	var strokeColorFn = function ( d ) {
		return d.canCollapse || d.canExpand ? d3.rgb( colorFn( d ) ).darker().toString() : '';
	};
	
	function toggle( d ) {
		
		if ( d.canExpand ) {
			this.backendApi.expandLeft( d.row, d.col, false );
			this._toggledNode = d;
		}
		else if( d.canCollapse ) {
			this.backendApi.collapseLeft( d.row, d.col, false );
			this._toggledNode = d;
		}
	}

	function getMinMax ( node, prop ) {

		var max = -Number.MIN_VALUE,
			min = Number.MAX_VALUE;

		if ( node.children ) {
			node.children.forEach( function ( c ) {
				var m = getMinMax( c, prop );
				max = Math.max( max, m.max );
				min = Math.min( min, m.min );
			} );
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
	
	
	function updateSelectionStates() {
		
	}
	
	function spaceOutLinear( levels, width, labelWeight ) {

		var numLevelsThatNeedSpaceForLabel = 1;
		if( levels.length > 1 ) {
			numLevelsThatNeedSpaceForLabel = levels.length + 1;
			if ( !levels[0].showLabels ) {
				numLevelsThatNeedSpaceForLabel--;
			}
			if ( levels.length > 1 && !levels[levels.length - 1].showLabels ) {
				numLevelsThatNeedSpaceForLabel--;
			}
		}
		
		var spacing = width / (numLevelsThatNeedSpaceForLabel || 1);
		var remainder = width - 2 * levels.reduce( function( prev, level ){ return prev + level.maxPointSize; }, 0);
		var distanceBetween = remainder / (numLevelsThatNeedSpaceForLabel || 1);
		var offset = 0;

		
		
		levels.forEach( function ( level, i, arr ) {
			var lastLevel = levels[Math.max(0, levels.length - 1)];
			var distanceToPrevious = spacing - level.maxPointSize - (i ? levels[i - 1].maxPointSize : 0);
			var diff = (1 - labelWeight) * distanceBetween + labelWeight * remainder * level.glyphCountWeight - distanceToPrevious;
			var foo = i === 0 && !level.showLabels ? level.maxPointSize : ( spacing + diff );
			var textWidth = foo;
			if ( i >= levels.length - 1 && lastLevel.showLabels ) {
				offset = width - foo + lastLevel.maxPointSize;
				textWidth -= lastLevel.maxPointSize;
			}
			else {
				offset += foo;
			}

			if ( i > 0 && i < levels.length - 1 ) {
				textWidth -= levels[i-1].maxPointSize;
			}

			level.textWidth = textWidth - level.maxPointSize - PADDING * 2;
			level.offset = offset;
		} );
	}

	function canLabelFitHorizontally( level ) {
		var glyphCount = level.glyphCount;
		var spaceForLabels = level.textWidth;
		if ( !(spaceForLabels > 18 || spaceForLabels / (12 * glyphCount) > 1 ) ) {
			level.showLabels = false;
		}
	}
	
	function canLabelFitVertically( levels, height, maxPointSize ) {
		// set label visibility based on vertical spacing between nodes
		levels.forEach( function ( level ) {
			level.showLabels = true;
			level.numVisibleLabels = 0;
			level.minLabelDistance = height;
			var nodes = level.nodes.slice();
			var original = level.nodes;
			
			nodes.forEach( function( node, i ) {
				node._handledLabel = false;
				node.levelIndex = i;
				node.showLabel = false;
				//node.x += maxPointSize;
			} );
			nodes.sort( function( a, b ) {
				return b.nodeSize - a.nodeSize;
			} );
			
			nodes.forEach( function ( n, i, arr ) {

				if( n._handledLabel ) {
					return;
				}
				//n.y = i * height/arr.length;
				var dx = 0;
				var idx = n.levelIndex;
				var prevX = 0;
				var nextX = 0;
				
				var space = 8;
				
				var touchesNeighbour = false;
				if ( idx === 0 ) {
					prevX = 2 * n.x;
				}
				else {
					touchesNeighbour = n.x - n.nodeSize < original[idx-1].x + original[idx-1].nodeSize;
					do {
						prevX = n.x - original[--idx].x;
					} while( prevX < space && idx > 0 && !original[idx].showLabel )
					if( idx === 0 && !original[idx].showLabel ) { // add additional space available above the first node
						prevX += 2*original[idx].x;
					}
				}

				idx = n.levelIndex;
				if ( idx === arr.length - 1 ) {
					nextX = 2 * (height - n.x);
				}
				else {
					touchesNeighbour = touchesNeighbour || (n.x + n.nodeSize > original[idx+1].x - original[idx+1].nodeSize);
					do {
						nextX = original[++idx].x - n.x;
					} while( nextX < space && idx < arr.length - 1 && !original[idx].showLabel )
					if( idx === arr.length-1 && !original[idx].showLabel ) { // add additional space available after the last node
						nextX += 2*(height-original[idx].x);
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
		var levels = data.levels,
			adaptiveStrokeWidth = layout.adaptiveStrokeWidth;
		
		var maxCircleSize = Math.min( 80, 0.25 * width / (levels.length || 1) );
		levels.forEach( function ( level ) {
			maxCircleSize = Math.min( maxCircleSize, 0.5 * height / (level.nodes.length || 1) );
		} );

		var prevMax = maxCircleSize;
		levels.forEach( function ( level ) {
			maxCircleSize = Math.min( maxCircleSize, 0.5 * (height-maxCircleSize) / (level.nodes.length || 1) );
		} );

		// point size in radius
		var minPointSize = Math.max( 2, maxCircleSize * (layout.dataPoint && layout.dataPoint.size ? layout.dataPoint.size[0] : 1) );
		var maxPointSize = Math.max( 2, maxCircleSize * (layout.dataPoint && layout.dataPoint.size ? layout.dataPoint.size[1] : 1) );

		var sizing = d3.scale.linear().domain( [data.min, data.max] ).rangeRound( [minPointSize, maxPointSize] ).clamp( true );

		var sizeFn = function ( d ) {
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
				maxPointSize: sizing( level.max )
			};
		} );

		var tree = d3.layout.tree().size( [height, width] ).separation( function ( a, b ) {
			return sizing( a.size ) + sizing( b.size );
		} );

		var nodes = tree.nodes( data.root ).reverse();
		nodes.pop();
		
		nodes.forEach( function( node ) {
			node.nodeSize = sizing( node.size );
		} );
		
		canLabelFitVertically( levels, height, maxPointSize );
		
		var labelWeight = 'labelWeight' in layout ? layout.labelWeight : 0.5;
		
		spaceOutLinear( levels, width, labelWeight );
	
		if ( levels.length > 1 ) {
			canLabelFitHorizontally( levels[levels.length-1] );
			canLabelFitHorizontally( levels[0] );
			
			spaceOutLinear( levels, width, labelWeight );
		}
		
		if ( levels.length > 2 ) {
			levels.slice(1, levels.length ).forEach( canLabelFitHorizontally );
		}
		
		nodes.forEach( function ( d ) {
			d.y = levels[( d.depth - 1)].offset;
		} );
		
		var linearTextTransform = function ( d ) {
			return "translate(" + (d.depth < levels.length ? -1 : 1) * (PADDING+levels[d.depth-1].maxPointSize) + ")";
		};

		var textAlignTransform = function ( d ) {
			return d.depth < levels.length ? "end" : "start";
		}
		
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
		}
	}
	
	
	function getMaxCircleSize( levels, radius ) {
		levels.forEach( function ( level, i ) {
			maxCircleSize = Math.min( maxCircleSize, Math.PI * radiusSpacing * (i + 1) / (level.nodes.length || 1) );
		} );
	}

	function spaceOutRadial( levels, radius, labelWeight ) {

		var numLevelsThatNeedSpaceForLabel = levels.length + 1;
		if ( !levels[levels.length - 1].showLabels ) {
			numLevelsThatNeedSpaceForLabel--;
		}
		
		levels.forEach( function( level ) {
			level.minRadius = level.maxPointSize * level.nodes.length / Math.PI;
		} );

		var spacing = radius / (numLevelsThatNeedSpaceForLabel || 1);
		var remainder = radius - 2 * levels.reduce( function( prev, level ){ return prev + level.maxPointSize; }, 0);
		var distanceBetween = remainder / (numLevelsThatNeedSpaceForLabel || 1);
		
		var offset = 0;
		
		levels.slice().reverse().forEach( function ( level, i, arr ) {
			var distanceToPrevious = spacing - level.maxPointSize - (i ? arr[i - 1].maxPointSize : 0);
			var diff = (1 - labelWeight) * distanceBetween + labelWeight * remainder * level.glyphCountWeight - distanceToPrevious;
			var foo = i === 0 && !level.showLabels ? level.maxPointSize : ( spacing + diff );
			var textWidth = foo;
			offset += foo;
			//var offsetDiff = radius - offset - level.minRadius;
			//if( offsetDiff < 0 ) {
			//	textWidth += offsetDiff;
			//}
			
			if( i > 0 ) {
				textWidth -= arr[i-1].maxPointSize;
			}
			level.textWidth = textWidth - level.maxPointSize - 2 * PADDING;
			level.offset = radius - offset;//Math.max( level.minRadius, radius - offset );
		} );
	}
	
	function _canLabelFitRadially( levels, radius, maxPointSize ) {
		levels.forEach( function( level ) {
			level.hasVisibleLabels = false;
			level.nodes.forEach( function( node, i, arr ) {
				node.showLabel = false;
				var prev = arr[i ? i-1 : arr.length - 1].x;
				var next = arr[i < arr.length - 1 ? i+1 : 0].x;
				var dx = Math.min( Math.abs( arr[i].x - prev ), Math.abs( next - arr[i].x ) );
				dx *= Math.PI * level.offset / 180;
				if( arr.length < 2 || dx > 62 ) {
					node.showLabel = true;
					level.hasVisibleLabels = true;
				}
			} );

			if( !level.hasVisibleLabels ) {
				level.showLabels = false;
			}
		} );
	}

	function canLabelFitRadially( levels, radius, maxPointSize ) {
		levels.forEach( function( level ) {
			level.showLabels = true;
			level.numVisibleLabels = 0;
			level.minLabelDistance = 180 * Math.PI * level.offset;

			var nodes = level.nodes.slice();
			var original = level.nodes;

			nodes.forEach( function( node, i ) {
				node.levelIndex = i;
				node.showLabel = false;
			} );
			nodes.sort( function( a, b ) {
				return b.size - a.size;
			} );


			nodes.forEach( function( n, i, arr ) {
				
				var idx = n.levelIndex;
				var prevX = 0;
				var nextX = 0;
				var space = 10;
				var looped = false;
				
				do {
					--idx;
					if ( idx === -1 && !looped ) {
						looped = true;
						idx = arr.length-1;
					}
					else if( looped ) {
						break;
					}
					
					prevX = n.x - original[idx].x;
					if( prevX < 0 ) {
						prevX = n.x - original[idx].x + 360;
					}
					prevX *= Math.PI * level.offset / 180;
					
				} while( prevX < space && !original[idx].showLabel )
				
				idx = n.levelIndex;
				looped = false;
				do {
					++idx;
					if( idx >= arr.length && !looped ) {
						looped = true;
						idx = 0;
					}
					else if( looped ) {
						break;
					}
					
					nextX = original[idx].x - n.x;
					if ( nextX < 0 ) {
						nextX += 360;
					}
					nextX *= Math.PI * level.offset / 180;
				} while( nextX < space && !original[idx].showLabel )
				
				n.showLabel = prevX >= space && nextX >= space;
				
				if( n.showLabel ) {
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
	
	function calculateRadial( data, layout, width, height ) {
		var levels = data.levels,
			arcSize = 360,
			adaptiveStrokeWidth = layout.adaptiveStrokeWidth,
			labelWeight = 0;//'labelWeight' in layout ? layout.labelWeight : 0.5;

		var radius = 0.5 * Math.min( width, height ),
			radiusSpacing = radius / levels.length;
		
		var maxCircleSize = Math.min( 80, 0.5 * radius / (levels.length || 1) );

		levels.forEach( function ( level, i ) {
			maxCircleSize = Math.min( maxCircleSize, 0.5 * Math.PI * radiusSpacing * (i + 1) / (level.nodes.length || 1) );
		} );
		
		// point size in radius
		var minPointSize = Math.max(2, maxCircleSize * (layout.dataPoint && layout.dataPoint.size ? layout.dataPoint.size[0] : 1) );
		var maxPointSize = Math.max(2, maxCircleSize * (layout.dataPoint && layout.dataPoint.size ? layout.dataPoint.size[1] : 1) );
		var sizing = d3.scale.linear().domain( [data.min, data.max] ).rangeRound( [minPointSize, maxPointSize] ).clamp( true );
			
		levels = levels.map( function ( level, i ) {
			return {
				showLabels: true,
				nodes: level.nodes,
				glyphCount: level.glyphCount,
				glyphCountWeight: level.glyphCountWeight,
				maxPointSize: sizing( level.max )
			};
		} );
		
		spaceOutRadial( levels, radius, labelWeight );

		var tree = d3.layout.tree().size( [arcSize, radius] )
			.separation( function ( a, b ) {
				return ( (a.parent === b.parent ? 1 : 2) / (a.depth || 1) );
			} );

		var nodes = tree.nodes( data.root ).reverse();
		nodes.pop();

		canLabelFitRadially( levels, radius, maxPointSize);
		
		levels.forEach( canLabelFitHorizontally );

		spaceOutRadial( levels, radius, labelWeight );
		
		//sizing = d3.scale.linear().domain( [data.min, data.max] ).rangeRound( [minPointSize, maxPointSize] ).clamp( true );

		var sizeFn = function ( d ) {
			d.nodeSize = d.target ? adaptiveStrokeWidth ? sizing( d.target.size ) : 1 : // d.target exists for node links
				sizing( d.size );
			return d.nodeSize;
		};

		
		var tree = d3.layout.tree().size( [arcSize, radius] )
			.separation( function ( a, b ) {
				return ( (a.parent === b.parent ? 1 : 2) / (a.depth || 1) );
				//return ( sizing( a.size ) + sizing( b.size ) ) * ( (a.parent === b.parent ? 1 : 2) / (a.depth || 1) );
				//return (sizing(a.size) + sizing( b.size )) / a.depth;
			} );



		nodes.forEach( function ( d ) {
			d.x = (((d.x + 90 + (arcSize === 360 ? 0 : 0) ) % 360) + 360 ) % 360;
			
			d.y = levels[d.depth-1].offset;
			
			if ( d.depth >= levels.length ) {
				var px = 0.5 * width;
				var py = 0.5 * height;
				var vx = Math.cos( (d.x - 90) * Math.PI/180 );
				var vy = Math.sin( (d.x - 90) * Math.PI/180 );

				var tl = -px/vx;
				var tr = 0.5 * width/vx;
				var tb = 0.5 * height/vy;
				var tt = -py/vy;

				var t = Math.min.apply( null, [tl, tr, tb, tt].filter(function(v){return v >= 0;}) );
				var x = px + t*vx;
				var y = py + t*vy;

				x -= px;
				y -= py;

				var c = Math.sqrt( x * x + y * y );
				d.textWidth = c - levels[d.depth-1].offset - levels[d.depth-1].maxPointSize - PADDING;
			}
		} );
		
		

		var textTransformFn = function ( d ) {
			return d.x < 180 ? "translate(" + (PADDING + levels[d.depth-1].maxPointSize) + ")" : "rotate(180) translate(-" + (PADDING + (levels[d.depth-1].maxPointSize)) + ")";
		};

		var radialTextAnchorFn = function ( d ) {
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
		}
	}
	
	function _update( source ) {
		clearTimeout( this._rotationTimer );
		var self = this,
			width = self._w,
			height = self._h,
			isRadial = this._isRadial;
		
		var values = isRadial ? calculateRadial( this._data, this._layout, this._w, this._h ) :
			calculateLinear( this._data, this._layout, this._w, this._h );
		
		var levels = values.levels;
		var nodes = values.nodes;
		var sizeFn = values.sizeFn;
		var labelPosition = values.nameLabeling.position;
		var labelAlignment = values.nameLabeling.align;
		var tree = values.tree;
		
		
		var minLabelSpace = Math.min.apply( null, levels.map( function( level ) {
			return level.minLabelDistance;
		} ) );
		
		this.$element.removeClass("f-size-m f-size-s f-size-xs");
		if( minLabelSpace !== null && !isNaN(minLabelSpace) && minLabelSpace < 13 ) {
			this.$element.addClass( minLabelSpace < 11 ? 'f-size-xs':
				minLabelSpace < 12 ? 'f-size-s' : 'f-size-m');
		}

		
		var diagonal = isRadial ? radialDiagonal : linearDiagonal;
		var transformFn = isRadial ? radialTransformFn : linearTransformFn;
		//var textAnchorFn = isRadial ? radialTextAnchorFn : linearTextAnchorFn;


		var enteringTransform = isRadial ?
		"rotate(" + (source._x - 90) + ") translate(" + source._y + ")" :
		"translate(" + source._y + "," + source._x + ")";

		var exitingTransform = isRadial ?
		"rotate(" + (source.x - 90) + ") translate(" + source.y + ")" :
		"translate(" + source.y + "," + source.x + ")";

		//nodes.forEach(function( d ) {
		//	d.y = d.depth * 240;
		//});

		// update existing nodes
		var node = self._root.selectAll( "g.node" )
			.data( nodes, function ( d, i ) {
				return d.id || (d.id = ++i);
			} );

		// attach new nodes to parent's previous position (position to transition from) 
		var nodeEnter = node.enter().append( "g" )
			.attr( "class", function ( d ) {
				return "node " + ((d.children || d._children) ? 'branch' : "leaf");
			} )
			.attr( "transform", enteringTransform )
			.on( "mouseenter", function ( d ) {
				onNodeMouseOver( d, this, d3.event, isRadial );
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

		var nodeUpdate = node.transition()
			.duration( duration )
			.attr( "transform", transformFn );
		//.style( 'stroke-width', function ( d ) {
		//	return Math.sqrt( d.size ) / 150;
		//} );

		nodeUpdate.attr( "class", function ( d ) {
			var classes = ['node'],
				cellId = d.col + ";" + d.row;
			classes.push( (d.children || d._children) ? 'branch' : 'leaf' );
			if ( d.canExpand || d.canCollapse ) {
				classes.push( 'node-expandable' );
			}
			if ( !d.isLocked && (!self.mySelections.active || self.mySelections.active && self.mySelections.col === d.col) ) {
				classes.push( "node-selectable" );
			}
			if ( self.mySelections.active ) {
				if( !self._isPathSelectActive ) {
					if ( d.col in self._selectedElemNo && d.elemNo in self._selectedElemNo[d.col] ) {
						classes.push( 'node-selected' );
					}
					else if ( self.mySelections.col !== d.col ) {
						classes.push( 'unselectable' );
					}
				}
				else if( self._selectedCells && (cellId in self._selectedCells) ) {
					classes.push( 'node-selected' );
				}
				else if( self._pathSelected && self._pathSelected[cellId] ) {
					classes.push( 'node-semi-selected' );
				}
				else if ( self.mySelections.col !== d.col ) {
					classes.push( 'unselectable' );
				}
			}

			return classes.join( " " );
		} );

		nodeUpdate.select( "circle" )
			.style( "stroke", strokeColorFn )
			.style( "fill", colorFn )
			.style( "stroke-width", function ( d ) {
				return d.canCollapse || d.canExpand ? sizeFn( d ) / 6 : 0;
			} )
			.attr( "r", sizeFn )
			.attr( "class", function ( d ) {
				return (d.children || d._children) ? 'branch' : "leaf";
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
		var wrap = function ( d ) {
			var self = d3.select( this ),
				dx, dy,
				width = 'textWidth' in d ? d.textWidth : levels[d.depth-1].textWidth,
				approxFit,
				textLength,
				text;
			
			self.text( d.name );
			textLength = self.node().getComputedTextLength();
			text = self.text();
			if ( textLength > width && text.length > 0 ) {
				approxFit = Math.ceil( width / (textLength / text.length) );
				text = text.slice( 0, approxFit );
			}
			while ( textLength > width && text.length > 0 ) {
				text = text.slice( 0, -1 );
				self.text( text + '…' );
				textLength = self.node().getComputedTextLength();
			}
		};

		var checkLabelNode = function ( d ) {
			if ( d.showLabel === false || levels[d.depth-1].showLabels === false ) {
				d3.select( this ).select( ".label" ).remove();
				return;
			}

			var t = this.querySelector( ".label" );
			if ( !t ) { // enter
				d3.select( this ).append( "text" )
					.text( d.name )
					.attr( "dy", ".35em" )
					.attr( 'class',  "label" )
					.style( "fill-opacity", 1e-6 );
			}

			// update
			d3.select( this ).select( ".label" )
				.text( d.name )
				.each( wrap )
				.attr( "text-anchor", labelAlignment )
				.attr( 'transform', labelPosition )
				.transition()
				.duration( duration )
				.style( "fill-opacity", 1 );
		};
		
		var checkSymbolNode = function ( d ) {

			if ( !d.symbol || d.nodeSize < 8 ) {
				d3.select( this ).select( ".symbol" ).remove();
				return;
			}
			
			var t;
			d._isSvgSymbol = false;
			
			if ( /^#/.exec( d.symbol ) ) {// svg link
				d3.select( this ).select( ".symbol-text" ).remove(); // remove other types of symbols
				d._isSvgSymbol = true;
				t = this.querySelector( ".symbol-svg" );
				if ( !t ) { // enter
					d3.select( this ).append( "use" )
						.attr( "class", "symbol symbol-svg" )
						.attr( "xlink:href", d.symbol )
						.attr( "transform", "scale(0.001, 0.001) translate(-370, -540)" );
				}
				else {
					t.setAttribute( "href", d.symbol );
				}
			}
			else { // text, icon
				d3.select( this ).select( ".symbol-svg" ).remove(); // remove other types of symbols
				t = this.querySelector( ".symbol-text" );
				var symbol = d.symbol;
				
				var isIcon = /^\(([0-9]{2,3})\)$/.exec( symbol );
				if ( isIcon ) {
					symbol = String.fromCharCode(isIcon[1]);
				}
				if ( !t ) { // enter
					d3.select( this ).append( "text" )
						.text( symbol )
						.attr( "text-anchor", "middle")
						.attr( 'class',  "symbol symbol-text" )
						.style( "fill-opacity", 1e-6 );
				}

				// update
				var fontSize = sizeFn( d );
				var color = 'color' in d ? d.color : defaultColor; 
				var isDarkBackColor = Color.isDark( d.color ); 
				d3.select( this ).select( ".symbol-text" )
					.text( symbol )
					.attr( "class", "symbol symbol-text" + (isIcon ? " symbol-icon" : "") )
					.transition()
					.duration( duration )
					.style( "fill", isDarkBackColor ? "#fff" : "#666")
					.style( "fill-opacity", 1 )
					.style( "font-size", fontSize * 1.2 )
			}
		};

		nodeUpdate.each( checkLabelNode );
		nodeUpdate.each( checkSymbolNode );

		nodeUpdate.select( ".symbol" )
			.attr( "transform", function ( d ) {
				var size = sizeFn( d );
				var scale = size / 20;
				
				return (d._isSvgSymbol ? "scale(" + scale + "," + scale + ")" : "") + (isRadial ? "rotate(" + (-d.x + 90) + ")" : "");
			} );

		var nodeExit = node.exit().transition()
			.duration( duration )
			.attr( "transform", exitingTransform )
			.remove();

		nodeExit.select( "circle" )
			.attr( "r", 1e-6 );

		nodeExit.select( ".label" )
			.style( 'fill-opacity', 1e-6 );

		var links = tree.links( nodes );

		// Update the links…
		var link = self._root.selectAll( "path.link" )
			.data( links, function ( d ) {
				return d.target.id;
			} );

		// Enter any new links at the parent's previous position.
		link.enter().insert( "path", "g" )
			.attr( "class", "link" )
			.attr( "d", function () {
				var o = {x: source._x, y: source._y};
				return diagonal( {source: o, target: o} );
			} )
			//.style("stroke", colorFn )
			.style( 'stroke-width', 1e-6 )
			.transition()
			.duration( duration )
			.attr( "d", diagonal );

		// Transition links to their new position.
		var linkUpdate = link.transition()
			.duration( duration )
			.style( 'stroke-width', sizeFn )
			.attr( "d", diagonal );

		linkUpdate.attr( "class", function( d ) {
			var s = "link",
				cellId = d.target.col + ";" + d.target.row;
			if( self._isPathSelectActive && (cellId in self._selectedCells || self._pathSelected[cellId]) ) {
				s += " semi-selected";
			}
			return s;
		} );

		// Transition exiting nodes to the parent's new position.
		link.exit().transition()
			.duration( duration )
			.attr( "d", function () {
				var o = {x: source.x, y: source.y};
				return diagonal( {source: o, target: o} );
			} )
			.remove();

		nodes.forEach( function ( n ) {
			n._x = n.x;
			n._y = n.y;
		} );
	}

	function _updateSize () {
		var w = this.$element.width(),
			h = this.$element.height();

		this._w = w;
		this._h = h;

		this._radius = Math.min( w, h ) / 2;

		var minPointSize = Math.max( 1, this._radius / 100 );
		var maxPointSize = Math.min( 40, Math.max( this._radius / 20, 2 ) );

		//this._pointSize = {min: minPointSize, max: maxPointSize};
		//this._sizing = d3.scale.linear().domain( [this._minMax.min, this._minMax.max] ).rangeRound( [minPointSize, maxPointSize] ).clamp( true );

		this._padding = {
			left: 0,
			right: 0
		};
	}

	var DendrogramView = DefaultView.extend( {
		init: function () {
			this._super.apply( this, arguments );
			
			//$("<div class='marker p-50-50'></div><div class='marker p-25'></div><div class='marker p-33'></div><div class='marker p-50'></div><div class='marker p-66'></div><div class='marker p-75'></div>" ).appendTo( this.$element );

			this.$element.addClass( "mek-dendrogram" );
			d3.select( this.$element[0] ).append( "svg" )
				.attr( {
					xmlns: "http://www.w3.org/2000/svg",
					xlink: "http://www.w3.org/1999/xlink"
				} ).style( 'display', 'none' );
			
			
			
			var svg = d3.select( this.$element[0] ).append( "svg" )
				.attr( {
					xmlns: "http://www.w3.org/2000/svg",
					xlink: "http://www.w3.org/1999/xlink"
				} );

			this.$element.find( "svg" ).eq(0 ).html( defs );

			//svg.append( "style" ).text( embedStyle );

			this._rotation = 0;
			
			this._svg = svg;
			this._root = svg.append( "g" )
				.attr( "class", "root" );

			$timeout = qvangular.getService( "$timeout" );

		},
		resize: function () {
			_updateSize.call( this );

			var w = this._w;
			var h = this._h;

			var svg = this._svg;

			_update.call( this, this._data.root );

			var rootTransform = this._isRadial ? "translate(" + w / 2 + "," + h / 2 + ")" :
			"translate(" + this._padding.left + ", 0)";

			svg.attr( "width", w )
				.attr( "height", h )
				.select( ".root" )
				.transition()
				.duration( duration )
				.attr( "transform", rootTransform );
		},
		on: function () {
			this._super();

			this.$element.on( "mousewheel DOMMouseScroll", function ( e ) {
				e = e.originalEvent;
				e.preventDefault();
				var direction = (e.detail < 0 || e.wheelDelta > 0) ? 1 : -1;
				this._rotation += 10 * direction;
				clearTimeout( this._rotationTimer );
				this._rotationTimer = setTimeout( function () {
					_update.call( this, this._data.root );
				}.bind( this ), 30 )

			}.bind( this ) );
			
			var self = this,
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
				if ( !self.mySelections.active && e && e.shiftKey ) {
					toggle.call( self, d );
					return;
				}

				if ( !self.selectionsEnabled ) {
					return;
				}

				selections.select.call( self, d );
				_update.call( self, d );
			}

			Touche( this.$element[0] ).swipe( {
				id: namespace,
				options: {
					touches: 1,
					threshold: 10
				},
				start: function ( e, data ) {
					if ( self.mySelections.active || self._layout.qHyperCube.qAlwaysFullyExpanded ) {
						return;
					}
					dataPoint = d3.select( data.relatedTarget ).data();
				},
				update: function () {
					Touche.preventGestures( this.gestureHandler );
				},
				end: function ( e, data ) {
					var dir = data.swipe.direction,
						angle,
						d;

					if ( !dataPoint || !dataPoint[0] ) {
						return;
					}
					Touche.preventGestures( this.gestureHandler );
					var d = dataPoint[0];

					if ( !self._isRadial ) {
						if ( dir === 'left' && d.canExpand || dir === 'right' && d.canCollapse ) {
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
						var s = data.relatedTarget && data.relatedTarget.parentElement ? data.relatedTarget.parentElement.className : '';
						s = s.baseVal || s;
						if ( s.match(/node-selectable/) ) {
							onTap( e, d3.select(data.relatedTarget ).data()[0] )
						}
					}
				} );
		},
		off: function () {
			clearTimeout( this._rotationTimer );
			this._super();
			this.$element.off( "mousewheel DOMMouseScroll" );
			$( document ).off( "keyup" + namespace );
			Touche( this.$element[0] ).off( "*", namespace );
		},
		paint: function ( $element, layout ) {

			if ( !this.mySelections ) {
				this.mySelections = {
					active: false
				};
			}

			this.mySelections.active = false;
			this.mySelections.col = -1;

			var data = dataProcessor.process( layout ),
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

			var root = this._root;
			root.attr( "class", 'root' );
			
			
			_update.call( this, this._toggledNode || this._data.root );
			this._toggledNode = null;

			var rootTransform = this._isRadial ? "translate(" + w / 2 + "," + h / 2 + ")" :
			"translate(" + this._padding.left + ", 0)";

			var svg = this._svg;
			svg.attr( "width", w )
				.attr( "height", h )
				.select( ".root" )
				.transition()
				.duration( duration )
				.attr( "transform", rootTransform );
		},
		togglePathSelect: function() {
			this._isPathSelectActive = !this._isPathSelectActive;
			if ( this.mySelections.active ) {
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
			var view = this;
			return new DefaultSelectionToolbar( this.$scope.backendApi, this.$scope.selectionsApi, false, false, [{
				  name: "",
				  isIcon: true,
				  buttonClass: "sel-toolbar-icon-toggle",
				  iconClass: "icon-link",
				  action: function () {
					  view.togglePathSelect();
				  },
				  isActive: function () {
					  var active = view.isPathSelectionActive();
					  this.name = active ? "mek.turnOffPathSelect" : "mek.turnOnPathSelect";
					  return active;
				  },
				  isDisabled: function () {
					  if ( view.isPathSelectionDisabled() ) {
						  return true;
					  }
					  return false;
				  }
				}], [] );
		},
		selectValues: function ( cells, clearOld ) {
			selections.selectValues( this, cells, clearOld );
		}
	} );
	
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
				nax: 10
			},
			measures: {
				min: 1,
				max: 1
			}
		},
		View: DendrogramView,
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