import { useEffect, useState } from "react";

export default function TokenAvatar({ token, size = 44, className = "" }) {
  const [from, to] = token.gradient;
  const [imgFailed, setImgFailed] = useState(false);

  // Reset the failure flag when the image itself changes — otherwise
  // switching between tokens (this component instance gets reused, not
  // remounted) could get stuck showing the gradient fallback for a
  // DIFFERENT token that actually has a perfectly good image.
  useEffect(() => {
    setImgFailed(false);
  }, [token.imageUrl]);

  const wrapperStyle =
    size === "100%" ? { width: "100%", height: "100%" } : { width: size, height: size };

  return (
    // Self-contained positioning context — the img/gradient inside always
    // uses `absolute inset-0`, so this always renders correctly regardless
    // of the caller's own layout (a plain flex row, a `relative` square
    // wrapper, whatever). Previously the img branch assumed the CALLER
    // was already `position: relative` with the right size — true for
    // TokenCard (`relative w-full aspect-square`), but not for
    // TokenDetailPage's plain `flex items-center` row, which is exactly
    // why the image flew off to a corner of the page there: with no
    // `relative` ancestor nearby, `absolute inset-0` fell back to
    // positioning against the viewport instead.
    <div className="relative shrink-0" style={wrapperStyle}>
      {token.imageUrl && !imgFailed ? (
        <img
          src={token.imageUrl}
          alt={token.name || token.symbol}
          onError={() => setImgFailed(true)}
          className={`absolute inset-0 w-full h-full object-cover rounded-2xl ${className}`}
        />
      ) : (
        <div
          className={`absolute inset-0 flex items-center justify-center rounded-2xl font-display font-semibold text-white ${className}`}
          style={{
            fontSize: typeof size === "number" ? size * 0.34 : "1.5rem",
            background: `linear-gradient(135deg, ${from}, ${to})`,
          }}
          aria-hidden="true"
        >
          {token.symbol.slice(0, 2)}
        </div>
      )}
    </div>
  );
}
