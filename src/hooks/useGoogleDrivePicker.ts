import { useState, useEffect, useCallback } from 'react';

// Declare Google global variables so TypeScript doesn't complain
declare global {
  interface Window {
    gapi: any;
    google: any;
  }
}

interface GoogleDriveFile {
  id: string;
  name: string;
  url: string;
  mimeType: string;
  sizeBytes?: number;
}

export function useGoogleDrivePicker() {
  const [isReady, setIsReady] = useState(false);
  const [isPicking, setIsPicking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const API_KEY = import.meta.env.VITE_GOOGLE_CONSOLE_API_KEY;
  const CLIENT_ID = import.meta.env.VITE_GOOGLE_CONSOLE_CLIENT_ID;
  const SCOPES = 'https://www.googleapis.com/auth/drive.readonly';

  useEffect(() => {
    console.log('[Google Drive Picker] Starting initialization...');
    
    if (!API_KEY || !CLIENT_ID) {
      console.error('[Google Drive Picker] ERROR: Missing API Key or Client ID in environment variables!');
      setError('Missing Google credentials in .env');
      return;
    }

    // Load both required Google scripts sequentially or concurrently
    const loadScripts = async () => {
      try {
        console.log('[Google Drive Picker] Loading gapi script...');
        await loadScript('https://apis.google.com/js/api.js');
        
        console.log('[Google Drive Picker] Loading google Identity Services (GSI) script...');
        await loadScript('https://accounts.google.com/gsi/client');
        
        // After scripts load, load the picker component
        console.log('[Google Drive Picker] Both scripts loaded. Loading picker module...');
        window.gapi.load('picker', {
          callback: () => {
            console.log('[Google Drive Picker] Picker module loaded successfully. Hook is ready.');
            setIsReady(true);
          },
          onerror: () => {
            console.error('[Google Drive Picker] ERROR: Failed to load gapi picker module.');
            setError('Failed to load Google Picker');
          }
        });
      } catch (err: any) {
        console.error('[Google Drive Picker] ERROR loading scripts:', err);
        setError('Failed to load Google scripts');
      }
    };

    loadScripts();
  }, [API_KEY, CLIENT_ID]);

  // Helper to dynamically inject script tags
  const loadScript = (src: string) => {
    return new Promise<void>((resolve, reject) => {
      if (document.querySelector(`script[src="${src}"]`)) {
        resolve(); // Already loaded
        return;
      }
      const script = document.createElement('script');
      script.src = src;
      script.async = true;
      script.defer = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error(`Script load error for ${src}`));
      document.body.appendChild(script);
    });
  };

  const openPicker = useCallback(
    () => {
      return new Promise<GoogleDriveFile[]>((resolve, reject) => {
        if (!isReady) {
          console.warn('[Google Drive Picker] WARNING: openPicker called before ready');
          reject(new Error('Picker not ready yet'));
          return;
        }

        console.log('[Google Drive Picker] User requested to open picker. Starting OAuth flow...');
        setIsPicking(true);

        try {
          const tokenClient = window.google.accounts.oauth2.initTokenClient({
            client_id: CLIENT_ID,
            scope: SCOPES,
            callback: (response: any) => {
              if (response.error !== undefined) {
                console.error('[Google Drive Picker] ERROR during OAuth:', response.error);
                setIsPicking(false);
                reject(response);
                return;
              }

              console.log('[Google Drive Picker] OAuth Success! Access token received.');
              console.log('[Google Drive Picker] Building Picker UI...');
              
              const view = new window.google.picker.DocsView(window.google.picker.ViewId.DOCS);
              // You can uncomment below to filter by file types (e.g. PDFs, Word docs)
              // view.setMimeTypes('application/pdf,application/vnd.google-apps.document');

              const picker = new window.google.picker.PickerBuilder()
                .enableFeature(window.google.picker.Feature.NAV_HIDDEN)
                .enableFeature(window.google.picker.Feature.MULTISELECT_ENABLED)
                .setDeveloperKey(API_KEY)
                .setAppId(CLIENT_ID)
                .setOAuthToken(response.access_token)
                .addView(view)
                .setCallback((data: any) => {
                  if (data.action === window.google.picker.Action.PICKED) {
                    console.log('[Google Drive Picker] File(s) successfully picked by user.');
                    const files = data.docs.map((doc: any) => ({
                      id: doc.id,
                      name: doc.name,
                      url: doc.url,
                      mimeType: doc.mimeType,
                      sizeBytes: doc.sizeBytes
                    }));
                    console.log('[Google Drive Picker] Picked files:', files);
                    setIsPicking(false);
                    resolve(files);
                  } else if (data.action === window.google.picker.Action.CANCEL) {
                    console.log('[Google Drive Picker] User cancelled the picker window.');
                    setIsPicking(false);
                    resolve([]); // Resolve empty instead of rejecting on cancel
                  }
                })
                .build();
              
              picker.setVisible(true);
              console.log('[Google Drive Picker] Picker window is now visible to the user.');
            },
          });

          // Request the access token, which triggers the popup
          tokenClient.requestAccessToken({ prompt: 'consent' });
        } catch (err) {
          console.error('[Google Drive Picker] CRITICAL ERROR launching token client:', err);
          setIsPicking(false);
          reject(err);
        }
      });
    },
    [API_KEY, CLIENT_ID, isReady]
  );

  return { isReady, isPicking, error, openPicker };
}
