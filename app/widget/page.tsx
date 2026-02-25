// app/widget/page.tsx
'use client';

import { Suspense, useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import ChatWidget from './components/ChatWidget';

function WidgetWrapper() {
  const searchParams = useSearchParams();
  const spaceId = searchParams.get('spaceId');
  
  const showPromptsParam = searchParams.get('showPrompts');
  const leadCaptureParam = searchParams.get('leadCapture');
  const promptsParam = searchParams.get('prompts');
  const removeBrandingParam = searchParams.get('removeBranding');
  const followUpQuestionsEnabledParam = searchParams.get('followUpQuestionsEnabled');
  const matchThresholdParam = searchParams.get('matchThreshold');

  const urlOverrides = useMemo(() => {
    let parsedPrompts = null;
    if (promptsParam) {
      try { parsedPrompts = JSON.parse(promptsParam); } catch (e) { console.error(e); }
    }
    return {
      color: searchParams.get('color') || '',
      botFontColor: searchParams.get('botFontColor') || '',
      userFontColor: searchParams.get('userFontColor') || '',
      agentBubbleColor: searchParams.get('agentBubbleColor') || '',
      userBubbleColor: searchParams.get('userBubbleColor') || '',
      launcherColor: searchParams.get('launcherColor') || '',
      launcherIconColor: searchParams.get('launcherIconColor') || '',
      header: searchParams.get('header') || '',
      description: searchParams.get('description') || '',
      placeholder: searchParams.get('placeholder') || '',
      removeBranding: removeBrandingParam !== null ? removeBrandingParam === 'true' : null,
      showPrompts: showPromptsParam !== null ? showPromptsParam === 'true' : null,
      prompts: parsedPrompts,
      leadCapture: leadCaptureParam !== null ? leadCaptureParam === 'true' : null,
      theme: searchParams.get('theme') || 'auto',
      position: searchParams.get('position') || 'right',
      preview: searchParams.get('preview') === 'true',
      parentUrl: searchParams.get('parentUrl') || '',
      systemPrompt: searchParams.get('systemPrompt') || null,
      language: searchParams.get('language') || null,
      followUpQuestionsEnabled: followUpQuestionsEnabledParam !== null ? followUpQuestionsEnabledParam === 'true' : null,
      matchThreshold: matchThresholdParam !== null ? parseFloat(matchThresholdParam) : null,
      reasoningEffort: searchParams.get('reasoningEffort') || null,
      verbosity: searchParams.get('verbosity') || null,
    };
  }, [searchParams, promptsParam, showPromptsParam, leadCaptureParam, removeBrandingParam, followUpQuestionsEnabledParam, matchThresholdParam]);

  const [liveOverrides, setLiveOverrides] = useState<any>({});
  const [config, setConfig] = useState<any>(null);
  const [loadingConfig, setLoadingConfig] = useState(true);
  const [fetchError, setFetchError] = useState(false);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data && event.data.type === 'kb-config-update') {
        const newConfig = event.data.config;
        
        setLiveOverrides({
          color: newConfig.primaryColor,
          botFontColor: newConfig.botFontColor,
          userFontColor: newConfig.userFontColor,
          agentBubbleColor: newConfig.agentBubbleColor,
          userBubbleColor: newConfig.userBubbleColor,
          launcherColor: newConfig.launcherColor,
          launcherIconColor: newConfig.launcherIconColor,
          header: newConfig.headerText,
          description: newConfig.descriptionText,
          placeholder: newConfig.inputPlaceholder,
          removeBranding: newConfig.removeBranding,
          showPrompts: newConfig.showPrompts,
          prompts: newConfig.suggestedPrompts,
          leadCapture: newConfig.leadCaptureEnabled,
          theme: newConfig.theme,
          position: newConfig.position,
          systemPrompt: newConfig.systemPrompt,
          language: newConfig.language,
          followUpQuestionsEnabled: newConfig.followUpQuestionsEnabled,
          matchThreshold: newConfig.matchThreshold,
          reasoningEffort: newConfig.reasoningEffort,
          verbosity: newConfig.verbosity,
        });
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const finalOverrides = { ...urlOverrides, ...liveOverrides };

  useEffect(() => {
    if (spaceId) {
      setLoadingConfig(true);
      fetch(`/api/widget-config?spaceId=${spaceId}`)
        .then(res => {
          if (!res.ok) throw new Error('Invalid Configuration');
          return res.json();
        })
        .then(data => {
          if (data.config) setConfig(data.config);
          setLoadingConfig(false);
        })
        .catch((err) => {
          console.error(err);
          setFetchError(true);
          setLoadingConfig(false);
        });
    } else {
      setLoadingConfig(false);
    }
  }, [spaceId]);

  if (loadingConfig) {
    return (
      <div className="flex h-screen items-center justify-center bg-transparent">
        <div className="flex space-x-1" role="status" aria-label="Loading Widget">
          <div className="w-1.5 h-1.5 bg-gray-300 rounded-full animate-pulse" />
          <div className="w-1.5 h-1.5 bg-gray-300 rounded-full animate-pulse delay-75" />
          <div className="w-1.5 h-1.5 bg-gray-300 rounded-full animate-pulse delay-150" />
        </div>
      </div>
    );
  }

  if (fetchError || !spaceId) {
    return null;
  }

  return <ChatWidget spaceId={spaceId} config={config} urlOverrides={finalOverrides} />;
}

export default function WidgetPage() {
  return (
    <Suspense fallback={<div className="flex h-screen items-center justify-center bg-transparent" />}>
      <WidgetWrapper />
    </Suspense>
  );
}
