'use client';

import { useState, useEffect } from 'react';
import {
  CheckCircle,
  FileText,
  Sparkles,
  Shield,
  Zap,
  ChevronDown,
  Files
} from 'lucide-react';
import { createPortal } from 'react-dom';

type HelpProps = { onClose: () => void };

interface FAQItem {
  question: string;
  answer: string;
}

const faqs: FAQItem[] = [
  {
    question: "What is openbq desktop?",
    answer:
      "openbq desktop is a local application for analysing biometric data quality using the Open Biometric Quality (openbq) framework. It allows you to process biometric datasets and explore quality metrics through visual analytics."
  },
  {
    question: "What biometric modalities are supported?",
    answer:
      "openbq desktop supports common biometric modalities including face images, fingerprints, irises, and voice recordings. Available metrics depend on the enabled openbq modules."
  },
  {
    question: "Is biometric data uploaded or shared?",
    answer:
      "No. All processing is performed locally on your machine. Biometric data is never uploaded, shared, or stored externally."
  },
  {
    question: "What outputs does openbq desktop generate?",
    answer:
      "openbq desktop produces quality metrics, distributions, and derived indicators that help identify low-quality samples, operational issues, and overall dataset health."
  },
  {
    question: "Who is openbq desktop designed for?",
    answer:
      "openbq desktop is intended for biometric system developers, evaluators, researchers, integrators, and operational teams who need to understand and improve biometric data quality."
  }
];

function FAQSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <section className="w-full py-16 px-6">
      <div className="mx-auto max-w-4xl">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
            Frequently Asked Questions
          </h2>
          <p className="text-lg text-gray-600 dark:text-gray-300">
            Common questions about openbq desktop
          </p>
        </div>

        <div className="space-y-4">
          {faqs.map((faq, index) => (
            <div
              key={index}
              className="rounded-xl bg-white dark:bg-white/5 border border-black/10 dark:border-white/10 overflow-hidden"
            >
              <button
                onClick={() =>
                  setOpenIndex(openIndex === index ? null : index)
                }
                className="w-full px-6 py-4 text-left flex items-center justify-between
                           hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
              >
                <span className="font-medium text-gray-900 dark:text-white">
                  {faq.question}
                </span>
                <ChevronDown
                  className={`w-5 h-5 text-gray-500 transition-transform ${openIndex === index ? 'rotate-180' : ''
                    }`}
                />
              </button>

              {openIndex === index && (
                <div className="px-6 pb-4 text-gray-600 dark:text-gray-300">
                  {faq.answer}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export default function Help({ onClose }: HelpProps) {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const [logoSrc, setLogoSrc] = useState<string>("");
 const [appInfo, setAppInfo] = useState<any>(null);
 
 useEffect(() => {
   async function fetchAppInfo() {
     try {
       const info = await window.electron.getAppInfo();
       setAppInfo(info);
     } catch {
       setAppInfo({ name: "openbq desktop", version: "0.x" });
     }
   }
 
   fetchAppInfo();
 }, []);
 
 useEffect(() => {
   if (!appInfo?.logofile) return;
 
   let cancelled = false;
 
   const loadLogo = async () => {
     try {
       console.log("LOGO",appInfo.logofile)
       const { success, base64 } =
         await window.electron.fs.readImageBase64(
           appInfo.logofile,
           "",
           { maxWidth: 600 }
         );
 
       if (!cancelled && success && base64) {
         setLogoSrc(`data:image/png;base64,${base64}`);
       }
     } catch (err) {
       console.error("Failed to load logo:", err);
     }
   };
 
   loadLogo();
 
   return () => {
     cancelled = true;
   };
 }, [appInfo?.logofile]);   // ← THIS must exist


  const mailtoSubject = `HELP: openbq desktop: v ${appInfo?.version} (${appInfo?.platform})`;
  const mailtoBody = [
    "Let us know who you are, how you are using openbq, or what you'd like help with.",
    "",
    "Debug Info -",
    `* Docker: installed ${appInfo?.docker?.installed}, running ${appInfo?.docker?.running}`,
    `* Ollama: installed ${appInfo?.ollama?.installed}, running ${appInfo?.ollama?.running}`,
  ].join("\n");
  const mailto = `mailto:support@openbq.io?subject=${encodeURIComponent(
    mailtoSubject
  )}&body=${encodeURIComponent(mailtoBody)}`;

  const openUserTutorial = async () => {
    try {
      const appPath = await window.electron?.getPath?.('appPath');
      if (!appPath) {
        window.electron?.showNotification?.(
          "Open tutorial",
          "Unable to determine app path for tutorial files."
        );
        return;
      }

      const candidates = [
        `${appPath}/assets/docs-html/index.html`,
        `${appPath}/../assets/docs-html/index.html`,
        `${appPath}/docs-html/index.html`,
        `${appPath}/../docs-html/index.html`,
      ];

      for (const candidate of candidates) {
        try {
          const check = await window.electron?.fs?.readFile?.(candidate);
          if (!check?.success) continue;
          const fileUrl = `file://${candidate.replace(/\\/g, "/")}`;
          await window.electron?.shell?.openExternal?.(fileUrl);
          return;
        } catch {
          // Try next candidate.
        }
      }

      window.electron?.showNotification?.(
        "Open tutorial",
        "User tutorial not found. Build docs first with: npm run docs:build:html"
      );
    } catch (err: any) {
      window.electron?.showNotification?.(
        "Open tutorial",
        err?.message ?? "Unable to open user tutorial."
      );
    }
  };


  if (typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] bg-black/40 p-4 sm:p-6 overflow-y-auto"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="w-full max-h-[90vh] overflow-hidden rounded-2xl
                   bg-white dark:bg-neutral-900
                   border border-black/10 dark:border-white/10
                   shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between
                        px-6 py-4 bg-white/90 dark:bg-neutral-900/90
                        backdrop-blur border-b border-black/10 dark:border-white/10">
          <div>

            <div className="text-sm text-gray-600 dark:text-gray-300 flex items-center gap-2">
              <span>Guide and FAQs — {appInfo?.name} v{appInfo?.version}</span>
              <span className="ml-auto text-xs opacity-70">
                (see https://openbq.io for more information)
              </span>
            </div>

          </div>

          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center justify-center rounded-lg px-3 py-2 text-sm font-medium
                       border border-black/10 dark:border-white/10
                       bg-white/70 dark:bg-white/5 dark:text-white
                       hover:bg-black/5 dark:hover:bg-white/10"
          >
            ✕
          </button>
        </div>

        <div className="max-h-[calc(90vh-64px)] overflow-y-auto">
          {/* Hero */}
          <section className="px-6 py-5">
            <div className="mx-auto max-w-4xl text-center">
                         {logoSrc && (
              <img
                src={logoSrc}
                alt="openbq"
                className="block mx-auto h-30 w-auto"
                draggable={false}
              />
            )} 
                  
              <p className="text-lg text-gray-600 dark:text-gray-300 mb-10">
                Analyse, visualise, and understand biometric data quality at scale.
              </p>
              

              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <button
                  onClick={() =>
                    document
                      .getElementById("help-get-started")
                      ?.scrollIntoView({ behavior: "smooth" })
                  }
                  className="inline-flex items-center justify-center px-8 py-3
                             rounded-lg border border-black/10 dark:border-white/10 dark:text-white
                             bg-white/70 dark:bg-white/5 hover:bg-black/5 dark:hover:bg-white/10"
                >
                  Get Started
                </button>

                <button
                  onClick={openUserTutorial}
                  className="inline-flex items-center justify-center px-8 py-3
                             rounded-lg border border-black/10 dark:border-white/10 dark:text-white
                             bg-white/70 dark:bg-white/5 hover:bg-black/5 dark:hover:bg-white/10"
                >
                  Open User Tutorial
                </button>

                <button
                  onClick={() =>
                    document
                      .getElementById("help-faq")
                      ?.scrollIntoView({ behavior: "smooth" })
                  }
                  className="inline-flex items-center justify-center px-8 py-3
                             rounded-lg border border-black/10 dark:border-white/10 dark:text-white
                             bg-white/70 dark:bg-white/5 hover:bg-black/5 dark:hover:bg-white/10"
                >
                  Learn More
                </button>
              </div>
              <div className='pt-5 text-blue-800 dark:text-blue-400 text-sm'>
                <a
          href={mailto}
          onClick={(e) => {
            e.preventDefault();
            window.electron.shell.openExternal(mailto);
          }}
        >
          Click here to contact us to let us know how you are using openbq!
        </a>
        </div>
            </div>
          </section>

          {/* Getting Started */}
          <section
            id="help-get-started"
            className="w-full py-16 px-6 bg-gray-50 dark:bg-black/30"
          >
            <div className="mx-auto max-w-4xl">
              <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-6 text-center">
                Getting Started
              </h2>

              <div className="space-y-8 text-gray-700 dark:text-gray-300">
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-2">
                    Prerequisites
                  </h3>
                  <ul className="list-disc pl-6 space-y-1">
                    <li>Docker must be installed and running on your machine.</li>
                    <li>Ollama is required for AI-assisted analysis and explanations.</li>
                  </ul>
                </div>

                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-2">
                    First Launch
                  </h3>
                  <p>
                    The first time openbq desktop starts, it will download and
                    initialise required models and containers. This may take
                    several minutes depending on your internet connection.
                  </p>
                </div>

                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-2">
                    Analysing Your First Dataset
                  </h3>
                  <ol className="list-decimal pl-6 space-y-1">
                    <li>Select a directory containing biometric data.</li>
                    <li>Choose the biometric modality to analyse.</li>
                    <li>Run the openbq analysis pipeline.</li>
                    <li>Inspect results using the visualisation tools.</li>
                  </ol>
                </div>

                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-2">
                    Understanding Results
                  </h3>
                  <p>
                    Visual outputs help identify low-quality samples, systematic
                    capture issues, and opportunities for operational improvement.
                  </p>
                </div>
              </div>
            </div>
          </section>

          <div id="help-faq">
            <FAQSection />
          </div>

          <footer className="w-full py-8 px-6 border-t border-black/10 dark:border-white/10">
            <div className="mx-auto max-w-6xl text-center text-sm text-gray-600 dark:text-gray-400">
              © {new Date().getFullYear()} {appInfo?.name}. All rights reserved.
            </div>
          </footer>
        </div>
      </div>
    </div>,
    document.body
  );
}
