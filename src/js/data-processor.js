import Color from 'color';
import { hierarchy as d3Hierarchy } from 'd3';
import symbols from './symbols';

function processData(layout) {
  const pages = layout.qHyperCube.qPivotDataPages[0];

  const hideNullNodes = layout.showNullNodes !== true;

  let row = 0;

  const dimensions = layout.qHyperCube.qDimensionInfo.map(d => d.qFallbackTitle);
  const measures = layout.qHyperCube.qMeasureInfo.map(d => d.qFallbackTitle);
  function nest(n, depth) {
    const values = pages.qData[row];
    const ret = {
      name: n.qType === 'O' ? layout.qHyperCube.qDimensionInfo[depth].othersLabel : n.qText,
      elemNo: n.qElemNo,
      values,
      attrExps: n.qAttrExps,
      row: row++,
      type: n.qType,
      col: depth,
      isLocked: layout.qHyperCube.qDimensionInfo[depth].qLocked,
      canExpand: n.qCanExpand && n.qType !== 'A' && n.qType !== 'U',
      canCollapse: n.qCanCollapse && n.qType !== 'A' && n.qType !== 'U',
      dimensions,
      measures,
    };
    if (n.qSubNodes.length) {
      ret.children = n.qSubNodes.filter(nn => nn.qType !== 'T' && nn.qType !== 'E').map(nn => nest(nn, depth + 1)).filter((nn) => {
        if (nn.type === 'U' || nn.type === 'A') {
          ret.selfNode = nn;
        }
        return hideNullNodes ? (nn.type !== 'A' && nn.type !== 'U') : true;
      });
      ret.canCollapse = ret.canCollapse && ret.children.length; // can't collapse if there are no children
    }
    if (ret.selfNode && !ret.children.length) {
      delete ret.selfNode;
    }
    return ret;
  }

  const children = pages.qLeft.map(node => nest(node, 0)).filter(n => (hideNullNodes ? (n.type !== 'A' && n.type !== 'U') : true));

  const data = {
    name: '_root',
    elemNo: -3,
    children,
    size: 1,
  };

  function hasSymbolExps(d) {
    return d && d.qValues && d.qValues[1] && typeof d.qValues[1].qText !== 'undefined' && d.qValues[1].qText !== '-';
  }

  function hasColorExps(d) {
    return d && d.qValues && d.qValues[0] && (d.qValues[0].qNum !== 'NaN' || (d.qValues[0].qText && d.qValues[0].qText !== '-'));
  }

  function applyColor(n, d) {
    const colorArg = d.qValues[0].qNum !== 'NaN' ? d.qValues[0].qNum : d.qValues[0].qText;
    const color = new Color(colorArg, 'argb');
    if (!color.isInvalid()) {
      n.color = color.toRGB();
    } else {
      delete n.color;
    }
  }

  function applySymbol(n, d) {
    const symbol = d.qValues[1].qText;
    if (symbol && symbols[symbol]) {
      n.symbol = symbols[symbol].url;
    } else if (/^\S{1}$/.exec(symbol)) { // text
      n.symbol = symbol;
    } else if (/^q-[0-9]{2,4}$/.exec(symbol)) { // qlik icon
      n.symbol = symbol;
    } else if (/^m-[_a-z0-9]+$/.exec(symbol)) { // material icon
      n.symbol = symbol;
    } else {
      delete n.symbol;
    }
    return symbol;
  }

  function mapValuesToProperties(n) {
    const values = layout.selfNodes && n.selfNode ? n.selfNode.values : n.values;


    let symbol;
    if (values) {
      // size
      n.size = isNaN(values[0].qNum) ? 1 : values[0].qNum; // eslint-disable-line

      // symbol
      if (hasSymbolExps(n.attrExps)) {
        symbol = applySymbol(n, n.attrExps);
      } else if (hasSymbolExps(values[0].qAttrExps)) {
        symbol = applySymbol(n, values[0].qAttrExps);
      } else {
        delete n.symbol;
      }

      // color
      if (hasColorExps(n.attrExps)) {
        applyColor(n, n.attrExps);
      } else if (hasColorExps(values[0].qAttrExps)) {
        applyColor(n, values[0].qAttrExps);
      } else if (n.symbol && symbols[symbol] && symbols[symbol].color) {
        n.color = new Color(symbols[symbol].color);
      } else {
        delete n.color;
      }
    }
    if (n.children) {
      n.children.forEach(mapValuesToProperties);
    }
  }

  function generateId(n, s) {
    n.id = `${s};${n.name}`;
    if (n.children) {
      n.children.forEach((c) => {
        generateId(c, n.id);
      });
    }
  }

  mapValuesToProperties(data);
  generateId(data, '');

  let totalGlyphCount = 0;
  const levels = [];
  function collect(arr, i) {
    if (!arr) {
      return;
    }
    if (!levels[i]) {
      levels[i] = {
        nodes: [],
        min: Number.MAX_VALUE,
        max: -Number.MAX_VALUE,
        glyphCount: layout.qHyperCube.qDimensionInfo[i].qApprMaxGlyphCount,
        depth: i,
      };
      totalGlyphCount += levels[i].glyphCount;
    }
    levels[i].nodes = levels[i].nodes.concat(arr);
    // levels[i] += arr ? arr.length : 0;
    arr.forEach((c) => {
      if (c.children && c.children.length) {
        collect(c.children, i + 1);
      }
    });
  }

  const hierarchy = d3Hierarchy(data);
  collect(hierarchy.children, 0);

  levels.forEach((level) => {
    level.glyphCountWeight = level.glyphCount / totalGlyphCount;
  });

  function getMinMax(node, prop) {
    let max = -Number.MAX_VALUE;
    let min = Number.MAX_VALUE;

    if (node.children) {
      node.children.forEach((c) => {
        const m = getMinMax(c, prop);
        max = Math.max(max, m.max);
        min = Math.min(min, m.min);
      });
    }
    if (node.data.name !== '_root') {
      levels[node.data.col].min = Math.min(node.data[prop], levels[node.data.col].min);
      levels[node.data.col].max = Math.max(node.data[prop], levels[node.data.col].max);
    }

    max = Math.max(max, node.data[prop]);
    min = Math.min(min, node.data[prop]);

    if (isNaN(max)) { //eslint-disable-line
      max = min = 1;
    }

    return {
      max,
      min,
    };
  }

  const minMax = getMinMax(hierarchy, 'size');

  return {
    root: data,
    hierarchy,
    levels,
    min: minMax.min,
    max: minMax.max,
    glyphCount: totalGlyphCount,
  };
}

export default {
  process: processData,
};
