// RonaPump Push Notification Service Worker

self.addEventListener('push', function(event) {
  let data = { title: 'RonaPump 🦍', body: 'You have a new notification' }
  try {
    if (event.data) data = event.data.json()
  } catch (e) {
    // Use defaults
  }

  const options = {
    body: data.body || '',
    icon: '/logo-192.png',
    badge: '/logo-192.png',
    data: { url: data.url || 'https://www.ronapump.com' },
    vibrate: [200, 100, 200],
    tag: data.tag || 'ronapump-' + Date.now(),
    renotify: true,
  }

  event.waitUntil(
    self.registration.showNotification(data.title || 'RonaPump 🦍', options)
  )
})

self.addEventListener('notificationclick', function(event) {
  event.notification.close()
  const url = event.notification.data?.url || 'https://www.ronapump.com'
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
      // Focus existing window if open
      for (const client of clientList) {
        if (client.url.includes('ronapump.com') && 'focus' in client) {
          return client.focus()
        }
      }
      // Otherwise open new window
      return clients.openWindow(url)
    })
  )
})
