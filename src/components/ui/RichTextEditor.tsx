import { cn } from "@/utils/cn";

/** Render stored rich-text HTML read-only (matches BlockEditor output). */
export function RichText({ html, className }: { html: string; className?: string }) {
  return (
    <div
      className={cn(
        "rich-text text-[14px] leading-relaxed text-[#111] dark:text-white",
        "[&_h1]:text-xl [&_h1]:font-bold [&_h1]:mb-2 [&_h2]:text-lg [&_h2]:font-bold [&_h2]:mb-2 [&_h3]:text-base [&_h3]:font-bold [&_h3]:mb-2",
        "[&_p]:mb-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:mb-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:mb-2",
        "[&_a]:text-primary [&_a]:underline [&_strong]:font-semibold",
        className
      )}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

/** Strip tags for short text previews. */
export function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}
