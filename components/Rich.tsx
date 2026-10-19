import { Fragment } from "react";

const TOKEN_RE = /(\*\*[^*]+\*\*|`[^`]+`|_[^_\s][^_]*_)/g;

/** Render minimal inline markup from dictionaries: **bold**, `code`, _em_. */
export default function Rich({ text }: { text: string }) {
  return (
    <>
      {text.split(TOKEN_RE).map((part, i) => {
        if (part.startsWith("**") && part.endsWith("**") && part.length > 4) return <strong key={i}>{part.slice(2, -2)}</strong>;
        if (part.startsWith("`") && part.endsWith("`") && part.length > 2)
          return (
            <code key={i} className="rounded bg-slate-100 px-1">
              {part.slice(1, -1)}
            </code>
          );
        if (part.startsWith("_") && part.endsWith("_") && part.length > 2) return <em key={i}>{part.slice(1, -1)}</em>;
        return <Fragment key={i}>{part}</Fragment>;
      })}
    </>
  );
}
