import { useState, useEffect } from 'react'
import { Category, Dataset } from '../types'

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
  // Flatten all datasets
  const allDatasets: Dataset[] = []
  const collect = (cats: Category[]) => {
    cats.forEach(c => {
      allDatasets.push(...c.datasets)
      if (c.children) collect(c.children)
    })
  }
  collect(categories)

  // Determine if any filter is active
  const hasFilters = keywordList.length > 0 || inclusionList.length > 0 || exclusionList.length > 0

  // Filter datasets
  const filtered = hasFilters
    ? allDatasets.filter(ds =>
        keywordList.every(k => ds.keywords?.includes(k)) &&
        inclusionList.every(i => ds.inclusionTerms?.includes(i)) &&
        exclusionList.every(e => ds.exclusionTerms?.includes(e))
      )
    : allDatasets

  // Local state
  const [note, setNote] = useState('')
  const [extract, setExtract] = useState<any>(null)

  // Clear on annotate
  useEffect(() => {
    if (isAnnotating) {
      setNote('')
      setExtract(null)
    }
  }, [isAnnotating])

  const handleExtract = async () => {
    try {
      const res = await fetch('/api/extract-annotations', {
        method: 'POST', headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ text: note })
      })
      const text = await res.text()
      if (!res.ok) { setExtract({ error: text }); return }
      let data
      try { data = JSON.parse(text) } catch { setExtract({ error: text }); return }
      setExtract(data.result)
    } catch (e) {
      setExtract({ error: 'Network error' })
    }
  }

  // Suggested lists filter
  const suggestedKeywords = extract?.keywords?.filter((t: string) => !keywordList.includes(t)) || []
  const suggestedInclusions = extract?.inclusionTerms?.filter((t: string) => !inclusionList.includes(t)) || []
  const suggestedExclusions = extract?.exclusionTerms?.filter((t: string) => !exclusionList.includes(t)) || []

  return (
    <div className="p-4 border-r">
      {/* Filters */}
      <div className="grid grid-cols-3 gap-4 mb-4">
        <div>
          <div className="flex justify-between mb-2">
            <span className="font-semibold">Keywords:</span>
            <button onClick={onClearKeywords} className="text-sm px-2 py-0.5 border rounded bg-indigo-100 hover:bg-indigo-200">Clear</button>
          </div>
          {keywordList.length ? keywordList.map(t => (
            <span key={t} onClick={() => onRemoveKeyword(t)} className="block mb-2 px-2 py-0.5 bg-indigo-100 rounded cursor-pointer">{t}</span>
          )) : <div className="text-gray-500">None</div>}
        </div>
        <div>
          <div className="flex justify-between mb-2">
            <span className="font-semibold">Inclusion:</span>
            <button onClick={onClearInclusion} className="text-sm px-2 py-0.5 border rounded bg-green-100 hover:bg-green-200">Clear</button>
          </div>
          {inclusionList.length ? inclusionList.map(t => (
            <span key={t} onClick={() => onRemoveInclusion(t)} className="block mb-2 px-2 py-0.5 bg-green-100 rounded cursor-pointer">{t}</span>
          )) : <div className="text-gray-500">None</div>}
        </div>
        <div>
          <div className="flex justify-between mb-2">
            <span className="font-semibold">Exclusion:</span>
            <button onClick={onClearExclusion} className="text-sm px-2 py-0.5 border rounded bg-red-100 hover:bg-red-200">Clear</button>
          </div>
          {exclusionList.length ? exclusionList.map(t => (
            <span key={t} onClick={() => onRemoveExclusion(t)} className="block mb-2 px-2 py-0.5 bg-red-100 rounded cursor-pointer">{t}</span>
          )) : <div className="text-gray-500">None</div>}
        </div>
      </div>

      {isAnnotating ? (
        <>
          <div className="flex space-x-4 justify-center mb-4">
            <button onClick={onSubmitAnnotations} className="px-4 py-2 bg-blue-500 text-white rounded">Submit Annotations</button>
            <button onClick={onCancelAnnotation} className="px-4 py-2 bg-gray-300 rounded">Cancel</button>
          </div>
          <textarea
            value={note}
            onChange={e => setNote(e.target.value)}
            placeholder="Enter full paper abstract..."
            className="w-full h-40 border rounded p-2 mb-4"
          />
          <div className="flex justify-center mb-4">
            <button onClick={handleExtract} className="px-4 py-2 bg-gray-200 rounded">Extract annotations</button>
          </div>
          {extract && (
            <textarea readOnly value={JSON.stringify(extract, null, 2)} className="w-full h-40 border rounded p-2 mb-4" />
          )}
          {extract && (
            <div className="grid grid-cols-3 gap-4">
              <div>
                <div className="font-semibold mb-2">Suggested Keywords:</div>
                {suggestedKeywords.length ? suggestedKeywords.map((t: string) => (
                  <span key={t} onClick={() => onAddKeyword(t)} className="block mb-2 px-2 py-0.5 bg-indigo-200 rounded cursor-pointer">{t}</span>
                )) : <div className="text-gray-500">None</div>}
              </div>
              <div>
                <div className="font-semibold mb-2">Suggested Inclusion:</div>
                {suggestedInclusions.length ? suggestedInclusions.map((t: string) => (
                  <span key={t} onClick={() => onAddInclusion(t)} className="block mb-2 px-2 py-0.5 bg-green-200 rounded cursor-pointer">{t}</span>
                )) : <div className="text-gray-500">None</div>}
              </div>
              <div>
                <div className="font-semibold mb-2">Suggested Exclusion:</div>
                {suggestedExclusions.length ? suggestedExclusions.map((t: string) => (
                  <span key={t} onClick={() => onAddExclusion(t)} className="block mb-2 px-2 py-0.5 bg-red-200 rounded cursor-pointer">{t}</span>
                )) : <div className="text-gray-500">None</div>}
              </div>
            </div>
          )}
        </>
      ) : (
        <ul>
          {filtered.map(ds => (
            <li key={ds.id} onClick={() => onSelectDataset(ds)} className="cursor-pointer py-1 hover:bg-gray-100">{ds.label}</li>
          ))}
        </ul>
      )}
    </div>
)
}
