declare module '*.geojson' {
  const value: {
    type: 'FeatureCollection';
    features: Array<{
      type: 'Feature';
      id: string | number;
      properties: Record<string, string>;
      geometry: { type: string; coordinates: unknown };
    }>;
  };
  export default value;
}
