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

const formatTime = (dateString?: string | Date) => {
  if (!dateString) return '';
  const d = new Date(dateString);
  return isNaN(d.getTime()) ? '' : d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

export default function MessageBubble({
  msg,
  isUser,
  botAvatar,
  primaryColor,
  botFontColor,
  userFontColor,
  isTyping,
  isLatest,
  onFollowUpClick,
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
  agentsOnline,
}: any) {
  const [escalationEmail, setEscalationEmail] = useState('');

  if (msg.role === 'system') {
    return (
      <div className="flex justify-center my-3 animate-in fade-in duration-300">
         <div className="text-[11px] text-green-600 font-medium flex items-center gap-1.5 bg-green-50 border border-green-100 px-3 py-1.5 rounded-full shadow-sm text-center">
           <CheckIcon className="w-3.5 h-3.5 shrink-0" />
           {msg.content}
         </div>
      </div>
    );
  }

  const isAgent = msg.role === 'agent';
  let content = msg.content || '';
  let sources: { text: string; url: string }[] = [];
  let followUps: string[] = [];

  if (!isUser && content) {
    // Extract Follow-ups
    const followUpRegex = /(?:\n+)?\*\*Follow-ups:\*\*\s*([\s\S]*?)(?=(?:\n+)?\*\*Sources:\*\*|$)/i;
    const fMatch = content.match(followUpRegex);
    if (fMatch) {
      const fText = fMatch[1];
      content = content.replace(fMatch[0], '');
      const listRegex = /-\s*(.*)/g;
      let m;
      while ((m = listRegex.exec(fText)) !== null) {
        followUps.push(m[1].trim().replace(/^['"]|['"]$/g, ''));
      }
    }

    // Extract Sources
    const sourceRegex = /(?:\n+)?\*\*Sources:\*\*\s*([\s\S]*?)(?=(?:\n+)?\*\*Follow-ups:\*\*|$)/i;
    const sMatch = content.match(sourceRegex);
    if (sMatch) {
      const sText = sMatch[1];
      content = content.replace(sMatch[0], '');
      const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
      let m;
      while ((m = linkRegex.exec(sText)) !== null) {
        sources.push({ text: m[1], url: m[2] });
      }
    }
    
    content = content.trim();
  }

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
          className={`px-3.5 py-2.5 rounded-2xl leading-relaxed break-words shadow-sm w-full ${isUser ? 'rounded-tr-sm' : 'bg-[var(--msg-bot-bg)] border border-[var(--border-color)] rounded-tl-sm'}`}
          style={isUser ? { backgroundColor: 'var(--primary-color)', color: userFontColor || 'var(--msg-user-text)' } : { color: botFontColor || 'var(--msg-bot-text)' }}
        >
          {isUser ? (
            <ReactMarkdown 
              className="prose prose-sm max-w-none prose-p:my-0 [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 prose-a:text-current prose-a:underline prose-img:rounded-xl prose-img:shadow-sm prose-img:max-w-full prose-img:my-1"
            >
              {msg.content}
            </ReactMarkdown>
          ) : (
            <ReactMarkdown 
              className="prose prose-sm max-w-none prose-p:my-1 [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 prose-a:text-blue-500 prose-pre:bg-[var(--input-bg)] prose-pre:text-[var(--text-primary)] prose-pre:border prose-pre:border-[var(--border-color)] prose-img:rounded-xl prose-img:max-w-full"
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
              {content}
            </ReactMarkdown>
          )}

          {sources.length > 0 && (
            <div className="mt-3 pt-3 border-t border-[var(--border-strong)] flex flex-col gap-2 animate-in fade-in duration-300 overflow-hidden">
              <span className="text-[9px] font-bold uppercase tracking-wider text-[var(--text-secondary)]">References</span>
              <div className="flex flex-col gap-1.5">
                {sources.map((src, i) => (
                  <a 
                    key={i} 
                    href={src.url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-[11px] bg-[var(--bg-primary)] border border-[var(--border-strong)] text-[var(--text-primary)] hover:border-[var(--primary-color)] px-2.5 py-1.5 rounded-md transition-colors decoration-transparent shadow-sm group/link max-w-full"
                  >
                    <svg className="w-3.5 h-3.5 flex-shrink-0 text-[var(--text-secondary)] group-hover/link:text-[var(--primary-color)] transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
                    <span className="truncate">Source {src.text}</span>
                  </a>
                ))}
              </div>
            </div>
          )}

          {!isUser && msg.id !== 'init' && !isTyping && !liveSessionId && escalatingId === msg.id && (
            <div className="mt-3 border-t border-[var(--border-strong)] pt-3 animate-in fade-in duration-200">
              <div className="flex gap-1.5">
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
                  {isSubmittingTicket ? 'Sending...' : (agentsOnline ? 'Chat' : 'Send')}
                </button>
              </div>
              {!agentsOnline && (
                <p className="text-[10px] text-[var(--text-secondary)] mt-1.5 leading-tight">
                  Agents are offline. We will reply via email.
                </p>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-1.5 mt-0.5 mx-1 text-[10px] text-[var(--text-secondary)]">
          <span className="opacity-70">{formatTime(msg.createdAt || msg.created_at)}</span>

          {!isUser && msg.id !== 'init' && !isTyping && !liveSessionId && (
            <>
              <span className="w-px h-2.5 bg-[var(--border-strong)] mx-0.5"></span>
              <button aria-label="Copy message" onClick={() => handleCopy(content, msg.id)} className="hover:text-[var(--text-primary)] transition-colors p-1" title="Copy response">
                {copiedId === msg.id ? <CheckIcon className="w-3.5 h-3.5 text-green-500" /> : <CopyIcon className="w-3.5 h-3.5" />}
              </button>
              <button aria-label="Thumbs up" onClick={() => submitFeedback(msg.id, userPrompt, msg.content, 'up')} className={`hover:text-green-500 transition-colors p-1 ${feedback?.hasOwnProperty(msg.id) && feedback[msg.id] === 'up' ? 'text-green-500' : ''}`} title="Helpful">
                <ThumbsUpIcon className="w-3.5 h-3.5" />
              </button>
              <button aria-label="Thumbs down" onClick={() => submitFeedback(msg.id, userPrompt, msg.content, 'down')} className={`hover:text-red-500 transition-colors p-1 ${feedback?.hasOwnProperty(msg.id) && feedback[msg.id] === 'down' ? 'text-red-500' : ''}`} title="Not helpful">
                <ThumbsDownIcon className="w-3.5 h-3.5" />
              </button>

              <span className="w-px h-2.5 bg-[var(--border-strong)] mx-0.5"></span>
              <button aria-label="Talk to human" onClick={() => setEscalatingId(msg.id)} className="font-medium hover:text-[var(--text-primary)] transition-colors">
                {agentsOnline ? 'Talk to human' : 'Email support'}
              </button>
            </>
          )}

          {isAgent && (
            <>
              <span className="w-px h-2.5 bg-[var(--border-strong)] mx-0.5"></span>
              <span className="font-medium text-green-600">Human Agent</span>
            </>
          )}
        </div>

        {/* Dynamic AI Follow-up Chips - Rendered only at the bottom of the latest bot message */}
        {isLatest && followUps.length > 0 && !isTyping && !liveSessionId && (
          <div className="mt-1.5 flex flex-col gap-2 w-full animate-in fade-in slide-in-from-top-2 duration-300">
            {followUps.map((q, i) => (
              <button
                key={i}
                onClick={() => onFollowUpClick(q)}
                className="text-left text-[12px] bg-[var(--bg-primary)] border border-[var(--border-strong)] text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] hover:border-[var(--primary-color)] px-3.5 py-2 rounded-xl transition-all shadow-sm group/followup flex items-center justify-between"
              >
                <span className="truncate pr-2 font-medium">{q}</span>
                <svg className="w-3.5 h-3.5 opacity-40 group-hover/followup:opacity-100 group-hover/followup:text-[var(--primary-color)] transition-all shrink-0 -translate-x-1 group-hover/followup:translate-x-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
