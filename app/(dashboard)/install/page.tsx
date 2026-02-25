// app/(dashboard)/install/page.tsx
'use client';
import { useBotConfig } from '../BotConfigProvider';
import { toast } from 'sonner';
import { useState } from 'react';
import { CopyIcon, CheckIcon } from '@/components/icons';

export default function InstallPage() {
  const { config, updateConfig, isOwner, activeSpaceId } = useBotConfig();
  const [copied, setCopied] = useState(false);

  // Minified, single-line embed code
  const embedCode = `<script>!function(){var p="${config.position}",t="${config.theme}",i=document.createElement("iframe");i.src="https://heyapoyo.com/widget?spaceId=${activeSpaceId}&position="+p+"&theme="+t+"&parentUrl="+encodeURIComponent(window.location.href),i.setAttribute("allowtransparency","true"),i.style.cssText="position:fixed;bottom:0;"+("left"===p?"left:0;":"right:0;")+"width:120px;height:120px;border:none;z-index:999999;background:transparent;color-scheme:normal;",document.head.appendChild(document.createElement("meta")).setAttribute("name","viewport"),document.body.appendChild(i),window.addEventListener("message",function(e){if(e.data&&"kb-widget-resize"===e.data.type){var t=window.innerWidth<=430;e.data.isOpen?(i.style.width=t?"100%":"448px",i.style.height=t?"100%":"800px"):setTimeout(function(){i.style.width="120px",i.style.height="120px"},300)}})}();</script>`;

  const handleCopy = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(embedCode);
      setCopied(true);
      toast.success('Copied to clipboard!');
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="p-8 pb-20 animate-in fade-in duration-300">
      <div className="mb-8">
        <h1 className="text-xl font-semibold tracking-tight text-gray-900">Embed & Install</h1>
        <p className="text-sm text-gray-500 mt-1 leading-relaxed">Deploy your AI agent to your website or application.</p>
      </div>

      <div className="space-y-8 bg-white border border-gray-200 p-6 rounded-md shadow-sm">
        <section>
          <label className="block text-sm font-semibold text-gray-900 mb-2">Workspace ID</label>
          <input type="text" readOnly className="w-full p-2.5 border border-gray-200 rounded-md text-sm bg-gray-50 text-gray-500 outline-none font-mono" value={activeSpaceId} />
        </section>

        <section className="pt-2 border-t border-gray-100">
          <label className="block text-sm font-semibold text-gray-900 mb-2">Allowed Domains (Security)</label>
          <input 
            type="text" 
            placeholder="example.com, myapp.io" 
            className="w-full p-2.5 border border-gray-200 rounded-md text-sm outline-none focus:border-black transition-colors" 
            disabled={!isOwner} 
            value={config.allowedDomains || ''} 
            onChange={(e) => updateConfig('allowedDomains', e.target.value)} 
          />
          <p className="text-[11px] text-gray-500 mt-1.5 font-medium">
            Comma-separated list of domains allowed to load the widget. Leave empty to allow any domain. (Changes to security apply automatically without updating your script).
          </p>
        </section>

        <section className="pt-2 border-t border-gray-100">
          <div className="mb-3">
             <label className="block text-sm font-semibold text-gray-900">Deployment Script</label>
             <p className="text-[11px] text-gray-500 mt-0.5 font-medium">Paste this code right before the closing <code>&lt;/body&gt;</code> tag on your website.</p>
          </div>
          
          <div 
            className="relative group cursor-pointer border border-gray-200 rounded-md bg-gray-50 hover:border-gray-300 transition-all overflow-hidden"
            onClick={handleCopy}
          >
             {/* Hover Icon top right */}
             <div className="absolute top-3 right-3 p-1.5 bg-white border border-gray-200 rounded text-gray-600 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity z-20 hover:text-black">
                {copied ? <CheckIcon className="w-4 h-4 text-green-500" /> : <CopyIcon className="w-4 h-4" />}
             </div>
             
             {/* Blur overlay with text */}
             <div className="absolute inset-0 bg-white/50 backdrop-blur-[2px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-200 z-10">
               <span className="bg-black text-white text-xs font-medium px-4 py-2 rounded-md shadow-md flex items-center gap-2">
                 {copied ? <CheckIcon className="w-4 h-4 text-green-400" /> : <CopyIcon className="w-4 h-4" />}
                 {copied ? 'Copied' : 'Click to copy'}
               </span>
             </div>
             
             {/* Code Block */}
             <div className="p-5 text-[11.5px] font-mono text-gray-600 leading-[1.6] break-all select-all">
               {embedCode}
             </div>
          </div>
        </section>
      </div>
    </div>
  );
}
