import { useState, type FC } from 'react'

const featurePillars = [
  {
    title: 'Smart discovery',
    copy: 'Filter by vibe, availability, and amenities with silky smooth iPhone-style controls.',
    icon: 'sparkle',
  },
  {
    title: 'Direct connect',
    copy: 'Built-in rounded chat bubbles, owner cards, and visit scheduling keep conversations flowing.',
    icon: 'chat',
  },
  {
    title: 'Safe community',
    copy: 'Admin verification, notices, and analytics keep every listing transparent and trustworthy.',
    icon: 'shield',
  },
]

const featuredRooms = [
  {
    title: 'Palm Courtyard Room',
    location: 'Harbor District',
    price: '$58 / night',
    tags: ['Furnished', 'AC', 'Wi-Fi'],
    status: 'Available',
  },
  {
    title: 'Nordic Light Suite',
    location: 'Elm Street',
    price: '$910 / mo',
    tags: ['Double', 'Workspace'],
    status: 'Available',
  },
  {
    title: 'Serenity Pod',
    location: 'Garden Avenue',
    price: '$540 / mo',
    tags: ['Single', 'Non-AC', 'Laundry'],
    status: 'Booked',
  },
]

const testimonials = [
  {
    quote:
      'UT feels like booking on a flagship iPhone app. Everything is silky smooth—filters, chat, even the map search.',
    name: 'Mara Jensen',
    role: 'Product Researcher & Seeker',
  },
  {
    quote: 'I listed two rooms and had quality leads in hours. The admin approvals keep everything trustworthy.',
    name: 'Kelvin Ortiz',
    role: 'Owner & Architect',
  },
]

const Icon: FC<{ name: string }> = ({ name }) => {
  switch (name) {
    case 'sparkle':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 3v6m0 6v6M3 12h6m6 0h6" />
          <path d="M16 8l2-2m-10 0L6 6m0 12-2 2m12 0 2 2" />
        </svg>
      )
    case 'chat':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M7 9h10M7 13h6" />
          <path d="M5 4h14a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-4l-4 3v-3H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z" />
        </svg>
      )
    case 'shield':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 3 5 6v6c0 4.4 3 8.6 7 9 4-.4 7-4.6 7-9V6Z" />
          <path d="M9 12l2 2 4-4" />
        </svg>
      )
    default:
      return null
  }
}

const StatusChip: FC<{ label: string }> = ({ label }) => (
  <span className={`status-chip ${label === 'Available' ? 'chip-available' : 'chip-booked'}`}>{label}</span>
)

const App: FC = () => {
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login')

  return (
    <div className="shelter-shell">
      <div className="hero-glow" aria-hidden="true" />
      <div className="hero-glow secondary" aria-hidden="true" />
      <main className="home-screen">
        <header className="hero">
          <div className="hero-copy">
            <span className="hero-pill">Premium iPhone-style rental hub</span>
            <h1>
              SHELTER is home, <span>simplified.</span>
            </h1>
            <p>
              Curated rooms, cinematic visuals, and glassmorphic workflows unite owners and seekers. Discover, chat, and
              request visits—all on a single, smooth landing page.
            </p>
            <div className="hero-stats">
              <div>
                <strong>18k+</strong>
                <span>Active seekers</span>
              </div>
              <div>
                <strong>3.4k</strong>
                <span>Verified owners</span>
              </div>
              <div>
                <strong>4.9/5</strong>
                <span>Experience score</span>
              </div>
            </div>
          </div>
          <div className="auth-panel">
            <div className="auth-tabs" role="tablist">
              <button
                type="button"
                className={authMode === 'login' ? 'tab active' : 'tab'}
                onClick={() => setAuthMode('login')}
              >
                Login
              </button>
              <button
                type="button"
                className={authMode === 'signup' ? 'tab active' : 'tab'}
                onClick={() => setAuthMode('signup')}
              >
                Sign up
              </button>
            </div>
            {authMode === 'login' ? (
              <form className="auth-form" aria-label="Login form">
                <label className="input-field">
                  <span>Email</span>
                  <input type="email" placeholder="you@shelter.com" />
                </label>
                <label className="input-field">
                  <span>Password</span>
                  <input type="password" placeholder="••••••••" />
                </label>
                <div className="form-row">
                  <label className="chip-toggle mini">
                    <input type="checkbox" /> Remember me
                  </label>
                  <button type="button" className="link-btn">
                    Forgot?
                  </button>
                </div>
                <button type="submit" className="primary-cta full">
                  Login
                </button>
              </form>
            ) : (
              <form className="auth-form" aria-label="Signup form">
                <label className="input-field">
                  <span>Full name</span>
                  <input type="text" placeholder="Avery Collins" />
                </label>
                <label className="input-field">
                  <span>Email</span>
                  <input type="email" placeholder="you@shelter.com" />
                </label>
                <label className="input-field">
                  <span>Password</span>
                  <input type="password" placeholder="Create a password" />
                </label>
                <div className="role-selector">
                  <p>Join as</p>
                  <div className="chip-group">
                    <label>
                      <input type="radio" name="role" defaultChecked /> Room seeker
                    </label>
                    <label>
                      <input type="radio" name="role" /> Room owner
                    </label>
                  </div>
                </div>
                <button type="submit" className="primary-cta full">
                  Create account
                </button>
              </form>
            )}
            <div className="auth-footer">
              <p>Admin verified listings, smooth onboarding, premium UX.</p>
            </div>
          </div>
        </header>

        <section className="search-teaser" aria-label="Search teaser">
          <div className="glass-card search-card">
            <div>
              <label>Location</label>
              <span>Try “Central City”</span>
            </div>
            <div>
              <label>Budget</label>
              <span>$400 - $900</span>
            </div>
            <div>
              <label>Stay Type</label>
              <span>Short & long term</span>
            </div>
            <button className="primary-cta compact">Explore</button>
          </div>
        </section>

        <section className="pillars">
          {featurePillars.map((pillar) => (
            <article key={pillar.title} className="glass-card pillar-card">
              <div className="icon-wrap">
                <Icon name={pillar.icon} />
              </div>
              <h3>{pillar.title}</h3>
              <p>{pillar.copy}</p>
              <button className="ghost-cta mini">Discover</button>
            </article>
          ))}
        </section>

        <section className="featured">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Smart picks</p>
              <h2>Curated rooms near you</h2>
            </div>
            <button className="chip-toggle">Smart suggestions • ON</button>
          </div>
          <div className="featured-grid">
            {featuredRooms.map((room) => (
              <article key={room.title} className="glass-card room-card">
                <div className="room-image" aria-hidden="true" />
                <div className="room-content">
                  <div className="room-row">
                    <h3>{room.title}</h3>
                    <StatusChip label={room.status} />
                  </div>
                  <p>{room.location}</p>
                  <div className="room-row">
                    <span className="price">{room.price}</span>
                    <div className="tag-row">
                      {room.tags.map((tag) => (
                        <span key={tag}>{tag}</span>
                      ))}
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="testimonials">
          <div className="glass-card testimonial-card">
            <div className="avatar-stack" aria-hidden="true">
              <span />
              <span />
              <span />
            </div>
            <div className="testimonial-copy">
              {testimonials.map((item) => (
                <blockquote key={item.name}>
                  <p>“{item.quote}”</p>
                  <footer>
                    {item.name} — <span>{item.role}</span>
                  </footer>
                </blockquote>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="footer">
        <div className="footer-wave" aria-hidden="true" />
        <div className="footer-content">
          <p>SHELTER • Room rentals made cinematic.</p>
          <div className="footer-links">
            <a href="#features">Features</a>
            <a href="#listings">Listings</a>
            <a href="#contact">Contact</a>
          </div>
          <button className="primary-cta compact">Join the waitlist</button>
        </div>
      </footer>
    </div>
  )
}

export default App

