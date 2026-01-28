import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../api/client';
import ArticleCard from '../components/ArticleCard';

export default function ReadLater() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);

  const { data, isLoading, error } = useQuery({
    queryKey: ['read-later', page],
    queryFn: () => api.getReadLater(page, 20),
  });

  const toggleReadLaterMutation = useMutation({
    mutationFn: api.toggleReadLater,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['read-later'] });
      queryClient.invalidateQueries({ queryKey: ['articles'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: api.deleteArticle,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['read-later'] });
      queryClient.invalidateQueries({ queryKey: ['articles'] });
    },
  });

  const totalPages = data ? Math.ceil(data.total / 20) : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Read Later</h2>
        {data && (
          <span className="text-dark-500">{data.total} articles</span>
        )}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : error ? (
        <div className="card p-6 text-center text-red-400">
          Failed to load read later queue. Please try again.
        </div>
      ) : data?.articles.length === 0 ? (
        <div className="card p-12 text-center">
          <p className="text-dark-400">Your read later queue is empty.</p>
          <p className="text-dark-500 text-sm mt-1">
            Click the bookmark icon on articles to add them here.
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
    </div>
  );
}
