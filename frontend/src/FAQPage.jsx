import React, { useState, useEffect, useRef } from "react";
import { motion, useInView } from "framer-motion";
import {
  LPV7_TOKENS, FONT_DISPLAY, FONT_MONO, TYPE, card, btn, CALENDLY_URL,
  SUPPORT_EMAIL, Reveal, Stagger, StaggerItem, AnimNum, SectionHead, LP_GLOBAL_CSS,
  StandaloneNav, StandaloneFooter,
} from "./lpShared.jsx";

function StandalonePage({ lang, setLang, children }) {
  const T = LPV7_TOKENS;
  return (
    <>
      <style>{LP_GLOBAL_CSS + `
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        body{background:#030b14;color:#e8f0ff;overflow-x:hidden}
        .lp-wrap{max-width:1180px;margin:0 auto;padding:0 32px}
        .lp-section{padding:clamp(52px,7vw,96px) 32px}
        .lp-lift{transition:transform .22s ease,box-shadow .22s ease}
        .lp-lift:hover{transform:translateY(-3px);box-shadow:0 12px 40px rgba(0,0,0,.4)}
        @media(max-width:1024px){.lp-wrap{padding:0 20px}.lp-section{padding:56px 20px}}
        @media(max-width:720px){.lp-wrap{padding:0 16px}.lp-section{padding:44px 16px}}
      `}</style>
      <div style={{ background:T.bg, minHeight:"100vh", color:T.text, fontFamily:FONT_DISPLAY }}>
        <StandaloneNav lang={lang} setLang={setLang}/>
        <div style={{ paddingTop:80 }}>
          {children}
        </div>
        <StandaloneFooter lang={lang}/>
      </div>
    </>
  );
}

export default function FAQPage() {
  const [lang, setLang] = useState(() => {
    try { return localStorage.getItem("lp_lang") || "en"; } catch { return "en"; }
  });
  return (
    <StandalonePage lang={lang} setLang={setLang}>
      <FAQ lang={lang}/>
    </StandalonePage>
  );
}
