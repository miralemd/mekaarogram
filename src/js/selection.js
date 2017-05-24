import EventUtils from "event-utils";

function clearSelections ( endSelections, endHighlight ) {
	this._selectedElemNo = {};
	this._pathSelected = {};
	this._selectedCells = {};

	if ( endSelections || endHighlight ) {
		this.dataSelections.highlight = false;
		this._root.attr( "class", "root" );
	}
	if ( endSelections ) {
		this.dataSelections.active = false;
	}
}

function selectCells( cells ) {
	switch ( this.model.layout.qHyperCube.qMode ) {
		case "P":
			if ( typeof this.model.selectPivotCells === "function" ) {
				return this.model.selectPivotCells( this.path, cells );
			}
			return this.model.rpc( "SelectPivotCells", null, [this.path, cells] );
		default:
			throw "you are using a non-supported backend-api";
	}
}

export default {
	selectValues: function ( obj, cells, clearOld ) {
		if ( !obj.selectionsEnabled ) {
			return;
		}
		if ( !obj.dataSelections.active ) {
			let $scope = obj.$scope;
			//map functions for toolbar
			$scope.selectionsApi.confirm = function () {
				clearSelections.call( obj, true );
				$scope.backendApi.endSelections( true ).then( function () {
					$scope.selectionsApi.deactivated();
				} );
			};
			$scope.selectionsApi.cancel = function () {
				clearSelections.call( obj, true );
				$scope.backendApi.endSelections( false );
				$scope.selectionsApi.deactivated();
			};
			$scope.selectionsApi.deactivate = function () {
				clearSelections.call( obj, true );
				obj.deactivated();
			};
			$scope.selectionsApi.clear = function () {
				clearSelections.call( obj, false, true );
				$scope.backendApi.clearSelections();
				$scope.selectionsApi.selectionsMade = false;
				obj.resize();
			};

			//start selection mode
			obj.backendApi.beginSelections();
			$scope.selectionsApi.activated();
			$scope.selectionsApi.selectionsMade = true;
			obj.dataSelections.active = true;
		}

		if ( !cells.length ) {
			//obj.backendApi.clearSelections();
			obj.$scope.selectionsApi.clear();
		}
		else {
			if ( clearOld ) {
				obj.backendApi.clearSelections();
			}
			if ( cells ) {
				selectCells.call( obj.backendApi, cells ).then( function( res ) {
					if ( typeof res === "boolean" && !res || typeof res === "object" && !res.qSuccess ) {
						obj.$scope.selectionsApi.clear();
					}
				} );
			}
			obj.$scope.selectionsApi.selectionsMade = true;
		}
	},
	select: function select ( node ) {
		if ( node ) {
			if ( node.elemNo < 0 && node.elemNo !== -3 ) {
				return;
			}

			if ( node.isLocked ) {
				EventUtils.showLockedFeedback( [this._layout.qHyperCube.qDimensionInfo[node.col]] );
				return;
			}

			if ( !this.dataSelections.highlight ) {
				this.dataSelections.highlight = true;
				this.dataSelections.col = node.col;
				this._root.attr( "class", "root inSelections" );
			}

			if ( !this._selectedElemNo ) {
				this._selectedElemNo = {};

			}
			if ( !this._pathSelected ) {
				this._pathSelected = {};
			}
			if ( !this._selectedCells ) {
				this._selectedCells = {};
			}

			if ( !this._selectedElemNo[node.col] ) {
				this._selectedElemNo[node.col] = {};
			}

			let selected = !( node.elemNo in this._selectedElemNo[node.col] );

			if ( !selected ) {
				delete this._selectedElemNo[node.col][node.elemNo];
			}
			else {
				this._selectedElemNo[node.col][node.elemNo] = node.row;
			}

			if ( this._isPathSelectActive ) {
				let cellId = node.col + ";" + node.row;
				selected = !( cellId in this._selectedCells );
				if ( !selected ) {
					delete this._selectedCells[ cellId ];
				}
				else {
					this._selectedCells[ cellId ] = node.elemNo;
				}

				while ( ( node = node.parent ) && node.elemNo >= 0 ){
					cellId = node.col + ";" + node.row;
					if ( !( cellId in this._pathSelected ) ) {
						this._pathSelected[cellId] = 0;
					}
					this._pathSelected[cellId] += selected ? 1 : -1;
				}
			}
		}

		let cells = [];

		if ( this._isPathSelectActive ) {
			for ( let cellId in this._selectedCells ) {
				cells.push( { qType: "L", qCol: Number( cellId.split( ";" )[0] ),	qRow: Number( cellId.split( ";" )[1] )
				} );
			}

			for ( let cellId in this._pathSelected ) {
				if ( this._pathSelected[cellId] > 0 ) {
					cells.push( { qType: "L", qCol: Number( cellId.split( ";" )[0] ), qRow: Number( cellId.split( ";" )[1] )
					} );
				}
			}
		}
		else {
			for ( let col in this._selectedElemNo ) {
				for ( let elemNo in this._selectedElemNo[col] ) {
					cells.push( { qType: "L", qCol: Number( col ), qRow: this._selectedElemNo[col][elemNo] } );
				}
			}
		}

		//console.log( cells );
		this.selectValues( cells, !node && cells.length );
	},
	switchSelectionModel: function( cellMode ) {

		let cells = [];

		if ( cellMode ) { // switch to indirect selections in multiple columns
			this._selectedCells = {};
			this._pathSelected = {};

			let nodes = this.levels[this.dataSelections.col].nodes;
			nodes.forEach( function( node ) {
				if ( node.elemNo in this._selectedElemNo[node.col] ) {
					this._selectedCells[ node.col + ";" + node.row ] = node.elemNo;

					while ( ( node = node.parent ) && node.elemNo >= 0 ){
						let cellId = node.col + ";" + node.row;
						if ( !( cellId in this._pathSelected ) ) {
							this._pathSelected[cellId] = 0;
						}
						this._pathSelected[cellId] += 1;
					}
				}
			}, this );

			for ( let cellId in this._selectedCells ) {
				cells.push( { qType: "L", qCol: Number( cellId.split( ";" )[0] ),	qRow: Number( cellId.split( ";" )[1] )
				} );
			}

			for ( let cellId in this._pathSelected ) {
				if ( this._pathSelected[cellId] > 0 ) {
					cells.push( { qType: "L", qCol: Number( cellId.split( ";" )[0] ), qRow: Number( cellId.split( ";" )[1] )
					} );
				}
			}

		} else { // switch to selection in one column (elemNo mode)
			let elemNo = {};
			for ( let cellId in this._selectedCells ) {
				if ( !( this._selectedCells[cellId] in elemNo ) ) {
					cells.push( { qType: "L", qCol: Number( cellId.split( ";" )[0] ), qRow: Number( cellId.split( ";" )[1] ) } );
					elemNo[this._selectedCells[cellId]] = Number( cellId.split( ";" )[1] );
				}
			}
			this._selectElemNo = {};
			this._selectedElemNo[this.dataSelections.col] = elemNo;

			//for ( var col in this._selectedElemNo ) {
			//	for ( var elemNo in this._selectedElemNo[col] ) {
			//		cells.push( {qType: 'L', qCol: Number(col), qRow: this._selectedElemNo[col][elemNo] } );
			//	}
			//}

			this._selectedCells = {};
			this._pathSelected = {};
		}

		this.backendApi.clearSelections();
		this.selectValues( cells );
	}
};
