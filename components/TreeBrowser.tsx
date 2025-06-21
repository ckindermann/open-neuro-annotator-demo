import { useState, useMemo } from 'react'
import TreeView from 'react-treeview'
import 'react-treeview/react-treeview.css'
import { Category, Annotation } from '../types'

interface TreeBrowserProps {
  categories: Category[]
  selectedCategory: Category | null
  onSelectCategory: (cat: Category) => void
  onAddKeyword: (ann: Annotation) => void
  onAddInclusion: (ann: Annotation) => void
  onAddExclusion: (ann: Annotation) => void
}

export default function TreeBrowser({
  categories,
  selectedCategory,
  onSelectCategory,
  onAddKeyword,
  onAddInclusion,
  onAddExclusion,
}: TreeBrowserProps) {
  const [search, setSearch] = useState('')
  const [collapsedMap, setCollapsedMap] = useState<Record<string, boolean>>({})

  const allNodeIds = useMemo(() => {
    const ids: string[] = []
    const traverse = (nodes: Category[]) => {
      nodes.forEach(node => {
        if (node.children && node.children.length > 0) {
          ids.push(node.id)
          traverse(node.children)
        }
      })
    }
    traverse(categories)
    return ids
  }, [categories])

  const collapseAll = () => {
    const m: Record<string, boolean> = {}
    allNodeIds.forEach(id => (m[id] = true))
    setCollapsedMap(m)
  }

  const toggleNode = (id: string) => {
    setCollapsedMap(prev => ({ ...prev, [id]: !prev[id] }))
  }

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return categories

    const recurse = (nodes: Category[]): Category[] =>
      nodes.reduce<Category[]>((acc, node) => {
        const children = node.children ?? []
        const filteredChildren = recurse(children)
        if (
          node.label.toLowerCase().includes(term) ||
          filteredChildren.length > 0
        ) {
          acc.push({ ...node, children: filteredChildren })
        }
        return acc
      }, [])

    return recurse(categories)
  }, [search, categories])

  const renderTree = (nodes: Category[]) =>
    nodes.map(node => {
      const hasChildren = !!node.children?.length
      const isCollapsed = collapsedMap[node.id] ?? false
      const isSelected = selectedCategory?.id === node.id

      const labelEl = (
        <span
          className={`cursor-pointer inline-flex items-center px-1 py-0.5 rounded ${
            isSelected ? 'bg-blue-100 font-semibold' : ''
          }`}
          onClick={() => {
            onSelectCategory(node)
            if (hasChildren) toggleNode(node.id)
          }}
        >
          {node.label}
        </span>
      )

      return (
        <TreeView
          key={node.id}
          nodeLabel={labelEl}
          collapsed={hasChildren ? isCollapsed : true}
        >
          {hasChildren && !isCollapsed && renderTree(node.children!)}
        </TreeView>
      )
    })

  return (
    <div className="p-4 border-r flex flex-col h-full">
      <div className="flex space-x-2 mb-4">
        <button
          className="px-3 py-1 border rounded bg-indigo-500 text-white hover:bg-indigo-600"
          onClick={() => {
            if (!selectedCategory) return
            onAddKeyword({
              id: selectedCategory.id,
              label: selectedCategory.label,
              comment: '',
              text: '',
            })
          }}
        >
          Keyword
        </button>
        <button
          className="px-3 py-1 border rounded bg-green-500 text-white hover:bg-green-600"
          onClick={() => {
            if (!selectedCategory) return
            onAddInclusion({
              id: selectedCategory.id,
              label: selectedCategory.label,
              comment: '',
              text: '',
            })
          }}
        >
          Inclusion
        </button>
        <button
          className="px-3 py-1 border rounded bg-red-500 text-white hover:bg-red-600"
          onClick={() => {
            if (!selectedCategory) return
            onAddExclusion({
              id: selectedCategory.id,
              label: selectedCategory.label,
              comment: '',
              text: '',
            })
          }}
        >
          Exclusion
        </button>
      </div>

      <div className="flex items-center mb-4 space-x-2">
        <button
          className="h-10 px-3 border rounded hover:bg-gray-100 flex items-center justify-center"
          onClick={collapseAll}
        >
          Collapse All
        </button>
        <input
          className="flex-1 h-10 px-2 border rounded"
          placeholder="Search categories"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      <div className="overflow-auto flex-1">
        {renderTree(filtered)}
      </div>
    </div>
  )
}
