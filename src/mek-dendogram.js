/*globals define, console*/
define( [
	'qvangular',
	'./properties',
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
	qvangular,
	properties,
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

	var embedStyle = "/* <![CDATA[ */ " + style + " /* ]]> */";
	var duration = 500;
	
	/*
	function select ( node ) {
		if ( node.elemNo < 0 && node.elemNo !== -3 ) {
			return;
		}

		if ( node.isLocked ) {
			EventUtils.showLockedFeedback( [this._layout.qHyperCube.qDimensionInfo[node.col]] );
			return;
		}

		if ( !this._selectedElemNo ) {
			this._selectedElemNo = {};
		}

		if ( this.mySelections.active ) {
			if ( node.col !== this.mySelections.col ) {
				return;
			}
		}
		else {
			this.mySelections.active = true;
			this._root.attr( "class", "root inSelections" );
			this.mySelections.col = node.col;
		}

		var selected = !(node.elemNo in this._selectedElemNo);

		if ( !selected ) {
			delete this._selectedElemNo[node.elemNo];
		}
		else {
			this._selectedElemNo[node.elemNo] = node.row;
		}

		var selectedRows = [];
		for ( var e in this._selectedElemNo ) {
			selectedRows.push( this._selectedElemNo[e] );
		}

		this.selectValues( node.col, selectedRows );
	}
	*/

	/*
	function clearSelections ( endSelections ) {
		this._selectedElemNo = {};

		if ( endSelections ) {
			this.mySelections.active = false;
			this._root.attr( "class", "root" );
		}
	}
	*/

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
		return ( d.target ? d.target.color : d.color ) || 'rgb(100, 150, 150)';
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

	/*function toggle(d) {
		if ( d.children ) {
			d._children = d.children;
			d.children = null;
		}
		else if( d._children ) {
			d.children = d._children;
			d._children = null;
		}
	}*/

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

	function _update( source ) {
		clearTimeout( this._rotationTimer );
		var self = this,
			radius = this._radius,
			levels = this._levels,
			maxNumLevels = this._layout.qHyperCube.qDimensionInfo.length,
			temp,
			isRadial = this._isRadial;

		var maxLevelNodes = Math.max.apply( null, levels );

		var minPointSize = 2;
		var maxPointSize = 40;

		if ( isRadial ) {
			var maxArcLength = Math.PI * radius / maxLevelNodes;
			maxPointSize = Math.min( maxPointSize, Math.max( maxArcLength / 2, minPointSize * 4 ) );
			minPointSize = Math.min( maxPointSize / 4, maxArcLength / 8 );
		}
		else {
			var boo = Math.min( self._width / maxLevelNodes, self._height / levels.length );
			minPointSize = Math.max( minPointSize, boo / 8 );
			maxPointSize = Math.max( minPointSize, Math.min( maxPointSize, Math.max( boo / 2, 2 ) ) );
		}

		self._pointSize = {min: minPointSize, max: maxPointSize};
		self._sizing = d3.scale.linear().domain( [self._minMax.min, self._minMax.max] ).rangeRound( [minPointSize, maxPointSize] ).clamp( true );

		temp = maxLevelNodes * maxPointSize / Math.PI;

		var arcSize = 360;

		levels = levels.map( function ( n ) {
			return {
				showLabels: isRadial ? (radius * 2 * Math.PI) / n > 16 : self._width / n > 8,
				nodes: n
			};
		} );

		var treeWidth = self._height;
		var textWidths = [];
		if ( !isRadial ) {
			self._padding.left = maxPointSize + maxPointSize / 6;
			self._padding.right = maxPointSize + maxPointSize / 6;
			// if more than one level and level one visible -> add padding to left
			if ( maxNumLevels > 1 && levels[0].showLabels ) {
				temp = Math.min( (this._w - (maxPointSize * 2 + 8) * levels.length) * (1 / levels.length), this._layout.qHyperCube.qDimensionInfo[0].qApprMaxGlyphCount * 12 );
				if ( temp >= 24 ) {
					self._padding.left += temp + 8;
				}
				else {
					levels[0].showLabels = false;
				}
			}
			if ( maxNumLevels === levels.length && levels[levels.length - 1] && levels[levels.length - 1].showLabels ) {
				temp = Math.min( (this._w - (maxPointSize * 2 + 8) * levels.length) * (1 / levels.length), this._layout.qHyperCube.qDimensionInfo.slice( -1 )[0].qApprMaxGlyphCount * 12 );
				if ( temp >= 24 ) {
					self._padding.right += temp + 8;
				}
				else {
					levels[levels.length - 1].showLabels = false;
				}
			}
			treeWidth -= (self._padding.left + self._padding.right);

			textWidths = levels.map( function ( ) {
				return (treeWidth / (levels.length - 1 || 1)) - 8 - maxPointSize * 2;
			} );

			if ( maxNumLevels > 1 && levels[0].showLabels ) {
				textWidths[0] = self._padding.left - 8 - maxPointSize;
			}
			if ( maxNumLevels === levels.length && levels[levels.length - 1] && levels[levels.length - 1].showLabels ) {
				textWidths[levels.length - 1] = self._padding.right - 8 - maxPointSize;
			}

			textWidths.forEach( function ( w, i ) {
				if ( w < 24 ) {
					levels[i].showLabels = false;
				}
			}, this );
		}
		else {
			radius -= maxPointSize;
			temp = Math.min( (radius - (maxPointSize * 2 + 8) * levels.length) * Math.min( 0.5, 1 / levels.length ), this._layout.qHyperCube.qDimensionInfo.slice( -1 )[0].qApprMaxGlyphCount * 12 );
			if ( levels[levels.length - 1].showLabels && temp >= 24 ) {
				radius -= temp;
			}
			levels.forEach( function ( level, i ) {
				textWidths.push( radius / ( levels.length ) - maxPointSize * 2 - 16 );
				if ( textWidths[i] < 24 && i < levels.length - 1 ) {
					level.showLabels = false;
				}
			} );
			textWidths[levels.length - 1] = temp;
			levels[levels.length - 1].showLabels = levels[levels.length - 1].showLabels && temp >= 24;
		}

		var linearTree = d3.layout.tree().size( [self._width, treeWidth] ).separation( function ( a, b ) {
			return self._sizing( a.size ) + self._sizing( b.size );
		} );

		var radialTree = d3.layout.tree().size( [arcSize, radius] )
			.separation( function ( a, b ) {
				return ( self._sizing( a.size ) + self._sizing( b.size ) ) * ( (a.parent === b.parent ? 1 : 2) / (a.depth || 1) );
				//return (sizing(a.size) + sizing( b.size )) / a.depth;
			} );

		var sizeFn = function ( d ) {
			d.nodeSize = d.target ? self._layout.adaptiveStrokeWidth ? self._sizing( d.target.size ) : 1 : // d.target exists for node links
				self._sizing( d.size );
			return d.nodeSize;
		};

		var radialTextTransformFn = function ( d ) {
			return d.x < 180 ? "translate(" + (8 + self._pointSize.max) + ")" : "rotate(180) translate(-" + (8 + self._pointSize.max) + ")";
		};

		var linearTextTransform = function ( d ) {
			return "translate(" + (d.canExpand || d.children ? -1 : 1) * (8 + self._pointSize.max) + ")";
		};

		var diagonal = isRadial ? radialDiagonal : linearDiagonal;
		var transformFn = isRadial ? radialTransformFn : linearTransformFn;
		var tree = isRadial ? radialTree : linearTree;
		var textTransformFn = isRadial ? radialTextTransformFn : linearTextTransform;
		var textAnchorFn = isRadial ? radialTextAnchorFn : linearTextAnchorFn;

		var nodes = tree.nodes( self._data ).reverse();
		var levelNodes = [];
		nodes.forEach( function ( n ) {
			if ( !levelNodes[n.depth] ) {
				levelNodes[n.depth] = [];
			}
			levelNodes[n.depth].push( n );
		} );

		if ( tree === radialTree ) {
			nodes.forEach( function ( d ) {
				d.x = (((d.x + (arcSize === 360 ? self._rotation : 0) ) % 360) + 360 ) % 360;
				//if ( arcSize <= 180 ) {
				//	d.y = ( d.y - radius/levels.length ) / ( radius - radius/levels.length);
				//	d.y *= radius;
				//}
			} );
		}
		else {
			levelNodes.filter( function ( level ) {
				return !!level;
			} ).forEach( function ( level ) {
				level.forEach( function ( n, i, arr ) {

					var dx = 0;
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
						dx = Math.min( dx, (self._width - n.x) * 2.4 );
					}

					if ( dx < 10 ) {
						n.showLabel = false;
					}
					else if ( n.depth > 0 ) {
						n.showLabel = true;
						levels[n.depth - 1].hasVisibleLabels = true;
					}
				} );
			} );
		}

		var spacing = 200;
		if ( self._data.name === '_root' ) {
			nodes.pop();

			if ( tree === linearTree ) {
				spacing = levels.length > 1 ? treeWidth / (levels.length - 1) : treeWidth / 2;
				nodes.forEach( function ( d ) {
					d.y = ( d.depth - 1) * spacing;
				} );
			}
			else if ( tree === radialTree ) {
				//spacing = (radius - self._pointSize.max * 2 - 16) / levels.length;
				//levels.forEach( function ( level, i ) {
				//	level.showLabels = level.showLabels && i < levels.length - 1 ? spacing > 40 : level.showLabels;
				//} );
			}
		}

		var rdx = this._w / 2 - radius;
		var rdy = this._h / 2 - radius;

		var wrap = function ( d ) {
			var self = d3.select( this ),
				dx, dy,
				width = d.depth === levels.length ? 100 : spacing,
				padding = 0,
				approxFit,
				textLength,
				text;
			dx = rdx * Math.cos( (d.x + 90) * Math.PI / 180 );
			dy = rdy * Math.sin( (d.x + 90) * Math.PI / 180 );
			width = isRadial && d.depth === levels.length ?
			Math.sqrt( dx * dx + dy * dy ) - maxPointSize - 8 :
				textWidths[d.depth - 1];
			self.text( d.name );
			textLength = self.node().getComputedTextLength();
			text = self.text();
			if ( textLength > width && text.length > 0 ) {
				approxFit = Math.ceil( width / (textLength / text.length) );
				text = text.slice( 0, approxFit );
			}
			while ( textLength > (width - 2 * padding) && text.length > 0 ) {
				text = text.slice( 0, -1 );
				self.text( text + '…' );
				textLength = self.node().getComputedTextLength();
			}
		};

		var checkTextNode = function ( d ) {
			if ( d.showLabel === false || ( d.depth > 0 && levels[d.depth - 1].showLabels === false ) ) {
				d3.select( this ).select( "text" ).remove();
				return;
			}

			var t = this.querySelector( "text" );
			if ( !t ) { // enter
				d3.select( this ).append( "text" )
					.text( d.name )
					.attr( "dy", ".35em" )
					.style( "fill-opacity", 1e-6 );
			}

			// update
			d3.select( this ).select( "text" )
				.text( d.name )
				.each( wrap )
				.attr( "text-anchor", textAnchorFn )
				.attr( 'transform', textTransformFn )
				.transition()
				.duration( duration )
				.style( "fill-opacity", 1 );
		};

		var checkEmoticonNode = function ( d ) {

			if ( !d.emoticon || d.nodeSize < 8 ) {
				d3.select( this ).select( "use" ).remove();
				return;
			}

			var t = this.querySelector( "use" );
			if ( !t ) { // enter
				d3.select( this ).append( "use" )
					.attr( "xlink:href", '#' + d.emoticon )
					.attr( "transform", "scale(0.001, 0.001) translate(-370, -540)" );
			}
			else {
				t.setAttribute( "href", '#' + d.emoticon );
			}
		};

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
			.on( 'click', function ( d ) {
				if ( !self.mySelections.active && d3.event.shiftKey ) {
					toggle.call( self, d );
					return;
				}
			
				if ( !self.selectionsEnabled ) {
					return;
				}
				
				selections.select.call( self, d );
				_update.call( self, d );
			} )
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
			var classes = ['node'];
			classes.push( (d.children || d._children) ? 'branch' : 'leaf' );
			if ( d.canExpand || d.canCollapse ) {
				classes.push( 'node-expandable' );
			}
			if ( !self.mySelections.active && !d.isLocked || ( self.mySelections.active && self.mySelections.col === d.col ) ) {
				classes.push( "node-selectable" );
			}
			if ( self.mySelections.active ) {
				if ( d.elemNo in self._selectedElemNo ) {
					classes.push( 'node-selected' );
				}
				if ( self.mySelections.col !== d.col ) {
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

		nodeUpdate.each( checkTextNode );
		nodeUpdate.each( checkEmoticonNode );

		nodeUpdate.select( "use" )
			.attr( "transform", function ( d ) {
				var size = sizeFn( d );
				var scale = size / 20;
				return "scale(" + scale + "," + scale + ")" + (isRadial ? "rotate(" + (-d.x + 90) + ")" : "");
			} );

		var nodeExit = node.exit().transition()
			.duration( duration )
			.attr( "transform", exitingTransform )
			.remove();

		nodeExit.select( "circle" )
			.attr( "r", 1e-6 );

		nodeExit.select( "text" )
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
		link.transition()
			.duration( duration )
			.style( 'stroke-width', sizeFn )
			.attr( "d", diagonal );

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
		this._width = h; // width to height due to projection
		this._height = w;

		this._radius = Math.min( w, h ) / 2;

		var minPointSize = Math.max( 1, this._radius / 100 );
		var maxPointSize = Math.min( 40, Math.max( this._radius / 20, 2 ) );

		this._pointSize = {min: minPointSize, max: maxPointSize};
		this._sizing = d3.scale.linear().domain( [this._minMax.min, this._minMax.max] ).rangeRound( [minPointSize, maxPointSize] ).clamp( true );

		this._padding = {
			left: 0,//maxPointSize,//Math.min( w * 0.2, this._layout.qHyperCube.qDimensionInfo[0].qApprMaxGlyphCount * 12 ),
			right: 0//maxPointSize//Math.min( w * 0.2, this._layout.qHyperCube.qDimensionInfo.slice( -1 )[0].qApprMaxGlyphCount * 12 )
		};

		//var levelSpacing = layout.radial ? this._radius / maxLevel : this._height / maxLevel;
	}

	/*
	var DendrogramController = Controller.extend( "DendogramController", {
		init: function( scope, element, timeout, selectionService ) {
			this.$scope = scope;
			this.$element = element;
			this.$timeout = timeout;

			this._super.apply( this, arguments );
		}
		//onPaint: function() {
		//	this.paint( this.$element, this.$scope.layout );
		//},
		//onResize: function() {
		//	this.resize();
		//},
		
	});
	*/

	var DendrogramView = DefaultView.extend( {
		init: function () {
			this._super.apply( this, arguments );

			var svg = d3.select( this.$element[0] ).append( "svg" )
				.attr( {
					xmlns: "http://www.w3.org/2000/svg",
					xlink: "http://www.w3.org/1999/xlink"
				} );

			this.$element.find( "svg " ).html( defs );

			svg.append( "style" ).text( embedStyle );

			this._rotation = 0;

			this._root = svg.append( "g" )
				.attr( "class", "root" );

			$timeout = qvangular.getService( "$timeout" );

		},
		resize: function () {
			_updateSize.call( this );

			var w = this._w;
			var h = this._h;

			var svg = d3.select( this.$element[0] ).select( "svg" );

			_update.call( this, this._data );

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
					_update.call( this, this._data );
				}.bind( this ), 30 )

			}.bind( this ) );
		},
		off: function () {
			clearTimeout( this._rotationTimer );
			this._super();
			this.$element.off( "mousewheel DOMMouseScroll" );
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

			this._levels = data.levels;
			this._maxLevelNodes = Math.max.apply( null, this._levels );
			this._isRadial = this._maxLevelNodes < 10 ? false : layout.radial;
			data = data.data;
			this._data = data;
			this._layout = layout;
			this._minMax = getMinMax( data, 'size' );

			_updateSize.call( this );

			w = this._w;
			h = this._h;

			data._x = h / 2;
			data._y = 0;

			var root = this._root;
			root.attr( "class", 'root' );
			
			
			_update.call( this, this._toggledNode || this._data );
			this._toggledNode = null;

			var rootTransform = this._isRadial ? "translate(" + w / 2 + "," + h / 2 + ")" :
			"translate(" + this._padding.left + ", 0)";

			var svg = d3.select( this.$element[0] ).select( "svg" );
			svg.attr( "width", w )
				.attr( "height", h )
				.select( ".root" )
				.transition()
				.duration( duration )
				.attr( "transform", rootTransform );
		},
		getSelectionToolbar: function () {
			return new DefaultSelectionToolbar( this.$scope.backendApi, this.$scope.selectionsApi, false, false, [], [] );
		},
		selectValues: function ( qDimNo, qValues ) {
			
			selections.selectValues( this, qDimNo, qValues );
			/*
			if ( !this.selectionsEnabled ) {
				return;
			}
			if ( !this.backendApi.inSelections() ) {
				var $scope = this.$scope, self = this;
				//map functions for toolbar
				$scope.selectionsApi.confirm = function () {
					clearSelections.call( self, true );
					$scope.backendApi.endSelections( true ).then( function () {
						$scope.selectionsApi.deactivated();
					} );
				};
				$scope.selectionsApi.cancel = function () {
					clearSelections.call( self, false );
					$scope.backendApi.endSelections( false );
					$scope.selectionsApi.deactivated();
				};
				$scope.selectionsApi.deactivate = function () {
					clearSelections.call( self, true );
					this.deactivated();
				};
				$scope.selectionsApi.clear = function () {
					clearSelections.call( self, false );
					$scope.backendApi.clearSelections();
					$scope.selectionsApi.selectionsMade = false;
					self.resize();
				};

				//start selection mode
				this.backendApi.beginSelections();
				$scope.selectionsApi.activated();
				$scope.selectionsApi.selectionsMade = true;
			}

			if ( !qValues.length ) {
				this.backendApi.clearSelections();
			}
			else {
				this.backendApi.select( qValues, [qDimNo], 'L' );
			}
			*/
		}
	} );
	
	components.addComponent("pivot-sorting", pivotSorting);

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
		data: {
			dimensions: {
				min: 1,
				nax: 10
			},
			measures: {
				min: 1,
				max: 2
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