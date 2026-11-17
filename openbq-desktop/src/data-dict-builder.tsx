import React, { useState } from 'react';
import { Upload, FileSpreadsheet, Loader2, Copy, ClipboardList, Database, Play } from 'lucide-react';
import * as XLSX from 'xlsx';
import Papa from 'papaparse';
import { FileText,HelpCircle, SettingsIcon } from 'lucide-react';
import {llm_prompt, prompt_options, llm_post_process_response} from './chunk.tsx';
import Settings, { useAISettings } from "./components/Settings.tsx";


type SettingsToggleProps = {
  open: boolean;
  onToggle: () => void;
};

export function SettingsToggleButton({ open, onToggle }: SettingsToggleProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      aria-controls="settings-panel"
      className="inline-flex items-center gap-2 rounded-lg border border-black/10 dark:border-white/10 px-3 py-2 text-sm font-medium
                 bg-white/70 dark:bg-black/30 hover:bg-black/5 dark:hover:bg-white/5
                 focus:outline-none focus:ring-2 focus:ring-blue-500"
    >
     <SettingsIcon className="w-5 h-5"/> 
      <span>{open ? "Hide settings" : "Settings"}</span>

      
    </button>
  );
}

export default function DataDictionaryApp() {
  const [file, setFile] = useState(null);
  const [context, setContext] = useState('');
  const [sampleSize, setSampleSize] = useState(10);
  const [sheets, setSheets] = useState([]);
  const [selectedSheet, setSelectedSheet] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(null);
  const [error, setError] = useState('');
  const [copiedHtml, setCopiedHtml] = useState(false);
  const [copiedText, setCopiedText] = useState(false);
  const [narrative, setNarrative] = useState('');
  const [generatingNarrative, setGeneratingNarrative] = useState(false);
  const [dataTable, setDataTable] = useState(null);
  const [queryResults, setQueryResults] = useState(null);
  const [selectedFields, setSelectedFields] = useState([]);
  const [whereField, setWhereField] = useState('');
  const [whereOperator, setWhereOperator] = useState('=');
  const [whereValue, setWhereValue] = useState('');
  const [orderByField, setOrderByField] = useState('');
  const [orderByDirection, setOrderByDirection] = useState('ASC');
  const [limitValue, setLimitValue] = useState(100);
  const [useOllama, setUseOllama] = useState(false);
  const [ollamaUrl, setOllamaUrl] = useState('http://localhost:11434');
  const [ollamaModel, setOllamaModel] = useState('llama2');
  const { settings, setSettings } = useAISettings();
  const [settingsOpen, setSettingsOpen] = useState(false);


  const handleFileUpload = async (e) => {
    const uploadedFile = e.target.files[0];
    if (!uploadedFile) return;

    setFile(uploadedFile);
    setError('');
    setResults(null);
    setNarrative('');
    setDataTable(null);
    setQueryResults(null);

    const fileExt = uploadedFile.name.split('.').pop().toLowerCase();

    if (fileExt === 'csv') {
      setSheets([{ name: 'CSV Data', data: null }]);
      setSelectedSheet('CSV Data');
    } else if (fileExt === 'xlsx' || fileExt === 'xls') {
      const data = await uploadedFile.arrayBuffer();
      const workbook = XLSX.read(data);
      const sheetNames = workbook.SheetNames.map(name => ({
        name,
        workbook
      }));
      setSheets(sheetNames);
      setSelectedSheet(sheetNames[0]?.name || '');
    } else {
      setError('Please upload a CSV or Excel file');
      setFile(null);
    }
  };

  const parseData = async () => {
    if (!file) return null;

    const fileExt = file.name.split('.').pop().toLowerCase();

    if (fileExt === 'csv') {
      return new Promise((resolve, reject) => {
        Papa.parse(file, {
          header: true,
          dynamicTyping: true,
          skipEmptyLines: true,
          complete: (results) => resolve(results.data),
          error: (error) => reject(error)
        });
      });
    } else {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const sheet = workbook.Sheets[selectedSheet];
      const jsonData = XLSX.utils.sheet_to_json(sheet, { defval: null });
      return jsonData;
    }
  };

  const getRandomSample = (data, size) => {
    const shuffled = [...data].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, Math.min(size, data.length));
  };

  const generateDataDictionary = async () => {
    if (!file) {
      setError('Please upload a file first');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const data = await parseData();

      if (!data || data.length === 0) {
        setError('No data found in the file');
        setLoading(false);
        return;
      }

      const sample = getRandomSample(data, sampleSize);
      const headers = Object.keys(data[0] || {});
      const firstRows = data.slice(0, 3);

      const prompt = `You are a data analyst creating a data dictionary. 

${context ? `Context about this dataset: ${context}\n\n` : ''}

I have a dataset with the following fields: ${headers.join(', ')}

Here are the first few rows:
${JSON.stringify(firstRows, null, 2)}

Here is a random sample of ${sample.length} rows:
${JSON.stringify(sample, null, 2)}

Please create a data dictionary with a description for each field. For each field, provide:
1. Field name
2. Data type (string, number, date, boolean, etc.)
3. A clear, concise description of what the field represents
4. Any notable patterns or characteristics you observe

Return your response as a JSON array with this structure:
[
  {
    "field": "field_name",
    "type": "data_type",
    "description": "field description"
  }
]

Return ONLY the JSON array, no other text.`;

      let content;

      if (useOllama) {
        const response = await fetch(`${ollamaUrl}/api/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: ollamaModel,
            prompt,
            stream: false
          })
        });

        if (!response.ok) throw new Error(`Ollama API request failed: ${response.statusText}`);

        const result = await response.json();
        content = result.response;
      } else {
        const response = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 4000,
            messages: [{ role: 'user', content: prompt }]
          })
        });

        if (!response.ok) throw new Error(`API request failed: ${response.statusText}`);

        const result = await response.json();
        content = result.content[0].text;
      }

      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const dictionary = JSON.parse(jsonMatch[0]);
        setResults({
          sheetName: selectedSheet,
          totalRows: data.length,
          sampleRows: sample.length,
          dictionary
        });

        setDataTable(data);
        setSelectedFields(headers);

        setTimeout(() => {
          generateNarrativeWithData(dictionary, selectedSheet, data.length, context);
        }, 100);
      } else {
        setError('Failed to parse API response');
      }
    } catch (err) {
      setError(`Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const generateNarrativeWithData = async (dictionary, sheetName, totalRows, dataContext) => {
    setGeneratingNarrative(true);

    try {
      const prompt = `You are a senior data analyst at Accenture writing an executive narrative for a data dictionary report.

${dataContext ? `Dataset Context: ${dataContext}\n\n` : ''}

Dataset: ${sheetName}
Total Rows: ${totalRows}

Fields in this dataset:
${dictionary.map(item => `- ${item.field} (${item.type}): ${item.description}`).join('\n')}

Write a comprehensive narrative (3-5 paragraphs) in the style of an Accenture consulting report that:

1. Overview: Begin with an executive summary of the dataset's purpose and scope
2. Field Clustering: Group and describe fields by their functional categories
3. Critical Analytics Fields: Call out the most important fields from an analysis perspective
4. Strategic Analysis Recommendations: Suggest 2-3 specific, actionable field combinations
5. Data Quality & Completeness: Comment on analytical potential and considerations

Do not use markdown formatting - just plain paragraphs separated by blank lines.`;

      let narrativeText;

      if (useOllama) {
        const response = await fetch(`${ollamaUrl}/api/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: ollamaModel,
            prompt,
            stream: false
          })
        });

        if (!response.ok) throw new Error('Failed to generate narrative');

        const result = await response.json();
        narrativeText = result.response;
      } else {
        const response = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 2500,
            messages: [{ role: 'user', content: prompt }]
          })
        });

        if (!response.ok) throw new Error('Failed to generate narrative');

        const result = await response.json();
        narrativeText = result.content[0].text;
      }

      setNarrative(narrativeText);
    } catch (err) {
      console.error('Error generating narrative:', err);
      setNarrative('This dataset contains the fields listed below. Each field has been analysed and documented with its data type and description.');
    } finally {
      setGeneratingNarrative(false);
    }
  };

  const generateNarrative = async () => {
    if (!results || narrative) return;
    await generateNarrativeWithData(results.dictionary, results.sheetName, results.totalRows, context);
  };

  const copyTextDefinitions = async () => {
    if (!results) return;

    if (!narrative && !generatingNarrative) {
      setGeneratingNarrative(true);
      await generateNarrative();
      let attempts = 0;
      while (!narrative && attempts < 50) {
        await new Promise(resolve => setTimeout(resolve, 200));
        attempts++;
      }
      setGeneratingNarrative(false);
    }

    const currentNarrative = narrative || 'Narrative description is being generated. Please try copying again in a moment.';

    const text = `# Data Dictionary: ${results.sheetName}

## Overview

${currentNarrative}

## Field Definitions

${results.dictionary.map(item =>
  `**${item.field}** (${item.type}): ${item.description}`
).join('\n\n')}

---
*Generated on ${new Date().toLocaleDateString()}*`;

    try {
      await navigator.clipboard.writeText(text);
      setCopiedText(true);
      setTimeout(() => setCopiedText(false), 2000);
    } catch (err) {
      setError('Failed to copy to clipboard');
    }
  };

  const copyTableAsHtml = async () => {
    if (!results) return;

    const html = `
<table border="1" cellpadding="8" cellspacing="0" style="border-collapse: collapse; width: 100%; font-family: -apple-system, system-ui, Segoe UI, Arial, sans-serif;">
  <thead>
    <tr style="background-color: #F2F2F7;">
      <th style="text-align:left;font-weight:600;padding:10px;">Field Name</th>
      <th style="text-align:left;font-weight:600;padding:10px;">Data Type</th>
      <th style="text-align:left;font-weight:600;padding:10px;">Description</th>
    </tr>
  </thead>
  <tbody>
    ${results.dictionary.map(item => `
    <tr>
      <td style="padding:10px;font-weight:500;">${item.field}</td>
      <td style="padding:10px;color:#6B7280;">${item.type}</td>
      <td style="padding:10px;">${item.description}</td>
    </tr>`).join('')}
  </tbody>
</table>`;

    try {
      const blob = new Blob([html], { type: 'text/html' });
      const data = [new ClipboardItem({ 'text/html': blob })];
      await navigator.clipboard.write(data);
      setCopiedHtml(true);
      setTimeout(() => setCopiedHtml(false), 2000);
    } catch (err) {
      setError('Failed to copy HTML to clipboard');
    }
  };

  const executeQuery = () => {
    if (!dataTable || selectedFields.length === 0) return;

    try {
      let filteredData = [...dataTable];

      if (whereField && whereValue) {
        filteredData = filteredData.filter(row => {
          const fieldValue = String(row[whereField] ?? '');
          const compareValue = String(whereValue);

          switch (whereOperator) {
            case '=': return fieldValue === compareValue;
            case '!=': return fieldValue !== compareValue;
            case '>': return parseFloat(fieldValue) > parseFloat(compareValue);
            case '<': return parseFloat(fieldValue) < parseFloat(compareValue);
            case '>=': return parseFloat(fieldValue) >= parseFloat(compareValue);
            case '<=': return parseFloat(fieldValue) <= parseFloat(compareValue);
            case 'LIKE': return fieldValue.toLowerCase().includes(compareValue.toLowerCase());
            default: return true;
          }
        });
      }

      if (orderByField) {
        filteredData.sort((a, b) => {
          const aVal = a[orderByField];
          const bVal = b[orderByField];
          const aNum = parseFloat(aVal);
          const bNum = parseFloat(bVal);

          let comparison;
          if (!isNaN(aNum) && !isNaN(bNum)) comparison = aNum - bNum;
          else comparison = String(aVal ?? '').localeCompare(String(bVal ?? ''));

          return orderByDirection === 'ASC' ? comparison : -comparison;
        });
      }

      const limitedData = filteredData.slice(0, limitValue);

      const resultRows = limitedData.map(row => {
        const newRow = {};
        selectedFields.forEach(field => { newRow[field] = row[field]; });
        return newRow;
      });

      const selectClause = selectedFields.join(', ');
      let query = `SELECT ${selectClause} FROM data`;
      if (whereField && whereValue) query += ` WHERE ${whereField} ${whereOperator} '${whereValue}'`;
      if (orderByField) query += ` ORDER BY ${orderByField} ${orderByDirection}`;
      query += ` LIMIT ${limitValue}`;

      setQueryResults({
        columns: selectedFields,
        rows: resultRows,
        query,
        totalFiltered: filteredData.length
      });
    } catch (err) {
      setError(`Query error: ${err.message}`);
    }
  };

  const toggleField = (field) => {
    setSelectedFields(prev =>
      prev.includes(field) ? prev.filter(f => f !== field) : [...prev, field]
    );
  };

  const selectAllFields = () => {
    if (results) setSelectedFields(results.dictionary.map(item => item.field));
  };

  const clearAllFields = () => setSelectedFields([]);

  const inputBase =
    "w-full px-3 py-2 rounded-lg border border-black/10 bg-white/80 shadow-sm " +
    "focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500/40";

  const buttonPrimary =
    "w-full rounded-xl bg-blue-600 text-white py-3 font-medium shadow-sm " +
    "hover:bg-blue-700 disabled:bg-black/20 disabled:cursor-not-allowed " +
    "transition-colors flex items-center justify-center gap-2";

  const buttonSecondary =
    "flex items-center gap-2 px-4 py-2 rounded-lg bg-white/70 border border-black/10 " +
    "shadow-sm hover:bg-white transition-colors";

  return (
<div className="min-h-screen bg-[#f5f5f7] dark:bg-[#0b0b0f] p-6">

 <div className="fixed top-0 inset-x-0 z-20 h-12
  bg-gradient-to-b from-white/200 to-white/70
  dark:from-[#121217]/90 dark:to-[#0f0f14]/70
  backdrop-blur
  border-b border-black/10 dark:border-white/10">

       <div className="mx-auto max-w-7xl h-full px-6 flex items-center">

      <h1 className="text-2xl font-bold dark:text-gray-800 mb-2 flex items-center">
            <FileText className="w-8 h-8 mr-2 text-blue-600" />
            Data Wrangler
          </h1>

      {/* Settings Button */}
      
          <div className="ml-auto flex items-center gap-3">
            <SettingsToggleButton
              open={settingsOpen}
              onToggle={() => setSettingsOpen((v) => !v)}
            />
           <button
              type="button"
              aria-controls="settings-panel"
              className="inline-flex items-center gap-2 rounded-lg border border-black/10 dark:border-white/10 px-3 py-2 text-sm font-medium
                        bg-white/70 dark:bg-black/30 hover:bg-black/5 dark:hover:bg-white/5
                        focus:outline-none focus:ring-2 focus:ring-blue-500"

              onClick={() => {
                  window.open("https://biometix.com", "_blank", "noopener,noreferrer");
                }}
            >
              <HelpCircle className="w-5 h-5" />
            Help
            </button>
          </div>
          </div>

           { settingsOpen? (
                    <Settings value={settings} onChange={setSettings} />
                    ) : (<div></div>)}
 

          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">Upload File</label>
            <div className="flex items-center justify-center w-full">
              <label className="w-full flex flex-col items-center px-4 py-7 bg-white/60 border border-dashed border-black/20 rounded-2xl cursor-pointer hover:bg-white/80 transition-colors">
                <Upload className="w-7 h-7 text-gray-500" />
                <span className="mt-2 text-sm text-gray-700">
                  {file ? file.name : 'Click to upload or drag and drop'}
                </span>
                <span className="mt-1 text-xs text-gray-500">CSV, XLSX, XLS</span>
                <input
                  type="file"
                  className="hidden"
                  accept=".csv,.xlsx,.xls"
                  onChange={handleFileUpload}
                />
              </label>
            </div>
          </div>

          {sheets.length > 1 && (
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">Worksheet</label>
              <select
                value={selectedSheet}
                onChange={(e) => setSelectedSheet(e.target.value)}
                className={inputBase}
              >
                {sheets.map(sheet => (
                  <option key={sheet.name} value={sheet.name}>{sheet.name}</option>
                ))}
              </select>
            </div>
          )}

          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">Data Context</label>
            <textarea
              value={context}
              onChange={(e) => setContext(e.target.value)}
              className={inputBase}
              rows={3}
              placeholder="e.g., Sales data for Q4 2024, customer survey responses, etc."
            />
          </div>

          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">Sample Size</label>
            <input
              type="number"
              value={sampleSize}
              onChange={(e) => setSampleSize(Math.max(1, parseInt(e.target.value) || 10))}
              className={inputBase}
              min="1"
              max="100"
            />
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700">
              {error}
            </div>
          )}

          <button
            onClick={generateDataDictionary}
            disabled={loading || !file}
            className={buttonPrimary}
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Generating…
              </>
            ) : (
              'Generate Data Dictionary'
            )}
          </button>

          {results && (
            <div className="mt-10">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold tracking-tight">Data Dictionary</h2>
                <div className="flex gap-2">
                  <button
                    onClick={copyTextDefinitions}
                    disabled={generatingNarrative}
                    className={buttonSecondary + (generatingNarrative ? " opacity-60 cursor-not-allowed" : "")}
                  >
                    {generatingNarrative ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Generating…
                      </>
                    ) : (
                      <>
                        <ClipboardList className="w-4 h-4" />
                        {copiedText ? 'Copied' : 'Copy Report'}
                      </>
                    )}
                  </button>

                  <button onClick={copyTableAsHtml} className={buttonSecondary}>
                    <Copy className="w-4 h-4" />
                    {copiedHtml ? 'Copied' : 'Copy HTML'}
                  </button>
                </div>
              </div>

              <div className="mb-5 text-sm text-gray-600">
                <p>Sheet: <span className="text-gray-900 font-medium">{results.sheetName}</span></p>
                <p>Total Rows: <span className="text-gray-900 font-medium">{results.totalRows}</span></p>
                <p>Sample Analysed: <span className="text-gray-900 font-medium">{results.sampleRows}</span></p>
              </div>

              {narrative && (
                <div className="mb-6 p-4 bg-white/70 border border-black/10 rounded-2xl">
                  <h3 className="text-sm font-semibold text-gray-900 mb-2">Dataset Overview</h3>
                  <div className="text-gray-700 whitespace-pre-line">{narrative}</div>
                </div>
              )}

              <div className="overflow-x-auto rounded-2xl border border-black/10 bg-white/70">
                <table className="w-full border-collapse">
                  <thead className="bg-[#F2F2F7]">
                    <tr>
                      <th className="border-b border-black/10 px-4 py-3 text-left font-semibold text-sm">Field Name</th>
                      <th className="border-b border-black/10 px-4 py-3 text-left font-semibold text-sm">Data Type</th>
                      <th className="border-b border-black/10 px-4 py-3 text-left font-semibold text-sm">Description</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.dictionary.map((item, idx) => (
                      <tr key={idx} className="hover:bg-white/60">
                        <td className="border-b border-black/5 px-4 py-3 font-medium">{item.field}</td>
                        <td className="border-b border-black/5 px-4 py-3 text-gray-600">{item.type}</td>
                        <td className="border-b border-black/5 px-4 py-3">{item.description}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {results && dataTable && (
            <div className="mt-10 rounded-2xl bg-white/70 backdrop-blur-xl border border-black/10 shadow-sm p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-9 h-9 rounded-xl bg-blue-600/10 flex items-center justify-center">
                  <Database className="w-5 h-5 text-blue-700" />
                </div>
                <h2 className="text-xl font-semibold tracking-tight">Query Builder</h2>
              </div>

              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-gray-700">Select Fields</label>
                  <div className="flex gap-2">
                    <button onClick={selectAllFields} className="text-xs px-3 py-1 rounded-lg bg-white/70 border border-black/10 hover:bg-white">
                      Select All
                    </button>
                    <button onClick={clearAllFields} className="text-xs px-3 py-1 rounded-lg bg-white/70 border border-black/10 hover:bg-white">
                      Clear
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 max-h-48 overflow-y-auto border border-black/10 rounded-2xl p-3 bg-[#F2F2F7]">
                  {results.dictionary.map(item => (
                    <label key={item.field} className="flex items-center gap-2 cursor-pointer hover:bg-white/70 p-2 rounded-xl">
                      <input
                        type="checkbox"
                        checked={selectedFields.includes(item.field)}
                        onChange={() => toggleField(item.field)}
                        className="rounded"
                      />
                      <span className="text-sm">{item.field}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="mb-4 grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Filter Field</label>
                  <select value={whereField} onChange={(e) => setWhereField(e.target.value)} className={inputBase}>
                    <option value="">No filter</option>
                    {results.dictionary.map(item => (
                      <option key={item.field} value={item.field}>{item.field}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Operator</label>
                  <select value={whereOperator} onChange={(e) => setWhereOperator(e.target.value)} className={inputBase}>
                    <option value="=">=</option>
                    <option value="!=">!=</option>
                    <option value=">">{'>'}</option>
                    <option value="<">{'<'}</option>
                    <option value=">=">{'≥'}</option>
                    <option value="<=">{'≤'}</option>
                    <option value="LIKE">Contains</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Value</label>
                  <input
                    type="text"
                    value={whereValue}
                    onChange={(e) => setWhereValue(e.target.value)}
                    placeholder="Filter value"
                    className={inputBase}
                  />
                </div>
              </div>

              <div className="mb-4 grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Sort By</label>
                  <select value={orderByField} onChange={(e) => setOrderByField(e.target.value)} className={inputBase}>
                    <option value="">No sorting</option>
                    {results.dictionary.map(item => (
                      <option key={item.field} value={item.field}>{item.field}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Direction</label>
                  <select value={orderByDirection} onChange={(e) => setOrderByDirection(e.target.value)} className={inputBase}>
                    <option value="ASC">Ascending</option>
                    <option value="DESC">Descending</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Limit</label>
                  <input
                    type="number"
                    value={limitValue}
                    onChange={(e) => setLimitValue(Math.max(1, parseInt(e.target.value) || 100))}
                    min="1"
                    className={inputBase}
                  />
                </div>
              </div>

              <button
                onClick={executeQuery}
                disabled={selectedFields.length === 0}
                className={buttonPrimary + (selectedFields.length === 0 ? " opacity-60" : "")}
              >
                <Play className="w-5 h-5" />
                Run Query
              </button>

              {queryResults && (
                <div className="mt-6">
                  <div className="mb-2 p-3 bg-[#F2F2F7] rounded-xl text-xs font-mono text-gray-700 overflow-x-auto border border-black/10">
                    {queryResults.query}
                  </div>
                  <p className="text-sm text-gray-600 mb-3">
                    Results: {queryResults.rows.length} rows {queryResults.totalFiltered > queryResults.rows.length && `(filtered from ${queryResults.totalFiltered})`}
                  </p>

                  {queryResults.rows.length > 0 ? (
                    <div className="overflow-x-auto max-h-96 overflow-y-auto border border-black/10 rounded-2xl bg-white/70">
                      <table className="w-full border-collapse">
                        <thead className="sticky top-0 bg-[#F2F2F7]">
                          <tr>
                            {queryResults.columns.map((col, idx) => (
                              <th key={idx} className="border-b border-black/10 px-3 py-3 text-left font-semibold text-sm">
                                {col}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {queryResults.rows.map((row, rowIdx) => (
                            <tr key={rowIdx} className="hover:bg-white/60">
                              {queryResults.columns.map((col, colIdx) => (
                                <td key={colIdx} className="border-b border-black/5 px-3 py-2 text-sm">
                                  {row[col] !== null ? String(row[col]) : <span className="text-gray-400">null</span>}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="text-gray-500 text-center py-4">No results found</p>
                  )}
                </div>
              )}
            </div>
          )}

        </div>
      </div>
    
  );
}