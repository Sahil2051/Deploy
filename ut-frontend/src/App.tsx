import { useState, useEffect, type ChangeEvent, type FormEvent } from 'react'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5000/api'

type User = {
  id: number
  fullName: string
  email: string
  phoneNumber: string
  isVerified?: boolean
}

type Room = {
  id: number
  owner_id: number
  owner_name: string
  owner_id_number?: string
  owner_is_verified?: boolean
  title: string
  description?: string
  address: string
  city?: string
  price_per_month: number
  room_type?: string
  bedrooms: number
  bathrooms: number
  area_sqft?: number // Kept for DB compatibility but unused in UI
  photos?: string[]
  available_from?: string
  amenities?: string
  contact_email?: string
  contact_phone?: string
  is_available: boolean
  created_at: string
}

type Booking = {
  id: number
  user_id: number
  room_id: number
  room_title: string
  room_address: string
  room_city: string
  check_in_date: string
  check_out_date: string
  guests_count: number
  total_price: number
  status: 'pending' | 'approved' | 'rejected' | 'cancelled'
  special_requests?: string
  created_at: string
  user_name?: string
  user_email?: string
  user_phone?: string
}

const initialSignupState = {
  fullName: '',
  age: '',
  address: '',
  email: '',
  phoneNumber: '',
  password: '',
}

const initialLoginState = {
  credential: '',
  password: '',
}

const initialRoomState = {
  ownerName: '',
  title: '',
  description: '',
  address: '',
  city: '',
  pricePerMonth: '',
  roomType: '',
  bedrooms: '1',
  bathrooms: '1',
  areaSqft: '', // Deprecated in UI
  availableFrom: '',
  amenities: '',
  contactEmail: '',
  contactPhone: '',
}

const initialBookingState = {
  checkInDate: '',
  checkOutDate: '',
  guestsCount: '1',
  specialRequests: '',
}

interface UserInquiry {
  id: number
  room_id: number
  room_title: string
  sender_name: string
  sender_email: string
  sender_phone: string | null
  message: string
  created_at: string
}

type ViewState = 'home' | 'rooms' | 'premium' | 'docs' | 'room-details'
type ModalView = 'signup' | 'login' | 'register-room' | 'admin-verify' | 'account' | null

type AdminUser = {
  id: number
  fullName: string
  email: string
  phoneNumber: string
  age: number
  address: string
  isVerified: boolean
  createdAt: string
}

function App() {
  const [currentView, setCurrentView] = useState<ViewState>('home')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null)
  const [user, setUser] = useState<User | null>(() => {
    const stored = localStorage.getItem('shelter_user')
    return stored ? JSON.parse(stored) : null
  })
  const [signupData, setSignupData] = useState(initialSignupState)
  const [loginData, setLoginData] = useState(initialLoginState)
  const [roomData, setRoomData] = useState(initialRoomState)
  const [roomStep, setRoomStep] = useState(1) // 1 or 2
  const [roomPhotos, setRoomPhotos] = useState<File[]>([])
  const [signupMessage, setSignupMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [loginMessage, setLoginMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [roomMessage, setRoomMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [signupLoading, setSignupLoading] = useState(false)
  const [loginLoading, setLoginLoading] = useState(false)
  const [roomLoading, setRoomLoading] = useState(false)
  const [activeModal, setActiveModal] = useState<ModalView>(null)
  const [myRooms, setMyRooms] = useState<Room[]>([])
  const [allRooms, setAllRooms] = useState<Room[]>([])
  const [filteredRooms, setFilteredRooms] = useState<Room[]>([])
  const [loadingRooms, setLoadingRooms] = useState(false)
  const [userInquiries, setUserInquiries] = useState<UserInquiry[]>([])
  const [isAdmin, setIsAdmin] = useState(false)
  const [adminMasterPassword, setAdminMasterPassword] = useState('')
  const [adminUsers, setAdminUsers] = useState<AdminUser[]>([])
  const [adminRooms, setAdminRooms] = useState<Room[]>([])
  const [adminBookings, setAdminBookings] = useState<Booking[]>([])
  const [adminLoading, setAdminLoading] = useState(false)
  const [adminActiveTab, setAdminActiveTab] = useState<'users' | 'rooms' | 'bookings'>('users')
  const [bookingData, setBookingData] = useState(initialBookingState)
  const [myBookings, setMyBookings] = useState<Booking[]>([])
  const [ownerBookings, setOwnerBookings] = useState<Booking[]>([])
  const [accountTab, setAccountTab] = useState<'profile' | 'inquiries' | 'bookings' | 'incoming'>('profile')
  const [bookingMessage, setBookingMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [bookingLoading, setBookingLoading] = useState(false)
  const [showLoginPassword, setShowLoginPassword] = useState(false)
  const [showSignupPassword, setShowSignupPassword] = useState(false)

  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredRooms(allRooms)
    } else {
      const lowerQuery = searchQuery.toLowerCase()
      const filtered = allRooms.filter(room =>
        room.address.toLowerCase().includes(lowerQuery) ||
        room.city?.toLowerCase().includes(lowerQuery) ||
        room.title.toLowerCase().includes(lowerQuery)
      )
      setFilteredRooms(filtered)
    }
  }, [searchQuery, allRooms])

  useEffect(() => {
    if (user) {
      fetchMyRooms()
      fetchMyBookings()
      fetchOwnerBookings()
    }
    fetchAllRooms()
  }, [user])

  const fetchMyRooms = async () => {
    if (!user) return
    setLoadingRooms(true)
    try {
      const response = await fetch(`${API_BASE_URL}/rooms/my-rooms?ownerId=${user.id}`)
      const payload = await response.json()
      if (response.ok) {
        setMyRooms(payload.rooms || [])
      }
    } catch (error) {
      console.error('Failed to fetch my rooms', error)
    } finally {
      setLoadingRooms(false)
    }
  }

  const fetchMyBookings = async () => {
    if (!user) return
    setBookingLoading(true)
    try {
      const response = await fetch(`${API_BASE_URL}/bookings/user/${user.id}`)
      const payload = await response.json()
      if (response.ok) {
        setMyBookings(payload.bookings || [])
      }
    } catch (error) {
      console.error('Failed to fetch my bookings', error)
    } finally {
      setBookingLoading(false)
    }
  }

  const fetchOwnerBookings = async () => {
    if (!user) return
    setBookingLoading(true)
    try {
      const response = await fetch(`${API_BASE_URL}/bookings/owner/${user.id}`)
      const payload = await response.json()
      if (response.ok) {
        setOwnerBookings(payload.bookings || [])
      }
    } catch (error) {
      console.error('Failed to fetch incoming bookings', error)
    } finally {
      setBookingLoading(false)
    }
  }

  const fetchAllRooms = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/rooms`)
      const payload = await response.json()
      if (response.ok) {
        setAllRooms(payload.rooms || [])
      }
    } catch (error) {
      console.error('Failed to fetch all rooms', error)
    }
  }

  const openModal = (view: ModalView) => {
    setActiveModal(view)
    setSignupMessage(null)
    setLoginMessage(null)
    setRoomMessage(null)
  }

  const closeModal = () => {
    setActiveModal(null)
    setRoomData(initialRoomState)
    setRoomStep(1)
    setRoomPhotos([])
  }

  const handleLogout = () => {
    setUser(null)
    localStorage.removeItem('shelter_user')
    setMyRooms([])
  }

  const handleSignupChange = (event: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = event.target
    setSignupData((prev) => ({ ...prev, [name]: value }))
  }

  const handleLoginChange = (event: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = event.target
    setLoginData((prev) => ({ ...prev, [name]: value }))
  }

  const handleRoomChange = (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = event.target
    setRoomData((prev) => ({ ...prev, [name]: value }))
  }

  const handlePhotoChange = (event: ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files.length > 0) {
      setRoomPhotos(Array.from(event.target.files))
    }
  }

  const handleSignupSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSignupLoading(true)
    setSignupMessage(null)

    try {
      const response = await fetch(`${API_BASE_URL}/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: signupData.fullName,
          age: Number(signupData.age),
          address: signupData.address,
          email: signupData.email,
          phoneNumber: signupData.phoneNumber,
          password: signupData.password,
        }),
      })

      const payload = await response.json()

      if (!response.ok) {
        throw new Error(payload?.message ?? 'Signup failed')
      }

      setSignupMessage({ type: 'success', text: payload?.message ?? 'Signup successful' })
      setSignupData(initialSignupState)
      setTimeout(() => {
        closeModal()
        openModal('login')
      }, 1500)
    } catch (error) {
      setSignupMessage({ type: 'error', text: error instanceof Error ? error.message : 'Signup failed' })
    } finally {
      setSignupLoading(false)
    }
  }

  const handleLoginSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setLoginLoading(true)
    setLoginMessage(null)

    // Check if this is an admin login attempt BEFORE API call
    const isAdminAttempt = loginData.credential.trim() === '9746872051' && loginData.password === 'sahil@123'

    if (isAdminAttempt) {
      // Show admin verification modal instead of logging in normally
      setActiveModal('admin-verify')
      setLoginData(initialLoginState)
      setLoginLoading(false)
      return
    }

    try {
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          credential: loginData.credential,
          password: loginData.password,
        }),
      })

      const payload = await response.json()

      if (!response.ok) {
        throw new Error(payload?.message ?? 'Login failed')
      }

      setUser(payload.user)
      localStorage.setItem('shelter_user', JSON.stringify(payload.user))
      setLoginMessage({ type: 'success', text: payload?.message ?? 'Login successful' })
      setLoginData(initialLoginState)
      setTimeout(() => {
        closeModal()
      }, 1000)
    } catch (error) {
      setLoginMessage({ type: 'error', text: error instanceof Error ? error.message : 'Login failed' })
    } finally {
      setLoginLoading(false)
    }
  }

  const handleRoomSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!user) return

    // If on Step 1, just go to Step 2
    if (roomStep === 1) {
      setRoomStep(2)
      return
    }

    setRoomLoading(true)
    setRoomMessage(null)

    try {
      const formData = new FormData()
      formData.append('ownerId', String(user.id))
      formData.append('ownerName', roomData.ownerName || user.fullName)
      formData.append('title', roomData.title)
      formData.append('description', roomData.description)
      formData.append('address', roomData.address)
      formData.append('city', roomData.city)
      formData.append('pricePerMonth', roomData.pricePerMonth)
      formData.append('roomType', roomData.roomType)
      formData.append('bedrooms', roomData.bedrooms)
      formData.append('bathrooms', roomData.bathrooms)
      // formData.append('areaSqft', roomData.areaSqft) // Not sending area anymore
      formData.append('availableFrom', roomData.availableFrom)
      formData.append('amenities', roomData.amenities)
      formData.append('contactEmail', roomData.contactEmail || user.email)
      formData.append('contactPhone', roomData.contactPhone || user.phoneNumber)

      // Append photos
      roomPhotos.forEach((photo) => {
        formData.append('photos', photo)
      })

      const response = await fetch(`${API_BASE_URL}/rooms`, {
        method: 'POST',
        // headers: { 'Content-Type': 'multipart/form-data' }, // Let browser set boundary
        body: formData,
      })

      const payload = await response.json()

      if (!response.ok) {
        throw new Error(payload?.message ?? 'Failed to register room')
      }

      setRoomMessage({ type: 'success', text: payload?.message ?? 'Room registered successfully' })
      setRoomData(initialRoomState)
      setRoomPhotos([])
      setRoomStep(1)
      await fetchMyRooms()
      await fetchAllRooms()
      setTimeout(() => {
        closeModal()
      }, 1500)
    } catch (error) {
      setRoomMessage({ type: 'error', text: error instanceof Error ? error.message : 'Failed to register room' })
    } finally {
      setRoomLoading(false)
    }
  }

  const handleDeleteRoom = async (roomId: number) => {
    if (!user && !isAdmin) return
    if (!confirm('Are you sure you want to delete this room?')) return

    try {
      const url = isAdmin
        ? `${API_BASE_URL}/admin/rooms/${roomId}`
        : `${API_BASE_URL}/rooms/${roomId}?ownerId=${user!.id}`

      const response = await fetch(url, {
        method: 'DELETE',
      })

      const payload = await response.json()

      if (!response.ok) {
        throw new Error(payload?.message ?? 'Failed to delete room')
      }

      if (isAdmin) {
        await fetchAdminRooms()
      } else {
        await fetchMyRooms()
      }
      await fetchAllRooms()
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to delete room')
    }
  }

  const handleAdminVerify = () => {
    if (adminMasterPassword === 'Password@6969') {
      setIsAdmin(true)
      localStorage.setItem('shelter_admin', 'true')
      setActiveModal(null)
      setAdminMasterPassword('')
      fetchAdminUsers()
      fetchAdminRooms()
      fetchAdminBookings()
    } else {
      alert('Invalid master password')
    }
  }

  const fetchUserInquiries = async () => {
    if (!user) return
    try {
      const resp = await fetch(`${API_BASE_URL}/rooms/my-inquiries/${user.id}`)
      const data = await resp.json()
      if (resp.ok) setUserInquiries(data.inquiries)
    } catch (err) {
      console.error('Fetch inquiries error', err)
    }
  }

  const handleUpdateProfile = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    const payload = {
      id: user?.id,
      fullName: formData.get('fullName'),
      email: formData.get('email'),
      phoneNumber: formData.get('phoneNumber'),
      password: formData.get('password') || undefined,
    }

    try {
      const resp = await fetch(`${API_BASE_URL}/auth/profile`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      const data = await resp.json()
      if (resp.ok) {
        setUser({ ...user!, ...data.user })
        alert('Profile updated!')
        closeModal()
      } else {
        alert(data.message || 'Update failed')
      }
    } catch (err) {
      alert('Network error')
    }
  }

  const handleSendInquiry = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!selectedRoom) return
    const formData = new FormData(e.currentTarget)
    const payload = {
      senderName: formData.get('senderName'),
      senderEmail: formData.get('senderEmail'),
      senderPhone: formData.get('senderPhone'),
      message: formData.get('message'),
    }

    try {
      const resp = await fetch(`${API_BASE_URL}/rooms/${selectedRoom.id}/inquire`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      const data = await resp.json()
      if (resp.ok) {
        alert('Inquiry sent successfully!')
        e.currentTarget.reset()
      } else {
        alert(data.message || 'Failed to send inquiry')
      }
    } catch (err) {
      alert('Network error')
    }
  }

  const handleBookingSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!user) {
      alert('Please login to book a room.')
      openModal('login')
      return
    }
    if (!selectedRoom) return

    setBookingLoading(true)
    setBookingMessage(null)

    const payload = {
      userId: user.id,
      roomId: selectedRoom.id,
      checkInDate: bookingData.checkInDate,
      checkOutDate: bookingData.checkOutDate,
      guestsCount: Number(bookingData.guestsCount),
      totalPrice: Number(selectedRoom.price_per_month) * 1, // Simplified: 1 month for now
      specialRequests: bookingData.specialRequests
    }

    try {
      const resp = await fetch(`${API_BASE_URL}/bookings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      const data = await resp.json()
      if (resp.ok) {
        setBookingMessage({ type: 'success', text: data.message })
        setTimeout(() => {
          setBookingMessage(null)
          setBookingData(initialBookingState)
        }, 3000)
        fetchMyBookings()
      } else {
        setBookingMessage({ type: 'error', text: data.message || 'Booking failed' })
      }
    } catch (err) {
      setBookingMessage({ type: 'error', text: 'Network error' })
    } finally {
      setBookingLoading(false)
    }
  }

  const handleBookingChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setBookingData(prev => ({ ...prev, [name]: value }))
  }

  const handleAdminLogout = () => {
    setIsAdmin(false)
    localStorage.removeItem('shelter_admin')
    setAdminUsers([])
    setAdminRooms([])
  }

  const fetchAdminUsers = async () => {
    setAdminLoading(true)
    try {
      const response = await fetch(`${API_BASE_URL}/admin/users`)
      const payload = await response.json()
      if (response.ok) {
        setAdminUsers(payload.users || [])
      }
    } catch (error) {
      console.error('Failed to fetch admin users', error)
    } finally {
      setAdminLoading(false)
    }
  }

  const fetchAdminRooms = async () => {
    setAdminLoading(true)
    try {
      const response = await fetch(`${API_BASE_URL}/admin/rooms`)
      const payload = await response.json()
      if (response.ok) {
        setAdminRooms(payload.rooms || [])
      }
    } catch (error) {
      console.error('Failed to fetch admin rooms', error)
    } finally {
      setAdminLoading(false)
    }
  }

  const fetchAdminBookings = async () => {
    setAdminLoading(true)
    try {
      const response = await fetch(`${API_BASE_URL}/admin/bookings`)
      const payload = await response.json()
      if (response.ok) {
        setAdminBookings(payload.bookings || [])
      }
    } catch (error) {
      console.error('Failed to fetch admin bookings', error)
    } finally {
      setAdminLoading(false)
    }
  }

  const handleUpdateOwnerBookingStatus = async (bookingId: number, status: string) => {
    if (!user) return
    try {
      const response = await fetch(`${API_BASE_URL}/bookings/${bookingId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, userId: user.id })
      })
      if (response.ok) {
        fetchOwnerBookings()
      } else {
        const data = await response.json()
        alert(data.message || 'Failed to update booking status')
      }
    } catch (error) {
      console.error('Update room booking status error', error)
    }
  }

  const handleDeleteUser = async (userId: number) => {
    if (!confirm('Are you sure you want to delete this user? This will also delete all their rooms.')) return

    try {
      const response = await fetch(`${API_BASE_URL}/admin/users/${userId}`, {
        method: 'DELETE',
      })

      const payload = await response.json()

      if (!response.ok) {
        throw new Error(payload?.message ?? 'Failed to delete user')
      }

      await fetchAdminUsers()
      await fetchAdminRooms()
      await fetchAllRooms()
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to delete user')
    }
  }

  const handleVerifyUser = async (userId: number) => {
    try {
      const response = await fetch(`${API_BASE_URL}/admin/users/${userId}/verify`, {
        method: 'PATCH',
      })

      const payload = await response.json()

      if (!response.ok) {
        throw new Error(payload?.message ?? 'Failed to verify user')
      }

      await fetchAdminUsers()
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to verify user')
    }
  }

  const handleUnverifyUser = async (userId: number) => {
    try {
      const response = await fetch(`${API_BASE_URL}/admin/users/${userId}/unverify`, {
        method: 'PATCH',
      })

      const payload = await response.json()

      if (!response.ok) {
        throw new Error(payload?.message ?? 'Failed to unverify user')
      }

      await fetchAdminUsers()
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to unverify user')
    }
  }

  useEffect(() => {
    const adminStatus = localStorage.getItem('shelter_admin')
    if (adminStatus === 'true') {
      setIsAdmin(true)
      fetchAdminUsers()
      fetchAdminRooms()
      fetchAdminBookings()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])



  const SERVER_URL = API_BASE_URL.replace('/api', '')

  return (
    <div className="shelter-shell">
      <div className="galaxy-comet" style={{ left: '10%', animationDelay: '2s' }} />
      <div className="galaxy-comet" style={{ left: '40%', animationDelay: '8s' }} />
      <div className="galaxy-comet" style={{ left: '70%', animationDelay: '15s' }} />
      <div className="star-layer" />
      <div className="star-shimmer" />
      <div className="shooting-star" style={{ animationDelay: '0s' }} />
      <div className="shooting-star" style={{ animationDelay: '4s', left: '30%' }} />
      <div className="shooting-star" style={{ animationDelay: '12s', left: '60%' }} />
      <div className="glow-star" />
      <div className="glow-star" />
      <div className="glow-star" />
      <div className="glow-star" />
      <div className="glow-star" />
      <div className="glow-star" />
      <div className="glow-star" />
      <div className="glow-star" />
      <div className="hero-glow" aria-hidden="true" />
      <div className="hero-glow secondary" aria-hidden="true" />

      <nav className="nav">
        <div className="logo" onClick={() => setCurrentView('home')} style={{ cursor: 'pointer' }}>
          SHELTER
        </div>

        <div className="nav-links-side">
          <button
            className={`nav-link ${(currentView as string) === 'home' ? 'active' : ''}`}
            onClick={() => setCurrentView('home')}
          >
            <span>🏠</span> Home
          </button>
          <button
            className={`nav-link ${(currentView as string) === 'rooms' ? 'active' : ''}`}
            onClick={() => setCurrentView('rooms')}
          >
            <span>🛏️</span> Rooms
          </button>
          <button
            className={`nav-link premium ${(currentView as string) === 'premium' ? 'active' : ''}`}
            onClick={() => setCurrentView('premium')}
          >
            <span>👑</span> Premium
          </button>
          <button
            className={`nav-link ${(currentView as string) === 'docs' ? 'active' : ''}`}
            onClick={() => setCurrentView('docs')}
          >
            <span>📄</span> Docs
          </button>
        </div>
      </nav >

      {currentView === 'docs' && (
        <div className="docs-page">
          <div className="docs-header">
            <div className="hero-pill">Project Documentation</div>
            <h1>How Shelter Works</h1>
            <p style={{ maxWidth: '600px', margin: '0 auto', color: '#94a3b8' }}>
              A comprehensive guide for guests, users, and administrators.
            </p>
          </div>

          <div className="docs-section">
            <h2><span className="docs-icon">👋</span> Guest Users</h2>
            <div className="docs-card">
              <p>
                <strong>Guest users</strong> can freely browse all available rooms without needing to log in.
                They can search for rooms by location using the search bar on the home or rooms page.
                Guests can view room details such as price, amenities, and owner contact information directly.
              </p>
            </div>
          </div>

          <div className="docs-section">
            <h2><span className="docs-icon">👤</span> Registered Users</h2>
            <div className="docs-card">
              <p>
                Users can sign up for an account to unlock more features.
                <strong>Room Registration:</strong> Only logged-in users can register their own rooms for rent.
                Listing a room costs a nominal fee (e.g., Rs 99). Users can manage their listings from their personal dashboard.
                When listing a room, you can provide detailed descriptions, uploading photos (coming soon), and setting contact details.
              </p>
            </div>
          </div>

          <div className="docs-section">
            <h2><span className="docs-icon">⚡</span> Administrators</h2>
            <div className="docs-card">
              <p>
                Admins have full control over the platform. They can verify users, manage all room listings, and ensure the safety of the platform.
                Admins can delete inappropriate listings or ban users who violate terms.
              </p>
            </div>
          </div>
        </div>
      )}

      {currentView === 'room-details' && selectedRoom && (
        <div style={{ maxWidth: '1000px', margin: '2rem auto' }} className="glass-card">
          <button
            className="ghost-cta mini"
            onClick={() => setCurrentView('rooms')}
            style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
          >
            ← Back to Rooms
          </button>

          <div className="room-details-header">
            <h1 style={{ marginBottom: '0.5rem', fontSize: '2.5rem' }}>{selectedRoom.title}</h1>
            <p className="room-address" style={{ fontSize: '1.2rem', color: '#94a3b8' }}>📍 {selectedRoom.address}, {selectedRoom.city}</p>
          </div>

          <div className="room-gallery" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1rem', margin: '2rem 0' }}>
            {selectedRoom.photos && selectedRoom.photos.length > 0 ? (
              selectedRoom.photos.map((photo, index) => (
                <img
                  key={index}
                  src={`${SERVER_URL}${photo}`}
                  alt={`${selectedRoom.title} view ${index + 1}`}
                  style={{ width: '100%', height: '250px', objectFit: 'cover', borderRadius: '16px' }}
                  onError={(e) => { (e.target as HTMLImageElement).src = 'https://placehold.co/600x400?text=No+Image' }}
                />
              ))
            ) : (
              <div style={{ height: '300px', background: 'rgba(255,255,255,0.05)', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px dashed rgba(255,255,255,0.2)' }}>
                <p style={{ color: '#94a3b8' }}>No photos available</p>
              </div>
            )}
          </div>

          <div className="room-info-grid" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '2rem' }}>
            <div className="main-info">
              <h3>Description</h3>
              <p style={{ lineHeight: '1.6', color: '#cbd5e1', marginBottom: '2rem' }}>
                {selectedRoom.description || 'No description provided.'}
              </p>

              <h3>Details</h3>
              <div className="room-meta-tags" style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '2rem' }}>
                <span className="status-chip chip-available">🛏️ {selectedRoom.bedrooms} Bedrooms</span>
                <span className="status-chip chip-available">🚿 {selectedRoom.bathrooms} Bathrooms</span>
                <span className="status-chip chip-available">📏 {selectedRoom.area_sqft || 'N/A'} Sq Ft</span>
                <span className="status-chip chip-available">🏠 {selectedRoom.room_type || 'Room'}</span>
              </div>

              <h3>Amenities</h3>
              <p>{selectedRoom.amenities || 'None listed'}</p>
            </div>

            <div className="sidebar-info glass-card" style={{ height: 'fit-content', padding: '1.5rem', background: 'rgba(255,255,255,0.5)' }}>
              <div style={{ marginBottom: '1.5rem' }}>
                <span style={{ fontSize: '2rem', fontWeight: 'bold', color: '#7aa8ff' }}>Rs {selectedRoom.price_per_month}</span>
                <span style={{ color: '#94a3b8' }}> / month</span>
              </div>

              <div className="owner-card" style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '1.5rem' }}>
                <p style={{ fontSize: '0.9rem', color: '#94a3b8', marginBottom: '0.5rem' }}>POSTED BY</p>
                <p style={{ fontWeight: 'bold', fontSize: '1.1rem', marginBottom: '0.5rem' }}>
                  {selectedRoom.owner_name}
                  {selectedRoom.owner_is_verified && <span className="verified-tick-icon">✓</span>}
                </p>

                {selectedRoom.contact_phone && (
                  <a href={`tel:${selectedRoom.contact_phone}`} className="primary-cta compact" style={{ display: 'block', textAlign: 'center', textDecoration: 'none', marginBottom: '0.5rem' }}>
                    📞 Call {selectedRoom.contact_phone}
                  </a>
                )}
                {selectedRoom.contact_email && (
                  <a href={`mailto:${selectedRoom.contact_email}`} className="ghost-cta mini" style={{ display: 'block', textAlign: 'center', textDecoration: 'none' }}>
                    ✉️ Email Owner
                  </a>
                )}

                <div className="inquiry-form-card">
                  <h4 style={{ marginBottom: '1rem', color: '#f8fafc' }}>Send Inquiry</h4>
                  <form onSubmit={handleSendInquiry} className="auth-form">
                    <input type="text" name="senderName" placeholder="Your Name" required className="auth-input" style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', color: '#f8fafc' }} />
                    <input type="email" name="senderEmail" placeholder="Your Email" required className="auth-input" style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', color: '#f8fafc' }} />
                    <input type="tel" name="senderPhone" placeholder="Your Phone (Optional)" className="auth-input" style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', color: '#f8fafc' }} />
                    <textarea name="message" placeholder="I'm interested in this room..." required className="auth-input" style={{ minHeight: '80px', padding: '0.8rem', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', color: '#f8fafc' }} />
                    <button type="submit" className="primary-cta compact" style={{ width: '100%' }}>Send Message</button>
                  </form>
                </div>

                <div className="booking-form-card" style={{ marginTop: '2rem', borderTop: '1px solid #eee', paddingTop: '1.5rem' }}>
                  <h4 style={{ marginBottom: '1rem', color: '#f8fafc' }}>Book this Room</h4>
                  <form onSubmit={handleBookingSubmit} className="auth-form">
                    <label style={{ color: '#94a3b8' }}>
                      <span>Check-in Date</span>
                      <input
                        type="date"
                        name="checkInDate"
                        value={bookingData.checkInDate}
                        onChange={handleBookingChange}
                        required
                        className="auth-input"
                        style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', color: '#f8fafc' }}
                      />
                    </label>
                    <label style={{ color: '#94a3b8' }}>
                      <span>Check-out Date</span>
                      <input
                        type="date"
                        name="checkOutDate"
                        value={bookingData.checkOutDate}
                        onChange={handleBookingChange}
                        required
                        className="auth-input"
                        style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', color: '#f8fafc' }}
                      />
                    </label>
                    <label style={{ color: '#94a3b8' }}>
                      <span>Guests</span>
                      <input
                        type="number"
                        name="guestsCount"
                        min="1"
                        value={bookingData.guestsCount}
                        onChange={handleBookingChange}
                        required
                        className="auth-input"
                        style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', color: '#f8fafc' }}
                      />
                    </label>
                    <textarea
                      name="specialRequests"
                      placeholder="Special requests (optional)..."
                      value={bookingData.specialRequests}
                      onChange={handleBookingChange}
                      className="auth-input"
                      style={{ minHeight: '60px', padding: '0.8rem', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', color: '#f8fafc' }}
                    />

                    {bookingMessage && (
                      <div className={`form-feedback-premium ${bookingMessage.type}`}>
                        {bookingMessage.type === 'success' ? '✅' : '❌'} {bookingMessage.text}
                      </div>
                    )}

                    <button
                      type="submit"
                      className="primary-cta"
                      style={{ width: '100%' }}
                      disabled={bookingLoading}
                    >
                      {bookingLoading ? 'Processing...' : `Book for Rs ${selectedRoom.price_per_month}`}
                    </button>
                  </form>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {
        (currentView === 'home' || currentView === 'rooms') && (
          <div className="search-container">
            <div className="search-bar-wrapper">
              <input
                type="text"
                className="search-input"
                placeholder="Search rooms by location, city, or address..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <button className="search-btn" aria-label="Search">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8"></circle>
                  <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                </svg>
              </button>
            </div>

            {currentView === 'home' && (
              <div className="auth-buttons-header">
                {isAdmin ? (
                  <>
                    <span className="user-info admin-badge">⚡ Admin</span>
                    <button className="ghost-cta mini" onClick={handleAdminLogout}>
                      Logout
                    </button>
                  </>
                ) : user ? (
                  <>
                    <span className="user-info">
                      Hi, <span className="user-name-with-badge">
                        {user.fullName.split(' ')[0]}
                        {user.isVerified && (
                          <span className="verified-tick-icon">✓</span>
                        )}
                      </span>
                    </span>
                    <button className="account-btn" onClick={() => { setActiveModal('account'); fetchUserInquiries(); }}>
                      👤 Account
                    </button>
                    <button className="ghost-cta mini" onClick={handleLogout}>
                      Logout
                    </button>
                  </>
                ) : (
                  <>
                    <button className="primary-cta compact" onClick={() => openModal('login')}>
                      Login
                    </button>
                    <button className="primary-cta compact light" onClick={() => openModal('signup')}>
                      Sign up
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        )
      }


      {
        currentView === 'premium' && (
          <div style={{ textAlign: 'center', padding: '4rem 0' }}>
            <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>👑</div>
            <h1 style={{
              fontSize: '3rem',
              background: 'linear-gradient(135deg, #a287f4, #cf9eff)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              margin: '0 0 1rem'
            }}>
              Premium Membership
            </h1>
            <p style={{ fontSize: '1.2rem', color: '#94a3b8' }}>
              Unlock exclusive features and verified badges. Coming soon.
            </p>
          </div>
        )
      }

      {/* Show normal content if not in docs/premium/details view */}
      {currentView !== 'docs' && currentView !== 'premium' && currentView !== 'room-details' && (
        <>
          {isAdmin && (
            <div className="dashboard-container">
              <div className="glass-card dashboard-panel admin-dashboard">
                <div className="dashboard-header">
                  <div>
                    <h2 className="admin-title">⚡ Supreme Admin Dashboard</h2>
                    <p className="user-details">Full system access and control</p>
                  </div>
                </div>

                <div className="admin-tabs">
                  <button
                    className={`admin-tab ${adminActiveTab === 'users' ? 'active' : ''}`}
                    onClick={() => {
                      setAdminActiveTab('users')
                      fetchAdminUsers()
                    }}
                  >
                    👥 Users ({adminUsers.length})
                  </button>
                  <button
                    className={`admin-tab ${adminActiveTab === 'rooms' ? 'active' : ''}`}
                    onClick={() => {
                      setAdminActiveTab('rooms')
                      fetchAdminRooms()
                    }}
                  >
                    🏠 Rooms ({adminRooms.length})
                  </button>
                  <button
                    className={`admin-tab ${adminActiveTab === 'bookings' ? 'active' : ''}`}
                    onClick={() => {
                      setAdminActiveTab('bookings')
                      fetchAdminBookings()
                    }}
                  >
                    🗂️ Booking Logs ({adminBookings.length})
                  </button>
                </div>

                {adminLoading ? (
                  <p>Loading...</p>
                ) : (
                  <div className="admin-content">
                    {adminActiveTab === 'users' && (
                      <div className="admin-section">
                        <h3>All Users</h3>
                        <div className="admin-table-container">
                          <table className="admin-table">
                            <thead>
                              <tr>
                                <th>ID</th>
                                <th>Name</th>
                                <th>Email</th>
                                <th>Phone</th>
                                <th>Verified</th>
                                <th>Actions</th>
                              </tr>
                            </thead>
                            <tbody>
                              {adminUsers.length === 0 ? (
                                <tr>
                                  <td colSpan={6} style={{ textAlign: 'center', padding: '2rem' }}>
                                    No users found
                                  </td>
                                </tr>
                              ) : (
                                adminUsers.map((adminUser) => (
                                  <tr key={adminUser.id}>
                                    <td>{adminUser.id}</td>
                                    <td>
                                      <span className="user-name-with-badge">
                                        {adminUser.fullName}
                                        {adminUser.isVerified && (
                                          <span className="verified-tick-icon" title="Verified User">
                                            ✓
                                          </span>
                                        )}
                                      </span>
                                    </td>
                                    <td>{adminUser.email}</td>
                                    <td>{adminUser.phoneNumber}</td>
                                    <td>
                                      {adminUser.isVerified ? (
                                        <span className="verified-badge">✓ Verified</span>
                                      ) : (
                                        <span className="unverified-badge">✗ Unverified</span>
                                      )}
                                    </td>
                                    <td>
                                      <div className="admin-actions">
                                        {adminUser.isVerified ? (
                                          <button
                                            className="admin-btn unverify-btn"
                                            onClick={() => handleUnverifyUser(adminUser.id)}
                                          >
                                            Unverify
                                          </button>
                                        ) : (
                                          <button
                                            className="admin-btn verify-btn"
                                            onClick={() => handleVerifyUser(adminUser.id)}
                                          >
                                            Verify
                                          </button>
                                        )}
                                        <button
                                          className="admin-btn delete-btn-admin"
                                          onClick={() => handleDeleteUser(adminUser.id)}
                                        >
                                          Delete
                                        </button>
                                      </div>
                                    </td>
                                  </tr>
                                ))
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {adminActiveTab === 'rooms' && (
                      <div className="admin-section">
                        <h3>All Rooms</h3>
                        {adminRooms.length === 0 ? (
                          <p className="empty-state">No rooms found</p>
                        ) : (
                          <div className="rooms-grid">
                            {adminRooms.map((room) => (
                              <div key={room.id} className="glass-card room-card">
                                <div className="room-image" aria-hidden="true" style={{ position: 'relative' }}>
                                  {room.photos && room.photos.length > 0 && (
                                    <img
                                      src={`${SERVER_URL}${room.photos[0]}`}
                                      alt={room.title}
                                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                                    />
                                  )}
                                </div>
                                <div className="room-content">
                                  <div className="room-row">
                                    <h4>{room.title}</h4>
                                    <button
                                      className="delete-btn"
                                      onClick={() => handleDeleteRoom(room.id)}
                                      aria-label="Delete room"
                                    >
                                      ×
                                    </button>
                                  </div>
                                  <p className="room-address">{room.address}</p>
                                  <p className="room-price">Rs {room.price_per_month} / month</p>
                                  {room.description && <p className="room-description">{room.description}</p>}
                                  <p className="owner-info">
                                    Owner: <span className="owner-name-with-badge">
                                      {room.owner_name}
                                      {room.owner_is_verified && (
                                        <span className="verified-tick-icon" title="Verified Owner">✓</span>
                                      )}
                                    </span> (ID: {room.owner_id})
                                  </p>
                                  <p className="owner-info">Owner ID Number: {room.owner_id_number}</p>
                                  <div className="room-meta">
                                    {room.bedrooms && <span>{room.bedrooms} Bed</span>}
                                    {room.bathrooms && <span>{room.bathrooms} Bath</span>}
                                    {room.area_sqft && <span>{room.area_sqft} sqft</span>}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {adminActiveTab === 'bookings' && (
                      <div className="admin-section">
                        <h3>Booking Logs (Read-only)</h3>
                        <div className="admin-table-container">
                          <table className="admin-table">
                            <thead>
                              <tr>
                                <th>ID</th>
                                <th>Room</th>
                                <th>User</th>
                                <th>Dates</th>
                                <th>Status</th>
                                <th>Last Updated</th>
                              </tr>
                            </thead>
                            <tbody>
                              {adminBookings.length === 0 ? (
                                <tr>
                                  <td colSpan={6} style={{ textAlign: 'center', padding: '2rem' }}>
                                    No logs found
                                  </td>
                                </tr>
                              ) : (
                                adminBookings.map((b) => (
                                  <tr key={b.id}>
                                    <td>{b.id}</td>
                                    <td>{b.room_title}</td>
                                    <td>{b.user_name}</td>
                                    <td>
                                      {new Date(b.check_in_date).toLocaleDateString()} - {new Date(b.check_out_date).toLocaleDateString()}
                                    </td>
                                    <td>
                                      <span className={`status-badge status-${b.status}`}>
                                        {b.status}
                                      </span>
                                    </td>
                                    <td>{new Date(b.created_at).toLocaleString()}</td>
                                  </tr>
                                ))
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {user && !isAdmin && (
            <div className="dashboard-container">
              <div className="glass-card dashboard-panel">
                <div className="dashboard-header">
                  <div>
                    <h2>Your Dashboard</h2>
                    <p className="user-details">
                      <strong>Name:</strong> <span className="user-name-with-badge">
                        {user.fullName}
                        {user.isVerified && (
                          <span className="verified-tick-icon" title="Verified User">✓</span>
                        )}
                      </span> | <strong>Email:</strong> {user.email} |{' '}
                      <strong>Phone:</strong> {user.phoneNumber}
                    </p>
                  </div>
                  <button className="primary-cta" onClick={() => openModal('register-room')}>
                    Register a Room
                  </button>
                </div>

                <div className="my-rooms-section">
                  <h3>Your Registered Rooms</h3>
                  {loadingRooms ? (
                    <p>Loading...</p>
                  ) : myRooms.length === 0 ? (
                    <p className="empty-state">No rooms registered yet. Click "Register a Room" to get started.</p>
                  ) : (
                    <div className="rooms-grid">
                      {myRooms.map((room) => (
                        <div key={room.id} className="glass-card room-card">
                          <div className="room-image" aria-hidden="true" style={{ position: 'relative' }}>
                            {room.photos && room.photos.length > 0 && (
                              <img
                                src={`${SERVER_URL}${room.photos[0]}`}
                                alt={room.title}
                                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                              />
                            )}
                          </div>
                          <div className="room-content">
                            <div className="room-row">
                              <h4>{room.title}</h4>
                              <button
                                className="delete-btn"
                                onClick={() => handleDeleteRoom(room.id)}
                                aria-label="Delete room"
                              >
                                ×
                              </button>
                            </div>
                            <p className="room-address">{room.address}</p>
                            <p className="room-price">Rs {room.price_per_month} / month</p>
                            {room.description && <p className="room-description">{room.description}</p>}
                            <div className="room-meta">
                              {room.bedrooms && <span>{room.bedrooms} Bed</span>}
                              {room.bathrooms && <span>{room.bathrooms} Bath</span>}
                              {room.area_sqft && <span>{room.area_sqft} sqft</span>}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          <div className="home">
            <section className="featured-rooms">
              <div className="section-heading">
                <div>
                  <p className="eyebrow">Available</p>
                  <h2>Rooms for Rent</h2>
                </div>
              </div>

              {filteredRooms.length === 0 ? (
                <p className="empty-state">
                  {searchQuery ? `No rooms found matching "${searchQuery}"` : "No rooms available at the moment."}
                </p>
              ) : (
                <div className="featured-grid">
                  {filteredRooms.map((room) => (
                    <article key={room.id} className="glass-card room-card">
                      <div className="room-image" aria-hidden="true" style={{ position: 'relative' }}>
                        {room.photos && room.photos.length > 0 && (
                          <img
                            src={`${SERVER_URL}${room.photos[0]}`}
                            alt={room.title}
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                          />
                        )}
                      </div>
                      <div className="room-content">
                        <div className="room-row">
                          <h3>{room.title}</h3>
                          <span className="price">Rs {room.price_per_month}/mo</span>
                        </div>
                        <p>{room.address}</p>
                        {room.description && <p className="room-description">{room.description}</p>}
                        <div className="room-row">
                          <div className="tag-row">
                            {room.bedrooms && <span>{room.bedrooms} Bed</span>}
                            {room.bathrooms && <span>{room.bathrooms} Bath</span>}
                            {room.area_sqft && <span>{room.area_sqft} sqft</span>}
                            {room.room_type && <span>{room.room_type}</span>}
                          </div>
                        </div>
                        <p className="owner-info">
                          Owner: <span className="owner-name-with-badge">
                            {room.owner_name}
                            {room.owner_is_verified && (
                              <span className="verified-tick-icon" title="Verified Owner">✓</span>
                            )}
                          </span>
                        </p>
                        {room.contact_phone && <p className="contact-info">Contact: {room.contact_phone}</p>}

                        <button
                          className="ghost-cta mini"
                          style={{ marginTop: '0.5rem', width: '100%' }}
                          onClick={() => {
                            setSelectedRoom(room)
                            setCurrentView('room-details')
                          }}
                        >
                          Show Details
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>
          </div>
        </>
      )
      }

      {
        activeModal && (
          <div className="auth-modal" role="dialog" aria-modal="true">
            <div className="auth-modal__backdrop" onClick={closeModal} />
            <section className={`glass-card auth-panel auth-modal__card ${activeModal === 'account' ? 'account-modal-wide' : ''}`}>
              <button className="modal-close" onClick={closeModal} aria-label="Close dialog">
                ×
              </button>
              {activeModal === 'signup' ? (
                <>
                  <header>
                    <p className="eyebrow">Create account</p>
                    <h1>Sign up</h1>
                  </header>
                  <form className="auth-form" onSubmit={handleSignupSubmit}>
                    <label>
                      <span>Full name</span>
                      <input name="fullName" value={signupData.fullName} onChange={handleSignupChange} required />
                    </label>
                    <label>
                      <span>Age</span>
                      <input type="number" min="16" name="age" value={signupData.age} onChange={handleSignupChange} required />
                    </label>
                    <label>
                      <span>Address</span>
                      <input name="address" value={signupData.address} onChange={handleSignupChange} required />
                    </label>
                    <label>
                      <span>Email</span>
                      <input type="email" name="email" value={signupData.email} onChange={handleSignupChange} required />
                    </label>
                    <label>
                      <span>Phone number</span>
                      <input name="phoneNumber" value={signupData.phoneNumber} onChange={handleSignupChange} required />
                    </label>
                    <label>
                      <span>Password</span>
                      <div className="password-input-container">
                        <input
                          type={showSignupPassword ? "text" : "password"}
                          name="password"
                          value={signupData.password}
                          onChange={handleSignupChange}
                          required
                          style={{ width: '100%' }}
                        />
                        <button
                          type="button"
                          className="password-toggle-btn"
                          onClick={() => setShowSignupPassword(!showSignupPassword)}
                          aria-label={showSignupPassword ? "Hide password" : "Show password"}
                        >
                          {showSignupPassword ? "👁️" : "👁️‍🗨️"}
                        </button>
                      </div>
                    </label>

                    <button className="primary-cta" type="submit" disabled={signupLoading}>
                      {signupLoading ? 'Creating account...' : 'Create account'}
                    </button>
                  </form>
                  {signupMessage && (
                    <p className={`form-feedback ${signupMessage.type === 'success' ? 'success' : 'error'}`}>
                      {signupMessage.text}
                    </p>
                  )}
                </>
              ) : activeModal === 'login' ? (
                <>
                  <header>
                    <p className="eyebrow">Welcome back</p>
                    <h1>Login</h1>
                  </header>
                  <form className="auth-form" onSubmit={handleLoginSubmit}>
                    <label>
                      <span>Email or phone</span>
                      <input name="credential" value={loginData.credential} onChange={handleLoginChange} required />
                    </label>
                    <label>
                      <span>Password</span>
                      <div className="password-input-container">
                        <input
                          type={showLoginPassword ? "text" : "password"}
                          name="password"
                          value={loginData.password}
                          onChange={handleLoginChange}
                          required
                          style={{ width: '100%' }}
                        />
                        <button
                          type="button"
                          className="password-toggle-btn"
                          onClick={() => setShowLoginPassword(!showLoginPassword)}
                          aria-label={showLoginPassword ? "Hide password" : "Show password"}
                        >
                          {showLoginPassword ? "👁️" : "👁️‍🗨️"}
                        </button>
                      </div>
                    </label>

                    <button className="primary-cta" type="submit" disabled={loginLoading}>
                      {loginLoading ? 'Signing in...' : 'Login'}
                    </button>
                  </form>
                  {loginMessage && (
                    <p className={`form-feedback ${loginMessage.type === 'success' ? 'success' : 'error'}`}>
                      {loginMessage.text}
                    </p>
                  )}
                </>
              ) : activeModal === 'admin-verify' ? (
                <>
                  <div className="admin-verify-header">
                    <div className="security-badge">
                      <div className="shield-icon">🛡️</div>
                      <div className="lock-rings">
                        <div className="ring ring-1"></div>
                        <div className="ring ring-2"></div>
                        <div className="ring ring-3"></div>
                      </div>
                    </div>
                    <p className="eyebrow security-label">🔒 SECURE ACCESS PROTOCOL</p>
                    <h1 className="admin-verify-title">
                      Supreme Admin
                      <br />
                      <span className="admin-glow">Authentication</span>
                    </h1>
                    <p className="admin-verify-subtitle">
                      Master key verification required for elevated privileges
                    </p>
                  </div>
                  <div className="admin-verify-container">
                    <div className="password-input-wrapper">
                      <label className="master-password-label">
                        <span className="label-icon">🔑</span>
                        <span>Master Password</span>
                        <span className="security-indicator">Encrypted</span>
                      </label>
                      <div className="password-input-container">
                        <input
                          type="password"
                          className="master-password-input"
                          value={adminMasterPassword}
                          onChange={(e) => setAdminMasterPassword(e.target.value)}
                          placeholder="Enter master key..."
                          onKeyPress={(e) => e.key === 'Enter' && handleAdminVerify()}
                          autoFocus
                        />
                        <div className="input-glow"></div>
                      </div>
                      <p className="security-note">
                        <span className="lock-icon">🔐</span>
                        Your credentials are encrypted end-to-end
                      </p>
                    </div>
                    <div className="admin-verify-actions">
                      <button className="primary-cta admin-verify-btn" onClick={handleAdminVerify}>
                        <span className="verify-icon">✓</span>
                        Verify & Grant Access
                      </button>
                      <button
                        className="ghost-cta admin-cancel-btn"
                        onClick={() => { setActiveModal(null); setAdminMasterPassword('') }}
                      >
                        Cancel Access
                      </button>
                    </div>
                  </div>
                </>
              ) : activeModal === 'account' && user ? (
                <div className="pro-account-modal">
                  <aside className="pro-account-sidebar">
                    <div className="pro-user-overview">
                      <div className="pro-avatar">
                        {user.fullName.charAt(0)}
                      </div>
                      <h3>{user.fullName}</h3>
                      {user.isVerified && <span className="pro-verified-pill">✓ Verified Account</span>}
                    </div>
                    <nav className="pro-account-nav">
                      <button
                        className={`pro-nav-item ${accountTab === 'profile' ? 'active' : ''}`}
                        onClick={() => setAccountTab('profile')}
                      >
                        <span className="pro-nav-icon">👤</span> Profile Details
                      </button>
                      <button
                        className={`pro-nav-item ${accountTab === 'inquiries' ? 'active' : ''}`}
                        onClick={() => { setAccountTab('inquiries'); fetchUserInquiries(); }}
                      >
                        <span className="pro-nav-icon">✉️</span> Messages & Inquiries
                      </button>
                      <button
                        className={`pro-nav-item ${accountTab === 'bookings' ? 'active' : ''}`}
                        onClick={() => { setAccountTab('bookings'); fetchMyBookings(); }}
                      >
                        <span className="pro-nav-icon">🛏️</span> Your Bookings
                      </button>
                      <button
                        className={`pro-nav-item ${accountTab === 'incoming' ? 'active' : ''}`}
                        onClick={() => { setAccountTab('incoming'); fetchOwnerBookings(); }}
                      >
                        <span className="pro-nav-icon">📑</span> Incoming Bookings
                      </button>
                    </nav>
                  </aside>

                  <main className="pro-account-main">
                    {accountTab === 'profile' && (
                      <div className="pro-section">
                        <header className="pro-section-header">
                          <h2>Profile Settings</h2>
                          <p>Manage your account information and password</p>
                        </header>
                        <form onSubmit={handleUpdateProfile} className="pro-form">
                          <div className="pro-form-row">
                            <div className="pro-field">
                              <label>Full Name</label>
                              <input name="fullName" defaultValue={user.fullName} required />
                            </div>
                            <div className="pro-field">
                              <label>Email Address</label>
                              <input name="email" type="email" defaultValue={user.email} required />
                            </div>
                          </div>
                          <div className="pro-form-row">
                            <div className="pro-field">
                              <label>Phone Number</label>
                              <input name="phoneNumber" type="tel" defaultValue={user.phoneNumber} required />
                            </div>
                            <div className="pro-field">
                              <label>New Password (Optional)</label>
                              <input name="password" type="password" placeholder="••••••••" />
                            </div>
                          </div>
                          <div className="pro-form-actions">
                            <button type="submit" className="pro-button-primary">Save Changes</button>
                          </div>
                        </form>
                      </div>
                    )}

                    {accountTab === 'inquiries' && (
                      <div className="pro-section">
                        <header className="pro-section-header">
                          <h2>Recent Inquiries</h2>
                          <p>Messages you've sent regarding rooms</p>
                        </header>
                        {userInquiries.length === 0 ? (
                          <div className="pro-empty-state">
                            <span className="pro-empty-icon">📂</span>
                            <p>You haven't sent any inquiries yet.</p>
                          </div>
                        ) : (
                          <div className="pro-inquiry-list">
                            {userInquiries.map(inq => (
                              <div key={inq.id} className="pro-inquiry-card">
                                <div className="pro-inquiry-card-header">
                                  <span className="pro-room-tag">{inq.room_title}</span>
                                  <time>{new Date(inq.created_at).toLocaleDateString()}</time>
                                </div>
                                <div className="pro-inquiry-body">
                                  <p className="pro-message-bubble">"{inq.message}"</p>
                                </div>
                                <div className="pro-inquiry-footer">
                                  <span>Sent as: <strong>{inq.sender_name}</strong></span>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {accountTab === 'bookings' && (
                      <div className="pro-section">
                        <header className="pro-section-header">
                          <h2>Your Bookings</h2>
                          <p>Track your room reservations and their status</p>
                        </header>
                        {bookingLoading ? (
                          <div className="pro-loading">
                            <div className="pro-spinner"></div>
                            <p>Fetching your bookings...</p>
                          </div>
                        ) : myBookings.length === 0 ? (
                          <div className="pro-empty-state">
                            <span className="pro-empty-icon">📅</span>
                            <p>No reservations found in your history.</p>
                          </div>
                        ) : (
                          <div className="pro-booking-list">
                            {myBookings.map(booking => (
                              <div key={booking.id} className="pro-booking-card">
                                <div className="pro-booking-meta">
                                  <div className="pro-booking-room-info">
                                    <h4>{booking.room_title}</h4>
                                    <p className="pro-address">📍 {booking.room_address}, {booking.room_city}</p>
                                  </div>
                                  <span className={`pro-status-chip pro-status-${booking.status}`}>
                                    {booking.status.toUpperCase()}
                                  </span>
                                </div>
                                <div className="pro-booking-details-grid">
                                  <div className="pro-detail-item">
                                    <span className="pro-label">Check-in</span>
                                    <span className="pro-val">{new Date(booking.check_in_date).toLocaleDateString()}</span>
                                  </div>
                                  <div className="pro-detail-item">
                                    <span className="pro-label">Check-out</span>
                                    <span className="pro-val">{new Date(booking.check_out_date).toLocaleDateString()}</span>
                                  </div>
                                  <div className="pro-detail-item">
                                    <span className="pro-label">Guests</span>
                                    <span className="pro-val">{booking.guests_count} Person(s)</span>
                                  </div>
                                  <div className="pro-detail-item">
                                    <span className="pro-label">Total Paid</span>
                                    <span className="pro-val pro-price">Rs {booking.total_price}</span>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {accountTab === 'incoming' && (
                      <div className="pro-section">
                        <header className="pro-section-header">
                          <h2>Incoming Bookings</h2>
                          <p>Manage booking requests for the rooms you've registered</p>
                        </header>

                        {bookingLoading ? (
                          <div className="pro-loading">
                            <div className="pro-spinner"></div>
                            <p>Loading requests...</p>
                          </div>
                        ) : ownerBookings.length === 0 ? (
                          <div className="pro-empty-state">
                            <span className="pro-empty-icon">📬</span>
                            <p>No booking requests yet for your rooms.</p>
                          </div>
                        ) : (
                          <div className="pro-booking-list">
                            {ownerBookings.map(booking => (
                              <div key={booking.id} className="pro-booking-card">
                                <div className="pro-booking-meta">
                                  <div className="pro-booking-room-info">
                                    <h4>{booking.room_title}</h4>
                                    <p className="pro-address">📍 {booking.room_address}, {booking.room_city}</p>
                                    <p style={{ marginTop: '0.5rem', fontSize: '0.9rem', color: '#818cf8', fontWeight: 'bold' }}>
                                      Booked by: {booking.user_name}
                                    </p>
                                  </div>
                                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.5rem' }}>
                                    <span className={`pro-status-chip pro-status-${booking.status}`}>
                                      {booking.status.toUpperCase()}
                                    </span>
                                    {booking.status === 'pending' && (
                                      <div className="admin-actions">
                                        <button
                                          className="admin-btn verify-btn"
                                          onClick={() => handleUpdateOwnerBookingStatus(booking.id, 'approved')}
                                        >
                                          Accept
                                        </button>
                                        <button
                                          className="admin-btn unverify-btn"
                                          onClick={() => handleUpdateOwnerBookingStatus(booking.id, 'rejected')}
                                        >
                                          Reject
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                </div>
                                <div className="pro-booking-details-grid">
                                  <div className="pro-detail-item">
                                    <span className="pro-label">Dates</span>
                                    <span className="pro-val">
                                      {new Date(booking.check_in_date).toLocaleDateString()} - {new Date(booking.check_out_date).toLocaleDateString()}
                                    </span>
                                  </div>
                                  <div className="pro-detail-item">
                                    <span className="pro-label">Guests</span>
                                    <span className="pro-val">{booking.guests_count}</span>
                                  </div>
                                  <div className="pro-detail-item">
                                    <span className="pro-label">Total Fee</span>
                                    <span className="pro-val pro-price">Rs {booking.total_price}</span>
                                  </div>
                                  <div className="pro-detail-item">
                                    <span className="pro-label">Created At</span>
                                    <span className="pro-val">{new Date(booking.created_at).toLocaleDateString()}</span>
                                  </div>
                                </div>
                                {booking.special_requests && (
                                  <div style={{ marginTop: '1.5rem', padding: '1rem', background: 'rgba(255,255,255,0.05)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)' }}>
                                    <span className="pro-label" style={{ display: 'block', marginBottom: '0.25rem', color: '#94a3b8' }}>Special Requests</span>
                                    <p style={{ margin: 0, fontSize: '0.9rem', fontStyle: 'italic', color: '#cbd5e1' }}>"{booking.special_requests}"</p>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </main>
                </div>
              ) : (
                <>
                  <header>
                    <p className="eyebrow">List your space</p>
                    <h1>Register a Room</h1>
                    <div className="step-indicator">
                      Step {roomStep} of 2
                    </div>
                  </header>
                  <form className="auth-form" onSubmit={handleRoomSubmit}>

                    {roomStep === 1 && (
                      <div className="form-step-1">
                        <label>
                          <span>Owner Name *</span>
                          <input
                            name="ownerName"
                            value={roomData.ownerName}
                            onChange={handleRoomChange}
                            placeholder={user?.fullName}
                            required
                          />
                        </label>
                        <label>
                          <span>Room Title *</span>
                          <input name="title" value={roomData.title} onChange={handleRoomChange} required />
                        </label>
                        <label>
                          <span>Description</span>
                          <textarea name="description" value={roomData.description} onChange={handleRoomChange} rows={3} />
                        </label>
                        <label>
                          <span>Address *</span>
                          <input name="address" value={roomData.address} onChange={handleRoomChange} required />
                        </label>
                        <label>
                          <span>City</span>
                          <input name="city" value={roomData.city} onChange={handleRoomChange} />
                        </label>
                      </div>
                    )}

                    {roomStep === 2 && (
                      <div className="form-step-2">
                        <label>
                          <span>Price per Month (Rs) *</span>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            name="pricePerMonth"
                            value={roomData.pricePerMonth}
                            onChange={handleRoomChange}
                            required
                          />
                        </label>
                        <label>
                          <span>Room Type</span>
                          <input name="roomType" value={roomData.roomType} onChange={handleRoomChange} placeholder="e.g., Apartment, House" />
                        </label>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                          <label>
                            <span>Bedrooms</span>
                            <input
                              type="number"
                              name="bedrooms"
                              value={roomData.bedrooms}
                              onChange={handleRoomChange}
                              min="0"
                            />
                          </label>
                          <label>
                            <span>Bathrooms</span>
                            <input
                              type="number"
                              name="bathrooms"
                              value={roomData.bathrooms}
                              onChange={handleRoomChange}
                              min="0"
                              step="0.5"
                            />
                          </label>
                        </div>
                        {/* Replaced Area with Photos */}
                        <label>
                          <span>Photos (First one will be cover)</span>
                          <input
                            type="file"
                            multiple
                            accept="image/*"
                            onChange={handlePhotoChange}
                            className="file-input"
                          />
                          <div className="photo-preview-count">
                            {roomPhotos.length} photos selected
                          </div>
                        </label>

                        <label>
                          <span>Available From</span>
                          <input type="date" name="availableFrom" value={roomData.availableFrom} onChange={handleRoomChange} />
                        </label>
                        <label>
                          <span>Amenities</span>
                          <input name="amenities" value={roomData.amenities} onChange={handleRoomChange} placeholder="WiFi, AC, Parking..." />
                        </label>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                          <label>
                            <span>Contact Email</span>
                            <input type="email" name="contactEmail" value={roomData.contactEmail} onChange={handleRoomChange} placeholder={user?.email} />
                          </label>
                          <label>
                            <span>Contact Phone</span>
                            <input type="tel" name="contactPhone" value={roomData.contactPhone} onChange={handleRoomChange} placeholder={user?.phoneNumber} />
                          </label>
                        </div>
                      </div>
                    )}

                    {roomMessage && (
                      <p className={`form-feedback ${roomMessage.type}`}>
                        {roomMessage.text}
                      </p>
                    )}

                    <div className="form-actions" style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
                      {/* Apple-style circular Next/Submit button */}
                      <button
                        type="submit"
                        disabled={roomLoading}
                        className="circle-next-btn"
                        aria-label={roomStep === 1 ? "Next Step" : "Submit Room"}
                      >
                        {roomLoading ? '...' : '>'}
                      </button>
                    </div>
                  </form>
                </>
              )}
              <button
                className="modal-close"
                onClick={closeModal}
                aria-label="Close modal"
              >
                ×
              </button>
            </section>
          </div>
        )
      }
    </div >
  )
}

export default App
