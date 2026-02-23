// app/(dashboard)/analytics/page.tsx
'use client';
import { useState, useEffect } from 'react';
import { supabaseClient as supabase } from '@/lib/supabase-client';
import { toast } from 'sonner';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import ReactMarkdown from 'react-markdown';

interface FeedbackData {
  id: string;
  prompt: string;
  response: string;
  rating: 'up' | 'down';
  created_at: string;
}

interface VolumeData {
  date: string;
  interactions: number;
}

export default function AnalyticsDashboard() {
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [feedbacks, setFeedbacks] = useState<FeedbackData[]>([]);
  const [volumeData, setVolumeData] = useState<VolumeData[]>([]);
  const [aiInsights, setAiInsights] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session) {
        const res = await fetch('/api/analytics', {
          headers: { 'Authorization': `Bearer ${session.access_token}` }
        });
        
        if (res.ok) {
          const data = await res.json();
          setFeedbacks(data.feedbacks);
          setVolumeData(data.volumeData);
          setAiInsights(data.aiInsights);
        }
      }
      setIsLoading(false);
    };

    fetchData();
  }, []);

  const handleExport = async (type: 'leads' | 'chats') => {
    try {
      setIsExporting(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const res = await fetch(`/api/export?type=${type}`, {
        headers: { 'Authorization': `Bearer ${session.access_token}` }
      });

      if (!res.ok) throw new Error('Export failed');
      
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${type}-export.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      toast.success(`Successfully exported ${type}`);
    } catch (e) {
      toast.error(`Failed to export ${type}`);
    } finally {
      setIsExporting(false);
    }
  };

  const totalFeedback = feedbacks.length;
  const positive = feedbacks.filter(f => f.rating === 'up').length;
  const negative = feedbacks.filter(f => f.rating === 'down').length;
  const satisfactionRate = totalFeedback > 0 ? Math.round((positive / totalFeedback) * 100) : 0;
  
  const needsImprovement = feedbacks.filter(f => f.rating === 'down').slice(0, 10);

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center bg-[#FAFAFA]">
        <div className="flex space-x-1">
          <div className="w-1.5 h-1.5 bg-gray-300 rounded-full animate-pulse" />
          <div className="w-1.5 h-1.5 bg-gray-300 rounded-full animate-pulse delay-75" />
          <div className="w-1.5 h-1.5 bg-gray-300 rounded-full animate-pulse delay-150" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full w-full bg-[#FAFAFA] text-gray-900 font-sans overflow-y-auto">
      <div className="max-w-[1200px] mx-auto w-full p-8 pb-20">
        
        <div className="mb-8 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <h1 className="text-xl font-medium mb-1 tracking-tight">Analytics Dashboard</h1>
            <p className="text-gray-500 text-sm leading-relaxed">Track bot performance, view customer interactions, and discover knowledge gaps.</p>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => handleExport('leads')}
              disabled={isExporting}
              className="px-3 py-1.5 bg-white border border-gray-200 text-gray-700 text-xs font-medium rounded-md hover:bg-gray-50 transition-colors shadow-sm disabled:opacity-50"
            >
              Export Leads
            </button>
            <button 
              onClick={() => handleExport('chats')}
              disabled={isExporting}
              className="px-3 py-1.5 bg-white border border-gray-200 text-gray-700 text-xs font-medium rounded-md hover:bg-gray-50 transition-colors shadow-sm disabled:opacity-50"
            >
              Export Chats
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatCard title="Total Interactions" value={totalFeedback} />
          <StatCard title="Satisfaction Rate" value={`${satisfactionRate}%`} subtitle="Based on total feedback" />
          <StatCard title="Helpful Responses" value={positive} />
          <StatCard title="Failed Responses" value={negative} />
        </div>

        {/* Charts and AI Insights Row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
          <div className="lg:col-span-2 bg-white border border-gray-200 rounded-sm p-5 flex flex-col">
             <h2 className="text-sm font-semibold text-gray-900 mb-6">Conversation Volume (30 Days)</h2>
             <div className="flex-1 w-full min-h-[220px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={volumeData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                    <XAxis dataKey="date" tick={{fontSize: 11, fill: '#9ca3af'}} axisLine={false} tickLine={false} dy={10} minTickGap={30} />
                    <YAxis tick={{fontSize: 11, fill: '#9ca3af'}} axisLine={false} tickLine={false} allowDecimals={false} dx={-10} />
                    <Tooltip 
                      contentStyle={{ borderRadius: '6px', fontSize: '12px', border: '1px solid #e5e7eb', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }} 
                      itemStyle={{ color: '#111827', fontWeight: 500 }}
                    />
                    <Line type="monotone" dataKey="interactions" stroke="#000000" strokeWidth={2} dot={false} activeDot={{r: 4, fill: '#000000', strokeWidth: 0}} />
                  </LineChart>
                </ResponsiveContainer>
             </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-sm p-5 flex flex-col">
             <div className="flex items-center gap-2 mb-1.5">
                <svg className="w-4 h-4 text-indigo-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v4m0 12v4M4.93 4.93l2.83 2.83m8.48 8.48l2.83 2.83M2 12h4m12 0h4M4.93 19.07l2.83-2.83m8.48-8.48l2.83-2.83"/></svg>
                <h2 className="text-sm font-semibold text-gray-900">AI Knowledge Gaps</h2>
             </div>
             <p className="text-xs text-gray-500 mb-5 leading-relaxed">Nightly automated summary of what users searched for but couldn't find.</p>
             
             <div className="flex-1 bg-gray-50/50 border border-gray-100 rounded p-4 overflow-y-auto">
                {aiInsights ? (
                   <ReactMarkdown className="prose prose-sm prose-p:mb-2 prose-p:leading-relaxed prose-ul:pl-4 prose-li:mb-1.5 prose-li:text-gray-700 text-gray-800 text-[13px]">
                     {aiInsights}
                   </ReactMarkdown>
                ) : (
                   <div className="h-full flex flex-col items-center justify-center text-center text-gray-400 py-6">
                     <p className="text-xs">Not enough failed requests yet to generate insights.</p>
                   </div>
                )}
             </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 bg-white border border-gray-200 rounded-sm overflow-hidden flex flex-col">
            <div className="p-5 border-b border-gray-100 flex justify-between items-center">
              <h2 className="text-sm font-semibold text-gray-900">Recent Customer Feedback</h2>
            </div>
            
            {feedbacks.length === 0 ? (
              <div className="p-8 text-center text-sm text-gray-500">
                No analytics data yet. Check back once users start interacting with your bot!
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead>
                    <tr className="bg-gray-50/50 border-b border-gray-100 text-gray-500">
                      <th className="px-5 py-3 font-medium text-xs uppercase tracking-wider">Date</th>
                      <th className="px-5 py-3 font-medium text-xs uppercase tracking-wider">Rating</th>
                      <th className="px-5 py-3 font-medium text-xs uppercase tracking-wider w-[35%]">Prompt</th>
                      <th className="px-5 py-3 font-medium text-xs uppercase tracking-wider w-[45%]">Response</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {feedbacks.map((f) => (
                      <tr key={f.id} className="hover:bg-gray-50/30 transition-colors group">
                        <td className="px-5 py-4 text-gray-500 whitespace-nowrap">
                          {new Date(f.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </td>
                        <td className="px-5 py-4">
                          {f.rating === 'up' ? (
                            <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded border border-green-200 bg-green-50 text-green-700 text-xs font-medium">
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3"><path d="M7 10v12"/><path d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2h0a3.13 3.13 0 0 1 3 3.88Z"/></svg>
                              Helpful
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded border border-red-200 bg-red-50 text-red-700 text-xs font-medium">
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3"><path d="M17 14V2"/><path d="M9 18.12 10 14H4.17a2 2 0 0 1-1.92-2.56l2.33-8A2 2 0 0 1 6.5 2H20a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-2.76a2 2 0 0 0-1.79 1.11L12 22h0a3.13 3.13 0 0 1-3-3.88Z"/></svg>
                              Failed
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-4 text-gray-900">
                          <div className="max-w-[200px] truncate" title={f.prompt}>{f.prompt}</div>
                        </td>
                        <td className="px-5 py-4 text-gray-500">
                          <div className="max-w-[300px] truncate" title={f.response}>{f.response}</div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="bg-white border border-gray-200 rounded-sm p-5 h-fit">
            <h2 className="text-sm font-semibold text-gray-900 mb-1">Needs Attention</h2>
            <p className="text-xs text-gray-500 mb-5">Identify knowledge gaps by reviewing responses that were downvoted by users.</p>
            
            <div className="flex flex-col gap-3">
              {needsImprovement.length > 0 ? (
                needsImprovement.map((f) => (
                  <div key={f.id} className="p-3 border border-red-100 bg-red-50/20 rounded-sm hover:border-red-200 transition-colors">
                    <div className="flex items-start gap-2 mb-1.5">
                      <span className="text-[9px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider mt-0.5 border border-red-200">
                        Failed
                      </span>
                      <p className="text-sm font-medium text-gray-900 break-words">{f.prompt}</p>
                    </div>
                    <p className="text-xs text-gray-600 line-clamp-2 leading-relaxed ml-10">
                      {f.response}
                    </p>
                  </div>
                ))
              ) : (
                <div className="text-center py-10 bg-gray-50 border border-gray-100 rounded-sm border-dashed">
                  <p className="text-sm text-gray-500">No negative feedback yet! 🎉</p>
                </div>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

function StatCard({ title, value, subtitle }: { title: string, value: string | number, subtitle?: string }) {
  return (
    <div className="bg-white p-5 border border-gray-200 rounded-sm flex flex-col justify-center">
      <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">{title}</span>
      <span className="text-3xl font-semibold text-gray-900 mt-1.5">{value}</span>
      {subtitle && <span className="text-xs text-gray-400 mt-1">{subtitle}</span>}
    </div>
  );
}
