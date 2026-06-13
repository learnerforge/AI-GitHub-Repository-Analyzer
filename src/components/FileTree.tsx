import React, { useState } from 'react'
import { FileNode as FileNodeType } from '@/types'
import { Folder, File, ChevronRight, ChevronDown } from 'lucide-react'

interface FileTreeProps {
  tree: FileNodeType[]
}

function TreeNode({ node, depth = 0 }: { node: FileNodeType; depth?: number }) {
  const [expanded, setExpanded] = useState(depth < 2)

  const isDir = node.type === 'tree'
  const hasChildren = isDir && node.children && node.children.length > 0

  return (
    <div>
      <div
        className="flex items-center gap-1.5 py-1 px-2 rounded hover:bg-gray-50 cursor-pointer text-sm"
        style={{ paddingLeft: `${depth * 20 + 8}px` }}
        onClick={() => hasChildren && setExpanded(!expanded)}
      >
        {hasChildren ? (
          expanded ? <ChevronDown className="w-3.5 h-3.5 text-gray-400" /> : <ChevronRight className="w-3.5 h-3.5 text-gray-400" />
        ) : (
          <span className="w-3.5" />
        )}
        {isDir ? (
          <Folder className="w-4 h-4 text-amber-500" />
        ) : (
          <File className="w-4 h-4 text-gray-400" />
        )}
        <span className="text-gray-700 truncate">{node.name}</span>
        {node.size !== undefined && (
          <span className="text-xs text-gray-400 ml-auto">
            {node.size > 1024 ? `${(node.size / 1024).toFixed(1)} KB` : `${node.size} B`}
          </span>
        )}
      </div>
      {expanded && hasChildren && (
        <div>
          {node.children!.map((child, i) => (
            <TreeNode key={`${child.path}-${i}`} node={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  )
}

export default function FileTreeView({ tree }: FileTreeProps) {
  if (!tree || tree.length === 0) {
    return (
      <div className="card">
        <div className="card-header">
          <h3 className="text-lg font-semibold">Project Structure</h3>
        </div>
        <div className="card-body text-gray-500 text-sm">No file tree data available</div>
      </div>
    )
  }

  return (
    <div className="card">
      <div className="card-header">
        <h3 className="text-lg font-semibold">Project Structure</h3>
        <p className="text-sm text-gray-500">{tree.length} top-level items</p>
      </div>
      <div className="card-body max-h-96 overflow-y-auto">
        {tree.slice(0, 50).map((node, i) => (
          <TreeNode key={`${node.path}-${i}`} node={node} />
        ))}
        {tree.length > 50 && (
          <p className="text-xs text-gray-400 text-center mt-2">
            Showing 50 of {tree.length} items
          </p>
        )}
      </div>
    </div>
  )
}
