import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { formatDistanceToNow, format } from 'date-fns';
import {
  ArrowLeft,
  ExternalLink,
  BookMarked,
  Trash2,
  Clock,
  Edit2,
  Network,
  Quote,
} from 'lucide-react';
import api from '../api/client';
import clsx from 'clsx';

const tagColors: Record<string, string> = {
  technology: 'tag-technology',
  business: 'tag-business',
  science: 'tag-science',
  culture: 'tag-culture',
  career: 'tag-career',
};

const statusOptions = [
  { value: 'unread', label: 'Unread' },
  { value: 'read', label: 'Read' },
  { value: 'archived', label: 'Archived' },
];

export default function ArticleDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [notes, setNotes] = useState('');

  const { data: article, isLoading, error } = useQuery({
    queryKey: ['article', id],
    queryFn: () => api.getArticle(id!),
    enabled: !!id,
  });

  const updateMutation = useMutation({
    mutationFn: (updates: Parameters<typeof api.updateArticle>[1]) =>
      api.updateArticle(id!, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['article', id] });
      queryClient.invalidateQueries({ queryKey: ['articles'] });
      setIsEditing(false);
    },
  });

  const toggleReadLaterMutation = useMutation({
    mutationFn: () => api.toggleReadLater(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['article', id] });
      queryClient.invalidateQueries({ queryKey: ['articles'] });
      queryClient.invalidateQueries({ queryKey: ['read-later'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => api.deleteArticle(id!),
    onSuccess: () => {
      navigate('/');
    },
  });

  const handleSaveNotes = () => {
    updateMutation.mutate({ user_notes: notes });
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !article) {
    return (
      <div className="card p-6 text-center">
        <p className="text-red-400">Article not found</p>
        <Link to="/" className="text-primary-400 hover:underline mt-2 inline-block">
          Back to Timeline
        </Link>
      </div>
    );
  }

  const readTime = article.read_time_seconds
    ? `${Math.ceil(article.read_time_seconds / 60)} min`
    : null;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Back Button */}
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-2 text-dark-400 hover:text-dark-200 transition-colors"
      >
        <ArrowLeft size={18} />
        Back
      </button>

      {/* Header */}
      <div className="card p-6 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <h1 className="text-2xl font-bold">{article.title}</h1>
          <div className="flex items-center gap-2">
            <a
              href={article.url}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-secondary p-2"
              title="Open original"
            >
              <ExternalLink size={18} />
            </a>
            <button
              onClick={() => toggleReadLaterMutation.mutate()}
              className={clsx(
                'btn p-2',
                article.is_read_later ? 'btn-primary' : 'btn-secondary'
              )}
              title={article.is_read_later ? 'Remove from read later' : 'Add to read later'}
            >
              <BookMarked size={18} />
            </button>
            <Link
              to={`/graph?article=${article.id}`}
              className="btn btn-secondary p-2"
              title="View in graph"
            >
              <Network size={18} />
            </Link>
            <button
              onClick={() => {
                if (confirm('Delete this article?')) {
                  deleteMutation.mutate();
                }
              }}
              className="btn btn-secondary p-2 hover:text-red-400"
              title="Delete"
            >
              <Trash2 size={18} />
            </button>
          </div>
        </div>

        {/* Meta */}
        <div className="flex flex-wrap items-center gap-3 text-sm text-dark-400">
          <span>{article.source_domain}</span>
          {article.author && (
            <>
              <span>·</span>
              <span>{article.author}</span>
            </>
          )}
          <span>·</span>
          <span>{formatDistanceToNow(new Date(article.captured_at), { addSuffix: true })}</span>
          {readTime && (
            <>
              <span>·</span>
              <span className="flex items-center gap-1">
                <Clock size={14} />
                {readTime} read
              </span>
            </>
          )}
        </div>

        {/* Status */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-dark-500">Status:</span>
          {statusOptions.map((opt) => (
            <button
              key={opt.value}
              onClick={() => updateMutation.mutate({ status: opt.value })}
              className={clsx(
                'px-3 py-1 text-sm rounded-full transition-colors',
                article.status === opt.value
                  ? 'bg-primary-600 text-white'
                  : 'bg-dark-800 text-dark-400 hover:text-dark-200'
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Tags */}
        {article.tags.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {article.tags.map((tag, i) => (
              <span
                key={i}
                className={clsx('tag', tagColors[tag.domain] || 'tag-default')}
              >
                {tag.topic ? `${tag.domain}:${tag.topic}` : tag.domain}
                {tag.entity && `:${tag.entity}`}
              </span>
            ))}
          </div>
        )}

        {/* Entities */}
        {article.entities.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {article.entities.map((entity, i) => (
              <span key={i} className="tag bg-dark-700 text-dark-300">
                {entity.entity}
                <span className="text-dark-500 ml-1">({entity.entity_type})</span>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Summary */}
      {article.summary && (
        <div className="card p-6">
          <h2 className="text-lg font-semibold mb-3">Summary</h2>
          <p className="text-dark-300 leading-relaxed">{article.summary}</p>
        </div>
      )}

      {/* Key Quotes */}
      {article.key_quotes && article.key_quotes.length > 0 && (
        <div className="card p-6">
          <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <Quote size={18} />
            Key Quotes
          </h2>
          <ul className="space-y-3">
            {article.key_quotes.map((quote, i) => (
              <li
                key={i}
                className="pl-4 border-l-2 border-primary-500 text-dark-300 italic"
              >
                "{quote}"
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Notes */}
      <div className="card p-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">Notes</h2>
          {!isEditing && (
            <button
              onClick={() => {
                setNotes(article.user_notes || '');
                setIsEditing(true);
              }}
              className="btn btn-secondary p-2"
            >
              <Edit2 size={16} />
            </button>
          )}
        </div>

        {isEditing ? (
          <div className="space-y-3">
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="input min-h-32 resize-y"
              placeholder="Add your notes..."
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setIsEditing(false)}
                className="btn btn-secondary"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveNotes}
                disabled={updateMutation.isPending}
                className="btn btn-primary"
              >
                {updateMutation.isPending ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        ) : article.user_notes ? (
          <p className="text-dark-300 whitespace-pre-wrap">{article.user_notes}</p>
        ) : (
          <p className="text-dark-500 italic">No notes yet</p>
        )}
      </div>

      {/* Processing Status */}
      {article.processing_status === 'pending' && (
        <div className="card p-4 flex items-center gap-3 text-dark-400">
          <div className="w-4 h-4 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
          Article is being processed. Tags and summary will appear soon.
        </div>
      )}

      {article.processing_status === 'failed' && (
        <div className="card p-4 text-yellow-400">
          Processing failed. The article was saved but AI analysis could not be completed.
        </div>
      )}

      {/* Metadata */}
      <div className="card p-6 text-sm text-dark-500">
        <h3 className="font-medium text-dark-400 mb-2">Details</h3>
        <dl className="space-y-1">
          <div className="flex">
            <dt className="w-32">Captured</dt>
            <dd>{format(new Date(article.captured_at), 'PPpp')}</dd>
          </div>
          {article.published_at && (
            <div className="flex">
              <dt className="w-32">Published</dt>
              <dd>{format(new Date(article.published_at), 'PP')}</dd>
            </div>
          )}
          <div className="flex">
            <dt className="w-32">Source</dt>
            <dd>{article.capture_source}</dd>
          </div>
          <div className="flex">
            <dt className="w-32">Type</dt>
            <dd>{article.content_type}</dd>
          </div>
          {article.word_count && (
            <div className="flex">
              <dt className="w-32">Word count</dt>
              <dd>{article.word_count.toLocaleString()}</dd>
            </div>
          )}
          <div className="flex">
            <dt className="w-32">Language</dt>
            <dd>{article.language}</dd>
          </div>
        </dl>
      </div>
    </div>
  );
}
