// app/widget/components/ChatInterface.tsx
import MessageBubble from './MessageBubble';
import ChatInput from './ChatInput';
import LeadCaptureForm from './LeadCaptureForm';

export default function ChatInterface({
  isLeadCaptured, handleLeadFormSubmit, isSubmittingLead,
  messages, liveMessages, botAvatar, primaryColor, agentBubbleColor, userBubbleColor, botFontColor, userFontColor,
  isLoading, isAgentTyping, error, liveSessionId, escalatingId, setEscalatingId, isSubmittingTicket, agentsOnline,
  showRouting, routingOptions, handleRoutingSelection, showPrompts, suggestedPrompts, onPromptClick, onFollowUpClick,
  input, onInputChange, handleFormSubmit, handleFileUpload, inputPlaceholder, handleCopy, copiedId, submitFeedback, feedback, submitTicket, messagesEndRef
}: any) {

  if (!isLeadCaptured) {
    return <LeadCaptureForm onSubmit={handleLeadFormSubmit} isSubmitting={isSubmittingLead} />;
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex-1 overflow-y-auto px-4 pt-4 pb-3 flex flex-col bg-[var(--bg-primary)] relative" aria-live="polite" aria-atomic="false">
        <div className="space-y-4">
          {messages.map((msg: any, index: number) => (
            <MessageBubble 
              key={msg.id} msg={msg} isUser={msg.role === 'user'} botAvatar={botAvatar}
              primaryColor={primaryColor} agentBubbleColor={agentBubbleColor} userBubbleColor={userBubbleColor} 
              botFontColor={botFontColor} userFontColor={userFontColor}
              isTyping={isLoading && index === messages.length - 1} isLatest={index === messages.length - 1 && liveMessages.length === 0}
              onFollowUpClick={onFollowUpClick} liveSessionId={liveSessionId}
              handleCopy={handleCopy} copiedId={copiedId} submitFeedback={submitFeedback} feedback={feedback}
              userPrompt={index > 0 && messages[index - 1].role === 'user' ? messages[index - 1].content : ''}
              submitTicket={submitTicket} isSubmittingTicket={isSubmittingTicket} escalatingId={escalatingId} setEscalatingId={setEscalatingId} agentsOnline={agentsOnline}
            />
          ))}

          {liveMessages.length > 0 && (
            <div className="flex justify-center my-6 relative">
              <div className="absolute inset-0 flex items-center" aria-hidden="true"><div className="w-full border-t border-[var(--border-strong)]" /></div>
              <div className="relative flex justify-center"><span className="bg-[var(--bg-primary)] px-3 text-[10px] uppercase font-bold tracking-widest text-[var(--text-secondary)]">Live Chat</span></div>
            </div>
          )}

          {liveMessages.map((msg: any) => (
            <MessageBubble 
              key={msg.id} msg={msg} isUser={msg.role === 'user'} botAvatar={botAvatar} primaryColor={primaryColor}
              agentBubbleColor={agentBubbleColor} userBubbleColor={userBubbleColor}
              botFontColor={botFontColor} userFontColor={userFontColor} handleCopy={handleCopy} copiedId={copiedId}
              liveSessionId={liveSessionId} agentsOnline={agentsOnline}
            />
          ))}

          {((isLoading && !liveSessionId && messages[messages.length - 1]?.role === 'user') || isAgentTyping) && (
            <div className="flex justify-start animate-in fade-in duration-300">
               {botAvatar && <img src={botAvatar} alt="Bot Loading" className="w-7 h-7 rounded-full mr-2.5 object-cover flex-shrink-0 mt-0.5 border border-[var(--border-color)] bg-white" />}
              <div 
                className="px-3 py-2 border border-[var(--border-color)] shadow-sm rounded-2xl rounded-tl-sm flex items-center space-x-1 min-h-[36px]"
                style={{ backgroundColor: agentBubbleColor || 'var(--msg-bot-bg)' }}
              >
                <div className="w-1.5 h-1.5 rounded-full animate-pulse opacity-60" style={{ backgroundColor: botFontColor || 'var(--text-secondary)' }} />
                <div className="w-1.5 h-1.5 rounded-full animate-pulse delay-75 opacity-60" style={{ backgroundColor: botFontColor || 'var(--text-secondary)' }} />
                <div className="w-1.5 h-1.5 rounded-full animate-pulse delay-150 opacity-60" style={{ backgroundColor: botFontColor || 'var(--text-secondary)' }} />
              </div>
            </div>
          )}

          {error && (
            <div className="flex justify-center my-2">
              <span className="bg-red-50 text-red-600 border border-red-100 px-3 py-2 rounded-lg text-xs shadow-sm">
                Sorry, an error occurred.
              </span>
            </div>
          )}
        </div>

        {showRouting && (
          <div className="flex flex-col gap-2 mt-4 animate-in fade-in slide-in-from-bottom-3 duration-500">
            {routingOptions.map((option: any) => (
              <button key={option.id} onClick={() => handleRoutingSelection(option)} className="w-full text-left p-3 rounded-md border border-[var(--border-strong)] bg-[var(--bg-primary)] hover:bg-[var(--bg-secondary)] transition-all shadow-sm group">
                <span className="font-medium text-[var(--text-primary)] text-sm">{option.label}</span>
              </button>
            ))}
          </div>
        )}

        {!showRouting && messages.length === 1 && showPrompts && suggestedPrompts.length > 0 && !liveSessionId && (
          <>
            <div className="flex-1" />
            <div className="w-full flex flex-wrap justify-center gap-2 mt-6 animate-in fade-in slide-in-from-bottom-3 duration-500">
              {suggestedPrompts.map((prompt: string, index: number) => (
                <button key={index} onClick={() => onPromptClick(prompt)} className="text-[13px] px-4 py-2.5 rounded-full border border-[var(--border-strong)] bg-[var(--bg-primary)] text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] transition-all shadow-sm text-center leading-tight max-w-full whitespace-normal break-words">
                  {prompt}
                </button>
              ))}
            </div>
          </>
        )}
        <div ref={messagesEndRef} />
      </div>

      <ChatInput 
        input={input} handleInputChange={onInputChange} handleFormSubmit={handleFormSubmit} 
        disabled={(isLoading && !liveSessionId) || showRouting} primaryColor={primaryColor} 
        isLiveChat={!!liveSessionId} onFileUpload={handleFileUpload} inputPlaceholder={inputPlaceholder}
      />
    </div>
  );
}
