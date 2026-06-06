import { useState } from "react";

export default function SkeletonImg({
  src,
  alt,
  className,
}: {
  src: string;
  alt: string;
  className?: string;
}) {
  const [loaded, setLoaded] = useState(false);
  return (
    <div className="relative w-full h-full">
      {!loaded && <div className="skeleton absolute inset-0 rounded-inherit" />}
      <img
        src={src}
        alt={alt}
        className={className}
        style={{ opacity: loaded ? 1 : 0, transition: "opacity 0.4s ease" }}
        onLoad={() => setLoaded(true)}
      />
    </div>
  );
}
