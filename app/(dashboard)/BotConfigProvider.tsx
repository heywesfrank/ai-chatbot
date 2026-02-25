'use client';
import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabaseClient as supabase } from '@/lib/supabase-client';
import { toast } from 'sonner';

interface BotConfigContextType {
  config: any;
  updateConfig: (key: string, value: any) => void;
  saveConfig: () => Promise<void>;
  isOwner: boolean;
  isSaving: boolean;
  activeSpaceId: string;
  refreshKey: number;
  triggerRefresh: () => void;
  userId: string | null;
  userEmail: string | null;
  isLoading: boolean;
}

const BotConfigContext = createContext<BotConfigContextType | null>(null);

export function BotConfigProvider({ children }: { children: ReactNode }) {
  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [isOwner, setIsOwner] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [activeSpaceId, setActiveSpaceId] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  const [config, setConfig] = useState({
    spaceId: '',
    workspaceName: 'My Workspace',
    timezone: 'UTC',
    systemPrompt: 'You are a helpful, knowledgeable, and professional customer support assistant. Your primary goal is to assist users by providing accurate and concise answers based on the provided documentation. Maintain a friendly and empathetic tone at all times. Never attempt to use HTML, inline CSS, or custom markdown to color text. Output plain text and standard markdown links only.',
    primaryColor: '#000000',
    botFontColor: '#1f2937',
    userFontColor: '#ffffff',
    agentBubbleColor: '#f3f4f6',
    userBubbleColor: '#000000',
    launcherColor: '#000000',
    launcherIconColor: '#ffffff',
    headerText: 'Documentation Bot',
    descriptionText: '',
    welcomeMessage: 'How can I help you today?',
    inputPlaceholder: 'Ask a question...',
    botAvatar: '',
    removeBranding: false,
    showPrompts: true,
    suggestedPrompts: ["How do I reset my password?", "Where can I find the documentation?", "How do I contact support?"],
    followUpQuestionsEnabled: false,
    leadCaptureEnabled: false,
    pageContextEnabled: false,
    routingConfig: [] as { id: string; label: string; value: string }[],
    language: 'Auto-detect',
    theme: 'auto',
    position: 'right',
    temperature: 0.5,
    matchThreshold: 0.5,
    reasoningEffort: 'medium',
    verbosity: 'medium',
    allowedDomains: '',
    agentsOnline: false,
    cannedResponses: [],
    triggers: [] // Added default state for triggers
  });

  const updateConfig = (key: string, value: any) => {
    if (isOwner) setConfig(prev => ({ ...prev, [key]: value }));
  };

  const triggerRefresh = () => setRefreshKey(k => k + 1);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setUserId(session.user.id);
        setUserEmail(session.user.email || '');
        hydrateWorkspace(session.user.id, session.user.email || '');
      } else {
        setIsLoading(false);
      }
    });
  }, []);

  const hydrateWorkspace = async (uid: string, email: string) => {
    let spaceData = null;
    let owner = true;

    const { data } = await supabase.from('bot_config').select('*').eq('user_id', uid).maybeSingle();
    if (data) {
      spaceData = data;
    } else {
      const { data: member } = await supabase.from('team_members').select('space_id').eq('email', email).maybeSingle();
      if (member) {
        const { data: teamData } = await supabase.from('bot_config').select('*').eq('space_id', member.space_id).maybeSingle();
        if (teamData) { spaceData = teamData; owner = false; }
      }
    }

    setIsOwner(owner);

    if (spaceData) {
      setConfig(prev => ({
        ...prev,
        spaceId: spaceData.space_id || '',
        workspaceName: spaceData.workspace_name || prev.workspaceName,
        timezone: spaceData.timezone || prev.timezone,
        systemPrompt: spaceData.system_prompt || prev.systemPrompt,
        primaryColor: spaceData.primary_color || prev.primaryColor,
        botFontColor: spaceData.bot_font_color || prev.botFontColor,
        userFontColor: spaceData.user_font_color || prev.userFontColor,
        agentBubbleColor: spaceData.agent_bubble_color || prev.agentBubbleColor,
        userBubbleColor: spaceData.user_bubble_color || prev.userBubbleColor,
        launcherColor: spaceData.launcher_color || prev.launcherColor,
        launcherIconColor: spaceData.launcher_icon_color || prev.launcherIconColor,
        headerText: spaceData.header_text || prev.headerText,
        descriptionText: spaceData.description_text || '',
        welcomeMessage: spaceData.welcome_message || prev.welcomeMessage,
        inputPlaceholder: spaceData.input_placeholder || prev.inputPlaceholder,
        botAvatar: spaceData.bot_avatar || '',
        removeBranding: spaceData.remove_branding ?? false,
        showPrompts: spaceData.show_prompts ?? true,
        suggestedPrompts: spaceData.suggested_prompts || prev.suggestedPrompts,
        followUpQuestionsEnabled: spaceData.follow_up_questions_enabled ?? false,
        leadCaptureEnabled: spaceData.lead_capture_enabled ?? false,
        pageContextEnabled: spaceData.page_context_enabled ?? false,
        routingConfig: spaceData.routing_config || [],
        language: spaceData.language || 'Auto-detect',
        temperature: spaceData.temperature ?? prev.temperature,
        matchThreshold: spaceData.match_threshold ?? prev.matchThreshold,
        reasoningEffort: spaceData.reasoning_effort || prev.reasoningEffort,
        verbosity: spaceData.verbosity || prev.verbosity,
        allowedDomains: spaceData.allowed_domains || '',
        agentsOnline: spaceData.agents_online ?? false,
        cannedResponses: spaceData.canned_responses || [],
        triggers: spaceData.triggers || [] // Added mapping for triggers
      }));
      if (spaceData.space_id) setActiveSpaceId(spaceData.space_id);
    }
    
    setIsLoading(false);
  };

  const saveConfig = async (): Promise<void> => {
    // With the SQL trigger, spaceId will already exist, but this acts as a safe fallback
    const activeId = config.spaceId || Math.random().toString(36).substring(2, 10);
    if (!config.spaceId) updateConfig('spaceId', activeId);
    
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      toast.error('Authentication required.');
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
        body: JSON.stringify({ ...config, spaceId: activeId, userId }),
      });

      if (response.ok) {
        toast.success('Configuration updated!');
        setActiveSpaceId(activeId);
        triggerRefresh();
      } else {
        toast.error('Failed to update configuration.');
      }
    } catch (error) { 
      toast.error('Error saving configuration.'); 
    } finally { 
      setIsSaving(false); 
    }
  };

  return (
    <BotConfigContext.Provider value={{
      config, updateConfig, saveConfig, isOwner, isSaving, activeSpaceId, refreshKey, triggerRefresh, userId, userEmail, isLoading
    }}>
      {children}
    </BotConfigContext.Provider>
  );
}

export function useBotConfig() {
  const context = useContext(BotConfigContext);
  if (!context) throw new Error('useBotConfig must be used within BotConfigProvider');
  return context;
}
