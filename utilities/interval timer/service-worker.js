// Service Worker for Interval Timer - Offline Support
const CACHE_NAME = 'interval-timer-v1';

// Get the base path from the service worker's location
const basePath = self.location.pathname.substring(0, self.location.pathname.lastIndexOf('/') + 1);

const urlsToCache = [
  './interval-timer.html',
  'https://fonts.googleapis.com/css2?family=Allerta+Stencil&display=swap',
  'https://fonts.gstatic.com/s/allertastencil/v20/HTx0L209KT-LmIE9N7OR6eiycOeF-zz313DuvE.woff2'
];

// Install event - cache resources
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Service Worker: Caching files');
        return cache.addAll(urlsToCache.map(url => new Request(url, {cache: 'reload'})));
      })
      .catch((error) => {
        console.log('Service Worker: Cache failed', error);
        // Cache the main HTML even if fonts fail
        return caches.open(CACHE_NAME).then((cache) => {
          return cache.add('./interval-timer.html');
        });
      })
  );
  self.skipWaiting(); // Activate immediately
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('Service Worker: Deleting old cache', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  return self.clients.claim(); // Take control of all pages immediately
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // Return cached version or fetch from network
        if (response) {
          return response;
        }
        
        // Clone the request because it's a stream
        const fetchRequest = event.request.clone();
        
        return fetch(fetchRequest).then((response) => {
          // Check if valid response
          if (!response || response.status !== 200 || response.type !== 'basic') {
            return response;
          }
          
          // Clone the response because it's a stream
          const responseToCache = response.clone();
          
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
          
          return response;
        }).catch(() => {
          // If fetch fails and it's a navigation request, return cached HTML
          if (event.request.mode === 'navigate') {
            // Try multiple possible paths for the HTML file
            return caches.match('./interval-timer.html')
              .then(response => {
                if (response) return response;
                // Try with base path
                return caches.match(basePath + 'interval-timer.html');
              })
              .then(response => {
                if (response) return response;
                // Try absolute path from root
                const url = new URL(event.request.url);
                const pathParts = url.pathname.split('/');
                const htmlPath = pathParts.slice(0, -1).join('/') + '/interval-timer.html';
                return caches.match(htmlPath);
              });
          }
        });
      })
  );
});
