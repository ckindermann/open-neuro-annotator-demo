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
  // Colors for highlight spans
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
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (isAnnotating) {
      setNote('')
      setExtract([])
    }
  }, [isAnnotating])

  const highlightedHTML = useMemo(() => {
    let html = note
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\n/g, '<br/>')
    extract.forEach((item, idx) => {
      const cls = colors[idx % colors.length]
      const token = escapeRegExp(item.text)
      html = html.replace(
        new RegExp(`\\b${token}\\b`, 'g'),
        `<span class="${cls}">${item.text}</span>`
      )
    })
    return html
  }, [note, extract])

  // Call your API to extract entities via Python script
  const handleExtract = async () => {
    const res = await fetch('/api/extract-annotations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: note }),
    })
    const data = await res.json()
    // data.result is an array of { text, category, subcategory, term, keyword, inclusion, exclusion }
    setExtract(data.result)
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
        <>
          {/* Submit & Cancel */}
          <div className="flex justify-center mb-4 space-x-4">
            <button
              onClick={() => onSubmitAnnotations(extract)}
              className="px-4 py-2 bg-blue-500 text-white rounded"
            >
              Submit Annotations
            </button>
            <button
              onClick={onCancelAnnotation}
              className="px-4 py-2 bg-gray-300 rounded"
            >
              Cancel
            </button>
          </div>

          {/* Abstract & Highlight */}
          <div className="relative mb-4">
            {extract.length > 0 && (
              <pre className="absolute inset-0 p-2 whitespace-pre-wrap pointer-events-none">
                <span
                  dangerouslySetInnerHTML={{ __html: highlightedHTML }}
                />
              </pre>
            )}
            <textarea
              ref={textareaRef}
              className={`relative w-full h-40 p-2 border rounded resize-none ${
                extract.length > 0
                  ? 'bg-transparent text-transparent caret-black'
                  : ''
              }`}
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="Enter full paper abstract…"
            />
          </div>

          {/* Extract & Add */}
          <div className="flex justify-center mb-4 space-x-4">
            <button
              onClick={handleExtract}
              className="px-4 py-2 bg-gray-200 rounded"
            >
              Extract annotations
            </button>
            <button
              onClick={() => onAddAnnotations(extract)}
              className="px-4 py-2 bg-green-200 rounded"
            >
              Add annotations
            </button>
          </div>

          {/* Annotation Table */}
          <table className="w-full table-auto border-collapse">
            <thead>
              <tr>
                {[
                  'Text',
                  'Category',
                  'Subcategory',
                  'Term',
                  'Keyword',
                  'Inclusion',
                  'Exclusion',
                  '+',
                  '-',
                ].map(col => (
                  <th
                    key={col}
                    className="border px-2 py-1 bg-gray-100 text-left"
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {extract.map((item, idx) => {
                const hl = colors[idx % colors.length]
                return (
                  <tr key={idx} className="hover:bg-gray-50">
                    <td className={`border px-2 py-1 ${hl}`}>
                      {item.text}
                    </td>
                    <td className="border px-2 py-1">
                      <select
                        value={item.category}
                        onChange={e =>
                          handleCategoryChange(idx, e.target.value)
                        }
                        className="border rounded px-1 py-0.5"
                      >
                        <option value="">None</option>
                        {categoryOptions.map(c => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="border px-2 py-1">
                      <select
                        value={item.subcategory}
                        onChange={e =>
                          handleSubcategoryChange(idx, e.target.value)
                        }
                        className="border rounded px-1 py-0.5"
                      >
                        <option value="">None</option>
                        {(categoryMap[item.category] || []).map(sub => (
                          <option key={sub} value={sub}>
                            {sub}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="border px-2 py-1">
                      <select
                        value={item.term}
                        onChange={e =>
                          handleTermChange(idx, e.target.value)
                        }
                        className="border rounded px-1 py-0.5"
                      >
                        <option value="">None</option>
                        {(subTermsMap[item.subcategory] || []).map(t => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="border px-2 py-1 text-center">
                      <input
                        type="checkbox"
                        checked={item.keyword}
                        onChange={() => toggleFlag(idx, 'keyword')}
                      />
                    </td>
                    <td className="border px-2 py-1 text-center">
                      <input
                        type="checkbox"
                        checked={item.inclusion}
                        onChange={() => toggleFlag(idx, 'inclusion')}
                      />
                    </td>
                    <td className="border px-2 py-1 text-center">
                      <input
                        type="checkbox"
                        checked={item.exclusion}
                        onChange={() => toggleFlag(idx, 'exclusion')}
                      />
                    </td>
                    <td className="border px-2 py-1 text-center">
                      <button
                        onClick={() => handleDuplicateExtract(idx)}
                        className="text-green-500"
                      >
                        +
                      </button>
                    </td>
                    <td className="border px-2 py-1 text-center">
                      <button
                        onClick={() => handleRemoveExtract(idx)}
                        className="text-red-500"
                      >
                        -
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </>
      ) : (
        <ul className="overflow-auto flex-1">
          {filteredDatasets.map(ds => (
            <li
              key={ds.id}
              onClick={() => onSelectDataset(ds)}
              className="cursor-pointer py-1 hover:bg-gray-100"
            >
              {ds.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
