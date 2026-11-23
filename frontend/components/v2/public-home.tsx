"use client";

import Link from "next/link";
import { Building2, CheckCircle2, FileSearch, Files, ShieldCheck, Users } from "lucide-react";
import { AnimatedGarmentFactory } from "./animated-garment-factory";
import { ThemeToggle } from "./theme-toggle";
import { useAuth } from "./auth-provider";

const steps = ["Upload documents", "Analyze evidence", "Review findings", "Track resolution"];

export function PublicHome() {
  const { state } = useAuth();
  const authenticated = state === "authenticated";
  return (
    <main className="v2-page public-home">
      <header className="public-header v2-container">
        <Link href="/" className="public-brand" aria-label="SafetyProof AI home">
          <span><ShieldCheck aria-hidden="true" /></span>
          <strong>SafetyProof <em>AI</em></strong>
        </Link>
        <nav aria-label="Public navigation">
          <a href="#how-it-works">How it works</a>
          <a href="#features">Features</a>
          <a href="#roles">Roles</a>
        </nav>
        <div className="public-actions">
          <ThemeToggle />
          <Link className="v2-button secondary" href={authenticated ? "/dashboard" : "/login"}>
            {authenticated ? "Dashboard" : "Sign in"}
          </Link>
        </div>
      </header>

      <section className="public-hero v2-container">
        <div className="hero-factory">
          <AnimatedGarmentFactory />
        </div>
        <div className="hero-copy">
          <span className="v2-eyebrow">Documentary safety evidence</span>
          <h1>Turn Safety Documents into Verifiable Evidence</h1>
          <p>SafetyProof AI organizes workplace-safety records for garment factories, links findings to source citations, and keeps human reviewers in control.</p>
          <div className="hero-actions">
            <Link className="v2-button" href={authenticated ? "/dashboard" : "/login"}>Get started</Link>
            <a className="v2-button secondary" href="#about">Learn more</a>
          </div>
          <p className="hero-caveat"><ShieldCheck aria-hidden="true" /> AI assistance supports documentary review; it does not replace professional inspection or certify factory safety.</p>
        </div>
      </section>

      <section id="about" className="public-section v2-container about-grid">
        <div>
          <span className="v2-eyebrow">What is SafetyProof AI?</span>
          <h2>A traceable workspace for evidence-backed review</h2>
        </div>
        <p>Authorized factory personnel and independent reviewers can organize inspection records, compare claims with supporting documents, inspect exact source pages, and track corrective work through the existing application.</p>
      </section>

      <section id="how-it-works" className="public-section v2-container">
        <div className="section-heading"><span className="v2-eyebrow">How it works</span><h2>From document to reviewed finding</h2></div>
        <div className="process-grid">
          {steps.map((step, index) => (
            <article className="v2-card process-card" key={step}>
              <span>{index + 1}</span><strong>{step}</strong>
            </article>
          ))}
        </div>
      </section>

      <section id="features" className="public-section v2-container">
        <div className="section-heading"><span className="v2-eyebrow">Main features</span><h2>Evidence stays connected to its source</h2></div>
        <div className="feature-grid">
          {[
            [Files, "Document workspace", "Upload and organize authorized inspection, incident, procedure, maintenance, and corrective-action records."],
            [FileSearch, "Source-cited findings", "Review evidence with document names, quoted passages, page numbers, and validated citation locations."],
            [CheckCircle2, "Human review", "Confirm, reject, or follow up on findings through the existing reviewer workflow."],
            [Building2, "Factory-scoped access", "Keep cases and evidence within the role and factory permissions enforced by the backend."],
          ].map(([Icon, title, description]) => {
            const FeatureIcon = Icon as typeof Files;
            return <article className="v2-card feature-card" key={String(title)}><FeatureIcon aria-hidden="true" /><h3>{String(title)}</h3><p>{String(description)}</p></article>;
          })}
        </div>
      </section>

      <section id="roles" className="public-section v2-container roles-section">
        <div className="section-heading"><span className="v2-eyebrow">User roles</span><h2>One evidence chain, role-appropriate tools</h2></div>
        <div className="roles-grid">
          <article><Users /><div><strong>Reviewers and auditors</strong><p>Assess cases, inspect citations, review findings, and coordinate corrective work.</p></div></article>
          <article><Building2 /><div><strong>Factory managers</strong><p>Access assigned factory cases, documents, inspection notices, and corrective tasks.</p></div></article>
          <article><ShieldCheck /><div><strong>Administrators</strong><p>Manage factories, account access, assignments, applications, and scheduled inspections.</p></div></article>
        </div>
      </section>

      <section className="public-section v2-container getting-started v2-card">
        <div><span className="v2-eyebrow">Getting started</span><h2>Continue with your authorized SafetyProof account</h2><p>Sign in to reach the analytics dashboard and the workflows permitted for your role.</p></div>
        <Link className="v2-button" href={authenticated ? "/dashboard" : "/login"}>{authenticated ? "Open dashboard" : "Sign in securely"}</Link>
      </section>

      <footer className="public-footer v2-container"><span>SafetyProof AI</span><span>Documentary evidence review · CoU AI Hackathon 2026</span></footer>
    </main>
  );
}
