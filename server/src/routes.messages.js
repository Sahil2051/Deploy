const express = require('express')
const db = require('./db')

const router = express.Router()

// Middleware to check if user is authenticated (expects userId in body or query)
const requireAuth = (req, res, next) => {
  const userId = req.body.userId || req.query.userId
  if (!userId) {
    return res.status(401).json({ message: 'Authentication required' })
  }
  req.user = { id: parseInt(userId) }
  next()
}

// Get all conversations for the current user
router.get('/conversations', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id

    const [conversations] = await db.execute(`
      SELECT
        CASE
          WHEN ct.participant1_id = ? THEN ct.participant2_id
          ELSE ct.participant1_id
        END as other_user_id,
        u.full_name as other_user_name,
        u.email as other_user_email,
        ct.room_id,
        r.title as room_title,
        ct.last_message_at,
        cm.content as last_message,
        cm.sender_id = ? as is_from_me,
        ct.is_favorite,
        (SELECT COUNT(*) FROM chat_messages WHERE receiver_id = ? AND sender_id = other_user_id AND is_read = FALSE) as unread_count
      FROM chat_threads ct
      JOIN users u ON (u.id = CASE WHEN ct.participant1_id = ? THEN ct.participant2_id ELSE ct.participant1_id END)
      LEFT JOIN rooms r ON ct.room_id = r.id
      LEFT JOIN chat_messages cm ON cm.id = (
        SELECT id FROM chat_messages
        WHERE (sender_id = ct.participant1_id AND receiver_id = ct.participant2_id)
           OR (sender_id = ct.participant2_id AND receiver_id = ct.participant1_id)
        ORDER BY created_at DESC LIMIT 1
      )
      WHERE (ct.participant1_id = ? OR ct.participant2_id = ?)
      ORDER BY ct.is_favorite DESC, ct.last_message_at DESC
    `, [userId, userId, userId, userId, userId, userId])

    res.json({ conversations })
  } catch (error) {
    console.error('Get conversations error:', error)
    res.status(500).json({ message: 'Failed to load conversations' })
  }
})

// Get messages in a conversation with another user
router.get('/conversation/:otherUserId', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id
    const otherUserId = req.params.otherUserId
    const roomId = req.query.roomId ? parseInt(req.query.roomId) : null

    // Mark messages as read
    await db.execute(`
      UPDATE chat_messages
      SET is_read = TRUE
      WHERE sender_id = ? AND receiver_id = ? AND is_read = FALSE
    `, [otherUserId, userId])

    const [messages] = await db.execute(`
      SELECT
        cm.id,
        cm.sender_id,
        cm.receiver_id,
        cm.content,
        cm.is_read,
        cm.created_at,
        u.full_name as sender_name
      FROM chat_messages cm
      JOIN users u ON cm.sender_id = u.id
      WHERE ((cm.sender_id = ? AND cm.receiver_id = ?) OR (cm.sender_id = ? AND cm.receiver_id = ?))
        AND (cm.room_id = ? OR ? IS NULL)
      ORDER BY cm.created_at ASC
    `, [userId, otherUserId, otherUserId, userId, roomId, roomId])

    res.json({ messages })
  } catch (error) {
    console.error('Get messages error:', error)
    res.status(500).json({ message: 'Failed to load messages' })
  }
})

// Send a message
router.post('/send', requireAuth, async (req, res) => {
  try {
    const { receiverId, content, roomId } = req.body
    const senderId = req.user.id

    if (!receiverId || !content) {
      return res.status(400).json({ message: 'Receiver and content are required' })
    }

    // Check if receiver exists
    const [receiver] = await db.execute('SELECT id FROM users WHERE id = ?', [receiverId])
    if (receiver.length === 0) {
      return res.status(404).json({ message: 'Receiver not found' })
    }

    // Insert message
    const [result] = await db.execute(`
      INSERT INTO chat_messages (sender_id, receiver_id, content, room_id)
      VALUES (?, ?, ?, ?)
    `, [senderId, receiverId, content, roomId || null])

    // Update or create thread
    const participants = [senderId, receiverId].sort((a, b) => a - b)
    await db.execute(`
      INSERT INTO chat_threads (participant1_id, participant2_id, room_id, last_message_at)
      VALUES (?, ?, ?, NOW())
      ON DUPLICATE KEY UPDATE last_message_at = NOW()
    `, [participants[0], participants[1], roomId || null])

    res.status(201).json({
      message: 'Message sent successfully',
      messageId: result.insertId
    })
  } catch (error) {
    console.error('Send message error:', error)
    res.status(500).json({ message: 'Failed to send message' })
  }
})

// Delete a conversation (remove all messages and thread)
router.delete('/conversation/:otherUserId', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id
    const otherUserId = req.params.otherUserId

    // delete messages between these users
    await db.execute(`
      DELETE FROM chat_messages
      WHERE (sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?)
    `, [userId, otherUserId, otherUserId, userId])

    // delete any thread records (all rooms)
    await db.execute(`
      DELETE FROM chat_threads
      WHERE (participant1_id = ? AND participant2_id = ?)
         OR (participant1_id = ? AND participant2_id = ?)
    `, [userId, otherUserId, otherUserId, userId])

    res.json({ message: 'Conversation deleted' })
  } catch (error) {
    console.error('Delete conversation error:', error)
    res.status(500).json({ message: 'Failed to delete conversation' })
  }
})

// Get unread message count
router.get('/unread-count', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id

    const [result] = await db.execute(`
      SELECT COUNT(*) as unread_count
      FROM chat_messages
      WHERE receiver_id = ? AND is_read = FALSE
    `, [userId])

    res.json({ unreadCount: result[0].unread_count })
  } catch (error) {
    console.error('Get unread count error:', error)
    res.status(500).json({ message: 'Failed to get unread count' })
  }
})

// Toggle favorite status for a conversation
router.patch('/conversation/:otherUserId/favorite', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id
    const otherUserId = req.params.otherUserId
    const { favorite } = req.body

    if (typeof favorite !== 'boolean') {
      return res.status(400).json({ message: 'favorite must be boolean' })
    }

    await db.execute(`
      UPDATE chat_threads
      SET is_favorite = ?
      WHERE (participant1_id = ? AND participant2_id = ?) OR (participant1_id = ? AND participant2_id = ?)
    `, [favorite ? 1 : 0, userId, otherUserId, otherUserId, userId])

    res.json({ message: 'Favorite status updated' })
  } catch (error) {
    console.error('Toggle favorite error:', error)
    res.status(500).json({ message: 'Failed to update favorite status' })
  }
})

module.exports = router