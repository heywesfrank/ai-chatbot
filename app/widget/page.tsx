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

  const urlOverrides = useMemo(() => {
    let parsedPrompts = null;
    if (promptsParam) {
      try { parsedPrompts = JSON.parse(promptsParam); } catch (e) { console.error(e); }
    }
    return {
      color: searchParams.get('color') || '',
      header: searchParams.get('header') || '',
      showPrompts: showPromptsParam !== null ? showPromptsParam === 'true' : null,
      prompts: parsedPrompts,
      leadCapture: leadCaptureParam !== null ? leadCaptureParam === 'true' : null
    };
  }, [searchParams, promptsParam, showPromptsParam, leadCaptureParam]);

  const [config, setConfig] = useState<any>(null);
  const [loadingConfig, setLoadingConfig] = useState(true);
  const [fetchError, setFetchError] = useState(false);

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
      <div className="flex h-screen items-center justify-center bg-white">
        <div className="flex space-x-1" role="status" aria-label="Loading Widget">
          <div className="w-1.5 h-1.5 bg-gray-300 rounded-full animate-pulse" />
          <div className="w-1.5 h-1.5 bg-gray-300 rounded-full animate-pulse delay-75" />
          <div className="w-1.5 h-1.5 bg-gray-300 rounded-full animate-pulse delay-150" />
        </div>
      </div>
    );
  }

  if (fetchError || !spaceId) {
    return (
      <div className="flex h-screen items-center justify-center bg-white text-center p-4">
        <div>
          <svg className="w-10 h-10 mb-4 text-gray-300 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
          <p className="text-sm font-medium text-gray-800">Widget Unavailable</p>
          <p className="text-xs text-gray-500 mt-1">Check your installation code and ensure Space ID is correct.</p>
        </div>
      </div>
    );
  }

  return <ChatWidget spaceId={spaceId} config={config} urlOverrides={urlOverrides} />;
}

export default function WidgetPage() {
  return (
    <Suspense fallback={
      <div className="flex h-screen items-center justify-center bg-white">
        <div className="flex space-x-1">
          <div className="w-1.5 h-1.5 bg-gray-300 rounded-full animate-pulse" />
          <div className="w-1.5 h-1.5 bg-gray-300 rounded-full animate-pulse delay-75" />
          <div className="w-1.5 h-1.5 bg-gray-300 rounded-full animate-pulse delay-150" />
        </div>
      </div>
    }>
      <WidgetWrapper />
    </Suspense>
  );
}
