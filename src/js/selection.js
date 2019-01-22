export default {
  select: function select(node) {
    if (node) {
      if (node.data.elemNo < 0 && node.data.elemNo !== -3) {
        return;
      }

      if (node.data.isLocked) {
        // EventUtils.showLockedFeedback( [this._layout.qHyperCube.qDimensionInfo[node.data.col]] );
        return;
      }

      if (!this.dataSelections.highlight) {
        this.dataSelections.highlight = true;
        this.dataSelections.col = node.data.col;
        this._root.attr('class', 'root inSelections');
      }

      if (!this._selectedElemNo) {
        this._selectedElemNo = {};
      }
      if (!this._pathSelected) {
        this._pathSelected = {};
      }
      if (!this._selectedCells) {
        this._selectedCells = {};
      }

      if (!this._selectedElemNo[node.data.col]) {
        this._selectedElemNo[node.data.col] = {};
      }

      let selected = !(node.data.elemNo in this._selectedElemNo[node.data.col]);

      if (!selected) {
        delete this._selectedElemNo[node.data.col][node.data.elemNo];
      } else {
        this._selectedElemNo[node.data.col][node.data.elemNo] = node.data.row;
      }

      if (this._isPathSelectActive) {
        let cellId = `${node.data.col};${node.data.row}`;
        selected = !(cellId in this._selectedCells);
        if (!selected) {
          delete this._selectedCells[cellId];
        } else {
          this._selectedCells[cellId] = node.data.elemNo;
        }

        while ((node = node.parent) && node.data.elemNo >= 0) {
          cellId = `${node.data.col};${node.data.row}`;
          if (!(cellId in this._pathSelected)) {
            this._pathSelected[cellId] = 0;
          }
          this._pathSelected[cellId] += selected ? 1 : -1;
        }
      }
    }

    const cells = [];

    if (this._isPathSelectActive) {
      Object.keys(this._selectedCells || {}).forEach((cellId) => {
        cells.push({ qType: 'L', qCol: Number(cellId.split(';')[0]), qRow: Number(cellId.split(';')[1]) });
      });

      Object.keys(this._pathSelected || {}).forEach((cellId) => {
        if (this._pathSelected[cellId] > 0) {
          cells.push({ qType: 'L', qCol: Number(cellId.split(';')[0]), qRow: Number(cellId.split(';')[1]) });
        }
      });
    } else {
      Object.keys(this._selectedElemNo || {}).forEach((col) => {
        Object.keys(this._selectedElemNo[col] || {}).forEach((elemNo) => {
          cells.push({ qType: 'L', qCol: Number(col), qRow: this._selectedElemNo[col][elemNo] });
        });
      });
    }
    this.selectValues(cells, !node && cells.length);
  },
  switchSelectionModel(cellMode) {
    const cells = [];

    if (cellMode) { // switch to indirect selections in multiple columns
      this._selectedCells = {};
      this._pathSelected = {};

      const nodes = this.levels[this.dataSelections.col].nodes;
      nodes.forEach((node) => {
        if (node.data.elemNo in this._selectedElemNo[node.data.col]) {
          this._selectedCells[`${node.data.col};${node.data.row}`] = node.data.elemNo;

          while ((node = node.parent) && node.data.elemNo >= 0) {
            const cellId = `${node.data.col};${node.data.row}`;
            if (!(cellId in this._pathSelected)) {
              this._pathSelected[cellId] = 0;
            }
            this._pathSelected[cellId] += 1;
          }
        }
      });

      Object.keys(this._selectedCells || {}).forEach((cellId) => {
        cells.push({ qType: 'L', qCol: Number(cellId.split(';')[0]), qRow: Number(cellId.split(';')[1]) });
      });

      Object.keys(this._pathSelected || {}).forEach((cellId) => {
        if (this._pathSelected[cellId] > 0) {
          cells.push({ qType: 'L', qCol: Number(cellId.split(';')[0]), qRow: Number(cellId.split(';')[1]) });
        }
      });
    } else { // switch to selection in one column (elemNo mode)
      const elemNo = {};
      Object.keys(this._selectedCells || {}).forEach((cellId) => {
        if (!(this._selectedCells[cellId] in elemNo)) {
          cells.push({ qType: 'L', qCol: Number(cellId.split(';')[0]), qRow: Number(cellId.split(';')[1]) });
          elemNo[this._selectedCells[cellId]] = Number(cellId.split(';')[1]);
        }
      });
      this._selectElemNo = {};
      this._selectedElemNo[this.dataSelections.col] = elemNo;

      // for ( var col in this._selectedElemNo ) {
      //   for ( var elemNo in this._selectedElemNo[col] ) {
      //     cells.push( {qType: 'L', qCol: Number(col), qRow: this._selectedElemNo[col][elemNo] } );
      //   }
      // }

      this._selectedCells = {};
      this._pathSelected = {};
    }

    this.backendApi.clearSelections();
    this.selectValues(cells);
  },
};
