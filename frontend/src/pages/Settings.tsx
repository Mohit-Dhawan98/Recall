import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Copy, RefreshCw, Check, Download } from 'lucide-react';
import api from '../api/client';

export default function Settings() {
  const [copied, setCopied] = useState(false);
  const [serverUrl, setServerUrl] = useState(
    localStorage.getItem('serverUrl') || import.meta.env.VITE_API_URL || ''
  );

  const { data: user, refetch: refetchUser } = useQuery({
    queryKey: ['user'],
    queryFn: api.getMe,
  });

  const generateKeyMutation = useMutation({
    mutationFn: api.generateApiKey,
    onSuccess: (data) => {
      localStorage.setItem('apiKey', data.api_key);
      refetchUser();
    },
  });

  const handleCopyApiKey = async () => {
    if (user?.api_key) {
      await navigator.clipboard.writeText(user.api_key);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleSaveServerUrl = () => {
    localStorage.setItem('serverUrl', serverUrl);
    window.location.reload();
  };

  const handleInstallPWA = async () => {
    // This would trigger the PWA install prompt if available
    const deferredPrompt = (window as any).deferredPrompt;
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      console.log(`User ${outcome} the install prompt`);
    } else {
      alert('To install: tap the share button and select "Add to Home Screen"');
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h2 className="text-2xl font-bold">Settings</h2>

      {/* API Key */}
      <div className="card p-6 space-y-4">
        <h3 className="text-lg font-semibold">API Key</h3>
        <p className="text-sm text-dark-400">
          Use this API key to authenticate from the browser extension or other clients.
        </p>

        {user && (
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={user.api_key}
              readOnly
              className="input font-mono text-sm"
            />
            <button
              onClick={handleCopyApiKey}
              className="btn btn-secondary p-2"
              title="Copy"
            >
              {copied ? <Check size={18} /> : <Copy size={18} />}
            </button>
            <button
              onClick={() => generateKeyMutation.mutate()}
              disabled={generateKeyMutation.isPending}
              className="btn btn-secondary p-2"
              title="Regenerate"
            >
              <RefreshCw
                size={18}
                className={generateKeyMutation.isPending ? 'animate-spin' : ''}
              />
            </button>
          </div>
        )}

        {generateKeyMutation.isSuccess && (
          <p className="text-sm text-green-400">
            New API key generated. Update your extension settings.
          </p>
        )}
      </div>

      {/* Server URL */}
      <div className="card p-6 space-y-4">
        <h3 className="text-lg font-semibold">Server URL</h3>
        <p className="text-sm text-dark-400">
          The URL of your Recall server. Change this if you're using a tunnel or custom domain.
        </p>

        <div className="flex items-center gap-2">
          <input
            type="url"
            value={serverUrl}
            onChange={(e) => setServerUrl(e.target.value)}
            placeholder="http://localhost:8000"
            className="input"
          />
          <button onClick={handleSaveServerUrl} className="btn btn-primary">
            Save
          </button>
        </div>
      </div>

      {/* PWA Install */}
      <div className="card p-6 space-y-4">
        <h3 className="text-lg font-semibold">Install App</h3>
        <p className="text-sm text-dark-400">
          Install Recall as an app on your device to enable sharing from other apps.
        </p>

        <button onClick={handleInstallPWA} className="btn btn-primary flex items-center gap-2">
          <Download size={18} />
          Install Recall
        </button>

        <div className="text-sm text-dark-500 space-y-1">
          <p><strong>iOS:</strong> Tap Share → Add to Home Screen</p>
          <p><strong>Android:</strong> Tap menu (⋮) → Install app</p>
        </div>
      </div>

      {/* Extension */}
      <div className="card p-6 space-y-4">
        <h3 className="text-lg font-semibold">Browser Extension</h3>
        <p className="text-sm text-dark-400">
          Install the Chrome extension to save articles with one click.
        </p>

        <div className="bg-dark-800 rounded-lg p-4 text-sm">
          <p className="text-dark-300 mb-2">Manual installation:</p>
          <ol className="list-decimal list-inside text-dark-400 space-y-1">
            <li>Download the extension from your Recall server</li>
            <li>Open Chrome → Extensions → Enable Developer Mode</li>
            <li>Click "Load unpacked" and select the extension folder</li>
            <li>Enter your server URL and API key in extension settings</li>
          </ol>
        </div>
      </div>

      {/* About */}
      <div className="card p-6 space-y-2">
        <h3 className="text-lg font-semibold">About</h3>
        <p className="text-sm text-dark-400">
          Recall v1.0.0 — Your second brain for everything you read.
        </p>
        <p className="text-sm text-dark-500">
          Self-hosted, privacy-first knowledge management.
        </p>
      </div>
    </div>
  );
}
