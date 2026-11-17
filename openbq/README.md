# BQAT TypeScript Module - Enhanced Version

## Overview

This enhanced version of the BQAT module includes three major improvements:

1. **Safe Default Output Directory** - Automatic app data directory management
2. **Intelligent Caching** - Automatic result caching to avoid redundant processing
3. **WSQ to JPEG Conversion** - Convert WSQ fingerprint images to JPEG with base64 output

## New Features

### 1. Safe Output Directory

The module now automatically uses platform-specific app data directories for output if none is specified:

- **macOS**: `~/Library/Application Support/BQAT/output`
- **Windows**: `%APPDATA%\BQAT\output`
- **Linux**: `~/.bqat/output`

This prevents permission errors and provides a consistent location for results.

```typescript
import { runContainer, getDefaultOutputDir } from './bqat-improved';

// Output will automatically go to safe app directory
const result = await runContainer({
  mode: 'face',
  input: '/path/to/images'
  // output not specified - uses default safe directory
});

// Get the default output directory path
const outputDir = getDefaultOutputDir();
console.log('Results saved to:', outputDir);
```

### 2. Intelligent Caching

The module automatically caches analysis results based on:
- Input directory contents (file names, sizes, modification times)
- Analysis parameters (mode, engine, config, etc.)

Cache is stored in: `~/Library/Application Support/BQAT/cache` (macOS) or equivalent

**How it works:**
- First run: Processes normally and saves results to cache
- Subsequent runs: If same input + params detected, returns cached results instantly
- Cache key is generated from SHA-256 hash of input contents + parameters

**Benefits:**
- Dramatically faster repeat analyses
- Reduces Docker container startup overhead
- Saves computation resources

**Usage:**

```typescript
import { runContainer } from './bqat-improved';

// First run - will process and cache
const result1 = await runContainer({
  mode: 'face',
  input: '/path/to/images'
});

// Second run with same params - returns cached results instantly
const result2 = await runContainer({
  mode: 'face',
  input: '/path/to/images'
});

console.log(result2.isFromCache()); // true

// Disable caching if needed
const result3 = await runContainer({
  mode: 'face',
  input: '/path/to/images'
}, {
  useCache: false
});
```

**Cache Management:**

```typescript
import { clearCache, getCacheStats } from './bqat-improved';

// Get cache statistics
const stats = getCacheStats();
console.log('Cached items:', stats.itemCount);
console.log('Total size:', stats.totalSize, 'bytes');
console.log('Oldest cache:', stats.oldestItem);
console.log('Newest cache:', stats.newestItem);

// Clear all cached results
clearCache();
```

### 3. WSQ to JPEG Conversion

New function to convert WSQ fingerprint images to JPEG format with base64 output.

**Process:**
1. Copies WSQ file to temporary directory
2. Runs BQAT preprocess with `jpeg` config
3. Converts output JPEG to base64 string
4. Cleans up temporary files

**Usage:**

```typescript
import { convertWSQtoJPEG } from './bqat-improved';

try {
  const base64Jpeg = await convertWSQtoJPEG('/path/to/fingerprint.wsq');
  
  // Use base64 string
  console.log('Base64 JPEG:', base64Jpeg.substring(0, 50) + '...');
  
  // Display in HTML img tag
  const imgTag = `<img src="data:image/jpeg;base64,${base64Jpeg}" />`;
  
  // Or save to file
  const buffer = Buffer.from(base64Jpeg, 'base64');
  fs.writeFileSync('output.jpg', buffer);
  
} catch (error) {
  console.error('Conversion failed:', error);
}
```

**With Progress Tracking:**

```typescript
const base64Jpeg = await convertWSQtoJPEG('/path/to/fingerprint.wsq', {
  onProgress: (event) => {
    console.log(event.type, event.message);
  }
});
```

## API Reference

### Directory Helpers

```typescript
// Get default output directory
getDefaultOutputDir(): string

// Get cache directory
getCacheDir(): string

// Get temporary directory (for conversions)
getTempDir(): string
```

### Cache Functions

```typescript
// Clear all cached results
clearCache(): void

// Get cache statistics
getCacheStats(): {
  itemCount: number;
  totalSize: number;
  oldestItem?: Date;
  newestItem?: Date;
}
```

### Conversion Functions

```typescript
// Convert WSQ to JPEG with base64 output
convertWSQtoJPEG(
  wsqFilePath: string,
  options?: DockerRunOptions
): Promise<string>
```

### Enhanced BQATResultData

```typescript
class BQATResultData {
  // Check if result came from cache
  isFromCache(): boolean
  
  // Existing methods...
  getSummary(): BQATSummary | undefined
  getCSVPath(): string | undefined
  getReportPath(): string | undefined
  getPreviewTablePath(): string | undefined
  getLogPath(): string | undefined
  loadCSV(): Promise<string>
  loadCSVParsed(): Promise<Record<string, any>[]>
  loadLog(): Promise<any>
  getRawOutput(): string
  getAllPaths(): {...}
}
```

### Updated Interfaces

```typescript
interface DockerRunOptions {
  imageTag?: string;
  shmSize?: string;
  removeContainer?: boolean;
  interactive?: boolean;
  useCache?: boolean; // NEW: Enable/disable caching (default: true)
  onStdout?: (data: string) => void;
  onStderr?: (data: string) => void;
  onProgress?: (progress: ProgressEvent) => void;
}

interface ProgressEvent {
  type: 'stdout' | 'stderr' | 'start' | 'end' | 'error' | 'cache'; // NEW: 'cache' type
  message: string;
  timestamp: Date;
  code?: number;
}

type BQATMode = 'face' | 'fingerprint' | 'iris' | 'voice' | 'preprocess'; // NEW: 'preprocess'
```

## Migration Guide

### From Original to Enhanced Version

**Before:**
```typescript
import { runContainer } from './bqat';

const result = await runContainer({
  mode: 'face',
  input: '/path/to/images',
  output: '/some/output/dir' // Required to avoid permissions issues
});
```

**After:**
```typescript
import { runContainer } from './bqat-improved';

const result = await runContainer({
  mode: 'face',
  input: '/path/to/images'
  // output is now optional - uses safe default directory
  // caching is automatic - second run will be instant
});

// Check if from cache
if (result.isFromCache()) {
  console.log('Results retrieved from cache!');
}
```

## Examples

### Example 1: Basic Face Analysis with Auto-Caching

```typescript
import { runContainer } from './bqat-improved';

async function analyzeFaces() {
  const result = await runContainer({
    mode: 'face',
    input: './face-images',
    report: true
  }, {
    onProgress: (event) => {
      if (event.type === 'cache') {
        console.log('✨ Using cached results!');
      } else {
        console.log(event.message);
      }
    }
  });
  
  const data = await result.loadCSVParsed();
  console.log('Processed', data.length, 'faces');
  
  return data;
}
```

### Example 2: WSQ Conversion Pipeline

```typescript
import { convertWSQtoJPEG } from './bqat-improved';
import * as fs from 'fs';
import * as path from 'path';

async function convertFingerprints(wsqDirectory: string) {
  const files = fs.readdirSync(wsqDirectory);
  const wsqFiles = files.filter(f => f.endsWith('.wsq'));
  
  const results = [];
  
  for (const wsqFile of wsqFiles) {
    const wsqPath = path.join(wsqDirectory, wsqFile);
    
    try {
      const base64Jpeg = await convertWSQtoJPEG(wsqPath);
      
      results.push({
        filename: wsqFile,
        success: true,
        data: base64Jpeg
      });
      
      console.log(`✅ Converted ${wsqFile}`);
      
    } catch (error) {
      results.push({
        filename: wsqFile,
        success: false,
        error: error.message
      });
      
      console.error(`❌ Failed to convert ${wsqFile}:`, error.message);
    }
  }
  
  return results;
}
```

### Example 3: Cache Management

```typescript
import { getCacheStats, clearCache, runContainer } from './bqat-improved';

async function manageCacheExample() {
  // Check cache before running
  let stats = getCacheStats();
  console.log('Cache has', stats.itemCount, 'items');
  console.log('Total cache size:', (stats.totalSize / 1024 / 1024).toFixed(2), 'MB');
  
  // Run analysis
  const result = await runContainer({
    mode: 'fingerprint',
    input: './fingerprints'
  });
  
  if (result.isFromCache()) {
    console.log('Result was from cache - instant!');
  } else {
    console.log('New analysis completed and cached');
  }
  
  // Check updated cache stats
  stats = getCacheStats();
  console.log('Cache now has', stats.itemCount, 'items');
  
  // Clear cache if too large
  if (stats.totalSize > 100 * 1024 * 1024) { // 100MB
    console.log('Cache too large, clearing...');
    clearCache();
  }
}
```

### Example 4: Electron Integration

```typescript
// In your Electron main process
import { ipcMain } from 'electron';
import { runContainer, convertWSQtoJPEG, getDefaultOutputDir } from './bqat-improved';

ipcMain.handle('bqat:analyze', async (event, args) => {
  try {
    const result = await runContainer(args, {
      onProgress: (event) => {
        // Send progress to renderer
        event.sender.send('bqat:progress', event);
      }
    });
    
    return {
      success: true,
      fromCache: result.isFromCache(),
      data: await result.loadCSVParsed()
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
});

ipcMain.handle('bqat:convert-wsq', async (event, wsqPath) => {
  try {
    const base64 = await convertWSQtoJPEG(wsqPath);
    return { success: true, data: base64 };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('bqat:get-output-dir', async () => {
  return getDefaultOutputDir();
});
```

## File Structure

The module creates the following directory structure:

```
~/Library/Application Support/BQAT/  (macOS)
├── output/          # Default output directory for analysis results
├── cache/           # Cached analysis results
│   ├── abc123...json    # Cache metadata files
│   └── ...
└── temp/            # Temporary files for conversions
    └── wsq_1234567890/  # Temp dirs (auto-cleaned)
```

## Performance Notes

- **Cache Hit**: ~10-50ms (file copy only)
- **Cache Miss**: Normal BQAT processing time + small overhead for caching
- **WSQ Conversion**: Depends on image size, typically 1-3 seconds

## Troubleshooting

### Cache not working?

Check that input directory hasn't changed. Cache is invalidated if:
- File names change
- File sizes change
- File modification times change
- Analysis parameters change

### WSQ conversion fails?

Ensure:
- Docker is running
- BQAT image supports preprocess mode with jpeg config
- WSQ file is valid

### Permission errors?

The module should automatically use safe directories, but if you still encounter issues:
```typescript
import { getDefaultOutputDir } from './bqat-improved';
console.log('Using output dir:', getDefaultOutputDir());
```

## License

Same as original BQAT module.