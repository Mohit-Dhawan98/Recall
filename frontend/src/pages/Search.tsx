import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Search as SearchIcon } from 'lucide-react';
import api from '../api/client';
import ArticleCard from '../components/ArticleCard';
import clsx from 'clsx';

const searchModes = [
  { value: 'hybrid', label: 'Hybrid' },
  { value: 'keyword', label: 'Keyword' },
  { value: 'semantic', label: 'Semantic' },
];

export default function Search() {
  const queryClient = useQueryClient();
  const [query, setQuery] = useState('');
  const [mode, setMode] = useState('hybrid');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  const { data: tagsData } = useQuery({
    queryKey: ['tags'],
    queryFn: api.getTags,
  });

  const searchMutation = useMutation({
    mutationFn: () => api.search(query, mode, selectedTags.length > 0 ? selectedTags : undefined),
  });

  const toggleReadLaterMutation = useMutation({
    mutationFn: api.toggleReadLater,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['articles'] });
      searchMutation.mutate();
    },
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      searchMutation.mutate();
    }
  };

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Search</h2>

      {/* Search Form */}
      <form onSubmit={handleSearch} className="space-y-4">
        <div className="relative">
          <SearchIcon
            size={20}
            className="absolute left-4 top-1/2 -translate-y-1/2 text-dark-500"
          />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search your knowledge base..."
            className="input pl-12"
          />
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            {searchModes.map((m) => (
              <button
                key={m.value}
                type="button"
                onClick={() => setMode(m.value)}
                className={clsx(
                  'px-3 py-1 text-sm rounded-full transition-colors',
                  mode === m.value
                    ? 'bg-primary-600 text-white'
                    : 'bg-dark-800 text-dark-400 hover:text-dark-200'
                )}
              >
                {m.label}
              </button>
            ))}
          </div>

          <button
            type="submit"
            disabled={!query.trim() || searchMutation.isPending}
            className="btn btn-primary disabled:opacity-50"
          >
            {searchMutation.isPending ? 'Searching...' : 'Search'}
          </button>
        </div>
      </form>

      {/* Tag Filter */}
      {tagsData?.tags && tagsData.tags.length > 0 && (
        <div className="card p-4">
          <h3 className="text-sm font-medium text-dark-400 mb-2">Filter by tags</h3>
          <div className="flex flex-wrap gap-2">
            {tagsData.tags.slice(0, 20).map((tag) => (
              <button
                key={tag.tag}
                onClick={() => toggleTag(tag.tag)}
                className={clsx(
                  'tag cursor-pointer',
                  selectedTags.includes(tag.tag)
                    ? 'bg-primary-600 text-white'
                    : 'tag-default'
                )}
              >
                {tag.tag} ({tag.count})
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Results */}
      {searchMutation.data ? (
        <div className="space-y-4">
          <p className="text-dark-400">
            Found {searchMutation.data.total} results for "{searchMutation.data.query}"
          </p>
          {searchMutation.data.results.length === 0 ? (
            <div className="card p-6 text-center text-dark-400">
              No articles found. Try different keywords or filters.
            </div>
          ) : (
            searchMutation.data.results.map((article) => (
              <ArticleCard
                key={article.id}
                article={article}
                onToggleReadLater={toggleReadLaterMutation.mutate}
              />
            ))
          )}
        </div>
      ) : searchMutation.isError ? (
        <div className="card p-6 text-center text-red-400">
          Search failed. Please try again.
        </div>
      ) : (
        <div className="card p-12 text-center text-dark-500">
          Enter a search query to find articles
        </div>
      )}
    </div>
  );
}
