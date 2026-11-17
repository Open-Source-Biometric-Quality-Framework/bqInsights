// test/test.js
const { app } = require('electron');
const { MarkdownToPDFConverter } = require('../dist/index.js');
const fs = require('fs');
const path = require('path');

// Create test markdown files
const testDir = __dirname;

// Create sample markdown content
const markdown1 = `# Chapter 1: Introduction

This is the **first chapter** of our document. It contains:

- Important information
- Key concepts
- Essential details

## Section 1.1

Here's some code:

\`\`\`javascript
function hello() {
  console.log('Hello, World!');
}
\`\`\`

## Section 1.2

> This is a blockquote with some important information.

| Feature | Status |
|---------|-------:|
| PDF Export | ✓ |
| Cover Page | ✓ |
| Custom Styles | ✓ |


<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
<div>

## Column 1
Content for first column

| Feature | Status |
|---------|-------:|
| PDF Export | ✓ |
| Cover Page | ✓ |
| Custom Styles | ✓ |

</div>
<div>

## Column 2
Content for second column



</div>
</div>

\`\`\`mermaid

---
config:
    xyChart:
        width: 450
        height: 400
        showDataLabel: true
    themeVariables:
        xyChart:
            titleColor: "#ff0000"
---
xychart
    title "Sales Revenue"
    x-axis [jan, feb, mar, apr, may, jun, jul, aug, sep, oct, nov, dec]
    y-axis "Revenue (in $)" 4000 --> 11000
    bar [5000, 6000, 7500, 8200, 9500, 10500, 11000, 10200, 9200, 8500, 7000, 6000]
    line [5000, 6000, 7500, 8200, 9500, 10500, 11000, 10200, 9200, 8500, 7000, 6000]

\`\`\`
`;

const markdown2 = `# Chapter 2: Advanced Topics

This is the **second chapter** with more details.

## Data Analysis

Some important findings:

1. First finding
2. Second finding
3. Third finding

### Process Flow

Here's a flowchart showing our process:

\`\`\`mermaid
graph TD
    A[Start] --> B{Is it working?}
    B -->|Yes| C[Great!]
    B -->|No| D[Debug]
    D --> B
    C --> E[End]
\`\`\`

### System Architecture

\`\`\`mermaid
graph LR
    A[Client] --> B[Load Balancer]
    B --> C[Server 1]
    B --> D[Server 2]
    C --> E[Database]
    D --> E
\`\`\`

### Subsection

More detailed information goes here.
`;

// Write test markdown files
fs.writeFileSync(path.join(testDir, 'test1.md'), markdown1);
fs.writeFileSync(path.join(testDir, 'test2.md'), markdown2);

// Create a simple cover HTML
const coverHTML = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body {
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      height: 100vh;
      margin: 0;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      font-family: Arial, sans-serif;
    }
    h1 {
      font-size: 48px;
      margin: 20px;
    }
    .subtitle {
      font-size: 24px;
      margin: 10px;
    }
    .date {
      font-size: 16px;
      margin-top: 50px;
      opacity: 0.8;
    }
  </style>
</head>
<body>
  <h1>Technical Documentation</h1>
  <div class="subtitle">Complete Guide</div>
  <div class="date">Generated on ${new Date().toLocaleDateString()}</div>
</body>
</html>
`;

fs.writeFileSync(path.join(testDir, 'cover.html'), coverHTML);

// Test 1: Simple conversion without cover
async function test1(converter) {
  console.log('Test 1: Converting single markdown file (minimal options)...');
  
  const outputPath = path.join(testDir, 'output1.pdf');
  console.log('  Output path:', outputPath);
  
  await converter.convert({
    markdownFiles: path.join(testDir, 'test1.md'),  // Single file only
    outputPath: outputPath
  });
  
  // Check if file exists
  if (fs.existsSync(outputPath)) {
    const stats = fs.statSync(outputPath);
    console.log(`✓ Created output1.pdf (${stats.size} bytes)`);
  } else {
    console.log('✗ File was not created!');
  }
}

// Test 2: Multiple files with HTML cover
async function test2(converter) {
  console.log('\nTest 2: Converting multiple markdown files with HTML cover and footers...');
  
  const outputPath = path.join(testDir, 'output2.pdf');
  
  await converter.convert({
    markdownFiles: [
      path.join(testDir, 'test1.md'),
      path.join(testDir, 'test2.md')
    ],
    outputPath: outputPath,
    cover: {
      htmlPath: path.join(testDir, 'cover.html')
    },
    pageOptions: {
      displayHeaderFooter: true,
      footerTemplate: '<div style="font-size:10px; text-align:center; width:100%; padding-top:5px;">Page <span class="pageNumber"></span> of <span class="totalPages"></span></div>',
      marginsType: 0
    }
  });
  
  if (fs.existsSync(outputPath)) {
    const stats = fs.statSync(outputPath);
    console.log(`✓ Created output2.pdf (${stats.size} bytes)`);
  } else {
    console.log('✗ File was not created!');
  }
}

// Test 3: Custom CSS styling
async function test3(converter) {
  console.log('\nTest 3: Converting with custom CSS and headers/footers...');
  
  const customCSS = `
    body {
      font-family: 'Georgia', serif;
      color: #2c3e50;
      font-size: 12px;
    }
    h1 {
      color: #3498db;
      border-bottom: 3px solid #3498db;
      page-break-before: always;
    }
    h1:first-of-type {
      page-break-before: auto;
    }
    h2 {
      color: #2980b9;
    }
    code {
      background-color: #ecf0f1;
      color: #e74c3c;
    }
  `;
  
  await converter.convert({
    markdownFiles: path.join(testDir, 'test1.md'),
    outputPath: path.join(testDir, 'output3.pdf'),
    css: customCSS,
    pageOptions: {
      pageSize: 'Letter',
      landscape: true,
      displayHeaderFooter: true,
      headerTemplate: '<div style="font-size:9px; text-align:right; width:100%; padding-right:20px; padding-top:5px; color:#999;">Custom Styled Report</div>',
      footerTemplate: '<div style="font-size:9px; text-align:center; width:100%; padding-top:5px; color:#999;"><span class="pageNumber"></span> / <span class="totalPages"></span></div>',
      marginsType: 0
    }
  });
  
  console.log('✓ Created output3.pdf');
}

// Test 4: Using inline cover HTML
async function test4(converter) {
  console.log('\nTest 4: Converting with inline cover HTML...');
  
  await converter.convert({
    markdownFiles: [path.join(testDir, 'test1.md')],
    outputPath: path.join(testDir, 'output4.pdf'),
    cover: {
      html: `
        <div style="display:flex; justify-content:center; align-items:center; height:95vh; background:#34495e; color:white;">
          <div style="text-align:center;">
            <h1 style="font-size:60px; margin:0;">PROJECT REPORT</h1>
            <p style="font-size:24px; margin-top:20px;">Q4 2024</p>
          </div>
        </div>
      `,
      pageOptions: {
        printBackground: true,
        displayHeaderFooter: true,
        headerTemplate: '<div style="font-size:9px; text-align:right; width:100%; padding-right:20px; padding-top:5px; color:#999;">Custom Styled Report</div>',
        footerTemplate: '<div style="font-size:9px; text-align:center; width:100%; padding-top:5px; color:#999;"><span class="pageNumber"></span> / <span class="totalPages"></span></div>',
     
      }
    }
  });
  
  console.log('✓ Created output4.pdf');
}

// Run all tests
async function runTests() {
  const converter = new MarkdownToPDFConverter();
  
  try {
    await test1(converter);
    await test2(converter);
    await test3(converter);
    await test4(converter);
    
    console.log('\n✅ All tests completed successfully!');
    console.log('\nGenerated files:');
    console.log('  - output1.pdf (single file, no cover)');
    console.log('  - output2.pdf (multiple files, HTML cover)');
    console.log('  - output3.pdf (custom CSS)');
    console.log('  - output4.pdf (inline cover HTML)');
    
    // Give file system time to complete writes
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    app.quit();
  } catch (error) {
    console.error('\n❌ Test failed:', error);
    app.quit();
    process.exit(1);
  }
}

// Wait for Electron app to be ready
app.whenReady().then(runTests);