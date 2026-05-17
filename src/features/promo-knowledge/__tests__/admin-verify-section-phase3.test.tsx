/**
 * Phase 3 — AdminVerifySection / AdminDecisionsRenderer tests.
 *
 * Pure renderToString tests (vitest node env). No RTL needed.
 */

import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { AdminDecisionsRenderer } from "../admin-verify/AdminDecisionsRenderer";
import type {
  AdminDecision,
  AdminReviewerError,
} from "../admin-verify/admin-decision-types";

// Phase 4: button label is "Terapkan Jawaban" — "JSON" is now forbidden too.
const FORBIDDEN_TECHNICAL_TERMS = [
  "field_path",
  "schema",
  "engine",
  "severity",
  "flags",
  "source_text",
  "warning",
  "ambiguity",
  "contradiction",
  "json",
];

function assertNoTechnicalTerms(html: string) {
  for (const term of FORBIDDEN_TECHNICAL_TERMS) {
    expect(
      html.toLowerCase().includes(term.toLowerCase()),
      `Rendered output must not contain forbidden technical term "${term}"`,
    ).toBe(false);
  }
}

const sampleDecision: AdminDecision = {
  id: "dec-1",
  decision_type: "contradiction",
  title: "Nilai bonus berbeda antar bagian",
  explanation: "Sistem menemukan dua nilai bonus yang berbeda di teks promo.",
  question: "Nilai bonus mana yang benar?",
  options: [
    { label: "Rp 100.000", value: "100k" },
    { label: "Rp 150.000", value: "150k" },
  ],
  manual_note_enabled: true,
  related_signal_indices: {
    warnings: [],
    ambiguity_flags: [],
    contradiction_flags: [0],
  },
};

describe("AdminDecisionsRenderer — state machine", () => {
  it("idle → renders nothing", () => {
    const html = renderToStaticMarkup(
      <AdminDecisionsRenderer
        state="idle"
        decisions={[]}
        error={null}
        onRetry={() => {}}
      />,
    );
    expect(html).toBe("");
  });

  it("empty → 'Tidak ada verifikasi tambahan'", () => {
    const html = renderToStaticMarkup(
      <AdminDecisionsRenderer
        state="empty"
        decisions={[]}
        error={null}
        onRetry={() => {}}
      />,
    );
    expect(html).toContain("Tidak ada verifikasi tambahan");
    assertNoTechnicalTerms(html);
  });

  it("loading → reviewer sedang menyusun pertanyaan", () => {
    const html = renderToStaticMarkup(
      <AdminDecisionsRenderer
        state="loading"
        decisions={[]}
        error={null}
        onRetry={() => {}}
      />,
    );
    expect(html).toContain("Reviewer sedang menyusun pertanyaan");
    assertNoTechnicalTerms(html);
  });

  it("error → blocking banner with retry button", () => {
    const err: AdminReviewerError = {
      ok: false,
      error: "REVIEWER_FAILED",
      message: "Reviewer gagal membuat pertanyaan. Coba ulang.",
    };
    const html = renderToStaticMarkup(
      <AdminDecisionsRenderer
        state="error"
        decisions={[]}
        error={err}
        onRetry={() => {}}
      />,
    );
    expect(html).toContain("Reviewer gagal membuat pertanyaan");
    expect(html).toContain("Coba ulang");
    assertNoTechnicalTerms(html);
  });

  it("ready with 1 decision → 1 card with title, explanation, question, options", () => {
    const html = renderToStaticMarkup(
      <AdminDecisionsRenderer
        state="ready"
        decisions={[sampleDecision]}
        error={null}
        onRetry={() => {}}
      />,
    );
    expect(html).toContain(sampleDecision.title);
    expect(html).toContain(sampleDecision.explanation);
    expect(html).toContain(sampleDecision.question);
    expect(html).toContain("Rp 100.000");
    expect(html).toContain("Rp 150.000");
    expect(html).toContain("Terapkan Semua Jawaban");
    expect(html).not.toContain("JSON");
    // Global button only — must not appear per-card.
    const matches = html.match(/Terapkan Semua Jawaban/g) ?? [];
    expect(matches.length).toBe(1);
    expect(html).not.toContain(">Terapkan Jawaban<");
  });

  it("ready with 3 decisions → still exactly 1 global apply button", () => {
    const decisions = [1, 2, 3].map((i) => ({
      ...sampleDecision,
      id: `dec-${i}`,
      title: `Pertanyaan ${i}`,
    }));
    const html = renderToStaticMarkup(
      <AdminDecisionsRenderer
        state="ready"
        decisions={decisions}
        error={null}
        onRetry={() => {}}
      />,
    );
    const matches = html.match(/Terapkan Semua Jawaban/g) ?? [];
    expect(matches.length).toBe(1);
  });

  it("ready cards must not contain technical terms in non-content chrome", () => {
    // Use a decision whose own copy avoids the forbidden vocab.
    const safe: AdminDecision = {
      ...sampleDecision,
      title: "Nilai bonus berbeda antar bagian",
      explanation: "Sistem menemukan dua nilai bonus yang berbeda.",
      question: "Nilai bonus mana yang benar?",
    };
    const html = renderToStaticMarkup(
      <AdminDecisionsRenderer
        state="ready"
        decisions={[safe]}
        error={null}
        onRetry={() => {}}
      />,
    );
    assertNoTechnicalTerms(html);
  });
});

describe("AdminVerifySection — legacy runtime imports removed", () => {
  const src = readFileSync(
    resolve(
      __dirname,
      "..",
      "admin-verify",
      "AdminVerifySection.tsx",
    ),
    "utf8",
  );

  const forbiddenImports = [
    "buildIssueQuestions",
    "buildF3ComplianceQuestions",
    "dedupIssueQuestions",
    "humanizeIssue",
    "ExtractorIssueCard",
    "readGapsFromJson",
    "extractor-issue-adapter",
    "f3-compliance-adapter",
    "gap-reader",
    "field-registry",
    "deterministic-apply",
    "enum-normalizer",
    "admin-answer-llm-resolver",
  ];

  for (const token of forbiddenImports) {
    it(`must not reference legacy token "${token}"`, () => {
      expect(src.includes(token)).toBe(false);
    });
  }
});
