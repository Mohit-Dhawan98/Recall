import { Link } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { ExternalLink, BookMarked, Clock, Trash2 } from 'lucide-react';
import clsx from 'clsx';
import type { Article } from '../api/client';

interface ArticleCardProps {
  article: Article;
  onToggleReadLater?: (id: string) => void;
  onDelete?: (id: string) => void;
}

const tagColors: Record<string, string> = {
  technology: 'tag-technology',
  business: 'tag-business',
  science: 'tag-science',
  culture: 'tag-culture',
  career: 'tag-career',
};

export default function ArticleCard({ article, onToggleReadLater, onDelete }: ArticleCardProps) {
  const readTime = article.read_time_seconds
    ? `${Math.ceil(article.read_time_seconds / 60)} min read`
    : null;

  return (
    <div className="card p-4 hover:border-dark-700 transition-colors">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <Link
            to={`/article/${article.id}`}
            className="text-lg font-medium text-dark-100 hover:text-primary-400 line-clamp-2"
          >
            {article.title}
          </Link>

          <div className="flex items-center gap-2 mt-1 text-sm text-dark-500">
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
                  <Clock size={12} />
                  {readTime}
                </span>
              </>
            )}
          </div>

          {article.summary && (
            <p className="mt-2 text-sm text-dark-400 line-clamp-2">{article.summary}</p>
          )}

          {article.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-3">
              {article.tags.slice(0, 4).map((tag, i) => (
                <span
                  key={i}
                  className={clsx('tag', tagColors[tag.domain] || 'tag-default')}
                >
                  {tag.topic ? `${tag.domain}:${tag.topic}` : tag.domain}
                </span>
              ))}
              {article.tags.length > 4 && (
                <span className="tag tag-default">+{article.tags.length - 4}</span>
              )}
            </div>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <a
            href={article.url}
            target="_blank"
            rel="noopener noreferrer"
            className="p-2 text-dark-500 hover:text-dark-300 hover:bg-dark-800 rounded-lg transition-colors"
            title="Open original"
          >
            <ExternalLink size={18} />
          </a>
          {onToggleReadLater && (
            <button
              onClick={() => onToggleReadLater(article.id)}
              className={clsx(
                'p-2 rounded-lg transition-colors',
                article.is_read_later
                  ? 'text-primary-400 hover:bg-primary-600/20'
                  : 'text-dark-500 hover:text-dark-300 hover:bg-dark-800'
              )}
              title={article.is_read_later ? 'Remove from read later' : 'Add to read later'}
            >
              <BookMarked size={18} />
            </button>
          )}
          {onDelete && (
            <button
              onClick={() => onDelete(article.id)}
              className="p-2 text-dark-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
              title="Delete"
            >
              <Trash2 size={18} />
            </button>
          )}
        </div>
      </div>

      {article.processing_status === 'pending' && (
        <div className="mt-3 flex items-center gap-2 text-xs text-dark-500">
          <div className="w-3 h-3 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
          Processing...
        </div>
      )}
    </div>
  );
}
