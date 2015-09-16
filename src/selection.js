define( [
	
],
/** @owner Miralem Drek (mek) */
function(
	
){

	function clearSelections ( endSelections ) {
		this._selectedElemNo = {};

		if ( endSelections ) {
			this.mySelections.active = false;
			this._root.attr( "class", "root" );
		}
	}

	function selectCells( cells ) {
		switch ( this.model.layout.qHyperCube.qMode ) {
			case "P":
				return this.model.rpc( "SelectPivotCells", null, [this.path, cells] );
			default:
				throw "you are using a non-supported backend-api";
		}
	}
	
	return {
		selectValues: function ( obj, cells ) {
			if ( !obj.selectionsEnabled ) {
				return;
			}
			if ( !obj.backendApi.inSelections() ) {
				var $scope = obj.$scope;
				//map functions for toolbar
				$scope.selectionsApi.confirm = function () {
					clearSelections.call( obj, true );
					$scope.backendApi.endSelections( true ).then( function () {
						$scope.selectionsApi.deactivated();
					} );
				};
				$scope.selectionsApi.cancel = function () {
					clearSelections.call( obj, false );
					$scope.backendApi.endSelections( false );
					$scope.selectionsApi.deactivated();
				};
				$scope.selectionsApi.deactivate = function () {
					clearSelections.call( obj, true );
					obj.deactivated();
				};
				$scope.selectionsApi.clear = function () {
					clearSelections.call( obj, true );
					$scope.backendApi.clearSelections();
					$scope.selectionsApi.selectionsMade = false;
					obj.resize();
				};

				//start selection mode
				obj.backendApi.beginSelections();
				$scope.selectionsApi.activated();
				$scope.selectionsApi.selectionsMade = true;
			}

			if ( !cells.length ) {
				//obj.backendApi.clearSelections();
				obj.$scope.selectionsApi.clear();
			}
			else {
				if ( cells ) {
					selectCells.call( obj.backendApi, cells  )
				}
				//else {
				//	obj.backendApi.select( qValues, [qDimNo], 'L' );
				//}
				obj.$scope.selectionsApi.selectionsMade = true;
			}
		},
		select: function select ( node ) {
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
			if ( !this._selectedElemNo[node.col] ) {
				this._selectedElemNo[node.col] = {};
			}

			if ( !this.mySelections.active ) {
				this.mySelections.active = true;
				this._root.attr( "class", "root inSelections" );
			}

			var selected = !(node.elemNo in this._selectedElemNo[node.col]);

			if ( !selected ) {
				delete this._selectedElemNo[node.col][node.elemNo];
			}
			else {
				this._selectedElemNo[node.col][node.elemNo] = node.row;
			}
			
			var cells = [];
			for ( var col in this._selectedElemNo ) {
				for ( var elemNo in this._selectedElemNo[col] ) {
					cells.push( {qType: 'L', qCol: Number(col), qRow: this._selectedElemNo[col][elemNo] } );
				}
			}
			console.log( cells );
			this.selectValues( cells );
		}
	};
} ); 
