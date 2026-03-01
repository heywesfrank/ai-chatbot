// app/help/components/HelpCenterHero.tsx
import Link from 'next/link';

export default function HelpCenterHero({ config, spaceId, searchQuery = '' }: { config: any, spaceId: string, searchQuery?: string }) {
  const bgColor = config?.help_center_color || config?.primary_color || '#000000';
  const bgImage = config?.help_center_bg_image;

  return (
    <div 
      className="relative border-b border-gray-200 bg-cover bg-center"
      style={{
        backgroundColor: bgImage ? 'transparent' : bgColor,
        backgroundImage: bgImage ? `url(${bgImage})` : 'none',
      }}
    >
      {/* Optional dark overlay when using a custom background image to enhance text legibility */}
      {bgImage && <div className="absolute inset-0 bg-black/40" />}
      
      <div className="relative z-10 flex flex-col">
        {/* Top Navigation / Logo Area */}
        <nav className="px-6 py-5 flex items-center">
          <Link href={`/help/${spaceId}`} className="flex items-center gap-2 transition-opacity hover:opacity-80">
            {config?.bot_avatar ? (
              <img src={config.bot_avatar} alt="Logo" className="h-6 w-auto rounded-sm object-contain" />
            ) : (
              <img src="/apoyo.png" alt="Logo" className="h-6 object-contain invert brightness-0" />
            )}
            <span className="font-semibold text-white drop-shadow-sm ml-1">{config?.workspace_name || 'Help Center'}</span>
          </Link>
        </nav>

        {/* Search Area */}
        <div className="max-w-2xl mx-auto w-full px-6 pb-12 pt-4">
          <form action={`/help/${spaceId}`} method="GET" className="relative">
            <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input 
              type="text" 
              name="q" 
              defaultValue={searchQuery}
              placeholder={config?.help_search_placeholder || "Search for articles..."} 
              className="w-full pl-11 pr-4 py-3.5 rounded-md bg-white/85 backdrop-blur-md focus:bg-white border border-transparent shadow-none focus:outline-none transition-all text-base placeholder:text-gray-500 text-gray-900"
            />
          </form>
        </div>
      </div>
    </div>
  );
}
