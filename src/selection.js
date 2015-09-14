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
	
	return {
		selectValues: function ( obj, qDimNo, qValues ) {
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

			if ( !qValues.length ) {
				//obj.backendApi.clearSelections();
				obj.$scope.selectionsApi.clear();
			}
			else {
				obj.backendApi.select( qValues, [qDimNo], 'L' );
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
	};
} ); 
