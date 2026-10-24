"use client";

import { useState, type FormEvent } from "react";
import { analyzeMessage, type AnalysisResult } from "../lib/analyzer";

const MESSAGE_LIMIT = 2_000;

type IconName = "shield" | "scan" | "arrow" | "lock" | "alert" | "check";

function Icon({ name }: { name: IconName }) {
  const paths = {
    shield: <><path d="M12 3 20 6v5c0 5-3 8-8 10-5-2-8-5-8-10V6l8-3Z"/><path d="m9 12 2 2 4-4"/></>,
    scan: <><path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3M7 12h10"/></>,
    arrow: <><path d="M5 12h14M13 6l6 6-6 6"/></>,
    lock: <><rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 1 1 8 0v3"/></>,
    alert: <><path d="M10 4 3 17a2 2 0 0 0 2 3h14a2 2 0 0 0 2-3L14 4a2 2 0 0 0-4 0Z"/><path d="M12 9v4m0 3h.01"/></>,
    check: <path d="m5 12 4 4L19 6"/>,
  };

  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {paths[name]}
    </svg>
  );
}

function Header() {
  return (
    <header className="topbar">
      <a className="brand" href="#home" aria-label="ScamSense PH home">
        <span className="brand-mark"><Icon name="shield" /></span>
        <span><b>ScamSense <em>PH</em></b><small>Stay one step ahead</small></span>
      </a>
      <nav aria-label="Main navigation">
        <span><Icon name="lock" /> Analysis stays in your browser</span>
        <a href="#how">How it works <Icon name="arrow" /></a>
      </nav>
    </header>
  );
}

function AnalyzerForm({
  message,
  error,
  onMessageChange,
  onAnalyze,
  onClear,
}: {
  message: string;
  error: string;
  onMessageChange: (value: string) => void;
  onAnalyze: (event: FormEvent<HTMLFormElement>) => void;
  onClear: () => void;
}) {
  const isOverLimit = message.length > MESSAGE_LIMIT;

  return (
    <form className="card analyzer" onSubmit={onAnalyze} noValidate>
      <div className="card-top">
        <span className="eyebrow"><i /> MESSAGE CHECKER</span>
        <span className="private"><Icon name="lock" /> Checked on this device</span>
      </div>
      <h2>Got a suspicious message?</h2>
      <p className="muted">Paste it below. We’ll help you spot the warning signs.</p>
      <label htmlFor="message">Message to check</label>
      <textarea
        id="message"
        value={message}
        onChange={(event) => onMessageChange(event.target.value)}
        placeholder={'Paste a suspicious SMS, email, or chat message here…\n\nExample: “You won a prize! Click this link to claim it today.”'}
        aria-describedby={error ? "message-help character-count message-error" : "message-help character-count"}
        aria-invalid={Boolean(error)}
        aria-errormessage={error ? "message-error" : undefined}
      />
      <div className="textarea-meta">
        <span id="message-help" className="hint"><Icon name="lock" /> Message analysis happens locally in this browser.</span>
        <span id="character-count" className={isOverLimit ? "error" : "count"}>
          {message.length.toLocaleString()} / {MESSAGE_LIMIT.toLocaleString()} characters
        </span>
      </div>
      {error && <p className="error-message" id="message-error" role="alert" aria-live="assertive">{error}</p>}
      <div className="actions">
        <button className="primary" type="submit"><Icon name="scan" /> Analyze message <Icon name="arrow" /></button>
        <button className="secondary" type="button" onClick={onClear} disabled={!message && !error}>Clear</button>
      </div>
      <div className="types"><span>Works with</span><b>SMS</b><b>Email</b><b>Chat</b><span className="text-only">Text only · no files</span></div>
    </form>
  );
}

function ResultsPanel({ result }: { result: AnalysisResult | null }) {
  return (
    <section className="card results" aria-labelledby="results-title">
      <div className="results-head">
        <div><span className="eyebrow">YOUR RESULTS</span><h2 id="results-title">Message breakdown</h2></div>
        <span className="waiting" role="status" aria-live="polite">{result ? "Analysis complete" : "Waiting for a message"}</span>
      </div>
      {!result ? (
        <div className="empty">
          <div className="empty-icon"><Icon name="scan" /></div>
          <h3>Your results will appear here</h3>
          <p>Paste a message and run a check to see which warning signs these rules detect.</p>
          <span className="empty-steps">① Paste your message　→　② Review your results</span>
        </div>
      ) : (
        <div className="analysis-output">
          <div className={`risk ${result.warningSigns.length >= 3 ? "several" : result.warningSigns.length ? "some" : "none"}`}>
            <span className="risk-icon"><Icon name={result.warningSigns.length ? "alert" : "shield"} /></span>
            <div><b>{result.label}</b><p>{result.summary}</p></div>
          </div>
          <div className="result-section">
            <div className="section-head"><h3>Warning signs</h3><span>{result.warningSigns.length} detected</span></div>
            {result.warningSigns.length ? result.warningSigns.map((warning) => (
              <article className="warning" key={warning.id}>
                <span className="warning-symbol" aria-hidden="true">!</span>
                <div><b>{warning.title}</b><p>{warning.detail}</p><small>Matched text: “{warning.matchedText}”</small></div>
              </article>
            )) : (
              <div className="no-signs"><Icon name="check" /><div><b>No common warning signs found by these rules</b><p>A message may still be unsafe. Check the sender and context.</p></div></div>
            )}
          </div>
          <div className="result-section recommendations">
            <div className="section-head"><h3>What you can do</h3><span>Safety tips</span></div>
            <ul>{result.recommendations.map((tip) => <li key={tip}><Icon name="check" />{tip}</li>)}</ul>
          </div>
          <p className="disclaimer"><Icon name="alert" /> These heuristic indicators cannot establish whether a message is fraudulent or safe.</p>
        </div>
      )}
    </section>
  );
}

function HowItWorks() {
  const steps = [
    ["01", "Paste a message", "Use text from an SMS, email, or chat that feels off."],
    ["02", "We check the signals", "Simple, explainable rules look for common scam tactics."],
    ["03", "You choose what’s next", "Review the clues, then verify through official channels."],
  ];
  const signals = ["Urgency or pressure", "Contextual payment requests", "Unexpected prizes", "Password or code requests", "Links and web addresses"];

  return (
    <section id="how" className="how" aria-labelledby="how-title">
      <div className="how-title"><div><span className="eyebrow">SIMPLE. PRIVATE. TRANSPARENT.</span><h2 id="how-title">A little awareness goes a long way.</h2></div><p>Five quick checks. No uploads. See the clues behind each result.</p></div>
      <div className="how-grid">{steps.map(([number, title, description]) => <article key={number}><small>{number}</small><h3>{title}</h3><p>{description}</p></article>)}</div>
      <div className="signals"><b>What we look for</b><div>{signals.map((signal, index) => <span key={signal}><em>0{index + 1}</em> {signal}</span>)}</div></div>
      <p className="language-note">The Filipino and Taglish examples are limited and illustrative. They do not cover every phrase or regional variation.</p>
    </section>
  );
}

export default function Dashboard() {
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [result, setResult] = useState<AnalysisResult | null>(null);

  function handleMessageChange(value: string) {
    setMessage(value);
    setError("");
    setResult(null);
  }

  function handleAnalyze(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!message.trim()) {
      setError("Paste a message before analyzing it.");
      setResult(null);
      return;
    }
    if (message.length > MESSAGE_LIMIT) {
      setError(`This message is over the ${MESSAGE_LIMIT.toLocaleString()} character limit. Shorten it before analyzing; your text has not been changed.`);
      setResult(null);
      return;
    }
    setError("");
    setResult(analyzeMessage(message));
  }

  function handleClear() {
    setMessage("");
    setError("");
    setResult(null);
  }

  return (
    <main id="home">
      <Header />
      <section className="hero">
        <div>
          <span className="eyebrow">YOUR EVERYDAY SCAM CHECKER</span>
          <h1>Think before<br /><em>you click.</em></h1>
          <p>Spot the red flags in suspicious messages — before they catch you off guard.</p>
          <div className="trust"><span><Icon name="lock" /> Private by design</span><span><Icon name="check" /> Easy to understand</span><span><Icon name="check" /> Free to use</span></div>
        </div>
        <div className="hero-art" aria-hidden="true"><div className="rings" /><div className="big-shield"><Icon name="shield" /></div><span className="float-alert">!　Stay alert</span><span className="float-safe"><Icon name="lock" /> Links checked</span></div>
      </section>
      <section className="workspace" aria-labelledby="checker-title">
        <div className="workspace-heading"><div><span className="eyebrow">THE MESSAGE CHECKER</span><h2 id="checker-title">A second opinion, in seconds.</h2></div><span className="local"><i /> Checks happen on your device</span></div>
        <div className="grid">
          <AnalyzerForm message={message} error={error} onMessageChange={handleMessageChange} onAnalyze={handleAnalyze} onClear={handleClear} />
          <ResultsPanel result={result} />
        </div>
        <div className="privacy"><Icon name="lock" /><p><b>Your privacy matters.</b> Messages are analyzed locally in your browser and are not uploaded or stored by this app.</p><a href="#how">Learn how it works <Icon name="arrow" /></a></div>
      </section>
      <HowItWorks />
      <footer><b>⬡ ScamSense PH</b><span>Think before you click.</span><p>Made for awareness. Always verify through official channels.</p></footer>
    </main>
  );
}
