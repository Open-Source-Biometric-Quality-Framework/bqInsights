export function matchTestData(data: {}[]) {
  const gaussian = (mean: number, stdDev: number) => {
    const u = 1 - Math.random(); // Converting [0,1) to (0,1]
    const v = 1 - Math.random();
    const z = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
    return z * stdDev + mean;
  };

  // do this for three algorithms: FaceNet, ArcFace, and SphereFace
  data = data.map(() => {
    // do match and non-match distributions
    const isMatch = Math.random() < 0.5;
    const score = isMatch ? gaussian(0.6, 0.3) + (Math.random() * 0.2) : gaussian(0.5, 0.3) + (Math.random() * 0.2);
    //  ? Math.min(1, Math.max(0.3, (Math.random() * 0.7) + 0.3)) // matches: 0.3 to 1.0
    //  : Math.max(0, Math.min(0.6, Math.random() * 0.6)); // non-matches: 0.0 to 0.6
    const algorithms = ['FaceNet', 'ArcFace', 'SphereFace'];
    const algorithm = algorithms[Math.floor(Math.random() * algorithms.length)];

    return {
      algorithm: algorithm,
      score: score,
      ground_truth: isMatch
    };
  });
  return data;
}
