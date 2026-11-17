# Markdown to PDF Converter

A Node.js/TypeScript package that converts Markdown files to PDF using Electron, with support for custom covers, styling, and full page control.

## Features

- ✅ Convert single or multiple Markdown files to PDF
- ✅ Optional cover pages (PDF, HTML, or inline HTML)
- ✅ Add text overlays to existing PDF covers
- ✅ Full control over page layout (size, orientation, margins)
- ✅ Custom headers and footers with page numbers
- ✅ Custom CSS styling
- ✅ GitHub-flavored Markdown support
- ✅ Automatic merging of multiple files

## Installation

```bash
npm install markdown-to-pdf-electron
```

## Quick Start

```javascript
const { convertMarkdownToPDF } = require('markdown-to-pdf-electron');

await convertMarkdownToPDF({
  markdownFiles: 'document.md',
  outputPath: 'output.pdf'
});
```

## Usage Examples

### Basic Conversion

```javascript
await convertMarkdownToPDF({
  markdownFiles: 'README.md',
  outputPath: 'output.pdf',
  pageOptions: {
    pageSize: 'A4',
    margins: {
      top: 20,
      bottom: 20,
      left: 15,
      right: 15
    }
  }
});
```

### Multiple Files

```javascript
await convertMarkdownToPDF({
  markdownFiles: ['chapter1.md', 'chapter2.md', 'chapter3.md'],
  outputPath: 'book.pdf'
});
```

### With HTML Cover

```javascript
await convertMarkdownToPDF({
  markdownFiles: 'document.md',
  outputPath: 'output.pdf',
  cover: {
    htmlPath: 'cover.html',
    pageOptions: {
      printBackground: true
    }
  }
});
```

### With Inline Cover HTML

```javascript
await convertMarkdownToPDF({
  markdownFiles: 'document.md',
  outputPath: 'output.pdf',
  cover: {
    html: `
      <div style="display:flex; height:100vh; justify-content:center; align-items:center;">
        <h1>My Document Title</h1>
      </div>
    `
  }
});
```

### Add Text to Existing PDF Cover

```javascript
await convertMarkdownToPDF({
  markdownFiles: 'document.md',
  outputPath: 'output.pdf',
  cover: {
    pdfPath: 'cover-template.pdf',
    texts: [
      {
        text: 'Project Report 2024',
        x: 50,
        y: 700,
        size: 30,
        font: 'Helvetica-Bold',
        align: 'center'
      },
      {
        text: 'Confidential',
        x: 50,
        y: 100,
        size: 14,
        color: { r: 0.8, g: 0, b: 0 }
      }
    ]
  }
});
```

### Custom Headers and Footers

```javascript
await convertMarkdownToPDF({
  markdownFiles: 'document.md',
  outputPath: 'output.pdf',
  pageOptions: {
    displayHeaderFooter: true,
    headerTemplate: `
      <div style="font-size:10px; text-align:center; width:100%;">
        My Company - Confidential
      </div>
    `,
    footerTemplate: `
      <div style="font-size:10px; text-align:center; width:100%;">
        Page <span class="pageNumber"></span> of <span class="totalPages"></span>
      </div>
    `,
    margins: {
      top: 40,
      bottom: 40,
      left: 20,
      right: 20
    }
  }
});
```

### Custom CSS Styling

```javascript
await convertMarkdownToPDF({
  markdownFiles: 'document.md',
  outputPath: 'output.pdf',
  css: `
    body {
      font-family: 'Georgia', serif;
      color: #333;
    }
    h1 {
      color: #0066cc;
      border-bottom: 2px solid #0066cc;
    }
    code {
      background-color: #f5f5f5;
      color: #d63384;
    }
  `
});
```

Or load from a file:

```javascript
await convertMarkdownToPDF({
  markdownFiles: 'document.md',
  outputPath: 'output.pdf',
  cssPath: 'styles.css'
});
```

## API Reference

### `convertMarkdownToPDF(options)`

Main conversion function.

#### Options

- **markdownFiles** (`string | string[]`): Path(s) to markdown file(s)
- **outputPath** (`string`): Output PDF file path
- **cover** (`CoverOptions`, optional): Cover page configuration
- **pageOptions** (`PageOptions`, optional): Page layout options
- **css** (`string`, optional): Inline CSS styles
- **cssPath** (`string`, optional): Path to CSS file

### `PageOptions`

- **landscape** (`boolean`): Portrait (false) or landscape (true)
- **pageSize** (`string | object`): 'A3', 'A4', 'A5', 'Legal', 'Letter', 'Tabloid', or `{width, height}` in microns
- **margins** (`object`): `{top, bottom, left, right}` in millimeters
- **marginsType** (`0 | 1 | 2`): 0=default, 1=none, 2=minimum
- **printBackground** (`boolean`): Include background colors/images
- **displayHeaderFooter** (`boolean`): Show header and footer
- **headerTemplate** (`string`): HTML template for header
- **footerTemplate** (`string`): HTML template for footer
- **scaleFactor** (`number`): Scale factor (100 = 100%)
- **pageRanges** (`string`): Page ranges like '1-5, 8, 11-13'

### `CoverOptions`

- **pdfPath** (`string`): Path to existing PDF to use as cover
- **htmlPath** (`string`): Path to HTML file for cover
- **html** (`string`): Inline HTML for cover
- **texts** (`CoverTextOptions[]`): Text overlays for PDF covers
- **pageOptions** (`PageOptions`): Specific options for cover page

### `CoverTextOptions`

- **text** (`string`): Text to display
- **x** (`number`): X coordinate
- **y** (`number`): Y coordinate (0,0 is bottom-left)
- **size** (`number`): Font size
- **font** (`string`): 'Helvetica', 'Helvetica-Bold', 'Times-Roman', 'Times-Bold', 'Courier', 'Courier-Bold'
- **color** (`object`): `{r, g, b}` with values 0-1
- **align** (`string`): 'left', 'center', 'right'

## Header/Footer Special Classes

Use these classes in your header/footer templates:

- `<span class="date"></span>` - Current date
- `<span class="title"></span>` - Document title
- `<span class="url"></span>` - Document URL
- `<span class="pageNumber"></span>` - Current page number
- `<span class="totalPages"></span>` - Total page count

## Building the Package

```bash
# Install dependencies
npm install

# Build TypeScript
npm run build

# Run tests
npm test
```

## Requirements

- Node.js >= 16.0.0
- Electron (included as dependency)

## License

MIT

## Contributing

Contributions welcome! Please feel free to submit a Pull Request.
