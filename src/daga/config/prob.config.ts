import {DiagramConfig, HorizontalAlign, LineShape, LineStyle, Side, Type, VerticalAlign } from '@metadev/daga-angular';

const RECTANGLE_RADIUS = 5;

const roundedRectangleShape = (
  x: number,
  y: number,
  width: number,
  height: number
) => {
  return `M ${x + RECTANGLE_RADIUS} ${y} L ${x + width - RECTANGLE_RADIUS} ${y} A ${
    RECTANGLE_RADIUS
  } ${RECTANGLE_RADIUS} 0 0 1 ${x + width} ${y + RECTANGLE_RADIUS} L ${x + width} ${
    y + height - RECTANGLE_RADIUS
  } A ${RECTANGLE_RADIUS} ${RECTANGLE_RADIUS} 0 0 1 ${x + width - RECTANGLE_RADIUS} ${y + height} L ${
    x + RECTANGLE_RADIUS
  } ${y + height} A ${RECTANGLE_RADIUS} ${RECTANGLE_RADIUS} 0 0 1 ${x} ${
    y + height - RECTANGLE_RADIUS
  } L ${x} ${y + RECTANGLE_RADIUS} A ${RECTANGLE_RADIUS} ${RECTANGLE_RADIUS} 0 0 1 ${x + RECTANGLE_RADIUS} ${y} Z`;
};

export const PROB_CONFIG: DiagramConfig = {
  type: 'simple-diagram',
  canvas: {
    grid: {
      spacing: 50,
      snap: true,
      style: 'lines',
      thickness: 0.02,
    }
  },
  layoutFormat: 'tree',
  connectionSettings: {
    inferConnectionType: true,
    defaultConnection: 'diagram-connection'
  },
  components: {
    buttons: {
      enableLayout: true,
      enableSelection: false
    },
    palette: {
      width: '15rem',
      gap: '0.5rem',
      sections: [
        {
          name: '',
          templates: [
            {
              templateType: 'node',
              type: 'start-diagram-node',
              label: 'Start',
              width: 212,
              height: 40,
              labelLook: null,
              look: {
                lookType: 'image-look',
                backgroundImage: '/assets/palette/element-start.svg'
              }
            },
            {
              templateType: 'node',
              type: 'state-diagram-node',
              label: 'State',
              width: 212,
              height: 40,
              labelLook: null,
              look: {
                lookType: 'image-look',
                backgroundImage: '/assets/palette/element-transition.svg'
              }
            },
            {
              templateType: 'node',
              type: 'event-diagram-node',
              label: 'Event',
              width: 212,
              height: 40,
              labelLook: null,
              look: {
                lookType: 'image-look',
                backgroundImage: '/assets/palette/element-state.svg'
              }
            },
            {
              templateType: 'node',
              type: 'end-diagram-node',
              label: 'End',
              width: 212,
              height: 40,
              labelLook: null,
              look: {
                lookType: 'image-look',
                backgroundImage: '/assets/palette/element-end.svg'
              }
            }
          ]
        }
      ]
    },
    propertyEditor: {
      width: '16rem'
    },
  },
  nodeTypes: [
    {
      id: 'event-diagram-node',
      name: 'Node',
      defaultWidth: 250,
      defaultHeight: 150,
      label: {
        fontSize: 18,
        margin: [0,0,-15,0],
        fit: false,
        horizontalAlign: HorizontalAlign.Center,
        verticalAlign: VerticalAlign.Center
      },
      ports: [
        {
          coords: [125, 0],
          direction: Side.Top
        },
        {
          coords: [0, 75],
          direction: Side.Left
        },
        {
          coords: [125, 150],
          direction: Side.Bottom
        },
        {
          coords: [250, 75],
          direction: Side.Right
        }
      ],
      look: {
        lookType: 'shaped-look',
        shape: roundedRectangleShape,
        fillColor: '#FFFFFF',
        borderColor: '#E5E7EB',
        borderThickness: 1,
        selected: {
          fillColor: '#FFFFFF',
          borderColor: '#378ADD',
          borderThickness: 2
        },
        highlighted: {
          borderThickness: 3
        }
      },
      properties: [
        {
          name: 'node name',
          type: Type.Text,
          basic: true,
          editable: true,
          rootAttribute: 'name'
        },
        {
          name: 'node number',
          type: Type.Number,
          defaultValue: 1,
          basic: true,
          editable: true
        },
        {
          name: 'probability',
          type: Type.Number,
          defaultValue: 0,
          basic: true,
          editable: true
        }
      ]
    },
    {
      id: 'state-diagram-node',
      name: 'State',
      defaultWidth: 250,
      defaultHeight: 150,
      label: {
        fontSize: 18,
        margin: [0,0,-15,0],
        fit: false,
        horizontalAlign: HorizontalAlign.Center,
        verticalAlign: VerticalAlign.Center
      },
      ports: [
        {
          coords: [125, 0],
          direction: Side.Top
        },
        {
          coords: [0, 75],
          direction: Side.Left
        },
        {
          coords: [125, 150],
          direction: Side.Bottom
        },
        {
          coords: [250, 75],
          direction: Side.Right
        }
      ],
      look: {
        lookType: 'shaped-look',
        shape: roundedRectangleShape,
        fillColor: '#FFFFFF',
        borderColor: '#E5E7EB',
        borderThickness: 1,
        selected: {
          fillColor: '#FFFFFF',
          borderColor: '#378ADD',
          borderThickness: 2
        },
        highlighted: {
          borderThickness: 3
        }
      },
      properties: [
        {
          name: 'node name',
          type: Type.Text,
          basic: true,
          editable: true,
          rootAttribute: 'name'
        },
        {
          name: 'node number',
          type: Type.Number,
          defaultValue: 1,
          basic: true,
          editable: true
        }
      ]
    },
    {
      id: 'start-diagram-node',
      name: 'Start',
      defaultWidth: 250,
      defaultHeight: 150,
      label: {
        fontSize: 18,
        margin: [0,0,-15,0],
        fit: false,
        horizontalAlign: HorizontalAlign.Center,
        verticalAlign: VerticalAlign.Center
      },
      ports: [
        {
          coords: [125, 0],
          direction: Side.Top
        },
        {
          coords: [0, 75],
          direction: Side.Left
        },
        {
          coords: [125, 150],
          direction: Side.Bottom
        },
        {
          coords: [250, 75],
          direction: Side.Right
        }
      ],
      look: {
        lookType: 'shaped-look',
        shape: roundedRectangleShape,
        fillColor: '#FFFFFF',
        borderColor: '#E5E7EB',
        borderThickness: 1,
        selected: {
          fillColor: '#FFFFFF',
          borderColor: '#378ADD',
          borderThickness: 2
        },
        highlighted: {
          borderThickness: 3
        }
      },
      properties: [
        {
          name: 'node name',
          type: Type.Text,
          basic: true,
          editable: true,
          rootAttribute: 'name'
        },
        {
          name: 'node number',
          type: Type.Number,
          defaultValue: 1,
          basic: true,
          editable: true
        }
      ]
    },
    {
      id: 'end-diagram-node',
      name: 'Node',
      defaultWidth: 250,
      defaultHeight: 150,
      label: {
        fontSize: 18,
        margin: [0,0,-15,0],
        fit: false,
        horizontalAlign: HorizontalAlign.Center,
        verticalAlign: VerticalAlign.Center
      },
      ports: [
        {
          coords: [125, 0],
          direction: Side.Top
        },
        {
          coords: [0, 75],
          direction: Side.Left
        },
        {
          coords: [125, 150],
          direction: Side.Bottom
        },
        {
          coords: [250, 75],
          direction: Side.Right
        }
      ],
      look: {
        lookType: 'shaped-look',
        shape: roundedRectangleShape,
        fillColor: '#FFFFFF',
        borderColor: '#E5E7EB',
        borderThickness: 1,
        selected: {
          fillColor: '#FFFFFF',
          borderColor: '#378ADD',
          borderThickness: 2
        },
        highlighted: {
          borderThickness: 3
        }
      },
      properties: [
        {
          name: 'node name',
          type: Type.Text,
          basic: true,
          editable: true,
          rootAttribute: 'name'
        },
        {
          name: 'node number',
          type: Type.Number,
          defaultValue: 1,
          basic: true,
          editable: true
        }
      ]
    }
  ],
  connectionTypes: [
    {
      id: 'diagram-connection',
      name: 'Connection',
      look: {
        lookType: 'connection-look',
        color: '#000000',
        thickness: 3,
        style: LineStyle.Solid,
        shape: LineShape.Bezier,
        selected: {
          color: '#AA00AA'
        },
        highlighted: {
          thickness: 5
        }
      },
      endMarkerLook: {
        lookType: 'marker-image-look',
        image: '/assets/marker/arrowDaga.svg',
        width: 4,
        height: 8,
        refX: 4,
        refY: 4
      },
      label: {
        color: '#000000',
        selectedColor: '#000000',
        fontSize: 12,
        padding: 6,
        margin: 20
      },
      startTypes: ['event-diagram-node', 'state-diagram-node'],
      endTypes: ['event-diagram-node', 'state-diagram-node'],
      properties: [
        {
          name: 'connection name',
          type: Type.Text,
          defaultValue: 'miss connection',
          basic: true,
          editable: true
        },
        {
          name: 'weight',
          type: Type.Number,
          defaultValue: 1,
          basic: true,
          editable: true
        }
      ]
    },
    {
      id: 'start-connection',
      name: 'Start-Connection',
      look: {
        lookType: 'connection-look',
        color: '#000000',
        thickness: 3,
        style: LineStyle.Solid,
        shape: LineShape.Bezier,
        selected: {
          color: '#AA00AA'
        },
        highlighted: {
          thickness: 5
        }
      },
      endMarkerLook: {
        lookType: 'marker-image-look',
        image: '/assets/marker/arrowDaga.svg',
        width: 4,
        height: 8,
        refX: 4,
        refY: 4
      },
      label: {
        color: '#000000',
        selectedColor: '#000000',
        fontSize: 12,
        padding: 6,
        margin: 20
      },
      startTypes: ['start-diagram-node'],
      endTypes: ['event-diagram-node', 'state-diagram-node'],
      properties: [
        {
          name: 'connection name',
          type: Type.Text,
          defaultValue: 'miss connection',
          basic: true,
          editable: true
        },
        {
          name: 'weight',
          type: Type.Number,
          defaultValue: 1,
          basic: true,
          editable: true
        }
      ]
    },
    {
      id: 'end-connection',
      name: 'End-Connection',
      look: {
        lookType: 'connection-look',
        color: '#000000',
        thickness: 3,
        style: LineStyle.Solid,
        shape: LineShape.Bezier,
        selected: {
          color: '#AA00AA'
        },
        highlighted: {
          thickness: 5
        }
      },
      endMarkerLook: {
        lookType: 'marker-image-look',
        image: '/assets/marker/arrowDaga.svg',
        width: 4,
        height: 8,
        refX: 4,
        refY: 4
      },
      label: {
        color: '#000000',
        selectedColor: '#000000',
        fontSize: 12,
        padding: 6,
        margin: 20
      },
      startTypes: ['event-diagram-node', 'state-diagram-node'],
      endTypes: ['end-diagram-node'],
      properties: [
        {
          name: 'connection name',
          type: Type.Text,
          defaultValue: 'end connection',
          basic: true,
          editable: true
        },
        {
          name: 'weight',
          type: Type.Number,
          defaultValue: 1,
          basic: true,
          editable: true
        }
      ]
    }
  ],
  properties: [
    {
      name: 'name',
      type: Type.Text,
      defaultValue: 'binomial diagram',
      basic: true,
      editable: true,
      rootAttribute: 'name'
    },
    {
      name: 'description',
      type: Type.TextArea,
      basic: true,
      editable: true,
      rootAttribute: 'description'
    },
    {
      name: 'layout',
      type: Type.Option,
      defaultValue: 'tree',
      basic: true,
      editable: true,
      rootAttribute: 'layoutFormat',
      options: [
        { key: 'adjacency', label: 'Adjacency' },
        { key: 'breadth', label: 'Breadth First' },
        { key: 'priority', label: 'Priority' },
        { key: 'tree', label: 'Tree' }
      ]
    },
    {
      name: 'created',
      type: Type.Datetime,
      basic: true,
      editable: false,
      rootAttribute: 'createdAt'
    },
    {
      name: 'last opened',
      type: Type.Datetime,
      basic: true,
      editable: false,
      rootAttribute: 'updatedAt'
    },
  ]
};
