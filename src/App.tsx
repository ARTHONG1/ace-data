import { useEffect, useState, ReactNode, useMemo } from 'react';
import { fetchPublicData, fetchBulkPublicData, PublicDataResponse } from './services/apiService';
import * as XLSX from 'xlsx';
import { 
  Database, 
  RefreshCw, 
  Search, 
  Table as TableIcon,
  ChevronLeft,
  ChevronRight,
  Info,
  ExternalLink,
  Download,
  Sparkles,
  Send,
  Filter,
  BrainCircuit,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { recommendDatasets, recommendAppsFromDatasets, searchDatasets, summarizeData } from './services/aiService';

export default function App() {
  const [data, setData] = useState<PublicDataResponse | null>(null);
  const [masterData, setMasterData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [downloading, setDownloading] = useState(false);
  const [appIdea, setAppIdea] = useState('');
  const [recommendations, setRecommendations] = useState<{ name: string; reason: string; url?: string }[]>([]);
  const [aiLoading, setAiLoading] = useState(false);
  const [selectedDatasets, setSelectedDatasets] = useState<string[]>([]);
  const [appRecommendations, setAppRecommendations] = useState<{ title: string; description: string; value: string; additionalDatasets: string[] }[]>([]);
  const [isAppRecLoading, setIsAppRecLoading] = useState(false);
  const [userAdditionalIdea, setUserAdditionalIdea] = useState('');
  
  // New States for Filtering and Intelligent Search
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedProvider, setSelectedProvider] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [isAiSearchMode, setIsAiSearchMode] = useState(false);
  const [aiSearchResults, setAiSearchResults] = useState<{ name: string; relevance: number }[] | null>(null);
  const [isAiSearching, setIsAiSearching] = useState(false);
  const [allCategories, setAllCategories] = useState<string[]>(['All']);
  const [allProviders, setAllProviders] = useState<string[]>(['All']);
  const [categoryCounts, setCategoryCounts] = useState<Record<string, number>>({});
  const [isSummaryLoading, setIsSummaryLoading] = useState(false);
  const [dataSummary, setDataSummary] = useState<string | null>(null);
  const [selectedDetailItem, setSelectedDetailItem] = useState<any | null>(null);

  const perPage = 10;

  // Fetch categories and master data once
  useEffect(() => {
    const initializeData = async () => {
      try {
        const result = await fetchBulkPublicData(500);
        setMasterData(result.data);
        
        const counts: Record<string, number> = { 'All': result.data.length };
        result.data.forEach(item => {
          const cat = item['분류'] || 'General';
          counts[cat] = (counts[cat] || 0) + 1;
        });
        setCategoryCounts(counts);
        
        const categories = Array.from(new Set(result.data.map(item => item['분류'] || 'General')));
        setAllCategories(['All', ...categories]);
        
        const providers = Array.from(new Set(result.data.map(item => item['제공기관'] || '알 수 없음').filter(Boolean)));
        setAllProviders(['All', ...providers.sort()]);
      } catch (err) {
        console.error('Failed to initialize master data:', err);
      }
    };
    initializeData();
  }, []);

  const handleAiSearch = async () => {
    if (!searchQuery.trim() || isAiSearching) return;
    
    setIsAiSearching(true);
    setDataSummary(null);
    try {
      const datasetNames = masterData.map(item => item['데이터셋명'] || item['목록명'] || '').filter(Boolean);
      const results = await searchDatasets(searchQuery, datasetNames);
      setAiSearchResults(results);
      setPage(1); // Reset to first page of results
    } catch (err) {
      alert('AI Search failed: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setIsAiSearching(false);
    }
  };

  const handleSummarize = async () => {
    if (filteredData.length === 0 || isSummaryLoading) return;
    setIsSummaryLoading(true);
    try {
      const summary = await summarizeData(filteredData);
      setDataSummary(summary || null);
    } catch (err) {
      alert('Summary failed: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setIsSummaryLoading(false);
    }
  };

  const clearFilters = () => {
    setSelectedCategory('All');
    setSelectedProvider('All');
    setSearchQuery('');
    setIsAiSearchMode(false);
    setAiSearchResults(null);
    setDataSummary(null);
    setPage(1);
  };

  const filteredData = useMemo(() => {
    let items = [...masterData];

    // Apply Category Filter
    if (selectedCategory !== 'All') {
      items = items.filter(item => (item['분류'] || 'General') === selectedCategory);
    }

    // Apply Provider Filter
    if (selectedProvider !== 'All') {
      items = items.filter(item => (item['제공기관'] || '알 수 없음') === selectedProvider);
    }

    // Apply AI Search Filter if active
    if (isAiSearchMode && aiSearchResults) {
      const resultNames = aiSearchResults.map(r => r.name);
      items = items.filter(item => resultNames.includes(item['데이터셋명'] || item['목록명'] || ''));
      // Sort by relevance
      items.sort((a, b) => {
        const nameA = a['데이터셋명'] || a['목록명'] || '';
        const nameB = b['데이터셋명'] || b['목록명'] || '';
        const relA = aiSearchResults.find(r => r.name === nameA)?.relevance || 0;
        const relB = aiSearchResults.find(r => r.name === nameB)?.relevance || 0;
        return relB - relA;
      });
    } else if (searchQuery && !isAiSearchMode) {
      // Normal Keyword Search
      items = items.filter(item => 
        (item['데이터셋명'] || item['목록명'] || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item['제공기관'] || '').toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    return items;
  }, [masterData, selectedCategory, selectedProvider, searchQuery, isAiSearchMode, aiSearchResults]);

  // Paginate the filtered data
  const paginatedData = useMemo(() => {
    const start = (page - 1) * perPage;
    return filteredData.slice(start, start + perPage);
  }, [filteredData, page, perPage]);

  const handleRecommendApps = async () => {
    if (selectedDatasets.length === 0 || isAppRecLoading) return;
    setIsAppRecLoading(true);
    try {
      const recs = await recommendAppsFromDatasets(selectedDatasets, userAdditionalIdea);
      setAppRecommendations(recs);
    } catch (err) {
      alert('App Recommendation failed: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setIsAppRecLoading(false);
    }
  };

  const toggleDatasetSelection = (name: string) => {
    setSelectedDatasets(prev => 
      prev.includes(name) ? prev.filter(n => n !== name) : [...prev, name]
    );
  };

  const handleRecommend = async () => {
    if (!appIdea.trim() || aiLoading) return;
    
    setAiLoading(true);
    try {
      const datasetNames = masterData.map(item => item['데이터셋명'] || item['목록명'] || '').filter(Boolean);
      const recs = await recommendDatasets(appIdea, datasetNames);
      
      // Map recommendations to include URLs if found in the master data
      const recsWithUrls = recs.map(rec => {
        const foundItem = masterData.find(item => (item['데이터셋명'] || item['목록명']) === rec.name);
        const url = foundItem ? (foundItem['URL'] || foundItem['데이터셋URL'] || foundItem['상세링크']) : undefined;
        return { ...rec, url };
      });

      setRecommendations(recsWithUrls);
    } catch (err) {
      alert('AI Recommendation failed: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setAiLoading(false);
    }
  };

  const handleDownloadExcel = async () => {
    if (downloading) return;
    
    setDownloading(true);
    try {
      if (masterData.length > 0) {
        const exportData = masterData.map(item => ({
          'Dataset Name': item['데이터셋명'] || item['목록명'] || 'Unnamed Dataset',
          'Organization': item['제공기관'] || 'N/A',
          'Category': item['분류'] || 'General',
          'URL': item['URL'] || item['데이터셋URL'] || item['상세링크'] || ''
        }));

        const worksheet = XLSX.utils.json_to_sheet(exportData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Datasets");
        XLSX.writeFile(workbook, `Datasets_Export_${new Date().toISOString().split('T')[0]}.xlsx`);
      } else {
        alert('No data available to download.');
      }
    } catch (err) {
      alert('Failed to download Excel: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setDownloading(false);
    }
  };

  const loadData = async (p: number) => {
    setLoading(true);
    try {
      const result = await fetchPublicData(p, perPage);
      setData(result);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData(page);
  }, [page]);

  const totalPages = Math.ceil(filteredData.length / perPage);

  return (
    <div className="min-h-screen bg-[#f2f4f6] text-[#191f28] font-sans selection:bg-blue-100">
      {/* Sticky Header */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-black/5">
        <div className="max-w-4xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 cursor-pointer" onClick={clearFilters}>
            <div className="w-8 h-8 bg-[#3182f6] rounded-lg flex items-center justify-center shadow-sm">
              <Database className="text-white w-5 h-5" />
            </div>
            <h1 className="text-xl font-bold tracking-tight">ACE Data Finder</h1>
          </div>
          <div className="flex items-center gap-4">
            <a 
              href="https://product.kyobobook.co.kr/detail/S000219238925"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-semibold text-[#4e5968] hover:bg-black/5 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5"
            >
              <ExternalLink size={16} />
              제미나이
            </a>
            <a 
              href="https://www.yes24.com/product/goods/152079426"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-semibold text-[#4e5968] hover:bg-black/5 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5"
            >
              <ExternalLink size={16} />
              바이브코딩
            </a>
            <a 
              href="https://studio--studio-2646915464-a86ca.us-central1.hosted.app/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-semibold text-[#4e5968] hover:bg-black/5 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5"
            >
              <ExternalLink size={16} />
              클래스똑딱
            </a>
            <a 
              href="https://studio--studio-6411906927-c7113.us-central1.hosted.app/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-semibold text-[#4e5968] hover:bg-black/5 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5"
            >
              <Info size={16} />
              개발자 정보
            </a>
            <button 
              onClick={handleDownloadExcel}
              disabled={downloading}
              className="text-sm font-semibold text-[#3182f6] hover:bg-blue-50 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
            >
              {downloading ? '다운로드 중...' : '엑셀 저장'}
            </button>
            <button 
              onClick={() => loadData(page)}
              className="p-2 text-[#4e5968] hover:bg-black/5 rounded-lg transition-colors"
            >
              <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8 space-y-8">

        {/* Welcome & AI Search Card */}
        <section className="bg-white rounded-3xl p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-black/[0.02]">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Sparkles size={18} className="text-[#3182f6]" />
                <span className="text-sm font-bold text-[#3182f6]">데이터 검색</span>
              </div>
              <h2 className="text-2xl font-bold leading-tight">
                어떤 공공데이터를 <br />
                찾고 계신가요?
              </h2>
            </div>
            
            {/* Search Mode Toggle */}
            <div className="flex bg-[#f2f4f6] p-1 rounded-xl shrink-0 self-start sm:self-end">
              <button
                onClick={() => {
                  setIsAiSearchMode(false);
                  setAiSearchResults(null);
                }}
                className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${!isAiSearchMode ? 'bg-white text-[#191f28] shadow-sm' : 'text-[#8b95a1] hover:text-[#4e5968]'}`}
              >
                일반 검색
              </button>
              <button
                onClick={() => setIsAiSearchMode(true)}
                className={`px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-1.5 ${isAiSearchMode ? 'bg-[#3182f6] text-white shadow-sm' : 'text-[#8b95a1] hover:text-[#4e5968]'}`}
              >
                <BrainCircuit size={16} />
                AI 지능형 검색
              </button>
            </div>
          </div>
          
          <div className="relative group">
            <div className={`absolute inset-y-0 left-4 flex items-center transition-colors ${isAiSearchMode ? 'text-[#3182f6]' : 'text-[#8b95a1]'}`}>
              {isAiSearchMode ? <BrainCircuit size={20} /> : <Search size={20} />}
            </div>
            <input 
              type="text" 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  if (isAiSearchMode) handleAiSearch();
                }
              }}
              placeholder={isAiSearchMode ? "예: 저출산 문제를 해결하기 위한 육아 지원 데이터 찾아줘" : "검색어를 입력하세요 (예: 미세먼지)"} 
              className={`w-full pl-12 pr-24 sm:pr-32 py-4 bg-[#f9fafb] border-2 rounded-2xl text-lg transition-all placeholder:text-[#adb5bd] outline-none ${isAiSearchMode ? 'border-blue-100 focus:border-[#3182f6] focus:bg-white' : 'border-transparent focus:border-gray-200 focus:bg-white'}`}
            />
            <div className="absolute inset-y-0 right-2 flex items-center">
              {isAiSearchMode && (
                <button 
                  onClick={handleAiSearch}
                  disabled={isAiSearching || !searchQuery.trim()}
                  className="px-4 py-2.5 bg-[#3182f6] text-white font-bold hover:bg-blue-600 rounded-xl disabled:opacity-30 transition-colors flex items-center gap-2"
                >
                  {isAiSearching ? <RefreshCw size={18} className="animate-spin" /> : <Send size={18} />}
                  <span className="hidden sm:inline">AI 검색</span>
                </button>
              )}
            </div>
          </div>

          {/* AI Search Results Reason */}
          <AnimatePresence>
            {isAiSearchMode && aiSearchResults && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-6 p-4 bg-blue-50/50 rounded-2xl border border-blue-100/50"
              >
                <div className="flex items-center gap-2 mb-2 text-[#3182f6]">
                  <Sparkles size={14} />
                  <span className="text-xs font-bold uppercase tracking-wider">AI 분석 결과</span>
                </div>
                <p className="text-sm text-[#4e5968] leading-relaxed">
                  입력하신 키워드와 가장 연관성이 높은 데이터셋 {aiSearchResults.length}개를 찾았습니다.
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </section>

        {/* AI Dataset Recommender Card */}
        <section className="bg-white rounded-3xl p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-black/[0.02]">
          <div className="flex items-center gap-2 mb-2">
            <BrainCircuit size={18} className="text-purple-500" />
            <span className="text-sm font-bold text-purple-500">아이디어 추천</span>
          </div>
          <h2 className="text-xl font-bold mb-4">앱 아이디어로 데이터셋 추천받기</h2>
          <div className="flex gap-2">
            <input 
              type="text" 
              value={appIdea}
              onChange={(e) => setAppIdea(e.target.value)}
              placeholder="예: 전국 미세먼지 알림 서비스" 
              className="flex-1 px-4 py-3 bg-[#f9fafb] border-none rounded-xl text-sm focus:ring-2 focus:ring-purple-500/20 transition-all"
              onKeyDown={(e) => e.key === 'Enter' && handleRecommend()}
            />
            <button 
              onClick={handleRecommend}
              disabled={aiLoading || !appIdea.trim()}
              className="px-6 py-3 bg-[#191f28] text-white rounded-xl font-bold hover:bg-black transition-all disabled:opacity-50"
            >
              {aiLoading ? <RefreshCw className="animate-spin" size={18} /> : '추천'}
            </button>
          </div>

          {recommendations.length > 0 && (
            <div className="mt-6 space-y-3">
              {recommendations.map((rec, idx) => (
                <motion.div 
                  key={idx}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.1 }}
                  className="p-4 bg-[#f9fafb] rounded-2xl border border-black/[0.02] flex items-start justify-between group"
                >
                  <div>
                    <h3 className="font-bold text-sm mb-1">{rec.name}</h3>
                    <p className="text-xs text-[#4e5968] leading-relaxed">{rec.reason}</p>
                  </div>
                  {rec.url && (
                    <a href={rec.url} target="_blank" rel="noopener noreferrer" className="p-2 text-[#3182f6] opacity-0 group-hover:opacity-100 transition-opacity">
                      <ExternalLink size={16} />
                    </a>
                  )}
                </motion.div>
              ))}
            </div>
          )}
        </section>

        {/* Stats Section */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="전체 데이터" value={filteredData.length.toLocaleString()} color="text-[#3182f6]" />
          <StatCard label="현재 페이지" value={page.toString()} color="text-emerald-500" />
          <StatCard label="카테고리" value={allCategories.length.toString()} color="text-amber-500" />
          <StatCard label="상태" value={loading ? '로딩중' : '정상'} color="text-purple-500" />
        </div>

        {/* Category & Data Section */}
        <section className="bg-white rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-black/[0.02] overflow-hidden">
          <div className="p-8 border-b border-black/[0.03]">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold">데이터 목록</h2>
              {(selectedCategory !== 'All' || selectedProvider !== 'All' || searchQuery !== '' || isAiSearchMode) && (
                <button onClick={clearFilters} className="text-xs font-bold text-red-500 hover:bg-red-50 px-3 py-1.5 rounded-lg transition-colors">
                  필터 초기화
                </button>
              )}
            </div>

            <div className="flex flex-col sm:flex-row gap-4 mb-4">
              <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar flex-1">
                {allCategories.map(cat => (
                  <button
                    key={cat}
                    onClick={() => {
                      setSelectedCategory(cat);
                      setPage(1);
                    }}
                    className={`px-4 py-2 rounded-xl text-sm font-bold whitespace-nowrap transition-all ${
                      selectedCategory === cat 
                        ? 'bg-[#3182f6] text-white shadow-md shadow-blue-200' 
                        : 'bg-[#f2f4f6] text-[#4e5968] hover:bg-[#e5e8eb]'
                    }`}
                  >
                    {cat}
                    <span className={`ml-1.5 text-[10px] opacity-60`}>
                      {categoryCounts[cat] || 0}
                    </span>
                  </button>
                ))}
              </div>
              
              <div className="shrink-0">
                <select
                  value={selectedProvider}
                  onChange={(e) => {
                    setSelectedProvider(e.target.value);
                    setPage(1);
                  }}
                  className="px-4 py-2 rounded-xl text-sm font-bold bg-[#f2f4f6] text-[#4e5968] hover:bg-[#e5e8eb] border-none focus:ring-2 focus:ring-[#3182f6]/20 transition-all outline-none cursor-pointer appearance-none pr-8 relative"
                  style={{ backgroundImage: 'url("data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%234e5968%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E")', backgroundRepeat: 'no-repeat', backgroundPosition: 'right .7rem top 50%', backgroundSize: '.65rem auto' }}
                >
                  <option value="All">제공기관 전체</option>
                  {allProviders.filter(p => p !== 'All').map(provider => (
                    <option key={provider} value={provider}>{provider}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Data Summary Insight */}
          <AnimatePresence>
            {(isAiSearchMode || selectedCategory !== 'All' || selectedProvider !== 'All') && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="px-8 py-4 bg-blue-50/30 border-b border-black/[0.03]"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-[#3182f6]">
                    <BrainCircuit size={16} />
                    <span className="text-sm font-bold">데이터 인사이트</span>
                  </div>
                  <button onClick={handleSummarize} disabled={isSummaryLoading} className="text-xs font-bold text-[#3182f6] flex items-center gap-1">
                    {isSummaryLoading ? <RefreshCw size={12} className="animate-spin" /> : <Sparkles size={12} />}
                    요약하기
                  </button>
                </div>
                {dataSummary && (
                  <p className="mt-2 text-sm text-[#4e5968] leading-relaxed">{dataSummary}</p>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Data List (Toss Style List) */}
          <div className="divide-y divide-black/[0.03]">
            {loading && !data ? (
              <div className="py-20 flex flex-col items-center justify-center gap-4">
                <RefreshCw className="animate-spin text-[#3182f6]" size={32} />
                <p className="text-sm text-[#8b95a1] font-medium">데이터를 불러오고 있습니다</p>
              </div>
            ) : paginatedData.map((item, idx) => (
              <motion.div 
                key={`${page}-${idx}`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="p-6 hover:bg-[#f9fafb] transition-colors group flex items-center justify-between"
              >
                <div className="flex-1 min-w-0 pr-4">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] font-bold text-[#8b95a1] uppercase tracking-wider">{(page - 1) * perPage + idx + 1}</span>
                    <span className="text-[10px] font-bold text-[#3182f6] bg-blue-50 px-1.5 py-0.5 rounded uppercase">
                      {item['분류'] || '일반'}
                    </span>
                  </div>
                  <h3 className="font-bold text-[#191f28] truncate group-hover:text-[#3182f6] transition-colors">
                    {item['데이터셋명'] || item['목록명'] || '이름 없는 데이터셋'}
                  </h3>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-xs text-[#8b95a1]">{item['제공기관'] || '제공기관 없음'}</span>
                    <span className="w-1 h-1 bg-[#e5e8eb] rounded-full" />
                    <span className="text-xs text-[#8b95a1] uppercase">{(item['제공형태'] || 'JSON').split(',')[0]}</span>
                  </div>
                  {isAiSearchMode && aiSearchResults && (
                    <p className="text-xs text-[#3182f6] mt-2 font-medium bg-blue-50/50 p-2 rounded-lg">
                      {aiSearchResults.find(r => r.name === (item['데이터셋명'] || item['목록명']))?.reason}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <input 
                    type="checkbox" 
                    checked={selectedDatasets.includes(item['데이터셋명'] || item['목록명'] || '')}
                    onChange={() => toggleDatasetSelection(item['데이터셋명'] || item['목록명'] || '')}
                    className="w-5 h-5 rounded-full border-[#e5e8eb] text-[#3182f6] focus:ring-[#3182f6] cursor-pointer"
                  />
                  <button 
                    onClick={() => setSelectedDetailItem(item)}
                    className="p-2 text-[#adb5bd] hover:text-[#3182f6] hover:bg-blue-50 rounded-xl transition-all"
                    title="상세 정보 보기"
                  >
                    <ChevronRight size={20} />
                  </button>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Pagination */}
          <div className="p-8 bg-[#f9fafb] flex items-center justify-center gap-4">
            <button 
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1 || loading}
              className="p-2 text-[#4e5968] hover:bg-[#e5e8eb] rounded-xl disabled:opacity-20 transition-all"
            >
              <ChevronLeft size={24} />
            </button>
            <div className="flex items-center gap-1">
              <span className="text-sm font-bold text-[#191f28]">{page}</span>
              <span className="text-sm text-[#8b95a1]">/</span>
              <span className="text-sm text-[#8b95a1]">{totalPages}</span>
            </div>
            <button 
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages || loading}
              className="p-2 text-[#4e5968] hover:bg-[#e5e8eb] rounded-xl disabled:opacity-20 transition-all"
            >
              <ChevronRight size={24} />
            </button>
          </div>
        </section>

        {/* Selected Items Floating Bar */}
        <AnimatePresence>
          {selectedDatasets.length > 0 && (
            <motion.div 
              initial={{ y: 100, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 100, opacity: 0 }}
              className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 w-full max-w-2xl px-4"
            >
              <div className="bg-[#191f28] text-white shadow-2xl rounded-3xl p-6 flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-lg">
                      {selectedDatasets.length}개의 데이터 선택됨
                    </h3>
                    <p className="text-xs text-white/50">데이터를 조합하여 앱 아이디어를 추천받으세요.</p>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => { setSelectedDatasets([]); setAppRecommendations([]); setUserAdditionalIdea(''); }} className="px-4 py-2 text-sm font-bold text-white/60 hover:text-white">취소</button>
                    <button 
                      onClick={handleRecommendApps} 
                      disabled={isAppRecLoading}
                      className="px-6 py-2 bg-[#3182f6] text-white rounded-xl font-bold hover:bg-blue-600 transition-all flex items-center gap-2"
                    >
                      {isAppRecLoading ? <RefreshCw className="animate-spin" size={18} /> : <Sparkles size={18} />}
                      {appRecommendations.length > 0 ? '다시 추천받기' : '추천받기'}
                    </button>
                  </div>
                </div>

                {/* Selected Datasets List */}
                <div className="flex gap-2 overflow-x-auto pb-2 pt-1 no-scrollbar">
                  {selectedDatasets.map(dataset => (
                    <div key={dataset} className="flex items-center gap-1.5 bg-white/10 px-3 py-1.5 rounded-lg whitespace-nowrap border border-white/5">
                      <span className="text-xs font-medium text-white/90">{dataset}</span>
                      <button 
                        onClick={() => toggleDatasetSelection(dataset)}
                        className="text-white/40 hover:text-white transition-colors p-0.5 rounded-md hover:bg-white/20"
                        title="선택 해제"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ))}
                </div>

                {appRecommendations.length > 0 && (
                  <div className="flex flex-col gap-4 pt-4 border-t border-white/10">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 max-h-[400px] overflow-y-auto custom-scrollbar">
                      {appRecommendations.map((app, idx) => (
                        <div key={idx} className="bg-white/5 rounded-2xl p-4 border border-white/10 flex flex-col h-full">
                          <h4 className="font-bold text-sm mb-2 text-blue-400">{app.title}</h4>
                          <p className="text-[11px] text-white/70 leading-relaxed mb-3 flex-1">{app.description}</p>
                          
                          {app.additionalDatasets && app.additionalDatasets.length > 0 && (
                            <div className="mt-auto pt-3 border-t border-white/10">
                              <div className="flex items-center gap-1 mb-2">
                                <Database size={10} className="text-emerald-400" />
                                <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">추가 추천 데이터</span>
                              </div>
                              <div className="flex flex-wrap gap-1">
                                {app.additionalDatasets.map((ds, i) => {
                                  const isSelected = selectedDatasets.includes(ds);
                                  return (
                                    <button 
                                      key={i} 
                                      onClick={() => toggleDatasetSelection(ds)}
                                      className={`text-[9px] px-1.5 py-0.5 rounded border transition-colors text-left flex items-center gap-1 ${
                                        isSelected 
                                          ? 'bg-emerald-500 text-white border-emerald-500' 
                                          : 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/30'
                                      }`}
                                      title={isSelected ? "선택 해제" : "데이터셋 추가하기"}
                                    >
                                      <span>{isSelected ? '✓' : '+'}</span>
                                      <span>{ds}</span>
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                    
                    {/* Feedback Input Area */}
                    <div className="flex gap-2 bg-white/5 p-2 rounded-2xl border border-white/10 mt-2">
                      <input 
                        type="text" 
                        value={userAdditionalIdea}
                        onChange={(e) => setUserAdditionalIdea(e.target.value)}
                        placeholder="추천 결과에 추가하고 싶은 아이디어나 피드백을 적어주세요 (예: 타겟층을 노인으로 바꿔줘)"
                        className="flex-1 bg-transparent border-none px-4 py-2 text-sm text-white placeholder:text-white/40 focus:outline-none focus:ring-0"
                        onKeyDown={(e) => e.key === 'Enter' && handleRecommendApps()}
                      />
                      <button 
                        onClick={handleRecommendApps}
                        disabled={isAppRecLoading || !userAdditionalIdea.trim()}
                        className="px-4 py-2 bg-[#3182f6] text-white rounded-xl text-sm font-bold hover:bg-blue-600 transition-all disabled:opacity-50 flex items-center gap-2 shrink-0"
                      >
                        <Send size={16} />
                        반영하기
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <footer className="py-12 text-center space-y-2">
          <p className="text-xs font-bold text-[#8b95a1] uppercase tracking-widest">DataPortal Explorer</p>
          <p className="text-[10px] text-[#adb5bd]">개발자는 ACE 연구회 회장 인천봉수초 교사 홍찬우</p>
        </footer>
      </main>

      {/* Toss-style Detail Modal */}
      <AnimatePresence>
        {selectedDetailItem && (
          <>
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[100]"
              onClick={() => setSelectedDetailItem(null)}
            />
            <motion.div
              initial={{ y: '100%', opacity: 0 }} 
              animate={{ y: 0, opacity: 1 }} 
              exit={{ y: '100%', opacity: 0 }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed bottom-0 sm:bottom-auto sm:top-1/2 sm:-translate-y-1/2 left-0 sm:left-1/2 sm:-translate-x-1/2 w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-3xl z-[101] overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
            >
              {/* Header */}
              <div className="p-6 pb-4 border-b border-black/5 relative">
                <button 
                  onClick={() => setSelectedDetailItem(null)}
                  className="absolute top-6 right-6 p-2 text-[#8b95a1] hover:bg-[#f2f4f6] rounded-full transition-colors"
                >
                  <X size={20} />
                </button>
                <div className="flex items-center gap-2 mb-3 pr-8">
                  <span className="text-[10px] font-bold text-[#3182f6] bg-blue-50 px-2 py-1 rounded uppercase">
                    {selectedDetailItem['분류'] || selectedDetailItem['분류체계'] || '일반'}
                  </span>
                  <span className="text-[10px] font-bold text-[#8b95a1] bg-[#f2f4f6] px-2 py-1 rounded uppercase">
                    {(selectedDetailItem['제공형태'] || selectedDetailItem['목록유형'] || 'DATA').split(',')[0]}
                  </span>
                </div>
                <h2 className="text-xl font-bold text-[#191f28] leading-tight pr-8">
                  {selectedDetailItem['데이터셋명'] || selectedDetailItem['목록명'] || selectedDetailItem['파일데이터명'] || '이름 없는 데이터셋'}
                </h2>
              </div>
              
              {/* Body */}
              <div className="p-6 overflow-y-auto custom-scrollbar flex-1 space-y-1">
                {Object.entries(selectedDetailItem).map(([key, value]) => {
                  // Skip internal or redundant keys
                  if (
                    ['데이터셋명', '목록명', '파일데이터명', '분류', '분류체계', '제공형태', '목록유형', 'URL', '데이터셋URL', '상세링크'].includes(key) ||
                    !value || 
                    value === '-' || 
                    String(value).trim() === ''
                  ) {
                    return null;
                  }
                  return <DetailRow key={key} label={key} value={String(value)} />;
                })}
              </div>

              {/* Footer */}
              <div className="p-4 sm:p-6 bg-white border-t border-black/5 flex gap-3">
                <button 
                  onClick={() => {
                    toggleDatasetSelection(selectedDetailItem['데이터셋명'] || selectedDetailItem['목록명'] || '');
                    setSelectedDetailItem(null);
                  }}
                  className={`flex-1 py-3.5 font-bold rounded-xl transition-colors flex items-center justify-center gap-2 ${
                    selectedDatasets.includes(selectedDetailItem['데이터셋명'] || selectedDetailItem['목록명'] || '')
                      ? 'bg-[#f2f4f6] text-[#4e5968] hover:bg-[#e5e8eb]'
                      : 'bg-[#3182f6] text-white hover:bg-blue-600'
                  }`}
                >
                  {selectedDatasets.includes(selectedDetailItem['데이터셋명'] || selectedDetailItem['목록명'] || '')
                    ? '선택 취소'
                    : '이 데이터 선택하기'}
                </button>
                <a 
                  href={`https://www.data.go.kr/search/index.do?index=data&query=${encodeURIComponent(selectedDetailItem['데이터셋명'] || selectedDetailItem['목록명'] || '')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-14 flex items-center justify-center bg-[#f2f4f6] text-[#4e5968] rounded-xl hover:bg-[#e5e8eb] transition-colors"
                  title="공공데이터포털에서 검색"
                >
                  <Search size={20} />
                </a>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

function DetailRow({ label, value }: { label: string, value?: string, key?: string | number }) {
  if (!value || value === '-' || value.trim() === '') return null;
  return (
    <div className="flex flex-col sm:flex-row sm:items-start justify-between py-3 border-b border-black/[0.02] last:border-0 gap-1 sm:gap-4">
      <span className="text-[13px] font-medium text-[#8b95a1] w-full sm:w-28 shrink-0 leading-relaxed">{label}</span>
      <span className="text-[14px] font-semibold text-[#333d4b] text-left sm:text-right break-words leading-relaxed flex-1">{value}</span>
    </div>
  );
}

function StatCard({ label, value, color }: { label: string, value: string, color: string }) {
  return (
    <div className="bg-white p-6 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-black/[0.02]">
      <p className="text-xs font-bold text-[#8b95a1] mb-1">{label}</p>
      <h3 className={`text-xl font-bold ${color}`}>{value}</h3>
    </div>
  );
}
