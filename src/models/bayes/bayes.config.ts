import {
  DiagramConfig,
  HorizontalAlign,
  LineShape,
  LineStyle,
  SectionGridConfig,
  ShapedLookConfig,
  Side,
  Type,
  VerticalAlign,
  layouts
} from '@metadev/daga-angular';
import { bottomRoundedRectangleShape, roundedRectangleShape, topRoundedRectangleShape } from '../shape';
import { BayesCausalLayout } from './util/causalLayout';

layouts['bayes-causal'] = new BayesCausalLayout();

interface BayesNodeVisual {
  solid: string;
  tint: string;
}

const BAYES_NODE_VISUALS: Record<string, BayesNodeVisual> = {
  'cause-diagram-node': { solid: '#C2410C', tint: '#FEE7DC' },
  'effect-diagram-node': { solid: '#047857', tint: '#D4F1E3' },
  'event-diagram-node': { solid: '#6D28D9', tint: '#EEDCFA' }
};

const NODE_BORDER = '#000000';
const NODE_BORDER_SELECTED = '#378ADD';
const NODE_FILL_WHITE = '#FFFFFF';

const NODE_LABEL_CONFIG = {
  fontSize: 14,
  margin: [42, 0, 0, 0],
  fit: false,
  horizontalAlign: HorizontalAlign.Center,
  verticalAlign: VerticalAlign.Top
};

const NODE_PORTS = [
  { coords: [125, 0] as [number, number], direction: Side.Top },
  { coords: [0, 75] as [number, number], direction: Side.Left },
  { coords: [125, 150] as [number, number], direction: Side.Bottom },
  { coords: [250, 75] as [number, number], direction: Side.Right }
];

const BAYES_NODE_PROPERTIES = [
  { name: 'node name', type: Type.Text, basic: true, editable: true, rootAttribute: 'name' },
  {
    name: 'bayes_evidence',
    type: Type.Option,
    defaultValue: 'null',
    basic: false,
    editable: true,
    options: [
      { key: 'si', label: 'Yes' },
      { key: 'null', label: '?' },
      { key: 'no', label: 'No' }
    ]
  },
  { name: 'bayes_cpt', type: Type.Text, defaultValue: '', basic: false, editable: false },
  { name: 'bayes_pSi', type: Type.Number, defaultValue: 50, basic: false, editable: false },
  { name: 'bayes_pNo', type: Type.Number, defaultValue: 50, basic: false, editable: false }
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

const nodeShellLook = (): ShapedLookConfig => ({
  lookType: 'shaped-look',
  shape: roundedRectangleShape,
  fillColor: 'transparent',
  borderColor: 'transparent',
  borderThickness: 2,
  selected: { borderColor: 'transparent', fillColor: 'transparent' },
  highlighted: { borderColor: 'black', borderThickness: 4 }
});

const buildBayesNodeType = (id: string, name: string) => ({
  id,
  name,
  defaultWidth: 250,
  defaultHeight: 150,
  label: NODE_LABEL_CONFIG,
  ports: NODE_PORTS,
  look: nodeShellLook(),
  sectionGrid: twoBandSectionGrid(BAYES_NODE_VISUALS[id].tint),
  properties: BAYES_NODE_PROPERTIES
});

export const bayes_CONFIG: DiagramConfig = {
  type: 'simple-diagram',
  canvas: {
    grid: {
      spacing: 50,
      snap: true,
      style: 'lines',
      thickness: 0.02
    }
  },
  layoutFormat: 'bayes-causal',
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
              type: 'cause-diagram-node',
              label: 'Cause',
              width: 212,
              height: 40,
              labelLook: null,
              look: {
                lookType: 'image-look',
                backgroundImage: '/assets/palette/element-cause.svg'
              }
            },
            {
              templateType: 'node',
              type: 'effect-diagram-node',
              label: 'Effect',
              width: 212,
              height: 40,
              labelLook: null,
              look: {
                lookType: 'image-look',
                backgroundImage: '/assets/palette/element-effect.svg'
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
                backgroundImage: '/assets/palette/element-event-bayes.svg'
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
    buildBayesNodeType('cause-diagram-node', 'Cause'),
    buildBayesNodeType('effect-diagram-node', 'Effect'),
    buildBayesNodeType('event-diagram-node', 'Event')
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
        look: {
          lookType: 'field-look',
          fontColor: '#000000',
          fontSize: 12,
          fontWeight: 400,
          highlighted: {
            fontWeight: 600
          }
        },
        padding: 6,
        margin: 20
      },
      startTypes: ['cause-diagram-node', 'effect-diagram-node', 'event-diagram-node'],
      endTypes: ['cause-diagram-node', 'effect-diagram-node', 'event-diagram-node'],
      properties: [
        {
          name: 'connection name',
          type: Type.Text,
          defaultValue: '',
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
      defaultValue: 'bayes diagram',
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
      defaultValue: 'adjacency',
      basic: true,
      editable: true,
      rootAttribute: 'layoutFormat',
      options: [
        { key: 'adjacency', label: 'Adjacency' },
        { key: 'breadth', label: 'Breadth First' },
        { key: 'priority', label: 'Priority' }
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
