/* global Touche */
import $ from 'jquery';
import Color from 'color';
import State from 'state';
import * as d3 from 'd3';
import 'touche'; // ensure Touche is imported and avaliable as global

import selections from './selection';
import tooltip from './tooltip';
import dataProcessor from './data-processor';

import defs from '../assets/defs.html';

const duration = 500;
const namespace = '.mekDendrogram';
const PADDING = 4;
const defaultColor = 'rgb(100, 150, 150)';
const MAX_NODES_FOR_ENABLED_ANIMATION = 100;

const globals = {
  instances: 0,
  svgDefs: undefined,
};

const isIE = (function isIE() {
  const ua = window.navigator.userAgent;
  return ua.indexOf('MSIE ') > -1 || ua.indexOf('Trident/') > -1 || ua.indexOf('Edge') > -1;
}());


function onNodeMouseOver(d, el, event, isRadial, showSelf) {
  tooltip.current.d = d;
  tooltip.current.el = el;
  tooltip.current.isRadial = isRadial;
  tooltip.current.showSelfValue = showSelf;

  tooltip.activate();
}

function onNodeMouseLeave() {
  tooltip.inactivate();
}

const linearDiagonal = d3.linkHorizontal().x(d => d.y).y(d => d.x);
const radialDiagonal = d3.linkRadial().radius(d => d.y).angle(d => d.x / 180 * Math.PI);
const radialTransformFn = d => `rotate(${d.x - 90}) translate(${d.y})`;
const linearTransformFn = d => `translate(${d.y},${d.x})`;
const colorFn = d => ((d.target ? d.target.data.color : d.data.color) || defaultColor);

const strokeColorFn = d => (d.data.canCollapse || d.data.canExpand ? d3.rgb(colorFn(d)).darker().toString() : '');

function toggle(d) {
  if (d.data.canExpand) {
    this.backendApi.expandLeft(d.data.row, d.data.col, false);
    this._toggledNode = d;
  } else if (d.data.canCollapse) {
    this.backendApi.collapseLeft(d.data.row, d.data.col, false);
    this._toggledNode = d;
  }
}

function spaceOutLinear(levels, width, labelWeight) {
  let numLevelsThatNeedSpaceForLabel = 1;
  if (levels.length > 1) {
    numLevelsThatNeedSpaceForLabel = levels.length + 1;
    if (!levels[0].showLabels) {
      numLevelsThatNeedSpaceForLabel--;
    }
    if (levels.length > 1 && !levels[levels.length - 1].showLabels) {
      numLevelsThatNeedSpaceForLabel--;
    }
  }

  const spacing = width / (numLevelsThatNeedSpaceForLabel || 1);
  const remainder = width - 2 * levels.reduce((prev, level) => prev + level.maxPointSize, 0);
  const distanceBetween = remainder / (numLevelsThatNeedSpaceForLabel || 1);
  let offset = 0;


  levels.forEach((level, i) => {
    const lastLevel = levels[Math.max(0, levels.length - 1)];
    const distanceToPrevious = spacing - level.maxPointSize - (i ? levels[i - 1].maxPointSize : 0);
    const diff = (1 - labelWeight) * distanceBetween + labelWeight * remainder * level.glyphCountWeight - distanceToPrevious;
    const foo = i === 0 && !level.showLabels ? level.maxPointSize : (spacing + diff);
    let textWidth = foo;
    if (i >= levels.length - 1 && lastLevel.showLabels) {
      offset = width - foo + lastLevel.maxPointSize;
      textWidth -= lastLevel.maxPointSize;
    } else {
      offset += foo;
    }

    if (i > 0 && i < levels.length - 1) {
      textWidth -= levels[i - 1].maxPointSize;
    }

    level.textWidth = textWidth - level.maxPointSize - PADDING * 2;
    level.offset = offset;
  });
}

function canLabelFitHorizontally(level) {
  const glyphCount = level.glyphCount;
  const spaceForLabels = level.textWidth;
  if (!(spaceForLabels > 18 || spaceForLabels / (12 * glyphCount) > 1)) {
    level.showLabels = false;
  }
}

function expandLabelWidthWherePossible(levels) {
  levels.forEach((level, i) => {
    const glyphCount = level.glyphCount;
    const spaceForLabels = level.textWidth;

    if (levels.length > 2 && i > 0 && i < levels.length - 1) {
      level.nodes.forEach((n) => {
        n.data.textWidth = spaceForLabels;

        let canFit = true;
        levels.slice(0, i).reverse().forEach((lev) => {
          if (!canFit) { // if it couln't fit through a corridor on last level, don't bother trying on next
            return;
          }
          const start = n.x - 6;
          const end = n.x + 6;

          let c; let s; let e; const corr = lev.corridor; const
            len = corr.length;
          let isExtended = false;
          for (c = 0; c < len; c++) {
            s = corr[c].start;
            e = corr[c].end;
            if (start >= s && end <= e) {
              isExtended = true;
              n.data.textWidth += PADDING * 2 + lev.textWidth + 2 * lev.maxPointSize;
              break;
            }
          }

          canFit = isExtended;
        });
      });
    }

    if (!(spaceForLabels > 18 || spaceForLabels / (12 * glyphCount) > 1)) {
      level.showLabels = false;
    }
  });
}

function canLabelFitVertically(levels, height) {
  // set label visibility based on vertical spacing between nodes
  levels.forEach((level) => {
    level.showLabels = true;
    level.numVisibleLabels = 0;
    level.minLabelDistance = height;
    const nodes = level.nodes.slice();
    const original = level.nodes;

    nodes.forEach((node, i) => {
      node.data._handledLabel = false;
      node.data.levelIndex = i;
      node.data.showLabel = false;
      // node.x += maxPointSize;
    });
    nodes.sort((a, b) => b.data.size - a.data.size);

    nodes.forEach((n, i, arr) => {
      if (n.data._handledLabel) {
        return;
      }
      // n.y = i * height/arr.length;
      let idx = n.data.levelIndex;
      let prevX = 0;
      let nextX = 0;

      const space = 8;

      let touchesNeighbour = false;
      if (idx === 0) {
        prevX = 2 * n.x;
      } else {
        touchesNeighbour = n.x - n.data.nodeSize < original[idx - 1].x;// + original[idx-1].nodeSize;
        do {
          prevX = n.x - original[--idx].x;
        } while (prevX < space && idx > 0 && !original[idx].data.showLabel);
        if (idx === 0 && !original[idx].data.showLabel) { // add additional space available above the first node
          prevX += 2 * original[idx].x;
        }
      }

      idx = n.data.levelIndex;
      if (idx === arr.length - 1) {
        nextX = 2 * (height - n.x);
      } else {
        touchesNeighbour = touchesNeighbour || (n.x + n.data.nodeSize > original[idx + 1].x);// - original[idx+1].nodeSize);
        do {
          nextX = original[++idx].x - n.x;
        } while (nextX < space && idx < arr.length - 1 && !original[idx].data.showLabel);
        if (idx === arr.length - 1 && !original[idx].data.showLabel) { // add additional space available after the last node
          nextX += 2 * (height - original[idx].x);
        }
      }

      n.data.showLabel = !touchesNeighbour && prevX >= space && nextX >= space;

      if (n.data.showLabel) {
        level.numVisibleLabels++;
        level.minLabelDistance = Math.min(level.minLabelDistance, prevX, nextX);
      }
    });

    if (!level.numVisibleLabels) {
      level.showLabels = false;
    }
  });
}

function calculateLinear(data, layout, width, height) {
  let levels = data.levels;

  const adaptiveStrokeWidth = layout.adaptiveStrokeWidth;

  let maxCircleSize = Math.min(80, 0.25 * width / (levels.length || 1));
  levels.forEach((level) => {
    maxCircleSize = Math.min(maxCircleSize, 0.5 * height / (level.nodes.length || 1));
  });

  levels.forEach((level) => {
    maxCircleSize = Math.min(maxCircleSize, 0.5 * (height - maxCircleSize) / (level.nodes.length || 1));
  });

  // point size in radius
  const minPointSize = Math.max(2, maxCircleSize * (layout.dataPoint && layout.dataPoint.size ? layout.dataPoint.size[0] : 1));
  const maxPointSize = Math.max(2, maxCircleSize * (layout.dataPoint && layout.dataPoint.size ? layout.dataPoint.size[1] : 1));

  const sizing = d3.scaleLinear().domain([data.min, data.max]).rangeRound([minPointSize, maxPointSize]).clamp(true);

  const sizeFn = d => (d.target ? adaptiveStrokeWidth ? sizing(d.target.data.size) : 1 // d.target exists for node links
    : sizing(d.data.size));

  levels = levels.map(level => ({
    showLabels: true,
    nodes: level.nodes,
    glyphCount: level.glyphCount,
    glyphCountWeight: level.glyphCountWeight,
    maxPointSize: sizing(level.max),
    corridor: [],
  }));

  const tree = d3.tree().size([height, width])
    .separation((a, b) => sizing(a.data.size) + sizing(b.data.size));

  const hierarchy = data.hierarchy;

  const nodes = hierarchy.descendants().reverse();

  nodes.forEach((node) => {
    node.data.nodeSize = sizing(node.data.size);
  });

  nodes.pop();

  tree(hierarchy);

  canLabelFitVertically(levels, height, maxPointSize);

  nodes.forEach((node) => {
    levels[node.depth - 1].corridor[Math.round(node.x)] = Math.max(levels[node.depth - 1].corridor[Math.round(node.x)] || 0, Math.max(2 * node.data.nodeSize, node.data.showLabel ? 12 : 0));
  });

  levels.forEach((level) => {
    const corridor = level.corridor.slice();
    const out = [];
    let start = 0;
    let end = 0;
    corridor.forEach((c, i) => {
      end = i - corridor[i] / 2;

      if (end - start > 12) {
        out.push({ start, end });
      }
      start = i + corridor[i] / 2;
    });
    end = height;

    if (end - start > 12) {
      out.push({ start, end });
    }

    level.corridor = out;
  });

  const labelWeight = 'labelWeight' in layout ? layout.labelWeight : 0.5;

  spaceOutLinear(levels, width, labelWeight);

  if (levels.length > 1) {
    canLabelFitHorizontally(levels[levels.length - 1]);
    canLabelFitHorizontally(levels[0]);

    spaceOutLinear(levels, width, labelWeight);
  }

  if (levels.length > 2) {
    expandLabelWidthWherePossible(levels);
    levels.slice(1, levels.length).forEach(canLabelFitHorizontally);
  }

  nodes.forEach((d) => {
    d.y = levels[(d.depth - 1)].offset;
  });

  const linearTextTransform = function (d) {
    return `translate(${(d.depth < levels.length ? -1 : 1) * (PADDING + levels[d.depth - 1].maxPointSize)})`;
  };

  const textAlignTransform = function (d) {
    return d.depth < levels.length ? 'end' : 'start';
  };

  return {
    sizing,
    levels,
    tree,
    hierarchy,
    nodes,
    sizeFn,
    nameLabeling: {
      position: linearTextTransform,
      align: textAlignTransform,
    },
  };
}
/*
function getMaxCircleSize( levels ) {
  levels.forEach( function ( level, i ) {
    maxCircleSize = Math.min( maxCircleSize, Math.PI * radiusSpacing * (i + 1) / (level.nodes.length || 1) );
  } );
} */

function spaceOutRadial(levels, radius, labelWeight) {
  let numLevelsThatNeedSpaceForLabel = levels.length + 1;
  if (!levels[levels.length - 1].showLabels) {
    numLevelsThatNeedSpaceForLabel--;
  }

  levels.forEach((level) => {
    level.minRadius = level.maxPointSize * level.nodes.length / Math.PI;
  });

  const spacing = radius / (numLevelsThatNeedSpaceForLabel || 1);
  const remainder = radius - 2 * levels.reduce((prev, level) => prev + level.maxPointSize, 0);
  const distanceBetween = remainder / (numLevelsThatNeedSpaceForLabel || 1);

  let offset = 0;

  levels.slice().reverse().forEach((level, i, arr) => {
    const distanceToPrevious = spacing - level.maxPointSize - (i ? arr[i - 1].maxPointSize : 0);
    const diff = (1 - labelWeight) * distanceBetween + labelWeight * remainder * level.glyphCountWeight - distanceToPrevious;
    const foo = i === 0 && !level.showLabels ? level.maxPointSize : (spacing + diff);
    let textWidth = foo;
    offset += foo;
    // var offsetDiff = radius - offset - level.minRadius;
    // if( offsetDiff < 0 ) {
    //  textWidth += offsetDiff;
    // }

    if (i > 0) {
      textWidth -= arr[i - 1].maxPointSize;
    }
    level.textWidth = textWidth - level.maxPointSize - 2 * PADDING;
    level.offset = radius - offset;// Math.max( level.minRadius, radius - offset );
  });
}

function canLabelFitRadially(levels) {
  levels.forEach((level) => {
    level.showLabels = true;
    level.numVisibleLabels = 0;
    level.minLabelDistance = 180 * Math.PI * level.offset;

    const nodes = level.nodes.slice();
    const original = level.nodes;

    nodes.forEach((node, i) => {
      node.data.levelIndex = i;
      node.data.showLabel = false;
    });
    nodes.sort((a, b) => b.data.size - a.data.size);

    nodes.forEach((n, i, arr) => {
      if (arr.length < 2) {
        n.data.showLabel = true;
        level.numVisibleLabels = 1;
        return;
      }

      let idx = n.data.levelIndex;
      let prevX = 0;
      let nextX = 0;
      const space = 10;
      let looped = false;

      do {
        --idx;
        if (idx === -1 && !looped) {
          looped = true;
          idx = arr.length - 1;
        } else if (looped) {
          break;
        }

        prevX = n.x - original[idx].x;
        if (prevX < 0) {
          prevX = n.x - original[idx].x + 360;
        }
        prevX *= Math.PI * level.offset / 180;
      } while (prevX < space && !original[idx].data.showLabel);

      idx = n.data.levelIndex;
      looped = false;
      do {
        ++idx;
        if (idx >= arr.length && !looped) {
          looped = true;
          idx = 0;
        } else if (looped) {
          break;
        }

        nextX = original[idx].x - n.x;
        if (nextX < 0) {
          nextX += 360;
        }
        nextX *= Math.PI * level.offset / 180;
      } while (nextX < space && !original[idx].data.showLabel);

      n.data.showLabel = prevX >= space && nextX >= space;

      if (n.data.showLabel) {
        level.numVisibleLabels++;
        level.minLabelDistance = Math.min(level.minLabelDistance, prevX, nextX);
      }

      // var prev = arr[i ? i-1 : arr.length - 1].x;
      // var next = arr[i < arr.length - 1 ? i+1 : 0].x;
      // var dx = Math.min( Math.abs( arr[i].x - prev ), Math.abs( next - arr[i].x ) );
      // dx *= Math.PI * level.offset / 180;
      // if( arr.length < 2 || dx > 62 ) {
      //  n.showLabel = true;
      //  level.hasVisibleLabels = true;
      // }
    });

    if (!level.numVisibleLabels) {
      level.showLabels = false;
    }
  });
}

function expandRadialLabels(levels) {
  levels.forEach((level, i) => {
    // var glyphCount = level.glyphCount;
    const spaceForLabels = level.textWidth;

    if (levels.length > 1 && i < levels.length - 1) {
      level.nodes.forEach((n) => {
        n.data.textWidth = spaceForLabels;
        n.data._extendToEdge = false;

        let canFit = true;
        levels.slice(i + 1).forEach((lev) => {
          if (!canFit) { // if it couln't fit through a corridor on last lev, don't bother trying on next
            return;
          }
          const start = Math.PI * n.x * lev.offset / 180 - 6;
          const end = start + 12;

          let c; let s; let e; const corr = lev.corridor; const
            len = corr.length;
          let isExtended = false;
          for (c = 0; c < len; c++) {
            s = corr[c].start;
            e = corr[c].end;
            if (start >= s && end <= e) {
              isExtended = true;
              n.data.textWidth += PADDING * 2 + lev.textWidth + 2 * lev.maxPointSize;
              break;
            }
          }
          if (isExtended && lev === levels[levels.length - 1]) {
            n.data._extendToEdge = true;
          }
          canFit = isExtended;
        });
      });
    }

    // if ( !(spaceForLabels > 18 || spaceForLabels / (12 * glyphCount) > 1 ) ) {
    //  level.showLabels = false;
    // }
  });
}

function calculateRadial(data, layout, width, height, rotation) {
  let levels = data.levels;

  const arcSize = 360;
  const adaptiveStrokeWidth = layout.adaptiveStrokeWidth;
  const labelWeight = 0;// 'labelWeight' in layout ? layout.labelWeight : 0.5;
  const radius = 0.5 * Math.min(width, height);
  const radiusSpacing = radius / levels.length;

  let maxCircleSize = Math.min(80, 0.5 * radius / (levels.length || 1));

  levels.forEach((level, i) => {
    maxCircleSize = Math.min(maxCircleSize, 0.5 * Math.PI * radiusSpacing * (i + 1) / (level.nodes.length || 1));
  });

  // point size in radius
  const minPointSize = Math.max(2, maxCircleSize * (layout.dataPoint && layout.dataPoint.size ? layout.dataPoint.size[0] : 1));
  const maxPointSize = Math.max(2, maxCircleSize * (layout.dataPoint && layout.dataPoint.size ? layout.dataPoint.size[1] : 1));
  const sizing = d3.scaleLinear().domain([data.min, data.max]).rangeRound([minPointSize, maxPointSize]).clamp(true);

  levels = levels.map(level => ({
    showLabels: true,
    nodes: level.nodes,
    glyphCount: level.glyphCount,
    glyphCountWeight: level.glyphCountWeight,
    maxPointSize: sizing(level.max),
    corridor: [],
  }));

  spaceOutRadial(levels, radius, labelWeight);

  const tree = d3.tree().size([arcSize, radius])
    .separation((a, b) => ((a.parent === b.parent ? 1 : 2) / (a.depth || 1)));

  tree(data.hierarchy);

  const nodes = data.hierarchy.descendants().reverse();
  nodes.pop();

  canLabelFitRadially(levels, radius, maxPointSize);

  levels.forEach(canLabelFitHorizontally);

  spaceOutRadial(levels, radius, labelWeight);

  const sizeFn = d => (d.target ? adaptiveStrokeWidth ? sizing(d.target.data.size) : 1 // d.target exists for node links
    : sizing(d.data.size));

  nodes.forEach((node) => {
    delete node.data.textWidth;
    node.data.nodeSize = sizing(node.data.size);
    const l = levels[node.depth - 1];
    const arcPos = Math.round(node.x * Math.PI * l.offset / 180);
    l.corridor[arcPos] = Math.max(l.corridor[arcPos] || 0, Math.max(2 * node.data.nodeSize, node.data.showLabel ? 12 : 0));
  });

  levels.forEach((level) => {
    const corridor = level.corridor.slice();
    const out = [];
    let start = (corridor.length - 1) - corridor[corridor.length - 1] / 2;
    let end = 0;
    let firstIndex;
    const half = Math.PI * level.offset;
    corridor.forEach((c, i) => {
      if (typeof firstIndex === 'undefined') {
        firstIndex = i;
      }
      end = i - corridor[i] / 2;

      if (end - start > 12) {
        out.push({ start, end });
      } else if (start - end > 12) {
        out.push({ start, end: end + half * 2 });
        out.push({ start: start - half * 2, end });
      }
      start = i + corridor[i] / 2;
    });
    end = firstIndex;

    if (end - start > 12) {
      out.push({ start, end });
    }

    level.corridor = out;
  });

  expandRadialLabels(levels);

  let radialShift = 0;
  if (levels[0].nodes.length === 1) {
    radialShift = -90;
  }

  nodes.forEach((d) => {
    d.x = (((d.x + radialShift + (arcSize === 360 ? rotation : 0)) % 360) + 360) % 360;

    d.y = levels[d.depth - 1].offset;

    if (d.depth >= levels.length || d.data._extendToEdge) {
      const px = 0.5 * width;
      const py = 0.5 * height;
      const vx = Math.cos((d.x - 90) * Math.PI / 180);
      const vy = Math.sin((d.x - 90) * Math.PI / 180);

      const tl = -px / vx;
      const tr = 0.5 * width / vx;
      const tb = 0.5 * height / vy;
      const tt = -py / vy;

      const t = Math.min.apply(null, [tl, tr, tb, tt].filter(v => v >= 0));
      let x = px + t * vx;
      let y = py + t * vy;

      x -= px;
      y -= py;

      const c = Math.sqrt(x * x + y * y);
      d.data.textWidth = c - levels[d.depth - 1].offset - levels[d.depth - 1].maxPointSize - PADDING;
    }
  });


  const textTransformFn = d => (d.x < 180 ? `translate(${PADDING + levels[d.depth - 1].maxPointSize})` : `rotate(180) translate(-${PADDING + (levels[d.depth - 1].maxPointSize)})`);
  const radialTextAnchorFn = d => (d.x < 180 ? 'start' : 'end');

  return {
    levels,
    nodes,
    sizeFn,
    nameLabeling: {
      position: textTransformFn,
      align: radialTextAnchorFn,
    },
    tree,
  };
}

function _update(source) {
  clearTimeout(this._rotationTimer);
  const self = this;
  const isRadial = this._isRadial;

  const values = isRadial ? calculateRadial(this._data, this._layout, this._w, this._h, this._rotation)
    : calculateLinear(this._data, this._layout, this._w, this._h);

  const levels = values.levels;
  const nodes = values.nodes;
  const sizeFn = values.sizeFn;
  const labelPosition = values.nameLabeling.position;
  const labelAlignment = values.nameLabeling.align;

  const numNodes = Math.max(nodes.length, this._prevNumNodes || 0);

  this.duration = numNodes > MAX_NODES_FOR_ENABLED_ANIMATION ? 0 : duration; // turn off animation if too many nodes
  this._prevNumNodes = nodes.length;

  const minLabelSpace = Math.min.apply(null, levels.map(level => level.minLabelDistance));

  this.$element.removeClass('f-size-m f-size-s f-size-xs');
  if (minLabelSpace !== null && !isNaN(minLabelSpace) && minLabelSpace < 13) {
    this.$element.addClass(minLabelSpace < 11 ? 'f-size-xs'
      : minLabelSpace < 12 ? 'f-size-s' : 'f-size-m');
  }

  const diagonal = isRadial ? radialDiagonal : linearDiagonal;
  const transformFn = isRadial ? radialTransformFn : linearTransformFn;
  // var textAnchorFn = isRadial ? radialTextAnchorFn : linearTextAnchorFn;

  const enteringTransform = isRadial
    ? `rotate(${source._x - 90}) translate(${source._y})`
    : `translate(${source._y},${source._x})`;

  const exitingTransform = isRadial
    ? `rotate(${source.x - 90}) translate(${source.y})`
    : `translate(${source.y},${source.x})`;

  // nodes.forEach(function( d ) {
  //  d.y = d.depth * 240;
  // });

  // update existing nodes
  const node = self._root.selectAll('g.node')
    .data(nodes, d => d.data.id);

  // attach new nodes to parent's previous position (position to transition from)
  const nodeEnter = node.enter().append('g')
    .attr('class', d => `node ${(d.children || d._children) ? 'branch' : 'leaf'}`)
    .attr('transform', enteringTransform)
    .on('mouseenter', function onMouseEnter(d) {
      onNodeMouseOver(d, this, d3.event, isRadial, self._layout.selfNodes);
    })
    .on('mouseleave', (d) => {
      onNodeMouseLeave(d, null, d3.event);
    });

  nodeEnter.append('circle')
    .style('fill', colorFn)
    .style('stroke', strokeColorFn)
    .attr('r', 1e-6);

  // nodeEnter.append( 'rect' )
  //  .attr( 'y', -5 )
  //  .attr( 'height', 10 );

  // nodeEnter.append('use')
  //   .attr('xlink:href', function( d ) {
  //     return '#' + d.emoticon;
  //   })
  //   .attr('transform', 'scale(0.001, 0.001) translate(-370, -540)');

  // nodeEnter.append('text')
  //   .attr('dy', '.35em')
  //   .text(function( d ) {
  //     return d.data.name;
  //   })
  //   .each(wrap)
  // .style('fill-opacity', 1e-6);

  let nodeUpdate = nodeEnter.merge(node);
  if (self.duration) {
    nodeUpdate = nodeUpdate.transition().duration(self.duration);
  }
  nodeUpdate = nodeUpdate.attr('transform', transformFn);

  nodeUpdate.attr('class', (d) => {
    const classes = ['node'];

    const cellId = `${d.data.col};${d.data.row}`;
    classes.push((d.children || d._children) ? 'branch' : 'leaf');
    if (d.data.canExpand || d.data.canCollapse) {
      classes.push('node-expandable');
    }
    if (!d.data.isLocked && (!self.dataSelections.highlight || (self.dataSelections.highlight && self.dataSelections.col === d.data.col))) {
      classes.push('node-selectable');
    }
    if (self.dataSelections.highlight) {
      if (!self._isPathSelectActive) {
        if (d.data.col in self._selectedElemNo && d.data.elemNo in self._selectedElemNo[d.data.col]) {
          classes.push('node-selected');
        } else if (self.dataSelections.col !== d.data.col) {
          classes.push('unselectable');
        }
      } else if (self._selectedCells && (cellId in self._selectedCells)) {
        classes.push('node-selected');
      } else if (self._pathSelected && self._pathSelected[cellId]) {
        classes.push('node-semi-selected');
      } else if (self.dataSelections.col !== d.data.col) {
        classes.push('unselectable');
      }
    }

    return classes.join(' ');
  });

  nodeUpdate.select('circle')
    .style('stroke', strokeColorFn)
    .style('fill', colorFn)
    .style('stroke-width', d => `${(d.data.canCollapse || d.data.canExpand ? d.data.nodeSize / 6 : 0)}px`)
    .attr('r', d => (d.data.canCollapse || d.data.canExpand ? d.data.nodeSize - d.data.nodeSize / 12 : d.data.nodeSize))
    .attr('class', d => ((d.children || d._children) ? 'branch' : 'leaf'));

  const wrap = function wrap(d) {
    const that = d3.select(this);
    const width = 'textWidth' in d.data ? d.data.textWidth : levels[d.depth - 1].textWidth;

    let approxFit;
    let textLength;
    let text;

    that.text(d.data.name);
    textLength = that.node().getComputedTextLength();
    text = that.text();
    if (textLength > width && text.length > 0) {
      approxFit = Math.ceil(width / (textLength / text.length));
      text = text.slice(0, approxFit);
    }
    while (textLength > width && text.length > 0) {
      text = text.slice(0, -1);
      that.text(`${text}…`);
      textLength = that.node().getComputedTextLength();
    }
  };

  const checkLabelNode = function checkLabelNode(d) {
    if (d.data.showLabel === false || levels[d.depth - 1].showLabels === false) {
      d3.select(this).select('.label').remove();
      return;
    }

    let t = this.querySelector('.label');
    if (!t) { // enter
      t = d3.select(this).append('text')
        .text(d.data.name)
        .attr('class', 'label')
        .style('fill-opacity', 1e-6);
      if (isIE) {
        t.attr('dy', '.30em'); // IE does not support css property dominant-baseline which vertically centers the text, so we need to shift it manually
      }
    }

    // update
    d3.select(this).select('.label')
      .text(d.data.name)
      .each(wrap)
      .attr('text-anchor', labelAlignment)
      .attr('transform', labelPosition)
      .style('fill-opacity', 1.0);
  };

  const checkSymbolNode = function checkSymbolNode(d) {
    if (!d.data.symbol || d.data.nodeSize < 8) {
      d3.select(this).select('.symbol').remove();
      return;
    }

    let t;
    d.data._isSvgSymbol = false;

    if (/^#/.exec(d.data.symbol)) { // svg link
      d3.select(this).select('.symbol-text').remove(); // remove other types of symbols
      d.data._isSvgSymbol = true;
      t = this.querySelector('.symbol-svg');
      if (!t) { // enter
        d3.select(this).append('use')
          .attr('class', 'symbol symbol-svg')
          .attr('xlink:href', location.href + d.data.symbol)
          .attr('transform', 'scale(0.001, 0.001) translate(-370, -540)');
      } else {
        t.setAttribute('href', location.href + d.data.symbol);
      }
    } else { // text, icon
      d3.select(this).select('.symbol-svg').remove(); // remove other types of symbols
      t = this.querySelector('.symbol-text');
      let symbol = d.data.symbol;
      let match;
      let classes = 'symbol symbol-text';

      if ((match = /^q-([0-9]{2,4})$/.exec(symbol))) { // qlik icon
        symbol = String.fromCharCode(match[1]);
        classes += ' symbol-q';
      } else if ((match = /^m-([_a-z0-9]+)$/.exec(symbol))) { // material icon
        symbol = match[1];
        classes += ' symbol-m';
      }

      if (!t) { // enter
        t = d3.select(this).append('text')
          .text(symbol)
          .attr('class', `${classes} entering`);
      }

      // update
      const fontSize = sizeFn(d);
      if (new Color(d.data.color).isDark()) {
        classes += ' symbol-text--light';
      }
      t = d3.select(this).select('.symbol-text')
        .text(symbol)
        .attr('class', classes)
        .style('font-size', `${fontSize * 1.0}px`);

      if (isIE) {
        t.attr('dy', /symbol-m/.exec(classes) ? '.50em' : '0.30em'); // IE does not support css property dominant-baseline which vertically centers the text, so we need to shift it manually
      }
    }
  };

  nodeUpdate.each(checkLabelNode);
  nodeUpdate.each(checkSymbolNode);

  nodeUpdate.select('.symbol')
    .attr('transform', (d) => {
      const size = d.data.nodeSize;
      const scale = size / 20;

      return (d.data._isSvgSymbol ? `scale(${scale},${scale})` : '') + (isRadial ? `rotate(${-d.x + 90})` : '');
    });

  let nodeExit = node.exit();
  if (self.duration) {
    nodeExit = nodeExit.transition()
      .duration(self.duration)
      .attr('transform', exitingTransform);
  }
  nodeExit = nodeExit.remove();

  nodeExit.select('circle')
    .attr('r', 1e-6);

  nodeExit.select('.label')
    .style('fill-opacity', 1e-6);


  const links = this._data.hierarchy.links().filter(link => !!link.source.parent);

  // Update the links…
  const link = self._root.selectAll('path.link')
    .data(links, d => d.target.data.id);

  // Enter any new links at the parent's previous position.
  const linkEnter = link.enter().insert('path', 'g')
    .attr('class', 'link')
    .attr('d', () => {
      const o = { x: source._x, y: source._y };
      return diagonal({ source: o, target: o });
    })
    // .style('stroke', colorFn )
    .style('stroke-width', 1e-6);
  // if (self.duration) {
  //   linkEnter = linkEnter.transition()
  //     .duration(self.duration);
  // }
  // linkEnter.attr('d', diagonal);

  // Transition links to their new position.
  let linkUpdate = linkEnter.merge(link).style('stroke-width', sizeFn);
  if (self.duration) {
    linkUpdate = linkUpdate.transition()
      .duration(self.duration);
  }
  linkUpdate.attr('d', diagonal);

  linkUpdate.attr('class', (d) => {
    let s = 'link';
    const cellId = `${d.target.data.col};${d.target.data.row}`;
    if (self._isPathSelectActive && (cellId in self._selectedCells || self._pathSelected[cellId])) {
      s += ' semi-selected';
    }
    return s;
  });

  // Transition exiting nodes to the parent's new position.
  let linkExit = link.exit();
  if (self.duration) {
    linkExit = linkExit.transition()
      .duration(self.duration)
      .attr('d', () => {
        const o = { x: source.x, y: source.y };
        return diagonal({ source: o, target: o });
      });
  }
  linkExit.remove();

  nodes.forEach((n) => {
    n._x = n.x;
    n._y = n.y;
  });
}

function _updateSize() {
  const w = this.$element.width();


  const h = this.$element.height();

  this._w = w;
  this._h = h;

  this._radius = Math.min(w, h) / 2;

  this._padding = {
    left: 0,
    right: 0,
  };
}

// svg defs contanining url to document defined elements need to have their
// refs updated to point to absolute path of the element due to the change of base href in client.html
function updateRefs(svg) {
  $(svg).find("[fill^='url(']").each((i, el) => {
    const value = el.getAttribute('fill');
    const ref = /#([A-z0-9-]+)\)$/.exec(value);
    if (ref && ref[1]) {
      el.setAttribute('fill', `url(${location.href}#${ref[1]})`);
    }
  });
}

function onLocationChange() {
  if (globals.svgDefs) {
    setTimeout(() => {
      if (globals.svgDefs && globals.svgDefs.parentNode) {
        updateRefs(globals.svgDefs);
      }
    });
  }
}

class Dendrogram {
  constructor($scope, $element, options, backendApi, ext) {
    this.$scope = $scope;
    this.$element = $element;
    this.options = options;
    this.backendApi = backendApi;
    this.ext = ext;
    this.init();
  }

  init() {
    // this._super.apply( this, arguments );

    globals.instances++;

    this.$element.children().first();
    const el = this.$element.children().length ? this.$element.children()[0] : this.$element[0];

    this.$element.addClass('mekaarogram');

    if (!globals.svgDefs) {
      const doc = new DOMParser().parseFromString(defs, 'application/xml');
      if (doc.documentElement.querySelectorAll('parsererror').length === 0) {
        globals.svgDefs = document.importNode(doc.documentElement, true);
        globals.svgDefs.style.position = 'absolute';
        globals.svgDefs.style.opacity = '0';
        globals.svgDefs.style.zIndex = '-1';
      }
    }

    if (globals.svgDefs && !globals.svgDefs.parentNode) {
      document.body.appendChild(globals.svgDefs);
      updateRefs(globals.svgDefs);
      State.StateChanged.bind(onLocationChange);
    }

    const svg = d3.select(el).append('svg');
    svg.attr({
      xmlns: 'http://www.w3.org/2000/svg',
      xlink: 'http://www.w3.org/1999/xlink',
    });

    // svg.append( 'style' ).text( embedStyle );

    this._rotation = 0;

    this._svg = svg;
    this._root = svg.append('g');
    this._root.attr('class', 'root');

    this.dataSelections = {
      highlight: false,
      active: false,
    };
  }

  resize() {
    _updateSize.call(this);

    const w = this._w;
    const h = this._h;

    const svg = this._svg;

    _update.call(this, this._data.hierarchy);

    const rootTransform = this._isRadial ? `translate(${w / 2},${h / 2})`
      : `translate(${this._padding.left}, 0)`;

    svg.attr('width', w)
      .attr('height', h)
      .select('.root')
      .transition()
      .duration(this.duration)
      .attr('transform', rootTransform);
  }

  on() {
    // this._super();

    this.$element.on('mousewheel DOMMouseScroll', (e) => {
      e = e.originalEvent;
      e.preventDefault();
      const direction = (e.detail < 0 || e.wheelDelta > 0) ? 1 : -1;
      this._rotation += 10 * direction;
      clearTimeout(this._rotationTimer);
      this._rotationTimer = setTimeout(() => {
        _update.call(this, this._data.hierarchy);
      }, 30);
    });

    const self = this;


    let dataPoint;

    $(document).on(`keyup${namespace}`, (e) => {
      if (!self.backendApi.inSelections()) {
        return;
      }
      if (e.which === 27) {
        self.$scope.selectionsApi.cancel();
      } else if (e.which === 13) {
        self.$scope.selectionsApi.confirm();
      }
    });


    function onTap(e, d) {
      if (!self.dataSelections.highlight && e && e.shiftKey) {
        toggle.call(self, d);
        return;
      }

      if (!self.ext.selectionsEnabled) {
        return;
      }

      selections.select.call(self, d);
      _update.call(self, d);
    }

    Touche(this.$element[0]).swipe({ // eslint-disable-line new-cap
      id: namespace,
      options: {
        touches: 1,
        threshold: 10,
      },
      start(e, data) {
        if (self.dataSelections.highlight || self._layout.qHyperCube.qAlwaysFullyExpanded) {
          return;
        }
        dataPoint = d3.select(data.relatedTarget).data();
      },
      update() {
        Touche.preventGestures(this.gestureHandler);
      },
      end(e, data) {
        const dir = data.swipe.direction;
        let angle;

        if (!dataPoint || !dataPoint[0]) {
          return;
        }
        Touche.preventGestures(this.gestureHandler);
        const d = dataPoint[0];

        if (!self._isRadial) {
          if ((dir === 'left' && d.data.canExpand) || (dir === 'right' && d.data.canCollapse)) {
            toggle.call(self, d);
          }
        } else {
          angle = Math.abs(data.swipe.angle - (d.x + 90) % 360);
          if (d.data.canExpand && angle < 30 || d.data.canCollapse && Math.abs(angle - 180) < 30) {
            toggle.call(self, d);
          }
        }
      },
    })
      .tap({
        id: namespace,
        end(e, data) {
          let s = data.relatedTarget && data.relatedTarget.parentNode ? data.relatedTarget.parentNode.className : '';
          s = s.baseVal || s;
          if (s.match(/node-selectable/)) {
            onTap(e, d3.select(data.relatedTarget).data()[0]);
          }
        },
      });
  }

  off() {
    clearTimeout(this._rotationTimer);
    // this._super();
    this.$element.off('mousewheel DOMMouseScroll');
    $(document).off(`keyup${namespace}`);
    Touche(this.$element[0]).off('*', namespace); // eslint-disable-line new-cap
  }

  paint(layout) {
    this.dataSelections.highlight = false;
    this.dataSelections.col = -1;

    const data = dataProcessor.process(layout);

    this._isRadial = layout.radial;// false;//this._maxLevelNodes < 10 ? false : layout.radial;
    this._data = data;
    this._layout = layout;
    this.levels = data.levels;

    _updateSize.call(this);

    const w = this._w;
    const h = this._h;

    this._data.hierarchy._x = h / 2;
    this._data.hierarchy._y = 0;

    const root = this._root;
    root.attr('class', 'root');


    _update.call(this, this._toggledNode || this._data.hierarchy);
    this._toggledNode = null;

    const rootTransform = this._isRadial ? `translate(${w / 2},${h / 2})`
      : `translate(${this._padding.left}, 0)`;

    const svg = this._svg;
    svg.attr('width', w)
      .attr('height', h)
      .select('.root')
      .transition()
      .duration(this.duration)
      .attr('transform', rootTransform);
  }

  togglePathSelect() {
    this._isPathSelectActive = !this._isPathSelectActive;
    if (this.dataSelections.highlight) {
      selections.switchSelectionModel.call(this, this._isPathSelectActive);
      // selections.select.call( this );
    }
    _update.call(this, this._data.hierarchy);
  }

  isPathSelectionActive() {
    return this._isPathSelectActive;
  }

  isPathSelectionDisabled() {
    return this._layout && this._layout.qHyperCube.qDimensionInfo.length < 2;
  }

  clearSelections(endSelections, endHighlight) {
    this._selectedElemNo = {};
    this._pathSelected = {};
    this._selectedCells = {};

    if (endSelections || endHighlight) {
      this.dataSelections.highlight = false;
      this._root.attr('class', 'root');
    }
    if (endSelections) {
      this.dataSelections.active = false;
    }
  }

  selectValues(cells, clearOld) {
    if (!this.ext.selectionsEnabled) {
      return;
    }
    if (!this.dataSelections.active) {
      const $scope = this.$scope;
      // map functions for toolbar
      $scope.selectionsApi.confirm = () => {
        this.clearSelections(true);
        $scope.backendApi.endSelections(true).then(() => {
          $scope.selectionsApi.deactivated();
        });
      };
      $scope.selectionsApi.cancel = () => {
        this.clearSelections(true);
        $scope.backendApi.endSelections(false);
        $scope.selectionsApi.deactivated();
      };
      $scope.selectionsApi.deactivate = () => {
        this.clearSelections(true);
        this.deactivated();
      };
      $scope.selectionsApi.clear = () => {
        this.clearSelections(false, true);
        $scope.backendApi.clearSelections();
        $scope.selectionsApi.selectionsMade = false;
        this.resize();
      };

      // start selection mode
      this.backendApi.beginSelections();
      $scope.selectionsApi.activated();
      $scope.selectionsApi.selectionsMade = true;
      this.dataSelections.active = true;
    }

    if (!cells.length) {
      // obj.backendApi.clearSelections();
      this.$scope.selectionsApi.clear();
    } else {
      if (clearOld) {
        this.backendApi.clearSelections();
      }
      if (cells) {
        this.selectCells(cells).then(function s(res) {
          if (typeof res === 'boolean' && !res || typeof res === 'object' && !res.qSuccess) {
            this.$scope.selectionsApi.clear();
          }
        });
      }
      this.$scope.selectionsApi.selectionsMade = true;
    }
  }

  selectCells(cells) {
    const b = this.backendApi;
    switch (b.model.layout.qHyperCube.qMode) {
      case 'P':
        if (typeof b.model.selectPivotCells === 'function') {
          return b.model.selectPivotCells(b.path, cells);
        }
        return b.model.rpc('SelectPivotCells', null, [b.path, cells]);
      default:
        throw new Error('you are using a non-supported backend-api');
    }
  }

  destroy() {
    globals.instances--;

    if (globals.instances <= 0 && globals.svgDefs && globals.svgDefs.parentNode) {
      globals.svgDefs.parentNode.removeChild(globals.svgDefs);
      State.StateChanged.unbind(onLocationChange);
    }
  }
}

export default Dendrogram;
