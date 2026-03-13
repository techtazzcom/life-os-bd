import { useState, useEffect } from "react";
import { ExternalLink } from "lucide-react";

const URL_REGEX = /(https?:\/\/[^\s<]+)/gi;

interface LinkMeta {
  url: string;
  title?: string;
  description?: string;
  image?: string;
  domain: string;
}

const extractUrls = (text: string): string[] => {
  return text.match(URL_REGEX) || [];
};

const LinkPreview = ({ content }: { content: string }) => {
  const [previews, setPreviews] = useState<LinkMeta[]>([]);

  useEffect(() => {
    const urls = extractUrls(content);
    if (urls.length === 0) return;

    // Take first 2 URLs only
    const uniqueUrls = [...new Set(urls)].slice(0, 2);
    
    uniqueUrls.forEach(url => {
      try {
        const domain = new URL(url).hostname.replace("www.", "");
        setPreviews(prev => {
          if (prev.find(p => p.url === url)) return prev;
          return [...prev, { url, domain, title: domain, description: url }];
        });
      } catch {
        // invalid URL
      }
    });
  }, [content]);

  if (previews.length === 0) return null;

  return (
    <div className="space-y-2 mt-2">
      {previews.map(preview => (
        <a
          key={preview.url}
          href={preview.url}
          target="_blank"
          rel="noopener noreferrer"
          className="block bg-secondary/60 border border-border rounded-xl overflow-hidden hover:bg-secondary transition group"
        >
          <div className="p-3 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <ExternalLink size={18} className="text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-black text-foreground truncate group-hover:text-primary transition">
                {preview.domain}
              </p>
              <p className="text-[11px] text-muted-foreground truncate">
                {preview.url}
              </p>
            </div>
          </div>
        </a>
      ))}
    </div>
  );
};

export { extractUrls };
export default LinkPreview;
