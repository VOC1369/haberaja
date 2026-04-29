/**
 * MINI MARKDOWN
 *
 * Renderer markdown ringan tanpa dependency. Hanya support subset yang
 * dipakai oleh polishLevel2:
 *   - ## Heading 2
 *   - **bold** (inline)
 *   - "- " unordered list
 *   - "1. " numbered list (preserved as-is, rendered as plain line — kita
 *     tidak rewrite numbering supaya pantulan parser tetap utuh)
 *   - paragraph + line break
 *
 * Tidak menggunakan dangerouslySetInnerHTML — semua via React nodes.
 */

import { Fragment } from "react";

function renderInline(text: string, keyPrefix: string): React.ReactNode[] {
  // Split by **bold** keeping delimiters
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (/^\*\*[^*]+\*\*$/.test(part)) {
      return (
        <strong key={`${keyPrefix}-b-${i}`} className="font-semibold text-foreground">
          {part.slice(2, -2)}
        </strong>
      );
    }
    return <Fragment key={`${keyPrefix}-t-${i}`}>{part}</Fragment>;
  });
}

interface Block {
  kind: "h2" | "ul" | "p" | "blank";
  lines: string[];
}

function tokenize(text: string): Block[] {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const blocks: Block[] = [];
  let buf: Block | null = null;

  const flush = () => {
    if (buf) blocks.push(buf);
    buf = null;
  };

  for (const raw of lines) {
    const line = raw;
    const trimmed = line.trim();

    if (trimmed === "") {
      flush();
      continue;
    }

    if (/^##\s+/.test(trimmed)) {
      flush();
      blocks.push({ kind: "h2", lines: [trimmed.replace(/^##\s+/, "")] });
      continue;
    }

    if (/^[-*]\s+/.test(trimmed)) {
      const item = trimmed.replace(/^[-*]\s+/, "");
      if (buf && buf.kind === "ul") {
        buf.lines.push(item);
      } else {
        flush();
        buf = { kind: "ul", lines: [item] };
      }
      continue;
    }

    // paragraph
    if (buf && buf.kind === "p") {
      buf.lines.push(line);
    } else {
      flush();
      buf = { kind: "p", lines: [line] };
    }
  }
  flush();
  return blocks;
}

interface MiniMarkdownProps {
  text: string;
  className?: string;
}

export function MiniMarkdown({ text, className }: MiniMarkdownProps) {
  const blocks = tokenize(text);
  return (
    <div className={className}>
      {blocks.map((b, i) => {
        const key = `mb-${i}`;
        if (b.kind === "h2") {
          return (
            <h2
              key={key}
              className="mt-5 mb-2 text-base font-bold tracking-wide text-button-hover uppercase"
            >
              {renderInline(b.lines[0], key)}
            </h2>
          );
        }
        if (b.kind === "ul") {
          return (
            <ul key={key} className="my-2 ml-5 list-disc space-y-1">
              {b.lines.map((item, j) => (
                <li key={`${key}-li-${j}`} className="leading-relaxed">
                  {renderInline(item, `${key}-${j}`)}
                </li>
              ))}
            </ul>
          );
        }
        // paragraph — preserve internal line breaks
        return (
          <p key={key} className="my-2 leading-relaxed whitespace-pre-wrap break-words">
            {b.lines.map((ln, j) => (
              <Fragment key={`${key}-l-${j}`}>
                {renderInline(ln, `${key}-${j}`)}
                {j < b.lines.length - 1 ? <br /> : null}
              </Fragment>
            ))}
          </p>
        );
      })}
    </div>
  );
}
