import {
  ClosedShape,
  DiagramConfig,
  HorizontalAlign,
  LineShape,
  LineStyle,
  SectionGridConfig,
  ShapedLookConfig,
  Side,
  Type,
  VerticalAlign
} from '@metadev/daga-angular';
import { bottomRoundedRectangleShape, roundedRectangleShape, topRoundedRectangleShape } from '../shape';

interface NodeVisual {
  solid: string;
  tint: string;
}

const NODE_VISUALS: Record<string, NodeVisual> = {
  'start-diagram-node': { solid: '#15A34A', tint: '#DCFCE7' },
  'event-diagram-node': { solid: '#BA51C5', tint: '#F4DCF7' },
  'state-diagram-node': { solid: '#047E9C', tint: '#D5EEF6' },
  'end-diagram-node': { solid: '#B8475A', tint: '#F7DCE1' }
};

const NODE_BORDER = '#000000';
const NODE_BORDER_SELECTED = '#378ADD';
const NODE_FILL_WHITE = '#FFFFFF';

const NODE_LABEL_CONFIG = {
  fontSize: 18,
  margin: [0, 0, -15, 0],
  fit: false,
  horizontalAlign: HorizontalAlign.Center,
  verticalAlign: VerticalAlign.Center
};

const NODE_PORTS = [
  { coords: [125, 0] as [number, number], direction: Side.Top },
  { coords: [0, 75] as [number, number], direction: Side.Left },
  { coords: [125, 150] as [number, number], direction: Side.Bottom },
  { coords: [250, 75] as [number, number], direction: Side.Right }
];

const NODE_PROPERTIES = [
  { name: 'node name', type: Type.Text, basic: true, editable: true, rootAttribute: 'name' },
  { name: 'node number', type: Type.Number, defaultValue: 1, basic: true, editable: true }
];

const NODE_PROPERTIES_WITH_PROB = [
  ...NODE_PROPERTIES,
  { name: 'probability', type: Type.Number, defaultValue: 0, basic: true, editable: true }
];

const topBandLook = (tint: string): ShapedLookConfig => ({
  lookType: 'shaped-look',
  shape: topRoundedRectangleShape,
  fillColor: tint,
  borderColor: NODE_BORDER,
  borderThickness: 1,
  selected: {
    fillColor: tint,
    borderColor: NODE_BORDER_SELECTED,
    borderThickness: 2
  },
  highlighted: {
    borderThickness: 1
  }
});

const middleBandLook = (): ShapedLookConfig => ({
  lookType: 'shaped-look',
  shape: ClosedShape.Rectangle,
  fillColor: NODE_FILL_WHITE,
  borderColor: NODE_BORDER,
  borderThickness: 1,
  selected: {
    fillColor: NODE_FILL_WHITE,
    borderColor: NODE_BORDER_SELECTED,
    borderThickness: 2
  },
  highlighted: {
    borderThickness: 1
  }
});

const bottomBandLook = (): ShapedLookConfig => ({
  lookType: 'shaped-look',
  shape: bottomRoundedRectangleShape,
  fillColor: NODE_FILL_WHITE,
  borderColor: NODE_BORDER,
  borderThickness: 1,
  selected: {
    fillColor: NODE_FILL_WHITE,
    borderColor: NODE_BORDER_SELECTED,
    borderThickness: 2
  },
  highlighted: {
    borderThickness: 1
  }
});

const twoBandSectionGrid = (tint: string): SectionGridConfig => ({
  defaultWidths: [250],
  defaultHeights: [32, 118],
  minWidths: [250],
  minHeights: [32, 118],
  margin: 0,
  sections: [[{ look: topBandLook(tint) }], [{ look: bottomBandLook() }]]
});

const threeBandSectionGrid = (tint: string): SectionGridConfig => ({
  defaultWidths: [250],
  defaultHeights: [32, 90, 28],
  minWidths: [250],
  minHeights: [32, 90, 28],
  margin: 0,
  sections: [[{ look: topBandLook(tint) }], [{ look: middleBandLook() }], [{ look: bottomBandLook() }]]
});

const nodeShellLook = (): ShapedLookConfig => ({
  lookType: 'shaped-look',
  shape: roundedRectangleShape,
  fillColor: 'transparent',
  borderColor: 'transparent',
  borderThickness: 0,
  selected: { borderColor: 'transparent', fillColor: 'transparent' },
  highlighted: { borderColor: 'black', borderThickness: 4 }
});

export const PROB_CONFIG: DiagramConfig = {
  type: 'simple-diagram',
  canvas: {
    grid: {
      spacing: 50,
      snap: true,
      style: 'lines',
      thickness: 0.02
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
      width: '14rem',
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
                backgroundImage: '/assets/palette/element-state.svg'
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
                backgroundImage: '/assets/palette/element-event.svg'
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
    }
  },
  nodeTypes: [
    {
      id: 'event-diagram-node',
      name: 'Node',
      defaultWidth: 250,
      defaultHeight: 150,
      label: NODE_LABEL_CONFIG,
      ports: NODE_PORTS,
      look: nodeShellLook(),
      sectionGrid: threeBandSectionGrid(NODE_VISUALS['event-diagram-node'].tint),
      properties: NODE_PROPERTIES_WITH_PROB
    },
    {
      id: 'state-diagram-node',
      name: 'State',
      defaultWidth: 250,
      defaultHeight: 150,
      label: NODE_LABEL_CONFIG,
      ports: NODE_PORTS,
      look: nodeShellLook(),
      sectionGrid: twoBandSectionGrid(NODE_VISUALS['state-diagram-node'].tint),
      properties: NODE_PROPERTIES
    },
    {
      id: 'start-diagram-node',
      name: 'Start',
      defaultWidth: 250,
      defaultHeight: 150,
      label: NODE_LABEL_CONFIG,
      ports: NODE_PORTS,
      look: nodeShellLook(),
      sectionGrid: twoBandSectionGrid(NODE_VISUALS['start-diagram-node'].tint),
      properties: NODE_PROPERTIES
    },
    {
      id: 'end-diagram-node',
      name: 'Node',
      defaultWidth: 250,
      defaultHeight: 150,
      label: NODE_LABEL_CONFIG,
      ports: NODE_PORTS,
      look: nodeShellLook(),
      sectionGrid: twoBandSectionGrid(NODE_VISUALS['end-diagram-node'].tint),
      properties: NODE_PROPERTIES
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
    }
  ]
};
