import { useState, useEffect, useCallback } from 'react';

// Declare Google global variables so TypeScript doesn't complain
declare global {
  interface Window {
    gapi: any;
    google: any;
  }
}

export interface GoogleDriveFile {
  id: string;
  name: string;
  url?: string;
  webViewLink?: string;
  mimeType: string;
  iconLink?: string;
  sizeBytes?: number;
}

export interface GoogleDriveFolder {
  id: string;
  name: string;
}

export function useGoogleDrivePicker() {
  const [isReady, setIsReady] = useState(false);
  const [isPicking, setIsPicking] = useState(false);
  const [isFetching, setIsFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Cache the token to prevent popups on every refresh
  const [cachedToken, setCachedToken] = useState<{ token: string, expiry: number } | null>(null);

  const API_KEY = import.meta.env.VITE_GOOGLE_CONSOLE_API_KEY;
  const CLIENT_ID = import.meta.env.VITE_GOOGLE_CONSOLE_CLIENT_ID;
  const SCOPES = 'https://www.googleapis.com/auth/drive.readonly';

  useEffect(() => {
    console.log('[Google Drive] Starting initialization...');
    
    if (!API_KEY || !CLIENT_ID) {
      console.error('[Google Drive] ERROR: Missing API Key or Client ID in environment variables!');
      setError('Missing Google credentials in .env');
      return;
    }

    const loadScripts = async () => {
      try {
        console.log('[Google Drive] Loading scripts...');
        await Promise.all([
          loadScript('https://apis.google.com/js/api.js'),
          loadScript('https://accounts.google.com/gsi/client')
        ]);
        
        console.log('[Google Drive] Scripts loaded. Loading picker and client modules...');
        window.gapi.load('picker:client', {
          callback: async () => {
            console.log('[Google Drive] Modules loaded. Initializing client...');
            try {
              await window.gapi.client.init({
                apiKey: API_KEY,
                discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'],
              });
              console.log('[Google Drive] Client initialized. Hook is ready.');
              setIsReady(true);
            } catch (initErr) {
              console.error('[Google Drive] ERROR initializing client:', initErr);
              setError('Failed to initialize Google API client');
            }
          },
          onerror: () => {
            console.error('[Google Drive] ERROR: Failed to load gapi modules.');
            setError('Failed to load Google API modules');
          }
        });
      } catch (err: any) {
        console.error('[Google Drive] ERROR loading scripts:', err);
        setError('Failed to load Google scripts');
      }
    };

    loadScripts();
  }, [API_KEY, CLIENT_ID]);

  const loadScript = (src: string) => {
    return new Promise<void>((resolve, reject) => {
      if (document.querySelector(`script[src="${src}"]`)) {
        resolve();
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

  const getAccessToken = (prompt = false): Promise<string> => {
    return new Promise((resolve, reject) => {
      // Return cached token if still valid (give 5 min buffer)
      if (cachedToken && Date.now() < cachedToken.expiry - 300000) {
        resolve(cachedToken.token);
        return;
      }

      try {
        const tokenClient = window.google.accounts.oauth2.initTokenClient({
          client_id: CLIENT_ID,
          scope: SCOPES,
          callback: (response: any) => {
            if (response.error !== undefined) {
              console.error('[Google Drive] OAuth Error:', response.error);
              reject(response);
              return;
            }
            console.log('[Google Drive] OAuth Success! Token received.');
            // Google tokens usually expire in 3600 seconds (1 hr)
            const expiresIn = response.expires_in || 3600;
            setCachedToken({
              token: response.access_token,
              expiry: Date.now() + expiresIn * 1000
            });
            resolve(response.access_token);
          },
        });
        
        if (prompt) {
          tokenClient.requestAccessToken({ prompt: 'consent' });
        } else {
          tokenClient.requestAccessToken({ prompt: '' });
        }
      } catch (err) {
        reject(err);
      }
    });
  };

  const pickFolder = useCallback(
    () => {
      return new Promise<GoogleDriveFolder | null>(async (resolve, reject) => {
        if (!isReady) {
          reject(new Error('Google Drive API not ready yet'));
          return;
        }

        console.log('[Google Drive] User requested to pick a folder.');
        setIsPicking(true);

        try {
          const accessToken = await getAccessToken(true);
          console.log('[Google Drive] Building Folder Picker UI...');
          
          const view = new window.google.picker.DocsView(window.google.picker.ViewId.FOLDERS);
          view.setSelectFolderEnabled(true);
          view.setMimeTypes('application/vnd.google-apps.folder');

          const picker = new window.google.picker.PickerBuilder()
            .enableFeature(window.google.picker.Feature.NAV_HIDDEN)
            .setDeveloperKey(API_KEY)
            .setAppId(CLIENT_ID)
            .setOAuthToken(accessToken)
            .addView(view)
            .setCallback((data: any) => {
              if (data.action === window.google.picker.Action.PICKED) {
                const folder = data.docs[0];
                console.log('[Google Drive] Folder picked:', folder.name);
                setIsPicking(false);
                resolve({ id: folder.id, name: folder.name });
              } else if (data.action === window.google.picker.Action.CANCEL) {
                console.log('[Google Drive] Picker cancelled.');
                setIsPicking(false);
                resolve(null);
              }
            })
            .build();
          
          picker.setVisible(true);
        } catch (err) {
          console.error('[Google Drive] Error launching picker:', err);
          setIsPicking(false);
          reject(err);
        }
      });
    },
    [API_KEY, CLIENT_ID, isReady]
  );

  const fetchFolderFiles = useCallback(
    async (folderId: string): Promise<GoogleDriveFile[]> => {
      if (!isReady) throw new Error('Google Drive API not ready');
      
      console.log(`[Google Drive] Fetching files for folder: ${folderId}`);
      setIsFetching(true);
      
      try {
        // Pass false so it doesn't force a consent prompt every time
        const accessToken = await getAccessToken(false);
        window.gapi.client.setToken({ access_token: accessToken });

        const response = await window.gapi.client.drive.files.list({
          q: `'${folderId}' in parents and trashed=false`,
          fields: 'files(id, name, mimeType, webViewLink, iconLink)',
          orderBy: 'folder, name'
        });

        const files = response.result.files || [];
        console.log(`[Google Drive] Found ${files.length} files.`);
        setIsFetching(false);
        return files as GoogleDriveFile[];
      } catch (err) {
        console.error('[Google Drive] Error fetching folder files:', err);
        setIsFetching(false);
        throw err;
      }
    },
    [isReady]
  );

  return { isReady, isPicking, isFetching, error, pickFolder, fetchFolderFiles };
}
