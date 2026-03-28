import { useNavigate } from 'react-router-dom';
import { ChefHat, Flame, UtensilsCrossed, Star, ArrowRight, Instagram } from 'lucide-react';
import './Landing.css';

export default function Landing() {
  const navigate = useNavigate();

  return (
    <div className="landing">
      {/* Navigation */}
      <nav className="landing-nav">
        <div className="landing-nav-inner">
          <div className="landing-logo">
            <span className="logo-mark">H</span>
            <span className="logo-text">ByHadMade</span>
          </div>
          <div className="landing-nav-links">
            <a href="https://www.instagram.com/byhadmade/" target="_blank" rel="noopener noreferrer" className="nav-social">
              <Instagram size={18} />
            </a>
            <button className="btn btn-primary btn-sm" onClick={() => navigate('/login')}>
              Sign In
            </button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="hero">
        <div className="hero-bg">
          <div className="hero-grain"></div>
          <div className="hero-gradient"></div>
        </div>
        <div className="hero-content">
          <div className="hero-badge">
            <Flame size={14} />
            <span>Crafted with Passion</span>
          </div>
          <h1 className="hero-title">
            <span className="hero-title-line">Where Flavor</span>
            <span className="hero-title-line hero-title-accent">Meets Artistry</span>
          </h1>
          <p className="hero-subtitle">
            Handcrafted recipes, curated menus, and culinary experiences
            born from a deep love for authentic cooking.
          </p>
          <div className="hero-actions">
            <button className="btn btn-primary btn-lg" onClick={() => navigate('/login')}>
              Enter Kitchen
              <ArrowRight size={18} />
            </button>
            <a
              href="https://www.instagram.com/byhadmade/"
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-glass btn-lg"
            >
              <Instagram size={18} />
              Follow the Journey
            </a>
          </div>
        </div>

        {/* Floating elements */}
        <div className="hero-float hero-float-1">
          <ChefHat size={32} />
        </div>
        <div className="hero-float hero-float-2">
          <UtensilsCrossed size={28} />
        </div>
        <div className="hero-float hero-float-3">
          <Star size={24} />
        </div>
      </section>

      {/* Features */}
      <section className="features">
        <div className="features-inner">
          <div className="features-header">
            <h2 className="section-title">The Craft Behind the Kitchen</h2>
            <p className="section-subtitle">Every dish tells a story. Every ingredient has a purpose.</p>
          </div>
          <div className="features-grid">
            <div className="feature-card">
              <div className="feature-icon">
                <ChefHat size={28} />
              </div>
              <h3>Handcrafted Recipes</h3>
              <p>Each recipe is developed, tested, and perfected with care. From classic comfort food to innovative fusion dishes.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">
                <UtensilsCrossed size={28} />
              </div>
              <h3>Curated Menus</h3>
              <p>Thoughtfully composed menus that balance flavors, textures, and presentation for an unforgettable dining experience.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">
                <Flame size={28} />
              </div>
              <h3>Passion Driven</h3>
              <p>Cooking isn't just a skill, it's a way of life. Every plate is an expression of dedication and love for the craft.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Quote Section */}
      <section className="quote-section">
        <div className="quote-inner">
          <blockquote className="quote">
            <span className="quote-mark">"</span>
            <p>Cooking is an art, and patience is a virtue. Great food comes from the heart.</p>
          </blockquote>
        </div>
      </section>

      {/* Instagram CTA */}
      <section className="cta-section">
        <div className="cta-inner">
          <div className="cta-content">
            <h2>Follow the Culinary Journey</h2>
            <p>Discover new recipes, behind-the-scenes moments, and daily inspiration on Instagram.</p>
            <a
              href="https://www.instagram.com/byhadmade/"
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-primary btn-lg"
            >
              <Instagram size={20} />
              @byhadmade
            </a>
          </div>
          <div className="cta-decoration">
            <div className="cta-circle cta-circle-1"></div>
            <div className="cta-circle cta-circle-2"></div>
            <div className="cta-circle cta-circle-3"></div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="landing-footer">
        <div className="footer-inner">
          <div className="footer-logo">
            <span className="logo-mark">H</span>
            <span className="logo-text">ByHadMade</span>
          </div>
          <p className="footer-text">Handcrafted with love.</p>
          <a
            href="https://www.instagram.com/byhadmade/"
            target="_blank"
            rel="noopener noreferrer"
            className="footer-social"
          >
            <Instagram size={18} />
          </a>
        </div>
      </footer>
    </div>
  );
}
