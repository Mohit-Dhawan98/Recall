import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Filter } from 'lucide-react';
import api from '../api/client';
import ArticleCard from '../components/ArticleCard';
import clsx from 'clsx';

const statusFilters = [
  { value: undefined, label: 'All' },
  { value: 'unread', label: 'Unread' },
  { value: 'read', label: 'Read' },
  { value: 'archived', label: 'Archived' },
];

export default function Timeline() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<string | undefined>(undefined);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newUrl, setNewUrl] = useState('');

  const { data, isLoading, error } = useQuery({
    queryKey: ['articles', page, status],
    queryFn: () => api.getArticles(page, 20, status),
  });

  const captureMutation = useMutation({
    mutationFn: (url: string) => api.captureArticle(url, 'pwa'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['articles'] });
      setShowAddModal(false);
      setNewUrl('');
    },
  });

  const toggleReadLaterMutation = useMutation({
    mutationFn: api.toggleReadLater,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['articles'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: api.deleteArticle,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['articles'] });
    },
  });

  const handleSubmitUrl = (e: React.FormEvent) => {
    e.preventDefault();
    if (newUrl.trim()) {
      captureMutation.mutate(newUrl.trim());
    }
  };

  const totalPages = data ? Math.ceil(data.total / data.page_size) : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Timeline</h2>
        <button
          onClick={() => setShowAddModal(true)}
          className="btn btn-primary flex items-center gap-2"
        >
          <Plus size={18} />
          Add Article
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2">
        <Filter size={16} className="text-dark-500" />
        {statusFilters.map((filter) => (
          <button
            key={filter.label}
            onClick={() => {
              setStatus(filter.value);
              setPage(1);
            }}
            className={clsx(
              'px-3 py-1 text-sm rounded-full transition-colors',
              status === filter.value
                ? 'bg-primary-600 text-white'
                : 'bg-dark-800 text-dark-400 hover:text-dark-200'
            )}
          >
            {filter.label}
          </button>
        ))}
      </div>

      {/* Articles */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : error ? (
        <div className="card p-6 text-center text-red-400">
          Failed to load articles. Please try again.
        </div>
      ) : data?.articles.length === 0 ? (
        <div className="card p-12 text-center">
          <p className="text-dark-400">No articles yet.</p>
          <p className="text-dark-500 text-sm mt-1">
            Save articles using the browser extension or the Add button above.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {data?.articles.map((article) => (
            <ArticleCard
              key={article.id}
              article={article}
              onToggleReadLater={toggleReadLaterMutation.mutate}
              onDelete={deleteMutation.mutate}
            />
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="btn btn-secondary disabled:opacity-50"
          >
            Previous
          </button>
          <span className="text-dark-400">
            Page {page} of {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="btn btn-secondary disabled:opacity-50"
          >
            Next
          </button>
        </div>
      )}

      {/* Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="card p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">Add Article</h3>
            <form onSubmit={handleSubmitUrl}>
              <input
                type="url"
                value={newUrl}
                onChange={(e) => setNewUrl(e.target.value)}
                placeholder="Paste article URL..."
                className="input"
                autoFocus
              />
              <div className="flex justify-end gap-2 mt-4">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!newUrl.trim() || captureMutation.isPending}
                  className="btn btn-primary disabled:opacity-50"
                >
                  {captureMutation.isPending ? 'Saving...' : 'Save'}
                </button>
              </div>
            </form>
            {captureMutation.isError && (
              <p className="text-red-400 text-sm mt-2">
                {(captureMutation.error as Error).message}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
