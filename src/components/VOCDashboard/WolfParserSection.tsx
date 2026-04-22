/**
 * WolfParserSection — V0.9
 *
 * UI flow 5 langkah (per doc):
 *   1. Paste raw promo text
 *   2. Klik "Parse" → runWolfParser
 *   3. Render gaps[] sebagai pertanyaan
 *   4. Operator jawab → applyOperatorAnswers
 *   5. Tampilkan clean_text + parser_json final
 *
 * Output PERSIS V0.9. Tidak menyentuh extractor / canonical.
 */

import { useState, useMemo } from "react";
import {
  FileSearch,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Copy,
  RotateCcw,
  ArrowRight,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  RadioGroup,
  RadioGroupItem,
} from "@/components/ui/radio-group";
import { toast } from "@/lib/notify";

import {
  runWolfParser,
  applyOperatorAnswers,
} from "@/lib/parsers/wolf-parser";
import type {
  ParserOutput,
  OperatorAnswer,
} from "@/lib/parsers/wolf-parser-types";
import {
  AICreditsExhaustedError,
  AIRateLimitError,
  AIOverloadedError,
} from "@/lib/ai-client";

type Stage = "input" | "questions" | "final";

export function WolfParserSection() {
  const [rawText, setRawText] = useState("");
  const [stage, setStage] = useState<Stage>("input");
  const [parserOutput, setParserOutput] = useState<ParserOutput | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  const gapsCount = parserOutput?.gaps.length ?? 0;
  const confidence = parserOutput?.parsed_promo.parse_confidence ?? null;

  const allAnswered = useMemo(() => {
    if (!parserOutput) return false;
    return parserOutput.gaps.every(
      (g) => (answers[g.field] ?? "").trim().length > 0,
    );
  }, [parserOutput, answers]);

  function handleReset() {
    setRawText("");
    setStage("input");
    setParserOutput(null);
    setAnswers({});
  }

  async function handleParse() {
    if (!rawText.trim()) {
      toast.warning("Raw promo kosong", {
        description: "Paste teks promo terlebih dahulu.",
      });
      return;
    }
    setLoading(true);
    try {
      const result = await runWolfParser(rawText);
      setParserOutput(result);
      setAnswers({});
      setStage(result.gaps.length > 0 ? "questions" : "final");
      toast.success("Parser selesai", {
        description: `${result.gaps.length} gap ditemukan.`,
      });
    } catch (err) {
      handleAIError(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmitAnswers() {
    if (!parserOutput) return;
    const payload: OperatorAnswer[] = parserOutput.gaps
      .map((g) => ({
        field: g.field,
        value: (answers[g.field] ?? "").trim(),
      }))
      .filter((a) => a.value.length > 0);

    if (!payload.length) {
      toast.warning("Belum ada jawaban", {
        description: "Isi minimal satu pertanyaan.",
      });
      return;
    }

    setLoading(true);
    try {
      const result = await applyOperatorAnswers(parserOutput, payload, rawText);
      setParserOutput(result);
      if (result.gaps.length === 0) {
        setStage("final");
        toast.success("Parser final", {
          description: "Semua gap terjawab.",
        });
      } else {
        setAnswers({});
        toast.info("Masih ada gap", {
          description: `${result.gaps.length} pertanyaan tersisa.`,
        });
      }
    } catch (err) {
      handleAIError(err);
    } finally {
      setLoading(false);
    }
  }

  function handleCopyJSON() {
    if (!parserOutput) return;
    navigator.clipboard.writeText(JSON.stringify(parserOutput, null, 2));
    toast.success("parser_json disalin");
  }

  function handleCopyCleanText() {
    if (!parserOutput) return;
    navigator.clipboard.writeText(parserOutput.parsed_promo.clean_text);
    toast.success("clean_text disalin");
  }

  return (
    <div className="space-y-6">
      <Header stage={stage} gapsCount={gapsCount} confidence={confidence} />

      {/* STEP 1 — INPUT */}
      {stage === "input" && (
        <Card className="p-6 space-y-4">
          <div>
            <Label htmlFor="raw-promo" className="text-sm font-medium">
              Raw Promo Text
            </Label>
            <p className="text-xs text-muted-foreground mt-1">
              Paste teks promo apa adanya. Parser akan ekstrak fakta eksplisit
              dan menanyakan field yang tidak jelas.
            </p>
          </div>
          <Textarea
            id="raw-promo"
            value={rawText}
            onChange={(e) => setRawText(e.target.value)}
            placeholder="Contoh: Bonus deposit 10% min depo 100rb max 2jt TO 8x slot only"
            className="min-h-[200px] font-mono text-sm"
            disabled={loading}
          />
          <div className="flex justify-end gap-2">
            <Button
              variant="ghost"
              onClick={handleReset}
              disabled={loading || !rawText}
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              Reset
            </Button>
            <Button onClick={handleParse} disabled={loading || !rawText.trim()}>
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Parsing...
                </>
              ) : (
                <>
                  <FileSearch className="h-4 w-4 mr-2" />
                  Parse
                </>
              )}
            </Button>
          </div>
        </Card>
      )}

      {/* STEP 2 — QUESTIONS */}
      {stage === "questions" && parserOutput && (
        <Card className="p-6 space-y-6">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-warning" />
            <h3 className="font-semibold">
              {parserOutput.gaps.length} pertanyaan untuk operator
            </h3>
          </div>

          <div className="space-y-5">
            {parserOutput.gaps.map((gap) => (
              <div
                key={gap.field}
                className="space-y-2 pb-4 border-b last:border-b-0"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <code className="text-xs px-1.5 py-0.5 bg-muted rounded">
                        {gap.field}
                      </code>
                      <Badge
                        variant={
                          gap.gap_type === "required_missing"
                            ? "destructive"
                            : gap.gap_type === "ambiguous"
                              ? "secondary"
                              : "outline"
                        }
                        className="text-[10px]"
                      >
                        {gap.gap_type}
                      </Badge>
                    </div>
                    <p className="text-sm">{gap.question}</p>
                  </div>
                </div>

                {gap.options.length > 0 ? (
                  <RadioGroup
                    value={answers[gap.field] ?? ""}
                    onValueChange={(v) =>
                      setAnswers((prev) => ({ ...prev, [gap.field]: v }))
                    }
                    className="flex flex-wrap gap-3 pt-1"
                  >
                    {gap.options.map((opt) => (
                      <div key={opt} className="flex items-center gap-2">
                        <RadioGroupItem
                          value={opt}
                          id={`${gap.field}-${opt}`}
                        />
                        <Label
                          htmlFor={`${gap.field}-${opt}`}
                          className="text-sm cursor-pointer"
                        >
                          {opt}
                        </Label>
                      </div>
                    ))}
                  </RadioGroup>
                ) : (
                  <Input
                    value={answers[gap.field] ?? ""}
                    onChange={(e) =>
                      setAnswers((prev) => ({
                        ...prev,
                        [gap.field]: e.target.value,
                      }))
                    }
                    placeholder="Jawaban operator..."
                    className="text-sm"
                  />
                )}
              </div>
            ))}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={handleReset} disabled={loading}>
              <RotateCcw className="h-4 w-4 mr-2" />
              Mulai Ulang
            </Button>
            <Button
              onClick={handleSubmitAnswers}
              disabled={loading || !allAnswered}
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Memproses...
                </>
              ) : (
                <>
                  Submit Jawaban
                  <ArrowRight className="h-4 w-4 ml-2" />
                </>
              )}
            </Button>
          </div>
        </Card>
      )}

      {/* STEP 3 — FINAL OUTPUT */}
      {stage === "final" && parserOutput && (
        <div className="space-y-4">
          <Card className="p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-success" />
                <h3 className="font-semibold">Output #1 — clean_text</h3>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopyCleanText}
              >
                <Copy className="h-3.5 w-3.5 mr-1.5" />
                Copy
              </Button>
            </div>
            <pre className="text-sm bg-muted/50 p-4 rounded whitespace-pre-wrap break-words font-mono">
              {parserOutput.parsed_promo.clean_text || "(kosong)"}
            </pre>
          </Card>

          <Card className="p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-success" />
                <h3 className="font-semibold">Output #2 — parser_json</h3>
                <Badge variant="outline" className="text-[10px]">
                  schema_version 0.9
                </Badge>
              </div>
              <Button variant="outline" size="sm" onClick={handleCopyJSON}>
                <Copy className="h-3.5 w-3.5 mr-1.5" />
                Copy
              </Button>
            </div>
            <pre className="text-xs bg-muted/50 p-4 rounded overflow-x-auto font-mono max-h-[600px]">
              {JSON.stringify(parserOutput, null, 2)}
            </pre>
          </Card>

          <div className="flex justify-end">
            <Button variant="outline" onClick={handleReset}>
              <RotateCcw className="h-4 w-4 mr-2" />
              Parse Promo Baru
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────

function Header({
  stage,
  gapsCount,
  confidence,
}: {
  stage: Stage;
  gapsCount: number;
  confidence: number | null;
}) {
  const stageLabel: Record<Stage, string> = {
    input: "Step 1 — Paste Raw Promo",
    questions: "Step 2 — Operator Q&A",
    final: "Step 3 — Final Output",
  };

  return (
    <div className="flex items-center justify-between">
      <div>
        <h2 className="text-2xl font-bold">Wolf Parser</h2>
        <p className="text-sm text-muted-foreground">
          Tahap 1 — Liveboard V0.9 · {stageLabel[stage]}
        </p>
      </div>
      <div className="flex items-center gap-2">
        {confidence !== null && (
          <Badge variant="outline" className="text-xs">
            confidence: {(confidence * 100).toFixed(0)}%
          </Badge>
        )}
        {stage !== "input" && (
          <Badge variant="secondary" className="text-xs">
            {gapsCount} gap{gapsCount === 1 ? "" : "s"}
          </Badge>
        )}
      </div>
    </div>
  );
}

function handleAIError(err: unknown) {
  if (
    err instanceof AICreditsExhaustedError ||
    err instanceof AIRateLimitError ||
    err instanceof AIOverloadedError
  ) {
    // Toast already fired in callAI.
    return;
  }
  const msg = err instanceof Error ? err.message : "Gagal memproses parser.";
  toast.error("Parser error", { description: msg });
}
