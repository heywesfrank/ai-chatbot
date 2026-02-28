// app/widget/components/HomeTab.tsx
import GreetingHeader from './GreetingHeader';

export default function HomeTab({ homeContent, greetingProps }: any) {
  let blocks = [];
  try {
    const parsed = JSON.parse(homeContent || '[]');
    if (Array.isArray(parsed)) {
      blocks = parsed;
    } else if (parsed.blocks) {
      blocks = parsed.blocks;
    }
  } catch (e) {
    blocks = [];
  }

  const formatUrl = (url: string) => {
    if (!url) return '#';
    if (!/^https?:\/\//i.test(url)) {
      return `https://${url}`;
    }
    return url;
  };

  return (
    <div className="flex flex-col h-full bg-[var(--bg-secondary)] overflow-y-auto">
      <GreetingHeader {...greetingProps} />
      {blocks.length > 0 && (
        <div className="p-5 flex-1 flex flex-col gap-4">
          {blocks.map((block: any, i: number) => {
            const innerContent = (
              <>
                {block.imageUrl && (
                  <div className="w-full aspect-[16/9] bg-[var(--bg-primary)] p-4 shrink-0">
                    <img src={block.imageUrl} className="w-full h-full object-cover" alt={block.title || 'Image'} />
                  </div>
                )}
                {(block.title || block.description) && (
                  <div className="p-4 bg-[var(--bg-secondary)] flex flex-col gap-1.5 border-t border-[var(--border-strong)]">
                    {block.title && <h3 className="font-semibold text-[var(--text-primary)] text-[15px] leading-tight">{block.title}</h3>}
                    {block.description && <p className="text-[13px] text-[var(--text-secondary)] leading-relaxed whitespace-pre-wrap">{block.description}</p>}
                  </div>
                )}
              </>
            );

            const cardClasses = "block bg-[var(--bg-primary)] rounded-xl overflow-hidden border border-[var(--border-strong)] shadow-sm hover:shadow-md transition-shadow group";

            if (block.linkUrl) {
              return (
                <a key={block.id || i} href={formatUrl(block.linkUrl)} target="_blank" rel="noopener noreferrer" className={cardClasses}>
                  {innerContent}
                </a>
              );
            }

            return (
              <div key={block.id || i} className={cardClasses}>
                {innerContent}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
