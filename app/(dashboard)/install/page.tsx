// app/(dashboard)/install/page.tsx
'use client';
import { useBotConfig } from '../BotConfigProvider';
import { toast } from 'sonner';

export default function InstallPage() {
  const { config, updateConfig, isOwner, activeSpaceId } = useBotConfig();

  const embedCode = `<script>
  (function() {
    var position = "${config.position}";
    var theme = "${config.theme}";
    var iframe = document.createElement('iframe');
    iframe.src = "https://ai-chatbot-alpha-orpin.vercel.app/widget?spaceId=${activeSpaceId}&position=" + position + "&theme=" + theme + "&parentUrl=" + encodeURIComponent(window.location.pathname);
    
    iframe.setAttribute('allowtransparency', 'true');
    
    iframe.style.position = 'fixed';
    iframe.style.bottom = '0px';
    iframe.style[position === 'left' ? 'left' : 'right'] = '0px';
    iframe.style.width = '120px'; 
    iframe.style.height = '120px';
    iframe.style.border = 'none';
    iframe.style.zIndex = '999999';
    iframe.style.background = 'transparent';
    iframe.style.colorScheme = 'normal';
    
    document.head.appendChild(document.createElement('meta')).setAttribute('name', 'viewport');
    document.body.appendChild(iframe);

    window.addEventListener('message', function(e) {
      if (e.data && e.data.type === 'kb-widget-resize') {
        var isMobile = window.innerWidth <= 430;
        if (e.data.isOpen) {
          iframe.style.width = isMobile ? '100%' : '448px';
          iframe.style.height = isMobile ? '100%' : '800px';
        } else {
          setTimeout(function() {
            iframe.style.width = '120px';
            iframe.style.height = '120px';
          }, 300);
        }
      }
    });
  })();
</script>`;

  return (
    <div className="p-8 pb-20 animate-in fade-in duration-300">
      <div className="mb-8">
        <h1 className="text-xl font-semibold tracking-tight text-gray-900">Embed & Install</h1>
        <p className="text-sm text-gray-500 mt-1 leading-relaxed">Deploy your AI agent to your website or application.</p>
      </div>

      <div className="space-y-8 bg-white border border-gray-200 p-6 rounded-md">
        <section>
          <label className="block text-sm font-semibold text-gray-900 mb-2">Workspace ID</label>
          <input type="text" readOnly className="w-full p-2.5 border border-gray-200 rounded-md text-sm bg-gray-50 text-gray-500 outline-none font-mono" value={activeSpaceId} />
        </section>

        <section className="pt-2 border-t border-gray-100">
          <label className="block text-sm font-semibold text-gray-900 mb-2">Allowed Domains (Security)</label>
          <input type="text" placeholder="example.com, myapp.io" className="w-full p-2.5 border border-gray-200 rounded-md text-sm outline-none focus:border-black transition-colors" disabled={!isOwner} value={config.allowedDomains || ''} onChange={(e) => updateConfig('allowedDomains', e.target.value)} />
          <p className="text-[11px] text-gray-500 mt-1.5 font-medium">Comma-separated list of domains allowed to load the widget. Leave empty to allow any domain.</p>
        </section>

        <section className="pt-2 border-t border-gray-100">
          <div className="flex items-center justify-between mb-2">
             <label className="block text-sm font-semibold text-gray-900">Deployment Script</label>
             <button onClick={() => { navigator.clipboard.writeText(embedCode); toast.success('Copied!');}} className="text-xs text-blue-600 font-medium hover:text-blue-800 transition-colors flex items-center gap-1">
                Copy to clipboard
             </button>
          </div>
          <div className="relative group">
             <textarea readOnly className="w-full p-4 border border-gray-200 rounded-md bg-gray-50 text-[11px] font-mono h-64 focus:outline-none focus:border-gray-300 transition-colors cursor-text text-gray-600 leading-relaxed" value={embedCode} onClick={(e) => { e.currentTarget.select(); navigator.clipboard.writeText(embedCode); toast.success('Copied!');}} />
          </div>
          <p className="text-[11px] text-gray-500 mt-2 font-medium">Paste this code right before the closing <code>&lt;/body&gt;</code> tag on your website.</p>
        </section>
      </div>
    </div>
  );
}
