import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { CheckCircle, XCircle, Loader2 } from 'lucide-react';
import api from '../api/client';

export default function Share() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');

  const captureMutation = useMutation({
    mutationFn: (url: string) => api.captureArticle(url, 'pwa'),
    onSuccess: (data) => {
      setStatus('success');
      setMessage(data.message);
      // Redirect to timeline after a short delay
      setTimeout(() => navigate('/'), 2000);
    },
    onError: (error: Error) => {
      setStatus('error');
      setMessage(error.message || 'Failed to save article');
    },
  });

  useEffect(() => {
    // Get URL from share target params
    const url = searchParams.get('url');
    const text = searchParams.get('text');
    // title available via searchParams.get('title') if needed

    // Extract URL from various possible sources
    let targetUrl = url;

    if (!targetUrl && text) {
      // Try to find URL in text
      const urlMatch = text.match(/https?:\/\/[^\s]+/);
      if (urlMatch) {
        targetUrl = urlMatch[0];
      }
    }

    if (targetUrl) {
      captureMutation.mutate(targetUrl);
    } else {
      setStatus('error');
      setMessage('No URL found to save');
    }
  }, [searchParams]);

  return (
    <div className="min-h-screen bg-dark-950 flex items-center justify-center p-4">
      <div className="card p-8 text-center max-w-sm w-full">
        {status === 'loading' && (
          <>
            <Loader2 className="w-12 h-12 text-primary-500 animate-spin mx-auto" />
            <p className="mt-4 text-dark-300">Saving article...</p>
          </>
        )}

        {status === 'success' && (
          <>
            <CheckCircle className="w-12 h-12 text-green-500 mx-auto" />
            <p className="mt-4 text-dark-100 font-medium">Saved!</p>
            <p className="mt-1 text-dark-400 text-sm">{message}</p>
            <p className="mt-4 text-dark-500 text-sm">Redirecting to timeline...</p>
          </>
        )}

        {status === 'error' && (
          <>
            <XCircle className="w-12 h-12 text-red-500 mx-auto" />
            <p className="mt-4 text-dark-100 font-medium">Error</p>
            <p className="mt-1 text-dark-400 text-sm">{message}</p>
            <button
              onClick={() => navigate('/')}
              className="btn btn-primary mt-4"
            >
              Go to Timeline
            </button>
          </>
        )}
      </div>
    </div>
  );
}
