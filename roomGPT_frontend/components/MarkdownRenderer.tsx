"use client";

import React from "react";

interface MarkdownRendererProps {
  content: string;
}

function renderInline(text: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  const pattern = /(\*\*[^*]+\*\*|`[^`]+`|\*[^*]+\*)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }

    const token = match[0];
    if (token.startsWith("**") && token.endsWith("**")) {
      nodes.push(<strong key={`${match.index}-bold`}>{token.slice(2, -2)}</strong>);
    } else if (token.startsWith("`") && token.endsWith("`")) {
      nodes.push(
        <code
          key={`${match.index}-code`}
          className="rounded bg-[#F3EEE5] px-1.5 py-0.5 text-[0.95em] text-[#6C5533]"
        >
          {token.slice(1, -1)}
        </code>
      );
    } else if (token.startsWith("*") && token.endsWith("*")) {
      nodes.push(<em key={`${match.index}-italic`}>{token.slice(1, -1)}</em>);
    }

    lastIndex = pattern.lastIndex;
  }

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }

  return nodes;
}

function normalizeLines(rawContent: string): string[] {
  const rawLines = rawContent.replace(/\r\n/g, "\n").split("\n");
  const expanded: string[] = [];

  rawLines.forEach((line) => {
    const trimmed = line.trim();
    if (trimmed.includes("||") && trimmed.includes("|") && trimmed.split("|").length >= 6) {
      const parts = trimmed
        .split("||")
        .map((part) => part.trim())
        .filter(Boolean);
      if (parts.length > 1) {
        parts.forEach((part) => expanded.push(part.startsWith("|") ? part : `| ${part}`));
        return;
      }
    }
    expanded.push(line);
  });

  return expanded;
}

function isTableSeparatorRow(line: string): boolean {
  const cleaned = line.trim().replace(/^\|/, "").replace(/\|$/, "");
  if (!cleaned) return false;
  return cleaned
    .split("|")
    .map((cell) => cell.trim())
    .every((cell) => /^:?-{3,}:?$/.test(cell));
}

function parseTableRow(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim());
}

function isTableCandidate(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed.includes("|")) return false;
  const pipeCount = (trimmed.match(/\|/g) || []).length;
  return pipeCount >= 2;
}

export default function MarkdownRenderer({ content }: MarkdownRendererProps) {
  const lines = normalizeLines(content);
  const elements: React.ReactNode[] = [];
  let paragraphBuffer: string[] = [];
  let listBuffer: { type: "ul" | "ol"; items: string[] } | null = null;
  let tableBuffer: string[] = [];
  let codeBuffer: string[] = [];
  let inCodeBlock = false;

  const flushParagraph = () => {
    if (!paragraphBuffer.length) return;
    const text = paragraphBuffer.join(" ");
    elements.push(
      <p key={`p-${elements.length}`} className="mb-3 break-words [overflow-wrap:anywhere] leading-7">
        {renderInline(text)}
      </p>
    );
    paragraphBuffer = [];
  };

  const flushList = () => {
    if (!listBuffer) return;
    const Tag = listBuffer.type;
    elements.push(
      <Tag
        key={`list-${elements.length}`}
        className={`mb-3 pl-5 break-words [overflow-wrap:anywhere] leading-7 ${Tag === "ul" ? "list-disc" : "list-decimal"}`}
      >
        {listBuffer.items.map((item, index) => (
          <li key={`${Tag}-${index}`} className="break-words [overflow-wrap:anywhere]">
            {renderInline(item)}
          </li>
        ))}
      </Tag>
    );
    listBuffer = null;
  };

  const flushTable = () => {
    if (!tableBuffer.length) return;
    const rows = tableBuffer.map(parseTableRow);
    if (!rows.length) {
      tableBuffer = [];
      return;
    }

    const hasSeparator = tableBuffer.length > 1 && isTableSeparatorRow(tableBuffer[1]);
    const header = rows[0] || [];
    const bodyRows = hasSeparator ? rows.slice(2) : rows.slice(1);

    elements.push(
      <div key={`table-${elements.length}`} className="mb-3 overflow-x-auto rounded-xl border border-[#8B6F47]/15">
        <table className="min-w-full border-collapse text-sm">
          <thead className="bg-[#F7F1E7] text-[#2D2D2D]">
            <tr>
              {header.map((cell, index) => (
                <th key={`h-${index}`} className="border border-[#8B6F47]/15 px-3 py-2 text-left font-semibold">
                  {renderInline(cell)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white/70">
            {bodyRows.map((row, rowIndex) => (
              <tr key={`r-${rowIndex}`}>
                {row.map((cell, cellIndex) => (
                  <td key={`c-${rowIndex}-${cellIndex}`} className="border border-[#8B6F47]/15 px-3 py-2 align-top">
                    {renderInline(cell)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );

    tableBuffer = [];
  };

  const flushCode = () => {
    if (!codeBuffer.length) return;
    elements.push(
      <pre
        key={`code-${elements.length}`}
        className="mb-3 overflow-x-auto rounded-xl bg-[#2A241F] px-4 py-3 text-sm text-[#F6F1E8]"
      >
        <code>{codeBuffer.join("\n")}</code>
      </pre>
    );
    codeBuffer = [];
  };

  lines.forEach((line) => {
    if (line.trim().startsWith("```")) {
      flushParagraph();
      flushList();
      flushTable();
      if (inCodeBlock) {
        flushCode();
      }
      inCodeBlock = !inCodeBlock;
      return;
    }

    if (inCodeBlock) {
      codeBuffer.push(line);
      return;
    }

    const trimmed = line.trim();
    if (!trimmed) {
      flushParagraph();
      flushList();
      flushTable();
      return;
    }

    if (isTableCandidate(trimmed)) {
      flushParagraph();
      flushList();
      tableBuffer.push(trimmed);
      return;
    }

    flushTable();

    const headingMatch = trimmed.match(/^(#{1,3})\s+(.*)$/);
    if (headingMatch) {
      flushParagraph();
      flushList();
      const level = headingMatch[1].length;
      const HeadingTag = `h${level}` as keyof JSX.IntrinsicElements;
      const className =
        level === 1
          ? "mb-3 mt-2 text-2xl font-semibold"
          : level === 2
          ? "mb-3 mt-2 text-xl font-semibold"
          : "mb-2 mt-2 text-lg font-semibold";
      elements.push(
        <HeadingTag key={`h-${elements.length}`} className={className}>
          {renderInline(headingMatch[2])}
        </HeadingTag>
      );
      return;
    }

    const quoteMatch = trimmed.match(/^>\s?(.*)$/);
    if (quoteMatch) {
      flushParagraph();
      flushList();
      elements.push(
        <blockquote
          key={`quote-${elements.length}`}
          className="mb-3 break-words [overflow-wrap:anywhere] border-l-4 border-[#C8B28B] bg-[#FAF6EF] px-4 py-2 italic text-[#6B6459]"
        >
          {renderInline(quoteMatch[1])}
        </blockquote>
      );
      return;
    }

    const unorderedMatch = trimmed.match(/^[-*]\s+(.*)$/);
    const orderedMatch = trimmed.match(/^\d+\.\s+(.*)$/);
    if (unorderedMatch || orderedMatch) {
      flushParagraph();
      const nextType = unorderedMatch ? "ul" : "ol";
      const item = (unorderedMatch || orderedMatch)![1];
      if (!listBuffer || listBuffer.type !== nextType) {
        flushList();
        listBuffer = { type: nextType, items: [] };
      }
      listBuffer.items.push(item);
      return;
    }

    flushList();
    paragraphBuffer.push(trimmed);
  });

  flushParagraph();
  flushList();
  flushTable();
  if (inCodeBlock) {
    flushCode();
  }

  return <div className="markdown-content min-w-0 text-sm [overflow-wrap:anywhere] sm:text-base">{elements}</div>;
}

