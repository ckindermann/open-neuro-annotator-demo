import React, { useState, useEffect, useMemo, useRef } from 'react'
import { Category, Dataset, Annotation } from '../types'

interface AnnotationItem {
  text: string
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
  onSubmitAnnotations: () => void
  onCancelAnnotation: () => void
  onAddKeyword: (ann: Annotation) => void
  onAddInclusion: (ann: Annotation) => void
  onAddExclusion: (ann: Annotation) => void
}

// escape regex special characters for highlighting
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
  onSubmitAnnotations,
  onCancelAnnotation,
  onAddKeyword,
  onAddInclusion,
  onAddExclusion,
}: DatasetFilterProps) {
  const colors = [
    'bg-yellow-200',
    'bg-green-200',
    'bg-blue-200',
    'bg-pink-200',
    'bg-purple-200',
  ]

  // Build a map of subcategory → its term labels
  const subTermsMap: Record<string, string[]> = {}
  categories.forEach(cat =>
    cat.children.forEach(sub => {
      subTermsMap[sub.id] = sub.children.map(t => t.label)
    })
  )
  const subcategories = Object.keys(subTermsMap)

  // Use datasets prop directly
  const allDatasets: Dataset[] = datasets

  // Apply current filters (matching by Annotation.id)
  const hasFilters =
    keywordList.length > 0 ||
    inclusionList.length > 0 ||
    exclusionList.length > 0

  const filteredDatasets = hasFilters
    ? allDatasets.filter(ds =>
        keywordList.every(k =>
          ds.keywords?.some(ann => ann.id === k.id)
        ) &&
        inclusionList.every(i =>
          ds.inclusionTerms?.some(ann => ann.id === i.id)
        ) &&
        exclusionList.every(e =>
          ds.exclusionTerms?.some(ann => ann.id === e.id)
        )
      )
    : allDatasets

  // Annotation‐extraction UI state
  const [note, setNote] = useState('')
  const [extract, setExtract] = useState<AnnotationItem[]>([])
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (isAnnotating) {
      setNote('')
      setExtract([])
    }
  }, [isAnnotating])

  // Highlighted HTML for extracted tokens
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

  // Fetch extraction from Python script
  const handleExtract = async () => {
    try {
      const res = await fetch('/api/extract-annotations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: note }),
      })
      const data = await res.json()
      setExtract(data.result)
    } catch (err) {
      console.error('Extraction error', err)
    }
  }

  // Toggling flags and changing subcategory/term per token
  const toggleKeywordFlag = (i: number) => {
    const a = [...extract]
    a[i].keyword = !a[i].keyword
    setExtract(a)
  }
  const toggleInclusionFlag = (i: number) => {
    const a = [...extract]
    a[i].inclusion = !a[i].inclusion
    setExtract(a)
  }
  const toggleExclusionFlag = (i: number) => {
    const a = [...extract]
    a[i].exclusion = !a[i].exclusion
    setExtract(a)
  }
  const handleSubcategoryChange = (i: number, v: string) => {
    const a = [...extract]
    a[i].subcategory = v
    a[i].term = ''
    setExtract(a)
  }
  const handleTermChange = (i: number, v: string) => {
    const a = [...extract]
    a[i].term = v
    setExtract(a)
  }

  return (
    <div className="p-4 border-r">
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
              onClick={onSubmitAnnotations}
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
          {/* Extract Annotations */}
          <div className="flex justify-center mb-4">
            <button
              onClick={handleExtract}
              className="px-4 py-2 bg-gray-200 rounded"
            >
              Extract annotations
            </button>
          </div>
          {/* Annotation Table */}
          <table className="w-full table-auto border-collapse">
            <thead>
              <tr>
                {['Text', 'Subcategory', 'Term', 'Keyword', 'Inclusion', 'Exclusion'].map(
                  col => (
                    <th
                      key={col}
                      className="border px-2 py-1 bg-gray-100 text-left"
                    >
                      {col}
                    </th>
                  )
                )}
              </tr>
            </thead>
            <tbody>
              {extract.map((item, idx) => {
                const hl = colors[idx % colors.length]
                return (
                  <tr key={idx} className="hover:bg-gray-50">
                    <td className={`border px-2 py-1 ${hl}`}>{item.text}</td>
                    <td className="border px-2 py-1">
                      <select
                        value={item.subcategory}
                        onChange={e =>
                          handleSubcategoryChange(idx, e.target.value)
                        }
                        className="border rounded px-1 py-0.5"
                      >
                        <option value="">None</option>
                        {subcategories.map(s => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="border px-2 py-1">
                      <select
                        value={item.term}
                        onChange={e => handleTermChange(idx, e.target.value)}
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
                        onChange={() => toggleKeywordFlag(idx)}
                      />
                    </td>
                    <td className="border px-2 py-1 text-center">
                      <input
                        type="checkbox"
                        checked={item.inclusion}
                        onChange={() => toggleInclusionFlag(idx)}
                      />
                    </td>
                    <td className="border px-2 py-1 text-center">
                      <input
                        type="checkbox"
                        checked={item.exclusion}
                        onChange={() => toggleExclusionFlag(idx)}
                      />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </>
      ) : (
        <ul>
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
