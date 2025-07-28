import { useState } from 'react'
import TreeBrowser from '../components/TreeBrowser'
import DatasetFilter from '../components/DatasetFilter'
import DatasetView from '../components/DatasetView'
import categoryTree from '../data/categories.json'
import datasetsData from '../data/datasets.json'
import { Category, Dataset, Annotation } from '../types'

// Shape of each row in the annotation table
interface AnnotationItem {
  text: string
  category: string
  subcategory: string
  term: string
  keyword: boolean
  inclusion: boolean
  exclusion: boolean
}

export default function Home() {
  const [categories] = useState<Category[]>(categoryTree)
  const [datasets, setDatasets] = useState<Dataset[]>(datasetsData)

  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null)
  const [selectedDataset, setSelectedDataset] = useState<Dataset | null>(null)

  // Top‐pane filter lists
  const [keywordList, setKeywordList] = useState<Annotation[]>([])
  const [inclusionList, setInclusionList] = useState<Annotation[]>([])
  const [exclusionList, setExclusionList] = useState<Annotation[]>([])
  const [isAnnotating, setIsAnnotating] = useState(false)

  // Collapsible panel states
  const [leftPanelCollapsed, setLeftPanelCollapsed] = useState(false)
  const [rightPanelCollapsed, setRightPanelCollapsed] = useState(false)

  // Helper to update our in‐memory datasets (and selected)
  const updateDataset = (id: string, fn: (ds: Dataset) => Dataset) => {
    setDatasets(prev => prev.map(ds => (ds.id === id ? fn(ds) : ds)))
    setSelectedDataset(prev => (prev && prev.id === id ? fn(prev) : prev))
  }

  const handleSelectCategory = (cat: Category) => {
    setSelectedCategory(cat)
    if (!isAnnotating) setSelectedDataset(null)
  }
  const handleSelectDataset = (ds: Dataset) => setSelectedDataset(ds)

  const handleAnnotate = () => {
    if (!selectedDataset) return
    setKeywordList(selectedDataset.keywords ?? [])
    setInclusionList(selectedDataset.inclusionTerms ?? [])
    setExclusionList(selectedDataset.exclusionTerms ?? [])
    setIsAnnotating(true)
  }
  const handleCancelAnnotation = () => setIsAnnotating(false)

  // 1) "Add annotations" merges the current table items into the in‐memory lists, stays in annotation mode
  const handleAddAnnotations = (items: AnnotationItem[]) => {
    // Build a map label → id for categories, subcats, and terms
    const labelToId = new Map<string,string>()
    const walk = (cats: Category[]) => {
      cats.forEach(c => {
        labelToId.set(c.label, c.id)
        c.children.forEach(sub => {
          labelToId.set(sub.label, sub.id)
          sub.children.forEach(term => {
            labelToId.set(term.label, term.id)
          })
        })
        walk(c.children)
      })
    }
    walk(categories)

    // Use a Set to ensure uniqueness by id
    const newKs: Annotation[] = []
    const newIs: Annotation[] = []
    const newEs: Annotation[] = []
    const seenK = new Set<string>()
    const seenI = new Set<string>()
    const seenE = new Set<string>()

    items.forEach(item => {
      // prefer term, then subcategory, then category
      const chosenLabel = item.term || item.subcategory || item.category
      const chosenId = labelToId.get(chosenLabel) ?? chosenLabel
      const ann: Annotation = {
        id: chosenId,
        label: chosenLabel,
        comment: '',
        text: item.text
      }
      if (item.keyword && !seenK.has(chosenId)) {
        newKs.push(ann)
        seenK.add(chosenId)
      }
      if (item.inclusion && !seenI.has(chosenId)) {
        newIs.push(ann)
        seenI.add(chosenId)
      }
      if (item.exclusion && !seenE.has(chosenId)) {
        newEs.push(ann)
        seenE.add(chosenId)
      }
    })

    setKeywordList(kl => {
      const ids = new Set(kl.map(a => a.id))
      return [
        ...kl,
        ...newKs.filter(a => !ids.has(a.id))
      ]
    })
    setInclusionList(il => {
      const ids = new Set(il.map(a => a.id))
      return [
        ...il,
        ...newIs.filter(a => !ids.has(a.id))
      ]
    })
    setExclusionList(el => {
      const ids = new Set(el.map(a => a.id))
      return [
        ...el,
        ...newEs.filter(a => !ids.has(a.id))
      ]
    })
    // remain in annotation mode
  }

  // 2) "Submit Annotations" writes out and exits annotation mode (unchanged)
  const handleSubmitAnnotations = async (items: AnnotationItem[]) => {
    if (!selectedDataset) return

    const labelToId = new Map<string,string>()
    const walk = (cats: Category[]) => {
      cats.forEach(c => {
        labelToId.set(c.label, c.id)
        c.children.forEach(sub => {
          labelToId.set(sub.label, sub.id)
          sub.children.forEach(term => {
            labelToId.set(term.label, term.id)
          })
        })
        walk(c.children)
      })
    }
    walk(categories)

    const mergedKs: Annotation[] = []
    const mergedIs: Annotation[] = []
    const mergedEs: Annotation[] = []

    items.forEach(item => {
      const chosenLabel = item.term || item.subcategory || item.category
      const chosenId = labelToId.get(chosenLabel) ?? chosenLabel
      const ann: Annotation = {
        id: chosenId,
        label: chosenLabel,
        comment: '',
        text: item.text
      }
      if (item.keyword)   mergedKs.push(ann)
      if (item.inclusion) mergedIs.push(ann)
      if (item.exclusion) mergedEs.push(ann)
    })

    const finalKs = [
      ...keywordList,
      ...mergedKs.filter(a => !keywordList.some(k => k.id === a.id))
    ]
    const finalIs = [
      ...inclusionList,
      ...mergedIs.filter(a => !inclusionList.some(i => i.id === a.id))
    ]
    const finalEs = [
      ...exclusionList,
      ...mergedEs.filter(a => !exclusionList.some(e => e.id === a.id))
    ]

    await fetch('/api/save-annotations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        datasetId: selectedDataset.id,
        keywords: finalKs,
        inclusionTerms: finalIs,
        exclusionTerms: finalEs,
      }),
    })

    updateDataset(selectedDataset.id, ds => ({
      ...ds,
      keywords: finalKs,
      inclusionTerms: finalIs,
      exclusionTerms: finalEs,
    }))
    setKeywordList(finalKs)
    setInclusionList(finalIs)
    setExclusionList(finalEs)
    setIsAnnotating(false)
  }

  return (
    <div className="grid grid-cols-[auto_1fr_auto] h-screen">
      {/* Left Panel - TreeBrowser */}
      <div className="relative">
        {leftPanelCollapsed ? (
          <button
            onClick={() => setLeftPanelCollapsed(false)}
            className="h-full w-8 bg-gray-100 hover:bg-gray-200 border-r flex items-center justify-center transition-colors"
            title="Expand vocabulary panel"
          >
            <span className="text-gray-600 text-lg">→</span>
          </button>
        ) : (
          <div className="relative">
            <TreeBrowser
              categories={categories}
              selectedCategory={selectedCategory}
              onSelectCategory={handleSelectCategory}
              onAddKeyword={ann =>
                setKeywordList(list =>
                  list.some(a => a.id === ann.id) ? list : [...list, ann]
                )
              }
              onAddInclusion={ann =>
                setInclusionList(list =>
                  list.some(a => a.id === ann.id) ? list : [...list, ann]
                )
              }
              onAddExclusion={ann =>
                setExclusionList(list =>
                  list.some(a => a.id === ann.id) ? list : [...list, ann]
                )
              }
            />
            <button
              onClick={() => setLeftPanelCollapsed(true)}
              className="absolute top-2 right-2 w-6 h-6 bg-white hover:bg-gray-100 border rounded flex items-center justify-center text-gray-600 text-sm transition-colors"
              title="Collapse vocabulary panel"
            >
              ←
            </button>
          </div>
        )}
      </div>

      {/* Center Panel - DatasetFilter */}
      <DatasetFilter
        datasets={datasets}
        categories={categories}
        keywordList={keywordList}
        inclusionList={inclusionList}
        exclusionList={exclusionList}
        selectedCategory={selectedCategory}
        onSelectDataset={handleSelectDataset}
        onRemoveKeyword={ann =>
          setKeywordList(list => list.filter(x => x.id !== ann.id))
        }
        onRemoveInclusion={ann =>
          setInclusionList(list => list.filter(x => x.id !== ann.id))
        }
        onRemoveExclusion={ann =>
          setExclusionList(list => list.filter(x => x.id !== ann.id))
        }
        onClearKeywords={() => setKeywordList([])}
        onClearInclusion={() => setInclusionList([])}
        onClearExclusion={() => setExclusionList([])}
        isAnnotating={isAnnotating}
        onAddAnnotations={handleAddAnnotations}
        onSubmitAnnotations={handleSubmitAnnotations}
        onCancelAnnotation={handleCancelAnnotation}
      />

      {/* Right Panel - DatasetView */}
      <div className="relative">
        {rightPanelCollapsed ? (
          <button
            onClick={() => setRightPanelCollapsed(false)}
            className="h-full w-8 bg-gray-100 hover:bg-gray-200 border-l flex items-center justify-center transition-colors"
            title="Expand dataset details panel"
          >
            <span className="text-gray-600 text-lg">←</span>
          </button>
        ) : (
          <div className="relative">
            <DatasetView
              selectedDataset={selectedDataset}
              onAnnotate={handleAnnotate}
            />
            <button
              onClick={() => setRightPanelCollapsed(true)}
              className="absolute top-4 left-2 w-6 h-6 bg-white hover:bg-gray-100 border rounded flex items-center justify-center text-gray-600 text-sm transition-colors z-10"
              title="Collapse dataset details panel"
            >
              →
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
