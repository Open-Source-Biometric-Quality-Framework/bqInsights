// components/BuildPptx.tsx

import { generatePptxReport } from "../reports/pptx_report";
//import { pptxToHtml } from "@jvmr/pptx-to-html";


export default function BuildPptx({ config }) {


  const build = async () => {
    const pres = await generatePptxReport(config);
    await pres.writeFile({ fileName: "Performix_Report.pptx" });
    // For testing: convert back to HTML and log
    //const pptxBuffer = await pres.write({ outputType: "arraybuffer" });
    //const slides = await pptxToHtml(pptxBuffer, { width: 950, height: 550, scaleToFit: false });
    //console.log("Generated Slides HTML:", slides);
  };

  return (
    <button onClick={build}>
      Generate PPTX Report
    </button>
  );
}