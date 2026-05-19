const DB_NAME = 'tj-images-v1'
const STORE_NAME = 'screenshots'

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = e => e.target.result.createObjectStore(STORE_NAME)
    req.onsuccess = e => resolve(e.target.result)
    req.onerror = e => reject(e.target.error)
  })
}

export async function saveImage(key, dataUrl) {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    tx.objectStore(STORE_NAME).put(dataUrl, key)
    tx.oncomplete = resolve
    tx.onerror = e => reject(e.target.error)
  })
}

export async function loadImage(key) {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly')
    const req = tx.objectStore(STORE_NAME).get(key)
    req.onsuccess = e => resolve(e.target.result ?? null)
    req.onerror = e => reject(e.target.error)
  })
}

export async function deleteImage(key) {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    tx.objectStore(STORE_NAME).delete(key)
    tx.oncomplete = resolve
    tx.onerror = e => reject(e.target.error)
  })
}

export function deleteTradeImages(tradeId) {
  return Promise.all([
    deleteImage(`${tradeId}-context`),
    deleteImage(`${tradeId}-orderflow`),
  ])
}

// Resizes and compresses to JPEG before storing — keeps each image under ~300KB
export function compressImage(file, maxWidth = 1400, quality = 0.82) {
  return new Promise(resolve => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      const scale = Math.min(1, maxWidth / img.width)
      const canvas = document.createElement('canvas')
      canvas.width = img.width * scale
      canvas.height = img.height * scale
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height)
      URL.revokeObjectURL(url)
      resolve(canvas.toDataURL('image/jpeg', quality))
    }
    img.src = url
  })
}
