// app/help/components/HelpCenterHero.tsx
import Link from 'next/link';

export default function HelpCenterHero({ config, spaceId, searchQuery = '' }: { config: any, spaceId: string, searchQuery?: string }) {
  const bgColor = config?.help_center_color || config?.primary_color || '#000000';
  const bgImage = config?.help_center_bg_image;
  const workspaceName = config?.workspace_name || 'Help Center';

  return (
    <div 
      className="relative border-b border-gray-200 bg-cover bg-center flex flex-col justify-between min-h-[280px]"
      style={{
        backgroundColor: bgImage ? 'transparent' : bgColor,
        backgroundImage: bgImage ? `url(${bgImage})` : 'none',
      }}
    >
      {/* Dark overlay when using a custom background image to enhance text legibility */}
      {bgImage && <div className="absolute inset-0 bg-black/40" />}
      
      <div className="relative z-10 flex flex-col h-full flex-1">
        {/* Top Navigation / Logo Area - ONLY LOGO */}
        <nav className="px-6 py-6 flex items-center">
          <Link href={`/help/${spaceId}`} className="flex items-center transition-opacity hover:opacity-80">
            {config?.bot_avatar ? (
              <img src={config.bot_avatar} alt={workspaceName} className="h-8 w-auto rounded-sm object-contain" />
            ) : (
              <div className="w-9 h-9 rounded-md bg-white/20 flex items-center justify-center text-white font-bold text-lg shadow-sm border border-white/10">
                {workspaceName.charAt(0).toUpperCase()}
              </div>
            )}
          </Link>
        </nav>

        {/* Spacer to push search to the bottom */}
        <div className="flex-1" />

        {/* Search Area */}
        <div className="max-w-2xl mx-auto w-full px-6 pb-10">
          <form action={`/help/${spaceId}`} method="GET" className="relative">
            {/* Magnifying Glass Icon */}
            <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            
            <input 
              type="text" 
              name="q" 
              defaultValue={searchQuery}
              placeholder={config?.help_search_placeholder || "Search for articles..."} 
              className="w-full pl-12 pr-4 py-4 rounded-md bg-white/85 backdrop-blur-md focus:bg-white border border-transparent shadow-none focus:outline-none transition-all text-base placeholder:text-gray-500 text-gray-900"
            />
          </form>
        </div>
      </div>
    </div>
  );
}
