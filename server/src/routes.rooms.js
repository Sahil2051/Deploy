const express = require('express')
const db = require('./db')
const multer = require('multer')
const path = require('path')

const router = express.Router()

// Configure Multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Save to ../uploads (relative to this file in src/)
    cb(null, path.join(__dirname, '../uploads'))
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9)
    cb(null, uniqueSuffix + path.extname(file.originalname))
  }
})

const upload = multer({ storage: storage })

// Get all rooms (for landing page)
router.get('/', async (_req, res) => {
  try {
    const [rows] = await db.execute(
      `SELECT r.*, u.full_name as owner_full_name, u.email as owner_email, u.phone_number as owner_phone,
       COALESCE(u.is_verified, 0) as owner_is_verified
       FROM rooms r
       JOIN users u ON r.owner_id = u.id
       WHERE r.is_available = TRUE
       ORDER BY r.created_at DESC`
    )

    // Parse photos JSON if it exists
    const rooms = rows.map(room => ({
      ...room,
      photos: typeof room.photos === 'string' ? JSON.parse(room.photos) : (room.photos || [])
    }))

    return res.json({ rooms })
  } catch (error) {
    console.error('Get rooms error', error)
    return res.status(500).json({ message: 'Failed to fetch rooms.' })
  }
})

// Get rooms by owner (for dashboard)
router.get('/my-rooms', async (req, res) => {
  const ownerId = req.query.ownerId

  if (!ownerId) {
    return res.status(400).json({ message: 'Owner ID required.' })
  }

  try {
    const [rows] = await db.execute(
      'SELECT * FROM rooms WHERE owner_id = ? ORDER BY created_at DESC',
      [ownerId]
    )

    // Parse photos JSON
    const rooms = rows.map(room => ({
      ...room,
      photos: typeof room.photos === 'string' ? JSON.parse(room.photos) : (room.photos || [])
    }))

    return res.json({ rooms })
  } catch (error) {
    console.error('Get my rooms error', error)
    return res.status(500).json({ message: 'Failed to fetch your rooms.' })
  }
})

// Create a new room with photos
router.post('/', upload.array('photos', 10), async (req, res) => {
  // Parsing multipart form data handled by multer
  // req.body contains text fields
  // req.files contains file info

  const {
    ownerId,
    ownerName,
    title,
    description,
    address,
    city,
    pricePerMonth,
    roomType,
    bedrooms,
    bathrooms,
    // areaSqft, // Unused
    availableFrom,
    amenities,
    contactEmail,
    contactPhone,
  } = req.body || {}

  if (!ownerId || !ownerName || !title || !address || !pricePerMonth) {
    return res.status(400).json({ message: 'Owner ID, owner name, title, address, and price are required.' })
  }

  try {
    // Process photos
    const photoPaths = req.files ? req.files.map(file => `/uploads/${file.filename}`) : []
    const photosJson = JSON.stringify(photoPaths)

    // Auto-generate owner_id_number based on total room count
    const [countResult] = await db.execute('SELECT COUNT(*) as total FROM rooms')
    const totalRooms = countResult[0].total || 0
    const generatedOwnerIdNumber = String(totalRooms + 1)

    const [result] = await db.execute(
      `INSERT INTO rooms (
        owner_id, owner_name, owner_id_number, title, description, address, city,
        price_per_month, room_type, bedrooms, bathrooms, area_sqft, available_from,
        amenities, contact_email, contact_phone, photos
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        ownerId,
        ownerName.trim(),
        generatedOwnerIdNumber,
        title.trim(),
        description?.trim() || null,
        address.trim(),
        city?.trim() || null,
        Number(pricePerMonth),
        roomType?.trim() || null,
        bedrooms ? Number(bedrooms) : 1,
        bathrooms ? Number(bathrooms) : 1,
        0, // area_sqft default to 0 as it is unused/removed from UI
        availableFrom || null,
        amenities?.trim() || null,
        contactEmail?.trim() || null,
        contactPhone?.trim() || null,
        photosJson
      ]
    )

    const [newRoom] = await db.execute('SELECT * FROM rooms WHERE id = ?', [result.insertId])

    return res.status(201).json({
      message: 'Room registered successfully.',
      room: newRoom[0],
    })
  } catch (error) {
    console.error('Create room error', error)
    return res.status(500).json({ message: 'Failed to register room.' })
  }
})

// Delete a room
router.delete('/:roomId', async (req, res) => {
  const { roomId } = req.params
  const { ownerId } = req.query

  if (!ownerId) {
    return res.status(400).json({ message: 'Owner ID required for deletion.' })
  }

  try {
    const [result] = await db.execute('DELETE FROM rooms WHERE id = ? AND owner_id = ?', [roomId, ownerId])

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Room not found or you do not have permission to delete it.' })
    }

    return res.json({ message: 'Room deleted successfully.' })
  } catch (error) {
    console.error('Delete room error', error)
    return res.status(500).json({ message: 'Failed to delete room.' })
  }
})

module.exports = router

