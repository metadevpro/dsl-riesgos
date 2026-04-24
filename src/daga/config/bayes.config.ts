import { ClosedShape, DiagramConfig, HorizontalAlign, LineShape, LineStyle, Side, Type, VerticalAlign } from '@metadev/daga-angular';

export const bayes_CONFIG: DiagramConfig = {
    type: 'simple-diagram',
    canvas: {
        grid: {
            spacing: 50,
            snap: true
        }
    },
    connectionSettings: {
        inferConnectionType: true,
        defaultConnection: 'diagram-connection'
    },
    components: {
        buttons: {},
        palette: {
            sections: [
                {
                    name: '',
                    templates: [
                        {
                            templateType: 'node',
                            type: 'diagram-node',
                            label: 'Node'
                        }
                    ]
                }
            ]
        },
        propertyEditor: {}
    },
    nodeTypes: [
        {
            id: 'diagram-node',
            name: 'Node',
            defaultWidth: 200,
            defaultHeight: 100,
            label: {
                fontSize: 14,
                margin: 6,
                fit: false,
                horizontalAlign: HorizontalAlign.Left,
                verticalAlign: VerticalAlign.Top,
            },
            ports: [
                {
                    coords: [100, 0],
                    direction: Side.Top
                },
                {
                    coords: [0, 50],
                    direction: Side.Left
                },
                {
                    coords: [100, 100],
                    direction: Side.Bottom
                },
                {
                    coords: [200, 50],
                    direction: Side.Right
                }
            ],
            look: {
                lookType: 'shaped-look',
                shape: ClosedShape.Rectangle,
                fillColor: '#FFFFFF',
                borderColor: '#888780',
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
                    name: 'bayes_evidence',
                    type: Type.Option,
                    defaultValue: 'null',
                    basic: false,
                    editable: true,
                    options: [
                        { key: 'si', label: 'Sí' },
                        { key: 'null', label: '?' },
                        { key: 'no', label: 'No' }
                    ]
                },
                {
                    name: 'bayes_cpt',
                    type: Type.Text,
                    defaultValue: '',
                    basic: false,
                    editable: false
                },
                {
                    name: 'bayes_pSi',
                    type: Type.Number,
                    defaultValue: 50,
                    basic: false,
                    editable: false
                },
                {
                    name: 'bayes_pNo',
                    type: Type.Number,
                    defaultValue: 50,
                    basic: false,
                    editable: false
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
                color: '#888780',
                thickness: 1.5,
                style: LineStyle.Solid,
                shape: LineShape.Bezier,
                selected: {
                    color: '#378ADD'
                },
                highlighted: {
                    thickness: 3
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
            startTypes: ['diagram-node'],
            endTypes: ['diagram-node'],
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
            defaultValue: 'unnamed',
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
        }
    ]
};