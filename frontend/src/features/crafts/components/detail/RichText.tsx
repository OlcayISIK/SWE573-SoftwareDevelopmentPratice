/**
 * Shows a description or story as paragraphs. A paragraph whose first line is a short title,
 * such as "How to understand it", gets that line as a small heading.
 */
export function RichText({ text, className = "" }: { text: string; className?: string }) {
  const paragraphs = text.split(/\n{2,}/).filter((part) => part.trim());
  return (
    <div className={`space-y-4 leading-relaxed text-stone-800 ${className}`}>
      {paragraphs.map((paragraph, index) => {
        const [first, ...rest] = paragraph.split("\n");
        const titled = rest.length > 0 && first.length <= 40 && !/[.!?:]$/.test(first.trim());
        return titled ? (
          <div key={index}>
            <h3 className="font-sans text-sm font-semibold uppercase tracking-wider text-lagoon">
              {first}
            </h3>
            <p className="mt-1 whitespace-pre-line">{rest.join("\n")}</p>
          </div>
        ) : (
          <p key={index} className="whitespace-pre-line">
            {paragraph}
          </p>
        );
      })}
    </div>
  );
}
