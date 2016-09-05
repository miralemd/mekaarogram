export default {
	type: "items",
	component: "accordion",
	items: {
		data: {
			uses: "data",
			items: {
				measures: {
					items: {
						colorExpression: {
							component: "expression",
							expressionType: "measure",
							ref: "qAttributeExpressions.0.qExpression",
							label: "Node color",
							defaultValue: ""
						},
						smileyExpression: {
							component: "expression",
							expressionType: "measure",
							ref: "qAttributeExpressions.1.qExpression",
							label: "Emoticon",
							defaultValue: ""
						}
					}
				}
			}
		},
		sorting: {
			uses: "sorting",
			component: "pivot-sorting"
		},
		settings: {
			uses: "settings",
			items: {
				presentation: {
					type: "items",
					translation: "properties.presentation",
					items: {
						//root: {
						//	type: "boolean",
						//	ref: "showRoot",
						//	defaultValue: true,
						//	label: "Show root"
						//},
						nodeSize: {
							type: "array",
							component: "slider",
							ref: "dataPoint.size",
							translation: "properties.dataPoints.bubbleSizes",
							min: 0.1,
							max: 1,
							step: 0.05,
							defaultValue: [0.2, 0.8]
						},
						adaptiveStrokeWidth: {
							type: "boolean",
							ref: "adaptiveStrokeWidth",
							defaultValue: true,
							translation: "mek.dynamicLinkWidth",
							show: function( data, handler ) {
								return handler.getDimensions().length > 1;
							}
						},
						radial: {
							type: "boolean",
							ref: "radial",
							defaultValue: false,
							translation: "mek.radial"
						},
						labelWeight: {
							show: false,
							type: "number",
							component: "slider",
							ref: "labelWeight",
							translation: "mek.labelWeight",
							min: 0,
							max: 1,
							step: 0.05,
							defaultValue: 0.5
						},
						expanded: {
							ref: "qHyperCubeDef.qAlwaysFullyExpanded",
							type: "boolean",
							translation: "properties.pivot.fullyExpanded",
							defaultValue: true,
							show: function( data, handler ) {
								return handler.getDimensions().length > 1;
							}
						},
						selfNodes: {
							type: "boolean",
							ref: "selfNodes",
							defaultValue: false,
							translation: "mek.excludeDescendants",
							show: function( data, handler ) {
								return handler.getDimensions().length > 1;
							}
						},

						nullNodes: {
							type: "boolean",
							ref: "showNullNodes",
							defaultValue: false,
							translation: "mek.showNullNodes"
						}
					}
				}
			}
		}
	}
};
