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
  const colors = [
    'bg-yellow-200',
    'bg-green-200',
    'bg-blue-200',
    'bg-pink-200',
    'bg-purple-200',
  ]

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

  // Render the highlighted overlay as React elements (no popover, no click handlers)
  // Use sortedExtract for both the table and the overlay color assignment
  const highlightedOverlay = useMemo(() => {
    if (!note) return null
    const elements: React.ReactNode[] = []
    let lastIdx = 0
    let text = note
    // Use sortedExtract for color assignment
    const termColors: Record<string, string> = {}
    sortedExtract.forEach((item, idx) => {
      if (item.text) termColors[item.text] = colors[idx % colors.length]
    })
    const terms = sortedExtract.map(item => escapeRegExp(item.text)).filter(Boolean)
    if (terms.length === 0) return note
    const regex = new RegExp(terms.join('|'), 'gi')
    let match
    let idx = 0
    while ((match = regex.exec(text)) !== null) {
      const word = match[0]
      const start = match.index
      const end = regex.lastIndex
      if (start > lastIdx) {
        elements.push(text.slice(lastIdx, start))
      }
      elements.push(
        <span
          key={idx}
          className={termColors[word] + ' rounded px-1'}
        >
          {word}
        </span>
      )
      lastIdx = end
      idx++
    }
    if (lastIdx < text.length) {
      elements.push(text.slice(lastIdx))
    }
    return elements
  }, [note, sortedExtract, colors])

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
      setExtract(data.result)
    } catch (err) {
      console.error('Error extracting annotations', err)
    } finally {
      setIsExtracting(false)
    }
  }

  // Row actions: remove or duplicate
  const handleRemoveExtract = (i: number) =>
    setExtract(prev => prev.filter((_, idx) => idx !== i))
  const handleDuplicateExtract = (i: number) =>
    setExtract(prev => {
      const copy = [...prev]
      copy.splice(i + 1, 0, { ...prev[i] })
      return copy
    })

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
    return item.id || `${item.text}__${item.category}__${item.subcategory}__${item.term}`;
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
          copy.splice(idx + 1, 0, { ...prev[idx] });
          return copy;
        });
      });
    } else {
      setExtract(prev => {
        const idx = prev.findIndex(item => getAnnotationId(item) === id);
        if (idx === -1) return prev;
        const copy = [...prev];
        copy.splice(idx + 1, 0, { ...prev[idx] });
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

  // Group sortedExtract into categories, subcategories, and terms
  const categoryRows = sortedExtract.filter(item => item.category && !item.subcategory && !item.term)
  const subcategoryRows = sortedExtract.filter(item => item.subcategory && !item.term)
  const termRows = sortedExtract.filter(item => item.term)

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

  function CategoryAnnotationsTable({ rows, sortedExtract, colors, collapsed, onToggleCollapse, ...handlers }: AnnotationTableProps & { collapsed: boolean, onToggleCollapse: () => void }) {
    if (rows.length === 0) return null;
    return (
      <div className={`flex flex-col mb-4 rounded border ${!collapsed ? 'min-h-[12rem] max-h-[24rem] overflow-y-auto' : ''}`}>
        <div className="font-semibold text-sm bg-gray-100 px-2 py-1 sticky top-0 z-20 flex items-center justify-between">
          <span>Categories</span>
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
                <th className="border px-1 py-1 w-10 text-center" title="Inclusion">➕</th>
                <th className="border px-1 py-1 w-10 text-center" title="Exclusion">➖</th>
                <th className="border px-1 py-1 w-8 text-center">+</th>
                <th className="border px-1 py-1 w-8 text-center">-</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((item, idx) => {
                const hl = colors[(sortedExtract.indexOf(item)) % colors.length]
                return (
                  <tr key={getAnnotationId(item)} className="hover:bg-gray-50 even:bg-gray-50 group">
                    <td className={`sticky left-0 z-10 border px-2 py-1 ${hl}`}>{item.text}</td>
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

  function SubcategoryAnnotationsTable({ rows, sortedExtract, colors, collapsed, onToggleCollapse, ...handlers }: AnnotationTableProps & { collapsed: boolean, onToggleCollapse: () => void }) {
    if (rows.length === 0) return null;
    return (
      <div className={`flex flex-col mb-4 rounded border ${!collapsed ? 'min-h-[12rem] max-h-[24rem] overflow-y-auto' : ''}`}>
        <div className="font-semibold text-sm bg-gray-100 px-2 py-1 sticky top-0 z-20 flex items-center justify-between">
          <span>Subcategories</span>
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
                <th className="border px-1 py-1 w-10 text-center" title="Inclusion">➕</th>
                <th className="border px-1 py-1 w-10 text-center" title="Exclusion">➖</th>
                <th className="border px-1 py-1 w-8 text-center">+</th>
                <th className="border px-1 py-1 w-8 text-center">-</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((item, idx) => {
                const hl = colors[(sortedExtract.indexOf(item)) % colors.length]
                return (
                  <tr key={getAnnotationId(item)} className="hover:bg-gray-50 even:bg-gray-50 group">
                    <td className={`sticky left-0 z-10 border px-2 py-1 ${hl}`}>{item.text}</td>
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

  function TermAnnotationsTable({ rows, sortedExtract, colors, collapsed, onToggleCollapse, tableRef, ...handlers }: AnnotationTableProps & { collapsed: boolean, onToggleCollapse: () => void, tableRef: React.RefObject<HTMLDivElement> }) {
    if (rows.length === 0) return null;
    return (
      <div ref={tableRef} className={`flex flex-col mb-4 rounded border ${!collapsed ? 'min-h-[12rem] max-h-[24rem] overflow-y-auto' : ''}`}>
        <div className="font-semibold text-sm bg-gray-100 px-2 py-1 sticky top-0 z-20 flex items-center justify-between">
          <span>Terms</span>
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
                <th className="border px-1 py-1 w-10 text-center" title="Inclusion">➕</th>
                <th className="border px-1 py-1 w-10 text-center" title="Exclusion">➖</th>
                <th className="border px-1 py-1 w-8 text-center">+</th>
                <th className="border px-1 py-1 w-8 text-center">-</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((item, idx) => {
                const hl = colors[(sortedExtract.indexOf(item)) % colors.length]
                return (
                  <tr key={getAnnotationId(item)} className="hover:bg-gray-50 even:bg-gray-50 group">
                    <td className={`sticky left-0 z-10 border px-2 py-1 ${hl}`}>{item.text}</td>
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
              <label className="block text-sm font-medium">Abstract</label>
              <div className="relative bg-gray-50 rounded border mb-0">
                {/* Highlighted overlay as React elements */}
                <div
                  ref={overlayRef}
                  className="absolute inset-0 p-2 whitespace-pre-wrap overflow-auto"
                  aria-hidden="true"
                  style={{ zIndex: 1 }}
                >
                  {highlightedOverlay}
                </div>
                {/* Textarea */}
                <textarea
                  ref={textareaRef}
                  className="relative w-full min-h-[6rem] max-h-[60vh] p-2 border-0 rounded resize-y bg-transparent text-transparent caret-black"
                  value={note}
                  onChange={e => setNote(e.target.value)}
                  placeholder="Enter full paper abstract…"
                  style={{ zIndex: 2, background: 'transparent', position: 'relative' }}
                  onScroll={e => {
                    const target = e.target as HTMLTextAreaElement;
                    if (highlightRef.current) {
                      highlightRef.current.scrollTop = target.scrollTop;
                      highlightRef.current.scrollLeft = target.scrollLeft;
                    }
                    if (overlayRef.current) {
                      overlayRef.current.scrollTop = target.scrollTop;
                      overlayRef.current.scrollLeft = target.scrollLeft;
                    }
                  }}
                  onClick={() => {}}
                />
              </div>
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
            </div>

            {/* Right: Extracted Annotations & Action Buttons */}
            <div className="flex flex-col flex-1 min-w-0">
              <h3 className="text-md font-semibold mb-2 border-b pb-1 flex-shrink-0">Extracted Annotations</h3>
              <div className="flex flex-col gap-4 flex-grow overflow-y-auto min-h-0">
                <TermAnnotationsTable
                  rows={termRows}
                  sortedExtract={sortedExtract}
                  colors={colors}
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
                  colors={colors}
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
                  colors={colors}
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
