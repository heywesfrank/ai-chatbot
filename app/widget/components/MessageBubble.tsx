// app/widget/components/MessageBubble.tsx
'use client';

import ReactMarkdown from 'react-markdown';
import { useState } from 'react';
import { CopyIcon, CheckIcon, ThumbsUpIcon, ThumbsDownIcon } from '@/components/icons';

const flattenText = (node: any): string => {
  if (typeof node === 'string') return node;
  if (Array.isArray(node)) return node.map(flattenText).join('');
  if (node && typeof node === 'object' && node.props && node.props.children) {
    return flattenText(node.props.children);
  }
  return '';
};

export default function MessageBubble({
  msg,
  isUser,
  botAvatar,
  primaryColor,
  isTyping,
  liveSessionId,
  handleCopy,
  copiedId,
  submitFeedback,
  feedback,
  userPrompt,
  submitTicket,
  isSubmittingTicket,
  escalatingId,
  setEscalatingId,
}: any) {
  const [escalationEmail, setEscalationEmail] = useState('');

  if (msg.role === 'system') {
    return (
      <div className="flex justify-center my-3 animate-in fade-in duration-300">
         <div className="text-[11px] text-green-600 font-medium flex items-center gap-1.5 bg-green-50 border border-green-100 px-3 py-1.5 rounded-full shadow-sm">
           <CheckIcon className="w-3.5 h-3.5" />
           {msg.content}
         </div>
      </div>
    );
  }

  const isAgent = msg.role === 'agent';

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} animate-in fade-in duration-300`}>
      {!isUser && botAvatar && (
        <img 
          src={botAvatar} 
          alt={isAgent ? "Agent" : "Bot"} 
          className={`w-7 h-7 rounded-full mr-2.5 object-cover flex-shrink-0 mt-0.5 border ${isAgent ? 'border-green-300 shadow-sm' : 'border-[var(--border-color)]'}`} 
        />
      )}
      
      <div className={`flex flex-col gap-1 max-w-[85%] ${isUser ? 'items-end' : 'items-start'}`}>
        <div 
          className={`px-3.5 py-2.5 rounded-2xl leading-relaxed break-words shadow-sm w-full ${isUser ? 'text-[var(--msg-user-text)] rounded-tr-sm' : 'bg-[var(--msg-bot-bg)] text-[var(--msg-bot-text)] border border-[var(--border-color)] rounded-tl-sm'}`}
          style={isUser ? { backgroundColor: 'var(--primary-color)' } : {}}
        >
          {isUser ? msg.content : (
            <ReactMarkdown 
              className="prose prose-sm max-w-none prose-p:my-1 [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 prose-a:text-blue-500 prose-pre:bg-[var(--input-bg)] prose-pre:text-[var(--text-primary)] prose-pre:border prose-pre:border-[var(--border-color)]"
              components={{
                pre: ({ children, ...props }) => {
                  const codeText = flattenText(children);
                  return (
                    <div className="relative group/code my-2">
                      <pre {...props} className="p-3 rounded-md overflow-x-auto text-[12px]">{children}</pre>
                      <button aria-label="Copy code snippet" onClick={() => handleCopy(codeText, codeText)} className="absolute top-2 right-2 p-1.5 bg-[var(--bg-primary)] border border-[var(--border-strong)] rounded shadow-sm text-[var(--text-secondary)] opacity-0 group-hover/code:opacity-100 transition-opacity hover:bg-[var(--bg-secondary)] focus:opacity-100 outline-none" title="Copy code">
                        {copiedId === codeText ? <CheckIcon className="w-3.5 h-3.5 text-green-500" /> : <CopyIcon className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  );
                }
              }}
            >
              {msg.content}
            </ReactMarkdown>
          )}

          {!isUser && msg.id !== 'init' && !isTyping && !liveSessionId && escalatingId === msg.id && (
            <div className="mt-3 border-t border-[var(--border-strong)] pt-3">
              <div className="flex gap-1.5 animate-in fade-in duration-200">
                <input 
                  type="email" 
                  aria-label="Email for live agent escalation"
                  required
                  placeholder="Your email address" 
                  className="border border-[var(--border-strong)] bg-[var(--input-bg)] text-[var(--text-primary)] text-[11px] p-2 rounded-md flex-1 focus:outline-none focus:border-[var(--primary-color)] transition-all disabled:opacity-50 shadow-sm" 
                  value={escalationEmail} 
                  onChange={e => setEscalationEmail(e.target.value)} 
                  disabled={isSubmittingTicket}
                />
                <button 
                  aria-label="Start human chat"
                  onClick={() => submitTicket(msg.id, userPrompt, escalationEmail)} 
                  disabled={!escalationEmail.includes('@') || isSubmittingTicket}
                  className="bg-[var(--text-primary)] text-[var(--bg-primary)] text-[11px] px-3.5 font-medium rounded-md disabled:opacity-50 hover:opacity-80 transition-opacity shadow-sm"
                >
                  {isSubmittingTicket ? 'Starting...' : 'Chat'}
                </button>
              </div>
            </div>
          )}
        </div>

        {!isUser && msg.id !== 'init' && !isTyping && !liveSessionId && (
          <div className="flex items-center gap-1.5 mt-0.5 ml-1 text-[var(--text-secondary)]">
            <button aria-label="Copy message" onClick={() => handleCopy(msg.content, msg.id)} className="hover:text-[var(--text-primary)] transition-colors p-1" title="Copy response">
              {copiedId === msg.id ? <CheckIcon className="w-3.5 h-3.5 text-green-500" /> : <CopyIcon className="w-3.5 h-3.5" />}
            </button>
            <button aria-label="Thumbs up" onClick={() => submitFeedback(msg.id, userPrompt, msg.content, 'up')} className={`hover:text-green-500 transition-colors p-1 ${feedback?.hasOwnProperty(msg.id) && feedback[msg.id] === 'up' ? 'text-green-500' : ''}`} title="Helpful">
              <ThumbsUpIcon className="w-3.5 h-3.5" />
            </button>
            <button aria-label="Thumbs down" onClick={() => submitFeedback(msg.id, userPrompt, msg.content, 'down')} className={`hover:text-red-500 transition-colors p-1 ${feedback?.hasOwnProperty(msg.id) && feedback[msg.id] === 'down' ? 'text-red-500' : ''}`} title="Not helpful">
              <ThumbsDownIcon className="w-3.5 h-3.5" />
            </button>

            <div className="w-px h-3 bg-[var(--border-strong)] mx-1"></div>
            <button aria-label="Talk to human" onClick={() => setEscalatingId(msg.id)} className="text-[11px] font-medium hover:text-[var(--text-primary)] transition-colors">
              Talk to human
            </button>
          </div>
        )}

        {isAgent && <span className="text-[10px] text-[var(--text-secondary)] ml-1">Human Agent</span>}
      </div>
    </div>
  );
}
