define( [
	
],
/** @owner Miralem Drek (mek) */
function(
	
){
	return {
		select: function select ( node ) {
			if ( node.elemNo < 0 ) {
				return;
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

			node.selected = !node.selected;
			this.selectValues( node.col, [node.elemNo], true );
		}
	};
} ); 
