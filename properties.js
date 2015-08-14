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
							adaptiveStrokeWidth: {
								type: "boolean",
								ref: "adaptiveStrokeWidth",
								defaultValue: true,
								label: "Dynamic link width"
							},
							radial: {
								type: "boolean",
								ref: "radial",
								defaultValue: false,
								label: "Radial"
							}
						}
					}
				}
			}
		}
	};

} );
