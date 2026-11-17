import React, { useState, useEffect, useMemo, useRef } from 'react';
import './FormattedFieldList.css';
import { callLLM } from '../llms.tsx'
import { getAISettings } from './Settings.tsx'

const FormattedFieldList = ({
  inputData,
  fieldConfig = {},
  dataKey,
  itemLabel,
  imageFunc,
  maxItems = 10,
  onSettingsChange,
  defaultHidePerfect = false,
  defaultHideNonScalar = false,
  getItemClusterLabel,
}) => {

  const [collapsed, setCollapsed] = useState({});
  const [expandedItems, setExpandedItems] = useState({});
  const [imageCache, setImageCache] = useState({});
  const [hideFullScores, setHideFullScores] = useState({});
  const [hideNonScalar, setHideNonScalar] = useState({});
  const [aiResponses, setAiResponses] = useState({});
  const [loadingAI, setLoadingAI] = useState({});

  const isScalarKey = (key) => /scalar/i.test(key || '');

  const formatFieldLabel = (label) => {
    if (!label) return '';
    let next = String(label).replace(/_/g, ' ');
    next = next.replace(/([a-z])([A-Z])/g, '$1 $2');
    next = next.replace(/\s+/g, ' ').trim();
    return next;
  };

  const toPriority = (value) => {
    const num = Number(value);
    return Number.isFinite(num) ? num : 0;
  };

  const isScalarField = (field) =>
    field?.is_score || field?.is_scalar || isScalarKey(field?.key) || /scalar/i.test(field?.label);

  const getImageFieldKey = (source) => {
    if (!source) return null;
    const configImage = Object.keys(source).find(
      (key) => fieldConfig?.[key]?.is_image
    );
    if (configImage) return configImage;
    return null;
  };

  const toggleGroup = (groupName) => {
    setCollapsed(prev => ({ ...prev, [groupName]: !prev[groupName] }));
  };

  const toggleItem = (itemIndex) => {
    setExpandedItems(prev => ({ ...prev, [itemIndex]: !prev[itemIndex] }));
  };

  const toggleHideFullScores = (itemIndex) => {
    setHideFullScores(prev => ({ ...prev, [itemIndex]: !prev[itemIndex] }));
  };

  const toggleHideNonScalar = (itemIndex) => {
    setHideNonScalar(prev => ({ ...prev, [itemIndex]: !prev[itemIndex] }));
  };

  const listRef = useRef(null);

  const handleExport = async (e) => {
    console.log("writing report ...")

    //e.preventDefault();          // <– stop the form submit
    const html = listRef.current?.innerHTML || "";
    const fileName = "formatted-field-list.html";
    const result = await window.electron.fs.writeFile(fileName, html);
    //return

    /*const save = await window.electron.report.savePdfDialog({
      defaultPath: "report.pdf",
    });

    if (save.canceled || !save.filePath) return;
    */
    
    const css = await window.electron.fs.readFile('src/components/FormattedFieldList.css');
    console.log("CSS loaded:", css)
    await window.electron.report.convertMarkdownToPdf({
      markdownFiles: result.fileName,
      outputPath: "report2.pdf", // save.filePath,
     // cover: {
     //       html: `<style>${css.content}</style> <H1> Hello  </H1>`
     // },
      css: css.content,
      pageOptions: {
        displayHeaderFooter: true,
        footerTemplate:
          `<div style="font-size:10px; text-align:center; width:100%; padding-top:5px;">Page <span class="pageNumber"></span> of <span class="totalPages"></span></div>`,
        marginsType: 0,
        printBackground: true,
      },
    });

    //console.log("PDF written to:", save.filePath);
  };




  const limitedData = useMemo(() => {
    if (!inputData) return [];
    if (!Array.isArray(inputData)) return [];
    return inputData.slice(0, maxItems);
  }, [inputData, maxItems]);

  useEffect(() => {
    setAiResponses({});
    setLoadingAI({});
    setHideFullScores((prev) => ({ ...prev, summary: defaultHidePerfect }));
    setHideNonScalar((prev) => ({ ...prev, summary: defaultHideNonScalar }));
    setHideFullScores((prev) => {
      const next = { ...prev };
      limitedData.forEach((_, idx) => {
        if (next[idx] === undefined) next[idx] = defaultHidePerfect;
      });
      return next;
    });
    setHideNonScalar((prev) => {
      const next = { ...prev };
      limitedData.forEach((_, idx) => {
        if (next[idx] === undefined) next[idx] = defaultHideNonScalar;
      });
      return next;
    });
  }, [limitedData, defaultHidePerfect, defaultHideNonScalar]);

  useEffect(() => {
    setHideFullScores((prev) => ({ ...prev, summary: defaultHidePerfect }));
    setHideNonScalar((prev) => ({ ...prev, summary: defaultHideNonScalar }));
  }, [defaultHidePerfect, defaultHideNonScalar]);

  // Load images when inputData changes
  useEffect(() => {
    const loadImages = async () => {
      if (!limitedData || !imageFunc) return;

      const newCache: Record<string, string> = {};

      for (let i = 0; i < limitedData.length; i++) {
        const item = limitedData[i][dataKey];
        const imageKey = getImageFieldKey(item);
        const imagePath = imageKey ? item?.[imageKey] : null;

        if (imagePath) {
          const cacheKey = `item-${i}-${imagePath}`;

          if (!imageCache[cacheKey]) {
            try {
              const base64 = await imageFunc({ imageFile: imagePath });

              if (base64) {
                newCache[cacheKey] = base64;
              }
            } catch (err) {
              console.error('Error loading image:', err);
            }
          }
        }
      }

      if (Object.keys(newCache).length > 0) {
        setImageCache(prev => ({ ...prev, ...newCache }));
      }
    };

    loadImages();

  }, [limitedData, dataKey, imageFunc]);

  // Create averaged composite image
  const createAverageImage = async () => {
    if (!limitedData || limitedData.length < 2) return null;

    const images: string[] = [];

    for (let i = 0; i < limitedData.length; i++) {
      const item = limitedData[i][dataKey];
      const imageKey = getImageFieldKey(item);
      const imagePath = imageKey ? item?.[imageKey] : null;
      if (imagePath) {
        const cacheKey = `item-${i}-${imagePath}`;
        const base64 = imageCache[cacheKey];

        if (base64) {
          images.push(base64);
        }
      }
    }


    if (images.length < 2) return null;

    return new Promise((resolve) => {
      // Load all images as HTMLImageElements
      const imageElements = [];
      let loadedCount = 0;

      images.forEach((base64, idx) => {
        const img = new Image();
        img.onload = () => {
          imageElements[idx] = img;
          loadedCount++;

          if (loadedCount === images.length) {
            // All images loaded, create composite
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');

            // Use dimensions from first image
            const firstImg = imageElements[0];
            canvas.width = firstImg.width;
            canvas.height = firstImg.height;

            // Draw each image with proportional opacity
            const opacity = 1 / images.length;

            imageElements.forEach((img) => {
              ctx.globalAlpha = opacity;
              // Draw image scaled to canvas size if needed
              ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            });

            // Reset alpha and convert to base64
            ctx.globalAlpha = 1.0;
            resolve(canvas.toDataURL('image/png'));
          }
        };
        img.onerror = () => {
          loadedCount++;
          if (loadedCount === images.length) {
            resolve(null);
          }
        };
        img.src = base64;
      });
    });
  };

  // Generate average image when images are loaded
  useEffect(() => {
    if (!limitedData || limitedData.length < 2) return;

    // Prevent regeneration loop
    if (imageCache['average-composite']) return;

    const allImagesLoaded = limitedData.every((item, i) => {
      const source = item[dataKey];
      const imageKey = getImageFieldKey(source);
      const imagePath = imageKey ? source?.[imageKey] : null;
      if (!imagePath) return true;
      const cacheKey = `item-${i}-${imagePath}`;
      return imageCache[cacheKey];
    });

    if (!allImagesLoaded) return;

    const generateAverage = async () => {
      const avgImage = await createAverageImage();

      if (avgImage) {
        setImageCache(prev => ({
          ...prev,
          'average-composite': avgImage
        }));
      }
    };

    generateAverage();

  }, [limitedData, imageCache, dataKey]);

  if (!inputData || !Array.isArray(inputData) || inputData.length === 0) {
    return null;
  }

  const getFieldSource = (item) => {
    if (!item || typeof item !== 'object') return null;
    if (!dataKey) return item;

    const nested = item[dataKey];
    if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
      return nested;
    }

    // Some payloads are flat rows; only use root object if it matches known field config keys.
    const keys = Object.keys(item);
    const hasConfiguredRootKeys = keys.some((key) => Boolean(fieldConfig?.[key]));
    return hasConfiguredRootKeys ? item : null;
  };

  const getFieldConfig = (fieldName) => {
    const config = fieldConfig[fieldName] || {};
    return {
      label: config.label || fieldName,
      group: config.group || 'General',
      priority: toPriority(config.priority),
      hide: config.hide !== undefined ? config.hide : (config.exclude ?? false),
      type: config.type !== undefined ? config.type : "None",
      is_score: config.is_score ?? false,
      is_image: config.is_image ?? false,
      is_scalar: config.is_scalar ?? false,
      thresholds: config.thresholds ?? {
        very_good: 90,
        good: 76,
        poor: 50,
        very_poor: 25
      },
      description: config.description ?? ''
    };
  };

  const extractFields = (source) => {
    if (!source || typeof source !== 'object') {
      return [];
    }

    const fields = [];

    for (const [key, value] of Object.entries(source)) {
      if (value === undefined || value === null) {
        continue;
      }

      const config = getFieldConfig(key);
      if (config.hide === true) {
        continue;
      }

      fields.push({
        key,
        value,
        ...config
      });
    }

    fields.sort((a, b) => b.priority - a.priority);
    return fields;
  };

  const groupFields = (fields) => {
    const groups = [];
    const groupMap = new Map();

    for (const field of fields) {
      const groupName = field.group || 'General';
      if (!groupMap.has(groupName)) {
        const newGroup = {
          name: groupName,
          fields: [],
          minPriority: toPriority(field.priority)
        };
        groupMap.set(groupName, newGroup);
        groups.push(newGroup);
      }
      const targetGroup = groupMap.get(groupName);
      targetGroup.fields.push(field);
      const priority = toPriority(field.priority);
      targetGroup.minPriority = Math.min(targetGroup.minPriority, priority);
    }

    groups.sort((a, b) => {
      if (a.minPriority !== b.minPriority) return a.minPriority - b.minPriority;
      return String(a.name).localeCompare(String(b.name));
    });

    for (const group of groups) {
      group.fields.sort((a, b) => {
        const delta = toPriority(a.priority) - toPriority(b.priority);
        if (delta !== 0) return delta;
        return String(a.label ?? a.key ?? '').localeCompare(String(b.label ?? b.key ?? ''));
      });
    }

    return groups.map(({ minPriority, ...group }) => group);
  };

  const calculateSummaryStats = () => {
    if (!inputData || inputData.length < 2) return null;

    const fieldStats = new Map();

    // Collect all numeric values by field key (only for fields with scalar in the key)
    inputData.forEach(item => {
      const source = getFieldSource(item);
      if (!source) return;

      const fields = extractFields(source);
      fields.forEach(field => {
        if (typeof field.value === 'number' && isScalarKey(field.key)) {
          if (!fieldStats.has(field.key)) {
            fieldStats.set(field.key, {
              values: [],
              config: field
            });
          }
          fieldStats.get(field.key).values.push(field.value);
        }
      });
    });

    // Calculate mean and std for each field
    const summaryFields = [];
    fieldStats.forEach((data, key) => {
      const values = data.values;
      const n = values.length;

      if (n > 0) {
        const mean = values.reduce((sum, v) => sum + v, 0) / n;
        let std = 0;

        if (n > 1) {
          const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / (n - 1);
          std = Math.sqrt(variance);
        }

        summaryFields.push({
          key,
          mean,
          std,
          ...data.config
        });
      }
    });

    summaryFields.sort((a, b) => b.priority - a.priority);
    return groupFields(summaryFields);
  };

  const renderValue = (field) => {
    let value = field.value;
    if (typeof value === 'object') {
      return JSON.stringify(value, null, 2);
    }

    if (typeof value === 'number') {
      if (!Number.isInteger(value)) {
        value = String(value.toFixed(3));
      }
      if (field.is_score || field.is_scalar || isScalarKey(field.key) || /scalar/i.test(field.label)) {
        value += ' %';
      }
      return String(value);
    }

    return String(value);
  };

  const renderSummaryValue = (field) => {
    let mean = field.mean;
    let std = field.std;

    if (!Number.isInteger(mean)) {
      mean = mean.toFixed(3);
    }
    if (!Number.isInteger(std)) {
      std = std.toFixed(3);
    }

    let suffix = '';
    if (field.is_score || field.is_scalar || isScalarKey(field.key) || /scalar/i.test(field.label)) {
      suffix = ' %';
    }

    return `${mean}${suffix} (±${std})`;
  };

  const getScalarClass = (field) => {
    if (!field.label || !(field.is_score || field.is_scalar || isScalarKey(field.key) || /scalar/i.test(field.label))) return '';

    const v = Number(field.value || field.mean);
    if (Number.isNaN(v)) return '';

    const thresholds = field.thresholds || { very_good: 90, good: 76, poor: 50, very_poor: 25 };
    if (v >= thresholds.very_good) return 'scalar-good';
    if (v >= thresholds.good) return 'scalar-warn';
    if (v >= thresholds.poor) return 'scalar-bad';
    return 'scalar-bad';
  };

  const categorizeFieldsByMean = (summaryGroups) => {
    if (!summaryGroups) return null;

    const categories = {
      'Very Poor': [],
      'Poor': [],
      'Average': [],
      'Good': []
    };

    summaryGroups.forEach(group => {
      group.fields.forEach(field => {
        const mean = field.mean;
        if (typeof mean !== 'number') return;

        const thresholds = field.thresholds || { very_good: 90, good: 76, poor: 50, very_poor: 25 };
        if (mean < thresholds.very_poor) {
          categories['Very Poor'].push(formatFieldLabel(field.label));
        } else if (mean < thresholds.poor) {
          categories['Poor'].push(formatFieldLabel(field.label));
        } else if (mean >= thresholds.good && mean < thresholds.very_good) {
          categories['Average'].push(formatFieldLabel(field.label));
        } else if (mean >= thresholds.very_good) {
          categories['Good'].push(formatFieldLabel(field.label));
        }
      });
    });

    return categories;
  };

  const renderCategoryDescription = (summaryGroups) => {
    const categories = categorizeFieldsByMean(summaryGroups);
    if (!categories) return null;

    const hasAnyCategories = Object.values(categories).some(arr => arr.length > 0);
    if (!hasAnyCategories) return null;

    return (
      <div className="category-description">
        <strong className="category-title">Performance Summary:</strong>
        {categories['Very Poor'].length > 0 && (
          <div className="category-row">
            <span className="category-label very-poor">Very Poor (&lt;25): </span>
            <span>{categories['Very Poor'].join(', ')}</span>
          </div>
        )}
        {categories['Poor'].length > 0 && (
          <div className="category-row">
            <span className="category-label poor">Poor (25-50): </span>
            <span>{categories['Poor'].join(', ')}</span>
          </div>
        )}
        {categories['Average'].length > 0 && (
          <div className="category-row">
            <span className="category-label average">Average (76-90): </span>
            <span>{categories['Average'].join(', ')}</span>
          </div>
        )}
        {categories['Good'].length > 0 && (
          <div className="category-row">
            <span className="category-label good">Good (≥90): </span>
            <span>{categories['Good'].join(', ')}</span>
          </div>
        )}
      </div>
    );
  };

  const renderSummaryGroup = (group, groupIndex) => {
    const groupKey = `summary-${group.name}`;
    const shouldHideFullScores = hideFullScores['summary'];
    const shouldHideNonScalar = hideNonScalar['summary'];

    // Filter fields if hide toggle is on
    const fieldsToRender = shouldHideFullScores
      ? group.fields.filter(field => {
        const numValue = Number(field.mean);
        return Number.isNaN(numValue) || numValue !== 100;
      })
      : group.fields;

    const filteredFields = shouldHideNonScalar
      ? fieldsToRender.filter(field => isScalarField(field))
      : fieldsToRender;

    if (filteredFields.length === 0) return null;

    return (
      <div key={`summary-group-${groupIndex}`} className="field-group">
        <h3
          className="group-name clickable"
          onClick={() => toggleGroup(groupKey)}
        >
          {group.name}
          <span className="toggle-icon">
            {collapsed[groupKey] ? '▼' : '▲'}
          </span>
        </h3>
        {!collapsed[groupKey] && (
          <dl className="field-list">
            {filteredFields.map((field, fieldIndex) => (
              <div key={`summary-field-${fieldIndex}`} className="field-item">
                <dt className="field-label">
                  {field.description && (
                    <span
                      className="mr-2 text-xs text-gray-400 field-info"
                      data-tooltip={field.description}
                      role="img"
                      aria-label="Field description"
                    >
                      ℹ️
                    </span>
                  )}
                  {formatFieldLabel(field.label)}
                </dt>
                <dd className={`field-value ${getScalarClass(field)}`}>
                  {renderSummaryValue(field)}
                </dd>
              </div>
            ))}
          </dl>
        )}
      </div>
    );
  };

  const llm_describe_summary = async (summaryGroups) => {
    try {
      setLoadingAI(prev => ({ ...prev, ['summary']: true }));

      // Extract scalar statistics from summary groups
      const scalarStats = {};
      let hasScalars = false;

      summaryGroups.forEach(group => {
        group.fields.forEach(field => {
          if (isScalarKey(field.key)) {
            scalarStats[field.key] = {
              mean: field.mean,
              std: field.std
            };
            hasScalars = true;
          }
        });
      });

      // If no scalars found, use all stats
      const dataToAnalyze = hasScalars ? scalarStats : summaryGroups;

      let value = await callLLM(`
      The following are aggregated quality parameters for ${inputData.length} biometric images:
${JSON.stringify(dataToAnalyze, null, 2)} 
      ---
      Assess the image quality across this dataset. Identify the main quality issues and suggest 2-3 key improvements for the capture proces - these might be operator training, environment modification or updated equipment. Keep it to 3-4 sentences maximum. 
      
      Start with "The assessed biometric quality in this cluster is ..." and then provide a concise analysis and recommendations.
      `, getAISettings());

      setAiResponses(prev => ({ ...prev, ['summary']: value }));
    } catch (error) {
      console.error('AI summary failed:', error);
      setAiResponses(prev => ({ ...prev, ['summary']: 'Error generating AI summary' }));
    } finally {
      setLoadingAI(prev => ({ ...prev, ['summary']: false }));
    }
  };

  const renderSummaryItem = () => {
    const summaryGroups = calculateSummaryStats();
    if (!summaryGroups) return null;

    const isExpanded = expandedItems['summary'];
    const shouldHideFullScores = hideFullScores['summary'];
    const averageImage = imageCache['average-composite'];

    return (
      <div className="formatted-item summary-item">
        <div className="item-label summary-label" onClick={() => toggleItem('summary')}>
          <span className="item-label-text">
            Summary Statistics (n={inputData.length})
          </span>
          {averageImage && (
            <div className="item-image">
              <img src={averageImage} alt="Average composite" />
            </div>
          )}
          <span className={`toggle-icon-main ${isExpanded ? 'expanded' : ''}`}>
            ▼
          </span>
        </div>
        {isExpanded && (
          <div className="item-content">
            <div className="controls">
              <label className="control-label">
                <input
                  type="checkbox"
                  checked={shouldHideFullScores || false}
                  onChange={() => {
                    toggleHideFullScores('summary');
                    onSettingsChange?.({
                      hidePerfect: !shouldHideFullScores,
                      hideNonScalar: !!shouldHideNonScalar
                    });
                  }}
                  onClick={(e) => e.stopPropagation()}
                />
                Hide non 100
              </label>
              <label className="control-label">
                <input
                  type="checkbox"
                  checked={hideNonScalar['summary'] || false}
                  onChange={() => {
                    toggleHideNonScalar('summary');
                    onSettingsChange?.({
                      hidePerfect: !!shouldHideFullScores,
                      hideNonScalar: !shouldHideNonScalar
                    });
                  }}
                  onClick={(e) => e.stopPropagation()}
                />
                Hide Non Scalar
              </label>
              <button
                className="btn-ai-summary"
                onClick={() => llm_describe_summary(summaryGroups)}
                disabled={loadingAI['summary']}
              >

                {loadingAI['summary'] ? 'Analyzing...' : 'AI Summary'}
              </button>
            </div>

            {/* AI Response Display */}
            {aiResponses['summary'] && (
              <div className="ai-response">
                <svg className="w-6 h-6 mr-2 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"></path>
                </svg>
                <strong>AI Analysis:</strong> {aiResponses['summary']}
              </div>
            )}

            {averageImage && (
              <div className="average-image-container">
                <div className="average-image-wrapper">
                  <img
                    src={averageImage}
                    alt="Average composite"
                    className="border-4 border-gray-500 rounded-lg shadow-2xl p-2"
                  />
                  <div className="average-image-caption">
                    Averaged composite of {inputData.length} images
                  </div>
                </div>
              </div>
            )}
            {renderCategoryDescription(summaryGroups)}
            {summaryGroups.map((group, groupIndex) =>
              renderSummaryGroup(group, groupIndex)
            )}
          </div>
        )}
      </div>
    );
  };

  const renderGroup = (group, itemIndex, groupIndex) => {
    const groupKey = `item-${itemIndex}-${group.name}`;
    const shouldHideFullScores = hideFullScores[itemIndex];
    const shouldHideNonScalar = hideNonScalar[itemIndex];

    // Filter fields if hide toggle is on
    const fieldsToRender = shouldHideFullScores
      ? group.fields.filter(field => {
        const numValue = Number(field.value);
        return Number.isNaN(numValue) || numValue !== 100;
      })
      : group.fields;

    const filteredFields = shouldHideNonScalar
      ? fieldsToRender.filter(field => isScalarField(field))
      : fieldsToRender;

    if (filteredFields.length === 0) return null;

    return (
      <div key={`item-${itemIndex}-group-${groupIndex}`} className="field-group">
        <h3
          className="group-name clickable"
          onClick={() => toggleGroup(groupKey)}
        >
          {group.name}
          <span className="toggle-icon">
            {collapsed[groupKey] ? '▼' : '▲'}
          </span>
        </h3>
        {!collapsed[groupKey] && (
          <dl className="field-list">
            {filteredFields.map((field, fieldIndex) => (
              <div key={`field-${fieldIndex}`} className="field-item">
                <dt className="field-label">
                  {field.description && (
                    <span
                      className="mr-2 text-xs text-gray-400 field-info"
                      data-tooltip={field.description}
                      role="img"
                      aria-label="Field description"
                    >
                      ℹ️
                    </span>
                  )}
                  {formatFieldLabel(field.label)}
                </dt>
                <dd className={`field-value ${getScalarClass(field)}`}>{renderValue(field)}</dd>
              </div>
            ))}
          </dl>
        )}
      </div>
    );
  };



  const llm_describe = async (item, index) => {
    try {
      setLoadingAI(prev => ({ ...prev, [index]: true }));

      // Get the source object (same as what renderItem uses)
      const source = getFieldSource(item);
      if (!source) {
        throw new Error('No source data found');
      }

      // Extract only scalar values
      const scalarData = {};
      let hasScalars = false;

      for (const [key, value] of Object.entries(source)) {
        if (isScalarKey(key)) {
          scalarData[key] = value;
          hasScalars = true;
        }
      }

      // If no scalars found, use the full source (excluding image fields)
      const imageKeys = Object.keys(source).filter((key) => fieldConfig?.[key]?.is_image);
      const dataToAnalyze = hasScalars
        ? scalarData
        : Object.fromEntries(Object.entries(source).filter(([key]) => !imageKeys.includes(key)));

      const imageFieldsDescription = imageKeys.length
        ? `Image fields (excluded from analysis): ${imageKeys.join(', ')}.`
        : 'No image fields detected.';

      let value = await callLLM(`
      The following is quality parameters for a biometric 
${JSON.stringify(dataToAnalyze)} 
      ---
      ${imageFieldsDescription}
      
        Assess the biometric quality. Identify the main quality issues and suggest 2-3 key improvements for the capture proces - these might be operator training, environment modification or updated equipment. Keep it consise and direct, 3-4 sentences maximum. Start with "The assessed biometric quality is"
      
      `, getAISettings());

      

      setAiResponses(prev => ({ ...prev, [index]: value }));
    } catch (error) {
      console.error('AI description failed:', error);
      setAiResponses(prev => ({ ...prev, [index]: 'Error generating AI summary' }));
    } finally {
      setLoadingAI(prev => ({ ...prev, [index]: false }));
    }
  };

  // Your renderItem function stays the same but WITHOUT any useState calls
  const renderItem = (item, index) => {
    const source = getFieldSource(item);
    if (!source) return null;
    const fields = extractFields(source);
    if (fields.length === 0) return null;
    const groups = groupFields(fields);
    const imageKey = getImageFieldKey(source);
    const imagePath = imageKey ? source?.[imageKey] : null;
    const cacheKey = `item-${index}-${imagePath}`;
    const imageBase64 = imageCache[cacheKey];
    const isExpanded = expandedItems[index];
    const shouldHideFullScores = hideFullScores[index];
    const shouldHideNonScalar = hideNonScalar[index];
    const clusterLabel = getItemClusterLabel?.(item, index, inputData) ?? null;

    return (
      <div key={`item-${index}`} className="formatted-item">
        <div className="item-label" onClick={() => toggleItem(index)}>
          <span className="item-label-text">
            {itemLabel ? itemLabel(item, index, inputData) : item?.file || `Item ${index + 1}`}
          </span>
          {clusterLabel ? (
            <span className="item-cluster-label">{clusterLabel}</span>
          ) : null}
          {imagePath && (
            <div className="item-image">
              {imageBase64 ? (
                <img src={imageBase64} alt={String(imagePath)} />
              ) : (
                <span>Loading…</span>
              )}
            </div>
          )}
          <span className={`toggle-icon-main ${isExpanded ? 'expanded' : ''}`}>
            ▼
          </span>
        </div>
        {isExpanded && (
          <div className="item-content">
            <div className="controls">
              <label className="control-label">
                <input
                  type="checkbox"
                  checked={shouldHideFullScores || false}
                  onChange={() => {
                    toggleHideFullScores(index);
                    onSettingsChange?.({
                      hidePerfect: !shouldHideFullScores,
                      hideNonScalar: !!shouldHideNonScalar
                    });
                  }}
                  onClick={(e) => e.stopPropagation()}
                />
                Hide Perfect
              </label>
              <label className="control-label">
                <input
                  type="checkbox"
                  checked={shouldHideNonScalar || false}
                  onChange={() => {
                    toggleHideNonScalar(index);
                    onSettingsChange?.({
                      hidePerfect: !!shouldHideFullScores,
                      hideNonScalar: !shouldHideNonScalar
                    });
                  }}
                  onClick={(e) => e.stopPropagation()}
                />
                Hide Non Scalar
              </label>
              <button
                className="btn-ai-summary"
                onClick={() => llm_describe(item, index)}
                disabled={loadingAI[index]}
              >
                {loadingAI[index] ? 'Analyzing...' : 'AI Summary'}
              </button>
            </div>

            {/* AI Response Display */}
            {aiResponses[index] && (
              <div className="ai-response">
                <span className="inline-flex items-center">
                  <svg className="w-6 h-6 mr-2 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"></path>
                  </svg>
                  <strong> AI Analysis</strong>
                </span>
                <p />

                <span>{aiResponses[index]}
                </span>
              </div>
            )}

            {imagePath && (
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }} className='pb-4'>
                {imageBase64 ? (
                  <img src={imageBase64} alt={String(imagePath)} className="border-4 border-gray-500 rounded-lg shadow-2xl p-2" />
                ) : (
                  <span>Loading…</span>
                )}
              </div>
            )}
            {groups.map((group, groupIndex) =>
              renderGroup(group, index, groupIndex)
            )}
          </div>
        )}
      </div>
    );
  };


  const renderedItems = limitedData
    .map((item, index) => renderItem(item, index))
    .filter(item => item !== null);

  if (renderedItems.length === 0) {
    return null;
  }


  return (
    <div>
    {/*  <button type="button" onClick={(e) => handleExport(e)}>Export to file</button> */}
      <div className="formatted-field-list" ref={listRef}>
        {inputData.length >= 2 && renderSummaryItem()}
        {renderedItems}
      </div>
      {inputData.length == 0 && (
        <div className="no-data">No data to display</div>
      )}
    </div>
  );
};

export default FormattedFieldList;
