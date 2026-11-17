# BQAT Cache Testing

This test suite verifies that the BQAT caching functionality works correctly and all output files are properly generated and cached.

## Prerequisites

1. **Docker installed and running**
   ```bash
   docker --version
   ```

2. **BQAT image pulled**
   ```bash
   docker pull ghcr.io/biometix/bqat-cli:latest
   ```

3. **Node.js and npm installed**
   ```bash
   node --version
   npm --version
   ```

## Installation

Install test dependencies:

```bash
npm install --save-dev vitest @types/node
```

## Running Tests

### Run all cache tests
```bash
npm run test:cache
```

### Run tests in watch mode (for development)
```bash
npm run test:cache:watch
```

### Run all tests
```bash
npm test
```

## What the Tests Verify

### ✅ File Generation (Test 1)
- CSV results file is created
- Log JSON file is created
- Report HTML files are created (when requested)
- Preview table HTML is created (when requested)
- All files are readable and have content

### ✅ Cache Hit (Test 2)
- Second run with identical parameters uses cache
- Cache hit is significantly faster (< 5 seconds vs 30-60 seconds)
- Cached results match original results
- All cached files are accessible

### ✅ Cache Miss on Parameter Change (Test 3)
- Changing any parameter (e.g., adding `report: true`) invalidates cache
- New run executes fully without using cache

### ✅ Cache Miss on Input Change (Test 4)
- Modifying input directory invalidates cache
- Adding/removing files triggers fresh execution

### ✅ Cached File Accessibility (Test 5)
- CSV can be loaded and parsed
- Log JSON can be loaded and parsed
- Report HTML files exist and contain valid HTML
- All file paths resolve correctly

### ✅ Cache Directory Structure (Test 6)
- Cache is stored in correct OS-specific location
  - macOS: `~/Library/Application Support/BQAT/cache/`
  - Windows: `%LOCALAPPDATA%/BQAT/cache/`
  - Linux: `~/.cache/bqat/cache/`
- Cache entries contain all required files:
  - `summary.json`
  - `results.csv`
  - `output.log`
  - `report.html` (if applicable)
  - `preview.html` (if applicable)

### ✅ Progress Events (Test 7)
- Progress events are emitted during execution
- Start and end events are received
- Cache status messages are emitted

## Test Data

The tests create dummy JPEG files for testing. For more realistic tests:

1. Replace the `createTestFiles()` function in `bqat-cache.test.ts`
2. Add real biometric sample files to the test input directory

Example:
```typescript
function createTestFiles(dir: string): void {
  // Copy real face images
  const sampleFiles = [
    '/path/to/real/face1.jpg',
    '/path/to/real/face2.jpg'
  ];
  
  sampleFiles.forEach(src => {
    const dest = path.join(dir, path.basename(src));
    fs.copyFileSync(src, dest);
  });
}
```

## Debugging Failed Tests

### Cache not being used
1. Check cache key generation in console output
2. Verify input directory hash is consistent
3. Ensure parameters are identical between runs

### Files not found
1. Check file paths in progress events
2. Verify `copyIfExists` is finding the source files
3. Look for path resolution warnings in output

### Timeout errors
1. Increase timeout in test (currently 60-70 seconds)
2. Check Docker performance
3. Verify Docker image is local (not re-pulling)

## Expected Output

```
✓ should generate all expected output files on first run (45231ms)
✓ should use cache on second run with same parameters (1523ms)
✓ should NOT use cache when parameters change (43567ms)
✓ should NOT use cache when input files change (44821ms)
✓ should have all cached files accessible (1234ms)
✓ should handle cache directory structure correctly (1156ms)
✓ should emit progress events during execution (42891ms)

Test Files  1 passed (1)
Tests  7 passed (7)
Duration  180.42s
```

## Cleanup

Tests automatically clean up temporary files. The cache directory persists for performance. To manually clear cache:

```bash
# macOS
rm -rf ~/Library/Application\ Support/BQAT/cache/

# Linux
rm -rf ~/.cache/bqat/cache/

# Windows
rmdir /s %LOCALAPPDATA%\BQAT\cache
```

## CI/CD Integration

For automated testing in CI/CD:

```yaml
# .github/workflows/test.yml
name: Test
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm ci
      - run: docker pull ghcr.io/biometix/bqat-cli:latest
      - run: npm run test:cache
```
