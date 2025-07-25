import React, { useState, useEffect, useMemo, useRef } from 'react'
import { Category, Dataset, Annotation } from '../types'

interface AnnotationItem {
  text: string
  category: string
  subcategory: string
  term: string
  keyword: boolean
  inclusion: boolean
  exclusion: boolean
  id?: string // Added for unique identification
}

interface DatasetFilterProps {
  datasets: Dataset[]
  categories: Category[]
  keywordList: Annotation[]
  inclusionList: Annotation[]
  exclusionList: Annotation[]
  selectedCategory: Category | null
  onSelectDataset: (ds: Dataset) => void
  onRemoveKeyword: (ann: Annotation) => void
  onRemoveInclusion: (ann: Annotation) => void
  onRemoveExclusion: (ann: Annotation) => void
  onClearKeywords: () => void
  onClearInclusion: () => void
  onClearExclusion: () => void
  isAnnotating: boolean
  onAddAnnotations: (items: AnnotationItem[]) => void
  onSubmitAnnotations: (items: AnnotationItem[]) => void
  onCancelAnnotation: () => void
}

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

export default function DatasetFilter({
  datasets,
  categories,
  keywordList,
  inclusionList,
  exclusionList,
  selectedCategory,
  onSelectDataset,
  onRemoveKeyword,
  onRemoveInclusion,
  onRemoveExclusion,
  onClearKeywords,
  onClearInclusion,
  onClearExclusion,
  isAnnotating,
  onAddAnnotations,
  onSubmitAnnotations,
  onCancelAnnotation,
}: DatasetFilterProps) {
  // Colors for highlight spans (original, background only)
  // Replace the fixed colors array with a unique color generator
  function getColorForIndex(idx: number) {
    // Golden angle for best distribution
    const hue = (idx * 137.508) % 360;
    return `hsl(${hue}, 70%, 85%)`;
  }

  // Color functions for each group
  function getTermColor(idx: number) {
    const hue = (idx * 137.508) % 360;
    return `hsl(${hue}, 80%, 70%)`; // strong
  }
  function getSubcategoryColor(idx: number) {
    const hue = (idx * 137.508) % 360;
    return `hsl(${hue}, 60%, 85%)`; // medium
  }
  function getCategoryColor(idx: number) {
    const hue = (idx * 137.508) % 360;
    return `hsl(${hue}, 40%, 95%)`; // very light
  }

  // Build maps: category -> subcategories, subcategory -> terms
  const categoryMap: Record<string, string[]> = {}
  const subTermsMap: Record<string, string[]> = {}
  categories.forEach(cat => {
    categoryMap[cat.label] = cat.children.map(sub => sub.label)
    cat.children.forEach(sub => {
      subTermsMap[sub.label] = sub.children.map(t => t.label)
    })
  })
  const categoryOptions = Object.keys(categoryMap)

  // Top‐pane filters logic
  const hasFilters =
    keywordList.length > 0 ||
    inclusionList.length > 0 ||
    exclusionList.length > 0
  const filteredDatasets = hasFilters
    ? datasets.filter(ds =>
        keywordList.every(k => ds.keywords?.some(a => a.id === k.id)) &&
        inclusionList.every(i => ds.inclusionTerms?.some(a => a.id === i.id)) &&
        exclusionList.every(e => ds.exclusionTerms?.some(a => a.id === e.id))
      )
    : datasets

  // Annotation extraction state
  const [note, setNote] = useState('')
  const [extract, setExtract] = useState<AnnotationItem[]>([])
  // Loading state for extraction
  const [isExtracting, setIsExtracting] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const highlightRef = useRef<HTMLPreElement>(null)
  const overlayRef = useRef<HTMLDivElement>(null)

  // Add state for the save-to-user input
  const [saveToUser, setSaveToUser] = useState('');

  // Before rendering the table, sort extract by first appearance in note
  const sortedExtract = useMemo(() => {
    return [...extract].sort((a, b) => {
      const aIdx = note.toLowerCase().indexOf(a.text.toLowerCase());
      const bIdx = note.toLowerCase().indexOf(b.text.toLowerCase());
      if (aIdx === -1 && bIdx === -1) return 0;
      if (aIdx === -1) return 1;
      if (bIdx === -1) return -1;
      return aIdx - bIdx;
    });
  }, [extract, note]);

  // Group sortedExtract into terms, subcategories, and categories, filtering out redundant mappings
  const termRows = sortedExtract.filter(item => item.term)
  const subcategoryRows = sortedExtract.filter(item =>
    item.subcategory && !item.term &&
    // Exclude only if it's the exact same item (by ID) that appears in termRows, not just same text/subcategory
    !termRows.some(t => getAnnotationId(t) === getAnnotationId(item))
  )
  const categoryRows = sortedExtract.filter(item =>
    item.category && !item.subcategory && !item.term &&
    // Exclude only if it's the exact same item (by ID) that appears in termRows or subcategoryRows
    !termRows.some(t => getAnnotationId(t) === getAnnotationId(item)) &&
    !subcategoryRows.some(s => getAnnotationId(s) === getAnnotationId(item))
  )

  // Build color maps for each group using the filtered table order
  const termColorMap: Record<string, string> = {}
  termRows.forEach((item, idx) => {
    if (item.text) termColorMap[item.text + '||' + (item.term || '')] = getTermColor(idx)
  })
  const subcatColorMap: Record<string, string> = {}
  subcategoryRows.forEach((item, idx) => {
    if (item.text) subcatColorMap[item.text + '||' + (item.subcategory || '')] = getSubcategoryColor(idx)
  })
  const catColorMap: Record<string, string> = {}
  categoryRows.forEach((item, idx) => {
    if (item.text) catColorMap[item.text + '||' + (item.category || '')] = getCategoryColor(idx)
  })

  // Robust, whitespace-preserving highlighter for the preview
  function getHighlightPreview(text: string, sortedExtract: AnnotationItem[], termColorMap: Record<string, string>, subcatColorMap: Record<string, string>, catColorMap: Record<string, string>) {
    if (!text || sortedExtract.length === 0) return text;
    // Build a list of highlight ranges: { start, end, color, specificity }
    const ranges: { start: number, end: number, color: string, specificity: number }[] = [];
    sortedExtract.forEach(item => {
      let color = '';
      let specificity = 0;
      if (item.term) {
        color = termColorMap[item.text + '||' + (item.term || '')];
        specificity = 3;
      } else if (item.subcategory) {
        color = subcatColorMap[item.text + '||' + (item.subcategory || '')];
        specificity = 2;
      } else {
        color = catColorMap[item.text + '||' + (item.category || '')];
        specificity = 1;
      }
      if (!item.text) return;
      // Find all matches for this context
      const regex = new RegExp(item.text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
      let match;
      while ((match = regex.exec(text)) !== null) {
        const start = match.index;
        const end = start + item.text.length;
        ranges.push({ start, end, color, specificity });
      }
    });
    // Sort ranges by start, then by -end (longer matches first), then by -specificity (most specific first)
    ranges.sort((a, b) => a.start - b.start || b.end - a.end || b.specificity - a.specificity);
    // For each position, keep only the most specific highlight
    const highlightAt: Array<{ color: string } | null> = Array(text.length).fill(null);
    for (const r of ranges) {
      for (let i = r.start; i < r.end; ++i) {
        if (!highlightAt[i] || r.specificity > (ranges.find(rr => rr.start <= i && rr.end > i)?.specificity || 0)) {
          highlightAt[i] = { color: r.color };
        }
      }
    }
    // Build the preview as an array of React nodes
    const nodes: React.ReactNode[] = [];
    let lastIdx = 0;
    while (lastIdx < text.length) {
      const current = highlightAt[lastIdx];
      if (!current) {
        // Unhighlighted run
        let next = lastIdx;
        while (next < text.length && !highlightAt[next]) next++;
        nodes.push(text.slice(lastIdx, next));
        lastIdx = next;
      } else {
        // Highlighted run
        let next = lastIdx;
        while (next < text.length && highlightAt[next] && highlightAt[next]?.color === current.color) next++;
        nodes.push(
          <span key={lastIdx + '-' + next} style={{ background: current.color, color: 'black', borderRadius: 4, padding: '0 2px' }}>{text.slice(lastIdx, next)}</span>
        );
        lastIdx = next;
      }
    }
    return nodes;
  }

  useEffect(() => {
    if (isAnnotating) {
      setNote('')
      setExtract([])
    }
  }, [isAnnotating])

  // Call your API to extract entities via Python script
  const handleExtract = async () => {
    setIsExtracting(true)
    try {
      const res = await fetch('/api/extract-annotations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: note }),
      })
      const data = await res.json()
      // Assign unique IDs to each extracted item to ensure proper duplication
      const extractedWithIds = data.result.map((item: AnnotationItem, index: number) => ({
        ...item,
        id: `extracted_${Date.now()}_${index}_${Math.random().toString(36).substr(2, 9)}`
      }))
      setExtract(extractedWithIds)
    } catch (err) {
      console.error('Error extracting annotations', err)
    } finally {
      setIsExtracting(false)
    }
  }

  // Add handler for save-to-user
  async function handleSaveToUserDir() {
    if (!saveToUser.trim()) return;
    await fetch('/api/save-user-annotations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user: saveToUser.trim(),
        annotations: extract,
        text: note,
      }),
    });
    // Optionally show a success message
  }

  // Row actions: remove (old index-based functions kept for potential fallback)
  const handleRemoveExtract = (i: number) =>
    setExtract(prev => prev.filter((_, idx) => idx !== i))

  // Toggle flags
  const toggleFlag = (
    i: number,
    key: 'keyword' | 'inclusion' | 'exclusion'
  ) =>
    setExtract(prev => {
      const a = [...prev]
      a[i][key] = !a[i][key]
      return a
    })

  // Handle dropdown changes
  const handleCategoryChange = (i: number, v: string) =>
    setExtract(prev => {
      const a = [...prev]
      a[i].category = v
      a[i].subcategory = ''
      a[i].term = ''
      return a
    })
  const handleSubcategoryChange = (i: number, v: string) =>
    setExtract(prev => {
      const a = [...prev]
      a[i].subcategory = v
      a[i].term = ''
      return a
    })
  const handleTermChange = (i: number, v: string) =>
    setExtract(prev => {
      const a = [...prev]
      a[i].term = v
      return a
    })

  // Helper to get a unique id for an annotation item
  function getAnnotationId(item: AnnotationItem) {
    if (item.id) return item.id;
    // Generate a unique ID based on content, timestamp, and randomness if no ID exists
    return `${item.text}__${item.category}__${item.subcategory}__${item.term}__${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Helper to detect duplicate rows based on content
  function isDuplicateRow(item: AnnotationItem, allRows: AnnotationItem[]): boolean {
    const itemKey = `${item.text}__${item.category}__${item.subcategory}__${item.term}`;
    const duplicates = allRows.filter(row => {
      const rowKey = `${row.text}__${row.category}__${row.subcategory}__${row.term}`;
      return rowKey === itemKey;
    });
    return duplicates.length > 1;
  }

  // Update handlers to use id
  function toggleFlagById(id: string, key: 'keyword' | 'inclusion' | 'exclusion', tableRef?: React.RefObject<HTMLDivElement>) {
    if (tableRef) {
      preserveScroll(tableRef, () => {
        setExtract(prev => prev.map(item =>
          getAnnotationId(item) === id ? { ...item, [key]: !item[key] } : item
        ));
      });
    } else {
      setExtract(prev => prev.map(item =>
        getAnnotationId(item) === id ? { ...item, [key]: !item[key] } : item
      ));
    }
  }
  function handleDuplicateExtractById(id: string, tableRef?: React.RefObject<HTMLDivElement>) {
    if (tableRef) {
      preserveScroll(tableRef, () => {
        setExtract(prev => {
          const idx = prev.findIndex(item => getAnnotationId(item) === id);
          if (idx === -1) return prev;
          const copy = [...prev];
          const originalItem = prev[idx];
          // Create a deep copy with a new unique ID
          const duplicatedItem = {
            ...originalItem,
            id: `${originalItem.text}__${originalItem.category}__${originalItem.subcategory}__${originalItem.term}__${Date.now()}_${Math.random()}`
          };
          copy.splice(idx + 1, 0, duplicatedItem);
          return copy;
        });
      });
    } else {
      setExtract(prev => {
        const idx = prev.findIndex(item => getAnnotationId(item) === id);
        if (idx === -1) return prev;
        const copy = [...prev];
        const originalItem = prev[idx];
        // Create a deep copy with a new unique ID
        const duplicatedItem = {
          ...originalItem,
          id: `${originalItem.text}__${originalItem.category}__${originalItem.subcategory}__${originalItem.term}__${Date.now()}_${Math.random()}`
        };
        copy.splice(idx + 1, 0, duplicatedItem);
        return copy;
      });
    }
  }
  function handleRemoveExtractById(id: string, tableRef?: React.RefObject<HTMLDivElement>) {
    if (tableRef) {
      preserveScroll(tableRef, () => {
        setExtract(prev => prev.filter(item => getAnnotationId(item) !== id));
      });
    } else {
      setExtract(prev => prev.filter(item => getAnnotationId(item) !== id));
    }
  }
  function handleCategoryChangeById(id: string, v: string, tableRef?: React.RefObject<HTMLDivElement>) {
    if (tableRef) {
      preserveScroll(tableRef, () => {
        setExtract(prev => prev.map(item =>
          getAnnotationId(item) === id ? { ...item, category: v, subcategory: '', term: '' } : item
        ));
      });
    } else {
      setExtract(prev => prev.map(item =>
        getAnnotationId(item) === id ? { ...item, category: v, subcategory: '', term: '' } : item
      ));
    }
  }
  function handleSubcategoryChangeById(id: string, v: string, tableRef?: React.RefObject<HTMLDivElement>) {
    if (tableRef) {
      preserveScroll(tableRef, () => {
        setExtract(prev => prev.map(item =>
          getAnnotationId(item) === id ? { ...item, subcategory: v, term: '' } : item
        ));
      });
    } else {
      setExtract(prev => prev.map(item =>
        getAnnotationId(item) === id ? { ...item, subcategory: v, term: '' } : item
      ));
    }
  }
  function handleTermChangeById(id: string, v: string, tableRef?: React.RefObject<HTMLDivElement>) {
    if (tableRef) {
      preserveScroll(tableRef, () => {
        setExtract(prev => prev.map(item =>
          getAnnotationId(item) === id ? { ...item, term: v } : item
        ));
      });
    } else {
      setExtract(prev => prev.map(item =>
        getAnnotationId(item) === id ? { ...item, term: v } : item
      ));
    }
  }

  // Define prop types for the annotation table components
  interface AnnotationTableProps {
    rows: AnnotationItem[];
    sortedExtract: AnnotationItem[];
    colors: string[];
    handleCategoryChange: (id: string, v: string) => void;
    handleSubcategoryChange: (id: string, v: string) => void;
    handleTermChange: (id: string, v: string) => void;
    toggleFlag: (id: string, key: 'keyword' | 'inclusion' | 'exclusion') => void;
    handleDuplicateExtract: (id: string) => void;
    handleRemoveExtract: (id: string) => void;
    categoryOptions: string[];
    categoryMap: Record<string, string[]>;
    subTermsMap: Record<string, string[]>;
    tableRef?: React.RefObject<HTMLDivElement>; // Added for scroll preservation
  }

  // Add collapsed state for each table to the parent component
  const [collapsedTables, setCollapsedTables] = useState({
    terms: false,
    subcategories: false,
    categories: false,
  });
  const toggleTableCollapse = (key: 'terms' | 'subcategories' | 'categories') => {
    setCollapsedTables(prev => ({ ...prev, [key]: !prev[key] }));
  };

  // Add refs for scrollable containers (assert non-null)
  const termsTableRef = useRef<HTMLDivElement>(null!);
  const subcategoriesTableRef = useRef<HTMLDivElement>(null!);
  const categoriesTableRef = useRef<HTMLDivElement>(null!);

  // Helper to preserve and restore scroll position
  function preserveScroll(ref: React.RefObject<HTMLDivElement>, fn: () => void) {
    if (!ref.current) return fn();
    const left = ref.current.scrollLeft;
    const top = ref.current.scrollTop;
    fn();
    setTimeout(() => {
      if (ref.current) {
        ref.current.scrollLeft = left;
        ref.current.scrollTop = top;
      }
    }, 0);
  }

  function CategoryAnnotationsTable({ rows, sortedExtract, collapsed, onToggleCollapse, ...handlers }: AnnotationTableProps & { collapsed: boolean, onToggleCollapse: () => void }) {
    if (rows.length === 0) return null;
    return (
      <div className={`flex flex-col mb-4 rounded border ${!collapsed ? 'min-h-[12rem] max-h-[24rem] overflow-y-auto' : ''}`}>
        <div className="font-semibold text-sm bg-gray-100 px-2 py-1 sticky top-0 z-20 flex items-center justify-between">
          <span>Categories <span className="text-xs text-gray-600">(🔴 = duplicates)</span></span>
          <button
            className="ml-2 px-2 py-0.5 rounded text-xs border bg-white hover:bg-gray-200"
            onClick={onToggleCollapse}
          >
            {collapsed ? 'Expand' : 'Collapse'}
          </button>
        </div>
        {!collapsed && (
          <table className="w-full table-auto border-collapse">
            <thead className="sticky top-0 bg-white z-10">
              <tr>
                <th className="sticky left-0 bg-white z-10 border px-2 py-1 text-left w-40">Text</th>
                <th className="border px-1 py-1 w-32">Category</th>
                <th className="border px-1 py-1 w-32">Subcategory</th>
                <th className="border px-1 py-1 w-32">Term</th>
                <th className="border px-1 py-1 w-10 text-center" title="Keyword">🔑</th>
                <th className="border px-1 py-1 w-10 text-center" title="Inclusion"><span role="img" aria-label="Inclusion" className="text-green-600">✅</span></th>
                <th className="border px-1 py-1 w-10 text-center" title="Exclusion"><span role="img" aria-label="Exclusion" className="text-red-600">🛑</span></th>
                <th className="border px-1 py-1 w-8 text-center">+</th>
                <th className="border px-1 py-1 w-8 text-center">-</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((item, idx) => {
                const hl = catColorMap[item.text + '||' + (item.category || '')]
                const isDuplicate = isDuplicateRow(item, sortedExtract)
                return (
                  <tr key={getAnnotationId(item)} className={`hover:bg-gray-50 even:bg-gray-50 group ${isDuplicate ? 'border-2 border-red-500' : ''}`}>
                    <td className={`sticky left-0 z-10 border px-2 py-1`} style={{ background: hl, color: 'black' }}>{item.text}</td>
                    <td className="border px-1 py-1">
                      <select value={item.category} onChange={e => handlers.handleCategoryChange(getAnnotationId(item), e.target.value)} className="border rounded px-1 py-0.5">
                        <option value="">None</option>
                        {handlers.categoryOptions.map(c => (<option key={c} value={c}>{c}</option>))}
                      </select>
                    </td>
                    <td className="border px-1 py-1">
                      <select value={item.subcategory} onChange={e => handlers.handleSubcategoryChange(getAnnotationId(item), e.target.value)} className="border rounded px-1 py-0.5">
                        <option value="">None</option>
                        {(handlers.categoryMap[item.category] || []).map(sub => (<option key={sub} value={sub}>{sub}</option>))}
                      </select>
                    </td>
                    <td className="border px-1 py-1">
                      <select value={item.term} onChange={e => handlers.handleTermChange(getAnnotationId(item), e.target.value)} className="border rounded px-1 py-0.5">
                        <option value="">None</option>
                        {(handlers.subTermsMap[item.subcategory] || []).map(t => (<option key={t} value={t}>{t}</option>))}
                      </select>
                    </td>
                    <td className="border px-1 py-1 text-center align-middle">
                      <input type="checkbox" checked={item.keyword} onChange={() => handlers.toggleFlag(getAnnotationId(item), 'keyword')} className="w-4 h-4 mx-auto" />
                    </td>
                    <td className="border px-1 py-1 text-center align-middle">
                      <input type="checkbox" checked={item.inclusion} onChange={() => handlers.toggleFlag(getAnnotationId(item), 'inclusion')} className="w-4 h-4 mx-auto" />
                    </td>
                    <td className="border px-1 py-1 text-center align-middle">
                      <input type="checkbox" checked={item.exclusion} onChange={() => handlers.toggleFlag(getAnnotationId(item), 'exclusion')} className="w-4 h-4 mx-auto" />
                    </td>
                    <td className="border px-1 py-1 text-center">
                      <button onClick={() => handlers.handleDuplicateExtract(getAnnotationId(item))} className="text-green-500 opacity-0 group-hover:opacity-100 transition">+</button>
                    </td>
                    <td className="border px-1 py-1 text-center">
                      <button onClick={() => handlers.handleRemoveExtract(getAnnotationId(item))} className="text-red-500 opacity-0 group-hover:opacity-100 transition">-</button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    );
  }

  function SubcategoryAnnotationsTable({ rows, sortedExtract, collapsed, onToggleCollapse, tableRef, ...handlers }: AnnotationTableProps & { collapsed: boolean, onToggleCollapse: () => void, tableRef: React.RefObject<HTMLDivElement> }) {
    if (rows.length === 0) return null;
    return (
      <div ref={tableRef} className={`flex flex-col mb-4 rounded border ${!collapsed ? 'min-h-[12rem] max-h-[24rem] overflow-y-auto' : ''}`}>
        <div className="font-semibold text-sm bg-gray-100 px-2 py-1 sticky top-0 z-20 flex items-center justify-between">
          <span>Subcategories <span className="text-xs text-gray-600">(🔴 = duplicates)</span></span>
          <button
            className="ml-2 px-2 py-0.5 rounded text-xs border bg-white hover:bg-gray-200"
            onClick={onToggleCollapse}
          >
            {collapsed ? 'Expand' : 'Collapse'}
          </button>
        </div>
        {!collapsed && (
          <table className="w-full table-auto border-collapse">
            <thead className="sticky top-0 bg-white z-10">
              <tr>
                <th className="sticky left-0 bg-white z-10 border px-2 py-1 text-left w-40">Text</th>
                <th className="border px-1 py-1 w-32">Category</th>
                <th className="border px-1 py-1 w-32">Subcategory</th>
                <th className="border px-1 py-1 w-32">Term</th>
                <th className="border px-1 py-1 w-10 text-center" title="Keyword">🔑</th>
                <th className="border px-1 py-1 w-10 text-center" title="Inclusion"><span role="img" aria-label="Inclusion" className="text-green-600">✅</span></th>
                <th className="border px-1 py-1 w-10 text-center" title="Exclusion"><span role="img" aria-label="Exclusion" className="text-red-600">🛑</span></th>
                <th className="border px-1 py-1 w-8 text-center">+</th>
                <th className="border px-1 py-1 w-8 text-center">-</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((item, idx) => {
                const hl = subcatColorMap[item.text + '||' + (item.subcategory || '')]
                const isDuplicate = isDuplicateRow(item, sortedExtract)
                return (
                  <tr key={getAnnotationId(item)} className={`hover:bg-gray-50 even:bg-gray-50 group ${isDuplicate ? 'border-2 border-red-500' : ''}`}>
                    <td className={`sticky left-0 z-10 border px-2 py-1`} style={{ background: hl, color: 'black' }}>{item.text}</td>
                    <td className="border px-1 py-1">
                      <select value={item.category} onChange={e => handlers.handleCategoryChange(getAnnotationId(item), e.target.value)} className="border rounded px-1 py-0.5">
                        <option value="">None</option>
                        {handlers.categoryOptions.map(c => (<option key={c} value={c}>{c}</option>))}
                      </select>
                    </td>
                    <td className="border px-1 py-1">
                      <select value={item.subcategory} onChange={e => handlers.handleSubcategoryChange(getAnnotationId(item), e.target.value)} className="border rounded px-1 py-0.5">
                        <option value="">None</option>
                        {(handlers.categoryMap[item.category] || []).map(sub => (<option key={sub} value={sub}>{sub}</option>))}
                      </select>
                    </td>
                    <td className="border px-1 py-1">
                      <select value={item.term} onChange={e => handlers.handleTermChange(getAnnotationId(item), e.target.value)} className="border rounded px-1 py-0.5">
                        <option value="">None</option>
                        {(handlers.subTermsMap[item.subcategory] || []).map(t => (<option key={t} value={t}>{t}</option>))}
                      </select>
                    </td>
                    <td className="border px-1 py-1 text-center align-middle">
                      <input type="checkbox" checked={item.keyword} onChange={() => handlers.toggleFlag(getAnnotationId(item), 'keyword')} className="w-4 h-4 mx-auto" />
                    </td>
                    <td className="border px-1 py-1 text-center align-middle">
                      <input type="checkbox" checked={item.inclusion} onChange={() => handlers.toggleFlag(getAnnotationId(item), 'inclusion')} className="w-4 h-4 mx-auto" />
                    </td>
                    <td className="border px-1 py-1 text-center align-middle">
                      <input type="checkbox" checked={item.exclusion} onChange={() => handlers.toggleFlag(getAnnotationId(item), 'exclusion')} className="w-4 h-4 mx-auto" />
                    </td>
                    <td className="border px-1 py-1 text-center">
                      <button onClick={() => handlers.handleDuplicateExtract(getAnnotationId(item))} className="text-green-500 opacity-0 group-hover:opacity-100 transition">+</button>
                    </td>
                    <td className="border px-1 py-1 text-center">
                      <button onClick={() => handlers.handleRemoveExtract(getAnnotationId(item))} className="text-red-500 opacity-0 group-hover:opacity-100 transition">-</button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    );
  }

  function TermAnnotationsTable({ rows, sortedExtract, collapsed, onToggleCollapse, tableRef, ...handlers }: AnnotationTableProps & { collapsed: boolean, onToggleCollapse: () => void, tableRef: React.RefObject<HTMLDivElement> }) {
    if (rows.length === 0) return null;
    return (
      <div ref={tableRef} className={`flex flex-col mb-4 rounded border ${!collapsed ? 'min-h-[12rem] max-h-[24rem] overflow-y-auto' : ''}`}>
        <div className="font-semibold text-sm bg-gray-100 px-2 py-1 sticky top-0 z-20 flex items-center justify-between">
          <span>Terms <span className="text-xs text-gray-600">(🔴 = duplicates)</span></span>
          <button
            className="ml-2 px-2 py-0.5 rounded text-xs border bg-white hover:bg-gray-200"
            onClick={onToggleCollapse}
          >
            {collapsed ? 'Expand' : 'Collapse'}
          </button>
        </div>
        {!collapsed && (
          <table className="w-full table-auto border-collapse">
            <thead className="sticky top-0 bg-white z-10">
              <tr>
                <th className="sticky left-0 bg-white z-10 border px-2 py-1 text-left w-40">Text</th>
                <th className="border px-1 py-1 w-32">Category</th>
                <th className="border px-1 py-1 w-32">Subcategory</th>
                <th className="border px-1 py-1 w-32">Term</th>
                <th className="border px-1 py-1 w-10 text-center" title="Keyword">🔑</th>
                <th className="border px-1 py-1 w-10 text-center" title="Inclusion"><span role="img" aria-label="Inclusion" className="text-green-600">✅</span></th>
                <th className="border px-1 py-1 w-10 text-center" title="Exclusion"><span role="img" aria-label="Exclusion" className="text-red-600">🛑</span></th>
                <th className="border px-1 py-1 w-8 text-center">+</th>
                <th className="border px-1 py-1 w-8 text-center">-</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((item, idx) => {
                const hl = termColorMap[item.text + '||' + (item.term || '')]
                const isDuplicate = isDuplicateRow(item, sortedExtract)
                return (
                  <tr key={getAnnotationId(item)} className={`hover:bg-gray-50 even:bg-gray-50 group ${isDuplicate ? 'border-2 border-red-500' : ''}`}>
                    <td className={`sticky left-0 z-10 border px-2 py-1`} style={{ background: hl, color: 'black' }}>{item.text}</td>
                    <td className="border px-1 py-1">
                      <select value={item.category} onChange={e => handlers.handleCategoryChange(getAnnotationId(item), e.target.value)} className="border rounded px-1 py-0.5">
                        <option value="">None</option>
                        {handlers.categoryOptions.map(c => (<option key={c} value={c}>{c}</option>))}
                      </select>
                    </td>
                    <td className="border px-1 py-1">
                      <select value={item.subcategory} onChange={e => handlers.handleSubcategoryChange(getAnnotationId(item), e.target.value)} className="border rounded px-1 py-0.5">
                        <option value="">None</option>
                        {(handlers.categoryMap[item.category] || []).map(sub => (<option key={sub} value={sub}>{sub}</option>))}
                      </select>
                    </td>
                    <td className="border px-1 py-1">
                      <select value={item.term} onChange={e => handlers.handleTermChange(getAnnotationId(item), e.target.value)} className="border rounded px-1 py-0.5">
                        <option value="">None</option>
                        {(handlers.subTermsMap[item.subcategory] || []).map(t => (<option key={t} value={t}>{t}</option>))}
                      </select>
                    </td>
                    <td className="border px-1 py-1 text-center align-middle">
                      <input type="checkbox" checked={item.keyword} onChange={() => handlers.toggleFlag(getAnnotationId(item), 'keyword')} className="w-4 h-4 mx-auto" />
                    </td>
                    <td className="border px-1 py-1 text-center align-middle">
                      <input type="checkbox" checked={item.inclusion} onChange={() => handlers.toggleFlag(getAnnotationId(item), 'inclusion')} className="w-4 h-4 mx-auto" />
                    </td>
                    <td className="border px-1 py-1 text-center align-middle">
                      <input type="checkbox" checked={item.exclusion} onChange={() => handlers.toggleFlag(getAnnotationId(item), 'exclusion')} className="w-4 h-4 mx-auto" />
                    </td>
                    <td className="border px-1 py-1 text-center">
                      <button onClick={() => handlers.handleDuplicateExtract(getAnnotationId(item))} className="text-green-500 opacity-0 group-hover:opacity-100 transition">+</button>
                    </td>
                    <td className="border px-1 py-1 text-center">
                      <button onClick={() => handlers.handleRemoveExtract(getAnnotationId(item))} className="text-red-500 opacity-0 group-hover:opacity-100 transition">-</button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    );
  }

  return (
    <div className="p-4 border-r flex flex-col h-full">
      {/* Top filters */}
      <div className="grid grid-cols-3 gap-4 mb-4">
        {/* Keywords */}
        <div>
          <div className="flex justify-between mb-2">
            <span className="font-semibold">Keywords:</span>
            <button
              onClick={onClearKeywords}
              className="text-sm px-2 py-0.5 border rounded bg-indigo-100 hover:bg-indigo-200"
            >
              Clear
            </button>
          </div>
          {keywordList.length > 0 ? (
            keywordList.map(ann => (
              <span
                key={ann.id}
                onClick={() => onRemoveKeyword(ann)}
                className="block mb-2 px-2 py-0.5 bg-indigo-100 rounded cursor-pointer"
              >
                {ann.label}
              </span>
            ))
          ) : (
            <div className="text-gray-500">None</div>
          )}
        </div>
        {/* Inclusion Terms */}
        <div>
          <div className="flex justify-between mb-2">
            <span className="font-semibold">Inclusion Terms:</span>
            <button
              onClick={onClearInclusion}
              className="text-sm px-2 py-0.5 border rounded bg-green-100 hover:bg-green-200"
            >
              Clear
            </button>
          </div>
          {inclusionList.length > 0 ? (
            inclusionList.map(ann => (
              <span
                key={ann.id}
                onClick={() => onRemoveInclusion(ann)}
                className="block mb-2 px-2 py-0.5 bg-green-100 rounded cursor-pointer"
              >
                {ann.label}
              </span>
            ))
          ) : (
            <div className="text-gray-500">None</div>
          )}
        </div>
        {/* Exclusion Terms */}
        <div>
          <div className="flex justify-between mb-2">
            <span className="font-semibold">Exclusion Terms:</span>
            <button
              onClick={onClearExclusion}
              className="text-sm px-2 py-0.5 border rounded bg-red-100 hover:bg-red-200"
            >
              Clear
            </button>
          </div>
          {exclusionList.length > 0 ? (
            exclusionList.map(ann => (
              <span
                key={ann.id}
                onClick={() => onRemoveExclusion(ann)}
                className="block mb-2 px-2 py-0.5 bg-red-100 rounded cursor-pointer"
              >
                {ann.label}
              </span>
            ))
          ) : (
            <div className="text-gray-500">None</div>
          )}
        </div>
      </div>

      {isAnnotating ? (
        <div className="bg-white rounded-xl shadow-lg p-6 mb-6 w-full max-w-full max-h-[90vh] min-h-[60vh] flex flex-col">
          {/* Card Header */}
          <h2 className="text-lg font-bold mb-4 border-b pb-2">Annotation Extraction</h2>

          {/* Two-column layout */}
          <div className="flex flex-row gap-8 flex-grow min-h-0">
            {/* Left: Abstract & Extract Button */}
            <div className="flex flex-col flex-1 min-w-0 gap-4">
              <div className="relative bg-gray-50 rounded border mb-0">
                {/* Show textarea only if not in extracted mode */}
                {extract.length === 0 ? (
                  <textarea
                    ref={textareaRef}
                    className="relative w-full min-h-[6rem] max-h-[60vh] p-2 border-0 rounded resize-y bg-transparent text-black caret-black"
                    value={note}
                    onChange={e => setNote(e.target.value)}
                    placeholder="Enter text …"
                    style={{ zIndex: 2, background: 'transparent', position: 'relative' }}
                  />
                ) : (
                  <pre
                    className="mt-0 p-2 border-0 rounded resize-y w-full min-h-[6rem] max-h-[60vh] overflow-auto whitespace-pre-wrap text-black bg-white"
                    style={{ resize: 'vertical' }}
                  >
                    {getHighlightPreview(note, sortedExtract, termColorMap, subcatColorMap, catColorMap)}
                  </pre>
                )}
              </div>
              {/* Button below input/preview */}
              {extract.length === 0 ? (
                <button
                  onClick={handleExtract}
                  disabled={isExtracting}
                  className={`w-full px-4 py-2 rounded shadow ${isExtracting ? 'bg-gray-300 cursor-not-allowed' : 'bg-gray-200 hover:bg-gray-300'}`}
                >
                  {isExtracting ? (
                    <span className="inline-flex items-center">
                      <span className="w-4 h-4 mr-2 border-2 border-t-transparent border-gray-700 rounded-full animate-spin" aria-hidden="true" />
                      Extracting…
                    </span>
                  ) : (
                    'Extract annotations'
                  )}
                </button>
              ) : (
                <button
                  onClick={() => {
                    setNote('');
                    setExtract([]);
                    // Optionally reset any other annotation state if needed
                  }}
                  className="w-full px-4 py-2 rounded shadow bg-gray-200 hover:bg-gray-300"
                >
                  New input
                </button>
              )}
              <div className="flex items-center gap-2 mt-2">
                <button
                  onClick={handleSaveToUserDir}
                  className="px-4 py-2 rounded bg-indigo-500 text-white hover:bg-indigo-600"
                >
                  Save to
                </button>
                <input
                  type="text"
                  className="border rounded px-2 py-1 flex-1"
                  placeholder="user directory"
                  value={saveToUser}
                  onChange={e => setSaveToUser(e.target.value)}
                />
              </div>
            </div>

            {/* Right: Extracted Annotations & Action Buttons */}
            <div className="flex flex-col flex-1 min-w-0">
              <h3 className="text-md font-semibold mb-2 border-b pb-1 flex-shrink-0">Extracted Annotations</h3>
              <div className="flex flex-col gap-4 flex-grow overflow-y-auto min-h-0">
                <TermAnnotationsTable
                  rows={termRows}
                  sortedExtract={sortedExtract}
                  colors={[]} // No longer needed, colors are generated dynamically
                  collapsed={collapsedTables.terms}
                  onToggleCollapse={() => toggleTableCollapse('terms')}
                  handleCategoryChange={(id, v) => handleCategoryChangeById(id, v, termsTableRef)}
                  handleSubcategoryChange={(id, v) => handleSubcategoryChangeById(id, v, termsTableRef)}
                  handleTermChange={(id, v) => handleTermChangeById(id, v, termsTableRef)}
                  toggleFlag={(id, key) => toggleFlagById(id, key, termsTableRef)}
                  handleDuplicateExtract={id => handleDuplicateExtractById(id, termsTableRef)}
                  handleRemoveExtract={id => handleRemoveExtractById(id, termsTableRef)}
                  categoryOptions={categoryOptions}
                  categoryMap={categoryMap}
                  subTermsMap={subTermsMap}
                  tableRef={termsTableRef as React.RefObject<HTMLDivElement>}
                />
                <SubcategoryAnnotationsTable
                  rows={subcategoryRows}
                  sortedExtract={sortedExtract}
                  colors={[]} // No longer needed, colors are generated dynamically
                  collapsed={collapsedTables.subcategories}
                  onToggleCollapse={() => toggleTableCollapse('subcategories')}
                  handleCategoryChange={(id, v) => handleCategoryChangeById(id, v, subcategoriesTableRef)}
                  handleSubcategoryChange={(id, v) => handleSubcategoryChangeById(id, v, subcategoriesTableRef)}
                  handleTermChange={(id, v) => handleTermChangeById(id, v, subcategoriesTableRef)}
                  toggleFlag={(id, key) => toggleFlagById(id, key, subcategoriesTableRef)}
                  handleDuplicateExtract={id => handleDuplicateExtractById(id, subcategoriesTableRef)}
                  handleRemoveExtract={id => handleRemoveExtractById(id, subcategoriesTableRef)}
                  categoryOptions={categoryOptions}
                  categoryMap={categoryMap}
                  subTermsMap={subTermsMap}
                  tableRef={subcategoriesTableRef as React.RefObject<HTMLDivElement>}
                />
                <CategoryAnnotationsTable
                  rows={categoryRows}
                  sortedExtract={sortedExtract}
                  colors={[]} // No longer needed, colors are generated dynamically
                  collapsed={collapsedTables.categories}
                  onToggleCollapse={() => toggleTableCollapse('categories')}
                  handleCategoryChange={(id, v) => handleCategoryChangeById(id, v, categoriesTableRef)}
                  handleSubcategoryChange={(id, v) => handleSubcategoryChangeById(id, v, categoriesTableRef)}
                  handleTermChange={(id, v) => handleTermChangeById(id, v, categoriesTableRef)}
                  toggleFlag={(id, key) => toggleFlagById(id, key, categoriesTableRef)}
                  handleDuplicateExtract={id => handleDuplicateExtractById(id, categoriesTableRef)}
                  handleRemoveExtract={id => handleRemoveExtractById(id, categoriesTableRef)}
                  categoryOptions={categoryOptions}
                  categoryMap={categoryMap}
                  subTermsMap={subTermsMap}
                  tableRef={categoriesTableRef as React.RefObject<HTMLDivElement>}
                />
              </div>
              <div className="flex justify-center gap-4 flex-shrink-0 mt-4">
                <button
                  onClick={() => onAddAnnotations(sortedExtract)}
                  className="px-4 py-2 bg-green-200 rounded shadow hover:bg-green-300"
                >
                  Add annotations
                </button>
                <button
                  onClick={() => onSubmitAnnotations(sortedExtract)}
                  className="px-4 py-2 bg-blue-500 text-white rounded shadow hover:bg-blue-600"
                >
                  Submit Annotations
                </button>
                <button
                  onClick={onCancelAnnotation}
                  className="px-4 py-2 bg-gray-300 rounded shadow hover:bg-gray-400"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <ul className="overflow-auto flex-1">
          {filteredDatasets.map((ds, i) => (
            <li
              key={ds.id}
              onClick={() => onSelectDataset(ds)}
              className={`cursor-pointer py-1 hover:bg-gray-100 px-2 ${i % 2 === 0 ? 'bg-gray-200' : ''}`}
            >
              <div className="font-semibold">{ds.label}</div>
              <div className="flex flex-wrap gap-1 mt-1">
                {(ds.keywords ?? []).map(ann => (
                  <span key={ann.id} className="bg-indigo-100 text-indigo-800 text-xs rounded px-2 py-0.5">{ann.label}</span>
                ))}
                {(ds.inclusionTerms ?? []).map(ann => (
                  <span key={ann.id} className="bg-green-100 text-green-800 text-xs rounded px-2 py-0.5">{ann.label}</span>
                ))}
                {(ds.exclusionTerms ?? []).map(ann => (
                  <span key={ann.id} className="bg-red-100 text-red-800 text-xs rounded px-2 py-0.5">{ann.label}</span>
                ))}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
