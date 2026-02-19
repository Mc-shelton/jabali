import { useId, useMemo } from 'react';
import './../styles/blob.scss';

/**
 * Abstract blob background shape.
 * Supports solid color (default) or image fill via SVG pattern.
 * Variants give different silhouettes.
 */
const paths = [
  'M0 270.5C0 115.261 115.261 0 270.5 0h283c94.323 0 170.5 76.177 170.5 170.5 0 35.158-10.777 69.089-30.938 97.678-14.71 20.735-20.256 46.642-15.195 71.441l3.059 15.293c11.535 57.729-12.698 116.689-62.185 150.153l-52.048 35.669C512.931 574.073 489.004 587 463.2 590.638l-50.231 6.903c-27.757 3.808-55.663-4.443-77.19-22.932l-33.598-28.875c-16.871-14.482-37.773-23.435-59.86-25.5L125.8 507.414C55.933 500.902 0 441.425 0 371.13Z',
  'M26 237.5C26 114.337 125.337 15 248.5 15h246c96.155 0 174 77.845 174 174 0 32.184-9.09 63.7-26.35 90.844-18.97 29.9-22.32 67.83-8.97 100.33l9.1 22.316c25.04 61.424-0.88 131.46-59.33 162.95L506 605.5c-36.62 19.97-78.41 27.25-119.55 20.9l-61.88-9.5c-27.99-4.3-53.1-19.33-69.48-41.87l-23.55-32.77c-16.44-22.87-42.27-38.2-70.48-41.61L94.8 495.7C50.37 490.37 26 457.77 26 412.92Z',
  'M10 240c0-115.606 93.77-209.5 209.5-209.5h265c96.59 0 175 78.41 175 175 0 29.33-7.22 58.2-20.98 84-17.55 32.88-17.22 72.16 0.87 104.75l8.61 15.65c33.38 60.64 11.25 136.2-48.76 170.83l-63.44 37.12C496.13 638.18 459.1 648 421.2 644.01l-74.51-7.82c-33.54-3.52-63.53-22.67-80.38-52.12l-17.46-30.47c-16.47-28.74-45.69-47.58-78.35-50.07l-44.3-3.39C53.34 498.14 10 450.38 10 394.9Z',
];

const BlobShape = ({
  color = '#ffc56c',
  image,
  className = '',
  style,
  opacity = 1,
  variant = 0,
  size,
  position = {},
}) => {
  const rawId = useId().replace(/:/g, '');
  const patternId = `blob-pattern-${rawId}`;
  const pathD = useMemo(() => paths[variant % paths.length], [variant]);
  const dimension = size
    ? typeof size === 'number'
      ? `${size}px`
      : size
    : undefined;

  return (
    <svg
      className={`blob-shape ${className}`.trim()}
      viewBox="0 0 724 704"
      role="presentation"
      aria-hidden="true"
      style={{ opacity, width: dimension, height: dimension, ...position, ...style }}
      preserveAspectRatio="xMidYMid meet"
    >
      {image ? (
        <defs>
          <pattern id={patternId} patternUnits="objectBoundingBox" width="1" height="1">
            <image href={image} width="724" height="704" preserveAspectRatio="xMidYMid slice" />
          </pattern>
        </defs>
      ) : null}

      <path fill={image ? `url(#${patternId})` : color} d={pathD} />
    </svg>
  );
};

export default BlobShape;
