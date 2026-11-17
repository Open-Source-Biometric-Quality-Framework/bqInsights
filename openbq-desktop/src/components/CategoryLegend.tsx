// CategoryLegend.tsx - Category legend display component

import React from 'react';

type CategoryLegendProps = {
  categoryColumn: Uint8Array | null;
  categoryColors: string[];
  filteringOn: boolean;
  onCategoryClick: (category: number, indices: number[]) => void;
  onResetFilters: () => void;
};

export function CategoryLegend({
  categoryColumn,
  categoryColors,
  filteringOn,
  onCategoryClick,
  onResetFilters
}: CategoryLegendProps) {
  if (!categoryColumn) return null;

  // Get unique categories
  const uniqueCategories = [...new Set(categoryColumn)];

  // Count occurrences
  const categoryCounts: Record<number, number> = categoryColumn.reduce(
    (acc: Record<number, number>, cat) => {
      acc[cat] = (acc[cat] || 0) + 1;
      return acc;
    },
    {} as Record<number, number>
  );

  // Sort by count (descending)
  const sortedCategories = uniqueCategories.sort(
    (a, b) => categoryCounts[b] - categoryCounts[a]
  );

  const handleCategoryClick = (category: number) => {
    const indices: number[] = [];
    for (let i = 0; i < categoryColumn.length; i++) {
      if (categoryColumn[i] === category) {
        indices.push(i);
      }
    }
    onCategoryClick(category, indices);
  };

  return (
    <div
      style={{
        position: 'absolute',
        left: 10,
        top: 10,
        width: 200,
        maxHeight: 300,
        overflowY: 'auto',
        padding: 20,
        background: '#1a1a1a',
        border: '1px solid #333',
        borderRadius: 8
      }}
    >
      <h3 style={{ color: '#fff', margin: '0 0 16px 0', fontSize: 14 }}>
        Categories
      </h3>
      
      {sortedCategories.map((category) => {
        const colorIdx = uniqueCategories.indexOf(category);
        return (
          <div
            key={category}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              marginBottom: 8,
              color: '#ccc',
              fontSize: 12
            }}
          >
            <div
              style={{
                width: 16,
                height: 16,
                background: categoryColors[colorIdx % categoryColors.length],
                borderRadius: 3,
                cursor: 'pointer'
              }}
              onClick={() => handleCategoryClick(category)}
              title={`Filter to category ${category}`}
            />
            <span>{categoryCounts[category as number]}</span>
          </div>
        );
      })}

      {filteringOn && (
        <div style={{ marginTop: 10 }}>
          <button
            onClick={onResetFilters}
            style={{
              padding: '6px 12px',
              background: '#333',
              color: '#fff',
              border: '1px solid #555',
              borderRadius: 4,
              cursor: 'pointer',
              fontSize: 12
            }}
          >
            Reset Filters
          </button>
        </div>
      )}
    </div>
  );
}