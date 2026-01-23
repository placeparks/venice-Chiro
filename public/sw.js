const CACHE_NAME = 'spineai-offline-v1';

// App assets to cache
const APP_ASSETS = [
    '/',
    '/index.html',
    '/app.js',
];

// MediaPipe CDN resources to cache for offline pose detection
const MEDIAPIPE_ASSETS = [
    'https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js',
    'https://cdn.jsdelivr.net/npm/@mediapipe/drawing_utils/drawing_utils.js',
    'https://cdn.jsdelivr.net/npm/@mediapipe/pose/pose.js',
    'https://cdn.jsdelivr.net/npm/@mediapipe/pose/pose_solution_packed_assets.data',
    'https://cdn.jsdelivr.net/npm/@mediapipe/pose/pose_solution_simd_wasm_bin.wasm',
    'https://cdn.jsdelivr.net/npm/@mediapipe/pose/pose_solution_packed_assets_loader.js',
    'https://cdn.jsdelivr.net/npm/@mediapipe/pose/pose_solution_simd_wasm_bin.js',
    'https://cdn.jsdelivr.net/npm/@mediapipe/pose/pose_web.binarypb',
];

// Install event - cache app assets
self.addEventListener('install', (event) => {
    console.log('[SW] Installing service worker...');
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log('[SW] Caching app assets...');
            return cache.addAll(APP_ASSETS).catch((err) => {
                console.warn('[SW] Failed to cache some app assets:', err);
            });
        })
    );
    // Activate immediately
    self.skipWaiting();
});

// Activate event - clean old caches
self.addEventListener('activate', (event) => {
    console.log('[SW] Activating service worker...');
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames
                    .filter((name) => name !== CACHE_NAME)
                    .map((name) => {
                        console.log('[SW] Deleting old cache:', name);
                        return caches.delete(name);
                    })
            );
        })
    );
    // Take control immediately
    self.clients.claim();
});

// Fetch event - serve from cache, fetch and cache MediaPipe resources
self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // Handle MediaPipe CDN requests - cache first, then network
    if (url.hostname === 'cdn.jsdelivr.net' && url.pathname.includes('@mediapipe')) {
        event.respondWith(
            caches.open(CACHE_NAME).then((cache) => {
                return cache.match(event.request).then((cachedResponse) => {
                    if (cachedResponse) {
                        // Return cached response, but also update cache in background
                        fetch(event.request).then((networkResponse) => {
                            if (networkResponse && networkResponse.status === 200) {
                                cache.put(event.request, networkResponse.clone());
                            }
                        }).catch(() => {
                            // Network failed, that's ok - we have cache
                        });
                        return cachedResponse;
                    }

                    // Not cached, fetch and cache
                    return fetch(event.request).then((networkResponse) => {
                        if (networkResponse && networkResponse.status === 200) {
                            cache.put(event.request, networkResponse.clone());
                        }
                        return networkResponse;
                    }).catch((err) => {
                        console.error('[SW] Failed to fetch MediaPipe resource:', err);
                        throw err;
                    });
                });
            })
        );
        return;
    }

    // Handle app assets - network first, fallback to cache
    if (url.origin === self.location.origin) {
        event.respondWith(
            fetch(event.request)
                .then((networkResponse) => {
                    // Cache successful responses
                    if (networkResponse && networkResponse.status === 200) {
                        const responseClone = networkResponse.clone();
                        caches.open(CACHE_NAME).then((cache) => {
                            cache.put(event.request, responseClone);
                        });
                    }
                    return networkResponse;
                })
                .catch(() => {
                    // Network failed, try cache
                    return caches.match(event.request).then((cachedResponse) => {
                        if (cachedResponse) {
                            return cachedResponse;
                        }
                        // If requesting a page, return index.html for SPA routing
                        if (event.request.mode === 'navigate') {
                            return caches.match('/index.html');
                        }
                        throw new Error('No cached response available');
                    });
                })
        );
        return;
    }

    // For other requests, just fetch normally
    event.respondWith(fetch(event.request));
});

// Listen for messages to trigger MediaPipe caching
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'CACHE_MEDIAPIPE') {
        console.log('[SW] Pre-caching MediaPipe assets...');
        caches.open(CACHE_NAME).then((cache) => {
            Promise.all(
                MEDIAPIPE_ASSETS.map((url) =>
                    fetch(url)
                        .then((response) => {
                            if (response.ok) {
                                cache.put(url, response);
                                console.log('[SW] Cached:', url);
                            }
                        })
                        .catch((err) => console.warn('[SW] Failed to cache:', url, err))
                )
            ).then(() => {
                // Notify clients that caching is complete
                self.clients.matchAll().then((clients) => {
                    clients.forEach((client) => {
                        client.postMessage({ type: 'MEDIAPIPE_CACHED' });
                    });
                });
            });
        });
    }
});
