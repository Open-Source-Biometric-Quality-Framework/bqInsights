export function getPdfCss(): string {
  return `
    .report-title-block {
      text-align: center;
      margin-bottom: 32px;
      padding-bottom: 16px;
      border-bottom: 1px solid #e5e7eb;
    }

    .report-main-title {
      font-size: 2em;
      font-weight: 700;
      color: #1f2937;
      margin: 0 0 8px 0;
    }

    .report-subtitle {
      font-size: 0.95em;
      color: #6b7280;
    }

    .ai-analysis-section {
      margin-bottom: 24px;
    }

    .ai-analysis-section h1 {
      font-size: 1.6em;
      font-weight: 700;
      color: #1f2937;
      border-bottom: 1px solid #e5e7eb;
      padding-bottom: 8px;
    }

    .ai-caveat {
      margin-top: 24px;
      padding: 12px 16px;
      border: 1px solid #e5e7eb;
      border-radius: 6px;
      background-color: #fffbe5;
      font-size: 0.85em;
      color: #92400e;
      line-height: 1.5;
    }
    
    .cluster-labels-section {
      page-break-before: always;
    }

    .cluster-labels-section h1 {
      font-size: 1.6em;
      font-weight: 700;
      color: #1f2937;
      border-bottom: 1px solid #e5e7eb;
      padding-bottom: 8px;
    }

    .cluster-label-heading {
      font-size: 1.1em;
      font-weight: 600;
      color: #1f2937;
      margin-bottom: 8px;
    }

    .cluster-card {
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      padding: 16px;
      margin-bottom: 16px;
      background-color: #fafafa;
    }

    .cluster-images {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      margin-top: 8px;
    }
    
    .cluster-example-img {
      width: 120px;
      height: 120px;
      object-fit: cover;
      border-radius: 4px;
      border: 1px solid #e5e7eb;
    }
    
    .outlier-label {
      font-size: 1.1em;
      font-weight: 600;
      color: #6b7280;
      margin-bottom: 8px;
    }

    .outlier-card {
      border: 1px dashed #d1d5db;
      border-radius: 8px;
      padding: 16px;
      margin-bottom: 16px;
      background-color: #f9fafb;
    }

    @media print {
      body {
        max-width: 100%;
      }
      
      .cluster-card, .outlier-card {
        break-inside: avoid;
      }
    }
  `;
}
