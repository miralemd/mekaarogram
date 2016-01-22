/**
 * @owner Miralem Drek (mek)
 */

define( [], function () {

	return {
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
								defaultValue: ''
							},
							smileyExpression: {
								component: "expression",
								expressionType: "measure",
								ref: "qAttributeExpressions.1.qExpression",
								label: "Emoticon",
								defaultValue: ''
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
							expanded: {
								ref: "qHyperCubeDef.qAlwaysFullyExpanded",
								type: "boolean",
								translation: "properties.pivot.fullyExpanded",
								defaultValue: true
							},
							selfNodes: {
								type: "boolean",
								ref: "selfNodes",
								defaultValue: false,
								translation: "mek.excludeDescendants"
							},
							adaptiveStrokeWidth: {
								type: "boolean",
								ref: "adaptiveStrokeWidth",
								defaultValue: true,
								translation: "mek.dynamicLinkWidth"
							},
							radial: {
								type: "boolean",
								ref: "radial",
								defaultValue: false,
								translation: "mek.radial"
							},
							spacing: {
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

} );
