import React, { useState, useEffect, type ChangeEvent, type FormEvent } from 'react'
import { MessageCircle } from 'lucide-react'
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'

// Fix for default marker icons in Leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
})

const PRODUCTION_API_FALLBACK_URL = 'https://shelter-msd1.onrender.com/api'
const LOCALHOST_API_BASE_URL = 'http://localhost:5000/api'
const LOCALHOST_LOOPBACK_API_BASE_URL = 'http://127.0.0.1:5000/api'
const IS_LOCAL_RUNTIME = /^(localhost|127\.0\.0\.1)$/i.test(
  typeof window !== 'undefined' ? window.location.hostname : 'localhost'
)

// In production, prefer an explicit VITE_API_BASE_URL. If missing, try same-origin
// before falling back to localhost values that only work during local development.
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL
  ?? (IS_LOCAL_RUNTIME ? LOCALHOST_LOOPBACK_API_BASE_URL : PRODUCTION_API_FALLBACK_URL)
const FALLBACK_API_BASE_URL = import.meta.env.VITE_FALLBACK_API_BASE_URL
  ?? (IS_LOCAL_RUNTIME ? LOCALHOST_API_BASE_URL : PRODUCTION_API_FALLBACK_URL)
const VALID_EMAIL_REGEX = /^[a-z0-9._%+-]+@[a-z0-9-]+(?:\.[a-z0-9-]+)+$/i

const toHealthUrl = (apiBaseUrl: string) => {
  return apiBaseUrl.endsWith('/api') ? `${apiBaseUrl.slice(0, -4)}/health` : `${apiBaseUrl}/health`
}

const PRIMARY_HEALTH_URL = toHealthUrl(API_BASE_URL)
const FALLBACK_HEALTH_URL = toHealthUrl(FALLBACK_API_BASE_URL)

type User = {
  id: number
  fullName: string
  email: string
  phoneNumber: string
  isVerified?: boolean
  isPremium?: boolean
  premiumUntil?: string | null
  premiumPlan?: string | null
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
  latitude?: number | null
  longitude?: number | null
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

const COUNTRY_CODES = [
  { code: '+977', label: 'Nepal (+977)' },
  { code: '+91', label: 'India (+91)' },
  { code: '+1', label: 'USA (+1)' },
  { code: '+44', label: 'UK (+44)' },
]

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
  latitude: '',
  longitude: '',
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
  room_owner_name?: string
  sender_name: string
  sender_email: string
  sender_phone: string | null
  message: string
  created_at: string
}

type ViewState = 'home' | 'rooms' | 'premium' | 'docs' | 'room-details' | 'messages'
type ModalView = 'signup' | 'login' | 'register-room' | 'admin-verify' | 'account' | null

type Message = {
  id: number
  sender_id: number
  receiver_id: number
  content: string
  is_read: boolean
  created_at: string
  sender_name: string
}

type Conversation = {
  other_user_id: number
  other_user_name: string
  other_user_email: string
  room_id: number | null
  room_title: string | null
  last_message_at: string
  last_message: string | null
  is_from_me: boolean
  unread_count: number
  is_favorite?: boolean
}

type CelebrationPayload = {
  title: string
  subtitle: string
}

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
  const [roomListTab, setRoomListTab] = useState<'all' | 'nearby' | 'map'>('all')
  const [loadingRooms, setLoadingRooms] = useState(false)
  const [userInquiries, setUserInquiries] = useState<UserInquiry[]>([])
  const [userBills, setUserBills] = useState<any[]>([])
  const [isAuthMaximized, setIsAuthMaximized] = useState(false)
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
  const [accountTab, setAccountTab] = useState<'profile' | 'inquiries' | 'bookings' | 'incoming' | 'billings'>('profile')
  const [inquiryView, setInquiryView] = useState<'sent' | 'received'>('sent')
  const [bookingLoading, setBookingLoading] = useState(false)
  const [toast, setToast] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [backendStatus, setBackendStatus] = useState<'checking' | 'online' | 'offline'>('checking')

  // Messaging state
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [newChatQuery, setNewChatQuery] = useState('')
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [sendingMessage, setSendingMessage] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const [celebration, setCelebration] = useState<CelebrationPayload | null>(null)
  const [signupMethod, setSignupMethod] = useState<'email' | 'phone'>('email')
  const [signupStep, setSignupStep] = useState<1 | 2>(1)
  const [signupOtpCode, setSignupOtpCode] = useState('')
  const [loginMethod, setLoginMethod] = useState<'email' | 'phone'>('email')
  const [authCountryCode, setAuthCountryCode] = useState('+977')
  const [isRoomDetailsMaximized, setIsRoomDetailsMaximized] = useState(false)
  const [changePasswordData, setChangePasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  })
  const [forgotPasswordData, setForgotPasswordData] = useState({
    email: '',
    token: '',
    newPassword: '',
    confirmPassword: '',
  })
  const [forgotPasswordStep, setForgotPasswordStep] = useState<1 | 2>(1)
  const [passwordActionMessage, setPasswordActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [passwordActionLoading, setPasswordActionLoading] = useState(false)

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToast({ text, type })
    setTimeout(() => setToast(null), 4000)
  }

  const parseApiPayload = async (response: Response) => {
    const contentType = response.headers.get('content-type') || ''
    if (contentType.includes('application/json')) {
      try {
        return await response.json()
      } catch {
        return {}
      }
    }

    const text = await response.text()
    return text ? { message: text } : {}
  }

  const fetchWithProxyFallback = async (path: string, init?: RequestInit) => {
    const candidates = [API_BASE_URL, FALLBACK_API_BASE_URL, '/api', PRODUCTION_API_FALLBACK_URL, LOCALHOST_API_BASE_URL]
    const uniqueCandidates = candidates.filter((base, index) => candidates.indexOf(base) === index)

    let lastError: unknown = null
    const failures: string[] = []
    for (const baseUrl of uniqueCandidates) {
      try {
        const response = await fetch(`${baseUrl}${path}`, init)
        const contentType = response.headers.get('content-type') || ''

        // Some static hosts return index.html with HTTP 200 for unknown API paths.
        // Treat HTML as a bad candidate so we keep trying real API origins.
        if (contentType.includes('text/html')) {
          failures.push(`${baseUrl}${path} -> returned HTML instead of API JSON`)
          continue
        }

        return response
      } catch (error) {
        lastError = error
        const reason = error instanceof Error ? error.message : String(error)
        failures.push(`${baseUrl}${path} -> ${reason}`)
      }
    }

    if (failures.length > 0) {
      throw new Error(`All API endpoints failed. ${failures.join(' | ')}`)
    }

    throw lastError ?? new TypeError('All API endpoints failed')
  }

  const getNetworkErrorMessage = (error: unknown) => {
    if (error instanceof Error) {
      return error.message
    }
    if (error instanceof TypeError) {
      return 'Cannot reach backend API. Ensure backend server is running.'
    }
    return 'Network error'
  }

  const launchCelebration = (title: string, subtitle: string) => {
    setCelebration({ title, subtitle })
    window.setTimeout(() => setCelebration(null), 4200)
  }

  const submitEsewaForm = (params: Record<string, string | number>) => {
    const form = document.createElement('form')
    form.setAttribute('method', 'POST')
    form.setAttribute('action', 'https://rc-epay.esewa.com.np/api/epay/main/v2/form')

    for (const [key, value] of Object.entries(params)) {
      const input = document.createElement('input')
      input.setAttribute('type', 'hidden')
      input.setAttribute('name', key)
      input.setAttribute('value', String(value))
      form.appendChild(input)
    }

    document.body.appendChild(form)
    form.submit()
  }

  const startBookingPayment = async (payload: {
    userId: number
    roomId: number
    checkInDate: string
    checkOutDate: string
    guestsCount: number
    totalPrice: number
    specialRequests: string
  }) => {
    const response = await fetch(`${API_BASE_URL}/payments/booking/initiate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: payload.userId,
        roomId: payload.roomId,
        totalAmount: payload.totalPrice,
        successUrl: window.location.origin
      })
    })

    const paymentParams = await parseApiPayload(response)
    if (!response.ok) {
      throw new Error(paymentParams.message || 'Failed to initiate booking payment.')
    }

    submitEsewaForm({
      amount: paymentParams.amount,
      tax_amount: paymentParams.tax_amount,
      total_amount: paymentParams.total_amount,
      transaction_uuid: paymentParams.transaction_uuid,
      product_code: paymentParams.product_code,
      product_service_charge: paymentParams.psc,
      product_delivery_charge: paymentParams.pdc,
      success_url: paymentParams.success_url,
      failure_url: paymentParams.failure_url,
      signed_field_names: 'total_amount,transaction_uuid,product_code',
      signature: paymentParams.signature,
    })
  }

  const startRoomRegistrationPayment = async () => {
    if (!user) {
      throw new Error('Please login to continue.')
    }

    const response = await fetch(`${API_BASE_URL}/payments/room/initiate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: user.id, amount: 99, successUrl: window.location.origin })
    })

    const paymentParams = await parseApiPayload(response)
    if (!response.ok) {
      throw new Error(paymentParams.message || 'Failed to initiate room registration payment.')
    }

    submitEsewaForm({
      amount: paymentParams.amount,
      tax_amount: paymentParams.tax_amount,
      total_amount: paymentParams.total_amount,
      transaction_uuid: paymentParams.transaction_uuid,
      product_code: paymentParams.product_code,
      product_service_charge: paymentParams.psc,
      product_delivery_charge: paymentParams.pdc,
      success_url: paymentParams.success_url,
      failure_url: paymentParams.failure_url,
      signed_field_names: 'total_amount,transaction_uuid,product_code',
      signature: paymentParams.signature,
    })
  }

  const [showLoginPassword, setShowLoginPassword] = useState(false)
  const [showSignupPassword, setShowSignupPassword] = useState(false)
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [nearbyRooms, setNearbyRooms] = useState<Room[]>([])
  const [isPremiumLoading, setIsPremiumLoading] = useState(false)
  const [nearbyRadius] = useState(10) // 10km radius

  useEffect(() => {
    let isMounted = true

    const checkBackendHealth = async () => {
      try {
        const primaryResponse = await fetch(PRIMARY_HEALTH_URL)
        if (!primaryResponse.ok) {
          throw new Error('Primary health check failed')
        }
        if (isMounted) setBackendStatus('online')
        return
      } catch {
        try {
          const fallbackResponse = await fetch(FALLBACK_HEALTH_URL)
          if (!fallbackResponse.ok) {
            throw new Error('Fallback health check failed')
          }
          if (isMounted) setBackendStatus('online')
          return
        } catch {
          if (isMounted) setBackendStatus('offline')
        }
      }
    }

    checkBackendHealth()
    const timerId = window.setInterval(checkBackendHealth, 15000)

    return () => {
      isMounted = false
      window.clearInterval(timerId)
    }
  }, [])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const resetEmail = params.get('resetEmail')
    const resetToken = params.get('resetToken')

    if (resetEmail || resetToken) {
      setForgotPasswordData((prev) => ({
        ...prev,
        email: resetEmail || prev.email,
        token: resetToken || prev.token,
      }))
      openModal('login')
    }
  }, [])

  useEffect(() => {
    if (user?.email) {
      setForgotPasswordData((prev) => ({ ...prev, email: prev.email || user.email }))
    }
  }, [user])

  useEffect(() => {
    if (currentView !== 'room-details') {
      setIsRoomDetailsMaximized(false)
    }
  }, [currentView])

  // Geolocation tracking
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          })
        },
        (error) => {
          console.error("Geolocation error:", error)
        }
      )
    }
  }, [])

  // Fetch nearby rooms if user is premium and location is available
  useEffect(() => {
    const fetchNearby = async () => {
      if (user?.isPremium && userLocation) {
        try {
          const res = await fetch(`${API_BASE_URL}/rooms/nearby?lat=${userLocation.lat}&lng=${userLocation.lng}&radius=${nearbyRadius}&userId=${user.id}`)
          const data = await res.json()
          if (res.status === 403) {
            // Premium expired
            const updatedUser = { ...user, isPremium: false }
            setUser(updatedUser)
            localStorage.setItem('shelter_user', JSON.stringify(updatedUser))
            alert("Your premium subscription has expired.")
            return
          }
          if (data.rooms) {
            setNearbyRooms(data.rooms)
          }
        } catch (error) {
          console.error("Fetch nearby rooms error:", error)
        }
      }
    }
    fetchNearby()
  }, [user, userLocation, nearbyRadius])

  const handlePurchasePremium = async (planType: 'day' | 'week' | 'month') => {
    if (!user) {
      setActiveModal('login')
      return
    }

    setIsPremiumLoading(true)
    try {
      // 1. Create the bill IMMEDIATELY on click
      const amount = { 'day': 99, 'week': 499, 'month': 1499 }[planType]
      const billRes = await fetch(`${API_BASE_URL}/premium/create-bill-on-click`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, planType, amount })
      })

      if (!billRes.ok) {
        console.error('Failed to generate bill record silently.')
      }

      // 2. eSewa Initiation (for show)
      const res = await fetch(`${API_BASE_URL}/premium/initiate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, planType })
      })

      const params = await res.json()
      if (!res.ok) throw new Error(params.message || 'Initiation failed')

      // 3. Create hidden form and submit to eSewa
      const form = document.createElement('form')
      form.setAttribute('method', 'POST')
      form.setAttribute('action', 'https://rc-epay.esewa.com.np/api/epay/main/v2/form')

      const fields = {
        amount: params.amount,
        tax_amount: params.tax_amount,
        total_amount: params.total_amount,
        transaction_uuid: params.transaction_uuid,
        product_code: params.product_code,
        product_service_charge: params.psc,
        product_delivery_charge: params.pdc,
        success_url: params.success_url,
        failure_url: params.failure_url,
        signed_field_names: 'total_amount,transaction_uuid,product_code',
        signature: params.signature,
      }

      for (const [key, value] of Object.entries(fields)) {
        const input = document.createElement('input')
        input.setAttribute('type', 'hidden')
        input.setAttribute('name', key)
        input.setAttribute('value', String(value))
        form.appendChild(input)
      }

      document.body.appendChild(form)
      form.submit()
    } catch (error) {
      console.error("Purchase error:", error)
      showToast(error instanceof Error ? error.message : "Failed to process purchase.", 'error')
      setIsPremiumLoading(false)
    }
  }

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

  // Handle eSewa callback for premium, room registration fee, and booking fee.
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search)
    const paymentStatus = urlParams.get('payment')
    const paymentData = urlParams.get('data')
    const paymentContext = urlParams.get('context')

    if (paymentStatus || paymentData) {
      console.log('eSewa Redirect Detected:', { paymentStatus, paymentContext, hasData: !!paymentData })
    }

    if (paymentStatus === 'success' && paymentData) {
      const runVerification = async () => {
        if (!user) {
          console.log('Verification delayed: User state not ready.')
          return
        }

        setIsPremiumLoading(true)

        try {
          if (paymentContext === 'booking') {
            const verifyResp = await fetch(`${API_BASE_URL}/payments/verify`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ data: paymentData, context: 'booking' })
            })
            const verifyPayload = await parseApiPayload(verifyResp)

            if (!verifyResp.ok) {
              throw new Error(verifyPayload.message || 'Booking payment verification failed.')
            }

            launchCelebration('Booking Congrats', `You booked ${selectedRoom?.title || 'your selected room'} successfully.`)
            showToast('Booking request already sent successfully.')
          } else if (paymentContext === 'room-registration') {
            const verifyResp = await fetch(`${API_BASE_URL}/payments/verify`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ data: paymentData, context: 'room-registration' })
            })
            const verifyPayload = await parseApiPayload(verifyResp)

            if (!verifyResp.ok) {
              throw new Error(verifyPayload.message || 'Room registration fee verification failed.')
            }

            launchCelebration('Room Registered Congrats', 'Your room listing is already submitted successfully.')
            showToast('Room registration was already completed successfully.')
          } else {
            const res = await fetch(`${API_BASE_URL}/premium/verify`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ data: paymentData })
            })

            const result = await res.json()

            if (!res.ok) {
              throw new Error(result.message || 'Premium verification failed.')
            }

            setActiveModal('account')
            setAccountTab('billings')
            fetchUserBills()

            if (result?.status === 'ALREADY_ACTIVE' || result?.activationStatus === 'ACTIVE') {
              showToast(result.message || 'Plan is already active.')
            } else {
              showToast('Payment verified. Go to Account section to start your premium activation.')
            }
          }
        } catch (error) {
          console.error("Verification error:", error)
          showToast(error instanceof Error ? error.message : 'Payment verification failed.', 'error')
        } finally {
          window.history.replaceState({}, document.title, window.location.pathname)
          setIsPremiumLoading(false)
        }
      }
      runVerification()
    } else if (paymentStatus === 'success') {
      if (paymentContext === 'booking') {
        launchCelebration('Booking Congrats', `You booked ${selectedRoom?.title || 'your selected room'} successfully.`)
        showToast('Booking request already sent successfully.')
      } else if (paymentContext === 'room-registration') {
        launchCelebration('Room Registered Congrats', 'Your room listing is already submitted successfully.')
        showToast('Room registration was already completed successfully.')
      } else {
        showToast('Payment successful. Go to Account section to start your premium activation.')
      }
      window.history.replaceState({}, document.title, window.location.pathname)
    } else if (paymentStatus === 'failure') {
      showToast('Payment failed or was cancelled.', 'error')
      window.history.replaceState({}, document.title, window.location.pathname)
    }
  }, [user, selectedRoom])

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
    setPasswordActionMessage(null)
    if (view === 'signup') {
      setSignupMethod('email')
      setSignupStep(1)
      setSignupOtpCode('')
    }
    if (view === 'login') {
      setLoginMethod('email')
      setForgotPasswordStep(1)
    }
  }

  const closeModal = () => {
    setActiveModal(null)
    setRoomData(initialRoomState)
    setRoomStep(1)
    setRoomPhotos([])
    setIsAuthMaximized(false)
    setAccountTab('profile')
    setPasswordActionMessage(null)
    setChangePasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' })
    setForgotPasswordData({ email: user?.email || '', token: '', newPassword: '', confirmPassword: '' })
    setForgotPasswordStep(1)
    setSignupData(initialSignupState)
    setSignupMethod('email')
    setSignupStep(1)
    setSignupOtpCode('')
  }

  const handleLogout = () => {
    setUser(null)
    localStorage.removeItem('shelter_user')
    setMyRooms([])
  }

  const handleSignupChange = (event: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = event.target
    setSignupData((prev) => ({ ...prev, [name]: value }))
    if (signupMethod === 'email' && signupStep === 2) {
      setSignupStep(1)
      setSignupOtpCode('')
      setSignupMessage(null)
    }
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

  const handleSignupRequestOtp = async () => {
    const emailToSend = signupData.email.trim()

    if (!VALID_EMAIL_REGEX.test(emailToSend)) {
      setSignupMessage({ type: 'error', text: 'Please enter a valid email address.' })
      return
    }

    setSignupLoading(true)
    setSignupMessage(null)

    try {
      const response = await fetchWithProxyFallback('/auth/signup/request-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: signupData.fullName,
          age: Number(signupData.age),
          address: signupData.address,
          email: emailToSend,
          password: signupData.password,
        }),
      })

      const payload = await parseApiPayload(response)

      if (!response.ok) {
        throw new Error(payload?.message ?? 'Failed to send verification code')
      }

      if (payload?.verificationCode) {
        setSignupOtpCode(String(payload.verificationCode))
      }

      setSignupStep(2)
      setSignupMessage({ type: 'success', text: payload?.message ?? 'Verification code sent to your email.' })
    } catch (error) {
      setSignupMessage({ type: 'error', text: error instanceof Error ? error.message : 'Failed to send verification code' })
    } finally {
      setSignupLoading(false)
    }
  }

  const handleSignupSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSignupLoading(true)
    setSignupMessage(null)

    const emailToSend = signupMethod === 'email' ? signupData.email.trim() : ''
    const phoneToSend = signupMethod === 'phone' ? `${authCountryCode}${signupData.phoneNumber}` : ''

    try {
      if (signupMethod === 'email') {
        if (signupStep === 1) {
          await handleSignupRequestOtp()
          return
        }

        if (!signupOtpCode.trim()) {
          setSignupMessage({ type: 'error', text: 'Enter the verification code sent to your email.' })
          return
        }

        const response = await fetchWithProxyFallback('/auth/signup/verify-otp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: emailToSend,
            otp: signupOtpCode.trim(),
          }),
        })

        const payload = await parseApiPayload(response)

        if (!response.ok) {
          throw new Error(payload?.message ?? 'OTP verification failed')
        }

        setSignupMessage({ type: 'success', text: payload?.message ?? 'Signup successful' })
        setSignupData(initialSignupState)
        setSignupOtpCode('')
        setSignupStep(1)
        setTimeout(() => {
          closeModal()
          openModal('login')
        }, 1500)
        return
      }

      const response = await fetchWithProxyFallback('/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: signupData.fullName,
          age: Number(signupData.age),
          address: signupData.address,
          email: emailToSend,
          phoneNumber: phoneToSend,
          countryCode: authCountryCode,
          password: signupData.password,
        }),
      })

      const payload = await parseApiPayload(response)

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

    const rawCredential = loginData.credential.trim()
    const credentialValue = loginMethod === 'phone'
      ? `${authCountryCode}${rawCredential}`
      : rawCredential
    const credentialDigits = credentialValue.replace(/\D/g, '')
    const adminPasswordMatch = loginData.password.trim().toLowerCase() === 'sahil@123'

    // Check if this is an admin login attempt BEFORE API call
    const isAdminAttempt = (credentialDigits === '9746872051' || credentialDigits === '9779746872051') && adminPasswordMatch

    if (isAdminAttempt) {
      // Show admin verification modal instead of logging in normally
      setActiveModal('admin-verify')
      setLoginData(initialLoginState)
      setLoginLoading(false)
      return
    }

    try {
      const response = await fetchWithProxyFallback('/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          credential: credentialValue,
          password: loginData.password,
        }),
      })

      const payload = await parseApiPayload(response)

      if (!response.ok) {
        throw new Error(payload?.message ?? 'Login failed')
      }

      if (!payload?.user || typeof payload.user !== 'object' || !payload.user.id) {
        throw new Error('Login response was invalid. Please check API configuration and try again.')
      }

      setUser(payload.user)
      localStorage.setItem('shelter_user', JSON.stringify(payload.user))
      setCurrentView('rooms')
      setLoginMessage({ type: 'success', text: payload?.message ?? 'Login successful' })
      launchCelebration('Welcome Aboard', `Welcome ${payload.user?.fullName || 'Explorer'}! Ready for your next shelter mission.`)
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

  const handleChangePasswordInput = (event: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = event.target
    setChangePasswordData((prev) => ({ ...prev, [name]: value }))
  }

  const handleForgotPasswordInput = (event: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = event.target
    setForgotPasswordData((prev) => ({ ...prev, [name]: value }))
  }

  const handlePasswordChangeSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!user) return

    if (changePasswordData.newPassword !== changePasswordData.confirmPassword) {
      setPasswordActionMessage({ type: 'error', text: 'New password and confirm password do not match.' })
      return
    }

    setPasswordActionLoading(true)
    setPasswordActionMessage(null)

    try {
      const response = await fetchWithProxyFallback('/auth/password/change', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          currentPassword: changePasswordData.currentPassword,
          newPassword: changePasswordData.newPassword,
        }),
      })

      const payload = await parseApiPayload(response)
      if (!response.ok) {
        throw new Error(payload?.message || 'Failed to change password.')
      }

      setPasswordActionMessage({ type: 'success', text: payload?.message || 'Password changed successfully.' })
      setChangePasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' })
    } catch (error) {
      setPasswordActionMessage({ type: 'error', text: error instanceof Error ? error.message : 'Failed to change password.' })
    } finally {
      setPasswordActionLoading(false)
    }
  }

  const handleForgotPasswordRequest = async () => {
    if (!forgotPasswordData.email.trim()) {
      setPasswordActionMessage({ type: 'error', text: 'Enter your email first.' })
      return
    }

    setPasswordActionLoading(true)
    setPasswordActionMessage(null)
    try {
      const response = await fetchWithProxyFallback('/auth/password/reset/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: forgotPasswordData.email.trim() }),
      })

      const payload = await parseApiPayload(response)
      if (!response.ok) {
        throw new Error(payload?.message || 'Failed to send verification email.')
      }

      const tokenHint = payload?.verificationToken ? ` Dev token: ${payload.verificationToken}` : ''
      setPasswordActionMessage({ type: 'success', text: `${payload?.message || 'Verification sent.'}${tokenHint}` })
      setForgotPasswordStep(2)
    } catch (error) {
      setPasswordActionMessage({ type: 'error', text: error instanceof Error ? error.message : 'Failed to send verification email.' })
    } finally {
      setPasswordActionLoading(false)
    }
  }

  const handleForgotPasswordVerify = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (forgotPasswordData.newPassword !== forgotPasswordData.confirmPassword) {
      setPasswordActionMessage({ type: 'error', text: 'Reset password and confirm password do not match.' })
      return
    }

    setPasswordActionLoading(true)
    setPasswordActionMessage(null)
    try {
      const response = await fetchWithProxyFallback('/auth/password/reset/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: forgotPasswordData.email.trim(),
          token: forgotPasswordData.token.trim(),
          newPassword: forgotPasswordData.newPassword,
        }),
      })

      const payload = await parseApiPayload(response)
      if (!response.ok) {
        throw new Error(payload?.message || 'Password reset failed.')
      }

      setPasswordActionMessage({ type: 'success', text: payload?.message || 'Password reset successful.' })
      setForgotPasswordData((prev) => ({ ...prev, token: '', newPassword: '', confirmPassword: '' }))
      setForgotPasswordStep(1)
    } catch (error) {
      setPasswordActionMessage({ type: 'error', text: error instanceof Error ? error.message : 'Password reset failed.' })
    } finally {
      setPasswordActionLoading(false)
    }
  }

  const handleRoomSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!user) return

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
      formData.append('latitude', roomData.latitude)
      formData.append('longitude', roomData.longitude)

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

      setRoomMessage({ type: 'success', text: 'Redirecting to eSewa gateway...' })
      setRoomData(initialRoomState)
      setRoomPhotos([])
      setRoomStep(1)
      await fetchMyRooms()
      await fetchAllRooms()

      try {
        await startRoomRegistrationPayment()
      } catch (paymentError) {
        console.error('Room showcase payment failed:', paymentError)
      }

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
      showToast(error instanceof Error ? error.message : 'Failed to delete room', 'error')
    }
  }

  const handleAdminVerify = () => {
    if (adminMasterPassword === 'Password@6969') {
      setIsAdmin(true)
      setCurrentView('rooms')
      localStorage.setItem('shelter_admin', 'true')
      setActiveModal(null)
      setAdminMasterPassword('')
      fetchAdminUsers()
      fetchAdminRooms()
      fetchAdminBookings()
    } else {
      showToast('Invalid master password', 'error')
    }
  }

  const fetchUserInquiries = async (view: 'sent' | 'received' = inquiryView) => {
    if (!user) return
    try {
      const endpoint = view === 'received'
        ? `/rooms/my-inquiries/${user.id}`
        : `/rooms/sent-inquiries/${user.id}`
      const response = await fetchWithProxyFallback(endpoint)
      if (response.ok) {
        const data = await response.json()
        setUserInquiries(data.inquiries || [])
      } else {
        setUserInquiries([])
      }
    } catch (error) {
      console.error('Fetch inquiries error', error)
      setUserInquiries([])
    }
  }

  const fetchUserBills = async () => {
    if (!user) return
    try {
      const response = await fetch(`${API_BASE_URL}/premium/bills/${user.id}`)
      if (response.ok) {
        const data = await response.json()
        setUserBills(data)
      }
    } catch (error) {
      console.error('Fetch bills error', error)
    }
  }

  const handleActivateBill = async (billId: number) => {
    if (!user) return
    try {
      setIsPremiumLoading(true)
      const response = await fetch(`${API_BASE_URL}/premium/activate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ billId, userId: user.id })
      })

      if (response.ok) {
        const data = await response.json()
        setToast({ text: data.message, type: 'success' })
        // Refresh user data to show premium status
        const updatedUser = {
          ...user,
          isPremium: true,
          premiumPlan: data.planType,
          premiumUntil: data.expiresAt
        }
        setUser(updatedUser)
        localStorage.setItem('shelter_user', JSON.stringify(updatedUser))
        fetchUserBills()
      } else {
        const error = await response.json()
        setToast({ text: error.message || 'Activation failed', type: 'error' })
      }
    } catch (error) {
      console.error('Activation error', error)
      setToast({ text: 'Activation failed', type: 'error' })
    } finally {
      setIsPremiumLoading(false)
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
      const resp = await fetchWithProxyFallback('/auth/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      const data = await parseApiPayload(resp)
      if (resp.ok) {
        const updatedUser = { ...user!, ...data.user }
        setUser(updatedUser)
        localStorage.setItem('shelter_user', JSON.stringify(updatedUser))
        showToast('Profile updated successfully!')
        closeModal()
      } else {
        showToast(data.message || 'Update failed', 'error')
      }
    } catch (err) {
      showToast(getNetworkErrorMessage(err), 'error')
    }
  }

  const handleSendInquiry = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!selectedRoom) return
    const form = e.currentTarget
    const formData = new FormData(form)
    const payload = {
      senderName: formData.get('senderName'),
      senderEmail: formData.get('senderEmail'),
      senderPhone: formData.get('senderPhone'),
      message: formData.get('message'),
    }

    try {
      const resp = await fetchWithProxyFallback(`/rooms/${selectedRoom.id}/inquire`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      const data = await parseApiPayload(resp)
      if (resp.ok) {
        showToast('Inquiry sent successfully!')
        form.reset()
      } else {
        showToast(data.message || 'Failed to send inquiry', 'error')
      }
    } catch (err) {
      showToast(getNetworkErrorMessage(err), 'error')
    }
  }

  const handleBookingSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!user) {
      showToast('Please login to book a room.', 'error')
      openModal('login')
      return
    }
    if (!selectedRoom) return

    setBookingLoading(true)

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
      const resp = await fetchWithProxyFallback('/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      const data = await parseApiPayload(resp)
      if (resp.ok) {
        showToast(data.message || 'Room booked successfully!')
        setBookingData(initialBookingState)
        fetchMyBookings()

        try {
          await startBookingPayment(payload)
        } catch (paymentError) {
          console.error('Booking showcase payment failed:', paymentError)
        }
      } else {
        showToast(data.message || 'Booking failed', 'error')
      }
    } catch (err) {
      showToast(getNetworkErrorMessage(err), 'error')
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
        showToast(`Booking ${status} successfully!`)
      } else {
        const data = await response.json()
        showToast(data.message || 'Failed to update booking status', 'error')
      }
    } catch (error) {
      console.error('Update room booking status error', error)
      showToast('Failed to update booking status', 'error')
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
      showToast(error instanceof Error ? error.message : 'Failed to delete user', 'error')
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
      showToast('User verified successfully!')
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Failed to verify user', 'error')
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
      showToast('User unverified successfully!')
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Failed to unverify user', 'error')
    }
  }

  // Messaging functions
  const mergeConversations = (raw: any[]): Conversation[] => {
    const map: Record<number, Conversation> = {}
    raw.forEach((c: any) => {
      const existing = map[c.other_user_id]
      if (!existing) {
        map[c.other_user_id] = { ...c }
      } else {
        // pick newest message/time
        if (new Date(c.last_message_at) > new Date(existing.last_message_at)) {
          existing.last_message_at = c.last_message_at
          existing.last_message = c.last_message
          existing.room_id = existing.room_id || c.room_id
          existing.room_title = existing.room_title || c.room_title
        }
        existing.unread_count = (existing.unread_count || 0) + (c.unread_count || 0)
        if (c.is_favorite) existing.is_favorite = true
      }
    })
    const arr: Conversation[] = Object.values(map)
    arr.sort((a, b) => {
      if ((b.is_favorite ? 1 : 0) - (a.is_favorite ? 1 : 0) !== 0) {
        return (b.is_favorite ? 1 : 0) - (a.is_favorite ? 1 : 0)
      }
      return new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime()
    })
    return arr
  }

  const fetchConversations = async () => {
    if (!user) return
    try {
      const response = await fetch(`${API_BASE_URL}/messages/conversations?userId=${user.id}`)
      const data = await response.json()
      if (response.ok) {
        setConversations(mergeConversations(data.conversations) as Conversation[])
      }
    } catch (error) {
      console.error('Failed to fetch conversations:', error)
    }
  }

  const fetchMessages = async (otherUserId: number, roomId?: number) => {
    if (!user) return
    setLoadingMessages(true)
    try {
      const url = roomId
        ? `${API_BASE_URL}/messages/conversation/${otherUserId}?userId=${user.id}&roomId=${roomId}`
        : `${API_BASE_URL}/messages/conversation/${otherUserId}?userId=${user.id}`
      const response = await fetch(url)
      const data = await response.json()
      if (response.ok) {
        setMessages(data.messages)
      }
    } catch (error) {
      console.error('Failed to fetch messages:', error)
    } finally {
      setLoadingMessages(false)
    }
  }

  const sendMessage = async (receiverId: number, content: string, roomId?: number) => {
    if (!user || !content.trim()) return
    setSendingMessage(true)
    try {
      const response = await fetch(`${API_BASE_URL}/messages/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          receiverId,
          content: content.trim(),
          roomId
        })
      })
      const data = await response.json()
      if (response.ok) {
        setNewMessage('')
        // Refresh conversations and messages
        await fetchConversations()
        if (selectedConversation) {
          await fetchMessages(selectedConversation.other_user_id, selectedConversation.room_id || undefined)
        }
        showToast('Message sent!')
      } else {
        showToast(data.message || 'Failed to send message', 'error')
      }
    } catch (error) {
      showToast('Failed to send message', 'error')
    } finally {
      setSendingMessage(false)
    }
  }

  const fetchUnreadCount = async () => {
    if (!user) return
    try {
      const response = await fetch(`${API_BASE_URL}/messages/unread-count?userId=${user.id}`)
      const data = await response.json()
      if (response.ok) {
        setUnreadCount(data.unreadCount)
      }
    } catch (error) {
      console.error('Failed to fetch unread count:', error)
    }
  }

  const handleSelectConversation = async (conversation: Conversation) => {
    // load all messages with that user regardless of room context
    setSelectedConversation(conversation)
    await fetchMessages(conversation.other_user_id)
  }

  const handleDeleteConversation = async (conversation: Conversation) => {
    // function used in UI list
    if (!user) return
    try {
      const response = await fetch(`${API_BASE_URL}/messages/conversation/${conversation.other_user_id}?userId=${user.id}`, {
        method: 'DELETE'
      })
      if (response.ok) {
        setConversations(convs => convs.filter(c => c.other_user_id !== conversation.other_user_id))
        if (selectedConversation?.other_user_id === conversation.other_user_id) {
          setSelectedConversation(null)
          setMessages([])
        }
        showToast('Conversation deleted')
      }
    } catch (e) {
      showToast('Failed to delete conversation', 'error')
    }
  }

  const handleToggleFavorite = async (conversation: Conversation) => {
    if (!user) return
    try {
      const response = await fetch(`${API_BASE_URL}/messages/conversation/${conversation.other_user_id}/favorite?userId=${user.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ favorite: !conversation.is_favorite })
      })
      if (response.ok) {
        await fetchConversations()
      }
    } catch (e) {
      console.error(e)
    }
  }

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedConversation || !newMessage.trim()) return
    await sendMessage(selectedConversation.other_user_id, newMessage, selectedConversation.room_id || undefined)
  }

  const handleStartChatWithOwner = async (room: Room) => {
    if (!user) {
      setActiveModal('login')
      return
    }
    // Find or create conversation with owner
    const existingConversation = conversations.find(
      c => c.other_user_id === room.owner_id && c.room_id === room.id
    )
    if (existingConversation) {
      setSelectedConversation(existingConversation)
      await fetchMessages(room.owner_id, room.id)
    } else {
      // Create new conversation by sending first message
      setSelectedConversation({
        other_user_id: room.owner_id,
        other_user_name: room.owner_name,
        other_user_email: room.contact_email || '',
        room_id: room.id,
        room_title: room.title,
        last_message_at: new Date().toISOString(),
        last_message: null,
        is_from_me: false,
        unread_count: 0
      })
      await fetchMessages(room.owner_id, room.id)
    }
    setCurrentView('messages')
  }

  const handleStartDirectChat = async (targetUser: AdminUser) => {
    if (!user) {
      setActiveModal('login')
      return
    }

    if (targetUser.id === user.id) {
      showToast('You cannot message yourself.', 'error')
      return
    }

    const existingConversation = conversations.find(
      conversation => conversation.other_user_id === targetUser.id
    )

    if (existingConversation) {
      setSelectedConversation(existingConversation)
      await fetchMessages(targetUser.id, existingConversation.room_id || undefined)
    } else {
      setSelectedConversation({
        other_user_id: targetUser.id,
        other_user_name: targetUser.fullName,
        other_user_email: targetUser.email,
        room_id: null,
        room_title: null,
        last_message_at: new Date().toISOString(),
        last_message: null,
        is_from_me: false,
        unread_count: 0,
      })
      setMessages([])
    }

    setCurrentView('messages')
    setNewChatQuery('')
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

  // Load conversations when messages view is opened
  useEffect(() => {
    if (currentView === 'messages' && user) {
      if (adminUsers.length === 0) {
        fetchAdminUsers()
      }
      fetchConversations()
      fetchUnreadCount()
    }
  }, [currentView, user])

  const filteredUsers = adminUsers.filter(candidate => {
    const query = newChatQuery.trim().toLowerCase()
    if (!query) return false

    return (
      candidate.fullName.toLowerCase().includes(query) ||
      candidate.email.toLowerCase().includes(query) ||
      candidate.phoneNumber.toLowerCase().includes(query)
    )
  })

  // Periodically check for new messages when user is logged in
  useEffect(() => {
    if (!user) return

    const interval = setInterval(() => {
      fetchUnreadCount()
      if (currentView === 'messages') {
        fetchConversations()
      }
    }, 30000) // Check every 30 seconds

    return () => clearInterval(interval)
  }, [user, currentView])



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

      {/* Global Toast Notification */}
      {toast && (
        <div className={`toast-container ${toast.type}`}>
          <div className="toast-content">
            <span className="toast-icon">
              {toast.type === 'success' ? '✅' : '❌'}
            </span>
            <span className="toast-text">{toast.text}</span>
          </div>
          <div className="toast-progress" />
        </div>
      )}

      {celebration && (
        <div className="celebration-overlay" role="status" aria-live="polite">
          <div className="celebration-stars" />
          <div className="celebration-content">
            <h2>{celebration.title}</h2>
            <p>{celebration.subtitle}</p>
          </div>
          <div className="celebration-balloons" aria-hidden="true">
            <span />
            <span />
            <span />
            <span />
            <span />
          </div>
          <div className="celebration-fireworks" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
        </div>
      )}

      {/* Verification Overlay */}
      {isPremiumLoading && (
        <div className="admin-verify-overlay" style={{ zIndex: 10000 }}>
          <div className="admin-verify-card premium-card" style={{ textAlign: 'center' }}>
            <div className="premium-badge-large" style={{ animation: 'pulse 2s infinite' }}>✨</div>
            <h2 style={{ color: '#fff', marginBottom: '1rem' }}>Verifying payment...</h2>
            <p style={{ color: '#94a3b8' }}>Please wait while we finalize your transaction.</p>
            <div className="loading-spinner"></div>
          </div>
        </div>
      )}

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
          {user && (
            <button
              className={`nav-link ${(currentView as string) === 'messages' ? 'active' : ''}`}
              onClick={() => {
                setCurrentView('messages')
                fetchConversations()
              }}
            >
              <span>💬</span> Messages {unreadCount > 0 && <span className="unread-badge">{unreadCount}</span>}
            </button>
          )}
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
        <div
          style={{ maxWidth: '1000px', margin: '2rem auto' }}
          className={`glass-card room-details-container ${isRoomDetailsMaximized ? 'room-details-maximized' : ''}`}
        >
          <div className="modal-header-actions room-details-actions">
            <button
              type="button"
              className="modal-maximize-btn"
              onClick={() => setIsRoomDetailsMaximized(!isRoomDetailsMaximized)}
              title={isRoomDetailsMaximized ? 'Minimize room details' : 'Maximize room details'}
              aria-label={isRoomDetailsMaximized ? 'Minimize room details' : 'Maximize room details'}
            >
              {isRoomDetailsMaximized ? 'Min' : 'Max'}
            </button>
          </div>
          <button
            className="back-btn"
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

            <div className="sidebar-info glass-card">
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
                  <a href={`mailto:${selectedRoom.contact_email}`} className="ghost-cta mini" style={{ display: 'block', textAlign: 'center', textDecoration: 'none', marginBottom: '0.5rem' }}>
                    ✉️ Email Owner
                  </a>
                )}
                {user && user.id !== selectedRoom.owner_id && (
                  <button
                    onClick={() => handleStartChatWithOwner(selectedRoom)}
                    className="message-owner-btn"
                    style={{ display: 'block', width: '100%', marginBottom: '0.5rem' }}
                  >
                    💬 Message Owner
                  </button>
                )}

                <div className="inquiry-form-card">
                  <h4 style={{ marginBottom: '1rem', color: '#f8fafc' }}>Send Inquiry</h4>
                  <p
                    style={{
                      marginTop: 0,
                      marginBottom: '0.75rem',
                      fontSize: '0.85rem',
                      color:
                        backendStatus === 'online'
                          ? '#22c55e'
                          : backendStatus === 'offline'
                            ? '#ef4444'
                            : '#94a3b8',
                    }}
                  >
                    Backend status: {backendStatus === 'checking' ? 'Checking...' : backendStatus}
                  </p>
                  <form onSubmit={handleSendInquiry} className="auth-form">
                    <input type="text" name="senderName" defaultValue={user?.fullName ?? ''} placeholder="Your Name" required className="auth-input" />
                    <input type="email" name="senderEmail" defaultValue={user?.email ?? ''} placeholder="Your Email" required className="auth-input" />
                    <input type="tel" name="senderPhone" defaultValue={user?.phoneNumber ?? ''} placeholder="Your Phone (Optional)" className="auth-input" />
                    <textarea name="message" placeholder="I'm interested in this room..." required className="auth-input" style={{ minHeight: '80px', padding: '0.8rem' }} />
                    <button type="submit" className="primary-cta compact" style={{ width: '100%' }}>Send Message</button>
                  </form>
                </div>

                <div className="booking-form-card">
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
                      />
                    </label>
                    <textarea
                      name="specialRequests"
                      placeholder="Special requests (optional)..."
                      value={bookingData.specialRequests}
                      onChange={handleBookingChange}
                      className="auth-input"
                      style={{ minHeight: '60px', padding: '0.8rem' }}
                    />


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

            {(currentView === 'home' || currentView === 'rooms') && (
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
                    <button type="button" className="account-btn" onClick={() => { setActiveModal('account'); setInquiryView('sent'); fetchUserInquiries('sent'); }}>
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
          <div className="premium-container" style={{ padding: '4rem 0', maxWidth: '1200px', margin: '0 auto' }}>
            {user?.isPremium ? (
              <div className="premium-active-dashboard">
                <div className="premium-header-content">
                  <div className="premium-badge-large">👑</div>
                  <h1 className="admin-title">Hello, Premium Member!</h1>
                  <p className="premium-subtitle">
                    Your {{
                      'day': '24 Hours',
                      'week': '7 Days',
                      'month': '1 Month'
                    }[user.premiumPlan as 'day' | 'week' | 'month'] || user.premiumPlan || 'active'} plan is valid until {user.premiumUntil ? new Date(user.premiumUntil).toLocaleDateString() : 'N/A'}.
                  </p>
                </div>

                <div className="premium-features-hub">
                  <div className="feature-hub-card" onClick={() => { setCurrentView('rooms'); setRoomListTab('map'); }}>
                    <div className="hub-icon">🗺️</div>
                    <h4>Interactive Map</h4>
                    <p>Find rooms visually with real-time mapping technology.</p>
                    <button className="hub-btn">Explore Map</button>
                  </div>
                  <div className="feature-hub-card" onClick={() => { setCurrentView('rooms'); setRoomListTab('nearby'); }}>
                    <div className="hub-icon">📍</div>
                    <h4>Nearby Discovery</h4>
                    <p>Track rooms near your current live location automatically.</p>
                    <button className="hub-btn">Find Nearby</button>
                  </div>
                  <div className="feature-hub-card">
                    <div className="hub-icon">🛡️</div>
                    <h4>Premium Support</h4>
                    <p>You have priority access to our 24/7 dedicated help desk.</p>
                    <button className="hub-btn ghost">Contact Support</button>
                  </div>
                </div>

                <div className="premium-status-banner">
                  <p>Your subscription is active. Thank you for supporting <strong>SHELTER</strong>!</p>
                </div>
              </div>
            ) : (
              <div className="premium-purchase-view">
                <div style={{ textAlign: 'center', marginBottom: '4rem' }}>
                  <div style={{ fontSize: '4rem', marginBottom: '1rem', filter: 'drop-shadow(0 0 15px rgba(122, 168, 255, 0.4))' }}>👑</div>
                  <h1 className="admin-title" style={{ fontSize: '3.5rem', marginBottom: '1rem' }}>SHELTER Premium</h1>
                  <p style={{ fontSize: '1.2rem', color: '#94a3b8', maxWidth: '600px', margin: '0 auto' }}>
                    Unlock high-tech geolocation features, map views, and verified status to find your perfect home faster.
                  </p>
                </div>

                <div className="premium-plans-container">
                  <div className="premium-plan-card">
                    <div className="plan-name">24 Hours</div>
                    <div className="plan-price">Rs 99<span>/day</span></div>
                    <ul className="plan-features">
                      <li>24h Premium Status</li>
                      <li>Geolocation Search</li>
                      <li>Interactive Map View</li>
                      <li>Priority Support</li>
                    </ul>
                    <button
                      className="primary-cta"
                      style={{ marginTop: 'auto', width: '100%' }}
                      onClick={() => handlePurchasePremium('day')}
                      disabled={isPremiumLoading}
                    >
                      {isPremiumLoading ? 'Processing...' : 'Get 24 Hours'}
                    </button>
                  </div>

                  <div className="premium-plan-card highlighted">
                    <div className="plan-name">7 Days</div>
                    <div className="plan-price">Rs 499<span>/week</span></div>
                    <ul className="plan-features">
                      <li>7 Days Premium Status</li>
                      <li>Nearby Room Discovery</li>
                      <li>Verified Badge</li>
                      <li>Interactive Map View</li>
                    </ul>
                    <button
                      className="primary-cta"
                      style={{ marginTop: 'auto', width: '100%' }}
                      onClick={() => handlePurchasePremium('week')}
                      disabled={isPremiumLoading}
                    >
                      {isPremiumLoading ? 'Processing...' : 'Get 7 Days'}
                    </button>
                  </div>

                  <div className="premium-plan-card">
                    <div className="plan-name">1 Month</div>
                    <div className="plan-price">Rs 1499<span>/month</span></div>
                    <ul className="plan-features">
                      <li>30 Days Premium Status</li>
                      <li>Full Map Access</li>
                      <li>Featured Listing</li>
                      <li>24/7 Dedicated Support</li>
                    </ul>
                    <button
                      className="primary-cta"
                      style={{ marginTop: 'auto', width: '100%' }}
                      onClick={() => handlePurchasePremium('month')}
                      disabled={isPremiumLoading}
                    >
                      {isPremiumLoading ? 'Processing...' : 'Get 1 Month'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )
      }

      {
        currentView === 'messages' && user && (
          <div className="messages-container" style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
            <div className="messages-header">
              <h1 style={{ color: '#fff', marginBottom: '2rem' }}>Messages</h1>
            </div>

            <div className="glass-card" style={{ marginBottom: '1.5rem', padding: '1rem 1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
                <div>
                  <h3 style={{ margin: 0, color: '#fff' }}>Start a new chat</h3>
                  <p style={{ margin: '0.35rem 0 0', color: '#94a3b8', fontSize: '0.92rem' }}>
                    Search by name, email, or phone to message any logged-in user.
                  </p>
                </div>
                <div style={{ minWidth: '280px', flex: '1 1 360px' }}>
                  <input
                    type="text"
                    value={newChatQuery}
                    onChange={(e) => setNewChatQuery(e.target.value)}
                    placeholder="Search users to message..."
                    className="auth-input"
                    style={{ width: '100%' }}
                  />
                </div>
              </div>

              {newChatQuery.trim() && (
                <div style={{ marginTop: '1rem', display: 'grid', gap: '0.75rem' }}>
                  {filteredUsers.length > 0 ? filteredUsers.slice(0, 6).map((candidate) => (
                    <button
                      key={candidate.id}
                      type="button"
                      onClick={() => handleStartDirectChat(candidate)}
                      className="conversation-item"
                      style={{
                        width: '100%',
                        textAlign: 'left',
                        border: '1px solid rgba(255,255,255,0.08)',
                        background: 'rgba(255,255,255,0.03)',
                        cursor: 'pointer'
                      }}
                    >
                      <div className="conversation-avatar">
                        {candidate.fullName.charAt(0).toUpperCase()}
                      </div>
                      <div className="conversation-content">
                        <div className="conversation-name">{candidate.fullName}</div>
                        <div className="conversation-preview">{candidate.email}</div>
                      </div>
                    </button>
                  )) : (
                    <p style={{ margin: 0, color: '#94a3b8' }}>No users found for that search.</p>
                  )}
                </div>
              )}
            </div>

            <div className="messages-layout">
              {/* Conversations List */}
              <div className="conversations-panel">
                <div className="conversations-header">
                  <h3>Conversations</h3>
                </div>
                <div className="conversations-list">
                  {conversations.length === 0 ? (
                    <div className="empty-state">
                      <MessageCircle size={48} style={{ color: '#64748b', marginBottom: '1rem' }} />
                      <p style={{ color: '#64748b' }}>No conversations yet</p>
                      <p style={{ color: '#64748b', fontSize: '0.9rem' }}>Start chatting with room owners!</p>
                    </div>
                  ) : (
                    conversations.map((conversation) => (
                      <div
                        key={conversation.other_user_id}
                        className={`conversation-item ${selectedConversation?.other_user_id === conversation.other_user_id ? 'active' : ''}`}
                        onClick={() => handleSelectConversation(conversation)}
                      >
                        <div className="conversation-avatar">
                          {conversation.other_user_name.charAt(0).toUpperCase()}
                        </div>
                        <div className="conversation-content">
                          <div className="conversation-name">
                            {conversation.other_user_name}
                            {conversation.is_favorite && (
                              <span className="favorite-star">★</span>
                            )}
                            <button
                              className="conv-action fav-btn"
                              onClick={(e) => { e.stopPropagation(); handleToggleFavorite(conversation); }}
                              title={conversation.is_favorite ? 'Unfavorite' : 'Favorite'}
                            >
                              {conversation.is_favorite ? '⭐' : '☆'}
                            </button>
                            <button
                              className="conv-action delete-btn"
                              onClick={(e) => { e.stopPropagation(); handleDeleteConversation(conversation); }}
                              title="Delete conversation"
                            >
                              ✕
                            </button>
                            {conversation.unread_count > 0 && (
                              <span className="unread-indicator">{conversation.unread_count}</span>
                            )}
                          </div>
                          <div className="conversation-preview">
                            {conversation.room_title && (
                              <span className="room-context">{conversation.room_title}: </span>
                            )}
                            {conversation.last_message || 'No messages yet'}
                          </div>
                          <div className="conversation-time">
                            {new Date(conversation.last_message_at).toLocaleDateString()}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Messages Area */}
              <div className="messages-panel">
                {selectedConversation ? (
                  <>
                    <div className="messages-header">
                      <div className="chat-partner">
                        <div className="partner-avatar">
                          {selectedConversation.other_user_name.charAt(0).toUpperCase()}
                        </div>
                        <div className="partner-info">
                          <h4>{selectedConversation.other_user_name}</h4>
                          {selectedConversation.room_title && (
                            <p style={{ color: '#64748b', fontSize: '0.9rem' }}>
                              Regarding: {selectedConversation.room_title}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="messages-list">
                      {loadingMessages ? (
                        <div className="loading-state">
                          <div className="loading-spinner"></div>
                          <p>Loading messages...</p>
                        </div>
                      ) : messages.length === 0 ? (
                        <div className="empty-chat">
                          <MessageCircle size={48} style={{ color: '#64748b', marginBottom: '1rem' }} />
                          <p style={{ color: '#64748b' }}>No messages yet</p>
                          <p style={{ color: '#64748b', fontSize: '0.9rem' }}>Send the first message!</p>
                        </div>
                      ) : (
                        messages.map((message) => (
                          <div
                            key={message.id}
                            className={`message-item ${message.sender_id === user.id ? 'sent' : 'received'}`}
                          >
                            <div className="message-content">
                              <p>{message.content}</p>
                              <span className="message-time">
                                {new Date(message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                          </div>
                        ))
                      )}
                    </div>

                    <form className="message-input-form" onSubmit={handleSendMessage}>
                      <div className="message-input-container">
                        <input
                          type="text"
                          value={newMessage}
                          onChange={(e) => setNewMessage(e.target.value)}
                          placeholder="Type your message..."
                          className="message-input"
                          disabled={sendingMessage}
                        />
                        <button
                          type="submit"
                          className="send-message-btn"
                          disabled={!newMessage.trim() || sendingMessage}
                        >
                          {sendingMessage ? '...' : 'Send'}
                        </button>
                      </div>
                    </form>
                  </>
                ) : (
                  <div className="no-chat-selected">
                    <MessageCircle size={64} style={{ color: '#64748b', marginBottom: '1rem' }} />
                    <h3>Select a conversation</h3>
                    <p style={{ color: '#64748b' }}>Choose a conversation from the list to start messaging</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )
      }

      {/* Show normal content if not in docs/premium/details view */}
      {currentView !== 'docs' && currentView !== 'premium' && currentView !== 'room-details' && (
        <>
          {isAdmin && (
            <div className="dashboard-container admin-theme-wrapper">
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
                <div className="admin-tabs" style={{ marginBottom: 0, padding: '0.25rem', borderRadius: '12px' }}>
                  <button
                    className={`admin-tab ${roomListTab === 'all' ? 'active' : ''}`}
                    onClick={() => setRoomListTab('all')}
                    style={{ padding: '0.5rem 1rem', fontSize: '0.8rem' }}
                  >
                    All
                  </button>
                  <button
                    className={`admin-tab ${roomListTab === 'nearby' ? 'active' : ''} ${!user?.isPremium ? 'locked-tab' : ''}`}
                    onClick={() => {
                      if (user?.isPremium) {
                        setRoomListTab('nearby');
                      } else {
                        setCurrentView('premium');
                        // Optional: Scroll to top or show message
                      }
                    }}
                    style={{ padding: '0.5rem 1rem', fontSize: '0.8rem', position: 'relative' }}
                  >
                    Nearby {!user?.isPremium && '🔒'}
                  </button>
                  <button
                    className={`admin-tab ${roomListTab === 'map' ? 'active' : ''} ${!user?.isPremium ? 'locked-tab' : ''}`}
                    onClick={() => {
                      if (user?.isPremium) {
                        setRoomListTab('map');
                      } else {
                        setCurrentView('premium');
                      }
                    }}
                    style={{ padding: '0.5rem 1rem', fontSize: '0.8rem', position: 'relative' }}
                  >
                    Map {!user?.isPremium && '🔒'}
                  </button>
                </div>
              </div>

              {!user?.isPremium && roomListTab !== 'all' && (
                <div className="geolocation-banner">
                  <p style={{ margin: 0 }}>Discover rooms near you on an interactive map!</p>
                  <button className="primary-cta compact" onClick={() => setCurrentView('premium')}>Upgrade to Premium</button>
                </div>
              )}

              {roomListTab === 'map' && user?.isPremium && (
                <div className="map-container">
                  <MapContainer
                    center={[userLocation?.lat || 27.7172, userLocation?.lng || 85.3240]}
                    zoom={13}
                    scrollWheelZoom={false}
                  >
                    <TileLayer
                      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />
                    {(roomListTab === 'map' ? allRooms : nearbyRooms).map(room => (
                      room.latitude && room.longitude && (
                        <Marker key={room.id} position={[room.latitude, room.longitude]}>
                          <Popup>
                            <strong>{room.title}</strong><br />
                            Rs {room.price_per_month}/mo<br />
                            <button onClick={() => { setSelectedRoom(room); setCurrentView('room-details'); }}>Details</button>
                          </Popup>
                        </Marker>
                      )
                    ))}
                    {userLocation && (
                      <Marker position={[userLocation.lat, userLocation.lng]}>
                        <Popup>Your Location</Popup>
                      </Marker>
                    )}
                  </MapContainer>
                </div>
              )}

              {(roomListTab === 'all' ? filteredRooms : nearbyRooms).length === 0 ? (
                <p className="empty-state">
                  {roomListTab === 'nearby'
                    ? "No rooms found nearby. Try increasing the search radius or check your geolocation permissions."
                    : (searchQuery ? `No rooms found matching "${searchQuery}"` : "No rooms available at the moment.")
                  }
                </p>
              ) : roomListTab !== 'map' && (
                <div className="featured-grid">
                  {(roomListTab === 'all' ? filteredRooms : nearbyRooms).map((room) => (
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

                        {user && user.id !== room.owner_id && (
                          <button
                            className="message-owner-btn"
                            style={{ marginTop: '0.5rem', width: '100%' }}
                            onClick={() => handleStartChatWithOwner(room)}
                          >
                            💬 Message Owner
                          </button>
                        )}

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
                <section className={`glass-card auth-panel auth-modal__card ${isAuthMaximized ? 'auth-modal-maximized' : 'auth-modal-wide'}`}>
              <div className="modal-header-actions">
                    <button
                      type="button"
                      className="modal-maximize-btn"
                      onClick={() => setIsAuthMaximized(!isAuthMaximized)}
                      title={isAuthMaximized ? 'Minimize' : 'Maximize'}
                      aria-label={isAuthMaximized ? 'Minimize modal' : 'Maximize modal'}
                    >
                      {isAuthMaximized ? 'Min' : 'Max'}
                    </button>
                <button className="modal-close" onClick={closeModal} aria-label="Close dialog">
                  ×
                </button>
              </div>
              {activeModal === 'signup' ? (
                <>
                  <header>
                    <p className="eyebrow">Create account</p>
                    <h1>Sign up</h1>
                  </header>
                  <form className="auth-form" onSubmit={handleSignupSubmit}>
                    <div className="auth-switch-row">
                      <button
                        type="button"
                        className={`auth-switch-btn ${signupMethod === 'email' ? 'active' : ''}`}
                        onClick={() => {
                          setSignupMethod('email')
                          setSignupStep(1)
                          setSignupOtpCode('')
                        }}
                      >
                        Use Email
                      </button>
                      <button
                        type="button"
                        className={`auth-switch-btn ${signupMethod === 'phone' ? 'active' : ''}`}
                        onClick={() => {
                          setSignupMethod('phone')
                          setSignupStep(1)
                          setSignupOtpCode('')
                        }}
                      >
                        Use Phone
                      </button>
                    </div>
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
                    {signupMethod === 'email' ? (
                      <label>
                        <span>Email address</span>
                        <div className="auth-email-row">
                          <input type="email" name="email" value={signupData.email} onChange={handleSignupChange} placeholder="yourname@example.com" required pattern="[a-z0-9._%+-]+@[a-z0-9-]+(\.[a-z0-9-]+)+" />
                          {signupStep === 1 && (
                            <button type="button" className="ghost-cta mini auth-send-otp-btn" onClick={handleSignupRequestOtp} disabled={signupLoading}>
                              {signupLoading ? 'Sending...' : 'Send OTP'}
                            </button>
                          )}
                        </div>
                      </label>
                    ) : (
                      <label>
                        <span>Phone number</span>
                        <div className="auth-phone-row">
                          <select value={authCountryCode} onChange={(e) => setAuthCountryCode(e.target.value)}>
                            {COUNTRY_CODES.map((country) => (
                              <option key={country.code} value={country.code}>{country.label}</option>
                            ))}
                          </select>
                          <input
                            name="phoneNumber"
                            value={signupData.phoneNumber}
                            onChange={handleSignupChange}
                            required
                            placeholder="10-digit number"
                          />
                        </div>
                      </label>
                    )}
                    {signupMethod === 'email' && (
                      <p className="form-hint">
                        Step 1: send a code to the email you entered. Step 2: enter that code to finish signup.
                      </p>
                    )}
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
                            {showSignupPassword ? "Hide" : "Show"}
                        </button>
                      </div>
                    </label>

                    {signupMethod === 'email' && signupStep === 2 && (
                      <label>
                        <span>Verification code</span>
                        <input
                          name="otp"
                          value={signupOtpCode}
                          onChange={(event) => setSignupOtpCode(event.target.value)}
                          placeholder="6-digit code"
                          inputMode="numeric"
                          required
                        />
                      </label>
                    )}

                    {signupMethod !== 'email' || signupStep === 2 ? (
                      <button className="primary-cta" type="submit" disabled={signupLoading}>
                        {signupLoading ? (signupMethod === 'email' ? 'Verifying code...' : 'Creating account...') : (signupMethod === 'email' ? 'Sign Up' : 'Create account')}
                      </button>
                    ) : (
                      <p className="form-hint">Click Send OTP first, then enter the code to finish signup.</p>
                    )}
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
                    <div className="auth-switch-row">
                      <button
                        type="button"
                        className={`auth-switch-btn ${loginMethod === 'email' ? 'active' : ''}`}
                        onClick={() => setLoginMethod('email')}
                      >
                        Login with Email
                      </button>
                      <button
                        type="button"
                        className={`auth-switch-btn ${loginMethod === 'phone' ? 'active' : ''}`}
                        onClick={() => setLoginMethod('phone')}
                      >
                        Login with Phone
                      </button>
                    </div>
                    <label>
                      <span>{loginMethod === 'phone' ? 'Phone number' : 'Email address'}</span>
                      {loginMethod === 'phone' ? (
                        <div className="auth-phone-row">
                          <select value={authCountryCode} onChange={(e) => setAuthCountryCode(e.target.value)}>
                            {COUNTRY_CODES.map((country) => (
                              <option key={country.code} value={country.code}>{country.label}</option>
                            ))}
                          </select>
                          <input name="credential" value={loginData.credential} onChange={handleLoginChange} placeholder="10-digit number" required />
                        </div>
                      ) : (
                        <input type="email" name="credential" value={loginData.credential} onChange={handleLoginChange} placeholder="yourname@example.com" required />
                      )}
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
                            {showLoginPassword ? "Hide" : "Show"}
                        </button>
                      </div>
                    </label>

                    <button className="primary-cta" type="submit" disabled={loginLoading}>
                      {loginLoading ? 'Signing in...' : 'Login'}
                    </button>
                  </form>
                  <div className="auth-forgot-box">
                    <div className="auth-forgot-intro">
                      <div>
                        <h3>Forgot your Password?</h3>
                        <p>Open the reset container to continue.</p>
                      </div>
                      <button
                        type="button"
                        className="ghost-cta mini auth-forgot-open-btn"
                        onClick={() => setForgotPasswordStep(2)}
                      >
                        Open
                      </button>
                    </div>
                    {forgotPasswordStep === 2 && (
                      <div className="auth-forgot-overlay" role="region" aria-label="Password reset panel">
                        <div className="auth-forgot-reset-panel">
                          <button
                            type="button"
                            className="auth-forgot-back-btn"
                            onClick={() => setForgotPasswordStep(1)}
                          >
                            Previous
                          </button>
                          <div className="auth-forgot-grid">
                            <input
                              name="email"
                              type="email"
                              value={forgotPasswordData.email}
                              onChange={handleForgotPasswordInput}
                              placeholder="yourname@example.com"
                            />
                            <button type="button" className="ghost-cta mini" onClick={handleForgotPasswordRequest} disabled={passwordActionLoading}>
                              Send Verification
                            </button>
                          </div>
                          <form onSubmit={handleForgotPasswordVerify} className="auth-form" style={{ marginTop: '0.75rem' }}>
                            <input name="token" value={forgotPasswordData.token} onChange={handleForgotPasswordInput} placeholder="Verification token" required />
                            <input name="newPassword" type="password" value={forgotPasswordData.newPassword} onChange={handleForgotPasswordInput} placeholder="New password" required />
                            <input name="confirmPassword" type="password" value={forgotPasswordData.confirmPassword} onChange={handleForgotPasswordInput} placeholder="Confirm new password" required />
                            <button className="primary-cta" type="submit" disabled={passwordActionLoading}>Reset Password</button>
                          </form>
                        </div>
                      </div>
                    )}
                  </div>
                  {loginMessage && (
                    <p className={`form-feedback ${loginMessage.type === 'success' ? 'success' : 'error'}`}>
                      {loginMessage.text}
                    </p>
                  )}
                  {passwordActionMessage && (
                    <p className={`form-feedback ${passwordActionMessage.type === 'success' ? 'success' : 'error'}`}>
                      {passwordActionMessage.text}
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
                        onClick={() => { setAccountTab('inquiries'); fetchUserInquiries(inquiryView); }}
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
                      <button
                        className={`pro-nav-item ${accountTab === 'billings' ? 'active' : ''}`}
                        onClick={() => { setAccountTab('billings'); fetchUserBills(); }}
                      >
                        <span className="pro-nav-icon">📜</span> Billings & Plans
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
                          </div>
                          <div className="pro-form-actions" style={{ display: 'flex', gap: '1rem' }}>
                            <button type="submit" className="pro-button-primary">Save Changes</button>
                            <button
                              type="button"
                              className="pro-button-secondary ghost"
                              onClick={async () => {
                                if (!user) return
                                setIsPremiumLoading(true)
                                try {
                                  const response = await fetch(`${API_BASE_URL}/auth/profile/${user.id}`)
                                  const payload = await response.json()
                                  if (response.ok) {
                                    const updatedUser = payload.user
                                    setUser(updatedUser)
                                    localStorage.setItem('shelter_user', JSON.stringify(updatedUser))
                                    alert("Status synced successfully! Your premium features are up to date.")
                                  } else {
                                    alert(payload.message || "Failed to sync status.")
                                  }
                                } catch (error) {
                                  console.error("Sync error:", error)
                                  alert("Network error while syncing status.")
                                } finally {
                                  setIsPremiumLoading(false)
                                }
                              }}
                            >
                              Sync Status
                            </button>
                          </div>
                        </form>

                        <div className="profile-password-box">
                          <h3>Change Password Using Current Password</h3>
                          <form className="pro-form" onSubmit={handlePasswordChangeSubmit}>
                            <div className="pro-form-row">
                              <div className="pro-field">
                                <label>Current Password</label>
                                <input name="currentPassword" type="password" value={changePasswordData.currentPassword} onChange={handleChangePasswordInput} required />
                              </div>
                              <div className="pro-field">
                                <label>New Password</label>
                                <input name="newPassword" type="password" value={changePasswordData.newPassword} onChange={handleChangePasswordInput} required />
                              </div>
                            </div>
                            <div className="pro-form-row">
                              <div className="pro-field">
                                <label>Confirm New Password</label>
                                <input name="confirmPassword" type="password" value={changePasswordData.confirmPassword} onChange={handleChangePasswordInput} required />
                              </div>
                              <div className="pro-field" />
                            </div>
                            <button type="submit" className="pro-button-primary" disabled={passwordActionLoading}>Update Password</button>
                          </form>
                        </div>

                        <div className="profile-password-box">
                          <h3>Reset Password via Email Verification</h3>
                          <p>Send verification to email, then paste token and set your new password.</p>
                          <div className="auth-forgot-grid" style={{ marginBottom: '0.75rem' }}>
                            <input
                              name="email"
                              type="email"
                              value={forgotPasswordData.email}
                              onChange={handleForgotPasswordInput}
                              placeholder="yourname@example.com"
                            />
                            <button type="button" className="pro-button-secondary" onClick={handleForgotPasswordRequest} disabled={passwordActionLoading}>
                              Send Verification
                            </button>
                          </div>
                          <form onSubmit={handleForgotPasswordVerify} className="pro-form">
                            <div className="pro-form-row">
                              <div className="pro-field">
                                <label>Verification Token</label>
                                <input name="token" value={forgotPasswordData.token} onChange={handleForgotPasswordInput} required />
                              </div>
                              <div className="pro-field">
                                <label>New Password</label>
                                <input name="newPassword" type="password" value={forgotPasswordData.newPassword} onChange={handleForgotPasswordInput} required />
                              </div>
                            </div>
                            <div className="pro-form-row">
                              <div className="pro-field">
                                <label>Confirm New Password</label>
                                <input name="confirmPassword" type="password" value={forgotPasswordData.confirmPassword} onChange={handleForgotPasswordInput} required />
                              </div>
                              <div className="pro-field" />
                            </div>
                            <button type="submit" className="pro-button-primary" disabled={passwordActionLoading}>Verify and Reset</button>
                          </form>
                        </div>

                        {passwordActionMessage && (
                          <p className={`form-feedback ${passwordActionMessage.type === 'success' ? 'success' : 'error'}`}>
                            {passwordActionMessage.text}
                          </p>
                        )}
                      </div>
                    )}

                    {accountTab === 'inquiries' && (
                      <div className="pro-section">
                        <header className="pro-section-header">
                          <h2>Recent Inquiries</h2>
                          <p>{inquiryView === 'sent' ? "Messages you've sent regarding rooms" : 'Inquiries received on your rooms'}</p>
                        </header>
                        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
                          <button
                            className="ghost-cta mini"
                            onClick={() => { setInquiryView('sent'); fetchUserInquiries('sent'); }}
                            type="button"
                            style={{ opacity: inquiryView === 'sent' ? 1 : 0.75 }}
                          >
                            Sent
                          </button>
                          <button
                            className="ghost-cta mini"
                            onClick={() => { setInquiryView('received'); fetchUserInquiries('received'); }}
                            type="button"
                            style={{ opacity: inquiryView === 'received' ? 1 : 0.75 }}
                          >
                            Received
                          </button>
                        </div>
                        {userInquiries.length === 0 ? (
                          <div className="pro-empty-state">
                            <span className="pro-empty-icon">📂</span>
                            <p>{inquiryView === 'sent' ? "You haven't sent any inquiries yet." : "No inquiries received for your rooms yet."}</p>
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
                                  {inquiryView === 'sent' ? (
                                    <span>Sent as: <strong>{inq.sender_name}</strong></span>
                                  ) : (
                                    <span>From: <strong>{inq.sender_name}</strong> ({inq.sender_email})</span>
                                  )}
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
                    {accountTab === 'billings' && (
                      <div className="pro-section">
                        <header className="pro-section-header">
                          <h2>Billings & History</h2>
                          <p>Manage your manual activations and view past transactions</p>
                        </header>
                        {userBills.length === 0 ? (
                          <div className="pro-empty-state">
                            <span className="pro-empty-icon">📜</span>
                            <p>No billing records found. Purchase a plan to see it here.</p>
                          </div>
                        ) : (
                          <div className="pro-bill-list">
                            {userBills.map(bill => (
                              <div key={bill.id} className={`pro-bill-card ${bill.is_activated ? 'activated' : ''}`}>
                                <div className="pro-bill-main">
                                  <div className="pro-bill-info">
                                    <div className="pro-bill-title-row">
                                      <h4>Premium {bill.plan_type === 'day' ? '24 Hours' : bill.plan_type === 'week' ? '7 Days' : '1 Month'} Plan</h4>
                                      <span className={`pro-status-chip ${bill.is_activated ? 'status-active' : 'status-pending'}`}>
                                        {bill.is_activated ? 'Activated' : 'Wait for Activation'}
                                      </span>
                                    </div>
                                    <p className="pro-bill-meta">
                                      <span>💰 Rs {bill.amount}</span>
                                      <span>📅 Paid: {new Date(bill.paid_at).toLocaleString()}</span>
                                    </p>
                                    {bill.is_activated && (
                                      <p className="pro-bill-activation-meta">
                                        <span>🚀 Activated: {new Date(bill.activated_at).toLocaleString()}</span>
                                        <span className="pro-expiry">⌛ Expires: {new Date(bill.expires_at).toLocaleString()}</span>
                                      </p>
                                    )}
                                  </div>
                                  {!bill.is_activated && (
                                    <button
                                      className="pro-activate-btn"
                                      onClick={() => handleActivateBill(bill.id)}
                                      disabled={isPremiumLoading}
                                    >
                                      {isPremiumLoading ? 'Activating...' : 'Activate Plan'}
                                    </button>
                                  )}
                                </div>
                                <div className="pro-bill-footer">
                                  <code>ID: {bill.transaction_uuid}</code>
                                </div>
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
                        <div className="room-payment-banner">
                          <strong>Room listing fee: Rs 99</strong>
                          <span>
                            Listing is submitted directly. Payment gateway opens after submit for showcase.
                          </span>
                        </div>
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
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                          <label>
                            <span>Latitude</span>
                            <input name="latitude" value={roomData.latitude} onChange={handleRoomChange} placeholder="e.g. 27.7172" />
                          </label>
                          <label>
                            <span>Longitude</span>
                            <input name="longitude" value={roomData.longitude} onChange={handleRoomChange} placeholder="e.g. 85.3240" />
                          </label>
                        </div>
                        <button
                          type="button"
                          className="ghost-cta mini"
                          style={{ width: '100%', marginTop: '0.5rem' }}
                          onClick={() => {
                            if (navigator.geolocation) {
                              navigator.geolocation.getCurrentPosition((pos) => {
                                setRoomData(prev => ({
                                  ...prev,
                                  latitude: pos.coords.latitude.toString(),
                                  longitude: pos.coords.longitude.toString()
                                }))
                              })
                            }
                          }}
                        >
                          📍 Detect My Current Location
                        </button>
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
            </section>
          </div>
        )
      }
    </div >
  )
}

export default App
