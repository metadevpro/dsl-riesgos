const RECTANGLE_RADIUS = 5;

export const roundedRectangleShape = (x: number, y: number, width: number, height: number) => {
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

export const topRoundedRectangleShape = (x: number, y: number, width: number, height: number) => {
  return `M ${x + RECTANGLE_RADIUS} ${y} L ${x + width - RECTANGLE_RADIUS} ${y} A ${
    RECTANGLE_RADIUS
  } ${RECTANGLE_RADIUS} 0 0 1 ${x + width} ${y + RECTANGLE_RADIUS} L ${x + width} ${y + height} L ${
    x
  } ${y + height} L ${x} ${y + RECTANGLE_RADIUS} A ${RECTANGLE_RADIUS} ${RECTANGLE_RADIUS} 0 0 1 ${x + RECTANGLE_RADIUS} ${y} Z`;
};

export const bottomRoundedRectangleShape = (x: number, y: number, width: number, height: number) => {
  return `M ${x} ${y} L ${x + width} ${y} L ${x + width} ${
    y + height - RECTANGLE_RADIUS
  } A ${RECTANGLE_RADIUS} ${RECTANGLE_RADIUS} 0 0 1 ${x + width - RECTANGLE_RADIUS} ${y + height} L ${
    x + RECTANGLE_RADIUS
  } ${y + height} A ${RECTANGLE_RADIUS} ${RECTANGLE_RADIUS} 0 0 1 ${x} ${y + height - RECTANGLE_RADIUS} L ${x} ${y} Z`;
};
