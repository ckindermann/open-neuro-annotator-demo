// components/DatasetFilter.tsx
import { useState, useEffect } from 'react'
import { Category, Dataset } from '../types'

interface AnnotationItem {
  text: string
  subcategory: string
  term: string
  keyword: boolean
  inclusion: boolean
  exclusion: boolean
}

interface DatasetFilterProps {
  categories: Category[]
  keywordList: string[]
  inclusionList: string[]
  exclusionList: string[]
  selectedCategory: Category | null
  onSelectDataset: (ds: Dataset) => void
  onRemoveKeyword: (term: string) => void
  onRemoveInclusion: (term: string) => void
  onRemoveExclusion: (term: string) => void
  onClearKeywords: () => void
  onClearInclusion: () => void
  onClearExclusion: () => void
  isAnnotating: boolean
  onSubmitAnnotations: () => void
  onCancelAnnotation: () => void
  onAddKeyword: (term: string) => void
  onAddInclusion: (term: string) => void
  onAddExclusion: (term: string) => void
}

export default function DatasetFilter({
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
  // Build subcategory -> term list map
  const subTermsMap: Record<string, string[]> = {}
  categories.forEach(cat => {
    cat.children?.forEach(sub => {
      subTermsMap[sub.label] = sub.children?.map(term => term.label) || []
    })
  })

  // List of all second-level subcategories
  const subcategories = Object.keys(subTermsMap)

  // Flatten all datasets
  const allDatasets: Dataset[] = []
  const collect = (cats: Category[]) => {
    cats.forEach(c => {
      allDatasets.push(...c.datasets)
      if (c.children) collect(c.children)
    })
  }
  collect(categories)

  // Apply filters
  const hasFilters =
    keywordList.length > 0 ||
    inclusionList.length > 0 ||
    exclusionList.length > 0
  const filtered = hasFilters
    ? allDatasets.filter(ds =>
        keywordList.every(k => ds.keywords?.includes(k)) &&
        inclusionList.every(i => ds.inclusionTerms?.includes(i)) &&
        exclusionList.every(e => ds.exclusionTerms?.includes(e))
      )
    : allDatasets

  // Local state for annotation mode
  const [note, setNote] = useState('')
  const [extract, setExtract] = useState<AnnotationItem[]>([])

  useEffect(() => {
    if (isAnnotating) {
      setNote('')
      setExtract([])
    }
  }, [isAnnotating])

  // Fetch extract from API
  const handleExtract = async () => {
    try {
      const res = await fetch('/api/extract-annotations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: note }),
      })
      const data = await res.json()
      setExtract(data.result)
    } catch (e) {
      console.error('Extraction error', e)
    }
  }

  // Toggle boolean fields
  const toggleKeyword = (i: number) => {
    const c = [...extract]
    c[i].keyword = !c[i].keyword
    setExtract(c)
  }
  const toggleInclusion = (i: number) => {
    const c = [...extract]
    c[i].inclusion = !c[i].inclusion
    setExtract(c)
  }
  const toggleExclusion = (i: number) => {
    const c = [...extract]
    c[i].exclusion = !c[i].exclusion
    setExtract(c)
  }

  // Change term
  const handleTermChange = (i: number, v: string) => {
    const c = [...extract]
    c[i].term = v
    setExtract(c)
  }

  // Change subcategory and reset term if needed
  const handleSubcategoryChange = (i: number, v: string) => {
    const c = [...extract]
    c[i].subcategory = v
    const terms = subTermsMap[v] || []
    c[i].term = terms.includes(c[i].term) ? c[i].term : terms[0] || ''
    setExtract(c)
  }

  return (
    <div className="p-4 border-r">
      {/* Top filter lists */}
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
          {keywordList.length ? (
            keywordList.map(t => (
              <span
                key={t}
                onClick={() => onRemoveKeyword(t)}
                className="block mb-2 px-2 py-0.5 bg-indigo-100 rounded cursor-pointer"
              >
                {t}
              </span>
            ))
          ) : (
            <div className="text-gray-500">None</div>
          )}
        </div>
        {/* Inclusion */}
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
          {inclusionList.length ? (
            inclusionList.map(t => (
              <span
                key={t}
                onClick={() => onRemoveInclusion(t)}
                className="block mb-2 px-2 py-0.5 bg-green-100 rounded cursor-pointer"
              >
                {t}
              </span>
            ))
          ) : (
            <div className="text-gray-500">None</div>
          )}
        </div>
        {/* Exclusion */}
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
          {exclusionList.length ? (
            exclusionList.map(t => (
              <span
                key={t}
                onClick={() => onRemoveExclusion(t)}
                className="block mb-2 px-2 py-0.5 bg-red-100 rounded cursor-pointer"
              >
                {t}
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

          {/* Abstract input */}
          <textarea
            value={note}
            onChange={e => setNote(e.target.value)}
            placeholder="Enter full paper abstract..."
            className="w-full h-40 border rounded p-2 mb-4"
          />

          {/* Extract button */}
          <div className="flex justify-center mb-4">
            <button
              onClick={handleExtract}
              className="px-4 py-2 bg-gray-200 rounded"
            >
              Extract annotations
            </button>
          </div>

          {/* Annotation table */}
          <table className="w-full table-auto border-collapse">
            <thead>
              <tr>
                <th className="border px-2 py-1 bg-gray-100">Text</th>
                <th className="border px-2 py-1 bg-gray-100">Subcategory</th>
                <th className="border px-2 py-1 bg-gray-100">Term</th>
                <th className="border px-2 py-1 bg-gray-100">Keyword</th>
                <th className="border px-2 py-1 bg-gray-100">Inclusion</th>
                <th className="border px-2 py-1 bg-gray-100">Exclusion</th>
              </tr>
            </thead>
            <tbody>
              {extract.length ? (
                extract.map((item, idx) => (
                  <tr key={idx} className="hover:bg-gray-50">
                    <td className="border px-2 py-1">{item.text}</td>
                    <td className="border px-2 py-1">
                      <select
                        value={item.subcategory}
                        onChange={e => handleSubcategoryChange(idx, e.target.value)}
                        className="border rounded px-1 py-0.5"
                      >
                        {subcategories.map(sub => (
                          <option key={sub} value={sub}>
                            {sub}
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
                        {(subTermsMap[item.subcategory] || []).map(opt => (
                          <option key={opt} value={opt}>
                            {opt}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="border px-2 py-1 text-center">
                      <input
                        type="checkbox"
                        checked={item.keyword}
                        onChange={() => toggleKeyword(idx)}
                      />
                    </td>
                    <td className="border px-2 py-1 text-center">
                      <input
                        type="checkbox"
                        checked={item.inclusion}
                        onChange={() => toggleInclusion(idx)}
                      />
                    </td>
                    <td className="border px-2 py-1 text-center">
                      <input
                        type="checkbox"
                        checked={item.exclusion}
                        onChange={() => toggleExclusion(idx)}
                      />
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="text-center py-4 text-gray-500">
                    No annotations extracted yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </>
      ) : (
        <ul>
          {filtered.map(ds => (
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
